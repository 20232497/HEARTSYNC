/* 계정의 내 서재(찜·최근 본·수집 기록) 행을 이 기기의 서재와 합침(takeShelf) — 다른 키와 달리 받은 값으로 덮지 않고 합치고, 이 기기에만 있던 것은 계정으로 올림 */
import { mergeShelf } from "../core/shelf.js";
import { S } from "../core/state.js";
import { KV } from "../core/storage.js";
import { CLOUD, SHELF_KEY } from "./cloud.js";

/** 계정의 서재와 이 기기의 서재를 합침: 이 기기에만 있던 것은 계정으로 올리고(CLOUD.put), 이 기기 값이 바뀌었으면 true. @param {unknown} remote 계정의 서재 행 값 @returns {boolean} */
export function takeShelf(remote) {
  const local = KV.getLocal(SHELF_KEY),
    m = mergeShelf(local, remote),
    s = JSON.stringify(m);
  if (s !== JSON.stringify(mergeShelf(remote))) CLOUD.put(SHELF_KEY, m);
  if (s === JSON.stringify(mergeShelf(local))) return false;
  KV.setLocal(SHELF_KEY, m);
  S.shelf = m;
  return true;
}
