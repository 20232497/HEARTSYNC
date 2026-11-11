// 에피소드형 작품: 상세(시작 칸이 위로·에피소드 안내·모은 결말 ???·세계관 일러스트 접힘) → 대화방 장 막대 → 갈림길 카드 → 결말 카드(입력창 숨김·모은 결말) → 외전 방,
// 대화 목록의 '결말'·'외전' 표시, 홈 카드의 '에피소드'와 인원(폼 빼고). AI는 가짜(llm을 바꿔 끼움) — 진행은 앱이 정하므로 턴 수만 당겨 놓고 돌림
import { webkit, chromium, devices } from "playwright";
import { noSupabase } from "./_offline.mjs";
const url = process.argv[2], out = process.argv[3];
const targets = [["iPhone 13", webkit], ["Galaxy S9+", chromium]];
for (const [dev, engine] of targets) {
  const b = await engine.launch(); const ctx = await b.newContext({ ...devices[dev] }); await noSupabase(ctx); const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 140)); });
  const res = { dev };
  const settle = () => p.waitForFunction(() => !gen, null, { timeout: 15000 }).then(() => p.waitForTimeout(250));
  try {
    await p.goto(url, { waitUntil: "load" }); await p.waitForTimeout(1200);
    await p.evaluate(() => { closeOverlays(); S.settings.audience = "all"; location.hash = "c-daeyeon"; }); await p.waitForTimeout(700);
    // 상세: 시작 버튼이 등장인물·도감보다 위, 에피소드 안내와 결말 ???, 세계관 일러스트는 접힌 칸
    res.detail = await p.evaluate(() => {
      const top = (el) => el ? el.getBoundingClientRect().top + $("#view").scrollTop : -1, start = $("#start");
      return { label: start.textContent, info: !!$(".ep-info"), names: $$(".ep-info .ep-ends span").map((s) => s.textContent).join("|"), want: ORIGINALS.find((c) => c.id === "daeyeon").episode.endings.map((x) => x.title).join("|"), ends: ORIGINALS.find((c) => c.id === "daeyeon").episode.endings.length,
        startTop: Math.round(top(start)), castTop: Math.round(top($(".cast"))), screens: +(top(start) / innerHeight).toFixed(2), art: $("#wArtBox") ? $("#wArtBox").tagName + ($("#wArtBox").open ? " open" : "") : "" };
    });
    { const d = res.detail; if (d.label !== "에피소드 시작" || !d.info || d.names !== d.want || !(d.startTop < d.castTop) || (d.art && d.art !== "DETAILS")) errs.push("상세가 다름: " + JSON.stringify(d)); }
    await p.screenshot({ path: `${out}/${dev.replace(/\W+/g, "_")}_episode_detail.png` });
    await p.evaluate(() => $("#start").click()); await p.waitForTimeout(900);
    res.bar = await p.evaluate(() => ({ hidden: $("#epBar").hidden, text: $("#epBar").textContent, ep: !!room.ep }));
    if (res.bar.hidden || !res.bar.text.includes("1장 / 4") || !res.bar.ep) errs.push("장 막대가 다름: " + JSON.stringify(res.bar));
    // 가짜 llm: 늘 '이 장을 이뤘다'(_ep.done)고 알림 · 하트는 넉넉히
    await p.evaluate(() => {
      S.wallet.hearts = 99999; S.wallet.ack["m-" + room.set.model] = true; S.wallet.ack["lite-" + new Date().toISOString().slice(0, 10)] = true;
      window.llm = async (input, { onText, json }) => {
        if (json) return "{}";
        window.__lastInput = input;
        const full = `*옥사의 등잔이 흔들렸다.*\n\n설련: "움직여. 시간이 없어."\n===STATE===\n` + JSON.stringify({ status: { "⚠️ 위험도": 40 }, suggestions: ["하나", "둘", "셋"], _ep: { done: true } });
        onText({ text: full }); return full;
      };
    });
    // 셋째 장 바로 앞까지 당겨 놓고 한 턴 → 갈림길 카드
    await p.evaluate(() => { room.ep = { ...room.ep, t: 14, beat: 2 }; saveRoom(room); renderLog(true); sendTurn("단서를 모아 본다"); }); await settle();
    res.choice = await p.evaluate(() => ({ ask: room.ep.ask, opts: $$(".ep-choice .ep-opt").length, composer: getComputedStyle($(".composer")).display !== "none" }));
    if (res.choice.ask !== "truth" || res.choice.opts !== 4 || !res.choice.composer) errs.push("갈림길이 다름: " + JSON.stringify(res.choice));
    await p.evaluate(() => document.querySelector('.ep-opt[data-pick="bargain"]').click()); await settle();
    res.picked = await p.evaluate(() => ({ pick: room.ep.picks.truth, beat: room.ep.beat, bar: $("#epBar").textContent, said: room.msgs[room.msgs.length - 2].text, card: !!$(".ep-choice"), sent: window.__lastInput[0].content.includes("→ 진상을 쥐고 권력자와 거래한다") }));
    if (res.picked.pick !== "bargain" || res.picked.beat !== 3 || !res.picked.bar.includes("4장 / 4") || res.picked.said !== "진상을 쥐고 권력자와 거래한다" || res.picked.card || !res.picked.sent) errs.push("고른 뒤가 다름: " + JSON.stringify(res.picked));
    // 마지막 장 마감 턴 → 결말을 정함 → 다음 응답이 결말 장면 → 끝
    await p.evaluate(() => { room.ep = { ...room.ep, t: 31 }; saveRoom(room); sendTurn("해 질 녘을 기다린다"); }); await settle();
    res.near = await p.evaluate(() => ({ end: room.ep.end, over: room.ep.over, bar: $("#epBar").textContent }));
    if (res.near.end !== "survival" || res.near.over || !res.near.bar.includes("결말에 다가가는 중")) errs.push("결말 앞이 다름: " + JSON.stringify(res.near));
    await p.evaluate(() => sendTurn("마지막으로 말한다")); await settle();
    res.end = await p.evaluate(() => {
      const a = room.msgs[room.msgs.length - 1];
      return { over: room.ep.over, card: !!$(".ep-end"), title: ($(".ep-end .ep-title") || {}).textContent, chips: $$(".ep-end .ep-ends span").length, seen: $$(".ep-end .ep-ends span.on").map((s) => s.textContent).join(), hidden: $("#view").textContent.includes("???"), composer: getComputedStyle($(".composer")).display,
        prompt: window.__lastInput[0].content.includes("이번 응답으로 이야기를 끝낸다"), shelf: (S.shelf.ends.daeyeon || []).join(), ep1: !!(a.alts[a.idx].ep1 && a.alts[a.idx].ep1.over), ep0: !!a.ep0, again: sendTurnBlocked() };
      function sendTurnBlocked() { return room.ep.over; }
    });
    if (!res.end.over || !res.end.card || res.end.title !== "생존 · 덮어 둔 진상" || res.end.chips !== 5 || res.end.seen !== "✓ 생존 · 덮어 둔 진상" || res.end.hidden || res.end.composer !== "none" || !res.end.prompt || res.end.shelf !== "survival" || !res.end.ep1 || !res.end.ep0) errs.push("결말 카드가 다름: " + JSON.stringify(res.end));
    await p.evaluate(() => $(".ep-end").scrollIntoView({ block: "center" })); await p.waitForTimeout(200);
    await p.screenshot({ path: `${out}/${dev.replace(/\W+/g, "_")}_episode_end.png` });
    // 외전: 다른 인물과 다시 → 새 자유 대화방(장 막대 없음·입력창 보임·구분 표시·첫 추천)
    res.side = await p.evaluate(async () => {
      const nap = (ms) => new Promise((r) => setTimeout(r, ms)), src = room.id, n0 = S.rooms.length, cast = room.char.cast.filter((x) => !x.of)[1];
      $("#epSide").click(); await nap(200);
      const kinds = $$(".overlay .side-kind").length, first = document.querySelector('.overlay .side-kind[aria-checked="true"]').dataset.k, whoHidden0 = $("#sideWho").hidden;
      document.querySelector('.overlay [data-k="after"]').click(); const whoAfter = $("#sideWho").hidden;
      document.querySelector('.overlay [data-k="pov"]').click(); document.querySelector(`.overlay [data-who="${cast.code}"]`).click();
      const whoHidden1 = $("#sideWho").hidden; $("#sideGo").click(); await nap(900);
      return { kinds, first, whoHidden0, whoAfter, whoHidden1, moved: room.id !== src && location.hash === "#r-" + room.id, rooms: S.rooms.length - n0, ep: room.ep === undefined, kind: room.side && room.side.kind, recap: rulesParts(room).fixed.includes("에피소드에서 있었던 일"), who: room.side && room.side.who === cast.code,
        opening: room.opening === "외전 · " + cast.name + "의 시점", bar: $("#epBar").hidden, composer: getComputedStyle($(".composer")).display !== "none", pill: !!$(".side-pill"), sug: (room.msgs[room.msgs.length - 1].alts[0].suggestions || []).length,
        fixed: (rulesParts(room).fixed.match(/\[외전 — 그 인물의 눈으로 다시 보기 · /) || []).length };
    });
    { const s = res.side; if (s.kinds !== 3 || s.first !== "talk" || s.whoHidden0 || !s.whoAfter || !s.recap || s.whoHidden1 || !s.moved || s.rooms !== 1 || !s.ep || s.kind !== "pov" || !s.who || !s.opening || !s.bar || !s.composer || !s.pill || s.sug !== 3 || s.fixed !== 1) errs.push("외전이 다름: " + JSON.stringify(s)); }
    await p.evaluate(() => { location.hash = "chats"; }); await p.waitForTimeout(600);
    res.chats = await p.evaluate(() => { const t = $("#view").textContent; return { end: t.includes("결말"), side: t.includes("외전") }; });
    if (!res.chats.end || !res.chats.side) errs.push("대화 목록 표시가 다름: " + JSON.stringify(res.chats));
    await p.evaluate(() => { location.hash = "home"; }); await p.waitForTimeout(700);
    res.card = await p.evaluate(() => { const c = document.querySelector('.card[data-char="daeyeon"] .cast-n'), g = document.querySelector('.card[data-char="geumseo"] .cast-n'); return { daeyeon: c && c.textContent, geumseo: g && g.textContent }; });
    if (!res.card.daeyeon || !res.card.daeyeon.includes("에피소드") || !res.card.daeyeon.includes("5인") || (res.card.geumseo && res.card.geumseo.includes("10인"))) errs.push("홈 카드가 다름: " + JSON.stringify(res.card));
  } catch (e) { res.fail = String(e).slice(0, 300); }
  res.errs = errs; console.log(JSON.stringify(res)); await b.close();
}
