// 일상 화풍의 조립(archive/style-mdaily/code/assemble.js) — 그림 도구(npm run art)가 쓰는 화풍 규칙. 앱 코드가 아니다.
// 2026-11-23~24: 구도·표정은 애니 화풍과 같게(acting), 여성은 또렷한 얼굴에 흐릿한 분위기(v8) + 표정을 과하지 않게(v11 — 거리 문구 v9·구도 밑그림 v10은 쓰지 않음),
// 남성은 애니 화풍으로 그리고 이 화풍의 흐림만 입힘(v12) + 칠·배경을 여성 쪽으로(v13). 나이 든 남자의 나이 문구는 애니 화풍의 조립이 정함.
// 작품 글(content/)이 바뀌어도 막지 않게 규칙의 성질만 본다.
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { profileJob, emotionJob, assertSafe, isFem, STYLE, guided, SIZE, split } from "../../archive/style-mdaily/code/assemble.js";
import { acting, agedOf, MODEL, emotionJob as animeEmotion, profileJob as animeProfile } from "../../archive/style-manime/code/assemble.js";

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
    CAST.push({
      c: base ? { ...c0, temper: c0.temper || base.temper, age: c0.age === undefined ? base.age : c0.age } : c0,
      place: (work.places || [])[0],
      places: work.places || []
    });
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
const SYMBOLS = ["sparkle", "heart", "spoken heart", "anger vein", "flying sweatdrops"];

test("일상 화풍: 모든 작품의 모든 인물·칸이 뽑히고 지킬 것(성인 표시·미성년 네거티브·3000자)을 지킴, 이 화풍이 조립한 네거티브에 겹친 낱말이 없음", () => {
  assert.ok(CAST.length > 0);
  for (const { c, place } of CAST)
    for (let s = 0; s <= 14; s++) {
      const j = assertSafe(s ? emotionJob(c, place, s) : profileJob(c, place));
      // 애니 화풍으로 그리는 인물(postAs)의 네거티브는 애니 화풍의 것 — 그쪽은 같은 낱말을 다른 가중치로 겹쳐 둔 것이 그려서 정한 값이다
      if (!j.postAs) {
        const n = names(j.neg);
        assert.equal(new Set(n).size, n.length, `${c.code}/${s}: 네거티브에 같은 낱말이 두 번`);
      }
      assert.equal(!!j.guide, guided(c, s), `${c.code}/${s}: 밑그림이 붙는지는 guided()와 같아야 함(그림 도구의 값 어림이 읽음)`);
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
      // 값 파일이 일부러 빼는 낱말(act.drop — 여성은 기본 표정의 가는 눈)은 빠져도 됨
      const dropped = ((STYLE[isFem(c) ? "f" : "m"].act || {}).drop || []).map((t) => t.toLowerCase());
      for (const t of names(a.eyes + ", " + a.emo)) assert.ok(dropped.includes(t) || got.includes(t), `칸 ${slot}: 애니의 표정 낱말 ${t}`);
      for (const sym of SYMBOLS) assert.ok(!got.includes(sym), `칸 ${slot}: 만화 기호 ${sym}`);
    }
    assert.ok(names(emotionJob(c, PLACE, 3).pos).includes("looking away"), "부끄러움은 시선을 돌림");
  }
  // 애니에서 가져오지 않는 것(이 화풍이 조립하는 여성 인물): 이모티콘 입(:d), 겹친 구도(cowboy shot), 낮 장소에서 낮을 막는 네거티브
  const laugh = names(emotionJob(F, PLACE, 2).pos);
  assert.ok(!laugh.includes(":d") && !laugh.includes("cowboy shot") && laugh.includes("upper body"));
  // 여성의 구도는 그대로(사용자 2026-11-24 "그냥 그대로 두자") — 거리 문구(v9)와 구도 밑그림(v10)은 쓰지 않는다
  const emo = emotionJob(F, PLACE, 2);
  assert.ok(!STYLE.f.act.frame && !STYLE.f.guide && !emo.guide && !emo.pos.includes("waist up") && !names(emo.neg).includes("close-up"));
  const DAY = { tags: "library, bookshelves, daylight" };
  assert.ok(!names(emotionJob(F, DAY, 5).neg).includes("day"), "놀람: 낮 장소에서 낮을 막지 않음");
  assert.ok(names(emotionJob(F, PLACE, 5).neg).includes("day"), "밤 장소는 이 화풍이 스스로 낮을 막음");
  // 연기가 쓰는 것을 화풍 네거티브가 막지 않음: 눈을 크게 뜨는 칸의 큰 눈, 손동작이 있는 칸의 손
  const wide = names(emotionJob({ ...F, temper: "" }, PLACE, 5).neg);
  assert.ok(!wide.includes("large eyes") && !wide.includes("big eyes"), "놀람: 큰 눈 네거티브를 풂");
  assert.ok(names(emotionJob(F, PLACE, 1).neg).includes("large eyes"), "기본 표정은 그대로 막음");
  assert.ok(names(emotionJob({ ...M, temper: "" }, PLACE, 5).neg).includes("big eyes"), "남자의 놀람은 큰 눈을 일부러 막음(애니 규칙 그대로)");
  const hands = emotionJob({ ...F, temper: "" }, PLACE, 5);
  assert.ok(/hands up/.test(hands.pos) && !names(hands.neg).includes("raised hands"), "손을 드는 칸은 손 네거티브를 풂");
  const rest = emotionJob(F, PLACE, 11);
  assert.ok(rest.pos.includes("(full body:1.5)") && rest.hires && rest.guide, "여성의 휴식(칸 11)은 멀리서 몸 전체 그대로");
});

