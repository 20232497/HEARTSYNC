/* 전역 상태 S(지갑·페르소나·대화방·설정), claude.ai capability, 현재 대화방·진행 중 생성(다른 모듈은 set…()로만 바꿈), API 키 유무(hasClaudeKey… — S와 CFG.serverKeys를 함께 봄) */
import { OR_TIER } from "../ai/models.js";
import { CFG } from "./config.js";
import { today } from "./util.js";
import { IMG_MODELS } from "../images/styles.js";

export const hasClaudeKey = () => !!S.settings.apiKey || !!CFG.serverKeys;
export const hasRunwareKey = () => !!S.settings.runwareKey || !!CFG.serverKeys;
export const hasOpenRouterKey = () => !!S.settings.openRouterKey || !!CFG.serverKeys;
export const S = {
  wallet: { hearts: 0, freeDay: today(), freeUsed: 0, pro: null, history: [], ledger: [], ack: {} },
  personas: [{ id: "p1", name: "유저", memo: "", desc: "", img: "", def: true }],
  profile: { nick: "" }, mine: [], rooms: [], community: [], imgpacks: {}, coverpacks: {}, lorepacks: {}, tagpacks: {},
  settings: { fs: 15.5, chatLh: 1.8, narrFont: "serif", enterSend: true, sceneImg: true, apiKey: "", runwareKey: "", customSits: [], imgModel: IMG_MODELS[0].id, imgStyle: "webtoon", imgStyleCustom: "", styleRefs: [], styleSets: [], styleV2: true, memCfg: { auto: true, every: 5, limit: 3000, guide: "auto", custom: "" },
    // 성인 모드: 자기 확인(isAgeVerified) 전에는 모두 꺼진 것과 같음. contentFilter false면 모든 대화방이 성인 모드
    isAgeVerified: false, contentFilter: true, autoFallback: true, openRouterKey: "", unfilteredModels: { ...OR_TIER }, customUnfilteredModel: "" },
  engine: "pending", cat: "전체", q: ""
};
export let SAMPLE = null, samplePromise = null, DB = null, DOWNLOADS = null;
export function setDB(v) { return (DB = v); }
export function setDownloads(v) { return (DOWNLOADS = v); }
export function setSample(v) { return (SAMPLE = v); }
export function setSamplePromise(v) { return (samplePromise = v); }
export let room = null, gen = null;
export function setGen(v) { return (gen = v); }
export function setRoom(v) { return (room = v); }
