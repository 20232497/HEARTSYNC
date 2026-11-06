// 12 공격은 모든 인물에게(맨손·무기 모두): AI 번호 목록·낱말 후보·빈 칸 채우기에서 거르지 않고, 그림은 무기 낱말이 있으면 쥐고 없으면 주먹. 겹쳐서 줄인 내장 코드(MERGED_CODES)도 여기서
import { test } from "node:test";
import assert from "node:assert/strict";

// 앱 모듈이 맨 윗단에서 읽는 브라우저 전역만 가짜로(gen-guard.test.mjs와 같음)
const mem = new Map();
globalThis.window = globalThis;
globalThis.addEventListener = globalThis.removeEventListener = () => {};
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k), key: () => null, length: 0 };
globalThis.location = { protocol: "https:", hostname: "20232497.github.io" };
const { S } = await import("../../src/js/core/state.js");
const { DIMS, MERGED_CODES } = await import("../../src/js/images/codes.js");
const { mergedCode, sitHints, sitName, sitScores } = await import("../../src/js/images/situations.js");
const { savedParts } = await import("../../src/js/images/prompt.js");
const { rulesPrompt } = await import("../../src/js/ai/prompt/rules.js");
const { codeGroups, groupHTML } = await import("../../src/js/admin/image-codes.js");
const { MotionPrompts } = await import("../../src/js/admin/motion-table.js");

const WORK = { id: "w1", title: "t", name: "n", persona: "p", cat: "로맨스", fields: ["호감"], gauge: "호감", cast: [{ code: "a", name: "가을", tags: "black hair, black suit" }] };
const room = (c) => ({ char: c, persona: { name: "나" }, set: { len: "mid" }, msgs: [], status: {} });
const group = (cast, key, name) => savedParts(WORK, cast, key).find((p) => p.key === name).tags.map((x) => x.t);

