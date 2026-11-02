/* 작품 찾기·정규화: normalizeChar, 전체 목록(allChars), id로 찾기(getChar) */
import { ORIGINALS } from "../content/index.js";
import { S } from "./state.js";

/* ---------------------------------------------------------------- 캐릭터·커버·이미지 */
export function normalizeChar(c) {
  if (!c) return c;
  if (!Array.isArray(c.fields) || !c.fields.length) c.fields = ["호감도", "속마음"];
  if (!c.gauge) c.gauge = c.fields[0];
  if (!Array.isArray(c.cast) || !c.cast.length) c.cast = [{ code: "c", name: c.name, look: "" }];
  if (!c.images || typeof c.images !== "object") c.images = {};
  if (!Array.isArray(c.lore)) c.lore = [];
  return c;
}
function allChars() { return [...S.mine, ...ORIGINALS, ...S.community.filter((c) => !S.mine.some((m) => m.id === c.id))]; }
export function getChar(id) { return S.mine.find((c) => c.id === id) || ORIGINALS.find((c) => c.id === id) || S.community.find((c) => c.id === id); }