test("일상 화풍: 여성의 표정은 과하지 않게(값 파일의 act.soften·scale) — 표정 칸의 센 낱말만 누그러지고, 낱말은 남고, 기본 표정·구도·소품 칸은 그대로", () => {
  const S = STYLE.f.act.soften,
    top = +(S.knee + (1.7 - S.knee) * S.ratio).toFixed(2), // 가장 센 낱말(1.7까지 올린 것)이 닿는 값
    wOf = (x) => +(/:([\d.]+)\)$/.exec(x) || [0, 0])[1],
    plain = { ...F, temper: "" }; // 성격이 없으면 공통 표정(가장 센 값)
  for (const slot of S.slots) {
    const a = acting(plain, slot, { symbols: false }),
      tags = split(emotionJob(plain, PLACE, slot).pos);
    for (const raw of split(a.eyes + ", " + a.emo)) {
      const t = names(raw)[0],
        x = tags.find((y) => names(y)[0] === t);
      if (t === ":d") continue; // 이모티콘 입은 이 화풍에 넣지 않음
      assert.ok(x, `칸 ${slot}: 표정 낱말이 남아 있어야 함 — ${t}`);
      // 가중치 없이 온 낱말(closed mouth 등 — 표정을 누르는 쪽)은 이 화풍의 표정 가중치를 그대로 받는다
      if (wOf(raw)) assert.ok(wOf(x) <= top, `칸 ${slot}: ${x}가 ${top}보다 셈`);
    }
  }
  // 낮춰도 과한 낱말은 따로 더: 놀람의 부릅뜬 눈과 벌린 입은 1 아래로
  const shock = split(emotionJob(plain, PLACE, 5).pos);
  for (const t of ["wide-eyed", "open mouth"]) assert.ok(wOf(shock.find((y) => names(y)[0] === t)) < 1, "놀람: " + t);
  // 그대로인 것: 기본 표정(칸 1)의 옅은 미소, 표정 칸의 구도 낱말, 소품·효과가 특징인 칸(각성의 빛나는 눈·부상의 붕대)
  assert.ok(emotionJob(F, PLACE, 1).pos.includes("(light smile:1.08)") && shock.includes("(upper body:1.32)"));
  assert.ok(emotionJob(F, PLACE, 13).pos.includes("(glowing eyes:1.7)") && emotionJob(F, PLACE, 9).pos.includes("(bandaged head:1.44)"));
  assert.ok(!S.slots.some((s) => [0, 1, 9, 10, 11, 12, 13].includes(s)));
});

// 가중치는 비교 생성으로 계속 맞추는 값이라 낱말이 있는지만 본다(성인 표시처럼 지킬 것은 가중치까지)
test("일상 화풍: 여성(v8의 모습 그대로)은 얼굴은 또렷하게, 분위기는 흐릿하게 — 이 화풍의 모델과 문구로 그림", () => {
  const f = emotionJob(F, PLACE, 1),
    fp = names(f.pos);
  assert.ok(isFem(F) && !isFem(M));
  assert.ok(f.model === STYLE.f.model.id && !f.postAs && !f.haze && !f.guide, "여성 인물은 이 화풍의 모델로, 밑그림 없이");
  assert.deepEqual([f.width, profileJob(F, PLACE).width], [SIZE.emotion.width, SIZE.profile.width], "규격 크기 그대로");
  assert.ok(fp.includes("soft gradient shading") && f.pos.includes("(adult woman:1.45)"), "여성의 칠과 성인 표시는 그대로");
  // 분위기는 후처리와 빛·배경 문구로 — 얼굴까지 흐리는 문구는 되살리지 않는다
  for (const t of ["soft focus", "low contrast", "lifted shadows", "pale skin", "narrow eyes"]) assert.ok(!fp.includes(t), "여성 v8에 없어야 함: " + t);
  assert.ok(fp.includes("soft bloom") && fp.includes("light haze") && f.post.blurA >= 0.3 && f.post.blurA < 0.6, "여성 v8: 빛 번짐·배경 안개·후처리 흐림");
  assert.ok(fp.includes("detailed iris") && fp.includes("rim light") && !names(f.neg).includes("rim light"), "여성: 홍채·가장자리 빛은 그대로");
  assert.ok(fp.includes("light smile"), "기본 표정: 여자는 살짝 미소");
});

