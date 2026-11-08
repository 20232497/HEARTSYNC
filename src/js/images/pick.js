/* 인물·칸별 그림 찾기(imagesOf·pickImg): 작품 폴더에 실린 그림(content/…/images/ → 작품의 images). 본문의 그림 태그 읽기는 codes.js의 imgTags */
import { getChar } from "../core/character.js";
import { fallbackSits } from "./codes.js";
import { validRef } from "../services/images.js";

/** 인물 코드 → { 칸 번호: 그림 경로 }. 오리지널은 최신 작품(getChar)의 그림을, 없으면 방 안의 작품 사본을 씀. @param {import("../core/types.js").Work} c */
export function imagesOf(c) {
  const live = getChar(c.id) || c, base = live.images || c.images || {};
  const out = {};
  for (const x of c.cast || []) out[x.code] = { ...(base[x.code] || {}) };
  return out;
}
/** 그 칸 → 1 기본 → 0 프로필 순으로 있는 그림(없으면 null). @returns {string|null} */
export function pickImg(c, code, n) {
  const m = imagesOf(c)[code] || {};
  for (const k of fallbackSits(n)) if (validRef(m[k])) return m[k];
  return null;
}
