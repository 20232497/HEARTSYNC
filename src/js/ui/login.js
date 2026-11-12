/* 로그인·가입·비밀번호 찾기·소셜 로그인 화면, 로그인 뒤 돌아갈 작품, 새 비밀번호 시트 */
import { getChar } from "../core/character.js";
import { $, $$, esc, toast } from "../core/util.js";
import { CLOUD } from "../services/cloud.js";
import { OAUTH_ICONS, PROVIDERS, SB, acctName, provName } from "../services/supabase.js";
import { reloadFromCloud } from "../services/sync.js";
import { firstSync } from "./account.js";
import { docUrl } from "./help.js";
import { askAud } from "./home.js";
import { sheet } from "./sheet.js";
import { LOGO, bindGo, go } from "./shell.js";

/* ---------------------------------------------------------------- 로그인 뒤 돌아갈 곳(작품·공지)
   처음 방문한 사람이 작품 주소(#c-<id>)나 공지(#notice)로 들어오면 부팅이 주소를 #login-c-<id>·#login-notice로 바꾼다 — 주소가 갈 곳을 들고 있어 새로 고침해도 남고, 메뉴로 나가면 저절로 사라진다.
   소셜 로그인·인증 메일은 redirect_to에 주소를 실을 수 없어 사이트 첫 화면으로 돌아오므로, 떠나기 전에 hv1_back에 적어 둔다.
   인증 메일은 새 탭으로 열리니 sessionStorage가 아니라 localStorage, 메일 링크가 유효한 1시간만 */
const BACK_KEY = "hv1_back",
  BACK_MS = 3600000;
const backHash = (h) => (/^c-./.test(h) || h === "notice" ? h : ""); // 돌아갈 수 있는 곳은 작품 주소와 공지뿐
const canBack = (h) => h === "notice" || !!getChar(h.slice(2));
const loginBack = () => {
  const h = location.hash.slice(1);
  return h.startsWith("login-") ? backHash(h.slice(6)) : "";
};
const setHash = (h) => {
  try {
    history.replaceState(null, "", location.pathname + location.search + "#" + h);
  } catch {}
};
function saveBack() {
  const to = loginBack();
  if (to) {
    try {
      localStorage.setItem(BACK_KEY, JSON.stringify({ to, at: Date.now() }));
    } catch {}
  }
}
function takeBack() {
  try {
    const v = localStorage.getItem(BACK_KEY);
    localStorage.removeItem(BACK_KEY);
    const b = JSON.parse(v);
    return b && Date.now() - b.at < BACK_MS ? backHash(b.to) : "";
  } catch {
    return "";
  }
}
/* 부팅 때 첫 주소를 정함. 작품은 모두 content/에서 오므로(계정에만 있는 작품 없음) 지금 못 찾으면 홈 */
export function bootBack(askLogin) {
  const h = location.hash.slice(1),
    saved = takeBack(),
    to = !h ? saved : loginBack() || (askLogin ? backHash(h) : "");
  if (askLogin) {
    setHash(to ? "login-" + to : "login");
    return;
  }
  if (to) setHash(canBack(to) ? to : "home");
}
/* 로그인·둘러보기를 마치고 나감: 돌아갈 곳이 있으면 그리로(로그인 화면은 방문 기록에서 빠짐), 없는 작품이면 홈 */
function leaveLogin() {
  const to = loginBack();
  takeBack();
  $("#view").scrollTop = 0;
  window.scrollTo(0, 0); // 폼을 내려 누른 자리가 다음 화면에 이어지면 작품 제목이 잘림
  if (to && canBack(to)) location.replace("#" + to);
  else go("home");
}

