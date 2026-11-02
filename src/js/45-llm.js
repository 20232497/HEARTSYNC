/* ---------------------------------------------------------------- LLM 엔진 */
async function waitEngine() { if (S.engine === "pending") await samplePromise; }
function engineName() { return S.engine === "sample" ? "claude.ai 계정" : S.engine === "byok" ? (S.settings.apiKey ? "API 키" : "HEART SYNC 서버") : "연결 안 됨"; }
/* ---------------------------------------------------------------- 성인 모드
   claude.ai 안(아티팩트)에서는 켜지 않음. 성인 서사는 OpenRouter 모델로만 보내고 Claude에는 성인 지시를 보내지 않음.
   미성년(19세 미만·학생·아동) 암시는 수위와 상관없이 성인 경로·우회·성인 수위 그림에서 뺌 */
const IN_CLAUDE = !!(window.claude && typeof window.claude.use === "function");
function ageOK() { return !!S.settings.isAgeVerified && !IN_CLAUDE; }
function isUnfilteredActive(r = room) {
  if (!ageOK()) return false;
  if (r && typeof r.set?.allowUnfiltered === "boolean") return r.set.allowUnfiltered || !S.settings.contentFilter;
  return !S.settings.contentFilter;
}
/* 이 대화방의 다음 응답이 실제로 성인 경로(OpenRouter)로 가는지: rulesPrompt·llm·모델 칩이 같은 값을 봄 */
function unfilteredRoute(r = room) {
  if (!r || !isUnfilteredActive(r) || !hasOpenRouterKey()) return false;
  const lastUser = [...(r.msgs || [])].reverse().find((m) => m.role === "user" && !m.sys);
  return !minorHint([lastUser?.text, r.userNote].join("\n"));
}
/* 정책 거절로 보이는 짧은 답 */
const REFUSAL_RE = /죄송합니다|도와드릴 수 없|작성할 수 없|이어 쓸 수 없|I cannot fulfill|I'm sorry/i;
const refusedText = (t) => typeof t === "string" && t.trim().length < 120 && REFUSAL_RE.test(t);
/* Claude가 거절했을 때 OpenRouter로 다시 쓸지. 위험 능력 분류기(사이버·생물 등)의 거절과 미성년 암시는 우회하지 않음 */
function canFallback(messages, category = null) {
  if (!ageOK() || !S.settings.autoFallback || !hasOpenRouterKey()) return false;
  if (["cyber", "bio", "frontier_llm", "reasoning_extraction"].includes(category)) return false;
  const recent = messages.length > 1 ? messages.slice(1).slice(-3) : messages;
  return !minorHint(recent.map((m) => m.content).join("\n"));
}
async function llm(messages, { tier = "quick", onText, signal, json = false, maxTokens = 2000, room: rr = null, adult = false } = {}) {
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
  let srvFb = tier !== "quick" && CFG.anthropicUrl === ANTHROPIC_URL, res;
  for (let tries = 0; tries < 2; tries++) {
    try {
      res = await fetch(CFG.anthropicUrl, {
        method: "POST", signal,
        headers: { "content-type": "application/json", "anthropic-version": "2023-06-01", ...(srvFb ? { "anthropic-beta": "server-side-fallback-2026-07-01" } : {}), ...(S.settings.apiKey ? { "x-api-key": S.settings.apiKey, "anthropic-dangerous-direct-browser-access": "true" } : {}) },
        body: JSON.stringify({ model, max_tokens: maxTokens, stream: true, system: sys, messages: rest, ...(srvFb ? { fallbacks: "default" } : {}) })
      });
    } catch (e) { if (e.name === "AbortError") throw { code: "cancelled" }; throw { code: "upstream_error" }; }
    // fallbacks를 모르는 계정·엔드포인트면 한 번만 빼고 다시
    if (res.status === 400 && srvFb && /fallback|beta/i.test(await res.clone().text().catch(() => ""))) { srvFb = false; continue; }
    break;
  }
  if (!res.ok) throw { code: res.status === 429 ? "rate_limited" : res.status === 401 ? "bad_key" : "upstream_error" };
  const reader = res.body.getReader(), dec = new TextDecoder(); let buf = "", text = "", stop = "", category = null;
  try {
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
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
  } catch (e) { throw { code: e.name === "AbortError" ? "cancelled" : "upstream_error", text }; }
  // 거절(stop_reason refusal)은 부분 출력이 있어도 완성된 답으로 쓰지 않음
  if (stop === "refusal") throw { code: "refused", text, category };
  if (json) { const v = looseJSON(text); if (v === undefined) throw { code: "invalid_json", text }; return v; }
  return text;
}
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
async function openRouterStream(messages, { tier, onText, signal, json, maxTokens, model: pinned = "", sampling = OR_SAMPLING, retry = true }) {
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
  let model = pinned || orModel(tier), res;
  for (let tries = 0; tries < 2; tries++) {
    try {
      res = await fetch(CFG.openRouterUrl, {
        method: "POST", signal,
        headers: { "content-type": "application/json", ...(S.settings.openRouterKey ? { authorization: "Bearer " + S.settings.openRouterKey } : {}),
          "HTTP-Referer": location.origin !== "null" ? location.origin : "https://20232497.github.io/HEARTSYNC/", "X-Title": "HEART SYNC" },
        body: JSON.stringify({ model, max_tokens: maxTokens, stream: true, ...sampling, messages: [{ role: "system", content: messages[0].content }, ...rest] })
      });
    } catch (e) { if (e.name === "AbortError") throw { code: "cancelled" }; throw { code: "or_network" }; }
    if (res.ok) break;
    const j = await res.json().catch(() => ({})), msg = String(j.error?.message || "");
    const code = res.status === 401 || res.status === 403 ? "or_bad_key" : res.status === 402 ? "or_no_funds" : res.status === 429 ? "rate_limited"
      : /context length|maximum context|too many tokens/i.test(msg) ? "prompt_too_large" : res.status === 404 || /model|endpoint/i.test(msg) ? "or_bad_model" : "upstream_error";
    // 등급 모델을 지금 제공하는 곳이 없으면 대신 모델(OR_BACKUP)로 한 번 더. 직접 고른 모델이면 그대로 알림
    const backup = OR_BACKUP[tier];
    if (code === "or_bad_model" && tries === 0 && backup && model !== backup && !String(S.settings.customUnfilteredModel || "").trim()) { model = backup; continue; }
    throw { code, msg };
  }
  const reader = res.body.getReader(), dec = new TextDecoder(); let buf = "", text = "", fin = false, err = null, bad = false, checked = 0;
  try {
    while (!fin) {
      const { value, done } = await reader.read(); if (done) break;
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
  } catch (e) { throw { code: e.name === "AbortError" ? "cancelled" : "upstream_error", text }; }
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
function looseJSON(t) {
  try { return JSON.parse(t); } catch {}
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch {} }
  return undefined;
}
function errCopy(e) {
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
    case "session_expired": return "로그인이 만료됐어요. 페이지를 새로고침해 주세요.";
    case "sampling_disabled": case "capability_disabled": return "이 계정에서는 AI 호출이 꺼져 있어요.";
    default: return "응답을 받지 못했어요. 다시 시도해 주세요. 하트는 돌려드렸어요.";
  }
}
