// 안전 규칙(src/js/core/safety.js) 단위 테스트 — 미성년 인물은 어떤 설정에서도 막는다(CLAUDE.md '원칙')
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { minorFlags, minorHint, roomMinorHint, settingHint } from "../../src/js/core/safety.js";

test("minorFlags: 출연진 외모의 19세 미만 나이·학생 신분, 설정 첫머리의 '이름(나이'를 잡는다", () => {
  assert.deepEqual(minorFlags({ cast: [{ code: "a", name: "A", look: "17세 여성" }, { code: "b", name: "B", look: "25세 남성" }], persona: "" }), ["A"]);
  assert.deepEqual(minorFlags({ cast: [{ code: "a", name: "A", look: "여고생 교복" }], persona: "" }), ["A"]);
  assert.deepEqual(minorFlags({ cast: [], persona: "한겨울(16, 여). 편의점 알바" }), ["한겨울"]);
  assert.deepEqual(minorFlags({ cast: [{ code: "c", name: "서도윤", look: "29세 남성" }], persona: "서도윤(29, 남). 탐정" }), []);
});
test("minorFlags: 설정 뒤쪽의 가족·과거 인물 나이는 보지 않는다", () => {
  const persona = "백연(외견 28세, 실제 나이 천 살 이상, 남). " + "x".repeat(130) + " 동생 백화(12, 여)는 오래전에 죽었다";
  assert.deepEqual(minorFlags({ cast: [{ code: "c", name: "백연", look: "28세 남성" }], persona }), []);
});
test("minorHint: 글 속 19세 미만 나이·학생·아동 낱말과 영문 태그", () => {
  assert.equal(minorHint("17세 소녀가"), true);
  assert.equal(minorHint("1girl, school uniform"), true);
  assert.equal(minorHint("교복을 입은"), true);
  assert.equal(minorHint("1girl, 25 years old, office lady"), false);
  assert.equal(minorHint("19세 성인"), false);
  assert.equal(minorHint(""), false);
});
const every = (want, list) => { for (const t of list) assert.equal(minorHint(t), want, `minorHint(${JSON.stringify(t)})`); };
test("minorHint: 한글로 쓴 나이를 잡는다", () => {
  every(true, ["열일곱 살", "열일곱살", "열여덟살이야", "열세 살", "열 살", "만 열일곱 살", "일곱 살 아이", "다섯 살", "세 살 아이", "열일곱 살구나", "열일곱 세", "십칠 세", "십칠세", "열일곱 소녀", "열여덟의 소년", "나이: 열일곱", "10대 소녀", "십대 소년", "10대 후반"]);
});
test("minorHint: 조사가 붙은 나이·'어린 + 사람'·연령·단위 없는 나이를 잡고, 나이 차이와 몸의 살은 통과", () => {
  every(true, ["17살을 맞았다", "그녀는 17살을 갓 넘겼다", "17 살을", "17살아", "17살랑", "열일곱 살을 넘긴 소녀", "네 살을 넘겼다", "12살 어린아이", "17살 어린 소녀", "17세 어린 소녀", "17살 어린 여자애", "열일곱 살 어린 소녀", "연령 16", "연령: 15", "연령은 14", "연령: 열일곱", "열여섯이다", "열일곱인 그녀"]);
  every(false, ["25살을 넘겼다", "스무 살을 맞았다", "살을 뺐다", "그녀의 살을 만졌다", "네 살을 만졌다", "두 살을 맞대고", "3살차이", "5살연상", "3살 어린 동생", "열일곱 살 어린", "연령 25", "연령 제한", "열다섯 명", "열일곱 번째"]);
});
test("minorHint: 학년을 잡는다", () => {
  every(true, ["고2", "중3", "초6", "고3이야", "(고1)", "고2 여름방학", "고등학교 2학년", "중학교 3학년", "초등학교 6학년", "고교 1학년", "여고 2학년", "고등학교 이학년", "2학년 3반"]);
});
test("minorHint: 숫자·영문 나이 표기를 잡는다", () => {
  every(true, ["17 y/o", "17y/o", "17 y.o.", "17yo", "17-year-old", "17 year old", "17 years old", "17 yrs old", "seventeen years old", "aged 16", "age: 15", "나이: 17", "나이 17", "나이는 16", "17세요", "(17세)", "１７세"]);
  every(true, ["teenage girl", "preteen", "high schooler", "highschool", "junior high", "schoolgirls"]);
});
test("minorHint: 학생을 가리키는 낱말을 잡는다", () => {
  every(true, ["청소년", "고교생", "중고생", "초등생", "잼민이", "여고생", "교복"]);
});
test("minorHint: 나이는 세·살 어느 쪽으로 써도 같이 잡고, 나이가 아닌 N세만 통과한다", () => {
  // 인물 소개의 기본 표기가 N세라, 한쪽만 풀면 표기만 바꿔 넘어갈 수 있음
  for (let n = 1; n <= 18; n++) every(true, [n + "세", n + "살", "하나 " + n + "세", "(" + n + "세, 여)"]);
  every(false, ["19세", "19살", "25세 여성", "32세 남성"]);
  // 군주 이름·세습·등급 표시는 나이가 아님
  every(false, ["루이 14세", "루이 16세의 궁전", "헨리 8세", "엘리자베스 2세", "찰스 3세", "나폴레옹 3세", "베네딕토 16세", "교황 레오 14세", "황제 레온 3세", "선왕 카를로스 2세", "한인 2세", "재일 3세", "15세 관람가", "12세 이상 관람가", "15세 이용가"]);
  // 같은 꼴이라도 나이로 읽히면 잡음: 뒤에 소녀·소년·성별, 직함 뒤의 두 자리 수, 직함과 수 사이의 나이 낱말, 없던 군주
  every(true, ["루이 17세 소년", "루이 16세, 남", "헨리 8세 아이", "엘리자베스 3세", "황제 레온 17세", "황제 나이 7세", "여왕 리리아 16세", "공작 영애 17세", "리리아 17세, 여"]);
});
test("minorHint: 여학생·남학생만으로는 막지 않고, 나이·학년·교복과 함께 쓰면 그쪽이 잡는다", () => {
  // 대학생에게도 흔히 쓰는 말이라 보지 않음(2026-11-06 사용자 결정)
  every(false, ["여학생", "남학생", "여학생 기숙사", "대학교 3학년 여학생", "공대 여학생"]);
  every(true, ["열일곱 살 여학생", "17살 남학생", "17세 여학생", "고2 여학생", "중학교 3학년 남학생", "교복 입은 여학생"]);
});
test("minorHint: 성인 나이·성인 신분은 통과", () => {
  every(false, ["스무 살", "스무살", "스물한 살", "스물두 살", "스물일곱 살", "서른세 살", "마흔네 살", "열아홉 살", "19세", "나이 25", "age 25", "25 yo", "이십 세", "이십칠 세", "수십 살", "몇십 세", "오십대 여성", "20대 소녀", "117살 엘프", "500살 먹은 뱀파이어", "천 살", "1500살"]);
  every(false, ["대학생", "여대생", "대학교 2학년", "대학 3학년", "고등학교 동창", "고등학교 졸업", "중학교 선생님", "초등학교 교사"]);
});
test("minorHint: 글자만 겹치는 말은 통과", () => {
  every(false, ["18세기", "17세기 유럽", "3세대", "제3세계", "3세트", "재벌 3세", "오너 2세", "2세 계획", "10대 기업", "십대 고수", "청소년 관람불가"]);
  every(false, ["두 살 위", "세 살 어린", "3살 차이", "5살 연상", "2살 연하", "한 살이라도 어릴 때", "한 살 더 먹었다", "세 살 버릇 여든까지"]);
  every(false, ["네 살아 있네", "다섯 살아남았다", "두 살인 사건", "일곱 살인 사건", "복수를 위한 살인이었다", "네 세계", "두 세력", "한 세상", "이 세상", "열두 세계"]);
  every(false, ["칼로리", "쇼타임", "글로리", "플로리다", "유아독존", "중2병", "그중 3명", "중 3명", "최고2", "사고 2건", "하고 2시간", "3초", "page 17", "image 12", "stage 12", "나이 차이 5", "나이가 3배"]);
});
test("settingHint: 어른 인물의 과거 이야기는 통과, 지금의 나이·신분은 잡는다", () => {
  for (const t of ["중학생 때 만났다", "열일곱 살 때 집을 나왔다", "고2 때 전학", "고등학교 2학년 때", "여고생이던 시절", "17살 무렵"]) assert.equal(settingHint(t), false, t);
  for (const t of ["열일곱 살이다", "17살 여고생이다. 그녀가 웃을 때 예쁘다", "17살 때문에 안 돼", "나이: 17"]) assert.equal(settingHint(t), true, t);
});
test("minorFlags: 한글 나이·학년·영문 태그도 잡고, 나이 차이는 통과", () => {
  assert.deepEqual(minorFlags({ cast: [{ code: "a", name: "A", look: "열일곱 살 여성" }], persona: "" }), ["A"]);
  assert.deepEqual(minorFlags({ cast: [{ code: "a", name: "A", look: "고2 여성" }], persona: "" }), ["A"]);
  assert.deepEqual(minorFlags({ cast: [{ code: "a", name: "A", look: "여성", tags: "1girl, school uniform" }], persona: "" }), ["A"]);
  assert.deepEqual(minorFlags({ cast: [{ code: "a", name: "A", look: "외견 28세, 실제 17세" }], persona: "" }), ["A"]);
  assert.deepEqual(minorFlags({ cast: [{ code: "a", name: "A", look: "25세 여성, 유저보다 3살 연상" }], persona: "" }), []);
  assert.deepEqual(minorFlags({ cast: [], persona: "한겨울(열일곱, 여). 편의점 알바" }), ["한겨울"]);
  assert.deepEqual(minorFlags({ name: "겨울", cast: [], persona: "이름: 한겨울\n나이: 17\n성별: 여" }), ["겨울"]);
  assert.deepEqual(minorFlags({ name: "겨울", cast: [], persona: "한겨울. 스물다섯 살. 중학생 때 이 동네로 왔다" }), []);
});

