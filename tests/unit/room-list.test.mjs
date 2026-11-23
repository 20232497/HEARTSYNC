// 두 기기의 대화방 목록 합치기(core/room-list.js): 한쪽에만 있는 방을 잃지 않고, 같은 방은 나중에 바뀐 쪽, 지운 방은 뺌. 삭제 표식 읽기(isTomb)
import { test } from "node:test";
import assert from "node:assert/strict";
import { isTomb, mergeRoomLists, sameRoomList } from "../../src/js/core/room-list.js";

const e = (id, at, more) => ({ id, at, name: id, ...(more || {}) });
const ids = (l) => l.map((x) => x.id);

test("mergeRoomLists: 두 기기가 각각 만든 방이 둘 다 남고, 순서는 즐겨찾기 먼저·최근 순", () => {
  const mine = [e("a", 30), e("shared", 10)],
    theirs = [e("b", 20), e("shared", 10)];
  assert.deepEqual(ids(mergeRoomLists(mine, theirs)), ["a", "b", "shared"]);
  assert.deepEqual(ids(mergeRoomLists(mine, [e("b", 20, { fav: true }), e("shared", 10)])), ["b", "a", "shared"]);
  assert.deepEqual(ids(mergeRoomLists(undefined, theirs)), ["b", "shared"], "이 기기에 목록이 없어도");
  assert.deepEqual(ids(mergeRoomLists(mine, null)), ["a", "shared"], "계정에 목록이 없어도");
});
test("mergeRoomLists: 같은 방은 나중에 바뀐 쪽 — 즐겨찾기는 최근 시각(at)을 안 바꾸므로 mt로 견줌, 같으면 계정 쪽", () => {
  const out = mergeRoomLists([e("x", 10, { mt: 50, fav: true, last: "내 것" })], [e("x", 10, { mt: 40, last: "계정 것" })]);
  assert.deepEqual([out[0].last, out[0].fav], ["내 것", true]);
  const out2 = mergeRoomLists([e("x", 10, { mt: 40, last: "내 것" })], [e("x", 99, { mt: 60, last: "계정 것" })]);
  assert.equal(out2[0].last, "계정 것");
  assert.equal(mergeRoomLists([e("x", 10, { last: "내 것" })], [e("x", 10, { last: "계정 것" })])[0].last, "계정 것", "같으면 계정 쪽");
  assert.equal(mergeRoomLists([e("x", 20, { last: "내 것" })], [e("x", 10, { last: "계정 것" })])[0].last, "내 것", "mt가 없는 예전 항목은 at으로");
});
test("mergeRoomLists: 지운 방은 어느 쪽 목록에 있어도 뺌(표식을 아직 못 받은 기기의 목록에서 되살아나지 않게)", () => {
  const gone = { dead: 123 };
  assert.deepEqual(ids(mergeRoomLists([e("a", 1), e("dead", 9)], [e("dead", 9), e("b", 2)], gone)), ["b", "a"]);
  assert.deepEqual(ids(mergeRoomLists([{ at: 1 }, null, e("a", 1)], [e("b", 2)])), ["b", "a"], "id가 없는 항목은 버림");
});
test("sameRoomList: 같은 방들을 같은 판으로 담았는지(순서는 보지 않음)", () => {
  assert.equal(sameRoomList([e("a", 1), e("b", 2)], [e("b", 2), e("a", 1)]), true);
  assert.equal(sameRoomList([e("a", 1)], [e("a", 1), e("b", 2)]), false);
  assert.equal(sameRoomList([e("a", 1, { mt: 5 })], [e("a", 1, { mt: 6 })]), false);
  assert.equal(sameRoomList([e("a", 1, { fav: true })], [e("a", 1)]), false);
  assert.equal(sameRoomList(undefined, []), true);
});
test("isTomb: 삭제 표식({ gone: 때 })만 — 방 본문·빈 값은 아님", () => {
  assert.equal(isTomb({ gone: 1795000000000 }), true);
  assert.equal(isTomb({ gone: 1, msgs: [] }), false, "본문에 같은 이름의 칸이 있어도 방은 방");
  for (const v of [null, undefined, {}, { gone: true }, [], "gone", { id: "r1", msgs: [] }]) assert.equal(isTomb(v), false);
});
