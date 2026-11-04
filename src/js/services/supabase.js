/* Supabase 인증 REST(SB): 로그인·가입·소셜·세션 갱신, 안내 문구 */
import { CFG, IN_CLAUDE } from "../core/config.js";
import { TIMEOUT } from "../core/constants.js";
import { timeoutSignal, toast } from "../core/util.js";
import { CLOUD } from "./cloud.js";
import { VAULT } from "./vault.js";

/* ---------------------------------------------------------------- 계정(Supabase): 로그인하면 KV를 계정에도 저장해 PC·휴대폰이 이어짐(사용자 요청 2026-11)
   라이브러리 없이 REST만 씀. 표 public.kv(user_id, key, value jsonb, updated_at) + RLS(본인 행만) — 만드는 SQL은 docs/supabase.sql.
   publishable 키는 브라우저에 넣으라고 만든 공개 키라 저장소에 둬도 됨(데이터는 RLS가 지킴). 세션은 이 기기 localStorage(hv1_auth)에만.
   claude.ai 안(IN_CLAUDE)에서는 쓰지 않음 — 그쪽은 claude.ai 계정 db에 저장됨 */
/**
 * Supabase 인증·REST(라이브러리 없음). on() 서버 설정 여부 · s 세션 { access_token, refresh_token, expires_at, user: { id, email, provider, providers } }(hv1_auth)
 * req(path, opt) → Promise<Response>(토큰 갱신·401 재시도·시간 제한) · signIn/signUp/verify/recover/setPassword/oauth/signOut · fromHash() 인증 메일·소셜 로그인 링크의 토큰을 세션으로
 */
