/* ---------------------------------------------------------------- 라우팅·셸 */
function go(hash) { if (location.hash === "#" + hash) route(); else location.hash = hash; }
function route() {
  const h = location.hash.slice(1) || "home";
  closeOverlays();
  if (gen && !h.startsWith("r-")) stopGen();
  document.body.classList.toggle("in-chat", h.startsWith("r-"));
  const [base, ...rest] = h.split("-"); const arg = rest.join("-");
  setNav(base === "c" ? "home" : base === "r" ? "chats" : base === "login" ? "me" : base);
  if (base === "c") return viewDetail(arg);
  if (base === "r") return viewChat(arg);
  if (base === "chats") return viewChats();
  if (base === "studio") return viewStudio(arg);
  if (base === "store") return viewStore();
  if (base === "me") return viewMe();
  if (base === "login") return viewLogin();
  return viewHome();
}
const LOGO = `<div class="logo"><span class="mark" aria-hidden="true"></span><span>HEART <i>SYNC</i></span></div>`;
const NAVS = [["home", "홈", "home"], ["chats", "대화", "chat"], ["studio", "만들기", "plus"], ["store", "스토어", "heart"], ["me", "MY", "user"]];
function renderShell() {
  $("#rail").innerHTML = LOGO +
    NAVS.map(([k, l, i]) => `<button class="nav" data-nav="${k}">${ICON[i]}<span>${l}</span></button>`).join("") +
    `<h4>최근 대화</h4><div id="railRecent"></div><div class="rail-foot"><button class="wallet" id="railWallet" aria-label="내 재화, 스토어로 이동"></button></div>`;
  $("#tabbar").innerHTML = NAVS.map(([k, l, i]) => `<button data-nav="${k}">${ICON[i]}<span>${l}</span></button>`).join("");
  $$("[data-nav]").forEach((b) => b.onclick = () => go(b.dataset.nav));
  $("#railWallet").onclick = () => go("store");
  renderRailRecent(); renderWalletChips();
}
function setNav(k) { $$("[data-nav]").forEach((b) => b.classList.toggle("on", b.dataset.nav === k)); }
function renderRailRecent() {
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
function renderWalletChips() { $$(".wallet").forEach((w) => { w.innerHTML = walletHTML(); w.classList.toggle("pro", isPro()); }); updateComposer(); }
function topbar(extra = "") {
  return `<div class="topbar">${LOGO}${extra}<span class="spacer"></span>
    <button class="wallet" data-go="store" aria-label="내 재화, 스토어로 이동">${walletHTML()}</button></div>`;
}
function bindGo(root) { $$("[data-go]", root).forEach((b) => b.onclick = () => go(b.dataset.go)); }
