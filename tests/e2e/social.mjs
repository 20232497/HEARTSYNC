// 소셜 로그인·계정 합치기 시험: Supabase와 카카오 로그인 왕복을 page.route로 흉내 냄(실제 서버·계정 없음). 키는 모두 시험용 가짜 값
// 로그인 화면 버튼 3개 → 안 켠 공급자(네이버)는 안내 → PC 게스트 대화·페르소나 사진 + 카카오로 가입(이메일 없음) → 계정이 비어 전부 올라감
// → 휴대폰 게스트 대화 + 카카오 로그인 → 합치기 → 대화가 합쳐짐 → PC가 받으면 휴대폰 페르소나 사진도 받음 → API 키는 어디에도 안 올라감 → 취소 오류
import { chromium, webkit, devices } from "playwright";
const [, , url, out] = process.argv; // out: 스크린샷 폴더(없으면 안 찍음)
const SB = "https://mblvphojbmxiuqnlxisi.supabase.co";
const ENABLED = { kakao: true, google: true }; // custom:naver는 아직 안 켬
const db = { users: {}, tokens: {}, rows: [], n: 0, log: [] };
const now = () => new Date(Date.now() + db.n++).toISOString().replace("Z", "+00:00");
const json = (route, status, body) =>
  route.fulfill({
    status,
    contentType: "application/json",
    headers: { "access-control-allow-origin": "*" },
    body: body === undefined ? "" : JSON.stringify(body)
  });
