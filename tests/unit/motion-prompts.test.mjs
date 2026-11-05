// 움짤 프롬프트 조립(admin/motion-prompts.js) 단위 테스트 — 공식의 순서, 코드별 움직임, 표의 범위(전체이용가 코드만 들어가는지)
import { test } from "node:test";
import assert from "node:assert/strict";
import { DIMS, dimOf } from "../../src/js/images/codes.js";
import { IDLE_MOTION, MOTIONS, buildVideoPrompt, hasMotionCode, sceneTags } from "../../src/js/admin/motion-prompts.js";

test("공식 순서: 카메라 → 정적 묘사 → 움직임 → 마무리", () => {
  const p = buildVideoPrompt([101, 404], "1girl, solo, office lady");
  const at = ["Static camera", "Featuring 1girl, solo, office lady", MOTIONS[101], "seamless loop"].map((s) => p.indexOf(s));
  assert.ok(at.every((n) => n >= 0), p);
  assert.deepEqual(at, [...at].sort((a, b) => a - b));
});
test("감정/행동이 둘이면 움직임도 둘 다", () => {
  const p = buildVideoPrompt([101, 107]);
  assert.ok(p.includes(MOTIONS[101]) && p.includes(MOTIONS[107]));
});
test("표에 없는 칸(기본 감정·의상·장소만)은 가만히 있는 움직임", () => {
  for (const codes of [[3], [404, 501], []]) assert.ok(buildVideoPrompt(codes).includes(IDLE_MOTION), String(codes));
  assert.ok(!buildVideoPrompt([101]).includes(IDLE_MOTION));
});
test("정적 묘사가 없으면 Featuring을 쓰지 않음", () => {
  assert.ok(!buildVideoPrompt([101]).includes("Featuring"));
});
test("sceneTags: 인물·의상·장소의 영문 태그만(한글 태그·장면 묶음은 뺌)", () => {
  const tag = (t) => ({ t, strong: false });
  assert.equal(sceneTags([
    { key: "scene", tags: [tag("smile")] },
    { key: "extra", tags: [tag("rain")] },
    { key: "look", tags: [tag("1girl"), tag("긴 흑발"), tag("black hair")] },
    { key: "wear", tags: [tag("apron")] },
    { key: "bg", tags: [tag("kitchen"), tag("부엌")] }
  ]), "1girl, black hair, apron, kitchen");
});
test("hasMotionCode: 표에 있는 감정/행동 코드만 참", () => {
  assert.ok(hasMotionCode([101, 404, 501]));
  for (const codes of [[3], [404], [501], [104], [111], [301], []]) assert.ok(!hasMotionCode(codes), String(codes));
});
test("표의 범위: 내장 코드는 전체이용가만, 그 밖은 가벼운 스킨십 여섯 개만", () => {
  const light = [201, 202, 213, 214, 215, 216];
  for (const k of Object.keys(MOTIONS).map(Number)) {
    assert.equal(dimOf(k), "act", `${k}는 감정/행동 코드가 아님`);
    if (DIMS[k]) assert.equal(DIMS[k].rating, "safe", `${k}는 전체이용가가 아님`);
    else assert.ok(light.includes(k), `${k}는 표에 들어갈 수 없음`);
  }
});
test("전체이용가 내장 감정/행동 코드는 모두 움직임이 있고, 문장은 영어", () => {
  for (const d of Object.values(DIMS)) if (d.dim === "act" && d.rating === "safe") assert.ok(MOTIONS[d.n], `${d.n} ${d.name}`);
  for (const [k, v] of Object.entries(MOTIONS)) assert.ok(v && !/[ㄱ-힣]/.test(v), k);
});
