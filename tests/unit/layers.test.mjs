// 빌드의 층 방향 검사(tools/build/layers.mjs — 아래층이 윗층을 import하지 못함, 사용자 빌드에 admin/ 모듈이 못 들어감): 가짜 그래프로 판정을 보고,
// 번들러가 실제로 그 검사를 부르는지(가짜 소스 폴더의 core → ui import가 빌드를 멈춤), 알려진 예외 표가 지금 소스와 맞는지(없어진 예외가 표에 남지 않게).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { build } from "../../tools/build.mjs";
import { bundleModules } from "../../tools/build/bundle.mjs";
import { BuildError, ROOT, TARGETS } from "../../tools/build/common.mjs";
import { LAYERS, LAYER_EXCEPTIONS, layerErrors } from "../../tools/build/layers.mjs";

// rel은 오류 글에 쓸 경로, at은 소스 루트(src/js) 기준 자리 — 번들러가 실제 경로로 계산해 넘기는 모양 그대로
const mod = (at, ...to) => ({ rel: "src/js/" + at, at, imports: to.map((x, i) => ({ at: x, line: i + 3 })) });

test("layerErrors: 아래층 → 윗층 import는 오류(원본 파일:줄), 윗층 → 아래층·같은 층·진입점은 통과", () => {
  const ok = [
    mod("ui/home.js", "core/util.js", "services/cloud.js", "ai/llm.js", "images/pick.js", "content/index.js", "ui/sheet.js"),
    mod("services/cloud.js", "core/storage.js", "services/supabase.js"),
    mod("ai/prompt/rules.js", "images/codes.js", "services/images.js", "core/constants.js"), // services·images·ai는 같은 층
    mod("images/pick.js", "services/images.js"),
    mod("admin/support.js", "ui/sheet.js", "services/support.js", "core/util.js"),
    mod("app.js", "ui/home.js", "core/state.js"),
    mod("admin.js", "admin/gate.js", "app.js")
  ];
  assert.deepEqual(layerErrors(ok, { admin: true }), []);
  const bad = [
    mod("core/rooms.js", "core/state.js", "ui/chat/view.js"),
    mod("core/state.js", "services/cloud.js"),
    mod("services/cloud.js", "ui/account.js", "admin/gate.js"),
    mod("ai/llm.js", "ui/sheet.js"),
    mod("images/pick.js", "ui/cover.js"),
    mod("content/index.js", "services/load.js"),
    mod("ui/me.js", "admin/gate.js"),
    mod("ui/shell.js", "app.js") // 진입점은 맨 위층 — 화면이 진입점을 import하지 못함
  ];
  const errs = layerErrors(bad, { admin: true });
  assert.equal(errs.length, 9);
  assert.match(errs[0], /^src\/js\/core\/rooms\.js:4: 아래층\(core\)이 윗층\(ui\)의 ui\/chat\/view\.js를 import해요/);
  assert.match(errs[1], /^src\/js\/core\/state\.js:3: 아래층\(core\)이 윗층\(services\)/);
  assert.match(errs[2], /^src\/js\/services\/cloud\.js:3: 아래층\(services\)이 윗층\(ui\)/);
  assert.match(errs[3], /^src\/js\/services\/cloud\.js:4: 아래층\(services\)이 윗층\(admin\)/);
  assert.match(errs[8], /^src\/js\/ui\/shell\.js:3: 아래층\(ui\)이 윗층\(진입점\)의 app\.js를 import해요/);
  assert.ok(
    errs.every((e) => /core\/events\.js의 emit/.test(e)),
    "고치는 길을 같이 알려 줌"
  );
});
test("layerErrors: 사용자 빌드에 admin/ 모듈이 들어가면 오류, 관리자 빌드는 통과", () => {
  const graph = [mod("admin/gate.js", "core/util.js"), mod("admin.js", "admin/gate.js")];
  assert.deepEqual(layerErrors(graph, { admin: true }), []);
  const errs = layerErrors(graph);
  assert.equal(errs.length, 1);
  assert.match(errs[0], /^src\/js\/admin\/gate\.js: 사용자 빌드에 관리자 모듈\(admin\/\)이 들어갔어요/);
});
test("layerErrors: 층 표에 없는 폴더(대소문자가 다른 이름도)와 src/js 밖의 파일은 오류 — 맨 위층으로 넘어가 검사를 비켜 가지 않게", () => {
  // 윈도우는 ./Admin/gate.js로도 admin/gate.js가 열림 — 표에 없는 폴더를 맨 위층으로 보면 사용자 빌드의 관리자 모듈 검사를 지나침
  const out = { rel: "tools/x.js", at: "../../tools/x.js", imports: [] };
  const errs = layerErrors([mod("Admin/gate.js", "core/util.js"), mod("main.js", "Admin/gate.js"), mod("widgets/x.js"), out]);
  assert.equal(errs.length, 3);
  assert.match(errs[0], /^src\/js\/Admin\/gate\.js: 층 표에 없는 자리예요/);
  assert.match(errs[1], /^src\/js\/widgets\/x\.js: 층 표에 없는 자리예요.*LAYERS에 층을 적어 주세요/);
  assert.match(errs[2], /^tools\/x\.js: 층 표에 없는 자리예요/);
  // 자리는 소스 루트 기준의 첫 폴더로만 봄 — 안쪽에 'src/js/core'가 또 있어도 admin/ 아래면 관리자 모듈
  assert.equal(layerErrors([mod("admin/sub/src/js/core/x.js")]).length, 1);
});
test("layerErrors: 알려진 예외는 적힌 파일 쌍만 — 같은 층의 다른 파일은 그대로 오류", () => {
  const [from, tos] = Object.entries(LAYER_EXCEPTIONS)[0];
  assert.deepEqual(layerErrors([mod(from, tos[0])], { admin: true }), []);
  assert.equal(layerErrors([mod("core/zz-new.js", tos[0])], { admin: true }).length, 1);
  assert.equal(layerErrors([mod(from, "ui/sheet.js")], { admin: true }).length, 1);
});
test("번들러가 층 검사를 부름: 가짜 소스 폴더의 core → ui import가 빌드를 멈춤(같은 것을 ui → core로 뒤집으면 통과)", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hs-layers-"));
  const write = (rel, text) => {
    const f = path.join(dir, "src", "js", rel);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, text);
    return f;
  };
  try {
    write("ui/b.js", "// 화면\nexport const b = 1;\n");
    write("core/a.js", '// 아래층\nimport { b } from "../ui/b.js";\nexport const a = b + 1;\n');
    const entry = write("main.js", '// 진입점\nimport { a } from "./core/a.js";\nconsole.log(a);\n');
    assert.throws(
      () => bundleModules(entry, TARGETS.user, "page.html"),
      (e) => e instanceof BuildError && e.list.length === 1 && /core\/a\.js:2: 아래층\(core\)이 윗층\(ui\)의 ui\/b\.js를 import해요/.test(e.list[0])
    );
    write("core/a.js", "// 아래층\nexport const a = 2;\n");
    write("ui/b.js", '// 화면\nimport { a } from "../core/a.js";\nexport const b = a;\n');
    const entry2 = write("main.js", '// 진입점\nimport { b } from "./ui/b.js";\nconsole.log(b);\n');
    assert.equal(bundleModules(entry2, TARGETS.user, "page.html").count, 3);
    // 빌드 대상의 admin 칸이 검사에 닿음: 같은 관리자 모듈이 사용자 빌드에서는 멈추고 관리자 빌드에서는 통과
    write("admin/g.js", '// 관리자\nimport { a } from "../core/a.js";\nexport const g = a;\n');
    const entry3 = write("admin.js", '// 관리자 진입점\nimport { g } from "./admin/g.js";\nconsole.log(g);\n');
    assert.throws(
      () => bundleModules(entry3, TARGETS.user, "page.html"),
      (e) => e instanceof BuildError && e.list.length === 1 && /admin\/g\.js: 사용자 빌드에 관리자 모듈\(admin\/\)이 들어갔어요/.test(e.list[0])
    );
    assert.equal(bundleModules(entry3, TARGETS.admin, "admin.html").count, 3);
    // import()는 번들러가 따라가지 않아 층 검사를 비켜 감 — 문법 단계에서 막음(JSDoc의 import("…") 타입 표기는 주석이라 그대로)
    write("core/a.js", '// 아래층\n/** @typedef {import("./types.js").Room} Room */\nexport const a = () => import("../ui/b.js");\n');
    assert.throws(
      () => bundleModules(entry3, TARGETS.admin, "admin.html"),
      (e) => e instanceof BuildError && e.list.length === 1 && /core\/a\.js:3: import\(\)는 쓸 수 없어요/.test(e.list[0])
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("지금 저장소: 층 표가 src/js의 폴더를 모두 알고, 예외 표의 쌍이 실제로 있는 import임(없어졌으면 표에서 뺌)", async () => {
  const dirs = fs
    .readdirSync(path.join(ROOT, "src", "js"), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
  assert.deepEqual(
    dirs.filter((d) => !(d in LAYERS)),
    [],
    "새 폴더는 tools/build/layers.mjs의 LAYERS에 층을 적어 주세요(그 폴더의 모듈을 쓰는 순간 빌드도 멈춤)"
  );
  // 번들러가 읽은 실제 import(관리자 빌드 — 모듈이 모두 듦)와 견줌: 주석 속의 글은 세지 않고, 같은 파일을 가리키는 다른 표기도 잡음
  const { graph } = await build("admin");
  for (const [from, tos] of Object.entries(LAYER_EXCEPTIONS))
    for (const to of tos)
      assert.ok(
        graph.some((m) => m.at === from && m.imports.some((i) => i.at === to)),
        `${from}이 이제 ${to}를 import하지 않아요 — LAYER_EXCEPTIONS에서 빼 주세요`
      );
});
