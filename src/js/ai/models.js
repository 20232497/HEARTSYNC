/* AI 모델 등급(MODELS)·출력량(LEN)·작품의 권장 모델(recommendOf). 모델 고도화는 여기와 ai/prompt/ */
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
/**
 * 프롬프트 캐싱 스위치 — on이면 Anthropic으로 가는 길(내 키 직행·프록시·무료 길 관문)에서 시스템 프롬프트의 고정부(ai/prompt/rules.js rulesParts의 fixed) 끝에 캐시 표시를 붙임.
 * 캐시는 5분 유지(읽을 때마다 연장)·쓰기 1.25배·읽기 0.1배라, 턴 간격이 5분 안인 대화에서만 이득이고 그보다 뜸하면 고정부를 매번 1.25배로 냄 — 실측(tools/model-bench.mjs --direct)으로 절감이 확인되기 전에는 꺼 둠.
 * 객체인 이유: 시험 도구가 켜고 끄며 잴 수 있게.
 */
export const PROMPT_CACHE = { on: false };
/** 앱의 기본 추천 모델 — 작품이 권장 모델(work.js recommend)을 적지 않았을 때 새 대화방이 시작하는 모델. MODELS의 그 모델 badge가 '추천'(바꾸면 badge도 같이) */
export const RECOMMEND_DEFAULT = "story";
/** 작품이 권장 모델을 직접 적었으면 그 키, 아니면 "" — 모델 선택 시트의 '권장' 배지는 이때만 붙음. @param {{recommend?: string}|null|undefined} c @returns {ModelKey|""} */
export function recommendSet(c) { return c && MODELS[c.recommend] ? c.recommend : ""; }
/** 새 대화방이 시작하는 모델 — 작품의 권장 모델(recommendSet), 없으면 RECOMMEND_DEFAULT. @param {{recommend?: string}|null|undefined} c @returns {ModelKey} */
export function recommendOf(c) { return recommendSet(c) || RECOMMEND_DEFAULT; }
// chars는 본문 분량, lines는 한 응답에 넣을 대사 줄 수(대화가 자주 오가게), tokens는 상태 JSON까지 담을 출력 한도
/** 출력량 표 — chars 본문 분량, lines 대사 줄 수, tokens 출력 한도, mul 요금 배수. @type {Record<LenKey, { name: string, mul: number, desc: string, chars: string, lines: number, tokens: number }>} */
export const LEN = { short: { name: "적게", mul: 0.75, desc: "짧고 빠른 티키타카", chars: "500~800자", lines: 4, tokens: 2000 },
  mid: { name: "보통", mul: 1, desc: "지문과 대사가 균형 있게", chars: "1000~1500자", lines: 6, tokens: 3200 },
  long: { name: "많게", mul: 1.5, desc: "소설처럼 길고 풍성하게", chars: "1800~2600자", lines: 10, tokens: 5000 } };
