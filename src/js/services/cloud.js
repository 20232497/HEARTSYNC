/* 계정 저장(CLOUD): KV를 계정 kv 표에 모아 올리고 받기, 기기별 설정 분리 */
import { emit, on } from "../core/events.js";
import { isTomb } from "../core/room-list.js";
import { goneRooms } from "../core/rooms.js";
import { shelfSyncOn } from "../core/shelf.js";
import { KV } from "../core/storage.js";
import { toast } from "../core/util.js";
import { cloudSettings } from "./cloud-settings.js";
import { applyRows, pullRows, retakeRows } from "./cloud-pull.js";
import { SB } from "./supabase.js";

/* KV ↔ 계정 동기화. 쓰기는 KV.set → put()이 키마다 0.8초 모아 upsert(지우기는 DELETE).
   읽기는 그림(img…)을 뺀 키를 받아 이 기기에 씀 — 처음 로그인하면 전부, 그 뒤엔 updated_at이 바뀐 것만. 그림(페르소나 사진)은 IMG.load가 필요할 때 한 장씩.
   이 기기에서 아직 못 올린 키(pending)와 올리는 중인 키(sending)는 받은 값으로 덮지 않음. 설정은 "settings" 키(글자 크기·Enter로 보내기는 기기마다 따로) */
/* 계정과 주고받는 KV 키. 예전 빌드가 남긴 행(그림 묶음·내 작품·잠근 키·따로 두던 장기기억 설정 memcfg 등)은 받지도 올리지도 않음 —
   장기기억 설정은 설정("settings" 행)의 한 칸으로만 다님(2026-11-23, core/settings.js) */
export const SYNCED_RE = /^(wallet|personas|rooms|room-.+)$/;
/* 내 서재(찜·최근 본·수집 기록)는 정해진 날짜부터만 계정과 주고받음(shelfSyncOn) — 그 전에는 이 기기에만. 다른 키와 달리 받은 값으로 덮지 않고 합침(takeShelf) */
export const SHELF_KEY = "shelf";
export const synced = (k) => SYNCED_RE.test(k) || (k === SHELF_KEY && shelfSyncOn());
/* 지운 방의 키면 본문 대신 삭제 표식을 올림 — 표식을 받기 전에 시작한 저장·전송이 뒤늦게 끝나면서 계정의 표식을 본문으로 덮지 않게(대기열에 넣을 때·되돌려 넣을 때·보낸 뒤에 봄) */
const tombFor = (k, x) => {
  if (!x || k.indexOf("room-") !== 0 || isTomb(x.v)) return x;
  const at = goneRooms()[k.slice(5)];
  return at ? { v: { gone: at } } : x;
};
export const IMG_KEY_RE = /^img[a-z0-9]{6,30}$/;
/**
 * 계정 저장(Supabase kv 표). start()/stop() 로그인·로그아웃 때 · put(k, v) 0.8초 모아 upsert(KV.remote 고리) · flush() 바로 올리고 결과를 돌려줌(한 번에 하나) ·
 * pull() → Promise<number> 바뀐 행 받아 적용
 * getOne(k) 그림 본문 받기 · 계정 데이터 지우기는 services/cloud-wipe.js(wipeAccount — 끝나면 wiped를 켬) · state: ""|"sync"|"ok"|"err"|"notable"("cloud" 이벤트)
 */
