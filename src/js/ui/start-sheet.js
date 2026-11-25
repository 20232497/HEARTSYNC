/* 새 대화 시작 창: 시작 상황과 페르소나를 고르고 시작 — 상세 페이지의 시작 버튼과 시작 상황 카드가 엶(startChat).
   처음 한 번은 같은 창의 첫 장이 AI 안내(ui/ai-notice.js)라 창이 연달아 뜨지 않음. 고를 것이 없으면(시작 상황 하나·페르소나 하나·안내를 이미 봄) 창 없이 바로 시작 */
import { MODELS } from "../ai/models.js";
import { findOpening } from "../core/room-fork.js";
import { defaultSet, newRoom } from "../core/rooms.js";
import { S, room, setRoom } from "../core/state.js";
import { $, $$, esc } from "../core/util.js";
import { FREE_DAILY, plan, qShort, quote } from "../core/wallet.js";
import { AI_NOTICE, AI_NOTICE_OK, ackAiNotice, aiNoticeNeeded } from "./ai-notice.js";
import { ICON } from "./icons.js";
import { plusSheet } from "./pay.js";
import { closeOverlays, sheet } from "./sheet.js";
import { go } from "./shell.js";
/** @typedef {import("../core/types.js").Work} Work */

/** 시작 상황 본문의 앞부분 — 그림 태그와 서식 기호를 뺀 한 줄. @param {{ text: string }} o @param {number} [n] 글자 수 @returns {string} */
export function opBrief(o, n = 120) {
  return o.text
    .replace(/\[\[[^\]]*\]\]/g, "")
    .replace(/[*"\[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, n);
}
/** 시작 상황의 배경 장소 배지(place가 작품의 places 범위 안일 때만). @param {Work} c @param {{ place?: number }} o @returns {string} */
export function opPlace(c, o) {
  const p = o.place && (c.places || [])[o.place - 1];
  return p ? ` <span class="pill">장소 · ${esc(p.name)}</span>` : "";
}
/** 새 대화가 시작하는 모델(작품의 권장 모델)과 그 턴 값 안내 — 값은 wallet의 quote 한 곳에서. @param {Work} c @returns {string} */
export function startNote(c) {
  const set0 = defaultSet(c),
    q0 = quote(set0);
  return (
    `새 대화는 ${esc(MODELS[set0.model].name)} 모델(${q0.type === "heart" ? "턴당 ♥" + q0.n : qShort(q0)})로 시작해요 — 대화방에서 바꿀 수 있어요. ` +
    `라이트 모델은 하루 ${FREE_DAILY}턴 무료.`
  );
}
/**
 * 이 작품의 가장 최근 방(S.rooms 순서는 즐겨찾기 먼저라 최근 시각으로 다시 고름)의 시작 상황 번호와 페르소나. 시작 상황은 방을 다시 찾는 규칙 그대로(core/room-fork.js findOpening),
 * 페르소나는 id로 — 어느 하나라도 지금 없으면 null(기본값으로 시작). 예전 목록 항목(시작 상황 칸이 없음)도 null.
 * @param {Work} c @returns {{ op: number, persona: import("../core/types.js").Persona }|null}
 */
export function lastSetup(c) {
  const e = S.rooms.filter((r) => r.charId === c.id).sort((a, b) => b.at - a.at)[0];
  if (!e || !e.personaId || !(e.openingId || e.opening)) return null;
  const op = findOpening(c, e),
    persona = S.personas.find((p) => p.id === e.personaId);
  return op >= 0 && persona ? { op, persona } : null;
}
/**
 * 이 작품으로 새 대화를 시작 —방 수 한도를 먼저 보고, 고를 것이 있거나 AI 안내를 아직 안 봤으면 시작 창을 엶.
 * 시작 상황을 주지 않으면(상세의 시작 버튼) 이 작품에서 가장 최근 방의 시작 상황·페르소나를 골라 둠 — 둘 다 지금도 있을 때만(lastSetup).
 * @param {Work} c 작품(normalizeChar를 거친 것) @param {number} [opIdx] 처음에 골라 둘 시작 상황 번호(상세의 시작 상황 카드)
 */
export function startChat(c, opIdx) {
  if (S.rooms.filter((r) => r.charId === c.id).length >= plan().rooms) return plusSheet("rooms");
  const last = opIdx === undefined ? lastSetup(c) : null;
  if (opIdx === undefined) opIdx = last ? last.op : 0;
  const def = (last && last.persona) || S.personas.find((p) => p.def) || S.personas[0];
  const begin = (i, p) => {
    closeOverlays();
    setRoom(newRoom(c, i, p));
    go("r-" + room.id);
  };
  const choose = c.openings.length > 1 || S.personas.length > 1;
  if (!choose && !aiNoticeNeeded()) return begin(opIdx, def);
  const ov = sheet(
    `<div class="sheet-head"><h2>${c.episode ? "에피소드 시작" : "새 대화 시작"}</h2>` +
      `<button class="icon-btn" data-x aria-label="닫기">${ICON.close}</button></div><p class="sub">${esc(c.title)}</p>` +
      `<div class="st-body" id="stBody"></div><div class="st-go" id="stFoot" hidden><button class="btn pri big" id="startGo"></button></div>`,
    "start-sheet"
  );
  const body = $("#stBody", ov), // 고르는 칸만 스크롤하고 시작 버튼(#stFoot)은 창 아래에 그대로 — 35-detail.css .start-sheet
    goBtn = $("#startGo", ov);
  const pick = () => {
    const card = (name, value, on, head, sub) =>
      `<label class="opening pick${on ? " on" : ""}"><input type="radio" name="${name}" value="${esc(value)}"${on ? " checked" : ""}>` +
      `<b>${head}</b>${sub ? `<span class="brief">${sub}</span>` : ""}</label>`;
    body.innerHTML =
      (last ? `<p class="note st-last" id="stLast">지난번 설정으로 골라 뒀어요 — 시작하면 새 대화방이 하나 더 생겨요.</p>` : "") +
      `<h3 class="st-h">${c.world_mode ? "게임 모드 · 시작 상황" : "시작 상황"}</h3><div class="openings">` +
      c.openings.map((o, i) => card("op", String(i), i === opIdx, esc(o.title) + opPlace(c, o), esc(opBrief(o)) + "…")).join("") +
      `</div><h3 class="st-h">대화할 내 페르소나<span class="spacer"></span><button class="btn sm ghost" id="stMe">페르소나 관리</button></h3>` +
      `<div class="openings">${S.personas.map((p) => card("pp", p.id, p === def, esc(p.name), esc(p.memo || ""))).join("")}</div>` +
      `<p class="note st-note">${startNote(c)}</p>`;
    $("#stFoot", ov).hidden = false;
    const cur = (name) => (body.querySelector(`input[name=${name}]:checked`) || {}).value;
    const persona = () => S.personas.find((p) => p.id === cur("pp")) || def;
    const sync = () => {
      $$(".opening.pick", body).forEach((l) => l.classList.toggle("on", l.querySelector("input").checked));
      goBtn.textContent = persona().name + "(으)로 시작";
    };
    $$("input", body).forEach((x) => (x.onchange = sync));
    sync();
    $("#stMe", body).onclick = () => {
      closeOverlays();
      go("me");
    };
    goBtn.onclick = () => begin(+(cur("op") || 0), persona());
  };
  if (!aiNoticeNeeded()) return pick();
  // 처음 한 번: 같은 창의 첫 장으로 AI 안내 — '알겠어요'를 누르면 고르는 장으로(고를 것이 없으면 바로 시작)
  body.innerHTML =
    `<p class="ai-first">${AI_NOTICE}</p>` +
    `<div class="cta-row"><span class="spacer"></span><button class="btn pri" id="aiOk">${AI_NOTICE_OK}</button></div>`;
  $("#aiOk", body).onclick = () => {
    ackAiNotice();
    if (choose) pick();
    else begin(opIdx, def);
  };
}
