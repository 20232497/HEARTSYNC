/* 바닥 시트·확인 창(sheet·confirmSheet), 오버레이 닫기 */
import { $, $$, esc } from "../core/util.js";

export function sheet(html, cls = "") {
  closeOverlays();
  const ov = document.createElement("div");
  ov.className = "overlay";
  ov.innerHTML = `<div class="sheet ${cls}" role="dialog" aria-modal="true">${html}</div>`;
  document.body.append(ov);
  ov.addEventListener("click", (e) => {
    if (e.target === ov || e.target.closest("[data-x]")) ov.remove();
  });
  return ov;
}
export function closeOverlays() {
  $$(".overlay").forEach((o) => o.remove());
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
