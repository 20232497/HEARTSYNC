// 계정 저장 시험: Supabase를 page.route로 흉내 냄(실제 서버로는 아무것도 안 감). 키는 모두 시험용 가짜 값
// PC 게스트 → 이메일 가입(계정이 비어 이 기기 데이터를 올림) → 휴대폰 로그인으로 대화·그림 받음 → 휴대폰 새 대화를 PC가 받음 → API 키는 계정에 안 올라감
// → 휴대폰 로그아웃(기기 지우기) → 갤럭시 게스트 대화 합치기 → 계정 삭제
// → 로그아웃 보호: 계정에 못 올린 것이 있으면 '기기 데이터도 지우기'를 골라도 지우지 않음(전송이 도는 중이어도) — 다시 올린 뒤에만 지우거나, 지우지 않고 로그아웃
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
    // 로그아웃 보호 시험용: 저장 요청만 붙잡아 두거나(gate) 실패시킴(failKv) — 읽기는 그대로
    if (m === "POST" && db.gate) {
      db.holding = (db.holding || 0) + 1; // 지금 붙잡고 있는 저장 요청 수
      await db.gate.opened; // 시험이 db.gate.open()을 부를 때까지 붙잡아 둠(전송이 '도는 중'인 상태를 시간에 기대지 않고 만듦)
      db.holding--;
    }
    if (m === "POST" && db.failKv) return json(route, 500, { message: "mock: 저장 실패" });
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
  // 내 서재의 날짜 관문을 처음부터 '날짜 전'으로 잡아 둠 — 시험은 이 상수를 바꿔 양쪽을 보는데, 실제 날짜가 SHELF.syncFrom을 지난 뒤에는 페이지를 여는 순간 이미
  // 열려 있어(로그인 직후의 받기가 '서재를 한 번 올림' 표시를 먼저 켬) 아래 '날짜 전' 장면이 성립하지 않음. 실제 날짜에 기대지 않게 함
  await A.page.evaluate(() => {
    SHELF.syncFrom = "2999-01-01";
  });
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

  // 예전 빌드가 계정에 남긴 화면 테마 값을 흉내 냄(지금은 기기마다 따로라 올리지 않음) — 다른 기기가 받아도 그 기기의 테마가 바뀌면 안 됨
  {
    const row = db.rows.find((r) => r.key === "settings");
    if (row) row.value = { ...row.value, theme: "dark" };
  }
  // ---------- 휴대폰: 같은 계정으로 로그인
  const B = await device(webkit, "iPhone 13");
  await B.page.goto(url, { waitUntil: "load" });
  await B.page.waitForTimeout(1000);
  await B.page.evaluate(() => {
    SHELF.syncFrom = "2999-01-01";
  });
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
      theme: [S.settings.theme || "", document.documentElement.getAttribute("data-theme") || ""].join("|"), // 계정의 옛 테마 값을 받지 않았어야 함("|")
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
  // 건너뛴 행 다시 받기: PC가 방을 열어 둔 사이 휴대폰이 그 방을 고침 → PC의 받기는 열린 방을 덮지 않고 넘어감(받은 자리 표시는 이미 그 행을 지나감) →
  // 방에서 나오면 그 방만 다시 받아 옴(이쪽에서 더 고치지 않아도). 다시 받은 방은 메모리에 든 옛 사본 대신 저장된 것으로 다시 열림
  await A.page.evaluate((id) => {
    location.hash = "r-" + id;
  }, room2);
  await A.page.waitForFunction((id) => !!room && room.id === id && !!document.querySelector("#inp"), room2, { timeout: 8000 });
  await B.page.evaluate(async (id) => {
    const r = await KV.get(roomKey(id));
    r.userNote = "휴대폰에서 고침";
    saveRoom(r);
    await CLOUD.flush();
  }, room2);
  const heldNote = await A.page.evaluate(async (id) => {
    await CLOUD.pull();
    return (KV.getLocal(roomKey(id)) || {}).userNote || "";
  }, room2);
  await A.page.evaluate(() => {
    location.hash = "home";
  });
  await A.page.waitForFunction((id) => (KV.getLocal(roomKey(id)) || {}).userNote === "휴대폰에서 고침", room2, { timeout: 5000 }).catch(() => {});
  res.retake = await A.page.evaluate((id) => ({ note: (KV.getLocal(roomKey(id)) || {}).userNote || "", inMemory: !!(room && room.id === id) }), room2);
  res.retake.held = heldNote;
  // 그 방을 다시 열면 받은 내용으로 열림(메모리의 옛 사본이 아니라)
  await A.page.evaluate((id) => {
    location.hash = "r-" + id;
  }, room2);
  await A.page.waitForFunction((id) => !!room && room.id === id && !!document.querySelector("#inp"), room2, { timeout: 5000 }).catch(() => {});
  res.retake.reopened = await A.page.evaluate(() => (room && document.querySelector("#inp") ? room.userNote : "(방이 안 열림)"));
  await A.page.evaluate(() => {
    location.hash = "home";
  });
  await A.page.waitForTimeout(300);
  // 응답 생성·요약이 아직 쓰고 있는 방은(화면을 떠났어도) 받은 것으로 덮지 않고 미뤘다가, 그 일이 끝난 뒤에 받음 — 끝나면서 저장하는 옛 사본이 받은 것을 덮지 않게
  await A.page.evaluate((id) => holdRoom(id), room2);
  await B.page.evaluate(async (id) => {
    const r = await KV.get(roomKey(id));
    r.userNote = "휴대폰에서 또 고침";
    saveRoom(r);
    await CLOUD.flush();
  }, room2);
  res.retake.busy = await A.page.evaluate(async (id) => {
    await CLOUD.pull();
    const during = (KV.getLocal(roomKey(id)) || {}).userNote || "";
    releaseRoom(id);
    await CLOUD.retake();
    return { during, after: (KV.getLocal(roomKey(id)) || {}).userNote || "" };
  }, room2);
  if (
    heldNote !== "" ||
    res.retake.note !== "휴대폰에서 고침" ||
    res.retake.inMemory ||
    res.retake.reopened !== "휴대폰에서 고침" ||
    res.retake.busy.during !== "휴대폰에서 고침" ||
    res.retake.busy.after !== "휴대폰에서 또 고침"
  )
    errs.push("건너뛴 행 다시 받기(열어 둔 방에 온 변경이 방을 나온 뒤 반영됨)가 다름: " + JSON.stringify(res.retake));
  // 전송은 한 번에 하나: 앞의 저장 요청이 서버에 붙잡혀 있는 동안 같은 키를 또 바꾸면, 뒤의 값은 앞의 요청이 끝난 뒤에 올라가 계정에 마지막 값이 남음
  // (겹쳐 나가면 늦게 끝난 옛 값이 새 값을 덮을 수 있었음)
  {
    let open;
    db.gate = { opened: new Promise((r) => (open = r)), open: () => open() };
  }
  const setMemo = (memo) =>
    KV.set(
      "personas",
      S.personas.map((x, i) => (i ? x : { ...x, memo }))
    );
  await A.page.evaluate(setMemo, "첫 번째");
  for (let i = 0; i < 50 && !db.holding; i++) await A.page.waitForTimeout(100);
  const firstHeld = (db.holding || 0) > 0;
  await A.page.evaluate(setMemo, "두 번째");
  await A.page.waitForTimeout(1400); // 두 번째 모으기(0.8초)가 끝남 — 겹쳐 나갔다면 붙잡힌 요청이 둘
  const overlapped = (db.holding || 0) > 1;
  db.gate.open();
  db.gate = null;
  await A.page.waitForTimeout(1000);
  res.oneAtATime = { firstHeld, overlapped, memo: (((db.rows.find((r) => r.key === "personas") || {}).value || [])[0] || {}).memo };
  if (!firstHeld || overlapped || res.oneAtATime.memo !== "두 번째")
    errs.push("전송은 한 번에 하나(마지막 값이 계정에 남음)가 다름: " + JSON.stringify(res.oneAtATime));
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
  if (res.phone.theme !== "|") errs.push("계정에 남은 화면 테마 값이 다른 기기로 넘어옴(테마는 기기마다 따로): " + res.phone.theme);
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
  // 합치기 창을 버튼이 아닌 길(Esc)로 닫아도 뒤처리가 끝남 — '그냥 닫으면 아무것도 잃지 않게 합침'. 전에는 Esc·화면 이동으로 닫으면 합치지도 않고 로그인 뒤 처리가 멈췄음
  await C.page.keyboard.press("Escape");
  await C.page.waitForTimeout(2000);
  res.merged = {
    local: await C.page.evaluate(() => S.rooms.map((r) => r.charId)),
    server: (db.rows.find((r) => r.key === "rooms") || {}).value?.map((r) => r.charId),
    room3Body: db.rows.some((r) => r.key === "room-" + room3),
    aud: await C.page.evaluate(() => S.settings.audience)
  };
  res.merged.state = await C.page.evaluate(() => CLOUD.state);
  {
    const g = res.merged;
    if (!g.local.includes("daeyeon") || !(g.server || []).includes("daeyeon") || !g.room3Body || g.state !== "ok")
      errs.push("합치기 창을 Esc로 닫았을 때의 뒤처리(합치고 로그인 뒤 처리가 끝남)가 다름: " + JSON.stringify(g));
  }
  // 로그아웃 보호 ①: 새 대화를 계정에 올리는 전송이 도는 중(가짜 서버가 첫 저장 요청을 붙잡아 둠)에 '이 기기의 데이터도 지우기'로 로그아웃 →
  // 도는 전송을 기다리며 화면을 막음(가림막이 화면을 덮고 키 눌림도 막음) → 붙잡은 요청이 실패로 끝나면 지우지 않고 '아직 올리지 못한 것이 있어요' 창 →
  // 실패하는 동안 '다시 올리기'를 눌러도 그대로 → 서버가 돌아온 뒤 '다시 올리기' → 올라간 뒤에야 지우고 로그아웃
  {
    let open;
    db.gate = { opened: new Promise((r) => (open = r)), open: () => open() };
  }
  db.failKv = true;
  const room4 = await C.page.evaluate(() => newRoom(normalizeChar(getChar("lethe")), 0, S.personas[0]).id);
  for (let i = 0; i < 50 && !db.holding; i++) await C.page.waitForTimeout(100); // 0.8초 모으기가 끝나 첫 저장 요청이 서버에 붙잡힐 때까지
  const inflight = (db.holding || 0) > 0;
  await C.page.evaluate(() => {
    location.hash = "me";
  });
  await C.page.waitForTimeout(400);
  await C.page.click("#cOut");
  await C.page.waitForTimeout(200);
  await C.page.click("#lwipe");
  await C.page.click("#lok");
  await C.page.waitForTimeout(700);
  // 아직 앞의 전송이 붙잡혀 있음: 로그아웃은 그것을 기다리는 중 — 가림막이 화면 전체를 덮고, 뒤쪽 버튼에 포커스를 두고 Enter를 눌러도 눌리지 않음, 아무것도 지워지지 않음
  await C.page.evaluate(() => {
    const btn = document.querySelector("#cSync");
    window.__behind = 0;
    btn.addEventListener("click", () => window.__behind++, true);
    btn.focus();
  });
  await C.page.keyboard.press("Enter"); // 진짜 키 눌림 — 막지 않으면 포커스가 있는 버튼이 눌림
  const waiting = await C.page.evaluate((id) => {
    const v = document.querySelector(".veil"),
      r = v ? v.getBoundingClientRect() : { width: 0, height: 0 };
    return {
      held: true,
      covers: r.width >= innerWidth && r.height >= innerHeight,
      keyBlocked: window.__behind === 0,
      body: !!KV.getLocal(roomKey(id)),
      signedIn: !!SB.s,
      sheet: !!document.querySelector("#lRetry")
    };
  }, room4);
  waiting.held = (db.holding || 0) > 0; // 재는 동안에도 붙잡혀 있었는지
  db.gate.open(); // 붙잡은 요청을 놓아 줌 → 실패로 끝남 → 이어 붙은 로그아웃의 전송도 실패
  db.gate = null;
  await C.page.waitForTimeout(1500);
  const guardNow = (id) => ({ body: !!KV.getLocal(roomKey(id)), sheet: !!document.querySelector("#lRetry"), signedIn: !!SB.s });
  const guard1 = await C.page.evaluate(guardNow, room4);
  if (guard1.sheet) await C.page.click("#lRetry");
  await C.page.waitForTimeout(1200);
  const guard2 = await C.page.evaluate(guardNow, room4);
  db.failKv = false;
  if (guard2.sheet) await C.page.click("#lRetry");
  await C.page.waitForTimeout(2200);
  res.logoutGuard = {
    inflight,
    waiting,
    guard1,
    guard2,
    server: db.rows.some((r) => r.key === "room-" + room4),
    after: await C.page.evaluate(() => ({ login: !!document.querySelector("#lform"), rooms: S.rooms.length, auth: !!localStorage.getItem("hv1_auth") }))
  };
  {
    const g = res.logoutGuard,
      w = waiting,
      held = (x) => x.body && x.sheet && x.signedIn;
    if (!inflight || !w.held || !w.covers || !w.keyBlocked || !w.body || !w.signedIn || w.sheet)
      errs.push("로그아웃 보호(도는 전송을 기다리는 동안 화면을 막고 아무것도 지우지 않음)가 다름: " + JSON.stringify({ inflight, waiting: w }));
    if (!held(guard1) || !held(guard2) || !g.server || !g.after.login || g.after.rooms || g.after.auth)
      errs.push("로그아웃 보호(못 올린 대화가 있으면 기기를 지우지 않고, 다시 올린 뒤에만 지움)가 다름: " + JSON.stringify(g));
  }
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
  // 로그아웃 보호 ②: 저장이 실패하는 채로 — '지금 동기화'가 '이미 최신이에요'라고 하지 않고, '기기 데이터도 지우기'를 골라도 창에서 '지우지 않고 로그아웃'을 누르면
  // 로그아웃만 되고 이 기기의 대화는 남음
  db.failKv = true;
  const room5 = await D.page.evaluate(() => newRoom(normalizeChar(getChar("hasuk")), 0, S.personas[0]).id);
  await D.page.evaluate(() => {
    location.hash = "me";
  });
  await D.page.waitForTimeout(400);
  await D.page.click("#cSync");
  await D.page.waitForTimeout(700);
  const syncToast = await D.page.evaluate(() => (document.querySelector(".toast") || {}).textContent || "");
  await D.page.click("#cOut");
  await D.page.waitForTimeout(200);
  await D.page.click("#lwipe");
  await D.page.click("#lok");
  await D.page.waitForTimeout(1200);
  const keepSheet = await D.page.evaluate(() => !!document.querySelector("#lKeep"));
  if (keepSheet) await D.page.click("#lKeep");
  await D.page.waitForTimeout(900);
  res.logoutKeep = await D.page.evaluate(
    (id) => ({
      body: !!KV.getLocal(roomKey(id)),
      listed: S.rooms.some((r) => r.id === id),
      signedIn: !!SB.s,
      guest: localStorage.getItem("hv1_guest")
    }),
    room5
  );
  db.failKv = false;
  {
    const k = res.logoutKeep;
    if (!/못했/.test(syncToast)) errs.push("저장이 실패했는데 '지금 동기화'가 못 했다고 알리지 않음: " + syncToast);
    if (!keepSheet || !k.body || !k.listed || k.signedIn || k.guest !== "1")
      errs.push("로그아웃 보호(지우지 않고 로그아웃)가 다름: " + JSON.stringify({ keepSheet, ...k }));
  }
  // '계정 것만 쓰기': 계정에 대화 목록 행이 없어도(올리다 실패한 계정 등) 이 기기의 목록이 남아 다시 올라가지 않음 — 목록에서 빼고 본문은 이 기기에 그대로 둠
  db.rows = db.rows.filter((r) => r.key !== "rooms");
  await D.page.evaluate(() => {
    location.hash = "login";
  });
  await D.page.waitForTimeout(400);
  await D.page.fill("#lmail", "tester@example.test");
  await D.page.fill("#lpw", "test-pass-1");
  await D.page.click("#lgo");
  await D.page.waitForTimeout(1500);
  const onlySheet = await D.page.evaluate(() => !!document.querySelector("#mNo"));
  if (onlySheet) await D.page.click("#mNo");
  await D.page.waitForTimeout(2000);
  res.accountOnly = await D.page.evaluate(async (id) => {
    await CLOUD.flush();
    return { rooms: S.rooms.map((r) => r.id), body: !!KV.getLocal(roomKey(id)) };
  }, room5);
  res.accountOnly.server = ((db.rows.find((r) => r.key === "rooms") || {}).value || []).map((r) => r.id);
  if (!onlySheet || res.accountOnly.rooms.length || !res.accountOnly.body || res.accountOnly.server.length)
    errs.push("계정 것만 쓰기(계정에 목록이 없으면 이 기기의 목록도 비우고 본문은 남김)가 다름: " + JSON.stringify({ onlySheet, ...res.accountOnly }));
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
