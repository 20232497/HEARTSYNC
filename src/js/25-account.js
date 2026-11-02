/* ---------------------------------------------------------------- 계정(Supabase): 로그인하면 KV를 계정에도 저장해 PC·휴대폰이 이어짐(사용자 요청 2026-11)
   라이브러리 없이 REST만 씀. 표 public.kv(user_id, key, value jsonb, updated_at) + RLS(본인 행만) — 만드는 SQL은 docs/supabase.sql.
   publishable 키는 브라우저에 넣으라고 만든 공개 키라 저장소에 둬도 됨(데이터는 RLS가 지킴). 세션은 이 기기 localStorage(hv1_auth)에만.
   claude.ai 안(IN_CLAUDE)에서는 쓰지 않음 — 그쪽은 claude.ai 계정 db에 저장됨 */
const SB = {
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
    const r = await fetch(this.url + path, Object.assign({}, opt, { headers: h }));
    if (r.status === 401 && this.s && !retried) { this.s.expires_at = 0; return this.req(path, opt, true); }
    return r;
  },
  // 액세스 토큰은 1시간 — 1분 남으면 refresh_token으로 새로 받음(동시에 여러 번 부르지 않게 하나로 묶음)
  async fresh() {
    if (!this.s || this.s.expires_at - 60000 > Date.now()) return;
    if (!this.refreshing) this.refreshing = (async () => {
      try {
        const r = await fetch(this.url + "/auth/v1/token?grant_type=refresh_token", { method: "POST", headers: { apikey: this.key, "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: this.s.refresh_token }) });
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
      const r = await fetch(u, { redirect: "manual" });
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
const PROVIDERS = [["kakao", "카카오"], ["custom:naver", "네이버"], ["google", "Google"]];
const OAUTH_ICONS = {
  kakao: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#191919" d="M12 3C6.48 3 2 6.53 2 10.88c0 2.82 1.88 5.29 4.7 6.68l-.96 3.53c-.08.31.27.56.54.38l4.2-2.78c.5.05 1 .08 1.52.08 5.52 0 10-3.53 10-7.89S17.52 3 12 3z"/></svg>',
  "custom:naver": '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" d="M16.27 12.85 7.38 0H0v24h7.73V11.16L16.62 24H24V0h-7.73z" transform="translate(4 4) scale(.667)"/></svg>',
  google: '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>'
};
function provName(p) { const x = PROVIDERS.find((y) => y[0] === p || y[0] === "custom:" + p); return x ? x[1] : ""; }
// 화면에 보일 계정 이름: 이메일, 없으면(카카오·네이버 등 이메일 없이 가입) '카카오 계정'
function acctName() { const u = SB.s && SB.s.user; if (!u) return ""; return u.email || (provName(u.provider) || "소셜") + " 계정"; }
/* KV ↔ 계정 동기화. 쓰기는 KV.set → put()이 키마다 0.8초 모아 upsert(지우기는 DELETE).
   읽기는 그림(img…)을 뺀 키를 받아 이 기기에 씀 — 처음 로그인하면 전부, 그 뒤엔 updated_at이 바뀐 것만. 그림은 IMG.load가 필요할 때 한 장씩.
   이 기기에서 아직 못 올린 키(pending)는 받은 값으로 덮지 않음. 설정은 "settings" 키(글자 크기·Enter로 보내기는 기기마다 따로) */
const DEVICE_SETTINGS = ["fs", "enterSend"];
const CLOUD = {
  on: false, uid: null, pending: {}, timer: null, state: "", at: 0, pulledAt: 0, noTable: false,
  lastKey() { return "hv1_cloudlast_" + this.uid; },
  start() { this.on = SB.on() && !!(SB.s && SB.s.user && SB.s.user.id); this.uid = this.on ? SB.s.user.id : null; this.noTable = false; if (this.on) VAULT.load(this.uid); },
  stop() { this.on = false; this.uid = null; this.pending = {}; clearTimeout(this.timer); clearTimeout(VAULT.timer); VAULT.timer = null; this.setState(""); },
  setState(s) { this.state = s; if (s === "ok") this.at = Date.now(); const el = $("#cloudState"); if (el) el.textContent = cloudStateText(); },
  put(k, v) {
    if (!this.on || this.noTable) return;
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
      // 그림 본문(img…)은 빼되 그림 칸 연결(imgpacks)은 받음 — 예전에는 not.like.img*가 imgpacks까지 빼서 다른 기기에 그림 칸이 안 넘어감
      let q = "/rest/v1/kv?select=key,value,updated_at&or=" + encodeURIComponent("(key.not.like.img*,key.eq.imgpacks)") + "&order=updated_at.asc&limit=500&offset=" + off;
      if (since) q += "&updated_at=gt." + encodeURIComponent(since);
      const r = await SB.req(q); await this.check(r);
      const part = await r.json(); out.push(...part);
      if (part.length < 500) return out;
    }
  },
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
  // 그림 여러 장을 한 번에(20장씩) — { key: value }
  async getMany(keys) {
    const out = {};
    if (!this.on || this.noTable) return out;
    for (let i = 0; i < keys.length; i += 20) {
      try {
        const r = await SB.req("/rest/v1/kv?select=key,value&key=in.(" + encodeURIComponent(keys.slice(i, i + 20).map((k) => '"' + k.replace(/"/g, "") + '"').join(",")) + ")");
        if (r.ok) (await r.json()).forEach((x) => { out[x.key] = x.value; });
      } catch {}
    }
    return out;
  },
  // 받은 행을 이 기기에 씀. 열려 있는 대화방은 덮지 않음(대화 중에 바뀌면 헷갈림). 바뀐 키 수를 돌려줌
  apply(rows) {
    let n = 0;
    const open = room && location.hash === "#r-" + room.id ? roomKey(room.id) : "";
    rows.forEach((x) => {
      if (x.updated_at && x.updated_at > (localStorage.getItem(this.lastKey()) || "")) try { localStorage.setItem(this.lastKey(), x.updated_at); } catch {}
      if (x.key === "vault") { this.vault = x.value; return; } // 잠긴 API 키 — VAULT.take가 풂
      if (x.key in this.pending || x.key === open) return;
      if (x.key === "settings") { mergeCloudSettings(x.value); n++; return; }
      KV.setLocal(x.key, x.value === null ? undefined : x.value); n++;
    });
    this.pulledAt = Date.now();
    return n;
  },
  takeVault() { const v = this.vault; this.vault = undefined; return v; },
  async pull() { const n = this.apply(await this.rows(localStorage.getItem(this.lastKey()) || "")); return n + (await VAULT.take(this.takeVault())); },
  // 이 기기의 모든 데이터를 계정에 올림(계정이 비었을 때·합칠 때). 그림은 계정에 없는 것만 한 장씩 읽어 묶어 보냄
  // (그림 본문은 IndexedDB에, IndexedDB가 막힌 브라우저에서는 localStorage에 있음)
  async pushAll(keys) {
    (keys || localKVKeys()).forEach((k) => { const v = KV.getLocal(k); if (v !== undefined) this.pending[k] = { v }; });
    this.pending.settings = { v: cloudSettings() };
    await this.flush();
    const isImg = (k) => /^img[a-z0-9]{6,30}$/.test(k), have = new Set(await this.imgKeys());
    let ls = []; try { ls = Object.keys(localStorage).filter((k) => k.indexOf("hv1_img") === 0).map((k) => k.slice(4)); } catch {}
    const mine = Array.from(new Set((await IDB.keys()).concat(ls))).filter((k) => isImg(k) && !have.has(k));
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
  async wipe() { if (this.on && !this.noTable) { this.pending = {}; if (VAULT.rec) { VAULT.rec.seen = null; VAULT.store(); } await SB.req("/rest/v1/kv?user_id=eq." + encodeURIComponent(this.uid), { method: "DELETE" }); } }
};
function chunkBy(items, max) {
  const out = []; let cur = [], size = 0;
  items.forEach((x) => { const n = JSON.stringify(x).length; if (cur.length && size + n > max) { out.push(cur); cur = []; size = 0; } cur.push(x); size += n; });
  if (cur.length) out.push(cur);
  return out;
}
// 이 기기 KV 키(그림·설정·세션·키 잠금 제외 — 그림은 IndexedDB, 설정은 "settings" 키로 따로)
function localKVKeys() {
  try { return Object.keys(localStorage).filter((k) => k.indexOf("hv1_") === 0).map((k) => k.slice(4)).filter((k) => !/^(settings|auth|guest|cloudlast_.*|cloudfix_.*|vault_.*|img[a-z0-9]{6,30})$/.test(k)); } catch { return []; }
}
// 계정에 올리는 설정: 기기별 설정과 API 키는 뺌(키는 비밀번호로 잠가 "vault" 행에만 — VAULT. 서버의 표도 settings에 키 칸이 있으면 거부)
function cloudSettings() {
  const s = Object.assign({}, S.settings);
  DEVICE_SETTINGS.concat(VAULT_FIELDS).forEach((k) => delete s[k]);
  return s;
}
function mergeCloudSettings(v) {
  if (!v || typeof v !== "object") return;
  const keep = {};
  DEVICE_SETTINGS.concat(VAULT_FIELDS).forEach((k) => { if (k in S.settings) keep[k] = S.settings[k]; });
  const next = Object.assign({}, S.settings, v, keep);
  delete next.keysLocal;
  S.settings = next;
  try { localStorage.setItem("hv1_settings", JSON.stringify(S.settings)); } catch {}
}
function cloudStateText() {
  if (!CLOUD.on) return "";
  if (CLOUD.state === "notable") return "⚠️ 계정 저장 표가 아직 없어요 (docs/supabase.sql을 실행해 주세요)";
  if (CLOUD.state === "err") return "⚠️ 계정에 저장하지 못했어요. 잠시 뒤 다시 시도해요";
  if (CLOUD.state === "sync") return "저장하는 중…";
  return CLOUD.at ? "계정에 저장됨 · " + ago(CLOUD.at) : "계정과 연결됨";
}
/* API 키 금고(사용자 요청 2026-11 — 키가 계정 서버에 평문으로 남지 않게): Anthropic·Runware·OpenRouter 키는 "settings" 행에 넣지 않고,
   로그인 비밀번호로 이 기기에서 만든 잠금 키(PBKDF2-SHA256 60만 번, 소금은 사용자 id)로 AES-GCM 암호화해 "vault" 행에만 올림.
   서버·관리자는 비밀번호를 모르니 키를 볼 수 없음. 잠금 키는 이 기기 localStorage(hv1_vault_<uid>)에만 — 키 원문도 이 기기에 있으니 더 약해지지 않음.
   비밀번호 없이 들어온 기기(다른 기기에서 연 인증 메일 링크)는 MY → 계정에서 비밀번호를 한 번 넣어야 풀림.
   비밀번호가 없는 계정(카카오·네이버·구글로만 가입)은 '키 잠금 암호'를 따로 정함 — 서버가 확인해 줄 수 없으니 계정의 잠금(kid)과 맞을 때만 받아들임(phraseSheet).
   비밀번호를 재설정하면 새 잠금(kid)으로 다시 올림. 예전 잠금을 가진 기기는 같은 kid일 때만 고치는 PATCH라 덮어쓰지 못하고 '비밀번호 입력'을 띄움 */
const VAULT_FIELDS = ["apiKey", "runwareKey", "openRouterKey"];
const VAULT = {
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
  setState(s) { this.state = s; paintVault(); },
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
  // 'API 키도 계정에 저장'을 끔 → 계정의 잠긴 키도 지움
  async drop() {
    clearTimeout(this.timer); this.timer = null;
    if (this.rec) { this.rec.seen = null; this.store(); }
    if (CLOUD.on && !CLOUD.noTable) await CLOUD.check(await SB.req("/rest/v1/kv?key=eq.vault", { method: "DELETE" }));
  }
};
function hashStr(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36); }
function b64(u8) { let s = ""; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); }
function unb64(t) { const s = atob(t), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
