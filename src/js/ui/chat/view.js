/* 대화방 화면 뼈대·입력창·게이지. 머리(뒤로·제목·AI 배지·무료 턴과 하트·게이지·모델 칩·대화 검색·방 메뉴) → 대화 → 한 줄 입력창([✦ 추천] [입력] [보내기 — 빈 입력이면 이어서 쓰기]).
   추천 패널과 ! 명령어 목록은 입력창 바로 위에 끼움. 안내 줄은 알릴 것이 있을 때만 */
import { MODELS } from "../../ai/models.js";
import { on } from "../../core/events.js";
import { migrateRoom } from "../../core/room-read.js";
import { goneRooms, roomKey, roomUnsaved, saveRoom } from "../../core/rooms.js";
import { S, gen, heldRoom, room, setRoom } from "../../core/state.js";
import { KV } from "../../core/storage.js";
import { $, esc, num, toast } from "../../core/util.js";
import { FREE_DAILY, freeLeft, heartsOf, isPro, listPrice, qShort, quote } from "../../core/wallet.js";
import { sendTurn, stopGen } from "./generate.js";
import { cmdKey, updateCmdList } from "./cmdlist.js";
import { runCommand } from "./command-run.js";
import { fitKeyboard } from "./keyboard.js";
import { bindStick, renderLog } from "./log.js";
import { barPct } from "./render.js";
import { openSearch } from "./search.js";
import { sugLabel, toggleSug } from "./suggest.js";
import { AI_BADGE, AI_NOTICE, AI_NOTICE_OK, ackAiNotice, aiNoticeNeeded } from "../ai-notice.js";
import { coverHTML } from "../cover.js";
import { ICON } from "../icons.js";
import { openModelSheet } from "../model-sheet.js";
import { openRoomDrawer } from "../room-drawer.js";
import { collectSeen } from "../room-tools.js";
import { bindGo, go, topbar } from "../shell.js";

