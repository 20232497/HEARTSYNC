/* MY의 '내 서재' 칸: 찜한 작품(누르면 작품 상세)과 도감 바로가기 — 휴대폰에서 찜·도감을 찾아 홈을 내려가지 않게(2026-11-21 프레임 7차 C9). MY 화면(ui/me.js)이 그림 */
import { likedIds } from "../core/shelf.js";
import { $$, esc } from "../core/util.js";
import { coverHTML } from "./cover.js";
import { go, shownWorks } from "./shell.js";

/** '내 서재' 칸 — 찜한 작품은 지금 보이는 작품만(관심있는 대화로 거름), 최근에 찜한 순. @returns {string} */
export function shelfHTML() {
  const likes = shownWorks(likedIds());
  return (
    `<h2 class="sec">내 서재</h2><div class="box me-shelf" id="meShelf">` +
    `<div class="menu-list"><button data-go="codex">도감<span class="v">인물·장소·컷씬</span></button></div>` +
    `<h3>찜한 작품 <small>${likes.length}</small></h3>` +
    (likes.length
      ? `<div class="chips">${likes.map(chipHTML).join("")}</div>`
      : `<p class="note">아직 없어요 — 작품 상세에서 찜하기를 누르면 여기에 모여요.</p>`) +
    `</div>`
  );
}
/** 찜한 작품 하나 — 표지와 제목. @param {import("../core/types.js").Work} c @returns {string} */
function chipHTML(c) {
  return `<button class="chip" data-char="${esc(c.id)}">${coverHTML(c)}<span>${esc(c.title)}</span></button>`;
}
/** 찜한 작품 버튼을 작품 상세로(도감 버튼의 data-go는 MY 화면의 bindGo가 맡음). @param {HTMLElement} root */
export function bindShelf(root) {
  $$("#meShelf [data-char]", root).forEach((b) => (b.onclick = () => go("c-" + b.dataset.char)));
}
