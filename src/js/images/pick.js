/* 인물·칸별 그림 찾기(imagesOf·pickImg)와 그림이 든 칸 번호(imgTags) */
import { getChar } from "../core/character.js";
import { S } from "../core/state.js";
import { validRef } from "../services/images.js";

export function imagesOf(c) {
  const live = getChar(c.id) || c, base = live.images || c.images || {}, over = S.imgpacks[c.id] || {};
  const out = {};
  for (const x of c.cast || []) out[x.code] = { ...(base[x.code] || {}), ...(over[x.code] || {}) };
  return out;
}
export function pickImg(c, code, sit) {
  const m = imagesOf(c)[code] || {};
  return [m[sit], m[1], m[0]].find(validRef) || null;
}
export function imgTags(text) { return [...String(text).matchAll(/\[\[img:([a-z0-9]+):(\d{1,2})\]\]/gi)].map((m) => ({ code: m[1].toLowerCase(), sit: +m[2] })); }
