// 여성향 일상 화풍(src/js/images/style-fdaily.js) 단위 테스트 — Runware 네거티브 길이 한도, 남자 대상에서 지워지는 태그, 인물·장면에 맞는 조건(머리 모양·정장·표정·구도), 자동 고르기
import { test } from "node:test";
import assert from "node:assert/strict";

// 앱 모듈이 맨 윗단에서 읽는 브라우저 전역만 가짜로(gen-guard.test.mjs와 같음)
const mem = new Map();
globalThis.window = globalThis;
globalThis.addEventListener = globalThis.removeEventListener = () => {};
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k), key: () => null, length: 0 };
globalThis.location = { protocol: "https:", hostname: "20232497.github.io" };
const { FDAILY } = await import("../../src/js/images/style-fdaily.js");
const { fitStyle, weighTags } = await import("../../src/js/images/style-fit.js");
const { IMG_NEG, NEG_MINOR, SUBJ } = await import("../../src/js/images/runware.js");
const { RATINGS } = await import("../../src/js/images/rating.js");
const { ARCH, autoSetId, builtinSet } = await import("../../src/js/images/styles.js");

const WHO = "1boy, male focus, solo, ";
const fit = (tags) => fitStyle(FDAILY, WHO + tags);
const LEAF = "(hair reaching neck:1.25)", SEXY = "(seductive smile:1.2)", GAZE = "(intense gaze:1.2)", SHOT = "(cowboy shot:1.3)", ANGLE = "(facing viewer:1.6)";

