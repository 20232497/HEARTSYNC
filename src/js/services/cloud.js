/* 계정 저장(CLOUD): KV를 계정 kv 표에 모아 올리고 받기, 기기별 설정 분리 */
import { emit, on } from "../core/events.js";
import { roomKey } from "../core/rooms.js";
import { mergeShelf, shelfSyncOn } from "../core/shelf.js";
import { S, room } from "../core/state.js";
import { IDB, KV } from "../core/storage.js";
import { ago } from "../core/util.js";
import { validRef } from "./images.js";
import { SB } from "./supabase.js";
/** @typedef {import("../core/types.js").Settings} Settings */

/* KV ↔ 계정 동기화. 쓰기는 KV.set → put()이 키마다 0.8초 모아 upsert(지우기는 DELETE).
   읽기는 그림(img…)을 뺀 키를 받아 이 기기에 씀 — 처음 로그인하면 전부, 그 뒤엔 updated_at이 바뀐 것만. 그림(페르소나 사진)은 IMG.load가 필요할 때 한 장씩.
   이 기기에서 아직 못 올린 키(pending)는 받은 값으로 덮지 않음. 설정은 "settings" 키(글자 크기·Enter로 보내기는 기기마다 따로) */
const DEVICE_SETTINGS = ["fs", "enterSend"];
/* API 키 칸은 계정에 올리지 않음 — 서버 표의 kv_no_plain_keys 제약도 settings에 이 칸이 있으면 거부. 예전 빌드의 그림·성인 키 칸도 기기에 남아 있을 수 있어 함께 뺌 */
const KEY_FIELDS = ["apiKey", "runwareKey", "openRouterKey"];
/* 계정과 주고받는 KV 키. 예전 빌드가 남긴 행(그림 묶음·내 작품·잠근 키 등)은 받지도 올리지도 않음 */
const SYNCED_RE = /^(wallet|personas|rooms|memcfg|room-.+)$/;
/* 내 서재(찜·최근 본·수집 기록)는 정해진 날짜부터만 계정과 주고받음(shelfSyncOn) — 그 전에는 이 기기에만. 다른 키와 달리 받은 값으로 덮지 않고 합침(takeShelf) */
const SHELF_KEY = "shelf";
const synced = (k) => SYNCED_RE.test(k) || (k === SHELF_KEY && shelfSyncOn());
const IMG_KEY_RE = /^img[a-z0-9]{6,30}$/;
/**
 * 계정 저장(Supabase kv 표). start()/stop() 로그인·로그아웃 때 · put(k, v) 0.8초 모아 upsert(KV.remote 고리) · flush() 바로 올림 · pull() → Promise<number> 바뀐 행 받아 적용
 * getOne(k) 그림 본문 받기 · pushAll(keys) 처음 로그인에 기기 데이터 올리기 · wipe() 계정 행 전부 삭제 · state: ""|"sync"|"ok"|"err"|"notable"("cloud" 이벤트)
 */
