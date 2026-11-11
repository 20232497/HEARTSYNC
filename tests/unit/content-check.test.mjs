// 작품 검사 규칙(tools/build.mjs — checkWork·scanImages·checkForbidden): 통과하는 가짜 작품 하나를 바탕으로 **한 칸씩만 망가뜨려** 규칙마다 기대한 오류가 나는지 봄.
// 규칙 하나가 조용히 꺼지면 그 줄이 실패하고, 규칙을 새로 더하면 맨 아래 '규칙 자리 수' 시험이 실패해 이 표에 줄을 더하게 함. 작품 이름·코드는 실제 작품에서 가져오지 않음.
import fs from "node:fs";
import path from "node:path";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { ROOT, appRules, checkWork, scanImages, checkForbidden } from "../../tools/build.mjs";

const R = appRules();
/* 검사 함수 안의 오류 자리 수(맨 아래 '규칙 자리 수' 시험) — 2026-11-12에 자리마다 번호를 달아 재 보니 아래 표가 76곳을 모두 한 번 이상 건드림 */
const WORK_SITES = 70, IMAGE_SITES = 6;
const KIND = Object.keys(R.LORE_KINDS)[0], long = (n) => "가".repeat(n);
/** 통과하는 가짜 작품 — 선택 칸을 거의 다 채워 둠(인물 둘: 본체 AAA + 그 다른 모습 AAB, 장소 둘, 컷씬 하나, 키워드북 하나, 명령어 둘, 시작 상황 하나) */
const base = () => ({
  id: "zz-check", name: "가람", title: "시험 작품", oneLiner: "한 줄 소개", desc: "작품 소개", persona: "이름: 가람\n나이: 27세\n외모: 검은 머리의 남성",
  cat: R.CATS[0], pal: 0, motif: Object.keys(R.MOTIFS)[0], glyph: "가", tags: ["시험"], fields: ["호감도"], gauge: "호감도",
  cast: [{ code: "AAA", name: "가람", look: "27세 남성, 검은 머리", tags: "black hair, tall" }, { code: "AAB", name: "가람(각성)", of: "AAA", look: "27세 남성, 흰 머리" }],
  places: [{ name: "광장", desc: "누구나 아는 곳", tags: "plaza" }, { name: "밀실", hidden: true }],
  cuts: [{ title: "재회", when: "다시 만날 때", tags: "reunion" }],
  lore: [{ keys: ["왕국", "나라"], text: "설명", kind: KIND, tags: "kingdom" }],
  commands: [{ cmd: "규칙", title: "규칙 보기", desc: "정해진 글", text: "[[AAA1]]\n\n정해진 글" }, { cmd: "장면", title: "장면 바꾸기", prompt: "장면을 바꾼다" }],
  openings: [{ id: "first", title: "첫 만남", text: "[[AAA0]]\n\n본문", place: 1, suggestions: ["안녕"], lead: { text: "천천히 시작한다", turns: 3 }, status: { 호감도: 10 } }]
});
/** 가짜 작품을 mut로 한 칸 망가뜨려 checkWork에 넣음. mut(c, ctx) — ctx(aud·row·id·order·extra)를 고치거나, 모듈 자체를 바꾸려면 새 모듈을 돌려줌 */
function run(mut) {
  const c = base(), ctx = { aud: "f", row: null, id: "zz-check", order: undefined, extra: {} };
  let mod = { default: c };
  const swap = mut ? mut(c, ctx) : undefined;
  if (swap) mod = swap;
  if (ctx.order !== undefined) mod.order = ctx.order;
  Object.assign(mod, ctx.extra);
  const errors = [], warnings = [];
  checkWork(mod, { aud: ctx.aud, row: ctx.row, id: ctx.id, wrel: "content/f/zz-check", R, errors, warnings });
  return { errors, warnings };
}
const op = (c) => c.openings[0];
const APP_CMD = R.APP_COMMANDS[0], ALIAS = R.APP_COMMANDS.find((x) => x.alias.length).alias[0];

