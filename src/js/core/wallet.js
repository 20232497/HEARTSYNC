/* 요금: 무료 턴·PLUS·하트 차감/환불, 가격 계산(listPrice·quote) */
import { LEN, MODELS } from "../ai/models.js";
import { S } from "./state.js";
import { KV } from "./storage.js";
import { today } from "./util.js";
import { renderWalletChips } from "../ui/shell.js";

export const FREE_DAILY = 10, WELCOME = 30, PLUS_MONTHLY = 300;
export const PLAN = { free: { memTurns: 20, memoMax: 3000, hist: 5, rooms: 3 }, pro: { memTurns: 40, memoMax: 10000, hist: 20, rooms: 99 } };
export function isPro() { return !!(S.wallet.pro && S.wallet.pro.until > Date.now()); }
export function plan() { return isPro() ? PLAN.pro : PLAN.free; }
export function refreshFree() { if (S.wallet.freeDay !== today()) { S.wallet.freeDay = today(); S.wallet.freeUsed = 0; } }
export function freeLeft() { refreshFree(); return Math.max(0, FREE_DAILY - S.wallet.freeUsed); }
export function saveWallet() { KV.set("wallet", S.wallet); renderWalletChips(); }
export function ledger(d, label) { S.wallet.ledger.unshift({ at: Date.now(), d, label }); S.wallet.ledger = S.wallet.ledger.slice(0, 80); }
/* 가격: 모델 기본가 × 출력량 + 기억력 가산. 무료 턴은 라이트 모델에만, PLUS는 라이트 무제한·나머지 50% */
export function listPrice(model, len, mem) {
  const m = MODELS[model] || MODELS.lite;
  return Math.max(1, Math.ceil(m.base * (LEN[len] || LEN.mid).mul) + Math.max(0, Math.ceil((mem - 10) / 10)) * m.memStep);
}
export function quote(set) {
  const list = listPrice(set.model, set.len, set.mem);
  if (isPro()) return set.model === "lite" ? { type: "plus", n: 0, list } : { type: "heart", n: Math.ceil(list / 2), list };
  if (set.model === "lite" && freeLeft() > 0) return { type: "free", n: 0, list };
  return { type: "heart", n: list, list };
}
export function qShort(q) { return q.type === "free" ? "무료" : q.type === "plus" ? "PLUS" : "♥" + q.n; }
export function charge(q, label) {
  if (q.type === "free") { S.wallet.freeUsed++; ledger(0, label + " · 무료 턴"); }
  else if (q.type === "heart") { S.wallet.hearts -= q.n; ledger(-q.n, label); }
  else ledger(0, label + " · PLUS");
  saveWallet();
}
export function refund(q, label) {
  if (q.type === "free") S.wallet.freeUsed = Math.max(0, S.wallet.freeUsed - 1);
  else if (q.type === "heart") { S.wallet.hearts += q.n; ledger(q.n, label + " · 실패 환불"); }
  saveWallet();
}
