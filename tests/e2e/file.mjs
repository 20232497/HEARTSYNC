// 파일(file://)로 열어도 돈다: 저장소 루트의 index.html을 Chromium·WebKit에서 file:// 로 열어 부팅(bootMsg 사라짐)·홈(전체·여성향·남성향의 대표 작품·가로 줄)·상세 페이지를 확인.
// 배포물이 단일 파일이어야 하는 이유가 이 모드(BYOK) — 모듈 파일로 나뉘면 CORS로 막혀 여기서 깨진다. 인자 URL은 받지만 쓰지 않음(runner 규약).
import { chromium, webkit } from "playwright";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const file = pathToFileURL(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "index.html")).href;
for (const [dev, engine] of [["Chromium file://", chromium], ["WebKit file://", webkit]]) {
  const b = await engine.launch(); const p = await b.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push("pageerror: " + e.message)); p.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 160)); });
  const res = { dev };
  try {
    await p.goto(file, { waitUntil: "load" }); await p.waitForTimeout(1200);
    res.boot = await p.evaluate(() => document.getElementById("bootMsg") ? document.getElementById("bootMsg").textContent : null);
    if (res.boot) errs.push("bootMsg가 남아 있음: " + res.boot);
    if (await p.$("#lguest")) { await p.click("#lguest"); await p.waitForTimeout(300); }
    for (const aud of ["all", "f", "m"]) {
      res[aud] = await p.evaluate((aud) => {
        setAudience(aud); closeOverlays(); location.hash = "home"; viewHome();
        return { hero: $$(".hero-card").map((x) => x.dataset.char), rows: $$(".row-scroll").map((rw) => $$("[data-char]", rw).length), grid: $$(".grid")[0] ? $$("[data-char]", $$(".grid")[0]).length : 0 };
      }, aud);
      if (res[aud].hero.length !== 4) errs.push(`${aud}: 대표 작품이 4개가 아님(${res[aud].hero.length})`);
    }
    if (res.f.hero.some((id) => res.m.hero.includes(id))) errs.push("여성향·남성향 대표 작품이 겹침");
    res.detail = await p.evaluate(async () => { location.hash = "c-godseats"; await new Promise((z) => setTimeout(z, 300)); return $("#view").textContent.includes("신님들, 관전 매너 좀"); });
    if (!res.detail) errs.push("상세 페이지가 안 그려짐");
  } catch (e) { res.fail = String(e).slice(0, 400); }
  res.errs = errs;
  console.log(JSON.stringify(res));
  await b.close();
}
