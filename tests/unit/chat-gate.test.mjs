// 대화 관문 Edge Function(docs/edge/chat.ts) 단위 테스트 — 진짜 함수 코드에 가짜 인증 서버·표·모델 서버를 끼움(tests/unit/_idv-fake.mjs)
import { test } from "node:test";
import assert from "node:assert/strict";
import { A, B, SB_URL, fakeWorld, loadEdge } from "./_idv-fake.mjs";
import { messagesMinorHint } from "../../src/js/core/safety.js";
const { handle } = await loadEdge("chat");

const NOW = new Date("2026-11-09T03:00:00Z");
const MODELS = { adult: { quick: "vendor/small", default: "vendor/mid", complex: "vendor/big" } };
const ENV = { OPENROUTER_API_KEY: "or-key-fake", CHAT_MODELS: JSON.stringify(MODELS) };
const MSGS = [{ role: "system", content: "서윤(25, 여). 카페 주인." }, { role: "user", content: "안녕" }];
const world = (env = {}) => fakeWorld({ ...ENV, ...env });
const adult = (w, over = {}) => w.add({ id: "hs" + "a".repeat(32), user_id: A, checked_at: "2026-11-01T00:00:00Z", adult: true, test: false, expires_at: "2027-11-01T00:00:00Z", ...over });
const call = async (w, body = {}, { tok = "tokA", method = "POST", screen = messagesMinorHint } = {}) => {
  const req = new Request(SB_URL + "/functions/v1/chat", { method, headers: { "content-type": "application/json", ...(tok ? { authorization: "Bearer " + tok } : {}) },
    ...(method === "POST" ? { body: JSON.stringify({ track: "adult", tier: "default", max_tokens: 3200, messages: MSGS, ...body }) } : {}) });
  const r = await handle(req, w.env, w.fetch, () => NOW, screen);
  const type = r.headers.get("content-type") || "";
  return { status: r.status, type, body: type.includes("json") ? await r.json().catch(() => null) : await r.text(), headers: r.headers };
};

test("통과: 성인 인증된 계정의 성인 트랙 요청을 모델 서버로 중계", async () => {
  const w = world({ CHAT_PREAMBLE_ADULT: "[운영자 머리말]" }); adult(w);
  const r = await call(w);
  assert.equal(r.status, 200);
  assert.match(r.type, /text\/event-stream/);
  assert.match(r.body, /"content":"안녕"/); // 모델의 스트림을 그대로
  const [m] = w.modelCalls(), sent = JSON.parse(m.body);
  assert.equal(w.modelCalls().length, 1);
  assert.equal(m.headers.authorization, "Bearer or-key-fake"); // 회사 키로 — 사용자 토큰은 모델 쪽으로 가지 않음
  assert.equal(sent.model, "vendor/mid");
  assert.equal(sent.stream, true);
  assert.equal(sent.max_tokens, 3200);
  assert.deepEqual(sent.provider, { data_collection: "deny" });
  assert.deepEqual(sent.reasoning, { effort: "low" }); // 생각을 낮게(끌 수 없는 모델이 있어 끄지 않음)
  assert.equal(sent.messages[0].content, "[운영자 머리말]\n\n" + MSGS[0].content); // 머리말은 시스템 글 맨 앞
  assert.deepEqual(sent.messages.slice(1), MSGS.slice(1));
  assert.ok(!JSON.stringify(sent).includes(A) && !m.body.includes("tokA"), "계정 id·토큰을 모델 쪽으로 보내지 않음");
  assert.equal(w.usage[A + "/adult"], 1);
});

test("등급마다 서버 설정의 모델, 출력 한도는 256~8000으로", async () => {
  const w = world(); adult(w);
  await call(w, { tier: "quick", max_tokens: 5 });
  await call(w, { tier: "complex", max_tokens: 999999 });
  const sent = w.modelCalls().map((c) => JSON.parse(c.body));
  assert.deepEqual(sent.map((s) => [s.model, s.max_tokens]), [["vendor/small", 256], ["vendor/big", 8000]]);
});

test("모델마다 생각 설정: CHAT_MODELS의 값이 { model, reasoning }이면 그 설정, 이름만이면 기본", async () => {
  const w = world({ CHAT_MODELS: JSON.stringify({ adult: { quick: { model: "vendor/a", reasoning: { enabled: false } }, default: { model: "vendor/b" }, complex: { reasoning: { effort: "high" } } } }) }); adult(w);
  await call(w, { tier: "quick" }); await call(w, { tier: "default" });
  assert.deepEqual(w.modelCalls().map((c) => JSON.parse(c.body)).map((s) => [s.model, s.reasoning]), [["vendor/a", { enabled: false }], ["vendor/b", { effort: "low" }]]);
  assert.deepEqual((await call(w, { tier: "complex" })).body, { code: "not_configured" }); // 모델 이름이 없는 칸
});

