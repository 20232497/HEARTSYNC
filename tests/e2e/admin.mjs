// 관리자 도구(admin.html) 스모크 + 사용자 빌드(index.html)와 갈라졌는지: 관리자 도구는 사용자 사이트의 네 화면(홈·대화·스토어·MY)이 그대로 그려지고
// 관문 함수가 있으며(이 서버 127.0.0.1에서는 묻지 않음), 고객센터 관리 모듈이 붙어 있음. 사용자 빌드에는 관문·고객센터 관리 함수가 없어야 함.
// 고객센터 관리의 실제 동작(공지 쓰기·받은 문의 답변)은 help 시험이 Supabase를 흉내 내어 본다.
import { chromium, webkit, devices } from "playwright";
import { noSupabase } from "./_offline.mjs";
const [, , url, out] = process.argv; // url = admin.html 주소(run.mjs가 붙임). 사용자 빌드는 admin.html을 뗀 주소
const userUrl = url.replace(/admin\.html$/, "");
const VIEWS = ["home", "chats", "store", "me", "help"];
for (const [dev, engine, opts] of [["Desktop Chrome", chromium, {}], ["iPhone 13", webkit, devices["iPhone 13"]]]) {
  const b = await engine.launch(); const ctx = await b.newContext({ ...opts }); await noSupabase(ctx); const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push("pageerror: " + e.message)); p.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 160)); });
  const res = { dev, views: {} };
  const wait = (ms) => p.waitForTimeout(ms), tag = dev.replace(/\W+/g, "_");
  const open = async (u) => { await p.goto(u, { waitUntil: "load" }); await wait(1200); if (await p.$("#lguest")) { await p.click("#lguest"); await wait(400); } await p.evaluate(() => { closeOverlays(); setAudience("all"); }); };
  try {
    await open(url);
    res.navs = await p.evaluate(() => [...document.querySelectorAll("#rail [data-nav]")].map((b) => b.dataset.nav));
    if (res.navs.join() !== "home,chats,store,me") errs.push("관리자 메뉴가 다름: " + res.navs.join());
    for (const v of VIEWS) {
      await p.evaluate((v) => { location.hash = v; }, v); await wait(500);
      res.views[v] = await p.evaluate(() => $("#view").innerHTML.length);
      if (res.views[v] < 200) errs.push(`${v} 화면이 비어 있음`);
    }
    await p.evaluate(() => { location.hash = "c-hwanghu"; }); await wait(500);
    res.detail = await p.evaluate(() => ({ start: !!$("#start"), cast: $$("[data-cast]").length }));
    if (!res.detail.start || !res.detail.cast) errs.push("상세: " + JSON.stringify(res.detail));
    if (out) await p.screenshot({ path: `${out}/${tag}_admin_detail.png` });
    // 비밀번호 관문: 로컬 주소에서는 세우지 않음(웹 주소에서만) — 함수가 있고, 이 서버(127.0.0.1)에서는 gateNeeded가 거짓이라 MY에 잠그기 버튼도 없음
    await p.evaluate(() => { location.hash = "me"; }); await wait(500);
    res.gate = await p.evaluate(() => ({ fn: typeof gate, needed: gateNeeded(), gated: document.body.classList.contains("gated"), lock: !!$("#adminLock"), notice: typeof noticeSheet }));
    if (res.gate.fn !== "function" || res.gate.needed || res.gate.gated || res.gate.lock || res.gate.notice !== "function") errs.push("관문·고객센터 관리: " + JSON.stringify(res.gate));

    // 사용자 빌드: 관리자 함수가 없음
    await open(userUrl);
    const u = { navs: await p.evaluate(() => [...document.querySelectorAll("#rail [data-nav]")].map((b) => b.dataset.nav)) };
    u.fns = await p.evaluate(() => ({ gate: typeof gate, gateNeeded: typeof gateNeeded, lockAdmin: typeof lockAdmin, noticeSheet: typeof noticeSheet, loadInbox: typeof loadInbox }));
    await p.evaluate(() => { location.hash = "me"; }); await wait(500);
    u.me = await p.evaluate(() => ({ key: !!$("#key"), save: !!$("#setSave"), ext: ($("#meExt")?.innerHTML || "").length }));
    res.user = u;
    if (u.navs.join() !== "home,chats,store,me") errs.push("사용자 메뉴가 다름: " + u.navs.join());
    if (Object.values(u.fns).some((t) => t !== "undefined")) errs.push("사용자 빌드에 관리자 함수가 있음: " + JSON.stringify(u.fns));
    if (!u.me.key || !u.me.save || u.me.ext) errs.push("사용자 MY: " + JSON.stringify(u.me));
  } catch (e) { res.fail = String(e).slice(0, 400); }
  res.errs = [...new Set(errs)];
  console.log(JSON.stringify(res));
  await b.close();
}
