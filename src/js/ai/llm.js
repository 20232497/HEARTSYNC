/* AI 호출 llm(): 방의 트랙에 따라 일반은 Anthropic 스트리밍(사용자 키 또는 CFG.anthropicUrl 서버 프록시), 성인은 서버 대화 관문(CFG.chatUrl)으로 — 오류를 안내 문구로(errCopy) */
import { trackOf } from "./models.js";
import { looseJSON } from "./parse.js";
import { anthropicEvent, openaiEvent, readSSE } from "./stream.js";
import { getChar } from "../core/character.js";
import { ANTHROPIC_URL, CFG } from "../core/config.js";
import { TIMEOUT } from "../core/constants.js";
import { roomMinorHint } from "../core/safety.js";
import { S, hasClaudeKey } from "../core/state.js";
import { abortCode, timeoutSignal } from "../core/util.js";
import { SB } from "../services/supabase.js";
/** @typedef {import("../core/types.js").LLMError} LLMError */
/** @typedef {import("../core/types.js").LLMMessage} LLMMessage */
/** @typedef {import("../core/types.js").LLMOptions} LLMOptions */
/** @typedef {import("../core/types.js").Room} Room */

/** 설정 화면에 보이는 AI 연결 이름. @returns {string} */
export function engineName() { return !hasClaudeKey() ? "연결 안 됨" : S.settings.apiKey ? "API 키" : "HEART SYNC 서버"; }
const MODEL_OF = { quick: "claude-haiku-5-5", default: "claude-sonnet-5-5", complex: "claude-opus-5-5" };
/** 서버 대화 관문이 돌려주는 오류 코드 중 그대로 안내하는 것(나머지는 upstream_error). */
const GATE_CODES = ["login", "adult_required", "minor_blocked", "too_many", "rate_limited", "not_configured"];
/**
 * AI 호출 하나. 경로는 방의 트랙(ai/models.js trackOf)이 정함 — 본문·요약·추천 모두 room을 넘겨야 같은 경로로 감.
 * 일반 트랙: api.anthropic.com 스트리밍(키는 S.settings.apiKey, CFG.serverKeys면 프록시가 붙임). 성인 트랙: 서버 대화 관문(CFG.chatUrl)만 — Anthropic으로는 보내지 않음.
 * @param {LLMMessage[]} messages 첫 메시지 = 시스템
 * @param {LLMOptions} [o]
 * @returns {Promise<string|unknown>} json이면 파싱한 값, 아니면 본문 글(상태 JSON 포함 — ai/parse.js로 나눔)
 * @throws {LLMError}
 */
export async function llm(messages, { tier = "quick", onText, signal, json = false, maxTokens = 2000, room = null } = {}) {
  const adult = trackOf(room) === "adult";
  if (!adult && !hasClaudeKey()) throw { code: "no_engine" };
  const sys = messages[0].content, rest = [];
  for (const m of messages.slice(1)) {
    const last = rest[rest.length - 1];
    if (last && last.role === m.role) last.content += "\n\n" + m.content; else rest.push({ role: m.role, content: m.content });
  }
  if (!rest.length || rest[0].role !== "user") rest.unshift({ role: "user", content: "(시작)" });
  const req = { sys, rest, tier, onText, signal, maxTokens };
  const text = adult ? await viaGateway(req, room) : await viaAnthropic(req);
  if (json) { const v = looseJSON(text); if (v === undefined) throw { code: "invalid_json", text }; return v; }
  return text;
}
/* 일반 트랙 — Anthropic Messages 스트리밍 */
async function viaAnthropic({ sys, rest, tier, onText, signal, maxTokens }) {
  const model = MODEL_OF[tier] || MODEL_OF.default;
  // Sonnet·Opus는 안전 분류기가 거절하면 Anthropic 서버가 권장 Claude 모델로 다시 씀(server-side fallback). 프록시 주소·Haiku에는 보내지 않음
  // 시간 제한: 응답 머리까지 connect, 그 뒤 조각 사이 stall(둘 다 {code:"timeout"} — 사용자 취소 cancelled와 구분)
  let srvFb = tier !== "quick" && CFG.anthropicUrl === ANTHROPIC_URL, res, T;
  for (let tries = 0; tries < 2; tries++) {
    T = timeoutSignal(TIMEOUT.connect, signal);
    try {
      res = await fetch(CFG.anthropicUrl, {
        method: "POST", signal: T.signal,
        headers: { "content-type": "application/json", "anthropic-version": "2023-06-01", ...(srvFb ? { "anthropic-beta": "server-side-fallback-2026-07-01" } : {}), ...(S.settings.apiKey ? { "x-api-key": S.settings.apiKey, "anthropic-dangerous-direct-browser-access": "true" } : {}) },
        body: JSON.stringify({ model, max_tokens: maxTokens, stream: true, system: sys, messages: rest, ...(srvFb ? { fallbacks: "default" } : {}) })
      });
    } catch (e) { T.clear(); throw { code: abortCode(e, T, "upstream_error") }; }
    // fallbacks를 모르는 계정·엔드포인트면 한 번만 빼고 다시
    if (res.status === 400 && srvFb && /fallback|beta/i.test(await res.clone().text().catch(() => ""))) { T.clear(); srvFb = false; continue; }
    break;
  }
  if (!res.ok) { T.clear(); throw { code: res.status === 429 ? "rate_limited" : res.status === 401 ? "bad_key" : "upstream_error" }; }
  return pump(res, T, anthropicEvent, onText);
}
/* 성인 트랙 — 서버 대화 관문(Supabase Edge Function "chat", docs/edge/chat.ts). 관문이 로그인·성인 인증·미성년 암시·하루 한도를 판정하고,
   모델을 골라 OpenAI 호환 스트림으로 중계함. 여기서 미리 보는 것(관문 주소·로그인·roomMinorHint)은 헛걸음을 줄일 뿐이고 판정은 서버가 함.
   실패해도 Anthropic으로 돌리지 않음(대체 경로 없음) */
