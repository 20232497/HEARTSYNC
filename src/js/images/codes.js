/* 그림 코드 체계(순수 — SIT 상수만 import해 Node 단위 테스트가 바로 씀): 인물 코드 + 번호 한 토큰, 작품의 코드 사전(codebook), 본문 태그 [[코드번호]], 그림을 찾는 순서.
   인물 코드는 영문 대문자 1~4자(HSY = 한서윤), 그 뒤 번호가 감정·행동 칸 0~14(SIT) — HSY3 = 한서윤 3 부끄러움. 본문 태그는 [[HSY3]], 그림 파일은 HSY3.webp.
   예약 시리즈(SERIES): MP<n> 장소(작품 places의 n번째), EV<n> 컷씬(작품 cuts의 n번째) — 번호는 1부터. 다른 모습(폼)은 별도 인물 코드(cast[].of가 본체).
   코드를 해석하는 곳(프롬프트·렌더러·갤러리·빌드 검사·도감)은 모두 codebook(c) 하나를 씀 — 시리즈를 더하려면 SERIES에 한 줄.
   예전 대화의 [[img:p1:3]]·조합 태그([[img:ks:3,404,501]])·세 자리 코드도 읽음(처음 나오는 0~14 번호, 없으면 1) — 방을 열 때 migrateRoom(core/rooms.js)이 새 코드로 바꿈 */
import { SERIES, SIT } from "../core/constants.js";

export { SERIES }; // 예약 시리즈 표(MP 장소 · EV 컷씬)는 core/constants.js에 — 쓰던 곳은 그대로 여기서 가져감

/** 인물 코드 모양: 영문 대문자 1~4자(번호와 붙여 써도 갈라지게 숫자는 안 됨) */
export const CODE_RE = /^[A-Z]{1,4}$/;
/** 종류로 예약 시리즈의 코드 글자 찾기 — seriesCode("place") → "MP", seriesCode("cut") → "EV"(없으면 ""). 'MP'·'EV'를 다른 모듈에 직접 쓰지 않게. @param {string} kind @returns {string} */
export function seriesCode(kind) {
  return Object.keys(SERIES).find((k) => SERIES[k].kind === kind) || "";
}
/** 본문의 그림 태그: 새 모양 [[HSY3]]·[[img:HSY3]], 또는 예전 모양 [[img:p1:3]]·[[img:ks:3,404,501]] */
export const IMG_TAG_RE = /\[\[(?:img:)?([A-Za-z]{1,4})(\d{1,2})\]\]|\[\[img:([a-z0-9]+):([\d,]+)\]\]/gi;
/**
 * 작품의 코드 사전: 코드 글자 → { kind, label, name, of, min, max, items, field, nameKey, hidden }.
 * 인물 코드(cast)는 번호 0~SIT.length-1(name은 인물 이름, of는 폼의 본체), 시리즈(MP·EV)는 1~목록 길이(목록이 비면 max 0, items는 그 목록).
 * hidden은 비공개(스포일러) 번호들 — 인물은 cast[].hidden의 감정 번호, 시리즈는 hidden: true인 항목의 번호(1부터). 도감·상세·장소 목록은 이 번호의 그림을 가리고, 대화에 그 코드가 나온 방에서만 보임.
 * @param {{cast?: {code: string, name: string, of?: string, hidden?: number[]}[], places?: object[], cuts?: object[]}|null|undefined} c
 * @returns {Record<string, {kind: "cast"|"place"|"cut", label: string, name: string, of: string, min: number, max: number, items: object[]|null, field: string,
 * nameKey: string, hidden: number[]}>}
 */
export function codebook(c) {
  const book = {};
  for (const x of (c && c.cast) || [])
    book[x.code] = {
      kind: "cast",
      label: x.name,
      name: x.name,
      of: x.of || "",
      min: 0,
      max: SIT.length - 1,
      items: null,
      field: "cast",
      nameKey: "name",
      hidden: Array.isArray(x.hidden) ? x.hidden : []
    };
  for (const code of Object.keys(SERIES)) {
    const s = SERIES[code],
      items = c && Array.isArray(c[s.field]) ? c[s.field] : [];
    book[code] = {
      kind: s.kind,
      label: s.label,
      name: s.label,
      of: "",
      min: 1,
      max: items.length,
      items,
      field: s.field,
      nameKey: s.nameKey,
      hidden: items.map((it, i) => (it && it.hidden ? i + 1 : 0)).filter(Boolean)
    };
  }
  return book;
}
/** 예전 태그의 번호 부분("3" 또는 조합 "3,404,501") → 0~14 번호(없으면 1). @param {string|number} spec @returns {number} */
export function sitOf(spec) {
  for (const p of String(spec === undefined || spec === null ? "" : spec).split(",")) {
    const t = p.trim();
    if (/^\d{1,2}$/.test(t) && +t < SIT.length) return +t;
  }
  return 1;
}
/** 본문의 그림 태그들 → [{ code(글자 부분, 대문자), sit(번호), raw(원문) }]. 인물 코드면 sit은 감정 칸, MP·EV면 n번째 항목(1부터). @param {string} text */
export function imgTags(text) {
  return [...String(text || "").matchAll(IMG_TAG_RE)].map((m) =>
    m[3] !== undefined ? { code: m[3].toUpperCase(), sit: sitOf(m[4]), raw: m[0] } : { code: m[1].toUpperCase(), sit: +m[2], raw: m[0] }
  );
}
/** 그림 코드 한 토큰 → 본문 태그. imgTag("HSY", 3) → "[[HSY3]]". @param {string} code @param {number} n @returns {string} */
export function imgTag(code, n) {
  return `[[${code}${n}]]`;
}
/** 코드의 글자 부분이 이 작품에서 무엇인지: 인물·장소(MP)·컷씬(EV)·모름(""). @param {string} letters @param {object|null|undefined} c @returns {"cast"|"place"|"cut"|""} */
export function codeKind(letters, c) {
  const e = codebook(c)[letters];
  return e ? e.kind : "";
}
/** 그림을 찾는 순서: 그 칸 → 1 기본 → 0 프로필(1차 그림은 0·1만 있어도 빈 칸이 안 보이게). 장소·컷씬(MP·EV)은 그 번호 하나. @param {number} n @param {string} [code] @returns {number[]} */
export function fallbackSits(n, code) {
  return SERIES[code] ? [n] : [...new Set([n, 1, 0])];
}
