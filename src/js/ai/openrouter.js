/* OpenRouter 스트리밍, 깨진 응답(garbled)·되풀이(loopAt) 감지 */
import { OR_BACKUP, OR_SAMPLING, orModel } from "./models.js";
import { looseJSON, splitReply } from "./parse.js";
import { CFG } from "../core/config.js";
import { MARK, TIMEOUT } from "../core/constants.js";
import { S, hasOpenRouterKey } from "../core/state.js";
import { abortCode, timeoutSignal } from "../core/util.js";
/** @typedef {import("../core/types.js").LLMError} LLMError */
/** @typedef {import("../core/types.js").LLMMessage} LLMMessage */
/** @typedef {import("../core/types.js").LLMOptions} LLMOptions */

/* 깨진 응답 알아보기: 일본어 가나·한자가 많이 섞이거나 한글이 거의 없거나, 이상한 조각이 2개 이상
   (camelCase·파일 이름·밑줄 낱말, 한글에 바로 붙은 소문자 영어·한자, 숫자 섞인 영문 덩어리 — 2026-11 실제로 나온 깨진 응답들로 맞춤) */
function garbled(t) {
  const s = String(t), cnt = (re) => (s.match(re) || []).length;
  const ko = cnt(/[가-힣]/g), kana = cnt(/[぀-ヿ]/g), han = cnt(/[一-鿿]/g);
  if (kana >= 6 || (han > 12 && han > ko * 0.2) || (s.length > 300 && ko < s.length * 0.2)) return true;
  // 한국어 사이에 끼어든 중국어 문장: 중국어 문장부호가 붙은 한자, 또는 한자 10자 이상 연속(무협 한자 병기는 보통 4~8자)
  if (/[一-鿿][。，！？；：]|[。，][一-鿿]|[一-鿿]{10,}/.test(s)) return true;
  return cnt(/[a-z]{2,}[A-Z][a-z]{2,}|\w+\.(?:cpp|js|py|h|java)\b|[A-Za-z]+_[A-Za-z]*/g) + cnt(/[가-힣][a-z]{3,}|[a-z]{3,}[가-힣]/g)
    + cnt(/[가-힣][一-鿿]|[一-鿿][가-힣]/g) + cnt(/\b(?=[a-z]*\d)(?=\d*[a-z])[a-z\d]{6,}\b/gi) >= 2;
}
/* 같은 문단 묶음(1~4문단, 합쳐 30자 이상)이 바로 이어서 되풀이되면 두 번째 묶음이 시작하는 위치, 아니면 -1.
   롤플레이 12B 모델이 같은 두세 줄을 출력 한도까지 반복하다 상태창 없이 끊기는 것을 막음(2026-11 Rocinante). 쓰는 중인 마지막 줄은 빼고 봄 */
function loopAt(body) {
  const paras = [], re = /[^\n]+/g; let m;
  while ((m = re.exec(body))) { const t = m[0].trim(); if (t) paras.push({ t, at: m.index }); }
  if (!/\n\s*$/.test(body)) paras.pop();
  for (let k = 1; k <= 4 && paras.length >= 2 * k; k++) {
    const a = paras.slice(-2 * k, -k), b = paras.slice(-k);
    if (a.every((p, i) => p.t === b[i].t) && a.reduce((n, p) => n + p.t.length, 0) >= 30) return b[0].at;
  }
  return -1;
}
/* OpenRouter(OpenAI 호환 SSE). 메시지 모양(첫 메시지 = 시스템, 같은 역할 이어 붙이기)과 json 처리는 byok와 같음.
   model을 주면 등급 대신 그 모델, sampling은 샘플링 값. 대화 요청(시스템에 MARK)의 본문이 깨지면 멈추고 temperature를 낮춰 한 번 다시 씀 */
/**
 * @param {LLMMessage[]} messages 첫 메시지 = 시스템
 * @param {LLMOptions & { model?: string, sampling?: object, retry?: boolean }} o model은 등급 대신 그 모델, retry는 깨진 응답을 한 번 다시 쓸지
 * @returns {Promise<string|unknown>}
 * @throws {LLMError} no_or_key · or_bad_key · or_no_funds · or_bad_model · or_network · garbled · timeout …
 */
