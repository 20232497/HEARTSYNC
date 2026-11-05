// 휴대폰 성인 인증 흐름 시험: 함수는 진짜 코드(docs/edge/verify-adult.ts), PortOne SDK·API와 표·인증 서버만 가짜(_idv-fake.mjs) — 실제 서버로는 아무것도 안 감.
// 꺼져 있으면(기본) 자기 확인 그대로·요청 없음 → 켜면 자기 확인을 인정하지 않음(둘러보기는 로그인 안내) → PC 인증(SDK는 누를 때만, 통과하면 수위 옵션이 열림) →
// 서버 값이 기기 캐시를 이김·로그아웃하면 꺼짐 → 미성년·취소·미완료·하루 제한·함수 없음 → 만료 → live 모드는 시험 결과 불인정 → 휴대폰(iPhone 13 WebKit) 리디렉션·주소 정리·꾸민 주소 → 파일로 열기 → 관리자 도구.
import { chromium, webkit, devices } from "playwright";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { A, B, SB_URL, fakeWorld, loadEdge } from "./_idv-fake.mjs";
const [, , url, out] = process.argv;
const site = url.replace(/[^/]*$/, "");
const fileUrl = pathToFileURL(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "index.html")).href;
const { handle } = await loadEdge();
const IDV_TEST = { idv: { mode: "test", storeId: "store-fake", channelKey: "channel-key-fake" } };
const IDV_LIVE = { idv: { mode: "live", storeId: "store-fake", channelKey: "channel-key-fake" } };
const USERS = { tokA: { id: A, email: "a@example.test" }, tokB: { id: B, email: "b@example.test" } };
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type, prefer, x-client-info", "access-control-allow-methods": "*" };
const FAKE_SDK = `window.PortOne = { requestIdentityVerification: function (o) {
  window.__idvReq = o; var m = localStorage.getItem("__idvMode") || "ok", id = o.identityVerificationId;
  if (m === "redirect") { location.href = o.redirectUrl + "?identityVerificationId=" + id + "&identityVerificationTxId=tx&transactionType=IDENTITY_VERIFICATION"; return new Promise(function () {}); }
  if (m === "cancel") return Promise.resolve({ transactionType: "IDENTITY_VERIFICATION", identityVerificationId: id, code: "FAILURE_TYPE_PG", message: "사용자가 본인인증을 취소했어요" });
  return Promise.resolve({ transactionType: "IDENTITY_VERIFICATION", identityVerificationId: id, identityVerificationTxId: "tx" });
} };`;
const res = {}, fail = [], errs = [], browsers = [];
const expect = (ok, msg, got) => { if (!ok) fail.push(msg + (got !== undefined ? ": " + JSON.stringify(got) : "")); };

