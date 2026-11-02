// 키워드북(src/js/ai/prompt/lore.js) 단위 테스트
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLore, loreText, matchLore } from "../../src/js/ai/prompt/lore.js";

test("parseLore: 한 줄에 '키워드1, 키워드2 | 설명' — |가 없거나 비어 있으면 뺀다", () => {
  const lore = parseLore("경위, 고양이 | 사무소에 사는 회색 고양이\n설명 없는 줄\n | 키워드 없는 줄\n순댓국 | 1층 24시간 순댓국집");
  assert.deepEqual(lore, [{ keys: ["경위", "고양이"], text: "사무소에 사는 회색 고양이" }, { keys: ["순댓국"], text: "1층 24시간 순댓국집" }]);
  assert.equal(loreText(lore), "경위, 고양이 | 사무소에 사는 회색 고양이\n순댓국 | 1층 24시간 순댓국집", "parseLore ↔ loreText가 서로 되돌림");
});
test("matchLore: 최근 메시지에 키워드가 나온 항목만, 대소문자 무시, 최대 6개", () => {
  const lore = [{ keys: ["경위"], text: "a" }, { keys: ["순댓국", "사장님"], text: "b" }, { keys: ["Hale"], text: "c" }];
  assert.deepEqual(matchLore(lore, ["오늘 사장님이", "hale을 봤어"]).map((e) => e.text), ["b", "c"]);
  const many = Array.from({ length: 9 }, (_, i) => ({ keys: ["k" + i], text: String(i) }));
  assert.equal(matchLore(many, [many.map((e) => e.keys[0]).join(" ")]).length, 6);
  assert.deepEqual(matchLore(undefined, ["x"]), []);
});
