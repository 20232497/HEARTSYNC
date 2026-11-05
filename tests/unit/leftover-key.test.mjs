// 쓰지 않는 Runware 키 정리(src/js/ui/leftover-key.js · VAULT.clearField · SUPPORT.adminStatus) 단위 테스트 — 관리자 키는 지워지지 않고, 서버 답을 못 받으면 지우지 않고, 다른 키를 잃지 않음
// 금고 암호화는 진짜(WebCrypto), 서버(SB.req)만 가짜. 흐름 시험은 tests/e2e/vault.mjs
import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";

// 앱 모듈이 읽는 브라우저 전역만 가짜로(gen-guard.test.mjs와 같은 방식). 화면 칸은 없다고 답해 칸 그리기는 건너뜀
const mem = new Map();
globalThis.window = globalThis;
globalThis.addEventListener = globalThis.removeEventListener = () => {};
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k), key: () => null, length: 0 };
globalThis.location = { protocol: "https:", hostname: "20232497.github.io", hash: "" };
globalThis.document = { querySelector: () => null, querySelectorAll: () => [] };
const { S } = await import("../../src/js/core/state.js");
const { SB } = await import("../../src/js/services/supabase.js");
const { CLOUD } = await import("../../src/js/services/cloud.js");
const { SUPPORT } = await import("../../src/js/services/support.js");
const { VAULT } = await import("../../src/js/services/vault.js");
const { leftoverPlan, clearLeftover } = await import("../../src/js/ui/leftover-key.js");

const UID = "u1", LOCK = { k: Buffer.alloc(32, 7).toString("base64"), kid: "kid1" }, OTHER_LOCK = { k: Buffer.alloc(32, 9).toString("base64"), kid: "kid2" };
const KEYS = { apiKey: "sk-ant-test", runwareKey: "rw-test", openRouterKey: "sk-or-test" };
const res = (status, body) => new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
// 가짜 서버: 금고 행 하나와 admins 표. kvDown이면 kv 요청이 연결 실패, patchFail이면 PATCH만 500
let server;
const fakeReq = async (path, opt = {}) => {
  const m = opt.method || "GET";
  server.log.push(m + " " + path);
  if (path.startsWith("/rest/v1/admins")) return server.admins(path);
  if (server.kvDown) throw new TypeError("연결 실패");
  if (m === "PATCH") {
    if (server.patchFail) return res(500, { message: "down" });
    const kid = decodeURIComponent(path).match(/value->>kid=eq\.([^&]+)/)[1];
    if (!server.vault || server.vault.kid !== kid) return res(200, []);
    server.vault = JSON.parse(opt.body).value; return res(200, [{ key: "vault" }]);
  }
  if (m === "POST") { // 금고 첫 저장(ignore-duplicates)과 설정 올리기
    const out = [];
    for (const x of JSON.parse(opt.body)) {
      if (x.key !== "vault") continue;
      if (server.vault && /ignore-duplicates/.test(opt.headers.Prefer)) continue;
      server.vault = x.value; out.push({ key: "vault" });
    }
    return res(201, out);
  }
  return res(200, server.vault ? [{ value: server.vault }] : []); // GET 금고
};
const notAdmin = () => res(200, []);
const yesAdmin = () => res(200, [{ user_id: UID }]);
// 로그인한 기기 하나 — 이 기기와 계정 금고에 KEYS가 맞춰진 상태
async function signedIn(keys = KEYS) {
  Object.assign(S.settings, keys, { syncKeys: true });
  SB.s = { user: { id: UID, email: "t@example.test", provider: "email", providers: ["email"] } };
  CLOUD.on = true; CLOUD.uid = UID; CLOUD.noTable = false;
  VAULT.rec = null; VAULT.state = ""; VAULT.use(LOCK, UID, false);
  server.vault = await VAULT.seal(VAULT.pick());
  await VAULT.take(server.vault);
}
const inVault = () => VAULT.open(server.vault);
const local = () => JSON.parse(mem.get("hv1_settings") || "{}");
beforeEach(() => {
  mem.clear();
  server = { vault: null, admins: notAdmin, kvDown: false, patchFail: false, log: [] };
  SB.on = () => true; SB.req = fakeReq; SB.s = null;
  SUPPORT.admin = null;
  clearTimeout(VAULT.timer); VAULT.timer = null; VAULT.rec = null; VAULT.state = ""; VAULT.fresh = false; VAULT.ck = null;
  CLOUD.on = false; CLOUD.uid = null; CLOUD.pending = {}; clearTimeout(CLOUD.timer);
  Object.assign(S.settings, { apiKey: "", runwareKey: "", openRouterKey: "", syncKeys: true });
});
after(() => { clearTimeout(VAULT.timer); clearTimeout(CLOUD.timer); });

