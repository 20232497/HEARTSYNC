// AI 응답 스트림 읽기(src/js/ai/stream.js)와 트랙 고르기(src/js/ai/models.js trackOf)
import { test } from "node:test";
import assert from "node:assert/strict";
import { trackOf } from "../../src/js/ai/models.js";
import { anthropicEvent, openaiEvent, readSSE } from "../../src/js/ai/stream.js";

const stream = (chunks) =>
  new ReadableStream({
    start(c) {
      const e = new TextEncoder();
      chunks.forEach((x) => c.enqueue(typeof x === "string" ? e.encode(x) : x));
      c.close();
    }
  });

test("readSSE: 줄이 조각 사이에서 끊겨도 data 줄마다 한 번, 깨진 줄·[DONE]은 넘어감, 해석(onData)의 오류는 삼키지 않음, 주석 줄은 시간 제한을 되돌리지 않음", async () => {
  const got = [];
  let ticks = 0;
  const han = new TextEncoder().encode('data: {"t":"한글"}\n'); // 한글 글자 중간에서 끊긴 조각
  await readSSE(
    stream([
      'event: x\ndata: {"t":1}\n\ndata: {"t"',
      ":2}\r\n",
      "data: {broken\n",
      "data: [DONE]\n",
      han.slice(0, 12),
      han.slice(12),
      ': comment\ndata:{"t":3}\n'
    ]),
    (ev) => {
      got.push(ev.t);
    },
    () => ticks++
  );
  assert.deepEqual(got, [1, 2, "한글", 3]);
  assert.equal(ticks, 6); // data 줄 6개(깨진 줄·[DONE] 포함) — event·주석 줄은 세지 않음
  let alive = 0;
  await readSSE(
    stream([": OPENROUTER PROCESSING\n\n", ": OPENROUTER PROCESSING\n\n"]),
    () => {},
    () => alive++
  );
  assert.equal(alive, 0);
  // 해석에서 난 오류는 부른 쪽으로 — 조용히 빠진 조각이 완성된 답처럼 저장되지 않게(전에는 JSON 읽기와 한 try라 같이 삼켰음)
  const seen = [];
  await assert.rejects(
    readSSE(stream(['data: {"t":1}\ndata: {"t":2}\ndata: {"t":3}\n']), (ev) => {
      seen.push(ev.t);
      if (ev.t === 2) throw new Error("해석 오류");
    }),
    /해석 오류/
  );
  assert.deepEqual(seen, [1, 2]);
});
test("readSSE: 객체가 아닌 JSON 줄(null·숫자·글)은 넘어가고, 해석 오류로 나가면 스트림을 닫음(서버가 뒤에서 계속 보내지 않게)", async () => {
  const got = [];
  await readSSE(stream(['data: null\ndata: 3\ndata: "글"\ndata: {"t":1}\n']), (ev) => {
    got.push(anthropicEvent(ev)); // 전에는 null에서 ev.type이 던져 답 전체가 끊긴 답이 됐음
  });
  assert.deepEqual(got, [{}]);
  let cancelled = null;
  const open = new ReadableStream({
    start(c) {
      c.enqueue(new TextEncoder().encode('data: {"t":1}\n')); // 닫지 않음 — 서버가 아직 보내는 중
    },
    cancel(why) {
      cancelled = why === undefined ? "닫힘" : why;
    }
  });
  await assert.rejects(
    readSSE(open, () => {
      throw new Error("해석 오류");
    }),
    /해석 오류/
  );
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(cancelled, "닫힘");
  // 닫기 부름을 reader에서 직접 셈(이미 닫힌 스트림은 cancel을 불러도 소스의 cancel이 안 불려, 소스 쪽으로는 '안 불렀음'을 볼 수 없음 — Codex 검토)
  const spied = (body) => {
    const s = { cancels: 0 };
    s.body = {
      getReader() {
        const rd = body.getReader();
        return {
          read: () => rd.read(),
          cancel: (why) => {
            s.cancels++;
            return rd.cancel(why);
          }
        };
      }
    };
    return s;
  };
  const done = spied(stream(['data: {"t":1}\n']));
  await readSSE(done.body, () => {});
  assert.equal(done.cancels, 0, "끝까지 읽은 스트림은 닫기를 부르지 않음");
  const bad = spied(stream(['data: {"t":1}\n']));
  await assert.rejects(
    readSSE(bad.body, () => {
      throw new Error("해석 오류");
    }),
    /해석 오류/
  );
  assert.equal(bad.cancels, 1);
  // 사용자 취소(읽기가 AbortError로 끊김): 닫기를 부르되 그 실패가 원래 오류를 덮지 않음 — 부른 쪽(llm)은 abortCode로 cancelled를 고름
  const aborted = spied(
    new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode('data: {"t":1}\n'));
        setTimeout(() => c.error(Object.assign(new Error("멈춤"), { name: "AbortError" })), 0);
      }
    })
  );
  const seen = [];
  await assert.rejects(
    readSSE(aborted.body, (ev) => seen.push(ev.t)),
    (e) => e.name === "AbortError"
  );
  assert.deepEqual(seen, [1], "멈추기 전에 받은 조각은 그대로 넘겼음");
  assert.equal(aborted.cancels, 1);
});