/* 대화방 전체 판정: 빈 방은 통과하고, 한 칸에 표현을 넣으면 막힌다 */
const sampleRoom = (over = {}) => ({
  char: { id: "w", title: "작품", name: "서윤", persona: "서윤(25, 여). 탐정", world: "", speech: "", secret: "", tags: [], cast: [{ code: "c", name: "서윤", look: "25세 여성" }], lore: [] },
  persona: { name: "유저", memo: "", desc: "" }, directive: "", userNote: "", memory: "", status: {}, set: { mem: 2 },
  msgs: [{ role: "ai", idx: 0, alts: [{ text: "*비가 내렸다.*" }] }], ...over
});
const you = (text) => ({ role: "user", text }), ai = (text) => ({ role: "ai", idx: 0, alts: [{ text }] });
const filler = (n) => Array.from({ length: n }, (_, i) => (i % 2 ? ai("*장면이 이어졌다.*") : you("다음 장면으로 가자")));

test("roomMinorHint: 깨끗한 방은 통과", () => {
  assert.equal(roomMinorHint(sampleRoom()), false);
  assert.equal(roomMinorHint(sampleRoom({ msgs: [ai("*비가 내렸다.*"), you("스무 살이야. 대학생이고")] })), false);
  assert.equal(roomMinorHint({}), false);
});
test("roomMinorHint: 대화 앞부분에서 유저가 쓴 나이는 기억력 밖으로 밀려도 계속 막는다", () => {
  assert.equal(roomMinorHint(sampleRoom({ msgs: [you("걔는 열일곱 살이야"), ai("*고개를 끄덕였다.*"), you("계속 가자")] })), true);
  assert.equal(roomMinorHint(sampleRoom({ msgs: [you("걔는 열일곱 살이야"), ...filler(40)] })), true);
});
test("roomMinorHint: 모델이 읽는 범위의 글은 그대로, 밖으로 밀린 AI 글·과거 이야기는 풀린다", () => {
  assert.equal(roomMinorHint(sampleRoom({ msgs: [ai("*교복 차림의 소녀가 들어왔다.*"), you("인사해")] })), true);
  assert.equal(roomMinorHint(sampleRoom({ msgs: [ai("*교복 차림의 소녀가 들어왔다.*"), ...filler(40)] })), false);
  assert.equal(roomMinorHint(sampleRoom({ msgs: [you("중학생 때 어땠어?"), ai("*웃었다.*")] })), true);
  assert.equal(roomMinorHint(sampleRoom({ msgs: [you("중학생 때 어땠어?"), ...filler(40)] })), false);
  // 고른 버전의 글만 모델이 읽음
  assert.equal(roomMinorHint(sampleRoom({ msgs: [{ role: "ai", idx: 1, alts: [{ text: "교복" }, { text: "정장" }] }] })), false);
});
test("roomMinorHint: 인물 설정·유저 캐릭터·유저노트·장기기억·키워드북·상태창의 나이를 본다", () => {
  const char = sampleRoom().char;
  assert.equal(roomMinorHint(sampleRoom({ char: { ...char, persona: "서윤(25, 여). " + "x".repeat(200) + " 그런데 사실 열일곱 살이다" } })), true);
  assert.equal(roomMinorHint(sampleRoom({ char: { ...char, cast: [{ code: "c", name: "서윤", look: "고2 여성" }] } })), true);
  assert.equal(roomMinorHint(sampleRoom({ char: { ...char, secret: "실은 고등학교 2학년이다" } })), true);
  assert.equal(roomMinorHint(sampleRoom({ char: { ...char, world: "배경은 여고생들의 기숙사" } })), true);
  assert.equal(roomMinorHint(sampleRoom({ persona: { name: "유저", memo: "17 y/o", desc: "" } })), true);
  assert.equal(roomMinorHint(sampleRoom({ persona: { name: "유저", memo: "", desc: "고2 남학생" } })), true);
  assert.equal(roomMinorHint(sampleRoom({ userNote: "서윤은 열여덟 살로 한다" })), true);
  assert.equal(roomMinorHint(sampleRoom({ memory: "서윤이 열일곱 살이라고 밝혔다" })), true);
  assert.equal(roomMinorHint(sampleRoom({ directive: "둘 다 고3이다" })), true);
  assert.equal(roomMinorHint(sampleRoom({ status: { "나이": 17 } })), true);
  assert.equal(roomMinorHint(sampleRoom({ status: { "호감도": 17, "관계": "서윤 12 · 하린 7" } })), false);
  assert.equal(roomMinorHint(sampleRoom(), [{ keys: ["하린"], text: "서윤의 친구. 열일곱 살", kind: "person" }]), true);
});
test("roomMinorHint: 어른 인물의 과거 이야기와 동물의 나이는 막지 않는다", () => {
  const char = sampleRoom().char;
  assert.equal(roomMinorHint(sampleRoom({ char: { ...char, secret: "중학생 때 유저와 마주친 적이 있다" } })), false);
  assert.equal(roomMinorHint(sampleRoom({ memory: "서윤은 열일곱 살 때 집을 나왔다" })), false);
  assert.equal(roomMinorHint(sampleRoom({ persona: { name: "유저", memo: "", desc: "고등학교 2학년 때 전학 왔다" } })), false);
  assert.equal(roomMinorHint(sampleRoom(), [{ keys: ["보리"], text: "늙은 진돗개(14살)", kind: "creature" }]), false);
});
test("오리지널 작품은 어느 시작 상황에서도 막히지 않는다(content/ 전부)", async () => {
  const root = fileURLToPath(new URL("../../content/", import.meta.url)), files = [];
  (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name === "work.js") files.push(p); } })(root);
  assert.ok(files.length >= 12, `작품 파일을 찾지 못함: ${files.length}개`);
  for (const f of files) {
    const c = (await import(pathToFileURL(f).href)).default;
    assert.deepEqual(minorFlags(c), [], `${c.id}: minorFlags`);
    for (const op of c.openings) {
      const r = { char: c, persona: { name: "유저", memo: "", desc: "" }, directive: op.directive || "", userNote: "", memory: "", status: op.status || {}, set: { mem: 10 }, msgs: [ai(op.text)] };
      assert.equal(roomMinorHint(r), false, `${c.id} · ${op.title}`);
    }
  }
});
