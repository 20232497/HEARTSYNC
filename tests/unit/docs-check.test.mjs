// 문서 지킴이(tools/build/docs-check.mjs — npm run check가 부름): CLAUDE.md의 크기 상한, 지도 표와 영역 문서의 '다루는 모듈'이 가리키는 경로가 실제로 있는지.
// 가짜 문서로 판정을 보고, 끝에 지금 저장소의 실제 문서가 통과하는지도 봄(CLAUDE.md가 다시 불어나거나 지도가 낡으면 여기서도 걸림)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import assert from "node:assert/strict";
import { CLAUDE_MAX, checkDocs, docModules, mapPaths } from "../../tools/build/docs-check.mjs";

const claude = (rows = "| 대화방 | `docs/app/chat.md` | `src/js/ui/chat/` · `src/js/core/rooms.js` |", extra = "") =>
  `# 이름\n\n규칙과 지도.\n\n## 지도 — 어느 영역은 어느 문서\n\n| 영역 | 읽을 문서 | 주요 모듈 |\n|---|---|---|\n${rows}\n\n## 코딩 규칙\n\n- \`여기는 지도가 아님.js\`\n${extra}`;
const area = "# 대화방\n\n**이 문서가 다루는 모듈**: `src/js/ui/chat/` · `src/js/core/rooms.js`\n\n## 항목\n\n- …\n";
const HAVE = new Set(["docs/app/chat.md", "src/js/ui/chat/", "src/js/core/rooms.js"]);
const run = (text, have = HAVE, docs = { "docs/app/chat.md": area }) =>
  checkDocs(
    text,
    (p) => have.has(p),
    (p) => (p in docs ? docs[p] : null)
  );

test("mapPaths·docModules: 지도 절의 `경로`만 뽑고(다른 절의 것은 빼고), 영역 문서는 '다루는 모듈' 줄에서", () => {
  assert.deepEqual(mapPaths(claude()), ["docs/app/chat.md", "src/js/ui/chat/", "src/js/core/rooms.js"]);
  assert.equal(mapPaths("# 지도 절이 없는 문서\n\n- `a.js`\n"), null);
  assert.deepEqual(docModules(area), ["src/js/ui/chat/", "src/js/core/rooms.js"]);
  assert.deepEqual(docModules("# 모듈 줄이 없는 문서\n"), []);
});
test("checkDocs: 통과 — 크기와 경로 수를 한 줄로", () => {
  const r = run(claude());
  assert.deepEqual(r.errors, []);
  assert.match(r.note, /^CLAUDE\.md 0\.\dKB\(상한 20\.0KB\) · 지도 표의 경로 3개와 영역 문서의 모듈 경로 2개가 모두 있어요$/);
});
test("checkDocs: 상한을 넘으면 실패(어디로 옮길지 안내), 지도 절이 없거나 CLAUDE.md가 없어도 실패", () => {
  assert.match(
    run(claude(undefined, "가".repeat(CLAUDE_MAX / 3 + 1))).errors[0],
    /CLAUDE\.md가 \d+\.\dKB예요 — 상한 20\.0KB.*영역 문서\(docs\/app\/\).*docs\/DECISIONS\.md/
  );
  assert.match(run("# 지도가 없음\n").errors[0], /'## 지도' 절의 표가 없어요/);
  assert.deepEqual(run(null).errors, ["CLAUDE.md가 없어요"]);
});
test("checkDocs: 지도 표나 영역 문서가 가리키는 경로가 없으면 실패 — 모듈을 옮기거나 나누면 문서도 같이 고치게", () => {
  const gone = new Set([...HAVE].filter((p) => p !== "src/js/core/rooms.js")),
    r = run(claude(), gone);
  assert.equal(r.errors.length, 2);
  assert.match(r.errors[0], /CLAUDE\.md 지도 표의 경로가 없어요: src\/js\/core\/rooms\.js/);
  assert.match(r.errors[1], /docs\/app\/chat\.md의 '다루는 모듈' 경로가 없어요: src\/js\/core\/rooms\.js/);
  assert.match(
    run(claude(), HAVE, { "docs/app/chat.md": "# 모듈 줄이 없는 영역 문서\n" }).errors[0],
    /docs\/app\/chat\.md: '\*\*이 문서가 다루는 모듈\*\*:' 줄이 없어요/
  );
  assert.match(run(claude(), new Set(["src/js/ui/chat/", "src/js/core/rooms.js"])).errors[0], /지도 표의 경로가 없어요: docs\/app\/chat\.md/);
});
test("지금 저장소의 문서가 통과: CLAUDE.md가 상한 안이고 지도 표·영역 문서의 경로가 모두 있음", () => {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".."),
    at = (p) => path.join(root, p),
    read = (p) => (fs.existsSync(at(p)) ? fs.readFileSync(at(p), "utf8").replace(/\r\n?/g, "\n") : null);
  const r = checkDocs(read("CLAUDE.md"), (p) => fs.existsSync(at(p)), read);
  assert.deepEqual(r.errors, []);
  assert.ok(mapPaths(read("CLAUDE.md")).filter((p) => /^docs\/app\//.test(p)).length >= 9, "영역 문서가 지도 표에 있음");
});
