/* 대화방 저장·목록·이전(migrateRoom)·새 방 만들기(newRoom)·분기(forkRoom), 메시지의 현재 버전 글(curText) */
import { recommendOf } from "../ai/models.js";
import { getChar, normalizeChar } from "./character.js";
import { SERIES } from "./constants.js";
import { emit } from "./events.js";
import { S } from "./state.js";
import { KV } from "./storage.js";
import { uid } from "./util.js";
/** @typedef {import("./types.js").Message} Message */
/** @typedef {import("./types.js").Persona} Persona */
/** @typedef {import("./types.js").Room} Room */
/** @typedef {import("./types.js").RoomSet} RoomSet */
/** @typedef {import("./types.js").Work} Work */

export function curText(m) { return m.role === "ai" ? (m.alts[m.idx] || {}).text || "" : m.text; }
/** 대화방의 KV 키 "room-<id>". @param {string} id @returns {string} */
export function roomKey(id) { return "room-" + id; }
function indexRoom(r) {
  const c = r.char, lastAi = [...r.msgs].reverse().find((m) => curText(m));
  const entry = { id: r.id, charId: c.id, name: c.name, title: c.title, glyph: c.glyph, pal: c.pal, motif: c.motif, img: c.img || "", at: r.at, fork: !!r.forkedFrom,
    last: (lastAi ? curText(lastAi) : "").replace(/\[\[[^\]]*\]\]/g, "").replace(/[*"\[\]]/g, "").replace(/\s+/g, " ").trim().slice(0, 70) };
  S.rooms = [entry, ...S.rooms.filter((x) => x.id !== r.id)].sort((a, b) => b.at - a.at);
  KV.set("rooms", S.rooms); emit("rooms");
}
/** 대화방 저장 + 목록(S.rooms) 갱신 + "rooms" 이벤트. 지운 방(deletedRooms)은 저장하지 않고, 오래된 메시지는 MAX_MSGS_KEEP개만 남김. @param {Room} r @returns {void} */
export function saveRoom(r) {
  if (deletedRooms.has(r.id)) return; // 지운 뒤 끝난 응답·요약이 방을 되살리지 않게
  r.at = Date.now();
  if (r.msgs.length > MAX_MSGS_KEEP) r.msgs = r.msgs.slice(-MAX_MSGS_KEEP);
  r.msgs.forEach((m, i) => { delete m.editing; if (m.role === "ai" && i < r.msgs.length - 20 && m.alts.length > 1) { m.alts = [m.alts[m.idx]]; m.idx = 0; } });
  KV.set(roomKey(r.id), r);
  indexRoom(r);
}
const MAX_MSGS_KEEP = 160;
/** 지운 대화방 id — 지운 뒤 끝난 응답·요약이 방을 되살리지 않게. @type {Set<string>} */
export const deletedRooms = new Set();
/** 예전 모양의 대화방(v2 아님)을 지금 모양으로 제자리 보정. @param {Room} r */
export function migrateRoom(r) {
  normalizeChar(r.char);
  if (!r.v2) {
    const old = r.set || {};
    r.set = { model: old.tier === "default" ? "story" : "lite", len: old.len === "long" ? "long" : old.len === "short" ? "short" : "mid", mem: 10, rerollAsk: false };
    r.memHist = []; r.sinceMem = 0; r.turn = r.msgs.filter((m) => m.role === "user").length; r.userNote = ""; r.bookmarks = [];
    r.persona = { memo: "", img: "", ...r.persona }; r.v2 = true;
    if (Array.isArray(r.facts) && r.facts.length && !r.memory) r.memory = "[이전 버전에서 옮긴 기억]\n" + r.facts.map((f) => "- " + f).join("\n");
    delete r.facts; delete r.memCursor;
  }
  delete r.set.allowUnfiltered; // 예전 방의 성인 무검열 칸(성인 기능은 서버에 다시 세움 — docs/ROADMAP.md)
  r.msgs.forEach((m) => delete m.editing);
  if (upgradeCodes(r)) KV.set(roomKey(r.id), r); // at(최근 활동)은 건드리지 않고 저장만
  return r;
}
/* 2026-11-08 그림 코드 체계 바꿈(images/codes.js): 예전 인물 코드(소문자·숫자 p1·ks)와 태그 [[img:p1:3]]·[[img:ks:3,404,501]]을
   지금 작품의 대문자 코드와 [[HSY3]]로. 같은 이름의 인물을 최신 작품(getChar)에서 찾고, 없으면 A·B·C… 순서로 새 코드. 바뀐 게 있으면 true */
function upgradeCodes(r) {
  const cast = r.char.cast || [], ok = (code) => /^[A-Z]{1,4}$/.test(code), old = cast.filter((x) => !ok(x.code));
  if (!old.length) return false;
  const live = getChar(r.char.id), taken = new Set(cast.filter((x) => ok(x.code)).map((x) => x.code)), map = {};
  const seq = (i) => { let s = ""; do { s = String.fromCharCode(65 + (i % 26)) + s; i = Math.floor(i / 26) - 1; } while (i >= 0); return s; };
  old.forEach((x) => {
    const hit = live && (live.cast || []).find((y) => y.name === x.name && ok(y.code) && !taken.has(y.code));
    let code = hit ? hit.code : ""; for (let i = 0; !code || taken.has(code); i++) code = seq(i);
    taken.add(code); map[x.code] = code; x.code = code;
  });
  // 예전 태그 → 새 태그: [[img:코드:번호(,조합)]] — 번호는 처음 나오는 0~14, 없으면 1(images/codes.js sitOf와 같은 규칙, 층 규칙 때문에 여기서 따로 씀)
  const sit = (spec) => { for (const p of String(spec).split(",")) if (/^\d{1,2}$/.test(p.trim()) && +p < 15) return +p; return 1; };
  const retag = (t) => String(t || "").replace(/\[\[img:([a-z0-9]+):([\d,]+)\]\]/gi, (raw, code, spec) => { const n = map[code.toLowerCase()]; return n ? `[[${n}${sit(spec)}]]` : raw; });
  r.msgs.forEach((m) => { if (m.role === "ai") m.alts.forEach((a) => { a.text = retag(a.text); }); else m.text = retag(m.text); });
  if (r.char.images) { const im = {}; for (const k of Object.keys(r.char.images)) im[map[k] || k] = r.char.images[k]; r.char.images = im; }
  return true;
}
/** 새 대화방의 기본 설정 — 모델은 작품의 권장 모델(recommendOf: work.js recommend, 없으면 앱 기본 추천), 출력량 보통·기억력 10턴. 상세 페이지의 '새 대화는 …로 시작' 안내도 이것으로. @param {Work} c @returns {RoomSet} */
export function defaultSet(c) { return { model: recommendOf(c), len: "mid", mem: 10, rerollAsk: false }; }
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
    id: uid("r"), v2: true, char: JSON.parse(JSON.stringify(c)), persona: { id: persona.id, name: persona.name, memo: persona.memo || "", desc: persona.desc || "", img: persona.img || "" },
    opening: op.title, ...(op.id ? { openingId: op.id } : {}), directive: op.directive || "", userNote: "", memory: "", memHist: [], pins: [], sinceMem: 0, turn: 0, status: st, bookmarks: [],
    set: defaultSet(c),
    ...(op.lead ? { lead: { text: op.lead.text, turns: op.lead.turns } } : {}),
    msgs: [{ id: uid("m"), role: "ai", idx: 0, alts: [{ text, status: st, suggestions: (op.suggestions || []).slice(0, 3), opening: true }], statusBefore: st }],
    at: Date.now(), created: Date.now()
  };
  saveRoom(r); return r;
}
/** 장기기억 구간의 머리표 "[a-b턴]" — 요약(ai/prompt/memory.js)이 구간마다 붙이고, 분기(memoryUpTo)가 읽음. @param {number} from @param {number} to @returns {string} */
export function memoryMark(from, to) { return `[${from}-${to}턴]`; }
/* 장기기억에서 그 턴보다 뒤에 시작하는 구간을 뺌 → [남긴 기억, 남긴 마지막 구간의 끝 턴(없으면 0), 뺀 것이 있는지].
   구간 머리표가 없는 글(직접 쓴 기억·압축으로 합쳐진 기억)은 그대로 둠 */