test("일상 화풍: 남성 인물은 애니 화풍으로 그리고 이 화풍의 흐림만 입힌다(값 파일의 draw) — 밑그림 없이, 만화 기호 없이", () => {
  assert.equal(STYLE.m.draw, "anime");
  const T = STYLE.m.anime;
  for (const slot of [0, 1, 3, 11, 14]) {
    const m = slot ? emotionJob(M, PLACE, slot) : profileJob(M, PLACE),
      a = slot ? animeEmotion(M, PLACE, slot, { symbols: false }) : animeProfile(M, PLACE, { symbols: false });
    assert.equal(m.model, MODEL.air, `칸 ${slot}: 애니 화풍의 모델`);
    assert.deepEqual([m.seed, m.width, m.height, m.hires], [a.seed, a.width, a.height, a.hires], `칸 ${slot}: 애니 화풍의 시드·크기 그대로`);
    assert.ok(m.neg.startsWith(a.neg), `칸 ${slot}: 애니 화풍의 네거티브는 빼지 않음`);
    assert.ok(m.postAs === "anime" && m.haze === STYLE.m.post && !m.guide && !m.lora, `칸 ${slot}: 애니 후처리 뒤에 이 화풍의 흐림, 밑그림·LoRA 없음`);
    assert.ok(/adult man/.test(m.pos) && names(m.neg).includes("child"), `칸 ${slot}: 성인 표시와 미성년 네거티브`);
    for (const sym of SYMBOLS) assert.ok(!names(m.pos).includes(sym), `칸 ${slot}: 만화 기호 ${sym}`);
    assert.ok(!guided(M, slot), `칸 ${slot}: 값 어림에서 밑그림으로 세지 않음`);
    // 칠을 여성 쪽으로(값 파일의 anime): 센 명암 낱말은 빠지고, 부드러운 칠 문구가 붙고, 대비를 올리는 애니 후처리는 쓰지 않음
    const got = names(m.pos);
    for (const t of T.drop) assert.ok(!got.includes(t), `칸 ${slot}: 빠져야 하는 낱말 ${t}`);
    assert.ok(m.pos.endsWith(T.add) && m.post === T.post && !m.post.filter, `칸 ${slot}: 부드러운 칠·대비 없는 후처리`);
    // 배경은 여성 인물과 같은 문구: 흐린 배경 + 장소 낱말 0.8(애니 화풍의 1.1·단색 배경이 아님)
    assert.ok(m.pos.includes("(blurry background:1.5)") && m.pos.includes("(library:0.8)") && !m.pos.includes("(library:1.1)"), `칸 ${slot}: 흐린 배경`);
    for (const t of T.bg.plain) assert.ok(!got.includes(t), `칸 ${slot}: 단색 배경 낱말 ${t}`);
    assert.ok(m.pos.includes(T.bg.night), `칸 ${slot}: 밤 장소의 빛 문구`);
  }
  // 값 파일이 이름으로 가리키는 낱말은 애니 화풍의 문구에 실제로 있다(낱말이 바뀌거나 오타가 나면 여기서 알림)
  const src = names(animeEmotion(M, PLACE, 1, { symbols: false }).pos);
  for (const t of [...T.drop, ...Object.keys(T.set)]) assert.ok(src.includes(t), "애니 화풍의 문구에 없는 낱말: " + t);
  for (const t of T.bg.plain.slice(0, 1)) assert.ok(names(animeProfile(M, PLACE).pos).includes(t), "애니 프로필에 없는 단색 배경 낱말: " + t);
  // 가중치 손질(set)이 실제로 들어감 — 배경 흐림은 배경 문구가 따로 넣으므로 그것 말고 나머지로 본다
  const tuned = emotionJob(M, PLACE, 1).pos;
  for (const [t, w] of Object.entries(T.set)) if (t !== "blurry background") assert.ok(tuned.includes(`(${t}:${w})`), "가중치가 안 바뀜: " + t);
  // 애니 화풍의 장소 문구만 통째로 바뀐다: 장소 낱말과 이름이 같은 인물 태그·성인 표시는 그대로, 애니 화풍이 뺀 동물은 다시 들어가지 않음
  const same = emotionJob(M, { tags: "office, black hair, solo, gray cat on desk, night" }, 1);
  assert.ok(same.pos.includes("(black hair:1.1)") && /\bsolo\b/.test(same.pos) && !same.pos.includes("(office:1.1)"), "인물 태그는 그대로, 장소 문구만 바뀜");
  assert.ok(!same.pos.includes("cat") && names(same.neg).includes("cat"), "뺀 동물은 배경 문구에도 없음");
  // 시간 낱말이 없는 장소: 애니 화풍이 밤으로 보고 더한 night는 남김 · tags가 없는 장소 객체도 그릴 수 있음
  assert.ok(names(emotionJob(M, { tags: "office, desk" }, 1).pos).includes("night"));
  assertSafe(emotionJob(M, {}, 1));
  // 밤 장소의 프로필은 낮을 막고(애니 프로필에는 없음), 낮 장소는 밤 빛 문구를 넣지 않고, 장소가 없으면 애니 화풍의 단색 배경 그대로
  assert.ok(names(profileJob(M, PLACE).neg).includes("daylight"));
  assert.ok(!emotionJob(M, { tags: "library, bookshelves, daylight" }, 1).pos.includes(T.bg.night));
  assert.ok(names(profileJob(M, undefined).pos).includes("simple background"));
  // 흐림은 여성과 같은 값(한 작품의 인물은 한 분위기) — 선이 또렷한 애니 그림은 같은 세기에서도 눈이 뭉개지지 않았다
  assert.deepEqual(STYLE.m.post, STYLE.f.post);
  // 시드를 주면 그 값으로(그림 도구의 '다시 그리기'), 안 주면 애니 화풍의 시드 그대로 — 같은 인물의 애니 그림과 같은 얼굴
  assert.equal(emotionJob(M, PLACE, 1, { seed: 9 }).seed, 9);
  assert.equal(profileJob(M, PLACE, { seed: 9 }).seed, 9);
  // 장소가 없어도, 작품의 모든 장소에서도(물가 장소는 젖은 옷 네거티브가 더 붙음) 그리기 전 검사를 통과
  assertSafe(emotionJob(M, undefined, 1));
  for (const { c, places } of CAST.filter((x) => !isFem(x.c))) for (const place of places) for (let s = 1; s <= 14; s++) assertSafe(emotionJob(c, place, s));
});

