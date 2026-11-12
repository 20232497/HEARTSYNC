/* 대화방 화면 뼈대·입력창·게이지 */
import { MODELS } from "../../ai/models.js";
import { liveWork } from "../../core/character.js";
import { commandHelp, findCommand, parseCommand } from "../../core/commands.js";
import { migrateRoom, roomKey, saveRoom } from "../../core/rooms.js";
import { S, gen, room, setRoom } from "../../core/state.js";
import { KV } from "../../core/storage.js";
import { $, esc, num, uid } from "../../core/util.js";
import { FREE_DAILY, freeLeft, isPro, listPrice, qShort, quote } from "../../core/wallet.js";
import { sendTurn, stopGen } from "./generate.js";
import { cmdKey, updateCmdList } from "./cmdlist.js";
import { bindStick, renderLog } from "./log.js";
import { barPct } from "./render.js";
import { hideSug, toggleSug } from "./suggest.js";
import { coverHTML } from "../cover.js";
import { ICON } from "../icons.js";
import { openModelSheet } from "../model-sheet.js";
import { openRoomDrawer } from "../room-drawer.js";
import { collectSeen } from "../room-tools.js";
import { bindGo, go, topbar } from "../shell.js";

export async function viewChat(id) {
  const v = $("#view");
  if (!room || room.id !== id) {
    v.innerHTML = `<div class="page"><p class="note">대화를 불러오는 중…</p></div>`;
    const r = await KV.get(roomKey(id));
    if (location.hash.slice(1) !== "r-" + id) return;
    if (!r) {
      v.innerHTML = `<div class="page">${topbar()}<div class="empty">대화방을 찾을 수 없어요.<br><button class="btn sm" data-go="chats">대화 목록</button></div></div>`;
      bindGo(v);
      return;
    }
    setRoom(migrateRoom(r));
  }
  collectSeen(room); // 이 방에 나온 그림 코드를 수집 기록에(새 방의 첫 장면, 이 기능 전에 만든 방, 다른 기기에서 온 방)
  const c = room.char;
  v.innerHTML =
    `<div class="chat">
    <div class="chat-bg">${coverHTML(c)}</div>
    <header class="chat-head">
      <button class="icon-btn" id="back" aria-label="뒤로">${ICON.back}</button>
      ${coverHTML(c)}
      <div class="who"><b>${esc(c.title)}</b><span>${esc(room.opening || "")} · ${esc(room.persona.name)}</span></div>
      <div class="meter" id="meter"></div>
      <button class="model-chip" id="modelChip" aria-label="AI 모델 선택"></button>
      <button class="icon-btn" id="info" aria-label="대화방 관리">${ICON.menu}</button>
    </header>
    <div class="ep-bar" id="epBar" hidden></div>
    <div class="chat-log" id="log"><div class="log-inner" id="logInner"></div><div class="jump-wrap">` +
    `<button class="jump" id="jumpBtn" type="button" hidden>↓ 맨 아래로</button></div></div>
    <div class="composer"><div class="inner">
      <div class="sug-panel" id="sugPanel" hidden></div>
      <div class="bar2">
        <button class="chip" id="sugBtn" aria-expanded="false">✦ AI 추천</button>
        <button class="chip" id="contBtn">이어서 쓰기</button>
        <span class="spacer"></span><span class="freecount" id="freeCount"></span>
      </div>
      <div class="cmd-panel" id="cmdPanel" role="listbox" aria-label="명령어" hidden></div>
      <form class="inputrow" id="form">
        <label class="sr" for="inp">메시지</label>
        <textarea id="inp" rows="1" maxlength="1500" placeholder="${esc(room.persona.name)}의 행동·대사 입력 (지문은 *별표* 사이에)"></textarea>
        <button class="stopbtn" id="stopBtn" type="button" hidden>■ 중지</button>
        <button class="send" id="sendBtn" type="submit" aria-label="보내기"></button>
      </form>
      <div class="hint" id="hint"></div>
    </div></div>
  </div>`;
  $("#back").onclick = () => (history.length > 1 ? history.back() : go("chats"));
  $("#info").onclick = () => openRoomDrawer("main");
  $("#modelChip").onclick = () => openModelSheet();
  $("#contBtn").onclick = () => {
    if (!gen) sendTurn("", { cont: true });
  };
  $("#sugBtn").onclick = () => toggleSug();
  $("#stopBtn").onclick = () => stopGen();
  const inp = $("#inp");
  inp.oninput = () => {
    inp.style.height = "auto";
    inp.style.height = Math.min(160, inp.scrollHeight) + "px";
    updateCmdList(inp);
  };
  inp.onkeydown = (e) => {
    if (cmdKey(e, inp)) return; // ! 명령어 목록이 떠 있으면 ↑↓·Enter·Esc는 목록이 먼저 받음
    // Enter로 보내기(기본) 또는 Ctrl+Enter로 보내기 — 채팅 설정의 enterSend
    const send = S.settings.enterSend !== false ? !e.shiftKey : e.ctrlKey || e.metaKey;
    if (e.key === "Enter" && send && !e.isComposing && e.keyCode !== 229) {
      e.preventDefault();
      if (gen) {
        flashHint("응답을 쓰는 중이에요. 끝나면 보낼 수 있고, 입력은 미리 써 둘 수 있어요.");
        return;
      }
      $("#form").requestSubmit();
    }
  };
  $("#form").onsubmit = async (e) => {
    e.preventDefault();
    if (gen) return;
    const t = inp.value.trim();
    if (!t) return;
    if (runCommand(t)) {
      inp.value = "";
      inp.oninput();
      return;
    }
    const ok = await sendTurn(t);
    if (ok && inp.value.trim() === t) {
      inp.value = "";
      inp.oninput();
    }
  };
  bindStick($("#log"));
  renderLog(true);
  updateMeter();
  updateComposer();
}
/* !명령어(core/commands.js): 앱 화면형 명령어(view가 있는 것 — !상태창·!갤러리·!지도·!도움말)는 AI를 부르지 않고 드로어를 엶(하트·턴을 쓰지 않음).
   작품의 즉답 명령어(commands의 text)는 AI 없이 정해진 글을 방에 남김(replyNow). 이 둘은 이름 뒤에 덧붙인 말이 있어도 같음(덧붙인 말은 쓰지 않음).
   앱 연출형(prompt — !시간경과 등)·작품 명령어(work.js commands의 prompt)·모르는 !글은 false → 그대로 AI에 보냄(연출 지시로 바꾸고 덧붙인 말을 붙이는 건 buildInput의 commandText) */
