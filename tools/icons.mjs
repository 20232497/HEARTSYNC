// 앱 아이콘 내보내기 — icons/src의 SVG 원본을 배포용 PNG 세 개(파비콘 32·홈 화면 192·아이폰 180)로 그림(Playwright Chromium).
// 쓰는 법: node tools/icons.mjs (아이콘을 고칠 때만 — 빌드와 무관)
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = createRequire(import.meta.url)("playwright");
const b = await chromium.launch();
const p = await b.newPage({ deviceScaleFactor: 1 });
const jobs = [
  ["favicon.svg", "favicon-32.png", 32, "22%"],
  ["app-icon.svg", "icon-192.png", 192, "22%"],
  ["app-icon.svg", "apple-touch-icon.png", 180, "0"] // iOS가 모서리를 깎으므로 불투명 정사각
];
for (const [src, out, s, r] of jobs) {
  const svg = readFileSync(join(repo, "icons/src", src), "utf8");
  await p.setViewportSize({ width: s, height: s });
  await p.setContent(
    `<style>html,body{margin:0;background:transparent}div{width:${s}px;height:${s}px;border-radius:${r};overflow:hidden}svg{display:block;width:100%;height:100%}</style><div>${svg}</div>`
  );
  await p.screenshot({ path: join(repo, "icons", out), omitBackground: r !== "0" });
}
await b.close();
