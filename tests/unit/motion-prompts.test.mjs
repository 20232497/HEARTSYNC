// 움짤 프롬프트 조립(admin/motion-prompts.js)·표(admin/motion-table.js) 단위 테스트 — 공식의 순서, POV 카메라, 성별에 따른 표, 번호대, 표의 범위(전체이용가 코드만 들어가는지)
import { test } from "node:test";
import assert from "node:assert/strict";
import { DIMS, dimOf } from "../../src/js/images/codes.js";
import { IDLE_MOTION, buildVideoPrompt, hasMotionCode, motionRow, sceneTags, wantsVideo } from "../../src/js/admin/motion-prompts.js";
import { MotionPrompts, MotionPrompts_Male } from "../../src/js/admin/motion-table.js";

const LOCKED = "Camera locked on the dynamic action", POV = "First-person POV, shot from the perspective of the partner";

test("공식 순서: 카메라 → 정적 묘사 → 움직임 → 마무리", () => {
  const p = buildVideoPrompt([101, 404], "1girl, solo, office lady");
  const at = [LOCKED, "Featuring 1girl, solo, office lady", MotionPrompts[101].motion_en, "seamless loop"].map((s) => p.indexOf(s));
  assert.ok(at.every((n) => n >= 0), p);
  assert.deepEqual(at, [...at].sort((a, b) => a - b));
});
test("감정/행동이 둘이면 움직임도 둘 다", () => {
  const p = buildVideoPrompt([101, 103]);
  assert.ok(p.includes(MotionPrompts[101].motion_en) && p.includes(MotionPrompts[103].motion_en));
});
test("표에 없는 칸(기본 감정·의상·장소만)은 가만히 숨 쉬는 움직임", () => {
  for (const codes of [[3], [404, 501], []]) assert.ok(buildVideoPrompt(codes).includes(IDLE_MOTION), String(codes));
  assert.ok(!buildVideoPrompt([101]).includes(IDLE_MOTION));
});
test("정적 묘사가 없으면 Featuring을 쓰지 않음", () => {
  assert.ok(!buildVideoPrompt([101]).includes("Featuring"));
});
test("POV: base_prompt나 motion_en에 pov가 있으면 1인칭 카메라, 조합의 어느 하나에 있어도", () => {
  assert.ok(buildVideoPrompt([127]).startsWith(POV), "base_prompt·motion_en 둘 다");
  assert.ok(buildVideoPrompt([129]).startsWith(POV), "motion_en에만 POV");
  assert.ok(buildVideoPrompt([101]).startsWith(LOCKED));
  assert.ok(buildVideoPrompt([101, 127]).startsWith(POV));
  assert.ok(buildVideoPrompt([3], "", { def: () => ({ prompt: "pov, wave", motion: "waving" }) }).startsWith(POV), "고쳐 둔 코드의 프롬프트");
  assert.ok(!/\bpov\b/i.test("spoV"), "낱말 경계");
});
test("성별: 남자 인물은 남성 표를 먼저, 없으면 기본 표. 여자 인물은 기본 표만", () => {
  assert.ok(buildVideoPrompt([151], "", { male: true }).includes(MotionPrompts_Male[151].motion_en));
  assert.ok(buildVideoPrompt([151], "", { male: false }).includes(IDLE_MOTION));
  assert.ok(buildVideoPrompt([251], "", { male: true }).startsWith(POV));
  assert.ok(buildVideoPrompt([101], "", { male: true }).includes(MotionPrompts[101].motion_en), "남성 표에 없으면 기본 표");
});
test("고쳐 둔 코드의 움직임이 표보다 먼저", () => {
  const def = (n) => n === 101 ? { prompt: "wave", motion: "waving a hand" } : n === 103 ? { prompt: "x" } : null;
  assert.equal(motionRow(101, { def }).motion_en, "waving a hand");
  assert.equal(motionRow(103, { def }).motion_en, MotionPrompts[103].motion_en, "움직임을 안 고쳤으면 표");
  assert.equal(motionRow(399, { def }), null);
});
test("번호대: 100~500이 있으면 움짤 대상, 기본·직접 만든 칸·장소 501~만이면 아님", () => {
  for (const codes of [[100], [101], [3, 201], [301], [404], [3, 404, 501], [500]]) assert.ok(wantsVideo(codes), String(codes));
  for (const codes of [[], [0], [3], [14], [15], [99], [3, 501], [599]]) assert.ok(!wantsVideo(codes), String(codes));
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
  assert.ok(hasMotionCode([151], { male: true }) && !hasMotionCode([151]));
});
test("표의 base_prompt가 전체이용가 내장 코드의 그림 프롬프트가 됨, 세미 수위 코드는 그대로", () => {
  assert.equal(DIMS[122].prompt, MotionPrompts[122].base_prompt);
  assert.equal(DIMS[127].prompt, MotionPrompts[127].base_prompt);
  assert.ok(!MotionPrompts[104] && !MotionPrompts[111]);
  assert.equal(DIMS[104].rating, "questionable");
  for (const d of Object.values(DIMS)) if (d.rating !== "safe") assert.ok(!MotionPrompts[d.n], `${d.n}`);
});
// 이 표는 공개 저장소와 웹 주소의 admin.html에 그대로 실림 — 성인 수위 표를 두지 않는 원칙(CLAUDE.md). 번호를 더할 땐 전체이용가 코드인지 보고 아래 목록에 더함
test("표의 범위: 내장 코드는 전체이용가만, 그 밖은 정해 둔 번호만", () => {
  const light = [201, 202, 213, 214, 215, 216], maleOnly = [151, 251];
  for (const k of Object.keys(MotionPrompts).map(Number)) {
    assert.equal(dimOf(k), "act", `${k}는 감정/행동 코드가 아님`);
    if (DIMS[k]) assert.equal(DIMS[k].rating, "safe", `${k}는 전체이용가가 아님`);
    else assert.ok(light.includes(k), `${k}: 전체이용가 코드인지 확인하고 이 시험의 목록에 더하세요 — 이 표는 공개 저장소에 실려요`);
  }
  for (const k of Object.keys(MotionPrompts_Male).map(Number)) assert.ok(maleOnly.includes(k), `${k}: 전체이용가 코드인지 확인하고 이 시험의 목록에 더하세요 — 이 표는 공개 저장소에 실려요`);
});
test("행의 모양: title·base_prompt·motion_en이 다 있고 문장은 영어", () => {
  for (const table of [MotionPrompts, MotionPrompts_Male]) for (const [k, r] of Object.entries(table)) {
    assert.ok(r.title && r.base_prompt && r.motion_en, k);
    assert.ok(!/[ㄱ-힣]/.test(r.base_prompt + r.motion_en), k);
  }
});
test("전체이용가 내장 감정/행동 코드는 모두 움직임이 있음", () => {
  for (const d of Object.values(DIMS)) if (d.dim === "act" && d.rating === "safe") assert.ok(MotionPrompts[d.n], `${d.n} ${d.name}`);
});
test("신체 물리 키워드는 조립 결과에 없음", () => {
  for (const [codes, male] of [[[101], false], [[101], true], [[3], false], [[127], false]]) assert.ok(!/flesh|jiggl|recoil|breast/i.test(buildVideoPrompt(codes, "", { male })), String(codes));
});
