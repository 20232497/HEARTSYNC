/* 대화방 저장·목록·이전(migrateRoom)·새 방 만들기, 메시지의 현재 버전 글(curText) */
import { normalizeChar } from "./character.js";
import { emit } from "./events.js";
import { S } from "./state.js";
import { KV } from "./storage.js";
import { uid } from "./util.js";
/** @typedef {import("./types.js").Message} Message */
/** @typedef {import("./types.js").Persona} Persona */
/** @typedef {import("./types.js").Room} Room */
/** @typedef {import("./types.js").Work} Work */

export function curText(m) { return m.role === "ai" ? (m.alts[m.idx] || {}).text || "" : m.text; }
/** 대화방의 KV 키 "room-<id>". @param {string} id @returns {string} */
export function roomKey(id) { return "room-" + id; }
function indexRoom(r) {
  const c = r.char, lastAi = [...r.msgs].reverse().find((m) => curText(m));
  const entry = { id: r.id, charId: c.id, name: c.name, title: c.title, glyph: c.glyph, pal: c.pal, motif: c.motif, img: c.img || "", at: r.at,
    last: (lastAi ? curText(lastAi) : "").replace(/\[\[img:[^\]]*\]\]/g, "").replace(/[*"\[\]]/g, "").replace(/\s+/g, " ").trim().slice(0, 70) };
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
  return r;
}
/**
 * 새 대화방 — 작품 사본·시작 상황 본문을 첫 AI 메시지로, 게이지가 없으면 10. 바로 저장함.
 * @param {Work} c @param {number} openingIdx 시작 상황 번호 @param {Persona} persona @returns {Room}
 */
export function newRoom(c, openingIdx, persona) {
  normalizeChar(c);
  const op = c.openings[openingIdx] || c.openings[0];
  const st = { ...(op.status || {}) };
  if (st[c.gauge] === undefined) st[c.gauge] = 10;
  const r = {
    id: uid("r"), v2: true, char: JSON.parse(JSON.stringify(c)), persona: { id: persona.id, name: persona.name, memo: persona.memo || "", desc: persona.desc || "", img: persona.img || "" },
    opening: op.title, directive: op.directive || "", userNote: "", memory: "", memHist: [], sinceMem: 0, turn: 0, status: st, bookmarks: [],
    set: { model: "lite", len: "mid", mem: 10, rerollAsk: false },
    msgs: [{ id: uid("m"), role: "ai", idx: 0, alts: [{ text: op.text, status: st, suggestions: [], opening: true }], statusBefore: st }],
    at: Date.now(), created: Date.now()
  };
  saveRoom(r); return r;
}
