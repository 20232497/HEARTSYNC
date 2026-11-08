// 그림 코드 체계(src/js/images/codes.js)·감정 칸 낱말 점수(src/js/images/situations.js) 단위 테스트 — 둘 다 순수 모듈이라 Node가 바로 import
import { test } from "node:test";
import assert from "node:assert/strict";
import { CODE_RE, SERIES, codeKind, fallbackSits, imgTag, imgTags, sitOf } from "../../src/js/images/codes.js";
import { sitHints, sitName, sitScores } from "../../src/js/images/situations.js";

test("CODE_RE: 인물 코드는 영문 대문자 1~4자(숫자·소문자 안 됨), MP·EV는 예약", () => {
  for (const ok of ["HSY", "C", "KAEL", "RU"]) assert.ok(CODE_RE.test(ok), ok);
  for (const bad of ["hsy", "p1", "HSY3", "ABCDE", ""]) assert.ok(!CODE_RE.test(bad), bad);
  assert.deepEqual(SERIES, { MP: "place", EV: "cut" });
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