export async function openRouterStream(messages, { tier, onText, signal, json, maxTokens, model: pinned = "", sampling = OR_SAMPLING, retry = true }) {
  if (!hasOpenRouterKey()) throw { code: "no_or_key" };
  const rest = [];
  for (const m of messages.slice(1)) {
    const last = rest[rest.length - 1];
    if (last && last.role === m.role) last.content += "\n\n" + m.content; else rest.push({ role: m.role, content: m.content });
  }
  if (!rest.length || rest[0].role !== "user") rest.unshift({ role: "user", content: "(시작)" });
  // 롤플레이 모델은 긴 시스템 지시의 출력 형식을 잊음 → 대화 요청이면 마지막 유저 메시지 끝에 형식을 한 번 더(2026-11 시험: 없으면 상태창을 안 씀)
  const chat = !json && messages[0].content.includes(MARK), shape = chat ? (/^\{"status".*$/m.exec(messages[0].content) || [])[0] : "";
  if (shape && rest[rest.length - 1].role === "user") rest[rest.length - 1].content += `\n\n[출력 형식 — 반드시 지킨다]\n1) 한국어 장면 본문\n2) 한 줄에 ${MARK}\n3) JSON 한 개: ${shape}`;
  let model = pinned || orModel(tier), res, T;
  for (let tries = 0; tries < 2; tries++) {
    T = timeoutSignal(TIMEOUT.connect, signal); // 응답 머리까지 connect, 스트림 조각 사이 stall
    try {
      res = await fetch(CFG.openRouterUrl, {
        method: "POST", signal: T.signal,
        headers: { "content-type": "application/json", ...(S.settings.openRouterKey ? { authorization: "Bearer " + S.settings.openRouterKey } : {}),
          "HTTP-Referer": location.origin !== "null" ? location.origin : "https://20232497.github.io/HEARTSYNC/", "X-Title": "HEART SYNC" },
        body: JSON.stringify({ model, max_tokens: maxTokens, stream: true, ...sampling, messages: [{ role: "system", content: messages[0].content }, ...rest] })
      });
    } catch (e) { T.clear(); throw { code: abortCode(e, T, "or_network") }; }
    if (res.ok) break;
    T.clear();
    const j = await res.json().catch(() => ({})), msg = String(j.error?.message || "");
    const code = res.status === 401 || res.status === 403 ? "or_bad_key" : res.status === 402 ? "or_no_funds" : res.status === 429 ? "rate_limited"
      : /context length|maximum context|too many tokens/i.test(msg) ? "prompt_too_large" : res.status === 404 || /model|endpoint/i.test(msg) ? "or_bad_model" : "upstream_error";
    // 등급 모델을 지금 제공하는 곳이 없으면 대신 모델(OR_BACKUP)로 한 번 더. 직접 고른 모델이면 그대로 알림
    const backup = OR_BACKUP[tier];
    if (code === "or_bad_model" && tries === 0 && backup && model !== backup && !String(S.settings.customUnfilteredModel || "").trim()) { model = backup; continue; }
    throw { code, msg };
  }
  const reader = res.body.getReader(), dec = new TextDecoder(); let buf = "", text = "", fin = false, err = null, bad = false, checked = 0;
  T.tick(TIMEOUT.stall);
  try {
    while (!fin) {
      const { value, done } = await reader.read(); if (done) break;
      T.tick(TIMEOUT.stall);
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line.startsWith("data:")) continue; // ": OPENROUTER PROCESSING" 같은 주석 줄
        const data = line.slice(5).trim();
        if (data === "[DONE]") { fin = true; break; }
        let ev; try { ev = JSON.parse(data); } catch { continue; }
        if (ev.error) { err = ev.error; fin = true; break; }
        const delta = ev.choices?.[0]?.delta?.content;
        if (delta) { text += delta; onText?.({ text, delta }); }
        // 본문이 깨지기 시작하면 바로 멈춤, 같은 문단을 되풀이하기 시작하면 첫 번째까지만 남기고 멈춤(100자마다 검사)
        if (chat && text.length >= 120 && text.length - checked >= 100) {
          checked = text.length; const body = splitReply(text).body;
          if (garbled(body)) { bad = fin = true; break; }
          const at = text.indexOf(MARK) < 0 ? loopAt(body) : -1;
          if (at >= 0) { text = body.slice(0, at).trimEnd(); onText?.({ text, delta: "" }); fin = true; try { reader.cancel(); } catch {} break; }
        }
      }
    }
  } catch (e) { throw { code: abortCode(e, T, "upstream_error"), text }; }
  finally { T.clear(); }
  if (!bad && chat && text.length >= 40 && garbled(splitReply(text).body)) bad = true;
  if (bad) {
    try { reader.cancel(); } catch {}
    onText?.({ text: "", delta: "" }); // 화면의 깨진 글을 지움
    if (retry) return openRouterStream(messages, { tier, onText, signal, json, maxTokens, model, sampling: { ...sampling, temperature: 0.6 }, retry: false });
    throw { code: "garbled", text };
  }
  if (err) throw { code: "upstream_error", text, msg: String(err.message || "") };
  if (json) { const v = looseJSON(text); if (v === undefined) throw { code: "invalid_json", text }; return v; }
  return text;
}
