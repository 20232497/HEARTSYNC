// 그림 의뢰 목록(npm run content:art): 작품마다 필요한 그림을 한 장씩 뽑아 — 코드(곧 파일 이름)·종류·이름·비공개·우선순위·실렸는지·넣을 경로·그림용 태그가 적혔는지.
// 그리고 종류별 규격 표(ART_SPECS — 생성 크기·화면 자리 비율·형식). **규격은 확정**(2026-11-11 이미지 세션 — 생성 시험으로 고름). 고칠 곳은 이 상수 한 곳(README '그림 싣기'가 같은 값을 보여 줌 — 단위 시험이 지킴).
// 코드 해석은 앱과 같은 것만 씀(images/codes.js codebook·imgTags, images/situations.js sitName, images/pick.js imagesOf) — 코드 글자·시리즈를 여기에 다시 적지 않는다.
// 검사가 아니라 안내 — 늘 exit 0. 빌드가 만든 src/js/content/generated.js를 읽으므로 먼저 npm run build. 의존성 없음.
//   node tools/content-art.mjs                     전체(순위순)
//   node tools/content-art.mjs --work hwanghu      한 작품만
//   node tools/content-art.mjs --todo              아직 안 실린 것만
//   node tools/content-art.mjs --rank 1            그 순위만(1·2·3)
//   node tools/content-art.mjs --json              줄 전부를 JSON으로(다른 도구에 넘길 때)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { codebook, imgTags } from "../src/js/images/codes.js";
import { imagesOf } from "../src/js/images/pick.js";
import { sitName } from "../src/js/images/situations.js";
import { validRef } from "../src/js/services/images.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
/**
 * 종류별 규격 — **확정**(2026-11-11 이미지 세션: 크기는 화면 자리의 비율과 정확히 같게, 넓이는 SDXL 계열 모델의 기본 해상도(약 100만 화소) 가까이 — Runware에서 생성 시험으로 확인). 바꾸려면 이미지 세션과 함께.
 * size 만드는 크기(가로×세로 픽셀) · ratio 그 크기의 비율 · slot 화면에서 그 그림이 놓이는 자리의 비율(다르면 가장자리가 잘리거나 여백이 생김) · note 근거와 확인할 점
 */
export const ART_SPECS = {
  cover: {
    name: "표지",
    file: "cover",
    size: "960×1280",
    ratio: "3:4 세로",
    slot: "3:4(홈 카드·상세) — 좁은 화면의 상세는 4:3으로 잘림",
    format: "webp",
    note: "화면 자리와 같음. 1080×1440은 모델 기본 해상도보다 커서 줄임(960×1280 생성 시험 통과)",
    state: "확정"
  },
  profile: {
    name: "인물 프로필",
    file: "<인물 코드>0",
    size: "768×1152",
    ratio: "2:3 세로",
    slot: "2:3(인물 사진 — 상세·도감) · 대화 속은 받은 그림의 비율 그대로",
    format: "webp",
    note: "얼굴 가까운 구도. 화면 자리와 같음. Runware는 64의 배수만 받아 832×1248은 만들 수 없음 — 화풍이 1152×1728로 키워 다시 그림(archive/style-manime)",
    state: "확정"
  },
  cast: {
    name: "인물 감정 칸",
    file: "<인물 코드><번호 1~14>",
    size: "1024×1024",
    ratio: "1:1 정사각",
    slot: "1:1(대화 속 — 받은 그림의 비율 그대로 · 방 갤러리 칸도 정사각)",
    format: "webp",
    note: "머리~허벅지 구도와 감정마다 몸짓(2026-11-11 사용자 결정 — 2:3과 정사각을 30장씩 비교해 정사각)",
    state: "확정"
  },
  place: {
    name: "장소",
    file: "<장소 코드><번호>",
    size: "1152×768",
    ratio: "3:2 가로",
    slot: "3:2(도감·상세 카드)",
    format: "webp",
    note: "화면 자리와 같음. Runware는 64의 배수만 받아 1248×832는 만들 수 없음 — 1728×1152로 키워 다시 그림(archive/style-works)",
    state: "확정"
  },
  cut: {
    name: "컷씬",
    file: "<컷씬 코드><번호>",
    size: "1152×768",
    ratio: "3:2 가로",
    slot: "3:2(도감·상세 카드)",
    format: "webp",
    note: "장소와 같음",
    state: "확정"
  },
  lore: {
    name: "세계관 일러스트",
    file: "lore-<번호>",
    size: "1152×768",
    ratio: "3:2 가로",
    slot: "3:2(상세의 세계관 카드·세계관 수첩)",
    format: "webp",
    note: "화면 자리에 맞춤 — 예전 문서의 16:9(1280×720)는 버림",
    state: "확정"
  }
};
/**
 * 우선순위 기준(2026-11-11 사용자 결정) — 바꾸려면 여기와 rankOf만.
 * 1순위: 표지 · 인물(본체)의 FIRST_SITS 칸 · 시작 상황 본문과 즉답 명령어 글에 직접 적힌 그림 · 시작 상황의 배경 장소
 * 2순위: 나머지 장소·컷씬 · 본체의 나머지 감정 칸 · 다른 모습(폼)의 FIRST_SITS 칸
 * 3순위: 다른 모습의 나머지 감정 칸 · 세계관 일러스트
 */
