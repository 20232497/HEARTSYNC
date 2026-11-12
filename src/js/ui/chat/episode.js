/* 에피소드 방의 화면 조각: 장 막대(epBarHTML — 대화방 머리 아래), 말풍선 위 사건 띠(epEventHTML), 로그 끝의 갈림길 카드·결말 카드(epTailHTML)와 그 버튼(bindEp), 외전 고르기(sideSheet).
   판정(언제 장이 넘어가고 어떤 결말인지)은 모두 core/episode.js — 여기는 상태 r.ep를 보여 주고 고른 것을 보내기만 함 */
import { SIDE, choiceOf } from "../../core/episode.js";
import { sideRoom } from "../../core/rooms.js";
import { endsSet } from "../../core/shelf.js";
import { S, gen, setRoom } from "../../core/state.js";
import { $, $$, esc, toast } from "../../core/util.js";
import { plan } from "../../core/wallet.js";
import { sendTurn } from "./generate.js";
import { flashHint } from "./view.js";
import { plusSheet } from "../pay.js";
import { restartRoom } from "../room-drawer.js";
import { closeOverlays, sheet } from "../sheet.js";
import { go } from "../shell.js";
/** @typedef {import("../../core/types.js").Room} Room */
/** @typedef {import("../../core/types.js").Alt} Alt */

/** 장 막대: '에피소드 · 2장 / 4 · 장 제목'과 장마다 점(지난 장·지금 장). 결말을 정한 뒤에는 이름을 감추고, 끝나면 결말 이름. 에피소드 방이 아니면 "". @param {Room} r */
export function epBarHTML(r) {
  const ep = r.char.episode,
    st = r.ep;
  if (!st || !ep) return "";
  const N = ep.beats.length,
    end = st.over && ep.endings.find((x) => x.id === st.end);
  const now = end ? `결말 · ${end.title}` : st.end ? "결말에 다가가는 중" : `${st.beat + 1}장 / ${N} · ${ep.beats[st.beat].title}`;
  const dots = ep.beats.map((b, i) => `<i class="${i < st.beat || st.end ? "on" : i === st.beat ? "cur" : ""}"></i>`).join("");
  return `<span class="ep-tag">에피소드</span><span class="ep-now">${esc(now)}</span><span class="ep-dots" aria-hidden="true">${dots}</span>`;
}
/** 말풍선 위 사건 띠 — 이 응답에 일어난 사건의 제목(AI에게 준 지시 글은 보이지 않음). @param {Room} r @param {Alt} alt */
export function epEventHTML(r, alt) {
  const e = alt.ev && r.char.episode && (r.char.episode.events || []).find((x) => x.id === alt.ev);
  return e ? `<div class="ep-ev" role="note"><b>사건</b> ${esc(e.title)}</div>` : "";
}
/**
 * 로그 끝: 고르기를 기다리는 갈림길 카드, 또는 끝난 방의 결말 카드(결말 이름은 모두 보이고 본 것에 표시 — ???로 가리면 다시 하기 부담스럽다는 2026-11-11 사용자 결정 · 외전·처음부터). 응답을 쓰는 중이거나 오류 줄이 있으면 갈림길은 숨김.
 * @param {Room} r
 */
