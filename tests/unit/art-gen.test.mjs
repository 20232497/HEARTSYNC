// 그림 총괄 페이지의 생성 호출(tools/art/gen.js) — 그림을 못 받아오는 경우의 처리. 앱 코드가 아니라 이 PC 전용 그림 도구다.
// 생성 서비스의 규칙(문서 Task Polling·Errors·Rate Limits): 동기 요청은 120초까지만 기다리고 그 뒤에는 status "processing"으로 돌아온다 → 같은 taskUUID로 getResponse를 조회.
// 다시 보내면 같은 그림을 두 번 사게 되므로, 다시 보내는 것은 서비스가 받지 않았다고 답했을 때뿐이어야 한다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { generate, removeBg, retry, spent } from "../../tools/art/gen.js";

const JOB = { pos: "a", neg: "b", model: "m", width: 64, height: 64, steps: 1, cfg: 1, scheduler: "x", seed: 1 };
const IMG = "data:image/webp;base64,UklGRg==";
const json = (v, status = 200, headers = {}) => new Response(JSON.stringify(v), { status, headers });
const done = (task, more = {}) => ({ taskType: "imageInference", taskUUID: task.taskUUID, imageDataURI: IMG, cost: 0.001, ...more });
/** 생성 서비스 흉내. replies: 그림을 보내는 요청에 차례로 줄 답(마지막 것이 되풀이됨) —
      "ok" 그림 · "slow:N" 처리 중으로 답하고 조회 N번째에 그림 · "lost" 받았지만 응답이 끊김(조회하면 그림) · "down" 닿지 못함(서비스는 그 작업을 모름)
      · "cut" 헤더는 왔는데 본문이 끊김(서비스는 그렸음) · "empty" 빈 응답(서비스는 그 작업을 모름) · 숫자 그 상태 코드 · { errors, status?, headers? } 오류
    sent: 그림을 보낸 요청들, polls: 조회 횟수 */
function service(replies) {
  const sent = [],
    known = {}; // taskUUID → 조회가 몇 번 남았는지(0이면 그림)
  let polls = 0;
  globalThis.fetch = async (url, init) => {
    if (String(url).startsWith("data:")) return new Response(new Blob(["x"], { type: "image/webp" }));
    const task = JSON.parse(init.body)[0];
    if (task.taskType === "getResponse") {
      polls++;
      if (!(task.taskUUID in known)) return json({ data: [{ taskType: "getResponse", taskUUID: task.taskUUID, status: "processing" }] }); // 모르는 작업은 이렇게 온다(실제 호출로 확인)
      if (known[task.taskUUID]-- > 0) return json({ data: [{ taskType: "imageInference", taskUUID: task.taskUUID, status: "processing" }] });
      return json({ data: [done(task, { status: "success" })] });
    }
    const r = replies.length > 1 ? replies.shift() : replies[0];
    sent.push(task);
    if (r === "down") throw new TypeError("fetch failed");
    if (r === "lost") {
      known[task.taskUUID] = 0;
      throw new TypeError("fetch failed");
    }
    if (r === "cut") {
      known[task.taskUUID] = 0;
      return { status: 200, ok: true, headers: new Headers(), text: () => Promise.reject(new TypeError("terminated")) };
    }
    if (r === "empty") return json({ data: [] });
    if (typeof r === "string" && r.startsWith("slow:")) {
      known[task.taskUUID] = +r.slice(5) - 1;
      return json({ data: [{ taskType: task.taskType, taskUUID: task.taskUUID, status: "processing" }] });
    }
    if (typeof r === "number") return json({}, r);
    if (r && r.errors) return json({ errors: r.errors.map((e) => ({ taskUUID: task.taskUUID, ...e })) }, r.status || 400, r.headers || {});
    return json({ data: [done(task, r && r.type ? { taskType: r.type } : {})] });
  };
  return { sent, polls: () => polls };
}
retry.waits = [0, 0];
retry.poll = [0];

