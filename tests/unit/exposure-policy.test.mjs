// 노출 정책(archive/style-manime/code/exposure.js) — 그림 도구(npm run art)가 쓰는 화풍 규칙. 앱 코드가 아니다.
// 가슴·비치는 옷·속옷은 늘 막고 어깨·팔·쇄골·다리는 막지 않는지(2026-11-26), 작품 태그에 적힌 옷과 부딪치는 네거티브만 그 그림에서 빠지며,
// 어느 경우에도 미성년 네거티브와 '늘 막는 것'은 남는지. 일상 화풍 여성의 값(mdaily-v12)도 같은 기준인지.
import { test } from "node:test";
import assert from "node:assert/strict";
import { profileJob, emotionJob, assertSafe, assertAdult, policyOf } from "../../archive/style-manime/code/assemble.js";
import { liftable } from "../../archive/style-manime/code/exposure.js";
import { STYLE } from "../../archive/style-mdaily/code/assemble.js";

const P0 = policyOf();
const PLACE = { tags: "library, bookshelves, night" };
const woman = (outfit) => ({ code: "TSF", name: "시험", gender: "f", look: "26세 여성", age: 26, tags: "black hair, long hair, blue eyes, " + outfit });
const man = (outfit) => ({ code: "TSM", name: "시험", gender: "m", look: "28세 남성", age: 28, tags: "black hair, short hair, grey eyes, " + outfit });
const both = (c, o) => [profileJob(c, PLACE, o), emotionJob(c, PLACE, 1, o)];
const names = (neg) => neg.split(", ").map((t) => t.replace(/^\((.+):[\d.]+\)$/, "$1"));
const KEPT = [
  "nsfw",
  "nude",
  "revealing clothes",
  "plunging neckline",
  "downblouse",
  "see-through",
  "lingerie",
  "bra",
  "huge breasts",
  "open shirt",
  "no pants"
];
const MINOR = ["child", "loli", "shota", "underage", "toddler", "aged down", "baby face", "young", "teenager", "chibi"];
// 2026-11-26 사용자 결정 — 막지 않는 살
const SKIN = ["bare shoulders", "off shoulder", "bare arms", "shoulder cutout", "detached sleeves", "collarbone", "bare legs"];

test("노출 정책: 옷을 적지 않은 인물 — 뺀 것이 없고 가슴골 네거티브는 그대로, 어깨·팔·쇄골·다리는 막지 않고 긴소매도 붙이지 않음", () => {
  for (const c of [woman("white blouse, black skirt"), man("navy blue suit, necktie"), man("reflective vest"), man("black v-neck shirt")])
    for (const j of both(c)) {
      const n = names(j.neg);
      assert.equal(j.lift, undefined, c.tags + ": 뺀 것이 없어야 함");
      assert.ok(j.neg.includes("(cleavage:1.5)") && j.neg.includes("(cleavage:1.3)"));
      for (const t of SKIN) assert.ok(!n.includes(t), c.tags + ": 막지 않아야 함 — " + t);
      assert.ok(!j.pos.includes("long sleeves"), c.tags + ": 긴소매를 붙이지 않음");
      assertSafe(j);
    }
  assert.ok(!names(profileJob(woman("white blouse"), PLACE).neg).includes("sleeveless"), "여자의 민소매는 막지 않음");
  assert.ok(names(profileJob(man("reflective vest"), PLACE).neg).includes("sleeveless"), "남자의 sleeveless는 조끼 차림을 지키는 값으로 남음");
});

test("노출 정책: 목선을 적은 옷(여성)은 열림 — 가슴골 네거티브만 빠지고 깊은 목선·비치는 옷·크기 과장·미성년 네거티브는 남음", () => {
  for (const outfit of ["white v-neck dress", "red off-shoulder dress", "black strapless dress"])
    for (const j of both(woman(outfit))) {
      const n = names(j.neg);
      assert.deepEqual(j.lift, ["cleavage"], outfit);
      assert.ok(!n.includes("cleavage"), outfit + ": 겹쳐 있던 것까지 모두 빠짐");
      for (const t of [...KEPT, ...MINOR, "large breasts"]) assert.ok(n.includes(t), outfit + ": 남아 있어야 함 — " + t);
      assertSafe(j);
    }
  assert.ok(names(profileJob(woman("evening dress"), PLACE).neg).includes("cleavage"), "옷 이름만으로는 열지 않음");
});