test("글 속 낱말: 맨손과 무기 모두 공격 번호로", () => {
  for (const s of ["칼을 휘둘러 베었다", "주먹을 날렸다", "맨손으로 덤볐다", "뺨을 때렸다", "걷어차 버렸다"]) assert.ok(sitScores(s, false).has(12), s);
  assert.ok(sitHints("칼을 휘둘러 공격하고 덤볐다", false).includes("12 공격"));
});
test("시스템 프롬프트: 어느 작품에나 공격 번호와 싸움 안내", () => {
  const p = rulesPrompt(room(WORK));
  assert.match(p, /11 휴식, 12 공격, 13 각성/);
  assert.match(p, /싸움 → 12 공격\(맨손·무기 모두\), 다침/);
});
test("이미지 스튜디오: 빈 칸 채우기에서 공격을 거르지 않음", () => {
  const html = groupHTML(codeGroups("act")[0], () => false, false, {}, null);
  assert.match(html, /빈 칸 15개 채우기/);
  assert.match(html, /data-row="12"/);
});
test("공격 그림: 맨손이면 주먹, 무기가 있으면 주먹 낱말을 빼고 Danbooru 낱말로 쥠", () => {
  const bare = { code: "b", name: "b", tags: "black hair, black suit" };
  assert.ok(group(bare, "12", "scene").includes("fighting stance") && group(bare, "12", "scene").includes("clenched hands"));
  assert.ok(!group(bare, "12", "scene").includes("holding weapon"));
  assert.ok(!group(bare, "12", "look").some((t) => /holding/.test(t)));
  for (const [tags, grip] of [["rapier", "holding sword"], ["longsword", "holding sword"], ["sword at hip", "holding sword"], ["pistols", "holding gun"], ["revolver", "holding gun"], ["sniper rifle", "holding rifle"], ["poison dagger", "holding dagger"], ["bus door shield", "holding shield"], ["bamboo staff", "holding staff"], ["iron flail", "holding flail"], ["iron baton", "holding weapon"], ["장검", "holding sword"], ["쌍권총", "holding gun"]]) {
    const cast = { code: "s", name: "s", tags: "black hair, " + tags }, look = group(cast, "12", "look"), scene = group(cast, "12", "scene");
    assert.ok(look.includes(`(${grip}:1.4)`) && look.includes(tags), tags);
    assert.ok(!scene.includes("fighting stance") && !scene.includes("clenched hands"), tags);
  }
});
test("겨눈 자세: 긴 무기·총은 무기마다 낱말이 다르고, 짧은 무기는 쥐기만", () => {
  const scene = (tags) => group({ code: "s", name: "s", tags: "black hair, " + tags }, "12", "scene");
  for (const [tags, word] of [["rapier", "(thrusting sword forward:1.4)"], ["longsword", "(thrusting sword forward:1.4)"], ["sword at hip", "(thrusting sword forward:1.4)"], ["장검", "(thrusting sword forward:1.4)"], ["long spear", "(thrusting spear forward:1.4)"], ["bamboo staff", "(thrusting staff forward:1.5)"], ["iron baton", "(thrusting weapon forward:1.4)"], ["iron flail", "(thrusting weapon forward:1.4)"], ["pistols", "(aiming at viewer:1.3)"], ["revolver", "(aiming at viewer:1.3)"], ["쌍권총", "(aiming at viewer:1.3)"], ["sniper rifle", "(aiming at viewer:1.4)"]]) {
    const s = scene(tags);
    assert.ok(s.includes(word), tags);
    assert.ok(s.includes("cowboy shot") && !s.includes("action pose"), tags + " 구도");
    assert.ok(s.includes("intense gaze"), tags + " 표정은 남음");
  }
  assert.ok(scene("sniper rifle").includes("rifle raised"));
  // 긴 무기는 들어 올려야 허리에서 잘리지 않음(fd113), 약한 fighting stance는 주먹 낱말(FIST_RE)로 지워지지 않음
  assert.ok(scene("longsword").includes("arms raised") && scene("longsword").includes("(fighting stance:1.2)"));
  // pointing은 칼 대신 큰 손가락을 그림(fd103·fd106·fd108)
  for (const tags of ["rapier", "pistols", "sniper rifle", "bamboo staff"]) assert.ok(!scene(tags).some((t) => /pointing/.test(t)), tags);
  for (const tags of ["poison dagger", "hidden dagger", "bus door shield"]) {
    const s = scene(tags);
    assert.equal(s[0], "holding weapon", tags);
    assert.ok(s.includes("action pose") && !s.some((t) => /aiming|thrusting/.test(t)), tags);
  }
  // 총과 칼을 함께 가지면 총이 먼저
  assert.ok(scene("longsword, revolver").includes("(aiming at viewer:1.3)"));
  // 무기 낱말이 아니면 겨누지 않음
  assert.ok(!group({ code: "s", name: "s", tags: "gunslinger, batman" }, "12", "scene").some((t) => /aiming|thrusting/.test(t)));
});
test("무기 낱말은 싸우는 칸에만: 다른 칸에서는 빠지고, 12가 아닌 싸우는 칸은 지니기만", () => {
  const cast = { code: "s", name: "s", tags: "black hair, longsword" };
  assert.ok(!group(cast, "1", "look").includes("longsword"));
  assert.ok(!group(cast, "3", "look").includes("longsword"));
  for (const k of ["0", "9", "13"]) { assert.ok(group(cast, k, "look").includes("longsword"), k); assert.ok(!group(cast, k, "look").some((t) => /holding/.test(t)), k); }
  // 조합이어도 공격이 들어 있으면 쥠
  assert.ok(group(cast, "12,404", "look").includes("(holding sword:1.4)"));
});
test("무기가 아닌 낱말은 걸리지 않음: hair bow·bow tie·검은 머리", () => {
  for (const t of ["hair bow", "bow tie", "검은 머리", "검은 정장"]) {
    const cast = { code: "s", name: "s", tags: t };
    assert.ok(group(cast, "1", "look").includes(t), t + " 다른 칸에서도 남음");
    assert.ok(group(cast, "12", "scene").includes("fighting stance"), t + " 맨손으로 봄");
  }
});
test("줄인 코드: 표에서 빠지고 대신할 칸은 살아 있으며, 낱말은 그 칸으로 옮겨 감", () => {
  for (const [n, to] of Object.entries(MERGED_CODES)) {
    assert.ok(!DIMS[n] && !MotionPrompts[n], n + "이 아직 표에 있음");
    assert.ok(to < 15 || DIMS[to], n + " → " + to);
    assert.equal(mergedCode(+n), to);
    assert.equal(sitName(+n), sitName(to), "예전 태그의 이름");
  }
  assert.equal(mergedCode(101), 101);
  assert.equal(mergedCode(3), 3);
  for (const [word, to] of [["환희에 찼다", 2], ["쑥스러웠다", 3], ["오열했다", 4], ["경악했다", 5], ["신경질을 냈다", 6], ["질투가 났다", 7], ["심호흡을 했다", 115]]) assert.ok(sitScores(word, false).has(to), word);
});
test("줄인 번호를 내 칸으로 다시 들여오면 그 칸이 이김", () => {
  const before = S.settings.customSits;
  S.settings.customSits = [{ n: 120, name: "환희 칸", prompt: "big smile", rating: "safe" }];
  try {
    assert.equal(mergedCode(120), 120);
    assert.equal(sitName(120), "환희 칸");
  } finally { S.settings.customSits = before; }
});
