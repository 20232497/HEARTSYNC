/* 바닥 시트·확인 창(sheet·confirmSheet), 오버레이 닫기 */
import { $, $$, esc } from "../core/util.js";

export function sheet(html, cls = "") {
  closeOverlays();
  const ov = document.createElement("div");
  ov.className = "overlay";
  ov.innerHTML = `<div class="sheet ${cls}" role="dialog" aria-modal="true">${html}</div>`;
  document.body.append(ov);
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
