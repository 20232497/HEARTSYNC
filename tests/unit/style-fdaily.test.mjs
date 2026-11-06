// 일상 화풍 단위 테스트(여성향 src/js/images/style-fdaily.js, 남성향 styles.js) — Runware 네거티브 길이 한도, 남자 대상에서 지워지는 태그, 인물·장면에 맞는 조건(머리 모양·정장·구도·정면), 표정은 코드만 정함, 자동 고르기
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// 앱 모듈이 맨 윗단에서 읽는 브라우저 전역만 가짜로(gen-guard.test.mjs와 같음)
const mem = new Map();
globalThis.window = globalThis;
globalThis.addEventListener = globalThis.removeEventListener = () => {};
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k), key: () => null, length: 0 };
globalThis.location = { protocol: "https:", hostname: "20232497.github.io" };
const { FDAILY } = await import("../../src/js/images/style-fdaily.js");
const { fitStyle, sceneMoves, weighTags } = await import("../../src/js/images/style-fit.js");
const { IMG_NEG, NEG_MINOR, SUBJ } = await import("../../src/js/images/runware.js");
const { RATINGS } = await import("../../src/js/images/rating.js");
const { ARCH, autoSetId, builtinSet } = await import("../../src/js/images/styles.js");
const { SIT_PONY_TAGS } = await import("../../src/js/images/prompt.js");
const { MotionPrompts } = await import("../../src/js/admin/motion-table.js");

