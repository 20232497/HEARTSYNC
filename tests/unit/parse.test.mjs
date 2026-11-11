// 응답 파싱(src/js/ai/parse.js) 단위 테스트 — npm test (node --test가 **/*.test.mjs를 찾음)
// 모듈을 Node에서 바로 import한다(브라우저 없이). 요청·응답 형식(MARK·status JSON)은 docs/app/prompt.md '응답 형식'
import { test } from "node:test";
import assert from "node:assert/strict";
import { splitReply, multiPairs, parseState, dropEcho, looseJSON } from "../../src/js/ai/parse.js";
import { MARK } from "../../src/js/core/constants.js";

const CHAR = { fields: ["📍 장소", "❤️ 호감도", "💭 속마음"], gauge: "❤️ 호감도" };

test("splitReply: 구분자로 본문과 상태 JSON을 나눈다", () => {
  const r = splitReply(`본문 한 줄\n${MARK}\n{"status":{"📍 장소":"궁"}}`);
  assert.equal(r.body, "본문 한 줄\n");
  assert.deepEqual(JSON.parse(r.json), { status: { "📍 장소": "궁" } });
});
test("splitReply: 변형 구분자(== STATE ==)와 구분자 없는 {\"status\"…}도 찾는다", () => {
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
  assert.deepEqual(multiPairs("이화 5 · 설련 0"), [["이화", 5], ["설련", 0]]);
  assert.deepEqual(multiPairs({ 이화: 5, 설련: "7" }), [["이화", 5], ["설련", 7]]);
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
