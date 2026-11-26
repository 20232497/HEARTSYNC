// 실패의 뒤처리(프레임 8차 가묶음): 메시지 수정을 취소하거나 새 답이 실패하면 고치기 전 대화 그대로, 다시 쓰기가 실패해도 에피소드 진행이 그대로,
// 본문 없는 답은 저장하지 않고 값을 돌려줌, 무료 턴 소진 안내에서 PLUS를 사도 같은 방·쓰던 글이 그대로, 깨진 로그인 복귀 주소로 열어도 홈이 뜸.
import { webkit, chromium, devices } from "playwright";
import { noSupabase } from "./_offline.mjs";
const url = process.argv[2];
const targets = [
  ["iPhone 13", webkit],
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
    // 시험 도우미: 바로 끝나는 가짜 응답, 응답이 끝나길 기다리기, 화면의 수정 버튼으로 고치기, 대화의 지금 모양
    await p.evaluate(() => {
      window.__nap = (ms) => new Promise((r) => setTimeout(r, ms));
      window.__ok = async (input, opt = {}) => {
        if (opt.json) return { suggestions: [] };
        const n = (window.__n = (window.__n || 0) + 1);
        const full = `*장면 ${n}: 바람이 불었다.*\n\n"대사 ${n}번이에요."\n===STATE===\n` + JSON.stringify({ status: {}, suggestions: [] });
        opt.onText && opt.onText({ text: full });
        return full;
      };
      window.__fail = async () => {
        throw { code: "server" };
      };
      // 보내기·다시 쓰기는 값 확인 창이 뜨면 끝나지 않으므로 기다림에 한도를 둠(시험이 멈추지 않고 실패로 드러나게)
      window.__turn = (t) => Promise.race([sendTurn(t), window.__nap(4000)]);
      window.__idle = async () => {
        for (let i = 0; i < 200 && gen; i++) await window.__nap(50);
        await window.__nap(250);
      };
      window.__edit = async (i, text) => {
        const open = document.querySelector(`[data-act="edit"][data-i="${i}"]`); // 값 확인을 닫은 뒤에는 수정 칸이 열린 채 남아 있음
        if (open) open.click();
        await window.__nap(60);
        $("#ed" + i).value = text;
        document.querySelector(`[data-act="save"][data-i="${i}"]`).click();
        await window.__nap(60);
      };
      window.__snap = () =>
        JSON.stringify({
          m: room.msgs.map((m) => [m.id, m.role === "user" ? m.text : m.alts.map((a) => a.text), m.idx === undefined ? -1 : m.idx]),
          st: room.status,
          ep: room.ep || null
        });
    });
    // 메시지 수정·다시 쓰기의 되돌리기 — 일반 작품과 에피소드형 작품(진행 상태가 있음) 둘 다
    const works = await p.evaluate(() => ["godseats", (ORIGINALS.find((c) => c.episode) || {}).id].filter(Boolean));
    res.edit = [];
    for (const id of works) {
      await p.evaluate((id) => {
        const r = newRoom(normalizeChar(ORIGINALS.find((c) => c.id === id)), 0, S.personas[0]);
        location.hash = "r-" + r.id;
      }, id);
      await p.waitForTimeout(900);
      const e = await p.evaluate(async () => {
        const { __nap: nap, __idle: idle, __edit: edit, __snap: snap, __turn: turn } = window;
        const out = {};
        S.wallet.freeUsed = 0;
        saveWallet();
        setModel("lite"); // 무료 턴으로 — 하트를 쓰는 모델은 값 확인 창이 먼저 뜸
        window.llm = window.__ok;
        await turn("첫 말이에요");
        await idle();
        await turn("둘째 말이에요");
        await idle();
        const i = room.msgs.findIndex((m) => m.role === "user" && m.text === "첫 말이에요"),
          base = snap(),
          n0 = room.msgs.length;
        out.setup = i > 0 && n0 >= i + 4;
        // ① 값 확인에서 멈춤(무료 턴이 없고 하트도 없음 → 안내 창): 아무것도 바뀌지 않음
        Object.assign(S.wallet, { freeUsed: 999, hearts: 0 });
        saveWallet();
        await edit(i, "고친 말이에요");
        await nap(300);
        out.cancel = { same: snap() === base, shown: room.msgs[i].text, wall: !!$(".overlay") };
        closeOverlays();
        await nap(150);
        out.cancel.draft = ($("#ed" + i) || {}).value || ""; // 고쳐 쓴 글은 수정 칸에 그대로(하트를 사고 와서 다시 누르게)
        // ② 승인 뒤 모델 오류: 고치기 전 대화로 되돌리고(원문·뒤 답·상태창·에피소드 진행) 알림, 무료 턴도 돌아옴 — 저장된 본문도 같음
        Object.assign(S.wallet, { freeUsed: 0, hearts: 0 });
        saveWallet();
        window.llm = window.__fail;
        await edit(i, "고친 말이에요");
        await idle();
        const kept = await KV.get(roomKey(room.id));
        out.fail = {
          same: snap() === base,
          err: ($(".toast") || {}).textContent || "",
          line: room.lastErr || "",
          want: errCopy({ code: "server" }),
          shownLine: ($(".err-line") || {}).textContent || "",
          retry: !!$("#retry"),
          free: S.wallet.freeUsed,
          stored: kept.msgs.length === n0 && kept.msgs[i].text === "첫 말이에요",
          dom: $$("#logInner .msg").length
        };
        // ③ 다시 쓰기가 실패해도 그대로 — 에피소드 진행(그 응답 앞으로 돌아간 채 남지 않음)도, 보고 있던 버전도(버전을 둘 만들고 앞 버전을 고른 채로 다시 쓰기)
        window.llm = window.__ok;
        await Promise.race([regen(room.msgs.length - 1), nap(4000)]);
        await idle();
        $$('[data-act="prev"]').pop().click();
        await nap(150);
        const lastMsg = room.msgs[room.msgs.length - 1],
          base2 = snap(),
          free0 = S.wallet.freeUsed;
        out.versions = { n: lastMsg.alts.length, idx: lastMsg.idx };
        window.llm = window.__fail;
        room.lastErr = "";
        await Promise.race([regen(room.msgs.length - 1), nap(4000)]);
        await idle();
        out.regen = { same: snap() === base2, free: S.wallet.freeUsed - free0, idx: lastMsg.idx, retry: !!$("#retry") }; // 앞의 수정 실패(다시 시도 숨김)가 남지 않고 이 실패에는 다시 시도가 있음
        room.lastErr = "";
        // ④ 성공하면 전처럼: 고친 글 + 새 답, 그 뒤의 대화는 없어짐
        window.llm = window.__ok;
        await edit(i, "고친 말이에요");
        await idle();
        out.ok = { n: room.msgs.length, want: i + 2, text: room.msgs[i].text, ai: (room.msgs[i + 1] || {}).role };
        return out;
      });
      res.edit.push({ id, ...e });
      if (!e.setup) errs.push(`[${id}] 준비가 안 됨: ` + JSON.stringify(e));
      if (!e.cancel.same || e.cancel.shown !== "첫 말이에요" || !e.cancel.wall || e.cancel.draft !== "고친 말이에요")
        errs.push(`[${id}] 수정의 값 확인을 멈췄는데 대화가 바뀌거나 고쳐 쓴 글이 사라짐: ` + JSON.stringify(e.cancel));
      // 까닭은 오류 줄에도(토스트로만 지나가지 않게) — 수정의 실패라 '다시 시도'는 없음
      const failLine = e.fail.line === e.fail.want && !!e.fail.want && e.fail.shownLine.trim() === e.fail.want && !e.fail.retry;
      if (!e.fail.same || !/고치기 전/.test(e.fail.err) || !failLine || e.fail.free !== 0 || !e.fail.stored)
        errs.push(`[${id}] 수정 뒤 새 답이 실패했는데 고치기 전으로 안 돌아감: ` + JSON.stringify(e.fail));
      if (e.versions.n !== 2 || e.versions.idx !== 0 || !e.regen.same || e.regen.free !== 0 || e.regen.idx !== 0 || !e.regen.retry)
        errs.push(`[${id}] 다시 쓰기가 실패한 뒤 대화·진행·고른 버전이 달라짐: ` + JSON.stringify({ ...e.versions, ...e.regen }));
      if (e.ok.n !== e.ok.want || e.ok.text !== "고친 말이에요" || e.ok.ai !== "ai")
        errs.push(`[${id}] 수정이 성공했을 때의 모양이 다름: ` + JSON.stringify(e.ok));
    }
    // 본문 없는 답(상태 블록만 옴): '(빈 응답)'으로 저장하지 않고 실패로 — 값을 돌려주고 다시 시도할 수 있게
    res.empty = await p.evaluate(async () => {
      const { __idle: idle } = window;
      Object.assign(S.wallet, { freeUsed: 0, hearts: 0 });
      saveWallet();
      window.llm = async () => "===STATE===\n" + JSON.stringify({ status: {}, suggestions: [] });
      const n0 = room.msgs.length;
      await window.__turn("빈 답이 올 말");
      await idle();
      const last = room.msgs[room.msgs.length - 1];
      const out = {
        added: room.msgs.length - n0,
        last: last.role,
        blank: JSON.stringify(room.msgs).includes("(빈 응답)"),
        free: S.wallet.freeUsed,
        err: room.lastErr || ""
      };
      // 오는 중에 끊긴 답(받은 글이 있음 — 시간 초과든, 끝난 신호 없이 닫혔든): 글은 남기고 값은 돌려줌, '다시 시도' 안내
      out.cut = [];
      for (const code of ["timeout", "upstream_error"]) {
        window.llm = async (input, opt) => {
          opt.onText({ text: "*받다 만 글.*" });
          throw { code, text: "*받다 만 글.*" };
        };
        room.lastErr = "";
        await window.__turn("끊길 말 " + code);
        await idle();
        const cutMsg = room.msgs[room.msgs.length - 1];
        out.cut.push({
          code,
          role: cutMsg.role,
          text: cutMsg.role === "ai" ? cutMsg.alts[cutMsg.idx].text : "",
          cost: cutMsg.role === "ai" ? cutMsg.alts[cutMsg.idx].cost || "" : "?",
          free: S.wallet.freeUsed,
          err: room.lastErr || ""
        });
      }
      room.lastErr = "";
      window.llm = window.__ok;
      return out;
    });
    if (!res.empty.cut.every((c) => c.role === "ai" && c.text === "*받다 만 글.*" && !c.cost && c.free === 0 && /돌려/.test(c.err)))
      errs.push("끊긴 답의 글을 남기고 값을 돌려주는 것이 다름: " + JSON.stringify(res.empty.cut));
    if (res.empty.added !== 1 || res.empty.last !== "user" || res.empty.blank || res.empty.free !== 0 || !res.empty.err)
      errs.push("본문 없는 답이 저장되거나 값이 나감: " + JSON.stringify(res.empty));
    // 답을 쓰는 중에 방을 떠나도(프레임 7차 C10): 멈추지 않고 왼쪽 메뉴·대화 목록에 '쓰는 중', 다른 방에서는 보내지 않고 안내(생성은 한 번에 하나),
    // 돌아오면 같은 방 객체(저장본을 새로 읽으면 끝난 답이 화면에 안 오고 다음 저장이 덮음), 끝나면 화면·저장본에 답, 화면 꺼짐 방지는 쓰는 동안만
    res.away = await p.evaluate(async () => {
      const { __nap: nap, __idle: idle } = window;
      Object.assign(S.wallet, { freeUsed: 0, hearts: 0 });
      saveWallet();
      room.lastErr = "";
      const A = room,
        n0 = A.msgs.length,
        wl = { req: 0, rel: 0 };
      Object.defineProperty(navigator, "wakeLock", {
        configurable: true,
        value: { request: async () => (wl.req++, { release: async () => void wl.rel++ }) }
      });
      let release;
      const hold = new Promise((r) => (release = r));
      window.llm = async (input, opt) => {
        if (opt.json) return { suggestions: [] };
        opt.onText({ text: "*쓰는 중인 글.*" });
        await new Promise((ok, no) => {
          hold.then(ok);
          opt.signal.addEventListener("abort", () => no({ code: "cancelled", text: "*쓰는 중인 글.*" })); // 멈추면 진짜 모델처럼 끝남
        });
        const full = `*다 쓴 글.*\n\n"끝났어요."\n===STATE===\n` + JSON.stringify({ status: {}, suggestions: [] });
        opt.onText({ text: full });
        return full;
      };
      await window.__turn("떠나도 이어질 말");
      await nap(200);
      const mark = (sel) => !!document.querySelector(`${sel} [data-room="${A.id}"] .writing`);
      const out = { started: !!gen, wake: wl.req };
      location.hash = "home";
      await nap(500);
      out.home = { gen: !!gen, rail: mark("#railRecent") };
      location.hash = "chats";
      await nap(400);
      out.list = mark("#view");
      const other = ORIGINALS.find((c) => c.id !== A.char.id && !c.episode),
        B = newRoom(normalizeChar(other), 0, S.personas[0]);
      location.hash = "r-" + B.id;
      await nap(900);
      const inp = $("#inp");
      inp.value = "다른 방의 말";
      inp.oninput();
      $("#sendBtn").click();
      await nap(250);
      out.other = { room: room.id === B.id, sent: room.msgs.some((m) => m.text === "다른 방의 말"), hint: $("#hint").textContent, stop: !$("#stopBtn").hidden };
      location.hash = "r-" + A.id;
      await nap(900);
      out.back = { same: room === A, live: !!$("#liveBubble"), stop: !$("#stopBtn").hidden };
      release();
      await idle();
      const kept = await KV.get(roomKey(A.id)),
        last = A.msgs[A.msgs.length - 1];
      out.done = {
        n: A.msgs.length - n0,
        text: last.role === "ai" ? last.alts[last.idx].text : "",
        shown: ($("#logInner").textContent || "").includes("끝났어요."),
        stored: kept.msgs.length === A.msgs.length,
        rail: mark("#railRecent"),
        wake: [wl.req, wl.rel]
      };
      // 화면을 내려 둔 사이 연결이 끊긴 답: 받은 글은 남기고 값은 돌려주며, 돌아오면 '이어서'를 안내
      window.llm = async (input, opt) => {
        opt.onText({ text: "*내려 둔 사이 받은 글.*" });
        Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
        document.dispatchEvent(new Event("visibilitychange"));
        await nap(50);
        delete document.hidden;
        throw { code: "upstream_error", text: "*내려 둔 사이 받은 글.*" };
      };
      const f0 = S.wallet.freeUsed;
      await window.__turn("내려 둘 말");
      await idle();
      out.hidden = { err: room.lastErr || "", free: S.wallet.freeUsed - f0 };
      room.lastErr = "";
      delete navigator.wakeLock;
      window.llm = window.__ok;
      return out;
    });
    {
      const a = res.away;
      if (!a.started || !a.home.gen || !a.home.rail || !a.list) errs.push("답을 쓰는 중에 방을 떠나면 멈추거나 '쓰는 중' 표시가 없음: " + JSON.stringify(a));
      if (!a.other.room || a.other.sent || !/다른 대화방/.test(a.other.hint) || a.other.stop)
        errs.push("다른 방에서 답을 쓰는 중에 보내기가 됨(또는 안내·중지 버튼이 다름): " + JSON.stringify(a.other));
      if (!a.back.same || !a.back.live || !a.back.stop) errs.push("쓰는 중인 방으로 돌아왔을 때 같은 방이 아님: " + JSON.stringify(a.back));
      const d = a.done;
      if (d.n !== 2 || !/끝났어요/.test(d.text) || !d.shown || !d.stored || d.rail)
        errs.push("떠났다 돌아온 방의 답이 화면·저장본에 없음: " + JSON.stringify(d));
      if (a.wake !== 1 || d.wake[0] !== 1 || d.wake[1] !== 1)
        errs.push("화면 꺼짐 방지가 쓰는 동안만이 아님: " + JSON.stringify({ start: a.wake, end: d.wake }));
      if (!/이어서/.test(a.hidden.err) || a.hidden.free !== 0)
        errs.push("내려 둔 사이 끊긴 답에 '이어서' 안내가 없거나 값이 나감: " + JSON.stringify(a.hidden));
    }
    // 무료 턴 소진 안내에서 PLUS를 사면: 같은 방에 머물고 쓰던 글이 그대로(전에는 화면을 통째로 다시 그려 글이 사라졌음)
    res.plus = await p.evaluate(async () => {
      const { __nap: nap } = window;
      room.lastErr = "";
      Object.assign(S.wallet, { freeUsed: 999, hearts: 50, pro: null, ack: {} });
      saveWallet();
      setModel("lite");
      const id = room.id,
        inp = $("#inp");
      inp.value = "쓰던 글이에요";
      inp.oninput();
      $("#sendBtn").click();
      await nap(300);
      const asked = !!$(".overlay #toPlus");
      if (!asked) return { asked };
      $(".overlay #toPlus").click();
      await nap(200);
      $(".overlay #pay").click();
      await nap(1400);
      const doneLabel = ($(".overlay #done") || {}).textContent || "";
      $(".overlay #done").click();
      await nap(300);
      return {
        asked,
        doneLabel,
        room: room && room.id === id,
        text: $("#inp") ? $("#inp").value : null,
        pro: isPro(),
        sent: room.msgs[room.msgs.length - 1].text === "쓰던 글이에요"
      };
    });
    if (!res.plus.asked || !res.plus.room || res.plus.text !== "쓰던 글이에요" || !res.plus.pro || res.plus.sent || res.plus.doneLabel !== "대화로 돌아가기")
      errs.push("무료 소진 안내에서 PLUS를 산 뒤 대화로 돌아오지 않음: " + JSON.stringify(res.plus));
    // 깨진 로그인 복귀 주소(#access_token=잘못된 인코딩)로 열어도 부팅이 멈추지 않고 홈이 뜸 — 주소는 정리됨
    // 같은 주소를 로그인한 채로 받아도 이미 있던 세션은 그대로(던지지 않고 빈 값) — 주소의 조각만 지움
    res.badHashFn = await p.evaluate(async () => {
      const fake = { access_token: "t", refresh_token: "r", expires_at: Date.now() + 3600e3, user: { id: "u-test", email: "" } },
        was = SB.s;
      SB.s = fake;
      history.replaceState(null, "", location.pathname + "#access_token=%E0%A4%A&type=recovery");
      let type = "threw";
      try {
        type = await SB.fromHash();
      } catch {}
      const out = { type, kept: SB.s === fake, hash: location.hash };
      SB.s = was;
      return out;
    });
    if (res.badHashFn.type !== "" || !res.badHashFn.kept || res.badHashFn.hash)
      errs.push("깨진 복귀 주소가 세션을 건드리거나 던짐: " + JSON.stringify(res.badHashFn));
    const p2 = await ctx.newPage();
    const boot = [];
    p2.on("pageerror", (e) => boot.push(e.message));
    await p2.goto(url + "#access_token=%E0%A4%A&refresh_token=x", { waitUntil: "load" });
    await p2.waitForTimeout(1500);
    res.badHash = await p2.evaluate(() => ({
      shell: !!document.querySelector("#tabbar button"),
      view: (document.querySelector("#view").textContent || "").length > 50,
      loading: !!document.querySelector("#bootMsg"),
      hash: location.hash
    }));
    res.badHash.errors = boot;
    await p2.close();
    if (!res.badHash.shell || !res.badHash.view || res.badHash.loading || /access_token/.test(res.badHash.hash) || boot.length)
      errs.push("깨진 로그인 복귀 주소에서 부팅이 멈춤: " + JSON.stringify(res.badHash));
  } catch (e) {
    res.fail = String(e).slice(0, 300);
  }
  res.errs = errs;
  console.log(JSON.stringify(res));
  await b.close();
}