const WHO = "1boy, male focus, solo, ";
const fit = (tags) => fitStyle(FDAILY, WHO + tags);
const LEAF = "(hair reaching neck:1.25)", SHOT = "(cowboy shot:1.3)", ANGLE = "(facing viewer:1.7)", MD_ANGLE = "(facing viewer:1.35)";
const MD = builtinSet("mdaily");
// 화풍에 넣으면 모든 칸의 얼굴이 같아지는 표정 태그 — 표정은 코드가 정함
const FIXED_FACE = /seductive|smirk|sultry|smoldering|charismatic|alluring|intense gaze|half-closed eyes|half-lidded|pouty lips|light blush|sharp eyes|cat eyes|closed mouth/;

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
  for (const t of ["(long hair:1.5)", "(low ponytail:1.5)"]) assert.ok(!pony.includes(t), t);
  const tied = fit("silver hair, high ponytail, hair tied up");
  assert.ok(!tied.prompt.includes(LEAF)); assert.ok(tied.neg.includes("(long hair:1.5)"), "올려 묶은 머리는 긴 머리가 풀려 내려오지 않게");
  assert.ok(!fit("dark red hair, half updo, hair bun").neg.includes("(hair bun:1.4)"));
  const slick = fit("black hair, slicked back hair").neg;
  assert.ok(!slick.includes("(forehead:1.2)")); assert.ok(!slick.includes("swept back hair"));
  assert.ok(fit("brown hair").neg.includes("(forehead:1.2)"));
});
test("정장: 목 태그를 바꾸고 긴 목 네거티브를 뺌, 수영복·보디슈트는 해당 없음", () => {
  for (const tags of ["black hair, black suit", "(black suit jacket:1.4)", "black three-piece suit, waistcoat", "navy blue suit, necktie", "tuxedo"]) {
    const f = fit(tags);
    assert.ok(f.prompt.includes("(long neck:1.3), (thick neck:1.25)"), tags); assert.ok(!f.prompt.includes("(thick neck:1.4)"), tags); assert.ok(!f.neg.includes("(long neck:1.3)"), tags);
  }
  for (const tags of ["swimsuit", "bodysuit", "brown hair, white shirt"]) {
    const f = fit(tags);
    assert.ok(f.prompt.includes("(thick neck:1.4)"), tags); assert.ok(f.neg.includes("(long neck:1.3)"), tags);
  }
});
test("표정: 두 일상 화풍 모두 고정 표정이 없고 네거티브로 표정을 막지 않음", () => {
  for (const st of [FDAILY, MD]) {
    for (const p of [st.prompt, st.coolPrompt]) assert.ok(!FIXED_FACE.test(p), p.match(FIXED_FACE));
    for (const t of ["pouting", "grin", "teeth", "open mouth", "clenched"]) assert.ok(!st.neg.includes(t), t);
    assert.ok(!/(^|[(, ])blush/.test(st.neg.replace(/nose blush/g, "")), "코에 번지는 홍조만 막음");
  }
});
test("표정: 코드 태그에 얼굴을 일그러뜨리거나 어려 보이게 하는 낱말이 없음", () => {
  const STIFF = /furious|clenched teeth|:d|:o|puffy cheeks|stiff posture|hostile|streaming tears|grimace|sobbing|sparkling eyes/;
  for (const t of SIT_PONY_TAGS) assert.ok(!STIFF.test(t), t);
  for (const [n, r] of Object.entries(MotionPrompts)) if (+n >= 100 && +n < 200) assert.ok(!STIFF.test(r.base_prompt), n + " " + r.base_prompt);
  assert.equal(SIT_PONY_TAGS.length, 15);
  assert.ok(SIT_PONY_TAGS[11].includes("sleeping"), "휴식은 정면 태그를 빼는 낱말을 유지");
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
  assert.equal(weighTags("sofa, 1boy, male focus, solo, black hair, (black suit:1.4), :d, painting (object), detailed background", 1.3),
    "(sofa:1.3), 1boy, male focus, solo, (black hair:1.3), (black suit:1.4), :d, painting (object), detailed background");
  assert.equal(weighTags("no humans, animal focus, cat", 1.3), "no humans, animal focus, (cat:1.3)");
  assert.equal(weighTags("1boy, crying", undefined), "1boy, crying");
  // 표정 태그는 내용 가중치를 받지 않음 — 입이 과하게 벌어지고 얼굴이 굳음. 옷 이름에 비슷한 글자가 있어도(sweater) 내용으로 침, 정면을 돕는 looking at viewer도 내용
  const face = "looking to the side, happy, wide smile, closed mouth, squinting, teary eyes, soft gaze, furrowed brow, parted lips, crying, blush";
  assert.equal(weighTags(face, 1.3), face);
  assert.equal(weighTags("wide smile, soft gaze", 1.3, 1.15), "(wide smile:1.15), (soft gaze:1.15)");
  assert.equal(weighTags("looking at viewer, smile", 1.3, 1.15), "(looking at viewer:1.3), (smile:1.15)");
  assert.equal(weighTags("black sweater, upper body, crossed arms", 1.3), "(black sweater:1.3), (upper body:1.3), (crossed arms:1.3)");
  assert.equal(FDAILY.contentWeight, 1.3); assert.equal(FDAILY.exprWeight, 1.15);
});
test("남성향 일상: 맨 앞이 정면, 각도를 정한 장면은 뺌, 네거티브 한도·안전 태그", () => {
  assert.ok(MD.prompt.startsWith(MD_ANGLE)); assert.ok(MD.coolPrompt.startsWith(MD_ANGLE));
  const up = fitStyle(MD, "1girl, solo, brown hair, smile").prompt;
  assert.ok(up.startsWith(MD_ANGLE));
  for (const tags of ["from behind", "lying on bed", "sleeping, closed eyes", "from side"]) {
    const p = fitStyle(MD, "1girl, solo, " + tags).prompt;
    assert.ok(!p.includes(MD_ANGLE), tags); assert.ok(!/^,|,\s*,/.test(p), tags);
  }
  // 이마가 보이는 인물은 앞머리 묶음을 그대로 뺌
  assert.ok(!fitStyle(MD, "1girl, solo, forehead").prompt.includes("(full bangs:1.3)"));
  for (const rating of Object.keys(RATINGS)) {
    const all = [ARCH.pony.neg, IMG_NEG, NEG_MINOR, RATINGS[rating].neg, "solo, 1girl, 1boy", MD.neg].filter(Boolean).join(", ");
    assert.ok(all.length <= 3000, rating + ": " + all.length + "자");
  }
  for (const t of ["(baby face:1.3)", "(childish face:1.2)", "(see-through clothes:1.3)"]) assert.ok(MD.neg.includes(t), t);
  for (const t of ["(mature female:1.45)", "(adult woman:1.45)", "mature face"]) assert.ok(MD.prompt.includes(t), t);
  for (const t of ["(young:1.3)", "(teen:1.4)", "(moe:1.3)"]) assert.ok(MD.neg.includes(t), t);
  assert.equal(builtinSet("mdaily").contentWeight, 1.2);
});
test("장면 가리기: 표정·구도뿐이면 거짓, 행동·시선을 정했으면 참", () => {
  const still = [0, 1, 2, 4, 5, 6, 8, 9, 10, 14], moving = [3, 7, 12, 13];
  for (const n of still) assert.equal(sceneMoves(SIT_PONY_TAGS[n]), false, "기본 " + n + ": " + SIT_PONY_TAGS[n]);
  for (const n of moving) assert.equal(sceneMoves(SIT_PONY_TAGS[n]), true, "기본 " + n + ": " + SIT_PONY_TAGS[n]);
  const stillRows = [101, 102, 105, 106, 112, 116, 117, 138, 139];
  for (const [n, row] of Object.entries(MotionPrompts)) assert.equal(sceneMoves(row.base_prompt), !stillRows.includes(+n), n + ": " + row.base_prompt);
  // 직접 만든 코드 — 목록에 없는 낱말은 행동으로 봄
  for (const s of ["turning head, looking back", "leaning forward, hand on table", "walking, hands in pockets", "hugging, arms around another", "sitting, crossed legs"]) assert.equal(sceneMoves(s), true, s);
  // 번역이 덧붙이는 인원·성별 태그, 강조 괄호는 행동이 아님
  assert.equal(sceneMoves("1girl, solo, (smile:1.3), looking at viewer"), false);
  assert.equal(sceneMoves("looking to the side, smile"), true);
  assert.equal(sceneMoves(""), false); assert.equal(sceneMoves(undefined), false);
});
test("정면 고정: 표정 칸은 유지하고 행동·시선을 정한 칸에서는 풂", () => {
  const body = "black hair, black suit";
  for (const [st, front, name] of [[FDAILY, ANGLE, "여성향"], [MD, MD_ANGLE, "남성향"]]) {
    const on = (scene) => fitStyle(st, scene + ", 1girl, solo, " + body, scene);
    assert.ok(on(SIT_PONY_TAGS[2]).prompt.includes(front), name + " 표정 칸");
    for (const n of [3, 7, 12]) { const p = on(SIT_PONY_TAGS[n]).prompt; assert.ok(!p.includes(front), name + " 기본 " + n); assert.ok(!/^,|,\s*,/.test(p), name + " 쉼표"); }
    assert.ok(!on("walking, hands in pockets").prompt.includes(front), name + " 직접 만든 행동");
    // 인물·옷 태그는 행동으로 치지 않음, 장면을 안 주면(표지·직접 쓴 프롬프트) 예전 그대로
    assert.ok(fitStyle(st, "1girl, solo, " + body, "smile").prompt.includes(front), name + " 옷");
    assert.ok(fitStyle(st, "walking, 1girl, solo").prompt.includes(front), name + " 장면 없음");
    assert.ok(!fitStyle(st, "from behind, 1girl, solo").prompt.includes(front), name + " 각도");
    // 표정 칸에서 손을 막은 네거티브는 행동 칸에서 풂
    assert.ok(on(SIT_PONY_TAGS[2]).neg.includes("(outstretched hand:1.3)"), name + " 표정 칸 손");
    assert.ok(!on("stretching, arms up").neg.includes("(outstretched hand:1.3)"), name + " 행동 칸 손");
  }
  // 안전 태그는 행동 칸에서도 그대로
  for (const st of [FDAILY, MD]) for (const t of ["(young:1.3)", "(teen:1.4)", "(baby face:1.3)", "(see-through clothes:1.3)"]) assert.ok(fitStyle(st, "walking, 1girl", "walking").neg.includes(t), t);
});
test("남성향 일상: 얼굴 모양은 화풍이 아니라 인물 태그가 정함", async () => {
  // 화풍이 눈매·눈썹·턱선을 정하면 옷과 머리색만 다른 한 얼굴이 됨(fd81)
  for (const p of [MD.prompt, MD.coolPrompt]) for (const t of ["upturned eyes", "almond eyes", "arched eyebrows", "thin eyebrows", "v-shaped jawline", "sharp facial features", "defined cheekbones", "narrow face"]) assert.ok(!p.includes(t), t);
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(join(d, e.name)) : e.name === "work.js" ? [join(d, e.name)] : []);
  let n = 0;
  for (const file of walk(fileURLToPath(new URL("../../content/m", import.meta.url)))) {
    const c = (await import(pathToFileURL(file).href)).default;
    const people = c.cast ? c.cast.map((m) => ({ name: m.name, look: m.look, tags: m.tags })) : [{ name: c.name, look: c.persona, tags: c.lookTags }];
    for (const m of people) {
      if (!/여성|, 여\)/.test(m.look || "")) continue;
      n++;
      assert.ok(/ eyes(,|$)/.test(m.tags), m.name + " 눈매");
      assert.ok(/ eyebrows(,|$)/.test(m.tags), m.name + " 눈썹");
      assert.ok(!/\b(big|large) eyes\b/.test(m.tags), m.name + " 어려 보이는 낱말");
    }
  }
  assert.equal(n, 23);
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
