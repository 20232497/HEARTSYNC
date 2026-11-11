// 작품 완성도 보고서(tools/content-report.mjs)의 셈: 칸별 숫자(measure)와 기준보다 얕은 칸(shallow)
import test from "node:test";
import assert from "node:assert/strict";
import { BASE, measure, shallow } from "../../tools/content-report.mjs";

test("measure·shallow: 뼈대 칸을 세고, 기준보다 얕은 칸만 짚음(첫 답변 추천은 시작 상황 전부에 있어야 채운 것)", () => {
  const thin = measure({ id: "a", title: "가", persona: "가".repeat(100), cast: [{ code: "A" }, { code: "B", of: "A" }], openings: [{ text: "…" }] });
  assert.deepEqual([thin.cast, thin.forms, thin.setting, thin.lore, thin.openings, thin.images], [1, 1, 100, 0, 1, 0]);
  assert.equal(shallow(thin).length, Object.keys(BASE).length, "아무것도 안 채운 작품은 기준 칸 전부가 얕음");
  const full = measure({ id: "b", title: "나", persona: "가".repeat(BASE.setting), lore: Array(BASE.lore).fill({ keys: ["k"], text: "t" }).concat({ keys: ["z"], text: "t", always: true }),
    openings: [{ text: "…", place: 1, suggestions: ["하나"], lead: { text: "…", turns: 2 } }, { text: "…", suggestions: ["둘"] }],
    places: Array(BASE.places).fill({ name: "곳" }), cuts: Array(BASE.cuts).fill({ title: "컷" }), commands: [{ cmd: "a", prompt: "p" }, { cmd: "b", text: "t" }], guide: "안내",
    images: { A: { 0: "x", 1: "y" }, MP: { 1: "z" } }, img: "cover" });
  assert.deepEqual([full.always, full.lead, full.replies, full.suggest, full.place, full.images], [1, 1, 1, 2, 1, 4]);
  assert.deepEqual(shallow(full), []);
  assert.deepEqual(shallow({ ...full, suggest: 1 }), ["첫 답변 추천"]);
});
