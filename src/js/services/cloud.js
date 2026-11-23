/* 계정 저장(CLOUD): KV를 계정 kv 표에 모아 올리고 받기, 기기별 설정 분리 */
import { emit, on } from "../core/events.js";
import { roomInUse, roomKey } from "../core/rooms.js";
import { mergeShelf, shelfSyncOn } from "../core/shelf.js";
import { S, room, setRoom } from "../core/state.js";
import { KV } from "../core/storage.js";
import { cloudSettings, mergeCloudSettings } from "./cloud-settings.js";
import { SB } from "./supabase.js";

/* KV ↔ 계정 동기화. 쓰기는 KV.set → put()이 키마다 0.8초 모아 upsert(지우기는 DELETE).
   읽기는 그림(img…)을 뺀 키를 받아 이 기기에 씀 — 처음 로그인하면 전부, 그 뒤엔 updated_at이 바뀐 것만. 그림(페르소나 사진)은 IMG.load가 필요할 때 한 장씩.
   이 기기에서 아직 못 올린 키(pending)와 올리는 중인 키(sending)는 받은 값으로 덮지 않음. 설정은 "settings" 키(글자 크기·Enter로 보내기는 기기마다 따로) */
/* 계정과 주고받는 KV 키. 예전 빌드가 남긴 행(그림 묶음·내 작품·잠근 키·따로 두던 장기기억 설정 memcfg 등)은 받지도 올리지도 않음 —
   장기기억 설정은 설정("settings" 행)의 한 칸으로만 다님(2026-11-23, core/settings.js) */