export const SB = {
  url: String(CFG.supabaseUrl || "").replace(/\/+$/, ""), key: String(CFG.supabaseKey || ""),
  s: null, refreshing: null, // 세션 { access_token, refresh_token, expires_at(ms), user: { id, email } }
  on() { return !IN_CLAUDE && !!(this.url && this.key); },
  load() { try { const s = JSON.parse(localStorage.getItem("hv1_auth") || "null"); this.s = s && s.access_token && s.user && s.user.id ? s : null; } catch { this.s = null; } },
  keep(s) { this.s = s; try { if (s) localStorage.setItem("hv1_auth", JSON.stringify(s)); else localStorage.removeItem("hv1_auth"); } catch {} },
  session(j) { return { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Date.now() + (+j.expires_in || 3600) * 1000, user: this.who(j.user || {}) }; },
  // providers: 이 계정에 연결된 로그인 방법(email·kakao·google·custom:naver) — email이 없으면 비밀번호가 없는 소셜 전용 계정
  who(u) { const m = u.app_metadata || {}; return { id: u.id, email: u.email || "", provider: m.provider || "", providers: Array.isArray(m.providers) ? m.providers : m.provider ? [m.provider] : [] }; },
  // 인증 메일·소셜 로그인이 돌아올 주소. 파일로 열었으면 웹 주소로
  site() { return location.protocol === "file:" ? "https://20232497.github.io/HEARTSYNC/" : location.origin + location.pathname; },
  async req(path, opt = {}, retried = false) {
    const h = Object.assign({ apikey: this.key, "Content-Type": "application/json" }, opt.headers || {});
    if (this.s) { await this.fresh(); if (this.s) h.Authorization = "Bearer " + this.s.access_token; }
    const T = timeoutSignal(TIMEOUT.api, opt.signal); let r; // 요청 하나의 시간 제한 — 넘으면 AbortError(부르는 쪽이 연결 실패로 처리)
    try { r = await fetch(this.url + path, Object.assign({}, opt, { headers: h, signal: T.signal })); } finally { T.clear(); }
    if (r.status === 401 && this.s && !retried) { this.s.expires_at = 0; return this.req(path, opt, true); }
    return r;
  },
  // 액세스 토큰은 1시간 — 1분 남으면 refresh_token으로 새로 받음(동시에 여러 번 부르지 않게 하나로 묶음)
  async fresh() {
    if (!this.s || this.s.expires_at - 60000 > Date.now()) return;
    if (!this.refreshing) this.refreshing = (async () => {
      try {
        const T = timeoutSignal(TIMEOUT.api), r = await fetch(this.url + "/auth/v1/token?grant_type=refresh_token", { method: "POST", signal: T.signal, headers: { apikey: this.key, "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: this.s.refresh_token }) });
        T.clear();
        if (r.ok) this.keep(this.session(await r.json()));
        else if (r.status === 400 || r.status === 401) { this.keep(null); CLOUD.stop(); toast("로그인이 풀렸어요. MY에서 다시 로그인해 주세요."); }
      } catch {} // 오프라인이면 다음 요청 때 다시
      finally { this.refreshing = null; }
    })();
    await this.refreshing;
  },
  async auth(path, body, method = "POST") {
    let r;
    try { r = await this.req("/auth/v1/" + path, { method, body: JSON.stringify(body) }); }
    catch { throw { msg: "계정 서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요." }; }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw { msg: authMsg(j, r.status), code: j.error_code || j.code };
    return j;
  },
  async signIn(email, password) { this.keep(null); this.keep(this.session(await this.auth("token?grant_type=password", { email, password }))); },
  // 로그인한 채로 비밀번호만 확인(API 키 잠금 풀기) — 틀려도 로그인은 그대로
  async verify(password) { this.keep(this.session(await this.auth("token?grant_type=password", { email: this.s.user.email, password }))); },
  // 이메일 인증이 켜져 있으면 세션 없이 user만 옴 → "confirm"(lastUid는 키 잠금을 미리 만들 때 씀)
  async signUp(email, password) {
    this.keep(null);
    const j = await this.auth("signup?redirect_to=" + encodeURIComponent(this.site()), { email, password });
    this.lastUid = (j.user && j.user.id) || j.id || "";
    if (j.access_token) { this.keep(this.session(j)); return "in"; }
    return "confirm";
  },
  recover(email) { return this.auth("recover?redirect_to=" + encodeURIComponent(this.site()), { email }); },
  setPassword(password) { return this.auth("user", { password }, "PUT"); },
  // 소셜 로그인·가입(카카오·구글·네이버). 대시보드에서 켠 공급자면 그 로그인 화면으로 넘어가고(302), 안 켰으면 400 → false
  async oauth(provider) {
    const u = this.url + "/auth/v1/authorize?provider=" + encodeURIComponent(provider) + "&redirect_to=" + encodeURIComponent(this.site());
    try {
      const T = timeoutSignal(TIMEOUT.api), r = await fetch(u, { redirect: "manual", signal: T.signal }); T.clear();
      if (r.status === 400) { const j = await r.json().catch(() => ({})); if (/not enabled|not found|unsupported provider/i.test(String(j.msg || j.error_description || ""))) return false; }
    } catch {} // 확인하지 못하면 그냥 넘어감(꺼져 있으면 Supabase가 오류를 보여 줌)
    location.href = u;
    return true;
  },
  async signOut() { if (this.s) { try { await this.req("/auth/v1/logout", { method: "POST" }); } catch {} } this.keep(null); VAULT.forget(); },
  // 인증 메일·소셜 로그인·비밀번호 재설정 링크는 #access_token=…&type=… 로 돌아옴 → 세션으로 바꾸고 주소에서 지움
  // 소셜 로그인을 취소했거나 실패하면 오류가 #… 또는 ?… 로 옴
  async fromHash() {
    const h = location.hash.slice(1), q = location.search.slice(1), hit = (t) => /(^|&)(access_token|error_description)=/.test(t);
    if (!hit(h) && !hit(q)) return "";
    const p = {}; (hit(h) ? h : q).split("&").forEach((kv) => { const i = kv.indexOf("="); if (i > 0) p[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1).replace(/\+/g, " ")); });
    try { history.replaceState(null, "", location.pathname + (hit(q) ? "" : location.search)); } catch { location.hash = ""; }
    if (p.error_description) { setTimeout(() => toast(oauthMsg(p)), 300); return ""; }
    this.keep({ access_token: p.access_token, refresh_token: p.refresh_token, expires_at: Date.now() + (+p.expires_in || 3600) * 1000, user: { id: "", email: "" } });
    try { const r = await this.req("/auth/v1/user"); const u = r.ok ? await r.json() : null; if (u && u.id) this.keep(Object.assign({}, this.s, { user: this.who(u) })); else this.keep(null); }
    catch { this.keep(null); }
    return this.s ? p.type || "login" : "";
  }
};
function authMsg(j, status) {
  const c = String(j.error_code || j.code || j.error || ""), m = String(j.msg || j.message || j.error_description || "");
  if (/invalid_credentials|invalid_grant/.test(c) || /Invalid login credentials/i.test(m)) return "이메일 또는 비밀번호가 맞지 않아요.";
  if (/email_not_confirmed/.test(c) || /not confirmed/i.test(m)) return "이메일 인증을 먼저 끝내 주세요. 받은 메일의 링크를 눌러 주세요.";
  if (/user_already_exists|email_exists/.test(c) || /already registered/i.test(m)) return "이미 가입된 이메일이에요. 로그인해 주세요.";
  if (/weak_password/.test(c) || /password should be/i.test(m)) return "비밀번호가 너무 약해요. 8자 이상으로, 쉽게 짐작되지 않게 정해 주세요.";
  if (/rate_limit/.test(c) || status === 429) return "요청이 너무 잦아요. 잠시 뒤 다시 해 주세요.";
  if (/signup_disabled/.test(c)) return "지금은 회원가입을 받지 않아요.";
  if (/email_address_invalid|validation_failed/.test(c)) return "이메일 주소를 확인해 주세요.";
  return m ? "계정 서버 오류: " + m.slice(0, 80) : "계정 서버 오류(" + status + ")";
}
// 소셜 로그인에서 돌아온 오류
function oauthMsg(p) {
  const e = String(p.error || ""), d = String(p.error_description || "");
  if (/access_denied/.test(e) || /cancel|denied/i.test(d)) return "로그인을 취소했어요.";
  if (/email/i.test(d) && /provider/i.test(d)) return "이 계정에서 이메일을 받지 못해 가입하지 못했어요. 관리자에게 알려 주세요.";
  return "로그인하지 못했어요: " + d.slice(0, 80);
}
export const PROVIDERS = [["kakao", "카카오"], ["custom:naver", "네이버"], ["google", "Google"]];
export const OAUTH_ICONS = {
  kakao: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#191919" d="M12 3C6.48 3 2 6.53 2 10.88c0 2.82 1.88 5.29 4.7 6.68l-.96 3.53c-.08.31.27.56.54.38l4.2-2.78c.5.05 1 .08 1.52.08 5.52 0 10-3.53 10-7.89S17.52 3 12 3z"/></svg>',
  "custom:naver": '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" d="M16.27 12.85 7.38 0H0v24h7.73V11.16L16.62 24H24V0h-7.73z" transform="translate(4 4) scale(.667)"/></svg>',
  google: '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>'
};
/** 공급자 id → 이름(카카오·네이버·Google). @param {string} p @returns {string} */
export function provName(p) { const x = PROVIDERS.find((y) => y[0] === p || y[0] === "custom:" + p); return x ? x[1] : ""; }
// 화면에 보일 계정 이름: 이메일, 없으면(카카오·네이버 등 이메일 없이 가입) '카카오 계정'
/** 화면에 보이는 계정 이름(이메일, 없으면 "카카오 계정"처럼). @returns {string} */
export function acctName() { const u = SB.s && SB.s.user; if (!u) return ""; return u.email || (provName(u.provider) || "소셜") + " 계정"; }