export function epTailHTML(r) {
  const ep = r.char.episode,
    st = r.ep;
  if (!st || !ep || gen) return "";
  if (st.over) {
    const end = ep.endings.find((x) => x.id === st.end) || { title: "" },
      got = endsSet(r.char.id),
      n = ep.endings.filter((x) => got.has(x.id)).length;
    const path = Object.keys(st.picks)
      .map((id) => {
        const ch = choiceOf(ep, id),
          o = ch && ch.options.find((x) => x.id === st.picks[id]);
        return o ? o.label : "";
      })
      .filter(Boolean);
    return `<div class="ep-card ep-end" role="region" aria-label="결말">
      <span class="ep-k">결말</span><b class="ep-title">${esc(end.title)}</b>
      <span class="note">${st.t}턴${path.length ? " · 고른 길: " + path.map(esc).join(" → ") : ""}</span>
      ${endsHTML(ep, got)}
      <span class="note">모은 결말 ${n} / ${ep.endings.length} — 다른 길을 고르면 다른 결말에 닿아요</span>
      <div class="cta-row"><button class="btn pri" id="epSide">외전 이어 가기</button><button class="btn" id="epAgain">처음부터 다시</button></div>
    </div>`;
  }
  const ch = st.ask && choiceOf(ep, st.ask);
  if (!ch || r.lastErr) return "";
  return `<div class="ep-card ep-choice" role="group" aria-label="갈림길"><span class="ep-k">갈림길</span><b class="ep-title">${esc(ch.ask)}</b>
    ${ch.options.map((o) => `<button class="ep-opt" data-pick="${esc(o.id)}">${esc(o.label)}</button>`).join("")}
    <span class="note">카드를 누르거나, 아래에 직접 써도 돼요</span></div>`;
}
/** 결말 이름 칩 — 모두 보이고, 본 결말은 ✓와 강조(상세 페이지의 안내 칸도 같이 씀). @param {import("../../core/types.js").Episode} ep @param {Set<string>} got */
export function endsHTML(ep, got) {
  return (
    `<div class="ep-ends" aria-label="결말 ${ep.endings.length}개 중 본 결말 ${ep.endings.filter((x) => got.has(x.id)).length}개">` +
    `${ep.endings.map((x) => `<span class="${got.has(x.id) ? "on" : ""}">` + `${got.has(x.id) ? "✓ " : ""}${esc(x.title)}</span>`).join("")}</div>`
  );
}
/** 갈림길 카드(누르면 그 보기를 유저의 말로 보냄 — 턴당 하트는 평소와 같음)·결말 카드 버튼. @param {HTMLElement} box @param {Room} r */
export function bindEp(box, r) {
  $$("[data-pick]", box).forEach(
    (b) =>
      (b.onclick = () => {
        if (gen) return flashHint("응답이 끝난 뒤에 고를 수 있어요.");
        const ch = r.ep && choiceOf(r.char.episode, r.ep.ask),
          o = ch && ch.options.find((x) => x.id === b.dataset.pick);
        if (o) sendTurn(o.label, { pick: o.id });
      })
  );
  const side = $("#epSide", box);
  if (side) side.onclick = () => sideSheet(r);
  const again = $("#epAgain", box);
  if (again) again.onclick = () => restartRoom(r);
}
/**
 * 외전 고르기: 세 갈래(SIDE — 결말 뒤 · 다른 인물의 시점 · 다른 인물과 다시) 중 하나와, 인물이 필요한 갈래면 인물(다른 모습은 빼고 본체만).
 * 고르면 이 대화와 결말을 이어받은 새 자유 대화방(core/rooms.js sideRoom)으로 감 — 작품당 방 수 한도는 분기와 같음. @param {Room} r
 */
export function sideSheet(r) {
  if (S.rooms.filter((x) => x.charId === r.char.id).length >= plan().rooms) return plusSheet("rooms");
  const cast = (r.char.cast || []).filter((x) => !x.of);
  let kind = Object.keys(SIDE)[0],
    who = cast[0] ? cast[0].code : "";
  const sh = sheet(
    `<h2>외전 이어 가기</h2><p class="sub">이 대화와 결말을 그대로 이어받은 새 대화방을 만들어요. 인물과 못다 한 이야기를 나누거나, 같은 사건을 다른 인물의 눈으로 다시 볼 수 있어요. 끝이 정해지지 않은 ` +
      `자유 대화이고 요금은 지금처럼 턴당 하트, 지금 방은 그대로 남아요.</p>
    <div class="side-kinds" role="radiogroup" aria-label="외전 갈래">${Object.keys(SIDE)
      .map(
        (k) =>
          `<button class="side-kind" role="radio" data-k="${k}" aria-checked="${k === kind}"><b>${esc(SIDE[k].label)}</b>` +
          `<span>${esc(SIDE[k].desc)}</span></button>`
      )
      .join("")}</div>
    <div class="field" id="sideWho" hidden><label>누구의 이야기로 할까요?</label>` +
      `<div class="side-who" role="radiogroup" aria-label="인물">${cast
        .map((x) => `<button class="chip" role="radio" data-who="` + `${esc(x.code)}" aria-checked="${x.code === who}">${esc(x.name)}</button>`)
        .join("")}</div></div>
    <div class="cta-row"><button class="btn ghost" data-x>취소</button><span class="spacer"></span><button class="btn pri" id="sideGo">외전 시작</button></div>`
  );
  const paint = () => {
    $$("[data-k]", sh).forEach((b) => b.setAttribute("aria-checked", String(b.dataset.k === kind)));
    $$("[data-who]", sh).forEach((b) => b.setAttribute("aria-checked", String(b.dataset.who === who)));
    $("#sideWho", sh).hidden = !SIDE[kind].who;
  };
  $$("[data-k]", sh).forEach(
    (b) =>
      (b.onclick = () => {
        kind = b.dataset.k;
        paint();
      })
  );
  $$("[data-who]", sh).forEach(
    (b) =>
      (b.onclick = () => {
        who = b.dataset.who;
        paint();
      })
  );
  paint(); // 기본 갈래(첫째)가 인물을 고르는 갈래면 인물 칸을 처음부터 보여 줌
  $("#sideGo", sh).onclick = () => {
    const f = sideRoom(r, kind, SIDE[kind].who ? who : "");
    if (!f) return toast("외전을 만들지 못했어요");
    closeOverlays();
    setRoom(f);
    go("r-" + f.id);
    toast("외전을 열었어요 — ✦ AI 추천에 첫 장면 제안이 있어요");
  };
}
