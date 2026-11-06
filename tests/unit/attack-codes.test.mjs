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
  for (const s of ["총구를 겨누었다", "방아쇠를 당겼다", "활시위를 당겼다", "조준했다"]) assert.ok(sitScores(s, false).has(12), s);
});
test("시스템 프롬프트: 어느 작품에나 공격 번호와 싸움 안내", () => {
  const p = rulesPrompt(room(WORK));
  assert.match(p, /11 휴식, 12 공격, 13 각성/);
  assert.match(p, /싸움·무기를 겨눔 → 12 공격\(맨손·무기 모두\), 다침/);
});
test("이미지 스튜디오: 빈 칸 채우기에서 공격을 거르지 않음", () => {
  const html = groupHTML(codeGroups("act")[0], () => false, false, {}, null);
  assert.match(html, /빈 칸 15개 채우기/);
  assert.match(html, /data-row="12"/);
});
test("공격 그림: 맨손이면 주먹", () => {
  const bare = { code: "b", name: "b", tags: "black hair, black suit" };
  assert.ok(group(bare, "12", "scene").includes("fighting stance") && group(bare, "12", "scene").includes("clenched hands"));
  assert.ok(!group(bare, "12", "scene").includes("holding weapon"));
  assert.ok(!group(bare, "12", "look").some((t) => /holding/.test(t)));
});
test("무기를 쥔 자세: 쥔 낱말과 무기는 장면 맨 앞으로, 인물 묶음에서는 빠짐", () => {
  for (const [tags, grip, word] of [["rapier", "holding sword", "sword held diagonally"], ["longsword", "holding sword", "sword held diagonally"], ["장검", "holding sword", "sword held diagonally"], ["long spear", "holding spear", "spear held diagonally"], ["bamboo staff", "holding staff", "staff held diagonally"], ["iron baton", "holding weapon", "weapon held diagonally"], ["iron flail", "holding flail", "weapon held diagonally"], ["pistols", "holding gun", "gun in each hand"], ["쌍권총", "holding gun", "gun in each hand"], ["revolver", "holding revolver", "revolver cylinder"], ["리볼버", "holding revolver", "revolver cylinder"], ["pistol", "holding handgun", "semi-automatic pistol"], ["handgun", "holding handgun", "semi-automatic pistol"], ["권총", "holding handgun", "semi-automatic pistol"], ["flintlock", "holding handgun", "semi-automatic pistol"], ["sniper rifle", "holding rifle", "scope"], ["저격총", "holding rifle", "scope"], ["rifle", "holding rifle", "rifle raised"], ["shotgun", "holding rifle", "rifle raised"], ["musket", "holding rifle", "rifle raised"], ["엽총", "holding rifle", "rifle raised"], ["산탄총", "holding rifle", "rifle raised"], ["기관총", "holding rifle", "rifle raised"], ["longbow", "holding bow", "(drawing bow:1.3)"], ["bow", "holding bow", "(drawing bow:1.3)"], ["활", "holding bow", "(drawing bow:1.3)"], ["crossbow", "holding crossbow", "(aiming:1.3)"], ["석궁", "holding crossbow", "(aiming:1.3)"], ["battle axe", "holding axe", "weapon over shoulder"], ["도끼", "holding axe", "weapon over shoulder"], ["war hammer", "holding hammer", "weapon over shoulder"], ["mace", "holding hammer", "weapon over shoulder"], ["철퇴", "holding hammer", "weapon over shoulder"], ["whip", "holding whip", "one-handed"], ["채찍", "holding whip", "one-handed"], ["scythe", "holding scythe", "(large curved blade above head:1.3)"], ["sickle", "holding sickle", "curved blade"], ["낫", "holding sickle", "curved blade"], ["halberd", "holding polearm", "(large axe blade above head:1.3)"], ["naginata", "holding polearm", "(large curved blade above head:1.3)"], ["언월도", "holding polearm", "(large curved blade above head:1.3)"], ["lance", "holding spear", "spear held diagonally"], ["trident", "holding spear", "spear held diagonally"], ["곤봉", "holding weapon", "weapon held diagonally"], ["poison dagger", "holding dagger", "blade forward"], ["단검", "holding dagger", "blade forward"], ["bus door shield", "holding shield", "shield raised"]]) {
    const cast = { code: "s", name: "s", tags: "black hair, " + tags }, look = group(cast, "12", "look"), scene = group(cast, "12", "scene");
    assert.equal(scene[0], `(${grip}:1.4)`, tags);
    assert.equal(scene[1], tags, tags);
    assert.ok(scene.includes(word) && scene.includes("three-quarter view") && scene.includes("looking at viewer") && scene.includes("cowboy shot"), tags);
    assert.ok(scene.includes("intense gaze"), tags + " 표정은 남음");
    // 주먹 낱말·액션 포즈는 빠지고, 손가락질(pointing)·팔 치켜들기(arms raised)는 쓰지 않음(fd103·fd108·fd114)
    assert.ok(!scene.includes("fighting stance") && !scene.includes("clenched hands") && !scene.includes("action pose"), tags);
    assert.ok(!scene.some((t) => /pointing|arms raised/.test(t)), tags);
    assert.ok(!look.includes(tags) && !look.some((t) => /holding/.test(t)), tags + " 인물 묶음");
  }
});
test("권총과 리볼버는 쥔 낱말과 생김새 낱말이 다름, 두 자루는 쌍권총만", () => {
  const scene = (tags) => group({ code: "s", name: "s", tags }, "12", "scene");
  const pistol = scene("pistol"), revolver = scene("revolver"), dual = scene("pistols");
  assert.ok(pistol.includes("two-handed") && !pistol.includes("revolver cylinder"));
  assert.ok(revolver.includes("one-handed") && !revolver.includes("semi-automatic pistol"));
  for (const s of [pistol, revolver]) assert.ok(!s.includes("(dual wielding:1.4)"));
  // hand on hip은 한 손 자세가 되지만 총이 사라지는 시드가 있음(fd126·fd127)
  assert.ok(!revolver.includes("hand on hip"));
  assert.ok(dual.includes("(dual wielding:1.4)") && dual.includes("two guns"));
  // 긴 총은 권총 줄로 빠지지 않음(한글은 끝이 총이라 줄 순서가 중요), 망원경은 저격총만
  for (const t of ["rifle", "shotgun", "엽총", "산탄총", "기관총"]) { const s = scene(t); assert.ok(s.includes("rifle raised") && !s.includes("scope") && !s.includes("semi-automatic pistol"), t); }
  // 배경을 나무판으로 바꾸거나(wooden grip) 다른 인물을 그리는(western revolver·six-shooter) 낱말은 쓰지 않음(fd119)
  for (const s of [pistol, revolver, dual]) assert.ok(!s.some((t) => /wooden|western|six-shooter|trigger guard/.test(t)));
});
test("무기 낱말이 둘이어도 쥔 낱말은 한 번만", () => {
  const scene = group({ code: "s", name: "s", tags: "improvised shield, bus door shield" }, "12", "scene");
  assert.equal(scene.filter((t) => t === "(holding shield:1.4)").length, 1);
  assert.ok(scene.includes("improvised shield") && scene.includes("bus door shield"));
});
test("자리가 붙은 무기 낱말: 공격 칸에서는 무기만, 다른 싸우는 칸에서는 그대로", () => {
  const cast = { code: "s", name: "s", tags: "black hair, sword at hip" };
  assert.equal(group(cast, "12", "scene")[1], "sword");
  assert.ok(group(cast, "0", "look").includes("sword at hip"));
});
test("총과 칼을 함께 가지면 총을 쥐고 칼은 인물 묶음에 남음", () => {
  const cast = { code: "s", name: "s", tags: "longsword, revolver" }, scene = group(cast, "12", "scene"), look = group(cast, "12", "look");
  assert.deepEqual(scene.slice(0, 2), ["(holding revolver:1.4)", "revolver"]);
  assert.ok(look.includes("longsword") && !look.includes("revolver") && !look.some((t) => /holding/.test(t)));
});
test("자세 줄이 없는 무기(그냥 weapon)는 쥐기만, 무기 낱말이 아니면 맨손", () => {
  const any = { code: "s", name: "s", tags: "weapon" };
  assert.equal(group(any, "12", "scene")[0], "holding weapon");
  assert.ok(group(any, "12", "scene").includes("action pose"));
  assert.ok(group(any, "12", "look").includes("(holding weapon:1.4)"));
  assert.ok(group({ code: "s", name: "s", tags: "gunslinger, batman" }, "12", "scene").includes("fighting stance"));
});
test("무기 낱말은 싸우는 칸에만: 다른 칸에서는 빠지고, 12가 아닌 싸우는 칸은 지니기만", () => {
  const cast = { code: "s", name: "s", tags: "black hair, longsword" };
  assert.ok(!group(cast, "1", "look").includes("longsword"));
  assert.ok(!group(cast, "3", "look").includes("longsword"));
  for (const k of ["0", "9", "13"]) { assert.ok(group(cast, k, "look").includes("longsword"), k); assert.ok(!group(cast, k, "look").some((t) => /holding/.test(t)), k); }
  // 조합이어도 공격이 들어 있으면 쥠
  assert.equal(group(cast, "12,404", "scene")[0], "(holding sword:1.4)");
});
test("무기가 아닌 낱말은 걸리지 않음: hair bow·bow tie·검은 머리", () => {
  for (const t of ["hair bow", "bow tie", "검은 머리", "검은 정장", "도끼눈", "whipped cream", "gunslinger", "망치질"]) {
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
