// 한 턴의 요청 묶음(src/js/ai/prompt/input.js buildInput): 직전 응답에 상태창을 출력 형식 그대로 붙이는지, 마지막 입력에 형식 다짐이 있는지
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseState, splitReply } from "../../src/js/ai/parse.js";
import { buildInput } from "../../src/js/ai/prompt/input.js";
import { ORIGINALS } from "../../src/js/content/index.js";
import { MARK } from "../../src/js/core/constants.js";
import { newRoom } from "../../src/js/core/rooms.js";

test("buildInput: 직전 응답 하나에만 상태창을 붙이고(앱의 파서가 그대로 읽음), 마지막 입력은 상태창으로 끝내라고 다짐", () => {
  const c = ORIGINALS.find((x) => x.id === "seodoyun");
  const r = newRoom(JSON.parse(JSON.stringify(c)), 0, { id: "p1", name: "지호", memo: "", desc: "" });
  const st2 = { ...r.status, "속마음": "말을 아끼는군." }, sug = ["하나", "둘", "셋"];
  r.msgs.push({ id: "u1", role: "user", text: "안녕" }, { id: "a1", role: "ai", idx: 0, alts: [{ text: '*고개를 든다.*\n\n"누구시죠?"', status: st2, suggestions: sug }], statusBefore: r.status }, { id: "u2", role: "user", text: "기억 안 나?" });
  const input = buildInput(r, r.msgs.length, st2), ai = input.filter((m) => m.role === "assistant");
  assert.equal(ai.length, 2);
  assert.ok(!ai[0].content.includes(MARK), "앞선 응답(시작 상황)에는 붙이지 않음");
  assert.equal(splitReply(ai[1].content).body.trim(), '*고개를 든다.*\n\n"누구시죠?"');
  assert.deepEqual(parseState(ai[1].content, r.char, {}), { status: st2, suggestions: sug });
  assert.match(input[input.length - 1].content, new RegExp(MARK + "를 쓰고 그 아래 상태 JSON 한 개로 응답을 마친다"));
  // 첫 턴: 시작 상황이 직전 응답 — 그때의 상태창과 보기 추천 셋이 붙음
  const first = buildInput(r, 2, r.status), open = parseState(first[1].content, r.char, {});
  assert.deepEqual(open.status, r.msgs[0].alts[0].status);
  assert.equal(open.suggestions.length, 3);
});
