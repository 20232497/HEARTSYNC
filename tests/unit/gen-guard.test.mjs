// 그림 생성 관문(src/js/images/gen-guard.js) 단위 테스트 — 관리자 계정만 Runware를 부르고, 개발 주소만 건너뜀
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// 앱 모듈이 맨 윗단에서 읽는 브라우저 전역만 가짜로(설정 CFG·저장소). gen-guard는 함수 안에서만 location을 읽어 import 뒤에 바꿔 끼워도 됨
const mem = new Map();
globalThis.window = globalThis;
globalThis.addEventListener = globalThis.removeEventListener = () => {};
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k), key: () => null, length: 0 };
globalThis.location = { protocol: "https:", hostname: "20232497.github.io" };
const { assertAdmin, genAccess, localDev } = await import("../../src/js/images/gen-guard.js");
const { SB } = await import("../../src/js/services/supabase.js");
const { SUPPORT } = await import("../../src/js/services/support.js");
const realAmAdmin = SUPPORT.amAdmin; // beforeEach가 가짜로 바꾸기 전의 진짜

let asked = 0, isAdmin = false;
beforeEach(() => {
  globalThis.location = { protocol: "https:", hostname: "20232497.github.io" };
  asked = 0; isAdmin = false;
  SB.on = () => true; SB.s = null;
  SUPPORT.amAdmin = async () => { asked++; return isAdmin; };
});
const rejects = (code) => assert.rejects(assertAdmin(), (e) => e && e.code === code);

test("웹 주소에서 로그인 안 했으면 admin_login — 서버에 묻지도 않음", async () => {
  await rejects("admin_login");
  assert.equal(asked, 0);
});
test("계정 서버가 없으면(file:// 설정 없음 등) admin_login", async () => {
  SB.on = () => false; SB.s = { user: { id: "u1" } };
  await rejects("admin_login");
});
test("로그인했지만 admins 표에 없으면 admin_only", async () => {
  SB.s = { user: { id: "u1" } };
  await rejects("admin_only");
  assert.equal(asked, 1);
});
test("관리자 계정이면 통과", async () => {
  SB.s = { user: { id: "u1" } }; isAdmin = true;
  await assertAdmin();
  assert.deepEqual(await genAccess(), { ok: true });
});
test("file://로 연 관리자 도구도 관문 대상(내려받아 열어도 못 그림)", async () => {
  globalThis.location = { protocol: "file:", hostname: "" };
  assert.equal(localDev(), false);
  await rejects("admin_login");
});
test("개발 서버·흐름 시험(localhost·127.0.0.1)만 건너뜀 — 비슷한 이름은 안 됨", async () => {
  for (const h of ["localhost", "127.0.0.1", "[::1]"]) { globalThis.location = { protocol: "http:", hostname: h }; assert.equal(localDev(), true, h); await assertAdmin(); }
  for (const h of ["localhost.evil.com", "127.0.0.1.nip.io", "my-localhost"]) { globalThis.location = { protocol: "https:", hostname: h }; assert.equal(localDev(), false, h); }
  assert.equal(asked, 0);
});
test("amAdmin: '아니오'는 기억하지 않아 admins에 넣으면 새로 고침 없이 반영, '맞음'은 기억", async () => {
  SUPPORT.amAdmin = realAmAdmin; SUPPORT.admin = null; SB.s = { user: { id: "u1" } };
  let rows = [], reqs = 0;
  SB.req = async () => { reqs++; return new Response(JSON.stringify(rows), { status: 200 }); };
  assert.equal(await SUPPORT.amAdmin(), false);
  rows = [{ user_id: "u1" }];
  assert.equal(await SUPPORT.amAdmin(), true);
  assert.equal(await SUPPORT.amAdmin(), true);
  assert.equal(reqs, 2);
});
test("Runware를 직접 부르는 곳은 둘뿐이고, 둘 다 호출 앞에 관리자 확인이 있음 — 새로 부르는 곳이 생기면 여기서 잡힘", () => {
  const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../src/js");
  const callers = fs.readdirSync(src, { recursive: true }).map((f) => String(f).replace(/\\/g, "/")).filter((f) => f.endsWith(".js") && fs.readFileSync(path.join(src, f), "utf8").includes("fetch(CFG.runwareUrl")).sort();
  assert.deepEqual(callers, ["admin/motion-run.js", "images/runware.js"]);
  for (const f of callers) {
    const code = fs.readFileSync(path.join(src, f), "utf8");
    assert.ok(code.slice(0, code.indexOf("fetch(CFG.runwareUrl")).includes("await assertAdmin()"), f);
  }
});
