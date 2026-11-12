// 작품 완성도 보고서(npm run content:report): 작품마다 뼈대 칸이 얼마나 채워졌는지 한 표로 — 설정 글자 수·키워드북·시작 상황·장소·컷씬·명령어·가이드·첫 답변 추천·배경 장소·그림 수.
// 기준(BASE)보다 얕은 칸에는 ▽를 붙이고 맨 아래에 작품별 얕은 칸을 모아 적는다. 검사가 아니라 안내 — 늘 exit 0(빌드 규칙은 tools/build.mjs).
// 데이터는 빌드가 만든 src/js/content/generated.js(앱이 보는 것과 같은 ORIGINALS)에서 읽으므로 먼저 npm run build. 의존성 없음.
//   node tools/content-report.mjs          표(마크다운)
//   node tools/content-report.mjs --json   숫자만 JSON으로(앞뒤 비교용)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
/* 이보다 얕으면 ▽ — 작품을 '틀이 다 쓰이는 상태'로 보는 최소선(군상극·1:1 공통). 값을 바꾸면 보고서만 달라짐 */
export const BASE = { setting: 800, lore: 5, openings: 2, places: 3, cuts: 2, commands: 2, guide: 1, suggest: 1, place: 1 };
const COLS = [
  ["setting", "설정(자)"],
  ["lore", "키워드북"],
  ["openings", "시작 상황"],
  ["places", "장소"],
  ["cuts", "컷씬"],
  ["commands", "명령어"],
  ["guide", "가이드(자)"],
  ["suggest", "첫 답변 추천"],
  ["place", "배경 장소"],
  ["images", "그림"]
];
const len = (v) => (typeof v === "string" ? v.length : 0),
  list = (v) => (Array.isArray(v) ? v : []);

/** 작품 하나의 숫자들. suggest·place는 그 칸을 적은 시작 상황의 수, images는 실린 그림 수. @param {object} c */
export function measure(c) {
  const ops = list(c.openings),
    img = c.images || {};
  return {
    id: c.id,
    title: c.title,
    aud: c.aud || "",
    cast: list(c.cast).filter((x) => !x.of).length,
    forms: list(c.cast).filter((x) => x.of).length,
    setting: len(c.persona) + len(c.world) + len(c.speech) + len(c.secret),
    lore: list(c.lore).length,
    always: list(c.lore).filter((e) => e.always).length,
    openings: ops.length,
    lead: ops.filter((o) => o.lead).length,
    places: list(c.places).length,
    cuts: list(c.cuts).length,
    commands: list(c.commands).length,
    replies: list(c.commands).filter((x) => x.text).length,
    guide: len(c.guide),
    suggest: ops.filter((o) => list(o.suggestions).length).length,
    place: ops.filter((o) => o.place).length,
    images: Object.keys(img).reduce((n, k) => n + Object.keys(img[k] || {}).length, 0) + (c.img ? 1 : 0)
  };
}
/** 기준보다 얕은 칸 이름들. 첫 답변 추천은 시작 상황 전부에 있어야 채운 것으로 봄. @param {ReturnType<typeof measure>} m @returns {string[]} */
export function shallow(m) {
  return COLS.filter(([k]) => k in BASE && (k === "suggest" ? m.suggest < m.openings : m[k] < BASE[k])).map(([, name]) => name);
}

async function main() {
  const gen = path.join(ROOT, "src/js/content/generated.js");
  if (!fs.existsSync(gen)) {
    console.error("src/js/content/generated.js가 없어요 — 먼저 npm run build");
    process.exit(0);
  }
  const { ORIGINALS } = await import(pathToFileURL(path.join(ROOT, "src/js/content/index.js")).href);
  const rows = ORIGINALS.map(measure);
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(rows, null, 1));
    return;
  }
  const cell = (m, k) => {
    const v =
      k === "lore"
        ? m.lore + (m.always ? `(상시 ${m.always})` : "")
        : k === "openings"
          ? m.openings + (m.lead ? `(연출 ${m.lead})` : "")
          : k === "commands"
            ? m.commands + (m.replies ? `(즉답 ${m.replies})` : "")
            : k === "suggest" || k === "place"
              ? `${m[k]}/${m.openings}`
              : String(m[k]);
    const low = k in BASE && (k === "suggest" ? m.suggest < m.openings : m[k] < BASE[k]);
    return v + (low ? " ▽" : "");
  };
  console.log(
    `작품 완성도 — ${rows.length}작품 (▽ = 기준보다 얕음: ${Object.keys(BASE)
      .map((k) => `${COLS.find((c) => c[0] === k)[1]} ${k === "suggest" ? "시작 상황 전부" : BASE[k] + " 이상"}`)
      .join(" · ")})\n`
  );
  console.log(`| 작품 | 대상 | 인물 | ${COLS.map((c) => c[1]).join(" | ")} |`);
  console.log(`|---|---|---|${COLS.map(() => "---").join("|")}|`);
  for (const m of rows)
    console.log(`| ${m.id} ${m.title} | ${m.aud} | ${m.cast}${m.forms ? `(+폼 ${m.forms})` : ""} | ${COLS.map(([k]) => cell(m, k)).join(" | ")} |`);
  const low = rows.map((m) => [m, shallow(m)]).filter((x) => x[1].length),
    total = low.reduce((n, x) => n + x[1].length, 0);
  console.log(`\n얕은 칸 ${total}개${low.length ? " — " + low.map(([m, s]) => `${m.id}: ${s.join("·")}`).join(" / ") : ""}`);
  console.log(
    `합계: 설정 ${rows.reduce((n, m) => n + m.setting, 0)}자 · 키워드북 ${rows.reduce((n, m) => n + m.lore, 0)}개 · 시작 상황 ${rows.reduce((n, m) => n + m.openings, 0)}개 · 장소 ${rows.reduce((n, m) => n + m.places, 0)}곳 · 컷씬 ${rows.reduce((n, m) => n + m.cuts, 0)}개 · 명령어 ${rows.reduce((n, m) => n + m.commands, 0)}개 · 그림 ${rows.reduce((n, m) => n + m.images, 0)}장`
  );
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
