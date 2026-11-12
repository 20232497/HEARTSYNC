// 그림 의뢰 목록(tools/content-art.mjs): 가짜 작품 하나로 줄 수·종류·우선순위·비공개·실림 표시를 보고, 규격 표(ART_SPECS)가 README '그림 싣기'와 같은 값인지 지킴
import fs from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { SIT } from "../../src/js/core/constants.js";
import { ART_SPECS, FIRST_SITS, artRows, artSummary, directCodes } from "../../tools/content-art.mjs";

// 인물 둘(본체 AAA + 그 다른 모습 AAB), 장소 둘(둘째 비공개), 컷씬 하나(비공개), 키워드북 둘 — 실린 그림은 AAA0·MP1·표지·키워드북 첫 항목
const work = () => ({
  id: "zz-art-test",
  title: "시험 작품",
  aud: "f",
  row: "fate",
  artTags: "castle, night",
  cast: [
    { code: "AAA", name: "가람", tags: "black hair", hidden: [13] },
    { code: "AAB", name: "가람(각성)", of: "AAA" }
  ],
  places: [
    { name: "광장", tags: "plaza" },
    { name: "밀실", hidden: true }
  ],
  cuts: [{ title: "재회", when: "다시 만날 때", hidden: true }],
  lore: [
    { keys: ["왕국", "나라"], text: "…", tags: "kingdom" },
    { keys: ["검"], text: "…" }
  ],
  openings: [
    { id: "a", title: "하나", text: "[[AAA3]]\n\n본문", place: 2 },
    { id: "b", title: "둘", text: "[[EV1]] [[ZZ9]] 본문" }
  ],
  commands: [
    { cmd: "규칙", title: "규칙", text: "[[AAB5]] 정해진 글" },
    { cmd: "장면", title: "장면", prompt: "[[AAA9]]는 지시문이라 세지 않음" }
  ],
  images: { AAA: { 0: "content/f/fate/zz-art-test/images/AAA0.webp" }, MP: { 1: "content/f/fate/zz-art-test/images/MP1.webp" } },
  img: "content/f/fate/zz-art-test/images/cover.webp",
  loreImages: { 왕국: "content/f/fate/zz-art-test/images/lore-1.webp" }
});
const row = (rows, code) => rows.find((x) => x.code === code);

