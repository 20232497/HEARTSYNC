/* ---------------------------------------------------------------- 대화 목록 */
function viewChats() {
  const v = $("#view");
  v.innerHTML = `<div class="page">${topbar()}<h1 class="sec" style="margin-top:4px">대화</h1>
    ${S.rooms.length ? `<div class="cont" style="grid-template-columns:1fr">${S.rooms.map((r) => `
      <button data-room="${esc(r.id)}">${coverHTML(r)}<span class="x"><b>${esc(r.title)} <span class="note" style="display:inline;font-weight:400">· ${esc(r.name)}</span></b><span>${esc(r.last) || "대화를 시작해 보세요"}</span></span><span class="note">${ago(r.at)}</span></button>`).join("")}</div>`
      : `<div class="empty">아직 대화가 없어요. 마음에 드는 작품을 골라 첫 대화를 시작해 보세요.<br><button class="btn sm pri" data-go="home">작품 둘러보기</button></div>`}</div>`;
  bindGo(v); IMG.hydrate(v);
  $$("[data-room]", v).forEach((b) => b.onclick = () => go("r-" + b.dataset.room));
}
