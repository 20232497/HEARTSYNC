/* 성인 모드 경로 판정(ageOK·unfilteredRoute)과 Claude 거절 시 우회 조건(canFallback) */
import { IN_CLAUDE } from "../core/config.js";
import { minorHint } from "../core/safety.js";
import { S, hasOpenRouterKey, room } from "../core/state.js";
/** @typedef {import("../core/types.js").LLMMessage} LLMMessage */
/** @typedef {import("../core/types.js").Room} Room */

export function ageOK() { return !!S.settings.isAgeVerified && !IN_CLAUDE; }
function isUnfilteredActive(r = room) {
  if (!ageOK()) return false;
  if (r && typeof r.set?.allowUnfiltered === "boolean") return r.set.allowUnfiltered || !S.settings.contentFilter;
  return !S.settings.contentFilter;
}
/* 이 대화방의 다음 응답이 실제로 성인 경로(OpenRouter)로 가는지: rulesPrompt·llm·모델 칩이 같은 값을 봄 */
/** 이 방의 다음 턴을 OpenRouter 성인 경로로 보낼지 — 성인 모드 + 키 + 최근 입력·유저노트에 미성년 암시 없음. @param {Room|null} [r=room] @returns {boolean} */
export function unfilteredRoute(r = room) {
  if (!r || !isUnfilteredActive(r) || !hasOpenRouterKey()) return false;
  const lastUser = [...(r.msgs || [])].reverse().find((m) => m.role === "user" && !m.sys);
  return !minorHint([lastUser?.text, r.userNote].join("\n"));
}
/* 정책 거절로 보이는 짧은 답 */
const REFUSAL_RE = /죄송합니다|도와드릴 수 없|작성할 수 없|이어 쓸 수 없|I cannot fulfill|I'm sorry/i;
/** 정책 거절로 보이는 짧은 답인지. @param {unknown} t @returns {boolean} */
export const refusedText = (t) => typeof t === "string" && t.trim().length < 120 && REFUSAL_RE.test(t);
/* Claude가 거절했을 때 OpenRouter로 다시 쓸지. 위험 능력 분류기(사이버·생물 등)의 거절과 미성년 암시는 우회하지 않음 */
/** Claude가 거절했을 때 OpenRouter로 다시 쓸지. @param {LLMMessage[]} messages @param {string|null} [category] 거절 분류 @returns {boolean} */
export function canFallback(messages, category = null) {
  if (!ageOK() || !S.settings.autoFallback || !hasOpenRouterKey()) return false;
  if (["cyber", "bio", "frontier_llm", "reasoning_extraction"].includes(category)) return false;
  const recent = messages.length > 1 ? messages.slice(1).slice(-3) : messages;
  return !minorHint(recent.map((m) => m.content).join("\n"));
}
