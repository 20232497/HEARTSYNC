// 빌드 검사 checkNoGen(tools/build.mjs) 단위 테스트 — 사용자 사이트(index.html)에 그림 생성 코드가 섞이면 빌드가 실패하는지
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkNoGen } from "../../tools/build.mjs";

test("생성 코드가 없으면 통과", () => {
  assert.deepEqual(checkNoGen(`<script>/* ── src/js/images/pick.js — 그림 고르기 */\nconst a = 1;</script>`), []);
});
test("들어가면 안 되는 것은 종류마다 하나씩 잡음", () => {
  for (const bad of [
    "/* ── src/js/admin/studio.js — 스튜디오 */",
    "/* ── src/js/images/runware.js — 호출 */",
    "/* ── src/js/images/gen-guard.js — 관문 */",
    "await runwareImage(tags)",
    "makeMotion(c, cast, key)",
    "autoImages(r, body)",
    "autoMotions(r, body)",
    "buildVideoPrompt(codes, scene)",
    `{ taskType: "imageInference" }`,
    `{ taskType: 'videoInference' }`
  ]) assert.equal(checkNoGen(bad).length, 1, bad);
});
test("비슷한 이름은 잡지 않음", () => {
  assert.deepEqual(checkNoGen("const myrunwareImageName = 1; // autoImagesOff"), []);
});
