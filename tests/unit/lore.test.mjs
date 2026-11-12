// 키워드북(src/js/ai/prompt/lore.js) 단위 테스트 — 상시·제외·보조 키·우선순위·예산
import { test } from "node:test";
import assert from "node:assert/strict";
import { matchLore } from "../../src/js/ai/prompt/lore.js";
import { LORE } from "../../src/js/core/constants.js";

const texts = (list) => list.map((e) => e.text);

test("matchLore: 최근 메시지에 키워드가 나온 항목만, 대소문자 무시, 최대 LORE.max개", () => {
  const lore = [
    { keys: ["경위"], text: "a" },
    { keys: ["순댓국", "사장님"], text: "b" },
    { keys: ["Hale"], text: "c" }
  ];
  assert.deepEqual(texts(matchLore(lore, ["오늘 사장님이", "hale을 봤어"])), ["b", "c"]);
  const many = Array.from({ length: LORE.max + 3 }, (_, i) => ({ keys: ["k" + i], text: String(i) }));
  assert.equal(matchLore(many, [many.map((e) => e.keys[0]).join(" ")]).length, LORE.max);
  assert.deepEqual(matchLore(undefined, ["x"]), []);
  assert.deepEqual(matchLore(lore, []), []);
});
test("matchLore 상시(always): 키워드가 없어도 늘 들어가고 걸린 항목보다 앞에 온다", () => {
  const lore = [
    { keys: ["검"], text: "검 설정" },
    { keys: ["세계"], text: "늘 사실", always: true }
  ];
  assert.deepEqual(texts(matchLore(lore, ["아무 말"])), ["늘 사실"]);
  assert.deepEqual(texts(matchLore(lore, ["검을 뽑았다"])), ["늘 사실", "검 설정"]);
  assert.deepEqual(
    matchLore(lore, ["검"])
      .filter((e) => !e.always)
      .map((e) => e.keys[0]),
    ["검"]
  ); // 말풍선 📖에 쓰는 가름
});
test("matchLore 제외(not)·보조 키(also): not의 낱말이 나오면 빼고, also가 있으면 keys와 also가 모두 나와야 넣는다", () => {
  const lore = [
    { keys: ["황제"], text: "지금의 황제", not: ["선대"] },
    { keys: ["열쇠"], text: "지하실 열쇠", also: ["지하", "창고"] }
  ];
  assert.deepEqual(texts(matchLore(lore, ["황제를 알현했다"])), ["지금의 황제"]);
  assert.deepEqual(texts(matchLore(lore, ["선대 황제의 초상"])), []);
  assert.deepEqual(texts(matchLore(lore, ["열쇠를 주웠다"])), []);
  assert.deepEqual(texts(matchLore(lore, ["열쇠로 창고 문을 열었다"])), ["지하실 열쇠"]);
});
test("matchLore 우선순위(order): 큰 것부터, 같으면 적힌 순서 — 상시끼리·걸린 것끼리 따로 줄 세움", () => {
  const lore = [
    { keys: ["a"], text: "A" },
    { keys: ["b"], text: "B", order: 5 },
    { keys: ["c"], text: "C", order: 5 },
    { keys: ["z"], text: "Z", always: true },
    { keys: ["y"], text: "Y", always: true, order: 1 }
  ];
  assert.deepEqual(texts(matchLore(lore, ["a b c"])), ["Y", "Z", "B", "C", "A"]);
});
test("matchLore 예산(LORE.budget): 상시 + 걸린 항목의 글자 합이 넘으면 그 항목은 자르지 않고 건너뛰고, 더 짧은 다음 항목은 담는다", () => {
  const big = "가".repeat(LORE.budget - 100),
    mid = "나".repeat(200),
    small = "다".repeat(80);
  const lore = [
    { keys: ["늘"], text: big, always: true },
    { keys: ["긴"], text: mid, order: 2 },
    { keys: ["짧"], text: small, order: 1 }
  ];
  const got = matchLore(lore, ["긴 짧"]);
  assert.deepEqual(texts(got), [big, small]);
  assert.ok(got.reduce((n, e) => n + e.text.length, 0) <= LORE.budget);
  assert.ok(
    got.every((e) => lore.includes(e)),
    "항목은 자르지 않고 그대로"
  );
});
