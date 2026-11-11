// 채팅 흐름: 입력창 ! 명령어 목록, 자동 스크롤 끔/켬, 고정 기억, 즉답 명령어, 좋아요·분기, 추천 답변 수동, 출력 설정 카드, 설정 페이지(이미지 기본 수위 칸 없음)
import { webkit, chromium, devices } from "playwright";
import { noSupabase } from "./_offline.mjs";
const url = process.argv[2], out = process.argv[3];
const targets = [["iPhone 13", webkit], ["iPhone SE", webkit], ["Galaxy S9+", chromium]];
for (const [dev, engine] of targets) {
  const b = await engine.launch(); const ctx = await b.newContext({ ...devices[dev] }); await noSupabase(ctx); const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 140)); });
  const res = { dev };
  try {
    await p.goto(url, { waitUntil: "load" }); await p.waitForTimeout(1200);
    await p.evaluate(() => { const r = newRoom(normalizeChar(ORIGINALS.find((c) => c.id === "godseats")), 0, S.personas[0]); location.hash = "r-" + r.id; });
    await p.waitForTimeout(900);
    // ! 명령어 목록: !만 치면 앱 + 작품 명령어가 모두 뜨고, ↓·Enter로 고르면 입력창에 채워진 뒤 닫힘(보내지는 않음)
    res.cmd = await p.evaluate(() => {
      const inp = $("#inp"), key = (k) => inp.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true })), all = allCommands(getChar(room.char.id));
      inp.value = "!"; inp.oninput();
      const n = $$("#cmdPanel [data-i]").length, open = !$("#cmdPanel").hidden;
      key("ArrowDown"); key("Enter");
      const r = { n, want: all.length, open, filled: inp.value, expect: "!" + all[1].cmd, closed: $("#cmdPanel").hidden, msgs: room.msgs.length };
      inp.value = ""; inp.oninput();
      return r;
    });
    if (!res.cmd.open || res.cmd.n !== res.cmd.want || res.cmd.n < 5 || res.cmd.filled !== res.cmd.expect || !res.cmd.closed || res.cmd.msgs !== 1) errs.push("! 명령어 목록이 다름: " + JSON.stringify(res.cmd));
    // 가짜 llm: 1.6초 동안 조금씩 흘려보냄
    await p.evaluate(() => {
      const para = (i) => `*장면 ${i}: 바람이 부서진 간판을 흔들었다. 먼지가 내려앉았다.*\n\n한서윤: "대사 ${i}번이에요. 조금 길게 말해 볼게요, 화면이 충분히 길어지도록."`;
      window.llm = async (input, { onText }) => {
        window.__lastInput = input;
        const body = Array.from({ length: 14 }, (_, i) => para(i + 1)).join("\n\n");
        const full = body + "\n===STATE===\n" + JSON.stringify({ status: {}, suggestions: ["하나", "둘", "셋"] });
        for (let n = 200; n < full.length; n += 200) { onText({ text: full.slice(0, n) }); await new Promise((r) => setTimeout(r, 120)); }
        return full;
      };
    });
    const turn = async (text) => p.evaluate(async (text) => {
      room.msgs.push({ id: uid("m"), role: "user", text }); const log = $("#log"); log.scrollTop = log.scrollHeight;
      const samp = []; const iv = setInterval(() => { const l = $("#log"); samp.push([Math.round(l.scrollTop), l.scrollHeight - l.clientHeight]); }, 100);
      await generate(null, quote(room.set)); clearInterval(iv);
      const l = $("#log");
      return { tops: [...new Set(samp.map((s) => s[0]))].length, first: samp[0], last: [Math.round(l.scrollTop), l.scrollHeight - l.clientHeight], sugHidden: $("#sugPanel").hidden, jumpHidden: $("#jumpBtn").hidden,
        reminder: /\[이번 응답\]/.test(window.__lastInput[window.__lastInput.length - 1].content) };
    }, text);
    res.off = await turn("첫 번째 입력");
    // 고정 기억: 첫 응답(msgs[2])의 '📌 고정' → 시트에서 고쳐 저장 → 방에 한 줄(그 메시지 id와 함께) → 드로어 장기기억의 '고정 기억' 탭에 보임
    res.pin = await p.evaluate(async () => {
      const nap = (ms) => new Promise((r) => setTimeout(r, ms));
      document.querySelector('[data-act="pin"][data-i="2"]').click(); await nap(150);
      const ta = document.querySelector("#pinTa"), seeded = ta.value.length > 0 && ta.maxLength === LIMITS.pin; ta.value = "첫눈 오는 날 다시 만나기로 약속했다"; ta.oninput();
      document.querySelector("#pinSave").click(); await nap(150);
      openRoomDrawer("memory"); document.querySelector('[data-tab="pin"]').click(); await nap(100);
      const rows = $$(".pin-row").length; closeOverlays();
      return { seeded, n: (room.pins || []).length, msg: room.pins[0] && room.pins[0].msgId === room.msgs[2].id, rows, cap: PLAN.free.pins };
    });
    if (!res.pin.seeded || res.pin.n !== 1 || !res.pin.msg || res.pin.rows !== 1) errs.push("고정 기억이 다름: " + JSON.stringify(res.pin));
    await p.evaluate(() => { room.set.autoScroll = true; saveRoom(room); });
    res.on = await turn("두 번째 입력");
    // 고정한 줄은 다음 턴의 프롬프트(변동부의 [고정 기억])에 그대로 들어감
    res.pinSent = await p.evaluate(() => { const s = window.__lastInput[0].content; return s.includes("[고정 기억") && s.includes("첫눈 오는 날 다시 만나기로 약속했다") && s.indexOf("[고정 기억") > window.__lastInput[0].cut; });
    if (!res.pinSent) errs.push("고정 기억이 프롬프트에 없음");
    // 즉답 명령어(작품 commands의 text — 가짜 데이터로 틀만): !이름을 보내면 AI를 부르지 않고 유저 말풍선 + 정해진 글이 남음 — 하트·턴은 그대로, 다시 쓰기 없음, 다음 턴 기록에는 들어감
    res.canned = await p.evaluate(async () => {
      const nap = (ms) => new Promise((r) => setTimeout(r, ms)), live = getChar(room.char.id), was = live.commands, hearts = S.wallet.hearts, used = S.wallet.freeUsed, n = room.msgs.length, turn = room.turn, real = window.llm; let calls = 0;
      window.llm = async (a, b) => { calls++; return real(a, b); };
      live.commands = (was || []).concat({ cmd: "안내시험", title: "안내", text: "[안내] 정해진 글이에요." });
      $("#inp").value = "!안내시험"; $("#form").requestSubmit(); await nap(300);
      const last = room.msgs[room.msgs.length - 1], prev = room.msgs[room.msgs.length - 2], sent = buildInput(room, room.msgs.length, room.status);
      const r = { added: room.msgs.length - n, canned: !!last.canned && !!prev.canned, text: last.alts[0].text, calls, wallet: S.wallet.hearts === hearts && S.wallet.freeUsed === used, turn: room.turn === turn,
        regen: !!document.querySelector('[data-act="regen"]'), cleared: $("#inp").value === "", drawn: $$("#logInner .msg").length === room.msgs.length,
        inHistory: sent.some((m) => m.role === "assistant" && m.content.includes("[안내] 정해진 글이에요.")) && sent.some((m) => m.role === "user" && m.content === "!안내시험") };
      window.llm = real; live.commands = was;
      return r;
    });
    { const c = res.canned; if (c.added !== 2 || !c.canned || c.text !== "[안내] 정해진 글이에요." || c.calls !== 0 || !c.wallet || !c.turn || c.regen || !c.cleared || !c.drawn || !c.inHistory) errs.push("즉답 명령어가 다름: " + JSON.stringify(c)); }
    // 좋아요 토글과 분기: 첫 응답(msgs[2])의 '분기' → 확인 → 방 수 +1·새 방으로 이동·메시지 수는 그 메시지까지·원래 방은 그대로·좋아요도 따라옴.
    // 장기기억은 분기한 턴(1턴)보다 뒤에 시작하는 구간([2-2턴])을 빼고 복사
    res.fork = await p.evaluate(async () => {
      const nap = (ms) => new Promise((r) => setTimeout(r, ms)), before = S.rooms.length, src = room.id, n0 = room.msgs.length, i = 2; // [오프닝, 유저, AI, 유저, AI, 즉답 유저, 즉답 글] — 즉답은 턴으로 세지 않음
      const head = memoryMark(1, 1) + " 앞\n첫 요약"; room.memory = head + "\n\n" + memoryMark(2, 2) + " 뒤\n둘째 요약"; saveRoom(room);
      document.querySelector(`[data-act="up"][data-i="${i}"]`).click();
      const fb = room.msgs[i].alts[room.msgs[i].idx].fb;
      document.querySelector(`[data-act="fork"][data-i="${i}"]`).click(); await nap(150);
      document.querySelector(".overlay #ok").click(); await nap(600);
      const kept = await KV.get(roomKey(src));
      return { rooms: S.rooms.length - before, moved: room.id !== src && location.hash === "#r-" + room.id, msgs: room.msgs.length, want: i + 1, from: !!room.forkedFrom && room.forkedFrom.roomId === src, fb, fbCopied: room.msgs[i].alts[room.msgs[i].idx].fb,
        srcMsgs: kept.msgs.length, n0, mark: / \(분기\)$/.test(room.opening), base: baseOpening(room) === kept.opening, index: S.rooms.find((x) => x.id === room.id).fork === true, drawn: $$("#logInner .msg").length,
        mem: room.memory === head, turn: room.turn, srcTurn: kept.turn, srcMem: kept.memory.includes(memoryMark(2, 2)), pins: (room.pins || []).length };
    });
    { const f = res.fork; if (f.rooms !== 1 || !f.moved || f.msgs !== f.want || !f.from || f.fb !== 1 || f.fbCopied !== 1 || f.srcMsgs !== f.n0 || !f.mark || !f.base || !f.index || f.drawn !== f.want || !f.mem || f.turn !== 1 || f.srcTurn !== 2 || !f.srcMem || f.pins !== 1) errs.push("분기가 다름: " + JSON.stringify(f)); }
    res.sugClick = await p.evaluate(async () => { $("#sugBtn").click(); await new Promise((r) => setTimeout(r, 200)); return $$("#sugPanel [data-s]").length; });
    await p.evaluate(() => { hideSug(); openRoomDrawer("output"); }); await p.waitForTimeout(400);
    res.drawer = await p.evaluate(() => { const as = document.querySelector("#as"); return { has: !!as, checked: as && as.checked, oldSug: !!document.querySelector("#sa"), overflowX: document.documentElement.scrollWidth - innerWidth }; });
    await p.evaluate(() => document.querySelector("#as").scrollIntoView({ block: "center" })); await p.waitForTimeout(200);
    await p.screenshot({ path: `${out}/${dev.replace(/\W+/g, "_")}_output.png` });
    await p.evaluate(() => { closeOverlays(); location.hash = "me"; }); await p.waitForTimeout(700);
    res.me = await p.evaluate(() => ({ imgRatingSel: !!document.querySelector("#imgRatingSel"), save: !!document.querySelector("#setSave"), overflowX: document.documentElement.scrollWidth - innerWidth }));
  } catch (e) { res.fail = String(e).slice(0, 300); }
  res.errs = errs; console.log(JSON.stringify(res)); await b.close();
}
