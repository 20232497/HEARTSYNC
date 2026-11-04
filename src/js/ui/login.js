/* 로그인·가입·비밀번호 찾기·소셜 로그인 화면, 키 잠금(금고) 시트 */
import { AUDS } from "../core/audience.js";
import { IN_CLAUDE } from "../core/config.js";
import { on } from "../core/events.js";
import { S } from "../core/state.js";
import { $, $$, esc, toast } from "../core/util.js";
import { CLOUD } from "../services/cloud.js";
import { OAUTH_ICONS, PROVIDERS, SB, acctName, provName } from "../services/supabase.js";
import { fixImgpacks, reloadFromCloud } from "../services/sync.js";
import { VAULT, VAULT_FIELDS } from "../services/vault.js";
import { firstSync } from "./account.js";
import { audSheet } from "./home.js";
import { viewMe } from "./me.js";
import { sheet } from "./sheet.js";
import { LOGO, bindGo, go } from "./shell.js";

/* ---------------------------------------------------------------- 로그인·계정 (Supabase, 계정 저장은 CLOUD) */
export function viewLogin() {
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
export async function afterLogin(fresh) {
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
export function newPasswordSheet() {
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
export function vaultHTML() {
  if (S.settings.syncKeys === false) return `<p class="note">API 키는 이 기기에만 있어요.</p>`;
  if (!VAULT.ok()) return `<p class="note">이 브라우저는 암호화를 지원하지 않아 API 키는 이 기기에만 둬요.</p>`;
  const ph = VAULT.phrase();
  if (ph && !VAULT.rec && VAULT.state !== "locked") return `<div class="vault-lock"><span>🔑 비밀번호 없이 가입한 계정이에요. 키 잠금 암호를 한 번 정하면 API 키를 암호화해 계정에 저장해요.</span><button class="btn sm" id="vUnlock">암호 정하기</button></div>`;
  if (!VAULT.rec || VAULT.state === "stale") return `<div class="vault-lock"><span>🔒 ${VAULT.rec ? (ph ? "다른 기기에서 키 잠금 암호를 새로 정했어요. 새 암호를 넣으면 API 키를 받아요." : "다른 기기에서 비밀번호가 바뀌었어요. 새 비밀번호를 넣으면 API 키를 받아요.") : ph ? "계정의 API 키가 잠겨 있어요. 키 잠금 암호를 한 번 넣으면 받아요." : "계정의 API 키가 잠겨 있어요. 로그인 비밀번호를 한 번 넣으면 받아요."}</span><button class="btn sm" id="vUnlock">${ph ? "암호 입력" : "비밀번호 입력"}</button></div>`;
  return `<p class="note">🔐 API 키는 ${ph ? "키 잠금 암호" : "로그인 비밀번호"}로 이 기기에서 암호화한 뒤 올려요. 서버와 관리자도 키를 볼 수 없어요.</p>`;
}
export function paintVault() { const el = $("#vaultBox"); if (!el) return; el.innerHTML = vaultHTML(); const b = $("#vUnlock", el); if (b) b.onclick = () => { if (VAULT.phrase()) phraseSheet(); else vaultSheet(); }; }
on("vault", paintVault); // 금고 상태가 바뀌면(services/vault) MY → 계정 칸을 다시 그림
// 비밀번호 없는 계정의 키 잠금 암호: 계정에 잠긴 키가 없으면 정하고, 있으면 넣어서 풂(reset: 잊어서 새로 정함 — 계정의 잠긴 키는 이 기기 키로 바뀜)
export async function phraseSheet(reset) {
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
export function vaultSheet() {
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
