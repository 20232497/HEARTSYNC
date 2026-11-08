/* 전역 상태 S(지갑·페르소나·대화방·설정), 현재 대화방·진행 중 생성(다른 모듈은 set…()로만 바꿈), API 키 유무(hasClaudeKey — S와 CFG.serverKeys를 함께 봄) */
import { CFG } from "./config.js";
import { today } from "./util.js";
/** @typedef {import("./types.js").Room} Room */
/** @typedef {import("./types.js").State} State */

export const hasClaudeKey = () => !!S.settings.apiKey || !!CFG.serverKeys;
/** 전역 상태 — 모양은 types.js의 State. 바꾼 모듈이 KV.set(또는 save…())으로 저장한다. @type {State} */
export const S = {
  wallet: { hearts: 0, freeDay: today(), freeUsed: 0, pro: null, history: [], ledger: [], ack: {} },
  personas: [{ id: "p1", name: "유저", memo: "", desc: "", img: "", def: true }],
  rooms: [],
  settings: { fs: 15.5, chatLh: 1.8, narrFont: "serif", enterSend: true, sceneImg: true, apiKey: "", memCfg: { auto: true, every: 5, limit: 3000, guide: "auto", custom: "" } },
  cat: "전체", q: ""
};
export let room = null, gen = null;
/** 진행 중인 응답 생성(없으면 null). @param {{ ctl: AbortController, msgId: string }|null} v @returns {typeof v} */
export function setGen(v) { return (gen = v); }
/** 지금 열린 대화방(없으면 null). @param {Room|null} v @returns {Room|null} */
export function setRoom(v) { return (room = v); }