function runCommand(t) {
  const live = liveWork(room.char),
    f = findCommand(parseCommand(t), live);
  if (f && f.work && f.work.text) {
    replyNow(t, f.work);
    return true;
  }
  if (!f || !f.app || !f.app.view) return false;
  if (f.app.view === "help") {
    flashHint("명령어: " + commandHelp(live) + " — 이름 뒤에 말을 덧붙여도 되고, // 로 시작하면 연출 지시");
    return true;
  }
  openRoomDrawer(f.app.view);
  return true;
}
/* 즉답: 유저 말풍선과 정해진 글의 AI 메시지를 방에 남김 — 하트·턴을 쓰지 않고 상태창은 직전 값 그대로. 두 메시지에 canned 표시
   (다시 쓰기·좋아요 없음, 분기의 턴 계산에서 빠짐). 다음 턴의 대화 기록에는 그대로 들어가 AI가 그 글을 본 것으로 이어 감 */
function replyNow(t, cmd) {
  const a = lastAi(room),
    st = a ? (a.alts[a.idx] || {}).status || a.statusBefore : room.status;
  room.lastErr = "";
  room.msgs.push(
    { id: uid("m"), role: "user", text: t, canned: true },
    { id: uid("m"), role: "ai", idx: 0, canned: true, alts: [{ text: cmd.text, status: st, suggestions: [], cost: "무료" }], statusBefore: st }
  );
  saveRoom(room);
  collectSeen(room);
  hideSug();
  renderLog(true);
}
let hintTimer = null;
export function flashHint(msg) {
  const h = $("#hint");
  if (!h) return;
  h.textContent = msg;
  h.classList.add("warn");
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => {
    hintTimer = null;
    h.classList.remove("warn");
    updateComposer();
  }, 2600);
}
export function updateComposer() {
  if (!room || !$("#sendBtn")) return;
  const q = quote(room.set),
    m = MODELS[room.set.model];
  const send = $("#sendBtn"),
    stop = $("#stopBtn");
  send.disabled = !!gen;
  stop.hidden = !gen;
  send.innerHTML = `${ICON.send}<small>${qShort(q)}</small>`;
  send.title = q.type === "heart" ? `이번 턴에 하트 ${q.n}개가 사용돼요` : q.type === "free" ? "오늘의 무료 턴으로 보내요" : "PLUS 무제한";
  $("#contBtn").disabled = !!gen;
  $("#sugBtn").disabled = !!gen;
  const chip = $("#modelChip");
  if (chip) chip.innerHTML = `${m.name} <small>${qShort(q)}/턴</small> ▾`; // 좁은 화면에서는 이름만(CSS) — 가격은 보내기 버튼에
  const fc = $("#freeCount");
  if (fc) {
    const left = freeLeft();
    fc.className = "freecount" + (!isPro() && left <= 3 ? " low" : "");
    fc.innerHTML = isPro()
      ? `<span class="badge-pro">PLUS</span> ♥ <b>${num(S.wallet.hearts)}</b>`
      : `무료 <b>${left}</b>/${FREE_DAILY}턴 · ♥ <b>${num(S.wallet.hearts)}</b>`;
  }
  const h = $("#hint");
  if (h && !hintTimer) {
    if (gen) h.textContent = "응답을 쓰는 중이에요 · 다음 입력은 미리 써 둘 수 있어요 · Esc 또는 ■ 중지";
    else if (q.type === "free" && freeLeft() <= 3)
      h.textContent = `오늘 무료 턴이 ${freeLeft()}번 남았어요. 다 쓰면 라이트 모델은 턴당 ♥${listPrice("lite", room.set.len, room.set.mem)}이에요.`;
    else
      h.textContent =
        (touchOnly() ? "" : (S.settings.enterSend !== false ? "Enter 전송 · Shift+Enter 줄바꿈" : "Ctrl+Enter 전송 · Enter 줄바꿈") + " · ") +
        "// 연출 지시 · ! 명령어"; // 터치 기기에서는 키 안내를 빼고
  }
}
/* 키보드 없는 터치 기기(휴대폰)인지 — 입력창 아래 키 안내를 뺄 때 */
function touchOnly() {
  return typeof matchMedia === "function" && matchMedia("(hover: none) and (pointer: coarse)").matches;
}
export function lastAi(r) {
  for (let i = r.msgs.length - 1; i >= 0; i--) if (r.msgs[i].role === "ai") return r.msgs[i];
  return null;
}
export function gaugeView(c, s) {
  const v = s?.[c.gauge];
  if (v === undefined) return null;
  const pct = barPct(v);
  if (pct === null) return null;
  return { pct, text: String(v) };
}
export function updateMeter() {
  const el = $("#meter");
  if (!el || !room) return;
  const g = gaugeView(room.char, room.status);
  el.innerHTML = g ? `<span>${esc(room.char.gauge)}</span><i><b style="width:${g.pct}%"></b></i><span>${esc(g.text)}</span>` : "";
}