test("adminStatus: 서버가 답해야 참·거짓, 못 받으면 null — amAdmin은 그대로 참일 때만 참", async () => {
  SB.s = { user: { id: UID } };
  assert.equal(await SUPPORT.adminStatus(), false);
  assert.equal(await SUPPORT.amAdmin(), false);
  for (const [name, answer] of [["서버 오류", () => res(500, { message: "x" })], ["표 없음", () => res(404, { code: "PGRST205" })], ["권한 오류", () => res(401, { message: "JWT" })], ["목록이 아닌 응답(중간 프록시 HTML)", () => res(200, "<html>")], ["연결 실패", () => { throw new TypeError("연결 실패"); }]]) {
    server.admins = answer;
    assert.equal(await SUPPORT.adminStatus(), null, name);
    assert.equal(await SUPPORT.amAdmin(), false, name);
  }
  server.admins = yesAdmin;
  assert.equal(await SUPPORT.adminStatus(), true);
  server.admins = () => { throw new TypeError("연결 실패"); };
  assert.equal(await SUPPORT.adminStatus(), true, "'맞음'은 기억 — 서버가 안 돼도 관리자");
});
test("adminStatus: 묻는 사이 로그인이 풀리거나 계정이 바뀌면 그 답을 '아니오'로 믿지 않음", async () => {
  SB.s = { user: { id: UID } };
  server.admins = () => { SB.s = null; return res(200, []); };
  assert.equal(await SUPPORT.adminStatus(), null);
  SB.s = { user: { id: UID } };
  server.admins = () => { SB.s = { user: { id: "다른 계정" } }; return res(200, []); };
  assert.equal(await SUPPORT.adminStatus(), null);
});

test("leftoverPlan: 키가 없으면 칸이 없고 서버에 묻지도 않음", async () => {
  SB.s = { user: { id: UID } };
  assert.equal(await leftoverPlan(), "none");
  assert.equal(server.log.length, 0);
});
test("leftoverPlan: 관리자·모름이면 지울 수 없음", async () => {
  await signedIn();
  server.admins = yesAdmin; assert.equal(await leftoverPlan(), "none");
  SUPPORT.admin = null; server.admins = () => res(500, {}); assert.equal(await leftoverPlan(), "unknown");
  server.admins = () => { throw new TypeError("연결 실패"); }; assert.equal(await leftoverPlan(), "unknown");
});
test("leftoverPlan: 관리자 도구 비밀번호를 지난 브라우저는 로그인 여부와 상관없이 칸이 없음", async () => {
  S.settings.runwareKey = "rw-test";
  mem.set("hv1_admin", "x"); assert.equal(await leftoverPlan(), "none");
  await signedIn(); mem.set("hv1_admin", "x"); assert.equal(await leftoverPlan(), "none");
  assert.equal(server.log.filter((l) => l.includes("admins")).length, 0);
});
test("leftoverPlan: 일반 이용자 — 로그인 전·이 기기만·금고 잠김·금고까지", async () => {
  S.settings.runwareKey = "rw-test";
  SB.on = () => false; assert.equal(await leftoverPlan(), "device", "계정 서버가 없는 곳");
  SB.on = () => true; assert.equal(await leftoverPlan(), "guest");
  await signedIn();
  assert.equal(await leftoverPlan(), "both");
  S.settings.syncKeys = false; assert.equal(await leftoverPlan(), "device", "계정에 안 올리는 설정");
  S.settings.syncKeys = true; VAULT.state = "stale"; assert.equal(await leftoverPlan(), "locked");
  VAULT.state = ""; VAULT.rec = null; assert.equal(await leftoverPlan(), "locked", "비밀번호 계정인데 이 기기에 잠금이 없음");
  SB.s.user.providers = ["kakao"]; assert.equal(await leftoverPlan(), "device", "키 잠금 암호를 정하지 않은 소셜 계정 — 금고가 없음");
  VAULT.state = "locked"; assert.equal(await leftoverPlan(), "locked", "소셜 계정인데 금고가 잠김");
});

