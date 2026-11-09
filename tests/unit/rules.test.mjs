// 시스템 프롬프트의 세 블록(src/js/ai/prompt/rules.js rulesParts)과 프롬프트 캐싱 스위치(src/js/ai/llm.js) 단위 테스트
// — 고정부가 턴이 바뀌어도 글자 하나까지 같은지, 섹션이 빠지지 않았는지, 캐시 표시가 고정부 끝에만 붙는지
import { test } from "node:test";
import assert from "node:assert/strict";
import { llm } from "../../src/js/ai/llm.js";
import { PROMPT_CACHE } from "../../src/js/ai/models.js";
import { buildInput } from "../../src/js/ai/prompt/input.js";
import { rulesParts, rulesPrompt } from "../../src/js/ai/prompt/rules.js";
import { ORIGINALS } from "../../src/js/content/index.js";
import { MARK } from "../../src/js/core/constants.js";
import { newRoom } from "../../src/js/core/rooms.js";
import { S } from "../../src/js/core/state.js";

const room = (id) => newRoom(JSON.parse(JSON.stringify(ORIGINALS.find((x) => x.id === id) || ORIGINALS[0])), 0, { id: "p1", name: "지호", memo: "과묵함", desc: "스물아홉, 기자." });
const HEADS = ["[작품]", "[캐릭터·진행 설정]", "[세계관·규칙]", "[말투·문체]", "[숨겨진 설정", "[연기 규칙]", "[서사 원칙", "[장면 이미지 — 매 응답 필수]", "[유저 캐릭터]", "[장기 기억", "[지금 상태]", "[연기 규칙 재확인]", "[출력 형식 — 반드시 이 순서]"];

