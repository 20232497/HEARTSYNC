/* AI 호출 llm(): Anthropic 스트리밍(사용자 키 또는 CFG.anthropicUrl 서버 프록시), 오류를 안내 문구로(errCopy) */
import { looseJSON } from "./parse.js";
import { ANTHROPIC_URL, CFG } from "../core/config.js";
import { TIMEOUT } from "../core/constants.js";
import { S, hasClaudeKey } from "../core/state.js";
import { abortCode, timeoutSignal } from "../core/util.js";
/** @typedef {import("../core/types.js").LLMError} LLMError */
/** @typedef {import("../core/types.js").LLMMessage} LLMMessage */
/** @typedef {import("../core/types.js").LLMOptions} LLMOptions */

/** 설정 화면에 보이는 AI 연결 이름. @returns {string} */
export function engineName() { return !hasClaudeKey() ? "연결 안 됨" : S.settings.apiKey ? "API 키" : "HEART SYNC 서버"; }
const MODEL_OF = { quick: "claude-haiku-5-5", default: "claude-sonnet-5-5", complex: "claude-opus-5-5" };
/**
 * AI 호출 하나(api.anthropic.com 스트리밍 — 키는 S.settings.apiKey, CFG.serverKeys면 프록시가 붙임).
 * @param {LLMMessage[]} messages 첫 메시지 = 시스템
 * @param {LLMOptions} [o]
 * @returns {Promise<string|unknown>} json이면 파싱한 값, 아니면 본문 글(상태 JSON 포함 — ai/parse.js로 나눔)
 * @throws {LLMError}
 */
export async function llm(messages, { tier = "quick", onText, signal, json = false, maxTokens = 2000 } = {}) {
  if (!hasClaudeKey()) throw { code: "no_engine" };
  const sys = messages[0].content, rest = [];
  for (const m of messages.slice(1)) {
    const last = rest[rest.length - 1];
    if (last && last.role === m.role) last.content += "\n\n" + m.content; else rest.push({ role: m.role, content: m.content });
  }
  if (!rest.length || rest[0].role !== "user") rest.unshift({ role: "user", content: "(시작)" });
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
  const reader = res.body.getReader(), dec = new TextDecoder(); let buf = "", text = "", stop = "", category = null;
  T.tick(TIMEOUT.stall);
  try {
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      T.tick(TIMEOUT.stall);
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line.startsWith("data:")) continue;
        try {
          const ev = JSON.parse(line.slice(5));
          if (ev.type === "content_block_delta" && ev.delta?.text) { text += ev.delta.text; onText && onText({ text, delta: ev.delta.text }); }
          else if (ev.type === "message_delta" && ev.delta?.stop_reason) { stop = ev.delta.stop_reason; const d = ev.delta.stop_details || ev.stop_details; category = d && d.category !== undefined ? d.category : null; }
        } catch {}
      }
    }
  } catch (e) { throw { code: abortCode(e, T, "upstream_error"), text }; }
  finally { T.clear(); }
  // 거절(stop_reason refusal)은 부분 출력이 있어도 완성된 답으로 쓰지 않음
  if (stop === "refusal") throw { code: "refused", text, category };
  if (json) { const v = looseJSON(text); if (v === undefined) throw { code: "invalid_json", text }; return v; }
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
    default: return "응답을 받지 못했어요. 다시 시도해 주세요. 하트는 돌려드렸어요.";
  }
}
