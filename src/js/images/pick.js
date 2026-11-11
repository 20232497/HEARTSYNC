/* 코드별 그림 찾기(imagesOf·pickImg): 작품 폴더에 실린 그림(content/…/images/<코드><번호>.webp → 작품의 images[코드][번호]). 본문의 그림 태그 읽기는 codes.js의 imgTags */
import { liveWork } from "../core/character.js";
import { fallbackSits } from "./codes.js";
import { validRef } from "../services/images.js";

/** 코드 글자 부분(인물·MP·EV) → { 번호: 그림 경로 }. 인물 코드는 그림이 없어도 빈 칸이 있음. 오리지널은 최신 작품(liveWork)의 그림을, 없으면 방 안의 작품 사본을 씀. @param {import("../core/types.js").Work} c */
export function imagesOf(c) {
  const base = liveWork(c).images || c.images || {};
  const out = {};
  for (const k of Object.keys(base)) out[k] = { ...base[k] };
  for (const x of c.cast || []) out[x.code] = out[x.code] || {};
  return out;
}
/** 그 칸 → 1 기본 → 0 프로필 순으로 있는 그림(장소·컷씬은 그 번호만), 없으면 null. @returns {string|null} */
export function pickImg(c, code, n) {
  const m = imagesOf(c)[code] || {};
  for (const k of fallbackSits(n, code)) if (validRef(m[k])) return m[k];
  return null;
}
