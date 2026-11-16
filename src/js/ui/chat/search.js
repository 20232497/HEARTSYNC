/* 대화 검색: 이 대화방의 메시지에서 낱말을 찾아 결과 목록을 보여 주고, 누르면 그 메시지로 감(ui/room-tools.js jumpTo).
   이 기기에 있는 메시지에서만 찾음(서버 호출 없음). 지금 보이는 버전의 본문만 봄 — 상태창 글과 다시 쓰기 전의 다른 버전은 보지 않음 */
import { speakerName } from "../../ai/prompt/rules.js";
import { curText } from "../../core/rooms.js";
import { room } from "../../core/state.js";
import { $, $$, esc } from "../../core/util.js";
import { ICON } from "../icons.js";
import { jumpTo } from "../room-tools.js";
import { closeOverlays, sheet } from "../sheet.js";
/** @typedef {import("../../core/types.js").Room} Room */

/* 결과 수 상한 · 찾은 말 앞에 보여 줄 글자 수(뒤는 그 두 배) */
const FIND_MAX = 60,
  FIND_SIDE = 30;

/**
 * 방의 메시지에서 낱말을 찾음 — 대소문자를 가리지 않고, 그림 태그는 빼고, 최근 메시지부터 FIND_MAX건까지. 메시지 하나에 한 건(처음 나온 자리).
 * @param {Room} r @param {string} q 찾을 말
 * @returns {{ id: string, who: string, pre: string, hit: string, post: string }[]} who는 말한 쪽 이름, pre·hit·post는 찾은 말과 그 앞뒤 글
 */
export function searchRoom(r, q) {
  const key = String(q || "")
    .trim()
    .toLowerCase();
  const out = [];
  if (!key) return out;
  for (let i = r.msgs.length - 1; i >= 0 && out.length < FIND_MAX; i--) {
    const m = r.msgs[i];
    if (m.sys) continue;
    const text = (curText(m) || "")
        .replace(/\[\[[^\]]*\]\]/g, "")
        .replace(/\s+/g, " ")
        .trim(),
      at = text.toLowerCase().indexOf(key);
    if (at < 0) continue;
    const end = at + key.length;
    out.push({
      id: m.id,
      who: m.role === "ai" ? speakerName(r) : r.persona.name,
      pre: (at > FIND_SIDE ? "…" : "") + text.slice(Math.max(0, at - FIND_SIDE), at),
      hit: text.slice(at, end),
      post: text.slice(end, end + FIND_SIDE * 2) + (text.length > end + FIND_SIDE * 2 ? "…" : "")
    });
  }
  return out;
}
/** 대화 검색 창을 엶 — 치는 대로 결과가 바뀌고, 결과를 누르면 창을 닫고 그 메시지로 감. 글은 모두 esc 뒤에 강조 표시를 감쌈. */
export function openSearch() {
  const r = room;
  if (!r) return;
  const ov = sheet(
    `<div class="sheet-head"><h2>대화 검색</h2><button class="icon-btn" data-x aria-label="닫기">${ICON.close}</button></div>` +
      `<p class="sub">이 대화방의 메시지에서 찾아요 — 지금 보이는 글만, 이 기기에 있는 대화에서.</p>` +
      `<label class="sr" for="csQ">찾을 말</label><input class="inp" id="csQ" type="search" maxlength="40" placeholder="찾을 말" autocomplete="off">` +
      `<div class="cs-list" id="csList" aria-live="polite"></div>`,
    "search-sheet"
  );
  const inp = $("#csQ", ov),
    list = $("#csList", ov);
  inp.oninput = () => {
    const q = inp.value.trim(),
      hits = searchRoom(r, q);
    list.innerHTML = !q
      ? ""
      : !hits.length
        ? `<p class="note">찾는 말이 없어요.</p>`
        : `<p class="note">${hits.length}${hits.length >= FIND_MAX ? "건 이상" : "건"} · 최근 것부터</p>` +
          hits
            .map(
              (h) =>
                `<button type="button" class="cs-hit" data-id="${esc(h.id)}"><b>${esc(h.who)}</b>` +
                `<span>${esc(h.pre)}<mark>${esc(h.hit)}</mark>${esc(h.post)}</span></button>`
            )
            .join("");
    $$("[data-id]", list).forEach(
      (b) =>
        (b.onclick = () => {
          closeOverlays();
          jumpTo(b.dataset.id);
        })
    );
  };
  inp.focus();
}
