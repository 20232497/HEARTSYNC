// 그림 생성 관문(src/js/images/gen-guard.js) 단위 테스트 — 관리자 계정만 Runware를 부르고, 개발 주소만 건너뜀
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

// 앱 모듈이 맨 윗단에서 읽는 브라우저 전역만 가짜로(설정 CFG·저장소). gen-guard는 함수 안에서만 location을 읽어 import 뒤에 바꿔 끼워도 됨
const mem = new Map();
globalThis.window = globalThis;
globalThis.addEventListener = globalThis.removeEventListener = () => {};
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k), key: () => null, length: 0 };
globalThis.location = { protocol: "https:", hostname: "20232497.github.io" };
const { assertAdmin, genAccess, localDev } = await import("../../src/js/images/gen-guard.js");
const { SB } = await import("../../src/js/services/supabase.js");
const { SUPPORT } = await import("../../src/js/services/support.js");

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
