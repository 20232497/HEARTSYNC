/* 그림 태그 읽기(순수 — SIT 상수만 import해 Node 단위 테스트가 바로 씀): 본문 태그 [[img:인물코드:번호]]와 그림을 찾는 순서.
   번호는 기본 감정 0~14(SIT) 하나. 예전 대화의 조합 태그([[img:ks:3,404,501]])·세 자리 코드는 처음 나오는 0~14 번호로 읽고, 없으면 1(기본)로 봄 */
import { SIT } from "../core/constants.js";

export const IMG_TAG_RE = /\[\[img:([a-z0-9]+):([\d,]+)\]\]/gi;
/** 태그의 번호 부분("3" 또는 예전 "3,404,501") → 0~14 번호(없으면 1). @param {string|number} spec @returns {number} */
export function sitOf(spec) {
  for (const p of String(spec === undefined || spec === null ? "" : spec).split(",")) {
    const t = p.trim();
    if (/^\d{1,2}$/.test(t) && +t < SIT.length) return +t;
  }
  return 1;
}
/** 본문의 그림 태그들 → [{ code(인물), sit(0~14), raw(원문) }]. @param {string} text */
export function imgTags(text) {
  return [...String(text || "").matchAll(IMG_TAG_RE)].map((m) => ({ code: m[1].toLowerCase(), sit: sitOf(m[2]), raw: m[0] }));
}
/** 그림을 찾는 순서: 그 칸 → 1 기본 → 0 프로필(1차 그림은 0·1만 있어도 빈 칸이 안 보이게). @param {number} n @returns {number[]} */
export function fallbackSits(n) { return [...new Set([n, 1, 0])]; }
