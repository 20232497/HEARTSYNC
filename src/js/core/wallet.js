/* 요금: 무료 턴·PLUS·하트 차감/환불, 가격 계산(listPrice·quote) */
import { LEN, MODELS } from "../ai/models.js";
import { FREE_DAILY, LIMITS, PLUS_MONTHLY, SUGGEST_COST, WELCOME } from "./constants.js";
import { emit } from "./events.js";
import { S } from "./state.js";
import { KV } from "./storage.js";
import { today } from "./util.js";
/** @typedef {import("./types.js").Plan} Plan */
/** @typedef {import("./types.js").Quote} Quote */
/** @typedef {import("./types.js").RoomSet} RoomSet */

export { FREE_DAILY, PLUS_MONTHLY, SUGGEST_COST, WELCOME }; // 요금 상수는 core/constants.js에(ai/models.js와의 순환 import 때문) — 쓰던 곳은 그대로 wallet에서 가져감
// pins: 대화방마다 고정 기억 개수(2026-11-09 사용자 결정 — 무료 5 · PLUS 20, 한 줄의 글자 수는 LIMITS.pin)
export const PLAN = {
  free: { memTurns: 20, memoMax: LIMITS.memory, hist: 5, rooms: 3, pins: 5 },
  pro: { memTurns: 40, memoMax: 10000, hist: 20, rooms: 99, pins: 20 }
};
/** PLUS 유효 여부. @returns {boolean} */
export function isPro() {
  return !!(S.wallet.pro && S.wallet.pro.until > Date.now());
}
/** 지금 요금제 한도. @returns {Plan} */
export function plan() {
  return isPro() ? PLAN.pro : PLAN.free;
}
export function refreshFree() {
  if (S.wallet.freeDay !== today()) {
    S.wallet.freeDay = today();
    S.wallet.freeUsed = 0;
  }
}
/** 오늘 남은 무료 턴(라이트). @returns {number} */
export function freeLeft() {
  refreshFree();
  return Math.max(0, FREE_DAILY - S.wallet.freeUsed);
}
export function saveWallet() {
  KV.set("wallet", S.wallet);
  emit("wallet");
}
/** 하트 장부에 한 줄(최근 80개). @param {number} d 변화량(차감은 음수, 무료·PLUS는 0) @param {string} label @returns {void} */
export function ledger(d, label) {
  S.wallet.ledger.unshift({ at: Date.now(), d, label });
  S.wallet.ledger = S.wallet.ledger.slice(0, 80);
}
/* 가격: 모델 기본가 × 출력량 + 기억력 가산. 무료 턴은 라이트 모델에만, PLUS는 라이트 무제한·나머지는 정가(할인 없음 — 2026-11-26 사용자 결정) */
/** 정가(하트). @param {string} model ModelKey @param {string} len LenKey @param {number} mem 기억력 @returns {number} */
export function listPrice(model, len, mem) {
  const m = MODELS[model] || MODELS.lite;
  return Math.max(1, Math.ceil(m.base * (LEN[len] || LEN.mid).mul) + Math.max(0, Math.ceil((mem - 10) / 10)) * m.memStep);
}
/** 이 설정으로 한 턴 견적. @param {RoomSet} set @returns {Quote} */
export function quote(set) {
  const list = listPrice(set.model, set.len, set.mem);
  /** @type {Quote} */
  const q =
    set.model !== "lite"
      ? { type: "heart", n: list, list, sug: 0 }
      : isPro()
        ? { type: "plus", n: 0, list, sug: 0 }
        : freeLeft() > 0
          ? { type: "free", n: 0, list, sug: 0 }
          : { type: "heart", n: list, list, sug: 0 };
  // 답변 추천 자동 받기(방 설정 autoSug): 턴 값에 추천 값을 더함 — 무료 턴·PLUS에서도 추천 값은 냄. 하트가 그만큼 없으면 이 턴은 추천 없이 보냄
  // (버튼에 보이는 값만 내게 — 추천 때문에 턴이 막히지 않음)
  if (set.autoSug && S.wallet.hearts >= q.n + SUGGEST_COST) q.sug = SUGGEST_COST;
  return q;
}
/** 추천을 눌러 받을 때(추천 버튼·'새로 추천')의 견적 — 요금제와 무관하게 SUGGEST_COST. @returns {Quote} */
export function sugQuote() {
  return { type: "heart", n: SUGGEST_COST, list: SUGGEST_COST, sug: 0 };
}
/** 이 견적으로 나가는 하트(턴 값 + 추천 값). @param {Quote} q @returns {number} */
export function heartsOf(q) {
  return q.n + (q.sug || 0);
}
/** 견적 짧은 글("무료"·"PLUS"·"♥4", 추천 자동 받기가 붙으면 "♥5"·"무료+♥1"·"PLUS+♥1"). @param {Quote} q @returns {string} */
export function qShort(q) {
  if (q.type === "heart") return "♥" + heartsOf(q);
  return (q.type === "free" ? "무료" : "PLUS") + (q.sug ? "+♥" + q.sug : "");
}
/** 견적대로 차감하고 저장("wallet" 이벤트). @param {Quote} q @param {string} label 장부 설명 @returns {void} */
export function charge(q, label) {
  if (q.type === "free") {
    S.wallet.freeUsed++;
    ledger(0, label + " · 무료 턴");
  } else if (q.type === "heart") {
    S.wallet.hearts -= q.n;
    ledger(-q.n, label);
  } else ledger(0, label + " · PLUS");
  if (q.sug) {
    S.wallet.hearts -= q.sug;
    ledger(-q.sug, label + " · 답변 추천(자동 받기)");
  }
  saveWallet();
}
/** 실패한 턴 되돌리기(무료 턴·하트 — 추천 값도). @param {Quote} q @param {string} label @returns {void} */
export function refund(q, label) {
  if (q.type === "free") S.wallet.freeUsed = Math.max(0, S.wallet.freeUsed - 1);
  else if (q.type === "heart") {
    S.wallet.hearts += q.n;
    ledger(q.n, label + " · 실패 환불");
  }
  refundSug(q, label);
  saveWallet();
}
/**
 * 추천 값만 되돌림 — 답은 왔는데 추천이 같이 오지 않았을 때(중간에 끊긴 답 포함). 되돌린 뒤 q.sug를 0으로 적어 두 번 되돌리지 않고, 답변의 값 표시(qShort)도 실제 낸 값이 됨.
 * @param {Quote} q @param {string} label @returns {void}
 */
export function refundSug(q, label) {
  if (!q.sug) return;
  S.wallet.hearts += q.sug;
  ledger(q.sug, label + " · 답변 추천 환불");
  q.sug = 0;
  saveWallet();
}
