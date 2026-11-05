/* 공지 화면(#notice)과 고객센터 화면(#help — 자주 묻는 질문·문의하기). 공지는 홈·대화처럼 메뉴에서 바로 들어오고, 고객센터는 MY의 칸에서 들어옴(#help-faq·#help-ask로 바로, 예전 주소 #help-notice는 #notice로 넘김).
   공지·문의는 Supabase(services/support.js), FAQ는 ui/faq.js의 고정 글. 관리자 빌드는 그린 뒤 EXT.help(tab, box, list)로 공지 쓰기·받은 문의를 더함(admin/support.js) — 관리자 계정이면 누를 것 없이 바로 관리 화면.
   claude.ai 안·서버 설정이 없으면(SB.on() 거짓) 공지는 마지막으로 받은 것만, 문의는 이메일 안내만 */
import { IN_CLAUDE } from "../core/config.js";
import { S } from "../core/state.js";
import { TARGET } from "../core/target.js";
import { $, $$, ago, esc, toast } from "../core/util.js";
import { SB, acctName } from "../services/supabase.js";
import { ASK_CATS, ASK_DAILY, ASK_STATUS, SUPPORT, SUPPORT_MAIL, supportErr } from "../services/support.js";
import { runExt } from "./ext.js";
import { faqGroups } from "./faq.js";
import { ICON } from "./icons.js";
import { confirmSheet } from "./sheet.js";
import { bindGo, go, topbar } from "./shell.js";
/** @typedef {import("../core/types.js").Notice} Notice */
/** @typedef {import("../core/types.js").Inquiry} Inquiry */

