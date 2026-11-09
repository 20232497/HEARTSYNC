// 내 서재(core/shelf.js): 여러 기기의 값을 덮지 않고 합치는 규칙(mergeShelf), 계정 동기화의 날짜 관문(shelfSyncOn), 찜·최근 본 읽고 쓰기
import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import { SHELF } from "../../src/js/core/constants.js";
import { liked, likedIds, markSeen, mergeShelf, recentIds, seenSet, shelfSyncOn, toggleLike, touchRecent } from "../../src/js/core/shelf.js";
import { S } from "../../src/js/core/state.js";

test("mergeShelf: 작품마다 더 늦은 시각 — 다른 기기에서 찜을 푼 것도 전해지고, 수집 기록은 합집합", () => {
  const pc = { likes: { a: 10, b: 20 }, unlikes: {}, recent: { a: 5 }, seen: { a: ["HSY3", "HSY0"] } };
  const phone = { likes: { a: 10, c: 30 }, unlikes: { a: 40 }, recent: { a: 9, c: 7 }, seen: { a: ["HSY0", "MP1"], c: ["EV1"] } };
  const m = mergeShelf(pc, phone);
  assert.deepEqual(m, { likes: { a: 10, b: 20, c: 30 }, unlikes: { a: 40 }, recent: { a: 9, c: 7 }, seen: { a: ["HSY0", "HSY3", "MP1"], c: ["EV1"] } });
  // 합치는 순서와 무관하고(JSON 글까지 같음), 다시 합쳐도 그대로 — 기기끼리 주고받다 멈춤
  assert.equal(JSON.stringify(mergeShelf(phone, pc)), JSON.stringify(m));
  assert.equal(JSON.stringify(mergeShelf(m, pc)), JSON.stringify(m));
  assert.equal(JSON.stringify(mergeShelf(m)), JSON.stringify(m));
});
test("mergeShelf: 빈 값·깨진 값은 빈 서재로, 최근 본은 SHELF.recent개까지(늦게 본 것부터 남김)", () => {
  const empty = { likes: {}, unlikes: {}, recent: {}, seen: {} };
  assert.deepEqual(mergeShelf(), empty);
  assert.deepEqual(mergeShelf(null, "글"), empty);
  assert.deepEqual(mergeShelf({ likes: ["a"], recent: 3, seen: { a: "HSY1" } }, undefined), { ...empty, seen: { a: [] } });
  const many = {}; for (let i = 1; i <= SHELF.recent + 5; i++) many["w" + i] = i;
  const kept = Object.keys(mergeShelf({ recent: many }, { recent: { old: 0.5 } }).recent);
  assert.equal(kept.length, SHELF.recent);
  assert.ok(kept.includes("w" + (SHELF.recent + 5)) && !kept.includes("w1") && !kept.includes("old"));
});
test("shelfSyncOn: SHELF.syncFrom 날짜(이 기기의 날짜)부터 참", () => {
  const p = SHELF.syncFrom.split("-").map(Number);
  assert.equal(shelfSyncOn(new Date(p[0], p[1] - 1, p[2] - 1, 23, 59)), false);
  assert.equal(shelfSyncOn(new Date(p[0], p[1] - 1, p[2], 0, 0)), true);
  assert.equal(shelfSyncOn(new Date(p[0] + 1, 0, 1)), true);
  assert.match(SHELF.syncFrom, /^\d{4}-\d{2}-\d{2}$/);
  // 계정에 올리기 시작하는 날 = 개인정보처리방침 시행일(그 방침에 이 항목을 적었으므로) — 날짜를 미루면 상수와 방침을 같이 고치게
  const day = `${p[0]}년 ${p[1]}월 ${p[2]}일`, doc = fs.readFileSync(new URL("../../privacy.html", import.meta.url), "utf8");
  assert.ok(doc.includes("시행일 " + day) && doc.includes("시행일: " + day), "privacy.html의 시행일이 SHELF.syncFrom과 같아야 함");
});
test("찜 켜고 끄기·최근 본: 방금 누른 쪽이 이기고(같은 순간에 눌러도), 목록은 새것 먼저", () => {
  S.shelf = mergeShelf();
  assert.equal(toggleLike("a"), true); assert.equal(toggleLike("b"), true);
  assert.equal(toggleLike("a"), false); assert.equal(liked("a"), false);
  assert.equal(toggleLike("a"), true); assert.equal(liked("a"), true);
  assert.deepEqual(likedIds().slice().sort(), ["a", "b"]);
  assert.equal(likedIds()[0], "a", "나중에 찜한 것이 앞");
  S.shelf.recent = { x: 1, y: 2 };
  assert.deepEqual(recentIds(), ["y", "x"]);
  touchRecent("y"); assert.equal(S.shelf.recent.y, 2, "이미 맨 앞이면 그대로");
  touchRecent("x"); assert.deepEqual(recentIds(), ["x", "y"]);
  S.shelf = mergeShelf();
});
test("수집 기록: 새 코드가 있을 때만 더하고(작품별), 같은 코드는 한 번만", () => {
  S.shelf = mergeShelf();
  assert.equal(markSeen("a", ["HSY3", "MP1", "HSY3"]), true);
  assert.equal(markSeen("a", ["MP1"]), false, "새 코드가 없으면 저장하지 않음");
  assert.equal(markSeen("a", ["EV1", "MP1"]), true);
  assert.deepEqual(S.shelf.seen, { a: ["EV1", "HSY3", "MP1"] });
  assert.ok(seenSet("a").has("HSY3") && !seenSet("b").has("HSY3"));
  S.shelf = mergeShelf();
});
