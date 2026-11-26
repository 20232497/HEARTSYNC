// 하트의 쓰임(2026-11-27 사용자 결정 "사이트 내의 하트 구매로는 오직 이야기 대화에만 사용할 수 있도록 고정해줘"): 하트를 빼는 길은 AI 대화(답 받기·다시 쓰기 — ui/chat/generate.js,
// 답변 추천 — ui/chat/suggest.js)뿐이어야 함. 새 모듈이 charge를 부르거나 하트를 직접 줄이면 이 시험이 실패 — 대화가 아닌 곳에 하트를 쓰려면 먼저 사용자 결정(docs/DECISIONS.md)부터
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import assert from "node:assert/strict";

const JS = fileURLToPath(new URL("../../src/js/", import.meta.url));
const files = (function walk(d) {
  return fs
    .readdirSync(d, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith(".js") ? [path.join(d, e.name)] : []));
})(JS).map((f) => [path.relative(JS, f).split(path.sep).join("/"), fs.readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")]);

// shortcut: 글자 모양으로 보는 걸림줄이라 일부러 돌아가는 코드(Object.assign으로 지갑 덮기 등)는 못 잡음 — 정직한 새 사용처를 멈춰 세우는 것이 목적, 하트가 서버 원장으로 가면 서버 쪽 시험으로
const others = files.filter(([f]) => f !== "core/wallet.js");
test("하트를 빼는 charge는 대화의 두 모듈(답 받기 generate·답변 추천 suggest)만 가져오고, 아무도 다시 내보내지 않음", () => {
  const users = others.filter(([, src]) => /import\s*\{[^}]*\bcharge\b[^}]*\}\s*from/.test(src)).map(([f]) => f);
  assert.deepEqual(users.sort(), ["ui/chat/generate.js", "ui/chat/suggest.js"]);
  assert.deepEqual(
    others.filter(([, src]) => /export\s*\{[^}]*\bcharge\b/.test(src)).map(([f]) => f),
    []
  );
});
test("하트를 줄이는 코드는 core/wallet.js에만 — 다른 모듈은 더하기(충전)만, 값을 따로 적는 곳은 첫 지급 한 줄", () => {
  const writes = others.flatMap(([f, src]) =>
    src
      .split("\n")
      .filter((l) => /(?:\.hearts\b|\[["']hearts["']\])\s*(?:[-*/%]?=(?!=)|\+=\s*-|--)|--\s*\S*\.hearts\b/.test(l)) // 칸(.hearts)에 쓰는 것만 — 같은 이름의 지역 변수는 아님
      .map((l) => `${f}: ${l.trim()}`)
  );
  // 저장된 지갑을 통째로 되살리는 것(services/load.js loadAll의 펼치기·계정에서 받기)은 값을 바꾸지 않으므로 여기서 보지 않음
  assert.deepEqual(writes, ["services/load.js: S.wallet.hearts = WELCOME;"]);
});
