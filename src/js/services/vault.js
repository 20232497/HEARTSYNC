/* API 키 금고(VAULT): 비밀번호·암호로 만든 키로 AES-GCM 암호화해 계정에 저장 */
import { emit, on } from "../core/events.js";
import { saveSettings } from "../core/settings.js";
import { S, hasClaudeKey } from "../core/state.js";
import { CLOUD } from "./cloud.js";
import { SB } from "./supabase.js";

/* API 키 금고(사용자 요청 2026-11 — 키가 계정 서버에 평문으로 남지 않게): Anthropic·Runware·OpenRouter 키는 "settings" 행에 넣지 않고,
   로그인 비밀번호로 이 기기에서 만든 잠금 키(PBKDF2-SHA256 60만 번, 소금은 사용자 id)로 AES-GCM 암호화해 "vault" 행에만 올림.
   서버·관리자는 비밀번호를 모르니 키를 볼 수 없음. 잠금 키는 이 기기 localStorage(hv1_vault_<uid>)에만 — 키 원문도 이 기기에 있으니 더 약해지지 않음.
   비밀번호 없이 들어온 기기(다른 기기에서 연 인증 메일 링크)는 MY → 계정에서 비밀번호를 한 번 넣어야 풀림.
   비밀번호가 없는 계정(카카오·네이버·구글로만 가입)은 '키 잠금 암호'를 따로 정함 — 서버가 확인해 줄 수 없으니 계정의 잠금(kid)과 맞을 때만 받아들임(phraseSheet).
   비밀번호를 재설정하면 새 잠금(kid)으로 다시 올림. 예전 잠금을 가진 기기는 같은 kid일 때만 고치는 PATCH라 덮어쓰지 못하고 '비밀번호 입력'을 띄움 */
export const VAULT_FIELDS = ["apiKey", "runwareKey", "openRouterKey"];
/**
 * API 키 금고 — 키를 로그인 비밀번호(또는 키 잠금 암호)로 기기에서 만든 잠금 키로 AES-GCM 암호화해 계정 "vault" 행에만 올림(서버는 못 봄).
 * fromPassword(pw, uid)/fromPhrase(phrase, uid, box) 잠금 키 만들기 · save() 바뀐 키 올리기(같은 kid일 때만) · take(box, merge) 계정 값을 기기에 · clearField(f) 키 한 칸만 지움 · drop() 행 삭제 · state: ""|"ok"|"locked"|"stale"("vault" 이벤트)
 */
