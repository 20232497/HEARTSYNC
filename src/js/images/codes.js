/* 그림 코드 체계(순수 — SIT 상수만 import해 Node 단위 테스트가 바로 씀): 인물 코드 + 번호 한 토큰, 본문 태그 [[코드번호]], 그림을 찾는 순서.
   인물 코드는 영문 대문자 1~4자(HSY = 한서윤), 그 뒤 번호가 감정·행동 칸 0~14(SIT) — HSY3 = 한서윤 3 부끄러움. 본문 태그는 [[HSY3]], 그림 파일은 HSY3.webp.
   예약 코드: MP<n> 장소(작품 places의 n번째), EV<n> 컷씬(작품 cuts의 n번째) — 번호는 1부터. 다른 모습(폼)은 별도 인물 코드(cast[].of가 본체).
   예전 대화의 [[img:p1:3]]·조합 태그([[img:ks:3,404,501]])·세 자리 코드도 읽음(처음 나오는 0~14 번호, 없으면 1) — 방을 열 때 migrateRoom(core/rooms.js)이 새 코드로 바꿈 */
import { SIT } from "../core/constants.js";

/** 인물 코드 모양: 영문 대문자 1~4자(번호와 붙여 써도 갈라지게 숫자는 안 됨) */
export const CODE_RE = /^[A-Z]{1,4}$/;
/** 예약 코드(인물 코드로 못 씀): 장소·컷씬 시리즈 — 번호는 작품 places·cuts의 n번째(1부터) */
export const SERIES = { MP: "place", EV: "cut" };
/** 본문의 그림 태그: 새 모양 [[HSY3]]·[[img:HSY3]], 또는 예전 모양 [[img:p1:3]]·[[img:ks:3,404,501]] */
export const IMG_TAG_RE = /\[\[(?:img:)?([A-Za-z]{1,4})(\d{1,2})\]\]|\[\[img:([a-z0-9]+):([\d,]+)\]\]/gi;
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
  return [...String(text || "").matchAll(IMG_TAG_RE)].map((m) => m[3] !== undefined
    ? { code: m[3].toUpperCase(), sit: sitOf(m[4]), raw: m[0] }
    : { code: m[1].toUpperCase(), sit: +m[2], raw: m[0] });
}
/** 그림 코드 한 토큰 → 본문 태그. imgTag("HSY", 3) → "[[HSY3]]". @param {string} code @param {number} n @returns {string} */
export function imgTag(code, n) { return `[[${code}${n}]]`; }
/** 코드의 글자 부분이 이 작품에서 무엇인지: 인물·장소(MP)·컷씬(EV)·모름(""). @param {string} letters @param {{cast?: {code: string}[]}|null|undefined} c @returns {"cast"|"place"|"cut"|""} */
export function codeKind(letters, c) {
  if (SERIES[letters]) return SERIES[letters];
  return ((c && c.cast) || []).some((x) => x.code === letters) ? "cast" : "";
}
/** 그림을 찾는 순서: 그 칸 → 1 기본 → 0 프로필(1차 그림은 0·1만 있어도 빈 칸이 안 보이게). 장소·컷씬(MP·EV)은 그 번호 하나. @param {number} n @param {string} [code] @returns {number[]} */
export function fallbackSits(n, code) { return SERIES[code] ? [n] : [...new Set([n, 1, 0])]; }
