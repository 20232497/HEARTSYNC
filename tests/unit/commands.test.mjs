// 대화방 명령어(src/js/core/commands.js) 단위 테스트 — 순수 모듈이라 Node가 바로 import
import { test } from "node:test";
import assert from "node:assert/strict";
import { APP_COMMANDS, commandHelp, commandText, findCommand, parseCommand } from "../../src/js/core/commands.js";

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
test("commandText: 작품 명령어는 // 연출 지시로, 앱 명령어·보통 글은 그대로", () => {
  assert.equal(commandText("!퀘스트", work), "// 유저가 명령어 !퀘스트(퀘스트 정리)을 썼다. 현재 퀘스트를 시스템 메시지로 정리한다.");
  assert.equal(commandText("!상태창", work), "!상태창");
  assert.equal(commandText("안녕", work), "안녕");
});
test("commandHelp·APP_COMMANDS: 앱 명령어 넷 + 작품 명령어 제목", () => {
  assert.deepEqual(APP_COMMANDS.map((x) => x.cmd), ["상태창", "갤러리", "지도", "도움말"]);
  assert.equal(commandHelp(work), "!상태창 · !갤러리 · !지도 · !도움말 · !퀘스트(퀘스트 정리)");
  assert.equal(commandHelp(null), "!상태창 · !갤러리 · !지도 · !도움말");
});
