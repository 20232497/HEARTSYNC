/* 움짤(그림 칸의 짧은 반복 영상): 칸마다 사진과 움짤을 함께 두고 어느 쪽을 보여 줄지(on)를 정한다 — 대화·스튜디오·상세가 같은 규칙으로 고름.
   저장은 S.motionpacks[작품 id][인물 코드][조합 키] = {ref, on, local?}(KV "motionpacks", 계정에도). 작품 폴더에 실린 움짤(c.motions — 경로 문자열)은 켜진 것으로 보고, 내 계정 값이 덮는다.
   사진을 지우거나 바꾸면 그 칸의 움짤도 지움(다른 사진에서 만든 움짤이 남지 않게 — images/pick.js putCastImage) */
import { getChar } from "../core/character.js";
import { S } from "../core/state.js";
import { KV } from "../core/storage.js";
import { keyOf, parseCodes } from "./codes.js";
import { IMG, validMotion } from "../services/images.js";
/** @typedef {import("../core/types.js").Motion} Motion */

const norm = (v) => typeof v === "string" ? { ref: v, on: true } : v && typeof v === "object" ? v : null;
/** 인물 코드 → { 조합 키: Motion }. @returns {Record<string, Record<string, Motion>>} */
export function motionsOf(c) {
  const live = getChar(c.id) || c, base = live.motions || c.motions || {}, over = S.motionpacks[c.id] || {}, out = {};
  for (const x of c.cast || []) {
    const m = {};
    for (const [k, v] of Object.entries(base[x.code] || {})) { const e = norm(v); if (e) m[k] = e; }
    for (const [k, v] of Object.entries(over[x.code] || {})) { const e = norm(v); if (e) m[k] = e; else delete m[k]; }
    out[x.code] = m;
  }
  return out;
}
/** 그 칸의 움짤(켜짐·꺼짐 상관없이, 없으면 null). @returns {Motion|null} */
export function motionOf(c, code, key) { const m = (motionsOf(c)[code] || {})[keyOf(String(key))]; return m && validMotion(m.ref) ? m : null; }
/** 보여 줄 움짤 참조 — 켜져 있을 때만. @returns {string|null} */
export function liveMotion(c, code, key) { const m = motionOf(c, code, key); return m && m.on ? m.ref : null; }
/* 내 계정 값 쓰기: v가 null이면 지움(작품 폴더에 실린 움짤이 있으면 그 자리를 null로 덮어 '없음'으로) */
function setPack(c, code, k, v) {
  const p = S.motionpacks[c.id] = S.motionpacks[c.id] || {}, m = p[code] = p[code] || {};
  const shipped = ((getChar(c.id) || c).motions || {})[code] || {};
  if (v) m[k] = v; else if (shipped[k]) m[k] = null; else delete m[k];
  if (!Object.keys(m).length) delete p[code];
  if (!Object.keys(p).length) delete S.motionpacks[c.id];
  KV.set("motionpacks", S.motionpacks);
}
/** 움짤 넣기(새로 만들면 켜짐). 예전 본문은 지움. ref가 없으면 그 칸의 움짤을 지움 */
export function putMotion(c, code, key, ref, { on = true, local = false } = {}) {
  const k = keyOf(String(key)); if (!k) return;
  const old = motionOf(c, code, k);
  if (old && old.ref !== ref && !String(old.ref).startsWith("content/")) IMG.drop(old.ref);
  setPack(c, code, k, ref ? { ref, on, ...(local ? { local: true } : {}) } : null);
}
/** 사진 ↔ 움짤 바꾸기. @returns {boolean} 바꾼 뒤 움짤이 켜졌는지 */
export function flipMotion(c, code, key) {
  const k = keyOf(String(key)), m = motionOf(c, code, k); if (!m) return false;
  setPack(c, code, k, { ...m, on: !m.on });
  return !m.on;
}
/** 지운 코드 번호가 든 조합의 움짤을 모든 작품에서 지움(코드 삭제 때). @param {number[]} ns */
export function dropMotionCodes(ns) {
  let changed = false;
  for (const p of Object.values(S.motionpacks)) for (const m of Object.values(p || {})) for (const k of Object.keys(m || {})) {
    if (!parseCodes(k).some((n) => ns.indexOf(n) >= 0)) continue;
    if (m[k] && m[k].ref) IMG.drop(m[k].ref);
    delete m[k]; changed = true;
  }
  if (changed) KV.set("motionpacks", S.motionpacks);
}
