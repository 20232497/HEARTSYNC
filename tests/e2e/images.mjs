// 그림 조합 코드: [[img:코드:3,404,501]] 태그 그리기(figure[data-key]), 의상·장소 이어 가기·되돌리기(400·500), AI가 태그를 빠뜨린 인물의 자동 태그(지문의 장소 낱말),
// 대화 중 자동 생성(가짜 runwareImage → 캔버스 PNG, 같은 조합은 다시 만들지 않음), 조합 갤러리·조합 만들기·코드 표·드로어 갤러리
import { webkit, chromium, devices } from "playwright";
const url = process.argv[2], out = process.argv[3];
const targets = [["Desktop Chrome", chromium], ["iPhone 13", webkit]];
for (const [dev, engine] of targets) {
  const b = await engine.launch(); const ctx = await b.newContext({ ...devices[dev] }); const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 140)); });
  const res = { dev };
  try {
    await p.goto(url, { waitUntil: "load" }); await p.waitForTimeout(1200);
    const code = await p.evaluate(() => { const r = newRoom(normalizeChar(ORIGINALS.find((c) => c.id === "godseats")), 0, S.personas[0]); location.hash = "r-" + r.id; return r.char.cast[0].code; });
    res.code = code;
    await p.waitForTimeout(900);
    // 가짜 llm: window.__body를 본문으로 돌려주고, 시스템 프롬프트를 남김
    await p.evaluate(() => {
      window.llm = async (input, { onText }) => {
        window.__lastInput = input;
        const full = window.__body + "\n===STATE===\n" + JSON.stringify({ status: {}, suggestions: ["하나", "둘", "셋"] });
        onText({ text: full.slice(0, 40) }); await new Promise((r) => setTimeout(r, 60)); onText({ text: full });
        return full;
      };
    });
    const turn = async (body, text = "입력") => p.evaluate(async ([body, text]) => {
      window.__body = body;
      room.msgs.push({ id: uid("m"), role: "user", text });
      await generate(null, quote(room.set));
      const ai = lastAi(room), sys = window.__lastInput[0].content;
      return { text: curText(ai), figs: $$("#logInner figure.scene-img").map((f) => ({ code: f.dataset.code, key: f.dataset.key, img: !!f.querySelector("img") })), rw: window.__rw || 0,
        sysHasDims: /의상 번호: 400 기본 의상/.test(sys) && /장소 번호: 500 기본 배경/.test(sys), nowLine: (sys.match(/지금 이어지는 의상·장소: ([^\n]+)/) || [])[1] || "" };
    }, [body, text]);
    const name = await p.evaluate(() => room.char.cast[0].name);
    // 1) 조합 태그 그대로 저장되고 figure에 조합 키가 붙음(그림은 없어 아트 카드)
    const t1 = await turn(`*바람이 불었다.*\n\n[[img:${code}:3,404,501]]\n\n${name}: "첫 대사예요."`);
    res.t1 = { tag: t1.text.includes(`[[img:${code}:3,404,501]]`), fig: t1.figs.some((f) => f.code === code && f.key === "3,404,501" && !f.img), sysHasDims: t1.sysHasDims };
    // 2) 감정만 쓰면 의상·장소가 이어지고, 시스템 프롬프트에 지금 의상·장소가 보임
    const t2 = await turn(`[[img:${code}:2]]\n\n${name}: "두 번째 대사예요."`);
    res.t2 = { tag: t2.text.includes(`[[img:${code}:2,404,501]]`), nowLine: t2.nowLine };
    // 3) 400으로 의상을 되돌리면 장소만 남음
    const t3 = await turn(`[[img:${code}:5,400]]\n\n${name}: "세 번째 대사예요."`);
    res.t3 = { tag: t3.text.includes(`[[img:${code}:5,501]]`) };
    // 4) 태그를 빠뜨리면 자동으로 붙이고, 지문의 장소 낱말(소파 → 503)을 읽음
    const t4 = await turn(`*${name}은 소파에 털썩 앉았다.*\n\n${name}: "네 번째 대사예요. 소파가 편하네요."`);
    res.t4 = { tag: new RegExp(`\\[\\[img:${code}:\\d+,503\\]\\]`).test(t4.text), text: t4.text.slice(0, 60) };
    // 5) 자동 생성: 가짜 runwareImage(캔버스 PNG). 없는 조합만 한 번 만들고 그 자리를 그림으로 바꿈. 500으로 장소(503)를 되돌려 키는 7,404
    await p.evaluate(() => {
      S.settings.autoImg = true; S.settings.runwareKey = "test-key"; window.__rw = 0;
      window.runwareImage = async () => { window.__rw++; const cv = document.createElement("canvas"); cv.width = cv.height = 8; const g = cv.getContext("2d"); g.fillStyle = "#f06292"; g.fillRect(0, 0, 8, 8); return new Promise((r) => cv.toBlob(r, "image/png")); };
    });
    const t5 = await turn(`[[img:${code}:7,404,500]]\n\n${name}: "다섯 번째 대사예요."`);
    const swapped = await p.waitForFunction((code) => { const f = document.querySelector(`#logInner figure.scene-img[data-code="${code}"][data-key="7,404"]`); return !!(f && f.querySelector("img")); }, code, { timeout: 10000 }).then(() => true).catch(() => false);
    res.t5 = { tagKey: t5.text.includes(`[[img:${code}:7,404]]`), swapped, rw: await p.evaluate(() => window.__rw), stored: await p.evaluate((code) => validRef((imagesOf(room.char)[code] || {})["7,404"]), code) };
    // 6) 같은 조합은 다시 만들지 않고 바로 그림이 보임
    const t6 = await turn(`[[img:${code}:7,404]]\n\n${name}: "여섯 번째 대사예요."`);
    await p.waitForTimeout(600);
    res.t6 = { rw: await p.evaluate(() => window.__rw), imgNow: t6.figs.filter((f) => f.key === "7,404").every((f) => f.img), fallback: await p.evaluate((code) => pickImg(room.char, code, "7,404,503") === (imagesOf(room.char)[code] || {})["7,404"] ? "same-act-only" : "other", code) };
    // 7) 이미지 슬롯: 조합 카드·코드 표·조합 만들기
    await p.evaluate(() => openImageSlots(room.char)); await p.waitForTimeout(500);
    res.slots = await p.evaluate(() => ({ combo: !!document.querySelector('[data-combo="7,404"]'), codes: !!document.querySelector("#codes"), grid: $$(".slot-grid .slot").length }));
    await p.evaluate(() => $("#codes").click()); await p.waitForTimeout(300);
    res.codeTable = await p.evaluate(() => ({ tables: $$(".code-tbl").length, rows: $$(".code-tbl tr").length, ov: $$(".btn[data-ov]").length }));
    await p.evaluate(() => { $$(".gen-ov").forEach((o) => o.remove()); $("#addCombo").click(); }); await p.waitForTimeout(300);
    res.combo = await p.evaluate(() => { $("#cbW").value = "404"; $("#cbW").onchange(); return { sel: !!document.querySelector("#cbA"), key: $("#cbKey").textContent }; });
    await p.screenshot({ path: `${out}/${dev.replace(/\W+/g, "_")}_images.png` });
    await p.evaluate(() => { closeOverlays(); openRoomDrawer("gallery"); }); await p.waitForTimeout(400);
    res.gallery = await p.evaluate(() => $$(".gallery button").length);
    await p.evaluate(() => closeOverlays());
  } catch (e) { res.fail = String(e).slice(0, 300); }
  const bad = [];
  if (res.t1 && !(res.t1.tag && res.t1.fig && res.t1.sysHasDims)) bad.push("t1 " + JSON.stringify(res.t1));
  if (res.t2 && !(res.t2.tag && /오피스룩·침실/.test(res.t2.nowLine))) bad.push("t2 " + JSON.stringify(res.t2));
  if (res.t3 && !res.t3.tag) bad.push("t3 " + JSON.stringify(res.t3));
  if (res.t4 && !res.t4.tag) bad.push("t4 " + JSON.stringify(res.t4));
  if (res.t5 && !(res.t5.tagKey && res.t5.swapped && res.t5.rw === 1 && res.t5.stored)) bad.push("t5 " + JSON.stringify(res.t5));
  if (res.t6 && !(res.t6.rw === 1 && res.t6.imgNow)) bad.push("t6 " + JSON.stringify(res.t6));
  if (res.slots && !(res.slots.combo && res.slots.codes)) bad.push("slots " + JSON.stringify(res.slots));
  if (res.codeTable && !(res.codeTable.tables === 3 && res.codeTable.rows > 60 && res.codeTable.ov > 0)) bad.push("codeTable " + JSON.stringify(res.codeTable));
  if (res.combo && !(res.combo.sel && res.combo.key.includes("1,404"))) bad.push("combo " + JSON.stringify(res.combo));
  if (res.gallery !== undefined && res.gallery < 1) bad.push("gallery " + res.gallery);
  res.errs = errs.concat(bad); console.log(JSON.stringify(res)); await b.close();
}
