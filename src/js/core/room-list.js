/* 두 기기의 대화방 목록 합치기(mergeRoomLists) — 계정에서 받은 목록으로 이 기기의 목록을 덮지 않고 방마다 합침. 지운 방의 표식(삭제 표식)을 읽는 isTomb도 여기 */
import { sortRooms } from "./rooms.js";
/** @typedef {import("./types.js").RoomIndex} RoomIndex */

/* 목록 항목이 마지막으로 바뀐 때 — mt(저장·즐겨찾기 때 찍음)가 없으면(예전 항목) 최근 활동 시각 at으로. 즐겨찾기는 at을 안 바꾸므로 at만으로는 어느 쪽이 새것인지 모름 */
const stampOf = (e) => e.mt || e.at || 0;
/**
 * 이 기기의 목록과 계정에서 받은 목록을 방(id)마다 합침 — 한쪽에만 있는 방은 그대로 두고, 양쪽에 다 있으면 나중에 바뀐 쪽(같으면 계정 쪽).
 * 전에는 받은 목록으로 통째로 덮어, 두 기기가 각각 새 방을 만들면 늦게 올린 쪽의 목록만 남고 다른 쪽의 방이 목록에서 빠졌음(2026-11-23).
 * 지운 방(gone — 이 기기가 지웠거나 삭제 표식을 받은 방)은 어느 쪽에 있어도 뺌: 아직 표식을 못 받은 기기의 목록에 남아 있다가 되살아나지 않게.
 * @param {RoomIndex[]} local 이 기기의 목록 @param {RoomIndex[]} remote 계정의 목록 @param {Record<string, number>} [gone] 지운 방 id → 지운 때
 * @returns {RoomIndex[]} 순서 규칙(sortRooms)대로 선 새 배열
 */
export function mergeRoomLists(local, remote, gone) {
  const list = (a) => (Array.isArray(a) ? a : []),
    byId = new Map();
  for (const e of list(remote).concat(list(local))) {
    if (!e || !e.id || (gone && gone[e.id])) continue;
    const cur = byId.get(e.id);
    if (!cur || stampOf(e) > stampOf(cur)) byId.set(e.id, e);
  }
  return sortRooms(Array.from(byId.values()));
}
/** 두 목록이 같은 방들을 같은 판으로 담고 있는지(순서는 보지 않음) — 합친 목록을 계정에 다시 올릴지 정할 때. @param {RoomIndex[]} a @param {RoomIndex[]} b @returns {boolean} */
export function sameRoomList(a, b) {
  const x = Array.isArray(a) ? a : [],
    y = Array.isArray(b) ? b : [];
  if (x.length !== y.length) return false;
  const m = new Map(y.map((e) => [e && e.id, e]));
  return x.every((e) => {
    const o = e && m.get(e.id);
    return !!o && stampOf(o) === stampOf(e) && !!o.fav === !!e.fav;
  });
}
/**
 * 계정의 방 행(room-<id>) 값이 삭제 표식인지 — 방을 지우면 행을 없애는 대신 { gone: 지운 때 }를 써 둠('바뀐 것만 받기'로 다른 기기가 지움을 알게).
 * @param {unknown} v @returns {boolean}
 */
export const isTomb = (v) => !!v && typeof v === "object" && !Array.isArray(v) && typeof v.gone === "number" && !("msgs" in v);
