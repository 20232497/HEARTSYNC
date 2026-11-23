// 일상 화풍의 조립(archive/style-mdaily/code/assemble.js) — 그림 도구(npm run art)가 쓰는 화풍 규칙. 앱 코드가 아니다.
// 2026-11-23: 구도·표정은 애니 화풍과 같게(acting), 남성 인물은 날카로운 후보(v11), 여성은 또렷한 얼굴에 흐릿한 분위기를 되돌린 후보(v8). 작품 글(content/)이 바뀌어도 막지 않게 규칙의 성질만 본다.
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { profileJob, emotionJob, assertSafe, isFem, STYLE, guided, SIZE } from "../../archive/style-mdaily/code/assemble.js";
import { acting, MODEL } from "../../archive/style-manime/code/assemble.js";

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

test("일상 화풍: 모든 작품의 모든 인물·칸이 뽑히고 지킬 것(성인 표시·미성년 네거티브·3000자)을 지킴, 네거티브에 겹친 낱말이 없음", () => {
  assert.ok(CAST.length > 0);
  for (const { c, place } of CAST)
    for (let s = 0; s <= 14; s++) {
      const j = assertSafe(s ? emotionJob(c, place, s) : profileJob(c, place));
      const n = names(j.neg);
      assert.equal(new Set(n).size, n.length, `${c.code}/${s}: 네거티브에 같은 낱말이 두 번`);
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
      // 값 파일이 일부러 빼는 낱말(act.drop — 여성 v7은 기본 표정의 가는 눈)은 빠져도 됨
      const dropped = ((STYLE[isFem(c) ? "f" : "m"].act || {}).drop || []).map((t) => t.toLowerCase());
      for (const t of names(a.eyes + ", " + a.emo)) assert.ok(dropped.includes(t) || got.includes(t), `칸 ${slot}: 애니의 표정 낱말 ${t}`);
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

// 가중치는 비교 생성으로 계속 맞추는 값이라 낱말이 있는지만 본다(성인 표시처럼 지킬 것은 가중치까지)
test("일상 화풍: 남성 인물은 날카로운 후보(v11) — 눈 사이로 떨어지는 앞머리·옆빛, 가르마 머리와 부드러운 칠이 없음 / 여성(v8)은 얼굴은 또렷하게, 분위기는 흐릿하게", () => {
  const m = emotionJob(M, PLACE, 1),
    f = emotionJob(F, PLACE, 1),
    mp = names(m.pos),
    fp = names(f.pos);
  for (const t of ["sharp jawline", "sharp eyes", "thick eyebrows", "hair between eyes", "side lighting", "sharp focus"])
    assert.ok(mp.includes(t), "남성 v9: " + t);
  for (const t of [
    "soft painting",
    "simple shading",
    "flat color",
    "desaturated",
    "thick neck",
    "muscular male",
    "soft bloom",
    "parted bangs",
    "curtained hair",
    "straight-on"
  ])
    assert.ok(!mp.includes(t), "남성 v9에 없어야 함: " + t);
  assert.ok(names(m.neg).includes("soft focus") && !names(m.neg).includes("hard shadows") && !names(m.neg).includes("messy hair"));
  assert.ok(m.post.blurA > 0 && m.post.blurA < f.post.blurA, "남성은 여성보다 옅게 흐림(날카로운 인상을 지킴)");
  assert.ok(fp.includes("soft gradient shading") && f.pos.includes("(adult woman:1.45)"), "여성의 칠과 성인 표시는 그대로");
  // 분위기는 후처리와 빛·배경 문구로 — 얼굴까지 흐리는 문구는 되살리지 않는다
  for (const t of ["soft focus", "low contrast", "lifted shadows", "pale skin", "narrow eyes"]) assert.ok(!fp.includes(t), "여성 v8에 없어야 함: " + t);
  assert.ok(fp.includes("soft bloom") && fp.includes("light haze") && f.post.blurA >= 0.3 && f.post.blurA < 0.6, "여성 v8: 빛 번짐·배경 안개·후처리 흐림");
  assert.ok(fp.includes("detailed iris") && fp.includes("rim light") && !names(f.neg).includes("rim light"), "여성: 홍채·가장자리 빛은 그대로");
  assert.ok(!isFem(M) && isFem(F));
  // 올백·이마를 드러낸 머리의 인물에게는 앞머리 문구를 붙이지 않음
  const back = names(emotionJob({ ...M, tags: "black hair, slicked back hair, grey eyes, navy blue suit, white shirt" }, PLACE, 1).pos);
  assert.ok(!back.includes("hair between eyes"), "올백 머리에는 떨어지는 앞머리를 붙이지 않음");
  // 화풍 안에서 부딪치던 것: 긍정에 넣은 빛을 막는 네거티브, 밝은 머리 남자의 두 번째 나이
  assert.ok(!names(m.neg).includes("rim light") && !names(m.neg).includes("cinematic lighting"));
  const pale = emotionJob({ ...M, age: 58, look: "58세 남성", tags: "grey hair, short hair, brown eyes, beige cardigan, white collared shirt" }, PLACE, 1);
  assert.deepEqual(pale.pos.match(/\(\d+ years old:[\d.]+\)/g), ["(58 years old:1.3)"], "나이 문구는 하나");
  // 기본 표정: 남자는 웃지 않고 입을 다묾(웃음은 네거티브), 여자는 살짝 미소
  assert.ok(names(m.pos).includes("closed mouth") && names(m.neg).includes("smirk"));
  assert.ok(names(f.pos).includes("light smile"));
});

test("일상 화풍: 남성 인물의 감정 그림은 애니 화풍으로 먼저 그린 밑그림을 쓴다(값 파일의 underdraw) — 프로필·휴식 칸과 여성 인물은 그대로", () => {
  const m = emotionJob(M, PLACE, 1),
    g = m.guide;
  assert.ok(g && g.strength === STYLE.m.underdraw.strength && g.strength > 0 && g.strength < 1, "밑그림과 세기");
  assert.equal(g.job.model, MODEL.air, "밑그림은 애니 화풍의 모델로");
  assert.deepEqual(
    [g.job.seed, g.job.width, g.job.height],
    [m.seed, SIZE.emotion.width, SIZE.emotion.height],
    "밑그림: 시드는 본 작업과 같게, 크기는 규격 크기"
  );
  // 본 그림은 밑그림보다 크게 그린다(값 파일의 scale) — 같은 크기에서 다시 그리면 작게 잡힌 얼굴의 눈과 세부가 뭉개졌음. 받은 뒤 규격 크기로 줄인다
  const k = STYLE.m.underdraw.scale;
  assert.ok(k > 1 && k <= 1.5, "본 그림을 키우는 배율(SDXL이 감당하는 1536까지)");
  assert.deepEqual([m.width, m.height], [SIZE.emotion.width * k, SIZE.emotion.height * k], "본 그림은 scale배 크기에서");
  assert.deepEqual(
    [emotionJob(F, PLACE, 1).width, profileJob(M, PLACE).width],
    [SIZE.emotion.width, SIZE.profile.width],
    "밑그림이 없는 그림은 규격 크기 그대로"
  );
  assert.ok(!("hires" in g.job) && !("post" in g.job) && !("lora" in g.job), "밑그림은 첫 그림만(키워 다시 그리기·후처리 없이)");
  assert.ok(/adult man/.test(g.job.pos) && names(g.job.neg).includes("child"), "밑그림에도 성인 표시와 미성년 네거티브");
  for (const slot of [2, 3, 6, 14])
    for (const sym of ["sparkle", "heart", "spoken heart", "anger vein", "flying sweatdrops"])
      assert.ok(!names(emotionJob(M, PLACE, slot).guide.job.pos).includes(sym), `칸 ${slot} 밑그림: 만화 기호 ${sym}`);
  assert.equal(emotionJob(M, PLACE, 1, { seed: 9 }).guide.job.seed, 9, "시드를 바꾸면 밑그림 시드도 같이");
  // 옷 규칙은 본 그림과 같게: 셔츠라고만 적힌 남자는 밑그림에도 깃 달린 셔츠(밑그림만 다른 깃으로 그려지면 그대로 따라옴)
  assert.ok(
    names(g.job.pos).includes("collared shirt") && names(m.pos).includes("collared shirt"),
    "셔츠 종류가 안 적힌 남자: 밑그림과 본 그림 모두 깃 달린 셔츠"
  );
  const tee = emotionJob({ ...M, tags: "black hair, short hair, grey eyes, black t-shirt, jeans" }, PLACE, 1);
  assert.ok(!names(tee.guide.job.pos).includes("collared shirt") && !names(tee.pos).includes("collared shirt"), "티셔츠 차림에는 붙이지 않음");
  assert.ok(assertSafe(emotionJob(M, undefined, 1)).guide, "장소가 없어도 뽑히고 검사를 통과");
  // 작품의 모든 장소에서(첫 장소만이 아니라 — 물가 장소는 젖은 옷 네거티브가 더 붙음) 남성 인물의 밑그림 작업이 검사를 통과
  for (const { c, places } of CAST.filter((x) => !isFem(x.c))) for (const place of places) for (let s = 1; s <= 14; s++) assertSafe(emotionJob(c, place, s));
  assert.ok(!profileJob(M, PLACE).guide, "프로필은 문구만");
  assert.ok(!emotionJob(M, PLACE, 11).guide, "남성 휴식 칸은 제 규칙대로");
  assert.ok(!emotionJob(F, PLACE, 1).guide, "여성 인물은 밑그림 없이");
  assert.ok(emotionJob(F, PLACE, 11).guide, "여성 휴식 칸의 밑그림은 그대로");
});
