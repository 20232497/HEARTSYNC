/* ---------------------------------------------------------------- MY */
/* ---------------------------------------------------------------- 로그인·계정 (Supabase, 계정 저장은 CLOUD) */
function viewLogin() {
  const v = $("#view");
  if (!SB.on() || SB.s) {
    v.innerHTML = `<div class="page"><div class="login-page"><div class="login-card">${LOGO}
      <p class="lead">${!SB.on() ? (IN_CLAUDE ? "claude.ai 안에서는 claude.ai 계정에 자동으로 저장돼요." : "계정 서버가 아직 연결되지 않았어요.") : `<b>${esc(acctName())}</b>(으)로 로그인되어 있어요.`}</p>
      <button class="btn pri block" data-go="home">홈으로</button>${SB.s ? `<div class="lrow"><button type="button" class="lnk" data-go="me">MY에서 계정 관리</button></div>` : ""}</div></div></div>`;
    bindGo(v); return;
  }
  let mode = "in";
  v.innerHTML = `<div class="page"><div class="login-page"><div class="login-card">
    ${LOGO}
    <p class="lead">로그인하면 PC와 휴대폰에서<br>대화·작품·설정이 그대로 이어져요.</p>
    <div class="seg" id="lmode"><button type="button" data-m="in" class="on">로그인</button><button type="button" data-m="up">회원가입</button></div>
    <form id="lform" novalidate>
      <div class="field"><label for="lmail">이메일</label><input id="lmail" type="email" autocomplete="email" inputmode="email" autocapitalize="off" spellcheck="false" maxlength="120"></div>
      <div class="field"><label for="lpw">비밀번호 <span class="note" id="lpwHint"></span></label><input id="lpw" type="password" autocomplete="current-password" maxlength="72"></div>
      <div class="field" id="lpw2Box" hidden><label for="lpw2">비밀번호 확인</label><input id="lpw2" type="password" autocomplete="new-password" maxlength="72"></div>
      <p class="lerr" id="lerr" role="alert"></p>
      <button class="btn pri block" id="lgo" type="submit">로그인</button>
    </form>
    <div class="lrow"><button type="button" class="lnk" id="lforgot">비밀번호를 잊었어요</button></div>
    <div class="lsep"><span>또는</span></div>
    <div class="oauth-list" id="loauth">${PROVIDERS.map(([k, n]) => `<button type="button" class="btn block oauth-btn ${k.replace("custom:", "")}" data-oauth="${k}">${OAUTH_ICONS[k]}<span>${n}로 시작하기</span></button>`).join("")}</div>
    <p class="lerr" id="loerr" role="alert"></p>
    <p class="note lnote">이메일이 없어도 카카오·네이버·Google 계정으로 바로 가입돼요.</p>
    <button type="button" class="btn ghost block" id="lguest">로그인 없이 둘러보기</button>
    <p class="note">처음 로그인할 때 이 기기에 있던 대화·작품·그림을 계정으로 옮길 수 있어요. API 키는 로그인 비밀번호(소셜 로그인은 따로 정하는 키 잠금 암호)로 이 기기에서 암호화한 뒤 저장해서 서버에서도 볼 수 없어요(MY → 계정에서 끌 수 있어요).</p>
    <p class="note lpriv"><a href="privacy.html">개인정보처리방침</a></p>
  </div></div></div>`;
  const err = $("#lerr"), go2 = $("#lgo"), say = (t, ok) => { err.textContent = t; err.classList.toggle("ok", !!ok); };
  $$("#lmode button").forEach((b) => b.onclick = () => {
    mode = b.dataset.m; $$("#lmode button").forEach((x) => x.classList.toggle("on", x === b));
    $("#lpw2Box").hidden = mode !== "up"; $("#lpw").autocomplete = mode === "up" ? "new-password" : "current-password";
    go2.textContent = mode === "up" ? "회원가입" : "로그인"; $("#lforgot").hidden = mode === "up"; $("#lpwHint").textContent = mode === "up" ? "8자 이상" : ""; say("");
  });
  $("#lform").onsubmit = async (e) => {
    e.preventDefault();
    const email = $("#lmail").value.trim(), pw = $("#lpw").value;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return say("이메일 주소를 확인해 주세요.");
    // 가입은 8자 이상 — 비밀번호가 API 키 잠금에도 쓰임
    if (mode === "up" && pw.length < 8) return say("비밀번호는 8자 이상으로 정해 주세요.");
    if (pw.length < 6) return say("비밀번호는 6자 이상이에요.");
    if (mode === "up" && pw !== $("#lpw2").value) return say("비밀번호 확인이 달라요.");
    go2.disabled = true; go2.textContent = "확인하는 중…"; say("");
    try {
      if (mode === "in") { await SB.signIn(email, pw); await VAULT.fromPassword(pw, SB.s.user.id); return loggedIn(); }
      const st = await SB.signUp(email, pw);
      await VAULT.fromPassword(pw, SB.lastUid); // 인증 메일 링크를 이 브라우저에서 열면 바로 키를 잠글 수 있게
      if (st === "in") return loggedIn();
      say("인증 메일을 보냈어요. 메일의 링크를 누르면 바로 로그인돼요. 메일이 안 보이면 스팸함도 확인해 주세요.", true);
    } catch (x) { say((x && x.msg) || "로그인하지 못했어요."); }
    go2.disabled = false; go2.textContent = mode === "up" ? "회원가입" : "로그인";
  };
  $("#lforgot").onclick = async () => {
    const email = $("#lmail").value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return say("비밀번호를 다시 정할 이메일을 먼저 적어 주세요.");
    try { await SB.recover(email); say("비밀번호 재설정 메일을 보냈어요. 메일의 링크를 눌러 새 비밀번호를 정해 주세요.", true); }
    catch (x) { say((x && x.msg) || "메일을 보내지 못했어요."); }
  };
  $("#lguest").onclick = () => { try { localStorage.setItem("hv1_guest", "1"); } catch {} go("home"); setTimeout(() => { if (!AUDS[S.settings.audience]) audSheet(true); }, 80); };
  // 소셜 로그인 = 가입(처음이면 계정이 저절로 만들어짐). 대시보드에서 아직 안 켠 공급자는 안내만
  const obs = $$("[data-oauth]", v), lock = (on) => obs.forEach((x) => { x.disabled = on; });
  obs.forEach((b) => b.onclick = async () => {
    const oerr = $("#loerr");
    lock(true); say(""); oerr.textContent = "";
    const ok = await SB.oauth(b.dataset.oauth);
    if (!ok) oerr.textContent = provName(b.dataset.oauth) + " 로그인은 아직 준비 중이에요. 이메일이나 다른 방법으로 시작해 주세요.";
    setTimeout(() => lock(false), ok ? 4000 : 0); // 넘어갔다가 뒤로 돌아와도 다시 누를 수 있게
  });
}
async function loggedIn() {
  try { localStorage.removeItem("hv1_guest"); } catch {}
  toast("로그인했어요");
  go("home");
  await new Promise((r) => setTimeout(r, 80));
  await afterLogin(true);
  if (!AUDS[S.settings.audience]) audSheet(true);
}
/* 로그인 직후(fresh)는 계정과 이 기기를 맞추고, 그 밖에는 바뀐 것만 받아 옴 */
async function afterLogin(fresh) {
  CLOUD.start();
  if (!CLOUD.on) return;
  try {
    // 그림 칸 연결 합치기는 받아 오기(pull)보다 먼저 — 받은 값이 이 기기 칸을 덮기 전에
    if (fresh) { await firstSync(); await fixImgpacks(true); }
    else { const fixed = await fixImgpacks(false); if ((await CLOUD.pull()) || fixed) await reloadFromCloud(); }
    CLOUD.setState(CLOUD.state === "notable" ? "notable" : "ok");
  } catch (e) { if (!CLOUD.noTable) CLOUD.setState("err"); }
  const ph = VAULT.phrase();
  if (fresh && VAULT.state === "locked") setTimeout(() => toast(ph ? "계정의 API 키를 받으려면 MY → 계정에서 키 잠금 암호를 넣어 주세요" : "계정의 API 키를 받으려면 MY → 계정에서 비밀번호를 한 번 넣어 주세요"), 1500);
  else if (fresh && ph && !VAULT.rec && S.settings.syncKeys !== false && VAULT_FIELDS.some((f) => S.settings[f])) setTimeout(() => toast("API 키도 계정에 저장하려면 MY → 계정에서 키 잠금 암호를 정해 주세요"), 1500);
}
// 예전 버전은 계정에서 그림 칸 연결(imgpacks)을 받지 않아 기기마다 따로 놀았음 → 기기·계정마다 한 번, 계정 것과 합쳐(이 기기 것이 우선) 다시 올림
async function fixImgpacks(fresh) {
  const flag = "hv1_cloudfix_" + CLOUD.uid;
  try { if (localStorage.getItem(flag)) return false; } catch { return false; }
  let changed = false;
  if (!fresh) {
    const r = await SB.req("/rest/v1/kv?select=value&key=eq.imgpacks"); await CLOUD.check(r);
    const j = await r.json(), remote = j[0] ? j[0].value : null, mine = KV.getLocal("imgpacks") || {};
    const merged = fillIn(mine, remote);
    changed = JSON.stringify(merged) !== JSON.stringify(mine);
    if (changed || (Object.keys(mine).length && JSON.stringify(merged) !== JSON.stringify(remote))) KV.set("imgpacks", merged);
  }
  try { localStorage.setItem(flag, "1"); } catch {}
  return changed;
}
async function firstSync() {
  try { localStorage.removeItem(CLOUD.lastKey()); } catch {}
  const rows = await CLOUD.rows("");
  const remote = {}; rows.forEach((x) => { remote[x.key] = x.value; });
  // 계정이 비었으면 이 기기 데이터가 계정의 첫 데이터(API 키는 잠가서 따로 — VAULT)
  if (!rows.some((x) => x.key !== "settings" && x.key !== "vault")) { await CLOUD.pushAll(); await VAULT.take(remote.vault || null, true); toast("이 기기의 데이터를 계정에 저장했어요"); return; }
  const local = { rooms: S.rooms, mine: S.mine, personas: S.personas, imgpacks: S.imgpacks, coverpacks: S.coverpacks, lorepacks: S.lorepacks, tagpacks: S.tagpacks, ponytags: KV.getLocal("ponytags"),
    customSits: S.settings.customSits, styleSets: S.settings.styleSets };
  const has = (list, id) => (Array.isArray(list) ? list : []).some((x) => x && x.id === id);
  const onlyRooms = local.rooms.filter((r) => !has(remote.rooms, r.id)), onlyMine = local.mine.filter((c) => !has(remote.mine, c.id)), pics = guestPics(remote, local);
  const use = async (merge) => {
    CLOUD.apply(rows);
    await VAULT.take(CLOUD.takeVault() || null, true);
    if (merge) { mergeGuest(remote, local); await CLOUD.pushAll([]); }
    await reloadFromCloud();
    toast(merge ? "이 기기의 데이터를 계정에 합쳤어요" : "계정 데이터를 불러왔어요");
  };
  if (!onlyRooms.length && !onlyMine.length && !pics) return use(false);
  const what = [onlyRooms.length ? `대화 ${onlyRooms.length}개` : "", onlyMine.length ? `작품 ${onlyMine.length}개` : "", pics ? `그림 ${pics}장` : ""].filter(Boolean).join("·");
  const ov = sheet(`<h2>이 기기의 데이터를 합칠까요?</h2><p class="sub">계정에 이미 저장된 데이터가 있어요. 이 기기에만 있는 데이터(${what})를 계정에 합칠 수 있어요. 계정에 있던 것은 그대로 남아요.</p>
    <div class="cta-row"><button class="btn ghost" id="mNo">계정 것만 쓰기</button><span class="spacer"></span><button class="btn pri" id="mYes">합치기</button></div>`);
  return new Promise((res) => {
    let done = false;
    const pick = async (merge) => { if (done) return; done = true; ov.remove(); await use(merge); res(); };
    $("#mYes", ov).onclick = () => pick(true); $("#mNo", ov).onclick = () => pick(false);
    ov.addEventListener("click", (e) => { if (e.target === ov) pick(true); }); // 그냥 닫으면 아무것도 잃지 않게 합침
  });
}
function isObj(x) { return !!x && typeof x === "object" && !Array.isArray(x); }
// a는 그대로 두고 빈 자리만 b로 채움 — 객체는 안쪽까지(그림 칸 하나하나)
function fillIn(a, b) {
  const out = Object.assign({}, isObj(a) ? a : {});
  Object.keys(isObj(b) ? b : {}).forEach((k) => { const x = out[k], y = b[k]; if (x == null || x === "") out[k] = y; else if (isObj(x) && isObj(y)) out[k] = fillIn(x, y); });
  return out;
}
// 이 기기에만 있는 그림 수(작품 그림 칸·표지·세계관 일러스트 중 계정에서 비어 있는 자리 + 계정에 없는 그림체 세트의 그림)
function guestPics(remote, local) {
  let n = 0;
  const walk = (a, b) => Object.keys(b || {}).forEach((k) => { const y = isObj(a) ? a[k] : undefined; if (isObj(b[k])) walk(y, b[k]); else if (validRef(b[k]) && !y) n++; });
  walk(remote.imgpacks, guestPacks(remote, local).imgpacks);
  ["coverpacks", "lorepacks"].forEach((k) => walk(remote[k], local[k]));
  const rs = isObj(remote.settings) && Array.isArray(remote.settings.styleSets) ? remote.settings.styleSets : [];
  (local.styleSets || []).forEach((x) => { if (x && !rs.some((y) => y && y.id === x.id)) n += (x.refs || []).filter(validRef).length; });
  return n;
}
// 직접 만든 이미지 칸(15번~): 계정 칸에 이 기기에만 있는 칸을 더함. 같은 이름이면 계정 번호로, 번호만 겹치면 빈 번호로 옮김
// → { sits, move: {이 기기 번호: 계정 번호(자리가 없으면 -1)} }
function mergeSits(remote, local) {
  const sits = (Array.isArray(remote) ? remote : []).slice(), move = {}, num = {};
  sits.forEach((d) => { num[d.name] = d.n; });
  (Array.isArray(local) ? local : []).forEach((d) => {
    if (!d || !Number.isInteger(d.n)) return;
    if (d.name in num) { if (num[d.name] !== d.n) move[d.n] = num[d.name]; return; }
    let n = d.n;
    if (sits.some((x) => x.n === n)) { n = CUSTOM_BASE; while (sits.some((x) => x.n === n)) n++; }
    if (sits.length >= CUSTOM_MAX || n >= 100) { move[d.n] = -1; return; }
    sits.push(Object.assign({}, d, { n })); num[d.name] = n;
    if (n !== d.n) move[d.n] = n;
  });
  return { sits, move };
}
// 칸 번호로 된 객체({번호: 값})의 번호를 옮김(-1은 뺌)
function moveSits(o, move) {
  if (!isObj(o)) return o;
  const out = {};
  Object.keys(o).forEach((k) => { const to = k in move ? move[k] : k; if (to !== -1 && !(to in out && out[to])) out[to] = o[k]; });
  return out;
}
// 이 기기의 그림 칸(imgpacks[작품][인물][칸])·저장 태그를 계정의 칸 번호에 맞춤 → { sits(합친 칸 정의), imgpacks, tagpacks }
// 계정 설정에 직접 만든 칸 목록이 없으면 이 기기 목록이 그대로 남음
function guestPacks(remote, local) {
  const rs = isObj(remote.settings) && Array.isArray(remote.settings.customSits) ? remote.settings.customSits : local.customSits;
  const ms = mergeSits(rs, local.customSits), mv = Object.keys(ms.move).length;
  const each = (packs, f) => { const out = {}; Object.keys(packs || {}).forEach((c) => { const by = packs[c]; out[c] = {}; Object.keys(isObj(by) ? by : {}).forEach((code) => { out[c][code] = mv ? f(by[code]) : by[code]; }); }); return out; };
  return { sits: ms.sits, imgpacks: each(local.imgpacks, (o) => moveSits(o, ms.move)), tagpacks: each(local.tagpacks, (t) => isObj(t) ? Object.assign({}, t, { sits: moveSits(t.sits, ms.move) }) : t) };
}
// 계정 값 위에 이 기기에만 있던 대화·작품·페르소나·그림 연결을 더함(같은 것이 있으면 계정 값)
function mergeGuest(remote, local) {
  const list = (a) => Array.isArray(a) ? a : [];
  const byId = (a, b) => { const ids = new Set(list(a).map((x) => x && x.id)); return list(a).concat(list(b).filter((x) => x && !ids.has(x.id))); };
  KV.set("rooms", byId(remote.rooms, local.rooms).sort((x, y) => (y.at || 0) - (x.at || 0)));
  local.rooms.forEach((r) => { if (!list(remote.rooms).some((x) => x.id === r.id)) { const v = KV.getLocal(roomKey(r.id)); if (v) KV.set(roomKey(r.id), v); } });
  KV.set("mine", byId(remote.mine, local.mine));
  const ps = byId(remote.personas, list(local.personas).map((p) => Object.assign({}, p, { def: false })));
  if (ps.length && !ps.some((p) => p.def)) ps[0].def = true;
  if (ps.length) KV.set("personas", ps);
  // 직접 만든 칸·그림체 세트(설정)도 합침 — 칸 번호가 옮겨지면 그 칸의 그림·저장 태그도 같이 옮김
  const gp = guestPacks(remote, local);
  const sets = list(S.settings.styleSets), add = list(local.styleSets).filter((x) => x && !sets.some((y) => y && y.id === x.id));
  if (gp.sits.length !== list(S.settings.customSits).length || add.length) { S.settings.customSits = gp.sits; S.settings.styleSets = sets.concat(add); saveSettings(); }
  const packs = { imgpacks: gp.imgpacks, coverpacks: local.coverpacks, lorepacks: local.lorepacks, tagpacks: gp.tagpacks, ponytags: local.ponytags };
  // 계정 값은 그대로 두고 빈 자리만 이 기기 값으로(같은 인물의 다른 칸 그림도 살림)
  Object.keys(packs).forEach((k) => { if (packs[k] && Object.keys(packs[k]).length) KV.set(k, fillIn(remote[k], packs[k])); });
}
// 계정에서 받은 것을 화면에 반영(입력 중이거나 응답을 받는 중이면 화면은 그대로)
async function reloadFromCloud() {
  await loadAll(); applySettings(); renderRailRecent(); renderWalletChips();
  const h = location.hash.slice(1) || "home", typing = document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
  if (!gen && !typing && !h.startsWith("r-") && !h.startsWith("studio")) route();
}
function newPasswordSheet() {
  const ov = sheet(`<h2>새 비밀번호</h2><p class="sub">재설정 링크로 들어왔어요. 새 비밀번호를 정해 주세요.</p>
    <div class="field"><label for="npw">새 비밀번호 (8자 이상)</label><input id="npw" type="password" autocomplete="new-password" maxlength="72"></div><p class="lerr" id="nerr"></p>
    <div class="cta-row"><span class="spacer"></span><button class="btn ghost" data-x>나중에</button><button class="btn pri" id="nok">바꾸기</button></div>`);
  $("#nok", ov).onclick = async () => {
    const pw = $("#npw", ov).value;
    if (pw.length < 8) { $("#nerr", ov).textContent = "8자 이상으로 정해 주세요."; return; }
    try {
      await SB.setPassword(pw); ov.remove(); toast("비밀번호를 바꿨어요");
      // API 키를 새 비밀번호로 다시 잠가 올림(다른 기기는 MY → 계정에서 새 비밀번호를 한 번 넣으면 받음)
      if (await VAULT.fromPassword(pw, SB.s.user.id)) await VAULT.write(true).catch(() => {});
    } catch (x) { $("#nerr", ov).textContent = (x && x.msg) || "바꾸지 못했어요."; }
  };
}
// MY → 계정의 API 키 잠금 상태
function vaultHTML() {
  if (S.settings.syncKeys === false) return `<p class="note">API 키는 이 기기에만 있어요.</p>`;
  if (!VAULT.ok()) return `<p class="note">이 브라우저는 암호화를 지원하지 않아 API 키는 이 기기에만 둬요.</p>`;
  const ph = VAULT.phrase();
  if (ph && !VAULT.rec && VAULT.state !== "locked") return `<div class="vault-lock"><span>🔑 비밀번호 없이 가입한 계정이에요. 키 잠금 암호를 한 번 정하면 API 키를 암호화해 계정에 저장해요.</span><button class="btn sm" id="vUnlock">암호 정하기</button></div>`;
  if (!VAULT.rec || VAULT.state === "stale") return `<div class="vault-lock"><span>🔒 ${VAULT.rec ? (ph ? "다른 기기에서 키 잠금 암호를 새로 정했어요. 새 암호를 넣으면 API 키를 받아요." : "다른 기기에서 비밀번호가 바뀌었어요. 새 비밀번호를 넣으면 API 키를 받아요.") : ph ? "계정의 API 키가 잠겨 있어요. 키 잠금 암호를 한 번 넣으면 받아요." : "계정의 API 키가 잠겨 있어요. 로그인 비밀번호를 한 번 넣으면 받아요."}</span><button class="btn sm" id="vUnlock">${ph ? "암호 입력" : "비밀번호 입력"}</button></div>`;
  return `<p class="note">🔐 API 키는 ${ph ? "키 잠금 암호" : "로그인 비밀번호"}로 이 기기에서 암호화한 뒤 올려요. 서버와 관리자도 키를 볼 수 없어요.</p>`;
}
function paintVault() { const el = $("#vaultBox"); if (!el) return; el.innerHTML = vaultHTML(); const b = $("#vUnlock", el); if (b) b.onclick = () => { if (VAULT.phrase()) phraseSheet(); else vaultSheet(); }; }
// 비밀번호 없는 계정의 키 잠금 암호: 계정에 잠긴 키가 없으면 정하고, 있으면 넣어서 풂(reset: 잊어서 새로 정함 — 계정의 잠긴 키는 이 기기 키로 바뀜)
async function phraseSheet(reset) {
  if (!SB.s) return;
  let box;
  try { box = await VAULT.remote(); } catch { toast("계정에 연결하지 못했어요. 잠시 뒤 다시 해 주세요"); return; }
  const make = !box || !!reset;
  const ov = sheet(`<h2>${!make ? "API 키 잠금 풀기" : box ? "키 잠금 암호 새로 정하기" : "키 잠금 암호 정하기"}</h2>
    <p class="sub">${!make ? "계정의 API 키는 키 잠금 암호로 잠겨 있어요. 이 기기에서 한 번만 넣으면 돼요."
      : box ? "계정에 잠겨 있던 API 키는 지워지고, 이 기기의 API 키를 새 암호로 잠가 올려요. 다른 기기에서는 새 암호를 한 번 넣어야 해요."
      : "비밀번호 없이 가입한 계정이라 API 키를 잠글 암호를 따로 정해요. 다른 기기에서 이 암호를 한 번 넣으면 키를 받아요. 암호는 어디에도 저장되지 않아 잊으면 찾을 수 없어요."}</p>
    <form id="vform"><div class="field"><label for="vpw">키 잠금 암호${make ? " (8자 이상)" : ""}</label><input id="vpw" type="password" autocomplete="${make ? "new-password" : "current-password"}" maxlength="72"></div>
    ${make ? `<div class="field"><label for="vpw2">암호 확인</label><input id="vpw2" type="password" autocomplete="new-password" maxlength="72"></div>` : ""}
    <p class="lerr" id="verr" role="alert"></p>
    ${make ? "" : `<div class="lrow"><button type="button" class="lnk" id="vreset">암호를 잊었어요</button></div>`}
    <div class="cta-row"><span class="spacer"></span><button type="button" class="btn ghost" data-x>나중에</button><button class="btn pri" id="vok" type="submit">${make ? "정하기" : "풀기"}</button></div></form>`);
  const rb = $("#vreset", ov); if (rb) rb.onclick = () => { ov.remove(); phraseSheet(true); };
  $("#vform", ov).onsubmit = async (e) => {
    e.preventDefault();
    const pw = $("#vpw", ov).value, btn = $("#vok", ov), err = $("#verr", ov), uid = SB.s && SB.s.user.id;
    if (!pw || !uid) return;
    if (make && pw.length < 8) { err.textContent = "8자 이상으로 정해 주세요."; return; }
    if (make && pw !== $("#vpw2", ov).value) { err.textContent = "암호 확인이 달라요."; return; }
    btn.disabled = true; btn.textContent = "확인하는 중…"; err.textContent = "";
    try {
      if (!(await VAULT.fromPhrase(pw, uid, make ? null : box))) throw { msg: make ? "이 브라우저에서는 키를 잠글 수 없어요." : "암호가 맞지 않아요." };
      let n = 0;
      if (!make) n = await VAULT.take(box, true);
      else if (box) await VAULT.write(true);
      else { await VAULT.write(); if (VAULT.state === "stale") { VAULT.unset(); throw { msg: "다른 기기에서 먼저 암호를 정했어요. 그 암호를 넣어 주세요." }; } }
      ov.remove(); toast(!make ? (n ? "계정의 API 키를 받았어요" : "키 잠금을 풀었어요") : "키 잠금 암호를 정했어요. API 키는 암호화해 계정에 저장해요");
      if (location.hash === "#me") viewMe(); else paintVault();
    } catch (x) { err.textContent = (x && x.msg) || "잠시 뒤 다시 해 주세요."; btn.disabled = false; btn.textContent = make ? "정하기" : "풀기"; }
  };
}
function vaultSheet() {
  if (!SB.s) return;
  const ov = sheet(`<h2>API 키 잠금 풀기</h2><p class="sub">계정의 API 키는 로그인 비밀번호로 잠겨 있어요. 이 기기에서 한 번만 넣으면 돼요.</p>
    <form id="vform"><input type="email" autocomplete="username" value="${esc(SB.s.user.email || "")}" hidden>
    <div class="field"><label for="vpw">로그인 비밀번호</label><input id="vpw" type="password" autocomplete="current-password" maxlength="72"></div><p class="lerr" id="verr" role="alert"></p>
    <div class="cta-row"><span class="spacer"></span><button type="button" class="btn ghost" data-x>나중에</button><button class="btn pri" id="vok" type="submit">풀기</button></div></form>`);
  $("#vform", ov).onsubmit = async (e) => {
    e.preventDefault();
    const pw = $("#vpw", ov).value, btn = $("#vok", ov), err = $("#verr", ov);
    if (!pw) return;
    btn.disabled = true; btn.textContent = "확인하는 중…"; err.textContent = "";
    try {
      await SB.verify(pw);
      if (!(await VAULT.fromPassword(pw, SB.s.user.id))) throw { msg: "이 브라우저에서는 키 잠금을 풀 수 없어요." };
      const n = await VAULT.take(await VAULT.remote(), true);
      ov.remove(); toast(n ? "계정의 API 키를 받았어요" : "키 잠금을 풀었어요");
      if (location.hash === "#me") viewMe(); else paintVault();
    } catch (x) { err.textContent = (x && x.msg) || "풀지 못했어요. 잠시 뒤 다시 해 주세요."; btn.disabled = false; btn.textContent = "풀기"; }
  };
}
function accountBoxHTML() {
  if (!SB.on()) return "";
  if (!SB.s) return `<h2 class="sec">계정</h2><div class="box"><p>로그인하면 PC와 휴대폰에서 대화·작품·설정이 그대로 이어져요.</p><div class="cta-row" style="margin-top:12px"><button class="btn pri" data-go="login">로그인 · 회원가입</button></div></div>`;
  return `<h2 class="sec">계정 <small id="cloudState">${esc(cloudStateText())}</small></h2><div class="box">
    <div class="acct-row"><span class="pill ok">로그인</span><b>${esc(acctName())}</b>${provName(SB.s.user.provider) ? `<span class="note">${esc(provName(SB.s.user.provider))}로 가입</span>` : ""}</div>
    <div class="toggle" style="margin-top:12px"><label for="syncKeys">API 키도 계정에 저장 <span class="note">켜 두면 휴대폰에서 키를 다시 넣지 않아도 돼요</span></label><input type="checkbox" id="syncKeys" ${S.settings.syncKeys !== false ? "checked" : ""}></div>
    <div id="vaultBox" class="vault-box">${vaultHTML()}</div>
    <div class="cta-row" style="margin-top:12px"><button class="btn sm" id="cSync">지금 동기화</button><span class="spacer"></span><button class="btn sm ghost" id="cOut">로그아웃</button><button class="btn sm danger" id="cDel">계정 삭제</button></div></div>`;
}
function bindAccount(v) {
  if (!$("#syncKeys", v)) return;
  paintVault();
  $("#syncKeys", v).onchange = async (e) => {
    S.settings.syncKeys = e.target.checked; saveSettings(); paintVault();
    if (!e.target.checked) { VAULT.drop().catch(() => {}); toast("API 키는 이 기기에만 둬요. 계정에 있던 키는 지웠어요"); return; }
    if (!VAULT.canWrite()) { toast("API 키는 이 기기에만 있어요"); if (VAULT.ok()) { if (VAULT.phrase()) phraseSheet(); else vaultSheet(); } return; }
    try { await VAULT.take(await VAULT.remote(), true); toast("API 키를 암호화해서 계정에 저장해요"); } catch { toast("계정에 저장하지 못했어요. 잠시 뒤 다시 해 주세요"); }
  };
  $("#cSync", v).onclick = async (e) => {
    e.target.disabled = true;
    try { await CLOUD.flush(); const n = await CLOUD.pull(); if (n) await reloadFromCloud(); CLOUD.setState(CLOUD.noTable ? "notable" : "ok"); toast(CLOUD.noTable ? "계정 저장 표가 아직 없어요" : n ? `계정에서 ${n}개를 받았어요` : "이미 최신이에요"); }
    catch { if (!CLOUD.noTable) CLOUD.setState("err"); toast(CLOUD.noTable ? "계정 저장 표가 아직 없어요" : "동기화하지 못했어요"); }
    e.target.disabled = false;
  };
  $("#cOut", v).onclick = () => {
    const ov = sheet(`<h2>로그아웃할까요?</h2><p class="sub">계정에 저장된 데이터는 그대로예요. 이 기기의 데이터는 남겨 두거나 지울 수 있어요.</p>
      <div class="toggle"><label for="lwipe">이 기기의 데이터도 지우기 <span class="note">다른 사람과 같이 쓰는 기기라면 켜 주세요</span></label><input type="checkbox" id="lwipe"></div>
      <div class="cta-row" style="margin-top:14px"><span class="spacer"></span><button class="btn ghost" data-x>취소</button><button class="btn pri" id="lok">로그아웃</button></div>`);
    $("#lok", ov).onclick = async () => {
      const wipe = $("#lwipe", ov).checked; ov.remove();
      await CLOUD.flush(); CLOUD.stop(); await SB.signOut();
      if (wipe) { await wipeDevice(); location.reload(); return; }
      try { localStorage.setItem("hv1_guest", "1"); } catch {}
      toast("로그아웃했어요. 이 기기의 데이터는 남아 있어요"); viewMe();
    };
  };
  $("#cDel", v).onclick = () => confirmSheet("계정을 삭제할까요?", "계정과 계정에 저장된 대화·작품·설정·그림이 모두 지워져요. 이 기기의 데이터는 남아요. 되돌릴 수 없어요.", "계정 삭제", async () => {
    try {
      const r = await SB.req("/rest/v1/rpc/delete_me", { method: "POST", body: "{}" });
      if (!r.ok) throw await r.json().catch(() => ({}));
      CLOUD.stop(); SB.keep(null); VAULT.forget(); try { localStorage.setItem("hv1_guest", "1"); } catch {}
      toast("계정을 삭제했어요"); viewMe();
    } catch (x) { toast("계정을 삭제하지 못했어요" + (x && x.code === "PGRST202" ? " (docs/supabase.sql의 delete_me 함수가 없어요)" : "")); }
  });
}
// 이 기기의 HEART SYNC 데이터 전부(설정·키·그림 포함)를 지움 — 같이 쓰는 기기에서 로그아웃할 때
async function wipeDevice() {
  await IDB.clear();
  try { Object.keys(localStorage).filter((k) => k.indexOf("hv1_") === 0).forEach((k) => localStorage.removeItem(k)); } catch {}
}
function viewMe() {
  const v = $("#view"), cur = S.personas.find((p) => p.def) || S.personas[0];
  v.innerHTML = `<div class="page">${topbar()}
    <h1 class="sec" style="margin-top:4px">MY</h1>
    <div class="statline">
      <div class="box"><h3>대화방</h3><b>${S.rooms.length}</b></div>
      <div class="box"><h3>만든 캐릭터</h3><b>${S.mine.length}</b></div>
      <div class="box"><h3>요금제</h3><b>${isPro() ? "PLUS" : "무료"}</b></div>
    </div>
    ${accountBoxHTML()}
    <h2 class="sec">내 페르소나 <small>대화에서 내가 연기하는 캐릭터</small></h2>
    <div class="box">
      <div class="avatar-pick">${pavHTML(cur)}<div style="min-width:0"><b style="font-size:17px">${esc(cur.name)}</b> <span class="pill">기본</span><div class="note">${esc(cur.memo || "")}</div></div></div>
      ${cur.desc ? `<div class="setcard" style="margin-top:12px"><h4>상세 정보</h4><p style="margin:0;white-space:pre-wrap;font-size:13.5px">${esc(cur.desc)}</p></div>` : ""}
      <h3 style="margin:16px 0 8px">현재 페르소나</h3>
      <div class="plist">${S.personas.map((p) => `<div class="prow ${p.def ? "on" : ""}">${pavHTML(p)}<div class="x" data-def="${esc(p.id)}" role="button" tabindex="0" title="기본 페르소나로 설정"><b>${esc(p.name)}${p.def ? ' <span class="chk">✓</span>' : ""}</b><span>${esc(p.memo || p.desc || "설명 없음")}</span></div><button class="btn sm ghost" data-pedit="${esc(p.id)}">수정</button></div>`).join("")}</div>
      ${S.personas.length < 8 ? `<button class="btn block" id="padd" style="margin-top:8px">+ 페르소나 추가</button>` : ""}
    </div>
    <h2 class="sec">크리에이터 프로필</h2>
    <div class="box"><div class="field" style="margin:0"><label for="nick">크리에이터 이름 (커뮤니티 공개 캐릭터에 표시)</label><input id="nick" maxlength="20" value="${esc(S.profile.nick)}" placeholder="예: 새벽작가"></div>
      <button class="btn sm" id="nickSave" style="margin-top:10px">저장</button></div>
    <h2 class="sec">관심있는 대화 <small>홈에 보일 작품</small></h2>
    <div class="box">${audSegHTML()}<p class="note" style="margin:8px 0 0">남성향은 여성 캐릭터, 여성향은 남성 캐릭터와의 대화만 보여요. 내가 만든 작품은 늘 보여요.</p></div>
    <h2 class="sec">채팅 설정 <small>바꾸면 바로 적용돼요</small></h2>
    <div class="box">
      <div class="bubble chat-pv" aria-hidden="true"><p class="narr">창밖으로 첫눈이 내리기 시작했다.</p><p><b class="spk">서윤</b><span class="dlg">"오늘은 여기까지 할까요?"</span></p></div>
      <div class="field"><label for="cfs" style="display:flex">글자 크기<span class="spacer"></span><output id="cfsV">${S.settings.fs}px</output></label><input type="range" id="cfs" min="13" max="21" step="0.5" value="${S.settings.fs}"></div>
      <div class="two">
        <div class="field"><span class="lbl">줄 간격</span><div class="seg" data-set="chatLh">${[[1.6, "좁게"], [1.8, "보통"], [2.1, "넓게"]].map(([n, l]) => `<button type="button" data-v="${n}" class="${S.settings.chatLh == n ? "on" : ""}">${l}</button>`).join("")}</div></div>
        <div class="field"><span class="lbl">지문 글꼴</span><div class="seg" data-set="narrFont">${[["serif", "명조"], ["sans", "고딕"]].map(([k, l]) => `<button type="button" data-v="${k}" class="${S.settings.narrFont === k ? "on" : ""}">${l}</button>`).join("")}</div></div>
      </div>
      <div class="toggle" style="margin-top:14px"><label for="cEnter">Enter로 보내기 <span class="note">끄면 Ctrl+Enter로 보내요</span></label><input type="checkbox" id="cEnter" ${S.settings.enterSend !== false ? "checked" : ""}></div>
      <div class="toggle" style="margin-top:8px"><label for="cImg">대화 속 장면 이미지 보기</label><input type="checkbox" id="cImg" ${S.settings.sceneImg !== false ? "checked" : ""}></div>
    </div>
    <h2 class="sec">AI 연결 <small>지금: ${esc(engineName())}</small></h2>
    <div class="box">
      <div class="field" style="margin-top:0"><label for="key">Anthropic API 키 <span class="note">파일로 열었을 때만 필요</span></label><input id="key" type="password" autocomplete="off" placeholder="sk-ant-..." value="${esc(S.settings.apiKey)}"></div>
      ${IN_CLAUDE ? `<div class="setcard" style="margin-top:14px"><h4>성인 인증 · 수위</h4><p class="d" style="margin:0">파일로 열었을 때만 설정할 수 있어요.</p></div>`
        : `<div class="setcard" style="margin-top:14px"><h4>성인 인증 · 수위</h4>
        <div class="toggle"><label for="ageChk">만 19세 이상이에요 (자기 확인)</label><input type="checkbox" id="ageChk" ${S.settings.isAgeVerified ? "checked" : ""}></div>
        <div class="toggle"><label for="unfilterChk">모든 대화방 수위 제한 해제</label><input type="checkbox" id="unfilterChk" ${!S.settings.contentFilter ? "checked" : ""}></div>
        <div class="toggle"><label for="fallbackChk">Claude가 거절하면 OpenRouter로 이어 쓰기</label><input type="checkbox" id="fallbackChk" ${S.settings.autoFallback ? "checked" : ""}></div>
        <p class="d" style="margin:0">OpenRouter 키가 있어야 동작해요. 미성년 인물·암시는 항상 막아요. 이 체크는 본인인증이 아니에요.</p>
        <p class="d" style="margin:6px 0 0">AI 그림은 전체이용가로 만들어요. 이미지 슬롯에서 세미·성인 수위로 직접 만든 칸만 그 칸의 수위로 자동으로 만들어요.</p></div>`}
      ${IN_CLAUDE ? "" : `<div class="two">
        <div class="field"><label for="orkey">OpenRouter API 키 <span class="note">성인 모드용</span></label><input id="orkey" type="password" autocomplete="off" placeholder="sk-or-..." value="${esc(S.settings.openRouterKey || "")}"></div>
        <div class="field"><label for="ormodel">무검열 모델</label><select id="ormodel">${(() => { const cur = String(S.settings.customUnfilteredModel || "").trim(), pre = OR_PRESETS.some((m) => m[0] === cur);
          return [["", "등급별 자동 (Rocinante · Hermes 3 · DeepSeek V3)"], ...OR_PRESETS, ["custom", "직접 입력"]].map(([k, l]) => `<option value="${esc(k)}" ${(k === "custom" ? cur && !pre : k === cur) ? "selected" : ""}>${esc(l)}</option>`).join(""); })()}</select></div>
      </div>
      <div class="field" id="ormodelBox" ${String(S.settings.customUnfilteredModel || "").trim() && !OR_PRESETS.some((m) => m[0] === S.settings.customUnfilteredModel.trim()) ? "" : "hidden"}><label for="ormodelTxt">OpenRouter 모델 ID</label><input id="ormodelTxt" maxlength="120" autocomplete="off" placeholder="예: deepseek/deepseek-chat-v3-0324" value="${esc(S.settings.customUnfilteredModel || "")}"></div>`}
    </div>
    <h2 class="sec">이미지 생성 <small>Runware</small></h2>
    <div class="box">
      <div class="field" style="margin-top:0"><label for="rkey">Runware API 키 <span class="note">runware.ai에서 발급</span></label><input id="rkey" type="password" autocomplete="off" placeholder="Runware API 키" value="${esc(S.settings.runwareKey || "")}"></div>
      <div class="field"><label for="gstyle">그림체</label><select id="gstyle">${styleOptionsHTML()}</select><p class="note" id="gstyleDesc" style="margin:2px 0 0"></p></div>
      <div class="field" id="gmodelBox"><label for="gmodel">이미지 모델</label><select id="gmodel">${[...IMG_MODELS, ...(IMG_MODELS.some((m) => m.id === S.settings.imgModel) ? [] : [{ id: S.settings.imgModel, name: S.settings.imgModel }])].map((m) => `<option value="${esc(m.id)}">${esc(m.name)}</option>`).join("")}</select></div>
      <div class="field" id="gstyleBox"><label for="gstyleTxt">그림체 문구 <span class="note">한국어로 써도 돼요</span></label><textarea id="gstyleTxt" maxlength="600" style="min-height:76px" placeholder="예: 한국 웹툰 그림체, 깔끔한 선화, 부드러운 피부 음영"></textarea></div>
      <div class="field"><span class="lbl">그림체 세트</span>
        <div class="ssets" id="ssets"></div><input type="file" id="ssetFile" accept="image/png,image/jpeg,image/webp,.zip,application/zip" multiple hidden>
        <div class="cta-row" style="margin-top:6px"><button class="btn sm" id="ssetAdd" type="button">+ 세트 가져오기 (그림 또는 ZIP)</button></div>
        <p class="note" style="margin:4px 0 0">이름 앞부분이 같은 그림끼리 3장씩 묶어요. Anthropic 키가 있으면 그림체 태그를 자동으로 써요.</p></div>
      <div class="cta-row" style="margin-top:10px"><button class="btn sm" id="gtest">연결 테스트</button><span class="note" id="gtestMsg">테스트 그림 1장을 만들어 봐요.</span></div>
    </div>
    <div class="cta-row" style="margin-top:14px"><button class="btn pri" id="setSave">설정 저장</button><span class="spacer"></span><button class="btn sm danger" id="reset">모든 데이터 초기화</button></div>
    <p class="note">키와 데이터는 ${KV.dbOk ? "내 claude.ai 계정" : "이 브라우저"}에만 저장돼요 · 이미지: ${IMG.assets ? "아티팩트 저장소" : "압축 후 내 저장 공간"}</p>
  </div>`;
  bindGo(v); IMG.hydrate(v);
  $("#nickSave").onclick = () => { S.profile.nick = $("#nick").value.trim(); KV.set("profile", S.profile); publishCommunity(); toast("저장했어요"); };
  $$("[data-def]", v).forEach((b) => b.onclick = () => { S.personas.forEach((p) => p.def = p.id === b.dataset.def); KV.set("personas", S.personas); viewMe(); });
  $$("[data-pedit]", v).forEach((b) => b.onclick = () => personaSheet(S.personas.find((p) => p.id === b.dataset.pedit), viewMe));
  const pa = $("#padd"); if (pa) pa.onclick = () => personaSheet(null, viewMe);
  const gs = $("#gstyle"), gt = $("#gstyleTxt"), gm = $("#gmodel");
  const findSet = (k) => (S.settings.styleSets || []).find((s) => "set:" + s.id === k);
  // 고른 그림체에 맞춰 설명·모델·문구 칸을 보여 줌(프리셋은 모델·문구 고정, 세트·직접 입력은 고칠 수 있음)
  gs.onchange = () => {
    const k = gs.value, set = findSet(k), p = set ? null : IMG_STYLES[k];
    $("#gstyleDesc").textContent = set ? "올린 그림에서 읽은 그림체예요. 문구와 모델을 고칠 수 있어요." : p.desc + (p.model ? ` · 모델: ${imgModelInfo(p.model).name}` : "");
    $("#gmodelBox").hidden = !!p?.model; $("#gstyleBox").hidden = !!p?.model;
    gm.value = (set ? set.model : p.model) || S.settings.imgModel;
    gt.value = set ? set.prompt || "" : k === "custom" ? S.settings.imgStyleCustom || "" : "";
  };
  gt.oninput = () => { const set = findSet(gs.value); if (set) { set.prompt = gt.value; saveSettings(); paintSets(); } };
  gm.onchange = () => { const set = findSet(gs.value); if (set) { set.model = gm.value; saveSettings(); paintSets(); } };
  const saveStyle = () => { S.settings.imgStyle = gs.value; if (gs.value === "custom") { S.settings.imgStyleCustom = gt.value.trim(); S.settings.imgModel = gm.value; } };
  const refreshStyle = () => { if (!gs.isConnected) return; gs.innerHTML = styleOptionsHTML(); gs.value = S.settings.imgStyle; gs.onchange(); paintSets(); };
  gs.onchange();
  const paintSets = () => {
    const box = $("#ssets"); if (!box) return;
    const sets = S.settings.styleSets || [];
    box.innerHTML = sets.length ? sets.map((s) => { const on = S.settings.imgStyle === "set:" + s.id; return `<div class="sset ${on ? "on" : ""}">
      <div class="th">${(s.refs || []).filter(validRef).map((r) => `<span>${IMG.tag(r)}</span>`).join("")}</div>
      <b>${esc(s.name)}${on ? ' <span class="pill">사용 중</span>' : ""}</b>
      <p class="note">${esc(s.prompt || "아직 그림체 문구가 없어요. '문구 뽑기'를 눌러 주세요.")}<br>모델: ${esc(imgModelInfo(s.model || IMG_MODELS[0].id).name)}</p>
      <div class="cta-row" style="margin:0"><button class="btn sm ${on ? "" : "pri"}" data-suse="${esc(s.id)}" ${on ? "disabled" : ""}>사용</button><button class="btn sm" data-sgen="${esc(s.id)}">문구 뽑기</button><button class="btn sm ghost" data-sdel="${esc(s.id)}">삭제</button></div></div>`; }).join("") : `<p class="note">아직 세트가 없어요.</p>`;
    IMG.hydrate(box);
    $$("[data-suse]", box).forEach((b) => b.onclick = () => { S.settings.imgStyle = "set:" + b.dataset.suse; saveSettings(); refreshStyle(); toast("이 세트의 그림체로 만들도록 바꿨어요"); });
    $$("[data-sgen]", box).forEach((b) => b.onclick = () => readSets([b.dataset.sgen]));
    $$("[data-sdel]", box).forEach((b) => b.onclick = () => {
      const s = findSet("set:" + b.dataset.sdel); if (!s) return;
      (s.refs || []).forEach((r) => IMG.drop(r)); S.settings.styleSets = S.settings.styleSets.filter((x) => x !== s);
      if (S.settings.imgStyle === "set:" + s.id) S.settings.imgStyle = "novel";
      saveSettings(); refreshStyle(); toast("세트를 지웠어요");
    });
  };
  const readSets = async (ids) => {
    if (!S.settings.apiKey) { const k = $("#key")?.value.trim(); if (k) { S.settings.apiKey = k; saveSettings(); } }
    if (!hasClaudeKey()) { toast("Anthropic API 키를 넣으면 Claude가 세트 그림을 읽어 그림체 태그를 자동으로 써요."); return; }
    let ok = 0, err = null;
    for (const [i, id] of ids.entries()) {
      const s = findSet("set:" + id); if (!s) continue;
      toast(`그림체를 읽는 중… ${i + 1}/${ids.length} · ${s.name}`);
      try { s.prompt = await claudeStyleTags(s.refs || []); ok++; saveSettings(); refreshStyle(); }
      catch (e) { err = e; if (["no_claude", "bad_claude", "network", "rate_limited"].includes(e?.code)) break; }
    }
    toast(err && !ok ? genErr(err) : `세트 ${ok}개의 그림체 문구를 썼어요${err ? " · " + genErr(err) : ""}`);
  };
  $("#ssetAdd").onclick = () => $("#ssetFile").click();
  $("#ssetFile").onchange = async (e) => {
    const picked = [...e.target.files]; e.target.value = "";
    if (!picked.length) return; toast("그림을 읽는 중…");
    let made = [];
    try {
      let files = [];
      for (const f of picked) files.push(...(/\.zip$/i.test(f.name) || /zip/.test(f.type) ? await unzipImages(f) : [f]));
      files = files.filter((f) => /\.(png|jpe?g|webp)$/i.test(f.name) || /^image\//.test(f.type));
      if (!files.length) { toast("그림 파일을 찾지 못했어요. PNG·JPG·WEBP 또는 그 그림이 든 ZIP을 골라 주세요."); return; }
      for (const g of groupStyleFiles(files).slice(0, 12)) {
        const refs = []; for (const f of g.files) refs.push(await IMG.put(f));
        made.push({ id: uid("ss"), name: g.name, refs, prompt: guessStylePrompt(g.name), model: guessStyleModel(g.name) });
      }
      S.settings.styleSets = [...(S.settings.styleSets || []), ...made];
      if (!activeSet()) S.settings.imgStyle = "set:" + made[0].id;
      saveSettings(); refreshStyle();
      toast(`세트 ${made.length}개를 만들었어요 (${made.map((s) => s.name).join(", ")})`);
    } catch (err) { toast(err?.code === "nozip" ? "이 브라우저는 ZIP을 바로 열 수 없어요. 압축을 풀어 그림 파일들을 골라 주세요." : "파일을 읽지 못했어요. PNG·JPG·ZIP인지 확인해 주세요."); return; }
    if (hasClaudeKey() || $("#key")?.value.trim()) await readSets(made.map((s) => s.id));
  };
  paintSets();
  // 채팅 설정: 바꾸는 즉시 저장·반영
  const chatSet = (k, val) => { S.settings[k] = val; saveSettings(); applySettings(); };
  $("#cfs").oninput = (e) => { chatSet("fs", +e.target.value); $("#cfsV").textContent = e.target.value + "px"; };
  $$("[data-set] button", v).forEach((b) => b.onclick = () => {
    const k = b.parentElement.dataset.set; chatSet(k, k === "chatLh" ? +b.dataset.v : b.dataset.v);
    $$("button", b.parentElement).forEach((x) => x.classList.toggle("on", x === b));
  });
  $("#cEnter").onchange = (e) => chatSet("enterSend", e.target.checked);
  $("#cImg").onchange = (e) => chatSet("sceneImg", e.target.checked);
  bindAccount(v);
  $$("[data-aud]", v).forEach((x) => x.onclick = () => { setAudience(x.dataset.aud); $$("[data-aud]", v).forEach((y) => y.classList.toggle("on", y === x)); toast(`${AUDS[audience()].name} 작품을 보여 드릴게요`); });
  // 성인 인증을 체크해야 수위 해제 옵션을 고를 수 있음
  const age = $("#ageChk");
  if (age) { const sync = () => ["#unfilterChk", "#fallbackChk"].forEach((s) => $(s).disabled = !age.checked); age.onchange = sync; sync(); }
  const orm = $("#ormodel");
  if (orm) orm.onchange = () => { $("#ormodelBox").hidden = orm.value !== "custom"; if (orm.value === "custom") $("#ormodelTxt").focus(); };
  $("#setSave").onclick = () => {
    S.settings.apiKey = $("#key").value.trim();
    S.settings.runwareKey = $("#rkey").value.trim(); saveStyle();
    if (age) {
      S.settings.isAgeVerified = age.checked; S.settings.contentFilter = !$("#unfilterChk").checked; S.settings.autoFallback = $("#fallbackChk").checked;
      S.settings.openRouterKey = $("#orkey").value.trim();
      S.settings.customUnfilteredModel = orm.value === "custom" ? $("#ormodelTxt").value.trim() : orm.value;
    }
    const warn = cleanKeys();
    saveSettings(); applySettings(); if (S.engine === "none" && S.settings.apiKey) S.engine = "byok"; viewMe();
    toast(warn.length ? "저장했어요. 키를 확인해 주세요: " + warn.join(" · ") : "설정을 저장했어요");
  };
  $("#gtest").onclick = () => {
    S.settings.runwareKey = $("#rkey").value.trim(); saveStyle(); saveSettings();
    genImageSheet({ title: "Runware 연결 테스트", aspect: "1:1", prompt: "1girl, solo, adult, sitting by the window, holding coffee cup, cat, warm afternoon sunlight, cozy room",
      onUse: async () => toast("테스트 이미지는 저장하지 않아요. Runware 연결이 잘 돼요!") });
  };
  $("#reset").onclick = () => confirmSheet("모든 데이터를 지울까요?", "대화방, 만든 캐릭터, 하트, 페르소나, 이미지 연결이 모두 지워져요." + (CLOUD.on ? " 로그인되어 있어서 계정에 저장된 데이터도 지워져요." : "") + " 되돌릴 수 없어요.", "전부 삭제", () => {
    S.rooms.forEach((r) => KV.set(roomKey(r.id), undefined));
    ["rooms", "mine", "wallet", "personas", "profile", "imgpacks", "coverpacks", "lorepacks", "tagpacks", "ponytags"].forEach((k) => KV.set(k, undefined));
    IDB.clear(); try { Object.keys(localStorage).filter((k) => /^hv1_img[a-z0-9]{10,30}$/.test(k)).forEach((k) => localStorage.removeItem(k)); } catch {}
    S.mine = []; publishCommunity();
    (CLOUD.on ? CLOUD.wipe().catch(() => {}) : Promise.resolve()).then(() => setTimeout(() => location.reload(), 400));
  });
}
function personaSheet(p, after) {
  let img = p?.img || "";
  const ov = sheet(`<div class="sheet-head"><h2>${p ? "페르소나 수정" : "새 페르소나"}</h2><button class="icon-btn" data-x aria-label="닫기">${ICON.close}</button></div>
    <div class="avatar-pick" style="margin:8px 0 4px"><div id="avBox">${pavHTML({ name: p?.name || "?", img })}</div><div><input type="file" id="av" accept="image/png,image/jpeg,image/webp" hidden><button class="btn sm" id="avBtn">이미지 올리기</button> <button class="btn sm" id="avAi">AI로 만들기</button> <button class="btn sm ghost" id="avDel" ${img ? "" : "hidden"}>빼기</button><p class="note" style="margin:6px 0 0">대화에서 내 말풍선 옆에 보여요.</p></div></div>
    <div class="field"><label for="pn">이름</label><input id="pn" maxlength="20" value="${esc(p?.name || "")}"></div>
    <div class="field"><label for="pm">메모 (목록에 보이는 한 줄, 예: 관능미 · 츤데레)</label><input id="pm" maxlength="30" value="${esc(p?.memo || "")}"></div>
    <div class="field"><label for="pd">상세 정보 (AI가 보고 나를 대해요)</label><textarea id="pd" maxlength="800" style="min-height:130px" placeholder="예: 27세 남자. 긴 장발의 리프컷, 진한 흑발. 나른하고 귀찮은 말투, 맑은 저음.">${esc(p?.desc || "")}</textarea></div>
    <div class="toggle" style="margin-top:12px"><label for="pdef">기본 페르소나로 쓰기</label><input type="checkbox" id="pdef" ${p?.def ? "checked" : ""}></div>
    <div class="cta-row">${p && S.personas.length > 1 ? `<button class="btn danger" id="pdel">삭제</button>` : ""}<span class="spacer"></span><button class="btn ghost" data-x>취소</button><button class="btn pri" id="psave">저장</button></div>`);
  IMG.hydrate(ov);
  $("#avBtn", ov).onclick = () => $("#av", ov).click();
  $("#av", ov).onchange = async (e) => { const f = e.target.files[0]; if (!f) return; try { img = await IMG.put(f); $("#avBox", ov).innerHTML = pavHTML({ name: $("#pn", ov).value || "?", img }); IMG.hydrate(ov); $("#avDel", ov).hidden = false; } catch { toast("이미지를 읽지 못했어요."); } };
  $("#avAi", ov).onclick = () => genImageSheet({ title: "AI로 페르소나 이미지 만들기", aspect: "1:1",
    prompt: ["solo, adult, portrait, upper body, looking at viewer", $("#pd", ov).value.trim() || $("#pn", ov).value.trim(), "simple background"].filter(Boolean).join(", "),
    onUse: async (blob) => { img = await IMG.put(blob); $("#avBox", ov).innerHTML = pavHTML({ name: $("#pn", ov).value || "?", img }); IMG.hydrate(ov); $("#avDel", ov).hidden = false; } });
  $("#avDel", ov).onclick = () => { img = ""; $("#avBox", ov).innerHTML = pavHTML({ name: $("#pn", ov).value || "?", img: "" }); $("#avDel", ov).hidden = true; };
  $("#psave", ov).onclick = () => {
    const name = $("#pn", ov).value.trim(); if (!name) { $("#pn", ov).focus(); return; }
    const item = p || { id: uid("p") }; Object.assign(item, { name, memo: $("#pm", ov).value.trim(), desc: $("#pd", ov).value.trim(), img });
    if ($("#pdef", ov).checked) S.personas.forEach((x) => x.def = false);
    item.def = $("#pdef", ov).checked || (!!p && p.def);
    if (!p) S.personas.push(item);
    if (!S.personas.some((x) => x.def)) S.personas[0].def = true;
    KV.set("personas", S.personas);
    if (room && room.persona.id === item.id) { room.persona = { id: item.id, name: item.name, memo: item.memo, desc: item.desc, img: item.img }; saveRoom(room); renderLog(); }
    ov.remove(); after && after();
  };
  const del = $("#pdel", ov); if (del) del.onclick = () => { S.personas = S.personas.filter((x) => x !== p); if (!S.personas.some((x) => x.def)) S.personas[0].def = true; KV.set("personas", S.personas); ov.remove(); after && after(); };
}
/* 키 붙여넣기 실수 잡기: OpenRouter 키 앞의 "sk-or-"가 빠졌으면 붙이고, 형식이 다른 키는 알려 줌 */
function cleanKeys() {
  const s = S.settings, warn = [];
  if (/^v1-[0-9a-f]{64}$/i.test(s.openRouterKey || "")) s.openRouterKey = "sk-or-" + s.openRouterKey;
  if (s.openRouterKey && !/^sk-or-/.test(s.openRouterKey)) warn.push("OpenRouter 키는 sk-or-로 시작해요");
  if (s.apiKey && !/^sk-ant-/.test(s.apiKey)) warn.push("Anthropic 키는 sk-ant-로 시작해요");
  return warn;
}
function saveSettings() { try { localStorage.setItem("hv1_settings", JSON.stringify(S.settings)); } catch {} KV.set("memcfg", S.settings.memCfg); CLOUD.put("settings", cloudSettings()); VAULT.save(); }
/* 채팅 설정을 화면에 반영(테마는 기기 설정을 따름) */
function applySettings() {
  const s = S.settings, root = document.documentElement;
  root.style.setProperty("--chat-fs", s.fs + "px");
  root.style.setProperty("--chat-lh", s.chatLh);
  root.style.setProperty("--narr-font", s.narrFont === "sans" ? "var(--sans)" : "var(--serif)");
  root.classList.toggle("no-scene-img", s.sceneImg === false);
}
