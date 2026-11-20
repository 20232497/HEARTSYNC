/* ✦ 답변 추천: 저장된 추천은 값 없이 펼치고, 없으면 눌러서 받음(추천 한 번의 값 — wallet sugQuote). 방마다 '자동 받기'(r.set.autoSug)를 켜면 답마다 같이 옴.
   값이 드는 버튼에는 누르기 전에 값이 보이고(sugLabel·'새로 추천'), 만들지 못하면 되돌림. 저장된 추천 = 작가가 시작 장면에 써 둔 것 · 자동 받기로 온 것 · 눌러서 받은 것 · 예전 방의 것 */
import { errCopy, llm } from "../../ai/llm.js";
import { speakerName } from "../../ai/prompt/rules.js";
import { curText, deletedRooms, roomKey, saveRoom } from "../../core/rooms.js";
import { S, gen, room } from "../../core/state.js";
import { KV } from "../../core/storage.js";
import { $, $$, esc, toast } from "../../core/util.js";
import { SUGGEST_COST, charge, qShort, refund, sugQuote } from "../../core/wallet.js";
import { lastAi, updateComposer } from "./view.js";
import { ICON } from "../icons.js";
import { needHearts } from "../pay.js";
/** @typedef {import("../../core/types.js").Room} Room */

let busy = false; // 추천을 만드는 중 — 연달아 눌러 값이 두 번 나가지 않게

