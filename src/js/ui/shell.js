/* 라우팅(go·route)·레일(메뉴·최근 대화·최근 본 작품)·탭바·상단바·지갑 칩. 화면은 진입점(main.js·admin.js)이 registerViews·setNavs로 등록한다 — 셸은 어떤 화면이 있는지 모른다.
   아래층의 "rooms"·"wallet"·"settings"·"route" 이벤트를 받아 레일·칩·화면을 다시 그림 */
import { audOK } from "../core/audience.js";
import { getChar } from "../core/character.js";
import { on } from "../core/events.js";
import { recentIds } from "../core/shelf.js";
import { S, gen } from "../core/state.js";
import { isAdmin } from "../core/target.js";
import { $, $$, esc, num } from "../core/util.js";
import { freeLeft, isPro } from "../core/wallet.js";
import { IMG } from "../services/images.js";
import { coverHTML } from "./cover.js";
import { ICON } from "./icons.js";
import { closeOverlays } from "./sheet.js";
/** @typedef {import("../core/types.js").Work} Work */

const VIEWS = {}; // 해시 앞부분 → 화면 함수. "c-<id>"·"r-<id>"처럼 "-" 뒤는 인자로 넘김
let NAVS = []; // 레일·탭바 메뉴 [해시, 이름, ICON 키]
export function registerViews(map) {
  Object.assign(VIEWS, map);
}
export function setNavs(list) {
  NAVS = list;
}
export function go(hash) {
  if (location.hash === "#" + hash) route();
  else location.hash = hash;
}
// #view는 안의 화면이 바뀌어도 스크롤이 남음 — 주소가 바뀔 때만 옮김(같은 주소를 다시 그리면 계정 동기화·스토어 완료처럼 보던 자리 그대로)
let routed = null,
  homeY = 0; // 마지막으로 그린 주소 · 홈을 떠날 때의 스크롤
export function route() {
  const h = location.hash.slice(1) || "home",
    v = $("#view"),
    moved = h !== routed;
  if (moved && routed === "home") homeY = v.scrollTop;
  routed = h;
  closeOverlays(); // 쓰던 답은 다른 화면으로 가도 멈추지 않음(프레임 7차 C10 — 끝나면 그 방에 저장되고, 왼쪽 메뉴·대화 목록에 '쓰는 중')
  document.body.classList.toggle("in-chat", h.startsWith("r-"));
  document.body.classList.toggle("in-detail", h.startsWith("c-")); // 상세: 좁은 화면에서 아래에 고정된 시작 버튼 줄 위로 토스트를 올림(35-detail.css)
  const [base, ...rest] = h.split("-");
  const arg = rest.join("-");
  const view = VIEWS[base] || VIEWS.home;
  setNav(base === "c" ? "home" : base === "r" ? "chats" : base === "login" || base === "help" ? "me" : VIEWS[base] ? base : "home");
  const out = view ? view(arg) : undefined;
  renderRailViewed(); // 상세를 열면 최근 본 작품이 바뀜(touchRecent)
  if (moved) v.scrollTop = h === "home" ? homeY : 0; // 새 화면은 맨 위부터, 긴 홈은 작품을 보고 돌아오면 보던 자리
  return out;
}
export const LOGO = `<div class="logo"><span class="mark" aria-hidden="true"></span><span>HEART <i>SYNC</i></span></div>`;
export function renderShell() {
  $("#rail").innerHTML =
    LOGO +
    (isAdmin() ? `<span class="pill" style="margin:-8px 0 8px 14px;justify-self:start">관리자 도구</span>` : "") +
    NAVS.map(([k, l, i]) => `<button class="nav" data-nav="${k}">${ICON[i]}<span>${l}</span></button>`).join("") +
    `<h4>최근 대화</h4><div id="railRecent"></div><div id="railViewed"></div>` +
    `<div class="rail-foot"><button class="wallet" id="railWallet" aria-label="내 재화, 스토어로 이동"></button></div>`;
  $("#tabbar").innerHTML = NAVS.map(([k, l, i]) => `<button data-nav="${k}">${ICON[i]}<span>${l}</span></button>`).join("");
  $$("[data-nav]").forEach((b) => (b.onclick = () => go(b.dataset.nav)));
  $("#railWallet").onclick = () => go("store");
  renderRailRecent();
  renderRailViewed();
  renderWalletChips();
}
function setNav(k) {
  $$("[data-nav]").forEach((b) => b.classList.toggle("on", b.dataset.nav === k));
}
/** 즐겨찾기한 방의 이름 앞 별 — 왼쪽 메뉴의 최근 대화·상세의 내 대화방(순서는 S.rooms 그대로라 즐겨찾기가 앞에 옴). @param {{ fav?: boolean }} r @returns {string} HTML */
export function favMark(r) {
  return r.fav ? '<i class="fav-mark" title="즐겨찾기">★</i>' : "";
}
/**
 * 방 목록 항목의 '시작 상황 · 페르소나' 한 줄(같은 작품의 방 여러 개를 구별) — 대화 목록·상세의 내 대화방. 예전 항목처럼 둘 다 없으면 빈 문자열.
 * @param {import("../core/types.js").RoomIndex} r @returns {string}
 */