const pub = (u) => ({ id: u.id, email: u.email || "", app_metadata: { provider: u.provider, providers: [u.provider] } });
function session(u) {
  const t = "tok" + Math.random().toString(36).slice(2);
  db.tokens[t] = u.id;
  return { access_token: t, refresh_token: "r" + t, expires_in: 3600, token_type: "bearer", user: pub(u) };
}
function who(req) {
  const a = req.headers()["authorization"] || "";
  return db.tokens[a.replace("Bearer ", "")] || null;
}
function match(row, q) {
  for (const [k, v] of q) {
    if (["select", "order", "limit", "offset", "on_conflict"].includes(k)) continue;
    // or=(key.not.like.img*,key.eq.imgpacks) — 하나라도 맞으면
    if (k === "or") {
      const parts = v
        .slice(1, -1)
        .split(",")
        .map((x) => {
          const i = x.indexOf(".");
          return [x.slice(0, i), x.slice(i + 1)];
        });
      if (!parts.some((pt) => match(row, [pt]))) return false;
      continue;
    }
    const val =
      k === "key" ? row.key : k === "updated_at" ? row.updated_at : k === "user_id" ? row.user_id : k === "value->>kid" ? row.value && row.value.kid : null;
    if (v.startsWith("eq.") && val !== v.slice(3)) return false;
    if (v.startsWith("neq.") && val === v.slice(4)) return false;
    if (v.startsWith("gt.") && !(val > v.slice(3))) return false;
    if (v.startsWith("like.") && !String(val).startsWith(v.slice(5).replace("*", ""))) return false;
    if (v.startsWith("not.like.") && String(val).startsWith(v.slice(9).replace("*", ""))) return false;
    if (v.startsWith("in.(")) {
      const ks = v
        .slice(4, -1)
        .split(",")
        .map((x) => x.replace(/^"|"$/g, ""));
      if (!ks.includes(val)) return false;
    }
  }
  return true;
}
function violates(x) {
  const v = x.value;
  if (x.key === "settings" && v && typeof v === "object" && !Array.isArray(v) && ["apiKey", "runwareKey", "openRouterKey"].some((k) => k in v)) return true;
  return false;
}
const pick = (r, sel) => (sel ? Object.fromEntries(sel.split(",").map((k) => [k, r[k]])) : r);
async function handler(route) {
  const req = route.request(),
    u = new URL(req.url()),
    p = u.pathname,
    m = req.method();
  db.log.push(m + " " + p + decodeURIComponent(u.search).slice(0, 90));
  if (m === "OPTIONS")
    return route.fulfill({
      status: 204,
      headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" }
    });
  const body = req.postData() ? JSON.parse(req.postData()) : null;
  if (p === "/auth/v1/authorize") {
    const prov = u.searchParams.get("provider"),
      back = u.searchParams.get("redirect_to");
    if (!ENABLED[prov])
      return json(route, 400, {
        code: 400,
        error_code: "validation_failed",
        msg: prov.startsWith("custom:") ? "Unsupported provider: custom provider " + prov + " not found" : "Unsupported provider: provider is not enabled"
      });
    // 앱의 확인 요청(fetch)은 실제로는 302(opaqueredirect) — Playwright가 302를 못 흉내 내서 200으로(앱은 400이 아니면 넘어감)
    if (req.resourceType() !== "document") {
      db.probes = (db.probes || 0) + 1;
      return route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*" }, body: "" });
    }
    // 공급자 화면을 건너뛰고 바로 돌아옴(같은 공급자면 같은 사용자 — 이메일 없음)
    const user = db.users[prov] || (db.users[prov] = { id: "s" + Object.keys(db.users).length + "-0000", provider: prov, email: "" });
    const s = session(user),
      to = back + "#access_token=" + s.access_token + "&refresh_token=" + s.refresh_token + "&expires_in=3600&token_type=bearer&type=signup";
    return route.fulfill({ status: 200, contentType: "text/html", body: "<script>location.replace(" + JSON.stringify(to) + ")</script>" });
  }
  if (p === "/auth/v1/token") {
    const uid = db.tokens[String(body.refresh_token).slice(1)];
    const user = Object.values(db.users).find((x) => x.id === uid);
    return user ? json(route, 200, session(user)) : json(route, 400, { error_code: "refresh_token_not_found" });
  }
  if (p === "/auth/v1/user") {
    const uid = who(req);
    const user = Object.values(db.users).find((x) => x.id === uid);
    return user ? json(route, 200, pub(user)) : json(route, 401, {});
  }
  if (p === "/auth/v1/logout") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*" } });
  if (p === "/rest/v1/kv") {
    const uid = who(req);
    if (!uid) return json(route, 401, { message: "JWT" });
    const q = [...u.searchParams.entries()],
      prefer = req.headers()["prefer"] || "",
      sel = u.searchParams.get("select");
    if (m === "GET") {
      let rows = db.rows.filter((r) => r.user_id === uid && match(r, q)).sort((a, b) => (a.updated_at < b.updated_at ? -1 : 1));
      const off = +(u.searchParams.get("offset") || 0),
        lim = +(u.searchParams.get("limit") || 1000);
      return json(
        route,
        200,
        rows.slice(off, off + lim).map((r) => pick(r, sel))
      );
    }
    if (m === "POST") {
      const outRows = [];
      for (const x of body) {
        if (x.user_id !== uid) return json(route, 403, { message: "RLS" });
        if (violates(x)) return json(route, 400, { code: "23514", message: "check constraint violated: " + x.key });
        const i = db.rows.findIndex((r) => r.user_id === uid && r.key === x.key);
        if (i >= 0 && prefer.includes("ignore-duplicates")) continue;
        const row = { user_id: uid, key: x.key, value: x.value, updated_at: now() };
        if (i >= 0) db.rows[i] = row;
        else db.rows.push(row);
        outRows.push(row);
      }
      return prefer.includes("return=representation")
        ? json(
            route,
            201,
            outRows.map((r) => pick(r, sel))
          )
        : json(route, 201);
    }
    if (m === "PATCH") {
      const hit = db.rows.filter((r) => r.user_id === uid && match(r, q));
      for (const r of hit) {
        const nx = Object.assign({}, r, body);
        if (violates(nx)) return json(route, 400, { code: "23514" });
        Object.assign(r, body, { updated_at: now() });
      }
      return prefer.includes("return=representation")
        ? json(
            route,
            200,
            hit.map((r) => pick(r, sel))
          )
        : json(route, 204);
    }
    if (m === "DELETE") {
      db.rows = db.rows.filter((r) => !(r.user_id === uid && match(r, q)));
      return json(route, 204);
    }
  }
  return json(route, 404, { message: "mock: unknown " + p });
}
const res = {},
  errs = [],
  browsers = [];
