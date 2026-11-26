// 요금 계산(src/js/core/wallet.js): 턴 견적(무료 턴·PLUS·하트)과 답변 추천의 값 — 자동 받기(방 설정 autoSug)가 턴 값에 더해지는 규칙, 차감과 환불
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { FREE_DAILY, SUGGEST_COST } from "../../src/js/core/constants.js";
import { S } from "../../src/js/core/state.js";
import { today } from "../../src/js/core/util.js";
import { charge, heartsOf, listPrice, qShort, quote, refund, refundSug, sugQuote } from "../../src/js/core/wallet.js";

const set = (model, autoSug) => ({ model, len: "mid", mem: 10, rerollAsk: false, ...(autoSug ? { autoSug: true } : {}) });
/** 지갑을 정해진 상태로: 하트·오늘 쓴 무료 턴·PLUS 여부 */
function wallet({ hearts = 30, freeUsed = 0, pro = false } = {}) {
  Object.assign(S.wallet, { hearts, freeUsed, freeDay: today(), ledger: [], pro: pro ? { until: Date.now() + 86400000 } : null });
}
beforeEach(() => wallet());

test("quote: 자동 받기가 꺼진 방은 예전과 같은 값(추천 값 0) — 무료 턴 · 하트 · PLUS", () => {
  assert.deepEqual(quote(set("lite")), { type: "free", n: 0, list: listPrice("lite", "mid", 10), sug: 0 });
  const story = quote(set("story"));
  assert.deepEqual([story.type, story.n, story.sug, heartsOf(story), qShort(story)], ["heart", story.list, 0, story.list, "♥" + story.list]);
  wallet({ freeUsed: FREE_DAILY });
  assert.equal(quote(set("lite")).type, "heart", "무료 턴을 다 쓰면 라이트도 하트");
  wallet({ pro: true });
  assert.deepEqual([quote(set("lite")).type, qShort(quote(set("lite")))], ["plus", "PLUS"]);
  for (const m of ["story", "master"]) assert.equal(quote(set(m)).n, quote(set(m)).list, `PLUS도 ${m}는 정가(할인 없음 — 2026-11-26)`);
  wallet({ pro: true, freeUsed: FREE_DAILY });
  assert.equal(quote(set("lite")).type, "plus", "PLUS는 무료 턴을 다 써도 라이트 무제한");
});
test("quote: 자동 받기를 켠 방은 턴 값에 추천 값이 더해짐 — 무료 턴에서도, PLUS에서도 추천 값은 그대로", () => {
  const free = quote(set("lite", true));
  assert.deepEqual([free.type, free.n, free.sug, heartsOf(free), qShort(free)], ["free", 0, SUGGEST_COST, SUGGEST_COST, "무료+♥" + SUGGEST_COST]);
  const story = quote(set("story", true));
  assert.deepEqual([story.sug, heartsOf(story), qShort(story)], [SUGGEST_COST, story.list + SUGGEST_COST, "♥" + (story.list + SUGGEST_COST)]);
  wallet({ pro: true });
  const plus = quote(set("lite", true));
  assert.deepEqual([plus.type, plus.sug, qShort(plus)], ["plus", SUGGEST_COST, "PLUS+♥" + SUGGEST_COST]);
  const pStory = quote(set("story", true));
  assert.deepEqual([pStory.n, pStory.sug], [pStory.list, SUGGEST_COST], "PLUS의 스토리는 정가 + 추천 값");
});
test("quote: 하트가 모자라면 자동 받기는 그 턴만 쉼(보이는 값만 냄) — 턴 자체는 막지 않음", () => {
  wallet({ hearts: 0 });
  const free = quote(set("lite", true));
  assert.deepEqual([free.type, free.sug, qShort(free)], ["free", 0, "무료"]);
  const story = quote(set("story"));
  wallet({ hearts: story.list }); // 턴 값만큼만 있음 → 추천 값까지는 못 냄
  assert.equal(quote(set("story", true)).sug, 0);
  wallet({ hearts: story.list + SUGGEST_COST });
  assert.equal(quote(set("story", true)).sug, SUGGEST_COST);
});
test("charge·refund: 무료 턴은 턴 수를, 추천 값은 하트를 — 실패하면 둘 다 되돌리고 장부에 남김", () => {
  const q = quote(set("lite", true));
  charge(q, "작품 · 라이트");
  assert.deepEqual([S.wallet.freeUsed, S.wallet.hearts], [1, 30 - SUGGEST_COST]);
  assert.deepEqual(
    S.wallet.ledger.map((x) => [x.d, x.label]),
    [
      [-SUGGEST_COST, "작품 · 라이트 · 답변 추천(자동 받기)"],
      [0, "작품 · 라이트 · 무료 턴"]
    ]
  );
  refund(q, "작품 · 라이트");
  assert.deepEqual([S.wallet.freeUsed, S.wallet.hearts, q.sug], [0, 30, 0]);
  const s = quote(set("story", true));
  charge(s, "작품 · 스토리");
  assert.equal(S.wallet.hearts, 30 - s.list - SUGGEST_COST);
  refund(s, "작품 · 스토리");
  assert.equal(S.wallet.hearts, 30);
});
test("refund: 자정 전에 쓴 무료 턴이 자정 뒤에 실패하면 새 날의 수는 줄이지 않음(무료 턴이 하나 더 생기지 않게) — 추천 값은 그대로 되돌림", () => {
  const q = quote(set("lite", true));
  charge(q, "작품 · 라이트");
  assert.equal(q.day, today(), "charge가 센 날을 적음");
  Object.assign(S.wallet, { freeDay: "9999-12-31", freeUsed: 1 }); // 자정이 지나 새 날로 세기 시작했고, 새 날에 한 턴을 씀
  refund(q, "작품 · 라이트");
  assert.deepEqual([S.wallet.freeUsed, S.wallet.hearts, q.sug], [1, 30, 0]);
});
test("refundSug: 답은 왔는데 추천이 안 온 턴은 추천 값만 되돌림 — 두 번 되돌리지 않고, 그 뒤의 값 표시는 실제 낸 값", () => {
  const q = quote(set("story", true));
  charge(q, "작품 · 스토리");
  refundSug(q, "작품 · 스토리");
  assert.deepEqual([S.wallet.hearts, q.sug, qShort(q)], [30 - q.list, 0, "♥" + q.list]);
  refundSug(q, "작품 · 스토리");
  assert.equal(S.wallet.hearts, 30 - q.list, "다시 불러도 그대로");
  refund(q, "작품 · 스토리"); // 그 뒤 턴이 실패로 끝나면 턴 값만 되돌림
  assert.equal(S.wallet.hearts, 30);
  const off = quote(set("story"));
  refundSug(off, "작품 · 스토리");
  assert.equal(S.wallet.hearts, 30, "추천 값을 내지 않은 턴은 되돌릴 것이 없음");
});
test("sugQuote: 눌러서 받는 추천은 요금제와 무관하게 SUGGEST_COST — 차감과 실패 환불", () => {
  const q = sugQuote();
  assert.deepEqual([q.type, q.n, qShort(q)], ["heart", SUGGEST_COST, "♥" + SUGGEST_COST]);
  wallet({ pro: true });
  assert.equal(sugQuote().n, SUGGEST_COST, "PLUS도 같은 값");
  charge(q, "작품 · 답변 추천");
  assert.equal(S.wallet.hearts, 30 - SUGGEST_COST);
  refund(q, "작품 · 답변 추천");
  assert.equal(S.wallet.hearts, 30);
  assert.equal(S.wallet.freeUsed, 0, "무료 턴은 건드리지 않음");
});