async function open({ engine = chromium, dev = "Desktop Chrome", cfg = null, tok = null, page = "index.html", world = fakeWorld(), direct = null, sdkOk = true, noFunction = false } = {}) {
  const b = await engine.launch(); browsers.push(b);
  const ctx = await b.newContext({ ...devices[dev] });
  const stat = { sdk: 0, fn: 0 };
  await ctx.route(SB_URL + "/**", async (route) => {
    const r = route.request(), u = new URL(r.url());
    if (r.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    if (u.pathname === "/functions/v1/verify-adult") {
      stat.fn++;
      if (noFunction) return route.fulfill({ status: 404, contentType: "application/json", headers: CORS, body: JSON.stringify({ code: "NOT_FOUND", message: "Requested function was not found" }) });
      const h = r.headers(), rq = new Request(r.url(), { method: r.method(), headers: { authorization: h.authorization || "", apikey: h.apikey || "", "content-type": "application/json" }, body: r.postData() || undefined });
      const a = await handle(rq, world.env, world.fetch);
      return route.fulfill({ status: a.status, contentType: "application/json", headers: CORS, body: await a.text() });
    }
    if (u.pathname === "/rest/v1/adult_checks") {
      const h = r.headers(), a = await world.fetch(r.url(), { method: r.method(), headers: { authorization: h.authorization || "", apikey: h.apikey || "" }, body: r.postData() || undefined });
      return route.fulfill({ status: a.status, contentType: "application/json", headers: CORS, body: await a.text() });
    }
    return route.fulfill({ status: 200, contentType: "application/json", headers: CORS, body: "[]" });
  });
  await ctx.route("https://cdn.portone.io/**", (route) => { stat.sdk++; return sdkOk ? route.fulfill({ status: 200, contentType: "application/javascript", headers: CORS, body: FAKE_SDK }) : route.abort(); });
  const seed = tok ? { access_token: tok, refresh_token: "r" + tok, expires_at: Date.now() + 86400000, user: { id: USERS[tok].id, email: USERS[tok].email, provider: "email", providers: ["email"] } } : null;
  await ctx.addInitScript(([c, s]) => { if (c) window.HEARTVERSE_CONFIG = c; try { if (s && !localStorage.getItem("__seeded")) { localStorage.setItem("__seeded", "1"); localStorage.setItem("hv1_auth", JSON.stringify(s)); } localStorage.setItem("hv1_guest", "1"); } catch (e) {} }, [cfg, seed]);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(dev + " pageerror: " + e.message));
  await p.goto(direct || site + page, { waitUntil: "load" }); await p.waitForTimeout(700);
  await p.evaluate(() => { closeOverlays(); setAudience("all"); });
  return { p, ctx, world, stat };
}
const me = async (p) => { await p.evaluate(() => { location.hash = "me"; if (!document.getElementById("setSave")) viewMe(); }); await p.waitForSelector("#setSave"); await p.waitForTimeout(250); };
const toastHas = (p, t) => p.waitForFunction((x) => $$(".toast").some((e) => e.textContent.includes(x)), t, { timeout: 5000 }).then(() => true).catch(() => false);
const look = (p) => p.evaluate(() => ({ on: idvOn(), ok: ageOK(), chk: !!$("#ageChk"), box: !!$("#idvBox"), go: !!$("#idvGo"), done: !!$("#idvBox .pill.ok"), test: !!$("#idvBox .pill.gold"), text: ($("#idvBox") || {}).textContent || "", unfilterOff: $("#unfilterChk") ? $("#unfilterChk").disabled : null, fallbackOff: $("#fallbackChk") ? $("#fallbackChk").disabled : null, idv: S.idv }));
// 페이지를 떠나기 전에 계정 저장을 끝냄 — WebKit은 떠나며 끊긴 요청을 "access control checks" 오류로 알림(앱은 다음에 다시 보냄)
const settle = (p) => p.evaluate(() => CLOUD.flush().catch(() => {}));
const passedRow = (over = {}) => ({ id: "hs" + "1".repeat(32), user_id: A, checked_at: new Date().toISOString(), adult: true, test: true, expires_at: new Date(Date.now() + 200 * 86400000).toISOString(), ...over });

