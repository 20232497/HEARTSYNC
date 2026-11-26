/* AI를 부르지 않는 !명령어 처리 — 앱 화면형은 드로어를 열고, 작품의 즉답은 정해진 글을 방에 남김. 대화방 입력창(ui/chat/view.js)이 보내기 전에 부름 */
import { liveWork } from "../../core/character.js";
import { commandHelp, findCommand, parseCommand } from "../../core/commands.js";
import { saveRoom } from "../../core/rooms.js";
import { room } from "../../core/state.js";
import { uid } from "../../core/util.js";
import { renderLog } from "./log.js";
import { hideSug } from "./suggest.js";
import { flashHint, lastAi } from "./view.js";
import { openRoomDrawer } from "../room-drawer.js";
import { collectSeen } from "../room-tools.js";

/* !명령어(core/commands.js): 앱 화면형 명령어(view가 있는 것 — !상태창·!갤러리·!지도·!도움말)는 AI를 부르지 않고 드로어를 엶(하트·턴을 쓰지 않음).
   작품의 즉답 명령어(commands의 text)는 AI 없이 정해진 글을 방에 남김(replyNow). 이 둘은 이름 뒤에 덧붙인 말이 있어도 같음(덧붙인 말은 쓰지 않음).
   앱 연출형(prompt — !시간경과 등)·작품 명령어(work.js commands의 prompt)·모르는 !글은 false → 그대로 AI에 보냄(연출 지시로 바꾸고 덧붙인 말을 붙이는 건 buildInput의 commandText) */
export function runCommand(t) {
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
