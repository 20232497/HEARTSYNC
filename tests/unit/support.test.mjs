// 신고·문의 분류의 계약: 앱의 분류 값(services/support.js ASK_CATS)이 서버 표의 허용값(docs/supabase.sql inquiries_category_check)과 같은지.
// SQL을 실행하지 않고 글로 대조함 — 앱에 분류를 더하면서 SQL을 빠뜨리면 그 분류의 문의가 서버에서 거절되므로
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { ASK_CATS, isReport } from "../../src/js/services/support.js";

test("문의 분류 값은 서버 표의 허용값과 같음 — 서버에만 남긴 예전 'adult'(성인 모드 문의) 하나만 더 있음", () => {
  const sql = fs.readFileSync(new URL("../../docs/supabase.sql", import.meta.url), "utf8");
  const m = sql.match(/inquiries_category_check check \(category in \(([^)]*)\)\)/);
  assert.ok(m, "docs/supabase.sql에 inquiries_category_check가 있음");
  const allowed = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]).sort(),
    app = ASK_CATS.map(([v]) => v);
  assert.equal(new Set(app).size, app.length, "앱 분류 값이 겹치지 않음");
  assert.deepEqual([...app, "adult"].sort(), allowed);
  assert.ok(isReport({ category: "report" }) && !isReport({ category: "etc" }), "신고 분류는 'report'");
});
