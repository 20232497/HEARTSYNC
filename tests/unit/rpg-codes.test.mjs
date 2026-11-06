// RPG 전용 코드: 12 공격은 cat이 RPG인 작품에서만 AI에게 알리고, 이미지 스튜디오에는 표시를 달고 빈 칸 채우기에서 뺌
import { test } from "node:test";
import assert from "node:assert/strict";

// 앱 모듈이 맨 윗단에서 읽는 브라우저 전역만 가짜로(gen-guard.test.mjs와 같음)
const mem = new Map();
globalThis.window = globalThis;
globalThis.addEventListener = globalThis.removeEventListener = () => {};
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k), key: () => null, length: 0 };
globalThis.location = { protocol: "https:", hostname: "20232497.github.io" };
const { sitFits, sitHints, sitScores } = await import("../../src/js/images/situations.js");
const { rulesPrompt } = await import("../../src/js/ai/prompt/rules.js");
const { codeGroups, groupHTML } = await import("../../src/js/admin/image-codes.js");

const RPG = { cat: "RPG" }, ROMANCE = { cat: "로맨스" }, FIGHT = "칼을 휘둘러 공격하고 주먹으로 덤볐다";
const room = (cat) => ({ char: { title: "t", name: "n", persona: "p", cat, fields: ["호감"], gauge: "호감", cast: [{ code: "a", name: "가을" }] }, persona: { name: "나" }, set: { len: "mid" }, msgs: [], status: {} });

test("sitFits: 공격만 RPG 전용이고 나머지는 어느 작품에서나", () => {
  assert.equal(sitFits(12, RPG), true);
  assert.equal(sitFits(12, ROMANCE), false);
  assert.equal(sitFits(12), false);
  for (const n of [0, 1, 6, 9, 13, 14, 122, 401, 501]) assert.equal(sitFits(n, ROMANCE), true, String(n));
});
test("글 속 낱말: RPG가 아닌 작품은 싸움 낱말이 공격 번호로 가지 않음", () => {
  assert.ok(sitScores(FIGHT, false, RPG).has(12));
  assert.ok(!sitScores(FIGHT, false, ROMANCE).has(12));
  assert.ok(sitHints(FIGHT, false, RPG).includes("12 공격"));
  assert.ok(!sitHints(FIGHT, false, ROMANCE).includes("12 공격"));
  // 다른 낱말은 그대로
  assert.ok(sitScores("눈물이 났다", false, ROMANCE).has(4));
});
test("시스템 프롬프트: RPG 작품에만 공격 번호를 알림", () => {
  const rpg = rulesPrompt(room("RPG")), other = rulesPrompt(room("판타지"));
  assert.match(rpg, /11 휴식, 12 공격, 13 각성/);
  assert.match(rpg, /싸움 → 12 공격/);
  assert.match(other, /11 휴식, 13 각성/);
  assert.match(other, /싸움 → 6 분노/);
  assert.doesNotMatch(other, /12 공격/);
});
test("이미지 스튜디오: 어느 작품에서나 표시가 보이고, RPG가 아니면 빈 칸 채우기에서 뺌", () => {
  const html = (c) => { const g = codeGroups("act", c)[0]; return groupHTML(g, () => false, false, {}, null); };
  for (const c of [RPG, ROMANCE]) assert.match(html(c), /data-row="12"[\s\S]*?RPG 전용/);
  assert.equal((html(RPG).match(/RPG 전용/g) || []).length, 1);
  assert.match(html(RPG), /빈 칸 15개 채우기/);
  assert.match(html(ROMANCE), /빈 칸 14개 채우기/);
  // 공격에만 그림이 없으면 RPG가 아닌 작품은 채울 것이 없음
  const st = {}; for (let n = 0; n < 15; n++) if (n !== 12) st[n] = { exact: true, count: 1 };
  assert.doesNotMatch(groupHTML(codeGroups("act", ROMANCE)[0], () => false, false, st, null), /data-fill/);
  assert.match(groupHTML(codeGroups("act", RPG)[0], () => false, false, st, null), /빈 칸 1개 채우기/);
});