test("로그인 없이·모르는 토큰은 login", async () => {
  const w = world(); adult(w);
  assert.deepEqual([(await call(w, {}, { tok: "" })).body, (await call(w, {}, { tok: "nope" })).body], [{ code: "login" }, { code: "login" }]);
  assert.equal(w.modelCalls().length, 0);
});

test("성인 인증: 없음·미성년 판정·만료·남의 인증·시험 채널은 adult_required", async () => {
  const cases = [null, { adult: false, expires_at: null }, { expires_at: "2026-11-08T00:00:00Z" }, { user_id: B }, { test: true }];
  for (const over of cases) {
    const w = world(); if (over) adult(w, over);
    const r = await call(w);
    assert.deepEqual([r.status, r.body], [403, { code: "adult_required" }], JSON.stringify(over));
    assert.equal(w.modelCalls().length, 0);
  }
  // 시험 채널은 서버 설정으로 켰을 때만 인정
  const w = world({ CHAT_ALLOW_TEST_IDV: "1" }); adult(w, { test: true });
  assert.equal((await call(w)).status, 200);
  // 만료된 옛 인증 뒤에 새 인증이 있으면 통과
  const w2 = world(); adult(w2, { expires_at: "2026-01-01T00:00:00Z", checked_at: "2025-01-01T00:00:00Z" }); adult(w2, { id: "hs" + "b".repeat(32) });
  assert.equal((await call(w2)).status, 200);
});

test("미성년 암시가 있으면 minor_blocked — 모델을 부르지 않고 한도도 세지 않음", async () => {
  const w = world(); adult(w);
  for (const messages of [
    [MSGS[0], { role: "user", content: "걔는 열일곱 살이야" }],
    [MSGS[0], { role: "user", content: "안녕" }, { role: "assistant", content: "*교복 차림의 소녀가 들어왔다.*" }, { role: "user", content: "인사해" }],
    [{ role: "system", content: "서윤. 실은 고등학교 2학년이다." }, MSGS[1]]
  ]) assert.deepEqual((await call(w, { messages })).body, { code: "minor_blocked" });
  assert.equal(w.modelCalls().length, 0);
  assert.equal(w.usage[A + "/adult"], undefined);
  // 판정 함수를 끼우지 않았거나 판정이 오류를 내면 막는 쪽
  const noScreen = await handle(new Request(SB_URL + "/functions/v1/chat", { method: "POST", headers: { authorization: "Bearer tokA" }, body: JSON.stringify({ track: "adult", tier: "default", messages: MSGS }) }), w.env, w.fetch, () => NOW);
  assert.deepEqual(await noScreen.json(), { code: "minor_blocked" });
  assert.deepEqual((await call(w, {}, { screen: () => { throw new Error("x"); } })).body, { code: "minor_blocked" });
  assert.equal(w.modelCalls().length, 0);
});

test("요청 모양: 모르는 트랙·등급·잘못된 메시지는 bad_request", async () => {
  const w = world(); adult(w);
  const bad = [{ track: "other" }, { track: undefined }, { tier: "ultra" }, { messages: [] }, { messages: [MSGS[1]] }, { messages: [MSGS[1], MSGS[0]] },
    { messages: [MSGS[0], { role: "tool", content: "x" }] }, { messages: [MSGS[0], { role: "user", content: 1 }] }, { messages: [MSGS[0], { role: "system", content: "또" }] },
    { messages: [MSGS[0], { role: "user", content: "가".repeat(600001) }] }];
  for (const b of bad) assert.deepEqual((await call(w, b)).body, { code: "bad_request" }, JSON.stringify(b).slice(0, 80));
  assert.equal((await call(w, {}, { method: "GET" })).status, 405);
  assert.equal((await call(w, {}, { method: "OPTIONS" })).headers.get("access-control-allow-origin"), "*");
  assert.equal(w.modelCalls().length, 0);
});

