// 대화방(core/rooms.js): 방이 시작 상황을 찾는 순서(openingIndex — id 우선 · 제목 대체 · 못 찾으면 첫째)와 작품에 적힌 시작 상황 id
import { test } from "node:test";
import assert from "node:assert/strict";
import { ORIGINALS } from "../../src/js/content/index.js";
import { LIMITS, OPENING_ID_RE } from "../../src/js/core/constants.js";
import { forkRoom, newRoom, openingIndex, saveRoom, setFav, sortRooms } from "../../src/js/core/rooms.js";
import { S } from "../../src/js/core/state.js";

const P = { id: "p1", name: "지호", memo: "", desc: "" };
// 시작 상황 셋짜리 가짜 작품(실제 작품의 모양을 빌리되 id·제목은 시험용 — 작품이 실제로 적은 값에 기대지 않게)
const work = () => {
  const c = JSON.parse(JSON.stringify(ORIGINALS[0]));
  c.openings = ["a-one", "b-two", "c-three"].map((id, i) => ({ ...c.openings[0], id, title: "제목 " + (i + 1) }));
  return c;
};

test("openingIndex: 방에 적힌 id가 먼저 — 작품이 제목을 고치고 순서를 바꿔도 같은 시작 상황", () => {
  const r = newRoom(work(), 2, P);
  assert.deepEqual([r.openingId, r.opening], ["c-three", "제목 3"]);
  const changed = work();
  changed.openings.reverse();
  changed.openings.forEach((o) => {
    o.title += " (고친 제목)";
  });
  assert.equal(openingIndex(changed, r), 0); // c-three는 뒤집힌 목록의 첫째
  assert.equal(openingIndex(work(), r), 2);
});
test("openingIndex: id가 없던 예전 방·id를 못 찾는 방은 제목으로(분기 표시는 떼고), 그것도 없으면 첫 시작 상황", () => {
  const c = work();
  assert.equal(openingIndex(c, { opening: "제목 3" }), 2, "예전 방 — 제목으로");
  assert.equal(openingIndex(c, { opening: "제목 2 (분기)" }), 1, "분기한 예전 방");
  assert.equal(openingIndex(c, { openingId: "gone", opening: "제목 2" }), 1, "id를 못 찾으면 제목으로");
  assert.equal(openingIndex(c, { openingId: "gone", opening: "없는 제목" }), 0);
  assert.equal(openingIndex(c, {}), 0);
  assert.equal(openingIndex({ openings: [] }, { openingId: "a-one" }), 0);
});
test("분기한 방은 시작 상황 id를 그대로 가져가고, id가 없는 작품(예전 사본)으로 만든 방에는 칸을 만들지 않음", () => {
  const c = work(),
    r = newRoom(c, 1, P),
    f = forkRoom(r, r.msgs[0].id);
  assert.deepEqual([f.openingId, f.opening, openingIndex(c, f)], ["b-two", "제목 2 (분기)", 1]);
  const old = work();
  old.openings.forEach((o) => {
    delete o.id;
  });
  assert.equal("openingId" in newRoom(old, 1, P), false);
});
test("작품의 시작 상황 id: 모두 모양에 맞고 작품 안에서 겹치지 않음(빌드 검사와 같은 규칙)", () => {
  for (const c of ORIGINALS) {
    const ids = c.openings.map((o) => o.id);
    assert.ok(
      ids.every((id) => typeof id === "string" && OPENING_ID_RE.test(id)),
      c.id + ": " + ids.join(",")
    );
    assert.equal(new Set(ids).size, ids.length, c.id + ": 겹치는 id");
  }
  for (const bad of ["A-one", "1st", "a", "has space", "under_score", "x".repeat(25), ""]) assert.equal(OPENING_ID_RE.test(bad), false, bad);
});
test("즐겨찾기: 목록의 순서는 즐겨찾기 먼저·그 안에서 최근 순, 켜고 꺼도 '최근' 시각은 그대로, 한도를 넘으면 바꾸지 않음", async () => {
  S.rooms = [];
  const a = newRoom(work(), 0, P),
    b = newRoom(work(), 1, P),
    c = newRoom(work(), 2, P);
  Object.assign(
    S.rooms.find((x) => x.id === a.id),
    { at: 1 }
  );
  Object.assign(
    S.rooms.find((x) => x.id === b.id),
    { at: 2 }
  );
  Object.assign(
    S.rooms.find((x) => x.id === c.id),
    { at: 3 }
  );
  S.rooms = sortRooms(S.rooms);
  assert.deepEqual(
    S.rooms.map((x) => x.id),
    [c.id, b.id, a.id],
    "기본은 최근 순"
  );
  assert.equal(await setFav(a.id, true), true);
  assert.deepEqual(
    S.rooms.map((x) => [x.id, !!x.fav, x.at]),
    [
      [a.id, true, 1],
      [c.id, false, 3],
      [b.id, false, 2]
    ],
    "즐겨찾기가 맨 위 — 시각은 그대로"
  );
  assert.equal(await setFav(b.id, true), true);
  assert.deepEqual(
    S.rooms.map((x) => x.id),
    [b.id, a.id, c.id],
    "즐겨찾기 안에서는 최근 순"
  );
  assert.equal(await setFav(a.id, false), true);
  assert.equal("fav" in S.rooms.find((x) => x.id === a.id), false, "끄면 칸을 지움(없음 = 아님)");
  assert.equal(await setFav("없는-방", true), false);
  // 한도: 이미 한도만큼 있으면 새로 켜지지 않고(이미 켠 것을 다시 켜는 것은 됨), 하나를 끄면 다시 켤 수 있음
  S.rooms = S.rooms.concat(Array.from({ length: LIMITS.favRooms - 1 }, (_, i) => ({ id: "x" + i, at: 0, fav: true })));
  assert.equal(S.rooms.filter((x) => x.fav).length, LIMITS.favRooms);
  assert.equal(await setFav(c.id, true), false, "한도를 넘음");
  assert.equal(await setFav(b.id, true), true, "이미 켠 방");
  assert.equal(await setFav("x0", false), true);
  assert.equal(await setFav(c.id, true), true);
});
test("즐겨찾기: 방을 저장하면 목록 항목에 따라가고, 분기한 새 방에는 딸려 가지 않음", () => {
  S.rooms = [];
  const r = newRoom(work(), 0, P);
  r.fav = true;
  saveRoom(r);
  assert.equal(S.rooms.find((x) => x.id === r.id).fav, true);
  const f = forkRoom(r, r.msgs[0].id);
  saveRoom(f);
  assert.equal("fav" in f, false);
  assert.equal(!!S.rooms.find((x) => x.id === f.id).fav, false);
  assert.equal(S.rooms[0].id, r.id, "나중에 만든 방보다 즐겨찾기가 앞");
});
