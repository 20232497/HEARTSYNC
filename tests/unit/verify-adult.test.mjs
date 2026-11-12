// 휴대폰 성인 인증 Edge Function(docs/edge/verify-adult.ts) 단위 테스트 — 진짜 함수 코드에 가짜 인증 서버·표·PortOne을 끼움(tests/unit/_idv-fake.mjs)
import { test } from "node:test";
import assert from "node:assert/strict";
import { A, B, PORTONE_SECRET, SECRET, SB_URL, fakeWorld, loadEdge } from "./_idv-fake.mjs";
const { handle, isAdultBirth } = await loadEdge();

const NOW = new Date("2026-11-05T03:00:00Z");
const ID = "hs" + "a".repeat(32);
const call = async (w, body, { tok = "tokA", method = "POST", now = NOW } = {}) => {
  const req = new Request(SB_URL + "/functions/v1/verify-adult", {
    method,
    headers: { "content-type": "application/json", ...(tok ? { authorization: "Bearer " + tok } : {}) },
    ...(method === "POST" ? { body: JSON.stringify(body) } : {})
  });
  const r = await handle(req, w.env, w.fetch, () => now);
  return { status: r.status, body: await r.json().catch(() => null), headers: r.headers };
};
const pending = (w, id = ID, user = A) => w.add({ id, user_id: user });

test("isAdultBirth: 출생연도 + 19 ≤ 올해(한국 시각), 읽을 수 없으면 null", () => {
  assert.equal(isAdultBirth("2007-12-31", NOW), true); // 올해 만 19세가 되는 해 — 청소년보호법 제2조 단서
  assert.equal(isAdultBirth("2008-01-01", NOW), false);
  assert.equal(isAdultBirth("1990-05-05", NOW), true);
  // 한국 시각으로 해가 바뀌는 순간: UTC 12-31 15:00 = 한국 1월 1일 0시
  assert.equal(isAdultBirth("2008-06-01", new Date("2026-12-31T14:59:00Z")), false);
  assert.equal(isAdultBirth("2008-06-01", new Date("2026-12-31T15:00:00Z")), true);
  for (const bad of ["", null, undefined, "1990", "abcd-ef-gh", "1990-13-01", "1990-00-10", "1990-01-32", "1800-01-01", "2030-01-01"])
    assert.equal(isAdultBirth(bad, NOW), null, String(bad));
});

test("요청 모양: OPTIONS는 CORS, POST 말고는 거부, 설정이 없으면 not_configured", async () => {
  const w = fakeWorld();
  const o = await handle(new Request(SB_URL, { method: "OPTIONS" }), w.env, w.fetch);
  assert.equal(o.status, 200);
  assert.match(o.headers.get("access-control-allow-headers"), /authorization/);
  assert.match(o.headers.get("access-control-allow-headers"), /apikey/);
  assert.equal((await call(w, null, { method: "GET" })).status, 405);
  assert.equal((await call(w, { action: "nope" })).body.code, "bad_request");
  for (const k of ["PORTONE_API_SECRET", "SUPABASE_URL", "SUPABASE_SECRET_KEYS"]) {
    const r = await call(fakeWorld({ [k]: undefined }), { action: "start" });
    assert.equal(r.status, 500);
    assert.equal(r.body.code, "not_configured", k);
  }
});

test("로그인 토큰이 없거나 틀리면 401 — 표·PortOne에 닿지 않음", async () => {
  for (const tok of [null, "wrong"]) {
    const w = fakeWorld(),
      r = await call(w, { action: "start" }, { tok });
    assert.equal(r.status, 401);
    assert.equal(r.body.code, "login");
    assert.equal(w.rows.length, 0);
    assert.equal(w.portoneCalls().length, 0);
  }
});

test("start: KCP가 받는 모양의 번호를 이 계정에 묶어 만들고, 24시간에 10번까지", async () => {
  const w = fakeWorld();
  const r = await call(w, { action: "start" });
  assert.equal(r.status, 200);
  assert.match(r.body.id, /^[A-Za-z0-9]{1,40}$/);
  assert.match(r.body.id, /^hs[0-9a-f]{32}$/);
  assert.equal(w.rows[0].id, r.body.id);
  assert.equal(w.rows[0].user_id, A);
  assert.equal(w.rows[0].checked_at, null);
  for (let i = 0; i < 9; i++) assert.equal((await call(w, { action: "start" })).status, 200);
  const over = await call(w, { action: "start" });
  assert.equal(over.status, 429);
  assert.equal(over.body.code, "too_many");
  assert.equal((await call(w, { action: "start" }, { tok: "tokB" })).status, 200); // 다른 계정은 따로 셈
  w.rows.forEach((x) => {
    x.created_at = new Date(NOW.getTime() - 25 * 3600000).toISOString();
  });
  assert.equal((await call(w, { action: "start" })).status, 200); // 하루가 지나면 다시
});

test("confirm: 이 계정이 만든 번호만 — 남의 번호·없는 번호·모양이 다른 번호는 PortOne에 묻지도 않음", async () => {
  const w = fakeWorld();
  pending(w, ID, B);
  const r = await call(w, { action: "confirm", id: ID });
  assert.equal(r.status, 404);
  assert.equal(r.body.code, "not_yours");
  assert.equal((await call(w, { action: "confirm", id: "hs" + "b".repeat(32) })).body.code, "not_yours");
  for (const id of ["", "x", "../secret", ID + "&user_id=eq." + A, null])
    assert.equal((await call(w, { action: "confirm", id })).body.code, "bad_request", String(id));
  assert.equal(w.portoneCalls().length, 0);
  assert.equal(w.rows[0].checked_at, null);
});

