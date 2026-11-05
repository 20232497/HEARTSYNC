/* 전역 상태 S(지갑·페르소나·대화방·설정), claude.ai capability, 현재 대화방·진행 중 생성(다른 모듈은 set…()로만 바꿈), API 키 유무(hasClaudeKey… — S와 CFG.serverKeys를 함께 봄).
   core 잎에 가깝게 — 이미지 모델·OpenRouter 모델의 기본값은 여기 두지 않고 쓰는 쪽(images/styles.js의 styleFor, ai/models.js의 orModel)이 비었을 때 채움 */
import { CFG } from "./config.js";
import { today } from "./util.js";
/** @typedef {import("./types.js").Room} Room */
/** @typedef {import("./types.js").State} State */

export const hasClaudeKey = () => !!S.settings.apiKey || !!CFG.serverKeys;
export const hasRunwareKey = () => !!S.settings.runwareKey || !!CFG.serverKeys;
export const hasOpenRouterKey = () => !!S.settings.openRouterKey || !!CFG.serverKeys;
/** 전역 상태 — 모양은 types.js의 State. 바꾼 모듈이 KV.set(또는 save…())으로 저장한다. @type {State} */
export const S = {
  wallet: { hearts: 0, freeDay: today(), freeUsed: 0, pro: null, history: [], ledger: [], ack: {} },
  personas: [{ id: "p1", name: "유저", memo: "", desc: "", img: "", def: true }],
  idv: null, // 휴대폰 성인 인증 결과(services/idv.js) — KV·계정에 저장하지 않음
  profile: { nick: "" }, mine: [], rooms: [], community: [], imgpacks: {}, coverpacks: {}, lorepacks: {}, tagpacks: {},
  settings: { fs: 15.5, chatLh: 1.8, narrFont: "serif", enterSend: true, sceneImg: true, autoImg: false, apiKey: "", runwareKey: "", customSits: [], imgModel: "", imgStyle: "auto", imgStyleCustom: "", styleRefs: [], styleSets: [], styleV2: true, styleV3: true, memCfg: { auto: true, every: 5, limit: 3000, guide: "auto", custom: "" },
    // 성인 모드: 자기 확인(isAgeVerified) 전에는 모두 꺼진 것과 같음. contentFilter false면 모든 대화방이 성인 모드
    isAgeVerified: false, contentFilter: true, autoFallback: true, openRouterKey: "", customUnfilteredModel: "" },
  engine: "pending", cat: "전체", q: ""
};
export let SAMPLE = null, samplePromise = null, DB = null, DOWNLOADS = null;
export function setDB(v) { return (DB = v); }
export function setDownloads(v) { return (DOWNLOADS = v); }
export function setSample(v) { return (SAMPLE = v); }
export function setSamplePromise(v) { return (samplePromise = v); }
export let room = null, gen = null;
/** 진행 중인 응답 생성(없으면 null). @param {{ ctl: AbortController, msgId: string }|null} v @returns {typeof v} */
export function setGen(v) { return (gen = v); }
/** 지금 열린 대화방(없으면 null). @param {Room|null} v @returns {Room|null} */
export function setRoom(v) { return (room = v); }
