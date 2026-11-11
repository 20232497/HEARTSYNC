/* 작품 찾기·정규화: normalizeChar, id로 찾기(getChar — 오리지널), 방의 작품을 지금 읽을 모양으로(liveWork — 어느 칸을 최신 작품에서 읽는지는 LIVE_FIELDS 한 곳), 화면 예시 문구에 쓸 인물(exampleCast) */
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
/** id로 작품 찾기(오리지널) — 방이 없는 화면(상세·도감·로그인 뒤 돌아갈 곳)에서. **방의 작품은 이것을 직접 부르지 않고 liveWork·latestWork로**(단위 시험 live-work가 지킴). @param {string} id @returns {Work|undefined} */
export function getChar(id) { return ORIGINALS.find((c) => c.id === id); }
/**
 * 방의 작품 사본(r.char)에서 굳지 않고 **최신 작품(content/)에서 읽는 칸** — 작품을 고치면 이미 열린 방에도 바로 닿는 것들:
 * 키워드북 · 장소 · 컷씬 · 작품 명령어 · 플레이 가이드 · 유저노트 양식 · 권장 모델 · 그림(images) · 세계관 일러스트(loreImages).
 * 나머지 칸(인물 cast와 그 비공개 칸 · 설정 persona·world·speech·secret · 상태창 fields·gauge · 제목·표지 · 에피소드 진행표 episode · 트랙)은 방을 만들 때의 사본 그대로(예전 방의 이야기가 바뀌지 않게).
 * 규칙은 이 목록 한 곳 — 칸을 옮기려면 여기만 고침(표와 예외는 core/types.js의 Room.char).
 */
export const LIVE_FIELDS = ["lore", "places", "cuts", "commands", "guide", "noteTemplate", "recommend", "images", "loreImages"];
/**
 * 방의 작품을 '지금 읽을 모양'으로: LIVE_FIELDS의 칸은 최신 작품에서, 나머지는 방 사본에서. 작품이 content/에서 빠져 못 찾으면 방 사본 그대로.
 * @param {Work} c 방의 작품 사본(r.char) @returns {Work} 최신 작품이 있으면 새 객체(사본은 건드리지 않음), 없으면 c 그대로
 */
export function liveWork(c) {
  const live = getChar(c.id);
  if (!live) return c;
  const out = { ...c };
  for (const k of LIVE_FIELDS) out[k] = live[k];
  return out;
}
/** 새 방을 만들 때 쓸 작품('처음부터 다시') — 방 사본이 아니라 최신 작품 통째로, content/에서 빠졌으면 방 사본. @param {Work} c @returns {Work} */
export function latestWork(c) { return getChar(c.id) || c; }
/**
 * 화면 예시 문구(도감 '코드 읽는 법'·FAQ·MY 미리보기·입력 칸 예시·프롬프트 예시)에 쓸 인물 — 특정 작품 이름을 코드에 박지 않으려고 데이터에서 뽑음.
 * 작품을 주면 그 작품의 첫 인물(폼이 아닌 본체), 안 주면 관심있는 대화에 맞는 첫 작품의 첫 인물, 그것도 없으면 EXAMPLE_CAST.
 * @param {Work|null} [c] @returns {{ code: string, name: string }}
 */
export function exampleCast(c) {
  const w = c || ORIGINALS.find(audOK), cast = (w && Array.isArray(w.cast) && w.cast) || [], x = cast.find((y) => !y.of) || cast[0];
  return x ? { code: x.code, name: x.name } : EXAMPLE_CAST;
}
