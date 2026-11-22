// 그림 총괄 페이지의 생성 호출(tools/art/gen.js) — 그림을 못 받아오는 경우의 처리. 앱 코드가 아니라 이 PC 전용 그림 도구다.
// 잠깐의 실패(연결 끊김·서버 오류·빈 응답)는 다시 걸고, 다시 걸어도 같은 실패(키·문구)는 바로 알리며, 응답이 한도를 넘으면 다시 걸지 않고 멈추는지.
import { test } from "node:test";
import assert from "node:assert/strict";
import { generate, removeBg, retry, spent } from "../../tools/art/gen.js";

const JOB = { pos: "a", neg: "b", model: "m", width: 64, height: 64, steps: 1, cfg: 1, scheduler: "x", seed: 1 };
const IMG = "data:image/webp;base64,UklGRg==";
const json = (v, status = 200) => new Response(JSON.stringify(v), { status });
/** 생성 서비스 흉내 — replies를 차례로(마지막 것이 되풀이됨): "down" 연결 끊김 · 숫자 그 상태 코드 · { errors } 오류 · { empty } 빈 응답 · { type } 그 taskType으로 그림 · "hang" 끊길 때까지 기다림 */
function service(replies) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    if (String(url).startsWith("data:")) return new Response(new Blob(["x"], { type: "image/webp" }));
    const task = JSON.parse(init.body)[0],
      r = replies.length > 1 ? replies.shift() : replies[0];
    calls.push(task);
    if (r === "down") throw new TypeError("fetch failed");
    if (r === "hang") return new Promise((_, no) => init.signal.addEventListener("abort", () => no(new DOMException("aborted", "AbortError"))));
    if (typeof r === "number") return json({}, r);
    if (r.errors) return json(r, 400);
    if (r.empty) return json({ data: [] });
    return json({ data: [{ taskType: r.type || task.taskType, taskUUID: task.taskUUID, imageDataURI: IMG, cost: 0.001 }] });
  };
  return calls;
}
const OK = {};
retry.waits = [0, 0];

test("그림 받아오기: 잠깐의 실패(서버 오류·연결 끊김·빈 응답·모델 올리기 실패)는 다시 걸어 받아 온다 — 다시 걸 때마다 새 taskUUID", async () => {
  for (const first of [503, 429, "down", { empty: true }, { errors: [{ code: "failedModelLoad", message: "model is loading" }] }]) {
    const calls = service([first, OK]),
      before = spent.usd;
    const out = await generate(JOB);
    assert.ok(out.blob.size > 0);
    assert.equal(calls.length, 2, JSON.stringify(first));
    assert.notEqual(calls[0].taskUUID, calls[1].taskUUID);
    assert.equal(+(spent.usd - before).toFixed(4), 0.001, "받은 그림 값만 더함");
  }
  const calls = service(["down", 502, OK]);
  await generate(JOB);
  assert.equal(calls.length, 3, "두 번까지 다시 건다");
});

test("그림 받아오기: 계속 실패하면 세 번 해 보고 알린다", async () => {
  const calls = service([{ empty: true }]);
  await assert.rejects(generate(JOB), /그림이 오지 않았어요\(빈 응답\) — 3번 해 봤어요/);
  assert.equal(calls.length, 3);
  service(["down"]);
  await assert.rejects(generate(JOB), /생성 서비스에 닿지 못했어요.*3번 해 봤어요/);
});

test("그림 받아오기: 다시 걸어도 같은 실패(키·잔액·문구·잘못된 요청)는 한 번에 알린다", async () => {
  for (const [reply, re] of [
    [{ errors: [{ code: "invalidApiKey", message: "Invalid API key" }] }, /invalidApiKey — Invalid API key$/],
    [{ errors: [{ code: "insufficientCredits", message: "Not enough credits" }] }, /insufficientCredits/],
    [{ errors: [{ code: "invalidPositivePrompt", message: "too long", parameter: "positivePrompt" }] }, /positivePrompt$/],
    [401, /HTTP 401$/]
  ]) {
    const calls = service([reply, OK]);
    await assert.rejects(generate(JOB), re);
    assert.equal(calls.length, 1, "다시 걸지 않음: " + re);
  }
});

test("그림 받아오기: 응답이 한도를 넘게 안 오면 멈추고 알린다 — 다시 걸지 않는다(값이 두 번 나가지 않게)", async () => {
  const limit = retry.limit;
  retry.limit = 30;
  try {
    const calls = service(["hang", OK]);
    await assert.rejects(generate(JOB), /응답이 .*넘게 오지 않아 멈췄어요/);
    assert.equal(calls.length, 1);
  } finally {
    retry.limit = limit;
  }
});

test("그림 받아오기: 배경 지우기의 응답은 taskType이 달라도(imageBackgroundRemoval) 보낸 taskUUID로 찾는다", async () => {
  // 브라우저의 FileReader 흉내(Node에는 없음) — 그림을 data URI로 읽는 데만 쓴다
  globalThis.FileReader = class {
    readAsDataURL() {
      this.result = IMG;
      queueMicrotask(() => this.onload());
    }
  };
  const calls = service([{ type: "imageBackgroundRemoval" }]);
  const cut = await removeBg(new Blob(["x"], { type: "image/webp" }));
  assert.ok(cut.size > 0);
  assert.equal(calls[0].taskType, "removeBackground");
});
