/* 대화방 화면 뼈대·입력창·게이지 */
import { MODELS } from "../../ai/models.js";
import { migrateRoom, roomKey } from "../../core/rooms.js";
import { S, gen, room, setRoom } from "../../core/state.js";
import { KV } from "../../core/storage.js";
import { $, esc, num } from "../../core/util.js";
import { FREE_DAILY, freeLeft, isPro, listPrice, qShort, quote } from "../../core/wallet.js";
import { sendTurn, stopGen } from "./generate.js";
import { bindStick, renderLog } from "./log.js";
import { barPct } from "./render.js";
import { toggleSug } from "./suggest.js";
import { coverHTML } from "../cover.js";
import { ICON } from "../icons.js";
import { openModelSheet } from "../model-sheet.js";
import { openRoomDrawer } from "../room-drawer.js";
import { bindGo, go, topbar } from "../shell.js";

export async function viewChat(id) {
  const v = $("#view");
  if (!room || room.id !== id) {
    v.innerHTML = `<div class="page"><p class="note">대화를 불러오는 중…</p></div>`;
    const r = await KV.get(roomKey(id));
    if (location.hash.slice(1) !== "r-" + id) return;
    if (!r) { v.innerHTML = `<div class="page">${topbar()}<div class="empty">대화방을 찾을 수 없어요.<br><button class="btn sm" data-go="chats">대화 목록</button></div></div>`; bindGo(v); return; }
    setRoom(migrateRoom(r));
  }
  const c = room.char;
  v.innerHTML = `<div class="chat">
    <div class="chat-bg">${coverHTML(c)}</div>
    <header class="chat-head">
      <button class="icon-btn" id="back" aria-label="뒤로">${ICON.back}</button>
      ${coverHTML(c)}
      <div class="who"><b>${esc(c.title)}</b><span>${esc(room.opening || "")} · ${esc(room.persona.name)}</span></div>
      <div class="meter" id="meter"></div>
      <button class="model-chip" id="modelChip" aria-label="AI 모델 선택"></button>
      <button class="icon-btn" id="info" aria-label="대화방 관리">${ICON.menu}</button>
    </header>
    <div class="chat-log" id="log"><div class="log-inner" id="logInner"></div><div class="jump-wrap"><button class="jump" id="jumpBtn" type="button" hidden>↓ 맨 아래로</button></div></div>
    <div class="composer"><div class="inner">
      <div class="sug-panel" id="sugPanel" hidden></div>
      <div class="bar2">
        <button class="chip" id="sugBtn" aria-expanded="false">✦ AI 추천</button>
        <button class="chip" id="contBtn">이어서 쓰기</button>
        <span class="spacer"></span><span class="freecount" id="freeCount"></span>
      </div>
      <form class="inputrow" id="form">
        <label class="sr" for="inp">메시지</label>
        <textarea id="inp" rows="1" maxlength="1500" placeholder="${esc(room.persona.name)}의 행동·대사 입력 (지문은 *별표* 사이에)"></textarea>
        <button class="stopbtn" id="stopBtn" type="button" hidden>■ 중지</button>
        <button class="send" id="sendBtn" type="submit" aria-label="보내기"></button>
      </form>
      <div class="hint" id="hint"></div>
    </div></div>
  </div>`;
  $("#back").onclick = () => history.length > 1 ? history.back() : go("chats");
  $("#info").onclick = () => openRoomDrawer("main");
  $("#modelChip").onclick = () => openModelSheet();
  $("#contBtn").onclick = () => { if (!gen) sendTurn("", { cont: true }); };
  $("#sugBtn").onclick = () => toggleSug();
  $("#stopBtn").onclick = () => stopGen();
  const inp = $("#inp");
  inp.oninput = () => { inp.style.height = "auto"; inp.style.height = Math.min(160, inp.scrollHeight) + "px"; };
  inp.onkeydown = (e) => {
    // Enter로 보내기(기본) 또는 Ctrl+Enter로 보내기 — 채팅 설정의 enterSend
    const send = S.settings.enterSend !== false ? !e.shiftKey : e.ctrlKey || e.metaKey;
    if (e.key === "Enter" && send && !e.isComposing && e.keyCode !== 229) {
      e.preventDefault();
      if (gen) { flashHint("응답을 쓰는 중이에요. 끝나면 보낼 수 있고, 입력은 미리 써 둘 수 있어요."); return; }
      $("#form").requestSubmit();
    }
  };
  $("#form").onsubmit = async (e) => {
    e.preventDefault();
    if (gen) return;
    const t = inp.value.trim(); if (!t) return;
    if (runCommand(t)) { inp.value = ""; inp.oninput(); return; }
    const ok = await sendTurn(t);
    if (ok && inp.value.trim() === t) { inp.value = ""; inp.oninput(); }
  };
  bindStick($("#log"));
  renderLog(true); updateMeter(); updateComposer();
}
/* !명령어 — AI를 부르지 않고 앱이 바로 처리(하트·턴을 쓰지 않음): !상태창 · !갤러리(!도감) · !지도(!장소) · !도움말. 모르는 !글은 그대로 AI에 보냄 */
const COMMANDS = { "상태창": "status", "상태": "status", "갤러리": "gallery", "도감": "gallery", "지도": "places", "장소": "places" };
function runCommand(t) {
  const m = t.match(/^[!！]\s*(\S+)$/); if (!m) return false;
  if (/^(도움말|명령어|help)$/i.test(m[1])) { flashHint("명령어: !상태창 · !갤러리 · !지도 — AI를 부르지 않아요. // 로 시작하면 연출 지시"); return true; }
  const view = COMMANDS[m[1]]; if (!view) return false;
  openRoomDrawer(view); return true;
}
let hintTimer = null;
export function flashHint(msg) {
  const h = $("#hint"); if (!h) return;
  h.textContent = msg; h.classList.add("warn");
  clearTimeout(hintTimer); hintTimer = setTimeout(() => { hintTimer = null; h.classList.remove("warn"); updateComposer(); }, 2600);
}
export function updateComposer() {
  if (!room || !$("#sendBtn")) return;
  const q = quote(room.set), m = MODELS[room.set.model];
  const send = $("#sendBtn"), stop = $("#stopBtn");
  send.disabled = !!gen; stop.hidden = !gen;
  send.innerHTML = `${ICON.send}<small>${qShort(q)}</small>`;
  send.title = q.type === "heart" ? `이번 턴에 하트 ${q.n}개가 사용돼요` : q.type === "free" ? "오늘의 무료 턴으로 보내요" : "PLUS 무제한";
  $("#contBtn").disabled = !!gen; $("#sugBtn").disabled = !!gen;
  const chip = $("#modelChip"); if (chip) chip.innerHTML = `${m.name} <small>${qShort(q)}/턴</small> ▾`;
  const fc = $("#freeCount");
  if (fc) {
    const left = freeLeft();
    fc.className = "freecount" + (!isPro() && left <= 3 ? " low" : "");
    fc.innerHTML = isPro() ? `<span class="badge-pro">PLUS</span> ♥ <b>${num(S.wallet.hearts)}</b>` : `무료 <b>${left}</b>/${FREE_DAILY}턴 · ♥ <b>${num(S.wallet.hearts)}</b>`;
  }
  const h = $("#hint");
  if (h && !hintTimer) {
    if (gen) h.textContent = "응답을 쓰는 중이에요 · 다음 입력은 미리 써 둘 수 있어요 · Esc 또는 ■ 중지";
    else if (q.type === "free" && freeLeft() <= 3) h.textContent = `오늘 무료 턴이 ${freeLeft()}번 남았어요. 다 쓰면 라이트 모델은 턴당 ♥${listPrice("lite", room.set.len, room.set.mem)}이에요.`;
    else h.textContent = (S.settings.enterSend !== false ? "Enter 전송 · Shift+Enter 줄바꿈" : "Ctrl+Enter 전송 · Enter 줄바꿈") + " · // 연출 지시 · !도움말";
  }
}
export function lastAi(r) { for (let i = r.msgs.length - 1; i >= 0; i--) if (r.msgs[i].role === "ai") return r.msgs[i]; return null; }
export function gaugeView(c, s) {
  const v = s?.[c.gauge]; if (v === undefined) return null;
  const pct = barPct(v); if (pct === null) return null;
  return { pct, text: String(v) };
}
export function updateMeter() {
  const el = $("#meter"); if (!el || !room) return;
  const g = gaugeView(room.char, room.status);
  el.innerHTML = g ? `<span>${esc(room.char.gauge)}</span><i><b style="width:${g.pct}%"></b></i><span>${esc(g.text)}</span>` : "";
}
