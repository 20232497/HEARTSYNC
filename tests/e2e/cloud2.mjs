// 계정 저장 시험: Supabase를 page.route로 흉내 냄(실제 서버로는 아무것도 안 감). 키는 모두 시험용 가짜 값
// PC 게스트 → 이메일 가입(계정이 비어 이 기기 데이터를 올림) → 휴대폰 로그인으로 대화·그림 받음 → 휴대폰 새 대화를 PC가 받음 → API 키는 계정에 안 올라감
// → 휴대폰 로그아웃(기기 지우기) → 갤럭시 게스트 대화 합치기 → 계정 삭제
import { chromium, webkit, devices } from "playwright";
const [, , url, out] = process.argv;
const SB = "https://mblvphojbmxiuqnlxisi.supabase.co";
const db = { users: {}, tokens: {}, rows: [], n: 0, log: [] };
const now = () => new Date(Date.now() + db.n++).toISOString().replace("Z", "+00:00");
const json = (route, status, body) =>
  route.fulfill({
    status,
    contentType: "application/json",
    headers: { "access-control-allow-origin": "*" },
    body: body === undefined ? "" : JSON.stringify(body)
  });
const pub = (u) => ({ id: u.id, email: u.email, app_metadata: { provider: "email" } });
function session(u) {
  const t = "tok" + Math.random().toString(36).slice(2);
  db.tokens[t] = u.id;
  return { access_token: t, refresh_token: "r" + t, expires_in: 3600, token_type: "bearer", user: pub(u) };
}
function who(req) {
  const a = req.headers()["authorization"] || "";
  return db.tokens[a.replace("Bearer ", "")] || null;
}
function match(row, q) {
  for (const [k, v] of q) {
    if (["select", "order", "limit", "offset", "on_conflict"].includes(k)) continue;
    const val =
      k === "key" ? row.key : k === "updated_at" ? row.updated_at : k === "user_id" ? row.user_id : k === "value->>kid" ? row.value && row.value.kid : null;
    if (v.startsWith("eq.") && val !== v.slice(3)) return false;
    if (v.startsWith("gt.") && !(val > v.slice(3))) return false;
    if (v.startsWith("like.") && !String(val).startsWith(v.slice(5).replace("*", ""))) return false;
    if (v.startsWith("not.like.") && String(val).startsWith(v.slice(9).replace("*", ""))) return false;
    if (v.startsWith("in.(")) {
      const ks = v
        .slice(4, -1)
        .split(",")
        .map((x) => x.replace(/^"|"$/g, ""));
      if (!ks.includes(val)) return false;
    }
  }
  return true;
}
// docs/supabase.sql의 check 제약과 같은 규칙
function violates(x) {
  const v = x.value;
  if (x.key === "settings" && v && typeof v === "object" && !Array.isArray(v) && ["apiKey", "runwareKey", "openRouterKey"].some((k) => k in v)) return true;
  return false;
}
const pick = (r, sel) => (sel ? Object.fromEntries(sel.split(",").map((k) => [k, r[k]])) : r);
async function handler(route) {
  const req = route.request(),
    u = new URL(req.url()),
    p = u.pathname,
    m = req.method();
  db.log.push(m + " " + p + decodeURIComponent(u.search).slice(0, 80));
  if (m === "OPTIONS")
    return route.fulfill({
      status: 204,
      headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" }
    });
  const body = req.postData() ? JSON.parse(req.postData()) : null;
  if (p === "/auth/v1/settings") return json(route, 200, { external: { email: true } });
  if (p === "/auth/v1/signup") {
    if (db.users[body.email]) return json(route, 422, { error_code: "user_already_exists", msg: "User already registered" });
    const user = (db.users[body.email] = { id: "u" + Object.keys(db.users).length + "-0000", email: body.email, pw: body.password });
    return json(route, 200, session(user));
  }
  if (p === "/auth/v1/token") {
    if (u.searchParams.get("grant_type") === "password") {
      const user = db.users[body.email];
      if (!user || user.pw !== body.password) return json(route, 400, { error_code: "invalid_credentials", msg: "Invalid login credentials" });
      return json(route, 200, session(user));
    }
    const uid = db.tokens[String(body.refresh_token).slice(1)];
    const user = Object.values(db.users).find((x) => x.id === uid);
    return user ? json(route, 200, session(user)) : json(route, 400, { error_code: "refresh_token_not_found" });
  }
  if (p === "/auth/v1/user") {
    const uid = who(req);
    const user = Object.values(db.users).find((x) => x.id === uid);
    if (!user) return json(route, 401, {});
    if (m === "PUT" && body && body.password) user.pw = body.password;
    return json(route, 200, pub(user));
  }
  if (p === "/rest/v1/rpc/delete_me") {
    const uid = who(req);
    db.rows = db.rows.filter((r) => r.user_id !== uid);
    for (const e of Object.keys(db.users)) if (db.users[e].id === uid) delete db.users[e];
    return json(route, 204);
  }
  if (p === "/auth/v1/logout") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*" } });
  if (p === "/rest/v1/kv") {
    const uid = who(req);
    if (!uid) return json(route, 401, { message: "JWT" });
    const q = [...u.searchParams.entries()],
      prefer = req.headers()["prefer"] || "",
      sel = u.searchParams.get("select");
    if (m === "GET") {
      let rows = db.rows.filter((r) => r.user_id === uid && match(r, q)).sort((a, b) => (a.updated_at < b.updated_at ? -1 : 1));
      const off = +(u.searchParams.get("offset") || 0),
        lim = +(u.searchParams.get("limit") || 1000);
      return json(
        route,
        200,
        rows.slice(off, off + lim).map((r) => pick(r, sel))
      );
    }
    if (m === "POST") {
      const outRows = [];
      for (const x of body) {
        if (x.user_id !== uid) return json(route, 403, { message: "RLS" });
        if (violates(x)) return json(route, 400, { code: "23514", message: "check constraint violated: " + x.key });
        const i = db.rows.findIndex((r) => r.user_id === uid && r.key === x.key);
        if (i >= 0 && prefer.includes("ignore-duplicates")) continue;
        const row = { user_id: uid, key: x.key, value: x.value, updated_at: now() };
        if (i >= 0) db.rows[i] = row;
        else db.rows.push(row);
        outRows.push(row);
      }
      return prefer.includes("return=representation")
        ? json(
            route,
            201,
            outRows.map((r) => pick(r, sel))
          )
        : json(route, 201);
    }
    if (m === "PATCH") {
      const hit = db.rows.filter((r) => r.user_id === uid && match(r, q));
      for (const r of hit) {
        const nx = Object.assign({}, r, body);
        if (violates(nx)) return json(route, 400, { code: "23514" });
        Object.assign(r, body, { updated_at: now() });
      }
      return prefer.includes("return=representation")
        ? json(
            route,
            200,
            hit.map((r) => pick(r, sel))
          )
        : json(route, 204);
    }
    if (m === "DELETE") {
      db.rows = db.rows.filter((r) => !(r.user_id === uid && match(r, q)));
      return json(route, 204);
    }
  }
  return json(route, 404, { message: "mock: unknown " + p });
}
const res = {};
const errs = [];
async function device(engine, dev) {
  const browser = await engine.launch();
  const ctx = await browser.newContext({ ...devices[dev] });
  await ctx.route(SB + "/**", handler);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errs.push(dev + " pageerror: " + e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errs.push(dev + " console: " + m.text().slice(0, 200));
  });
  return { browser, page };
}
const tag = (s) => s.replace(/\W+/g, "_");
try {
  // ---------- PC: 게스트로 시작
  const A = await device(chromium, "Desktop Chrome");
  await A.page.goto(url, { waitUntil: "load" });
  await A.page.waitForTimeout(1000);
  res.firstScreen = await A.page.evaluate(() => ({
    hash: location.hash,
    login: !!document.querySelector("#lform"),
    kakao: !!document.querySelector("[data-oauth=kakao]"),
    google: !!document.querySelector("[data-oauth=google]")
  }));
  if (out) await A.page.screenshot({ path: `${out}/pc_login.png` });
  await A.page.click("#lguest");
  await A.page.waitForTimeout(400);
  res.guestSheet = await A.page.evaluate(() => !!document.querySelector(".overlay [data-aud]"));
  await A.page.click(".overlay [data-aud=f]");
  await A.page.waitForTimeout(300);
  // 게스트 데이터: 대화방 하나, 키(시험용 가짜 값), 그림 하나
  await A.page.evaluate(async () => {
    const r = newRoom(normalizeChar(getChar("hasuk")), 0, S.personas[0]);
    window.__room = r.id;
    S.settings.apiKey = "sk-ant-test-fake";
    saveSettings();
    const cv = document.createElement("canvas");
    cv.width = 40;
    cv.height = 40;
    cv.getContext("2d").fillRect(0, 0, 20, 20);
    const blob = await new Promise((r2) => cv.toBlob(r2, "image/png"));
    window.__img = await IMG.put(blob);
  });
  // 로그인 페이지로 가서 회원가입(모의 서버)
  await A.page.evaluate(() => {
    location.hash = "login";
  });
  await A.page.waitForTimeout(400);
  await A.page.click("#lmode [data-m=up]");
  await A.page.fill("#lmail", "tester@example.test");
  await A.page.fill("#lpw", "test-pass-1");
  await A.page.fill("#lpw2", "test-pass-2");
  await A.page.click("#lgo");
  await A.page.waitForTimeout(200);
  res.mismatch = await A.page.textContent("#lerr");
  await A.page.fill("#lpw2", "test-pass-1");
  await A.page.click("#lgo");
  await A.page.waitForTimeout(2500);
  res.afterSignup = await A.page.evaluate(() => ({ hash: location.hash, on: CLOUD.on, state: CLOUD.state, email: SB.s && SB.s.user.email }));
  res.serverAfterSignup = {
    keys: db.rows.map((r) => r.key).sort(),
    apiKey: (db.rows.find((r) => r.key === "settings") || {}).value?.apiKey,
    fs: "fs" in ((db.rows.find((r) => r.key === "settings") || {}).value || {}),
    aud: (db.rows.find((r) => r.key === "settings") || {}).value?.audience
  };
  const roomId = await A.page.evaluate(() => window.__room),
    imgRef = await A.page.evaluate(() => window.__img);
  // MY 계정 칸
  await A.page.evaluate(() => {
    location.hash = "me";
  });
  await A.page.waitForTimeout(500);
  res.meBox = await A.page.evaluate(() => ({ state: document.querySelector("#cloudState")?.textContent, keys: document.querySelector("#syncKeys")?.checked }));
  if (out) await A.page.screenshot({ path: `${out}/pc_me.png` });

  // ---------- 휴대폰: 같은 계정으로 로그인
  const B = await device(webkit, "iPhone 13");
  await B.page.goto(url, { waitUntil: "load" });
  await B.page.waitForTimeout(1000);
  await B.page.fill("#lmail", "tester@example.test");
  await B.page.fill("#lpw", "wrong-pass");
  await B.page.click("#lgo");
  await B.page.waitForTimeout(500);
  res.wrongPw = await B.page.textContent("#lerr");
  await B.page.fill("#lpw", "test-pass-1");
  await B.page.click("#lgo");
  await B.page.waitForTimeout(2500);
  res.phone = await B.page.evaluate(
    async (args) => ({
      hash: location.hash,
      rooms: S.rooms.map((r) => r.id),
      hasRoom: S.rooms.some((r) => r.id === args.roomId),
      apiKey: S.settings.apiKey,
      aud: S.settings.audience,
      sheet: !!document.querySelector(".overlay"),
      img: ((await IMG.load(args.imgRef.slice(3))) || "").slice(0, 22)
    }),
    { roomId, imgRef }
  );
  if (out) await B.page.screenshot({ path: `${out}/phone_home.png` });
  // 휴대폰에서 새 대화 → PC에서 받아 오기
  await B.page.evaluate(() => {
    const r = newRoom(normalizeChar(getChar("lethe")), 0, S.personas[0]);
    window.__room2 = r.id;
  });
  await B.page.evaluate(() => CLOUD.flush());
  await B.page.waitForTimeout(300);
  const room2 = await B.page.evaluate(() => window.__room2);
  res.pcPull = await A.page.evaluate(async (id) => {
    const n = await CLOUD.pull();
    await reloadFromCloud();
    return { n, has: S.rooms.some((r) => r.id === id), roomBody: !!KV.getLocal(roomKey(id)) };
  }, room2);
  // 내 서재(찜·최근 본)의 날짜 관문 — 날짜 전에는 계정으로 가지 않고, 날짜가 되면 이 기기에만 쌓인 것이 올라가 다른 기기의 것과 합쳐짐(덮지 않음). 찜을 푼 것도 전해짐. 시험은 날짜 상수를 바꿔 양쪽을 모두 봄
  const shelfRow = () => (db.rows.find((r) => r.key === "shelf") || {}).value;
  await A.page.evaluate(async () => {
    SHELF.syncFrom = "2999-01-01";
    toggleLike("lethe");
    await CLOUD.pull();
    await CLOUD.flush();
  });
  await B.page.evaluate(async () => {
    SHELF.syncFrom = "2999-01-01";
    toggleLike("hasuk");
    await CLOUD.pull();
    await CLOUD.flush();
  });
  res.shelfBefore = { server: shelfRow() === undefined, pc: await A.page.evaluate(() => likedIds()), phone: await B.page.evaluate(() => likedIds()) };
  await A.page.evaluate(async () => {
    SHELF.syncFrom = "2000-01-01";
    await CLOUD.pull();
    await CLOUD.flush();
  });
  const up1 = Object.keys((shelfRow() || { likes: {} }).likes);
  await B.page.evaluate(async () => {
    SHELF.syncFrom = "2000-01-01";
    await CLOUD.pull();
    await CLOUD.flush();
  });
  const up2 = Object.keys((shelfRow() || { likes: {} }).likes).sort(),
    phoneLikes = await B.page.evaluate(() => likedIds().slice().sort());
  await B.page.evaluate(async () => {
    toggleLike("lethe");
    await CLOUD.flush();
  });
  res.shelfAfter = {
    up1,
    up2,
    phoneLikes,
    pc: await A.page.evaluate(async () => {
      const n = await CLOUD.pull();
      await reloadFromCloud();
      return { n, likes: likedIds().slice().sort(), kv: Object.keys(KV.getLocal("shelf").unlikes) };
    })
  };
  {
    const b = res.shelfBefore,
      a = res.shelfAfter;
    if (
      !b.server ||
      b.pc.join() !== "lethe" ||
      b.phone.join() !== "hasuk" ||
      a.up1.join() !== "lethe" ||
      a.up2.join() !== "hasuk,lethe" ||
      a.phoneLikes.join() !== "hasuk,lethe" ||
      !a.pc.n ||
      a.pc.likes.join() !== "hasuk" ||
      a.pc.kv.join() !== "lethe"
    )
      errs.push("내 서재의 계정 동기화(날짜 관문·합치기)가 다름: " + JSON.stringify({ b, a }));
  }
  // API 키는 계정에 올라가지 않음 — 휴대폰에는 대화는 넘어오되 키는 비어 있음(MY에서 따로 넣음)
  res.keys = { server: JSON.stringify(db.rows).includes("sk-ant-test-fake"), phone: await B.page.evaluate(() => S.settings.apiKey) };
  if (res.keys.server || res.keys.phone) errs.push("API 키가 계정을 거쳐 넘어감: " + JSON.stringify(res.keys));
  if (!res.phone.hasRoom || !res.phone.img.startsWith("data:image") || !res.pcPull.has || !res.pcPull.roomBody)
    errs.push("기기 사이 이어짐: " + JSON.stringify({ phone: res.phone, pc: res.pcPull }));
  // 휴대폰: 로그아웃 + 기기 데이터 지우기
  await B.page.evaluate(() => {
    location.hash = "me";
  });
  await B.page.waitForTimeout(500);
  if (out) await B.page.screenshot({ path: `${out}/phone_me.png`, fullPage: false });
  await B.page.click("#cOut");
  await B.page.waitForTimeout(200);
  await B.page.click("#lwipe");
  await B.page.click("#lok");
  await B.page.waitForTimeout(1800);
  res.phoneAfterLogout = await B.page.evaluate(() => ({
    hash: location.hash,
    login: !!document.querySelector("#lform"),
    rooms: S.rooms.length,
    auth: !!localStorage.getItem("hv1_auth"),
    apiKey: S.settings.apiKey
  }));
  res.serverStill = db.rows.length;
  // ---------- 갤럭시: 게스트 대화가 있는 채로 같은 계정 로그인 → 합치기
  const C = await device(chromium, "Galaxy S9+");
  await C.page.goto(url, { waitUntil: "load" });
  await C.page.waitForTimeout(900);
  await C.page.click("#lguest");
  await C.page.waitForTimeout(300);
  await C.page.click(".overlay [data-aud=m]");
  const room3 = await C.page.evaluate(() => newRoom(normalizeChar(getChar("daeyeon")), 0, S.personas[0]).id);
  await C.page.evaluate(() => {
    location.hash = "login";
  });
  await C.page.waitForTimeout(400);
  await C.page.fill("#lmail", "tester@example.test");
  await C.page.fill("#lpw", "test-pass-1");
  await C.page.click("#lgo");
  await C.page.waitForTimeout(1500);
  res.mergeSheet = await C.page.evaluate(
    () => document.querySelector(".overlay h2")?.textContent + " / " + document.querySelector(".overlay .sub")?.textContent
  );
  if (out) await C.page.screenshot({ path: `${out}/galaxy_merge.png` });
  await C.page.click("#mYes");
  await C.page.waitForTimeout(2000);
  res.merged = {
    local: await C.page.evaluate(() => S.rooms.map((r) => r.charId)),
    server: (db.rows.find((r) => r.key === "rooms") || {}).value?.map((r) => r.charId),
    room3Body: db.rows.some((r) => r.key === "room-" + room3),
    aud: await C.page.evaluate(() => S.settings.audience)
  };
  await C.browser.close();
  // ---------- 또 다른 기기: 대화는 없고 찜만 있는 게스트가 같은 계정에 로그인 → 찜도 합칠지 물음, '계정 것만 쓰기'를 고르면 이 기기의 찜은 버리고 계정의 찜만(날짜 관문은 지난 것으로)
  const D = await device(chromium, "Desktop Chrome");
  await D.page.goto(url, { waitUntil: "load" });
  await D.page.waitForTimeout(900);
  await D.page.click("#lguest");
  await D.page.waitForTimeout(300);
  await D.page.click(".overlay [data-aud=all]");
  await D.page.evaluate(() => {
    SHELF.syncFrom = "2000-01-01";
    toggleLike("daeyeon");
    location.hash = "login";
  });
  await D.page.waitForTimeout(400);
  await D.page.fill("#lmail", "tester@example.test");
  await D.page.fill("#lpw", "test-pass-1");
  await D.page.click("#lgo");
  await D.page.waitForTimeout(1500);
  const likeSheet = await D.page.evaluate(
    () => document.querySelector(".overlay h2")?.textContent + " / " + document.querySelector(".overlay .sub")?.textContent
  );
  await D.page.click("#mNo");
  await D.page.waitForTimeout(2000);
  res.likeMerge = {
    sheet: likeSheet,
    local: await D.page.evaluate(() => likedIds().slice().sort()),
    server: Object.keys((shelfRow() || { likes: {} }).likes).sort()
  };
  if (!/^이 기기의 찜을 합칠까요\? \/ .*찜한 작품 1개를/.test(likeSheet) || res.likeMerge.local.join() !== "hasuk" || res.likeMerge.server.includes("daeyeon"))
    errs.push("찜만 있는 기기의 처음 로그인(묻기·계정 것만 쓰기)이 다름: " + JSON.stringify(res.likeMerge));
  await D.browser.close();
  // PC: 계정 삭제
  await A.page.evaluate(() => {
    location.hash = "me";
  });
  await A.page.waitForTimeout(400);
  await A.page.click("#cDel");
  await A.page.waitForTimeout(200);
  await A.page.click(".overlay #ok");
  await A.page.waitForTimeout(800);
  res.deleted = {
    rows: db.rows.length,
    users: Object.keys(db.users).length,
    local: await A.page.evaluate(() => ({ rooms: S.rooms.length, signedIn: !!SB.s }))
  };
  await A.browser.close();
  await B.browser.close();
} catch (e) {
  res.fail = String(e).slice(0, 400);
}
res.errors = errs;
res.requests = db.log.length;
console.log(JSON.stringify(res, null, 1));