export function roomSetupHTML(r) {
  const t = [r.opening, r.personaName].filter(Boolean).map(esc).join(" · ");
  return t ? `<span class="r-setup">${t}</span>` : "";
}
export function renderRailRecent() {
  const el = $("#railRecent");
  if (!el) return;
  el.innerHTML =
    S.rooms
      .slice(0, 6)
      .map((r) => `<button class="recent" data-room="${esc(r.id)}">${coverHTML(r)}<span>${favMark(r)}${esc(r.name)}${writingMark(r)}</span></button>`)
      .join("") || `<p class="note" style="padding:0 12px">아직 대화가 없어요.</p>`;
  $$("[data-room]", el).forEach((b) => (b.onclick = () => go("r-" + b.dataset.room)));
  IMG.hydrate(el);
}
/** 작품 id 목록 → 지금 보이는 작품(관심있는 대화로 거름, 없어진 작품은 빠짐, 순서 그대로) — 방이 없는 목록(최근 본·MY의 찜한 작품)이 씀. @param {string[]} ids @returns {Work[]} */
export const shownWorks = (ids) => ids.map((id) => getChar(id)).filter((c) => c && audOK(c));
/** 최근 본 작품 — 방금 본 것 먼저. 왼쪽 메뉴와 대화 탭(ui/chats.js)이 같이 씀. @returns {Work[]} */
export const viewedWorks = () => shownWorks(recentIds());
/** 왼쪽 메뉴의 '최근 본 작품' — 작게 네 개까지(없으면 제목도 숨김). 홈의 줄을 여기로 옮김(2026-11-21 사용자 결정) — 좁은 화면에는 레일이 없어 대화 탭 아래에 보임 */
export function renderRailViewed() {
  const el = $("#railViewed");
  if (!el) return;
  const list = viewedWorks().slice(0, 4);
  el.innerHTML = list.length
    ? `<h4>최근 본 작품</h4>` + list.map((c) => `<button class="recent" data-char="${esc(c.id)}">${coverHTML(c)}<span>${esc(c.name)}</span></button>`).join("")
    : "";
  $$("[data-char]", el).forEach((b) => (b.onclick = () => go("c-" + b.dataset.char)));
  IMG.hydrate(el);
}
/** 답을 쓰는 중인 방의 표시 — 왼쪽 메뉴의 최근 대화·대화 목록(그 방을 떠나도 답은 계속 씀). @param {{ id: string }} r @returns {string} HTML */
export function writingMark(r) {
  return gen && gen.roomId === r.id ? ' <i class="writing">쓰는 중</i>' : "";
}
function walletHTML() {
  return isPro()
    ? `<span class="badge-pro">PLUS</span><span class="h">♥ ${num(S.wallet.hearts)}</span>`
    : `<span class="f">무료 <b style="color:var(--fg)">${freeLeft()}</b>턴</span><span class="h">♥ ${num(S.wallet.hearts)}</span>`;
}
export function renderWalletChips() {
  $$(".wallet").forEach((w) => {
    w.innerHTML = walletHTML();
    w.classList.toggle("pro", isPro());
  });
}
export function topbar(extra = "") {
  return `<div class="topbar">${LOGO}${extra}<span class="spacer"></span>
    <button class="wallet" data-go="store" aria-label="내 재화, 스토어로 이동">${walletHTML()}</button></div>`;
}
export function bindGo(root) {
  $$("[data-go]", root).forEach((b) => (b.onclick = () => go(b.dataset.go)));
}
on("rooms", renderRailRecent);
on("rooms", renderRailViewed); // 계정에서 받은 뒤(reloadFromCloud)에도 — 대화방 안에서는 "route" 알림이 없어 이 알림으로 받음
on("settings", renderRailViewed); // 관심있는 대화를 바꾸면 다시 거름
on("wallet", renderWalletChips);
on("route", route);
