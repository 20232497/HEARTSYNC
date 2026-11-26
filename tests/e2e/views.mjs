// 사용자 사이트(index.html)의 모든 화면·작품·시트가 오류 없이 그려지는지(스모크): 홈·대화·도감·공지·스토어·MY 여섯 화면, 오리지널 작품 전부의 상세 페이지,
// 각 작품의 첫 시작 상황으로 연 대화방(오프닝 본문·상태창·입력창), 대화방 드로어·모델 시트·페르소나·관심있는 대화·PLUS·확인 시트.
// 관리자 도구의 화면·시트(만들기·이미지 슬롯·세계관 일러스트·추천 칸)는 admin.mjs. pageerror와 console error를 모아 errs에 담는다 — 모듈 분리 뒤 어떤 화면에서든 ReferenceError가 나면 여기서 잡힘.
import { chromium, webkit, devices } from "playwright";
import { noSupabase } from "./_offline.mjs";
const [, , url, out] = process.argv;
for (const [dev, engine, opts] of [
  ["Desktop Chrome", chromium, {}],
  ["iPhone 13", webkit, devices["iPhone 13"]]
]) {
  const b = await engine.launch();
  const ctx = await b.newContext({ ...opts });
  await noSupabase(ctx);
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  p.on("console", (m) => {
    if (m.type() === "error") errs.push("console: " + m.text().slice(0, 160));
  });
  const res = { dev, views: {}, works: 0, rooms: 0, sheets: {} };
  const wait = (ms) => p.waitForTimeout(ms);
  const tag = dev.replace(/\W+/g, "_");
  try {
    await p.goto(url, { waitUntil: "load" });
    await wait(1200);
    if (await p.$("#lguest")) {
      await p.click("#lguest");
      await wait(400);
    }
    await p.evaluate(() => {
      closeOverlays();
      setAudience("all");
    });
    // 다섯 화면
    for (const v of ["home", "chats", "codex", "notice", "store", "me"]) {
      await p.evaluate((v) => {
        location.hash = v;
      }, v);
      await wait(500);
      res.views[v] = await p.evaluate(() => $("#view").innerHTML.length);
      if (res.views[v] < 200) errs.push(`${v} 화면이 비어 있음`);
    }
    // 작품마다 상세 → 첫 시작 상황으로 방 열기 → 로그·상태창·입력창
    const ids = await p.evaluate(() => ORIGINALS.map((c) => c.id));
    for (const id of ids) {
      await p.evaluate((id) => {
        location.hash = "c-" + id;
      }, id);
      await wait(350);
      const ok = await p.evaluate((id) => $("#view").textContent.includes(getChar(id).title), id);
      if (!ok) {
        errs.push(`상세 ${id}가 안 그려짐`);
        continue;
      }
      // 플레이 가이드 칸은 작품에 guide가 있을 때만
      if (await p.evaluate((id) => !!getChar(id).guide !== !!$("#view p.guide"), id)) errs.push(`상세 ${id}: 플레이 가이드 칸이 데이터와 다름`);
      res.works++;
      await p.evaluate((id) => {
        const r = newRoom(normalizeChar(getChar(id)), 0, S.personas[0]);
        location.hash = "r-" + r.id;
      }, id);
      await wait(700);
      const chk = await p.evaluate(() => ({
        log: ($("#log")?.innerText || "").length,
        status: !!$(".status"),
        composer: !!$("textarea, #input, #composer textarea"),
        figs: document.querySelectorAll("#log figure, #log .scene-img").length
      }));
      if (chk.log < 50) errs.push(`대화방 ${id}: 오프닝 본문이 비어 있음`);
      else res.rooms++;
      if (!chk.status) errs.push(`대화방 ${id}: 상태창이 없음`);
      if (!chk.composer) errs.push(`대화방 ${id}: 입력창이 없음`);
      // 유저노트 양식: 작품에 noteTemplate이 있을 때만 '양식 넣기' 버튼이 뜨고 그 글을 넣음. 입력 칸 예시는 이 작품의 인물 이름으로
      const note = await p.evaluate((id) => {
        openRoomDrawer("note");
        const want = getChar(id).noteTemplate,
          btn = $("#tpl"),
          ph = $("#noteTa").placeholder;
        if (btn) btn.click();
        const filled = $("#noteTa").value;
        closeOverlays();
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
        try {
          (0, eval)(`(${src})`)();
          await new Promise((z) => setTimeout(z, 250));
          const o = document.querySelector(".overlay, .drawer");
          const n = o ? o.textContent.replace(/\s+/g, " ").trim().length : 0;
          closeOverlays();
          return n;
        } catch (e) {
          return "error: " + e.message;
        }
      }, sheets[name].toString());
      res.sheets[name] = r;
      if (typeof r !== "number" || r < 10) errs.push(`시트 ${name}: ${r}`);
    }
    // 겹의 키보드(프레임 7차 C3): 열면 포커스가 창 안으로, Tab·Shift+Tab은 창 안에서만 돌고, Esc는 맨 위 겹만 닫고 연 버튼으로 포커스를 돌려줌 — 시트와 방 서랍
    res.keys = {};
    for (const [name, opener, open] of [
      ["sheet", "#findBtn", "confirmSheet('정말 지울까요?', '이 대화방의 메시지가 모두 사라져요.', '지우기', () => {})"],
      ["drawer", "#info", "$('#info').click()"]
    ]) {
      await p.evaluate(
        ([sel, code]) => {
          $(sel).focus();
          (0, eval)(code);
        },
        [opener, open]
      );
      await p.waitForTimeout(250);
      const inside = () => p.evaluate(() => !!document.activeElement && !!document.activeElement.closest(".overlay"));
      const k = { open: await inside(), tab: 0, back: 0 };
      for (let i = 0; i < 7; i++) {
        await p.keyboard.press("Tab");
        if (await inside()) k.tab++;
      }
      for (let i = 0; i < 3; i++) {
        await p.keyboard.press("Shift+Tab");
        if (await inside()) k.back++;
      }
      await p.keyboard.press("Escape");
      await p.waitForTimeout(150);
      Object.assign(k, await p.evaluate((sel) => ({ closed: !$(".overlay"), focus: document.activeElement === $(sel) }), opener));
      res.keys[name] = k;
      if (!k.open || k.tab !== 7 || k.back !== 3 || !k.closed || !k.focus) errs.push(`겹의 키보드(${name}): ` + JSON.stringify(k));
    }
    // 비공개(스포일러) 플래그 — 가짜 데이터로 틀만 확인: 인물의 hidden 칸은 잠긴 칩, hidden 장소는 도감 칸에서 그림만 가림(이름은 보임)
    res.hidden = await p.evaluate(() => {
      const c = {
        ...normalizeChar(getChar(ORIGINALS[0].id)),
        id: "zz-test",
        cast: [{ code: "T", name: "시험", hidden: [3] }],
        places: [{ name: "비밀의 방", hidden: true }, { name: "광장" }],
        cuts: [], // 작품이 실제로 적은 컷씬에 기대지 않게 비움
        images: { MP: { 1: "content/zz/images/MP1.webp", 2: "content/zz/images/MP2.webp" } }
      }; // 없는 작품 id라 이 가짜 그림 경로가 그대로 쓰임(글만 만들고 화면에 넣지는 않음)
      castSheet(c, c.cast[0]);
      const locked = $$(".overlay .chip.locked").length;
      closeOverlays();
      const html = codexHTML(c);
      return {
        locked,
        names: html.includes("비밀의 방") && html.includes("광장"),
        picHidden: !html.includes("MP1.webp") && html.includes("MP2.webp"),
        cards: (html.match(/wcard locked/g) || []).length
      };
    });
    if (res.hidden.locked !== 1 || !res.hidden.names || !res.hidden.picHidden || res.hidden.cards !== 1)
      errs.push("비공개 칸이 가려지지 않음: " + JSON.stringify(res.hidden));
    // 예시 문구는 데이터에서: 도감 '코드 읽는 법'은 고른 작품의 첫 인물 코드, MY 채팅 미리보기는 관심있는 대화에 맞는 첫 작품의 인물(전체 → 여성향으로 바꾸면 달라짐)
    res.example = await p.evaluate(async () => {
      const nap = (ms) => new Promise((r) => setTimeout(r, ms)),
        last = ORIGINALS[ORIGINALS.length - 1],
        want = exampleCast(normalizeChar(last));
      location.hash = "codex-" + last.id;
      await nap(400);
      const how = $(".codex-how").textContent.includes(want.code + EXAMPLE_SIT) && $(".codex-how").textContent.includes(want.name);
      const spk = async (aud) => {
        setAudience(aud);
        location.hash = "home";
        await nap(200);
        location.hash = "me";
        await nap(400);
        return [$(".chat-pv .spk").textContent, exampleCast().name];
      };
      const all = await spk("all"),
        f = await spk("f"),
        m = await spk("m");
      setAudience("all");
      return { how, all, f, m };
    });
    {
      const x = res.example;
      if (!x.how || x.all[0] !== x.all[1] || x.f[0] !== x.f[1] || x.m[0] !== x.m[1] || x.f[0] === x.m[0])
        errs.push("예시 문구가 데이터와 다름: " + JSON.stringify(x));
    }
    // 시작 상황의 배경 장소 — 가짜 데이터로 틀만: place가 있는 시작 상황 카드에 장소 이름이 보이고, 그 시작 상황으로 연 방의 첫 메시지 맨 위에 장소 카드
    res.opening = await p.evaluate(async () => {
      const nap = (ms) => new Promise((r) => setTimeout(r, ms)),
        live = ORIGINALS[0],
        keep = [live.places, live.openings[0].place];
      live.places = [{ name: "시험 광장" }];
      live.openings[0].place = 1;
      location.hash = "home";
      await nap(150);
      location.hash = "c-" + live.id;
      await nap(400);
      const pill = ($(".opening .pill") || {}).textContent || "";
      const r = newRoom(normalizeChar(live), 0, S.personas[0]),
        tag = r.msgs[0].alts[0].text.indexOf("[[" + seriesCode("place") + "1]]") === 0;
      location.hash = "r-" + r.id;
      await nap(600);
      const card = !!$("#log .scene-img.place");
      if (keep[0] === undefined) delete live.places;
      else live.places = keep[0];
      if (keep[1] === undefined) delete live.openings[0].place;
      else live.openings[0].place = keep[1];
      return { pill, tag, card };
    });
    if (!res.opening.pill.includes("시험 광장") || !res.opening.tag || !res.opening.card)
      errs.push("시작 상황의 배경 장소가 다름: " + JSON.stringify(res.opening));
    // 시작 상황 id — '처음부터 다시'가 제목이 아니라 id로 같은 시작 상황을 찾음: 방을 만든 뒤 작품이 그 시작 상황의 제목을 고치고 순서를 바꿔도 같은 장면으로 시작(예전에는 제목이 바뀌면 조용히 첫 시작 상황으로 갔음)
    res.restart = await p.evaluate(async () => {
      const nap = (ms) => new Promise((r) => setTimeout(r, ms)),
        live = ORIGINALS.slice()
          .reverse()
          .find((c) => c.openings.length > 1),
        keep = live.openings.slice();
      const r = newRoom(normalizeChar(live), 1, S.personas[0]),
        want = keep[1].text.slice(0, 30);
      live.openings = [keep[1], keep[0]].concat(keep.slice(2)).map((o) => ({ ...o, title: o.title + " (고친 제목)" }));
      location.hash = "r-" + r.id;
      await nap(600);
      openRoomDrawer("main");
      await nap(150);
      $("#qNew").click();
      await nap(150);
      document.querySelector(".overlay #ok").click();
      await nap(700);
      const out = {
        id: r.openingId,
        wantId: keep[1].id,
        fresh: room.id !== r.id,
        sameId: room.openingId === r.openingId,
        sameScene: curText(room.msgs[0]).includes(want),
        title: room.opening,
        wantTitle: keep[1].title + " (고친 제목)"
      };
      live.openings = keep;
      return out;
    });
    {
      const s = res.restart;
      if (!s.id || s.id !== s.wantId || !s.fresh || !s.sameId || !s.sameScene || s.title !== s.wantTitle)
        errs.push("제목을 고친 뒤의 '처음부터 다시'가 같은 시작 상황으로 가지 않음: " + JSON.stringify(s));
    }
    // 대화방 즐겨찾기 — 대화 목록의 별을 누르면 그 방이 '즐겨찾기' 묶음으로 맨 위에(더 최근 방보다 앞, '최근' 시각은 그대로), 방과 목록에 같이 적힘.
    // 방 메뉴의 토글로 풀면 다시 최근 순
    res.fav = await p.evaluate(async () => {
      const nap = (ms) => new Promise((r) => setTimeout(r, ms));
      const a = newRoom(normalizeChar(ORIGINALS[0]), 0, S.personas[0]);
      await nap(10);
      const b = newRoom(normalizeChar(ORIGINALS[1]), 0, S.personas[0]); // b가 더 최근
      location.hash = "chats";
      await nap(300);
      const top0 = $("[data-room]").dataset.room,
        at0 = S.rooms.find((x) => x.id === a.id).at;
      $(`[data-fav="${a.id}"]`).click();
      await nap(300);
      const out = {
        beforeTop: top0 === b.id,
        top: $("[data-room]").dataset.room === a.id,
        head: ($("#favHead") || {}).textContent || "",
        pressed: $(`[data-fav="${a.id}"]`).getAttribute("aria-pressed"),
        sameAt: S.rooms.find((x) => x.id === a.id).at === at0,
        saved: !!(await KV.get(roomKey(a.id))).fav,
        first: S.rooms[0].id === a.id
      };
      location.hash = "r-" + a.id;
      await nap(600);
      openRoomDrawer("main");
      await nap(150);
      out.drawer = $("#mFav").getAttribute("aria-pressed");
      $("#mFav").click();
      await nap(300);
      out.off = !room.fav && !S.rooms.find((x) => x.id === a.id).fav && $("#mFav").getAttribute("aria-pressed") === "false";
      closeOverlays();
      return out;
    });
    {
      const f = res.fav;
      if (
        !f.beforeTop ||
        !f.top ||
        !/즐겨찾기\s*1 \/ 20/.test(f.head) ||
        f.pressed !== "true" ||
        !f.sameAt ||
        !f.saved ||
        !f.first ||
        f.drawer !== "true" ||
        !f.off
      )
        errs.push("대화방 즐겨찾기가 다름: " + JSON.stringify(f));
    }
    // 길 찾기(2026-11-26 프레임 7차 C6~C9): 대화 목록·상세의 방 줄에 '시작 상황 · 페르소나', 상세 시작 줄의 '이어하기'(방이 여럿이면 고르는 창 — 무조건 최근 방으로 보내지 않음),
    // 시작 창은 이 작품의 최근 방의 시작 상황·페르소나를 골라 둠(그 시작 상황이 없어지면 골라 두지 않음), MY의 내 서재(찜·도감), 홈 검색은 입력칸을 새로 만들지 않음,
    // 장기기억 화면의 '지금 AI에게 보내는 것'은 프롬프트와 같은 함수로 센 수(한도를 넘은 고정 기억은 안 보낸다고)
    res.nav = await p.evaluate(async () => {
      // 시작 상황이 둘 이상이고 방이 가장 적은 작품 — 무료 요금제의 작품당 방 한도(plan().rooms)에 닿으면 시작 창 대신 PLUS 안내가 뜸
      const nap = (ms) => new Promise((r) => setTimeout(r, ms)),
        count = (c) => S.rooms.filter((x) => x.charId === c.id).length,
        w = normalizeChar(ORIGINALS.filter((c) => c.openings.length > 1 && audOK(c)).sort((a, b) => count(a) - count(b))[0]),
        last = newRoom(w, 1, S.personas[0]),
        wasLiked = liked(w.id);
      await saveRoom(last);
      const mine = S.rooms.filter((x) => x.charId === w.id),
        e = S.rooms.find((x) => x.id === last.id),
        out = { n: mine.length, entry: [e.opening === w.openings[1].title, e.openingId === w.openings[1].id, e.personaName === S.personas[0].name] };
      location.hash = "chats";
      await nap(300);
      out.listSetup = ($(`[data-room="${last.id}"] .r-setup`) || {}).textContent || "";
      location.hash = "c-" + w.id;
      await nap(300);
      out.cta = { resume: !!$("#resume"), startPri: $("#start").classList.contains("pri"), sideSetup: !!$(`.d-rooms [data-room="${last.id}"] .r-setup`) };
      $("#resume").click();
      await nap(200);
      out.pick = $$(".overlay [data-room]").length;
      $(`.overlay [data-room="${last.id}"]`).click();
      await nap(500);
      out.went = location.hash === "#r-" + last.id && !$(".overlay");
      location.hash = "c-" + w.id;
      await nap(300);
      $("#start").click();
      await nap(300);
      if ($("#aiOk")) {
        $("#aiOk").click();
        await nap(200);
      }
      out.start = {
        note: !!$("#stLast"),
        op: ($('.overlay input[name="op"]:checked') || {}).value,
        pp: ($('.overlay input[name="pp"]:checked') || {}).value === S.personas[0].id
      };
      closeOverlays();
      out.gone = lastSetup({ ...w, openings: w.openings.filter((o, i) => i !== 1) }) === null;
      if (!wasLiked) toggleLike(w.id);
      location.hash = "me";
      await nap(300);
      out.shelf = {
        codex: !!$('#meShelf [data-go="codex"]'),
        liked: $$("#meShelf [data-char]")
          .map((b) => b.dataset.char)
          .includes(w.id)
      };
      $(`#meShelf [data-char="${w.id}"]`).click();
      await nap(300);
      out.shelf.went = location.hash === "#c-" + w.id;
      if (!wasLiked) toggleLike(w.id); // 뒤의 찜 시험이 처음 상태에서 시작하게 되돌림
      location.hash = "home";
      await nap(300);
      const q = $("#q");
      q.value = w.title.slice(0, 2);
      q.oninput();
      out.search = { same: $("#q") === q, head: ($("#homeBody .grid") || {}).previousElementSibling?.textContent || "" };
      q.value = "";
      q.oninput();
      location.hash = "r-" + last.id;
      await nap(500);
      room.pins = Array.from({ length: plan().pins + 2 }, (_, i) => ({ id: "x" + i, text: "표 " + i, at: i }));
      openRoomDrawer("memory");
      await nap(200);
      out.mem = ($("#memSent") || {}).textContent || "";
      out.memWant = [
        pinsSent(room).length + "줄",
        "2줄은 한도를 넘어",
        "보낼 말 포함 메시지 " + recentOf(room, room.msgs.filter((m) => curText(m)).concat([{}])).length + "개"
      ];
      room.pins = [];
      closeOverlays();
      return out;
    });
    {
      const n = res.nav;
      if (
        n.n < 2 ||
        n.entry.some((x) => !x) ||
        !n.listSetup.includes(" · ") ||
        !n.cta.resume ||
        n.cta.startPri ||
        !n.cta.sideSetup ||
        n.pick !== n.n ||
        !n.went ||
        !n.start.note ||
        n.start.op !== "1" ||
        !n.start.pp ||
        !n.gone ||
        !n.shelf.codex ||
        !n.shelf.liked ||
        !n.shelf.went ||
        !n.search.same ||
        !/검색 결과/.test(n.search.head) ||
        n.memWant.some((s) => !n.mem.includes(s))
      )
        errs.push("길 찾기(방 구별·이어하기·지난번 설정·내 서재·검색·보내는 기억)가 다름: " + JSON.stringify(n));
    }
    // 방 안의 표시 설정 — 방 메뉴 → 표시 설정에서 글자 크기를 바꾸면 뒤의 대화 글에 바로 반영되고(CSS 변수) 저장됨. MY의 채팅 설정과 같은 조각이라 같은 값이 보임.
    // 'Enter로 보내기'를 끄면 입력 칸의 키 안내가 바뀜. 방 안에서는 보기 말풍선이 없고(뒤의 대화가 보기) MY에는 있음
    res.display = await p.evaluate(async () => {
      const nap = (ms) => new Promise((r) => setTimeout(r, ms)),
        rid = room.id,
        fs0 = S.settings.fs,
        fire = (el, ev) => el[ev]({ target: el });
      openRoomDrawer("main");
      await nap(150);
      const item = $('[data-v="display"]');
      if (!item) return { item: false };
      item.click();
      await nap(150);
      const cfs = $("#cfs");
      cfs.value = "19";
      fire(cfs, "oninput");
      const out = {
        item: true,
        title: $(".drawer h2").textContent,
        pv: !!$(".drawer .chat-pv"),
        fs: S.settings.fs,
        css: getComputedStyle(document.documentElement).getPropertyValue("--chat-fs").trim(),
        label: $("#cfsV").textContent,
        saved: JSON.parse(localStorage.getItem("hv1_settings")).fs,
        key0: $("#inp").title
      };
      $("#cEnter").checked = false;
      fire($("#cEnter"), "onchange");
      out.key1 = $("#inp").title;
      $("#cEnter").checked = true;
      fire($("#cEnter"), "onchange");
      closeOverlays();
      location.hash = "me";
      await nap(500);
      Object.assign(out, { me: $("#cfs").value, mePv: !!$(".chat-pv") });
      $("#cfs").value = String(fs0); // 다음 확인을 위해 되돌리고 방으로 돌아감
      fire($("#cfs"), "oninput");
      location.hash = "r-" + rid;
      await nap(600);
      return out;
    });
    {
      const d = res.display;
      if (
        !d.item ||
        d.title !== "표시 설정" ||
        d.pv ||
        d.fs !== 19 ||
        d.css !== "19px" ||
        d.label !== "19px" ||
        d.saved !== 19 ||
        !/^Enter 전송/.test(d.key0) ||
        !/^Ctrl\+Enter 전송/.test(d.key1) ||
        d.me !== "19" ||
        !d.mePv
      )
        errs.push("방 안의 표시 설정이 다름: " + JSON.stringify(d));
    }
    // 유저 설정 상한 — 페르소나 상세·유저노트 입력 칸의 maxlength와 "n / 한도" 카운터가 상수(LIMITS)를 따름, 장기기억 기본 한도도
    res.limits = await p.evaluate(() => {
      personaSheet(S.personas[0]);
      const pd = $("#pd").maxLength,
        pc = $("#pdCnt").textContent;
      closeOverlays();
      openRoomDrawer("note");
      const nt = $("#noteTa").maxLength,
        nc = $("#nCnt").textContent;
      closeOverlays();
      return { pd, pc, nt, nc, mem: PLAN.free.memoMax, want: LIMITS, end: [" / " + num(LIMITS.personaDesc), " / " + num(LIMITS.userNote)] };
    });
    {
      const l = res.limits;
      if (
        l.pd !== l.want.personaDesc ||
        l.nt !== l.want.userNote ||
        l.mem !== l.want.memory ||
        l.pc.slice(-l.end[0].length) !== l.end[0] ||
        l.nc.slice(-l.end[1].length) !== l.end[1]
      )
        errs.push("설정 상한이 상수와 다름: " + JSON.stringify(l));
    }
    // 내 서재 — 상세의 찜 버튼 → 홈의 '찜한 작품' 줄, 상세를 열면 왼쪽 메뉴의 '최근 본 작품'(홈에는 줄이 없음 — 좁은 화면에서는 레일이 숨지만 DOM에는 있음),
    // 대화 탭 맨 아래에도 같은 목록 — 레일이 없는 좁은 화면에서만 보임. 같은 홈 줄의 다른 작품(줄이 있는 작품만), 관심있는 대화로 거름, 찜을 풀면 줄이 사라짐
    res.shelf = await p.evaluate(async () => {
      const nap = (ms) => new Promise((r) => setTimeout(r, ms)),
        was = { hash: location.hash, shelf: JSON.stringify(S.shelf), aud: S.settings.audience };
      const c = ORIGINALS.find((x) => x.row),
        solo = ORIGINALS.find((x) => !x.row),
        ids = (sel) => {
          const h = document.querySelector(sel);
          return h ? [...h.nextElementSibling.querySelectorAll("[data-char]")].map((b) => b.dataset.char) : null;
        };
      const railIds = () => [...document.querySelectorAll("#railViewed [data-char]")].map((b) => b.dataset.char);
      S.shelf = mergeShelf();
      S.settings.audience = "all";
      S.cat = "전체";
      S.kind = "all";
      S.q = "";
      location.hash = "c-" + solo.id;
      await nap(300);
      const soloNear = !!document.querySelector("#rowNear");
      location.hash = "c-" + c.id;
      await nap(300);
      const near = ids("#rowNear"),
        wantNear = ORIGINALS.filter((x) => x.row === c.row && x.id !== c.id).map((x) => x.id),
        off = $("#like").getAttribute("aria-pressed");
      $("#like").click();
      const on = $("#like").getAttribute("aria-pressed"),
        label = $("#like").textContent,
        saved = !!(KV.getLocal("shelf") || { likes: {} }).likes[c.id];
      location.hash = "chats";
      await nap(300);
      const tab = document.querySelector(".chats-viewed"),
        chats = {
          ids: [...document.querySelectorAll(".chats-viewed [data-char]")].map((b) => b.dataset.char),
          shown: !!tab && getComputedStyle(tab).display !== "none",
          rail: getComputedStyle(document.querySelector("#rail")).display !== "none"
        };
      location.hash = "home";
      await nap(300);
      const likes = ids("#rowLikes"),
        recent = railIds(),
        homeRecent = !!document.querySelector("#rowRecent");
      S.settings.audience = audOf(c) === "f" ? "m" : "f";
      emit("settings"); // 설정을 저장하면 나는 알림 — 왼쪽 메뉴가 이것을 받아 다시 거름(시험은 저장하지 않으려고 알림만)
      viewHome();
      const other = [ids("#rowLikes"), railIds().includes(c.id)];
      S.settings.audience = "all";
      emit("settings");
      location.hash = "c-" + c.id;
      await nap(300);
      const still = $("#like").getAttribute("aria-pressed");
      $("#like").click();
      location.hash = "home";
      await nap(300);
      const gone = ids("#rowLikes");
      S.settings.audience = was.aud;
      location.hash = was.hash;
      await nap(400);
      S.shelf = JSON.parse(was.shelf);
      KV.setLocal("shelf", S.shelf); // 돌아간 화면이 상세면 최근 본에 적히므로 그 뒤에 되돌림
      return { soloNear, near, wantNear, off, on, label, saved, likes, recent, homeRecent, chats, want: [c.id, solo.id], other, still, gone };
    });
    {
      const s = res.shelf;
      if (
        s.soloNear ||
        JSON.stringify(s.near) !== JSON.stringify(s.wantNear) ||
        !s.wantNear.length ||
        s.off !== "false" ||
        s.on !== "true" ||
        s.label !== "찜한 작품" ||
        !s.saved ||
        JSON.stringify(s.likes) !== JSON.stringify([s.want[0]]) ||
        JSON.stringify(s.recent) !== JSON.stringify(s.want) ||
        JSON.stringify(s.chats.ids) !== JSON.stringify(s.want) ||
        s.chats.shown === s.chats.rail || // 레일이 보이면 대화 탭의 목록은 숨고, 레일이 없으면 보임
        s.homeRecent ||
        s.other[0] !== null ||
        s.other[1] ||
        s.still !== "true" ||
        s.gone !== null
      )
        errs.push("내 서재(찜·최근 본·같은 줄)가 다름: " + JSON.stringify(s));
    }
    // 홈 구성 — 추천작 → 둘러보기 → 구역(기획 줄·장르별 줄) 순서, 형식 고르기(전체·에피소드·자유형)는 구역만 거르고 추천작은 그대로,
    // 맞는 작품이 없으면 조건을 푸는 버튼, 장르를 고르면 그 장르의 격자 하나, 최근 대화·최근 본 작품 줄은 홈에 없음
    res.home = await p.evaluate(async () => {
      const nap = (ms) => new Promise((r) => setTimeout(r, ms)),
        was = { hash: location.hash, aud: S.settings.audience };
      const secs = () =>
          $$("#view h2.sec")
            .map((h) => h.firstChild.textContent.trim())
            .filter((t) => t !== "찜한 작품"),
        cards = () => Array.from(new Set($$("#view .row-scroll .card, #view .grid .card").map((b) => b.dataset.char))).sort(),
        ids = (f) =>
          ORIGINALS.filter(f)
            .map((c) => c.id)
            .sort(),
        has = (f) => ORIGINALS.some(f);
      const reset = () => {
        S.settings.audience = "all";
        S.cat = "전체";
        S.kind = "all";
        S.q = "";
        viewHome();
      };
      location.hash = "home";
      await nap(300);
      reset();
      const order = secs(),
        all = cards(),
        hero = $$(".hero-card").length,
        noRecent = !$("#view .cont") && !$("#rowRecent");
      $("#view [data-kind=ep]").click();
      const ep = cards(),
        epHero = $$(".hero-card").length,
        epOn = $$("#view [data-kind].on").map((b) => b.dataset.kind + ":" + b.getAttribute("aria-pressed"));
      $("#view [data-kind=free]").click();
      const free = cards();
      // 에피소드형이 하나도 없는 쪽(여성향·남성향)이 있으면 그쪽에서 '에피소드'를 골라 빈 화면을 봄
      const lone = ["f", "m"].find((a) => !has((c) => c.episode && audOf(c) === a));
      let none = null;
      if (lone) {
        S.settings.audience = lone;
        S.kind = "ep";
        viewHome();
        none = { empty: !!$("#view .empty"), btn: !!$("#view .empty [data-kind=all]") };
        if (none.btn) $("#view .empty [data-kind=all]").click();
        none.after = S.kind;
        none.back = cards().length;
      }
      reset();
      const cat = CATS.find((k) => has((c) => c.cat === k));
      $$("#view [data-cat]")
        .find((b) => b.dataset.cat === cat)
        .click();
      const one = { secs: secs(), cards: cards(), grid: $$("#view .grid").length, rows: $$("#view .row-scroll").length };
      reset();
      S.settings.audience = was.aud;
      location.hash = was.hash;
      await nap(300);
      return {
        order,
        all,
        hero,
        noRecent,
        ep,
        epHero,
        epOn,
        free,
        none,
        one,
        want: {
          order: ["추천작", "둘러보기"]
            .concat(HOME_ROWS.filter((w) => has((c) => c.row === w.key)).map((w) => w.title))
            .concat(CATS.filter((k) => has((c) => c.cat === k))),
          all: ids(() => true),
          ep: ids((c) => c.episode),
          free: ids((c) => !c.episode),
          one: { secs: ["추천작", "둘러보기", cat], cards: ids((c) => c.cat === cat), grid: 1, rows: 0 }
        }
      };
    });
    {
      const h = res.home,
        j = JSON.stringify;
      if (j(h.order) !== j(h.want.order) || !h.noRecent) errs.push("홈 구역 순서가 다름(또는 최근 줄이 남음): " + j([h.order, h.noRecent]));
      if (h.hero !== 4 || h.epHero !== 4) errs.push("추천작이 4개가 아니거나 형식 고르기에 따라 바뀜: " + j([h.hero, h.epHero]));
      if (j(h.all) !== j(h.want.all) || j(h.ep) !== j(h.want.ep) || j(h.free) !== j(h.want.free) || j(h.epOn) !== j(["ep:true"]))
        errs.push("형식 고르기(전체·에피소드·자유형)가 다름: " + j([h.all.length, h.ep, h.free.length, h.epOn]));
      if (h.none && (!h.none.empty || !h.none.btn || h.none.after !== "all" || !h.none.back)) errs.push("맞는 작품이 없을 때의 안내가 다름: " + j(h.none));
      if (j(h.one) !== j(h.want.one)) errs.push("장르를 고른 화면이 다름: " + j(h.one));
    }
    // 작품 메타 한 줄 — 가짜 데이터로 틀만: 제작자 기본값, 공개일·독점 배지
    res.meta = await p.evaluate(() => ({
      def: metaHTML({}) === esc(DEFAULT_CREATOR),
      full: metaHTML({ creator: "시험 <제작자>", exclusive: true, publishedAt: "2026-11-09" })
    }));
    if (
      !res.meta.def ||
      res.meta.full.indexOf("시험 &lt;제작자&gt; · ") !== 0 ||
      !res.meta.full.includes("2026.11.09 공개") ||
      !res.meta.full.includes('<span class="pill gold">독점</span>')
    )
      errs.push("작품 메타 줄이 다름: " + JSON.stringify(res.meta));
    // 모델 배지와 새 방의 시작 모델 — '추천'은 늘 앱 기본 추천 모델에, '권장'은 작품이 recommend를 적었을 때만 그 모델에. 새 방은 권장(없으면 기본 추천) 모델로 시작
    res.rec = await p.evaluate(() => {
      const live = getChar(room.char.id),
        keep = live.recommend,
        at = () => {
          openModelSheet();
          const b = document.querySelector(".model-card .pill.ok"),
            rec = b ? b.closest("[data-m]").dataset.m : "";
          const pick = [...document.querySelectorAll(".model-card")]
            .filter((x) => x.querySelector(".k").textContent === MODELS[RECOMMEND_DEFAULT].badge)
            .map((x) => x.dataset.m)
            .join();
          closeOverlays();
          return { rec, pick, start: defaultSet(live).model };
        };
      delete live.recommend;
      const def = at();
      live.recommend = "master";
      const set = at();
      if (keep === undefined) delete live.recommend;
      else live.recommend = keep;
      return { def, set, want: RECOMMEND_DEFAULT };
    });
    if (
      res.rec.def.rec !== "" ||
      res.rec.def.pick !== res.rec.want ||
      res.rec.def.start !== res.rec.want ||
      res.rec.set.rec !== "master" ||
      res.rec.set.pick !== res.rec.want ||
      res.rec.set.start !== "master"
    )
      errs.push("권장 모델 배지가 다름: " + JSON.stringify(res.rec));
    // 세계관 수첩 — 키워드북이 있는 작품의 드로어에만 메뉴가 뜨고, 응답에 📖로 저장된 항목만 열리고 나머지는 잠긴 카드(이름·설명이 화면에 없음)
    res.lorebook = await p.evaluate(() => {
      const w = ORIGINALS.find((c) => (c.lore || []).length),
        r = newRoom(normalizeChar(getChar(w.id)), 0, S.personas[0]);
      setRoom(r);
      r.msgs.push({ id: "lb1", role: "ai", idx: 0, alts: [{ text: "시험", lore: [w.lore[0].keys[0]] }] });
      openRoomDrawer("main");
      const menu = ($('[data-v="lore"]') || {}).textContent || "";
      closeOverlays();
      openRoomDrawer("lore");
      const txt = $(".drawer").textContent;
      return {
        id: w.id,
        n: w.lore.length,
        menu,
        cards: $$(".drawer .wcard").length,
        locked: $$(".drawer .wcard.locked").length,
        open: txt.includes(w.lore[0].text),
        leak: w.lore
          .slice(1)
          .filter((e) => txt.includes(e.text))
          .map((e) => e.keys[0])
      };
    });
    await wait(250);
    if (out) await p.screenshot({ path: `${out}/${tag}_views_lorebook.png` });
    res.lorebook.plain = await p.evaluate(() => {
      // 키워드북 없는 작품은 가짜 사본으로 — 지금 오리지널은 모두 키워드북이 있음(없는 id라 getChar가 이 사본을 씀)
      closeOverlays();
      setRoom(newRoom({ ...normalizeChar(getChar(ORIGINALS[0].id)), id: "zz-plain", lore: [] }, 0, S.personas[0]));
      openRoomDrawer("main");
      const has = !!$('[data-v="lore"]');
      closeOverlays();
      return has;
    });
    {
      const l = res.lorebook;
      if (!l.menu.includes(`1 / ${l.n}`) || l.cards !== l.n || l.locked !== l.n - 1 || !l.open || l.leak.length || l.plain)
        errs.push("세계관 수첩이 다름: " + JSON.stringify(l));
    }
    if (out) {
      await p.evaluate(() => openRoomDrawer("main"));
      await wait(300);
      await p.screenshot({ path: `${out}/${tag}_views_drawer.png` });
      await p.evaluate(() => closeOverlays());
    }
    // 방 메뉴의 묶음 카드: 예전의 모든 항목이 한 번 눌러 닿는 자리에 그대로 있음(묶고 순서만 바꿈)
    res.menu = await p.evaluate(() => {
      openRoomDrawer("main");
      // 있는지만이 아니라 눈에 보이고 누르면 일하는지까지(크기가 있고 onclick이 붙어 있음). 작품에 따라 있는 항목(플레이 가이드·세계관 수첩·장소)도 작품 데이터와 견줌
      const live = liveWork(room.char),
        has = (s) => {
          const el = $(".drawer " + s);
          return !!el && el.getBoundingClientRect().height > 0 && typeof el.onclick === "function";
        },
        byWork = [live.guide ? "#mGuide" : "", (live.lore || []).length ? '[data-v="lore"]' : "", (live.places || []).length ? '[data-v="places"]' : ""].filter(
          Boolean
        ),
        want = byWork
          .concat(['[data-v="persona"]', "#mFav", '[data-v="status"]', '[data-v="bookmarks"]', "#mFind", "#compo", '[data-v="gallery"]', "#mModel"])
          .concat(['[data-v="output"]', '[data-v="display"]', '[data-v="note"]', '[data-v="memory"]', "#topup", "#qCopy", "#qExport", "#qNew", "#delRoom"]);
      const out = {
        cards: $$(".drawer .menu-card").length,
        missing: want.filter((s) => !has(s)),
        titles: $$(".drawer .menu-card > .lbl, .drawer .menu-card .sheet-head .lbl").map((x) => x.textContent)
      };
      closeOverlays();
      return out;
    });
    if (res.menu.cards !== 4 || res.menu.missing.length || res.menu.titles.join("|") !== "이 대화|이 작품|대화 설정|내 재화")
      errs.push("방 메뉴의 묶음 카드가 다름: " + JSON.stringify(res.menu));
    // 화면 테마(맨 끝 — 페이지를 다시 읽으므로): 방 메뉴의 표시 설정에서 고르면 html에 바로 걸리고 이 기기에만 저장됨(계정에 올리는 설정에서는 빠짐).
    // 다시 열면 화면이 그려지기 전에(body가 생기기 전 — 머리의 스크립트) 걸려 깜빡이지 않음. '기기 설정'을 고르면 칸을 지우고 속성을 뗌
    res.theme = await p.evaluate(() => {
      openRoomDrawer("display");
      const btn = (v) => $(`.drawer [data-set="theme"] [data-v="${v}"]`),
        html = document.documentElement,
        stored = () => JSON.parse(localStorage.getItem("hv1_settings")).theme;
      const first = { seg: !!btn("dark"), attr: html.getAttribute("data-theme"), on: ($('.drawer [data-set="theme"] .on') || {}).textContent };
      btn("dark").click();
      const dark = {
        attr: html.getAttribute("data-theme"),
        stored: stored(),
        cloud: "theme" in cloudSettings(),
        bg: getComputedStyle(html).getPropertyValue("--bg").trim()
      };
      closeOverlays();
      return { first, dark };
    });
    await p.addInitScript(() => {
      // 이 스크립트는 문서가 만들어지기 전에 돌아서 html 요소가 아직 없음 — 문서 전체를 지켜보다가 data-theme가 처음 걸리는 순간 body가 있었는지를 적음
      new MutationObserver(() => {
        const h = document.documentElement;
        if (h && window.__themeAt === undefined && h.getAttribute("data-theme")) window.__themeAt = document.body ? "body" : "head";
      }).observe(document, { attributes: true, childList: true, subtree: true });
    });
    await p.reload({ waitUntil: "load" });
    await wait(1200);
    res.theme.reload = await p.evaluate(() => {
      const html = document.documentElement,
        out = { at: window.__themeAt, attr: html.getAttribute("data-theme") };
      location.hash = "me";
      return out;
    });
    await wait(500);
    res.theme.auto = await p.evaluate(() => {
      const html = document.documentElement,
        on = ($('[data-set="theme"] .on') || {}).textContent;
      $('[data-set="theme"] [data-v=""]').click();
      return { on, attr: html.getAttribute("data-theme"), stored: "theme" in JSON.parse(localStorage.getItem("hv1_settings")) };
    });
    // 밝게: 기기가 어두운 설정이어도 '밝게'를 고르면 밝은 색(기기 설정일 때는 어두운 색)
    await p.emulateMedia({ colorScheme: "dark" });
    res.theme.light = await p.evaluate(() => {
      const html = document.documentElement,
        bg = () => getComputedStyle(html).getPropertyValue("--bg").trim(),
        auto = bg();
      $('[data-set="theme"] [data-v="light"]').click();
      const out = { auto, attr: html.getAttribute("data-theme"), bg: bg() };
      $('[data-set="theme"] [data-v=""]').click();
      return out;
    });
    await p.emulateMedia({ colorScheme: null });
    if (res.theme.light.auto !== "#0f0d15" || res.theme.light.attr !== "light" || res.theme.light.bg !== "#f6f4f9")
      errs.push("어두운 기기에서 '밝게'를 고른 뒤가 다름: " + JSON.stringify(res.theme.light));
    {
      const t = res.theme;
      if (!t.first.seg || t.first.attr !== null || t.first.on !== "기기 설정") errs.push("화면 테마의 처음 상태가 다름: " + JSON.stringify(t.first));
      if (t.dark.attr !== "dark" || t.dark.stored !== "dark" || t.dark.cloud || t.dark.bg !== "#0f0d15")
        errs.push("어둡게를 고른 뒤가 다름: " + JSON.stringify(t.dark));
      if (t.reload.at !== "head" || t.reload.attr !== "dark") errs.push("다시 열 때 테마가 화면이 그려지기 전에 걸리지 않음: " + JSON.stringify(t.reload));
      if (t.auto.on !== "어둡게" || t.auto.attr !== null || t.auto.stored) errs.push("기기 설정으로 되돌린 뒤가 다름: " + JSON.stringify(t.auto));
    }
  } catch (e) {
    res.fail = String(e).slice(0, 400);
  }
  res.errs = [...new Set(errs)];
  console.log(JSON.stringify(res));
  await b.close();
}
