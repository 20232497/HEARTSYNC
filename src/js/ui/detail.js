/* 작품 상세 페이지: 왼쪽(넓은 화면에서 고정 — 표지·제목·찜·새 대화 시작·이 작품의 내 대화방) | 오른쪽(탭 줄 + 소개·시작 상황·등장인물과 도감·같은 줄의 다른 작품).
   좁은 화면에서는 찜·시작 버튼 줄이 화면 아래에 고정(35-detail.css .d-cta) — 시작 버튼이 늘 보이게(2026-11-16 프레임 6차, 그 전에는 휴대폰에서 첫 화면 밖이었음).
   탭은 내용을 갈아 끼우지 않고 같은 페이지의 그 자리로 옮김(내용이 모두 문서에 있어 찾기·시험이 쉬움). 시작 버튼과 시작 상황 카드는 시작 창(ui/start-sheet.js)을 엶 */
import { HOME_ROWS, ORIGINALS } from "../content/index.js";
import { audOK } from "../core/audience.js";
import { getChar, normalizeChar } from "../core/character.js";
import { epLength } from "../core/episode.js";
import { endsSet, liked, toggleLike, touchRecent } from "../core/shelf.js";
import { S } from "../core/state.js";
import { $, $$, ago, esc, toast } from "../core/util.js";
import { IMG } from "../services/images.js";
import { endsHTML } from "./chat/episode.js";
import { fmt } from "./chat/render.js";
import { bindCast, bindCodex, castGridHTML, collectHTML, commandsHTML, guideHTML, metaHTML, placesHTML } from "./codex.js";
import { coverHTML, lightbox } from "./cover.js";
import { rowHTML } from "./home.js";
import { ICON } from "./icons.js";
import { bindGo, favMark, go, topbar } from "./shell.js";
import { opBrief, opPlace, startChat, startNote } from "./start-sheet.js";
import { worldArtHTML } from "./worldart.js";
/** @typedef {import("../core/types.js").Work} Work */

/* 소개가 이보다 길면 접어 두고 '더 보기', 플레이 가이드가 이보다 길면 접는 칸으로 */
const LONG_DESC = 320,
  LONG_GUIDE = 240;

