// 노출 정책(archive/style-manime/code/exposure.js) — 그림 도구(npm run art)가 쓰는 화풍 규칙. 앱 코드가 아니다.
// 옷을 적지 않은 인물의 문구는 그대로이고, 작품 태그에 적힌 옷과 부딪치는 네거티브만 그 그림에서 빠지며, 어느 경우에도 미성년 네거티브와 '늘 막는 것'은 남는지.
import { test } from "node:test";
import assert from "node:assert/strict";
import { profileJob, emotionJob, assertSafe, assertAdult, policyOf } from "../../archive/style-manime/code/assemble.js";
import { liftable } from "../../archive/style-manime/code/exposure.js";

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

test("노출 정책: 옷을 적지 않은 인물은 닫힘 — 뺀 것이 없고 가슴골·쇄골·맨어깨 네거티브가 그대로", () => {
  for (const c of [woman("white blouse, black skirt"), man("navy blue suit, necktie"), man("reflective vest"), man("black v-neck shirt")])
    for (const j of both(c)) {
      assert.equal(j.lift, undefined, c.tags + ": 뺀 것이 없어야 함");
      assert.ok(j.neg.includes("(cleavage:1.5)") && j.neg.includes("(cleavage:1.3)") && names(j.neg).includes("bare shoulders"));
      assertSafe(j);
    }
  assert.ok(emotionJob(woman("white blouse"), PLACE, 1).pos.includes("(long sleeves:1.2)"), "소매를 적지 않은 옷은 긴소매");
});

test("노출 정책: 목선을 적은 옷(여성)은 열림 — 가슴골·쇄골 네거티브만 빠지고 깊은 목선·비치는 옷·크기 과장·미성년 네거티브는 남음", () => {
  for (const outfit of ["white v-neck dress", "red off-shoulder dress", "black strapless dress"])
    for (const j of both(woman(outfit))) {
      const n = names(j.neg);
      assert.ok(j.lift.includes("cleavage") && j.lift.includes("collarbone"), outfit);
      assert.ok(!n.includes("cleavage") && !n.includes("collarbone"), outfit + ": 겹쳐 있던 것까지 모두 빠짐");
      for (const t of [...KEPT, ...MINOR, "large breasts"]) assert.ok(n.includes(t), outfit + ": 남아 있어야 함 — " + t);
      assertSafe(j);
    }
  assert.ok(!names(profileJob(woman("red off-shoulder dress"), PLACE).neg).includes("bare shoulders"), "오프숄더는 맨어깨도 풂");
  assert.ok(names(profileJob(woman("white v-neck dress"), PLACE).neg).includes("bare shoulders"), "브이넥은 맨어깨를 풀지 않음");
  assert.ok(names(profileJob(woman("evening dress"), PLACE).neg).includes("cleavage"), "옷 이름만으로는 열지 않음");
  assert.deepEqual(profileJob(woman("white shirt, collarbone"), PLACE).lift, ["collarbone"], "쇄골만 적으면 쇄골만");
});

test("노출 정책: 민소매·반바지·남자의 풀어 둔 깃 — 그 옷과 부딪치는 것만 빠짐", () => {
  for (const c of [woman("white tank top, denim shorts"), man("black tank top, cargo pants")]) {
    const [p, e] = both(c);
    for (const j of [p, e]) {
      const n = names(j.neg);
      for (const t of ["sleeveless", "bare arms", "bare shoulders"]) assert.ok(!n.includes(t), c.tags + ": 빠져야 함 — " + t);
      for (const t of [...KEPT, ...MINOR, "cleavage"]) assert.ok(n.includes(t), c.tags + ": 남아 있어야 함 — " + t);
      assertSafe(j);
    }
    assert.ok(!e.pos.includes("(long sleeves:1.2)"), "민소매를 적은 그림에는 긴소매를 넣지 않음");
  }
  assert.ok(!names(profileJob(woman("white tank top, denim shorts"), PLACE).neg).includes("bare legs"), "반바지는 맨다리를 풂");
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
