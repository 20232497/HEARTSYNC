// API 키 금고 시험: Supabase를 page.route로 흉내 냄(실제 서버로는 아무것도 안 감). 키는 모두 시험용 가짜 값
// PC 가입 → 계정에는 암호문만 → 휴대폰 로그인으로 키 받음 → 메일 링크로 들어온 기기는 잠김 → 비밀번호 입력으로 풂
// → 비밀번호 재설정 → 예전 잠금 기기는 덮어쓰지 못함 → 다시 풂 → 키 저장 끄기 → 로그아웃하면 잠금 키도 지움
import { chromium, webkit, devices } from "playwright";
const [, , url, out] = process.argv;
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
    const val = k === "key" ? row.key : k === "updated_at" ? row.updated_at : k === "user_id" ? row.user_id : k === "value->>kid" ? row.value && row.value.kid : null;
    if (v.startsWith("eq.") && val !== v.slice(3)) return false;
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
const res = {};
const errs = [];
async function device(engine, dev) {
  const browser = await engine.launch(); const ctx = await browser.newContext({ ...devices[dev] });
  await ctx.route(SB + "/**", handler);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errs.push(dev + " pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errs.push(dev + " console: " + m.text().slice(0, 200)); });
  return { browser, page };
}
const tag = (s) => s.replace(/\W+/g, "_");
try {
  // ---------- PC: 게스트로 시작
  const A = await device(chromium, "Desktop Chrome");
  await A.page.goto(url, { waitUntil: "load" }); await A.page.waitForTimeout(1000);
  res.firstScreen = await A.page.evaluate(() => ({ hash: location.hash, login: !!document.querySelector("#lform"), kakao: !!document.querySelector("[data-oauth=kakao]"), google: !!document.querySelector("[data-oauth=google]") }));
  if (out) await A.page.screenshot({ path: `${out}/pc_login.png` });
  await A.page.click("#lguest"); await A.page.waitForTimeout(400);
  res.guestSheet = await A.page.evaluate(() => !!document.querySelector(".overlay [data-aud]"));
  await A.page.click(".overlay [data-aud=f]"); await A.page.waitForTimeout(300);
  // 게스트 데이터: 대화방 하나, 키(시험용 가짜 값), 그림 하나
  await A.page.evaluate(async () => {
    const r = newRoom(normalizeChar(getChar("hasuk")), 0, S.personas[0]); window.__room = r.id;
    S.settings.apiKey = "sk-ant-test-fake"; saveSettings();
    const cv = document.createElement("canvas"); cv.width = 40; cv.height = 40; cv.getContext("2d").fillRect(0, 0, 20, 20);
    const blob = await new Promise((r2) => cv.toBlob(r2, "image/png")); window.__img = await IMG.put(blob);
  });
  // 로그인 페이지로 가서 회원가입(모의 서버)
  await A.page.evaluate(() => { location.hash = "login"; }); await A.page.waitForTimeout(400);
  await A.page.click("#lmode [data-m=up]");
  await A.page.fill("#lmail", "tester@example.test"); await A.page.fill("#lpw", "test-pass-1"); await A.page.fill("#lpw2", "test-pass-2");
  await A.page.click("#lgo"); await A.page.waitForTimeout(200);
  res.mismatch = await A.page.textContent("#lerr");
  await A.page.fill("#lpw2", "test-pass-1"); await A.page.click("#lgo"); await A.page.waitForTimeout(2500);
  res.afterSignup = await A.page.evaluate(() => ({ hash: location.hash, on: CLOUD.on, state: CLOUD.state, email: SB.s && SB.s.user.email }));
  res.serverAfterSignup = { keys: db.rows.map((r) => r.key).sort(), apiKey: (db.rows.find((r) => r.key === "settings") || {}).value?.apiKey, fs: "fs" in ((db.rows.find((r) => r.key === "settings") || {}).value || {}), aud: (db.rows.find((r) => r.key === "settings") || {}).value?.audience };
  const roomId = await A.page.evaluate(() => window.__room), imgRef = await A.page.evaluate(() => window.__img);
  // MY 계정 칸
  await A.page.evaluate(() => { location.hash = "me"; }); await A.page.waitForTimeout(500);
  res.meBox = await A.page.evaluate(() => ({ state: document.querySelector("#cloudState")?.textContent, keys: document.querySelector("#syncKeys")?.checked }));
  if (out) await A.page.screenshot({ path: `${out}/pc_me.png` });

  // ---------- 휴대폰: 같은 계정으로 로그인
  const B = await device(webkit, "iPhone 13");
  await B.page.goto(url, { waitUntil: "load" }); await B.page.waitForTimeout(1000);
  await B.page.fill("#lmail", "tester@example.test"); await B.page.fill("#lpw", "wrong-pass"); await B.page.click("#lgo"); await B.page.waitForTimeout(500);
  res.wrongPw = await B.page.textContent("#lerr");
  await B.page.fill("#lpw", "test-pass-1"); await B.page.click("#lgo"); await B.page.waitForTimeout(2500);
  res.phone = await B.page.evaluate(async (args) => ({
    hash: location.hash, rooms: S.rooms.map((r) => r.id), hasRoom: S.rooms.some((r) => r.id === args.roomId), apiKey: S.settings.apiKey, aud: S.settings.audience,
    sheet: !!document.querySelector(".overlay"), img: (await IMG.load(args.imgRef.slice(3)) || "").slice(0, 22)
  }), { roomId, imgRef });
  if (out) await B.page.screenshot({ path: `${out}/phone_home.png` });
  // 휴대폰에서 새 대화 → PC에서 받아 오기
  await B.page.evaluate(() => { const r = newRoom(normalizeChar(getChar("lethe")), 0, S.personas[0]); window.__room2 = r.id; });
  await B.page.evaluate(() => CLOUD.flush()); await B.page.waitForTimeout(300);
  const room2 = await B.page.evaluate(() => window.__room2);
  res.pcPull = await A.page.evaluate(async (id) => { const n = await CLOUD.pull(); await reloadFromCloud(); return { n, has: S.rooms.some((r) => r.id === id), roomBody: !!KV.getLocal(roomKey(id)) }; }, room2);
  // PC: API 키 계정 저장 끄기 → 계정 설정에서 키가 빠짐, 휴대폰은 자기 키 유지
  await A.page.click("#syncKeys"); await A.page.waitForTimeout(1200);
  res.keysOff = { serverKey: (db.rows.find((r) => r.key === "settings") || {}).value?.apiKey, keysLocal: (db.rows.find((r) => r.key === "settings") || {}).value?.keysLocal };
  res.phoneAfterKeysOff = await B.page.evaluate(async () => { await CLOUD.pull(); return { apiKey: S.settings.apiKey, syncKeys: S.settings.syncKeys }; });
  // 휴대폰: 로그아웃 + 기기 데이터 지우기
  await B.page.evaluate(() => { location.hash = "me"; }); await B.page.waitForTimeout(500);
  if (out) await B.page.screenshot({ path: `${out}/phone_me.png`, fullPage: false });
  await B.page.click("#cOut"); await B.page.waitForTimeout(200); await B.page.click("#lwipe"); await B.page.click("#lok"); await B.page.waitForTimeout(1800);
  res.phoneAfterLogout = await B.page.evaluate(() => ({ hash: location.hash, login: !!document.querySelector("#lform"), rooms: S.rooms.length, auth: !!localStorage.getItem("hv1_auth"), apiKey: S.settings.apiKey }));
  res.serverStill = db.rows.length;
  // ---------- 갤럭시: 게스트 대화가 있는 채로 같은 계정 로그인 → 합치기
  const C = await device(chromium, "Galaxy S9+");
  await C.page.goto(url, { waitUntil: "load" }); await C.page.waitForTimeout(900);
  await C.page.click("#lguest"); await C.page.waitForTimeout(300); await C.page.click(".overlay [data-aud=m]");
  const room3 = await C.page.evaluate(() => newRoom(normalizeChar(getChar("daeyeon")), 0, S.personas[0]).id);
  await C.page.evaluate(() => { location.hash = "login"; }); await C.page.waitForTimeout(400);
  await C.page.fill("#lmail", "tester@example.test"); await C.page.fill("#lpw", "test-pass-1"); await C.page.click("#lgo"); await C.page.waitForTimeout(1500);
  res.mergeSheet = await C.page.evaluate(() => document.querySelector(".overlay h2")?.textContent + " / " + document.querySelector(".overlay .sub")?.textContent);
  if (out) await C.page.screenshot({ path: `${out}/galaxy_merge.png` });
  await C.page.click("#mYes"); await C.page.waitForTimeout(2000);
  res.merged = { local: await C.page.evaluate(() => S.rooms.map((r) => r.charId)), server: (db.rows.find((r) => r.key === "rooms") || {}).value?.map((r) => r.charId), room3Body: db.rows.some((r) => r.key === "room-" + room3), aud: await C.page.evaluate(() => S.settings.audience) };
  await C.browser.close();
  // PC: 계정 삭제
  await A.page.evaluate(() => { location.hash = "me"; }); await A.page.waitForTimeout(400);
  await A.page.click("#cDel"); await A.page.waitForTimeout(200); await A.page.click(".overlay #ok"); await A.page.waitForTimeout(800);
  res.deleted = { rows: db.rows.length, users: Object.keys(db.users).length, local: await A.page.evaluate(() => ({ rooms: S.rooms.length, signedIn: !!SB.s })) };
  await A.browser.close(); await B.browser.close();
} catch (e) { res.fail = String(e).slice(0, 400); }
res.errors = errs;
res.requests = db.log.length;
console.log(JSON.stringify(res, null, 1));
