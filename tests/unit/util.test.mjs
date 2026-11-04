// 시간 제한 신호(src/js/core/util.js timeoutSignal·abortCode) 단위 테스트 — 시간이 지나면 timedOut로 abort, tick이 미룸, clear가 멈춤, 바깥 취소는 timedOut이 아님
import { test } from "node:test";
import assert from "node:assert/strict";
import { abortCode, timeoutSignal } from "../../src/js/core/util.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test("timeoutSignal: 시간이 지나면 abort되고 timedOut이 켜진다", async () => {
  const t = timeoutSignal(30);
  assert.equal(t.signal.aborted, false);
  await sleep(70);
  assert.equal(t.signal.aborted, true); assert.equal(t.timedOut, true);
  assert.equal(abortCode({ name: "AbortError" }, t, "x"), "timeout");
});
test("timeoutSignal: tick이 멈춤 시간을 다시 재고, clear가 타이머를 멈춘다", async () => {
  const t = timeoutSignal(40);
  await sleep(25); t.tick(80); await sleep(40);
  assert.equal(t.signal.aborted, false, "tick으로 미뤄져 아직 살아 있음");
  t.clear(); await sleep(100);
  assert.equal(t.signal.aborted, false, "clear 뒤에는 abort되지 않음");
});
test("timeoutSignal: 바깥 신호가 취소되면 같이 abort되지만 timedOut은 아니다(cancelled)", async () => {
  const ctl = new AbortController(), t = timeoutSignal(1000, ctl.signal);
  ctl.abort();
  assert.equal(t.signal.aborted, true); assert.equal(t.timedOut, false);
  assert.equal(abortCode({ name: "AbortError" }, t, "x"), "cancelled");
  t.clear();
  const pre = new AbortController(); pre.abort();
  assert.equal(timeoutSignal(1000, pre.signal).signal.aborted, true, "이미 취소된 바깥 신호면 바로 abort");
});
test("abortCode: AbortError가 아니면 기본 코드, T가 없어도 안전", () => {
  assert.equal(abortCode(new Error("boom"), null, "upstream_error"), "upstream_error");
  assert.equal(abortCode({ name: "AbortError" }, null, "x"), "cancelled");
  assert.equal(abortCode(null, null, "network"), "network");
});