export function viewDetail(id) {
  const c = normalizeChar(getChar(id)),
    v = $("#view");
  if (!c) {
    v.innerHTML =
      `<div class="page">${topbar()}<div class="empty">캐릭터를 찾을 수 없어요. 삭제됐거나 아직 불러오는 중일 수 있어요.<br>` +
      `<button class="btn sm" data-go="home">홈으로</button></div></div>`;
    bindGo(v);
    return;
  }
  const rooms = S.rooms.filter((r) => r.charId === c.id);
  const persona = S.personas.find((p) => p.def) || S.personas[0];
  const wa = worldArtHTML(c); // 키워드북이 없으면 칸을 숨김
  const row = HOME_ROWS.find((w) => w.key === c.row),
    near = row ? ORIGINALS.filter((x) => x.row === c.row && x.id !== c.id && audOK(x)) : []; // 같은 홈 줄의 다른 작품(줄이 없는 작품은 탭과 칸을 숨김)
  const likeHTML = (on) => `${ICON.mark}<span>${on ? "찜한 작품" : "찜하기"}</span>`;
  const tabs = [
    ["intro", "소개"],
    ["open", "시작 상황"],
    ["cast", "등장인물·도감"]
  ].concat(near.length ? [["near", "다른 작품"]] : []);
  touchRecent(c.id);
  v.innerHTML =
    `<div class="page d-page">
    ${topbar(`<button class="icon-btn" data-go="home" aria-label="뒤로">${ICON.back}</button>`)}
    <div class="detail">
      <div class="d-side">
        <div class="d-top">${coverHTML(c, "", { vt: true })}
          <div class="d-info"><span class="note">${esc(c.cat)}${c.world_mode ? " · 세계관" : ""} · ${metaHTML(c)}</span>
          <h1>${esc(c.title)}</h1><p class="lead">${esc(c.oneLiner)}</p>` +
    `${c.hold ? `<p class="d-hold" id="dHold">출시판 제외 — ${esc(c.hold)}</p>` : ""}</div>
        </div>
        <div class="tags">${(c.tags || []).map((t) => `<span>#${esc(t)}</span>`).join("")}</div>
        <div class="d-cta"><button class="btn ghost like-btn" id="like" aria-pressed="${liked(c.id)}">${likeHTML(liked(c.id))}</button>` +
    `<button class="btn pri big" id="start">${c.episode ? "에피소드 시작" : "새 대화 시작"}</button></div>
        <p class="note d-price">${startNote(c)}</p>
        ${rooms.length ? `<div class="d-rooms"><h3>이어서 하기 <small>이 작품의 내 대화방</small></h3><div class="cont">${rooms.map(roomHTML).join("")}</div></div>` : ""}
      </div>
      <div class="d-main">
        <div class="d-tabs" id="dTabs" role="navigation" aria-label="이 페이지의 칸">` +
    tabs.map(([k, name]) => `<button type="button" class="d-tab" data-tab="${k}">${name}</button>`).join("") +
    `</div>
        <section id="d-intro">${descHTML(c)}<div${(c.guide || "").length > LONG_GUIDE ? " data-fold" : ""}>${guideHTML(c)}</div>` +
    `${epInfoHTML(c)}<div data-fold>${commandsHTML(c)}</div></section>
        <section id="d-open"><div class="box"><h3>${c.world_mode ? "게임 모드 · 시작 상황" : "시작 상황"} <small>고르면 그 장면에서 시작해요</small></h3>` +
    `<div class="openings">${c.openings.map((o, i) => openingHTML(c, o, i, persona)).join("")}</div></div></section>
        <section id="d-cast"><div class="box"><h3>등장인물 <small>누르면 코드·감정 칸 안내</small>${collectHTML(c)} ` +
    `<button class="btn sm ghost" data-go="codex-${esc(c.id)}" style="float:right">도감</button></h3>
          <div class="cast">${castGridHTML(c)}</div>` +
    `<p class="note d-fields">상태창: ${c.fields.slice(0, 8).map(esc).join(" · ")}${c.fields.length > 8 ? " 외" : ""}</p></div>
          <div data-fold="wide">${placesHTML(c)}<div class="box" id="wArtBox" ${wa ? "" : 'style="display:none"'}><h3>세계관 일러스트</h3>${wa}</div></div></section>
        ${near.length ? `<section id="d-near">${rowHTML("같은 줄의 다른 작품", row.title, near, "rowNear")}</section>` : ""}
      </div>
    </div></div>`;
  const wide = matchMedia("(min-width:781px)").matches; // 그림이 있는 칸(장소·컷씬·세계관 일러스트)은 넓은 화면에서는 펼쳐 두고 휴대폰에서만 접음
  $$("[data-fold] > .box", v).forEach((b) => foldBox(b, wide && b.parentElement.dataset.fold === "wide"));
  bindGo(v);
  IMG.hydrate(v);
  $$("[data-char]", v).forEach((b) => (b.onclick = () => go("c-" + b.dataset.char)));
  $("#like").onclick = (e) => {
    const b = e.currentTarget,
      on = toggleLike(c.id);
    b.setAttribute("aria-pressed", on);
    b.innerHTML = likeHTML(on);
    toast(on ? "찜했어요 — 홈의 '찜한 작품'에서 볼 수 있어요" : "찜을 풀었어요");
  };
  $$("[data-room]", v).forEach((b) => (b.onclick = () => go("r-" + b.dataset.room)));
  $$("[data-wlb]", v).forEach(
    (b) =>
      (b.onclick = () => {
        const i = b.querySelector("img");
        if (i?.src) lightbox(i.src);
      })
  );
  bindCast(v, c);
  bindCodex(v);
  bindTabs(v);
  const more = $("#dMore");
  if (more)
    more.onclick = () => {
      const open = $("#dDesc").classList.toggle("clamp") === false;
      more.textContent = open ? "접기" : "더 보기";
      more.setAttribute("aria-expanded", open);
    };
  $("#start").onclick = () => startChat(c, 0);
  $$("[data-op]", v).forEach((b) => (b.onclick = () => startChat(c, +b.dataset.op)));
}
/* 이 작품의 내 대화방 한 줄(왼쪽 '이어서 하기') — r은 방 목록 항목 */
const roomHTML = (r) =>
  `<button data-room="${esc(r.id)}">${coverHTML(r)}<span class="x"><b>${favMark(r)}${esc(r.name)}</b>` +
  `<span>${esc(r.last)}</span></span><span class="note">${ago(r.at)}</span></button>`;
/* 소개 칸 — 길면 접어 두고 '더 보기' */
function descHTML(c) {
  const long = (c.desc || "").length > LONG_DESC;
  return (
    `<div class="box"><h3>소개</h3><p class="d-desc${long ? " clamp" : ""}" id="dDesc">${esc(c.desc)}</p>` +
    `${long ? `<button type="button" class="btn sm ghost d-more" id="dMore" aria-expanded="false">더 보기</button>` : ""}</div>`
  );
}
/* 시작 상황 카드 — 제목·배경 장소·앞부분, '장면 펼쳐 읽기'(대화방과 같은 서식 함수 fmt — 그림 태그는 빼고 글만: 비공개 그림이 대화 전에 드러나지 않게), 이 상황으로 시작 */
function openingHTML(c, o, i, persona) {
  return (
    `<div class="opening"><b>${esc(o.title)}${opPlace(c, o)}</b><span class="brief">${esc(opBrief(o))}…</span>` +
    `<details class="d-scene"><summary>장면 펼쳐 읽기</summary><div class="bubble">${fmt(o.text.replace(/\[\[[^\]]*\]\]/g, ""), c, persona)}</div></details>` +
    `<button type="button" class="btn sm" data-op="${i}">이 상황으로 시작</button></div>`
  );
}
/* 접는 칸으로 바꿈: .box(div) → details.box(머리 h3가 summary) — 긴 칸(명령어·장소·컷씬·세계관 일러스트·긴 플레이 가이드)이 처음에는 접혀 있게 */
function foldBox(box, open) {
  const h = box.querySelector("h3");
  if (!h) return;
  const d = document.createElement("details"),
    s = document.createElement("summary");
  d.className = box.className;
  d.open = !!open;
  if (box.id) d.id = box.id;
  if (box.style.display) d.style.display = box.style.display;
  s.append(h);
  d.append(s, ...Array.from(box.childNodes));
  box.replaceWith(d);
}
/* 탭 줄: 누르면 그 칸이 탭 줄 바로 아래에 오게 옮기고, 스크롤하는 동안 지금 칸을 강조. 화면이 바뀌어 탭 줄이 사라지면 스크롤 듣기를 스스로 뗌 */
function bindTabs(v) {
  const tabs = $("#dTabs", v),
    btns = $$("[data-tab]", tabs),
    secs = btns.map((b) => $("#d-" + b.dataset.tab, v));
  const mark = () => {
    if (!document.body.contains(tabs)) return v.removeEventListener("scroll", mark);
    const line = tabs.getBoundingClientRect().bottom + 16;
    let cur = 0;
    secs.forEach((s, i) => {
      if (s.getBoundingClientRect().top <= line) cur = i;
    });
    btns.forEach((b, i) => {
      b.classList.toggle("on", i === cur);
      if (i === cur) b.setAttribute("aria-current", "true");
      else b.removeAttribute("aria-current");
    });
  };
  btns.forEach(
    (b, i) =>
      (b.onclick = () => {
        v.scrollTop += secs[i].getBoundingClientRect().top - v.getBoundingClientRect().top - tabs.offsetHeight - 8;
      })
  );
  v.addEventListener("scroll", mark, { passive: true });
  mark();
}
/** 에피소드형 작품의 안내 칸 — 장 수·결말 수·대략의 턴 수와 결말 이름(모두 보이고 본 것에 ✓). 자유형이면 "". @param {Work} c */
function epInfoHTML(c) {
  const ep = c.episode;
  if (!ep) return "";
  const got = endsSet(c.id),
    n = ep.endings.filter((x) => got.has(x.id)).length;
  return (
    `<div class="box ep-info"><h3>에피소드 <small>끝이 있는 이야기</small></h3>
    <p>${ep.beats.length}장 · 결말 ${ep.endings.length}개 · 약 ${epLength(ep)}턴 — 고른 길과 행동에 따라 결말이 갈려요. 결말을 본 뒤에는 그 대화를 이어받아 외전 — 인물과 더 ` +
    `나누는 이야기, 다른 인물의 눈으로 다시 보는 사건 — 으로 이어 갈 수 있어요. 요금은 자유 대화와 같은 턴당 하트예요.</p>
    ${endsHTML(ep, got)}
    <span class="note">모은 결말 ${n} / ${ep.endings.length}</span></div>`
  );
}