async function device(engine, dev) {
  const browser = await engine.launch();
  browsers.push(browser);
  const ctx = await browser.newContext({ ...devices[dev] });
  await ctx.route(SB + "/**", handler);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errs.push(dev + " pageerror: " + e.message));
  page.on("console", (msg) => {
    if (msg.type() === "error" && !/Failed to load resource/.test(msg.text())) errs.push(dev + " console: " + msg.text().slice(0, 200));
  });
  return page;
}
const row = (k) => (db.rows.find((r) => r.key === k) || {}).value;
const plainOnServer = (s) => JSON.stringify(db.rows).includes(s);
const toasts = (pg) => pg.evaluate(() => Array.from(document.querySelectorAll(".toast")).map((t) => t.textContent));
const check = (ok, what, v) => {
  if (!ok) errs.push(what + ": " + JSON.stringify(v).slice(0, 300));
};
// 게스트 데이터 만들기: 대화방 하나(+ 원하면 페르소나 사진 — 캔버스로 작은 그림을 그려 IMG.put → kv:img…)
const makeGuest = (pg, plan) =>
  pg.evaluate(async (plan) => {
    S.settings.apiKey = plan.key;
    saveSettings();
    const r = newRoom(normalizeChar(getChar(plan.work)), 0, S.personas[0]);
    let img = "";
    if (plan.color) {
      const c = document.createElement("canvas");
      c.width = c.height = 40;
      const g = c.getContext("2d");
      g.fillStyle = plan.color;
      g.fillRect(0, 0, 40, 40);
      img = await IMG.put(await new Promise((z) => c.toBlob(z, "image/png")));
      S.personas.push({ id: uid("p"), name: plan.persona, memo: "", desc: "", img, def: false });
      KV.set("personas", S.personas);
    }
    return { room: r.id, img };
  }, plan);
