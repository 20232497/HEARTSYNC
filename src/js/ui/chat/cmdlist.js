/* 대화방 입력창의 ! 명령어 목록: !로 시작하는 낱말을 치는 동안 입력창 위에 "!이름 — 제목" 목록(앱 → 작품)을 띄우고, 고르면 입력창에 채움(↑↓ 고르기 · Enter 채우기 · Esc 닫기).
   목록은 core/commands.js의 commandList 하나로 만듦 — 작품이 commands를 더하면 그대로 나옴 */
import { liveWork } from "../../core/character.js";
import { COMMAND_KINDS, commandList } from "../../core/commands.js";
import { room } from "../../core/state.js";
import { $, $$, esc } from "../../core/util.js";

let shown = [],
  sel = 0; // 지금 떠 있는 목록과 고른 줄
const fullOf = (x) => "!" + x.cmd;
function paint(inp) {
  const p = $("#cmdPanel");
  if (!p) return;
  p.hidden = !shown.length;
  p.innerHTML = shown
    .map(
      (x, i) =>
        `<button type="button" role="option" class="c${i === sel ? " on" : ""}" aria-selected="${i === sel}" aria-label="` +
        `${esc(fullOf(x))} — ${esc(x.title)}" data-i="${i}">` +
        `<code>${esc(fullOf(x))}</code><span>${esc(x.title)}</span>` +
        `<span class="pill${x.kind === "work" ? " gold" : x.kind === "direct" ? " ok" : ""}">${esc(COMMAND_KINDS[x.kind].name)}</span></button>`
    )
    .join("");
  $$("[data-i]", p).forEach((b) => (b.onclick = () => fill(inp, shown[+b.dataset.i])));
  const on = $(".on", p);
  if (on && on.scrollIntoView) on.scrollIntoView({ block: "nearest" });
}
function fill(inp, x) {
  inp.value = fullOf(x);
  inp.oninput();
  inp.focus();
}
/** 입력이 바뀔 때마다 부름: 목록을 다시 만들고 그림. 다 친 명령어 하나만 남으면(고른 직후 포함) 닫음. @param {HTMLTextAreaElement} inp */
export function updateCmdList(inp) {
  const list = room ? commandList(inp.value, liveWork(room.char)) : [];
  shown = list.length === 1 && inp.value.trim() === fullOf(list[0]) ? [] : list;
  sel = Math.min(sel, Math.max(0, shown.length - 1));
  paint(inp);
}
/**
 * 입력창 keydown에서 먼저 부름 — 목록이 떠 있을 때 ↑↓(고르기)·Enter(채우기)·Esc(닫기)를 처리했으면 true(보내기 등 다른 처리는 건너뜀). @param {KeyboardEvent} e @param {HTMLTextAreaElement} inp
 * @returns {boolean}
 */
export function cmdKey(e, inp) {
  if (!shown.length) return false;
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    sel = (sel + (e.key === "ArrowDown" ? 1 : shown.length - 1)) % shown.length;
    paint(inp);
  } else if (e.key === "Escape") {
    shown = [];
    paint(inp);
    e.stopPropagation();
  } // 전역 Esc(응답 중지·시트 닫기)로 번지지 않게
  else if (e.key === "Enter" && !e.shiftKey && !e.isComposing && e.keyCode !== 229 && inp.value.trim() !== fullOf(shown[sel]))
    fill(inp, shown[sel]); // 이미 다 친 명령어면 그대로 보내기
  else return false;
  e.preventDefault();
  return true;
}
