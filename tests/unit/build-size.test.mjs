// 빌드의 크기 기준(tools/build/common.mjs SIZE_LIMITS — 모듈 용량·한 줄 글자 수): 번들에 든 모듈마다 재는지(빌드가 만든 작품 데이터는 빼고), 요약 한 줄(sizeNote)의 셈,
// 긴 줄 지킴이(longLineErrors — 정렬 도구가 나누지 못해 예외로 둔 줄이 모듈마다 허용한 수를 넘으면 병합 전 검사가 실패)와 지금 저장소가 그 기준 안인지, 코드 정렬(tools/format.mjs)이 맞는지
import { test } from "node:test";
import assert from "node:assert/strict";
import { build, longLineErrors, sizeNote } from "../../tools/build.mjs";
import { SIZE_LIMITS } from "../../tools/build/common.mjs";
import { FORMAT_GLOBS, runFormat } from "../../tools/format.mjs";

const m = (rel, bytes, long) => ({ rel: "src/js/" + rel, bytes, long });

test("크기 재기: 번들에 든 모듈마다 용량·긴 줄 수를 재고, 빌드가 만든 generated.js는 재지 않음", async () => {
  const o = await build("user");
  assert.equal(o.sizes.length, o.modules - 1, "모듈 수에서 generated.js 하나를 뺀 만큼");
  assert.ok(!o.sizes.some((s) => /generated\.js$/.test(s.rel)));
  assert.ok(o.sizes.every((s) => /^src\/js\/.+\.js$/.test(s.rel) && s.bytes > 0 && Number.isInteger(s.long) && s.long >= 0));
  assert.deepEqual([SIZE_LIMITS.moduleBytes, SIZE_LIMITS.lineChars], [16 * 1024, 160], "기준 값(사용자 결정) — 바꾸면 CLAUDE.md '코딩 규칙'도");
});
test("sizeNote: 기준을 넘는 모듈 수와 큰 것 셋의 이름, 긴 줄 수 — 두 빌드에 같이 든 모듈은 한 번만", () => {
  const big = SIZE_LIMITS.moduleBytes + 1024;
  const note = sizeNote([m("a.js", 100, 0), m("b.js", big, 2), m("c.js", big + 2048, 0), m("d.js", big + 1, 5), m("e.js", big + 4096, 0), m("b.js", big, 2)]);
  assert.equal(note, "크기 기준(알림): 16.0KB를 넘는 모듈 4개(e.js 21.0KB, c.js 19.0KB, d.js 17.0KB …) · 160자를 넘는 줄 7개(모듈 2/5개)");
  assert.equal(sizeNote([m("a.js", 100, 0)]), "크기 기준(알림): 16.0KB를 넘는 모듈 0개 · 160자를 넘는 줄 0개(모듈 0/1개)");
});
test("longLineErrors: 예외로 적힌 모듈은 적힌 수까지, 그 밖의 모듈은 긴 줄이 하나라도 있으면 오류", () => {
  const [name, ok] = Object.entries(SIZE_LIMITS.longLines)[0];
  assert.deepEqual(longLineErrors([m(name, 100, ok), m("zz-new.js", 100, 0), m(name, 100, ok)]), []);
  const errs = longLineErrors([m(name, 100, ok + 1), m("zz-new.js", 100, 2)]);
  assert.equal(errs.length, 2);
  assert.match(errs[0], new RegExp(`^src/js/${name.replace(/[.]/g, "\\.")}: 160자를 넘는 줄이 ${ok + 1}개예요\\(둬도 되는 수 ${ok}개\\)`));
  assert.match(errs[1], /^src\/js\/zz-new\.js: 160자를 넘는 줄이 2개예요\(둬도 되는 수 0개\).*이어 붙이면/);
});
test("지금 저장소: 긴 줄이 예외 표 안이고, 예외 표에 남는 자리가 없음(줄였으면 표의 수도 줄임)", async () => {
  const sizes = [...(await build("admin")).sizes, ...(await build("user")).sizes];
  assert.deepEqual(longLineErrors(sizes), []);
  const now = Object.fromEntries([...new Map(sizes.map((s) => [s.rel.replace("src/js/", ""), s.long])).entries()].filter(([, n]) => n > 0));
  assert.deepEqual(
    now,
    SIZE_LIMITS.longLines,
    "예외 표(SIZE_LIMITS.longLines)가 지금 남은 긴 줄과 같아야 함 — 긴 줄을 줄였으면 표의 수를 줄이거나 그 모듈을 표에서 빼세요"
  );
});
test("코드 정렬: src/js·tools·tests가 정렬 도구(prettier)의 모양과 같음 — 다르면 npm run format", () => {
  assert.deepEqual(FORMAT_GLOBS, ["src/js/**/*.js", "tools/**/*.mjs", "tests/**/*.mjs"]);
  const r = runFormat(false);
  assert.equal(r.missing, false, "정렬 도구가 깔려 있어야 함(npm ci)");
  assert.deepEqual(r.files, [], "정렬 안 된 파일 — npm run format");
  assert.equal(r.ok, true, r.err);
});
