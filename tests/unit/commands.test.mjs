// 대화방 명령어(src/js/core/commands.js) 단위 테스트 — 순수 모듈이라 Node가 바로 import
import { test } from "node:test";
import assert from "node:assert/strict";
import { APP_COMMANDS, COMMAND_KINDS, allCommands, commandHelp, commandList, commandText, findCommand, parseCommand } from "../../src/js/core/commands.js";

const work = { commands: [{ cmd: "퀘스트", title: "퀘스트 정리", desc: "지금 퀘스트를 정리해요", prompt: "현재 퀘스트를 시스템 메시지로 정리한다." }] };

test("parseCommand: !이름(전각 ！·앞뒤 공백 허용)만 명령어, 그 밖은 빈 문자열", () => {
  assert.equal(parseCommand("!상태창"), "상태창");
  assert.equal(parseCommand("  ！지도 "), "지도");
  assert.equal(parseCommand("!퀘스트 정리"), "");
  assert.equal(parseCommand("상태창"), "");
  assert.equal(parseCommand(""), "");
});
test("findCommand: 앱 명령어(별칭·영문 대소문자 무시)가 먼저, 다음 작품 명령어, 없으면 null", () => {
  assert.equal(findCommand("상태창", work).app.view, "status");
  assert.equal(findCommand("도감", work).app.view, "gallery");
  assert.equal(findCommand("HELP", work).app.view, "help");
  assert.equal(findCommand("퀘스트", work).work.title, "퀘스트 정리");
  assert.equal(findCommand("퀘스트", null), null);
  assert.equal(findCommand("없는명령", work), null);
  assert.equal(findCommand("", work), null);
});
test("commandText: 작품 명령어·앱 연출형은 // 연출 지시로, 앱 화면형·보통 글은 그대로", () => {
  assert.equal(commandText("!퀘스트", work), "// 유저가 명령어 !퀘스트(퀘스트 정리)을 썼다. 현재 퀘스트를 시스템 메시지로 정리한다.");
  assert.equal(commandText("!상태창", work), "!상태창");
  assert.equal(commandText("안녕", work), "안녕");
  const skip = APP_COMMANDS.find((x) => x.cmd === "시간경과");
  assert.equal(commandText("!시간경과", work), `// 유저가 명령어 !시간경과(${skip.title})을 썼다. ${skip.prompt}`);
  assert.equal(commandText("！반복금지", null).indexOf("// 유저가 명령어 !반복금지("), 0);
});
test("APP_COMMANDS: 항목마다 view(화면형)와 prompt(연출형) 중 하나만, 이름·별칭은 겹치지 않음", () => {
  assert.deepEqual(APP_COMMANDS.filter((x) => x.view).map((x) => x.cmd), ["상태창", "갤러리", "지도", "도움말"]);
  assert.deepEqual(APP_COMMANDS.filter((x) => x.prompt).map((x) => x.cmd), ["시간경과", "새사건", "조연등장", "반복금지"]);
  for (const x of APP_COMMANDS) { assert.ok(!!x.view !== !!x.prompt, x.cmd); assert.ok(x.title && x.desc && Array.isArray(x.alias), x.cmd); assert.ok(/^[^s!！/]+$/.test(x.cmd), x.cmd); }
  const names = APP_COMMANDS.flatMap((x) => [x.cmd, ...x.alias]).map((s) => s.toLowerCase());
  assert.equal(new Set(names).size, names.length);
});
test("allCommands·commandHelp: 앱(화면 → 연출) → 작품 순, 종류는 COMMAND_KINDS의 키", () => {
  const all = allCommands(work);
  assert.deepEqual(all.map((x) => x.kind), ["view", "view", "view", "view", "direct", "direct", "direct", "direct", "work"]);
  assert.ok(all.every((x) => COMMAND_KINDS[x.kind].name && typeof x.desc === "string"));
  assert.equal(commandHelp(work), "!상태창 · !갤러리 · !지도 · !도움말 · !시간경과 · !새사건 · !조연등장 · !반복금지 · !퀘스트(퀘스트 정리)");
  assert.equal(allCommands(null).length, APP_COMMANDS.length);
});
test("즉답 명령어(commands의 text): 종류는 reply·작품 것(own), commandText는 원문 그대로(AI에 지시로 바꾸지 않음), 도움말에는 제목과 함께", () => {
  const w = { commands: [...work.commands, { cmd: "규칙", title: "탑의 규칙", desc: "기본 규칙을 다시 봐요", text: "[안내] 정해진 글" }] };
  const all = allCommands(w), rule = all[all.length - 1];
  assert.deepEqual([rule.kind, rule.own, all[all.length - 2].kind, all[0].own], ["reply", true, "work", false]);
  assert.ok(COMMAND_KINDS.reply.name && COMMAND_KINDS.reply.note);
  assert.equal(findCommand("규칙", w).work.text, "[안내] 정해진 글");
  assert.equal(commandText("!규칙", w), "!규칙");
  assert.equal(commandText("!퀘스트", w).indexOf("// 유저가 명령어 !퀘스트("), 0);
  assert.ok(commandHelp(w).endsWith("!퀘스트(퀘스트 정리) · !규칙(탑의 규칙)"));
  assert.deepEqual(commandList("!규", w).map((x) => [x.cmd, x.kind]), [["규칙", "reply"]]);
});
test("commandList(입력창 ! 목록): !만 쳐도 전부, 글자를 치면 이름·별칭이 그 글자로 시작하는 것만, 명령어 모양이 아니면 빈 목록", () => {
  assert.equal(commandList("!", work).length, APP_COMMANDS.length + 1);
  assert.deepEqual(commandList("!상", work).map((x) => x.cmd), ["상태창"]);
  assert.deepEqual(commandList(" ！장", work).map((x) => x.cmd), ["지도"]);
  assert.deepEqual(commandList("!HE", work).map((x) => x.cmd), ["도움말"]);
  assert.deepEqual(commandList("!퀘", work).map((x) => x.cmd), ["퀘스트"]);
  assert.deepEqual(commandList("!퀘", null), []);
  assert.deepEqual(commandList("!퀘스트 정리", work), []);
  assert.deepEqual(commandList("안녕 !", work), []);
  assert.deepEqual(commandList("", work), []);
});
