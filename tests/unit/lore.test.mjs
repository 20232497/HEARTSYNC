// 키워드북(src/js/ai/prompt/lore.js) 단위 테스트
import { test } from "node:test";
import assert from "node:assert/strict";
import { matchLore } from "../../src/js/ai/prompt/lore.js";

test("matchLore: 최근 메시지에 키워드가 나온 항목만, 대소문자 무시, 최대 6개", () => {
  const lore = [{ keys: ["경위"], text: "a" }, { keys: ["순댓국", "사장님"], text: "b" }, { keys: ["Hale"], text: "c" }];
  assert.deepEqual(matchLore(lore, ["오늘 사장님이", "hale을 봤어"]).map((e) => e.text), ["b", "c"]);
  const many = Array.from({ length: 9 }, (_, i) => ({ keys: ["k" + i], text: String(i) }));
  assert.equal(matchLore(many, [many.map((e) => e.keys[0]).join(" ")]).length, 6);
  assert.deepEqual(matchLore(undefined, ["x"]), []);
});
