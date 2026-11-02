/* ---------------------------------------------------------------- 대화방 저장 */
function roomKey(id) { return "room-" + id; }
function indexRoom(r) {
  const c = r.char, lastAi = [...r.msgs].reverse().find((m) => curText(m));
  const entry = { id: r.id, charId: c.id, name: c.name, title: c.title, glyph: c.glyph, pal: c.pal, motif: c.motif, img: c.img || "", at: r.at,
    last: (lastAi ? curText(lastAi) : "").replace(/\[\[img:[^\]]*\]\]/g, "").replace(/[*"\[\]]/g, "").replace(/\s+/g, " ").trim().slice(0, 70) };
  S.rooms = [entry, ...S.rooms.filter((x) => x.id !== r.id)].sort((a, b) => b.at - a.at);
  KV.set("rooms", S.rooms); renderRailRecent();
}
function saveRoom(r) {
  if (deletedRooms.has(r.id)) return; // 지운 뒤 끝난 응답·요약이 방을 되살리지 않게
  r.at = Date.now();
  if (r.msgs.length > MAX_MSGS_KEEP) r.msgs = r.msgs.slice(-MAX_MSGS_KEEP);
  r.msgs.forEach((m, i) => { delete m.editing; if (m.role === "ai" && i < r.msgs.length - 20 && m.alts.length > 1) { m.alts = [m.alts[m.idx]]; m.idx = 0; } });
  KV.set(roomKey(r.id), r);
  indexRoom(r);
}
const MAX_MSGS_KEEP = 160;
const deletedRooms = new Set();
function migrateRoom(r) {
  normalizeChar(r.char);
  if (!r.v2) {
    const old = r.set || {};
    r.set = { model: old.tier === "default" ? "story" : "lite", len: old.len === "long" ? "long" : old.len === "short" ? "short" : "mid", mem: 10, rerollAsk: false };
    r.memHist = []; r.sinceMem = 0; r.turn = r.msgs.filter((m) => m.role === "user").length; r.userNote = ""; r.bookmarks = [];
    r.persona = { memo: "", img: "", ...r.persona }; r.v2 = true;
    if (Array.isArray(r.facts) && r.facts.length && !r.memory) r.memory = "[이전 버전에서 옮긴 기억]\n" + r.facts.map((f) => "- " + f).join("\n");
    delete r.facts; delete r.memCursor;
  }
  if (typeof r.set.allowUnfiltered !== "boolean") r.set.allowUnfiltered = false;
  r.msgs.forEach((m) => delete m.editing);
  return r;
}
function newRoom(c, openingIdx, persona) {
  normalizeChar(c);
  const op = c.openings[openingIdx] || c.openings[0];
  const st = { ...(op.status || {}) };
  if (st[c.gauge] === undefined) st[c.gauge] = 10;
  const r = {
    id: uid("r"), v2: true, char: JSON.parse(JSON.stringify(c)), persona: { id: persona.id, name: persona.name, memo: persona.memo || "", desc: persona.desc || "", img: persona.img || "" },
    opening: op.title, directive: op.directive || "", userNote: "", memory: "", memHist: [], sinceMem: 0, turn: 0, status: st, bookmarks: [],
    set: { model: "lite", len: "mid", mem: 10, rerollAsk: false, allowUnfiltered: false },
    msgs: [{ id: uid("m"), role: "ai", idx: 0, alts: [{ text: op.text, status: st, suggestions: [], opening: true }], statusBefore: st }],
    at: Date.now(), created: Date.now()
  };
  saveRoom(r); return r;
}
