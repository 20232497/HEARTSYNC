// 대화방(core/rooms.js): 방이 시작 상황을 찾는 순서(openingIndex — id 우선 · 제목 대체 · 못 찾으면 첫째)와 작품에 적힌 시작 상황 id
import { test } from "node:test";
import assert from "node:assert/strict";
import { ORIGINALS } from "../../src/js/content/index.js";
import { LIMITS, OPENING_ID_RE } from "../../src/js/core/constants.js";
import { on } from "../../src/js/core/events.js";
import { migrateRoom } from "../../src/js/core/room-read.js";
import { forkRoom, openingIndex } from "../../src/js/core/room-fork.js";
import { deletedRooms, newRoom, removeRoom, roomGone, roomKey, roomUnsaved, saveRoom, setFav, sortRooms } from "../../src/js/core/rooms.js";
import { S, holdRoom, releaseRoom, roomInUse } from "../../src/js/core/state.js";
import { KV } from "../../src/js/core/storage.js";

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
test("방 읽기 경계(migrateRoom): 기본값이 분명한 빠짐만 채우고, 복구할 수 없으면 null — 원본은 그대로", () => {
  const good = newRoom(work(), 0, P);
  // v2인데 설정 칸이 없는 방(다른 기기·예전 빌드가 남긴 것) — 전에는 여기서 예외가 나 방 화면이 멈췄음
  const noSet = JSON.parse(JSON.stringify(good));
  delete noSet.set;
  delete noSet.persona;
  delete noSet.bookmarks;
  delete noSet.pins;
  delete noSet.memHist;
  const fixed = migrateRoom(noSet);
  assert.ok(fixed, "설정 칸이 없어도 열림");
  assert.deepEqual(fixed.set, good.set, "새 방의 기본 설정으로");
  assert.equal(typeof fixed.persona.name, "string");
  assert.deepEqual([fixed.bookmarks, fixed.pins, fixed.memHist], [[], [], []]);
  // 설정 칸은 있는데 모델이 빠졌거나 표에 없는 값인 방 — 화면이 그 값을 읽다가 멈추지 않게 기본값으로(다른 칸은 그대로)
  const partial = JSON.parse(JSON.stringify(good));
  partial.set = { len: "mid", autoSug: true };
  assert.deepEqual(migrateRoom(partial).set, { ...good.set, autoSug: true });
  const wrong = JSON.parse(JSON.stringify(good));
  wrong.set = { ...good.set, model: "없는-모델", len: "없는-길이", mem: 0 };
  assert.deepEqual(migrateRoom(wrong).set, good.set);
  const inherited = JSON.parse(JSON.stringify(good));
  inherited.set = { ...good.set, model: "constructor", len: "toString" }; // 표에 없는데 객체가 물려받은 이름
  assert.deepEqual(migrateRoom(inherited).set, good.set);
  // 버전 번호가 범위를 벗어난 응답 → 마지막 버전으로, 버전이 하나도 없는 응답·글이 없는 내 메시지는 뺌
  const odd = JSON.parse(JSON.stringify(good));
  odd.msgs.push(
    { id: "u1", role: "user", text: "안녕" },
    { id: "a1", role: "ai", idx: 5, alts: [{ text: "하나" }, { text: "둘" }] },
    { id: "a2", role: "ai", idx: 0, alts: [] },
    { id: "u2", role: "user" }
  );
  const o = migrateRoom(odd);
  assert.deepEqual(o.msgs.map((m) => m.id).slice(1), ["u1", "a1"]);
  assert.equal(o.msgs[2].idx, 1);
  // 복구할 수 없는 방: 메시지가 없음 · 작품 사본이 없음 · 방이 아님 — null을 돌려주고 받은 객체는 건드리지 않음
  for (const broken of [{ ...good, msgs: undefined }, { ...good, msgs: [] }, { ...good, char: null }, { id: good.id }, null, "글"]) {
    const before = JSON.stringify(broken);
    assert.equal(migrateRoom(broken), null);
    assert.equal(JSON.stringify(broken), before);
  }
  // 멀쩡한 방은 그대로
  const same = JSON.parse(JSON.stringify(good));
  assert.deepEqual(migrateRoom(same), good);
});
test("쓰고 있는 방(holdRoom·releaseRoom): 생성과 요약이 겹쳐도 둘 다 끝나야 풀림", () => {
  assert.equal(roomInUse("r-x"), false);
  holdRoom("r-x");
  holdRoom("r-x");
  releaseRoom("r-x");
  assert.equal(roomInUse("r-x"), true);
  releaseRoom("r-x");
  assert.equal(roomInUse("r-x"), false);
  releaseRoom("r-x"); // 더 놓아도 음수가 되지 않음
  holdRoom("r-x");
  assert.equal(roomInUse("r-x"), true);
  releaseRoom("r-x");
});
test("방 저장이 실패하면(본문이 저장소에 들어가지 못함) 목록을 마지막으로 저장된 모양으로 되돌리고 저장 안 됨으로 적음 — 다음 저장이 되면 풀림", async () => {
  S.rooms = [];
  const r = newRoom(work(), 0, P);
  assert.equal(await saveRoom(r), true);
  const good = JSON.stringify(S.rooms.find((x) => x.id === r.id));
  const stored = (await KV.get(roomKey(r.id))).msgs.length;
  // 저장소가 가득 찬 것을 흉내: 방 본문 쓰기만 실패
  const real = KV.set;
  KV.set = function (k, v, o) {
    return k.indexOf("room-") === 0 ? Promise.resolve(false) : real.call(this, k, v, o);
  };
  let told = 0;
  on("rooms", () => told++);
  r.msgs.push({ id: "u-new", role: "user", text: "저장되지 못할 말" }, { id: "a-new", role: "ai", idx: 0, alts: [{ text: "저장되지 못할 답" }] });
  const p = saveRoom(r);
  assert.match(S.rooms.find((x) => x.id === r.id).last, /저장되지 못할 답/, "목록은 바로 고쳐 둠(화면이 기다리지 않게)");
  assert.equal(await p, false);
  assert.equal(JSON.stringify(S.rooms.find((x) => x.id === r.id)), good, "실패하면 마지막으로 저장된 모양으로");
  assert.equal(roomUnsaved(r.id), true);
  assert.equal(told, 2); // 저장을 시작할 때 한 번(목록을 고침), 실패해 되돌릴 때 한 번
  // 처음부터 저장되지 못한 새 방은 목록에 남지 않음
  const ghost = newRoom(work(), 1, P);
  await new Promise((res) => setTimeout(res, 0));
  assert.equal(
    S.rooms.some((x) => x.id === ghost.id),
    false
  );
  assert.equal(roomUnsaved(ghost.id), true);
  KV.set = real;
  assert.equal(await saveRoom(r), true);
  assert.equal(roomUnsaved(r.id), false);
  assert.match(S.rooms.find((x) => x.id === r.id).last, /저장되지 못할 답/);
  assert.equal((await KV.get(roomKey(r.id))).msgs.length, stored + 2);
});
test("잇단 저장: 먼저 시작한 저장이 되고 뒤의 저장이 실패하면, 저장된 앞의 것에 맞는 목록으로 되돌림(더 옛 모양이나 목록에서 빠지는 일 없이)", async () => {
  S.rooms = [];
  const real = KV.set,
    waits = [];
  // 방 본문 쓰기를 붙잡아 두고 시험이 차례대로 끝냄
  KV.set = function (k, v, o) {
    return k.indexOf("room-") === 0 ? new Promise((res) => waits.push(res)) : real.call(this, k, v, o);
  };
  const r = newRoom(work(), 0, P); // 저장 ①(새 방)
  r.msgs.push({ id: "u2", role: "user", text: "둘째" }, { id: "a2", role: "ai", idx: 0, alts: [{ text: "둘째 답" }] });
  const p2 = saveRoom(r); // 저장 ②
  const first = JSON.stringify(S.rooms.length);
  waits[0](true); // ①은 저장됨
  await new Promise((res) => setTimeout(res, 0));
  waits[1](false); // ②는 실패
  assert.equal(await p2, false);
  assert.equal(first, "1");
  const e = S.rooms.find((x) => x.id === r.id);
  assert.ok(e, "첫 본문은 저장됐으니 목록에 남음");
  assert.doesNotMatch(e.last, /둘째 답/, "저장되지 못한 둘째의 미리보기는 아님");
  assert.equal(roomUnsaved(r.id), true);
  KV.set = real;
  assert.equal(await saveRoom(r), true);
  assert.match(S.rooms.find((x) => x.id === r.id).last, /둘째 답/);
});
test("즐겨찾기: 본문을 읽는 사이 지운 방은 다시 쓰지 않음, 본문에 적지 못하면 목록도 그대로", async () => {
  S.rooms = [];
  const a = newRoom(work(), 0, P),
    b = newRoom(work(), 1, P);
  await saveRoom(a);
  await saveRoom(b);
  const p = setFav(a.id, true); // 닫힌 방 — 본문을 읽는 동안
  removeRoom(a.id); // 지움
  assert.equal(await p, false);
  await new Promise((res) => setTimeout(res, 0));
  assert.equal(await KV.get(roomKey(a.id)), undefined, "지운 방의 본문이 되살아나지 않음");
  const real = KV.set;
  KV.set = function (k, v, o) {
    return k.indexOf("room-") === 0 ? Promise.resolve(false) : real.call(this, k, v, o);
  };
  assert.equal(await setFav(b.id, true), false);
  assert.equal(!!S.rooms.find((x) => x.id === b.id).fav, false);
  KV.set = real;
  assert.equal(await setFav(b.id, true), true);
  assert.equal((await KV.get(roomKey(b.id))).fav, true);
});
test("다른 기기가 지운 방(roomGone): 목록·본문에서 빼고 지운 방으로 적음 — 뒤늦은 저장이 되살리지 않고, 목록 항목에는 바뀐 때(mt)가 찍힘", async () => {
  S.rooms = [];
  const a = newRoom(work(), 0, P),
    b = newRoom(work(), 1, P);
  await saveRoom(a);
  assert.equal(typeof S.rooms[0].mt, "number", "목록 항목의 바뀐 때");
  assert.equal(roomGone(a.id, 12345), true);
  assert.deepEqual(
    S.rooms.map((x) => x.id),
    [b.id]
  );
  assert.ok(deletedRooms.has(a.id));
  await new Promise((res) => setTimeout(res, 0));
  assert.equal(await KV.get(roomKey(a.id)), undefined);
  assert.equal(await saveRoom(a), false);
  assert.equal(roomGone("없던-방", 1), false);
});
test('방 삭제(removeRoom): 지운 방으로 적고 목록에서 빼며 "rooms" 알림 — 그 뒤의 저장은 방을 되살리지 않음', async () => {
  S.rooms = [];
  const a = newRoom(work(), 0, P),
    b = newRoom(work(), 1, P);
  let told = 0;
  on("rooms", () => told++);
  removeRoom(a.id);
  assert.ok(deletedRooms.has(a.id));
  assert.deepEqual(
    S.rooms.map((x) => x.id),
    [b.id]
  );
  assert.equal(told, 1);
  await new Promise((res) => setTimeout(res, 0));
  assert.equal(await KV.get(roomKey(a.id)), undefined, "본문도 지워짐");
  saveRoom(a); // 지운 뒤에 끝난 응답·요약의 저장
  assert.deepEqual(
    S.rooms.map((x) => x.id),
    [b.id]
  );
});