test("지우기: 일반 이용자 — 이 기기와 금고에서 Runware 키만 빠지고 다른 키·잠금은 그대로", async () => {
  await signedIn();
  const kid = server.vault.kid;
  assert.deepEqual(await clearLeftover(), { plan: "both", account: "done" });
  assert.equal(S.settings.runwareKey, "");
  assert.equal(local().runwareKey, "", "이 기기 저장값도");
  assert.equal(server.vault.kid, kid);
  assert.deepEqual(await inVault(), { ...KEYS, runwareKey: "" });
  assert.equal(S.settings.apiKey, KEYS.apiKey); assert.equal(S.settings.openRouterKey, KEYS.openRouterKey);
});
test("지우기: 다른 기기에서 먼저 바꾼 키를 옛 값으로 덮지 않음", async () => {
  await signedIn();
  server.vault = await VAULT.seal({ ...KEYS, apiKey: "sk-ant-newer" });
  await clearLeftover();
  assert.deepEqual(await inVault(), { ...KEYS, apiKey: "sk-ant-newer", runwareKey: "" });
  assert.equal(S.settings.apiKey, "sk-ant-newer");
});
test("지우기: 이 기기에서 바꾼 뒤 못 올린 키를 잃지 않음(타이머가 돌고 있어도)", async () => {
  await signedIn();
  S.settings.openRouterKey = "sk-or-mine"; VAULT.save();
  assert.ok(VAULT.timer);
  await clearLeftover();
  assert.deepEqual(await inVault(), { ...KEYS, openRouterKey: "sk-or-mine", runwareKey: "" });
  assert.equal(S.settings.openRouterKey, "sk-or-mine");
  S.settings.openRouterKey = "sk-or-mine2"; // 타이머 없이 '바뀌었는데 안 올린' 상태(seen과 다름)
  S.settings.runwareKey = "rw-again"; server.vault = await VAULT.seal({ ...KEYS, openRouterKey: "sk-or-mine", runwareKey: "rw-again" });
  await clearLeftover();
  assert.equal((await inVault()).openRouterKey, "sk-or-mine2");
});
test("지우기: 설정 저장 직후(키는 그대로, 타이머만 돎)에도 다른 기기의 새 키를 덮지 않음", async () => {
  await signedIn();
  server.vault = await VAULT.seal({ ...KEYS, apiKey: "sk-ant-newer" });
  VAULT.save(); // 글자 크기 같은 다른 설정을 저장해도 타이머가 돎 — 그대로 두면 take가 건너뛰어 옛 키를 올림
  assert.ok(VAULT.timer);
  await clearLeftover();
  assert.deepEqual(await inVault(), { ...KEYS, apiKey: "sk-ant-newer", runwareKey: "" });
  assert.equal(S.settings.apiKey, "sk-ant-newer");
});
test("지우기: 다른 기기는 다음 동기화 때 지워지고 그 기기의 다른 키는 그대로", async () => {
  await signedIn(); // 이 기기를 휴대폰이라 치면: 예전 금고와 맞춰 둔 상태에서 PC가 지운 금고를 받음
  server.vault = await VAULT.seal({ ...KEYS, runwareKey: "" });
  assert.equal(await VAULT.take(server.vault), 1);
  assert.equal(S.settings.runwareKey, ""); assert.equal(S.settings.apiKey, KEYS.apiKey);
  assert.equal(local().runwareKey, "");
});
test("지우기: 관리자 계정이면 누르는 순간에도 아무것도 지우지 않음", async () => {
  await signedIn();
  server.admins = yesAdmin;
  const before = JSON.stringify(server.vault), writes = () => server.log.filter((l) => /^(PATCH|POST|DELETE)/.test(l)).length, w0 = writes();
  assert.deepEqual(await clearLeftover(), { plan: "none", account: "" });
  assert.equal(S.settings.runwareKey, KEYS.runwareKey);
  assert.equal(JSON.stringify(server.vault), before);
  assert.equal(writes(), w0);
});
test("지우기: 칸을 그린 뒤 서버 답을 못 받으면 아무것도 지우지 않음", async () => {
  await signedIn();
  assert.equal(await leftoverPlan(), "both");
  server.admins = () => { throw new TypeError("연결 실패"); };
  const before = JSON.stringify(server.vault);
  assert.deepEqual(await clearLeftover(), { plan: "unknown", account: "" });
  assert.equal(S.settings.runwareKey, KEYS.runwareKey);
  assert.equal(JSON.stringify(server.vault), before);
});
test("지우기: 금고를 읽지 못하면 던지고 이 기기 키도 그대로", async () => {
  await signedIn();
  server.kvDown = true;
  await assert.rejects(clearLeftover());
  assert.equal(S.settings.runwareKey, KEYS.runwareKey);
});
test("지우기: 금고 쓰기가 실패하면 이 기기 키를 되돌리고 던짐 — 계정에 남았는데 지웠다고 하지 않음", async () => {
  await signedIn();
  server.patchFail = true;
  const before = JSON.stringify(server.vault);
  await assert.rejects(clearLeftover());
  assert.equal(S.settings.runwareKey, KEYS.runwareKey);
  assert.equal(JSON.stringify(server.vault), before);
});
test("지우기: 다른 비밀번호로 잠긴 금고는 덮지 않고 이 기기에서만 지움", async () => {
  await signedIn();
  VAULT.use(OTHER_LOCK, UID, false);
  const other = await VAULT.seal({ ...KEYS });
  server.vault = other;
  VAULT.use(LOCK, UID, true); // 방금 확인한 잠금이어도 — take라면 이 기기 키로 덮어쓸 상황
  assert.equal((await clearLeftover()).account, "locked");
  assert.equal(S.settings.runwareKey, "");
  assert.equal(S.settings.apiKey, KEYS.apiKey);
  assert.equal(JSON.stringify(server.vault), JSON.stringify(other));
});
test("지우기: 이 기기에 잠금이 없으면 금고를 건드리지 않고 이 기기에서만 지움", async () => {
  await signedIn();
  VAULT.rec = null;
  const before = JSON.stringify(server.vault);
  assert.equal((await clearLeftover()).account, "locked");
  assert.equal(S.settings.runwareKey, "");
  assert.equal(JSON.stringify(server.vault), before);
});
test("지우기: 금고가 없으면 none — 뒤이어 금고를 새로 만들어도 Runware 키는 없음", async () => {
  await signedIn();
  server.vault = null;
  assert.equal(await VAULT.clearField("runwareKey"), "none");
  assert.equal(S.settings.runwareKey, "");
  await VAULT.write(); // saveSettings가 건 0.8초 타이머를 기다리지 않고 바로
  assert.deepEqual(await inVault(), { ...KEYS, runwareKey: "" });
});
test("지우기: 키 저장을 끈 계정·로그인 전은 서버에 묻지 않고 이 기기에서만", async () => {
  await signedIn();
  S.settings.syncKeys = false; server.log = [];
  assert.equal(await VAULT.clearField("runwareKey"), "none");
  assert.equal(S.settings.runwareKey, "");
  assert.equal(server.log.filter((l) => l.includes("vault")).length, 0);
  CLOUD.on = false; SB.s = null; S.settings.runwareKey = "rw-guest"; server.log = [];
  assert.deepEqual(await clearLeftover(), { plan: "guest", account: "none" });
  assert.equal(S.settings.runwareKey, "");
  assert.equal(server.log.length, 0);
});
