/* 요금: 무료 턴·PLUS·하트 차감/환불, 가격 계산(listPrice·quote) */
import { LEN, MODELS } from "../ai/models.js";
import { FREE_DAILY, LIMITS, PLUS_MONTHLY, WELCOME } from "./constants.js";
import { emit } from "./events.js";
import { S } from "./state.js";
import { KV } from "./storage.js";
import { today } from "./util.js";
/** @typedef {import("./types.js").Plan} Plan */
/** @typedef {import("./types.js").Quote} Quote */
/** @typedef {import("./types.js").RoomSet} RoomSet */

export { FREE_DAILY, PLUS_MONTHLY, WELCOME }; // 요금 상수는 core/constants.js에(ai/models.js와의 순환 import 때문) — 쓰던 곳은 그대로 wallet에서 가져감
// pins: 대화방마다 고정 기억 개수(2026-11-09 사용자 결정 — 무료 5 · PLUS 20, 한 줄의 글자 수는 LIMITS.pin)
export const PLAN = { free: { memTurns: 20, memoMax: LIMITS.memory, hist: 5, rooms: 3, pins: 5 }, pro: { memTurns: 40, memoMax: 10000, hist: 20, rooms: 99, pins: 20 } };
/** PLUS 유효 여부. @returns {boolean} */
export function isPro() { return !!(S.wallet.pro && S.wallet.pro.until > Date.now()); }
/** 지금 요금제 한도. @returns {Plan} */
export function plan() { return isPro() ? PLAN.pro : PLAN.free; }
export function refreshFree() { if (S.wallet.freeDay !== today()) { S.wallet.freeDay = today(); S.wallet.freeUsed = 0; } }
/** 오늘 남은 무료 턴(라이트). @returns {number} */
export function freeLeft() { refreshFree(); return Math.max(0, FREE_DAILY - S.wallet.freeUsed); }
export function saveWallet() { KV.set("wallet", S.wallet); emit("wallet"); }
/** 하트 장부에 한 줄(최근 80개). @param {number} d 변화량(차감은 음수, 무료·PLUS는 0) @param {string} label @returns {void} */
export function ledger(d, label) { S.wallet.ledger.unshift({ at: Date.now(), d, label }); S.wallet.ledger = S.wallet.ledger.slice(0, 80); }
/* 가격: 모델 기본가 × 출력량 + 기억력 가산. 무료 턴은 라이트 모델에만, PLUS는 라이트 무제한·나머지 50% */
/** 정가(하트). @param {string} model ModelKey @param {string} len LenKey @param {number} mem 기억력 @returns {number} */
export function listPrice(model, len, mem) {
  const m = MODELS[model] || MODELS.lite;
  return Math.max(1, Math.ceil(m.base * (LEN[len] || LEN.mid).mul) + Math.max(0, Math.ceil((mem - 10) / 10)) * m.memStep);
}
/** 이 설정으로 한 턴 견적. @param {RoomSet} set @returns {Quote} */
export function quote(set) {
  const list = listPrice(set.model, set.len, set.mem);
  if (isPro()) return set.model === "lite" ? { type: "plus", n: 0, list } : { type: "heart", n: Math.ceil(list / 2), list };
  if (set.model === "lite" && freeLeft() > 0) return { type: "free", n: 0, list };
  return { type: "heart", n: list, list };
}
/** 견적 짧은 글("무료"·"PLUS"·"♥4"). @param {Quote} q @returns {string} */
export function qShort(q) { return q.type === "free" ? "무료" : q.type === "plus" ? "PLUS" : "♥" + q.n; }
/** 견적대로 차감하고 저장("wallet" 이벤트). @param {Quote} q @param {string} label 장부 설명 @returns {void} */
export function charge(q, label) {
  if (q.type === "free") { S.wallet.freeUsed++; ledger(0, label + " · 무료 턴"); }
  else if (q.type === "heart") { S.wallet.hearts -= q.n; ledger(-q.n, label); }
  else ledger(0, label + " · PLUS");
  saveWallet();
}
/** 실패한 턴 되돌리기(무료 턴·하트). @param {Quote} q @param {string} label @returns {void} */
export function refund(q, label) {
  if (q.type === "free") S.wallet.freeUsed = Math.max(0, S.wallet.freeUsed - 1);
  else if (q.type === "heart") { S.wallet.hearts += q.n; ledger(q.n, label + " · 실패 환불"); }
  saveWallet();
}