/* 규칙마다 한 줄: [무엇을 망가뜨렸나, 망가뜨리는 함수, 기대하는 오류 글의 일부] */
const RULES = [
  // 모듈 모양
  ["export default가 객체가 아님", () => ({ default: [] }), /export default \{ … \} 로 작품 하나/],
  ["order가 숫자가 아님", (c, x) => { x.order = "1"; }, /export const order 는 숫자/],
  ["함수가 든 작품", (c) => { c.fn = () => 1; }, /글·숫자·참거짓·배열·객체만.*작품\.fn/],
  ["NaN이 든 작품", (c) => { c.pal = NaN; }, /글·숫자·참거짓·배열·객체만.*작품\.pal/],
  ["undefined가 든 작품", (c) => { c.world = undefined; }, /글·숫자·참거짓·배열·객체만.*작품\.world/],
  // 이름·필수 칸·분류
  ["id가 폴더 이름과 다름", (c) => { c.id = "other"; }, /id\("other"\)가 폴더 이름\("zz-check"\)과 달라요/],
  ["폴더 이름에 대문자·공백", (c, x) => { x.id = c.id = "Zz Check"; }, /폴더 이름\(=id\)은 영문 소문자·숫자/],
  ...["name", "title", "oneLiner", "desc", "persona"].map((k) => [`필수 칸 ${k}가 빔`, (c) => { c[k] = " "; }, new RegExp(`"${k}"가 비었어요`)]),
  ...["world", "speech", "secret", "glyph", "gauge"].map((k) => [`${k}가 글이 아님`, (c) => { c[k] = 3; }, new RegExp(`"${k}"는 글이어야`)]),
  ["없는 cat", (c) => { c.cat = "없는분류"; }, /cat\("없는분류"\)은/],
  ["범위 밖 pal", (c) => { c.pal = R.PALETTES.length; }, /pal은 0~/],
  ["없는 motif", (c) => { c.motif = "none"; }, /motif\("none"\)는/],
  ["tags가 배열이 아님", (c) => { c.tags = "시험"; }, /tags는 글 배열/],
  ["tags에 빈 글", (c) => { c.tags = ["시험", ""]; }, /tags는 글 배열/],
  ["fields가 빔", (c) => { c.fields = []; }, /fields\(상태창 칸 이름\)는 글 배열/],
  // 폴더가 정하는 칸
  ["aud가 폴더와 다름", (c) => { c.aud = "m"; }, /aud\("m"\)가 폴더\(f\/\)와 달라요/],
  ["줄 폴더가 아닌데 row", (c) => { c.row = "line"; }, /row\("line"\)를 쓰려면 _row\.json이 있는 줄 폴더/],
  ["row가 줄 폴더와 다름", (c, x) => { c.row = "line"; x.row = { key: "other" }; }, /row\("line"\)가 줄 폴더\(other\/\)와 달라요/],
  // 출연진
  ["cast가 빈 배열", (c) => { c.cast = []; op(c).text = "본문"; c.commands[0].text = "글"; }, /cast는 출연진 배열\(한 명 이상\)/],
  ["cast 항목에 이름이 없음", (c) => { delete c.cast[0].name; }, /cast\[0\]: \{ code: "영문 대문자 1~4자", name, look \}/],
  ["인물 코드에 소문자·숫자", (c) => { c.cast[1].code = "aa1"; }, /cast\[1\]\(가람\(각성\)\)\.code "aa1" — 인물 코드는 영문 대문자 1~4자/],
  ["인물 코드가 다섯 자", (c) => { c.cast[1].code = "ABCDE"; }, /인물 코드는 영문 대문자 1~4자/],
  ["예약 코드 MP를 인물에", (c) => { c.cast[1].code = "MP"; }, /code "MP"는 예약 코드/],
  ["예약 코드 EV를 인물에", (c) => { c.cast[1].code = "EV"; }, /code "EV"는 예약 코드/],
  ["인물 코드 중복", (c) => { c.cast.push({ code: "AAA", name: "다른 가람", look: "30세 남성" }); }, /cast 코드 "AAA"가 겹쳐요/],
  ["look이 글이 아님", (c) => { c.cast[0].look = 3; }, /cast\[0\]\.look은 글/],
  ["desc가 글이 아님", (c) => { c.cast[0].desc = 3; }, /cast\[0\]\.desc\(도감 소개\)는 글/],
  ["인물 tags에 한글", (c) => { c.cast[0].tags = "검은 머리"; }, /cast\[0\]\.tags는 영문 Danbooru 태그/],
  ["hidden이 배열이 아님", (c) => { c.cast[0].hidden = 3; }, /hidden은 숨길 감정 번호 배열/],
  ["hidden 번호가 범위 밖", (c) => { c.cast[0].hidden = [R.SIT.length]; }, /hidden은 숨길 감정 번호 배열/],
  ["hidden 번호 중복", (c) => { c.cast[0].hidden = [3, 3]; }, /hidden에 같은 번호가 두 번/],
  ["hidden에 0(프로필)", (c) => { c.cast[0].hidden = [0]; }, /0\(프로필\)은 숨길 수 없어요/],
  ["of가 없는 코드", (c) => { c.cast[1].of = "ZZZ"; }, /\.of "ZZZ" — 본체 인물의 코드여야/],
  ["폼의 폼", (c) => { c.cast.push({ code: "AAC", name: "가람(셋째)", of: "AAB", look: "27세 남성" }); }, /\.of "AAB" — 폼의 폼은 둘 수 없어요/],
  // 장소·컷씬
  ["장소에 이름이 없음", (c) => { delete c.places[0].name; }, /places\(장소\)는 \[\{ name/],
  ["장소 tags에 한글", (c) => { c.places[0].tags = "광장"; }, /places\(장소\)는/],
  ["장소 hidden이 참거짓이 아님", (c) => { c.places[1].hidden = "yes"; }, /places\(장소\)는/],
  ["컷씬에 제목이 없음", (c) => { delete c.cuts[0].title; }, /cuts\(컷씬\)는 \[\{ title/],
  ["컷씬 when이 글이 아님", (c) => { c.cuts[0].when = 3; }, /cuts\(컷씬\)는/],
  ["장소 이름 중복", (c) => { c.places.push({ name: "광장" }); }, /places: 장소 이름 "광장"이\(가\) 두 번/],
  ["컷씬 제목 중복", (c) => { c.cuts.push({ title: "재회" }); }, /cuts: 컷씬 제목 "재회"이\(가\) 두 번/],
  ["키워드북 첫 키 중복", (c) => { c.lore.push({ keys: ["왕국", "다른 말"], text: "설명", kind: KIND, tags: "k" }); }, /lore: 키워드북의 첫 키 "왕국"이\(가\) 두 번/],
  // 본문의 그림 태그
  ["태그가 한 토큰이 아님", (c) => { op(c).text = "[[AAA 3]] 본문"; }, /openings\[0\]: \[\[AAA 3\]\] — 그림 태그는 \[\[코드번호\]\] 한 토큰/],
  ["예전 [[img:…]] 태그", (c) => { op(c).text = "[[img:AAA:3]] 본문"; }, /예전 \[\[img:코드:번호\]\] 모양은 더 쓰지 않아요/],
  ["cast에 없는 코드", (c) => { op(c).text = "[[ZZZ1]] 본문"; }, /\[\[ZZZ1\]\] — 코드 "ZZZ"가 cast에 없어요/],
  ["소문자 코드", (c) => { op(c).text = "[[aaa1]] 본문"; }, /\[\[aaa1\]\] — 코드는 대문자로 — AAA1/],
  ["감정 번호가 범위 밖", (c) => { op(c).text = `[[AAA${R.SIT.length}]] 본문`; }, /번호 15 — 그림 칸은 기본 감정 0~14번/],
  ["장소 번호가 범위 밖", (c) => { op(c).text = "[[MP3]] 본문"; }, /\[\[MP3\]\] — MP3 — .*1~2번/],
  ["cuts 없이 EV 태그", (c) => { delete c.cuts; op(c).text = "[[EV1]] 본문"; }, /\[\[EV1\]\] — EV 코드를 쓰려면 work\.js에 cuts/],
  // 작품 명령어
  ["commands가 배열이 아님", (c) => { c.commands = "규칙"; }, /commands\(명령어\)는 \[\{ cmd/],
  ["명령어에 제목이 없음", (c) => { delete c.commands[0].title; }, /commands\[0\]: \{ cmd, title, desc\?, prompt 또는 text \}/],
  ["prompt와 text 둘 다", (c) => { c.commands[0].prompt = "지시"; }, /commands\[0\]\(규칙\): prompt.*와 text.* 중 하나만/],
  ["prompt도 text도 없음", (c) => { delete c.commands[1].prompt; }, /commands\[1\]\(장면\): prompt.*와 text.* 중 하나만/],
  ["즉답 글이 너무 김", (c) => { c.commands[0].text = long(R.LIMITS.reply + 1); }, new RegExp(`즉답 글은 ${R.LIMITS.reply}자 이내`)],
  ["즉답 글의 그림 태그가 틀림", (c) => { c.commands[0].text = "[[ZZZ1]] 글"; }, /commands\[0\]\(규칙\)\.text: \[\[ZZZ1\]\]/],
  ["cmd에 공백", (c) => { c.commands[0].cmd = "규 칙"; }, /cmd "규 칙" — 공백·!·\/ 없이 이름만/],
  ["cmd에 !", (c) => { c.commands[0].cmd = "!규칙"; }, /공백·!·\/ 없이 이름만/],
  ["앱 명령어 이름과 겹침", (c) => { c.commands[0].cmd = APP_CMD.cmd; }, /는 앱 명령어 이름이에요/],
  ["앱 명령어 별칭과 겹침", (c) => { c.commands[0].cmd = ALIAS; }, /는 앱 명령어 이름이에요/],
  ["cmd 중복(대소문자 무시)", (c) => { c.commands[0].cmd = "Rule"; c.commands[1].cmd = "rule"; }, /cmd "rule"가 겹쳐요/],
  // 작품 메타·권장 모델·가이드·양식
  ["creator가 빈 글", (c) => { c.creator = ""; }, /creator\(제작자 이름\)는 비어 있지 않은 글/],
  ["exclusive가 참거짓이 아님", (c) => { c.exclusive = "yes"; }, /exclusive\(독점 여부\)는 참거짓/],
  ["publishedAt이 없는 날짜", (c) => { c.publishedAt = "2026-02-30"; }, /publishedAt\("2026-02-30"\)은 "YYYY-MM-DD"/],
  ["publishedAt 모양이 다름", (c) => { c.publishedAt = "26-11-09"; }, /publishedAt\("26-11-09"\)은/],
  ["없는 권장 모델", (c) => { c.recommend = "ultra"; }, /recommend\("ultra"\)는/],
  ["권장 모델에 객체의 기본 속성 이름", (c) => { c.recommend = "toString"; }, /recommend\("toString"\)는/],
  ["guide가 빈 글", (c) => { c.guide = " "; }, /guide\(플레이 가이드\)는/],
  ["guide가 너무 김", (c) => { c.guide = long(R.LIMITS.guide + 1); }, new RegExp(`guide\\(플레이 가이드\\)는 ${R.LIMITS.guide}자 이내.*지금 ${R.LIMITS.guide + 1}자`)],
  ["noteTemplate이 너무 김", (c) => { c.noteTemplate = long(R.LIMITS.userNote + 1); }, new RegExp(`noteTemplate\\(유저노트 양식\\)는 ${R.LIMITS.userNote}자 이내`)],
  ["lookTags에 한글", (c) => { c.lookTags = "검은 머리"; }, /lookTags는 영문 Danbooru 태그/],
  ["artTags에 한글", (c) => { c.artTags = "성, 밤"; }, /artTags\(세계관 태그\)는 영문 태그/],
  // 키워드북
  ["키워드북 항목에 keys가 빔", (c) => { c.lore[0].keys = []; }, /lore\(키워드북\)는 \[\{ keys/],
  ["키워드북 text가 빔", (c) => { c.lore[0].text = ""; }, /lore\(키워드북\)는/],
  ["always가 참거짓이 아님", (c) => { c.lore[0].always = "yes"; }, /lore\[0\]\(왕국\)\.always\(상시 주입\)는 참거짓/],
  ["order가 숫자가 아님", (c) => { c.lore[0].order = "1"; }, /lore\[0\]\(왕국\)\.order\(우선순위/],
  ["not이 글 배열이 아님", (c) => { c.lore[0].not = "전쟁"; }, /\.not\(이 낱말이 나오면 넣지 않음\)은 글 배열/],
  ["not이 빈 배열", (c) => { c.lore[0].not = []; }, /\.not\(이 낱말이 나오면 넣지 않음\)은 글 배열/],
  ["also에 빈 글", (c) => { c.lore[0].also = [""]; }, /\.also\(keys와 함께 나와야 하는 낱말\)는 글 배열/],
  ["상시 항목에 not", (c) => { c.lore[0].always = true; c.lore[0].not = ["전쟁"]; }, /상시\(always\) 항목에는 not·also를 쓸 수 없어요/],
  ["상시 항목에 also", (c) => { c.lore[0].always = true; c.lore[0].also = ["전쟁"]; }, /상시\(always\) 항목에는 not·also를 쓸 수 없어요/],
  ["한 항목이 한 턴 예산보다 김", (c) => { c.lore[0].text = long(R.LORE.budget + 1); }, new RegExp(`한 턴 예산\\(${R.LORE.budget}자\\)보다 길어 한 번도 들어가지 못해요`)],
  ["상시 항목 개수가 예산을 넘음", (c) => { c.lore = Array.from({ length: R.LORE.max + 1 }, (_, i) => ({ keys: ["키" + i], text: "설명", always: true, kind: KIND, tags: "k" })); }, new RegExp(`상시\\(always\\) 항목이 ${R.LORE.max + 1}개`)],
  ["상시 항목 글자 합이 예산을 넘음", (c) => { c.lore = [0, 1].map((i) => ({ keys: ["키" + i], text: long(Math.ceil(R.LORE.budget * 0.6)), always: true, kind: KIND, tags: "k" })); }, /상시\(always\) 항목이 2개·\d+자예요/],
  ["없는 kind", (c) => { c.lore[0].kind = "weird"; }, /lore\[0\]\(왕국\)\.kind\("weird"\)는/],
  ["키워드북 tags에 한글", (c) => { c.lore[0].tags = "왕국"; }, /lore\[0\]\(왕국\)\.tags는 영문 태그/],
  // 시작 상황
  ["시작 상황이 없음", (c) => { c.openings = []; }, /openings\(시작 상황\)가 하나 이상/],
  ["시작 상황에 본문이 없음", (c) => { delete op(c).text; }, /openings\[0\]: title·text가 있어야/],
  ["시작 상황 id가 없음", (c) => { delete op(c).id; }, /openings\[0\]\(첫 만남\)\.id가 없어요/],
  ["시작 상황 id에 대문자", (c) => { op(c).id = "First"; }, /\.id\("First"\)가 모양에 안 맞아요/],
  ["시작 상황 id가 한 글자", (c) => { op(c).id = "a"; }, /\.id\("a"\)가 모양에 안 맞아요/],
  ["시작 상황 id가 숫자로 시작", (c) => { op(c).id = "1st"; }, /\.id\("1st"\)가 모양에 안 맞아요/],
  ["시작 상황 id 중복", (c) => { c.openings.push({ id: "first", title: "둘째", text: "본문" }); }, /openings\[1\]\.id\("first"\)가 앞의 시작 상황과 겹쳐요/],
  ["directive가 글이 아님", (c) => { op(c).directive = 3; }, /openings\[0\]\.directive는 글/],
  ["place가 범위 밖", (c) => { op(c).place = 3; }, /openings\[0\]\.place\(3\) — 배경 장소는 places의 1~2번째/],
  ["places 없이 place", (c) => { delete c.places; }, /places가 없으면 쓸 수 없어요/],
  ["suggestions가 빈 배열", (c) => { op(c).suggestions = []; }, /suggestions\(첫 답변 추천\)는 글 1~3개/],
  ["suggestions가 네 개", (c) => { op(c).suggestions = ["가", "나", "다", "라"]; }, /suggestions\(첫 답변 추천\)는 글 1~3개/],
  ["suggestions 한 줄이 너무 김", (c) => { op(c).suggestions = [long(R.LIMITS.suggestion + 1)]; }, new RegExp(`각 ${R.LIMITS.suggestion}자 이내`)],
  ["lead의 turns가 0", (c) => { op(c).lead.turns = 0; }, /lead\(시작 연출\)는 \{ text/],
  ["lead의 turns가 상한을 넘음", (c) => { op(c).lead.turns = R.LIMITS.leadTurns + 1; }, /lead\(시작 연출\)는/],
  ["lead의 글이 너무 김", (c) => { op(c).lead.text = long(R.LIMITS.lead + 1); }, /lead\(시작 연출\)는/],
  ["status 값이 글·숫자가 아님", (c) => { op(c).status = { 호감도: [1] }; }, /openings\[0\]\.status는 \{ "칸 이름": 글 또는 숫자 \}/],
  // 트랙·안전·폴더
  ["성인 트랙을 적음", (c) => { c.track = "adult"; }, /track: "adult" — content\/의 작품은 일반 트랙만/],
  ["19세 미만 출연진(외모)", (c) => { c.cast[0].look = "17세 남성, 검은 머리"; }, /19세 미만이거나 학생으로 보이는 인물이 있어요: 가람 /],
  ["19세 미만 출연진(영문 태그)", (c) => { c.cast[1].tags = "16 years old"; }, /19세 미만이거나 학생으로 보이는 인물이 있어요: 가람\(각성\)/],
  ["설정 첫머리의 미성년 나이", (c) => { c.persona = "가람(17, 견습 기사)\n외모: 검은 머리의 남성"; }, /19세 미만이거나 학생으로 보이는 인물이 있어요/],
  ["출연진 성별과 폴더가 어긋남", (c, x) => { x.aud = "m"; }, /출연진 외모가 모두 남성이에요 — f\/ 폴더/]
];

test("바탕 가짜 작품은 오류·경고 없이 통과", () => {
  assert.deepEqual(run(), { errors: [], warnings: [] });
});
for (const [name, mut, want] of RULES) {
  test(`checkWork: ${name} → 실패`, () => {
    const { errors } = run(mut);
    assert.ok(errors.some((x) => want.test(x)), `기대한 오류(${want})가 없음 — 나온 오류: ${JSON.stringify(errors)}`);
    assert.ok(errors.every((x) => x.startsWith("content/f/zz-check: ")), "오류는 작품 경로로 시작");
  });
}
test("checkWork: 통과해야 하는 모양 — track general, cast 없는 1:1 작품(코드 C), 전체(all) 폴더의 혼성 출연진, 줄 폴더와 같은 row", () => {
  assert.deepEqual(run((c) => { c.track = "general"; }).errors, []);
  assert.deepEqual(run((c) => { delete c.cast; c.lookTags = "black hair"; c.openings[0].text = "[[C0]]\n\n본문"; c.commands[0].text = "[[C1]] 글"; }), { errors: [], warnings: [] });
  assert.deepEqual(run((c, x) => { x.aud = "all"; c.cast.push({ code: "BBB", name: "나래", look: "26세 여성" }); }), { errors: [], warnings: [] });
  assert.deepEqual(run((c, x) => { c.row = "line"; c.aud = "f"; x.row = { key: "line" }; x.order = 3; }), { errors: [], warnings: [] });
});
test("checkWork: 경고로만 알리는 것(빌드는 통과)", () => {
  const warn = (mut, want) => { const r = run(mut); assert.deepEqual(r.errors, []); assert.ok(r.warnings.some((x) => want.test(x)), `기대한 경고(${want})가 없음 — ${JSON.stringify(r.warnings)}`); };
  warn((c, x) => { x.extra = { helper: 1 }; }, /빌드가 쓰지 않는 export: helper/);
  warn((c) => { c.glyph = "가람"; }, /glyph는 한 글자/);
  warn((c) => { c.gauge = "신뢰"; }, /gauge\("신뢰"\)가 fields에 없어요/);
  warn((c) => { c.lookTags = "black hair"; }, /cast가 있으면 lookTags는 쓰이지 않아요/);
  warn((c) => { c.lore[0].always = true; c.lore[0].text = long(R.LORE.budget / 2 + 1); }, /한 턴 예산\(\d+자\)의 절반을 넘어요/);
  warn((c) => { delete c.lore[0].kind; }, /lore\[0\]\(왕국\)에 kind·tags가 없어요/);
  warn((c) => { c.openings[0].status = { 신뢰: 1 }; }, /openings\[0\]\.status의 신뢰 칸이 fields에 없어요/);
  warn((c, x) => { x.aud = "all"; }, /출연진 외모가 모두 남성이에요 — f\/ 폴더가 더 맞을 수 있어요/);
});

/* 그림 파일 이름 규칙(scanImages): 저장소 안의 임시 폴더(.build/ — git에 안 들어감)에 빈 파일을 이름만 만들어 넣어 봄 */
const tmps = [];
after(() => tmps.forEach((d) => fs.rmSync(d, { recursive: true, force: true })));
function scan(files) {
  fs.mkdirSync(path.join(ROOT, ".build"), { recursive: true });
  const dir = fs.mkdtempSync(path.join(ROOT, ".build", "t-img-")), rel = path.relative(ROOT, dir).split(path.sep).join("/");
  tmps.push(dir);
  fs.mkdirSync(path.join(dir, "images"));
  files.forEach((f) => fs.writeFileSync(path.join(dir, "images", f), ""));
  const w = { rel, c: base() }, errors = [], warnings = [];
  scanImages(w, R, errors, warnings);
  return { w, rel, errors, warnings };
}
test("scanImages: 이름 규칙에 맞는 그림은 images·img·loreImages로(코드 글자 → 번호 → 경로, 키워드북은 첫 키로)", () => {
  const { w, rel, errors, warnings } = scan(["AAA0.webp", "AAA3.png", "AAB14.jpg", "MP2.jpeg", "EV1.webp", "cover.webp", "lore-1.webp"]);
  assert.deepEqual([errors, warnings], [[], []]);
  assert.deepEqual(w.images, { AAA: { 0: `${rel}/images/AAA0.webp`, 3: `${rel}/images/AAA3.png` }, AAB: { 14: `${rel}/images/AAB14.jpg` }, EV: { 1: `${rel}/images/EV1.webp` }, MP: { 2: `${rel}/images/MP2.jpeg` } });
  assert.equal(w.img, `${rel}/images/cover.webp`);
  assert.deepEqual(w.loreImages, { 왕국: `${rel}/images/lore-1.webp` });
  const none = scan([]).w; // 그림이 없으면 칸을 만들지 않음
  assert.deepEqual([none.images, none.img, none.loreImages], [undefined, undefined, undefined]);
});
const IMAGE_RULES = [
  ["번호 15 이상", ["AAA15.webp"], /AAA15\.webp: 번호 15 — 그림 칸은 기본 감정 0~14번/],
  ["cast에 없는 코드", ["ZZZ1.webp"], /ZZZ1\.webp: 코드 "ZZZ"가 cast에 없어요/],
  ["소문자 코드", ["aaa1.webp"], /aaa1\.webp: 코드는 대문자로/],
  ["범위 밖 장소", ["MP3.webp"], /MP3\.webp: MP3 — .*1~2번/],
  ["범위 밖 컷씬", ["EV2.webp"], /EV2\.webp: EV2 — .*1~1번/],
  ["예전 이름", ["ks-0.webp"], /ks-0\.webp: 예전 이름이에요/],
  ["같은 칸 그림이 둘", ["AAA3.png", "AAA3.webp"], /AAA3\.webp: AAA3 그림이 둘이에요/],
  ["표지가 둘", ["cover.png", "cover.webp"], /cover\.webp: 표지가 둘이에요/],
  ["없는 키워드북 번호", ["lore-2.webp"], /lore-2\.webp: 키워드북 항목은 1~1번이에요/],
  ["키워드북 0번", ["lore-0.webp"], /lore-0\.webp: 키워드북 항목은 1~1번이에요/],
  ["키워드북 그림이 둘", ["lore-1.png", "lore-1.webp"], /lore-1\.webp: 키워드북 1번 항목의 그림이 둘이에요/]
];
for (const [name, files, want] of IMAGE_RULES) {
  test(`scanImages: ${name} → 실패`, () => {
    const { errors } = scan(files);
    assert.ok(errors.some((x) => want.test(x)), `기대한 오류(${want})가 없음 — ${JSON.stringify(errors)}`);
  });
}
test("scanImages: 그림이 아닌 파일·알 수 없는 이름은 경고만 하고 지나침, _·.으로 시작하는 파일은 보지 않음", () => {
  const { w, errors, warnings } = scan(["notes.txt", "strange.webp", "_draft.webp", ".hidden.png"]);
  assert.deepEqual(errors, []);
  assert.equal(warnings.length, 2);
  assert.ok(warnings.some((x) => /notes\.txt: 그림 파일\(webp·png·jpg\)이 아니라/.test(x)) && warnings.some((x) => /strange\.webp: 이름을 알 수 없어/.test(x)), JSON.stringify(warnings));
  assert.equal(w.images, undefined);
});

test("checkForbidden: 두 빌드 모두 외부 AI·그림 서비스 주소가 있으면 실패, 사용자 빌드에는 관리자 모듈 머리도 안 됨", () => {
  const ok = "<script>fetch('https://api.anthropic.com/v1/messages')</script>", adminHead = "/* ── src/js/admin/gate.js — 관문 */";
  assert.deepEqual([checkForbidden(ok, "user"), checkForbidden(ok, "admin")], [[], []]);
  for (const host of ["https://openrouter.ai/api/v1", "https://api.RunWare.ai/v1"]) {
    assert.match(checkForbidden(`<script>fetch("${host}")</script>`, "user")[0], /index\.html에 들어가면 안 되는 것.*OpenRouter·Runware/);
    assert.match(checkForbidden(`<script>fetch("${host}")</script>`, "admin")[0], /admin\.html에 들어가면 안 되는 것/);
  }
  assert.match(checkForbidden(adminHead, "user")[0], /index\.html에 들어가면 안 되는 것.*관리자 모듈/);
  assert.deepEqual(checkForbidden(adminHead, "admin"), [], "관리자 빌드에는 관리자 모듈이 들어감");
});

/* 규칙을 새로 더했는데 이 표에 줄을 더하지 않으면 여기서 걸림 — checkWork·scanImages 안의 오류 자리(e(…)·errors.push(…)) 수 */
test("규칙 자리 수: checkWork의 오류 자리 수가 이 시험이 아는 수와 같음(규칙을 더하면 위 표에 줄을 더하고 이 수를 고침)", () => {
  const src = fs.readFileSync(new URL("../../tools/build.mjs", import.meta.url), "utf8").replace(/\r\n?/g, "\n");
  const body = (name) => { const i = src.indexOf(`export function ${name}(`), j = src.indexOf("\n}\n", i); assert.ok(i >= 0 && j > i, name + " 를 찾지 못함"); return src.slice(i, j); };
  const sites = (text, re) => (text.match(re) || []).length;
  assert.equal(sites(body("checkWork"), /[^\w.]e\(/g), WORK_SITES, "checkWork의 e(…) 자리 수가 바뀜 — 더한 규칙의 줄을 RULES 표에 넣고 WORK_SITES를 고치세요");
  assert.equal(sites(body("scanImages"), /errors\.push\(/g), IMAGE_SITES, "scanImages의 오류 자리 수가 바뀜 — IMAGE_RULES 표에 줄을 넣고 IMAGE_SITES를 고치세요");
});
