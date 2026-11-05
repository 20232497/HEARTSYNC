/* 성인 모드 경로 판정(ageOK·unfilteredRoute)과 Claude 거절 시 우회 조건(canFallback) */
import { CFG, IN_CLAUDE, idvOn } from "../core/config.js";
import { getChar } from "../core/character.js";
import { idvPassed, minorHint, roomMinorHint } from "../core/safety.js";
import { S, hasOpenRouterKey, room } from "../core/state.js";
/** @typedef {import("../core/types.js").LLMMessage} LLMMessage */
/** @typedef {import("../core/types.js").Room} Room */

/* 성인 확인: 휴대폰 인증을 켰으면(CFG.idv) 그 결과만, 아니면 자기 확인 체크. 켠 뒤에는 예전 체크가 남아 있어도 인정하지 않음 */
export function ageOK() {
  if (IN_CLAUDE) return false;
  return idvOn() ? idvPassed(S.idv, CFG.idv.mode) : !!S.settings.isAgeVerified;
}
function isUnfilteredActive(r = room) {
  if (!ageOK()) return false;
  if (r && typeof r.set?.allowUnfiltered === "boolean") return r.set.allowUnfiltered || !S.settings.contentFilter;
  return !S.settings.contentFilter;
}
/** 이 방의 글(대화·설정)에 미성년 암시가 있어 성인 경로를 막는지. 키워드북은 buildInput처럼 원본 작품의 최신 것. @param {Room} r @returns {boolean} */
export const roomBlocked = (r) => roomMinorHint(r, getChar(r.char?.id)?.lore);
/* 이 대화방의 다음 응답이 실제로 성인 경로(OpenRouter)로 가는지: rulesPrompt·llm·모델 칩이 같은 값을 봄 */
/** 이 방의 다음 턴을 OpenRouter 성인 경로로 보낼지 — 성인 모드 + 키 + 방의 글에 미성년 암시 없음(roomBlocked). @param {Room|null} [r=room] @returns {boolean} */
export function unfilteredRoute(r = room) {
  if (!r || !isUnfilteredActive(r) || !hasOpenRouterKey()) return false;
  return !roomBlocked(r);
}
/* 정책 거절로 보이는 짧은 답 */
const REFUSAL_RE = /죄송합니다|도와드릴 수 없|작성할 수 없|이어 쓸 수 없|I cannot fulfill|I'm sorry/i;
/** 정책 거절로 보이는 짧은 답인지. @param {unknown} t @returns {boolean} */
export const refusedText = (t) => typeof t === "string" && t.trim().length < 120 && REFUSAL_RE.test(t);
/* Claude가 거절했을 때 OpenRouter로 다시 쓸지. 위험 능력 분류기(사이버·생물 등)의 거절과 미성년 암시는 우회하지 않음.
   보내려는 메시지 전부(첫 메시지인 시스템 규칙은 안전 문구가 있어 뺌)와 대화방의 글을 봄 — 성인 경로에서 막힌 방이 거절을 거쳐 OpenRouter로 새지 않게 */
/** Claude가 거절했을 때 OpenRouter로 다시 쓸지. @param {LLMMessage[]} messages @param {string|null} [category] 거절 분류 @param {Room|null} [r] 대화방 호출이면 그 방 @returns {boolean} */
export function canFallback(messages, category = null, r = null) {
  if (!ageOK() || !S.settings.autoFallback || !hasOpenRouterKey()) return false;
  if (["cyber", "bio", "frontier_llm", "reasoning_extraction"].includes(category)) return false;
  if (r && roomBlocked(r)) return false;
  return !minorHint((messages.length > 1 ? messages.slice(1) : messages).map((m) => m.content).join("\n"));
}
