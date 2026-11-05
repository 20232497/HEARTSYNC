// HeartVerse mobile smoke test: WebKit (iPhone) + Chromium (Android) on given URLs
import { webkit, chromium, devices } from "playwright";
import { noSupabase } from "./_offline.mjs";
const [, , ...urls] = process.argv;
const out = process.env.SHOT_DIR;
const targets = [["iPhone 13", webkit], ["iPhone SE", webkit], ["Galaxy S9+", chromium]];
for (const url of urls) {
  for (const [dev, engine] of targets) {
    const browser = await engine.launch();
    const ctx = await browser.newContext({ ...devices[dev] }); await noSupabase(ctx);
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
    page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 160)); });
    const res = { url, dev };
    try {
      await page.goto(url, { waitUntil: "load", timeout: 30000 });
      await page.waitForTimeout(1500);
      const check = async (label) => {
        const r = await page.evaluate(() => ({
          mode: document.compatMode,
          bootMsg: !!document.getElementById("bootMsg") && document.getElementById("bootMsg").textContent,
          viewLen: (document.getElementById("view") || {}).innerHTML?.length || 0,
          viewH: Math.round(document.getElementById("view")?.getBoundingClientRect().height || 0),
          overflowX: document.documentElement.scrollWidth - innerWidth,
          tabbar: getComputedStyle(document.getElementById("tabbar")).display,
        }));
        res[label] = r;
      };
      await check("home");
      if (out) await page.screenshot({ path: `${out}/${dev.replace(/\W+/g, "_")}_${url.includes("github.io") ? "live" : "fixed"}_home.png` });
      await page.evaluate(() => { location.hash = "me"; }); await page.waitForTimeout(600); await check("me");
      await page.evaluate(() => { const c = ORIGINALS[0]; location.hash = "c-" + c.id; }); await page.waitForTimeout(600); await check("detail");
      await page.evaluate(() => { const r = newRoom(normalizeChar(ORIGINALS[0]), 0, S.personas[0]); location.hash = "r-" + r.id; }); await page.waitForTimeout(900); await check("chat");
      res.chatInput = await page.evaluate(() => { const i = document.getElementById("inp"); if (!i) return "no input"; const r = i.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight }; });
      if (out) await page.screenshot({ path: `${out}/${dev.replace(/\W+/g, "_")}_${url.includes("github.io") ? "live" : "fixed"}_chat.png` });
    } catch (e) { res.fail = String(e).slice(0, 200); }
    res.errors = errors;
    console.log(JSON.stringify(res));
    await browser.close();
  }
}
