// 채팅 흐름: 입력창 ! 명령어 목록, 자동 스크롤 끔/켬, 고정 기억, 즉답 명령어, 좋아요·분기, 추천 답변 수동, 출력 설정 카드, 설정 페이지(이미지 기본 수위 칸 없음)
import { webkit, chromium, devices } from "playwright";
import { noSupabase } from "./_offline.mjs";
const url = process.argv[2],
  out = process.argv[3];
const targets = [
  ["iPhone 13", webkit],
  ["iPhone SE", webkit],
  ["Galaxy S9+", chromium]
];
for (const [dev, engine] of targets) {
  const b = await engine.launch();
  const ctx = await b.newContext({ ...devices[dev] });
  await noSupabase(ctx);
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  p.on("console", (m) => {
    if (m.type() === "error") errs.push("console: " + m.text().slice(0, 140));
  });
  const res = { dev };
  try {
    await p.goto(url, { waitUntil: "load" });
    await p.waitForTimeout(1200);
    await p.evaluate(() => {
      const r = newRoom(normalizeChar(ORIGINALS.find((c) => c.id === "godseats")), 0, S.personas[0]);
      location.hash = "r-" + r.id;
    });
    await p.waitForTimeout(900);
    // AI 표시(docs/legal/ui-copy.md §6): 머리의 배지는 늘 보이고, 첫 대화 전 안내를 못 본 사람에게는 머리 아래 띠('알겠어요'를 누르면 적어 두고 다시 안 뜸),
    // AI 말풍선의 접근성 이름, 내보낸 글의 첫 줄
    res.ai = await p.evaluate(async () => {
      const badge = () => ($(".chat-head .ai-badge") || {}).textContent,
        first = {
          badge: badge(),
          note: !!$("#aiNote"),
          label: $("#logInner .msg[role=group]").getAttribute("aria-label"),
          line: exportText(room).split("\n")[0]
        };
      $("#aiNoteOk").click();
      const gone = !$("#aiNote"),
        saved = JSON.parse(localStorage.getItem("hv1_settings")).aiSeen > 0;
      await viewChat(room.id);
      return { ...first, gone, saved, again: !!$("#aiNote"), badge2: badge() };
    });
    if (
      res.ai.badge !== "AI 캐릭터" ||
      res.ai.badge2 !== "AI 캐릭터" ||
      !res.ai.note ||
      !res.ai.gone ||
      !res.ai.saved ||
      res.ai.again ||
      res.ai.label !== "AI 응답: 내레이터" ||
      res.ai.line !== "※ 이 파일의 캐릭터 대사와 서술은 생성형 AI(HEART SYNC)가 만든 것입니다."
    )
      errs.push("AI 표시가 다름: " + JSON.stringify(res.ai));
    // ! 명령어 목록: !만 치면 앱 + 작품 명령어가 모두 뜨고, ↓·Enter로 고르면 입력창에 채워진 뒤 닫힘(보내지는 않음)
    res.cmd = await p.evaluate(() => {
      const inp = $("#inp"),
        key = (k) => inp.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true })),
        all = allCommands(getChar(room.char.id));
      inp.value = "!";
      inp.oninput();
      const n = $$("#cmdPanel [data-i]").length,
        open = !$("#cmdPanel").hidden;
      key("ArrowDown");
      key("Enter");
      const r = { n, want: all.length, open, filled: inp.value, expect: "!" + all[1].cmd, closed: $("#cmdPanel").hidden, msgs: room.msgs.length };
      inp.value = "";
      inp.oninput();
      return r;
    });
    if (!res.cmd.open || res.cmd.n !== res.cmd.want || res.cmd.n < 5 || res.cmd.filled !== res.cmd.expect || !res.cmd.closed || res.cmd.msgs !== 1)
      errs.push("! 명령어 목록이 다름: " + JSON.stringify(res.cmd));
    // 가짜 llm: 1.6초 동안 조금씩 흘려보냄
    await p.evaluate(() => {
      const para = (i) =>
        `*장면 ${i}: 바람이 부서진 간판을 흔들었다. 먼지가 내려앉았다.*\n\n한서윤: "대사 ${i}번이에요. 조금 길게 말해 볼게요, 화면이 충분히 길어지도록."`;
      window.llm = async (input, { onText, json }) => {
        if (json && /제안하라/.test(input[0].content)) return { suggestions: ["가", "나", "다"] }; // 눌러서 받는 추천(따로 부름)
        window.__lastInput = input;
        const body = Array.from({ length: 14 }, (_, i) => para(i + 1)).join("\n\n");
        const full = body + "\n===STATE===\n" + JSON.stringify({ status: {}, suggestions: ["하나", "둘", "셋"] });
        for (let n = 200; n < full.length; n += 200) {
          onText({ text: full.slice(0, n) });
          await new Promise((r) => setTimeout(r, 120));
        }
        return full;
      };
    });
    const turn = async (text) =>
      p.evaluate(async (text) => {
        room.msgs.push({ id: uid("m"), role: "user", text });
        const log = $("#log");
        log.scrollTop = log.scrollHeight;
        const samp = [];
        const iv = setInterval(() => {
          const l = $("#log");
          samp.push([Math.round(l.scrollTop), l.scrollHeight - l.clientHeight]);
        }, 100);
        await generate(null, quote(room.set));
        clearInterval(iv);
        const l = $("#log");
        return {
          tops: [...new Set(samp.map((s) => s[0]))].length,
          first: samp[0],
          last: [Math.round(l.scrollTop), l.scrollHeight - l.clientHeight],
          sugHidden: $("#sugPanel").hidden,
          jumpHidden: $("#jumpBtn").hidden,
          reminder: /\[이번 응답\]/.test(window.__lastInput[window.__lastInput.length - 1].content)
        };
      }, text);
    res.off = await turn("첫 번째 입력");
    // 고정 기억: 첫 응답(msgs[2])의 '📌 고정' → 시트에서 고쳐 저장 → 방에 한 줄(그 메시지 id와 함께) → 드로어 장기기억의 '고정 기억' 탭에 보임
    res.pin = await p.evaluate(async () => {
      const nap = (ms) => new Promise((r) => setTimeout(r, ms));
      document.querySelector('[data-act="pin"][data-i="2"]').click();
      await nap(150);
      const ta = document.querySelector("#pinTa"),
        seeded = ta.value.length > 0 && ta.maxLength === LIMITS.pin;
      ta.value = "첫눈 오는 날 다시 만나기로 약속했다";
      ta.oninput();
      document.querySelector("#pinSave").click();
      await nap(150);
      openRoomDrawer("memory");
      document.querySelector('[data-tab="pin"]').click();
      await nap(100);
      const rows = $$(".pin-row").length;
      closeOverlays();
      return { seeded, n: (room.pins || []).length, msg: room.pins[0] && room.pins[0].msgId === room.msgs[2].id, rows, cap: PLAN.free.pins };
    });
    if (!res.pin.seeded || res.pin.n !== 1 || !res.pin.msg || res.pin.rows !== 1) errs.push("고정 기억이 다름: " + JSON.stringify(res.pin));
    await p.evaluate(() => {
      room.set.autoScroll = true;
      saveRoom(room);
    });
    res.on = await turn("두 번째 입력");
    // 고정한 줄은 다음 턴의 프롬프트(변동부의 [고정 기억])에 그대로 들어감
    res.pinSent = await p.evaluate(() => {
      const s = window.__lastInput[0].content;
      return s.includes("[고정 기억") && s.includes("첫눈 오는 날 다시 만나기로 약속했다") && s.indexOf("[고정 기억") > window.__lastInput[0].cut;
    });
    if (!res.pinSent) errs.push("고정 기억이 프롬프트에 없음");
    // 즉답 명령어(작품 commands의 text — 가짜 데이터로 틀만): !이름을 보내면 AI를 부르지 않고 유저 말풍선 + 정해진 글이 남음 — 하트·턴은 그대로, 다시 쓰기 없음, 다음 턴 기록에는 들어감
    res.canned = await p.evaluate(async () => {
      const nap = (ms) => new Promise((r) => setTimeout(r, ms)),
        live = getChar(room.char.id),
        was = live.commands,
        hearts = S.wallet.hearts,
        used = S.wallet.freeUsed,
        n = room.msgs.length,
        turn = room.turn,
        real = window.llm;
      let calls = 0;
      window.llm = async (a, b) => {
        calls++;
        return real(a, b);
      };
      live.commands = (was || []).concat({ cmd: "안내시험", title: "안내", text: "[안내] 정해진 글이에요." });
      $("#inp").value = "!안내시험";
      $("#form").requestSubmit();
      await nap(300);
      const last = room.msgs[room.msgs.length - 1],
        prev = room.msgs[room.msgs.length - 2],
        sent = buildInput(room, room.msgs.length, room.status);
      const r = {
        added: room.msgs.length - n,
        canned: !!last.canned && !!prev.canned,
        text: last.alts[0].text,
        calls,
        wallet: S.wallet.hearts === hearts && S.wallet.freeUsed === used,
        turn: room.turn === turn,
        regen: !!document.querySelector('[data-act="regen"]'),
        cleared: $("#inp").value === "",
        drawn: $$("#logInner .msg").length === room.msgs.length,
        inHistory:
          sent.some((m) => m.role === "assistant" && m.content.includes("[안내] 정해진 글이에요.")) &&
          sent.some((m) => m.role === "user" && m.content === "!안내시험")
      };
      window.llm = real;
      live.commands = was;
      return r;
    });
    {
      const c = res.canned;
      if (
        c.added !== 2 ||
        !c.canned ||
        c.text !== "[안내] 정해진 글이에요." ||
        c.calls !== 0 ||
        !c.wallet ||
        !c.turn ||
        c.regen ||
        !c.cleared ||
        !c.drawn ||
        !c.inHistory
      )
        errs.push("즉답 명령어가 다름: " + JSON.stringify(c));
    }
    // 좋아요 토글과 분기: 첫 응답(msgs[2])의 '분기' → 확인 → 방 수 +1·새 방으로 이동·메시지 수는 그 메시지까지·원래 방은 그대로·좋아요도 따라옴.
    // 장기기억은 분기한 턴(1턴)보다 뒤에 시작하는 구간([2-2턴])을 빼고 복사
    res.fork = await p.evaluate(async () => {
      const nap = (ms) => new Promise((r) => setTimeout(r, ms)),
        before = S.rooms.length,
        src = room.id,
        n0 = room.msgs.length,
        i = 2; // [오프닝, 유저, AI, 유저, AI, 즉답 유저, 즉답 글] — 즉답은 턴으로 세지 않음
      const head = memoryMark(1, 1) + " 앞\n첫 요약";
      room.memory = head + "\n\n" + memoryMark(2, 2) + " 뒤\n둘째 요약";
      saveRoom(room);
      document.querySelector(`[data-act="up"][data-i="${i}"]`).click();
      const fb = room.msgs[i].alts[room.msgs[i].idx].fb;
      document.querySelector(`[data-act="fork"][data-i="${i}"]`).click();
      await nap(150);
      document.querySelector(".overlay #ok").click();
      await nap(600);
      const kept = await KV.get(roomKey(src));
      return {
        rooms: S.rooms.length - before,
        moved: room.id !== src && location.hash === "#r-" + room.id,
        msgs: room.msgs.length,
        want: i + 1,
        from: !!room.forkedFrom && room.forkedFrom.roomId === src,
        fb,
        fbCopied: room.msgs[i].alts[room.msgs[i].idx].fb,
        srcMsgs: kept.msgs.length,
        n0,
        mark: / \(분기\)$/.test(room.opening),
        base: baseOpening(room) === kept.opening,
        index: S.rooms.find((x) => x.id === room.id).fork === true,
        drawn: $$("#logInner .msg").length,
        mem: room.memory === head,
        turn: room.turn,
        srcTurn: kept.turn,
        srcMem: kept.memory.includes(memoryMark(2, 2)),
        pins: (room.pins || []).length
      };
    });
    {
      const f = res.fork;
      if (
        f.rooms !== 1 ||
        !f.moved ||
        f.msgs !== f.want ||
        !f.from ||
        f.fb !== 1 ||
        f.fbCopied !== 1 ||
        f.srcMsgs !== f.n0 ||
        !f.mark ||
        !f.base ||
        !f.index ||
        f.drawn !== f.want ||
        !f.mem ||
        f.turn !== 1 ||
        f.srcTurn !== 2 ||
        !f.srcMem ||
        f.pins !== 1
      )
        errs.push("분기가 다름: " + JSON.stringify(f));
    }
    // 답변 추천(값이 듦): 자동 받기를 켜지 않은 방은 답에 딸려 온 추천을 버림 → 버튼에 값이 보이고, 누르면 값을 내고 받아 펼침 → 받은 것을 다시 열면 값 없이
    // → '새로 추천'이 실패하면 되돌림. 자동 받기를 켜면 보내기 버튼의 값에 더해지고 버튼에 표시가 붙음
    res.sug = await p.evaluate(async () => {
      const nap = (ms) => new Promise((r) => setTimeout(r, ms)),
        alt = () => lastAi(room).alts[lastAi(room).idx];
      S.wallet.hearts = 30;
      saveWallet();
      updateComposer();
      const h0 = S.wallet.hearts,
        out = { cost: SUGGEST_COST, dropped: (alt().suggestions || []).length === 0, label: $("#sugBtn").textContent };
      $("#sugBtn").click();
      await nap(300);
      Object.assign(out, { got: $$("#sugPanel [data-s]").length, paid: h0 - S.wallet.hearts, redo: ($("#sugRe") || {}).textContent || "" });
      hideSug();
      out.label2 = $("#sugBtn").textContent; // 받은 뒤에는 값이 안 보임(다시 열어도 값 없음)
      $("#sugBtn").click();
      await nap(100);
      out.again = h0 - S.wallet.hearts;
      const keep = window.llm;
      window.llm = async () => {
        throw { code: "server" };
      };
      $("#sugRe").click();
      await nap(300);
      Object.assign(out, { afterFail: h0 - S.wallet.hearts, failed: /만들지 못했어요/.test($("#sugPanel").textContent) });
      window.llm = keep;
      hideSug();
      out.send0 = $("#sendBtn").textContent;
      setAutoSug(room, true);
      Object.assign(out, {
        send1: $("#sendBtn").textContent,
        auto: $("#sugBtn").classList.contains("auto"),
        want: qShort(quote(room.set)),
        sug: quote(room.set).sug
      });
      return out;
    });
    {
      const s = res.sug,
        c = s.cost;
      if (!s.dropped || !s.label.includes("♥" + c) || s.got !== 3 || s.paid !== c || !s.redo.includes("♥" + c) || s.label2.includes("♥") || s.again !== c)
        errs.push("눌러서 받는 추천이 다름: " + JSON.stringify(s));
      if (s.afterFail !== c || !s.failed) errs.push("추천 실패 환불이 다름: " + JSON.stringify(s));
      if (s.send0 === s.send1 || !s.send1.includes(s.want) || !s.auto || s.sug !== c) errs.push("자동 받기의 값 표시가 다름: " + JSON.stringify(s));
    }
    // 추천의 가장자리 경우(Codex 검토에서 나온 것) — 보이지 않던 값이 나가거나 새 대화를 덮지 않게:
    // ① 빈칸뿐인 추천은 받은 것이 아님(되돌림) ② 기다리는 사이 방을 나갔다 들어와 방 객체가 바뀌어도 그사이의 대화를 덮지 않고 그 메시지에 붙음
    // ③ 다른 버전으로 바꾸면 펼친 추천이 닫히고 버튼에 값이 다시 보임 ④ 하트 확인 창을 보는 사이 잔액이 늘어도 확인한 값보다 더 내지 않음
    res.edge = await p.evaluate(async () => {
      const nap = (ms) => new Promise((r) => setTimeout(r, ms)),
        keep = window.llm,
        out = {},
        cur = (r) => lastAi(r).alts[lastAi(r).idx];
      setAutoSug(room, false);
      hideSug();
      const h0 = S.wallet.hearts;
      cur(room).suggestions = [];
      updateComposer();
      window.llm = async () => ({ suggestions: ["  ", ""] });
      $("#sugBtn").click();
      await nap(200);
      out.blank = {
        refunded: S.wallet.hearts === h0,
        none: (cur(room).suggestions || []).length === 0,
        said: /만들지 못했어요/.test($("#sugPanel").textContent)
      };
      hideSug();
      let release;
      const wait = new Promise((r) => (release = r));
      window.llm = async () => {
        await wait;
        return { suggestions: ["늦게 온 추천"] };
      };
      $("#sugBtn").click();
      await nap(50);
      const id = room.id,
        fresh = migrateRoom(JSON.parse(JSON.stringify(room))); // 방을 나갔다 다시 들어온 것처럼 새 객체
      setRoom(fresh);
      fresh.msgs.push({ id: uid("m"), role: "user", text: "그사이 보낸 말", canned: true });
      saveRoom(fresh);
      release();
      await nap(250);
      out.stale = {
        kept: (await KV.get(roomKey(id))).msgs.some((m) => m.text === "그사이 보낸 말"),
        attached: (cur(fresh).suggestions || []).join("|"),
        paid: h0 - S.wallet.hearts
      };
      fresh.msgs.pop();
      saveRoom(fresh);
      // ②-2 다른 방을 보고 있을 때 끝난 추천: 저장된 최신 방을 읽어 거기에 붙임(처음 잡은 낡은 객체를 저장하지 않음)
      const slow = () => {
        let go;
        const held = new Promise((r) => (go = r));
        window.llm = async () => {
          await held;
          return { suggestions: ["다른 방에서 온 추천"] };
        };
        return go;
      };
      const reset = async () => {
        cur(room).suggestions = [];
        saveRoom(room);
        await viewChat(id);
        return S.wallet.hearts;
      };
      let h1 = await reset(),
        go = slow();
      $("#sugBtn").click();
      await nap(50);
      const latest = migrateRoom(JSON.parse(JSON.stringify(room))); // 그사이 다시 들어와 한마디 보낸 뒤
      latest.msgs.push({ id: uid("m"), role: "user", text: "다른 방으로 가기 전 한마디", canned: true });
      saveRoom(latest);
      const other = newRoom(normalizeChar(ORIGINALS[1]), 0, S.personas[0]); // 다른 방을 보고 있음
      setRoom(other);
      go();
      await nap(300);
      const stored = await KV.get(roomKey(id)),
        last = [...stored.msgs].reverse().find((x) => x.role === "ai");
      out.away = {
        kept: stored.msgs.some((x) => x.text === "다른 방으로 가기 전 한마디"),
        attached: (last.alts[last.idx].suggestions || []).join("|"),
        paid: h1 - S.wallet.hearts
      };
      stored.msgs = stored.msgs.filter((x) => x.text !== "다른 방으로 가기 전 한마디");
      setRoom(migrateRoom(stored));
      saveRoom(room);
      S.rooms = S.rooms.filter((x) => x.id !== other.id); // 시험용 방은 목록에서 뺌
      KV.set("rooms", S.rooms);
      // ②-3 붙일 버전이 사라짐(그 답이 다른 글로 바뀜): 붙일 곳이 없으니 되돌림
      h1 = await reset();
      go = slow();
      $("#sugBtn").click();
      await nap(50);
      const lm = lastAi(room),
        texts = lm.alts.map((x) => x.text);
      lm.alts = lm.alts.map((x) => ({ ...x, text: x.text + " (고친 글)" }));
      go();
      await nap(300);
      out.gone = {
        refunded: S.wallet.hearts === h1,
        none: (cur(room).suggestions || []).length === 0,
        said: /메시지가 없어졌어요/.test($("#sugPanel").textContent)
      };
      lm.alts.forEach((x, i) => (x.text = texts[i]));
      saveRoom(room);
      window.llm = keep;
      await viewChat(id);
      const m = lastAi(room);
      m.alts[m.idx].suggestions = ["저장된 추천"]; // ③의 전제: 지금 버전에는 저장된 추천이 있고(값 없이 펼침), 새로 더하는 버전에는 없음
      m.alts.push({ text: "다른 버전의 답", status: m.alts[m.idx].status });
      saveRoom(room);
      renderLog();
      updateComposer();
      $("#sugBtn").click(); // 저장된 추천(값 없이 펼침)
      const before = { open: !$("#sugPanel").hidden, label: $("#sugBtn").textContent };
      $$('[data-act="next"]').pop().click();
      out.version = { before, closed: $("#sugPanel").hidden, label: $("#sugBtn").textContent };
      $$('[data-act="prev"]').pop().click();
      out.version.back = $("#sugBtn").textContent;
      m.alts.pop();
      m.idx = 0;
      saveRoom(room);
      renderLog();
      room.set.autoSug = true; // 턴 값만큼만 있어 추천 값은 못 냄 → 확인 창에는 턴 값만 보임
      const turn = quote({ ...room.set, autoSug: false }).n,
        ack = S.wallet.ack;
      S.wallet.hearts = turn;
      S.wallet.ack = {};
      const pending = ensurePay(room);
      await nap(150);
      const shown = ($(".overlay #ok") || {}).textContent || "";
      S.wallet.hearts += SUGGEST_COST; // 그사이 다른 환불이 들어옴
      $(".overlay #ok").click();
      const q = await pending;
      out.confirm = { shown, turn, sug: q.sug, pays: heartsOf(q) };
      Object.assign(S.wallet, { hearts: 30, ack });
      saveWallet();
      setAutoSug(room, true);
      return out;
    });
    {
      const e = res.edge,
        c = res.sug.cost;
      if (!e.blank.refunded || !e.blank.none || !e.blank.said) errs.push("빈 추천을 되돌리지 않음: " + JSON.stringify(e.blank));
      if (!e.stale.kept || e.stale.attached !== "늦게 온 추천" || e.stale.paid !== c)
        errs.push("늦게 끝난 추천이 새 대화를 덮거나 붙지 않음: " + JSON.stringify(e.stale));
      if (!e.away.kept || e.away.attached !== "다른 방에서 온 추천" || e.away.paid !== c)
        errs.push("다른 방을 보는 사이 끝난 추천이 새 대화를 덮거나 붙지 않음: " + JSON.stringify(e.away));
      if (!e.gone.refunded || !e.gone.none || !e.gone.said) errs.push("붙일 곳이 사라진 추천을 되돌리지 않음: " + JSON.stringify(e.gone));
      const v = e.version;
      if (!v.before.open || v.before.label.includes("♥") || !v.closed || !v.label.includes("♥" + c) || v.back.includes("♥"))
        errs.push("버전을 바꾼 뒤 추천 버튼의 값 표시가 다름: " + JSON.stringify(v));
      if (!e.confirm.shown.includes("♥" + e.confirm.turn + "로") || e.confirm.sug !== 0 || e.confirm.pays !== e.confirm.turn)
        errs.push("확인한 값보다 더 냄: " + JSON.stringify(e.confirm));
    }
    // 자동 받기를 켠 턴: 답과 같이 온 추천이 저장되고 바로 펼쳐짐, 턴 값 + 추천 값이 나감. 끄면 다음 턴의 프롬프트에 추천 칸이 없음
    res.autoTurn = await (async () => {
      const before = await p.evaluate(() => ({ hearts: S.wallet.hearts, need: heartsOf(quote(room.set)) }));
      await turn("자동 받기를 켠 턴");
      const after = await p.evaluate(() => {
        const a = lastAi(room).alts[lastAi(room).idx],
          sys = window.__lastInput[0].content;
        const out = {
          hearts: S.wallet.hearts,
          sugs: (a.suggestions || []).join("|"),
          open: !$("#sugPanel").hidden,
          asked: /"suggestions":\["…"/.test(sys),
          cost: a.cost
        };
        setAutoSug(room, false);
        hideSug();
        return out;
      });
      await turn("자동 받기를 끈 턴");
      const off = await p.evaluate(() => ({
        asked: window.__lastInput.some((m) => m.content.includes("suggestions")),
        sugs: (lastAi(room).alts[lastAi(room).idx].suggestions || []).length
      }));
      return { paid: before.hearts - after.hearts, need: before.need, ...after, off };
    })();
    {
      const a = res.autoTurn;
      if (a.paid !== a.need || a.sugs !== "하나|둘|셋" || !a.asked || !a.open || a.cost !== "♥" + a.need)
        errs.push("자동 받기를 켠 턴이 다름: " + JSON.stringify(a));
      if (a.off.asked || a.off.sugs !== 0) errs.push("자동 받기를 끈 턴에 추천 칸이 남음: " + JSON.stringify(a.off));
    }
    // 한 줄 입력창: 보내기 버튼은 입력이 비면 '이어서 쓰기'(값이 보임), 글을 치면 보내기. 답이 막 끝난 직후의 누름은 이어서 쓰기로 받지 않음(잘못 눌러 값이 나가지 않게).
    // 예전의 버튼 줄(이어서 쓰기 칩·무료 턴 글)은 없고 무료 턴·하트는 머리에, 안내 줄은 알릴 것이 없으면 비어 있음
    res.row = await p.evaluate(async () => {
      const send = $("#sendBtn"),
        inp = $("#inp"),
        look = () => ({ cont: send.classList.contains("cont"), text: send.textContent, label: send.getAttribute("aria-label") });
      hideSug();
      inp.value = "";
      inp.oninput();
      updateComposer();
      const empty = look();
      inp.value = "안녕";
      inp.oninput();
      const typed = look();
      inp.value = "";
      inp.oninput();
      setGen({ ctl: new AbortController(), msgId: "x" }); // 응답이 끝나는 순간을 흉내 — updateComposer가 그 순간을 잡아 잠깐 잠금
      updateComposer();
      setGen(null);
      updateComposer();
      const n0 = room.msgs.length;
      send.click();
      await new Promise((r) => setTimeout(r, 80));
      return {
        empty,
        typed,
        locked: room.msgs.length === n0 && !gen,
        head: $("#freeCount").textContent,
        oldRow: !!$("#contBtn") || !!$(".composer .bar2"),
        hint: $("#hint").textContent,
        composer: Math.round($(".composer").getBoundingClientRect().height)
      };
    });
    {
      const w = res.row;
      if (!w.empty.cont || !/^이어서/.test(w.empty.text) || !/♥|무료|PLUS/.test(w.empty.text) || w.empty.label !== "이어서 쓰기")
        errs.push("빈 입력의 보내기 버튼(이어서 쓰기)이 다름: " + JSON.stringify(w.empty));
      if (w.typed.cont || w.typed.label !== "보내기" || !w.locked) errs.push("보내기 버튼 전환·잘못 누름 막기가 다름: " + JSON.stringify(w));
      if (!w.head.includes("♥") || w.oldRow || w.hint || w.composer > 96) errs.push("머리·입력창 묶음이 다름: " + JSON.stringify(w));
    }
    // 지갑 알림("wallet") 하나로 틀의 지갑 칩과 대화방 머리가 같이 바뀜 — 대화방 화면이 알림을 직접 받음(틀 ui/shell.js가 대화방을 부르지 않음)
    res.walletSync = await p.evaluate(() => {
      const h0 = S.wallet.hearts,
        want = num(h0 + 123);
      S.wallet.hearts = h0 + 123;
      saveWallet();
      const out = { head: $("#freeCount").textContent.includes(want), chips: $$(".wallet").every((w) => w.textContent.includes(want)) };
      S.wallet.hearts = h0;
      saveWallet();
      out.back = !$("#freeCount").textContent.includes(want);
      return out;
    });
    if (!res.walletSync.head || !res.walletSync.chips || !res.walletSync.back)
      errs.push("지갑이 바뀌어도 대화방 머리·지갑 칩이 안 따라옴: " + JSON.stringify(res.walletSync));
    // 대화 검색: 머리의 검색 버튼 → 낱말을 치면 결과(찾은 말 강조) → 누르면 창이 닫히고 그 메시지로 감
    res.find = await p.evaluate(async () => {
      const nap = (ms) => new Promise((r) => setTimeout(r, ms));
      $("#findBtn").click();
      await nap(100);
      const q = $("#csQ");
      q.value = "대사 3번";
      q.oninput();
      const hits = $$("#csList .cs-hit"),
        out = { n: hits.length, mark: ($("#csList mark") || {}).textContent, id: hits[0] && hits[0].dataset.id };
      q.value = "어디에도없는말";
      q.oninput();
      out.none = $("#csList").textContent;
      q.value = "대사 3번";
      q.oninput();
      $("#csList .cs-hit").click();
      await nap(200);
      return { ...out, closed: !$(".overlay"), at: !!$(`.msg[data-id="${out.id}"].flash`) };
    });
    if (res.find.n < 1 || res.find.mark !== "대사 3번" || !/찾는 말이 없어요/.test(res.find.none) || !res.find.closed || !res.find.at)
      errs.push("대화 검색이 다름: " + JSON.stringify(res.find));
    await p.evaluate(() => {
      hideSug();
      openRoomDrawer("output");
    });
    await p.waitForTimeout(400);
    res.drawer = await p.evaluate(() => {
      const as = document.querySelector("#as");
      return { has: !!as, checked: as && as.checked, oldSug: !!document.querySelector("#sa"), overflowX: document.documentElement.scrollWidth - innerWidth };
    });
    await p.evaluate(() => document.querySelector("#as").scrollIntoView({ block: "center" }));
    await p.waitForTimeout(200);
    await p.screenshot({ path: `${out}/${dev.replace(/\W+/g, "_")}_output.png` });
    await p.evaluate(() => {
      closeOverlays();
      location.hash = "me";
    });
    await p.waitForTimeout(700);
    res.me = await p.evaluate(() => ({
      imgRatingSel: !!document.querySelector("#imgRatingSel"),
      save: !!document.querySelector("#setSave"),
      overflowX: document.documentElement.scrollWidth - innerWidth
    }));
    // 방 읽기 경계: 설정 칸이 없는 방(다른 기기·예전 빌드가 남긴 것)은 기본 설정으로 열리고, 메시지가 없는 방은 안내만 뜨며 저장된 내용은 그대로 —
    // 전에는 설정 칸이 없는 방 하나가 예외로 방 화면을 멈췄음
    res.boundary = await p.evaluate(async () => {
      const nap = (ms) => new Promise((r) => setTimeout(r, ms)),
        a = newRoom(normalizeChar(ORIGINALS[0]), 0, S.personas[0]),
        b = newRoom(normalizeChar(ORIGINALS[1]), 0, S.personas[0]),
        ra = await KV.get(roomKey(a.id)),
        rb = await KV.get(roomKey(b.id));
      delete ra.set;
      delete rb.msgs;
      if (!(await KV.put(roomKey(a.id), ra)) || !(await KV.put(roomKey(b.id), rb)))
        throw new Error("깨진 방을 저장소에 넣지 못함 — 방 읽기 경계 시험이 그 방에 닿지 못함");
      setRoom(null);
      location.hash = "r-" + a.id;
      await nap(800);
      const opened = !!document.querySelector("#inp") && !!room && room.id === a.id && !!room.set && !!room.set.model;
      location.hash = "r-" + b.id;
      await nap(800);
      const left = await KV.get(roomKey(b.id));
      return { opened, notice: (document.querySelector("#view .empty") || {}).textContent || "", kept: !!left && !("msgs" in left), room: room ? room.id : "" };
    });
    {
      const x = res.boundary;
      if (!x.opened || !/열 수 없어요/.test(x.notice) || !x.kept) errs.push("방 읽기 경계(깨진 방 하나가 화면을 멈추지 않음)가 다름: " + JSON.stringify(x));
    }
    // 방 본문은 큰 저장소(IndexedDB)에: 예전 설치가 localStorage에 둔 본문으로도 방이 열리고, 큰 저장소에 들어간 것을 확인한 뒤에만 옛 키를 지움.
    // 본문이 저장되지 못하면(저장소 쓰기 실패) 목록을 마지막으로 저장된 모양으로 되돌리고 '저장하지 못했어요 · 다시 저장'을 보임 — 화면의 대화는 그대로
    res.bodies = await p.evaluate(async () => {
      const nap = (ms) => new Promise((r) => setTimeout(r, ms)),
        r = newRoom(normalizeChar(ORIGINALS[0]), 0, S.personas[0]);
      await saveRoom(r);
      const key = roomKey(r.id),
        lsKey = "hv1_" + key,
        body = await KV.get(key),
        inIdb0 = !!(await IDB.get(key)) && !localStorage.getItem(lsKey);
      // 예전 설치 흉내: 본문을 localStorage에만 둠
      await IDB.set(key, undefined);
      localStorage.setItem(lsKey, JSON.stringify(body));
      // ① 큰 저장소 쓰기가 실패하는 동안: 옛 본문으로 열리고 옛 키는 그대로 남음
      const realSet = IDB.set,
        realAdd = IDB.add;
      IDB.set = async () => false;
      IDB.add = async () => "fail"; // 옛 본문을 옮기는 길(없을 때만 넣기)도 실패
      setRoom(null);
      location.hash = "r-" + r.id;
      await nap(900);
      const openedOld = !!room && room.id === r.id && !!document.querySelector("#inp"),
        keptOld = !!localStorage.getItem(lsKey),
        before = JSON.stringify(S.rooms.find((x) => x.id === r.id));
      // 새 턴을 저장하려 해도 실패 → 목록은 그대로, '저장하지 못했어요' 줄이 보임
      room.msgs.push({ id: uid("m"), role: "user", text: "저장되지 못할 뻔한 말" });
      const ok1 = await saveRoom(room);
      await nap(150);
      const failShown = !document.querySelector("#saveFail").hidden,
        listSame = JSON.stringify(S.rooms.find((x) => x.id === r.id)) === before,
        stillOld = !!localStorage.getItem(lsKey) && !(await IDB.get(key));
      // ② 저장소가 돌아온 뒤 '다시 저장' → 저장되고 줄이 사라짐, 본문은 큰 저장소에 있고 옛 키는 지워짐
      IDB.set = realSet;
      IDB.add = realAdd;
      document.querySelector("#saveRetry").click();
      await nap(600);
      const moved = await IDB.get(key);
      return {
        inIdb0,
        openedOld,
        keptOld,
        ok1,
        failShown,
        listSame,
        stillOld,
        retried: document.querySelector("#saveFail").hidden,
        inIdb: !!moved && moved.msgs.some((m) => m.text === "저장되지 못할 뻔한 말"),
        oldGone: !localStorage.getItem(lsKey),
        listed: S.rooms.some((x) => x.id === r.id)
      };
    });
    {
      const x = res.bodies;
      if (!x.inIdb0 || !x.openedOld || !x.keptOld || x.ok1 || !x.failShown || !x.listSame || !x.stillOld || !x.retried || !x.inIdb || !x.oldGone || !x.listed)
        errs.push("방 본문 저장소(예전 본문으로 열림·실패하면 목록을 되돌리고 알림·다시 저장)가 다름: " + JSON.stringify(x));
    }
    // 부팅 뒤에는 열지 않은 방의 예전 본문도 큰 저장소로 옮겨 둠(localStorage 자리를 비움) — 옮긴 뒤에도 그 방이 열림
    {
      const id = await p.evaluate(async () => {
        const r = newRoom(normalizeChar(ORIGINALS[1]), 0, S.personas[0]);
        await saveRoom(r);
        const key = roomKey(r.id),
          body = await KV.get(key);
        await IDB.set(key, undefined);
        localStorage.setItem("hv1_" + key, JSON.stringify(body));
        return r.id;
      });
      await p.reload({ waitUntil: "load" });
      await p.waitForTimeout(1500);
      res.sweep = await p.evaluate(async (id) => {
        const key = roomKey(id);
        const moved = !!(await IDB.get(key)) && !localStorage.getItem("hv1_" + key);
        location.hash = "r-" + id;
        await new Promise((r) => setTimeout(r, 900));
        return { moved, opened: !!room && room.id === id && !!document.querySelector("#inp") };
      }, id);
      if (!res.sweep.moved || !res.sweep.opened) errs.push("부팅 뒤 예전 방 본문 옮기기가 다름: " + JSON.stringify(res.sweep));
    }
    // 장기기억 설정의 원본은 설정(settings.memCfg) 하나 — 예전 빌드가 따로 두던 사본(hv1_memcfg)과 값이 달라도 설정의 값을 쓰고,
    // 설정에 그 칸이 없는 예전 설치에서만 따로 둔 사본을 읽어 설정으로 옮김. 저장할 때 따로 둔 사본은 더 쓰지 않음
    {
      const seed = (withCfg) =>
        p.evaluate((withCfg) => {
          const s = JSON.parse(localStorage.getItem("hv1_settings") || "{}");
          if (withCfg) s.memCfg = { ...(s.memCfg || {}), every: 7 };
          else delete s.memCfg;
          localStorage.setItem("hv1_settings", JSON.stringify(s));
          localStorage.setItem("hv1_memcfg", JSON.stringify({ every: 3 }));
        }, withCfg);
      await seed(true);
      await p.reload({ waitUntil: "load" });
      await p.waitForTimeout(1200);
      const both = await p.evaluate(() => S.settings.memCfg.every);
      await seed(false);
      await p.reload({ waitUntil: "load" });
      await p.waitForTimeout(1200);
      const legacy = await p.evaluate(() => {
        const saved = (JSON.parse(localStorage.getItem("hv1_settings") || "{}").memCfg || {}).every;
        const every = S.settings.memCfg.every;
        S.settings.memCfg.every = 9;
        saveSettings();
        return { every, saved, extra: JSON.parse(localStorage.getItem("hv1_memcfg")).every };
      });
      res.memcfg = { both, legacy };
      if (both !== 7 || legacy.every !== 3 || legacy.saved !== 3 || legacy.extra !== 3)
        errs.push("장기기억 설정의 원본(설정 하나, 예전 사본은 옛 설치에서만 읽음)이 다름: " + JSON.stringify(res.memcfg));
    }
  } catch (e) {
    res.fail = String(e).slice(0, 300);
  }
  res.errs = errs;
  console.log(JSON.stringify(res));
  await b.close();
}