const TABS = [["faq", "자주 묻는 질문"], ["ask", "문의하기"]];
const SITE = "https://20232497.github.io/HEARTSYNC/";
const SEEN = "hv1_notice_seen"; // 마지막으로 본 공지 id(가장 큰 것) — MY의 '새 공지' 표시
/** 정적 문서(terms.html·privacy.html) 주소 — 파일로 열었거나 claude.ai 안이면 같은 폴더에 문서가 없으니 웹 주소로. @param {string} f @returns {string} */
export function docUrl(f) { return location.protocol === "file:" || IN_CLAUDE ? SITE + f : f; }
const day = (t) => { const d = new Date(t); return isNaN(d) ? "" : d.toLocaleDateString("ko-KR"); };
// 공지·답변 본문: esc 뒤 주소만 링크로(따옴표·꺾쇠는 이미 이스케이프돼 속성을 깨지 못함)
const rich = (s) => esc(s).replace(/https?:\/\/[^\s<]+/g, (u) => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`);
const seenId = () => { try { return +localStorage.getItem(SEEN) || 0; } catch { return 0; } };
/** 이 기기에서 아직 안 본 공지가 있는지(마지막으로 받은 목록 기준). @returns {boolean} */
export function hasNewNotice() { const s = seenId(); return SUPPORT.cached().some((n) => +n.id > s); }
let checkedAt = 0;
/** MY를 열 때 공지를 가끔(이 페이지에서 30분에 한 번) 받아 '새 공지'(#noticeNew)를 맞춤 — 실패는 조용히 넘김. @returns {void} */
export function checkNotices() {
  if (!SB.on() || Date.now() - checkedAt < 1800000) return;
  checkedAt = Date.now();
  SUPPORT.notices().then(() => { const el = $("#noticeNew"); if (el) el.textContent = hasNewNotice() ? "새 공지" : ""; }).catch(() => {});
}

export function viewHelp(arg) {
  if (arg === "notice") { location.replace("#notice"); return; } // 예전 주소
  const tab = TABS.some((t) => t[0] === arg) ? arg : "faq", v = $("#view");
  v.innerHTML = `<div class="page help-page">${topbar()}
    <div class="help-head"><button class="icon-btn" data-go="me" aria-label="MY로 돌아가기">${ICON.back}</button><h1 class="sec">고객센터</h1></div>
    <div class="tabs" role="tablist">${TABS.map(([k, l]) => `<button type="button" role="tab" data-htab="${k}" aria-selected="${k === tab}" class="${k === tab ? "on" : ""}">${l}</button>`).join("")}</div>
    <div id="helpBody"></div></div>`;
  bindGo(v);
  $$("[data-htab]", v).forEach((b) => b.onclick = () => go("help-" + b.dataset.htab));
  const box = $("#helpBody", v);
  if (tab === "ask") askTab(box); else faqTab(box);
}

/* ---------------------------------------------------------------- 공지(메뉴 화면) */
export function viewNotice() {
  const v = $("#view");
  v.innerHTML = `<div class="page help-page">${topbar()}<h1 class="sec" style="margin-top:4px">공지</h1><div id="helpBody"></div></div>`;
  bindGo(v);
  noticeBody($("#helpBody", v));
}
/** 공지 한 개(접힘). @param {Notice} n @param {boolean} open @returns {string} */
function noticeHTML(n, open) {
  return `<details class="notice" data-nid="${+n.id}" ${open ? "open" : ""}><summary><span class="t">${n.pinned ? `<span class="pill">고정</span>` : ""}${n.published === false ? `<span class="pill gold">비공개</span>` : ""}<b>${esc(n.title)}</b></span><span class="d">${day(n.created_at)}</span></summary>
    <div class="nbody">${rich(n.body)}</div></details>`;
}
async function noticeBody(box) {
  const seen = seenId();
  const paint = (list, msg) => {
    box.innerHTML = (msg ? `<p class="note help-msg">${esc(msg)}</p>` : "") +
      (list.length ? `<div class="nlist">${list.map((n, i) => noticeHTML(n, (i === 0 && +n.id > seen) || (n.pinned && +n.id > seen))).join("")}</div>` : `<div class="empty">아직 공지가 없어요.</div>`);
    const top = list.reduce((a, n) => Math.max(a, +n.id || 0), 0);
    if (top > seen) { try { localStorage.setItem(SEEN, String(top)); } catch {} }
    runExt("help", "notice", box, list);
  };
  const cached = SUPPORT.cached();
  if (!SB.on()) return paint(cached, `공지사항은 웹 주소(${SITE.replace("https://", "")})에서 최신으로 볼 수 있어요.`);
  box.innerHTML = cached.length ? "" : `<p class="note">불러오는 중…</p>`;
  if (cached.length) paint(cached);
  try { paint(await SUPPORT.notices()); }
  catch (e) { paint(cached, supportErr(e) + (cached.length ? " 마지막으로 받은 공지를 보여 드려요." : "")); }
}

/* ---------------------------------------------------------------- 자주 묻는 질문(찾기 + 묶음별 접기) */
function faqTab(box) {
  box.innerHTML = `<div class="field faq-find"><label for="faqQ" class="sr">질문 찾기</label><input id="faqQ" type="search" placeholder="궁금한 것을 찾아보세요 (예: 하트, 비밀번호, 성인)" autocomplete="off"></div>
    <div id="faqList">${faqGroups().map(([g, items]) => `<section class="faq-grp"><h3>${esc(g)}</h3>${items.map(([q, a]) => `<details class="faq"><summary>${esc(q)}</summary><div class="a">${a}</div></details>`).join("")}</section>`).join("")}</div>
    <p class="empty" id="faqNone" hidden>찾는 질문이 없어요. <a href="#help-ask">문의하기</a>로 물어봐 주세요.</p>
    <p class="note" style="margin-top:14px">찾는 답이 없으면 <a href="#help-ask">문의하기</a>로 알려 주세요.</p>`;
  const q = $("#faqQ", box);
  q.oninput = () => {
    const t = q.value.trim().toLowerCase(); let any = false;
    $$(".faq-grp", box).forEach((g) => {
      let hit = 0;
      $$("details", g).forEach((d) => { const ok = !t || d.textContent.toLowerCase().indexOf(t) >= 0; d.hidden = !ok; d.open = !!t && ok; if (ok) hit++; });
      g.hidden = !hit; if (hit) any = true;
    });
    $("#faqNone", box).hidden = any;
  };
}

/* ---------------------------------------------------------------- 문의하기(로그인한 사람만 — 본인 문의만 보임, RLS) */
/** 내 문의 한 개. @param {Inquiry} a @returns {string} */
export function askHTML(a, extra = "") {
  const cat = (ASK_CATS.find((c) => c[0] === a.category) || ["", "기타"])[1];
  return `<details class="ask" data-aid="${+a.id}"><summary><span class="t"><span class="pill ${a.status === "open" ? "" : "ok"}">${ASK_STATUS[a.status] || esc(a.status)}</span><b>${esc(a.title)}</b></span><span class="d">${esc(cat)} · ${day(a.created_at)}</span></summary>
    <div class="nbody">${rich(a.body)}</div>
    ${a.answer ? `<div class="answer"><b>운영자 답변</b><span class="d">${day(a.answered_at)}</span><div>${rich(a.answer)}</div></div>` : ""}${extra}</details>`;
}
function askTab(box) {
  const mail = `<a href="mailto:${SUPPORT_MAIL}">${SUPPORT_MAIL}</a>`;
  if (!SB.on()) {
    box.innerHTML = `<div class="box"><p>${IN_CLAUDE ? "claude.ai 안에서는 문의를 남길 수 없어요." : "계정 서버가 연결되지 않았어요."} 이메일 ${mail}로 보내 주시거나, 웹 주소(<a href="${SITE}" target="_blank" rel="noopener">${SITE.replace("https://", "")}</a>)에서 로그인한 뒤 문의해 주세요.</p></div>`;
    runExt("help", "ask", box, []); return;
  }
  if (!SB.s) {
    box.innerHTML = `<div class="box"><p>로그인하면 문의를 남기고 답변도 여기서 확인할 수 있어요.</p><div class="cta-row" style="margin-top:12px"><button class="btn pri" data-go="login">로그인 · 회원가입</button></div>
      <p class="note" style="margin:12px 0 0">로그인하지 않고 문의하려면 ${mail}로 메일을 보내 주세요.</p></div>`;
    bindGo(box); runExt("help", "ask", box, []); return;
  }
  box.innerHTML = `<form class="box ask-form" id="askForm" novalidate>
      <p class="note" style="margin:0 0 4px"><b>${esc(acctName())}</b> 계정으로 남겨요. 답변은 아래 '내 문의'에서 확인할 수 있어요.</p>
      <div class="two"><div class="field"><label for="aCat">분류</label><select id="aCat">${ASK_CATS.map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select></div>
        <div class="field"><label for="aMail">답변 받을 이메일 <span class="note">선택</span></label><input id="aMail" type="email" inputmode="email" autocomplete="email" maxlength="120" placeholder="이메일로도 답을 받으려면"></div></div>
      <div class="field"><label for="aTitle">제목</label><input id="aTitle" maxlength="100" autocomplete="off"></div>
      <div class="field"><label for="aBody" style="display:flex">내용<span class="spacer"></span><output id="aCnt" class="note">0 / 4000</output></label><textarea id="aBody" maxlength="4000" style="min-height:150px" placeholder="무엇을 하다가 어떤 일이 있었는지 적어 주시면 빨리 도와드릴 수 있어요. 비밀번호·API 키는 적지 마세요."></textarea></div>
      <div class="toggle"><label for="aMeta">앱·브라우저 정보 함께 보내기 <span class="note">브라우저 종류·화면 크기·AI 연결 방식(오류 원인을 찾는 데 써요)</span></label><input type="checkbox" id="aMeta"></div>
      <p class="lerr" id="aErr" role="alert"></p>
      <div class="cta-row" style="margin-top:6px"><span class="note">문의 내용은 답변을 위해 계정을 삭제할 때까지 보관해요 · <a href="${docUrl("privacy.html")}#items" target="_blank" rel="noopener">개인정보처리방침</a></span><span class="spacer"></span><button class="btn pri" type="submit" id="aSend">보내기</button></div>
    </form>
    <h2 class="sec">내 문의 <small>하루 ${ASK_DAILY}건까지</small></h2><div id="askList"><p class="note">불러오는 중…</p></div>`;
  const err = $("#aErr", box), body = $("#aBody", box);
  // 선택 수집 항목이라 미리 켜 두지 않음 — 오류 신고를 고르면 켜 보라고 한 줄 안내
  $("#aCat", box).onchange = (e) => { if (e.target.value === "bug" && !$("#aMeta", box).checked) err.textContent = "오류 신고는 '앱·브라우저 정보 함께 보내기'를 켜 주시면 원인을 찾기 쉬워요."; else if (err.textContent.indexOf("앱·브라우저") >= 0) err.textContent = ""; };
  body.oninput = () => { $("#aCnt", box).textContent = body.value.length + " / 4000"; };
  $("#askForm", box).onsubmit = async (e) => {
    e.preventDefault();
    const title = $("#aTitle", box).value.trim(), text = body.value.trim(), mail = $("#aMail", box).value.trim();
    if (!title) { err.textContent = "제목을 적어 주세요."; return $("#aTitle", box).focus(); }
    if (text.length < 5) { err.textContent = "내용을 5자 이상 적어 주세요."; return body.focus(); }
    if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) { err.textContent = "이메일 주소를 확인해 주세요."; return $("#aMail", box).focus(); }
    const meta = $("#aMeta", box).checked ? { ua: String(navigator.userAgent || "").slice(0, 200), screen: innerWidth + "x" + innerHeight, engine: S.engine, app: TARGET, host: location.host || location.protocol } : null;
    const btn = $("#aSend", box); btn.disabled = true; err.textContent = "";
    try {
      await SUPPORT.ask({ category: $("#aCat", box).value, title, body: text, reply_to: mail, meta });
      toast("문의를 남겼어요. 답변이 오면 '내 문의'에서 볼 수 있어요");
      $("#aTitle", box).value = ""; body.value = ""; body.oninput(); loadMine(box);
    } catch (x) { err.textContent = supportErr(x); }
    btn.disabled = false;
  };
  loadMine(box);
}
async function loadMine(box) {
  const el = $("#askList", box); if (!el) return;
  let list = [];
  try { list = await SUPPORT.mine(); } catch (e) { el.innerHTML = `<p class="note help-msg">${esc(supportErr(e))}</p>`; runExt("help", "ask", box, []); return; }
  el.innerHTML = list.length ? `<div class="nlist">${list.map((a) => askHTML(a, `<div class="cta-row" style="margin:8px 0 0"><span class="note">${ago(Date.parse(a.created_at))}</span><span class="spacer"></span><button type="button" class="btn sm ghost" data-adel="${+a.id}">지우기</button></div>`)).join("")}</div>`
    : `<div class="empty">아직 남긴 문의가 없어요.</div>`;
  $$("[data-adel]", el).forEach((b) => b.onclick = () => confirmSheet("이 문의를 지울까요?", "문의와 답변이 모두 지워지고 되돌릴 수 없어요.", "지우기", async () => {
    try { await SUPPORT.dropAsk(+b.dataset.adel); toast("문의를 지웠어요"); loadMine(box); } catch (e) { toast(supportErr(e)); }
  }));
  runExt("help", "ask", box, list);
}
