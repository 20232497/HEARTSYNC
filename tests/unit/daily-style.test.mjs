// 일상 화풍의 조립(archive/style-mdaily/code/assemble.js) — 그림 도구(npm run art)가 쓰는 화풍 규칙. 앱 코드가 아니다.
// 2026-11-23: 구도·표정은 애니 화풍과 같게(acting), 남성 인물은 날카로운 v8 후보. 작품 글(content/)이 바뀌어도 막지 않게 규칙의 성질만 본다.
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { profileJob, emotionJob, assertSafe, isFem } from "../../archive/style-mdaily/code/assemble.js";
import { acting } from "../../archive/style-manime/code/assemble.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const walk = (d) =>
  fs
    .readdirSync(d, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name === "work.js" ? [path.join(d, e.name)] : []));
const CAST = [];
for (const f of walk(path.join(ROOT, "content"))) {
  const work = (await import(pathToFileURL(f).href)).default;
  for (const c0 of work.cast || []) {
    const base = c0.of ? (work.cast || []).find((x) => x.code === c0.of) : null;
    CAST.push({ c: base ? { ...c0, temper: c0.temper || base.temper, age: c0.age === undefined ? base.age : c0.age } : c0, place: (work.places || [])[0] });
  }
}
const names = (s) => s.split(", ").map((t) => t.replace(/^\((.+):[\d.]+\)$/, "$1"));
const PLACE = { tags: "library, bookshelves, night" };
const F = { code: "TSF", name: "시험", gender: "f", look: "26세 여성", age: 26, temper: "다정", tags: "black hair, long hair, blue eyes, white blouse" };
const M = {
  code: "TSM",
  name: "시험",
  gender: "m",
  look: "28세 남성",
  age: 28,
  temper: "차가움",
  tags: "black hair, short hair, grey eyes, navy blue suit, white shirt"
};

test("일상 화풍: 모든 작품의 모든 인물·칸이 뽑히고 지킬 것(성인 표시·미성년 네거티브·3000자)을 지킴, 네거티브에 겹친 낱말이 없음", () => {
  assert.ok(CAST.length > 0);
  for (const { c, place } of CAST)
    for (let s = 0; s <= 14; s++) {
      const j = assertSafe(s ? emotionJob(c, place, s) : profileJob(c, place));
      const n = names(j.neg);
      assert.equal(new Set(n).size, n.length, `${c.code}/${s}: 네거티브에 같은 낱말이 두 번`);
    }
});