function memoryUpTo(mem, turn) {
  let last = 0, cut = false;
  const kept = String(mem || "").split(/\n\n(?=\[\d+-\d+턴\])/).filter((p) => {
    const m = p.match(/^\[(\d+)-(\d+)턴\]/);
    if (!m) return true;
    if (+m[1] > turn) { cut = true; return false; }
    last = +m[2]; return true;
  });
  return [kept.join("\n\n"), last, cut];
}
/* 분기한 방의 시작 상황 제목 끝에 붙는 표시 — 원래 제목은 baseOpening으로 */
const FORK_MARK = " (분기)";
/** 시작 상황의 원래 제목(분기 표시를 뗌) — '처음부터'가 같은 시작 상황을 찾을 때. @param {Room} r @returns {string} */
export function baseOpening(r) { const t = r.opening || ""; return t.slice(-FORK_MARK.length) === FORK_MARK ? t.slice(0, -FORK_MARK.length) : t; }
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
  const ai = [...f.msgs].reverse().find((m) => m.role === "ai"), ids = new Set(f.msgs.map((m) => m.id));
  f.id = uid("r"); f.opening = (baseOpening(r) || "기본") + FORK_MARK; f.forkedFrom = { roomId: r.id, msgId };
  f.status = (ai && (ai.alts[ai.idx].status || ai.statusBefore)) || r.status;
  const after = r.msgs.slice(i + 1).filter((m) => m.role === "user" && !m.canned).length, /* 즉답 명령어의 메시지는 턴이 아님 */ turn = Math.max(0, (r.turn || 0) - after), mem = memoryUpTo(r.memory, turn);
  f.turn = turn; f.memory = mem[0]; f.sinceMem = mem[2] ? Math.max(0, turn - mem[1]) : Math.max(0, (r.sinceMem || 0) - after);
  f.memHist = []; f.lastErr = ""; f.bookmarks = (r.bookmarks || []).filter((b) => ids.has(b)); f.created = Date.now();
  f.pins = (r.pins || []).filter((p) => !p.msgId || ids.has(p.msgId)).map((p) => ({ ...p })); // 고정 기억은 그 메시지까지에서 고정한 것만(직접 적은 것은 모두)
  saveRoom(f); return f;
}
