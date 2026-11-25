// 오래된 아이폰용 CSS 검사(tools/build/css-check.mjs cssErrors): inset 약칭·접두사 없는 backdrop-filter·@supports 밖의 color-mix()·CSS 중첩을 잡고 좋은 예는 통과시키는지,
// 지금 저장소의 CSS(src/css)가 그 기준을 지키는지(빌드도 같은 검사로 멈춤).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "../../tools/build/common.mjs";
import { cssErrors } from "../../tools/build/css-check.mjs";

const run = (css) => cssErrors("src/css/x.css", css);
const SUP = "@supports (color:color-mix(in srgb, red, blue))";

test("cssErrors: inset 약칭은 오류(원본 파일:줄) — 네 변을 따로 적으면 통과, safe-area-inset 같은 다른 이름·따옴표 안의 글은 건드리지 않음", () => {
  const errs = run(
    "/* 머리 { } */\n.a { position:fixed; inset:0; }\n.b { top:0; right:0; bottom:0; left:0; padding-top:env(safe-area-inset-top,0px); }\n" +
      "@media (max-width:560px) {\n  .c { INSET:0 0 auto; }\n}\n" +
      '.d::before { content:"}"; inset:0; }\n.e::after { content:"x;inset:0;y"; top:0; }'
  );
  assert.deepEqual(
    errs.map((e) => e.slice(0, 16)),
    ["src/css/x.css:2:", "src/css/x.css:5:", "src/css/x.css:7:"],
    "@media 안의 규칙·대문자 속성도 잡고, 따옴표 안의 }와 ;에 속지 않음"
  );
  assert.match(errs[0], /inset 약칭은/);
});
test("cssErrors: backdrop-filter는 같은 규칙 안의 앞에 -webkit-backdrop-filter가 있어야 함", () => {
  assert.deepEqual(run(".a { -webkit-backdrop-filter:blur(6px); backdrop-filter:blur(6px); }"), []);
  const errs = run(
    ".a { backdrop-filter:blur(6px); }\n.b { backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px); }\n.c { -webkit-backdrop-filter:blur(2px); }\n.d { backdrop-filter:blur(2px); }"
  );
  assert.deepEqual(
    errs.map((e) => e.slice(0, 16)),
    ["src/css/x.css:1:", "src/css/x.css:2:", "src/css/x.css:4:"],
    "다른 규칙의 접두사 선언은 세지 않고, 뒤에 적은 것도 물러날 줄이 아님"
  );
  assert.match(errs[0], /-webkit-backdrop-filter를 같이/);
});
test("cssErrors: color-mix()는 @supports 안에만 — 밖에 같은 선택자·같은 속성의 평범한 선언이 있어야 함(앞줄에 평범한 선언을 더하는 것으로는 안 됨)", () => {
  const good =
    ".a { background:var(--surface); }\n" +
    `${SUP} { .a { background:color-mix(in srgb, var(--surface) 88%, transparent); } }\n` +
    ".b { color:#fff; text-shadow:0 1px 2px #000; }\n" +
    `${SUP} {\n  .b { color:color-mix(in srgb, var(--tint) 80%, #fff); text-shadow:0 8px 40px color-mix(in srgb, var(--tint) 70%, transparent); }\n}\n` +
    '.c { content:"color-mix("; background:url(data:image/png;base64,AAAA); }';
  assert.deepEqual(run(good), []);
  const errs = run(
    ".a { background:var(--surface); background:color-mix(in srgb, var(--surface) 88%, transparent); }\n" + // var()가 든 선언은 버려지지 않아 앞줄이 소용없음
      ".b { background:linear-gradient(red, COLOR-MIX(in srgb, red 50%, blue)); }\n" +
      `${SUP} { .c { background:color-mix(in srgb, red 50%, blue); } }\n` + // 밖에 .c의 평범한 background가 없음
      ".d { color:red; }\n" +
      `${SUP} { .d { background:color-mix(in srgb, red 50%, blue); } }\n` + // 다른 속성(color)의 선언은 물러날 줄이 아님
      "@supports (display:grid) { .e { color:color-mix(in srgb, red 50%, blue); } }\n" + // color-mix를 조건으로 걸지 않은 @supports
      ".f { /* background:color-mix(in srgb, red 50%, blue); */ color:red; }"
  );
  assert.deepEqual(
    errs.map((e) => e.slice(0, 16)),
    ["src/css/x.css:1:", "src/css/x.css:2:", "src/css/x.css:3:", "src/css/x.css:5:", "src/css/x.css:6:"]
  );
  assert.match(errs[0], /color-mix\(\)는 @supports \(color:color-mix\(in srgb, red, blue\)\) \{ … \} 안에만/);
  assert.match(errs[2], /같은 선택자\(\.c\)의 평범한 background 선언/);
});
test("cssErrors: 조건은 정해진 모양 하나만, 물러날 선언은 맨 바깥 규칙에 — 선택자는 빈칸 차이를 무시하고 따옴표 값은 구분함", () => {
  const mixed = "{ .a { color:color-mix(in srgb, red 50%, blue); } }";
  // not·or가 붙은 조건, var()가 든 조건은 오래된 브라우저에서도 열릴 수 있음 — color-mix()를 조건으로 건 것으로 치지 않음
  for (const cond of [
    "@supports not (color:color-mix(in srgb, red, blue))",
    "@supports (display:grid) or (color:color-mix(in srgb, red, blue))",
    "@supports (color:color-mix(in srgb, var(--a), blue))"
  ])
    assert.equal(run(`.a { color:red; }\n${cond} ${mixed}`).length, 1, cond);
  // 빈칸만 다른 조건·선택자는 같은 것
  assert.deepEqual(
    run(".a > .b { color:red; }\n@supports ( color : color-mix(in srgb, red, blue) ) { .a>.b { color:color-mix(in srgb, red 50%, blue); } }"),
    []
  );
  // @media 안에만 있는 평범한 선언은 그 조건 밖의 화면에서 물러날 줄이 못 됨
  assert.equal(run(`@media (min-width:900px) { .a { color:red; } }\n${SUP} ${mixed}`).length, 1);
  // 따옴표 값이 다른 선택자는 다른 것
  assert.equal(run(`[data-t="dark"] .a { color:red; }\n${SUP} { [data-t="lite"] .a { color:color-mix(in srgb, red 50%, blue); } }`).length, 1);
  // 따옴표 안의 /* 는 주석을 열지 않음(그 뒤의 선언을 가리지 않음)
  assert.equal(run('.a::before { content:"/*"; inset:0; }\n.b::before { content:"*/"; }').length, 1);
});
test("cssErrors: 규칙 안의 규칙(CSS 중첩)은 오류 — @media·@keyframes 같은 묶음은 그대로", () => {
  assert.deepEqual(
    run("@media (max-width:560px) { .a { top:0; } }\n@keyframes k { from { opacity:0; } to { opacity:1; } }\n@font-face { font-family:x; }"),
    []
  );
  const errs = run(".a { top:0;\n  & .b { color:red; }\n}");
  assert.equal(errs.length, 1);
  assert.match(errs[0], /^src\/css\/x\.css:1: 규칙 안에 규칙을 넣지 않아요\(CSS 중첩/);
});
test("지금 저장소: src/css의 모든 조각이 검사를 통과함", () => {
  const dir = path.join(ROOT, "src", "css");
  const errs = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".css"))
    .flatMap((f) => cssErrors("src/css/" + f, fs.readFileSync(path.join(dir, f), "utf8")));
  assert.deepEqual(errs, []);
});
