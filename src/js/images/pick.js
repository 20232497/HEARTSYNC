/* 인물·칸별 그림 찾기(imagesOf·pickImg·pickKey — 조합 키 폴백)·그림 넣기(putCastImage — 사진을 바꾸면 그 칸의 움짤은 지움). 본문의 그림 태그 읽기는 codes.js의 imgTags */
import { getChar } from "../core/character.js";
import { S } from "../core/state.js";
import { KV } from "../core/storage.js";
import { fallbackKeys, keyOf } from "./codes.js";
import { motionOf, putMotion } from "./motion.js";
import { publishCommunity } from "../services/community.js";
import { IMG, validRef } from "../services/images.js";

/* 인물 코드 → { 키: 그림 참조 }. 키는 번호("3") 또는 조합 키("3,404,501"). 작품의 images 위에 내 계정의 imgpacks를 덮음 */
export function imagesOf(c) {
  const live = getChar(c.id) || c, base = live.images || c.images || {}, over = S.imgpacks[c.id] || {};
  const out = {};
  for (const x of c.cast || []) out[x.code] = { ...(base[x.code] || {}), ...(over[x.code] || {}) };
  return out;
}
/* key: 번호(3) 또는 조합 키("3,404,501"). 조합 그대로 → 감정만 → 첫 감정 → 1 기본 → 0 프로필 순으로 있는 그림 */
export function pickImg(c, code, key) { const k = pickKey(c, code, key); return k === null ? null : imagesOf(c)[code][k]; }
/* 그 폴백 순서에서 실제로 그림이 있는 조합 키(없으면 null) — 그 칸의 움짤을 찾을 때 */
export function pickKey(c, code, key) {
  const m = imagesOf(c)[code] || {};
  for (const k of fallbackKeys(key)) if (validRef(m[k])) return k;
  return null;
}
/* 그 조합의 그림이 바로 있는지(폴백 없이) — 대화 중 자동 생성이 만들지 말지 정할 때 */
export function hasImg(c, code, key) { const m = imagesOf(c)[code] || {}; return validRef(m[keyOf(String(key))]); }
/* 인물 그림 저장: 내 작품은 mine.images에(공개 중이면 커뮤니티에도 다시 올림), 그 밖은 내 계정의 S.imgpacks에. ref가 없으면 지움 */
export function putCastImage(c, code, key, ref) {
  const mine = S.mine.find((m) => m.id === c.id), k = keyOf(String(key));
  if (!k) return;
  const store = mine ? (mine.images = mine.images || {}) : (S.imgpacks[c.id] = S.imgpacks[c.id] || {});
  const m = store[code] || {};
  if (m[k] && m[k] !== ref) { IMG.drop(m[k]); if (motionOf(c, code, k)) putMotion(c, code, k, null); }
  if (ref) m[k] = ref; else delete m[k];
  store[code] = m;
  if (mine) { KV.set("mine", S.mine); if (mine.publish) publishCommunity(); } else KV.set("imgpacks", S.imgpacks);
}
