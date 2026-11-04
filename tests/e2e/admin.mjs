// 관리자 도구(admin.html) 스모크 + 사용자 빌드(index.html)와 갈라졌는지: 일곱 화면(홈·대화·작품·이미지·만들기·스토어·MY), 상세의 관리 버튼(일러스트 관리·이미지 관리·
// 작품 폴더에 저장), 드로어의 이미지 버튼, MY의 이미지 생성 설정(#rkey·#gstyle·기본 화풍 카드)·크리에이터 프로필, 페르소나 시트의 'AI로 만들기', 시트 5종(코드 편집기·
// 세계관 일러스트·추천 코드·생성 창·페르소나), 만들기의 관심있는 대화 칸, 이미지 스튜디오(코드 목록·조합 키·프롬프트·찾기·접기). 그리고 사용자 빌드에는 그 자리들이 비어 있고
// 관리자 함수(viewStudio·viewImages·openImages)가 없어야 함.
import { chromium, webkit, devices } from "playwright";
import { noSupabase } from "./_offline.mjs";
const [, , url, out] = process.argv; // url = admin.html 주소(run.mjs가 붙임). 사용자 빌드는 admin.html을 뗀 주소
const userUrl = url.replace(/admin\.html$/, "");
for (const [dev, engine, opts] of [["Desktop Chrome", chromium, {}], ["iPhone 13", webkit, devices["iPhone 13"]]]) {
  const b = await engine.launch(); const ctx = await b.newContext({ ...opts }); await noSupabase(ctx); const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push("pageerror: " + e.message)); p.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 160)); });
  const res = { dev, views: {}, sheets: {} };
  const wait = (ms) => p.waitForTimeout(ms), tag = dev.replace(/\W+/g, "_");
  const open = async (u) => { await p.goto(u, { waitUntil: "load" }); await wait(1200); if (await p.$("#lguest")) { await p.click("#lguest"); await wait(400); } await p.evaluate(() => { closeOverlays(); setAudience("all"); }); };
  const sheetLen = async (src) => p.evaluate(async (s) => { try { (0, eval)(`(${s})`)(); await new Promise((z) => setTimeout(z, 250)); const o = document.querySelector(".overlay, .drawer"); const n = o ? o.textContent.replace(/\s+/g, " ").trim().length : 0; closeOverlays(); return n; } catch (e) { return "error: " + e.message; } }, src);
  try {
    await open(url);
    res.navs = await p.evaluate(() => [...document.querySelectorAll("#rail [data-nav]")].map((b) => b.dataset.nav));
    if (res.navs.join() !== "home,chats,works,images,studio,store,me") errs.push("관리자 메뉴가 다름: " + res.navs.join());
    for (const v of ["home", "chats", "works", "images", "studio", "store", "me"]) {
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
      sitEditor: () => sitEditor(null, () => {}),
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
    // 비밀번호 관문: 로컬 주소에서는 세우지 않음(웹 주소에서만) — 함수가 있고, 이 서버(127.0.0.1)에서는 gateNeeded가 거짓
    res.gate = await p.evaluate(() => ({ fn: typeof gate, needed: gateNeeded(), gated: document.body.classList.contains("gated") }));
    if (res.gate.fn !== "function" || res.gate.needed || res.gate.gated) errs.push("관문: " + JSON.stringify(res.gate));
    // 이미지 스튜디오: 인물 칩·코드 목록이 그려지고, 의상·장소를 고르면 조합 키가 바뀌고, 프롬프트 보기·찾기·묶음 접기가 됨(그리기는 Runware 키가 필요해 누르지 않음)
    await p.evaluate(() => { location.hash = "images-hwanghu"; }); await wait(500);
    res.studio = await p.evaluate(async () => {
      const w = (ms) => new Promise((z) => setTimeout(z, ms));
      const who = $$(".is-who").length, acts = $$(".is-code").length, groups = $$(".is-group").length;
      $('[data-tab="wear"]').click(); await w(150); const wears = $$(".is-code").length; $(".is-code [data-pick]").click(); await w(150);
      $('[data-tab="place"]').click(); await w(150); const places = $$(".is-code").length; $(".is-code [data-pick]").click(); await w(150);
      const combo = $(".ct-combo code").textContent; $("#isPrompt").click(); await w(150);
      const prompt = ($(".ct-prompt")?.textContent || "").length;
      $('[data-tab="act"]').click(); await w(150);
      const q = $("#isQ"); q.value = "웃음"; q.dispatchEvent(new Event("input")); await w(100);
      const found = $$(".is-code").filter((e) => !e.hidden).length; q.value = ""; q.dispatchEvent(new Event("input"));
      $('[data-fold="act0"]').click(); await w(150); const folded = $('[data-group="act0"]').classList.contains("closed"); $('[data-fold="act0"]').click(); await w(150);
      // 성인 확인을 켜면 세미·성인 코드가 더 보이고, 이 PC에 관리자 전용 코드(content/codes.admin.json, git에 없음 — 런타임에 읽은 수, 없으면 0)가 있으면 그것도 '관리자' 표시로
      S.settings.isAgeVerified = true; saveSettings(); viewImages("hwanghu"); await w(200);
      const all = ["act", "wear", "place"].flatMap((d) => codeGroups(d).flatMap((g) => g.items));
      const adultN = all.filter((d) => d.rating !== "safe").length, adminN = all.filter((d) => d.src === "관리자").length, adminCodes = EXTRA_CODES.length, adultRows = $$(".is-code.adult").length;
      S.settings.isAgeVerified = false; saveSettings(); viewImages("hwanghu"); await w(200);
      return { who, acts, groups, wears, places, combo, prompt, found, folded, go: !!$("#isGo"), adultN, adultRows, adminN, adminCodes };
    });
    const st = res.studio;
    if (st.who < 5 || st.acts < 50 || st.groups < 2 || st.wears < 2 || st.places < 5 || !/\[\[img:[a-z0-9]+:\d+,4\d\d,5\d\d\]\]/.test(st.combo) || st.prompt < 40 || !st.found || st.found >= st.acts || !st.folded || !st.go || st.adultN < 6 || !st.adultRows || st.adminN !== st.adminCodes) errs.push("이미지 스튜디오: " + JSON.stringify(st));
    if (out) await p.screenshot({ path: `${out}/${tag}_admin_me.png`, fullPage: false });

    // 사용자 빌드: 관리 자리가 비어 있고 관리자 함수가 없음
    await open(userUrl);
    const u = { navs: await p.evaluate(() => [...document.querySelectorAll("#rail [data-nav]")].map((b) => b.dataset.nav)) };
    u.fns = await p.evaluate(() => ({ studio: typeof viewStudio, images: typeof viewImages, openImages: typeof openImages, codeGroups: typeof codeGroups, gen: typeof genImageSheet, works: typeof viewWorks, runware: typeof runwareImage, gate: typeof gate, loadAdminCodes: typeof loadAdminCodes }));
    u.extra = await p.evaluate(() => EXTRA_CODES.length);
    await p.evaluate(() => { location.hash = "c-hwanghu"; }); await wait(500);
    u.detail = await p.evaluate(() => ({ wArt: !!$("#wArt"), imgSlots: !!$("#imgSlots"), start: !!$("#start"), cast: $$("[data-cast]").length }));
    await p.evaluate(() => { const r = newRoom(normalizeChar(getChar("hwanghu")), 0, S.personas[0]); location.hash = "r-" + r.id; }); await wait(600);
    u.drawer = await p.evaluate(async () => { openRoomDrawer("main"); await new Promise((z) => setTimeout(z, 250)); const r = { mImg: !!$("#mImg"), gallery: !!$('[data-v="gallery"]') }; closeOverlays(); return r; });
    await p.evaluate(() => { location.hash = "me"; }); await wait(500);
    u.me = await p.evaluate(() => ({ rkey: !!$("#rkey"), gstyle: !!$("#gstyle"), nick: !!$("#nick"), save: !!$("#setSave"), key: !!$("#key") }));
    u.studioRoute = await p.evaluate(async () => { location.hash = "studio"; await new Promise((z) => setTimeout(z, 400)); return $("#view").textContent.includes("둘러보기") || !!$(".hero, .home, [data-aud]"); });
    res.user = u;
    if (u.navs.join() !== "home,chats,store,me") errs.push("사용자 메뉴가 다름: " + u.navs.join());
    if (Object.values(u.fns).some((t) => t !== "undefined") || u.extra !== 0) errs.push("사용자 빌드에 관리자 함수·코드가 있음: " + JSON.stringify(u.fns) + " extra=" + u.extra);
    if (u.detail.wArt || u.detail.imgSlots || !u.detail.start || !u.detail.cast) errs.push("사용자 상세: " + JSON.stringify(u.detail));
    if (u.drawer.mImg || !u.drawer.gallery) errs.push("사용자 드로어: " + JSON.stringify(u.drawer));
    if (u.me.rkey || u.me.gstyle || u.me.nick || !u.me.save || !u.me.key) errs.push("사용자 MY: " + JSON.stringify(u.me));
  } catch (e) { res.fail = String(e).slice(0, 400); }
  res.errs = [...new Set(errs)];
  console.log(JSON.stringify(res));
  await b.close();
}
