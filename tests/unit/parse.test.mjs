// 응답 파싱(src/js/ai/parse.js) 단위 테스트 — npm test (node --test가 **/*.test.mjs를 찾음)
// 모듈을 Node에서 바로 import한다(브라우저 없이). 요청·응답 형식(MARK·status JSON)은 docs/app/prompt.md '응답 형식'
import { test } from "node:test";
import assert from "node:assert/strict";
import { splitReply, multiPairs, multiMax, castMulti, castField, parseState, dropEcho, looseJSON } from "../../src/js/ai/parse.js";
import { MARK } from "../../src/js/core/constants.js";
import { ORIGINALS } from "../../src/js/content/index.js";

const CHAR = {
  fields: ["📍 장소", "❤️ 호감도", "💭 속마음"],
  gauge: "❤️ 호감도",
  cast: [
    { code: "IH", name: "이화" },
    { code: "SR", name: "설련" }
  ]
};

test("splitReply: 구분자로 본문과 상태 JSON을 나눈다", () => {
  const r = splitReply(`본문 한 줄\n${MARK}\n{"status":{"📍 장소":"궁"}}`);
  assert.equal(r.body, "본문 한 줄\n");
  assert.deepEqual(JSON.parse(r.json), { status: { "📍 장소": "궁" } });
});
test('splitReply: 변형 구분자(== STATE ==)와 구분자 없는 {"status"…}도 찾는다', () => {
  assert.equal(JSON.parse(splitReply('본문\n== STATE ==\n{"status":{}}').json).status !== undefined, true);
  // ```json 울타리는 json 조각에 그대로 남고 looseJSON이 첫 {부터 읽는다(parseState가 그렇게 씀)
  assert.ok(looseJSON(splitReply('본문\n```json\n{"status":{}}').json).status);
  assert.deepEqual(splitReply("구분자 없는 본문만"), { body: "구분자 없는 본문만", json: "" });
});
test("splitReply: JSON 뒤에 붙은 그림 태그([[HSY0]]·예전 [[img:ks:0]])는 본문으로 옮긴다", () => {
  const r = splitReply(`본문\n${MARK}\n{"status":{}}\n[[HSY0]]`);
  assert.match(r.body, /\[\[HSY0\]\]$/);
  assert.doesNotMatch(r.json, /\[\[/);
  const old = splitReply(`본문\n${MARK}\n{"status":{}}\n[[img:ks:0]]`);
  assert.match(old.body, /\[\[img:ks:0\]\]$/);
  assert.doesNotMatch(old.json, /\[\[img/);
});

test("multiPairs: '이름 n · …' 다인원 칸을 읽고, 숫자만 있는 값(60/100)은 인물로 보지 않는다", () => {
  assert.deepEqual(multiPairs("이화 5 · 설련 0"), [
    ["이화", 5],
    ["설련", 0]
  ]);
  assert.deepEqual(multiPairs({ 이화: 5, 설련: "7" }), [
    ["이화", 5],
    ["설련", 7]
  ]);
  assert.deepEqual(multiPairs("60/100"), []);
  assert.deepEqual(multiPairs(42), []);
});

test("parseState: 다인원 칸은 빠진 인물을 직전 값으로 채우고 한 턴 -10~+8로 묶는다", () => {
  const before = { "📍 장소": "황후궁", "❤️ 호감도": "이화 50 · 설련 40", "💭 속마음": "" };
  const out = parseState(`본문\n${MARK}\n{"status":{"❤️ 호감도":"이화 70"},"suggestions":["1. 하나","2) 둘","셋","넷"]}`, CHAR, before);
  assert.equal(out.status["❤️ 호감도"], "이화 58 · 설련 40");
  assert.equal(out.status["📍 장소"], "황후궁", "빈 값은 직전 값을 덮지 않음");
  assert.deepEqual(out.suggestions, ["하나", "둘", "셋"], "앞 번호를 빼고 3개까지");
});
test("multiMax: 다인원 칸 한도는 작품의 인물 수(다른 모습 빼고) — 적어도 12, 많아야 30", () => {
  const cast = (n) => Array.from({ length: n }, (_, i) => ({ code: "P" + i, name: "인물" + i }));
  assert.equal(multiMax({}), 12, "인물 칸이 없으면 예전 한도");
  assert.equal(multiMax({ cast: cast(5) }), 12, "인물이 적은 작품도 새로 나온 사람을 12명까지");
  assert.equal(multiMax({ cast: [...cast(22), { code: "F", name: "폼", of: "P0" }] }), 22, "다른 모습은 세지 않음");
  assert.equal(multiMax({ cast: cast(40) }), 30);
});
test("parseState: 인물이 스물인 작품 — 처음 채울 때 200자에서 자르지 않고, 합칠 때 12명에서 끊지 않는다", () => {
  const names = [..."가나다라마바사아자차카타파하거너더러머버"].map((x) => "세레나 바이스" + x),
    c = { ...CHAR, cast: names.map((name, i) => ({ code: "H" + i, name })) },
    line = (n) =>
      names
        .slice(0, n)
        .map((k) => `${k} 10`)
        .join(" · ");
  const first = parseState(`x\n${MARK}\n{"status":{"❤️ 호감도":"${line(20)}"}}`, c, { "❤️ 호감도": "없음" }).status["❤️ 호감도"];
  assert.ok(line(20).length > 200, "시험 값이 예전 200자 한도를 넘어야 뜻이 있음");
  assert.equal(first, line(20));
  const merged = parseState(`x\n${MARK}\n{"status":{"❤️ 호감도":"${line(20)}"}}`, c, { "❤️ 호감도": line(2) }).status["❤️ 호감도"];
  assert.equal(merged, line(20), "새 인물이 뒤에 붙어 스물 모두");
  const small = { ...CHAR, cast: c.cast.slice(0, 2) };
  const few = parseState(`x\n${MARK}\n{"status":{"❤️ 호감도":"${line(20)}"}}`, small, { "❤️ 호감도": line(2) }).status["❤️ 호감도"];
  assert.equal(few, line(12), "인물이 적은 작품은 예전처럼 12명까지");
});
test("castMulti: 이름의 절반 넘게가 출연진 이름인 칸만 인물 수치 칸 — 줄인 이름('레나')도 셈", () => {
  const c = {
    cast: [
      { code: "HR", name: "홍레나" },
      { code: "IH", name: "이화" },
      { code: "SB", name: "세레나 바이스" }
    ]
  };
  assert.equal(castMulti("레나 5 · 이화 3", c), true);
  assert.equal(castMulti("세레나 바이스 5 · 낯선이 3 · 이화 1", c), true, "새로 나온 사람이 섞여도 절반 넘게면");
  assert.equal(castMulti("이화 5 · 낯선이 3", c), false, "절반은 넘어야 함");
  assert.equal(castMulti("체력 1 · 근력 1", c), false);
  assert.equal(castMulti("이화 5", c), false, "한 사람뿐이면 다인원이 아님");
});
test("parseState: 사람 이름이 아닌 '이름 숫자' 칸(💰 자원·📖 명부·신님들 스탯)은 합치지 않고 AI가 쓴 그대로 — 세계관 평가 2026-11-26", () => {
  const w = {
    fields: ["💰 자원", "📖 명부", "스탯", "❤️ 호감도"],
    gauge: "HP",
    cast: ["메아르", "미록", "도람", "세오", "한서윤", "도하린"].map((name, i) => ({ code: "P" + i, name }))
  };
  const res = "골드 1400 · 소환권 1 · 교본 2 · 승급석 1",
    roster = "대기 메아르★4 Lv39 · 미록★4 Lv36 · 도람★3 Lv30 · 세오★3 Lv30",
    stat = "체력 2 · 근력 1 · 민첩 2 · 마력 1 · 매력 2 · SP 0";
  const before = {
    "💰 자원": "골드 1200 · 소환권 1 · 교본 2 · 승급석 0",
    "📖 명부": "대기 메아르★4 Lv39 · 미록★4 Lv36 · 원정 도람★3 · 세오★3",
    스탯: "체력 1 · 근력 1 · 민첩 1 · 마력 1 · 매력 1 · SP 3",
    "❤️ 호감도": "한서윤 40 · 도하린 30"
  };
  const reply = (st) => `x\n${MARK}\n${JSON.stringify({ status: st })}`;
  const out = parseState(reply({ "💰 자원": res, "📖 명부": roster, 스탯: stat, "❤️ 호감도": "한서윤 90" }), w, before).status;
  assert.equal(out["💰 자원"], res, "골드가 0~100에 묶이지 않음(예전엔 '골드 100')");
  assert.equal(out["📖 명부"], roster, "명부 항목이 겹쳐 늘어나지 않음");
  assert.equal(out["스탯"], stat, "레벨업에 맞춘 스탯이 그대로");
  assert.equal(out["❤️ 호감도"], "한서윤 48 · 도하린 30", "인물 칸은 그대로 합침");
  const first = parseState(reply({ "📖 명부": roster }), w, {}).status["📖 명부"];
  assert.equal(first, roster, "처음 채울 때도 '메아르★ 4'처럼 띄어 고치지 않음");
});
test("castField: 칸은 작품의 시작 값으로 가림 — 새로 나온 사람이 쌓여도 호감도는 계속 합치고, 이름만 남은 명부는 합치지 않음(Codex 검토)", () => {
  const w = {
    fields: ["❤️ 호감도", "📖 명부"],
    gauge: "HP",
    cast: ["이화", "설련", "메아르", "미록"].map((name, i) => ({ code: "P" + i, name })),
    openings: [{ status: { "❤️ 호감도": "이화 50 · 설련 40", "📖 명부": "대기 메아르★4 Lv39 · 미록★4 Lv36" } }]
  };
  const reply = (st) => `x\n${MARK}\n${JSON.stringify({ status: st })}`;
  const crowd = "이화 50 · 설련 40 · 낯선이 10 · 길손 5"; // 출연진이 꼭 절반 — 이름만 보면 인물 칸이 아님
  assert.equal(castMulti(crowd, w), false);
  assert.equal(castField(w, "❤️ 호감도", crowd), true);
  const st = parseState(reply({ "❤️ 호감도": "이화 150", "📖 명부": "메아르 60 · 미록 36" }), w, {
    "❤️ 호감도": crowd,
    "📖 명부": "메아르 39 · 미록 36"
  }).status;
  assert.equal(st["❤️ 호감도"], "이화 58 · 설련 40 · 낯선이 10 · 길손 5", "빠진 사람은 직전 값, 한 턴 +8까지");
  assert.equal(st["📖 명부"], "메아르 60 · 미록 36", "이름이 출연진이어도 시작 값이 명부면 레벨을 묶지 않음");
  const first = parseState(reply({ "❤️ 호감도": "이화 150 · 설련 -20" }), w, {}).status["❤️ 호감도"];
  assert.equal(first, "이화 100 · 설련 0", "처음 채울 때도 0~100");
});
test("castField: 실제 작품의 시작 상태창 — 신님들 스탯은 인물 칸이 아니고, ❤️ 호감도는 어느 작품·시작 상황이든 인물 칸", () => {
  const gs = ORIGINALS.find((x) => x.id === "godseats");
  const starts = (c) => [c.status, ...(c.openings || []).map((o) => o.status)].filter(Boolean);
  assert.ok(starts(gs).every((st) => !castField(gs, "스탯", st["스탯"])));
  for (const c of ORIGINALS)
    for (const st of starts(c))
      if (multiPairs(st["❤️ 호감도"]).length >= 2) assert.ok(castField(c, "❤️ 호감도", st["❤️ 호감도"]), `${c.id}: ${st["❤️ 호감도"]}`);
});
test("parseState: 숫자 게이지는 직전 값에서 -10~+8, 0~100 안에서만 움직인다", () => {
  const c = { fields: ["호감도"], gauge: "호감도" };
  assert.equal(parseState(`x\n${MARK}\n{"status":{"호감도":100}}`, c, { 호감도: 50 }).status["호감도"], 58);
  assert.equal(parseState(`x\n${MARK}\n{"status":{"호감도":0}}`, c, { 호감도: 5 }).status["호감도"], 0);
  assert.equal(parseState(`x\n${MARK}\n{"status":{"호감도":"글자"}}`, c, { 호감도: 50 }).status["호감도"], 50, "숫자가 아니면 그대로");
});
test("parseState: 토큰 한도로 끊긴 JSON도 닫아서 읽는다", () => {
  const out = parseState(`x\n${MARK}\n{"status": {"📍 장소": "마탑", "💭 속마음": "이 차를 몇 번`, CHAR, {});
  assert.equal(out.status["📍 장소"], "마탑");
});
test("parseState: 상태 JSON이 없으면 직전 상태를 그대로 돌려준다", () => {
  assert.deepEqual(parseState("본문만", CHAR, { "📍 장소": "궁" }), { status: { "📍 장소": "궁" }, suggestions: [] });
});

test("dropEcho: 본문 첫 줄이 유저 입력을 옮겨 적은 것이면 뺀다", () => {
  const said = "나는 조용히 창가로 걸어가 커튼을 걷었다";
  assert.equal(dropEcho(`*나는 조용히 창가로 걸어가 커튼을 걷었다.*\n\n카시안: "일어났군."`, said), `카시안: "일어났군."`);
  assert.equal(dropEcho(`*문이 열리고 황제가 들어왔다.*\n\n카시안: "일어났군."`, said).startsWith("*문이"), true);
});

test("looseJSON: 앞뒤 군말이 붙은 JSON도 읽는다", () => {
  assert.deepEqual(looseJSON('여기 결과: {"a": 1} 끝'), { a: 1 });
  assert.equal(looseJSON("json 아님"), undefined);
});
test("parseState: 빈칸뿐인 추천은 추천이 아님 — 걸러 내고(값을 낸 턴이면 되돌리는 근거), 남은 것은 앞뒤 빈칸을 뗌", () => {
  const out = parseState(`본문\n${MARK}\n{"status":{},"suggestions":["   ","","  다가간다  "]}`, CHAR, {});
  assert.deepEqual(out.suggestions, ["다가간다"]);
  assert.deepEqual(parseState(`본문\n${MARK}\n{"status":{},"suggestions":[" ","1. "]}`, CHAR, {}).suggestions, []);
});
