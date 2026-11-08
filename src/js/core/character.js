/* 작품 찾기·정규화: normalizeChar, id로 찾기(getChar — 오리지널) */
import { ORIGINALS } from "../content/index.js";
/** @typedef {import("./types.js").Work} Work */

/** 빠진 칸(fields·gauge·cast·images·lore)을 기본값으로 제자리 보정. @template {Work|null|undefined} T @param {T} c @returns {T} 같은 객체 */
export function normalizeChar(c) {
  if (!c) return c;
  if (!Array.isArray(c.fields) || !c.fields.length) c.fields = ["호감도", "속마음"];
  if (!c.gauge) c.gauge = c.fields[0];
  if (!Array.isArray(c.cast) || !c.cast.length) c.cast = [{ code: "c", name: c.name, look: "" }];
  if (!c.images || typeof c.images !== "object") c.images = {};
  if (!Array.isArray(c.lore)) c.lore = [];
  return c;
}
/** id로 작품 찾기(오리지널). 대화방은 방 안의 작품 사본을 쓰고, 이것은 최신 키워드북·그림을 볼 때. @param {string} id @returns {Work|undefined} */
export function getChar(id) { return ORIGINALS.find((c) => c.id === id); }