/* ---------------------------------------------------------------- 로그인·계정 (Supabase, 계정 저장은 CLOUD) */
export function viewLogin() {
  const v = $("#view");
  if (!SB.on() || SB.s) {
    v.innerHTML = `<div class="page"><div class="login-page"><div class="login-card">${LOGO}
      <p class="lead">${!SB.on() ? "계정 서버가 아직 연결되지 않았어요." : `<b>${esc(acctName())}</b>(으)로 로그인되어 있어요.`}</p>
      <button class="btn pri block" data-go="home">홈으로</button>${
        SB.s ? `<div class="lrow"><button type="button" class="lnk" ` + `data-go="me">MY에서 계정 관리</button></div>` : ""
      }</div></div></div>`;
    bindGo(v);
    return;
  }
  let mode = "in";
  v.innerHTML =
    `<div class="page"><div class="login-page"><div class="login-card">
    ${LOGO}
    <p class="lead">로그인하면 PC와 휴대폰에서<br>대화·설정이 그대로 이어져요.</p>
    <div class="seg" id="lmode"><button type="button" data-m="in" class="on">로그인</button><button type="button" data-m="up">회원가입</button></div>
    <form id="lform" novalidate>
      <div class="field"><label for="lmail">이메일</label>` +
    `<input id="lmail" type="email" autocomplete="email" inputmode="email" autocapitalize="off" spellcheck="false" maxlength="120"></div>
      <div class="field"><label for="lpw">비밀번호 <span class="note" id="lpwHint"></span></label>` +
    `<input id="lpw" type="password" autocomplete="current-password" maxlength="72"></div>
      <div class="field" id="lpw2Box" hidden><label for="lpw2">비밀번호 확인</label><input id="lpw2" type="password" autocomplete="new-password" maxlength="72"></div>
      <p class="lerr" id="lerr" role="alert"></p>
      <button class="btn pri block" id="lgo" type="submit">로그인</button>
    </form>
    <div class="lrow"><button type="button" class="lnk" id="lforgot">비밀번호를 잊었어요</button></div>
    <div class="lsep"><span>또는</span></div>
    <div class="oauth-list" id="loauth">${PROVIDERS.map(
      ([k, n]) =>
        `<button type="button" class="btn block oauth-btn ${k.replace("custom:", "")}" data-oauth="${k}">${OAUTH_ICONS[k]}` +
        `<span>${n}로 시작하기</span></button>`
    ).join("")}</div>
    <p class="lerr" id="loerr" role="alert"></p>
    <p class="note lnote">이메일이 없어도 카카오·네이버·Google 계정으로 바로 가입돼요.</p>
    <button type="button" class="btn ghost block" id="lguest">로그인 없이 둘러보기</button>
    <p class="note">처음 로그인할 때 이 기기에 있던 대화를 계정으로 옮길 수 있어요. API 키는 계정에 올리지 않고 이 기기에만 둬요.</p>
    <p class="note lpriv"><a href="${esc(docUrl("terms.html"))}">이용약관</a> · <a href="${esc(docUrl("privacy.html"))}">개인정보처리방침</a></p>
  </div></div></div>`;
  const err = $("#lerr"),
    go2 = $("#lgo"),
    say = (t, ok) => {
      err.textContent = t;
      err.classList.toggle("ok", !!ok);
    };
  $$("#lmode button").forEach(
    (b) =>
      (b.onclick = () => {
        mode = b.dataset.m;
        $$("#lmode button").forEach((x) => x.classList.toggle("on", x === b));
        $("#lpw2Box").hidden = mode !== "up";
        $("#lpw").autocomplete = mode === "up" ? "new-password" : "current-password";
        go2.textContent = mode === "up" ? "회원가입" : "로그인";
        $("#lforgot").hidden = mode === "up";
        $("#lpwHint").textContent = mode === "up" ? "8자 이상" : "";
        say("");
      })
  );
  $("#lform").onsubmit = async (e) => {
    e.preventDefault();
    const email = $("#lmail").value.trim(),
      pw = $("#lpw").value;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return say("이메일 주소를 확인해 주세요.");
    // 가입은 8자 이상(대시보드의 최소 길이와 같음)
    if (mode === "up" && pw.length < 8) return say("비밀번호는 8자 이상으로 정해 주세요.");
    if (pw.length < 6) return say("비밀번호는 6자 이상이에요.");
    if (mode === "up" && pw !== $("#lpw2").value) return say("비밀번호 확인이 달라요.");
    go2.disabled = true;
    go2.textContent = "확인하는 중…";
    say("");
    try {
      if (mode === "in") {
        await SB.signIn(email, pw);
        return loggedIn();
      }
      const st = await SB.signUp(email, pw);
      if (st === "in") return loggedIn();
      saveBack();
      say("인증 메일을 보냈어요. 메일의 링크를 누르면 바로 로그인돼요. 메일이 안 보이면 스팸함도 확인해 주세요.", true);
    } catch (x) {
      say((x && x.msg) || "로그인하지 못했어요.");
    }
    go2.disabled = false;
    go2.textContent = mode === "up" ? "회원가입" : "로그인";
  };
  $("#lforgot").onclick = async () => {
    const email = $("#lmail").value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return say("비밀번호를 다시 정할 이메일을 먼저 적어 주세요.");
    try {
      await SB.recover(email);
      saveBack();
      say("비밀번호 재설정 메일을 보냈어요. 메일의 링크를 눌러 새 비밀번호를 정해 주세요.", true);
    } catch (x) {
      say((x && x.msg) || "메일을 보내지 못했어요.");
    }
  };
  $("#lguest").onclick = () => {
    try {
      localStorage.setItem("hv1_guest", "1");
    } catch {}
    leaveLogin();
    setTimeout(askAud, 80);
  };
  // 소셜 로그인 = 가입(처음이면 계정이 저절로 만들어짐). 대시보드에서 아직 안 켠 공급자는 안내만
  const obs = $$("[data-oauth]", v),
    lock = (on) =>
      obs.forEach((x) => {
        x.disabled = on;
      });
  obs.forEach(
    (b) =>
      (b.onclick = async () => {
        const oerr = $("#loerr");
        lock(true);
        say("");
        oerr.textContent = "";
        saveBack();
        const ok = await SB.oauth(b.dataset.oauth);
        if (!ok) {
          takeBack();
          oerr.textContent = provName(b.dataset.oauth) + " 로그인은 아직 준비 중이에요. 이메일이나 다른 방법으로 시작해 주세요.";
        }
        setTimeout(() => lock(false), ok ? 4000 : 0); // 넘어갔다가 뒤로 돌아와도 다시 누를 수 있게
      })
  );
}
async function loggedIn() {
  try {
    localStorage.removeItem("hv1_guest");
  } catch {}
  toast("로그인했어요");
  leaveLogin();
  await new Promise((r) => setTimeout(r, 80));
  await afterLogin(true);
  askAud();
}
/* 로그인 직후(fresh)는 계정과 이 기기를 맞추고, 그 밖에는 바뀐 것만 받아 옴 */
export async function afterLogin(fresh) {
  CLOUD.start();
  if (!CLOUD.on) return;
  try {
    if (fresh) await firstSync();
    else if (await CLOUD.pull()) await reloadFromCloud();
    CLOUD.setState(CLOUD.state === "notable" ? "notable" : "ok");
  } catch (e) {
    if (!CLOUD.noTable) CLOUD.setState("err");
  }
}
export function newPasswordSheet() {
  const ov = sheet(
    `<h2>새 비밀번호</h2><p class="sub">재설정 링크로 들어왔어요. 새 비밀번호를 정해 주세요.</p>
    <div class="field"><label for="npw">새 비밀번호 (8자 이상)</label>` +
      `<input id="npw" type="password" autocomplete="new-password" maxlength="72"></div><p class="lerr" id="nerr"></p>
    <div class="cta-row"><span class="spacer"></span><button class="btn ghost" data-x>나중에</button><button class="btn pri" id="nok">바꾸기</button></div>`
  );
  $("#nok", ov).onclick = async () => {
    const pw = $("#npw", ov).value;
    if (pw.length < 8) {
      $("#nerr", ov).textContent = "8자 이상으로 정해 주세요.";
      return;
    }
    try {
      await SB.setPassword(pw);
      ov.remove();
      toast("비밀번호를 바꿨어요");
    } catch (x) {
      $("#nerr", ov).textContent = (x && x.msg) || "바꾸지 못했어요.";
    }
  };
}