const SYNCED_RE = /^(wallet|personas|rooms|room-.+)$/;
/* 내 서재(찜·최근 본·수집 기록)는 정해진 날짜부터만 계정과 주고받음(shelfSyncOn) — 그 전에는 이 기기에만. 다른 키와 달리 받은 값으로 덮지 않고 합침(takeShelf) */
const SHELF_KEY = "shelf";
export const synced = (k) => SYNCED_RE.test(k) || (k === SHELF_KEY && shelfSyncOn());
/* 응답 생성·요약이 아직 쓰고 있는 방의 키인지(core/rooms.js roomInUse) — 그 일이 끝나면 들고 있던 방을 저장하므로 받은 것으로 덮지 않고 미룸 */
const using = (k) => k.indexOf("room-") === 0 && roomInUse(k.slice(5));
export const IMG_KEY_RE = /^img[a-z0-9]{6,30}$/;
/**
 * 계정 저장(Supabase kv 표). start()/stop() 로그인·로그아웃 때 · put(k, v) 0.8초 모아 upsert(KV.remote 고리) · flush() 바로 올리고 결과를 돌려줌(한 번에 하나) ·
 * pull() → Promise<number> 바뀐 행 받아 적용
 * getOne(k) 그림 본문 받기 · wipe() 계정 행 전부 삭제 · state: ""|"sync"|"ok"|"err"|"notable"("cloud" 이벤트)
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
  owed: false, // 처음 올리기(pushAll)가 덜 끝남 — 그림을 대기열에 넣기 전에 실패하면 대기열에는 흔적이 없어, 로그아웃이 이 표시를 보고 다시 올림
  timer: null,
  state: "",
  at: 0,
  pulledAt: 0,
  noTable: false,
  shelfUp: false,
  lastKey() {
    return "hv1_cloudlast_" + this.uid;
  },
  start() {
    this.on = SB.on() && !!(SB.s && SB.s.user && SB.s.user.id);
    this.uid = this.on ? SB.s.user.id : null;
    this.noTable = false;
    this.shelfUp = false;
    try {
      this.owed = this.on && localStorage.getItem("hv1_cloudowed") === this.uid; // 새로고침 뒤에도 기억
    } catch {}
  },
  stop() {
    this.on = false;
    this.uid = null;
    this.pending = {};
    this.sending = new Set();
    this.skipped = new Set();
    this.putSeq = {};
    this.owed = false;
    clearTimeout(this.timer);
    this.setState("");
  },
  setState(s) {
    this.state = s;
    if (s === "ok") this.at = Date.now();
    emit("cloud");
  },
  put(k, v) {
    if (!this.on || this.noTable || !(k === "settings" || synced(k) || IMG_KEY_RE.test(k))) return;
    this.pending[k] = v === undefined ? null : { v };
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
    const next = () => this.send();
    return (this.busy = (this.busy || Promise.resolve()).then(next, next));
  },
  // 전송 한 차례 — flush()의 줄에서만 부름. 시작할 때의 계정(uid)이 도는 사이 바뀌면(로그아웃·다른 계정) 남은 요청·되돌려 넣기·상태 갱신을 모두 버림
  async send() {
    const uid = this.uid,
      gone = () => this.uid !== uid;
    if (!this.on) return "off";
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
      this.setState("ok");
      // 도는 사이 새로 바뀐 것이 있으면 이어서 올림 — "ok"는 남은 것이 없다는 뜻이어야 함(로그아웃이 이 결과를 보고 기기를 지움)
      return Object.keys(this.pending).length ? this.send() : "ok";
    } catch (e) {
      if (gone()) return "off";
      this.sending = new Set();
      // 못 올린 것은 되돌려 두고(그사이 새로 바뀐 값이 있으면 그게 우선) 15초 뒤 다시
      items.forEach(([k, x]) => {
        if (!(k in this.pending)) this.pending[k] = x;
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
  // 받은 행을 이 기기에 씀. 열려 있는 대화방은 덮지 않음(대화 중에 바뀌면 헷갈림). 바뀐 키 수를 돌려줌.
  // hold: 이 받기를 시작할 때 올리는 중이던 키 — 받는 사이 올리기가 끝나도, 그 전에 읽힌 옛 값으로 덮지 않음(pull이 넘김).
  // since: 이 받기를 시작할 때의 번호(this.seq) — 그 뒤에 이 기기에서 바뀐 키도 덮지 않음. 없으면 처음 로그인의 전부 받기(firstSync)
  apply(rows, hold, since) {
    const full = since === undefined,
      newer = (k) => !full && (this.putSeq[k] || 0) > since;
    let n = 0;
    const open = room && location.hash === "#r-" + room.id ? roomKey(room.id) : "";
    rows.forEach((x) => {
      if (x.updated_at && x.updated_at > (localStorage.getItem(this.lastKey()) || ""))
        try {
          localStorage.setItem(this.lastKey(), x.updated_at);
        } catch {}
      if (x.key === SHELF_KEY) {
        if (shelfSyncOn() && this.takeShelf(x.value)) n++;
        return;
      } // 보내지 못한 것이 있어도 합침
      if (x.key in this.pending || this.sending.has(x.key) || (hold && hold.has(x.key)) || newer(x.key)) return; // 이 기기의 값이 올라가(올라갔거나) 계정 것을 대신함
      if (x.key === open || using(x.key)) {
        this.skipped.add(x.key); // 받은 자리 표시(커서)는 이미 이 행을 지나갔으므로 적어 두었다가 방에서 나오면(쓰던 일이 끝나면) 다시 받음
        return;
      }
      if (x.key === "settings") {
        mergeCloudSettings(x.value);
        n++;
        return;
      }
      // 예전 빌드가 따로 올리던 장기기억 설정 행: 처음 로그인의 전부 받기에서, 계정의 설정 행에 그 칸이 없을 때만 받아 설정으로 옮김(지금은 설정의 한 칸으로만 다님 —
      // 예전 행만 남은 계정에서 값을 잃지 않게). 바뀐 것만 받는 때에는 보지 않음 — 예전 빌드가 이 행만 고쳐도 지금 설정을 덮지 않게
      if (x.key === "memcfg") {
        if (full && x.value && typeof x.value === "object" && !rows.some((y) => y.key === "settings" && y.value && y.value.memCfg)) {
          mergeCloudSettings({ memCfg: x.value });
          n++;
        }
        return;
      }
      if (!SYNCED_RE.test(x.key)) return;
      KV.setLocal(x.key, x.value === null ? undefined : x.value);
      if (room && x.key === roomKey(room.id)) setRoom(null); // 메모리에 든 옛 사본을 놓음 — 그대로 두면 그 방을 다시 열 때 옛 사본이 쓰이고, 저장하면 받은 것을 덮음
      n++;
    });
    this.pulledAt = Date.now();
    return n;
  },
  // 계정의 서재와 이 기기의 서재를 합침: 이 기기에만 있던 것은 계정으로 올리고, 이 기기 값이 바뀌었으면 true
  takeShelf(remote) {
    const local = KV.getLocal(SHELF_KEY),
      m = mergeShelf(local, remote),
      s = JSON.stringify(m);
    if (s !== JSON.stringify(mergeShelf(remote))) this.put(SHELF_KEY, m);
    if (s === JSON.stringify(mergeShelf(local))) return false;
    KV.setLocal(SHELF_KEY, m);
    S.shelf = m;
    return true;
  },
  /**
   * 열려 있어서 넘어간 방(skipped)을 다시 받음 — 방에서 나온 뒤(boot.js의 화면 이동)와 받기(pull) 앞에 부름. 아직 열려 있는 방은 계속 보류,
   * 이 기기에 못 올린 변경이 있는 방은 그 값이 계정으로 올라가므로 받지 않음, 요청이 실패하면 다음에 다시. @returns {Promise<number>} 다시 받은 수
   */
  async retake() {
    const uid = this.uid,
      isOpen = (k) => !!room && location.hash === "#r-" + room.id && roomKey(room.id) === k;
    let n = 0;
    for (const k of [...this.skipped]) {
      if (!this.on || this.uid !== uid) break;
      if (isOpen(k) || using(k)) continue;
      this.skipped.delete(k);
      if (k in this.pending || this.sending.has(k)) continue;
      const since = this.seq;
      let got = null;
      try {
        const r = await SB.req("/rest/v1/kv?select=value&key=eq." + encodeURIComponent(k));
        if (r.ok) got = await r.json();
      } catch {}
      if (this.uid !== uid) break;
      if (!got || isOpen(k) || using(k)) {
        this.skipped.add(k); // 못 받았거나 그사이 다시 열었으면 다음에
        continue;
      }
      if (!got[0] || k in this.pending || this.sending.has(k) || (this.putSeq[k] || 0) > since) continue; // 계정에 그 방이 없거나, 그사이 이 기기에서 고침(올리기까지 끝났어도)
      KV.setLocal(k, got[0].value);
      if (room && roomKey(room.id) === k) setRoom(null);
      n++;
    }
    return n;
  },
  async pull() {
    const hold = new Set(this.sending),
      since = this.seq,
      again = await this.retake();
    let n = again + this.apply(await this.rows(localStorage.getItem(this.lastKey()) || ""), hold, since);
    // 로그인한 뒤(또는 날짜가 된 뒤) 처음 한 번: 바뀐 행만 받는 pull에는 서재 행이 안 올 수 있어 따로 받아 합침 — 날짜 전에 이 기기에만 쌓인 것이 이때 계정으로
    if (!this.shelfUp && shelfSyncOn()) {
      this.shelfUp = true;
      if (this.takeShelf(await this.getOne(SHELF_KEY))) n++;
    }
    return n;
  },
  async wipe() {
    if (this.on && !this.noTable) {
      this.pending = {};
      await SB.req("/rest/v1/kv?user_id=eq." + encodeURIComponent(this.uid), { method: "DELETE" });
    }
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
