// 첫 방문 시험: 처음 온 사람이 작품 주소(#c-<id>)로 들어와도 로그인·둘러보기 뒤 그 작품이 열리는지.
// 둘러보기·이메일 로그인·소셜 로그인(취소·안 켠 공급자)·인증 메일과 비밀번호 재설정 링크(새 탭)·새로 고침, 없는 작품·작품이 아닌 주소,
// 계정에만 있는 작품, 관심있는 대화 시트가 작품을 가리지 않고 홈에 처음 갈 때 뜨는지, 계정의 고른 값을 덮지 않는지.
// Supabase와 소셜 로그인 왕복은 page.route로 흉내 냄(실제 서버·계정 없음). 값이 다르면 errors에 쌓임 → tests/run.mjs가 실패로 판정
import { chromium, webkit, devices } from "playwright";
const [, , url, out] = process.argv; // out: 스크린샷 폴더(없으면 안 찍음)
const SB = "https://mblvphojbmxiuqnlxisi.supabase.co", EMAIL = "first@example.test", UID = "u1-0000", HOUR = 3600000;
const ENABLED = { kakao: true }; // custom:naver는 아직 안 켬

const json = (route, status, body) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: body === undefined ? "" : JSON.stringify(body) });
const pub = (u) => ({ id: u.id, email: u.email, app_metadata: { provider: u.provider, providers: [u.provider] } });
const newDb = () => ({ users: { [EMAIL]: { id: UID, email: EMAIL, provider: "email" }, kakao: { id: "k1-0000", email: "", provider: "kakao" } }, tokens: {}, rows: [], n: 0, oauth: "ok" });
const stamp = (db) => new Date(Date.now() + db.n++).toISOString().replace("Z", "+00:00");
const addRow = (db, key, value) => db.rows.push({ user_id: UID, key, value, updated_at: stamp(db) });
function session(db, u) { const t = "tok" + Math.random().toString(36).slice(2); db.tokens[t] = u; return { access_token: t, refresh_token: "r" + t, expires_in: 3600, token_type: "bearer", user: pub(u) }; }
// 메일 링크가 돌아오는 주소(#access_token=…&type=…)
const mailLink = (db, type) => { const s = session(db, db.users[EMAIL]); return `#access_token=${s.access_token}&refresh_token=${s.refresh_token}&expires_in=3600&token_type=bearer&type=${type}`; };
function matches(row, q) {
  for (const [k, v] of q) {
    if (["select", "order", "limit", "offset", "on_conflict"].includes(k)) continue;
    if (k === "or") { const parts = v.slice(1, -1).split(",").map((x) => { const i = x.indexOf("."); return [x.slice(0, i), x.slice(i + 1)]; }); if (!parts.some((pt) => matches(row, [pt]))) return false; continue; }
    const val = k === "key" ? row.key : k === "updated_at" ? row.updated_at : k === "user_id" ? row.user_id : k === "value->>kid" ? row.value && row.value.kid : null;
    if (v.startsWith("eq.") && val !== v.slice(3)) return false;
    if (v.startsWith("gt.") && !(val > v.slice(3))) return false;
    if (v.startsWith("like.") && !String(val).startsWith(v.slice(5).replace("*", ""))) return false;
    if (v.startsWith("not.like.") && String(val).startsWith(v.slice(9).replace("*", ""))) return false;
    if (v.startsWith("in.(")) { const ks = v.slice(4, -1).split(",").map((x) => x.replace(/^"|"$/g, "")); if (!ks.includes(val)) return false; }
  }
  return true;
}
async function fake(route, db) {
  const req = route.request(), u = new URL(req.url()), p = u.pathname, m = req.method();
  if (m === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" } });
  const body = req.postData() ? JSON.parse(req.postData()) : null, me = db.tokens[(req.headers()["authorization"] || "").replace("Bearer ", "")];
  if (p === "/auth/v1/authorize") {
    const prov = u.searchParams.get("provider"), back = u.searchParams.get("redirect_to");
    if (!ENABLED[prov]) return json(route, 400, { error_code: "validation_failed", msg: "Unsupported provider: provider is not enabled" });
    if (req.resourceType() !== "document") return route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*" }, body: "" }); // 앱의 확인 요청(실제로는 302)
    let to = back + "#error=access_denied&error_code=access_denied&error_description=User+cancelled+login";
    if (db.oauth === "ok") { const s = session(db, db.users.kakao); to = back + `#access_token=${s.access_token}&refresh_token=${s.refresh_token}&expires_in=3600&token_type=bearer&type=signup`; }
    return route.fulfill({ status: 200, contentType: "text/html", body: "<script>location.replace(" + JSON.stringify(to) + ")</script>" });
  }
  if (p === "/auth/v1/token") {
    if (u.searchParams.get("grant_type") === "password") { const user = db.users[body.email]; return user ? json(route, 200, session(db, user)) : json(route, 400, { error_code: "invalid_credentials" }); }
    const user = db.tokens[String(body.refresh_token).slice(1)]; return user ? json(route, 200, session(db, user)) : json(route, 400, { error_code: "refresh_token_not_found" });
  }
  if (p === "/auth/v1/signup") return json(route, 200, { id: UID, user: pub(db.users[EMAIL]) }); // 이메일 인증이 켜져 있으면 세션 없이 옴
  if (p === "/auth/v1/recover") return json(route, 200, {});
  if (p === "/auth/v1/user") return me ? json(route, 200, pub(me)) : json(route, 401, {});
  if (p === "/auth/v1/logout") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*" } });
  if (p !== "/rest/v1/kv") return json(route, 200, []); // 공지 등 — 이 시험과 상관없음
  if (!me) return json(route, 401, { message: "JWT" });
  const q = [...u.searchParams.entries()], prefer = req.headers()["prefer"] || "", sel = u.searchParams.get("select");
  const pick = (r) => sel ? Object.fromEntries(sel.split(",").map((k) => [k, r[k]])) : r, own = (r) => r.user_id === me.id;
  if (m === "GET") { const off = +(u.searchParams.get("offset") || 0), lim = +(u.searchParams.get("limit") || 1000); return json(route, 200, db.rows.filter((r) => own(r) && matches(r, q)).slice(off, off + lim).map(pick)); }
  if (m === "POST") {
    const put = [];
    for (const x of body) {
      const i = db.rows.findIndex((r) => own(r) && r.key === x.key);
      if (i >= 0 && prefer.includes("ignore-duplicates")) continue;
      const row = { user_id: me.id, key: x.key, value: x.value, updated_at: stamp(db) };
      if (i >= 0) db.rows[i] = row; else db.rows.push(row);
      put.push(row);
    }
    return prefer.includes("return=representation") ? json(route, 201, put.map(pick)) : json(route, 201);
  }
  if (m === "PATCH") { const hit = db.rows.filter((r) => own(r) && matches(r, q)); hit.forEach((r) => Object.assign(r, body, { updated_at: stamp(db) })); return prefer.includes("return=representation") ? json(route, 200, hit.map(pick)) : json(route, 204); }
  if (m === "DELETE") { db.rows = db.rows.filter((r) => !(own(r) && matches(r, q))); return json(route, 204); }
  return json(route, 404, {});
}

// 화면 상태 한 묶음: work는 주소의 작품 제목이 상세 화면에 보이는지
const state = (pg) => pg.evaluate(() => {
  const id = location.hash.startsWith("#c-") ? location.hash.slice(3) : "", c = id && getChar(id), h1 = document.querySelector(".detail h1");
  return { hash: location.hash, login: !!document.querySelector("#lguest"), sheet: !!document.querySelector(".overlay"), work: !!(c && h1 && h1.textContent === c.title), audUnset: !AUDS[S.settings.audience], aud: S.settings.audience, signedIn: !!SB.s, saved: localStorage.getItem("hv1_back"), token: /access_token/.test(location.href), overflow: document.documentElement.scrollWidth - innerWidth, atTop: document.querySelector("#view").scrollTop === 0 && scrollY === 0 };
});
const opened = (pg, hash) => pg.goto(url + hash, { waitUntil: "load" }).then(() => pg.waitForFunction(() => document.querySelector("#view .page"), null, { timeout: 15000 }));
const hashIs = (pg, h) => pg.waitForFunction((x) => location.hash === x, h, { timeout: 15000 }).catch(() => {}).then(() => pg.waitForTimeout(150)); // 주소가 바뀐 뒤 화면이 그려질 틈까지
const settle = (pg) => pg.waitForTimeout(350); // 늦게 뜨는 시트·라우팅까지 끝나기를 기다림
const guest = (pg) => pg.click("#lguest");
const signIn = async (pg) => { await pg.fill("#lmail", EMAIL); await pg.fill("#lpw", "password-1"); await pg.click("#lgo"); };
const synced = (pg) => pg.waitForFunction(() => CLOUD.state === "ok", null, { timeout: 20000 }).catch(() => {});

for (const [dev, engine] of [["Desktop Chrome", chromium], ["iPhone 13", webkit]]) {
  const res = { dev, passed: 0, errors: [] }, tag = dev.replace(/\W+/g, "_");
  const browser = await engine.launch();
  const expect = async (pg, label, want) => {
    const got = await state(pg), wrong = Object.keys(want).filter((k) => JSON.stringify(got[k]) !== JSON.stringify(want[k]));
    if (wrong.length) res.errors.push(`${label}: ` + wrong.map((k) => `${k} ${JSON.stringify(got[k])} (기대 ${JSON.stringify(want[k])})`).join(", ")); else res.passed++;
  };
  const scenario = async (name, fn) => {
    const db = newDb(), ctx = await browser.newContext({ ...devices[dev] });
    await ctx.route(SB + "/**", (r) => fake(r, db));
    const watch = (p) => { p.on("pageerror", (e) => res.errors.push(`${name} pageerror: ${e.message}`)); p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) res.errors.push(`${name} console: ${m.text().slice(0, 200)}`); }); return p; };
    try { await fn(watch(await ctx.newPage()), db, async () => watch(await ctx.newPage())); }
    catch (e) { res.errors.push(`${name}: ${String(e).slice(0, 300)}`); }
    await ctx.close();
  };

  // 둘러보기 → 그 작품, 시트 없음, 방문 기록에 로그인 화면이 안 남음 → 홈에 처음 가면 시트
  await scenario("guest", async (pg) => {
    await opened(pg, "#c-hwanghu");
    await expect(pg, "첫 화면", { hash: "#login-c-hwanghu", login: true, sheet: false, overflow: 0 });
    if (out) await pg.screenshot({ path: `${out}/firstvisit_${tag}_login.png` });
    const before = await pg.evaluate(() => history.length);
    await pg.evaluate(() => document.querySelector("#lguest").scrollIntoView()); // 폼 아래쪽 버튼 — 눌러도 다음 화면은 맨 위부터
    await guest(pg); await hashIs(pg, "#c-hwanghu"); await settle(pg);
    await expect(pg, "둘러보기 뒤", { hash: "#c-hwanghu", work: true, login: false, sheet: false, audUnset: true, overflow: 0, atTop: true });
    if (out) await pg.screenshot({ path: `${out}/firstvisit_${tag}_work.png` });
    if ((await pg.evaluate(() => history.length)) !== before) res.errors.push("둘러보기: 로그인 화면이 방문 기록에 남음");
    await pg.reload({ waitUntil: "load" }); await pg.waitForFunction(() => document.querySelector(".detail h1"), null, { timeout: 15000 }); await settle(pg);
    await expect(pg, "작품에서 새로 고침", { hash: "#c-hwanghu", work: true, sheet: false, audUnset: true });
    await pg.click(".topbar [data-go=home]"); await hashIs(pg, "#home"); await settle(pg);
    await expect(pg, "홈에 처음", { hash: "#home", sheet: true, aud: "all" });
    if (out) await pg.screenshot({ path: `${out}/firstvisit_${tag}_home_sheet.png` });
    await pg.click(".overlay [data-aud=f]"); await settle(pg);
    await expect(pg, "시트에서 고름", { hash: "#home", sheet: false, aud: "f" });
    await pg.evaluate(() => { location.hash = "c-hasuk"; }); await hashIs(pg, "#c-hasuk");
    await pg.evaluate(() => { location.hash = "home"; }); await hashIs(pg, "#home"); await settle(pg);
    await expect(pg, "홈 다시", { sheet: false, aud: "f" });
  });
  // 로그인 화면에서 새로 고쳐도 갈 곳이 남음
  await scenario("reload", async (pg) => {
    await opened(pg, "#c-hasuk");
    await pg.reload({ waitUntil: "load" }); await pg.waitForFunction(() => document.querySelector("#lguest"), null, { timeout: 15000 });
    await expect(pg, "새로 고침", { hash: "#login-c-hasuk", login: true });
    await guest(pg); await hashIs(pg, "#c-hasuk");
    await expect(pg, "새로 고침 뒤 둘러보기", { work: true, sheet: false });
  });
  // 없는 작품 → 홈(홈이니 시트도 평소처럼)
  await scenario("unknown", async (pg) => {
    await opened(pg, "#c-nope");
    await expect(pg, "없는 작품 첫 화면", { hash: "#login-c-nope", login: true });
    await guest(pg); await hashIs(pg, "#home"); await settle(pg);
    await expect(pg, "없는 작품 둘러보기", { hash: "#home", work: false, sheet: true });
  });
  await scenario("unknown-login", async (pg) => {
    await opened(pg, "#c-nope");
    await signIn(pg); await hashIs(pg, "#home"); await synced(pg); await settle(pg);
    await expect(pg, "없는 작품 로그인", { hash: "#home", work: false, signedIn: true });
  });
  // 작품 주소가 아니면 돌아가지 않음
  await scenario("not-work", async (pg, db, tab) => {
    for (const h of ["#store", "#c-", "#login-store", "#login-r-abc", "#login-c-"]) { const p = await tab(); await opened(p, h); await expect(p, h + " 첫 화면", { hash: "#login", login: true }); await p.close(); }
    await opened(pg, "#store"); await guest(pg); await hashIs(pg, "#home");
    await expect(pg, "작품 아닌 주소 둘러보기", { hash: "#home" });
    await pg.evaluate(() => { localStorage.removeItem("hv1_guest"); localStorage.setItem("hv1_back", JSON.stringify({ to: "store", at: Date.now() })); });
    const p = await tab(); await opened(p, "");
    await expect(p, "꾸민 hv1_back", { hash: "#login", saved: null });
  });
  // 이메일 로그인 → 그 작품, 시트 없음 → 홈에 처음 가면 시트(계정에 고른 값이 없을 때)
  await scenario("email", async (pg, db) => {
    await opened(pg, "#c-lethe");
    const before = await pg.evaluate(() => history.length);
    await signIn(pg); await hashIs(pg, "#c-lethe"); await synced(pg); await settle(pg);
    await expect(pg, "로그인 뒤", { hash: "#c-lethe", work: true, signedIn: true, login: false, sheet: false, audUnset: true });
    if ((await pg.evaluate(() => history.length)) !== before) res.errors.push("로그인: 로그인 화면이 방문 기록에 남음");
    await pg.evaluate(() => { location.hash = "home"; }); await hashIs(pg, "#home"); await settle(pg);
    await expect(pg, "로그인 뒤 홈에 처음", { sheet: true });
    const leak = await pg.evaluate(() => { localStorage.setItem("hv1_back", JSON.stringify({ to: "c-lethe", at: Date.now() })); const ks = localKVKeys(); localStorage.removeItem("hv1_back"); return ks.includes("back"); });
    if (leak || db.rows.some((r) => r.key === "back")) res.errors.push("hv1_back이 계정에 올라감");
  });
  // 계정에 고른 관심있는 대화가 있으면 덮지 않고 묻지도 않음
  await scenario("account-aud", async (pg, db) => {
    addRow(db, "settings", { audience: "m" }); addRow(db, "mine", []);
    await opened(pg, "#c-daeyeon");
    await signIn(pg); await hashIs(pg, "#c-daeyeon"); await synced(pg); await settle(pg);
    await expect(pg, "계정 값", { work: true, sheet: false, aud: "m" });
    await pg.evaluate(() => { location.hash = "home"; }); await hashIs(pg, "#home"); await settle(pg);
    await expect(pg, "계정 값 홈", { sheet: false, aud: "m" });
  });
  // 계정에만 있는 내 작품: 받아 온 뒤에 열림
  await scenario("own-work", async (pg, db) => {
    await opened(pg, "#c-mywork");
    addRow(db, "mine", [await pg.evaluate(() => Object.assign({}, ORIGINALS[0], { id: "mywork", title: "내가 만든 시험 작품" }))]);
    await signIn(pg); await hashIs(pg, "#c-mywork"); await settle(pg);
    await expect(pg, "내 작품", { hash: "#c-mywork", work: true, signedIn: true });
  });
  // 소셜 로그인: 페이지를 떠났다 돌아와도 그 작품, 주소에 토큰 없음, 적어 둔 값은 지워짐
  await scenario("oauth", async (pg) => {
    await opened(pg, "#c-seodoyun");
    await pg.click("[data-oauth=kakao]"); await pg.waitForLoadState("load"); await hashIs(pg, "#c-seodoyun"); await synced(pg); await settle(pg);
    await expect(pg, "소셜 로그인 뒤", { hash: "#c-seodoyun", work: true, signedIn: true, token: false, saved: null, sheet: false });
  });
  // 소셜 로그인을 취소하고 돌아옴 → 로그인 화면에 갈 곳이 그대로
  await scenario("oauth-cancel", async (pg, db) => {
    db.oauth = "cancel";
    await opened(pg, "#c-kael");
    await pg.click("[data-oauth=kakao]");
    // 돌아온 주소가 떠나기 전과 같으니 왕복이 끝났는지는 '적어 둔 값을 새 페이지가 꺼내 지웠는지'로 봄
    await pg.waitForFunction(() => typeof AUDS !== "undefined" && !localStorage.getItem("hv1_back") && document.querySelector("#lguest"), null, { timeout: 15000 });
    await expect(pg, "취소 뒤", { hash: "#login-c-kael", login: true, signedIn: false, saved: null, token: false });
    await pg.waitForFunction(() => Array.from(document.querySelectorAll(".toast")).some((t) => /취소/.test(t.textContent)), null, { timeout: 5000 }).catch(() => res.errors.push("취소 안내가 없음"));
    await guest(pg); await hashIs(pg, "#c-kael");
    await expect(pg, "취소 뒤 둘러보기", { work: true });
  });
  // 안 켠 공급자: 페이지를 떠나지 않으니 적어 둔 값을 남기지 않음
  await scenario("oauth-off", async (pg) => {
    await opened(pg, "#c-kael");
    await pg.click("[data-oauth='custom:naver']"); await pg.waitForFunction(() => document.querySelector("#loerr").textContent !== "", null, { timeout: 10000 });
    await expect(pg, "안 켠 공급자", { hash: "#login-c-kael", login: true, saved: null });
  });
  // 인증 메일을 새 탭에서 열어도 그 작품
  await scenario("mail-confirm", async (pg, db, tab) => {
    await opened(pg, "#c-baekyeon");
    await pg.click("#lmode [data-m=up]"); await pg.fill("#lmail", EMAIL); await pg.fill("#lpw", "password-1"); await pg.fill("#lpw2", "password-1"); await pg.click("#lgo");
    await pg.waitForFunction(() => /인증 메일/.test(document.querySelector("#lerr").textContent), null, { timeout: 15000 });
    const saved = (await state(pg)).saved;
    if (!saved || !saved.includes("c-baekyeon")) res.errors.push("인증 메일: 갈 곳을 적어 두지 않음 " + saved);
    const p = await tab(); await opened(p, mailLink(db, "signup")); await hashIs(p, "#c-baekyeon"); await synced(p); await settle(p);
    await expect(p, "인증 메일 링크", { hash: "#c-baekyeon", work: true, signedIn: true, token: false, saved: null });
  });
  // 적어 둔 지 1시간이 지났으면 쓰지 않음
  await scenario("mail-expired", async (pg, db, tab) => {
    await opened(pg, "");
    await pg.evaluate((at) => localStorage.setItem("hv1_back", JSON.stringify({ to: "c-baekyeon", at })), Date.now() - 2 * HOUR);
    const p = await tab(); await opened(p, mailLink(db, "signup")); await synced(p); await settle(p);
    await expect(p, "오래된 값", { work: false, signedIn: true, saved: null });
    if ((await p.evaluate(() => !!document.querySelector(".detail")))) res.errors.push("오래된 값으로 작품이 열림");
  });
  // 비밀번호 재설정 링크: 그 작품 위에 새 비밀번호 창이 남아 있음
  await scenario("recovery", async (pg, db, tab) => {
    await opened(pg, "#c-baekya");
    await pg.fill("#lmail", EMAIL); await pg.click("#lforgot");
    await pg.waitForFunction(() => /재설정 메일/.test(document.querySelector("#lerr").textContent), null, { timeout: 15000 });
    const p = await tab(); await opened(p, mailLink(db, "recovery")); await hashIs(p, "#c-baekya");
    await p.waitForSelector("#npw", { timeout: 15000 }); await settle(p);
    await expect(p, "재설정 링크", { hash: "#c-baekya", work: true, signedIn: true, sheet: true, saved: null });
    if (!(await p.evaluate(() => !!document.querySelector("#npw")))) res.errors.push("새 비밀번호 창이 닫힘");
  });
  // 로그인 화면에서 메뉴로 나가면 갈 곳이 사라짐(나중에 로그인해도 끌려가지 않음)
  await scenario("nav-away", async (pg) => {
    await opened(pg, "#c-yunhaera");
    await pg.evaluate(() => { location.hash = "home"; }); await hashIs(pg, "#home");
    await pg.evaluate(() => { location.hash = "login"; }); await hashIs(pg, "#login"); await pg.waitForSelector("#lmail");
    await signIn(pg); await hashIs(pg, "#home"); await synced(pg); await settle(pg);
    await expect(pg, "메뉴로 나간 뒤 로그인", { hash: "#home", work: false, signedIn: true });
  });
  // 이미 둘러본 사람은 로그인 화면 없이 바로, 없는 작품은 예전처럼 안내
  await scenario("returning", async (pg, db, tab) => {
    await opened(pg, ""); await guest(pg); await hashIs(pg, "#home"); await settle(pg);
    await pg.click(".overlay [data-aud=all]"); await settle(pg);
    let p = await tab(); await opened(p, "#c-hangyeoul");
    await expect(p, "다시 온 사람", { hash: "#c-hangyeoul", work: true, login: false, sheet: false });
    p = await tab(); await opened(p, "#c-nope");
    await expect(p, "다시 온 사람 없는 작품", { hash: "#c-nope", login: false, work: false });
    if (!/찾을 수 없어요/.test(await p.evaluate(() => document.querySelector("#view").textContent))) res.errors.push("없는 작품 안내가 없음");
    p = await tab(); await opened(p, "#login-c-hangyeoul");
    await expect(p, "둘러보던 사람이 로그인 주소로", { hash: "#c-hangyeoul", work: true, login: false });
    await p.evaluate(() => { location.hash = "login"; }); await hashIs(p, "#login"); await p.waitForSelector("#lguest");
    await guest(p); await hashIs(p, "#home");
    await expect(p, "MY에서 연 로그인 → 둘러보기", { hash: "#home", work: false });
  });

  await browser.close();
  console.log(JSON.stringify(res));
}
