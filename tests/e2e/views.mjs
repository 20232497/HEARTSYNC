// 사용자 사이트(index.html)의 모든 화면·작품·시트가 오류 없이 그려지는지(스모크): 홈·대화·도감·공지·스토어·MY 여섯 화면, 오리지널 작품 전부의 상세 페이지,
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
    for (const v of ["home", "chats", "codex", "notice", "store", "me"]) {
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
      // 플레이 가이드 칸은 작품에 guide가 있을 때만
      if (await p.evaluate((id) => !!getChar(id).guide !== !!$("#view p.guide"), id)) errs.push(`상세 ${id}: 플레이 가이드 칸이 데이터와 다름`);
      res.works++;
      await p.evaluate((id) => { const r = newRoom(normalizeChar(getChar(id)), 0, S.personas[0]); location.hash = "r-" + r.id; }, id); await wait(700);
      const chk = await p.evaluate(() => ({ log: ($("#log")?.innerText || "").length, status: !!$(".status"), composer: !!$("textarea, #input, #composer textarea"), figs: document.querySelectorAll("#log figure, #log .scene-img").length }));
      if (chk.log < 50) errs.push(`대화방 ${id}: 오프닝 본문이 비어 있음`); else res.rooms++;
      if (!chk.status) errs.push(`대화방 ${id}: 상태창이 없음`);
      if (!chk.composer) errs.push(`대화방 ${id}: 입력창이 없음`);
      // 유저노트 양식: 작품에 noteTemplate이 있을 때만 '양식 넣기' 버튼이 뜨고 그 글을 넣음. 입력 칸 예시는 이 작품의 인물 이름으로
      const note = await p.evaluate((id) => {
        openRoomDrawer("note"); const want = getChar(id).noteTemplate, btn = $("#tpl"), ph = $("#noteTa").placeholder;
        if (btn) btn.click(); const filled = $("#noteTa").value; closeOverlays();
        return { ok: !!btn === !!want && (!want || filled === want), ph: ph.includes(exampleCast(room.char).name) };
      }, id);
      if (!note.ok || !note.ph) errs.push(`대화방 ${id}: 유저노트 양식·예시가 데이터와 다름 ${JSON.stringify(note)}`);
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
    // 비공개(스포일러) 플래그 — 가짜 데이터로 틀만 확인: 인물의 hidden 칸은 잠긴 칩, hidden 장소는 도감 칸에서 그림만 가림(이름은 보임)
    res.hidden = await p.evaluate(() => {
      const c = { ...normalizeChar(getChar(ORIGINALS[0].id)), id: "zz-test", cast: [{ code: "T", name: "시험", hidden: [3] }], places: [{ name: "비밀의 방", hidden: true }, { name: "광장" }], cuts: [], // 작품이 실제로 적은 컷씬에 기대지 않게 비움
        images: { MP: { 1: "content/zz/images/MP1.webp", 2: "content/zz/images/MP2.webp" } } }; // 없는 작품 id라 이 가짜 그림 경로가 그대로 쓰임(글만 만들고 화면에 넣지는 않음)
      castSheet(c, c.cast[0]); const locked = $$(".overlay .chip.locked").length; closeOverlays();
      const html = codexHTML(c);
      return { locked, names: html.includes("비밀의 방") && html.includes("광장"), picHidden: !html.includes("MP1.webp") && html.includes("MP2.webp"), cards: (html.match(/wcard locked/g) || []).length };
    });
    if (res.hidden.locked !== 1 || !res.hidden.names || !res.hidden.picHidden || res.hidden.cards !== 1) errs.push("비공개 칸이 가려지지 않음: " + JSON.stringify(res.hidden));
    // 예시 문구는 데이터에서: 도감 '코드 읽는 법'은 고른 작품의 첫 인물 코드, MY 채팅 미리보기는 관심있는 대화에 맞는 첫 작품의 인물(전체 → 여성향으로 바꾸면 달라짐)
    res.example = await p.evaluate(async () => {
      const nap = (ms) => new Promise((r) => setTimeout(r, ms)), last = ORIGINALS[ORIGINALS.length - 1], want = exampleCast(normalizeChar(last));
      location.hash = "codex-" + last.id; await nap(400);
      const how = $(".codex-how").textContent.includes(want.code + EXAMPLE_SIT) && $(".codex-how").textContent.includes(want.name);
      const spk = async (aud) => { setAudience(aud); location.hash = "home"; await nap(200); location.hash = "me"; await nap(400); return [$(".chat-pv .spk").textContent, exampleCast().name]; };
      const all = await spk("all"), f = await spk("f"), m = await spk("m"); setAudience("all");
      return { how, all, f, m };
    });
    { const x = res.example; if (!x.how || x.all[0] !== x.all[1] || x.f[0] !== x.f[1] || x.m[0] !== x.m[1] || x.f[0] === x.m[0]) errs.push("예시 문구가 데이터와 다름: " + JSON.stringify(x)); }
    // 시작 상황의 배경 장소 — 가짜 데이터로 틀만: place가 있는 시작 상황 카드에 장소 이름이 보이고, 그 시작 상황으로 연 방의 첫 메시지 맨 위에 장소 카드
    res.opening = await p.evaluate(async () => {
      const nap = (ms) => new Promise((r) => setTimeout(r, ms)), live = ORIGINALS[0], keep = [live.places, live.openings[0].place];
      live.places = [{ name: "시험 광장" }]; live.openings[0].place = 1;
      location.hash = "home"; await nap(150); location.hash = "c-" + live.id; await nap(400);
      const pill = ($(".opening .pill") || {}).textContent || "";
      const r = newRoom(normalizeChar(live), 0, S.personas[0]), tag = r.msgs[0].alts[0].text.indexOf("[[" + seriesCode("place") + "1]]") === 0;
      location.hash = "r-" + r.id; await nap(600);
      const card = !!$("#log .scene-img.place");
      if (keep[0] === undefined) delete live.places; else live.places = keep[0];
      if (keep[1] === undefined) delete live.openings[0].place; else live.openings[0].place = keep[1];
      return { pill, tag, card };
    });
    if (!res.opening.pill.includes("시험 광장") || !res.opening.tag || !res.opening.card) errs.push("시작 상황의 배경 장소가 다름: " + JSON.stringify(res.opening));
    // 유저 설정 상한 — 페르소나 상세·유저노트 입력 칸의 maxlength와 "n / 한도" 카운터가 상수(LIMITS)를 따름, 장기기억 기본 한도도
    res.limits = await p.evaluate(() => {
      personaSheet(S.personas[0]); const pd = $("#pd").maxLength, pc = $("#pdCnt").textContent; closeOverlays();
      openRoomDrawer("note"); const nt = $("#noteTa").maxLength, nc = $("#nCnt").textContent; closeOverlays();
      return { pd, pc, nt, nc, mem: PLAN.free.memoMax, want: LIMITS, end: [" / " + num(LIMITS.personaDesc), " / " + num(LIMITS.userNote)] };
    });
    { const l = res.limits; if (l.pd !== l.want.personaDesc || l.nt !== l.want.userNote || l.mem !== l.want.memory || l.pc.slice(-l.end[0].length) !== l.end[0] || l.nc.slice(-l.end[1].length) !== l.end[1]) errs.push("설정 상한이 상수와 다름: " + JSON.stringify(l)); }
    // 내 서재 — 상세의 찜 버튼 → 홈의 '찜한 작품' 줄, 상세를 열면 '최근 본 작품' 줄, 같은 홈 줄의 다른 작품(줄이 있는 작품만), 관심있는 대화로 거름, 찜을 풀면 줄이 사라짐
    res.shelf = await p.evaluate(async () => {
      const nap = (ms) => new Promise((r) => setTimeout(r, ms)), was = { hash: location.hash, shelf: JSON.stringify(S.shelf), aud: S.settings.audience };
      const c = ORIGINALS.find((x) => x.row), solo = ORIGINALS.find((x) => !x.row), ids = (sel) => { const h = document.querySelector(sel); return h ? [...h.nextElementSibling.querySelectorAll("[data-char]")].map((b) => b.dataset.char) : null; };
      S.shelf = mergeShelf(); S.settings.audience = "all"; S.cat = "전체"; S.q = "";
      location.hash = "c-" + solo.id; await nap(300); const soloNear = !!document.querySelector("#rowNear");
      location.hash = "c-" + c.id; await nap(300);
      const near = ids("#rowNear"), wantNear = ORIGINALS.filter((x) => x.row === c.row && x.id !== c.id).map((x) => x.id), off = $("#like").getAttribute("aria-pressed");
      $("#like").click(); const on = $("#like").getAttribute("aria-pressed"), label = $("#like").textContent, saved = !!(KV.getLocal("shelf") || { likes: {} }).likes[c.id];
      location.hash = "home"; await nap(300); const likes = ids("#rowLikes"), recent = ids("#rowRecent");
      S.settings.audience = audOf(c) === "f" ? "m" : "f"; viewHome(); const other = [ids("#rowLikes"), (ids("#rowRecent") || []).includes(c.id)];
      S.settings.audience = "all"; location.hash = "c-" + c.id; await nap(300); const still = $("#like").getAttribute("aria-pressed"); $("#like").click();
      location.hash = "home"; await nap(300); const gone = ids("#rowLikes");
      S.settings.audience = was.aud; location.hash = was.hash; await nap(400); S.shelf = JSON.parse(was.shelf); KV.setLocal("shelf", S.shelf); // 돌아간 화면이 상세면 최근 본에 적히므로 그 뒤에 되돌림
      return { soloNear, near, wantNear, off, on, label, saved, likes, recent, want: [c.id, solo.id], other, still, gone };
    });
    { const s = res.shelf; if (s.soloNear || JSON.stringify(s.near) !== JSON.stringify(s.wantNear) || !s.wantNear.length || s.off !== "false" || s.on !== "true" || s.label !== "찜한 작품" || !s.saved || JSON.stringify(s.likes) !== JSON.stringify([s.want[0]])
      || JSON.stringify(s.recent) !== JSON.stringify(s.want) || s.other[0] !== null || s.other[1] || s.still !== "true" || s.gone !== null) errs.push("내 서재(찜·최근 본·같은 줄)가 다름: " + JSON.stringify(s)); }
    // 작품 메타 한 줄 — 가짜 데이터로 틀만: 제작자 기본값, 공개일·독점 배지
    res.meta = await p.evaluate(() => ({ def: metaHTML({}) === esc(DEFAULT_CREATOR), full: metaHTML({ creator: "시험 <제작자>", exclusive: true, publishedAt: "2026-11-09" }) }));
    if (!res.meta.def || res.meta.full.indexOf("시험 &lt;제작자&gt; · ") !== 0 || !res.meta.full.includes("2026.11.09 공개") || !res.meta.full.includes('<span class="pill gold">독점</span>')) errs.push("작품 메타 줄이 다름: " + JSON.stringify(res.meta));
    // 모델 배지와 새 방의 시작 모델 — '추천'은 늘 앱 기본 추천 모델에, '권장'은 작품이 recommend를 적었을 때만 그 모델에. 새 방은 권장(없으면 기본 추천) 모델로 시작
    res.rec = await p.evaluate(() => {
      const live = getChar(room.char.id), keep = live.recommend, at = () => {
        openModelSheet(); const b = document.querySelector(".model-card .pill.ok"), rec = b ? b.closest("[data-m]").dataset.m : "";
        const pick = [...document.querySelectorAll(".model-card")].filter((x) => x.querySelector(".k").textContent === MODELS[RECOMMEND_DEFAULT].badge).map((x) => x.dataset.m).join();
        closeOverlays(); return { rec, pick, start: defaultSet(live).model };
      };
      delete live.recommend; const def = at(); live.recommend = "master"; const set = at();
      if (keep === undefined) delete live.recommend; else live.recommend = keep;
      return { def, set, want: RECOMMEND_DEFAULT };
    });
    if (res.rec.def.rec !== "" || res.rec.def.pick !== res.rec.want || res.rec.def.start !== res.rec.want || res.rec.set.rec !== "master" || res.rec.set.pick !== res.rec.want || res.rec.set.start !== "master") errs.push("권장 모델 배지가 다름: " + JSON.stringify(res.rec));
    // 세계관 수첩 — 키워드북이 있는 작품의 드로어에만 메뉴가 뜨고, 응답에 📖로 저장된 항목만 열리고 나머지는 잠긴 카드(이름·설명이 화면에 없음)
    res.lorebook = await p.evaluate(() => {
      const w = ORIGINALS.find((c) => (c.lore || []).length), r = newRoom(normalizeChar(getChar(w.id)), 0, S.personas[0]); setRoom(r);
      r.msgs.push({ id: "lb1", role: "ai", idx: 0, alts: [{ text: "시험", lore: [w.lore[0].keys[0]] }] });
      openRoomDrawer("main"); const menu = ($('[data-v="lore"]') || {}).textContent || ""; closeOverlays();
      openRoomDrawer("lore"); const txt = $(".drawer").textContent;
      return { id: w.id, n: w.lore.length, menu, cards: $$(".drawer .wcard").length, locked: $$(".drawer .wcard.locked").length,
        open: txt.includes(w.lore[0].text), leak: w.lore.slice(1).filter((e) => txt.includes(e.text)).map((e) => e.keys[0]) };
    });
    await wait(250); if (out) await p.screenshot({ path: `${out}/${tag}_views_lorebook.png` });
    res.lorebook.plain = await p.evaluate(() => {
      closeOverlays(); const w = ORIGINALS.find((c) => !(c.lore || []).length); setRoom(newRoom(normalizeChar(getChar(w.id)), 0, S.personas[0]));
      openRoomDrawer("main"); const has = !!$('[data-v="lore"]'); closeOverlays(); return has;
    });
    { const l = res.lorebook; if (!l.menu.includes(`1 / ${l.n}`) || l.cards !== l.n || l.locked !== l.n - 1 || !l.open || l.leak.length || l.plain) errs.push("세계관 수첩이 다름: " + JSON.stringify(l)); }
    if (out) { await p.evaluate(() => openRoomDrawer("main")); await wait(300); await p.screenshot({ path: `${out}/${tag}_views_drawer.png` }); await p.evaluate(() => closeOverlays()); }
  } catch (e) { res.fail = String(e).slice(0, 400); }
  res.errs = [...new Set(errs)];
  console.log(JSON.stringify(res));
  await b.close();
}