test("네거티브 전체가 Runware 한도(3000자) 안", () => {
  for (const rating of Object.keys(RATINGS)) {
    const all = [ARCH.pony.neg, IMG_NEG, NEG_MINOR, RATINGS[rating].neg, SUBJ.male.neg, "solo, 1girl, 1boy", FDAILY.neg].filter(Boolean).join(", ");
    assert.ok(all.length <= 3000, `${rating}: ${all.length}자`);
  }
});
test("남자 그림에서 조용히 지워지는 태그가 화풍에 없음", () => {
  for (const p of [FDAILY.prompt, FDAILY.coolPrompt, FDAILY.paleTag, FDAILY.blackTag]) {
    const gone = p.split(/,\s*/).filter((t) => SUBJ.male.strip.test(t));
    assert.deepEqual(gone, []);
  }
});
test("앱에 등록됨: Run七八造 모델, 성인 태그, 안전 네거티브", () => {
  const b = builtinSet("fdaily");
  assert.equal(b.model, "civitai:548016@861939");
  assert.ok(b.prompt.startsWith("adult man, "));
  for (const t of ["(baby face:1.3)", "(young:1.3)", "(teen:1.4)", "(school uniform:1.4)", "(bare chest:1.5)", "shirtless", "nipples"]) assert.ok(b.neg.includes(t), t);
  assert.ok(b.noHumans && b.noHumans.model !== "civitai:959624@1074388", "사람 없는 그림에 YabaL을 쓰지 않음(그림 판매 불가)");
});
test("머리색: 갈색은 따뜻한 문구, 검정은 차가운 문구 + 머리색 태그", () => {
  const brown = fit("brown hair, white shirt").prompt, black = fit("black hair, emperor").prompt;
  assert.ok(brown.includes("soft warm palette")); assert.ok(!brown.includes(FDAILY.paleTag));
  assert.ok(black.includes("soft cool palette")); assert.ok(black.endsWith(FDAILY.blackTag)); assert.ok(!black.includes(FDAILY.paleTag));
});
test("머리색: 회색·은발·애쉬 금발은 차가운 문구 + 성숙 태그, 그냥 금발은 따뜻한 문구", () => {
  for (const hair of ["grey hair", "(grey hair:1.25)", "silver hair", "ash blonde hair", "(ash blonde hair:1.25)", "platinum blond hair"]) {
    const p = fit(hair).prompt;
    assert.ok(p.includes("soft cool palette"), hair); assert.ok(p.endsWith(FDAILY.paleTag), hair);
  }
  const blond = fit("blonde hair, wavy hair").prompt;
  assert.ok(blond.includes("soft warm palette")); assert.ok(!blond.includes(FDAILY.paleTag));
});
test("애쉬 금발 규칙은 paleTag가 없는 화풍(남성향 일상)을 바꾸지 않음", () => {
  assert.ok(fitStyle({ prompt: "warm", coolPrompt: "cool" }, "1girl, ash blonde hair").prompt.startsWith("warm"));
});
test("머리 모양을 정하지 않은 인물은 리프컷", () => {
  for (const tags of ["black hair, golden eyes, emperor", "blonde hair, wavy hair", "black hair, messy hair, narrow eyes", "black hair, neat hair, glasses", "brown hair, soft hair"]) assert.ok(fit(tags).prompt.includes(LEAF), tags);
});
test("자기 머리 모양이 있는 인물은 리프컷을 빼고, 그 모양을 막는 네거티브도 뺌", () => {
  const cases = ["brown hair, short hair, knight", "black hair, very short hair, chef", "silver hair, long hair, low ponytail", "black hair, slicked back hair", "dark red hair, half updo", "brown hair, permed hair", "black hair, messy hair, hair over eyes"];
  for (const tags of cases) assert.ok(!fit(tags).prompt.includes(LEAF), tags);
  const pony = fit("silver hair, long hair, low ponytail").neg;
  for (const t of ["(long hair:1.5)", "(low ponytail:1.5)", "(ponytail:1.4)"]) assert.ok(!pony.includes(t), t);
  const slick = fit("black hair, slicked back hair").neg;
  assert.ok(!slick.includes("(forehead:1.2)")); assert.ok(!slick.includes("swept back hair"));
  assert.ok(fit("brown hair").neg.includes("(forehead:1.2)"));
});
test("정장: 목 태그를 바꾸고 긴 목 네거티브를 뺌, 수영복·보디슈트는 해당 없음", () => {
  for (const tags of ["black hair, black suit", "(black suit jacket:1.4)", "black three-piece suit, waistcoat", "navy blue suit, necktie", "tuxedo"]) {
    const f = fit(tags);
    assert.ok(f.prompt.includes("(long neck:1.3), (thick neck:1.25)"), tags); assert.ok(!f.prompt.includes("(muscular neck:1.35)"), tags); assert.ok(!f.neg.includes("(long neck:1.3)"), tags);
  }
  for (const tags of ["swimsuit", "bodysuit", "brown hair, white shirt"]) {
    const f = fit(tags);
    assert.ok(f.prompt.includes("(muscular neck:1.35)"), tags); assert.ok(f.neg.includes("(long neck:1.3)"), tags);
  }
});
test("표정: 뚜렷한 감정 칸은 섹시한 미소·눈빛을 빼고, 은은한 칸은 그대로", () => {
  const strong = ["crying, streaming tears, sad, frown, looking down", "angry, furious, clenched teeth, glaring", "surprised, wide-eyed, open mouth", "scared, frightened, trembling", "pout, puffy cheeks, annoyed", "smile, open mouth, :d, laughing, closed eyes, happy", "blush, embarrassed, shy", "injured, bandages", "sleeping, closed eyes, lying down", "fighting stance, attacking"];
  for (const tags of strong) { const p = fit(tags).prompt; assert.ok(!p.includes(SEXY), tags); assert.ok(!p.includes(GAZE), tags); assert.ok(!p.includes("closed mouth"), tags); }
  const mild = ["portrait, upper body, looking at viewer, light smile", "neutral expression, closed mouth, upper body", "relieved, gentle smile", "blush, loving gaze, gentle smile"];
  for (const tags of mild) assert.ok(fit(tags).prompt.includes(SEXY), tags);
  assert.ok(!fit("pout, puffy cheeks").neg.includes("(pouting:1.4)"));
  assert.ok(fit("brown hair").neg.includes("(pouting:1.4)"));
});
test("각도: 기본은 정면, 장면이 다른 각도를 정하면 빼고, 네거티브에 각도를 막는 태그는 없음", () => {
  assert.ok(FDAILY.prompt.includes(ANGLE)); assert.ok(FDAILY.coolPrompt.includes(ANGLE));
  assert.ok(!FDAILY.prompt.includes("three-quarter view"));
  assert.ok(fit("facing viewer, smile").prompt.includes(ANGLE));
  for (const tags of ["from side", "three-quarter view", "profile", "from above", "from below"]) assert.ok(!fit(tags).prompt.includes(ANGLE), tags);
  for (const t of ["from side", "three-quarter", "profile"]) assert.ok(!FDAILY.neg.includes(t), t);
});
test("구도: 장면이 정한 구도·각도는 화풍이 덮지 않음", () => {
  const up = fit("portrait, upper body, light smile").prompt;
  assert.ok(!up.includes(SHOT)); assert.ok(up.includes(ANGLE));
  const back = fit("from behind").prompt;
  assert.ok(back.includes(SHOT)); assert.ok(!back.includes(ANGLE));
  const lying = fit("sofa, lying on couch").prompt;
  assert.ok(!lying.includes(SHOT)); assert.ok(!lying.includes(ANGLE));
  const plain = fit("brown hair").prompt;
  assert.ok(plain.includes(SHOT)); assert.ok(plain.includes(ANGLE));
});
test("태그를 빼도 문구가 깨지지 않고 안전 네거티브는 그대로", () => {
  const f = fit("silver hair, long hair, low ponytail, black suit, crying, close-up, from behind, forehead");
  assert.ok(!/,\s*,/.test(f.prompt)); assert.ok(!/^,|,\s*$/.test(f.prompt)); assert.ok(!/,\s*,/.test(f.neg));
  assert.ok(f.prompt.endsWith(FDAILY.paleTag));
  for (const t of ["(baby face:1.3)", "(young:1.3)", "(teen:1.4)", "(school uniform:1.4)"]) assert.ok(f.neg.includes(t), t);
});
test("넘긴 머리·아주 짧은 머리는 화풍 맨 앞에서 강조", () => {
  const slick = fit("black hair, slicked back hair").prompt;
  assert.ok(slick.startsWith("(slicked back hair:1.5), (forehead:1.3), ")); assert.ok(!slick.includes(LEAF));
  assert.ok(fit("black hair, very short hair").prompt.startsWith("(very short hair:1.5), "));
  assert.ok(fit("brown hair, short hair").prompt.startsWith("adult man, "));
});
test("weighTags: 인물·장면 태그에 가중치, 인원·성별·배경 자리·이모티콘·이미 가중치 있는 태그는 그대로", () => {
  assert.equal(weighTags("crying, 1boy, male focus, solo, black hair, (black suit:1.4), :d, painting (object), detailed background", 1.3),
    "(crying:1.3), 1boy, male focus, solo, (black hair:1.3), (black suit:1.4), :d, painting (object), detailed background");
  assert.equal(weighTags("no humans, animal focus, cat", 1.3), "no humans, animal focus, (cat:1.3)");
  assert.equal(weighTags("1boy, crying", undefined), "1boy, crying");
  assert.equal(FDAILY.contentWeight, 1.3);
});
test("사람 없는 그림은 내용 가중치를 쓰지 않고 그림 판매가 되는 모델로", () => {
  const b = builtinSet("fdaily");
  assert.equal(b.noHumans.contentWeight, undefined);
  assert.equal(b.noHumans.model, "civitai:827184@1761560");
});
test("자동 고르기: 남자는 여성향 일상, 여성향 작품의 여자 인물은 남성향 일상", () => {
  assert.equal(autoSetId({ kind: "daily", aud: "f", male: true }), "fdaily");
  assert.equal(autoSetId({ kind: "daily", aud: "f" }), "fdaily");
  assert.equal(autoSetId({ kind: "daily", aud: "f", male: false }), "mdaily");
  assert.equal(autoSetId({ kind: "daily", aud: "m", male: true }), "fdaily");
  assert.equal(autoSetId({ kind: "daily", aud: "m", male: false }), "mdaily");
  assert.equal(autoSetId({ kind: "daily", aud: "all", male: true }), "fdaily");
  assert.equal(autoSetId({ kind: "daily", aud: "all", male: false }), "mdaily");
  assert.equal(autoSetId({ kind: "world", aud: "f", male: false }), "fworld");
  assert.equal(autoSetId(), "mdaily");
});
