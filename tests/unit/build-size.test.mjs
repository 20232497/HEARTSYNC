// 빌드의 크기 기준(tools/build/common.mjs SIZE_LIMITS — 모듈 용량·한 줄 글자 수): 번들에 든 모듈마다 재는지(빌드가 만든 작품 데이터는 빼고), 요약 한 줄(sizeNote)이 맞게 세는지.
// 지금은 알림만이라 '넘으면 실패'는 보지 않는다 — 전체 재정렬(프레임 5차 2부) 뒤에 실패로 바꿀 때 이 시험도 같이
import { test } from "node:test";
import assert from "node:assert/strict";
import { build, sizeNote } from "../../tools/build.mjs";
import { SIZE_LIMITS } from "../../tools/build/common.mjs";

test("크기 재기: 번들에 든 모듈마다 용량·긴 줄 수를 재고, 빌드가 만든 generated.js는 재지 않음", async () => {
  const o = await build("user");
  assert.equal(o.sizes.length, o.modules - 1, "모듈 수에서 generated.js 하나를 뺀 만큼");
  assert.ok(!o.sizes.some((s) => /generated\.js$/.test(s.rel)));
  assert.ok(o.sizes.every((s) => /^src\/js\/.+\.js$/.test(s.rel) && s.bytes > 0 && Number.isInteger(s.long) && s.long >= 0));
  assert.deepEqual(SIZE_LIMITS, { moduleBytes: 16 * 1024, lineChars: 160 }, "기준 값(사용자 결정) — 바꾸면 CLAUDE.md '코딩 규칙'도");
});
test("sizeNote: 기준을 넘는 모듈 수와 큰 것 셋의 이름, 긴 줄 수 — 두 빌드에 같이 든 모듈은 한 번만", () => {
  const big = SIZE_LIMITS.moduleBytes + 1024, m = (rel, bytes, long) => ({ rel: "src/js/" + rel, bytes, long });
  const note = sizeNote([m("a.js", 100, 0), m("b.js", big, 2), m("c.js", big + 2048, 0), m("d.js", big + 1, 5), m("e.js", big + 4096, 0), m("b.js", big, 2)]);
  assert.equal(note, "크기 기준(알림): 16.0KB를 넘는 모듈 4개(e.js 21.0KB, c.js 19.0KB, d.js 17.0KB …) · 160자를 넘는 줄 7개(모듈 2/5개)");
  assert.equal(sizeNote([m("a.js", 100, 0)]), "크기 기준(알림): 16.0KB를 넘는 모듈 0개 · 160자를 넘는 줄 0개(모듈 0/1개)");
});