try {
  // ---------- 로그인 화면: 아이폰 SE 폭에서 버튼 3개
  const SE = await device(webkit, "iPhone SE");
  await SE.goto(url, { waitUntil: "load" });
  await SE.waitForTimeout(1000);
  res.se = await SE.evaluate(() => ({
    hash: location.hash,
    buttons: Array.from(document.querySelectorAll("[data-oauth]")).map((b) => b.dataset.oauth),
    overflow: document.documentElement.scrollWidth > innerWidth
  }));
  check(res.se.hash === "#login" && res.se.buttons.join() === "kakao,custom:naver,google" && !res.se.overflow, "로그인 화면", res.se);
  if (out) await SE.screenshot({ path: `${out}/social-login-se.png`, fullPage: true });
  await SE.click("[data-oauth='custom:naver']");
  await SE.waitForTimeout(800);
  res.naverOff = {
    err: await SE.textContent("#loerr"),
    hash: await SE.evaluate(() => location.hash),
    btnEnabled: await SE.evaluate(() => !document.querySelector("[data-oauth=kakao]").disabled)
  };
  check(/준비 중/.test(res.naverOff.err) && res.naverOff.hash === "#login" && res.naverOff.btnEnabled, "안 켠 공급자", res.naverOff);

  // ---------- PC: 게스트로 대화·페르소나 사진·키를 만든 뒤 카카오로 가입(계정이 빔 → 전부 올림)
  const A = await device(chromium, "Desktop Chrome");
  await A.goto(url, { waitUntil: "load" });
  await A.waitForTimeout(1000);
  await A.click("#lguest");
  await A.waitForTimeout(300);
  await A.click(".overlay [data-aud=all]");
  await A.waitForTimeout(200);
  const a = await makeGuest(A, { key: "sk-ant-test-fake-A", work: "hasuk", color: "#f00", persona: "PC 사진" });
  await A.evaluate(() => {
    location.hash = "login";
  });
  await A.waitForTimeout(400);
  await A.click("[data-oauth=kakao]");
  await A.waitForLoadState("load");
  await A.waitForTimeout(3500);
  res.A_login = {
    hashClean: await A.evaluate(() => !/access_token/.test(location.href)),
    user: await A.evaluate(() => SB.s && SB.s.user && SB.s.user.provider),
    rowKeys: db.rows
      .map((r) => r.key)
      .filter((k) => !/^img[a-z0-9]{6,}$/.test(k))
      .sort(),
    img: db.rows.some((r) => r.key === a.img.slice(3)),
    toasts: await toasts(A)
  };
  check(
    res.A_login.hashClean &&
      res.A_login.user === "kakao" &&
      ["personas", "rooms", "room-" + a.room, "settings", "wallet"].every((k) => res.A_login.rowKeys.includes(k)) &&
      res.A_login.img,
    "PC 가입 뒤 올리기",
    res.A_login
  );
  check(!res.A_login.rowKeys.some((k) => /vault|imgpacks|mine|tagpacks/.test(k)), "올리지 않는 칸", res.A_login.rowKeys);
  await A.evaluate(() => {
    location.hash = "me";
  });
  await A.waitForTimeout(500);
  res.A_me = await A.evaluate(() => ({
    acct: ($(".acct-row") || {}).textContent || "",
    syncKeys: !!$("#syncKeys"),
    vault: !!$("#vaultBox"),
    sync: !!$("#cSync")
  }));
  check(/카카오/.test(res.A_me.acct) && !res.A_me.syncKeys && !res.A_me.vault && res.A_me.sync, "MY 계정 칸", res.A_me);

  // ---------- 휴대폰: 게스트 대화 → 카카오 로그인 → 합치기
  const B = await device(webkit, "iPhone 13");
  await B.goto(url, { waitUntil: "load" });
  await B.waitForTimeout(1000);
  await B.click("#lguest");
  await B.waitForTimeout(300);
  await B.click(".overlay [data-aud=all]");
  await B.waitForTimeout(200);
  const b = await makeGuest(B, { key: "sk-ant-test-fake-B", work: "seodoyun", color: "#00f", persona: "폰 사진" });
  await B.evaluate(() => {
    location.hash = "login";
  });
  await B.waitForTimeout(400);
  await B.click("[data-oauth=kakao]");
  await B.waitForLoadState("load");
  await B.waitForTimeout(3000);
  res.B_sheet = await B.evaluate(() => {
    const o = document.querySelector(".overlay .sheet");
    return o ? o.textContent.replace(/\s+/g, " ").slice(0, 160) : null;
  });
  check(/대화 1개/.test(res.B_sheet || ""), "합치기 창", res.B_sheet);
  if (out) await B.screenshot({ path: `${out}/social-merge-sheet.png` });
  await B.click("#mYes");
  await B.waitForTimeout(3500);
  res.B_merged = await B.evaluate(() => ({
    rooms: S.rooms.map((r) => r.charId).sort(),
    personas: S.personas.map((p) => p.name),
    defs: S.personas.filter((p) => p.def).length,
    apiKey: S.settings.apiKey
  }));
  res.B_server = {
    rooms: (row("rooms") || []).map((r) => r.charId).sort(),
    roomRow: !!row("room-" + b.room),
    personas: (row("personas") || []).map((p) => p.name),
    img: db.rows.some((r) => r.key === b.img.slice(3))
  };
  check(
    res.B_merged.rooms.join() === "hasuk,seodoyun" &&
      res.B_merged.personas.includes("PC 사진") &&
      res.B_merged.personas.includes("폰 사진") &&
      res.B_merged.defs === 1 &&
      res.B_merged.apiKey === "sk-ant-test-fake-B",
    "휴대폰 합친 뒤",
    res.B_merged
  );
  check(
    res.B_server.rooms.join() === "hasuk,seodoyun" && res.B_server.roomRow && res.B_server.personas.includes("폰 사진") && res.B_server.img,
    "합친 뒤 계정",
    res.B_server
  );

  // ---------- PC가 받으면 휴대폰 대화·페르소나 사진(그림 본문은 계정에서 한 장씩)도 보임
  res.A_pull = await A.evaluate(async (ref) => {
    const n = await CLOUD.pull();
    if (n) await reloadFromCloud();
    const d = document.createElement("div");
    d.innerHTML = IMG.tag(ref);
    document.body.appendChild(d);
    await IMG.hydrate(d);
    const ok = /^data:image/.test((d.querySelector("img") || {}).src || "");
    d.remove();
    return { rooms: S.rooms.map((r) => r.charId).sort(), photo: ok, apiKey: S.settings.apiKey };
  }, b.img);
  check(res.A_pull.rooms.join() === "hasuk,seodoyun" && res.A_pull.photo && res.A_pull.apiKey === "sk-ant-test-fake-A", "PC가 받은 뒤", res.A_pull);
  res.plain = ["sk-ant-test-fake-A", "sk-ant-test-fake-B"].filter(plainOnServer);
  check(!res.plain.length, "API 키가 계정에 올라감", res.plain);

  // ---------- 취소하고 돌아옴(#error) → 안내
  const D = await device(chromium, "Galaxy S9+");
  await D.goto(url + "#error=access_denied&error_code=access_denied&error_description=User+cancelled+login", { waitUntil: "load" });
  await D.waitForTimeout(1500);
  res.cancel = { toasts: await toasts(D), href: await D.evaluate(() => location.href), signedIn: await D.evaluate(() => !!SB.s) };
  check(res.cancel.toasts.length && !/error=/.test(res.cancel.href) && !res.cancel.signedIn, "취소 안내", res.cancel);
  await A.setViewportSize({ width: 375, height: 760 });
  await A.evaluate(() => {
    location.hash = "me";
  });
  await A.waitForTimeout(400);
  if (out) await A.screenshot({ path: `${out}/social-me.png` });
} catch (e) {
  res.fail = String(e).slice(0, 600);
}
for (const br of browsers) await br.close();
res.errors = errs;
console.log(JSON.stringify(res, null, 1));