export const FIRST_SITS = [0, 1]; // 프로필·기본 — 처음 등장할 때와, 그 칸 그림이 없을 때 대신 나오는 칸이라 가장 먼저 필요
const list = (v) => (Array.isArray(v) ? v : []);
const KIND_NAME = { cover: "표지", cast: "인물", form: "다른 모습", place: "장소", cut: "컷씬", lore: "세계관" };

/** 시작 상황 본문·즉답 명령어 글에 직접 적힌 그림 코드("KAS0"·"MP1")와 시작 상황의 배경 장소 코드. @param {object} c @returns {Set<string>} */
export function directCodes(c) {
  const book = codebook(c),
    out = new Set(),
    placeCode = Object.keys(book).find((k) => book[k].kind === "place");
  const texts = list(c.openings)
    .map((o) => o.text)
    .concat(list(c.commands).map((x) => x.text));
  texts.forEach((t) =>
    imgTags(t).forEach((x) => {
      if (book[x.code]) out.add(x.code + x.sit);
    })
  );
  list(c.openings).forEach((o) => {
    if (o.place && placeCode) out.add(placeCode + o.place);
  });
  return out;
}
function rankOf(kind, n, code, direct) {
  if (kind === "cover" || direct.has(code)) return 1;
  if (kind === "cast") return FIRST_SITS.includes(n) ? 1 : 2;
  if (kind === "form") return FIRST_SITS.includes(n) ? 2 : 3;
  return kind === "lore" ? 3 : 2;
}
/**
 * 작품 하나에 필요한 그림 전부 — 한 항목 = 그림 한 장(순서: 표지 → 인물과 다른 모습의 감정 칸 → 장소 → 컷씬 → 세계관 일러스트).
 * @param {object} c 작품(ORIGINALS의 한 항목 — aud·row·images·img·loreImages 포함)
 * @returns {{ work: string, code: string, kind: string, spec: string, name: string, hidden: boolean, rank: 1|2|3, has: boolean, tags: boolean, path: string
 * }[]}
 */
export function artRows(c) {
  const book = codebook(c),
    imgs = imagesOf(c),
    direct = directCodes(c),
    rows = [];
  const dir = `content/${c.aud || "all"}/${c.row ? c.row + "/" : ""}${c.id}/images/`;
  const add = (code, kind, spec, name, hidden, n, has, tags) =>
    rows.push({
      work: c.id,
      code,
      kind: KIND_NAME[kind],
      spec,
      name,
      hidden: !!hidden,
      rank: rankOf(kind, n, code, direct),
      has: !!has,
      tags: !!tags,
      path: dir + code + "." + ART_SPECS[spec].format
    });
  add("cover", "cover", "cover", c.title || c.id, false, 0, c.img, c.artTags);
  for (const code of Object.keys(book)) {
    const e = book[code],
      m = imgs[code] || {};
    if (e.kind === "cast") {
      const member = list(c.cast).find((x) => x.code === code) || {};
      for (let n = e.min; n <= e.max; n++)
        add(
          code + n,
          e.of ? "form" : "cast",
          n === 0 ? "profile" : "cast",
          `${e.name} · ${sitName(n)}`,
          e.hidden.includes(n),
          n,
          validRef(m[n]),
          member.tags || c.lookTags
        );
    } else {
      list(e.items).forEach((it, i) =>
        add(code + (i + 1), e.kind, e.kind, (it && it[e.nameKey]) || code + (i + 1), e.hidden.includes(i + 1), i + 1, validRef(m[i + 1]), it && it.tags)
      );
    }
  }
  list(c.lore).forEach((x, i) => add("lore-" + (i + 1), "lore", "lore", x.keys[0], false, i + 1, (c.loreImages || {})[x.keys[0]], x.tags));
  return rows;
}
/** 줄들의 합계: 필요·실림과 순위별 남은 수. @param {ReturnType<typeof artRows>} rows */
export function artSummary(rows) {
  const left = (r) => rows.filter((x) => x.rank === r && !x.has).length;
  return {
    need: rows.length,
    has: rows.filter((x) => x.has).length,
    left1: left(1),
    left2: left(2),
    left3: left(3),
    noTags: rows.filter((x) => !x.tags).length
  };
}

