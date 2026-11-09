/* 작품 찾기·정규화: normalizeChar, id로 찾기(getChar — 오리지널), 화면 예시 문구에 쓸 인물(exampleCast) */
import { ORIGINALS } from "../content/index.js";
import { audOK } from "./audience.js";
import { EXAMPLE_CAST } from "./constants.js";
/** @typedef {import("./types.js").Work} Work */

/** 빠진 칸(fields·gauge·cast·images·lore)을 기본값으로 제자리 보정. @template {Work|null|undefined} T @param {T} c @returns {T} 같은 객체 */
export function normalizeChar(c) {
  if (!c) return c;
  if (!Array.isArray(c.fields) || !c.fields.length) c.fields = ["호감도", "속마음"];
  if (!c.gauge) c.gauge = c.fields[0];
  if (!Array.isArray(c.cast) || !c.cast.length) c.cast = [{ code: "C", name: c.name, look: "" }];
  if (!c.images || typeof c.images !== "object") c.images = {};
  if (!Array.isArray(c.lore)) c.lore = [];
  return c;
}
/** id로 작품 찾기(오리지널). 대화방은 방 안의 작품 사본을 쓰고, 이것은 최신 키워드북·그림을 볼 때. @param {string} id @returns {Work|undefined} */
export function getChar(id) { return ORIGINALS.find((c) => c.id === id); }
/**
 * 화면 예시 문구(도감 '코드 읽는 법'·FAQ·MY 미리보기·입력 칸 예시·프롬프트 예시)에 쓸 인물 — 특정 작품 이름을 코드에 박지 않으려고 데이터에서 뽑음.
 * 작품을 주면 그 작품의 첫 인물(폼이 아닌 본체), 안 주면 관심있는 대화에 맞는 첫 작품의 첫 인물, 그것도 없으면 EXAMPLE_CAST.
 * @param {Work|null} [c] @returns {{ code: string, name: string }}
 */
export function exampleCast(c) {
  const w = c || ORIGINALS.find(audOK), cast = (w && Array.isArray(w.cast) && w.cast) || [], x = cast.find((y) => !y.of) || cast[0];
  return x ? { code: x.code, name: x.name } : EXAMPLE_CAST;
}