export const VAULT = {
  rec: null, ck: null, state: "", timer: null, fresh: false, // rec { uid, k(잠금 키 base64), kid, seen(마지막으로 계정과 맞춘 키 묶음의 해시) }
  ok() { return !!(window.crypto && crypto.subtle && window.TextEncoder); },
  // 비밀번호가 없는 계정(소셜 로그인만 연결됨) — 키 잠금 암호를 씀. 같은 이메일로 이메일 가입도 연결돼 있으면 비밀번호
  phrase() { const u = SB.s && SB.s.user; if (!u) return false; const ps = u.providers && u.providers.length ? u.providers : u.provider ? [u.provider] : []; return ps.length > 0 && ps.indexOf("email") < 0; },
  load(uid) {
    if (this.rec && this.rec.uid === uid) return; // 방금 비밀번호로 만든 잠금은 그대로(fresh 유지)
    this.ck = null; this.fresh = false; this.state = "";
    try { const r = JSON.parse(localStorage.getItem("hv1_vault_" + uid) || "null"); this.rec = r && r.k && r.kid && r.uid === uid ? r : null; } catch { this.rec = null; }
  },
  store() { if (this.rec) try { localStorage.setItem("hv1_vault_" + this.rec.uid, JSON.stringify(this.rec)); } catch {} },
  forget() { this.rec = null; this.ck = null; this.fresh = false; this.state = ""; clearTimeout(this.timer); this.timer = null; try { Object.keys(localStorage).filter((k) => k.indexOf("hv1_vault_") === 0).forEach((k) => localStorage.removeItem(k)); } catch {} },
  setState(s) { this.state = s; emit("vault"); },
  async derive(secret, uid) {
    const enc = new TextEncoder();
    const base = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "PBKDF2" }, false, ["deriveBits"]);
    const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode("heartverse-vault:" + uid), iterations: 600000 }, base, 256));
    return { k: b64(bits), kid: b64(new Uint8Array(await crypto.subtle.digest("SHA-256", bits))).replace(/[+/=]/g, "").slice(0, 16) };
  },
  use(d, uid, fresh) {
    // seen(마지막으로 계정과 맞춘 키 묶음)은 잠금이 바뀌어도 이어 감 — 잠긴 사이 이 기기에서 바꾼 키를 알아보려고
    this.rec = { uid, k: d.k, kid: d.kid, seen: this.rec && this.rec.uid === uid ? this.rec.seen : null };
    this.ck = null; this.fresh = fresh; this.state = ""; this.store();
  },
  // 서버가 비밀번호를 확인해 준 직후에만 부름(로그인·가입·재설정·잠금 풀기)
  async fromPassword(password, uid) {
    if (!this.ok() || !uid || !password) return false;
    try { this.use(await this.derive(password, uid), uid, true); return true; } catch { return false; }
  },
  // 키 잠금 암호: 계정에 잠긴 키(box)가 있으면 그 잠금과 같을 때만(틀린 암호로 계정 키를 덮지 않게 fresh도 켜지 않음). box가 없으면 처음 정하는 것
  async fromPhrase(phrase, uid, box) {
    if (!this.ok() || !uid || !phrase) return false;
    try { const d = await this.derive(phrase, uid); if (box && box.kid !== d.kid) return false; this.use(d, uid, false); return true; } catch { return false; }
  },
  unset() { if (this.rec) try { localStorage.removeItem("hv1_vault_" + this.rec.uid); } catch {} this.rec = null; this.ck = null; this.fresh = false; this.state = ""; },
  async key() { if (!this.ck) this.ck = await crypto.subtle.importKey("raw", unb64(this.rec.k), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]); return this.ck; },
  async seal(o) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await this.key(), new TextEncoder().encode(JSON.stringify(o))));
    return { v: 1, kid: this.rec.kid, iv: b64(iv), ct: b64(ct) };
  },
  async open(box) { return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(box.iv) }, await this.key(), unb64(box.ct)))); },
  pick() { const o = {}; VAULT_FIELDS.forEach((f) => { o[f] = typeof S.settings[f] === "string" ? S.settings[f] : ""; }); return o; },
  canWrite() { return CLOUD.on && !CLOUD.noTable && S.settings.syncKeys !== false && !!this.rec && this.ok(); },
  save() { if (!this.canWrite() || this.state === "stale") return; clearTimeout(this.timer); this.timer = setTimeout(() => { this.timer = null; this.write().catch(() => {}); }, 800); },
  // force: 비밀번호를 바꾼 직후 — 지금 잠금으로 덮어씀
  async write(force) {
    clearTimeout(this.timer); this.timer = null;
    if (force) this.fresh = false;
    if (!this.canWrite() || (this.state === "stale" && !force)) return;
    const o = this.pick(), h = hashStr(JSON.stringify(o));
    // 이 기기가 계정과 맞춘 적이 없으면 빈 키로 계정의 키를 지우지 않음
    if (!force && (h === this.rec.seen || (this.rec.seen == null && !VAULT_FIELDS.some((f) => o[f])))) return;
    const box = await this.seal(o), row = JSON.stringify([{ user_id: CLOUD.uid, key: "vault", value: box }]);
    let done;
    if (force) { await CLOUD.check(await SB.req("/rest/v1/kv?on_conflict=user_id,key", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: row })); done = true; }
    else {
      // 같은 잠금으로 잠긴 행만 고침 → 행이 없으면 새로 넣음(있으면 그대로) → 둘 다 아니면 다른 비밀번호로 잠긴 것
      let r = await SB.req("/rest/v1/kv?select=key&key=eq.vault&value->>kid=eq." + encodeURIComponent(this.rec.kid), { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ value: box }) });
      await CLOUD.check(r); done = (await r.json()).length > 0;
      if (!done) {
        r = await SB.req("/rest/v1/kv?select=key&on_conflict=user_id,key", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=representation" }, body: row });
        await CLOUD.check(r); done = (await r.json()).length > 0;
      }
    }
    if (!done) return this.setState("stale");
    this.rec.seen = h; this.store(); this.setState("ok");
  },
  // 계정의 "vault" 행(없으면 null, 안 받았으면 undefined)을 이 기기 키로. 키가 바뀌었으면 1
  // merge(처음 로그인·잠금 풀기): 빈 칸은 서로 채우고 다시 올림. 이 기기에서 바꾼 뒤 못 올린 키(dirty)가 있으면 그게 우선
  async take(box, merge) {
    if (box === undefined || !this.ok() || S.settings.syncKeys === false) return 0;
    const fresh = this.fresh; this.fresh = false; // '방금 확인한 비밀번호'는 로그인·잠금 풀기 직후 한 번만
    if (!this.rec) { if (box) this.setState("locked"); return 0; }
    if (!box) { if (merge) { this.rec.seen = null; await this.write(); } return 0; }
    if (box.kid !== this.rec.kid) {
      // 방금 확인한 비밀번호의 잠금과 다르면 계정 것이 예전 잠금 → 이 기기 키를 지금 잠금으로 올림. 아니면 이 기기가 예전 잠금
      if (fresh && VAULT_FIELDS.some((f) => S.settings[f])) { this.state = ""; await this.write(true); } else this.setState("stale");
      return 0;
    }
    if (this.timer) return 0; // 이 기기에서 바꾼 키를 아직 못 올림 — 그게 우선
    let o; try { o = await this.open(box); } catch { this.setState("stale"); return 0; }
    const mine = this.pick(), before = JSON.stringify(mine), dirty = this.rec.seen != null && hashStr(before) !== this.rec.seen, got = {};
    VAULT_FIELDS.forEach((f) => { got[f] = typeof o[f] === "string" ? o[f] : ""; S.settings[f] = !merge ? (dirty ? mine[f] : got[f]) : dirty ? mine[f] || got[f] : got[f] || mine[f]; });
    this.rec.seen = hashStr(JSON.stringify(got)); this.store(); this.setState("ok");
    if (merge || dirty) await this.write();
    if (before === JSON.stringify(this.pick())) return 0;
    try { localStorage.setItem("hv1_settings", JSON.stringify(S.settings)); } catch {}
    if (S.engine === "none" || S.engine === "byok") S.engine = hasClaudeKey() ? "byok" : "none";
    return 1;
  },
  async remote() { const r = await SB.req("/rest/v1/kv?select=value&key=eq.vault"); await CLOUD.check(r); const j = await r.json(); return j[0] ? j[0].value : null; },
  /**
   * 키 한 칸만 이 기기와 계정에서 지움(사용자 사이트의 쓰지 않는 Runware 키 — ui/leftover-key.js).
   * 계정의 최신 값을 먼저 받아 맞춘 뒤 올려서, 다른 기기에서 바꾼 키를 옛 값으로 덮지 않고 이 기기에서 바꾼 뒤 못 올린 키도 잃지 않음(take의 seen 규칙). 쓰기는 write()의 kid 규칙 그대로.
   * 서버에 닿지 못하면 아무것도 바꾸지 않고 던짐 — 계정에 키가 남았는데 '지웠어요'라고 하지 않게.
   * @param {string} f VAULT_FIELDS 칸 이름
   * @returns {Promise<"done"|"none"|"locked">} done 계정의 암호문에서도 뺌 · none 계정에 잠긴 키가 없음(또는 계정에 안 올리는 설정) · locked 이 기기에서만 지움(잠금이 없거나 예전 잠금이라 계정 것은 못 고침)
   * @throws 서버 오류·연결 실패
   */
  async clearField(f) {
    const clear = (res) => { S.settings[f] = ""; saveSettings(); return res; };
    if (!CLOUD.on || CLOUD.noTable || S.settings.syncKeys === false) return clear("none");
    if (this.timer) await this.write(); // 이 기기에서 바꾼 키를 먼저 올림(타이머가 돌면 take가 맞춰 주지 않음)
    const box = await this.remote();
    if (!box) return clear("none");
    if (!this.rec || !this.ok() || box.kid !== this.rec.kid) return clear("locked");
    await this.take(box, this.rec.seen == null); // 계정과 맞춘 적 없는 기기면 합침 — 이 기기의 다른 키를 잃지 않게
    if (this.state === "stale") return clear("locked"); // 잠금은 같은데 풀리지 않음
    const before = S.settings[f]; S.settings[f] = "";
    try { await this.write(); } catch (e) { S.settings[f] = before; throw e; }
    return this.state === "stale" ? clear("locked") : clear("done"); // stale: 그사이 다른 기기에서 비밀번호가 바뀜
  },
  // 'API 키도 계정에 저장'을 끔 → 계정의 잠긴 키도 지움
  async drop() {
    clearTimeout(this.timer); this.timer = null;
    if (this.rec) { this.rec.seen = null; this.store(); }
    if (CLOUD.on && !CLOUD.noTable) await CLOUD.check(await SB.req("/rest/v1/kv?key=eq.vault", { method: "DELETE" }));
  }
};
on("settings", () => VAULT.save()); // 설정을 저장할 때마다 키가 바뀌었는지 보고 올림(0.8초 모아서)
function hashStr(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36); }
function b64(u8) { let s = ""; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); }
function unb64(t) { const s = atob(t), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
