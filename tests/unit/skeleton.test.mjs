// 뼈대(src/page.html·src/admin.html)의 뷰포트 메타 — 두 빌드가 같은 값이고 화면 확대를 잠가 둠.
// 아이폰은 글자가 16px보다 작은 입력칸을 누르면 화면을 확대하고 되돌리지 않는데, maximum-scale=1이면 그 확대가 없음(2026-11-21 사용자 결정 — 입력칸 글자 크기는 그대로)
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const meta = (f) => (fs.readFileSync(new URL("../../src/" + f, import.meta.url), "utf8").match(/<meta name="viewport" content="([^"]*)">/) || [])[1] || "";

test("뼈대 둘의 뷰포트 메타가 같고 화면 확대를 잠가 둠", () => {
  const user = meta("page.html"),
    admin = meta("admin.html"),
    parts = user.split(",");
  assert.equal(user, admin, "사용자 사이트와 관리자 도구의 뷰포트 메타가 다름");
  // interactive-widget=resizes-content: 안드로이드 크롬은 자판이 열리면 레이아웃을 줄임(아이폰은 받지 않아 ui/chat/keyboard.js가 맞춤 — 2026-11-26 프레임 7차 C1)
  for (const p of ["width=device-width", "initial-scale=1", "maximum-scale=1", "viewport-fit=cover", "interactive-widget=resizes-content"])
    assert.ok(parts.includes(p), `뷰포트 메타에 ${p}가 없음: ${user}`);
});
