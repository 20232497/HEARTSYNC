// 관리자 비밀번호 관문(src/js/admin/gate.js): 웹 주소에서만 서는지를 가짜 https 호스트(heartsync.test — page.route로 저장소 파일을 그대로 줌, 실제 네트워크 없음)로 확인.
// 관문이 보이고 레일이 숨고, 틀린 비밀번호는 거부, 기억(localStorage hv1_admin = HASH)이 있으면 바로 부팅, 사용자 사이트(index.html)에는 관문이 없음.
// 맞는 비밀번호 입력은 환경변수 HS_ADMIN_PW가 있을 때만(저장소에 비밀번호를 적지 않으려고): HS_ADMIN_PW=… npm run e2e gate
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
await noSupabase(ctx);
await ctx.route("https://api.anthropic.com/**", (route) => route.abort());
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
    if (res.right.gated || res.right.navs !== 5 || !res.right.remembered) errs.push("맞는 비밀번호: " + JSON.stringify(res.right));
  } else {
    await p.evaluate(() => localStorage.setItem("hv1_admin", HASH));
    res.right = "HS_ADMIN_PW 없음 — 기억만 심어 확인";
  }
  // 기억이 있으면 다시 열어도 바로 부팅
  await p.goto(HOST + "/admin.html", { waitUntil: "load" }); await wait(1200);
  if (await p.$("#lguest")) { await p.click("#lguest"); await wait(400); }
  res.again = await p.evaluate(() => ({ gated: document.body.classList.contains("gated"), navs: $$("#rail .nav").length }));
  if (res.again.gated || res.again.navs !== 5) errs.push("기억 뒤 부팅: " + JSON.stringify(res.again));
  // 웹 주소의 관리자 도구 MY에는 잠그기 버튼이 있고, 누르면 기억이 지워져 다시 관문이 섬
  await p.evaluate(() => { location.hash = "me"; }); await p.waitForTimeout(500);
  res.lock = await p.evaluate(() => !!$("#adminLock"));
  if (!res.lock) errs.push("MY에 관리자 잠그기 버튼이 없음");
  else { await p.click("#adminLock"); await wait(1200); res.locked = await p.evaluate(() => ({ gated: document.body.classList.contains("gated"), remembered: !!localStorage.getItem("hv1_admin") })); if (!res.locked.gated || res.locked.remembered) errs.push("잠그기 뒤: " + JSON.stringify(res.locked)); }
  // 사용자 사이트에는 관문이 없음
  await p.goto(HOST + "/", { waitUntil: "load" }); await wait(1200);
  res.user = await p.evaluate(() => ({ gate: typeof gate, gated: document.body.classList.contains("gated"), view: $("#view").innerHTML.length }));
  if (res.user.gate !== "undefined" || res.user.gated || res.user.view < 200) errs.push("사용자 사이트: " + JSON.stringify(res.user));
} catch (e) { res.fail = String(e).slice(0, 400); }
res.errs = [...new Set(errs)];
console.log(JSON.stringify(res));
await b.close();