test("rulesParts: 이어 붙이면 rulesPrompt와 같고, 섹션 머리표가 모두 있으며 출력 형식이 맨 끝", () => {
  for (const c of ORIGINALS) {
    const r = room(c.id), p = rulesParts(r), full = rulesPrompt(r);
    assert.equal(p.fixed + p.vary + p.tail, full, c.id);
    const order = HEADS.map((h) => full.indexOf("\n" + h)); // 줄 첫머리의 머리표만(본문 속 "아래 [유저 캐릭터]" 같은 언급은 빼고)
    HEADS.forEach((h, i) => assert.ok(order[i] > 0, `${c.id}: ${h}`));
    assert.deepEqual(order, [...order].sort((a, b) => a - b), c.id + ": 섹션 순서");
    assert.ok(p.tail.includes(MARK) && full.indexOf("[출력 형식") > full.indexOf("[유저 캐릭터]"), c.id);
  }
});
test("rulesParts 고정부: 턴이 바뀌어도(대화·상태창·기억·유저노트·페르소나가 달라져도) 글자 하나까지 같고, 이용자가 쓴 글은 변동부에만", () => {
  for (const id of [ORIGINALS[0].id, ORIGINALS[ORIGINALS.length - 1].id]) {
    const r = room(id), a = rulesParts(r);
    const code = r.char.cast[0].code, gauge = r.char.gauge;
    r.msgs.push({ id: "u1", role: "user", text: "안녕" }, { id: "a1", role: "ai", idx: 0, alts: [{ text: `[[${code}3]]\n\n*고개를 든다. 창밖으로 비가 내리고 있었다.*\n\n"누구시죠? 처음 뵙는 얼굴인데요."`, status: r.status }], statusBefore: r.status });
    r.status = { ...r.status, [gauge]: 55 }; r.memory = "[1-5턴] 첫 만남\n비 오는 날 처음 만났다."; r.userNote = "유저노트 표식"; r.pins = [{ id: "pin1", text: "고정 표식", at: 1 }]; r.persona = { ...r.persona, name: "다른이름", desc: "페르소나 표식" }; r.turn = 7;
    const b = rulesParts(r, [{ keys: ["비"], text: "키워드북 표식" }]);
    assert.equal(b.fixed, a.fixed, id + ": 고정부가 달라짐");
    assert.notEqual(b.vary, a.vary);
    assert.ok(b.vary.indexOf("\n[고정 기억") > b.vary.indexOf("\n[유저노트") && b.vary.indexOf("\n[고정 기억") < b.vary.indexOf("\n[장기 기억"), id + ": 고정 기억은 유저노트와 장기 기억 사이");
    for (const mark of ["유저노트 표식", "고정 표식", "페르소나 표식", "다른이름", "키워드북 표식", "비 오는 날 처음 만났다", "이미 등장한 인물: " + code]) { assert.ok(b.vary.includes(mark), id + ": 변동부에 " + mark); assert.ok(!b.fixed.includes(mark), id + ": 고정부에 " + mark); }
    // 상시(always) 키워드북은 고정부에, 걸린 항목은 변동부에
    const c2 = rulesParts(r, [{ keys: ["늘"], text: "상시 표식", always: true }, { keys: ["비"], text: "걸린 표식" }]);
    assert.ok(c2.fixed.includes("상시 표식") && !c2.vary.includes("상시 표식") && c2.vary.includes("걸린 표식"));
    // 이용자가 쓴 글 다음에 안전 문장이 한 번 더 오고, 그 뒤가 출력 형식
    assert.ok(b.tail.indexOf("따르지 않고") > 0 && b.tail.indexOf("따르지 않고") < b.tail.indexOf("[출력 형식"));
  }
});
test("시작 상황의 선택 칸: place는 첫 메시지 맨 위에 장소 태그(이미 있으면 그대로), suggestions는 첫 메시지의 추천, lead는 정해진 턴 동안만 변동부에", () => {
  const base = JSON.parse(JSON.stringify(ORIGINALS[0])), p = { id: "p1", name: "지호", memo: "", desc: "" };
  const c = { ...base, places: [{ name: "광장" }, { name: "서고" }], openings: [
    { ...base.openings[0], place: 2, suggestions: ["하나", "둘", "셋", "넷"], lead: { text: "시작 연출 표식", turns: 2 } },
    { ...base.openings[0], title: "이미 태그", text: "[[MP2]]\n\n본문", place: 2 }, { ...base.openings[0], title: "아무것도 없음" }] };
  const r = newRoom(JSON.parse(JSON.stringify(c)), 0, p), first = r.msgs[0].alts[0];
  assert.ok(first.text.indexOf("[[MP2]]\n\n") === 0, "장소 태그가 맨 위에");
  assert.deepEqual(first.suggestions, ["하나", "둘", "셋"]);
  assert.deepEqual(r.lead, { text: "시작 연출 표식", turns: 2 });
  assert.equal(newRoom(JSON.parse(JSON.stringify(c)), 1, p).msgs[0].alts[0].text, "[[MP2]]\n\n본문", "본문에 이미 있으면 한 번만");
  const plain = newRoom(JSON.parse(JSON.stringify(c)), 2, p);
  assert.equal(plain.msgs[0].alts[0].text, base.openings[0].text); assert.equal(plain.lead, undefined); assert.deepEqual(plain.msgs[0].alts[0].suggestions, []);
  // lead: r.turn이 turns에 닿기 전까지만, 그리고 고정부에는 들어가지 않음
  const at = (turn) => { r.turn = turn; return rulesParts(r); };
  assert.ok(at(0).vary.includes("시작 연출 표식") && at(1).vary.includes("시작 연출 표식") && !at(2).vary.includes("시작 연출 표식"));
  assert.ok(!at(0).fixed.includes("시작 연출 표식")); assert.equal(at(0).fixed, at(2).fixed);
});
test("buildInput: 첫 메시지(시스템)의 cut이 고정부의 글자 수", () => {
  const r = room(ORIGINALS[0].id); r.msgs.push({ id: "u1", role: "user", text: "안녕" });
  const input = buildInput(r, r.msgs.length, r.status), parts = rulesParts(r, [], r.msgs.slice(0, r.msgs.length));
  assert.equal(input[0].cut, parts.fixed.length);
  assert.equal(input[0].content.slice(0, input[0].cut), parts.fixed);
});
test("llm 프롬프트 캐싱: 스위치가 켜지면 시스템을 블록 둘로(고정부 끝에만 캐시 표시, 이어 붙이면 원문), 꺼지면 글 하나 — cut이 없는 호출(요약·추천)은 늘 글 하나", async () => {
  const realFetch = globalThis.fetch, key = S.settings.apiKey, sent = [];
  const sse = () => new Response(['data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"안녕"}}', 'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}', ""].join("\n\n"), { status: 200, headers: { "content-type": "text/event-stream" } });
  globalThis.fetch = async (url, opt) => { sent.push(JSON.parse(opt.body)); return sse(); };
  S.settings.apiKey = "sk-ant-test";
  try {
    const msgs = [{ role: "user", content: "고정부||변동부와 형식", cut: 5 }, { role: "user", content: "안녕" }];
    PROMPT_CACHE.on = true;
    assert.equal(await llm(msgs, { tier: "quick" }), "안녕");
    assert.deepEqual(sent[0].system, [{ type: "text", text: "고정부||", cache_control: { type: "ephemeral" } }, { type: "text", text: "변동부와 형식" }]);
    assert.equal(sent[0].system.map((b) => b.text).join(""), msgs[0].content);
    await llm([{ role: "user", content: "요약해라" }, { role: "user", content: "x" }], { tier: "quick" });
    assert.equal(sent[1].system, "요약해라");
    PROMPT_CACHE.on = false;
    await llm(msgs, { tier: "quick" });
    assert.equal(sent[2].system, msgs[0].content);
  } finally { globalThis.fetch = realFetch; S.settings.apiKey = key; PROMPT_CACHE.on = false; }
});