test("confirm: 통과 — API Secret을 PortOne에만 보내고, 이름·전화번호·생년월일·CI는 응답에도 표에도 없음", async () => {
  const w = fakeWorld();
  pending(w);
  const r = await call(w, { action: "confirm", id: ID });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { adult: true, test: true, checkedAt: NOW.toISOString(), expiresAt: "2027-11-05T03:00:00.000Z" });
  const p = w.portoneCalls();
  assert.equal(p.length, 1);
  assert.equal(p[0].url, "https://api.portone.io/identity-verifications/" + ID);
  assert.equal(p[0].headers.authorization, "PortOne " + PORTONE_SECRET);
  w.calls.filter((c) => !c.url.includes("api.portone.io")).forEach((c) => assert.ok(!JSON.stringify(c).includes(PORTONE_SECRET), c.url));
  const stored = JSON.stringify(w.rows),
    sent = JSON.stringify(r.body);
  for (const pii of ["홍길동", "01012345678", "1990-05-05", "CI-VALUE", "DI-VALUE", "MALE"]) {
    assert.ok(!stored.includes(pii), "표: " + pii);
    assert.ok(!sent.includes(pii), "응답: " + pii);
  }
  assert.deepEqual(Object.keys(w.rows[0]).sort(), ["adult", "checked_at", "created_at", "expires_at", "id", "test", "user_id"]);
});

test("confirm: 채널이 LIVE일 때만 test false — 모르면 시험으로 침", async () => {
  for (const [type, want] of [
    ["LIVE", false],
    ["TEST", true],
    [undefined, true],
    ["WEIRD", true]
  ]) {
    const w = fakeWorld();
    pending(w);
    w.portone = { status: "VERIFIED", birthDate: "1990-01-01", type };
    assert.equal((await call(w, { action: "confirm", id: ID })).body.test, want, String(type));
  }
});

test("confirm: 미성년이면 adult false·만료 없음으로 기록", async () => {
  const w = fakeWorld();
  pending(w);
  w.portone = { status: "VERIFIED", birthDate: "2010-03-03", type: "LIVE" };
  const r = await call(w, { action: "confirm", id: ID });
  assert.equal(r.status, 200);
  assert.equal(r.body.adult, false);
  assert.equal(r.body.expiresAt, null);
  assert.equal(w.rows[0].adult, false);
  assert.notEqual(w.rows[0].checked_at, null);
});

test("confirm: 인증이 안 끝났거나 생년월일이 없으면 기록하지 않음(다시 시도 가능)", async () => {
  for (const [portone, status, code] of [
    [{ status: "READY", type: "TEST" }, 409, "not_verified"],
    [{ status: "FAILED", type: "TEST" }, 409, "not_verified"],
    [{ http: 404 }, 409, "not_verified"],
    [{ status: "VERIFIED", type: "TEST", id: "hs" + "f".repeat(32), birthDate: "1990-01-01" }, 409, "not_verified"], // 다른 번호의 결과
    [{ status: "VERIFIED", type: "TEST" }, 422, "no_birth"],
    [{ status: "VERIFIED", type: "TEST", birthDate: "모름" }, 422, "no_birth"],
    [{ http: 401 }, 500, "portone_auth"],
    [{ http: 403 }, 500, "portone_auth"],
    [{ http: 500 }, 502, "upstream"],
    [{ throws: true }, 502, "upstream"]
  ]) {
    const w = fakeWorld();
    pending(w);
    w.portone = portone;
    const r = await call(w, { action: "confirm", id: ID });
    assert.equal(r.status, status, JSON.stringify(portone));
    assert.equal(r.body.code, code, JSON.stringify(portone));
    assert.equal(w.rows[0].checked_at, null);
    assert.equal(w.rows[0].adult, null);
  }
});

test("confirm: 두 번 불려도 같은 결과 — PortOne에 다시 묻지 않음", async () => {
  const w = fakeWorld();
  pending(w);
  const one = await call(w, { action: "confirm", id: ID });
  w.portone = { status: "VERIFIED", birthDate: "2015-01-01", type: "LIVE" }; // 그사이 값이 달라져도
  const two = await call(w, { action: "confirm", id: ID }, { now: new Date(NOW.getTime() + 60000) });
  assert.deepEqual(two.body, one.body);
  assert.equal(w.portoneCalls().length, 1);
});

test("표가 없으면 no_table, PORTONE_STORE_ID가 있으면 쿼리로 보냄", async () => {
  const w = fakeWorld();
  w.noTable = true;
  assert.equal((await call(w, { action: "start" })).body.code, "no_table");
  const s = fakeWorld({ PORTONE_STORE_ID: "store-1" });
  pending(s);
  await call(s, { action: "confirm", id: ID });
  assert.ok(s.portoneCalls()[0].url.endsWith("?storeId=store-1"));
});

test("service 키: 새 secret 키는 apikey로만(토큰을 섞으면 RLS를 따름), 예전 키는 Bearer도", async () => {
  const a = fakeWorld();
  await call(a, { action: "start" });
  a.calls
    .filter((c) => c.url.includes("/rest/v1/"))
    .forEach((c) => {
      assert.equal(c.headers.apikey, SECRET);
      assert.equal(c.headers.authorization, undefined);
    });
  const old = fakeWorld({ SUPABASE_SECRET_KEYS: undefined, SUPABASE_PUBLISHABLE_KEYS: undefined, SUPABASE_SERVICE_ROLE_KEY: "legacy.jwt.key" });
  assert.equal((await call(old, { action: "start" })).status, 200);
  old.calls
    .filter((c) => c.url.includes("/rest/v1/"))
    .forEach((c) => {
      assert.equal(c.headers.apikey, "legacy.jwt.key");
      assert.equal(c.headers.authorization, "Bearer legacy.jwt.key");
    });
});
