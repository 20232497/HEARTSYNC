// 관심있는 대화(전체·남성향·여성향) 흐름 시험: 첫 시작 창 → 고르기 → 홈 필터 → 설정 → 신작 대화방
import { webkit, chromium, devices } from "playwright";
const [, , url, out] = process.argv;
const targets = [["Desktop Chrome", chromium], ["iPhone SE", webkit], ["Galaxy S9+", chromium]];
for (const [dev, engine] of targets) {
  const browser = await engine.launch();
  const ctx = await browser.newContext({ ...devices[dev] });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 160)); });
  const res = { dev };
  const tag = dev.replace(/\W+/g, "_");
  try {
    await page.goto(url, { waitUntil: "load" });
    await page.waitForTimeout(1200);
    res.loginFirst = await page.evaluate(() => location.hash);
    await page.click("#lguest"); await page.waitForTimeout(400);
    res.sheet = await page.evaluate(() => ({ open: !!document.querySelector(".overlay [data-aud]"), saved: S.settings.audience }));
    if (out) await page.screenshot({ path: `${out}/${tag}_aud_sheet.png` });
    await page.click(".overlay [data-aud=f]");
    await page.waitForTimeout(500);
    const home = () => page.evaluate(() => ({
      aud: S.settings.audience, sheetGone: !document.querySelector(".overlay"),
      hero: [...document.querySelectorAll(".hero-card")].map((b) => b.dataset.char),
      rows: [...document.querySelectorAll("h2.sec")].map((h) => h.firstChild.textContent.trim()),
      grid: [...document.querySelectorAll(".grid .card")].map((b) => b.dataset.char),
      overflowX: document.documentElement.scrollWidth - innerWidth
    }));
    res.f = await home();
    if (out) await page.screenshot({ path: `${out}/${tag}_home_f.png`, fullPage: true });
    await page.click("#view [data-aud=m]"); await page.waitForTimeout(400);
    res.m = await home();
    await page.click("#view [data-aud=all]"); await page.waitForTimeout(400);
    res.all = await home();
    res.allTags = await page.evaluate(() => [...document.querySelectorAll(".aud-tag")].length);
    // 새로고침해도 유지, 창은 다시 안 뜸
    await page.reload({ waitUntil: "load" }); await page.waitForTimeout(1000);
    res.reload = await page.evaluate(() => ({ aud: S.settings.audience, sheet: !!document.querySelector(".overlay") }));
    // 설정에서 바꾸기
    await page.evaluate(() => { location.hash = "me"; }); await page.waitForTimeout(500);
    await page.click("#view [data-aud=f]"); await page.waitForTimeout(300);
    res.me = await page.evaluate(() => ({ aud: S.settings.audience, on: document.querySelector("#view [data-aud].on")?.dataset.aud }));
    // 신작 세 편: 상세·대화방 첫 장면
    res.works = await page.evaluate(() => ["hwanghu", "hasuk", "lethe"].map((id) => {
      const c = normalizeChar(getChar(id));
      return { id, aud: audOf(c), cast: c.cast.length, open: c.openings.length, lore: c.lore.length, minor: (typeof minorFlags === "function" ? minorFlags(c) : []).length,
        imgs: c.openings.map((o) => (o.text.match(/\[\[img:/g) || []).length), gender: guessAud(c) };
    }));
    await page.evaluate(() => { location.hash = "c-hwanghu"; }); await page.waitForTimeout(500);
    if (out) await page.screenshot({ path: `${out}/${tag}_detail.png` });
    await page.evaluate(() => { const r = newRoom(normalizeChar(getChar("lethe")), 0, S.personas[0]); location.hash = "r-" + r.id; }); await page.waitForTimeout(900);
    res.chat = await page.evaluate(() => ({ figs: document.querySelectorAll("#log figure, #log .scene-img").length, text: (document.querySelector("#log")?.innerText || "").slice(0, 60), overflowX: document.documentElement.scrollWidth - innerWidth }));
    if (out) await page.screenshot({ path: `${out}/${tag}_chat.png` });
    // 시드니 seoulzero는 없어야
    res.seoulzero = await page.evaluate(() => !!getChar("seoulzero"));
  } catch (e) { res.fail = String(e).slice(0, 300); }
  res.errors = errors;
  console.log(JSON.stringify(res));
  await browser.close();
}
