/* 관심있는 대화(전체·남성향·여성향): 작품 aud 판정과 필터 */
import { castLook } from "./cast.js";
import { S } from "./state.js";
/** @typedef {import("./types.js").Aud} Aud */
/** @typedef {import("./types.js").Work} Work */

/* 관심있는 대화(S.settings.audience): all 전체 · m 남성향(여성 캐릭터와의 대화) · f 여성향(남성 캐릭터와의 대화).
   작품의 aud가 없으면(예전 내 작품·커뮤니티) 출연진 외모의 성별로 짐작 — 여자만이면 m, 남자만이면 f, 섞이거나 모르면 all(전체에서만 보임) */
export const AUDS = { all: { name: "전체", desc: "남녀 캐릭터" }, m: { name: "남성향", desc: "여성 캐릭터" }, f: { name: "여성향", desc: "남성 캐릭터" } };
/** 출연진 외모의 성별로 짐작한 성향 — 여자만 m, 남자만 f, 섞이거나 모르면 all. @param {Work} c @returns {Aud} */
export function guessAud(c) {
  let f = 0, m = 0;
  (Array.isArray(c.cast) && c.cast.length ? c.cast : [{ code: "C", name: c.name, look: "" }]).forEach((x) => {
    const l = castLook(x, c);
    if (/여성|여자|\b(?:female|woman|girl)\b/i.test(l)) f++; else if (/남성|남자|\b(?:male|man|boy)\b/i.test(l)) m++;
  });
  return f && !m ? "m" : m && !f ? "f" : "all";
}
/** 작품의 성향(aud가 있으면 그것, 없으면 guessAud). @param {Work|null|undefined} c @returns {Aud} */
export const audOf = (c) => !c ? "all" : AUDS[c.aud] ? c.aud : guessAud(c);
/** 사용자가 고른 관심있는 대화. @returns {Aud} */
export const audience = () => AUDS[S.settings.audience] ? S.settings.audience : "all";
/** 이 작품을 지금 설정에서 보여 줄지. @param {Work} c @returns {boolean} */
export const audOK = (c) => audience() === "all" || audOf(c) === audience();
