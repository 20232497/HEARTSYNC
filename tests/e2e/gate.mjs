// 관리자 비밀번호 관문(src/js/admin/gate.js): 웹 주소에서만 서는지를 가짜 https 호스트(heartsync.test — page.route로 저장소 파일을 그대로 줌, 실제 네트워크 없음)로 확인.
// 관문이 보이고 레일이 숨고, 틀린 비밀번호는 거부, 기억(localStorage hv1_admin = HASH)이 있으면 바로 부팅, 사용자 사이트(index.html)에는 관문이 없음.
// 맞는 비밀번호 입력은 환경변수 HS_ADMIN_PW가 있을 때만(저장소에 비밀번호를 적지 않으려고): HS_ADMIN_PW=… npm run e2e gate
// 그림 생성 관문(images/gen-guard.js)도 여기서 본다 — 다른 흐름 시험은 127.0.0.1이라 관문을 건너뜀. 관리자가 아니면 번역·Runware 요청이 나가지 않고, 관리자면 그려지는지(Runware·Supabase·AI는 모두 가짜)
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { noSupabase } from "./_offline.mjs";
import { ROOT } from "../serve.mjs";
const HOST = "https://heartsync.test";
const b = await chromium.launch(); const ctx = await b.newContext({ ignoreHTTPSErrors: true }); const p = await ctx.newPage();
const errs = []; p.on("pageerror", (e) => errs.push("pageerror: " + e.message));
await ctx.route(HOST + "/**", (route) => {
  let rel = decodeURIComponent(new URL(route.request().url()).pathname); if (rel.endsWith("/")) rel += "index.html";
  const file = path.join(ROOT, rel);
  if (fs.existsSync(file) && fs.statSync(file).isFile()) route.fulfill({ path: file }); else route.fulfill({ status: 404, body: "no " + rel });
});
// 가짜 서버들. 나중에 등록한 route가 먼저 잡으므로 Supabase 전체 → admins 표 순서
const calls = { runware: [], llm: 0, admins: 0 }; let adminRows = [];
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
await noSupabase(ctx);
await ctx.route("**/rest/v1/admins*", (route) => { calls.admins++; route.fulfill({ json: adminRows }); });
await ctx.route("https://api.runware.ai/**", (route) => { const t = route.request().postDataJSON()[0]; calls.runware.push(t.taskType); route.fulfill({ json: { data: [{ taskType: t.taskType, taskUUID: t.taskUUID, status: "processing", imageDataURI: PNG }] } }); });
for (const h of ["https://api.anthropic.com/**", "https://openrouter.ai/**"]) await ctx.route(h, (route) => { calls.llm++; route.abort(); });
const res = {};
const wait = (ms) => p.waitForTimeout(ms);
try {
  await p.goto(HOST + "/admin.html", { waitUntil: "load" }); await wait(800);
  res.gated = await p.evaluate(() => ({ needed: gateNeeded(), gated: document.body.classList.contains("gated"), pw: !!$("#gatePw"), railHidden: getComputedStyle($("#rail")).display === "none", booted: !!$("#rail .nav") }));
  if (!res.gated.needed || !res.gated.gated || !res.gated.pw || !res.gated.railHidden || res.gated.booted) errs.push("관문이 안 섬: " + JSON.stringify(res.gated));
  await p.fill("#gatePw", "wrong-password"); await p.press("#gatePw", "Enter"); await wait(400);
  res.wrong = await p.evaluate(() => ({ msg: $("#gateMsg").textContent, gated: document.body.classList.contains("gated"), remembered: !!localStorage.getItem("hv1_admin") }));
  if (!res.wrong.msg || !res.wrong.gated || res.wrong.remembered) errs.push("틀린 비밀번호: " + JSON.stringify(res.wrong));
  if (process.env.HS_ADMIN_PW) {
    await p.fill("#gatePw", process.env.HS_ADMIN_PW); await p.press("#gatePw", "Enter"); await wait(1500);
    if (await p.$("#lguest")) { await p.click("#lguest"); await wait(400); }
    res.right = await p.evaluate(() => ({ gated: document.body.classList.contains("gated"), navs: $$("#rail .nav").length, remembered: localStorage.getItem("hv1_admin") === HASH }));
    if (res.right.gated || res.right.navs !== 8 || !res.right.remembered) errs.push("맞는 비밀번호: " + JSON.stringify(res.right));
  } else {
    await p.evaluate(() => localStorage.setItem("hv1_admin", HASH));
    res.right = "HS_ADMIN_PW 없음 — 기억만 심어 확인";
  }
  // 기억이 있으면 다시 열어도 바로 부팅
  await p.goto(HOST + "/admin.html", { waitUntil: "load" }); await wait(1200);
  if (await p.$("#lguest")) { await p.click("#lguest"); await wait(400); }
  res.again = await p.evaluate(() => ({ gated: document.body.classList.contains("gated"), navs: $$("#rail .nav").length }));
  if (res.again.gated || res.again.navs !== 8) errs.push("기억 뒤 부팅: " + JSON.stringify(res.again));
  // 그림 생성 관문 — 키는 있고 번역도 할 수 있는 상태에서, 번역(partsTags·groupsPrompt)과 Runware까지 몇 번 닿는지 센다
  await p.evaluate(() => {
    closeOverlays();
    S.settings.runwareKey = "rw-test-fake"; S.settings.apiKey = "sk-ant-test-fake"; S.engine = "byok"; S.settings.autoImg = true;
    window.__n = { partsTags: 0, groupsPrompt: 0 }; window.__toasts = [];
    for (const name of Object.keys(__n)) { const f = window[name]; window[name] = (...a) => { __n[name]++; return f(...a); }; }
    const t = window.toast; window.toast = (m) => { __toasts.push(String(m)); return t(m); };
  });
  const probe = () => p.evaluate(async () => {
    const c = normalizeChar(getChar("seodoyun")), cast = c.cast[0], tail = () => __toasts[__toasts.length - 1] || "";
    __n.partsTags = __n.groupsPrompt = 0; __toasts.length = 0; ISTATE.results.length = 0;
    // 연속 그리기: 첫 칸에서 멈춰야 함
    await runKeys(c, cast, ["1", "2", "3"], false, () => {});
    const run = { parts: __n.partsTags, results: ISTATE.results.length, busy: !!ISTATE.busy, toast: tail() };
    // 생성 창: 번역 전에 막혀야 함
    __n.groupsPrompt = 0;
    const ov = genImageSheet({ prompt: "비 오는 골목", onUse: async () => {} });
    $("#gmk", ov).click(); await new Promise((z) => setTimeout(z, 300));
    const sheet = { groups: __n.groupsPrompt, msg: $("#gpv", ov).textContent }; ov.remove();
    return { access: await genAccess(), run, sheet };
  });
  // ① 로그인 안 함
  res.genOut = await probe();
  res.genOut.auto = await p.evaluate(async () => {
    const c = normalizeChar(getChar("seodoyun")), body = `[[img:${c.cast[0].code}:1]]`;
    __n.partsTags = 0; __toasts.length = 0;
    await autoImages({ char: c }, body); await autoImages({ char: c }, body); // 두 턴
    return { parts: __n.partsTags, told: __toasts.filter((t) => t.includes("장면 그림")).length };
  });
  res.genOut.video = await p.evaluate(() => rwTask({ taskType: "videoInference", taskUUID: "gate-video" }).then(() => "지나감", (e) => e.code));
  // 자동 움짤도 관리자가 아니면 만들기 전에 멈춤(아래 '요청이 나감' 검사가 Runware까지 안 갔는지 봄)
  res.genOut.autoMo = await p.evaluate(async (PNG) => {
    const c = normalizeChar(getChar("seodoyun")), code = c.cast[0].code, body = `[[img:${code}:101]]`;
    S.settings.autoMotion = true; putCastImage(c, code, "101", PNG);
    await autoMotions({ char: c }, body);
    const out = { jobs: Object.keys(MJOBS).length, made: !!motionOf(c, code, "101") };
    putCastImage(c, code, "101", null); S.settings.autoMotion = false;
    return out;
  }, PNG);
  const g = res.genOut;
  if (g.autoMo.jobs || g.autoMo.made) errs.push("비로그인 자동 움짤: " + JSON.stringify(g.autoMo));
  if (g.access.code !== "admin_login") errs.push("비로그인 권한: " + JSON.stringify(g.access));
  if (g.run.parts || g.run.results || g.run.busy || !g.run.toast.includes("관리자 계정")) errs.push("비로그인 연속 그리기: " + JSON.stringify(g.run));
  if (g.sheet.groups || !g.sheet.msg.includes("관리자 계정")) errs.push("비로그인 생성 창: " + JSON.stringify(g.sheet));
  if (g.auto.parts || g.auto.told !== 1) errs.push("비로그인 자동 생성: " + JSON.stringify(g.auto));
  if (g.video !== "admin_login") errs.push("비로그인 움짤 생성: " + g.video);
  if (calls.runware.length || calls.llm) errs.push("비로그인인데 요청이 나감: " + JSON.stringify(calls));
  // ② 움짤 결과 묻기는 로그인이 풀려도 막지 않음(이미 청구된 작업)
  res.genPoll = await p.evaluate(() => rwTask({ taskType: "getResponse", taskUUID: "gate-poll" }).then(() => "받음", (e) => e.code));
  if (res.genPoll !== "받음" || calls.runware.join() !== "getResponse") errs.push("움짤 결과 묻기: " + res.genPoll + " " + calls.runware.join());
  // ③ 로그인했지만 admins 표에 없음
  await p.evaluate(() => { SB.s = { access_token: "t", refresh_token: "r", expires_at: Date.now() + 3600000, user: { id: "u1", email: "a@heartsync.test" } }; });
  res.genMember = await probe();
  if (res.genMember.access.code !== "admin_only" || res.genMember.run.parts || res.genMember.run.results || !calls.admins) errs.push("비관리자: " + JSON.stringify(res.genMember));
  if (calls.runware.join() !== "getResponse" || calls.llm) errs.push("비관리자인데 요청이 나감: " + JSON.stringify(calls));
  // ④ admins에 넣으면 새로 고침 없이 그려짐
  adminRows = [{ user_id: "u1" }];
  res.genAdmin = await p.evaluate(async () => {
    const c = normalizeChar(getChar("seodoyun")), cast = c.cast[0];
    __n.partsTags = 0; ISTATE.results.length = 0;
    const access = await genAccess();
    await runKeys(c, cast, ["1"], false, () => {});
    return { access, parts: __n.partsTags, results: ISTATE.results.length };
  });
  if (!res.genAdmin.access.ok || !res.genAdmin.parts || res.genAdmin.results !== 1 || !calls.runware.includes("imageInference")) errs.push("관리자: " + JSON.stringify(res.genAdmin) + " " + calls.runware.join());
  // 사용자 사이트에는 관문이 없음
  await p.goto(HOST + "/", { waitUntil: "load" }); await wait(1200);
  res.user = await p.evaluate(() => ({ gate: typeof gate, gated: document.body.classList.contains("gated"), view: $("#view").innerHTML.length }));
  if (res.user.gate !== "undefined" || res.user.gated || res.user.view < 200) errs.push("사용자 사이트: " + JSON.stringify(res.user));
} catch (e) { res.fail = String(e).slice(0, 400); }
res.errs = [...new Set(errs)];
console.log(JSON.stringify(res));
await b.close();