/* 일반 트랙의 무료 길: 성인 인증·미성년 판정 없이 로그인과 하루 한도만 — 회사 키의 Claude로, 서버 설정에 있는 등급만 */
const FREE = { ANTHROPIC_API_KEY: "ant-key-fake", CHAT_MODELS: JSON.stringify({ general: { quick: "claude-haiku-5-5" }, adult: MODELS.adult }) };
test("일반 무료 길: 성인 인증 없는 계정도 통과 — Anthropic으로, 머리말·생각 설정 없이", async () => {
  const w = world({ ...FREE, CHAT_PREAMBLE_ADULT: "[운영자 머리말]" }); // 성인 인증 행 없음
  const msgs = [MSGS[0], { role: "user", content: "중학생 때 얘기 좀 해 줘" }]; // 성인 트랙이면 막힐 말 — 일반 트랙은 판정하지 않음
  const r = await call(w, { track: "general", tier: "quick", messages: msgs });
  assert.equal(r.status, 200);
  assert.match(r.body, /"text":"안녕"/); // Anthropic 스트림을 그대로
  const [c] = w.claudeCalls(), sent = JSON.parse(c.body);
  assert.equal(w.claudeCalls().length, 1); assert.equal(w.modelCalls().length, 0); // 외부 모델 쪽으로는 가지 않음
  assert.equal(c.headers["x-api-key"], "ant-key-fake");
  assert.deepEqual(sent, { model: "claude-haiku-5-5", max_tokens: 3200, stream: true, system: MSGS[0].content, messages: [msgs[1]] });
  assert.ok(!c.body.includes(A) && !c.body.includes("tokA") && !c.body.includes("머리말"));
  assert.equal(w.usage[A + "/general"], 1); assert.equal(w.usage[A + "/adult"], undefined);
});
test("일반 무료 길: 서버에 없는 등급은 need_key, 길을 켜지 않았으면 not_configured, 한도는 성인 트랙과 따로", async () => {
  const w = world({ ...FREE, CHAT_FREE_DAILY_LIMIT: "2" }); adult(w);
  assert.deepEqual([(await call(w, { track: "general", tier: "default" })).status, (await call(w, { track: "general", tier: "default" })).body], [403, { code: "need_key" }]);
  assert.equal(w.claudeCalls().length, 0); assert.equal(w.usage[A + "/general"], undefined); // 막힌 요청은 세지 않음
  assert.deepEqual([(await call(w, { track: "general", tier: "quick" })).status, (await call(w, { track: "general", tier: "quick" })).status], [200, 200]);
  assert.deepEqual((await call(w, { track: "general", tier: "quick" })).body, { code: "too_many" });
  assert.equal((await call(w)).status, 200); // 성인 트랙의 한도는 따로
  assert.equal(w.modelCalls().length, 1); assert.equal(w.claudeCalls().length, 2);
  for (const env of [{}, { CHAT_MODELS: FREE.CHAT_MODELS }, { ANTHROPIC_API_KEY: "ant-key-fake" }]) { // 키만·표만 있거나 둘 다 없음(성인 트랙만 켠 서버)
    const w2 = world(env);
    assert.deepEqual((await call(w2, { track: "general", tier: "quick" })).body, { code: "not_configured" }, JSON.stringify(Object.keys(env)));
    assert.equal(w2.claudeCalls().length, 0);
  }
  assert.deepEqual((await call(world(FREE), { track: "general", tier: "quick" }, { tok: "" })).body, { code: "login" });
});

test("하루 한도를 넘으면 too_many, 한도 함수가 없으면 no_table", async () => {
  const w = world({ CHAT_DAILY_LIMIT: "2" }); adult(w);
  assert.deepEqual([(await call(w)).status, (await call(w)).status], [200, 200]);
  assert.deepEqual((await call(w)).body, { code: "too_many" });
  assert.equal(w.modelCalls().length, 2);
  const w2 = world(); adult(w2); w2.noUsage = true;
  assert.deepEqual((await call(w2)).body, { code: "no_table" });
  assert.equal(w2.modelCalls().length, 0);
});

test("설정이 빠졌으면 not_configured", async () => {
  for (const env of [{ OPENROUTER_API_KEY: "" }, { CHAT_MODELS: "" }, { CHAT_MODELS: "{" }, { CHAT_MODELS: JSON.stringify({ adult: { quick: "vendor/small" } }) }]) {
    const w = world(env); adult(w);
    assert.deepEqual((await call(w)).body, { code: "not_configured" }, JSON.stringify(env));
    assert.equal(w.modelCalls().length, 0);
  }
});

test("모델 서버 오류: 429 rate_limited · 키·모델 문제 not_configured · 그 밖 upstream", async () => {
  const w = world(); adult(w);
  const codes = [];
  for (const up of [{ status: 429 }, { status: 401 }, { status: 404 }, { status: 500 }, { throws: true }]) { w.upstream = up; codes.push((await call(w)).body.code); }
  assert.deepEqual(codes, ["rate_limited", "not_configured", "not_configured", "upstream", "upstream"]);
});