test("anthropicEvent: 글 조각·끝난 이유·거절 분류", () => {
  assert.deepEqual(anthropicEvent({ type: "content_block_delta", delta: { type: "text_delta", text: "안" } }), { delta: "안" });
  assert.deepEqual(anthropicEvent({ type: "message_delta", delta: { stop_reason: "end_turn" } }), { stop: "end_turn", category: null });
  assert.deepEqual(anthropicEvent({ type: "message_delta", delta: { stop_reason: "refusal", stop_details: { category: "cyber" } } }), {
    stop: "refusal",
    category: "cyber"
  });
  assert.deepEqual(anthropicEvent({ type: "ping" }), {});
  assert.deepEqual(anthropicEvent({ type: "error", error: { type: "overloaded_error", message: "Overloaded" } }), { failed: true });
});

test("llm: 끝난 이유가 온 스트림만 답 — 중간의 오류 조각·끝난 이유 없이 닫힌 스트림은 upstream_error(받은 글은 text에)", async () => {
  const { llm } = await import("../../src/js/ai/llm.js");
  const { S } = await import("../../src/js/core/state.js");
  S.settings.apiKey = "sk-ant-test";
  const d = (o) => "data: " + JSON.stringify(o) + "\n\n",
    delta = (t) => d({ type: "content_block_delta", delta: { type: "text_delta", text: t } });
  let sent = null;
  const run = (body) => {
    globalThis.fetch = async (u, o) => {
      sent = JSON.parse(o.body);
      return new Response(stream([body]));
    };
    return llm(
      [
        { role: "system", content: "s" },
        { role: "user", content: "u" }
      ],
      { tier: "quick", maxTokens: 3200 }
    );
  };
  try {
    assert.equal(await run(delta("안녕") + d({ type: "message_delta", delta: { stop_reason: "end_turn" } })), "안녕");
    // 생각 토큰이 본문 몫을 먹지 않게: effort low + 출력 한도에 생각 몫(THINKING.room)
    const { THINKING } = await import("../../src/js/ai/llm.js");
    assert.deepEqual(sent.output_config, { effort: THINKING.effort });
    assert.equal(sent.max_tokens, 3200 + THINKING.room);
    await assert.rejects(
      run(delta("삼백… 년.") + d({ type: "error", error: { type: "overloaded_error" } })),
      (e) => e.code === "upstream_error" && e.text === "삼백… 년."
    );
    await assert.rejects(run(delta("*한 번")), (e) => e.code === "upstream_error" && e.text === "*한 번");
    // 객체가 아닌 data 줄(null)은 넘어가고 답은 그대로 끝남 — 전에는 해석기가 null에서 던져 답 전체가 끊긴 답이 됐음(해석 오류를 부른 쪽으로 던지는 것은 readSSE 시험)
    const end = d({ type: "message_delta", delta: { stop_reason: "end_turn" } });
    assert.equal(await run(delta("앞 글") + "data: null\n\n" + delta(" 뒤 글") + end), "앞 글 뒤 글");
    // 화면 갱신(onText)이 던져도 받은 글은 유지하고 끝까지 받음(오류는 콘솔에만)
    const keepErr = console.error;
    let logged = 0;
    console.error = () => logged++;
    try {
      globalThis.fetch = async () => new Response(stream([delta("하나") + delta(" 둘") + end]));
      const got = await llm([{ role: "user", content: "u" }], {
        tier: "quick",
        maxTokens: 100,
        onText: () => {
          throw new Error("화면 오류");
        }
      });
      assert.equal(got, "하나 둘");
      assert.equal(logged, 2);
    } finally {
      console.error = keepErr;
    }
  } finally {
    delete globalThis.fetch;
    S.settings.apiKey = "";
  }
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
  for (const r of [null, undefined, {}, { char: {} }, { char: { track: "general" } }, { char: { track: "ADULT" } }, { track: "adult", char: {} }])
    assert.equal(trackOf(r), "general");
});