export const CLOUD = {
  on: false, uid: null, pending: {}, timer: null, state: "", at: 0, pulledAt: 0, noTable: false, shelfUp: false,
  lastKey() { return "hv1_cloudlast_" + this.uid; },
  start() { this.on = SB.on() && !!(SB.s && SB.s.user && SB.s.user.id); this.uid = this.on ? SB.s.user.id : null; this.noTable = false; this.shelfUp = false; },
  stop() { this.on = false; this.uid = null; this.pending = {}; clearTimeout(this.timer); this.setState(""); },
  setState(s) { this.state = s; if (s === "ok") this.at = Date.now(); emit("cloud"); },
  put(k, v) {
    if (!this.on || this.noTable || !(k === "settings" || synced(k) || IMG_KEY_RE.test(k))) return;
    this.pending[k] = v === undefined ? null : { v };
    clearTimeout(this.timer); this.timer = setTimeout(() => this.flush(), 800);
  },
  async check(r) {
    if (r.ok) return;
    const j = await r.json().catch(() => ({}));
    if (r.status === 404 || j.code === "PGRST205" || j.code === "42P01") { this.noTable = true; this.setState("notable"); }
    throw j;
  },
  async flush() {
    clearTimeout(this.timer);
    const items = Object.entries(this.pending);
    if (!items.length || !this.on || this.noTable) return;
    this.pending = {}; this.setState("sync");
    try {
      const ups = items.filter((x) => x[1]).map(([key, x]) => ({ user_id: this.uid, key, value: x.v }));
      const dels = items.filter((x) => !x[1]).map((x) => x[0]);
      for (const batch of chunkBy(ups, 1500000)) // 그림이 섞이면 요청이 커지므로 1.5MB씩
        await this.check(await SB.req("/rest/v1/kv?on_conflict=user_id,key", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(batch) }));
      for (let i = 0; i < dels.length; i += 40)
        await this.check(await SB.req("/rest/v1/kv?key=in.(" + encodeURIComponent(dels.slice(i, i + 40).map((k) => '"' + k.replace(/"/g, "") + '"').join(",")) + ")", { method: "DELETE" }));
      this.setState("ok");
    } catch (e) {
      // 못 올린 것은 되돌려 두고(그사이 새로 바뀐 값이 있으면 그게 우선) 15초 뒤 다시
      items.forEach(([k, x]) => { if (!(k in this.pending)) this.pending[k] = x; });
      if (this.noTable) { this.pending = {}; return; }
      this.setState("err"); this.timer = setTimeout(() => this.flush(), 15000);
    }
  },
  // 계정의 행 읽기(그림 제외). since가 있으면 그 뒤에 바뀐 것만. 1000행 제한이 있어 500행씩
  async rows(since) {
    const out = [];
    for (let off = 0; ; off += 500) {
      let q = "/rest/v1/kv?select=key,value,updated_at&key=not.like.img*&order=updated_at.asc&limit=500&offset=" + off;
      if (since) q += "&updated_at=gt." + encodeURIComponent(since);
      const r = await SB.req(q); await this.check(r);
      const part = await r.json(); out.push(...part);
      if (part.length < 500) return out;
    }
  },
  // 계정에 있는 그림 키(예전 빌드의 그림 칸 연결 imgpacks 행은 이름이 img로 시작해 뺌)
  async imgKeys() {
    const out = [];
    for (let off = 0; ; off += 1000) {
      const r = await SB.req("/rest/v1/kv?select=key&key=like.img*&key=neq.imgpacks&limit=1000&offset=" + off); await this.check(r);
      const part = await r.json(); out.push(...part.map((x) => x.key));
      if (part.length < 1000) return out;
    }
  },
  async getOne(k) {
    if (!this.on || this.noTable) return undefined;
    try { const r = await SB.req("/rest/v1/kv?select=value&key=eq." + encodeURIComponent(k)); if (!r.ok) return undefined; const j = await r.json(); return j[0] ? j[0].value : undefined; } catch { return undefined; }
  },
  // 받은 행을 이 기기에 씀. 열려 있는 대화방은 덮지 않음(대화 중에 바뀌면 헷갈림). 바뀐 키 수를 돌려줌
  apply(rows) {
    let n = 0;
    const open = room && location.hash === "#r-" + room.id ? roomKey(room.id) : "";
    rows.forEach((x) => {
      if (x.updated_at && x.updated_at > (localStorage.getItem(this.lastKey()) || "")) try { localStorage.setItem(this.lastKey(), x.updated_at); } catch {}
      if (x.key === SHELF_KEY) { if (shelfSyncOn() && this.takeShelf(x.value)) n++; return; } // 보내지 못한 것이 있어도 합침
      if (x.key in this.pending || x.key === open) return;
      if (x.key === "settings") { mergeCloudSettings(x.value); n++; return; }
      if (!SYNCED_RE.test(x.key)) return;
      KV.setLocal(x.key, x.value === null ? undefined : x.value); n++;
    });
    this.pulledAt = Date.now();
    return n;
  },
  // 계정의 서재와 이 기기의 서재를 합침: 이 기기에만 있던 것은 계정으로 올리고, 이 기기 값이 바뀌었으면 true
  takeShelf(remote) {
    const local = KV.getLocal(SHELF_KEY), m = mergeShelf(local, remote), s = JSON.stringify(m);
    if (s !== JSON.stringify(mergeShelf(remote))) this.put(SHELF_KEY, m);
    if (s === JSON.stringify(mergeShelf(local))) return false;
    KV.setLocal(SHELF_KEY, m); S.shelf = m;
    return true;
  },
  async pull() {
    let n = this.apply(await this.rows(localStorage.getItem(this.lastKey()) || ""));
    // 로그인한 뒤(또는 날짜가 된 뒤) 처음 한 번: 바뀐 행만 받는 pull에는 서재 행이 안 올 수 있어 따로 받아 합침 — 날짜 전에 이 기기에만 쌓인 것이 이때 계정으로
    if (!this.shelfUp && shelfSyncOn()) { this.shelfUp = true; if (this.takeShelf(await this.getOne(SHELF_KEY))) n++; }
    return n;
  },
  // 이 기기의 모든 데이터를 계정에 올림(계정이 비었을 때·합칠 때). 그림은 계정에 없는 것만 한 장씩 읽어 묶어 보냄
  // (그림 본문은 IndexedDB에, IndexedDB가 막힌 브라우저에서는 localStorage에 있음)
  async pushAll(keys) {
    (keys || localKVKeys()).forEach((k) => { const v = KV.getLocal(k); if (v !== undefined) this.pending[k] = { v }; });
    this.pending.settings = { v: cloudSettings() };
    await this.flush();
    const have = new Set(await this.imgKeys());
    let ls = []; try { ls = Object.keys(localStorage).filter((k) => k.indexOf("hv1_img") === 0).map((k) => k.slice(4)); } catch {}
    const mine = Array.from(new Set((await IDB.keys()).concat(ls))).filter((k) => IMG_KEY_RE.test(k) && !have.has(k));
    let batch = [], size = 0;
    const send = async () => { if (!batch.length) return; await this.check(await SB.req("/rest/v1/kv?on_conflict=user_id,key", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(batch) })); batch = []; size = 0; };
    for (const k of mine) {
      let v = await IDB.get(k); if (typeof v !== "string") v = KV.getLocal(k);
      if (typeof v !== "string" || !validRef(v)) continue;
      batch.push({ user_id: this.uid, key: k, value: v }); size += v.length;
      if (size > 1500000) await send();
    }
    await send();
    this.setState("ok");
  },
  async wipe() { if (this.on && !this.noTable) { this.pending = {}; await SB.req("/rest/v1/kv?user_id=eq." + encodeURIComponent(this.uid), { method: "DELETE" }); } }
};
function chunkBy(items, max) {
  const out = []; let cur = [], size = 0;
  items.forEach((x) => { const n = JSON.stringify(x).length; if (cur.length && size + n > max) { out.push(cur); cur = []; size = 0; } cur.push(x); size += n; });
  if (cur.length) out.push(cur);
  return out;
}
// core가 services를 모르게 고리로 꽂음: KV.set → 계정에도, 설정 저장 → "settings" 행
KV.remote = (k, v) => CLOUD.put(k, v);
on("settings", () => CLOUD.put("settings", cloudSettings()));
// 이 기기 KV 키 중 계정과 주고받는 것(그림은 pushAll이 따로, 설정은 "settings" 키로 따로)
function localKVKeys() {
  try { return Object.keys(localStorage).filter((k) => k.indexOf("hv1_") === 0).map((k) => k.slice(4)).filter(synced); } catch { return []; }
}
/** 계정에 올릴 설정 — 기기별 칸(fs·enterSend)과 API 키 칸은 뺌(서버 제약 kv_no_plain_keys). @returns {Partial<Settings>} */
export function cloudSettings() {
  const s = Object.assign({}, S.settings);
  DEVICE_SETTINGS.concat(KEY_FIELDS).forEach((k) => delete s[k]);
  return s;
}
function mergeCloudSettings(v) {
  if (!v || typeof v !== "object") return;
  const keep = {};
  DEVICE_SETTINGS.concat(KEY_FIELDS).forEach((k) => { if (k in S.settings) keep[k] = S.settings[k]; });
  const next = Object.assign({}, S.settings, v, keep);
  delete next.keysLocal;
  S.settings = next;
  try { localStorage.setItem("hv1_settings", JSON.stringify(S.settings)); } catch {}
}
/** MY → 계정에 보이는 동기화 상태 글. @returns {string} */
export function cloudStateText() {
  if (!CLOUD.on) return "";
  if (CLOUD.state === "notable") return "⚠️ 계정 저장 표가 아직 없어요 (docs/supabase.sql을 실행해 주세요)";
  if (CLOUD.state === "err") return "⚠️ 계정에 저장하지 못했어요. 잠시 뒤 다시 시도해요";
  if (CLOUD.state === "sync") return "저장하는 중…";
  return CLOUD.at ? "계정에 저장됨 · " + ago(CLOUD.at) : "계정과 연결됨";
}
