/* AI 모델 등급(MODELS)·출력량(LEN). 모델 고도화는 여기와 ai/prompt/ */
import { FREE_DAILY } from "../core/constants.js";
/** @typedef {import("../core/types.js").LenKey} LenKey */
/** @typedef {import("../core/types.js").ModelKey} ModelKey */
/** @typedef {import("../core/types.js").Tier} Tier */

/**
 * 방의 트랙(대화 경로): "general" 일반 = Claude(Anthropic) · "adult" 성인 = 서버 대화 관문 뒤의 외부 모델(모델 이름은 서버 설정이 가짐).
 * 작품의 track이 방을 만들 때 사본(r.char.track)에 굳어 방이 사는 동안 바뀌지 않음 — 한 방 안에서 모델을 오가지 않고, 그 방의 모든 AI 호출(본문·요약·추천)이 같은 경로로 감(ai/llm.js).
 * @param {{ char?: { track?: string } }|null|undefined} r @returns {"general"|"adult"}
 */
export function trackOf(r) { return r && r.char && r.char.track === "adult" ? "adult" : "general"; }
/** 모델 등급 표 — tier는 llm()의 모델(일반 트랙: quick Haiku · default Sonnet · complex Opus, 성인 트랙: 서버 관문이 같은 세 등급에 모델을 붙임), base는 기본가(하트), memStep은 기억력 10턴마다 더하는 값. @type {Record<ModelKey, { tier: Tier, name: string, badge: string, desc: string, base: number, memStep: number }>} */
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