test("애니 화풍: 나이 든 남자(40·50 이상)는 나이를 막는 문구를 빼고 나이 문구를 넣는다 — 벗어진 이마는 앞머리로 덮지 않음, 미성년 네거티브는 그대로", () => {
  const man = (age, tags) => ({ ...M, age, look: age + "세 남성", tags: tags || M.tags });
  const old = man(58, "grey hair, short hair, receding hairline, brown eyes, glasses, beige cardigan, white collared shirt");
  assert.deepEqual([agedOf(man(36)), agedOf(man(45)).from, agedOf(old).from, agedOf({ ...F, age: 58 })], [null, 40, 50, null]);
  for (let slot = 0; slot <= 14; slot++) {
    const j = slot ? animeEmotion(old, PLACE, slot) : animeProfile(old, PLACE),
      pos = names(j.pos),
      neg = names(j.neg);
    assert.ok(j.pos.includes("(58 years old:1.1)") && pos.includes("middle-aged man") && /adult man/.test(j.pos), `칸 ${slot}: 나이 문구와 성인 표시`);
    for (const t of ["30 years old", "flawless skin", "clear skin", "bishounen", "curtained hair", "hair parted in the middle"])
      assert.ok(!pos.includes(t), `칸 ${slot}: 젊게 만드는 문구 ${t}`);
    assert.ok(!j.pos.includes("(hair between eyes:0.8)") && pos.includes("forehead"), `칸 ${slot}: 벗어진 이마를 덮지 않음`);
    for (const t of ["old man", "wrinkles", "old", "middle-aged"]) assert.ok(!neg.includes(t), `칸 ${slot}: 나이를 막는 네거티브 ${t}`);
    for (const t of ["child", "shota", "underage", "young boy", "aged down"]) assert.ok(neg.includes(t), `칸 ${slot}: 미성년 네거티브 ${t}`);
  }
  // 40대는 한 단계 약하게, 서른 넘은 남자(40 미만)와 여성은 그대로
  const mid = animeEmotion(man(45), PLACE, 1),
    young = animeEmotion(man(36), PLACE, 1);
  assert.ok(mid.pos.includes("(45 years old:1.1)") && mid.pos.includes("(mature male:1.15)") && !names(mid.neg).includes("old man"));
  assert.ok(young.pos.includes("(30 years old:0.6)") && names(young.neg).includes("old man") && names(young.pos).includes("curtained hair"));
  assert.ok(names(animeEmotion({ ...F, age: 58 }, PLACE, 1).neg).includes("middle-aged"), "여성은 정하지 않음(이 화풍의 작품에 나이 든 여성이 없음)");
});
