/* 방 읽기의 경계(migrateRoom): 저장된 방을 열 수 있는 모양으로 보정하고 복구할 수 없으면 null — 예전 모양(v2 아님)과 예전 그림 코드도 여기서 옮김. 방을 여는 곳(ui/chat/view.js)이 부름 */
import { getChar, normalizeChar } from "./character.js";
import { fixSet, roomKey } from "./rooms.js";
import { KV } from "./storage.js";
import { uid } from "./util.js";
/** @typedef {import("./types.js").Room} Room */

/* 열 수 있는 메시지인지: AI 응답은 버전(alts)이 하나 이상, 내 메시지는 글이 있어야 함 */
const okMsg = (m) =>
  !!m &&
  typeof m === "object" &&
  (m.role === "ai" ? Array.isArray(m.alts) && m.alts.length > 0 && m.alts.every((a) => a && typeof a === "object") : typeof m.text === "string");
/**
 * 저장된 방을 열 수 있는 모양으로(제자리 보정) — 방을 여는 곳(ui/chat/view.js)이 부름. **방 읽기의 경계는 여기 한 곳**(2026-11-23):
 * - 복구할 수 없으면(방이 아님 · 작품 사본이 없음 · 열 수 있는 메시지가 없음) null을 돌려주고 받은 객체는 건드리지 않음 — 부른 쪽은 저장된 원본을 그대로 둔 채 안내만 함.
 * - 기본값이 분명한 빠짐만 채움: 설정(fixSet — 빠진 칸과 표에 없는 모델·출력량) · 페르소나 · 상태창 · 북마크·고정 기억·기억 이력(빈 목록) · 메시지 id · 버전 번호(범위를 벗어나면 마지막 버전). 모양이 깨진 메시지는 뺌.
 * - 예전 모양(v2 아님)은 지금 모양으로 옮김.
 * 여기서 고친 것은 저장하지 않음(다음에 방을 저장할 때 같이) — 그림 코드 체계를 옮긴 것(upgradeCodes)만 바로 저장.
 * @param {Room} r @returns {Room|null}
 */
export function migrateRoom(r) {
  if (!r || typeof r !== "object" || !r.id || !r.char || typeof r.char !== "object" || !Array.isArray(r.msgs)) return null;
  const msgs = r.msgs.filter(okMsg);
  if (!msgs.length) return null;
  r.msgs = msgs;
  r.msgs.forEach((m) => {
    if (!m.id) m.id = uid("m");
    if (m.role === "ai" && !(m.idx >= 0 && m.idx < m.alts.length)) m.idx = m.alts.length - 1;
  });
  normalizeChar(r.char);
  if (!r.v2) {
    const old = r.set || {};
    r.set = {
      model: old.tier === "default" ? "story" : "lite",
      len: old.len === "long" ? "long" : old.len === "short" ? "short" : "mid",
      mem: 10,
      rerollAsk: false
    };
    r.memHist = [];
    r.sinceMem = 0;
    r.turn = r.msgs.filter((m) => m.role === "user").length;
    r.userNote = "";
    r.bookmarks = [];
    r.persona = { memo: "", img: "", ...r.persona };
    r.v2 = true;
    if (Array.isArray(r.facts) && r.facts.length && !r.memory) r.memory = "[이전 버전에서 옮긴 기억]\n" + r.facts.map((f) => "- " + f).join("\n");
    delete r.facts;
    delete r.memCursor;
  }
  r.set = fixSet(r.char, r.set); // 설정 칸이 통째로 없거나(전에는 아래 줄에서 예외가 나 방 화면이 멈췄음) 모델·출력량이 빠졌거나 표에 없는 값인 방
  r.persona = { id: "", name: "유저", memo: "", desc: "", img: "", ...(r.persona && typeof r.persona === "object" ? r.persona : {}) };
  if (!r.status || typeof r.status !== "object") r.status = {};
  for (const k of ["bookmarks", "pins", "memHist"]) if (!Array.isArray(r[k])) r[k] = [];
  delete r.set.allowUnfiltered; // 예전 방의 성인 무검열 칸(성인 기능은 서버에 다시 세움 — docs/ROADMAP.md)
  r.msgs.forEach((m) => delete m.editing);
  if (upgradeCodes(r)) KV.set(roomKey(r.id), r); // at(최근 활동)은 건드리지 않고 저장만
  return r;
}
/* 2026-11-08 그림 코드 체계 바꿈(images/codes.js): 예전 인물 코드(소문자·숫자 p1·ks)와 태그 [[img:p1:3]]·[[img:ks:3,404,501]]을
   지금 작품의 대문자 코드와 [[HSY3]]로. 같은 이름의 인물을 최신 작품(getChar)에서 찾고, 없으면 A·B·C… 순서로 새 코드. 바뀐 게 있으면 true */
function upgradeCodes(r) {
  const cast = r.char.cast || [],
    ok = (code) => /^[A-Z]{1,4}$/.test(code),
    old = cast.filter((x) => !ok(x.code));
  if (!old.length) return false;
  const live = getChar(r.char.id),
    taken = new Set(cast.filter((x) => ok(x.code)).map((x) => x.code)),
    map = {};
  const seq = (i) => {
    let s = "";
    do {
      s = String.fromCharCode(65 + (i % 26)) + s;
      i = Math.floor(i / 26) - 1;
    } while (i >= 0);
    return s;
  };
  old.forEach((x) => {
    const hit = live && (live.cast || []).find((y) => y.name === x.name && ok(y.code) && !taken.has(y.code));
    let code = hit ? hit.code : "";
    for (let i = 0; !code || taken.has(code); i++) code = seq(i);
    taken.add(code);
    map[x.code] = code;
    x.code = code;
  });
  // 예전 태그 → 새 태그: [[img:코드:번호(,조합)]] — 번호는 처음 나오는 0~14, 없으면 1(images/codes.js sitOf와 같은 규칙, 층 규칙 때문에 여기서 따로 씀)
  const sit = (spec) => {
    for (const p of String(spec).split(",")) if (/^\d{1,2}$/.test(p.trim()) && +p < 15) return +p;
    return 1;
  };
  const retag = (t) =>
    String(t || "").replace(/\[\[img:([a-z0-9]+):([\d,]+)\]\]/gi, (raw, code, spec) => {
      const n = map[code.toLowerCase()];
      return n ? `[[${n}${sit(spec)}]]` : raw;
    });
  r.msgs.forEach((m) => {
    if (m.role === "ai")
      m.alts.forEach((a) => {
        a.text = retag(a.text);
      });
    else m.text = retag(m.text);
  });
  if (r.char.images) {
    const im = {};
    for (const k of Object.keys(r.char.images)) im[map[k] || k] = r.char.images[k];
    r.char.images = im;
  }
  return true;
}
