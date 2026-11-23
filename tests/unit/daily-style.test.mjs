// 일상 화풍의 조립(archive/style-mdaily/code/assemble.js) — 그림 도구(npm run art)가 쓰는 화풍 규칙. 앱 코드가 아니다.
// 2026-11-23~24: 구도·표정은 애니 화풍과 같게(acting), 여성은 또렷한 얼굴에 흐릿한 분위기(v8), 남성은 애니 화풍으로 그리고 이 화풍의 흐림만 입힘(v12).
// 작품 글(content/)이 바뀌어도 막지 않게 규칙의 성질만 본다.
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { profileJob, emotionJob, assertSafe, isFem, STYLE, guided, SIZE } from "../../archive/style-mdaily/code/assemble.js";
import { acting, MODEL, emotionJob as animeEmotion, profileJob as animeProfile } from "../../archive/style-manime/code/assemble.js";

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

// 가중치는 비교 생성으로 계속 맞추는 값이라 낱말이 있는지만 본다(성인 표시처럼 지킬 것은 가중치까지)
test("일상 화풍: 여성(v8)은 얼굴은 또렷하게, 분위기는 흐릿하게 — 이 화풍의 모델과 문구로 그림", () => {
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
  for (const slot of [0, 1, 3, 11, 14]) {
    const m = slot ? emotionJob(M, PLACE, slot) : profileJob(M, PLACE),
      a = slot ? animeEmotion(M, PLACE, slot, { symbols: false }) : animeProfile(M, PLACE, { symbols: false });
    assert.equal(m.model, MODEL.air, `칸 ${slot}: 애니 화풍의 모델`);
    assert.deepEqual(
      [m.pos, m.neg, m.seed, m.width, m.height, m.post],
      [a.pos, a.neg, a.seed, a.width, a.height, a.post],
      `칸 ${slot}: 애니 화풍의 작업 그대로`
    );
    assert.ok(m.postAs === "anime" && m.haze === STYLE.m.post && !m.guide && !m.lora, `칸 ${slot}: 애니 후처리 뒤에 이 화풍의 흐림, 밑그림·LoRA 없음`);
    assert.ok(/adult man/.test(m.pos) && names(m.neg).includes("child"), `칸 ${slot}: 성인 표시와 미성년 네거티브`);
    for (const sym of SYMBOLS) assert.ok(!names(m.pos).includes(sym), `칸 ${slot}: 만화 기호 ${sym}`);
    assert.ok(!guided(M, slot), `칸 ${slot}: 값 어림에서 밑그림으로 세지 않음`);
  }
  // 흐림은 여성보다 옅게(날카로운 인상을 지킴)
  assert.ok(STYLE.m.post.blurA > 0 && STYLE.m.post.blurA < STYLE.f.post.blurA);
  // 시드를 주면 그 값으로(그림 도구의 '다시 그리기'), 안 주면 애니 화풍의 시드 그대로 — 같은 인물의 애니 그림과 같은 얼굴
  assert.equal(emotionJob(M, PLACE, 1, { seed: 9 }).seed, 9);
  assert.equal(profileJob(M, PLACE, { seed: 9 }).seed, 9);
  // 장소가 없어도, 작품의 모든 장소에서도(물가 장소는 젖은 옷 네거티브가 더 붙음) 그리기 전 검사를 통과
  assertSafe(emotionJob(M, undefined, 1));
  for (const { c, places } of CAST.filter((x) => !isFem(x.c))) for (const place of places) for (let s = 1; s <= 14; s++) assertSafe(emotionJob(c, place, s));
});
