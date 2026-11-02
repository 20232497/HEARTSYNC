// 소셜 로그인·그림 넘기기 시험: Supabase와 카카오 로그인 왕복을 page.route로 흉내 냄(실제 서버·계정 없음). 키는 모두 시험용 가짜 값
// 로그인 화면 버튼 3개 → 안 켠 공급자(네이버)는 안내 → PC 게스트 그림 + 카카오로 가입(이메일 없음) → 그림이 계정으로
// → 키 잠금 암호 정하기 → 휴대폰 게스트 그림(같은 인물 다른 칸·번호가 겹치는 직접 만든 칸) + 카카오 로그인 → 합치기 → 그림·칸 합쳐짐
// → 다른 기기 그림을 한 번에 받음 → 틀린 암호·맞는 암호 → 암호를 잊었어요(새로 정함) → PC는 stale → 새 암호로 풂 → 취소 오류
import { chromium, webkit, devices } from "playwright";
const [, , url, out] = process.argv; // out: 스크린샷 폴더(없으면 안 찍음)
const SB = "https://mblvphojbmxiuqnlxisi.supabase.co";
const ENABLED = { kakao: true, google: true }; // custom:naver는 아직 안 켬
const db = { users: {}, tokens: {}, rows: [], n: 0, log: [] };
const now = () => new Date(Date.now() + db.n++).toISOString().replace("Z", "+00:00");
const json = (route, status, body) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: body === undefined ? "" : JSON.stringify(body) });
const pub = (u) => ({ id: u.id, email: u.email || "", app_metadata: { provider: u.provider, providers: [u.provider] } });
function session(u) { const t = "tok" + Math.random().toString(36).slice(2); db.tokens[t] = u.id; return { access_token: t, refresh_token: "r" + t, expires_in: 3600, token_type: "bearer", user: pub(u) }; }
function who(req) { const a = req.headers()["authorization"] || ""; return db.tokens[a.replace("Bearer ", "")] || null; }
function match(row, q) {
  for (const [k, v] of q) {
    if (["select", "order", "limit", "offset", "on_conflict"].includes(k)) continue;
    // or=(key.not.like.img*,key.eq.imgpacks) — 하나라도 맞으면
    if (k === "or") { const parts = v.slice(1, -1).split(",").map((x) => { const i = x.indexOf("."); return [x.slice(0, i), x.slice(i + 1)]; }); if (!parts.some((pt) => match(row, [pt]))) return false; continue; }
    const val = k === "key" ? row.key : k === "updated_at" ? row.updated_at : k === "user_id" ? row.user_id : k === "value->>kid" ? row.value && row.value.kid : null;
    if (v.startsWith("eq.") && val !== v.slice(3)) return false;
    if (v.startsWith("neq.") && val === v.slice(4)) return false;
    if (v.startsWith("gt.") && !(val > v.slice(3))) return false;
    if (v.startsWith("like.") && !String(val).startsWith(v.slice(5).replace("*", ""))) return false;
    if (v.startsWith("not.like.") && String(val).startsWith(v.slice(9).replace("*", ""))) return false;
    if (v.startsWith("in.(")) { const ks = v.slice(4, -1).split(",").map((x) => x.replace(/^"|"$/g, "")); if (!ks.includes(val)) return false; }
  }
  return true;
}
function violates(x) {
  const v = x.value;
  if (x.key === "settings" && v && typeof v === "object" && !Array.isArray(v) && ["apiKey", "runwareKey", "openRouterKey"].some((k) => k in v)) return true;
  if (x.key === "vault" && !(v && typeof v === "object" && v.kid && v.iv && v.ct)) return true;
  return false;
}
const pick = (r, sel) => sel ? Object.fromEntries(sel.split(",").map((k) => [k, r[k]])) : r;
async function handler(route) {
  const req = route.request(), u = new URL(req.url()), p = u.pathname, m = req.method();
  db.log.push(m + " " + p + decodeURIComponent(u.search).slice(0, 90));
  if (m === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" } });
  const body = req.postData() ? JSON.parse(req.postData()) : null;
  if (p === "/auth/v1/authorize") {
    const prov = u.searchParams.get("provider"), back = u.searchParams.get("redirect_to");
    if (!ENABLED[prov]) return json(route, 400, { code: 400, error_code: "validation_failed", msg: prov.startsWith("custom:") ? "Unsupported provider: custom provider " + prov + " not found" : "Unsupported provider: provider is not enabled" });
    // 앱의 확인 요청(fetch)은 실제로는 302(opaqueredirect) — Playwright가 302를 못 흉내 내서 200으로(앱은 400이 아니면 넘어감)
    if (req.resourceType() !== "document") { db.probes = (db.probes || 0) + 1; return route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*" }, body: "" }); }
    // 공급자 화면을 건너뛰고 바로 돌아옴(같은 공급자면 같은 사용자 — 이메일 없음)
    const user = db.users[prov] || (db.users[prov] = { id: "s" + Object.keys(db.users).length + "-0000", provider: prov, email: "" });
    const s = session(user), to = back + "#access_token=" + s.access_token + "&refresh_token=" + s.refresh_token + "&expires_in=3600&token_type=bearer&type=signup";
    return route.fulfill({ status: 200, contentType: "text/html", body: "<script>location.replace(" + JSON.stringify(to) + ")</script>" });
  }
  if (p === "/auth/v1/token") {
    const uid = db.tokens[String(body.refresh_token).slice(1)]; const user = Object.values(db.users).find((x) => x.id === uid); return user ? json(route, 200, session(user)) : json(route, 400, { error_code: "refresh_token_not_found" });
  }
  if (p === "/auth/v1/user") {
    const uid = who(req); const user = Object.values(db.users).find((x) => x.id === uid);
    return user ? json(route, 200, pub(user)) : json(route, 401, {});
  }
  if (p === "/auth/v1/logout") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*" } });
  if (p === "/rest/v1/kv") {
    const uid = who(req); if (!uid) return json(route, 401, { message: "JWT" });
    const q = [...u.searchParams.entries()], prefer = req.headers()["prefer"] || "", sel = u.searchParams.get("select");
    if (m === "GET") {
      let rows = db.rows.filter((r) => r.user_id === uid && match(r, q)).sort((a, b) => a.updated_at < b.updated_at ? -1 : 1);
      const off = +(u.searchParams.get("offset") || 0), lim = +(u.searchParams.get("limit") || 1000);
      return json(route, 200, rows.slice(off, off + lim).map((r) => pick(r, sel)));
    }
    if (m === "POST") {
      const outRows = [];
      for (const x of body) {
        if (x.user_id !== uid) return json(route, 403, { message: "RLS" });
        if (violates(x)) return json(route, 400, { code: "23514", message: "check constraint violated: " + x.key });
        const i = db.rows.findIndex((r) => r.user_id === uid && r.key === x.key);
        if (i >= 0 && prefer.includes("ignore-duplicates")) continue;
        const row = { user_id: uid, key: x.key, value: x.value, updated_at: now() };
        if (i >= 0) db.rows[i] = row; else db.rows.push(row);
        outRows.push(row);
      }
      return prefer.includes("return=representation") ? json(route, 201, outRows.map((r) => pick(r, sel))) : json(route, 201);
    }
    if (m === "PATCH") {
      const hit = db.rows.filter((r) => r.user_id === uid && match(r, q));
      for (const r of hit) { const nx = Object.assign({}, r, body); if (violates(nx)) return json(route, 400, { code: "23514" }); Object.assign(r, body, { updated_at: now() }); }
      return prefer.includes("return=representation") ? json(route, 200, hit.map((r) => pick(r, sel))) : json(route, 204);
    }
    if (m === "DELETE") { db.rows = db.rows.filter((r) => !(r.user_id === uid && match(r, q))); return json(route, 204); }
  }
  return json(route, 404, { message: "mock: unknown " + p });
}
const res = {}, errs = [], browsers = [];
async function device(engine, dev) {
  const browser = await engine.launch(); browsers.push(browser);
  const ctx = await browser.newContext({ ...devices[dev] });
  await ctx.route(SB + "/**", handler);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errs.push(dev + " pageerror: " + e.message));
  page.on("console", (msg) => { if (msg.type() === "error" && !/Failed to load resource/.test(msg.text())) errs.push(dev + " console: " + msg.text().slice(0, 200)); });
  return page;
}
const row = (k) => (db.rows.find((r) => r.key === k) || {}).value;
const plainOnServer = (s) => JSON.stringify(db.rows).includes(s);
const keysOf = (pg) => pg.evaluate(() => ({ apiKey: S.settings.apiKey, runwareKey: S.settings.runwareKey, state: VAULT.state, rec: !!VAULT.rec }));
const meText = async (pg) => { await pg.evaluate(() => { location.hash = "me"; }); await pg.waitForTimeout(500); return pg.evaluate(() => ({ acct: (document.querySelector(".acct-row") || {}).textContent || "", vault: (document.querySelector("#vaultBox") || {}).textContent || "", btn: (document.querySelector("#vUnlock") || {}).textContent || "" })); };
const toasts = (pg) => pg.evaluate(() => Array.from(document.querySelectorAll(".toast")).map((t) => t.textContent));
// 게스트 그림 만들기: 캔버스로 작은 JPEG를 그려 IMG.put → kv:img… 연결
const makeImgs = (pg, plan) => pg.evaluate(async (plan) => {
  const pic = async (color) => { const c = document.createElement("canvas"); c.width = c.height = 40; const g = c.getContext("2d"); g.fillStyle = color; g.fillRect(0, 0, 40, 40); const b = await new Promise((r) => c.toBlob(r, "image/png")); return IMG.put(b); };
  const out = {};
  for (const x of plan.slots) { const ref = await pic(x.color); ((S.imgpacks[x.c] = S.imgpacks[x.c] || {})[x.code] = S.imgpacks[x.c][x.code] || {})[x.sit] = ref; out[x.c + "/" + x.code + "/" + x.sit] = ref; }
  KV.set("imgpacks", S.imgpacks);
  if (plan.cover) { S.coverpacks[plan.cover] = await pic("#123"); KV.set("coverpacks", S.coverpacks); out.cover = S.coverpacks[plan.cover]; }
  if (plan.sits) { S.settings.customSits = plan.sits; }
  if (plan.set) { S.settings.styleSets = [{ id: plan.set, name: "시험 세트", refs: [await pic("#0a0"), await pic("#0b0")], prompt: "illustration", model: IMG_MODELS[0].id }]; out.setRefs = S.settings.styleSets[0].refs; }
  saveSettings();
  return out;
}, plan);
try {
  // ---------- 로그인 화면: 아이폰 SE 폭에서 버튼 3개
  const SE = await device(webkit, "iPhone SE");
  await SE.goto(url, { waitUntil: "load" }); await SE.waitForTimeout(1000);
  res.se = await SE.evaluate(() => ({ hash: location.hash, buttons: Array.from(document.querySelectorAll("[data-oauth]")).map((b) => b.textContent.trim() + "|" + b.dataset.oauth + "|" + Math.round(b.getBoundingClientRect().width)), overflow: document.documentElement.scrollWidth > innerWidth, note: (document.querySelector(".lnote") || {}).textContent }));
  if (out) await SE.screenshot({ path: `${out}/social-login-se.png`, fullPage: true });
  await SE.click("[data-oauth='custom:naver']"); await SE.waitForTimeout(800);
  res.naverOff = { err: await SE.textContent("#loerr"), stillLogin: await SE.evaluate(() => location.hash), btnEnabled: await SE.evaluate(() => !document.querySelector("[data-oauth=kakao]").disabled) };

  // ---------- PC: 게스트로 그림·키를 만든 뒤 카카오로 가입(계정이 빔 → 전부 올림)
  const A = await device(chromium, "Desktop Chrome");
  await A.goto(url, { waitUntil: "load" }); await A.waitForTimeout(1000);
  await A.click("#lguest"); await A.waitForTimeout(300); await A.click(".overlay [data-aud=all]"); await A.waitForTimeout(200);
  await A.evaluate(() => { S.settings.apiKey = "sk-ant-test-fake-A"; saveSettings(); });
  const aImgs = await makeImgs(A, { slots: [{ c: "hasuk", code: "A", sit: 0, color: "#f00" }, { c: "hasuk", code: "A", sit: 15, color: "#f80" }], cover: "hasuk", sits: [{ n: 15, name: "데이트", prompt: "date", rating: "safe" }], set: "setA" });
  await A.evaluate(() => { location.hash = "login"; }); await A.waitForTimeout(400);
  await A.click("[data-oauth=kakao]"); await A.waitForLoadState("load"); await A.waitForTimeout(3500);
  const imgKeysA = Object.values(aImgs).flat().filter((r) => typeof r === "string").map((r) => r.slice(3));
  res.A_login = { hashClean: await A.evaluate(() => !/access_token/.test(location.href)), user: await A.evaluate(() => SB.s && SB.s.user), rowKeys: db.rows.map((r) => r.key).filter((k) => !/^img[a-z0-9]{6,}$/.test(k)).sort(), imgsUploaded: imgKeysA.filter((k) => db.rows.some((r) => r.key === k)).length + "/" + imgKeysA.length, vaultRow: !!row("vault"), toasts: await toasts(A) };
  res.A_me = await meText(A);
  // 키 잠금 암호 정하기(짧음 → 확인 다름 → 정상)
  await A.click("#vUnlock"); await A.waitForTimeout(500);
  await A.fill("#vpw", "short"); await A.fill("#vpw2", "short"); await A.click("#vok"); await A.waitForTimeout(150);
  const e1 = await A.textContent("#verr");
  await A.fill("#vpw", "phrase-one-1"); await A.fill("#vpw2", "phrase-one-2"); await A.click("#vok"); await A.waitForTimeout(150);
  const e2 = await A.textContent("#verr");
  await A.fill("#vpw2", "phrase-one-1"); await A.click("#vok"); await A.waitForTimeout(3500);
  res.A_phrase = { e1, e2, sheet: await A.evaluate(() => !!document.querySelector("#vform")), vault: row("vault") && { kid: row("vault").kid, ct: !!row("vault").ct }, plain: plainOnServer("sk-ant-test-fake-A"), me: (await meText(A)).vault };

  // ---------- 휴대폰: 게스트 그림(같은 인물 다른 칸 + 이름이 다른 15번 칸) → 카카오 로그인 → 합치기
  const B = await device(webkit, "iPhone 13");
  await B.goto(url, { waitUntil: "load" }); await B.waitForTimeout(1000);
  await B.click("#lguest"); await B.waitForTimeout(300); await B.click(".overlay [data-aud=all]"); await B.waitForTimeout(200);
  await B.evaluate(() => { S.settings.runwareKey = "rw-test-fake-B"; saveSettings(); });
  const bImgs = await makeImgs(B, { slots: [{ c: "hasuk", code: "A", sit: 3, color: "#00f" }, { c: "hasuk", code: "A", sit: 0, color: "#0ff" }, { c: "hasuk", code: "A", sit: 15, color: "#f0f" }], sits: [{ n: 15, name: "수영복", prompt: "swimsuit", rating: "safe" }] });
  await B.evaluate(() => { location.hash = "login"; }); await B.waitForTimeout(400);
  await B.click("[data-oauth=kakao]"); await B.waitForLoadState("load"); await B.waitForTimeout(3000);
  res.B_sheet = await B.evaluate(() => { const o = document.querySelector(".overlay .sheet"); return o ? o.textContent.replace(/\s+/g, " ").slice(0, 160) : null; });
  if (out) await B.screenshot({ path: `${out}/social-merge-sheet.png` });
  await B.click("#mYes"); await B.waitForTimeout(3500);
  const packs = await B.evaluate(() => ({ slots: S.imgpacks.hasuk && S.imgpacks.hasuk.A, cover: S.coverpacks.hasuk, sits: S.settings.customSits.map((d) => d.n + ":" + d.name), sets: S.settings.styleSets.map((x) => x.id) }));
  res.B_merged = {
    slot0IsAccount: packs.slots && packs.slots[0] === aImgs["hasuk/A/0"], slot3FromPhone: packs.slots && packs.slots[3] === bImgs["hasuk/A/3"], slot15Date: packs.slots && packs.slots[15] === aImgs["hasuk/A/15"],
    swimMovedTo16: packs.slots && packs.slots[16] === bImgs["hasuk/A/15"], sits: packs.sits, sets: packs.sets, cover: packs.cover === aImgs.cover,
    server: { imgpacks: Object.keys((row("imgpacks") || {}).hasuk.A).sort(), sits: (row("settings").customSits || []).map((d) => d.n + ":" + d.name), phoneImgs: ["hasuk/A/3", "hasuk/A/15"].map((k) => db.rows.some((r) => r.key === bImgs[k].slice(3))) },
    keys: await keysOf(B), toasts: await toasts(B)
  };
  // 계정(PC)의 그림은 휴대폰에 없음 → 그림 칸을 열면 한 번에 받아 옴
  const before = db.log.length;
  res.B_hydrate = await B.evaluate(async (refs) => { const d = document.createElement("div"); d.innerHTML = refs.map((r) => IMG.tag(r)).join(""); document.body.appendChild(d); await IMG.hydrate(d); const ok = Array.from(d.querySelectorAll("img")).filter((i) => /^data:image/.test(i.src)).length; d.remove(); return ok + "/" + refs.length; }, [aImgs["hasuk/A/0"], aImgs["hasuk/A/15"], aImgs.cover, aImgs.setRefs[0]]);
  res.B_hydrateReqs = db.log.slice(before).filter((l) => /rest\/v1\/kv/.test(l)).map((l) => l.slice(0, 70));
  res.B_idbAfter = await B.evaluate(async (k) => typeof (await IDB.get(k)) === "string", aImgs.cover.slice(3));

  // ---------- 휴대폰 키 잠금: 틀린 암호 → 맞는 암호
  res.B_me = await meText(B);
  await B.click("#vUnlock"); await B.waitForTimeout(600);
  await B.fill("#vpw", "wrong-phrase"); await B.click("#vok"); await B.waitForTimeout(3000);
  res.B_wrong = { err: await B.textContent("#verr"), keys: await keysOf(B), vaultKid: row("vault").kid };
  await B.fill("#vpw", "phrase-one-1"); await B.click("#vok"); await B.waitForTimeout(3500);
  res.B_unlock = { keys: await keysOf(B), me: (await meText(B)).vault, plain: plainOnServer("rw-test-fake-B") };
  res.A_gets = await A.evaluate(async () => { await CLOUD.pull(); return { apiKey: S.settings.apiKey, runwareKey: S.settings.runwareKey }; });

  // ---------- 휴대폰: 암호를 잊었어요 → 새로 정함 → PC는 stale → 새 암호로 풂
  const oldKid = row("vault").kid;
  await B.evaluate(() => { VAULT.state = "stale"; paintVault(); }); // 잠금 풀기 창을 띄우려고 상태만 바꿈
  await B.click("#vUnlock"); await B.waitForTimeout(600);
  await B.click("#vreset"); await B.waitForTimeout(600);
  res.B_resetTitle = await B.evaluate(() => (document.querySelector(".overlay h2") || {}).textContent);
  await B.fill("#vpw", "phrase-two-2"); await B.fill("#vpw2", "phrase-two-2"); await B.click("#vok"); await B.waitForTimeout(3500);
  res.B_reset = { kidChanged: row("vault").kid !== oldKid, keys: await keysOf(B) };
  await A.evaluate(() => { S.settings.apiKey = "sk-ant-test-fake-A2"; saveSettings(); }); await A.waitForTimeout(1800);
  res.A_stale = { keys: await keysOf(A), me: await meText(A), serverKid: row("vault").kid !== oldKid };
  await A.click("#vUnlock"); await A.waitForTimeout(600);
  await A.fill("#vpw", "phrase-one-1"); await A.click("#vok"); await A.waitForTimeout(3000);
  const aw = await A.textContent("#verr");
  await A.fill("#vpw", "phrase-two-2"); await A.click("#vok"); await A.waitForTimeout(3500);
  res.A_unlock = { wrongOld: aw, keys: await keysOf(A) };

  // ---------- 취소하고 돌아옴(#error) → 안내
  const D = await device(chromium, "Galaxy S9+");
  await D.goto(url + "#error=access_denied&error_code=access_denied&error_description=User+cancelled+login", { waitUntil: "load" }); await D.waitForTimeout(1500);
  res.cancel = { toasts: await toasts(D), href: await D.evaluate(() => location.href), signedIn: await D.evaluate(() => !!SB.s) };
  await A.setViewportSize({ width: 375, height: 760 }); await meText(A); if (out) await A.screenshot({ path: `${out}/social-me.png` });
} catch (e) { res.fail = String(e).slice(0, 600); }
for (const b of browsers) await b.close();
res.errors = errs;
console.log(JSON.stringify(res, null, 1));
