// 관리자 도구(admin.html) 스모크 + 사용자 빌드(index.html)와 갈라졌는지: 일곱 화면(홈·대화·작품·이미지·만들기·스토어·MY), 상세의 관리 버튼(일러스트 관리·이미지 관리·
// 작품 폴더에 저장), 드로어의 이미지 버튼, MY의 이미지 생성 설정(#rkey·#gstyle·기본 화풍 카드)·크리에이터 프로필, 페르소나 시트의 'AI로 만들기', 시트 5종(코드 편집기·
// 세계관 일러스트·추천 코드·생성 창·페르소나), 만들기의 관심있는 대화 칸, 이미지 스튜디오(코드 목록·조합 키·프롬프트·찾기·접기·코드 선택 삭제·조합 모두 빼기·갤러리 움짤·⟳). 그리고 사용자 빌드에는 그 자리들이 비어 있고
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
    res.me = await p.evaluate(() => ({ rkey: !!$("#rkey"), gstyle: !!$("#gstyle"), bsets: $$("#bsets .bset").length, nick: !!$("#nick"), save: !!$("#setSave"), autoMotion: !!$("#autoMotion") && !$("#autoMotion").checked }));
    if (!res.me.rkey || !res.me.gstyle || !res.me.bsets || !res.me.nick || !res.me.save || !res.me.autoMotion) errs.push("MY 이미지 설정: " + JSON.stringify(res.me));
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
    // 코드 선택 삭제(내 칸만 체크 칸, 묶음 전체 선택, 두 번 눌러 삭제 → 그 코드의 그림도 지움) · 조합 '모두 빼기' · 갤러리의 크게·움짤·⟳(가짜 움짤로 사진 ↔ 움짤) — 움짤 만들기는 Runware 요금이 들어 창만 열어 봄
    res.studio2 = await p.evaluate(async () => {
      const w = (ms) => new Promise((z) => setTimeout(z, ms)), c = normalizeChar(getChar("hwanghu")), code = c.cast[0].code;
      const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
      S.settings.customSits = [...(S.settings.customSits || []), { n: 31, name: "시험칸가", prompt: "smile", rating: "safe" }, { n: 32, name: "시험칸나", prompt: "wink", rating: "safe" }]; saveSettings();
      putCastImage(c, code, "31", PNG); putCastImage(c, code, "1", PNG);
      ISTATE.cast = code; ISTATE.tab = "act"; viewImages("hwanghu"); await w(200);
      const r = { delBtn: !!$("#isDelMode") };
      $("#isDelMode").click(); await w(150);
      r.bar = !!$(".is-delbar"); r.chks = $$(".is-chk").length; r.locked = $$(".is-code.locked").length; r.goOff = $("#isDelGo").disabled;
      const chk = $('[data-chk="31"]'); chk.checked = true; chk.dispatchEvent(new Event("change")); await w(150);
      r.one = ISTATE.del.size; r.imgs = countSitImages([31]);
      const gsel = $('.is-code[data-row="32"]').closest(".is-group").querySelector("[data-gsel]"); gsel.click(); await w(150);
      r.both = ISTATE.del.has(31) && ISTATE.del.has(32);
      $("#isDelGo").click(); await w(50); r.sure = /한 번 더/.test($("#isDelGo").textContent); $("#isDelGo").click(); await w(200);
      r.gone = !(S.settings.customSits || []).some((d) => d.n === 31 || d.n === 32) && !(imagesOf(c)[code] || {})["31"] && !$(".is-delbar") && ISTATE.del === null;
      // 조합: 감정 둘 + 의상 → 모두 빼기 → 기본(1)만
      ISTATE.acts = [1, 2]; ISTATE.wear = 404; viewImages(); await w(150);
      r.clr = !!$("#isSelClr"); $("#isSelClr").click(); await w(150);
      r.cleared = ISTATE.acts.join() === "1" && ISTATE.wear === null && !$("#isSelClr");
      // 움짤: 칸 1에 가짜 움짤(켜짐) → 갤러리에 움짤 표시·⟳(켜짐)·영상, ⟳ 누르면 사진
      putMotion(c, code, "1", "data:video/mp4;base64,AAAAIGZ0eXBpc29t"); viewImages(); await w(200);
      const gi = () => $('[data-load="1"]').closest(".is-gi");
      r.mo = { badge: gi().querySelector(".mo-badge")?.textContent, flipOn: gi().querySelector('[data-flip="1"]')?.classList.contains("on"), video: !!gi().querySelector("video.mo"), zoom: !!gi().querySelector('[data-zoom="1"]'), make: !!gi().querySelector('[data-mo="1"]'), now: !!$(".is-now [data-flip]") };
      gi().querySelector('[data-flip="1"]').click(); await w(200);
      r.mo.off = { badge: gi().querySelector(".mo-badge")?.textContent, video: !!gi().querySelector("video"), on: motionOf(c, code, "1").on };
      gi().querySelector('[data-mo="1"]').click(); await w(200);
      r.mo.sheet = { open: !!$(".mo-sheet"), models: $$("#moM option").length, durs: $$("#moD option").length, del: !!$("#moDel"), prev: $$(".mo-prev figure").length };
      $(".mo-sheet [data-x]").click(); await w(100);
      putCastImage(c, code, "1", null); r.mo.cleaned = !motionOf(c, code, "1");
      ISTATE.cast = ""; viewImages("hwanghu"); await w(150);
      return r;
    });
    const s2 = res.studio2;
    if (!s2.delBtn || !s2.bar || s2.chks < 2 || !s2.locked || !s2.goOff || s2.one !== 1 || s2.imgs !== 1 || !s2.both || !s2.sure || !s2.gone || !s2.clr || !s2.cleared
      || s2.mo.badge !== "움짤" || !s2.mo.flipOn || !s2.mo.video || !s2.mo.zoom || !s2.mo.make || !s2.mo.now || s2.mo.off.badge !== "사진" || s2.mo.off.video || s2.mo.off.on
      || !s2.mo.sheet.open || s2.mo.sheet.models !== 4 || s2.mo.sheet.durs < 2 || !s2.mo.sheet.del || s2.mo.sheet.prev !== 2 || !s2.mo.cleaned) errs.push("스튜디오 삭제·움짤: " + JSON.stringify(s2));
    // 기본 코드 고치기(✎ → baseSits, 그림 태그·움직임에 반영, 기본값으로), 작성 구조 안내, 내장 코드의 움직임 칸(표와 같으면 저장 안 함), 전체이용가가 아니면 움직임을 숨기고 지움, 목록으로 추가(작성 구조·여러 줄·껍데기 줄)
    res.codeEdit = await p.evaluate(async () => {
      const w = (ms) => new Promise((z) => setTimeout(z, ms)), c = normalizeChar(getChar("hwanghu")), cast = c.cast[0], edit = (n) => $(`.is-code[data-row="${n}"] .is-ed`);
      const tags = () => savedParts(c, cast, "3").find((g) => g.key === "scene").tags.map((x) => x.t).join(", ");
      ISTATE.cast = cast.code; ISTATE.tab = "act"; ISTATE.acts = [1]; viewImages("hwanghu"); await w(200);
      const g = $(".is-codes .code-guide"), r = { guide: !!g && ["행동 코드 작성 구조", "base_prompt", "motion_en", "미소_지음"].every((t) => g.textContent.includes(t)) };
      $('[data-tab="wear"]').click(); await w(150); r.guideWear = !$(".is-codes .code-guide"); $('[data-tab="act"]').click(); await w(150);
      const before = tags();
      r.baseBtn = !!edit(3); edit(3).click(); await w(150);
      r.base = { prompt: $("#bsP").value === before, resetOff: $("#bsR").disabled, guide: !!$(".sheet .code-guide ul") };
      $("#bsS").click(); await w(150); r.unchanged = !baseSit(3); // 안 고치고 저장하면 고친 것으로 치지 않음
      edit(3).click(); await w(150); $("#bsP").value = "covering face, blush"; $("#bsM").value = "covering face with both hands"; $("#bsS").click(); await w(200);
      r.saved = { tags: tags(), mark: /수정/.test($('.is-code[data-row="3"] .src')?.textContent || ""), video: /covering face with both hands/.test(motionPromptOf(c, cast, "3")), synced: !!(cloudSettings().baseSits || {})[3] };
      edit(3).click(); await w(150); $("#bsR").click(); await w(200);
      r.back = { tags: tags() === before, gone: !baseSit(3), mark: !$('.is-code[data-row="3"] .src') };
      // 내장 코드: 표의 문장으로 채움 → 그대로 저장하면 움직임은 저장 안 함 → 고치면 저장·사용
      edit(101).click(); await w(150);
      r.dims = { filled: $("#smo").value === MotionPrompts[101].motion_en, prompt: $("#spr").value === MotionPrompts[101].base_prompt, guide: !!$(".sheet .code-guide ul") };
      $("#ssv").click(); await w(200);
      const own = () => S.settings.customSits.find((d) => d.n === 101);
      r.dims.plain = !!own() && !own().motion;
      edit(101).click(); await w(150); $("#smo").value = "waving a hand"; $("#ssv").click(); await w(200);
      r.dims.motion = own().motion; r.dims.used = /waving a hand/.test(motionPromptOf(c, cast, "101"));
      // 수위를 올리면 움직임 칸이 숨고, 저장하면 지워짐 / 의상 코드에는 움직임 칸이 없음
      S.settings.isAgeVerified = true; saveSettings(); viewImages("hwanghu"); await w(200);
      edit(101).click(); await w(150);
      const hide = { on: !$("#smoF").hidden }; $("#srt").value = "questionable"; $("#srt").dispatchEvent(new Event("change")); hide.off = $("#smoF").hidden; hide.note = !$("#smoN").hidden;
      $("#ssv").click(); await w(200); hide.dropped = !own().motion && own().rating === "questionable";
      sitEditor(null, () => {}); $("#sdm").value = "wear"; $("#sdm").dispatchEvent(new Event("change")); hide.wear = $("#smoF").hidden; $(".overlay.gen-ov:last-child [data-x]").click(); await w(50);
      r.hide = hide;
      S.settings.customSits = S.settings.customSits.filter((d) => d.n !== 101);
      // 목록: 표를 통째로 — 껍데기 줄은 빼고, 값 안의 작은따옴표·여러 줄 행·예전 이름 prompt·다른 꼴의 줄도 읽음
      const text = 'export const MotionPrompts = {\n  // === 시험 ===\n  171: { title: "시험_하나", base_prompt: "wave, partner\'s hand", motion_en: "POV partner\'s hand waving" },\n  172: {\n    title: "시험_둘",\n    base_prompt: "nod",\n    motion_en: "nodding slowly"\n  },\n  173: { title: "시험_셋", prompt: "bow" },\n} as const;\n시험 이름\n시험 넷 | 우산';
      r.parse = parseSitList(text).map((d) => [d.n, d.name, d.prompt, d.motion || ""].join("/"));
      const addList = async (t, rating) => { sitListSheet(() => {}); await w(50); r.listGuide = !!$(".sheet .code-guide ul"); $("#slt").value = t; $("#slt").oninput(); if (rating) $("#slr").value = rating; $("#sladd").click(); await w(150); };
      await addList(text);
      const n = (x) => S.settings.customSits.find((d) => d.n === x);
      r.list = { safe: n(171) && n(171).motion, none: n(173) && n(173).motion === undefined, prompt: n(172) && n(172).prompt };
      r.list.used = /nodding slowly/.test(motionPromptOf(c, cast, "172"));
      await addList('174: { title: "시험_다섯", base_prompt: "wave", motion_en: "waving" },', "questionable");
      r.list.semi = n(174) && n(174).rating === "questionable" && n(174).motion === undefined;
      r.list.semiPrompt = motionPromptOf(c, cast, "174") === MOTION_PROMPT;
      S.settings.customSits = S.settings.customSits.filter((d) => d.n < 171 || d.n > 174); S.settings.customSits = S.settings.customSits.filter((d) => !/^시험/.test(d.name));
      S.settings.isAgeVerified = false; saveSettings(); ISTATE.cast = ""; viewImages("hwanghu"); await w(150);
      return r;
    });
    const ce = res.codeEdit;
    if (!ce.guide || !ce.guideWear || !ce.baseBtn || !ce.base.prompt || !ce.base.resetOff || !ce.base.guide || !ce.unchanged || ce.saved.tags !== "covering face, blush" || !ce.saved.mark || !ce.saved.video || !ce.saved.synced || !ce.back.tags || !ce.back.gone || !ce.back.mark
      || !ce.dims.filled || !ce.dims.prompt || !ce.dims.guide || !ce.dims.plain || ce.dims.motion !== "waving a hand" || !ce.dims.used || !ce.hide.on || !ce.hide.off || !ce.hide.note || !ce.hide.dropped || !ce.hide.wear || !ce.listGuide
      || ce.parse.join("|") !== "171/시험 하나/wave, partner's hand/POV partner's hand waving|172/시험 둘/nod/nodding slowly|173/시험 셋/bow/|/시험 이름/시험 이름/|/시험 넷/우산/"
      || ce.list.safe !== "POV partner's hand waving" || !ce.list.none || ce.list.prompt !== "nod" || !ce.list.used || !ce.list.semi || !ce.list.semiPrompt) errs.push("코드 고치기·작성 구조: " + JSON.stringify(ce));
    if (out) await p.screenshot({ path: `${out}/${tag}_admin_me.png`, fullPage: false });

    // 사용자 빌드: 관리 자리가 비어 있고 관리자 함수가 없음
    await open(userUrl);
    const u = { navs: await p.evaluate(() => [...document.querySelectorAll("#rail [data-nav]")].map((b) => b.dataset.nav)) };
    u.fns = await p.evaluate(() => ({ studio: typeof viewStudio, images: typeof viewImages, openImages: typeof openImages, codeGroups: typeof codeGroups, gen: typeof genImageSheet, works: typeof viewWorks, runware: typeof runwareImage, gate: typeof gate, loadAdminCodes: typeof loadAdminCodes, makeMotion: typeof makeMotion, motionSheet: typeof motionSheet, autoMotions: typeof autoMotions, buildVideoPrompt: typeof buildVideoPrompt, MotionPrompts: typeof MotionPrompts }));
    u.extra = await p.evaluate(() => EXTRA_CODES.length);
    await p.evaluate(() => { location.hash = "c-hwanghu"; }); await wait(500);
    u.detail = await p.evaluate(() => ({ wArt: !!$("#wArt"), imgSlots: !!$("#imgSlots"), start: !!$("#start"), cast: $$("[data-cast]").length }));
    await p.evaluate(() => { const r = newRoom(normalizeChar(getChar("hwanghu")), 0, S.personas[0]); location.hash = "r-" + r.id; }); await wait(600);
    u.drawer = await p.evaluate(async () => { openRoomDrawer("main"); await new Promise((z) => setTimeout(z, 250)); const r = { mImg: !!$("#mImg"), gallery: !!$('[data-v="gallery"]') }; closeOverlays(); return r; });
    await p.evaluate(() => { location.hash = "me"; }); await wait(500);
    u.me = await p.evaluate(() => ({ rkey: !!$("#rkey"), gstyle: !!$("#gstyle"), nick: !!$("#nick"), save: !!$("#setSave"), key: !!$("#key"), autoMotion: !!$("#autoMotion") }));
    u.studioRoute = await p.evaluate(async () => { location.hash = "studio"; await new Promise((z) => setTimeout(z, 400)); return $("#view").textContent.includes("둘러보기") || !!$(".hero, .home, [data-aud]"); });
    res.user = u;
    if (u.navs.join() !== "home,chats,store,me") errs.push("사용자 메뉴가 다름: " + u.navs.join());
    if (Object.values(u.fns).some((t) => t !== "undefined") || u.extra !== 0) errs.push("사용자 빌드에 관리자 함수·코드가 있음: " + JSON.stringify(u.fns) + " extra=" + u.extra);
    if (u.detail.wArt || u.detail.imgSlots || !u.detail.start || !u.detail.cast) errs.push("사용자 상세: " + JSON.stringify(u.detail));
    if (u.drawer.mImg || !u.drawer.gallery) errs.push("사용자 드로어: " + JSON.stringify(u.drawer));
    if (u.me.rkey || u.me.gstyle || u.me.nick || u.me.autoMotion || !u.me.save || !u.me.key) errs.push("사용자 MY: " + JSON.stringify(u.me));
  } catch (e) { res.fail = String(e).slice(0, 400); }
  res.errs = [...new Set(errs)];
  console.log(JSON.stringify(res));
  await b.close();
}
