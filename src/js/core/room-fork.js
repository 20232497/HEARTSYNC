/* 분기(forkRoom)·외전(sideRoom)과, 방의 시작 상황이 작품의 몇 번째인지 찾기(openingIndex·baseOpening). 새 방을 저장하는 것은 core/rooms.js saveRoom */
import { SIDE } from "./episode.js";
import { saveRoom } from "./rooms.js";
import { uid } from "./util.js";
/** @typedef {import("./types.js").Room} Room */
/** @typedef {import("./types.js").Work} Work */

/* 장기기억에서 그 턴보다 뒤에 시작하는 구간을 뺌 → [남긴 기억, 남긴 마지막 구간의 끝 턴(없으면 0), 뺀 것이 있는지].
   구간 머리표가 없는 글(직접 쓴 기억·압축으로 합쳐진 기억)은 그대로 둠 */
function memoryUpTo(mem, turn) {
  let last = 0,
    cut = false;
  const kept = String(mem || "")
    .split(/\n\n(?=\[\d+-\d+턴\])/)
    .filter((p) => {
      const m = p.match(/^\[(\d+)-(\d+)턴\]/);
      if (!m) return true;
      if (+m[1] > turn) {
        cut = true;
        return false;
      }
      last = +m[2];
      return true;
    });
  return [kept.join("\n\n"), last, cut];
}
/* 분기한 방의 시작 상황 제목 끝에 붙는 표시 — 원래 제목은 baseOpening으로 */
const FORK_MARK = " (분기)";
/** 시작 상황의 원래 제목(분기 표시를 뗌) — '처음부터'가 같은 시작 상황을 찾을 때. @param {Room} r @returns {string} */
export function baseOpening(r) {
  const t = r.opening || "";
  return t.slice(-FORK_MARK.length) === FORK_MARK ? t.slice(0, -FORK_MARK.length) : t;
}
/**
 * 방의 시작 상황이 작품의 몇 번째인지 — 찾는 순서는 여기 한 곳: 방에 적힌 id(openingId) → 제목(id가 없던 예전 방이거나 id를 못 찾을 때, 분기 표시는 떼고) → 첫 시작 상황.
 * 작품이 시작 상황의 제목을 고쳐도 id가 같으면 같은 시작 상황으로 감. '처음부터 다시'(ui/room-drawer.js)가 씀.
 * @param {Work} c 최신 작품 @param {Room} r @returns {number}
 */
export function openingIndex(c, r) {
  const ops = (c && c.openings) || [];
  let i = r.openingId ? ops.findIndex((o) => o.id === r.openingId) : -1;
  if (i < 0) i = ops.findIndex((o) => o.title === baseOpening(r));
  return Math.max(0, i);
}
/**
 * 분기: 그 메시지까지를 깊은 복사한 새 대화방 — 같은 작품 사본·페르소나·설정·유저노트·시작 상황 id(openingId), 상태창은 그 시점의 것, 시작 상황 제목에 '(분기)', forkedFrom에 출처.
 * 장기기억은 분기한 턴보다 뒤에 시작하는 구간([a-b턴])을 빼고 복사(2026-11-09 사용자 결정 — 아직 안 일어난 일이 따라오지 않게. 머리표가 없으면 통째로).
 * 턴 번호는 원래 방의 것을 이어 씀(지운 메시지가 있어도 구간 머리표와 어긋나지 않게). 원래 방은 건드리지 않고 새 방을 바로 저장함(지운 방·MAX_MSGS_KEEP 규칙은 saveRoom 그대로).
 * @param {Room} r @param {string} msgId 이 메시지까지 가져감 @returns {Room|null} 메시지를 못 찾으면 null
 */
export function forkRoom(r, msgId) {
  const i = r.msgs.findIndex((m) => m.id === msgId);
  if (i < 0) return null;
  const f = JSON.parse(JSON.stringify({ ...r, msgs: r.msgs.slice(0, i + 1) }));
  const ai = [...f.msgs].reverse().find((m) => m.role === "ai"),
    ids = new Set(f.msgs.map((m) => m.id));
  f.id = uid("r");
  f.opening = (baseOpening(r) || "기본") + FORK_MARK;
  f.forkedFrom = { roomId: r.id, msgId };
  delete f.fav; // 즐겨찾기는 원래 방의 것 — 분기·외전으로 만든 새 방에는 딸려 가지 않음
  f.status = (ai && (ai.alts[ai.idx].status || ai.statusBefore)) || r.status;
  const after = r.msgs.slice(i + 1).filter((m) => m.role === "user" && !m.canned).length,
    /* 즉답 명령어의 메시지는 턴이 아님 */ turn = Math.max(0, (r.turn || 0) - after),
    mem = memoryUpTo(r.memory, turn);
  f.turn = turn;
  f.memory = mem[0];
  f.sinceMem = mem[2] ? Math.max(0, turn - mem[1]) : Math.max(0, (r.sinceMem || 0) - after);
  f.memHist = [];
  f.lastErr = "";
  f.bookmarks = (r.bookmarks || []).filter((b) => ids.has(b));
  f.created = Date.now();
  f.pins = (r.pins || []).filter((p) => !p.msgId || ids.has(p.msgId)).map((p) => ({ ...p })); // 고정 기억은 그 메시지까지에서 고정한 것만(직접 적은 것은 모두)
  saveRoom(f);
  return f;
}
/**
 * 외전: 결말까지 끝난 에피소드 방을 통째로 이어받은 새 자유 대화방 — 분기(forkRoom)처럼 대화·장기기억·고정 기억·상태창을 깊은 복사하고, 진행 상태(ep)를 떼고 side에 어떤 외전인지 적음.
 * 그래서 AI는 그 대화와 결말을 그대로 읽고(프롬프트 고정부의 [외전] — ai/prompt/rules.js), 끝이 없는 자유 대화로 이어 감. 원래 방은 그대로(끝난 채). 첫 추천은 외전 갈래의 SIDE.sug.
 * @param {Room} r 끝난 에피소드 방 @param {"after"|"pov"|"again"} kind @param {string} [who] 인물 코드(pov·again) @returns {Room|null}
 */
export function sideRoom(r, kind, who) {
  const K = SIDE[kind],
    last = r.msgs[r.msgs.length - 1];
  if (!K || !r.ep || !r.ep.over || !last || (K.who && !who)) return null;
  const f = forkRoom(r, last.id),
    name = ((r.char.cast || []).find((x) => x.code === who) || {}).name || "";
  const end = (r.char.episode.endings || []).find((x) => x.id === r.ep.end) || {};
  delete f.ep;
  delete f.forkedFrom;
  f.side = { kind, ...(K.who ? { who } : {}), from: r.id, ending: r.ep.end, endTitle: end.title || "", picks: { ...r.ep.picks }, seen: r.ep.seen.slice() };
  f.sideAfter = last.id;
  f.opening = K.title(name); // 외전 구분선은 이 메시지 뒤(오래된 메시지가 잘려도 어긋나지 않게 id로)
  const ai = [...f.msgs].reverse().find((m) => m.role === "ai");
  if (ai) ai.alts[ai.idx].suggestions = K.sug(name); // ✦ AI 추천이 부르지 않고 보여 줌
  saveRoom(f);
  return f;
}