test("artRows: 한 줄 = 그림 한 장 — 표지 1 + 인물마다 감정 칸 전부 + 장소 + 컷씬 + 키워드북 항목", () => {
  const rows = artRows(work());
  assert.equal(rows.length, 1 + 2 * SIT.length + 2 + 1 + 2);
  assert.deepEqual(
    rows.slice(0, 2).map((x) => x.code),
    ["cover", "AAA0"]
  );
  assert.deepEqual([...new Set(rows.map((x) => x.kind))], ["표지", "인물", "다른 모습", "장소", "컷씬", "세계관"]);
  assert.equal(new Set(rows.map((x) => x.code)).size, rows.length, "코드는 겹치지 않음");
  assert.deepEqual(
    [row(rows, "AAA3").name, row(rows, "MP2").name, row(rows, "EV1").name, row(rows, "lore-2").name],
    ["가람 · " + SIT[3], "밀실", "재회", "검"]
  );
  // 넣을 경로는 작품 폴더(content/<aud>/[<줄>/]<id>/images/)와 코드 그대로의 파일 이름
  assert.equal(row(rows, "MP2").path, "content/f/fate/zz-art-test/images/MP2.webp");
  // 규격: 0번 칸(프로필)은 2:3, 감정 칸 1~14는 정사각 — 다른 모습도 같음
  assert.deepEqual(
    ["AAA0", "AAA1", "AAA14", "AAB0", "AAB3", "MP1", "cover"].map((c) => row(rows, c).spec),
    ["profile", "cast", "cast", "profile", "cast", "place", "cover"]
  );
  const solo = work();
  delete solo.row;
  solo.aud = "m";
  assert.equal(row(artRows(solo), "cover").path, "content/m/zz-art-test/images/cover.webp");
});
test("우선순위: 1 = 표지·본체의 프로필과 기본·첫 장면과 즉답 글에 직접 나오는 그림·시작 상황의 배경 장소, 2 = 나머지 장소·컷씬·본체의 감정 칸·다른 모습의 프로필과 기본, 3 = 다른 모습의 감정 칸·세계관", () => {
  const c = work(),
    rows = artRows(c),
    rank = (code) => row(rows, code).rank;
  assert.deepEqual([...directCodes(c)].sort(), ["AAA3", "AAB5", "EV1", "MP2"], "작품에 없는 코드(ZZ9)와 AI 지시문(prompt) 속 태그는 세지 않음");
  assert.deepEqual(FIRST_SITS, [0, 1]);
  assert.deepEqual(["cover", "AAA0", "AAA1", "AAA3", "MP2", "EV1", "AAB5"].map(rank), [1, 1, 1, 1, 1, 1, 1]);
  assert.deepEqual(["AAA2", "AAA14", "MP1", "AAB0", "AAB1"].map(rank), [2, 2, 2, 2, 2]);
  assert.deepEqual(["AAB2", "AAB14", "lore-1", "lore-2"].map(rank), [3, 3, 3, 3]);
});
test("비공개·실림·태그 표시와 합계", () => {
  const rows = artRows(work());
  assert.deepEqual(
    rows.filter((x) => x.hidden).map((x) => x.code),
    ["AAA13", "MP2", "EV1"]
  );
  assert.deepEqual(
    rows.filter((x) => x.has).map((x) => x.code),
    ["cover", "AAA0", "MP1", "lore-1"]
  );
  assert.deepEqual(
    rows
      .filter((x) => !x.tags)
      .map((x) => x.code)
      .filter((c) => !/^AAB/.test(c)),
    ["MP2", "EV1", "lore-2"],
    "그림용 영문 태그가 없는 줄(다른 모습 AAB는 태그를 안 적었음)"
  );
  const s = artSummary(rows);
  assert.deepEqual([s.need, s.has], [rows.length, 4]);
  assert.equal(s.left1 + s.left2 + s.left3, rows.length - 4);
  assert.equal(s.left1, 7 - 2, "1순위 7장 가운데 표지·AAA0이 실림");
});
test("규격 표는 모두 확정이고, README '그림 싣기'가 같은 크기를 보여 줌(고칠 곳은 ART_SPECS 한 곳 — 바꾸면 README도)", () => {
  const readme = fs.readFileSync(new URL("../../content/README.md", import.meta.url), "utf8");
  for (const k of Object.keys(ART_SPECS)) {
    const s = ART_SPECS[k];
    assert.equal(s.state, "확정", k);
    assert.equal(s.format, "webp", k);
    assert.match(s.size, /^\d+×\d+$/, k);
    assert.ok(readme.includes(s.size), `README에 ${s.name}의 크기 ${s.size}가 없음`);
  }
  // 적힌 비율이 크기와 정확히 맞고 화면 자리(slot의 첫 비율)와도 같은지 — 다르면 화면에서 잘리거나 여백이 생김
  for (const k of Object.keys(ART_SPECS)) {
    const s = ART_SPECS[k],
      [x, y] = s.size.split("×").map(Number),
      m = s.ratio.match(/^(\d+):(\d+) /),
      slot = s.slot.match(/(\d+):(\d+)/);
    assert.ok(m, k + ": 비율은 'W:H 세로|가로'");
    assert.equal(x * Number(m[2]), y * Number(m[1]), k + ": 크기와 비율이 어긋남");
    assert.equal(x * Number(slot[2]), y * Number(slot[1]), k + ": 크기와 화면 자리 비율이 어긋남");
    assert.ok(x * y <= 1300000, k + ": 모델 기본 해상도(약 100만 화소)보다 많이 큼");
  }
});
