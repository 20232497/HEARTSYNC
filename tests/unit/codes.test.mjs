// 그림 태그 읽기(src/js/images/codes.js)·감정 칸 낱말 점수(src/js/images/situations.js) 단위 테스트 — 둘 다 순수 모듈이라 Node가 바로 import
import { test } from "node:test";
import assert from "node:assert/strict";
import { fallbackSits, imgTags, sitOf } from "../../src/js/images/codes.js";
import { sitHints, sitName, sitScores } from "../../src/js/images/situations.js";

test("sitOf: 0~14 번호는 그대로, 예전 조합·세 자리 코드는 처음 나오는 0~14 번호, 없으면 1", () => {
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
test("imgTags: 본문의 태그를 인물 코드(소문자)·칸 번호·원문으로", () => {
  const t = imgTags("[[img:KS:3]] 안녕 [[img:ys:2,404,501]] 그리고 [[img:a1:120]]");
  assert.deepEqual(t, [
    { code: "ks", sit: 3, raw: "[[img:KS:3]]" },
    { code: "ys", sit: 2, raw: "[[img:ys:2,404,501]]" },
    { code: "a1", sit: 1, raw: "[[img:a1:120]]" }
  ]);
  assert.deepEqual(imgTags("태그 없음"), []);
  assert.deepEqual(imgTags(null), []);
});
test("fallbackSits: 그 칸 → 1 기본 → 0 프로필, 겹치면 한 번만", () => {
  assert.deepEqual(fallbackSits(6), [6, 1, 0]);
  assert.deepEqual(fallbackSits(1), [1, 0]);
  assert.deepEqual(fallbackSits(0), [0, 1]);
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
