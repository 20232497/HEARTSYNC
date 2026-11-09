/* 세계관 카드(ui/worldart.js): 세계관 수첩이 '펼친 항목'을 고르는 규칙(loreSeen)과 잠긴 카드(loreCard)가 글을 내보내지 않는지 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { loreCard, loreSeen } from "../../src/js/ui/worldart.js";

const lore = [
  { keys: ["번호표", "번호표 기계"], text: "자정에 켜지는 기계", kind: "item" },
  { keys: ["수칙"], text: "열세 줄", kind: "item", always: true },
  { keys: ["지하 2층", "B2"], text: "없는 층", kind: "place" },
  { keys: ["그림자"], text: "반 박자 늦는 그림자", kind: "creature" }
];

test("loreSeen: 응답마다 저장된 📖 키워드(다시 쓴 버전 포함)와 상시 항목만 펼친 것으로", () => {
  const r = { msgs: [
    { role: "user", text: "그림자가 이상해요" },                       // 유저가 낱말을 써도 AI가 꺼내 쓰기 전엔 아님
    { role: "ai", idx: 1, alts: [{ lore: ["번호표"] }, { lore: [] }] }, // 지금 안 보이는 버전도 한 번 본 것
    { role: "ai", idx: 0, alts: [{ text: "📖 없음" }] }
  ] };
  assert.deepEqual([...loreSeen(r, lore)].sort(), [0, 1]);
});

test("loreSeen: 첫 키워드가 아니라 다른 키로 저장돼 있어도 같은 항목, 빈 방은 상시 항목만", () => {
  assert.deepEqual([...loreSeen({ msgs: [{ role: "ai", alts: [{ lore: ["B2"] }] }] }, lore)].sort(), [1, 2]);
  assert.deepEqual([...loreSeen({ msgs: [] }, lore)], [1]);
  assert.equal(loreSeen({}, []).size, 0);
});

test("loreCard: 잠긴 카드는 종류만 — 이름·설명은 내보내지 않음, 열린 카드는 esc한 이름·설명", () => {
  const c = { id: "__none__", loreImages: {} };
  const locked = loreCard(c, lore[2], false, false);
  assert.match(locked, /locked/);
  assert.match(locked, /장소/);
  assert.doesNotMatch(locked, /지하 2층|없는 층/);
  const open = loreCard(c, { keys: ["<b>"], text: "a & b", kind: "concept" }, true, false);
  assert.match(open, /&lt;b&gt;/);
  assert.match(open, /a &amp; b/);
  assert.doesNotMatch(open, /wpic/); // ph 거짓 — 그림 없는 항목에 빈 자리 없음
  assert.match(loreCard(c, lore[0]), /wpic ph/); // 상세 페이지 기본값은 빈 그림 자리를 둠(예전 모양 그대로)
});
