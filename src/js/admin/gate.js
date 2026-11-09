/* 관리자 페이지 비밀번호 관문(관리자 빌드만): 웹 주소(https://…/admin.html)로 열면 비밀번호를 맞혀야 부팅한다. 로컬(localhost·127.0.0.1·file://)은 묻지 않음(개발 서버·흐름 시험·로컬 파일).
   비밀번호는 소스에 SHA-256 해시로만 두고 입력값의 해시와 비교(crypto.subtle — https·localhost·file 모두 보안 컨텍스트). 맞으면 이 브라우저에 기억(localStorage hv1_admin = 해시), MY의 '관리자 잠그기'가 지움.
   주의: 정적 페이지의 클라이언트 관문이라 소스를 읽는 사람은 우회할 수 있다 — 무심코 들어오는 것을 막는 용도. 실제 데이터(API 키·그림·대화)는 관리자의 브라우저와 계정(Supabase RLS)에만 있어 페이지가 보여도 새지 않는다.
   비밀번호를 바꾸려면 HASH를 새 비밀번호의 sha256 16진수로(node -e 'console.log(require("crypto").createHash("sha256").update("새비밀번호").digest("hex"))') */
import { $ } from "../core/util.js";
import { EXT } from "../ui/ext.js";
import { LOGO } from "../ui/shell.js";

const HASH = "0b66aa75aec80f1efadd5420201f74451496acf05526b52015ee26ea44ed3a3e", KEY = "hv1_admin";
/** 관문을 세울 자리인지 — 웹 주소(http/https)이고 로컬 호스트가 아닐 때. @returns {boolean} */
export const gateNeeded = () => /^https?:$/.test(location.protocol) && !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
async function sha256(s) { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join(""); }
/** 이 브라우저의 기억을 지우고 다시 묻게 함. @returns {void} */
export function lockAdmin() { try { localStorage.removeItem(KEY); } catch {} location.reload(); }
/* MY(관리자 도구, 웹 주소일 때만): 이 브라우저의 기억을 지우는 버튼 */
EXT.me.push((v) => {
  const box = $("#meExt", v); if (!box || !gateNeeded()) return;
  box.insertAdjacentHTML("beforeend", `<div class="box" style="margin-top:12px"><button class="btn sm ghost" id="adminLock">이 브라우저에서 관리자 잠그기</button></div>`);
  $("#adminLock", box).onclick = () => lockAdmin();
});
/** 비밀번호가 맞을 때(또는 관문이 필요 없을 때) 풀리는 약속 — 진입점이 boot() 앞에 기다림. @returns {Promise<void>} */
export function gate() {
  return new Promise((resolve) => {
    let ok = false; try { ok = localStorage.getItem(KEY) === HASH; } catch {}
    if (!gateNeeded() || ok) return resolve();
    const v = $("#view"); document.body.classList.add("gated");
    v.innerHTML = `<div class="page"><div class="login-page"><div class="login-card">${LOGO}<p class="lead">관리자 도구예요. 비밀번호를 넣어 주세요.</p>
      <form id="gateForm"><div class="field" style="margin-top:0"><label for="gatePw">비밀번호</label><input id="gatePw" type="password" autocomplete="current-password"></div>
        <button class="btn pri block" type="submit">들어가기</button><p class="note" id="gateMsg" role="alert"></p></form>
      <p class="note" style="text-align:center">사용자 사이트는 <a href="./">여기</a>예요.</p></div></div></div>`;
    const pw = $("#gatePw", v), msg = $("#gateMsg", v);
    pw.focus();
    $("#gateForm", v).onsubmit = async (e) => {
      e.preventDefault();
      if (!(window.crypto && crypto.subtle)) { msg.textContent = "이 브라우저에서는 열 수 없어요. 최신 Chrome·Safari로 https 주소에서 열어 주세요."; return; }
      if ((await sha256(pw.value)) === HASH) { try { localStorage.setItem(KEY, HASH); } catch {} document.body.classList.remove("gated"); v.innerHTML = `<p class="boot-msg" id="bootMsg">불러오는 중…</p>`; resolve(); }
      else { msg.textContent = "비밀번호가 달라요."; pw.value = ""; pw.focus(); }
    };
  });
}
