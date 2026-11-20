/* 대화방 화면 뼈대·입력창·게이지. 머리(뒤로·제목·AI 배지·무료 턴과 하트·게이지·모델 칩·대화 검색·방 메뉴) → 대화 → 한 줄 입력창([✦ 추천] [입력] [보내기 — 빈 입력이면 이어서 쓰기]).
   추천 패널과 ! 명령어 목록은 입력창 바로 위에 끼움. 안내 줄은 알릴 것이 있을 때만 */
import { MODELS } from "../../ai/models.js";
import { liveWork } from "../../core/character.js";
import { commandHelp, findCommand, parseCommand } from "../../core/commands.js";
import { migrateRoom, roomKey, saveRoom } from "../../core/rooms.js";
import { S, gen, room, setRoom } from "../../core/state.js";
import { KV } from "../../core/storage.js";
import { $, esc, num, uid } from "../../core/util.js";
import { FREE_DAILY, freeLeft, heartsOf, isPro, listPrice, qShort, quote } from "../../core/wallet.js";
import { sendTurn, stopGen } from "./generate.js";
import { cmdKey, updateCmdList } from "./cmdlist.js";
import { bindStick, renderLog } from "./log.js";
import { barPct } from "./render.js";
import { openSearch } from "./search.js";
import { hideSug, sugLabel, toggleSug } from "./suggest.js";
import { AI_BADGE, AI_NOTICE, AI_NOTICE_OK, ackAiNotice, aiNoticeNeeded } from "../ai-notice.js";
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
      <div class="who"><b>${esc(c.title)}</b><div class="who-sub"><small class="ai-badge">${AI_BADGE}</small>` +
    `<span class="freecount" id="freeCount"></span><span class="who-op">${esc(room.opening || "")} · ${esc(room.persona.name)}</span></div></div>
      <div class="meter" id="meter"></div>
      <button class="model-chip" id="modelChip" aria-label="AI 모델 선택"></button>
      <button class="icon-btn" id="findBtn" aria-label="대화 검색">${ICON.search}</button>
      <button class="icon-btn" id="info" aria-label="대화방 관리">${ICON.menu}</button>
    </header>
    <div class="ep-bar" id="epBar" hidden></div>` +
    (aiNoticeNeeded()
      ? `<div class="ai-note" id="aiNote" role="note"><span>${AI_NOTICE}</span><button class="btn sm" id="aiNoteOk">${AI_NOTICE_OK}</button></div>`
      : "") +
    `<div class="chat-log" id="log"><div class="log-inner" id="logInner"></div><div class="jump-wrap">` +
    `<button class="jump" id="jumpBtn" type="button" hidden>↓ 맨 아래로</button></div></div>
    <div class="composer"><div class="inner">
      <div class="sug-panel" id="sugPanel" hidden></div>
      <div class="cmd-panel" id="cmdPanel" role="listbox" aria-label="명령어" hidden></div>
      <form class="inputrow" id="form">
        <button class="sugbtn" id="sugBtn" type="button" aria-expanded="false"></button>
        <label class="sr" for="inp">메시지</label>
        <textarea id="inp" rows="1" maxlength="1500" placeholder="행동·대사 입력 · // 연출 지시 · ! 명령어"></textarea>
        <button class="stopbtn" id="stopBtn" type="button" hidden>■ 중지</button>
        <button class="send" id="sendBtn" type="button"></button>
      </form>
      <div class="hint" id="hint"></div>
    </div></div>
  </div>`;
  $("#back").onclick = () => (history.length > 1 ? history.back() : go("chats"));
  $("#info").onclick = () => openRoomDrawer("main");
  $("#findBtn").onclick = () => openSearch();
  $("#modelChip").onclick = () => openModelSheet();
  $("#sugBtn").onclick = () => toggleSug();
  $("#stopBtn").onclick = () => stopGen();
  // 첫 대화 전 안내를 못 본 채 방에 들어온 사람(이 안내가 생기기 전에 만든 방·방 주소로 바로 들어옴)에게는 머리 아래 띠로 보여 줌 — 창을 띄우지 않음
  if ($("#aiNoteOk"))
    $("#aiNoteOk").onclick = () => {
      ackAiNotice();
      $("#aiNote").remove();
    };
  const inp = $("#inp");
  let empty = true;
  inp.oninput = () => {
    inp.style.height = "auto";
    inp.style.height = Math.min(160, inp.scrollHeight) + "px";
    updateCmdList(inp);
    // 입력이 비었는지가 바뀌면 보내기 버튼의 모양을 바꿈(빈 입력 = 이어서 쓰기)
    if (!inp.value.trim() !== empty) {
      empty = !empty;
      updateComposer();
    }
  };
  // 보내기: 명령어(앱 화면형·즉답)는 AI 없이, 그 밖은 한 턴. Enter와 버튼이 같은 길로 옴(오래된 iOS에는 form.requestSubmit이 없어 직접 부름)
  const submit = async () => {
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
  // 보내기 버튼: 입력이 있으면 보내고, 비어 있으면 '이어서 쓰기'(버튼의 글과 모양이 그렇게 바뀌어 있음 — updateComposer).
  // 답이 막 끝난 직후의 누름은 이어서 쓰기로 받지 않음(보내려던 손이 한 번 더 닿아 값이 나가지 않게). Enter는 빈 입력에서 아무 일도 하지 않음
  $("#sendBtn").onclick = () => {
    if (gen) return;
    if (inp.value.trim()) return submit();
    if (Date.now() < contLock) return;
    sendTurn("", { cont: true });
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
      submit();
    }
  };
  $("#form").onsubmit = (e) => {
    e.preventDefault();
    submit();
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
/* '이어서 쓰기'를 받지 않는 시각(답이 막 끝난 직후)과 직전에 응답 중이었는지 — updateComposer가 응답이 끝나는 순간을 잡음 */
let contLock = 0,
  wasGen = false;
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
  if (wasGen && !gen) contLock = Date.now() + 700; // 답이 막 끝남 — 잠깐은 빈 입력의 누름을 이어서 쓰기로 받지 않음
  wasGen = !!gen;
  send.disabled = !!gen;
  stop.hidden = !gen;
  // 보내기 버튼은 입력이 비어 있으면 '이어서 쓰기'가 됨 — 글과 모양(.cont)이 달라 무엇을 하는지, 값이 얼마인지 누르기 전에 보임
  const cont = !gen && !$("#inp").value.trim();
  send.classList.toggle("cont", cont);
  send.innerHTML = (cont ? "이어서" : ICON.send) + `<small>${qShort(q)}</small>`;
  send.setAttribute("aria-label", cont ? "이어서 쓰기" : "보내기");
  // 누르기 전에 값이 보이게: 보내기 버튼의 값에는 추천 자동 받기(q.sug)가 더해져 있고, 추천 버튼은 저장된 추천이 없을 때만 값을 보임
  // 설명 글은 풀어 씀 — 버튼의 '무료+♥1'만 보면 '무료'가 먼저 읽히므로(법률 세션 권고, docs/legal/ui-copy.md §3)
  const sugNote = q.sug ? ` · 답변 추천 자동 받기로 하트 ${q.sug}개가 사용돼요` : "";
  send.title =
    (cont ? "입력 없이 이어서 쓰기 — " : "") +
    (q.type === "heart"
      ? `이번 턴에 하트 ${heartsOf(q)}개가 사용돼요` + (q.sug ? ` · 답변 추천 자동 받기 ♥${q.sug} 포함` : "")
      : q.type === "free"
        ? (q.sug ? "이번 턴은 무료 턴이에요" : "오늘의 무료 턴으로 보내요") + sugNote
        : (q.sug ? "이번 턴은 PLUS로 보내요" : "PLUS 무제한") + sugNote);
  // 키 안내는 입력 칸의 title로 — 방 안의 표시 설정에서 'Enter로 보내기'를 바꾸면 여기서 같이 바뀜
  $("#inp").title = S.settings.enterSend !== false ? "Enter 전송 · Shift+Enter 줄바꿈" : "Ctrl+Enter 전송 · Enter 줄바꿈";
  const sug = $("#sugBtn");
  sug.disabled = !!gen;
  sug.innerHTML = sugLabel(room);
  sug.classList.toggle("auto", !!room.set.autoSug);
  sug.title = room.set.autoSug
    ? q.sug
      ? `답변 추천 자동 받기 켜짐 — 답마다 ♥${q.sug}이 더 나가요`
      : "답변 추천 자동 받기 켜짐 — 하트가 모자라 이번 턴은 추천 없이 보내요"
    : "";
  const chip = $("#modelChip");
  if (chip) chip.innerHTML = `${m.name} <small>${qShort(q)}/턴</small> ▾`; // 좁은 화면에서는 이름만(CSS) — 가격은 보내기 버튼에
  const fc = $("#freeCount");
  if (fc) {
    const left = freeLeft();
    fc.className = "freecount" + (!isPro() && left <= 3 ? " low" : "");
    // 머리의 하트와 오늘 남은 무료 턴 — 하트를 앞에 둬서, 자리가 모자라면 뒤의 무료 턴부터 줄어듦(CSS)
    fc.title = isPro() ? "PLUS" : `오늘 무료 턴 ${left} / ${FREE_DAILY}`;
    fc.innerHTML = isPro()
      ? `<span class="badge-pro">PLUS</span> ♥ <b>${num(S.wallet.hearts)}</b>`
      : `♥ <b>${num(S.wallet.hearts)}</b> · 무료 <b>${left}</b>턴`;
  }
  // 안내 줄은 알릴 것이 있을 때만 보임(비면 CSS가 감춤): 잠깐 뜨는 안내(flashHint — 명령어 도움말·응답 중 입력)와 무료 턴이 얼마 안 남았을 때.
  // 늘 보이던 '// 연출 지시 · ! 명령어' 안내는 입력 칸의 흐린 글로, 키 안내는 입력 칸의 title로 옮김
  const h = $("#hint");
  if (h && !hintTimer)
    h.textContent =
      !gen && q.type === "free" && freeLeft() <= 3
        ? `오늘 무료 턴이 ${freeLeft()}번 남았어요. 다 쓰면 라이트 모델은 턴당 ♥${listPrice("lite", room.set.len, room.set.mem)}이에요.`
        : "";
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
