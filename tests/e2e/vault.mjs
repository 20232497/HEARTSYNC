// API 키 금고 시험: Supabase를 page.route로 흉내 냄(실제 서버로는 아무것도 안 감). 키는 모두 시험용 가짜 값
// PC 가입 → 계정에는 암호문만 → 휴대폰 로그인으로 키 받음 → 메일 링크로 들어온 기기는 잠김 → 비밀번호 입력으로 풂
// → 비밀번호 재설정 → 예전 잠금 기기는 덮어쓰지 못함 → 다시 풂 → 키 저장 끄기 → 로그아웃하면 잠금 키도 지움
import { chromium, webkit, devices } from "playwright";
const [, , url] = process.argv;
const SB = "https://mblvphojbmxiuqnlxisi.supabase.co";
const db = { users: {}, tokens: {}, rows: [], n: 0, log: [] };
const now = () => new Date(Date.now() + db.n++).toISOString().replace("Z", "+00:00");
const json = (route, status, body) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: body === undefined ? "" : JSON.stringify(body) });
const pub = (u) => ({ id: u.id, email: u.email, app_metadata: { provider: "email" } });
function session(u) { const t = "tok" + Math.random().toString(36).slice(2); db.tokens[t] = u.id; return { access_token: t, refresh_token: "r" + t, expires_in: 3600, token_type: "bearer", user: pub(u) }; }
function who(req) { const a = req.headers()["authorization"] || ""; return db.tokens[a.replace("Bearer ", "")] || null; }
function match(row, q) {
  for (const [k, v] of q) {
    if (["select", "order", "limit", "offset", "on_conflict"].includes(k)) continue;
    // or=(key.not.like.img*,key.eq.imgpacks) — 하나라도 맞으면
    if (k === "or") { const parts = v.slice(1, -1).split(",").map((x) => { const i = x.indexOf("."); return [x.slice(0, i), x.slice(i + 1)]; }); if (!parts.some((pt) => match(row, [pt]))) return false; continue; }
    const val = k === "key" ? row.key : k === "updated_at" ? row.updated_at : k === "user_id" ? row.user_id : k === "value->>kid" ? row.value && row.value.kid : null;
    if (v.startsWith("eq.") && val !== v.slice(3)) return false;
    if (v.startsWith("neq.") && val === v.slice(4)) return false;
    if (v.startsWith("gt.") && !(val > v.slice(3))) return false;
    if (v.startsWith("like.") && !String(val).startsWith(v.slice(5).replace("*", ""))) return false;
    if (v.startsWith("not.like.") && String(val).startsWith(v.slice(9).replace("*", ""))) return false;
    if (v.startsWith("in.(")) { const ks = v.slice(4, -1).split(",").map((x) => x.replace(/^"|"$/g, "")); if (!ks.includes(val)) return false; }
  }
  return true;
}
// docs/supabase.sql의 check 제약과 같은 규칙
function violates(x) {
  const v = x.value;
  if (x.key === "settings" && v && typeof v === "object" && !Array.isArray(v) && ["apiKey", "runwareKey", "openRouterKey"].some((k) => k in v)) return true;
  if (x.key === "vault" && !(v && typeof v === "object" && v.kid && v.iv && v.ct)) return true;
  return false;
}
const pick = (r, sel) => sel ? Object.fromEntries(sel.split(",").map((k) => [k, r[k]])) : r;
async function handler(route) {
  const req = route.request(), u = new URL(req.url()), p = u.pathname, m = req.method();
  db.log.push(m + " " + p + decodeURIComponent(u.search).slice(0, 80));
  if (m === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" } });
  const body = req.postData() ? JSON.parse(req.postData()) : null;
  if (p === "/auth/v1/settings") return json(route, 200, { external: { email: true } });
  if (p === "/auth/v1/signup") {
    if (db.users[body.email]) return json(route, 422, { error_code: "user_already_exists", msg: "User already registered" });
    const user = db.users[body.email] = { id: "u" + Object.keys(db.users).length + "-0000", email: body.email, pw: body.password };
    return json(route, 200, session(user));
  }
  if (p === "/auth/v1/token") {
    if (u.searchParams.get("grant_type") === "password") { const user = db.users[body.email]; if (!user || user.pw !== body.password) return json(route, 400, { error_code: "invalid_credentials", msg: "Invalid login credentials" }); return json(route, 200, session(user)); }
    const uid = db.tokens[String(body.refresh_token).slice(1)]; const user = Object.values(db.users).find((x) => x.id === uid); return user ? json(route, 200, session(user)) : json(route, 400, { error_code: "refresh_token_not_found" });
  }
  if (p === "/auth/v1/user") {
    const uid = who(req); const user = Object.values(db.users).find((x) => x.id === uid);
    if (!user) return json(route, 401, {});
    if (m === "PUT" && body && body.password) user.pw = body.password;
    return json(route, 200, pub(user));
  }
  if (p === "/rest/v1/rpc/delete_me") { const uid = who(req); db.rows = db.rows.filter((r) => r.user_id !== uid); for (const e of Object.keys(db.users)) if (db.users[e].id === uid) delete db.users[e]; return json(route, 204); }
  if (p === "/auth/v1/logout") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*" } });
  if (p === "/rest/v1/kv") {
    const uid = who(req); if (!uid) return json(route, 401, { message: "JWT" });
    const q = [...u.searchParams.entries()], prefer = req.headers()["prefer"] || "", sel = u.searchParams.get("select");
    if (m === "GET") {
      let rows = db.rows.filter((r) => r.user_id === uid && match(r, q)).sort((a, b) => a.updated_at < b.updated_at ? -1 : 1);
      const off = +(u.searchParams.get("offset") || 0), lim = +(u.searchParams.get("limit") || 1000);
      return json(route, 200, rows.slice(off, off + lim).map((r) => pick(r, sel)));
    }
    if (m === "POST") {
      const outRows = [];
      for (const x of body) {
        if (x.user_id !== uid) return json(route, 403, { message: "RLS" });
        if (violates(x)) return json(route, 400, { code: "23514", message: "check constraint violated: " + x.key });
        const i = db.rows.findIndex((r) => r.user_id === uid && r.key === x.key);
        if (i >= 0 && prefer.includes("ignore-duplicates")) continue;
        const row = { user_id: uid, key: x.key, value: x.value, updated_at: now() };
        if (i >= 0) db.rows[i] = row; else db.rows.push(row);
        outRows.push(row);
      }
      return prefer.includes("return=representation") ? json(route, 201, outRows.map((r) => pick(r, sel))) : json(route, 201);
    }
    if (m === "PATCH") {
      const hit = db.rows.filter((r) => r.user_id === uid && match(r, q));
      for (const r of hit) { const nx = Object.assign({}, r, body); if (violates(nx)) return json(route, 400, { code: "23514" }); Object.assign(r, body, { updated_at: now() }); }
      return prefer.includes("return=representation") ? json(route, 200, hit.map((r) => pick(r, sel))) : json(route, 204);
    }
    if (m === "DELETE") { db.rows = db.rows.filter((r) => !(r.user_id === uid && match(r, q))); return json(route, 204); }
  }
  return json(route, 404, { message: "mock: unknown " + p });
}
const res = {}, errs = [], browsers = [];
async function device(engine, dev) {
  const browser = await engine.launch(); browsers.push(browser);
  const ctx = await browser.newContext({ ...devices[dev] });
  await ctx.route(SB + "/**", handler);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errs.push(dev + " pageerror: " + e.message));
  page.on("console", (msg) => { if (msg.type() === "error" && !/Failed to load resource/.test(msg.text())) errs.push(dev + " console: " + msg.text().slice(0, 200)); });
  return page;
}
const vaultRow = () => (db.rows.find((r) => r.key === "vault") || {}).value || null;
const settingsRow = () => (db.rows.find((r) => r.key === "settings") || {}).value || {};
const plainOnServer = (s) => JSON.stringify(db.rows).includes(s);
const keysOf = (pg) => pg.evaluate(() => ({ apiKey: S.settings.apiKey, runwareKey: S.settings.runwareKey, state: VAULT.state, rec: !!VAULT.rec, engine: S.engine }));
const meVault = async (pg) => { await pg.evaluate(() => { location.hash = "me"; }); await pg.waitForTimeout(500); return pg.evaluate(() => ({ text: (document.querySelector("#vaultBox") || {}).textContent || "", unlock: !!document.querySelector("#vUnlock") })); };
const unlock = async (pg, pw) => { await pg.click("#vUnlock"); await pg.waitForTimeout(200); await pg.fill("#vpw", pw); await pg.click("#vok"); await pg.waitForTimeout(3500); return pg.evaluate(() => ({ err: (document.querySelector("#verr") || {}).textContent || "", sheet: !!document.querySelector("#vform"), signedIn: !!SB.s })); };
try {
  // ---------- PC: 게스트로 키를 넣고 가입
  const A = await device(chromium, "Desktop Chrome");
  await A.goto(url, { waitUntil: "load" }); await A.waitForTimeout(1000);
  await A.click("#lguest"); await A.waitForTimeout(300); await A.click(".overlay [data-aud=all]"); await A.waitForTimeout(200);
  await A.evaluate(() => { S.settings.apiKey = "sk-ant-test-fake-A"; S.settings.runwareKey = "rw-test-fake-A"; saveSettings(); newRoom(normalizeChar(getChar("hasuk")), 0, S.personas[0]); });
  await A.evaluate(() => { location.hash = "login"; }); await A.waitForTimeout(400);
  await A.click("#lmode [data-m=up]");
  await A.fill("#lmail", "tester@example.test"); await A.fill("#lpw", "short12"); await A.fill("#lpw2", "short12"); await A.click("#lgo"); await A.waitForTimeout(200);
  res.shortPw = await A.textContent("#lerr");
  await A.fill("#lpw", "test-pass-1"); await A.fill("#lpw2", "test-pass-1");
  const t0 = Date.now(); await A.click("#lgo"); await A.waitForTimeout(3500);
  res.signup = { ms: Date.now() - t0, keys: db.rows.map((r) => r.key).sort(), settingsKeyFields: ["apiKey", "runwareKey", "openRouterKey"].filter((k) => k in settingsRow()), vault: vaultRow() && { kid: vaultRow().kid, iv: !!vaultRow().iv, ctLen: vaultRow().ct.length }, plainAOnServer: plainOnServer("sk-ant-test-fake-A") || plainOnServer("rw-test-fake-A"), local: await keysOf(A) };
  res.A_me = await meVault(A);

  // ---------- 휴대폰: 같은 계정 로그인 → 키를 받음
  const B = await device(webkit, "iPhone 13");
  await B.goto(url, { waitUntil: "load" }); await B.waitForTimeout(1000);
  res.pbkdf2WebKitMs = await B.evaluate(async () => { const t = performance.now(), e = new TextEncoder(); const k = await crypto.subtle.importKey("raw", e.encode("test-pass-1"), { name: "PBKDF2" }, false, ["deriveBits"]); await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: e.encode("x"), iterations: 600000 }, k, 256); return Math.round(performance.now() - t); });
  await B.fill("#lmail", "tester@example.test"); await B.fill("#lpw", "test-pass-1"); await B.click("#lgo"); await B.waitForTimeout(4000);
  res.B_login = await keysOf(B);
  // 휴대폰에서 키를 바꿈 → PC가 받음, 서버에는 여전히 암호문만
  await B.evaluate(() => { S.settings.apiKey = "sk-ant-test-fake-B"; saveSettings(); }); await B.waitForTimeout(1800);
  res.B_change = { kid: vaultRow().kid, plainBOnServer: plainOnServer("sk-ant-test-fake-B"), A_pull: await A.evaluate(async () => { const n = await CLOUD.pull(); return { n, apiKey: S.settings.apiKey, runwareKey: S.settings.runwareKey }; }) };

  // ---------- 갤럭시: 비밀번호 없이 들어온 기기(다른 기기에서 연 인증 메일 링크와 같음) → 잠김 → 비밀번호 입력으로 풂
  const C = await device(chromium, "Galaxy S9+");
  await C.goto(url, { waitUntil: "load" }); await C.waitForTimeout(600);
  const sess = session(db.users["tester@example.test"]);
  await C.evaluate((s) => { localStorage.setItem("hv1_auth", JSON.stringify({ access_token: s.access_token, refresh_token: s.refresh_token, expires_at: Date.now() + 3600000, user: { id: s.user.id, email: s.user.email, provider: "email" } })); localStorage.setItem("hv1_settings", JSON.stringify({ audience: "all" })); }, sess);
  await C.reload({ waitUntil: "load" }); await C.waitForTimeout(1500);
  res.C_locked = { keys: await keysOf(C), me: await meVault(C) };
  res.C_wrongPw = await unlock(C, "wrong-pass-9");
  await C.click(".overlay [data-x]"); await C.waitForTimeout(200);
  res.C_unlock = { r: await unlock(C, "test-pass-1"), keys: await keysOf(C), me: (await meVault(C)).text.slice(0, 40) };

  // ---------- 갤럭시에서 비밀번호 재설정 → 새 잠금으로 다시 올림
  const oldKid = vaultRow().kid;
  await C.evaluate(() => newPasswordSheet()); await C.waitForTimeout(200);
  await C.fill("#npw", "short"); await C.click("#nok"); await C.waitForTimeout(200);
  res.C_shortNew = await C.textContent("#nerr");
  await C.fill("#npw", "new-pass-22"); await C.click("#nok"); await C.waitForTimeout(3500);
  res.reset = { kidChanged: vaultRow().kid !== oldKid, pwChanged: db.users["tester@example.test"].pw === "new-pass-22", C: await keysOf(C) };
  // PC는 예전 잠금 → 키를 바꿔도 계정을 덮지 못하고 '비밀번호 입력'
  const newKid = vaultRow().kid;
  await A.evaluate(() => { S.settings.runwareKey = "rw-test-fake-A2"; saveSettings(); }); await A.waitForTimeout(1800);
  res.A_stale = { serverKidKept: vaultRow().kid === newKid, keys: await keysOf(A), me: await meVault(A) };
  res.A_unlockOldPw = (await unlock(A, "test-pass-1")).err;
  await A.click(".overlay [data-x]"); await A.waitForTimeout(200);
  res.A_unlockNew = { r: await unlock(A, "new-pass-22"), keys: await keysOf(A), serverKid: vaultRow().kid === newKid, plainOnServer: plainOnServer("rw-test-fake-A2") };
  // 휴대폰(예전 잠금)도 받아 보면 stale
  res.B_afterReset = await B.evaluate(async () => { await CLOUD.pull(); return { state: VAULT.state, apiKey: S.settings.apiKey }; });

  // ---------- PC: 키 저장 끄기 → 계정의 vault 행 삭제, 다른 기기는 자기 키 유지
  await A.evaluate(() => { location.hash = "me"; }); await A.waitForTimeout(400);
  await A.click("#syncKeys"); await A.waitForTimeout(1500);
  res.keysOff = { vault: !!vaultRow(), syncKeys: settingsRow().syncKeys, me: (await A.evaluate(() => document.querySelector("#vaultBox").textContent)).slice(0, 30) };
  res.C_afterOff = await C.evaluate(async () => { await CLOUD.pull(); return { apiKey: S.settings.apiKey, syncKeys: S.settings.syncKeys }; });
  // 다시 켜면 이 기기 키를 다시 올림
  await A.click("#syncKeys"); await A.waitForTimeout(1500);
  res.keysOn = { vault: !!vaultRow(), kid: vaultRow() && vaultRow().kid === newKid };

  // ---------- 휴대폰 로그아웃(기기 데이터는 남김) → 잠금 키는 지움
  await B.evaluate(() => { location.hash = "me"; }); await B.waitForTimeout(500);
  await B.click("#cOut"); await B.waitForTimeout(200); await B.click("#lok"); await B.waitForTimeout(1200);
  res.B_logout = await B.evaluate(() => ({ vaultKeys: Object.keys(localStorage).filter((k) => k.indexOf("hv1_vault_") === 0).length, auth: !!localStorage.getItem("hv1_auth"), apiKey: S.settings.apiKey }));
  res.serverSettingsFields = Object.keys(settingsRow()).filter((k) => /key/i.test(k));
} catch (e) { res.fail = String(e).slice(0, 500); }
for (const b of browsers) await b.close();
res.errors = errs;
res.requests = db.log.length;
res.vaultRequests = db.log.filter((l) => /vault/.test(l)).slice(0, 12);
console.log(JSON.stringify(res, null, 1));
