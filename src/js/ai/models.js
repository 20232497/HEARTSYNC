/* AI 모델 등급(MODELS)·출력량(LEN)·OpenRouter 모델 선택(OR_TIER…). 모델 고도화는 여기와 ai/prompt/ */
import { FREE_DAILY } from "../core/constants.js";
import { S } from "../core/state.js";
/** @typedef {import("../core/types.js").LenKey} LenKey */
/** @typedef {import("../core/types.js").ModelKey} ModelKey */
/** @typedef {import("../core/types.js").Tier} Tier */

/* 성인 모드(OpenRouter) 등급별 모델: 라이트=quick, 스토리=default, 마스터=complex.
   마스터는 DeepSeek V3 — Magnum V4 72B(제공자 Mancer 하나)는 2026-11 시험에서 한국어가 깨지거나(3/3) 같은 줄을 되풀이하고 상태창을 안 쓰며 한 턴에 2분 걸려 뺌(직접 입력으로는 고를 수 있음) */
export const OR_TIER = { quick: "thedrummer/rocinante-12b", default: "nousresearch/hermes-3-llama-3.1-70b", complex: "deepseek/deepseek-chat-v3-0324" };
// 샘플링을 안 보내면 제공자 기본값(높은 temperature)으로 한국어가 일본어·중국어·코드 조각으로 깨짐 → 늘 보냄(모르는 값은 OpenRouter가 뺌)
export const OR_SAMPLING = { temperature: 0.8, top_p: 0.92, min_p: 0.05, repetition_penalty: 1.05 };
// 그림 태그 번역: 지시를 잘 따르는 순서. Hermes 3는 머리색 같은 없는 외모를 지어내서 쓰지 않음
export const OR_TAG_MODELS = ["deepseek/deepseek-chat-v3-0324", "thedrummer/unslopnemo-12b"];
// 등급 모델을 OpenRouter가 못 줄 때(제공자 없음 등) 한 번 대신 쓰는 모델. Rocinante 12B는 2026-10 기준 제공자가 없음
export const OR_BACKUP = { quick: "thedrummer/unslopnemo-12b" };
export const OR_PRESETS = [["deepseek/deepseek-chat-v3-0324", "DeepSeek V3"], ["nousresearch/hermes-3-llama-3.1-70b", "Hermes 3 70B"], ["anthracite-org/magnum-v4-72b", "Magnum V4 72B"], ["meta-llama/llama-3.3-70b-instruct", "Llama 3.3 70B"]];
const OR_NAMES = Object.fromEntries([...OR_PRESETS, ["thedrummer/rocinante-12b", "Rocinante 12B"], ["thedrummer/unslopnemo-12b", "UnslopNemo 12B"]]);
/** 등급에 쓸 OpenRouter 모델 id(직접 지정 → 설정 → OR_TIER). @param {Tier} tier @returns {string} */
export const orModel = (tier) => String(S.settings.customUnfilteredModel || "").trim() || S.settings.unfilteredModels?.[tier] || OR_TIER[tier] || OR_TIER.default;
/** OpenRouter 모델 id → 보이는 이름. @param {string} id @returns {string} */
export const orName = (id) => OR_NAMES[id] || String(id).split("/").pop();
/** 모델 등급 표 — base는 기본가(하트), memStep은 기억력 10턴마다 더하는 값. @type {Record<ModelKey, { tier: Tier, name: string, badge: string, desc: string, base: number, memStep: number }>} */
export const MODELS = {
  lite:   { tier: "quick",   name: "라이트", badge: "매일 무료 " + FREE_DAILY + "턴", desc: "빠르고 가벼운 일상 대화", base: 1, memStep: 0 },
  story:  { tier: "default", name: "스토리", badge: "추천", desc: "풍부한 묘사와 안정적인 캐릭터 연기", base: 4, memStep: 1 },
  master: { tier: "complex", name: "마스터", badge: "최고 품질", desc: "한 편의 소설 같은 몰입감. 복잡한 세계관과 전투 계산에 강해요", base: 8, memStep: 2 }
};
// chars는 본문 분량, lines는 한 응답에 넣을 대사 줄 수(대화가 자주 오가게), tokens는 상태 JSON까지 담을 출력 한도
/** 출력량 표 — chars 본문 분량, lines 대사 줄 수, tokens 출력 한도, mul 요금 배수. @type {Record<LenKey, { name: string, mul: number, desc: string, chars: string, lines: number, tokens: number }>} */
export const LEN = { short: { name: "적게", mul: 0.75, desc: "짧고 빠른 티키타카", chars: "500~800자", lines: 4, tokens: 2000 },
  mid: { name: "보통", mul: 1, desc: "지문과 대사가 균형 있게", chars: "1000~1500자", lines: 6, tokens: 3200 },
  long: { name: "많게", mul: 1.5, desc: "소설처럼 길고 풍성하게", chars: "1800~2600자", lines: 10, tokens: 5000 } };
