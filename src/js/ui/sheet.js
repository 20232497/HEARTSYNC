/* 바닥 시트·확인 창(sheet·confirmSheet), 오버레이 닫기, 겹(시트·서랍)의 키보드 — 포커스를 안으로·Tab은 안에서만·Esc는 맨 위 겹만·닫히면 연 자리로 */
import { $, $$, esc } from "../core/util.js";

export function sheet(html, cls = "") {
  closeOverlays();
  const ov = document.createElement("div");
  ov.className = "overlay";
  ov.innerHTML = `<div class="sheet ${cls}" role="dialog" aria-modal="true">${html}</div>`;
  document.body.append(ov);
  holdFocus(ov, $(".sheet", ov));
  ov.addEventListener("click", (e) => {
    if (e.target === ov || e.target.closest("[data-x]")) shut(ov);
  });
  return ov;
}
/* 겹 하나를 닫음 — 닫힐 때 할 일(ov.onShut)이 걸려 있으면 한 번 부름. 버튼이 아닌 길(배경·취소·Esc·화면 이동·다른 시트가 열림)로 닫혀도
   뒤처리가 끝나야 하는 창이 씀(처음 로그인 합치기 창 — ui/account.js). 버튼이 직접 ov.remove()로 닫는 길에서는 부르지 않음 */
function shut(ov) {
  const f = ov.onShut;
  ov.onShut = null;
  ov.remove();
  if (f) f();
}
export function closeOverlays() {
  $$(".overlay").forEach(shut);
}
const FOCUSABLE = "button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex='-1'])";
/**
 * 겹(시트·방 서랍)의 키보드(2026-11-26 프레임 7차 C3): 열면 포커스를 겹 안으로(상자 자체 — 입력칸에 바로 두지 않아 휴대폰 자판이 뜨지 않음),
 * Tab·Shift+Tab은 겹 안에서만 돎(브라우저마다 Tab이 건너뛰는 것이 달라 — 사파리는 버튼을 건너뜀 — 직접 옮김), 닫히면 연 자리로 포커스를 돌려줌.
 * 닫는 길이 여럿이라(배경·닫기 버튼·Esc·화면 이동·버튼이 직접 ov.remove()) remove에 돌려주기를 붙임 — 그사이 다른 곳에 포커스가 갔으면 건드리지 않음.
 * @param {HTMLElement} ov 겹(.overlay) @param {HTMLElement} box 그 안의 창(.sheet·.drawer)
 */
export function holdFocus(ov, box) {
  const back = document.activeElement,
    rm = ov.remove.bind(ov);
  box.tabIndex = -1;
  box.focus({ preventScroll: true });
  ov.remove = () => {
    rm();
    const now = document.activeElement;
    if (back && back.isConnected && back.focus && (!now || now === document.body)) back.focus({ preventScroll: true });
  };
  ov.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    e.preventDefault();
    const f = $$(FOCUSABLE, box).filter((x) => x.getClientRects().length);
    if (!f.length) return box.focus({ preventScroll: true });
    const i = f.indexOf(document.activeElement),
      n = f.length; // 상자 자체에 있으면 i가 -1 — 앞으로는 첫째, 뒤로는 마지막
    f[e.shiftKey ? (i <= 0 ? n - 1 : i - 1) : (i + 1) % n].focus();
  });
}
/** Esc 한 번 — 크게 보기가 떠 있으면 그것을, 아니면 맨 위 겹 하나를 닫음. 닫은 것이 있으면 true(boot.js의 키 처리가 부름 — 없으면 쓰던 답 중지로). @returns {boolean} */
export function escapeLayer() {
  const lb = $(".lightbox"),
    all = $$(".overlay");
  if (lb) lb.remove();
  else if (all.length) shut(all[all.length - 1]);
  return !!(lb || all.length);
}
export function confirmSheet(title, sub, okLabel, onOk) {
  const ov = sheet(
    `<h2>${esc(title)}</h2><p class="sub">${esc(sub)}</p><div class="cta-row"><span class="spacer"></span>` +
      `<button class="btn ghost" data-x>취소</button><button class="btn pri" id="ok">${esc(okLabel)}</button></div>`
  );
  $("#ok", ov).onclick = () => {
    ov.remove();
    onOk();
  };
}
