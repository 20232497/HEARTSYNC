// AI 응답 스트림 읽기(src/js/ai/stream.js)와 트랙 고르기(src/js/ai/models.js trackOf)
import { test } from "node:test";
import assert from "node:assert/strict";
import { trackOf } from "../../src/js/ai/models.js";
import { anthropicEvent, openaiEvent, readSSE } from "../../src/js/ai/stream.js";

const stream = (chunks) => new ReadableStream({ start(c) { const e = new TextEncoder(); chunks.forEach((x) => c.enqueue(typeof x === "string" ? e.encode(x) : x)); c.close(); } });

test("readSSE: 줄이 조각 사이에서 끊겨도 data 줄마다 한 번, 깨진 줄·[DONE]·onData 오류는 넘어감, 주석 줄은 시간 제한을 되돌리지 않음", async () => {
  const got = []; let ticks = 0;
  const han = new TextEncoder().encode('data: {"t":"한글"}\n'); // 한글 글자 중간에서 끊긴 조각
  await readSSE(stream(['event: x\ndata: {"t":1}\n\ndata: {"t"', ':2}\r\n', "data: {broken\n", "data: [DONE]\n", han.slice(0, 12), han.slice(12), ': comment\ndata:{"t":3}\n']),
    (ev) => { got.push(ev.t); if (ev.t === 2) throw new Error("화면 오류"); }, () => ticks++);
  assert.deepEqual(got, [1, 2, "한글", 3]);
  assert.equal(ticks, 6); // data 줄 6개(깨진 줄·[DONE] 포함) — event·주석 줄은 세지 않음
  let alive = 0; await readSSE(stream([": OPENROUTER PROCESSING\n\n", ": OPENROUTER PROCESSING\n\n"]), () => {}, () => alive++);
  assert.equal(alive, 0);
});

test("anthropicEvent: 글 조각·끝난 이유·거절 분류", () => {
  assert.deepEqual(anthropicEvent({ type: "content_block_delta", delta: { type: "text_delta", text: "안" } }), { delta: "안" });
  assert.deepEqual(anthropicEvent({ type: "message_delta", delta: { stop_reason: "end_turn" } }), { stop: "end_turn", category: null });
  assert.deepEqual(anthropicEvent({ type: "message_delta", delta: { stop_reason: "refusal", stop_details: { category: "cyber" } } }), { stop: "refusal", category: "cyber" });
  assert.deepEqual(anthropicEvent({ type: "ping" }), {});
});

test("openaiEvent: 글 조각·끝·내용 필터는 거절·오류", () => {
  assert.deepEqual(openaiEvent({ choices: [{ delta: { content: "안" } }] }), { delta: "안" });
  assert.deepEqual(openaiEvent({ choices: [{ delta: { role: "assistant", content: "" } }] }), {});
  assert.deepEqual(openaiEvent({ choices: [{ delta: {}, finish_reason: "stop" }] }), { stop: "stop" });
  assert.deepEqual(openaiEvent({ choices: [{ delta: { content: "끝" }, finish_reason: "length" }] }), { delta: "끝", stop: "length" });
  assert.deepEqual(openaiEvent({ choices: [{ delta: {}, finish_reason: "content_filter" }] }), { stop: "refusal" });
  assert.deepEqual(openaiEvent({ error: { code: 502, message: "x" } }), { failed: true });
  assert.deepEqual(openaiEvent({ choices: [{ delta: {}, finish_reason: "error" }] }), { failed: true });
  assert.deepEqual(openaiEvent({ id: "x", usage: {} }), {});
});

test("trackOf: 작품 사본의 track이 adult일 때만 성인 트랙", () => {
  assert.equal(trackOf({ char: { track: "adult" } }), "adult");
  for (const r of [null, undefined, {}, { char: {} }, { char: { track: "general" } }, { char: { track: "ADULT" } }, { track: "adult", char: {} }]) assert.equal(trackOf(r), "general");
});