async function viaGateway({ sys, rest, tier, onText, signal, maxTokens }, r) {
  if (!CFG.chatUrl) throw { code: "no_gateway" };
  if (SB.s) await SB.fresh();
  if (!SB.s) throw { code: "login" };
  if (roomMinorHint(r, (getChar(r.char.id) || r.char).lore)) throw { code: "minor_blocked" };
  const T = timeoutSignal(TIMEOUT.connect, signal); let res;
  try {
    res = await fetch(CFG.chatUrl, {
      method: "POST", signal: T.signal,
      headers: { "content-type": "application/json", apikey: SB.key, authorization: "Bearer " + SB.s.access_token },
      body: JSON.stringify({ track: "adult", tier, max_tokens: maxTokens, messages: [{ role: "system", content: sys }].concat(rest) })
    });
  } catch (e) { T.clear(); throw { code: abortCode(e, T, "upstream_error") }; }
  if (!res.ok) {
    T.clear();
    const j = await res.json().catch(() => ({}));
    throw { code: GATE_CODES.includes(j && j.code) ? j.code : res.status === 429 ? "rate_limited" : "upstream_error" };
  }
  return pump(res, T, openaiEvent, onText);
}
/* 스트림을 끝까지 읽어 본문을 모음 — 조각 사이 stall 시간 제한, 끊기면 받은 데까지를 text에 실어 던짐. parse는 공급자별 조각 해석(ai/stream.js) */
async function pump(res, T, parse, onText) {
  let text = "", stop = "", category = null, failed = false;
  T.tick(TIMEOUT.stall);
  try {
    await readSSE(res.body, (ev) => {
      const e = parse(ev);
      if (e.delta) { text += e.delta; onText && onText({ text, delta: e.delta }); }
      if (e.stop) { stop = e.stop; category = e.category !== undefined ? e.category : null; }
      if (e.failed) failed = true;
    }, () => T.tick(TIMEOUT.stall));
  } catch (e) { throw { code: abortCode(e, T, "upstream_error"), text }; }
  finally { T.clear(); }
  // 거절(stop_reason refusal)은 부분 출력이 있어도 완성된 답으로 쓰지 않음
  if (stop === "refusal") throw { code: "refused", text, category };
  if (failed) throw { code: "upstream_error", text };
  return text;
}
/** 오류 → 사용자 안내 문구. 취소(cancelled)는 빈 문자열. @param {LLMError|unknown} e @returns {string} */
export function errCopy(e) {
  switch (e && e.code) {
    case "cancelled": return "";
    case "rate_limited": return "요청이 몰렸어요. 잠시 뒤 다시 보내 주세요.";
    case "refused": return "이 장면은 이어 쓸 수 없었어요. 입력을 바꾸거나 // 지시로 방향을 틀어 보세요.";
    case "no_engine": return "AI 연결이 없어요. MY → 설정에서 Anthropic API 키를 넣어 주세요.";
    case "bad_key": return "API 키가 올바르지 않아요. MY → 설정에서 확인해 주세요.";
    case "timeout": return "응답이 너무 오래 걸려 멈췄어요. 네트워크를 확인하고 다시 시도해 주세요. 하트는 돌려드렸어요.";
    case "session_expired": return "로그인이 만료됐어요. 페이지를 새로고침해 주세요.";
    case "no_gateway": case "not_configured": return "이 작품의 대화는 아직 준비 중이에요. 하트는 돌려드렸어요.";
    case "login": return "이 작품은 로그인한 뒤에 대화할 수 있어요. MY → 계정에서 로그인해 주세요.";
    case "adult_required": return "성인 인증이 확인된 계정만 이 작품과 대화할 수 있어요.";
    case "minor_blocked": return "미성년으로 보이는 인물·표현이 있어 이어 쓸 수 없어요. 유저노트·설정·최근 대화를 확인해 주세요.";
    case "too_many": return "오늘 대화 한도를 다 썼어요. 내일 다시 이어 주세요.";
    default: return "응답을 받지 못했어요. 다시 시도해 주세요. 하트는 돌려드렸어요.";
  }
}