export const CLOUD = {
  on: false,
  uid: null,
  pending: {},
  busy: null, // 지금 도는 전송의 줄(Promise) — flush()가 뒤에 이어 붙임
  sending: new Set(), // 지금 올리는 중인 키(send가 채우고 비움)
  skipped: new Set(), // 열려 있어서 덮지 않고 넘어간 방의 키 — 방에서 나오면 다시 받음(retake)
  seq: 0, // 이 기기에서 값을 바꿀 때마다 올라가는 번호
  putSeq: {}, // 키 → 마지막으로 바꾼 때의 번호. 받기를 시작한 뒤에 바뀐 키는 그 받기의 값으로 덮지 않음(받는 사이 저장하고 올리기까지 끝나면 pending·sending에는 흔적이 없음)
  owed: null, // 처음 올리기(pushAll)가 덜 끝남: { keys } — 올리려던 키(null이면 이 기기의 것 전부). 대기열에 넣기 전에 실패하면 대기열에는 흔적이 없어, 로그아웃이 이것을 보고 다시 올림
  timer: null,
  state: "",
  at: 0,
  pulledAt: 0,
  noTable: false,
  wiped: false, // 계정 데이터를 지운 뒤(wipe) — 이 화면에서는 더 올리지 않음(곧 새로고침)
  first: false, // 처음 로그인 맞추기(firstSync) 중 — 바뀐 행 받기(pull)를 미룸(ui/login.js afterLogin이 켜고 끔)
  shelfUp: false,
  skipKey() {
    return "hv1_cloudskip_" + this.uid;
  },
  // 다시 받을 방을 적거나(on) 지움 — 새로고침 뒤에도 남게 localStorage에도(받은 자리 표시는 localStorage에 남는데 이것만 사라지면 그 변경이 다시 오지 않음)
  skip(k, on = true) {
    if (on) this.skipped.add(k);
    else this.skipped.delete(k);
    try {
      if (this.skipped.size) localStorage.setItem(this.skipKey(), JSON.stringify([...this.skipped]));
      else localStorage.removeItem(this.skipKey());
    } catch {}
  },
  // 아직 계정에 올리지 못한 삭제 표식(키 → 지운 때). 대기열은 메모리에만 있어 올리기 전에 새로고침하면 지움이 이 기기에만 남으므로, localStorage에도 적어 두고
  // 다음에 계정에 연결할 때 다시 올림. set을 주면 그것으로 바꿔 적음
  tombs(set) {
    const key = "hv1_cloudtomb_" + this.uid;
    try {
      if (!set) return JSON.parse(localStorage.getItem(key) || "{}") || {};
      if (Object.keys(set).length) localStorage.setItem(key, JSON.stringify(set));
      else localStorage.removeItem(key);
    } catch {}
    return set || {};
  },
  lastKey() {
    return "hv1_cloudlast_" + this.uid;
  },
  start() {
    this.on = SB.on() && !!(SB.s && SB.s.user && SB.s.user.id);
    this.uid = this.on ? SB.s.user.id : null;
    this.noTable = false;
    this.wiped = false;
    this.shelfUp = false;
    // 새로고침 뒤에도 기억하는 둘: 덜 끝난 처음 올리기(owed — 올릴 키와 함께)와 다시 받을 방(skipped)
    this.owed = null;
    this.skipped = new Set();
    if (this.on)
      try {
        const o = JSON.parse(localStorage.getItem("hv1_cloudowed") || "null");
        if (o && o.uid === this.uid) this.owed = { keys: Array.isArray(o.keys) ? o.keys : null };
        this.skipped = new Set(JSON.parse(localStorage.getItem(this.skipKey()) || "[]"));
        // 다른 기기의 초기화를 따라 이 기기를 지우고 새로고침했으면 알림(services/cloud-wipe.js takeWipe)
        if (localStorage.getItem("hv1_wipenote")) {
          localStorage.removeItem("hv1_wipenote");
          toast("다른 기기에서 모든 데이터를 초기화해서, 이 기기의 대화·하트·페르소나도 지웠어요");
        }
      } catch {}
    // 지난번에 올리지 못한 삭제 표식을 다시 대기열에
    if (this.on) {
      const t = this.tombs();
      Object.keys(t).forEach((k) => {
        this.pending[k] = { v: { gone: t[k] } };
      });
      if (Object.keys(t).length) {
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.flush(), 800);
      }
    }
  },
  stop() {
    this.on = false;
    this.uid = null;
    this.wiped = false;
    this.pending = {};
    this.sending = new Set();
    this.skipped = new Set();
    this.putSeq = {};
    this.owed = null;
    clearTimeout(this.timer);
    this.setState("");
  },
  setState(s) {
    this.state = s;
    if (s === "ok") this.at = Date.now();
    emit("cloud");
  },
  put(k, v) {
    if (!this.on || this.noTable || this.wiped || !(k === "settings" || synced(k) || IMG_KEY_RE.test(k))) return;
    const x = v === undefined ? null : tombFor(k, { v });
    this.pending[k] = x;
    if (x && isTomb(x.v)) {
      const t = this.tombs();
      if (!t[k]) {
        t[k] = x.v.gone;
        this.tombs(t); // 올라간 것을 확인할 때까지 기억(send가 지움)
      }
    }
    this.putSeq[k] = ++this.seq;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 800);
  },
  // 응답이 실패면 던짐. 오류 본문은 8초까지만 기다리고(머리만 오고 본문이 멈추면 전송의 줄이 영영 안 풀림), 기다리는 사이 계정이 바뀌었으면 '표 없음' 판정을 켜지 않음
  async check(r) {
    if (r.ok) return;
    const uid = this.uid,
      j = await Promise.race([r.json().catch(() => ({})), new Promise((res) => setTimeout(() => res({}), 8000))]);
    if (this.uid !== uid) throw j;
    if (r.status === 404 || j.code === "PGRST205" || j.code === "42P01") {
      this.noTable = true;
      this.setState("notable");
    }
    throw j;
  },
  /**
   * 모아 둔 것을 지금 올림. **전송은 한 번에 하나** — 도는 것이 있으면 그것이 끝난 뒤에 이어서 돎(겹쳐 돌면 늦게 끝난 옛 값이 새 값을 덮고,
   * 로그아웃이 '보낼 것 없음'으로 보고 도는 전송을 기다리지 않음). 로그아웃·'지금 동기화'는 돌려준 결과를 보고 다음 일을 정함(ui/account.js).
   * @returns {Promise<"ok"|"left"|"notable"|"off">} ok 남은 것 없음 · left 못 올린 것이 남음(15초 뒤 다시 시도) · notable 계정 저장 표가 없음 · off 계정 연결이 꺼짐
   */
  flush() {
    clearTimeout(this.timer);
    const next = () => KV.settled().then(() => this.send()); // 진행 중인 방 본문 저장이 끝나 대기열에 들어온 뒤에 보냄(본문은 큰 저장소에 쓰인 뒤에야 올림)
    return (this.busy = (this.busy || Promise.resolve()).then(next, next));
  },
  // 전송 한 차례 — flush()의 줄에서만 부름. 시작할 때의 계정(uid)이 도는 사이 바뀌면(로그아웃·다른 계정) 남은 요청·되돌려 넣기·상태 갱신을 모두 버림
  async send() {
    const uid = this.uid,
      gone = () => this.uid !== uid;
    if (!this.on || this.wiped) return "off";
    if (this.noTable) return "notable";
    const items = Object.entries(this.pending);
    if (!items.length) return "ok";
    this.pending = {};
    this.sending = new Set(items.map((x) => x[0])); // 올리는 중인 키 — 그사이 받은 옛 값으로 이 기기를 덮지 않게(apply)
    this.setState("sync");
    // 요청 하나: 보내기 전과 응답을 받은 뒤에 계정을 다시 봄 — 바뀌었으면 응답을 해석하지 않고 그만둠(다른 계정에 '표 없음' 판정을 켜지 않게)
    const call = async (path, opts) => {
      if (gone()) throw 0;
      const r = await SB.req(path, opts);
      if (gone()) throw 0;
      await this.check(r);
    };
    try {
      const ups = items.filter((x) => x[1]).map(([key, x]) => ({ user_id: uid, key, value: x.v }));
      const dels = items.filter((x) => !x[1]).map((x) => x[0]);
      // 그림이 섞이면 요청이 커지므로 1.5MB씩
      for (const batch of chunkBy(ups, 1500000))
        await call("/rest/v1/kv?on_conflict=user_id,key", {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify(batch)
        });
      // 지우기에는 계정 조건을 붙임 — 요청이 토큰 갱신을 기다리는 사이 다른 계정으로 바뀌어도 그 계정의 행을 지우지 않게
      for (let i = 0; i < dels.length; i += 40) {
        const keys = dels
          .slice(i, i + 40)
          .map((k) => '"' + k.replace(/"/g, "") + '"')
          .join(",");
        await call("/rest/v1/kv?user_id=eq." + encodeURIComponent(uid) + "&key=in.(" + encodeURIComponent(keys) + ")", { method: "DELETE" });
      }
      this.sending = new Set();
      // 올라간 삭제 표식은 '못 올린 표식'에서 지우고, 보낸 본문이 그사이 지운 방의 것이면 표식을 이어서 올림(본문이 계정의 표식을 덮었을 수 있음)
      const t = this.tombs();
      let changed = false;
      items.forEach(([k, x]) => {
        if (x && isTomb(x.v) && t[k]) {
          delete t[k];
          changed = true;
        }
      });
      if (changed) this.tombs(t);
      items.forEach(([k, x]) => {
        const y = tombFor(k, x);
        if (y !== x && !(k in this.pending)) this.put(k, y.v); // put이 '못 올린 표식'에도 적음 — 위에서 지운 뒤라 덮이지 않음
      });
      this.setState("ok");
      // 도는 사이 새로 바뀐 것이 있으면 이어서 올림 — "ok"는 남은 것이 없다는 뜻이어야 함(로그아웃이 이 결과를 보고 기기를 지움)
      return Object.keys(this.pending).length ? this.send() : "ok";
    } catch (e) {
      if (gone()) return "off";
      this.sending = new Set();
      // 못 올린 것은 되돌려 두고(그사이 새로 바뀐 값이 있으면 그게 우선) 15초 뒤 다시
      items.forEach(([k, x]) => {
        if (!(k in this.pending)) this.pending[k] = tombFor(k, x); // 그사이 지운 방의 본문이면 표식으로
      });
      if (this.noTable) {
        this.pending = {};
        return "notable";
      }
      this.setState("err");
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.flush(), 15000);
      return "left";
    }
  },
  // 계정의 행 읽기(그림 제외). since가 있으면 그 뒤에 바뀐 것만. 1000행 제한이 있어 500행씩
  async rows(since) {
    const out = [];
    for (let off = 0; ; off += 500) {
      let q = "/rest/v1/kv?select=key,value,updated_at&key=not.like.img*&order=updated_at.asc&limit=500&offset=" + off;
      if (since) q += "&updated_at=gt." + encodeURIComponent(since);
      const r = await SB.req(q);
      await this.check(r);
      const part = await r.json();
      out.push(...part);
      if (part.length < 500) return out;
    }
  },
  // 계정에 있는 그림 키(예전 빌드의 그림 칸 연결 imgpacks 행은 이름이 img로 시작해 뺌)
  async imgKeys() {
    const out = [];
    for (let off = 0; ; off += 1000) {
      const r = await SB.req("/rest/v1/kv?select=key&key=like.img*&key=neq.imgpacks&limit=1000&offset=" + off);
      await this.check(r);
      const part = await r.json();
      out.push(...part.map((x) => x.key));
      if (part.length < 1000) return out;
    }
  },
  async getOne(k) {
    if (!this.on || this.noTable) return undefined;
    try {
      const r = await SB.req("/rest/v1/kv?select=value&key=eq." + encodeURIComponent(k));
      if (!r.ok) return undefined;
      const j = await r.json();
      return j[0] ? j[0].value : undefined;
    } catch {
      return undefined;
    }
  },
  // 받기(받은 행 적용·다시 받기·바뀐 행 받기)는 services/cloud-pull.js에 — 여기서는 이름만 이어 줌
  apply(rows, hold, since) {
    return applyRows(rows, hold, since);
  },
  retake() {
    return retakeRows();
  },
  pull() {
    return pullRows();
  }
};
function chunkBy(items, max) {
  const out = [];
  let cur = [],
    size = 0;
  items.forEach((x) => {
    const n = JSON.stringify(x).length;
    if (cur.length && size + n > max) {
      out.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(x);
    size += n;
  });
  if (cur.length) out.push(cur);
  return out;
}
// core가 services를 모르게 고리로 꽂음: KV.set → 계정에도, 설정 저장 → "settings" 행
KV.remote = (k, v) => CLOUD.put(k, v);
on("settings", () => CLOUD.put("settings", cloudSettings()));
