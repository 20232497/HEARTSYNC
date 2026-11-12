// 그림 코드 체계(src/js/images/codes.js)·감정 칸 낱말 점수(src/js/images/situations.js) 단위 테스트 — 둘 다 순수 모듈이라 Node가 바로 import
import { test } from "node:test";
import assert from "node:assert/strict";
import { CODE_RE, SERIES, codeKind, codebook, fallbackSits, imgTag, imgTags, seriesCode, sitOf } from "../../src/js/images/codes.js";
import { sitHints, sitName, sitScores } from "../../src/js/images/situations.js";

test("CODE_RE: 인물 코드는 영문 대문자 1~4자(숫자·소문자 안 됨), MP·EV는 예약 시리즈", () => {
  for (const ok of ["HSY", "C", "KAEL", "RU"]) assert.ok(CODE_RE.test(ok), ok);
  for (const bad of ["hsy", "p1", "HSY3", "ABCDE", ""]) assert.ok(!CODE_RE.test(bad), bad);
  assert.deepEqual(Object.keys(SERIES), ["MP", "EV"]);
  assert.deepEqual([SERIES.MP.kind, SERIES.MP.field, SERIES.EV.kind, SERIES.EV.field], ["place", "places", "cut", "cuts"]);
});
test("codebook: 인물 코드는 0~14(폼은 of), MP·EV는 목록 길이만큼 1부터(목록이 없으면 max 0) — 해석의 단일 출처", () => {
  const c = {
    cast: [
      { code: "HSY", name: "한서윤" },
      { code: "HSYA", name: "각성한 한서윤", of: "HSY" }
    ],
    places: [{ name: "광장", desc: "첫 전장" }]
  };
  const b = codebook(c);
  assert.deepEqual([b.HSY.kind, b.HSY.min, b.HSY.max, b.HSY.name, b.HSY.of], ["cast", 0, 14, "한서윤", ""]);
  assert.equal(b.HSYA.of, "HSY");
  assert.deepEqual([b.MP.kind, b.MP.min, b.MP.max, b.MP.items[0].name, b.MP.label], ["place", 1, 1, "광장", "장소"]);
  assert.deepEqual([b.EV.kind, b.EV.max, b.EV.items], ["cut", 0, []]);
  assert.equal(codebook(null).MP.kind, "place");
  assert.equal(codebook({}).HSY, undefined);
});
test("seriesCode: 종류로 예약 시리즈의 코드 글자를 찾음(다른 모듈이 'MP'·'EV'를 직접 쓰지 않게), 모르는 종류는 빈 문자열", () => {
  assert.equal(seriesCode("place"), "MP");
  assert.equal(seriesCode("cut"), "EV");
  assert.equal(seriesCode("cast"), "");
  for (const k of Object.keys(SERIES)) assert.equal(seriesCode(SERIES[k].kind), k);
});
test("codebook.hidden: 비공개(스포일러) 번호 — 인물은 cast[].hidden의 감정 번호, 장소·컷씬은 hidden: true인 항목의 번호(1부터), 없으면 빈 배열", () => {
  const b = codebook({
    cast: [
      { code: "HSY", name: "한서윤", hidden: [13, 9] },
      { code: "DHR", name: "도하린" }
    ],
    places: [{ name: "광장" }, { name: "숨은 방", hidden: true }],
    cuts: [
      { title: "결말", hidden: true },
      { title: "첫 만남", hidden: false }
    ]
  });
  assert.deepEqual(b.HSY.hidden, [13, 9]);
  assert.deepEqual(b.DHR.hidden, []);
  assert.deepEqual(b.MP.hidden, [2]);
  assert.deepEqual(b.EV.hidden, [1]);
  assert.deepEqual(codebook(null).MP.hidden, []);
});
test("sitOf(예전 태그): 0~14 번호는 그대로, 조합·세 자리 코드는 처음 나오는 0~14 번호, 없으면 1", () => {
  assert.equal(sitOf("3"), 3);
  assert.equal(sitOf(0), 0);
  assert.equal(sitOf("14"), 14);
  assert.equal(sitOf("3,404,501"), 3);
  assert.equal(sitOf("404,6"), 6);
  assert.equal(sitOf("15"), 1);
  assert.equal(sitOf("101,404"), 1);
  assert.equal(sitOf(""), 1);
  assert.equal(sitOf(undefined), 1);
});
test("imgTags: 새 태그 [[HSY3]]은 코드(대문자)+번호 한 토큰, [[img:HSY3]]·소문자도 읽고, 예전 [[img:ks:3,404,501]]도 읽는다", () => {
  const t = imgTags("[[HSY3]] 안녕 [[img:dhr12]] [[MP2]] [[EV1]] [[img:KS:3]] [[img:ys:2,404,501]] [[img:a1:120]] [[상태창]]");
  assert.deepEqual(t, [
    { code: "HSY", sit: 3, raw: "[[HSY3]]" },
    { code: "DHR", sit: 12, raw: "[[img:dhr12]]" },
    { code: "MP", sit: 2, raw: "[[MP2]]" },
    { code: "EV", sit: 1, raw: "[[EV1]]" },
    { code: "KS", sit: 3, raw: "[[img:KS:3]]" },
    { code: "YS", sit: 2, raw: "[[img:ys:2,404,501]]" },
    { code: "A1", sit: 1, raw: "[[img:a1:120]]" }
  ]);
  assert.deepEqual(imgTags("태그 없음 [[HSY]] [[HSY123]]"), []);
  assert.deepEqual(imgTags(null), []);
  assert.equal(imgTag("HSY", 3), "[[HSY3]]");
});
test("codeKind: 작품의 cast에 있으면 인물, MP·EV는 장소·컷씬, 나머지는 모름", () => {
  const c = { cast: [{ code: "HSY" }, { code: "DHR" }] };
  assert.equal(codeKind("HSY", c), "cast");
  assert.equal(codeKind("MP", c), "place");
  assert.equal(codeKind("EV", c), "cut");
  assert.equal(codeKind("ZZ", c), "");
  assert.equal(codeKind("HSY", null), "");
});
test("fallbackSits: 인물은 그 칸 → 1 기본 → 0 프로필(겹치면 한 번만), 장소·컷씬은 그 번호 하나", () => {
  assert.deepEqual(fallbackSits(6), [6, 1, 0]);
  assert.deepEqual(fallbackSits(1, "HSY"), [1, 0]);
  assert.deepEqual(fallbackSits(0), [0, 1]);
  assert.deepEqual(fallbackSits(2, "MP"), [2]);
  assert.deepEqual(fallbackSits(1, "EV"), [1]);
});
test("sitName: 모르는 번호는 '기본'", () => {
  assert.equal(sitName(3), "부끄러움");
  assert.equal(sitName(99), "기본");
});
test("sitScores·sitHints: 낱말로 칸 번호 후보(점수 높은 순 둘)", () => {
  const text = "부끄러워 머뭇거리다 귀까지 빨개졌다. 그러다 피식 웃었다.";
  const s = sitScores(text);
  assert.ok(s.get(3) > s.get(2));
  assert.ok(s.get(2) >= 1);
  assert.deepEqual(sitHints(text), ["3 부끄러움", "2 웃음"]);
  assert.deepEqual(sitHints("칼을 겨누고 방아쇠를"), ["12 공격"]);
  assert.equal(sitScores("").size, 0);
});