test("그림 받아오기: 2분을 넘겨 '처리 중'으로 돌아온 작업은 다시 보내지 않고 같은 작업을 조회해 받는다", async () => {
  const s = service(["slow:3", "slow:1"]),
    before = spent.usd;
  const out = await generate({ ...JOB, hires: { w: 96, h: 96, strength: 0.4 } }); // 첫 그림도, 키워 다시 그린 그림도 처리 중으로 옴
  assert.ok(out.blob.size > 0);
  assert.equal(s.sent.length, 2, "그림 요청은 단계마다 한 번씩만(다시 보내지 않음)");
  assert.equal(s.polls(), 4);
  assert.equal(s.sent[1].seedImage, IMG, "키워 다시 그리기는 조회로 받은 첫 그림을 밑그림으로");
  assert.equal(+(spent.usd - before).toFixed(4), 0.002);
});

test("그림 받아오기: 응답만 잃은 요청(연결 끊김·본문 끊김)은 조회로 되찾는다 — 같은 그림을 두 번 사지 않는다", async () => {
  for (const how of ["lost", "cut"]) {
    const s = service([how]);
    const out = await generate(JOB);
    assert.ok(out.blob.size > 0, how);
    assert.equal(s.sent.length, 1, how + ": 다시 보내지 않음");
    assert.equal(s.polls(), 1);
  }
});

test("그림 받아오기: 서비스가 받지 않은 요청(닿지 못함·빈 응답·429·5xx·다시 걸 만한 오류 코드)만 새 taskUUID로 다시 보낸다 — 두 번까지", async () => {
  const over = { errors: [{ code: "serviceOverloaded", message: "busy", retryAfter: 0 }], status: 429, headers: { "retry-after": "0" } };
  for (const first of [
    "down",
    "empty",
    503,
    504,
    over,
    { errors: [{ code: "timeoutProvider", message: "provider" }], status: 504 },
    { errors: [{ code: "failedModelLoad", message: "loading" }] }
  ]) {
    const s = service([first, "ok"]);
    await generate(JOB);
    assert.equal(s.sent.length, 2, JSON.stringify(first));
    assert.notEqual(s.sent[0].taskUUID, s.sent[1].taskUUID);
  }
  const s = service(["down", 502, "ok"]);
  await generate(JOB);
  assert.equal(s.sent.length, 3);
  const never = service([503]);
  await assert.rejects(generate(JOB), /HTTP 503 — 3번 해 봤어요/);
  assert.equal(never.sent.length, 3, "세 번 해 보고 멈춤");
});

test("그림 받아오기: 다시 걸어도 같은 실패(키·잔액·문구·잘못된 요청)는 한 번에 알린다 — 설명 글에 timeout·provider가 들어 있어도", async () => {
  for (const [reply, re] of [
    [{ errors: [{ code: "invalidApiKey", message: "Invalid API key" }], status: 401 }, /invalidApiKey — Invalid API key$/],
    [{ errors: [{ code: "insufficientCredits", message: "Not enough credits" }], status: 402 }, /insufficientCredits/],
    [{ errors: [{ code: "invalidPositivePrompt", message: "provider timeout words in the text", parameter: "positivePrompt" }] }, /positivePrompt$/],
    [401, /HTTP 401$/],
    [403, /HTTP 403$/]
  ]) {
    const s = service([reply, "ok"]);
    await assert.rejects(generate(JOB), re);
    assert.equal(s.sent.length, 1, "다시 보내지 않음: " + re);
    assert.equal(s.polls(), 0);
  }
});

test("그림 받아오기: 처리 중인 작업이 한도까지 안 끝나면 멈추고 알린다 — 다시 보내지 않는다", async () => {
  const limit = retry.limit;
  retry.limit = 40;
  retry.poll = [10];
  try {
    const s = service(["slow:99999"]);
    await assert.rejects(generate(JOB), /그림이 아직 그려지는 중이에요 — .*기다렸지만 그림이 오지 않아 멈췄어요/);
    assert.equal(s.sent.length, 1);
    assert.ok(s.polls() >= 1);
  } finally {
    retry.limit = limit;
    retry.poll = [0];
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
  const s = service([{ type: "imageBackgroundRemoval" }]);
  const cut = await removeBg(new Blob(["x"], { type: "image/webp" }));
  assert.ok(cut.size > 0);
  assert.equal(s.sent[0].taskType, "removeBackground");
});
