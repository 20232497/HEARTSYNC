// 기본 화풍: 설정 기본값 '자동'이 작품 성향·인물 성별·표지 여부로 내장 화풍을 고르고, 같은 이름의 세트가 덮으면 그 문구·모델을 쓰며, 세트를 지우거나 '내장으로 되돌리기'를 누르면 내장으로 돌아오는지.
// ZIP 파일 이름 묶기(groupStyleFiles)·이름 → 내장 화풍 맞추기(matchBuiltin), 설정 페이지의 기본 화풍 카드·선택지, 생성 창이 ctx에 맞는 화풍 이름을 보여 주는지
import { webkit, chromium, devices } from "playwright";
const url = process.argv[2], out = process.argv[3];
const targets = [["Desktop Chrome", chromium], ["iPhone 13", webkit]];
for (const [dev, engine] of targets) {
  const b = await engine.launch(); const ctx = await b.newContext({ ...devices[dev] }); const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 140)); });
  const res = { dev };
  try {
    await p.goto(url, { waitUntil: "load" }); await p.waitForTimeout(1200);
    // 1) 자동 고르기
    res.auto = await p.evaluate(() => {
      const f = (c) => { const s = styleFor(c); return { id: s.id, model: s.model, hasPrompt: s.prompt.length > 40, name: s.name }; };
      return { setting: S.settings.imgStyle, m: f({ kind: "daily", aud: "m" }), f: f({ kind: "daily", aud: "f" }), allMale: f({ kind: "daily", aud: "all", male: true }), allFemale: f({ kind: "daily", aud: "all", male: false }),
        mw: f({ kind: "world", aud: "m" }), fw: f({ kind: "world", aud: "f" }), none: f(), anime: (() => { S.settings.imgStyle = "sys:manime"; const r = f({ kind: "daily", aud: "m" }); S.settings.imgStyle = "auto"; return r; })(),
        preset: (() => { S.settings.imgStyle = "line"; const r = f({ kind: "daily", aud: "m" }); S.settings.imgStyle = "auto"; return r; })() };
    });
    // 2) 파일 이름 묶기와 내장 화풍 맞추기
    res.group = await p.evaluate(() => {
      const files = ["프롬1_남성향_일상1.png", "프롬1_남성향_일상2.png", "프롬1_남성향_일상10.png", "프롬2_남성향_애니1.png", "프롬2_여성향_세계관표지3.png", "프롬3_남성향_세계관표지 (2).png", "프롬1_여성향_일상7.png"].map((name) => ({ name }));
      return groupStyleFiles(files).map((g) => ({ name: g.name, n: g.files.length, over: matchBuiltin(g.name) }));
    });
    // 3) 세트로 덮어쓰기 → 설정 페이지 → 지우기 → 내장으로 복귀
    await p.evaluate(() => { S.settings.styleSets = [{ id: "t1", name: "프롬1_남성향_일상", refs: [], prompt: "my test style tags", model: IMG_MODELS[1].id, overrides: matchBuiltin("프롬1_남성향_일상") }]; saveSettings(); location.hash = "me"; });
    await p.waitForTimeout(800);
    res.over = await p.evaluate(() => { const s = styleFor({ kind: "daily", aud: "m" }), untouched = styleFor({ kind: "daily", aud: "f" });
      return { prompt: s.prompt, model: s.model, name: s.name, fPromptUntouched: untouched.prompt.length > 40 && untouched.prompt !== "my test style tags",
        optionText: [...document.querySelectorAll("#gstyle option")].find((o) => o.value === "sys:mdaily")?.textContent || "", autoSelected: document.querySelector("#gstyle").value,
        cards: document.querySelectorAll("#bsets .bset").length, pill: !!document.querySelector('#bsets .bset[data-bset="mdaily"] .pill'), overSel: document.querySelector('[data-sover="t1"]')?.value }; });
    await p.evaluate(() => document.querySelector('[data-bres="mdaily"]').click()); await p.waitForTimeout(300);
    res.restore = await p.evaluate(() => ({ prompt: styleFor({ kind: "daily", aud: "m" }).prompt !== "my test style tags", setKept: S.settings.styleSets.length === 1 && !S.settings.styleSets[0].overrides }));
    await p.evaluate(() => { const sel = document.querySelector('[data-sover="t1"]'); sel.value = "mworld"; sel.onchange(); }); await p.waitForTimeout(300);
    res.reassign = await p.evaluate(() => ({ world: styleFor({ kind: "world", aud: "m" }).prompt === "my test style tags", daily: styleFor({ kind: "daily", aud: "m" }).prompt !== "my test style tags" }));
    await p.evaluate(() => { S.settings.imgStyle = "set:t1"; saveSettings(); document.querySelector('[data-sdel="t1"]').click(); }); await p.waitForTimeout(300);
    res.del = await p.evaluate(() => ({ sets: S.settings.styleSets.length, setting: S.settings.imgStyle, world: styleFor({ kind: "world", aud: "m" }).prompt.length > 40 && styleFor({ kind: "world", aud: "m" }).prompt !== "my test style tags" }));
    // 4) 생성 창은 ctx에 맞는 화풍 이름을 보여 줌
    await p.evaluate(() => genImageSheet({ title: "시험", prompt: "1boy", ctx: { kind: "world", aud: "f" } })); await p.waitForTimeout(300);
    res.sheet = await p.evaluate(() => { const t = document.querySelector(".gen-auto .note")?.textContent || ""; closeOverlays(); return t; });
    await p.screenshot({ path: `${out}/${dev.replace(/\W+/g, "_")}_styles.png` });
  } catch (e) { res.fail = String(e).slice(0, 300); }
  const bad = [], a = res.auto;
  if (a && !(a.setting === "auto" && a.m.id === "sys:mdaily" && a.f.id === "sys:fdaily" && a.allMale.id === "sys:fdaily" && a.allFemale.id === "sys:mdaily" && a.mw.id === "sys:mworld" && a.fw.id === "sys:fworld" && a.none.id === "sys:mdaily" && a.m.hasPrompt && a.fw.hasPrompt && a.anime.id === "sys:manime" && a.anime.model !== a.m.model && a.preset.id === "line")) bad.push("auto " + JSON.stringify(a));
  if (res.group && !(res.group.length === 5 && res.group.find((g) => g.name === "프롬1_남성향_일상")?.n === 3 && res.group.find((g) => g.name === "프롬1_남성향_일상")?.over === "mdaily" && res.group.find((g) => g.over === "manime") && res.group.find((g) => g.over === "fworld") && res.group.find((g) => g.name === "프롬3_남성향_세계관표지")?.over === "mworld" && res.group.find((g) => g.over === "fdaily"))) bad.push("group " + JSON.stringify(res.group));
  if (res.over && !(res.over.prompt === "my test style tags" && res.over.model && res.over.name.includes("내 세트") && res.over.fPromptUntouched && res.over.optionText.includes("덮음") && res.over.autoSelected === "auto" && res.over.cards === 5 && res.over.pill && res.over.overSel === "mdaily")) bad.push("over " + JSON.stringify(res.over));
  if (res.restore && !(res.restore.prompt && res.restore.setKept)) bad.push("restore " + JSON.stringify(res.restore));
  if (res.reassign && !(res.reassign.world && res.reassign.daily)) bad.push("reassign " + JSON.stringify(res.reassign));
  if (res.del && !(res.del.sets === 0 && res.del.setting === "auto" && res.del.world)) bad.push("del " + JSON.stringify(res.del));
  if (res.sheet !== undefined && !/프롬2 여성향 세계관/.test(res.sheet)) bad.push("sheet " + res.sheet);
  res.errs = errs.concat(bad); console.log(JSON.stringify(res)); await b.close();
}