try {
  // 1. 꺼져 있으면(기본) 예전 그대로 — 자기 확인, 서버·SDK 요청 없음
  { const { p, world, stat } = await open({ tok: "tokA" });
    await me(p); let s = await look(p);
    expect(!s.on && s.chk && !s.box && !s.ok && s.unfilterOff === true, "꺼짐: 자기 확인 칸", s);
    await p.check("#ageChk"); await p.click("#setSave"); await p.waitForTimeout(250); s = await look(p);
    expect(s.ok && s.unfilterOff === false, "꺼짐: 체크하면 성인 확인", s);
    expect(stat.sdk === 0 && stat.fn === 0 && !world.calls.length, "꺼짐: 요청이 나감", { stat, calls: world.calls });
    res.off = "ok"; }

  // 2. 켰는데 로그인 전: 예전 체크를 인정하지 않고 로그인 안내
  { const { p, stat } = await open({ cfg: IDV_TEST });
    await p.evaluate(() => { S.settings.isAgeVerified = true; }); await me(p); const s = await look(p);
    expect(s.on && !s.ok && !s.chk && s.box && !s.go && s.unfilterOff === true && /로그인/.test(s.text) && s.test, "둘러보기: 로그인 안내", s);
    expect(!!(await p.$('#idvBox [data-go="login"]')), "둘러보기: 로그인 버튼");
    expect(stat.sdk === 0 && stat.fn === 0, "둘러보기: 요청이 나감", stat);
    res.guest = "ok"; }

  // 3. PC 인증: SDK는 누를 때만, 통과하면 수위 옵션이 열림, 표에는 개인정보 없음
  { const { p, ctx, world, stat } = await open({ cfg: IDV_TEST, tok: "tokA" });
    await p.evaluate(() => { S.settings.isAgeVerified = true; }); await me(p); let s = await look(p);
    expect(!s.ok && s.go && !s.chk && s.unfilterOff === true && stat.sdk === 0 && stat.fn === 0, "시작 전", { s, stat });
    if (out) await p.locator(".setcard:has(#idvBox)").screenshot({ path: `${out}/idv_before.png` });
    await p.click("#idvGo"); expect(await toastHas(p, "성인 인증을 마쳤어요"), "통과 안내");
    s = await look(p);
    expect(s.ok && s.done && s.test && !s.go && s.unfilterOff === false && s.fallbackOff === false, "통과 뒤 칸", s);
    const rq = await p.evaluate(() => { const o = Object.assign({}, window.__idvReq); o.site = SB.site(); return o; });
    expect(rq.storeId === "store-fake" && rq.channelKey === "channel-key-fake" && /^[A-Za-z0-9]{1,40}$/.test(rq.identityVerificationId) && rq.redirectUrl === rq.site, "SDK 요청", rq);
    expect(stat.sdk === 1 && stat.fn === 2, "요청 수", stat);
    expect(world.rows.length === 1 && world.rows[0].user_id === A && world.rows[0].adult === true && !/홍길동|0101234|1990-05-05|CI-VALUE/.test(JSON.stringify(world.rows)), "표", world.rows);
    if (out) await p.locator(".setcard:has(#idvBox)").screenshot({ path: `${out}/idv_done.png` });
    // 저장 버튼이 인증 결과를 건드리지 않고, 수위 설정은 저장됨
    await p.check("#unfilterChk"); await p.click("#setSave"); await p.waitForTimeout(250); s = await look(p);
    expect(s.ok && (await p.evaluate(() => S.settings.contentFilter)) === false, "수위 저장", s);
    // 다시 열어도 그대로(서버 값). 계정 표에 없는 값을 기기 캐시에 꾸며 넣어도 서버 값이 이김
    await p.reload({ waitUntil: "load" }); await p.waitForTimeout(600); await me(p); s = await look(p);
    expect(s.ok && s.done, "다시 열기", s);
    world.rows.length = 0;
    await p.evaluate((a) => localStorage.setItem("hv1_idv_" + a, JSON.stringify({ uid: a, adult: true, test: true, at: Date.now(), until: Date.now() + 1e10 })), A);
    await p.reload({ waitUntil: "load" }); await p.waitForTimeout(800); await me(p); s = await look(p);
    expect(!s.ok && s.go, "꾸민 캐시를 서버 값이 덮음", s);
    // 로그아웃하면 꺼지고, 다른 계정은 앞 계정의 결과를 못 씀
    world.add(passedRow()); await p.evaluate(() => IDV.refresh()); await p.waitForTimeout(250); s = await look(p);
    expect(s.ok, "다시 받기", s);
    await p.evaluate(() => SB.keep(null)); await p.waitForTimeout(150); s = await look(p);
    expect(!s.ok && !s.idv, "로그아웃", s);
    await p.evaluate(([b]) => SB.keep({ access_token: "tokB", refresh_token: "r", expires_at: Date.now() + 1e8, user: { id: b, email: "b@example.test" } }), [B]); await p.waitForTimeout(300); s = await look(p);
    expect(!s.ok && !s.done, "다른 계정", s);
    await ctx.close(); res.pc = "ok"; }

  // 4. 미성년: 성인 모드가 안 열리고, 예전 통과가 있어도 덮음
  { const world = fakeWorld(); world.add(passedRow({ checked_at: new Date(Date.now() - 86400000).toISOString() })); world.portone = { status: "VERIFIED", birthDate: new Date().getFullYear() - 10 + "-01-01", type: "TEST" };
    const { p } = await open({ cfg: IDV_TEST, tok: "tokA", world });
    await me(p); let s = await look(p); expect(s.ok, "미성년: 먼저 통과 상태", s);
    await p.evaluate(() => IDV.run()); await p.waitForTimeout(250); s = await look(p);
    expect(!s.ok && !s.done && s.unfilterOff === true && /만 19세가 되는 해/.test(s.text), "미성년 결과", s);
    res.minor = "ok"; }

  // 5. 실패들: 취소·미완료·SDK 못 받음·하루 제한·함수 없음 — 상태는 그대로, 버튼은 다시 눌림
  { const { p, world } = await open({ cfg: IDV_TEST, tok: "tokA" }); await me(p);
    await p.evaluate(() => localStorage.setItem("__idvMode", "cancel"));
    await p.click("#idvGo"); expect(await toastHas(p, "취소"), "취소 안내");
    let s = await look(p); expect(!s.ok && s.go && !(await p.$eval("#idvGo", (x) => x.disabled)), "취소 뒤", s);
    expect(world.rows.length === 1 && world.rows[0].checked_at === null, "취소: 판정 없음", world.rows);
    await p.evaluate(() => localStorage.removeItem("__idvMode")); world.portone = { status: "READY", type: "TEST" };
    await p.click("#idvGo"); expect(await toastHas(p, "인증이 끝나지 않았어요"), "미완료 안내"); s = await look(p); expect(!s.ok && s.go, "미완료 뒤", s);
    while (world.rows.length < 10) world.add({ id: "hs" + String(world.rows.length).padStart(32, "0"), user_id: A });
    await p.click("#idvGo"); expect(await toastHas(p, "하루 10번"), "하루 제한 안내");
    res.fails = "ok"; }
  { const { p } = await open({ cfg: IDV_TEST, tok: "tokA", sdkOk: false }); await me(p);
    await p.click("#idvGo"); expect(await toastHas(p, "인증창을 불러오지 못했어요"), "SDK 못 받음"); const s = await look(p); expect(!s.ok && s.go, "SDK 실패 뒤", s); }
  { const { p } = await open({ cfg: IDV_TEST, tok: "tokA", noFunction: true }); await me(p);
    await p.click("#idvGo"); expect(await toastHas(p, "인증 서버가 아직 준비되지"), "함수 없음"); }

  // 6. 만료·live 모드
  { const world = fakeWorld(); world.add(passedRow({ expires_at: new Date(Date.now() - 1000).toISOString() }));
    const { p } = await open({ cfg: IDV_TEST, tok: "tokA", world }); await me(p); const s = await look(p);
    expect(!s.ok && s.go && /기간\(1년\)이 지났어요/.test(s.text), "만료", s); res.expired = "ok"; }
  { const world = fakeWorld(); world.add(passedRow({ test: true })); world.portone = { status: "VERIFIED", birthDate: "1990-01-01", type: "LIVE" };
    const { p } = await open({ cfg: IDV_LIVE, tok: "tokA", world }); await me(p); let s = await look(p);
    expect(!s.ok && s.go && !s.test && /시험 모드에서 한 인증은 효력이 없어요/.test(s.text), "live: 시험 결과 불인정", s);
    await p.click("#idvGo"); expect(await toastHas(p, "성인 인증을 마쳤어요"), "live 통과 안내"); s = await look(p);
    expect(s.ok && s.done && !s.test && s.idv.test === false, "live 통과", s); res.live = "ok"; }

  // 7. 휴대폰: 인증창이 페이지째 떠났다가 돌아옴
  { const { p, world, stat } = await open({ engine: webkit, dev: "iPhone 13", cfg: IDV_TEST, tok: "tokA" }); await me(p);
    res.mobileOverflow = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); expect(res.mobileOverflow <= 0, "휴대폰 가로 넘침", res.mobileOverflow);
    if (out) await p.locator(".setcard:has(#idvBox)").screenshot({ path: `${out}/idv_iphone.png` });
    await p.evaluate(() => localStorage.setItem("__idvMode", "redirect")); await settle(p);
    await p.click("#idvGo"); await p.waitForFunction(() => typeof S !== "undefined" && S.idv && S.idv.adult, null, { timeout: 8000 }).catch(() => {}); await p.waitForTimeout(400);
    let s = await look(p); const here = await p.evaluate(() => location.search + location.hash);
    expect(s.ok && s.done && here === "#me", "돌아온 뒤", { s, here });
    expect(world.rows.length === 1 && world.rows[0].adult === true && stat.fn === 2, "돌아온 뒤 서버", { stat, rows: world.rows });
    // 꾸민 주소: 주소의 문구를 화면에 쓰지 않고, 남의·없는 번호는 통과시키지 않음
    await p.evaluate(() => { localStorage.removeItem("hv1_idv_" + S.idv.uid); }); world.rows.length = 0; await settle(p);
    await p.goto(site + "index.html?identityVerificationId=x&code=FAIL&message=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E%EA%B0%80%EC%A7%9C%EB%AC%B8%EA%B5%AC", { waitUntil: "load" });
    expect(await toastHas(p, "인증을 마치지 못했어요"), "꾸민 실패 주소: 고정 문구"); await p.waitForTimeout(150);
    expect(!(await p.evaluate(() => document.body.textContent.includes("가짜문구") || !!$("img[src='x']"))), "주소의 문구를 쓰지 않음");
    await settle(p); await p.goto(site + "index.html?identityVerificationId=hs" + "9".repeat(32), { waitUntil: "load" });
    expect(await toastHas(p, "이 계정에서 시작한 인증이 아니에요"), "꾸민 번호: 거부"); s = await look(p);
    expect(!s.ok && (await p.evaluate(() => location.search)) === "", "꾸민 번호 뒤", s);
    res.redirect = "ok"; }

  // 8. 파일로 열기: 인증창 대신 웹 주소 안내, 같은 계정의 서버 결과는 그대로 씀
  { const { p } = await open({ cfg: IDV_TEST, tok: "tokA", direct: fileUrl }); await me(p); let s = await look(p);
    expect(!s.go && /웹 주소/.test(s.text) && !s.ok, "파일: 안내", s);
    expect((await p.$eval("#idvBox a", (a) => a.href)).startsWith("https://20232497.github.io/HEARTSYNC/"), "파일: 웹 주소 링크"); }
  { const world = fakeWorld(); world.add(passedRow());
    const { p } = await open({ cfg: IDV_TEST, tok: "tokA", direct: fileUrl, world }); await me(p); const s = await look(p);
    expect(s.ok && s.done, "파일: 서버 결과", s); res.file = "ok"; }

  // 9. 관리자 도구도 같은 판정
  { const { p } = await open({ cfg: IDV_TEST, tok: "tokA", page: "admin.html" }); await me(p); let s = await look(p);
    expect(!s.ok && s.go && !s.chk, "관리자: 시작 전", s);
    await p.click("#idvGo"); expect(await toastHas(p, "성인 인증을 마쳤어요"), "관리자: 통과"); s = await look(p); expect(s.ok, "관리자: 통과 뒤", s);
    res.admin = "ok"; }
} catch (e) { errs.push("script: " + (e && e.stack || e).toString().slice(0, 500)); }
for (const b of browsers) await b.close().catch(() => {});
res.fail = fail; res.errs = errs;
console.log(JSON.stringify(res, null, 1));
