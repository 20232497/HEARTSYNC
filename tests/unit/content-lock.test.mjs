// 순서 잠금(tools/content-lock.mjs)의 판정: 뒤에 더하기·이름 고치기는 통과, 중간에 끼우기·지우기·순서 바꾸기·이름표 없애기는 어긋남
import { test } from "node:test";
import assert from "node:assert/strict";
import { LOCK_LISTS, checkLock, forceTable, lockOf, lockText } from "../../tools/content-lock.mjs";

const work = () => ({
  cast: [
    { code: "AAA", name: "가" },
    { code: "BBB", name: "나", of: "AAA" }
  ],
  openings: [
    { id: "first", title: "하나" },
    { id: "second", title: "둘" }
  ],
  places: [{ name: "광장" }, { name: "서고" }, { name: "온실" }],
  cuts: [{ title: "첫 만남" }, { title: "이별" }],
  lore: [
    { keys: ["왕", "임금"], text: "…" },
    { keys: ["검"], text: "…" }
  ]
});
const locked = () => lockOf(work());
const judge = (change) => {
  const c = work();
  change(c);
  return checkLock(locked(), lockOf(c));
};

test("lockOf: 자리로 세는 목록은 이름(장소 이름·컷씬 제목·키워드북 첫 키), 이름표로 세는 목록은 시작 상황 id·인물 코드", () => {
  assert.deepEqual(locked(), {
    places: ["광장", "서고", "온실"],
    cuts: ["첫 만남", "이별"],
    lore: ["왕", "검"],
    openings: ["first", "second"],
    cast: ["AAA", "BBB"],
    endings: []
  });
  assert.deepEqual(lockOf({}), { places: [], cuts: [], lore: [], openings: [], cast: [], endings: [] });
  assert.deepEqual(lockOf({ episode: { endings: [{ id: "good" }, { id: "bad" }] } }).endings, ["good", "bad"]); // 결말 id는 에피소드 안에서 꺼냄
  assert.deepEqual(Object.keys(JSON.parse(lockText(locked()))), ["_", ...Object.keys(LOCK_LISTS)]);
});
test("그대로면 통과이고 최신 — 찍을 것 없음", () => {
  assert.deepEqual(checkLock(locked(), locked()), { errors: [], changes: [], stale: false });
});
test("맨 뒤에 더하기·이름 고치기·새 시작 상황과 인물은 통과 — 다만 잠금이 뒤처져 '찍어야 함'", () => {
  const r = judge((c) => {
    c.places.push({ name: "지하실" });
    c.places[1].name = "큰 서고";
    c.cuts[0].title = "첫 만남(고침)";
    c.lore.push({ keys: ["방패"], text: "…" });
    c.openings.push({ id: "third", title: "셋" });
    c.cast.push({ code: "CCC", name: "다" });
  });
  assert.deepEqual(r.errors, []);
  assert.equal(r.stale, true);
  assert.deepEqual(r.changes, [
    { key: "places", code: "MP2", from: "서고", to: "큰 서고" },
    { key: "places", code: "MP4", to: "지하실" },
    { key: "cuts", code: "EV1", from: "첫 만남", to: "첫 만남(고침)" },
    { key: "lore", code: "lore-3", to: "방패" },
    { key: "openings", code: "third", to: "third" },
    { key: "cast", code: "CCC", to: "CCC" }
  ]);
  // 시작 상황·인물의 제목·이름·순서는 잠그지 않음(이름표만) — 순서만 바뀌면 어긋남은 아니고 잠금만 다시 찍음
  const o = judge((c) => {
    c.openings.reverse();
    c.openings[0].title = "고친 제목";
    c.cast[0].name = "고친 이름";
  });
  assert.deepEqual([o.errors, o.changes, o.stale], [[], [], true]);
});
test("중간에 끼우기: 뒤의 번호가 밀려 어긋남 — 어느 코드가 어디로 밀렸는지 알려 줌", () => {
  const r = judge((c) => {
    c.places.splice(1, 0, { name: "새 장소" });
  });
  assert.equal(r.errors.length, 1);
  assert.equal(r.stale, false);
  assert.match(r.errors[0], /^MP2 '서고'이\(가\) MP3 자리로 밀렸어요/);
  assert.match(r.errors[0], /어긋난 자리 2곳/);
});
test("지우기: 가운데를 지우면 '지워져 당겨짐', 끝을 지우면 '없어짐'", () => {
  assert.match(
    judge((c) => {
      c.places.splice(0, 1);
    }).errors[0],
    /^MP1 '광장'이\(가\) 지워져 뒤의 번호가 당겨졌어요/
  );
  assert.match(
    judge((c) => {
      c.cuts.pop();
    }).errors[0],
    /^EV2 '이별'이\(가\) 없어졌어요/
  );
  assert.match(
    judge((c) => {
      delete c.lore;
    }).errors[0],
    /^lore-1 '왕'이\(가\) 없어졌어요/
  );
});
test("순서 바꾸기: 두 자리를 맞바꿔도 어긋남", () => {
  assert.match(
    judge((c) => {
      c.cuts.reverse();
    }).errors[0],
    /^EV1 '첫 만남'이\(가\) EV2 자리로 밀렸어요/
  );
  assert.match(
    judge((c) => {
      c.lore.reverse();
    }).errors[0],
    /^lore-1 '왕'이\(가\) lore-2 자리로 밀렸어요/
  );
});
test("이름표 없애기: 시작 상황 id·인물 코드가 사라지거나 바뀌면 어긋남", () => {
  assert.match(
    judge((c) => {
      c.openings[0].id = "renamed";
    }).errors[0],
    /^시작 상황 first이\(가\) 없어졌어요/
  );
  assert.match(
    judge((c) => {
      c.cast.pop();
    }).errors[0],
    /^인물 코드 BBB이\(가\) 없어졌어요/
  );
});
test("잠금이 없는 새 작품: 어긋남은 없고 전부 '아직 안 잠김'", () => {
  const r = checkLock(null, locked());
  assert.deepEqual([r.errors, r.stale, r.changes.length], [[], true, 11]);
});
test("한계(문서에 적어 둠): 맨 끝을 지우고 새 항목을 더하면 이름 고치기와 구분되지 않아 통과", () => {
  const r = judge((c) => {
    c.places.pop();
    c.places.push({ name: "전혀 다른 곳" });
  });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.changes, [{ key: "places", code: "MP3", from: "온실", to: "전혀 다른 곳" }]);
});
test("forceTable: 강제로 다시 찍을 때 바뀌는 자리와 없어지는 이름표", () => {
  const c = work();
  c.places.splice(1, 0, { name: "새 장소" });
  c.openings.shift();
  assert.deepEqual(forceTable(locked(), lockOf(c)), ["MP2 · '서고' → '새 장소'", "MP3 · '온실' → '서고'", "MP4 · (없음) → '온실'", "시작 상황 first · 없어짐"]);
});
