// 채팅 흐름: 자동 스크롤 끔/켬, 추천 답변 수동, 출력 설정 카드, 설정 페이지(이미지 기본 수위 칸 없음)
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
    await p.evaluate(() => { room.set.autoScroll = true; saveRoom(room); });
    res.on = await turn("두 번째 입력");
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
