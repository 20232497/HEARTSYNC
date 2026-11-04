// 관리자 도구(admin.html) 스모크 + 사용자 빌드(index.html)와 갈라졌는지: 여섯 화면(홈·대화·작품·만들기·스토어·MY), 상세의 관리 버튼(일러스트 관리·이미지 슬롯 관리·
// 작품 폴더에 저장), 드로어의 이미지 슬롯, MY의 이미지 생성 설정(#rkey·#gstyle·기본 화풍 카드)·크리에이터 프로필, 페르소나 시트의 'AI로 만들기', 시트 4종(이미지 슬롯·
// 세계관 일러스트·추천 칸·생성 창), 스튜디오의 관심있는 대화 칸. 그리고 사용자 빌드에는 그 자리들이 비어 있고 관리자 함수(viewStudio·openImageSlots)가 없어야 함.
import { chromium, webkit, devices } from "playwright";
const [, , url, out] = process.argv; // url = admin.html 주소(run.mjs가 붙임). 사용자 빌드는 admin.html을 뗀 주소
const userUrl = url.replace(/admin\.html$/, "");
for (const [dev, engine, opts] of [["Desktop Chrome", chromium, {}], ["iPhone 13", webkit, devices["iPhone 13"]]]) {
  const b = await engine.launch(); const ctx = await b.newContext({ ...opts }); const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push("pageerror: " + e.message)); p.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 160)); });
  const res = { dev, views: {}, sheets: {} };
  const wait = (ms) => p.waitForTimeout(ms), tag = dev.replace(/\W+/g, "_");
  const open = async (u) => { await p.goto(u, { waitUntil: "load" }); await wait(1200); if (await p.$("#lguest")) { await p.click("#lguest"); await wait(400); } await p.evaluate(() => { closeOverlays(); setAudience("all"); }); };
  const sheetLen = async (src) => p.evaluate(async (s) => { try { (0, eval)(`(${s})`)(); await new Promise((z) => setTimeout(z, 250)); const o = document.querySelector(".overlay, .drawer"); const n = o ? o.textContent.replace(/\s+/g, " ").trim().length : 0; closeOverlays(); return n; } catch (e) { return "error: " + e.message; } }, src);
  try {
    await open(url);
    res.navs = await p.evaluate(() => [...document.querySelectorAll("#rail [data-nav]")].map((b) => b.dataset.nav));
    if (res.navs.join() !== "home,chats,works,studio,store,me") errs.push("관리자 메뉴가 다름: " + res.navs.join());
    for (const v of ["home", "chats", "works", "studio", "store", "me"]) {
      await p.evaluate((v) => { location.hash = v; }, v); await wait(500);
      res.views[v] = await p.evaluate(() => $("#view").innerHTML.length);
      if (res.views[v] < 200) errs.push(`${v} 화면이 비어 있음`);
    }
    await p.evaluate(() => { location.hash = "works"; }); await wait(500);
    res.works = await p.evaluate(() => ({ rows: $(".wrow").length, saveAll: !!$("#saveAll"), codes: !!$("#saveCodes") }));
    if (res.works.rows < 12 || !res.works.saveAll) errs.push("작품 화면: " + JSON.stringify(res.works));
    await p.evaluate(() => { location.hash = "studio"; }); await wait(500);
    res.studioAud = await p.evaluate(() => { const s = $("#f-aud"); return s ? [...s.options].map((o) => o.textContent) : null; });
    if (!res.studioAud) errs.push("스튜디오에 관심있는 대화 칸(#f-aud)이 없음");
    await p.evaluate(() => { location.hash = "c-hwanghu"; }); await wait(500);
    res.detail = await p.evaluate(() => ({ wArt: !!$("#wArt"), imgSlots: !!$("#imgSlots"), wExport: !!$("#wExport"), wArtBox: $("#wArtBox")?.style.display !== "none" }));
    if (!res.detail.wArt || !res.detail.imgSlots || !res.detail.wExport || !res.detail.wArtBox) errs.push("상세 관리 버튼: " + JSON.stringify(res.detail));
    if (out) await p.screenshot({ path: `${out}/${tag}_admin_detail.png` });
    await p.evaluate(() => { const r = newRoom(normalizeChar(getChar("hwanghu")), 0, S.personas[0]); location.hash = "r-" + r.id; }); await wait(700);
    res.drawer = await p.evaluate(async () => { openRoomDrawer("main"); await new Promise((z) => setTimeout(z, 250)); const ok = !!$("#mImg"); closeOverlays(); return ok; });
    if (!res.drawer) errs.push("드로어에 이미지 슬롯이 없음");
    const sheets = {
      slots: () => { const c = normalizeChar(getChar("hwanghu")); openImageSlots(c, c.cast[0].code); },
      worldArt: () => openWorldArt(normalizeChar(getChar("hwanghu"))),
      sitPresets: () => sitPresetSheet(() => {}),
      gen: () => genImageSheet({ title: "시험", prompt: "1girl, smile", ctx: { kind: "daily", aud: "m" } }),
      persona: () => personaSheet(S.personas[0])
    };
    for (const name of Object.keys(sheets)) { const r = await sheetLen(sheets[name].toString()); res.sheets[name] = r; if (typeof r !== "number" || r < 10) errs.push(`시트 ${name}: ${r}`); }
    res.personaAi = await p.evaluate(async () => { personaSheet(S.personas[0]); await new Promise((z) => setTimeout(z, 200)); const ok = !!$("#avAi"); closeOverlays(); return ok; });
    if (!res.personaAi) errs.push("페르소나 시트에 'AI로 만들기'가 없음");
    await p.evaluate(() => { location.hash = "me"; }); await wait(500);
    res.me = await p.evaluate(() => ({ rkey: !!$("#rkey"), gstyle: !!$("#gstyle"), bsets: $$("#bsets .bset").length, nick: !!$("#nick"), save: !!$("#setSave") }));
    if (!res.me.rkey || !res.me.gstyle || !res.me.bsets || !res.me.nick || !res.me.save) errs.push("MY 이미지 설정: " + JSON.stringify(res.me));
    if (out) await p.screenshot({ path: `${out}/${tag}_admin_me.png`, fullPage: false });

    // 사용자 빌드: 관리 자리가 비어 있고 관리자 함수가 없음
    await open(userUrl);
    const u = { navs: await p.evaluate(() => [...document.querySelectorAll("#rail [data-nav]")].map((b) => b.dataset.nav)) };
    u.fns = await p.evaluate(() => ({ studio: typeof viewStudio, slots: typeof openImageSlots, gen: typeof genImageSheet, works: typeof viewWorks, runware: typeof runwareImage }));
    await p.evaluate(() => { location.hash = "c-hwanghu"; }); await wait(500);
    u.detail = await p.evaluate(() => ({ wArt: !!$("#wArt"), imgSlots: !!$("#imgSlots"), start: !!$("#start"), cast: $$("[data-cast]").length }));
    await p.evaluate(() => { const r = newRoom(normalizeChar(getChar("hwanghu")), 0, S.personas[0]); location.hash = "r-" + r.id; }); await wait(600);
    u.drawer = await p.evaluate(async () => { openRoomDrawer("main"); await new Promise((z) => setTimeout(z, 250)); const r = { mImg: !!$("#mImg"), gallery: !!$('[data-v="gallery"]') }; closeOverlays(); return r; });
    await p.evaluate(() => { location.hash = "me"; }); await wait(500);
    u.me = await p.evaluate(() => ({ rkey: !!$("#rkey"), gstyle: !!$("#gstyle"), nick: !!$("#nick"), save: !!$("#setSave"), key: !!$("#key") }));
    u.studioRoute = await p.evaluate(async () => { location.hash = "studio"; await new Promise((z) => setTimeout(z, 400)); return $("#view").textContent.includes("둘러보기") || !!$(".hero, .home, [data-aud]"); });
    res.user = u;
    if (u.navs.join() !== "home,chats,store,me") errs.push("사용자 메뉴가 다름: " + u.navs.join());
    if (Object.values(u.fns).some((t) => t !== "undefined")) errs.push("사용자 빌드에 관리자 함수가 있음: " + JSON.stringify(u.fns));
    if (u.detail.wArt || u.detail.imgSlots || !u.detail.start || !u.detail.cast) errs.push("사용자 상세: " + JSON.stringify(u.detail));
    if (u.drawer.mImg || !u.drawer.gallery) errs.push("사용자 드로어: " + JSON.stringify(u.drawer));
    if (u.me.rkey || u.me.gstyle || u.me.nick || !u.me.save || !u.me.key) errs.push("사용자 MY: " + JSON.stringify(u.me));
  } catch (e) { res.fail = String(e).slice(0, 400); }
  res.errs = [...new Set(errs)];
  console.log(JSON.stringify(res));
  await b.close();
}