/* 마지막 AI 응답의 지금 버전과 거기 저장된 추천 */
const curAlt = (r) => {
  const m = r && lastAi(r);
  return m ? m.alts[m.idx] : null;
};
const saved = (r) => ((curAlt(r) || {}).suggestions || []).length > 0;
/** 추천 버튼의 글 — 저장된 추천이 없어 누르면 값이 드는 때에는 값을 같이 보임. @param {Room} r @returns {string} HTML */
export function sugLabel(r) {
  return `✦<span class="t"> 추천</span>` + (saved(r) ? "" : ` <small>${qShort(sugQuote())}</small>`);
}
/** 방의 '자동 받기'를 켜고 끔 — 켤 때 값이 더 나간다는 것을 알림. 입력창의 값 표시가 바로 바뀜. @param {Room} r @param {boolean} on */
export function setAutoSug(r, on) {
  if (on) r.set.autoSug = true;
  else delete r.set.autoSug;
  saveRoom(r);
  updateComposer();
  toast(on ? `답변 추천 자동 받기를 켰어요 — 답마다 ♥${SUGGEST_COST}이 더 나가요` : "답변 추천 자동 받기를 껐어요");
}
export function hideSug() {
  const p = $("#sugPanel");
  if (p) p.hidden = true;
  const b = $("#sugBtn");
  if (b) {
    b.classList.remove("on");
    b.setAttribute("aria-expanded", "false");
  }
}
/** 저장된 추천이 있으면 펼침(값 없음) — 자동 받기로 온 추천을 답이 끝난 뒤 바로 보일 때. 없으면 아무것도 하지 않음. */
export function showSug() {
  if (room && saved(room) && $("#sugPanel") && $("#sugPanel").hidden) toggleSug();
}
export async function toggleSug() {
  const p = $("#sugPanel"),
    b = $("#sugBtn");
  if (!p.hidden) return hideSug();
  const r = room,
    alt = curAlt(r);
  if (!alt) return;
  const open = () => {
    p.hidden = false;
    b.classList.add("on");
    b.setAttribute("aria-expanded", "true");
  };
  const auto = () =>
    `<label class="sug-auto"><input type="checkbox" id="sugAuto"${r.set.autoSug ? " checked" : ""}> 답마다 자동으로 받기 ` +
    `<span class="note">턴마다 +♥${SUGGEST_COST}</span></label>`;
  const paint = (list) => {
    p.innerHTML =
      `<div class="head">✦ 이렇게 이어가 보세요 <span class="spacer"></span>` +
      `<button class="btn sm ghost" id="sugRe">${ICON.redo.replace("<svg", '<svg width="14" height="14"')} 새로 추천 ${qShort(sugQuote())}</button>` +
      `<button class="btn sm ghost" id="sugX" aria-label="추천 닫기">닫기</button></div>` +
      list.map((s) => `<button class="s" data-s="${esc(s)}">${esc(s)}</button>`).join("") +
      auto();
    $$("[data-s]", p).forEach(
      (x) =>
        (x.onclick = () => {
          const inp = $("#inp");
          inp.value = x.dataset.s;
          inp.oninput();
          inp.focus();
          hideSug();
        })
    );
    $("#sugX", p).onclick = hideSug;
    $("#sugRe", p).onclick = () => fetchSug();
    $("#sugAuto", p).onchange = (e) => setAutoSug(r, e.target.checked);
  };
  /* 새로 만들기: 값을 먼저 내고(하트가 모자라면 부르지 않고 안내) 가장 가벼운 등급으로 따로 부름 — 방을 넘겨 본문과 같은 경로로. 만들지 못하면 되돌림 */
  const fetchSug = async () => {
    if (busy || gen) return;
    const q = sugQuote(),
      label = `${r.char.title} · 답변 추천`;
    if (S.wallet.hearts < q.n) return needHearts(q.n, "답변 추천");
    const mid = lastAi(r).id,
      text0 = alt.text; // 추천을 붙일 메시지와 그 버전의 글 — 답이 오면 다시 찾음(버전 번호는 저장하며 밀릴 수 있어 쓰지 않음)
    busy = true;
    charge(q, label);
    open();
    p.innerHTML = `<div class="head">✦ 답변 추천을 만드는 중… <span class="thinking"><i></i><i></i><i></i></span></div>`;
    const recent = r.msgs
      .filter((x) => curText(x) && !x.sys)
      .slice(-6)
      .map(
        (x) =>
          (x.role === "ai" ? speakerName(r) : r.persona.name) +
          ": " +
          curText(x)
            .replace(/\[\[img:[^\]]*\]\]/g, "")
            .slice(0, 700)
      )
      .join("\n\n");
    try {
      const v = await llm(
        [
          {
            role: "user",
            content: `롤플레이 「${r.char.title}」의 최근 대화다. 유저 캐릭터 ${r.persona.name}가 다음에 보낼 만한 행동·대사 3개를 제안하라.
- 서로 다른 방향(다정·도발·신중 등), 각 40자 이내, ${r.persona.name}의 1인칭 시점. 행동은 *별표*, 대사는 "큰따옴표".
- JSON {"suggestions":["…","…","…"]} 하나로만 답하라.

${recent}`
          }
        ],
        { tier: "quick", json: true, room: r }
      );
      const list = Array.isArray(v?.suggestions)
        ? v.suggestions
            .filter((s) => typeof s === "string")
            .map((s) => s.trim().slice(0, 80))
            .filter(Boolean) // 빈 글만 온 것은 받은 것이 아님 — 아래에서 되돌림
            .slice(0, 3)
        : [];
      if (!list.length) throw { code: "invalid_json" };
      // 기다리는 사이 방을 나갔으면 처음 잡은 방 객체(r)는 낡았을 수 있음 — 그것을 저장하면 그사이의 대화를 덮음. 그래서 붙일 곳을 다시 찾음:
      // 그 방이 열려 있으면 지금의 방 객체에서, 다른 방을 보고 있으면 저장된 최신 것을 읽어서. 그 버전은 같은 객체이거나 글이 같은 것으로 찾고,
      // 방·메시지·버전이 지워졌으면 붙일 곳이 없으니 값을 되돌림
      const now = room && room.id === r.id ? room : deletedRooms.has(r.id) ? null : await KV.get(roomKey(r.id)),
        m = now && (now.msgs || []).find((x) => x.id === mid),
        a = m && m.role === "ai" ? m.alts.find((x) => x === alt) || m.alts.find((x) => x.text === text0) : null;
      if (!a) throw { code: "gone" };
      a.suggestions = list;
      saveRoom(now);
      if (room === r && !p.hidden && curAlt(r) === a) paint(list);
    } catch (e) {
      refund(q, label);
      if (room === r && !p.hidden) {
        const why = e && e.code === "gone" ? "추천을 붙일 메시지가 없어졌어요." : errCopy(e);
        p.innerHTML =
          `<div class="head">답변 추천을 만들지 못했어요. ${esc(why)} 하트는 돌려드렸어요.<span class="spacer"></span>` +
          `<button class="btn sm ghost" id="sugX">닫기</button></div>`;
        $("#sugX", p).onclick = hideSug;
      }
    } finally {
      busy = false;
      if (room && room.id === r.id) updateComposer();
    }
  };
  if (saved(r)) {
    open();
    return paint(alt.suggestions);
  }
  fetchSug();
}