export async function viewChat(id) {
  const v = $("#view");
  if ((!room || room.id !== id) && heldRoom(id)) setRoom(heldRoom(id)); // 답을 쓰거나 요약하는 중인 방은 그 객체 그대로(core/state.js heldRoom)
  if (!room || room.id !== id) {
    v.innerHTML = `<div class="page"><p class="note">대화를 불러오는 중…</p></div>`;
    // 읽는 사이 계정에서 받은 것이 쓰였으면 다시 읽음 — 먼저 시작한 읽기가 옛 본문을 돌려주면, 그것을 메모리에 올렸다가 저장할 때 받은 것을 덮음
    const key = roomKey(id);
    let r, v0;
    do {
      v0 = KV.stamp(key);
      r = await KV.get(key);
    } while (KV.stamp(key) !== v0);
    if (goneRooms()[id]) r = undefined; // 지운 방(이 기기에서 지웠거나 삭제 표식을 받음) — 본문이 어쩌다 남아 있어도 열지 않음
    if (location.hash.slice(1) !== "r-" + id) return;
    // 방 읽기의 경계(core/room-read.js migrateRoom): 열 수 없는 모양이면 저장된 원본은 그대로 두고 안내만 — 방 하나 때문에 화면이 멈추지 않게
    let ok = null;
    try {
      ok = r ? migrateRoom(r) : null;
    } catch {}
    if (!ok) {
      const why = r
        ? `이 대화방을 열 수 없어요. 저장된 내용이 온전하지 않아요.<br><span class="note">내용은 지우지 않고 그대로 두었어요.</span>`
        : "대화방을 찾을 수 없어요.";
      v.innerHTML = `<div class="page">${topbar()}<div class="empty">${why}<br><button class="btn sm" data-go="chats">대화 목록</button></div></div>`;
      bindGo(v);
      return;
    }
    setRoom(ok);
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
        <span class="inp-mode" id="inpMode" aria-live="polite" hidden></span>
        <label class="sr" for="inp">메시지</label>
        <textarea id="inp" rows="1" maxlength="1500" placeholder="행동·대사 입력 · // 연출 지시 · ! 명령어"></textarea>
        <button class="stopbtn" id="stopBtn" type="button" hidden>■ 중지</button>
        <button class="send" id="sendBtn" type="button"></button>
      </form>
      <div class="hint" id="hint"></div>
      <div class="save-fail" id="saveFail" role="alert" hidden><span>이 대화를 저장하지 못했어요. 화면의 대화는 그대로예요.</span>` +
    `<button class="btn sm" id="saveRetry" type="button">다시 저장</button></div>
    </div></div>
  </div>`;
  $("#back").onclick = () => (history.length > 1 ? history.back() : go("chats"));
  $("#info").onclick = () => openRoomDrawer("main");
  $("#findBtn").onclick = () => openSearch();
  $("#modelChip").onclick = () => openModelSheet();
  $("#sugBtn").onclick = () => toggleSug();
  $("#stopBtn").onclick = () => stopGen();
  // 본문이 저장소에 들어가지 못한 방(가득 참 등): 목록은 마지막으로 저장된 모양으로 돌아가 있고, 여기서 다시 저장할 수 있음(core/rooms.js saveRoom)
  $("#saveRetry").onclick = async (e) => {
    e.target.disabled = true;
    const ok = await saveRoom(room);
    e.target.disabled = false;
    toast(ok ? "대화를 저장했어요" : "아직 저장하지 못했어요. 브라우저의 저장 공간을 확인해 주세요");
  };
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
    // 입력 모드 표시(프레임 7차 C5): //로 시작하면 연출 지시, !로 시작하면 명령어 — 입력칸 테두리 위에 작게(안내 줄이 늘 자리를 차지하지 않게)
    const lead = inp.value.trimStart(), // 보낼 때 앞 공백을 자르므로 표시도 같게
      mode = lead.startsWith("//") ? "연출 지시" : lead.startsWith("!") ? "명령어" : "",
      tag = $("#inpMode");
    if (tag.textContent !== mode) tag.textContent = mode;
    tag.hidden = !mode;
    // 입력이 비었는지가 바뀌면 보내기 버튼의 모양을 바꿈(빈 입력 = 이어서 쓰기)
    if (!inp.value.trim() !== empty) {
      empty = !empty;
      updateComposer();
    }
  };
  // 보내기: 명령어(앱 화면형·즉답)는 AI 없이, 그 밖은 한 턴. Enter와 버튼이 같은 길로 옴(오래된 iOS에는 form.requestSubmit이 없어 직접 부름)
  const submit = async () => {
    if (genBusy()) return;
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
    if (genBusy()) return;
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
      submit();
    }
  };
  $("#form").onsubmit = (e) => {
    e.preventDefault();
    submit();
  };
  bindStick($("#log"));
  fitKeyboard($(".chat", v)); // 휴대폰 자판 위에 맞춤(visualViewport가 있을 때만 — ui/chat/keyboard.js)
  renderLog(true);
  updateMeter();
  updateComposer();
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
/* 답을 쓰는 중이면 안내하고 true — 생성은 한 번에 하나라, 다른 방에서 쓰는 중이어도 보내지 않음(그 방은 떠나도 계속 씀 — 프레임 7차 C10) */
function genBusy() {
  if (!gen) return false;
  flashHint(
    gen.roomId === room.id
      ? "응답을 쓰는 중이에요. 끝나면 보낼 수 있고, 입력은 미리 써 둘 수 있어요."
      : "다른 대화방에서 답을 쓰는 중이에요. 그 답이 끝나면 보낼 수 있고, 입력은 미리 써 둘 수 있어요."
  );
  return true;
}
/**
 * 이번 턴 값의 설명 — 보내기 버튼과 다시 쓰기 버튼의 title. 누르기 전에 값이 보이게: 보내기 값에는 추천 자동 받기(q.sug)가 더해져 있음.
 * 풀어 씀 — 버튼의 '무료+♥1'만 보면 '무료'가 먼저 읽히므로(법률 세션 권고, docs/legal/ui-copy.md §3). @param {ReturnType<typeof quote>} q @returns {string}
 */
export function costNote(q) {
  const sugNote = q.sug ? ` · 답변 추천 자동 받기로 하트 ${q.sug}개가 사용돼요` : "";
  return q.type === "heart"
    ? `이번 턴에 하트 ${heartsOf(q)}개가 사용돼요` + (q.sug ? ` · 답변 추천 자동 받기 ♥${q.sug} 포함` : "")
    : q.type === "free"
      ? (q.sug ? "이번 턴은 무료 턴이에요" : "오늘의 무료 턴으로 보내요") + sugNote
      : "이번 턴은 PLUS로 보내요" + (q.sug ? sugNote : " — 하트가 나가지 않아요"); // '무제한'은 스토어·결제 시트에만(ui-copy §3 유지 조건 — 법률 세션 2026-11-26)
}
/**
 * 마지막 답 아래 '다시 쓰기' 버튼의 [글, 설명] — 값은 보내기 버튼·다시 쓰기 창의 실행 버튼과 같은 견적(qShort). 옆의 '‹ 2/3 ›'는 저장된 답이라 값이 없음(프레임 7차 C4).
 * @param {ReturnType<typeof quote>} q @returns {[string, string]}
 */
export const regenText = (q) => ["↻ 다시 쓰기 · " + qShort(q), "새로 한 번 더 써요 — " + costNote(q)];
export function updateComposer() {
  if (!room || !$("#sendBtn")) return;
  const q = quote(room.set),
    m = MODELS[room.set.model];
  const send = $("#sendBtn"),
    stop = $("#stopBtn"),
    here = !!gen && gen.roomId === room.id; // 이 방에서 쓰는 중(다른 방의 답은 중지 버튼을 보이지 않고, 보내기를 누르면 genBusy가 안내)
  if (wasGen && !here) contLock = Date.now() + 700; // 답이 막 끝남 — 잠깐은 빈 입력의 누름을 이어서 쓰기로 받지 않음
  wasGen = here;
  send.disabled = here;
  stop.hidden = !here;
  // 보내기 버튼은 입력이 비어 있으면 '이어서 쓰기'가 됨 — 글과 모양(.cont)이 달라 무엇을 하는지, 값이 얼마인지 누르기 전에 보임
  const cont = !here && !$("#inp").value.trim();
  send.classList.toggle("cont", cont);
  send.innerHTML = (cont ? "이어서" : ICON.send) + `<small>${qShort(q)}</small>`;
  send.setAttribute("aria-label", cont ? "이어서 쓰기" : "보내기");
  send.title = (cont ? "입력 없이 이어서 쓰기 — " : "") + costNote(q);
  const rg = $('#logInner [data-act="regen"]'); // 마지막 답의 다시 쓰기 — 값이 바뀌면(무료 턴을 다 씀·PLUS·모델) 버튼의 값도 같이
  if (rg) [rg.textContent, rg.title] = regenText(q);
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
  const sf = $("#saveFail");
  if (sf) sf.hidden = !roomUnsaved(room.id);
  const h = $("#hint");
  if (h && !hintTimer)
    h.textContent =
      !gen && q.type === "free" && freeLeft() <= 3
        ? `오늘 무료 턴이 ${freeLeft()}번 남았어요. 다 쓰면 라이트 모델은 턴당 ♥${listPrice("lite", room.set.len, room.set.mem)}이에요.`
        : "";
}
on("wallet", updateComposer); // 하트·무료 턴이 바뀜 — 보내기 버튼의 값과 안내를 맞춤(전에는 틀 ui/shell.js가 직접 불렀음)
on("rooms", updateComposer); // 방 저장이 실패했거나 실패했던 방이 저장됨 — '저장하지 못했어요' 줄을 맞춤(core/rooms.js saveRoom)
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
