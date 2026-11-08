/* 라우팅(go·route)·레일·탭바·상단바·지갑 칩. 화면은 진입점(main.js·admin.js)이 registerViews·setNavs로 등록한다 — 셸은 어떤 화면이 있는지 모른다.
   아래층의 "rooms"·"wallet"·"route" 이벤트를 받아 레일·칩·화면을 다시 그림 */
import { on } from "../core/events.js";
import { S, gen } from "../core/state.js";
import { isAdmin } from "../core/target.js";
import { $, $$, esc, num } from "../core/util.js";
import { freeLeft, isPro } from "../core/wallet.js";
import { IMG } from "../services/images.js";
import { stopGen } from "./chat/generate.js";
import { updateComposer } from "./chat/view.js";
import { coverHTML } from "./cover.js";
import { ICON } from "./icons.js";
import { closeOverlays } from "./sheet.js";

const VIEWS = {}; // 해시 앞부분 → 화면 함수. "c-<id>"·"r-<id>"처럼 "-" 뒤는 인자로 넘김
let NAVS = [];    // 레일·탭바 메뉴 [해시, 이름, ICON 키]
export function registerViews(map) { Object.assign(VIEWS, map); }
export function setNavs(list) { NAVS = list; }
export function go(hash) { if (location.hash === "#" + hash) route(); else location.hash = hash; }
// #view는 안의 화면이 바뀌어도 스크롤이 남음 — 주소가 바뀔 때만 옮김(같은 주소를 다시 그리면 계정 동기화·스토어 완료처럼 보던 자리 그대로)
let routed = null, homeY = 0; // 마지막으로 그린 주소 · 홈을 떠날 때의 스크롤
export function route() {
  const h = location.hash.slice(1) || "home", v = $("#view"), moved = h !== routed;
  if (moved && routed === "home") homeY = v.scrollTop;
  routed = h;
  closeOverlays();
  if (gen && !h.startsWith("r-")) stopGen();
  document.body.classList.toggle("in-chat", h.startsWith("r-"));
  const [base, ...rest] = h.split("-"); const arg = rest.join("-");
  const view = VIEWS[base] || VIEWS.home;
  setNav(base === "c" ? "home" : base === "r" ? "chats" : base === "login" || base === "help" ? "me" : VIEWS[base] ? base : "home");
  const out = view ? view(arg) : undefined;
  if (moved) v.scrollTop = h === "home" ? homeY : 0; // 새 화면은 맨 위부터, 긴 홈은 작품을 보고 돌아오면 보던 자리
  return out;
}
export const LOGO = `<div class="logo"><span class="mark" aria-hidden="true"></span><span>HEART <i>SYNC</i></span></div>`;
export function renderShell() {
  $("#rail").innerHTML = LOGO + (isAdmin() ? `<span class="pill" style="margin:-8px 0 8px 14px;justify-self:start">관리자 도구</span>` : "") +
    NAVS.map(([k, l, i]) => `<button class="nav" data-nav="${k}">${ICON[i]}<span>${l}</span></button>`).join("") +
    `<h4>최근 대화</h4><div id="railRecent"></div><div class="rail-foot"><button class="wallet" id="railWallet" aria-label="내 재화, 스토어로 이동"></button></div>`;
  $("#tabbar").innerHTML = NAVS.map(([k, l, i]) => `<button data-nav="${k}">${ICON[i]}<span>${l}</span></button>`).join("");
  $$("[data-nav]").forEach((b) => b.onclick = () => go(b.dataset.nav));
  $("#railWallet").onclick = () => go("store");
  renderRailRecent(); renderWalletChips();
}
function setNav(k) { $$("[data-nav]").forEach((b) => b.classList.toggle("on", b.dataset.nav === k)); }
export function renderRailRecent() {
  const el = $("#railRecent"); if (!el) return;
  el.innerHTML = S.rooms.slice(0, 6).map((r) => `<button class="recent" data-room="${esc(r.id)}">${coverHTML(r)}<span>${esc(r.name)}</span></button>`).join("") ||
    `<p class="note" style="padding:0 12px">아직 대화가 없어요.</p>`;
  $$("[data-room]", el).forEach((b) => b.onclick = () => go("r-" + b.dataset.room));
  IMG.hydrate(el);
}
function walletHTML() {
  return isPro() ? `<span class="badge-pro">PLUS</span><span class="h">♥ ${num(S.wallet.hearts)}</span>`
    : `<span class="f">무료 <b style="color:var(--fg)">${freeLeft()}</b>턴</span><span class="h">♥ ${num(S.wallet.hearts)}</span>`;
}
export function renderWalletChips() { $$(".wallet").forEach((w) => { w.innerHTML = walletHTML(); w.classList.toggle("pro", isPro()); }); updateComposer(); }
export function topbar(extra = "") {
  return `<div class="topbar">${LOGO}${extra}<span class="spacer"></span>
    <button class="wallet" data-go="store" aria-label="내 재화, 스토어로 이동">${walletHTML()}</button></div>`;
}
export function bindGo(root) { $$("[data-go]", root).forEach((b) => b.onclick = () => go(b.dataset.go)); }
on("rooms", renderRailRecent); on("wallet", renderWalletChips); on("route", route);
