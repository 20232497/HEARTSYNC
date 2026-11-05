// 내장 화풍을 그림 내용에 맞추기(src/js/images/style-fit.js) 단위 테스트 — 머리색별 문구, 앞머리 없는 인물, 네거티브 충돌
import { test } from "node:test";
import assert from "node:assert/strict";
import { dropNegConflicts, fitStyle } from "../../src/js/images/style-fit.js";

const ST = { prompt: "warm, (full bangs:1.3), dense bangs, pale skin, end", coolPrompt: "cool, (full bangs:1.3), dense bangs, (pale skin:1.25), end", blackTag: "(black hair:1.3)",
  bangs: "(full bangs:1.3), dense bangs", bangsNeg: "(forehead:1.4), wispy bangs", neg: "(3d, cgi:1.2), (forehead:1.4), wispy bangs, earrings, updo" };

test("fitStyle: 갈색·금발은 기본 문구", () => {
  assert.ok(fitStyle(ST, "1girl, brown hair").prompt.startsWith("warm"));
  assert.ok(fitStyle(ST, "1girl, long pink hair").prompt.startsWith("warm"));
});
test("fitStyle: 검은 머리는 차가운 문구와 머리색 태그", () => {
  const p = fitStyle(ST, "1girl, long black hair").prompt;
  assert.ok(p.startsWith("cool")); assert.ok(p.endsWith("(black hair:1.3)"));
});
test("fitStyle: 은발은 차가운 문구지만 검은 머리 태그는 없음", () => {
  const p = fitStyle(ST, "1girl, silver hair").prompt;
  assert.ok(p.startsWith("cool")); assert.ok(!p.includes("black hair"));
});
test("fitStyle: 이마를 드러낸 인물은 앞머리 태그와 앞머리 네거티브를 뺌", () => {
  const f = fitStyle(ST, "1girl, brown hair, parted bangs, forehead");
  assert.ok(!f.prompt.includes("full bangs")); assert.ok(!f.neg.includes("forehead")); assert.ok(!f.neg.includes("wispy bangs"));
  assert.ok(f.neg.includes("earrings"));
});
test("fitStyle: 어두운 피부로 설정한 인물은 피부를 하얗게 하는 태그를 뺌", () => {
  assert.ok(!fitStyle(ST, "1girl, brown hair, dark skin").prompt.includes("pale skin"));
});
test("fitStyle: 문구가 하나뿐인 화풍은 머리색과 상관없이 그대로", () => {
  assert.equal(fitStyle({ prompt: "tags" }, "1girl, black hair").prompt, "tags");
});
test("dropNegConflicts: 내용에 있는 것만 빼고 묶음은 남김", () => {
  assert.equal(dropNegConflicts("(3d, doll:1.2), earrings, (hair bun:1.2), updo", "hoop earrings, hair bun"), "(3d, doll:1.2), updo");
  assert.equal(dropNegConflicts("photo, earrings", "1girl"), "photo, earrings");
});
test("dropNegConflicts: 낱말 일부만 겹치면 빼지 않음", () => {
  assert.equal(dropNegConflicts("doll, updo", "dollhouse"), "doll, updo");
});
