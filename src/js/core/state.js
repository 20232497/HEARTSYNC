/* 전역 상태 S(지갑·페르소나·대화방·설정), 현재 대화방·진행 중 생성(다른 모듈은 set…()로만 바꿈), API 키 유무(hasClaudeKey — S와 CFG.serverKeys를 함께 봄) */
import { CFG } from "./config.js";
import { LIMITS } from "./constants.js";
import { today } from "./util.js";
/** @typedef {import("./types.js").Room} Room */
/** @typedef {import("./types.js").State} State */

/** AI에 닿을 길이 있는지: 내 API 키, 서버 프록시(serverKeys), 또는 서버 대화 관문(chatUrl — 키 없는 로그인 이용자의 무료 길). */
export const hasClaudeKey = () => !!S.settings.apiKey || !!CFG.serverKeys || !!CFG.chatUrl;
/** 전역 상태 — 모양은 types.js의 State. 바꾼 모듈이 KV.set(또는 save…())으로 저장한다. @type {State} */
export const S = {
  wallet: { hearts: 0, freeDay: today(), freeUsed: 0, pro: null, history: [], ledger: [], ack: {} },
  personas: [{ id: "p1", name: "유저", memo: "", desc: "", img: "", def: true }],
  rooms: [],
  shelf: { likes: {}, unlikes: {}, recent: {}, seen: {}, ends: {} },
  settings: {
    fs: 15.5,
    chatLh: 1.8,
    narrFont: "serif",
    enterSend: true,
    sceneImg: true,
    apiKey: "",
    memCfg: { auto: true, every: 5, limit: LIMITS.memory, guide: "auto", custom: "" }
  },
  cat: "전체",
  kind: "all",
  q: ""
};
export let room = null,
  gen = null;
/**
 * 진행 중인 응답 생성(없으면 null) — roomId는 그 응답을 쓰는 방(다른 기기가 지운 방이 이 방일 때만 멈춤).
 * @param {{ ctl: AbortController, msgId: string, roomId: string }|null} v @returns {typeof v}
 */
export function setGen(v) {
  return (gen = v);
}
/** 지금 열린 대화방(없으면 null). @param {Room|null} v @returns {Room|null} */
export function setRoom(v) {
  return (room = v);
}
/* 응답 생성·요약이 아직 쓰고 있는 방 — 그 일이 끝나면 들고 있던 방 객체를 저장하므로, 그사이 계정에서 받은 것으로 그 방을 덮으면 곧 옛 사본에 다시 덮임.
   계정 받기(services/cloud.js)가 이 표를 보고 그 방을 미룸. 생성과 요약이 겹칠 수 있어 수를 셈 */
const inUse = new Map();
/** 이 방을 쓰기 시작함(끝나면 꼭 releaseRoom). @param {string} id @returns {void} */
export function holdRoom(id) {
  inUse.set(id, (inUse.get(id) || 0) + 1);
}
/** 이 방을 다 씀. @param {string} id @returns {void} */
export function releaseRoom(id) {
  const n = (inUse.get(id) || 0) - 1;
  if (n > 0) inUse.set(id, n);
  else inUse.delete(id);
}
/** 응답 생성·요약이 아직 쓰고 있는 방인지. @param {string} id @returns {boolean} */
export const roomInUse = (id) => inUse.has(id);
