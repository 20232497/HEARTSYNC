// 사용자 사이트(index.html)의 모든 화면·작품·시트가 오류 없이 그려지는지(스모크): 홈·대화·스토어·MY 네 화면, 오리지널 작품 전부의 상세 페이지,
// 각 작품의 첫 시작 상황으로 연 대화방(오프닝 본문·상태창·입력창), 대화방 드로어·모델 시트·페르소나·관심있는 대화·PLUS·확인 시트.
// 관리자 도구의 화면·시트(만들기·이미지 슬롯·세계관 일러스트·추천 칸)는 admin.mjs. pageerror와 console error를 모아 errs에 담는다 — 모듈 분리 뒤 어떤 화면에서든 ReferenceError가 나면 여기서 잡힘.
import { chromium, webkit, devices } from "playwright";
import { noSupabase } from "./_offline.mjs";
const [, , url, out] = process.argv;
for (const [dev, engine, opts] of [["Desktop Chrome", chromium, {}], ["iPhone 13", webkit, devices["iPhone 13"]]]) {
  const b = await engine.launch(); const ctx = await b.newContext({ ...opts }); await noSupabase(ctx); const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push("pageerror: " + e.message)); p.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 160)); });
  const res = { dev, views: {}, works: 0, rooms: 0, sheets: {} };
  const wait = (ms) => p.waitForTimeout(ms);
  const tag = dev.replace(/\W+/g, "_");
  try {
    await p.goto(url, { waitUntil: "load" }); await wait(1200);
    if (await p.$("#lguest")) { await p.click("#lguest"); await wait(400); }
    await p.evaluate(() => { closeOverlays(); setAudience("all"); });
    // 다섯 화면
    for (const v of ["home", "chats", "store", "me"]) {
      await p.evaluate((v) => { location.hash = v; }, v); await wait(500);
      res.views[v] = await p.evaluate(() => $("#view").innerHTML.length);
      if (res.views[v] < 200) errs.push(`${v} 화면이 비어 있음`);
    }
    // 작품마다 상세 → 첫 시작 상황으로 방 열기 → 로그·상태창·입력창
    const ids = await p.evaluate(() => ORIGINALS.map((c) => c.id));
    for (const id of ids) {
      await p.evaluate((id) => { location.hash = "c-" + id; }, id); await wait(350);
      const ok = await p.evaluate((id) => $("#view").textContent.includes(getChar(id).title), id);
      if (!ok) { errs.push(`상세 ${id}가 안 그려짐`); continue; }
      res.works++;
      await p.evaluate((id) => { const r = newRoom(normalizeChar(getChar(id)), 0, S.personas[0]); location.hash = "r-" + r.id; }, id); await wait(700);
      const chk = await p.evaluate(() => ({ log: ($("#log")?.innerText || "").length, status: !!$(".status"), composer: !!$("textarea, #input, #composer textarea"), figs: document.querySelectorAll("#log figure, #log .scene-img").length }));
      if (chk.log < 50) errs.push(`대화방 ${id}: 오프닝 본문이 비어 있음`); else res.rooms++;
      if (!chk.status) errs.push(`대화방 ${id}: 상태창이 없음`);
      if (!chk.composer) errs.push(`대화방 ${id}: 입력창이 없음`);
    }
    if (out) await p.screenshot({ path: `${out}/${tag}_views_room.png` });
    // 시트·드로어: 대화방 안에서 열고 닫기
    const sheets = {
      drawer: () => openRoomDrawer("main"),
      drawerOutput: () => openRoomDrawer("output"),
      model: () => openModelSheet(),
      persona: () => personaSheet(S.personas[0]),
      audience: () => audSheet(false),
      plus: () => plusSheet("rooms"),
      confirm: () => confirmSheet("정말 지울까요?", "이 대화방의 메시지가 모두 사라져요.", "지우기", () => {})
    };
    for (const name of Object.keys(sheets)) {
      const r = await p.evaluate(async (src) => {
        try { (0, eval)(`(${src})`)(); await new Promise((z) => setTimeout(z, 250)); const o = document.querySelector(".overlay, .drawer"); const n = o ? o.textContent.replace(/\s+/g, " ").trim().length : 0; closeOverlays(); return n; }
        catch (e) { return "error: " + e.message; }
      }, sheets[name].toString());
      res.sheets[name] = r;
      if (typeof r !== "number" || r < 10) errs.push(`시트 ${name}: ${r}`);
    }
    if (out) { await p.evaluate(() => openRoomDrawer("main")); await wait(300); await p.screenshot({ path: `${out}/${tag}_views_drawer.png` }); await p.evaluate(() => closeOverlays()); }
  } catch (e) { res.fail = String(e).slice(0, 400); }
  res.errs = [...new Set(errs)];
  console.log(JSON.stringify(res));
  await b.close();
}