test("노출 정책: 남자의 민소매·풀어 둔 깃 — 그 옷과 부딪치는 것만 빠짐, 여자의 민소매·반바지는 풀 것이 없음", () => {
  for (const j of both(man("black tank top, cargo pants"))) {
    const n = names(j.neg);
    assert.deepEqual(j.lift, ["sleeveless"]);
    assert.ok(!n.includes("sleeveless"));
    for (const t of [...KEPT, ...MINOR, "cleavage", "bare chest", "pectorals"]) assert.ok(n.includes(t), "남아 있어야 함 — " + t);
    assertSafe(j);
  }
  for (const j of both(woman("white tank top, denim shorts"))) {
    assert.equal(j.lift, undefined, "여자의 민소매·반바지는 원래 막지 않음");
    assertSafe(j);
  }
  const m = names(profileJob(man("white dress shirt, open collar"), PLACE).neg);
  assert.ok(!m.includes("unbuttoned shirt") && !m.includes("unbuttoned"), "풀어 둔 깃");
  for (const t of ["open shirt", "bare chest", "pectorals", "open clothes"]) assert.ok(m.includes(t), "남자의 풀어 헤친 셔츠·맨가슴은 계속 막음 — " + t);
});

test("노출 정책: 강조는 지정한 인물(여성)만, 표지처럼 accent: false로 부르면 쓰지 않음", () => {
  const P = policyOf(),
    c = woman("white blouse");
  P.accent.push("TSF:시험");
  try {
    const j = emotionJob(c, PLACE, 1);
    assert.ok(j.lift.includes("large breasts") && j.lift.includes("cleavage"));
    assert.ok(names(j.neg).includes("huge breasts") && names(j.neg).includes("plunging neckline"), "크기 과장·깊은 목선은 강조에서도 막음");
    assertSafe(j);
    assert.equal(emotionJob(c, PLACE, 1, { accent: false }).lift, undefined);
    assert.equal(emotionJob({ ...man("white shirt"), code: "TSF" }, PLACE, 1).lift, undefined, "남자에게는 적용하지 않음");
  } finally {
    P.accent.pop();
  }
  assert.equal(P.accent.length, 0, "저장소에는 강조로 지정한 인물이 아직 없음(지정은 이미지 세션이 그려 확인한 뒤)");
});

test("노출 정책: 그리기 전 검사 — 적지 않고 뺀 것, 정책이 풀어 주지 않는 것, 미성년 네거티브 누락, 모르는 트랙은 던짐", () => {
  const j = profileJob(woman("white v-neck dress"), PLACE);
  assert.throws(() => assertSafe({ ...j, lift: undefined }), /네거티브에 없어요: \(cleavage:1\.5\)/, "뺐다고 적지 않으면 통과하지 못함");
  assert.throws(() => assertSafe({ ...j, lift: [...j.lift, "nude"] }), /정책이 풀어 주지 않는 네거티브를 뺐어요: nude/);
  assert.throws(() => assertSafe({ ...j, neg: j.neg.replace("nude, ", "") }), /네거티브에 없어요: nude/);
  assert.throws(() => assertAdult({ ...j, neg: j.neg.replace("loli, ", "") }), /네거티브에 없어요: loli/);
  assert.throws(
    () => assertSafe({ ...j, neg: j.neg.replace("underage, ", "") }),
    /네거티브에 없어요: underage/,
    "미성년 네거티브는 무엇을 풀었든 꼭 있어야 함"
  );
  assert.throws(() => assertAdult({ ...j, pos: j.pos.replace("(adult woman:1.2)", "") }), /성인·혼자 표시가 없어요/);
  for (const t of [...MINOR, ...KEPT]) assert.ok(!liftable(P0).includes(t), "풀 수 있는 목록에 있으면 안 됨 — " + t);
  assert.throws(() => policyOf("adult"), /노출 정책이 없는 트랙이에요: adult/);
  assert.throws(() => profileJob(woman("white blouse"), PLACE, { track: "adult" }), /노출 정책이 없는 트랙/, "값이 없는 트랙으로는 그리지 않음");
});

test("노출 기준: 일상 화풍 여성(mdaily-v12)도 같은 기준 — 어깨·쇄골·민소매는 막지 않고 가슴·비치는 옷은 막음", () => {
  const n = names(STYLE.f.neg);
  for (const t of ["sleeveless", "bare shoulders", "collarbone"]) assert.ok(!n.includes(t), "막지 않아야 함 — " + t);
  for (const t of ["cleavage", "low neckline", "breast focus", "large breasts", "see-through clothes", "revealing clothes"])
    assert.ok(n.includes(t), "남아 있어야 함 — " + t);
});
