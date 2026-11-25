// 출시판 제외(work.js hold — tools/build/content.mjs genModules·bundle.mjs loadModule): hold 작품은 사용자 빌드(index.html)에 id·제목·까닭이 하나도 실리지 않고
// 관리자 빌드(admin.html)에는 실림. 가짜 작품으로 목록 글 둘을 보고, 실제 두 빌드가 각자 맞는 목록을 읽는지(모듈 머리 줄)와 지금 hold 작품이 index.html에 없는지 봄.
// 관리자 화면의 '출시판 제외 — 까닭' 표시는 흐름 시험 admin
import { test } from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { build } from "../../tools/build.mjs";
import { GEN_FILE } from "../../tools/build/common.mjs";
import { genModules } from "../../tools/build/content.mjs";

const w = (id, title, extra = {}) => ({ c: { id, name: title, title, ...extra }, aud: "f", rel: `content/f/${id}` });

test("genModules: hold 작품은 사용자 목록에서 id·제목·까닭까지 빠지고, 전부 든 목록에는 남음", () => {
  const works = [w("zzopen", "열린 시험 작품"), w("zzhold", "숨긴 시험 작품", { hold: "시험용 회신 대기" })];
  const { all, user } = genModules(works, []);
  for (const s of ["zzopen", "열린 시험 작품"]) {
    assert.ok(user.includes(s) && all.includes(s), s);
  }
  for (const s of ["zzhold", "숨긴 시험 작품", "시험용 회신 대기"]) {
    assert.ok(!user.includes(s), "사용자 목록에 " + s);
    assert.ok(all.includes(s), "전부 든 목록에 " + s);
  }
  assert.equal(user, genModules([works[0]], []).user, "사용자 목록은 hold 작품을 아예 넣지 않았을 때와 글자 하나까지 같음");
});
test("genModules: 홈 줄은 작품이 모두 hold일 때만 사용자 목록에서 빠짐(줄 이름·소개까지)", () => {
  const mixed = { key: "zzmix", title: "섞인 시험 줄", sub: "" },
    held = { key: "zzheld", title: "숨긴 시험 줄", sub: "숨긴 줄 소개" },
    empty = { key: "zzempty", title: "빈 시험 줄", sub: "" };
  const works = [
    { ...w("zza", "가"), row: mixed },
    { ...w("zzb", "나", { hold: "회신 대기" }), row: mixed },
    { ...w("zzc", "다", { hold: "회신 대기" }), row: held }
  ];
  const { all, user } = genModules(works, [mixed, held, empty]);
  for (const s of ["섞인 시험 줄", "빈 시험 줄"]) assert.ok(user.includes(s) && all.includes(s), s);
  for (const s of ["숨긴 시험 줄", "숨긴 줄 소개"]) {
    assert.ok(!user.includes(s), "사용자 목록에 " + s);
    assert.ok(all.includes(s), "전부 든 목록에 " + s);
  }
});

test("두 빌드: 사용자 빌드는 출시판 제외를 뺀 목록, 관리자 빌드는 전부를 읽고 — 지금 hold 작품은 index.html에 없음", async () => {
  const [u, a] = [await build("user"), await build("admin")];
  // 모듈 이름은 둘 다 generated.js — 첫 줄 주석(사용자 빌드에 남는 머리)으로 어느 목록을 읽었는지 앎
  assert.match(u.html, /src\/js\/content\/generated\.js — 빌드가 content\/ 폴더로 만든 작품 데이터\(사용자 빌드 — 출시판 제외 작품은 뺌\)/);
  assert.match(a.html, /작품 데이터\(전부 — 관리자 빌드·단위 시험·도구가 읽음\)/);
  // 줄 지도(결과 줄 → 원본 파일:줄)는 실제로 읽은 파일을 가리킴
  const from = (o) => new Set(o.map.map((x) => x.from));
  assert.ok(from(u).has("src/js/content/generated-user.js") && !from(u).has("src/js/content/generated.js"), "사용자 빌드 줄 지도");
  assert.ok(from(a).has("src/js/content/generated.js") && !from(a).has("src/js/content/generated-user.js"), "관리자 빌드 줄 지도");
  const { ORIGINALS } = await import(pathToFileURL(GEN_FILE).href);
  for (const c of ORIGINALS.filter((x) => x.hold)) {
    for (const s of [`"id": "${c.id}"`, c.title, c.hold]) {
      assert.ok(!u.html.includes(s), `index.html에 출시판 제외 작품 ${c.id}의 ${s}`);
      assert.ok(a.html.includes(s), `admin.html에 ${c.id}의 ${s}`);
    }
  }
});