async function main() {
  const gen = path.join(ROOT, "src/js/content/generated.js");
  if (!fs.existsSync(gen)) {
    console.error("src/js/content/generated.js가 없어요 — 먼저 npm run build");
    return;
  }
  const { ORIGINALS } = await import(pathToFileURL(path.join(ROOT, "src/js/content/index.js")).href);
  const argv = process.argv.slice(2),
    arg = (k) => {
      const i = argv.indexOf(k);
      return i >= 0 ? argv[i + 1] || "" : "";
    };
  const only = arg("--work"),
    rank = +arg("--rank") || 0,
    todo = argv.includes("--todo");
  const works = ORIGINALS.filter((c) => !only || c.id === only);
  if (only && !works.length) {
    console.error(`작품 "${only}"가 없어요 (있는 작품: ${ORIGINALS.map((c) => c.id).join(", ")})`);
    return;
  }
  const all = works.map((c) => ({ c, rows: artRows(c) }));
  const shown = (rows) => rows.filter((x) => (!todo || !x.has) && (!rank || x.rank === rank)).sort((a, b) => a.rank - b.rank);
  if (argv.includes("--json")) {
    console.log(JSON.stringify({ specs: ART_SPECS, rows: all.flatMap((w) => shown(w.rows)) }, null, 1));
    return;
  }
  const total = artSummary(all.flatMap((w) => w.rows));
  console.log(
    `그림 의뢰 목록 — ${works.length}작품 · 필요 ${total.need}장 · 실림 ${total.has}장 · 남은 1순위 ${total.left1}장 · 2순위 ${total.left2}장 · 3순위 ${total.left3}장\n`
  );
  console.log("규격 표 — 확정(2026-11-11 이미지 세션. 고칠 곳: tools/content-art.mjs ART_SPECS)\n");
  console.log("| 종류 | 파일 이름 | 만드는 크기 | 비율 | 화면 자리 | 형식 | 근거·확인할 점 | 상태 |\n|---|---|---|---|---|---|---|---|");
  for (const k of Object.keys(ART_SPECS)) {
    const s = ART_SPECS[k];
    console.log(`| ${s.name} | ${s.file} | ${s.size} | ${s.ratio} | ${s.slot} | ${s.format} | ${s.note} | ${s.state} |`);
  }
  console.log(
    "\n우선순위: 1 = 표지·인물의 프로필과 기본·첫 장면과 즉답 글에 직접 나오는 그림·시작 상황의 배경 장소 / 2 = 나머지 장소·컷씬·인물의 감정 칸·다른 모습의 프로필과 기본 / 3 = 다른 모습의 감정 칸·세계관 일러스트"
  );
  for (const w of all) {
    const rows = shown(w.rows),
      s = artSummary(w.rows);
    console.log(
      `\n### ${w.c.id} ${w.c.title} — 필요 ${s.need} · 실림 ${s.has} · 남은 1순위 ${s.left1}${rows.length !== w.rows.length ? ` (아래는 ${rows.length}장)` : ""}`
    );
    if (!rows.length) continue;
    console.log("| 순위 | 코드 | 종류 | 이름 | 비공개 | 실림 | 태그 | 넣을 경로 |\n|---|---|---|---|---|---|---|---|");
    for (const x of rows)
      console.log(`| ${x.rank} | ${x.code} | ${x.kind} | ${x.name} | ${x.hidden ? "🔒" : ""} | ${x.has ? "●" : ""} | ${x.tags ? "" : "없음"} | ${x.path} |`);
  }
  console.log("\n작품별 합계\n| 작품 | 필요 | 실림 | 남은 1순위 | 남은 2순위 | 남은 3순위 | 태그 없는 줄 |\n|---|---|---|---|---|---|---|");
  for (const w of all) {
    const s = artSummary(w.rows);
    console.log(`| ${w.c.id} | ${s.need} | ${s.has} | ${s.left1} | ${s.left2} | ${s.left3} | ${s.noTags} |`);
  }
  console.log(`| 합계 | ${total.need} | ${total.has} | ${total.left1} | ${total.left2} | ${total.left3} | ${total.noTags} |`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
