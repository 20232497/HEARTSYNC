/* AI 호출 llm(): claude.ai sample → BYOK 스트리밍 → OpenRouter 우회, 오류를 안내 문구로(errCopy) */
import { ageOK, canFallback, refusedText, unfilteredRoute } from "./adult.js";
import { openRouterStream } from "./openrouter.js";
import { looseJSON } from "./parse.js";
import { ANTHROPIC_URL, CFG } from "../core/config.js";
import { TIMEOUT } from "../core/constants.js";
import { S, SAMPLE, hasClaudeKey, hasOpenRouterKey, samplePromise } from "../core/state.js";
import { abortCode, timeoutSignal, toast } from "../core/util.js";
/** @typedef {import("../core/types.js").LLMError} LLMError */
/** @typedef {import("../core/types.js").LLMMessage} LLMMessage */
/** @typedef {import("../core/types.js").LLMOptions} LLMOptions */

export async function waitEngine() { if (S.engine === "pending") await samplePromise; }
/** 설정 화면에 보이는 AI 연결 이름. @returns {string} */
export function engineName() { return S.engine === "sample" ? "claude.ai 계정" : S.engine === "byok" ? (S.settings.apiKey ? "API 키" : "HEART SYNC 서버") : "연결 안 됨"; }
/**
 * AI 호출 하나. 경로: 성인 경로면 OpenRouter → claude.ai sample → BYOK(api.anthropic.com 스트리밍). Claude가 거절하면 canFallback일 때 OpenRouter로 다시.
 * @param {LLMMessage[]} messages 첫 메시지 = 시스템
 * @param {LLMOptions} [o]
 * @returns {Promise<string|unknown>} json이면 파싱한 값, 아니면 본문 글(상태 JSON 포함 — ai/parse.js로 나눔)
 * @throws {LLMError}
 */
export async function llm(messages, { tier = "quick", onText, signal, json = false, maxTokens = 2000, room: rr = null, adult = false } = {}) {
  await waitEngine();
  const o = { tier, onText, signal, json, maxTokens };
  // 성인 경로: 성인 모드 대화방(room)이거나 호출한 쪽이 성인 수위(adult)를 요청하면 OpenRouter로만
  if ((rr && unfilteredRoute(rr)) || (adult && ageOK() && hasOpenRouterKey())) return openRouterStream(messages, o);
  let out;
  try {
    if (S.engine === "sample" && SAMPLE) {
      const opts = { cache: false };
      if (onText) opts.onText = onText;
      if (signal) opts.signal = signal;
      if (!S.sampleTiers || S.sampleTiers.includes(tier)) opts.modelTier = tier;
      else if (tier === "complex" && S.sampleTiers.includes("default")) opts.modelTier = "default";
      out = json ? await SAMPLE.json(messages, opts) : (await SAMPLE(messages, opts)).text;
    }
    else if (hasClaudeKey()) out = await byok(messages, o);
    else throw { code: "no_engine" };
  } catch (e) {
    if ((e?.code === "refused" || (e?.code === "invalid_json" && refusedText(e.text))) && canFallback(messages, e.category)) return fallbackStream(messages, o);
    throw e;
  }
  if (refusedText(out) && canFallback(messages)) return fallbackStream(messages, o);
  return out;
}
function fallbackStream(messages, o) {
  toast("Claude가 이 요청을 거절해 OpenRouter 모델로 이어 써요");
  return openRouterStream(messages, o);
}
async function byok(messages, { tier, onText, signal, json, maxTokens }) {
  const sys = messages[0].content, rest = [];
  for (const m of messages.slice(1)) {
    const last = rest[rest.length - 1];
    if (last && last.role === m.role) last.content += "\n\n" + m.content; else rest.push({ role: m.role, content: m.content });
  }
  if (!rest.length || rest[0].role !== "user") rest.unshift({ role: "user", content: "(시작)" });
  const model = { quick: "claude-haiku-5-5", default: "claude-sonnet-5-5", complex: "claude-opus-5-5" }[tier] || "claude-sonnet-5-5";
  // Sonnet·Opus는 안전 분류기가 거절하면 Anthropic 서버가 권장 Claude 모델로 다시 씀(server-side fallback). 프록시 주소·Haiku에는 보내지 않음
  // 시간 제한: 응답 머리까지 connect, 그 뒤 조각 사이 stall(둘 다 {code:"timeout"} — 사용자 취소 cancelled와 구분). claude.ai sample 경로에는 없음
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
          else if (ev.type === "message_delta" && ev.delta?.stop_reason) { stop = ev.delta.stop_reason; category = (ev.delta.stop_details || ev.stop_details)?.category ?? null; }
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
    case "not_granted": return "Claude 사용을 허용해야 대화할 수 있어요. 페이지를 새로고침하면 다시 물어봐요.";
    case "rate_limited": case "queue_overflow": return "요청이 몰렸어요. 잠시 뒤 다시 보내 주세요.";
    case "refused": return "이 장면은 이어 쓸 수 없었어요. 입력을 바꾸거나 // 지시로 방향을 틀어 보세요.";
    case "prompt_too_large": return "대화가 너무 길어요. 출력 설정에서 기억력을 줄이거나 장기기억을 정리해 주세요.";
    case "no_engine": return "AI 연결이 없어요. MY → 설정에서 Anthropic API 키를 넣어 주세요.";
    case "bad_key": return "API 키가 올바르지 않아요. MY → 설정에서 확인해 주세요.";
    case "no_or_key": return "OpenRouter API 키가 없어요. MY → 설정에서 넣어 주세요. 하트는 돌려드렸어요.";
    case "or_bad_key": return "OpenRouter API 키가 올바르지 않아요. MY → 설정에서 확인해 주세요.";
    case "or_no_funds": return "OpenRouter 크레딧이 부족해요. openrouter.ai에서 충전해 주세요. 하트는 돌려드렸어요.";
    case "or_bad_model": return "OpenRouter 모델을 찾을 수 없어요. MY → 설정에서 무검열 모델을 확인해 주세요.";
    case "garbled": return "모델 응답이 깨져서(다른 언어·코드 조각이 섞임) 쓰지 않았어요. 다시 보내거나 AI 모델에서 다른 등급을 골라 주세요.";
    case "or_network": return "OpenRouter에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.";
    case "timeout": return "응답이 너무 오래 걸려 멈췄어요. 네트워크를 확인하고 다시 시도해 주세요. 하트는 돌려드렸어요.";
    case "session_expired": return "로그인이 만료됐어요. 페이지를 새로고침해 주세요.";
    case "sampling_disabled": case "capability_disabled": return "이 계정에서는 AI 호출이 꺼져 있어요.";
    default: return "응답을 받지 못했어요. 다시 시도해 주세요. 하트는 돌려드렸어요.";
  }
}
