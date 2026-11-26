/* 대화 목록: 즐겨찾기한 방이 맨 위 묶음(별 버튼으로 켜고 끔 — core/rooms.js setFav, LIMITS.favRooms개까지), 그 아래 최근 대화. 순서는 S.rooms 그대로(sortRooms).
   맨 아래에 최근 본 작품을 작게 — 왼쪽 메뉴가 없는 좁은 화면에서만 보임(넓은 화면은 왼쪽 메뉴에 있음, 2026-11-21 사용자 결정) */
import { LIMITS } from "../core/constants.js";
import { on } from "../core/events.js";
import { setFav } from "../core/rooms.js";
import { S } from "../core/state.js";
import { $, $$, ago, esc, toast } from "../core/util.js";
import { IMG } from "../services/images.js";
import { coverHTML } from "./cover.js";
import { bindGo, go, roomSetupHTML, topbar, viewedWorks, writingMark } from "./shell.js";

/* 방 한 줄: 방으로 가는 버튼 + 즐겨찾기 별(버튼 안에 버튼을 넣지 않으려고 나란히 둠) */
const chatRowHTML = (r) =>
  `<div class="crow"><button data-room="${esc(r.id)}">${coverHTML(r)}<span class="x"><b>${esc(r.title)} ` +
  `<span class="note" style="display:inline;font-weight:400">· ${esc(r.name)}</span>` +
  `${writingMark(r)}${r.fork ? ' <span class="pill">분기</span>' : ""}` +
  `${r.ep ? ` <span class="pill">${r.ep === "결말" ? "결말" : "에피소드 · " + esc(r.ep)}</span>` : ""}` +
  `${r.side ? ' <span class="pill">외전</span>' : ""}</b>${roomSetupHTML(r)}` +
  `<span>${esc(r.last) || "대화를 시작해 보세요"}</span></span><span class="note">${ago(r.at)}</span></button>` +
  `<button type="button" class="fav-btn" data-fav="${esc(r.id)}" aria-pressed="${!!r.fav}" aria-label="즐겨찾기"` +
  ` title="${r.fav ? "즐겨찾기 풀기" : "즐겨찾기 — 목록 맨 위에 고정"}">${r.fav ? "★" : "☆"}</button></div>`;

export function viewChats() {
  const v = $("#view"),
    favs = S.rooms.filter((r) => r.fav),
    rest = S.rooms.filter((r) => !r.fav),
    seen = viewedWorks();
  const list = (rooms) => `<div class="cont rooms">${rooms.map(chatRowHTML).join("")}</div>`;
  v.innerHTML =
    `<div class="page">${topbar()}<h1 class="sec" style="margin-top:4px">대화</h1>` +
    (S.rooms.length
      ? (favs.length ? `<h2 class="sec" id="favHead">즐겨찾기 <small>${favs.length} / ${LIMITS.favRooms}</small></h2>${list(favs)}` : "") +
        (favs.length && rest.length ? `<h2 class="sec">최근 대화</h2>` : "") +
        (rest.length ? list(rest) : "")
      : `<div class="empty">아직 대화가 없어요. 마음에 드는 작품을 골라 첫 대화를 시작해 보세요.<br>` +
        `<button class="btn sm pri" data-go="home">작품 둘러보기</button></div>`) +
    (seen.length
      ? `<div class="chats-viewed"><h2 class="sec">최근 본 작품</h2><div class="chips">` +
        seen.map((c) => `<button class="chip" data-char="${esc(c.id)}">${coverHTML(c)}<span>${esc(c.name)}</span></button>`).join("") +
        `</div></div>`
      : "") +
    `</div>`;
  bindGo(v);
  IMG.hydrate(v);
  $$("[data-room]", v).forEach((b) => (b.onclick = () => go("r-" + b.dataset.room)));
  $$("[data-char]", v).forEach((b) => (b.onclick = () => go("c-" + b.dataset.char)));
  $$("[data-fav]", v).forEach(
    (b) =>
      (b.onclick = async () => {
        const on = b.getAttribute("aria-pressed") !== "true";
        if (!(await setFav(b.dataset.fav, on))) return toast(`즐겨찾기는 ${LIMITS.favRooms}개까지예요 — 하나를 풀고 다시 눌러 주세요`);
        if (location.hash.slice(1) === "chats") viewChats(); // 순서가 바뀌므로 다시 그림(스크롤 자리는 그대로)
      })
  );
}
// 목록을 보는 사이 방이 바뀜 — 떠난 방의 답이 끝났거나(마지막 말·'쓰는 중' 표시) 계정에서 받음. 스크롤 자리는 그대로
on("rooms", () => {
  if (location.hash.slice(1) === "chats") viewChats();
});