test("일상 화풍: 구도·표정은 애니 화풍의 것 — 프로필은 얼굴 가까이, 감정 그림은 서 있는 가슴 위, 표정 낱말이 그대로 들어가고 만화 기호는 없음", () => {
  for (const c of [F, M]) {
    const p = names(profileJob(c, PLACE).pos);
    assert.ok(p.includes("close-up") && p.includes("portrait") && p.includes("facing viewer"), "프로필 구도");
    for (const slot of [1, 2, 3, 6, 14]) {
      const a = acting(c, slot, { symbols: false }),
        got = names(emotionJob(c, PLACE, slot).pos);
      assert.ok(got.includes("standing") && got.includes("upper body"), `칸 ${slot}: 서 있는 가슴 위`);
      for (const t of names(a.eyes + ", " + a.emo)) assert.ok(got.includes(t), `칸 ${slot}: 애니의 표정 낱말 ${t}`);
      for (const sym of ["sparkle", "heart", "spoken heart", "anger vein", "flying sweatdrops"]) assert.ok(!got.includes(sym), `칸 ${slot}: 만화 기호 ${sym}`);
    }
    assert.ok(names(emotionJob(c, PLACE, 3).pos).includes("looking away"), "부끄러움은 시선을 돌림");
  }
  // 애니에서 가져오지 않는 것: 이모티콘 입(:d), 겹친 구도(cowboy shot), 낮 장소에서 낮을 막는 네거티브
  const laugh = names(emotionJob(F, PLACE, 2).pos);
  assert.ok(!laugh.includes(":d") && !laugh.includes("cowboy shot") && laugh.includes("upper body"));
  const DAY = { tags: "library, bookshelves, daylight" };
  for (const c of [F, M]) assert.ok(!names(emotionJob(c, DAY, 5).neg).includes("day"), "놀람: 낮 장소에서 낮을 막지 않음");
  assert.ok(names(emotionJob(F, PLACE, 5).neg).includes("day"), "밤 장소는 이 화풍이 스스로 낮을 막음");
  // 연기가 쓰는 것을 화풍 네거티브가 막지 않음: 눈을 크게 뜨는 칸의 큰 눈, 손동작이 있는 칸의 손
  const wide = names(emotionJob({ ...F, temper: "" }, PLACE, 5).neg);
  assert.ok(!wide.includes("large eyes") && !wide.includes("big eyes"), "놀람: 큰 눈 네거티브를 풂");
  assert.ok(names(emotionJob(F, PLACE, 1).neg).includes("large eyes"), "기본 표정은 그대로 막음");
  assert.ok(names(emotionJob({ ...M, temper: "" }, PLACE, 5).neg).includes("big eyes"), "남자의 놀람은 큰 눈을 일부러 막음(애니 규칙 그대로)");
  const hands = emotionJob({ ...F, temper: "" }, PLACE, 5);
  assert.ok(/hands up/.test(hands.pos) && !names(hands.neg).includes("raised hands"), "손을 드는 칸은 손 네거티브를 풂");
  const rest = emotionJob(F, PLACE, 11);
  assert.ok(rest.pos.includes("(full body:1.5)") && rest.hires && rest.guide, "휴식(칸 11)은 멀리서 몸 전체 그대로");
});

test("일상 화풍: 남성 인물은 날카로운 v8 후보 — 부드러운 칠·굵은 몸 문구가 없고, 여성 인물의 칠(v6)은 그대로", () => {
  const m = emotionJob(M, PLACE, 1),
    f = emotionJob(F, PLACE, 1);
  for (const t of ["(sharp jawline:1.45)", "(sharp eyes:1.35)", "(clean lineart:1.25)", "(sharp focus:1.2)"]) assert.ok(m.pos.includes(t), "남성 v8: " + t);
  for (const t of ["soft painting", "simple shading", "flat color", "desaturated", "thick neck", "muscular male", "soft bloom"])
    assert.ok(!names(m.pos).includes(t), "남성 v8에 없어야 함: " + t);
  assert.ok(m.neg.includes("(soft focus:1.2)") && !names(m.neg).includes("hard shadows"));
  assert.ok(m.post.blurA < 0.6, "후처리를 덜 뿌옇게");
  assert.ok(f.pos.includes("soft gradient shading") && f.pos.includes("(adult woman:1.45)"), "여성 v6의 칠은 그대로");
  assert.ok(!isFem(M) && isFem(F));
  // 화풍 안에서 부딪치던 것: 긍정에 넣은 빛을 막는 네거티브, 밝은 머리 남자의 두 번째 나이
  assert.ok(!names(m.neg).includes("rim light") && !names(m.neg).includes("cinematic lighting"));
  const pale = emotionJob({ ...M, age: 58, look: "58세 남성", tags: "grey hair, short hair, brown eyes, beige cardigan, white collared shirt" }, PLACE, 1);
  assert.deepEqual(pale.pos.match(/\(\d+ years old:[\d.]+\)/g), ["(58 years old:1.3)"], "나이 문구는 하나");
  // 기본 표정: 남자는 웃지 않고 입을 다묾(웃음은 네거티브), 여자는 살짝 미소
  assert.ok(names(m.pos).includes("closed mouth") && names(m.neg).includes("smirk"));
  assert.ok(names(f.pos).includes("light smile"));
});
