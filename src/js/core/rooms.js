/* 대화방 저장·목록·삭제(removeRoom)·새 방 만들기(newRoom), 메시지의 현재 버전 글(curText). 저장된 방을 여는 쪽은 core/room-read.js, 분기·외전·시작 상황 찾기는 core/room-fork.js */
import { LEN, MODELS, recommendOf } from "../ai/models.js";
import { normalizeChar } from "./character.js";
import { LIMITS, SERIES } from "./constants.js";
import { epInit } from "./episode.js";
import { emit } from "./events.js";
import { S, gen, room, setRoom } from "./state.js";
import { KV } from "./storage.js";
import { uid } from "./util.js";
/** @typedef {import("./types.js").Message} Message */
/** @typedef {import("./types.js").Persona} Persona */
/** @typedef {import("./types.js").Room} Room */
/** @typedef {import("./types.js").RoomSet} RoomSet */
/** @typedef {import("./types.js").Work} Work */

export function curText(m) {
  return m.role === "ai" ? (m.alts[m.idx] || {}).text || "" : m.text;
}
/** 대화방의 KV 키 "room-<id>". @param {string} id @returns {string} */
export function roomKey(id) {
  return "room-" + id;
}
function indexRoom(r) {
  const c = r.char,
    lastAi = [...r.msgs].reverse().find((m) => curText(m));
  const entry = {
    id: r.id,
    charId: c.id,
    name: c.name,
    title: c.title,
    glyph: c.glyph,
    pal: c.pal,
    motif: c.motif,
    img: c.img || "",
    at: r.at,
    mt: Date.now(), // 이 항목이 바뀐 때 — 두 기기의 목록을 합칠 때 어느 쪽이 새것인지(core/room-list.js)
    fork: !!r.forkedFrom,
    ep: r.ep ? (r.ep.end ? "결말" : r.ep.beat + 1 + "장") : "",
    side: !!r.side,
    ...(r.fav ? { fav: true } : {}),
    last: (lastAi ? curText(lastAi) : "")
      .replace(/\[\[[^\]]*\]\]/g, "")
      .replace(/[*"\[\]]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 70)
  };
  S.rooms = sortRooms([entry, ...S.rooms.filter((x) => x.id !== r.id)]);
  emit("rooms");
}
/**
 * 대화방 목록의 순서 — 즐겨찾기 먼저, 그 안에서 최근 순. 순서 규칙은 여기 한 곳: 대화 목록·왼쪽 메뉴의 최근 대화·상세의 내 대화방이 모두 S.rooms의 순서를 그대로 씀.
 * @param {import("./types.js").RoomIndex[]} list @returns {import("./types.js").RoomIndex[]} 새 배열
 */
export function sortRooms(list) {
  return list.slice().sort((a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0) || b.at - a.at);
}
/**
 * 대화방 즐겨찾기를 켜고 끔 — 방(r.fav)과 목록 항목에 같이 적고 "rooms" 이벤트. 순서 기준 시각(at)은 건드리지 않음(즐겨찾기를 눌렀다고 '최근 대화'가 되지 않게).
 * 켤 때 이미 LIMITS.favRooms개면 아무것도 바꾸지 않고 false. 지금 열려 있는 방이면 그 방 객체에 적음(나중의 저장이 표시를 지우지 않게).
 * @param {string} id @param {boolean} on @returns {Promise<boolean>} 바꿨으면 true
 */
export async function setFav(id, on) {
  const cur = S.rooms.find((x) => x.id === id);
  if (!cur) return false;
  if (on && !cur.fav && S.rooms.filter((x) => x.fav).length >= LIMITS.favRooms) return false;
  let r;
  try {
    r = room && room.id === id ? room : await KV.get(roomKey(id), true);
  } catch {
    return false; // 본문을 읽지 못함(없는 것과 다름) — 목록만 바꾸면 본문과 어긋남
  }
  if (deletedRooms.has(id)) return false; // 본문을 읽는 사이 지운 방 — 다시 쓰면 되살아남
  if (r) {
    if (on) r.fav = true;
    else delete r.fav;
    if (!(await KV.set(roomKey(id), r))) {
      // 본문에 적지 못했으면 목록도 바꾸지 않음(다시 열면 표시가 사라져 어긋남)
      if (on) delete r.fav;
      else r.fav = true;
      return false;
    }
  } // 본문이 없는 목록 항목(다른 기기의 방이 아직 안 온 것 등)은 목록만 바꿈
  S.rooms = sortRooms(
    S.rooms.map((x) => {
      if (x.id !== id) return x;
      const y = { ...x, mt: Date.now() }; // 즐겨찾기는 최근 시각(at)을 안 바꾸므로 '바뀐 때'를 따로 찍음(목록 합치기가 이쪽을 새것으로 보게)
      if (on) y.fav = true;
      else delete y.fav;
      return y;
    })
  );
  persistRooms();
  const se = savedEntry.get(id);
  if (se) se.entry = S.rooms.find((x) => x.id === id); // 저장된 본문에 맞는 목록 항목도 이 표시로 — 다음 저장이 실패해 되돌릴 때 표시가 사라지지 않게
  emit("rooms");
  return true;
}
/* 저장이 실패한 방(본문이 저장소에 들어가지 못함) — 방 화면이 '저장하지 못했어요 · 다시 저장'을 보여 줌. 다음 저장이 성공하면 풀림 */
const unsaved = new Set();
/** 마지막 저장이 실패한 방인지. @param {string} id @returns {boolean} */
export const roomUnsaved = (id) => unsaved.has(id);
/* 방마다: 저장 차례 번호(늦게 끝난 옛 저장이 목록을 건드리지 않게)와, 마지막으로 본문이 저장됐을 때의 목록 항목(실패하면 이 모양으로 되돌림 — 없던 방이면 undefined) */
const saveSeq = new Map(),
  savedEntry = new Map();
/* 저장소(와 계정)에 적어도 되는 목록(storableRooms)과 그것을 적는 일(persistRooms) — 본문이 아직 한 번도 저장되지 않은 새 방은 뺌: 목록이 먼저 적힌 뒤 창이 닫히면 목록에는 있는데 열 수 없는 방이 남음.
   화면용 목록(S.rooms)에는 그 방이 바로 있음. 새 방인지는 savedEntry로(이 세션의 첫 저장 때 목록에 없었고 아직 저장된 본문이 없음) */
export function storableRooms(list) {
  return list.filter((x) => {
    const se = savedEntry.get(x.id);
    return !se || !!se.entry;
  });
}
function persistRooms() {
  KV.set("rooms", storableRooms(S.rooms));
}
/**
 * 대화방 저장 + 목록(S.rooms) 갱신 + "rooms" 이벤트. 지운 방(deletedRooms)은 저장하지 않고, 오래된 메시지는 MAX_MSGS_KEEP개만 남김.
 * 본문은 큰 저장소(IndexedDB — core/storage.js)에 쓰므로 끝나는 때가 뒤임: 화면용 목록은 바로 고치고(화면이 기다리지 않게) 저장소의 목록은 본문이 저장된 뒤에 적음(persistRooms), **본문이 저장되지 못하면 목록을 마지막으로 저장된 모양으로
 * 되돌리고**(목록과 본문이 어긋나지 않게) 그 방을 '저장 안 됨'으로 적은 뒤 "rooms" 알림. 계정 올리기는 본문이 저장된 뒤에만(KV.set).
 * @param {Room} r @returns {Promise<boolean>} 본문이 저장됐는지
 */
export function saveRoom(r) {
  if (deletedRooms.has(r.id)) return Promise.resolve(false); // 지운 뒤 끝난 응답·요약이 방을 되살리지 않게
  r.at = Date.now();
  if (r.msgs.length > MAX_MSGS_KEEP) r.msgs = r.msgs.slice(-MAX_MSGS_KEEP);
  r.msgs.forEach((m, i) => {
    delete m.editing;
    if (m.role === "ai" && i < r.msgs.length - 20 && m.alts.length > 1) {
      m.alts = [m.alts[m.idx]];
      m.idx = 0;
    }
  });
  const id = r.id,
    seq = (saveSeq.get(id) || 0) + 1;
  saveSeq.set(id, seq);
  if (!savedEntry.has(id)) savedEntry.set(id, { seq: 0, entry: S.rooms.find((x) => x.id === id) }); // 이 세션의 첫 저장 — 지금 목록 항목이 '마지막으로 저장된 모양'(새 방이면 없음)
  indexRoom(r);
  const entry = S.rooms.find((x) => x.id === id); // 이번 저장에 맞는 목록 항목
  return Promise.resolve(KV.set(roomKey(id), r)).then((ok) => {
    // 저장된 것은 차례와 상관없이 기록 — 먼저 시작한 저장이 됐고 뒤의 저장이 실패하면, 앞의 것(저장된 본문)에 맞는 항목으로 되돌려야 함
    if (ok && seq > savedEntry.get(id).seq) savedEntry.set(id, { seq, entry });
    if (deletedRooms.has(id)) return !!ok; // 그사이 지운 방
    if (ok) {
      // 그사이 목록을 저장소에서 다시 읽어(계정 받기 뒤의 reloadFromCloud — 저장 중이던 새 방은 저장된 목록에 없었음) 이 방이 빠졌으면 다시 넣음
      if (!S.rooms.some((x) => x.id === id)) {
        S.rooms = sortRooms([entry, ...S.rooms]);
        emit("rooms");
      }
      persistRooms(); // 목록은 본문이 저장된 뒤에만 적음(계정 올리기도 이때) — 뒤에 더 새 저장이 있어도 본문이 생겼으니 적어 둠
    }
    if (saveSeq.get(id) !== seq) return !!ok; // 더 새 저장이 뒤에 있음(화면·되돌리기는 그쪽이 정함)
    if (ok) {
      if (unsaved.delete(id)) emit("rooms"); // 실패했던 방이 저장됨 — 방 화면이 '저장하지 못했어요' 줄을 거둠
    } else {
      unsaved.add(id);
      const good = savedEntry.get(id).entry;
      S.rooms = sortRooms(good ? S.rooms.map((x) => (x.id === id ? good : x)) : S.rooms.filter((x) => x.id !== id));
      persistRooms();
      emit("rooms");
    }
    return !!ok;
  });
}
/**
 * 지운 방의 id → 지운 때. 이 기기에 남겨 둠(hv1_gone — 계정에 올리지 않음): 아직 삭제 표식을 못 받은 다른 기기의 목록·본문이 와도 되살리지 않게
 * (core/room-list.js mergeRoomLists · services/cloud-pull.js). 자동으로 비우지 않음(보류). @returns {Record<string, number>}
 */
export function goneRooms() {
  try {
    return JSON.parse(localStorage.getItem("hv1_gone") || "{}") || {};
  } catch {
    return {};
  }
}
/* 방을 이 기기에서 지움(이 기기에서 지울 때와, 다른 기기가 지운 방의 표식을 받았을 때 같이 씀) — 지운 방으로 적고 본문과 목록에서 뺌 */
function forgetRoom(id, at) {
  deletedRooms.add(id);
  const g = goneRooms();
  if (!g[id]) {
    g[id] = at;
    try {
      localStorage.setItem("hv1_gone", JSON.stringify(g));
    } catch {}
  }
  KV.put(roomKey(id), undefined);
  S.rooms = S.rooms.filter((r) => r.id !== id);
}
/**
 * 대화방 삭제(데이터 쪽) — 지운 방으로 적고(끝나지 않은 응답·요약의 저장이 되살리지 않게) 본문과 목록에서 뺀 뒤 "rooms" 알림.
 * 계정에는 그 방의 행을 없애는 대신 **삭제 표식**({ gone: 지운 때 })을 써 둠(2026-11-23) — 다른 기기가 '바뀐 것만 받기'로 지움을 알고, 그 기기의 늦은 저장이 방을 되살리지 않음.
 * 로그인하지 않았으면 표식은 어디에도 가지 않음. 화면 쪽 일(진행 중 응답 멈추기·현재 방 해제·이동)은 부른 쪽이 함(ui/room-tools.js deleteRoom).
 * @param {string} id @returns {void}
 */
export function removeRoom(id) {
  const at = Date.now();
  forgetRoom(id, at);
  KV.set(roomKey(id), { gone: at }, { local: false });
  persistRooms();
  emit("rooms");
}
/**
 * 다른 기기가 지운 방(계정에서 삭제 표식을 받음)을 이 기기에서도 지움 — 열려 있거나 응답을 쓰는 중이어도(지움이 이김). 메모리에 든 방이면 놓음.
 * 목록은 계정에도 다시 올림(이 기기의 못 올린 목록에 그 방이 남아 있으면 그것이 올라가 되살아나므로).
 * @param {string} id @param {number} [at] 지운 때 @returns {boolean} 이 기기에 그 방이 있었으면 true
 */
export function roomGone(id, at) {
  const had = S.rooms.some((r) => r.id === id) || (!!room && room.id === id);
  forgetRoom(id, at || Date.now());
  if (gen && gen.roomId === id) gen.ctl.abort(); // 이 방에 쓰던 응답을 멈춤(다른 방의 응답은 그대로) — 끝나며 하는 저장은 지운 방이라 버려짐
  if (room && room.id === id) setRoom(null);
  if (had) {
    persistRooms();
    emit("rooms");
  }
  return had;
}
const MAX_MSGS_KEEP = 160;
/** 지운 대화방 id — 지운 뒤 끝난 응답·요약이 방을 되살리지 않게. @type {Set<string>} */
export const deletedRooms = new Set();
/**
 * 새 대화방의 기본 설정 — 모델은 작품의 권장 모델(recommendOf: work.js recommend, 없으면 앱 기본 추천), 출력량 보통·기억력 10턴. 상세 페이지의 '새 대화는 …로 시작' 안내도 이것으로. @param {Work} c @returns {RoomSet}
 */
export function defaultSet(c) {
  return { model: recommendOf(c), len: "mid", mem: 10, rerollAsk: false };
}
/**
 * 방 설정의 빠진 칸과 표에 없는 값을 기본값으로(방 읽기의 경계 core/room-read.js가 씀) — 모델·출력량이 표에 없으면 화면이 그 값을 읽다가 멈춤.
 * 그 밖의 칸(자동 받기 등)은 그대로 둠. @param {Work} c @param {unknown} set @returns {RoomSet}
 */
export function fixSet(c, set) {
  const d = defaultSet(c),
    s = { ...d, ...(set && typeof set === "object" ? set : {}) };
  const has = (table, k) => Object.prototype.hasOwnProperty.call(table, k); // 표에 직접 적힌 키만(constructor 같은 물려받은 이름은 아님)
  if (!has(MODELS, s.model)) s.model = d.model;
  if (!has(LEN, s.len)) s.len = d.len;
  if (!(s.mem > 0)) s.mem = d.mem;
  return s;
}
/**
 * 새 대화방 — 작품 사본·시작 상황 본문을 첫 AI 메시지로, 게이지가 없으면 10, 설정은 defaultSet. 바로 저장함.
 * 방은 시작 상황을 id(openingId)로 기억하고 제목(opening)은 화면에 보이는 글로만 씀 — 다시 찾을 때는 openingIndex.
 * 시작 상황의 선택 칸: place(배경 장소 — 본문에 그 장소 태그가 없으면 맨 위에 넣음) · suggestions(첫 메시지의 추천 답변) · lead(시작 직후 N턴 동안만 주는 연출 지시 — 방에 복사해 둠).
 * @param {Work} c @param {number} openingIdx 시작 상황 번호 @param {Persona} persona @returns {Room}
 */
export function newRoom(c, openingIdx, persona) {
  normalizeChar(c);
  const op = c.openings[openingIdx] || c.openings[0];
  const st = { ...(op.status || {}) };
  if (st[c.gauge] === undefined) st[c.gauge] = 10;
  const placeTag = op.place ? `[[${Object.keys(SERIES).find((k) => SERIES[k].field === "places")}${op.place}]]` : "";
  const text = placeTag && !op.text.includes(placeTag) ? placeTag + "\n\n" + op.text : op.text;
  const r = {
    id: uid("r"),
    v2: true,
    char: JSON.parse(JSON.stringify(c)),
    persona: { id: persona.id, name: persona.name, memo: persona.memo || "", desc: persona.desc || "", img: persona.img || "" },
    opening: op.title,
    ...(op.id ? { openingId: op.id } : {}),
    directive: op.directive || "",
    userNote: "",
    memory: "",
    memHist: [],
    pins: [],
    sinceMem: 0,
    turn: 0,
    status: st,
    bookmarks: [],
    set: defaultSet(c),
    ...(op.lead ? { lead: { text: op.lead.text, turns: op.lead.turns } } : {}),
    ...(c.episode ? { ep: epInit() } : {}), // 에피소드형 작품: 진행 상태(core/episode.js) — 장·사건·결말은 방의 작품 사본(r.char.episode)에서
    msgs: [
      { id: uid("m"), role: "ai", idx: 0, alts: [{ text, status: st, suggestions: (op.suggestions || []).slice(0, 3), opening: true }], statusBefore: st }
    ],
    at: Date.now(),
    created: Date.now()
  };
  saveRoom(r);
  return r;
}
/** 장기기억 구간의 머리표 "[a-b턴]" — 요약(ai/prompt/memory.js)이 구간마다 붙이고, 분기(memoryUpTo)가 읽음. @param {number} from @param {number} to @returns {string} */
export function memoryMark(from, to) {
  return `[${from}-${to}턴]`;
}
