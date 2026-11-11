// @ts-nocheck — 의존성 없는 순수 JS(대시보드 편집기에 그대로 붙여 넣고, 단위 테스트가 Node에서 그대로 읽음)
// HEART SYNC 대화 관문 — Supabase Edge Function "chat". 회사 키로 모델을 부르는 대화의 서버 쪽. 올리는 순서는 docs/SETUP.md '대화 관문 설정'.
//
// 두 길(한 방은 한 트랙으로만 — src/js/ai/models.js trackOf):
//   일반 트랙의 무료 길: API 키가 없는 로그인 이용자가 무료 모델(Claude — Anthropic)로 대화. 서버 설정에 있는 등급만 받고, 나머지 등급은 need_key(자기 키로)
//   성인 트랙: 외부 모델(OpenRouter). 성인 인증·미성년 판정을 브라우저가 하면 콘솔로 넘어갈 수 있어 여기서만 판정
// 두 길은 서로 넘나들지 않는다 — 성인 트랙 요청을 Anthropic으로, 일반 트랙 요청을 외부 모델로 보내는 길은 없다.
//
// 요청(POST, 로그인 토큰 필수): { track: "general"|"adult", tier: "quick"|"default"|"complex", max_tokens, messages: [{ role: "system", … }, { role: "user"|"assistant", … }], cache_prefix? }
//   cache_prefix(선택, 일반 트랙만): 시스템 글 앞에서부터 몇 글자가 턴마다 같은 '고정부'인지 — 그 끝에 프롬프트 캐시 표시를 붙여 Anthropic에 블록 둘로 보냄(앱의 ai/llm.js와 같은 모양). 없거나 범위 밖이면 글 하나로
// 응답: 모델의 스트림(text/event-stream)을 그대로 중계 — 일반은 Anthropic Messages 모양, 성인은 OpenAI 호환 모양. 실패는 JSON { code } —
//   login · bad_request · need_key · adult_required · minor_blocked · too_many · rate_limited · not_configured · no_table · upstream
//
// 차례: 로그인 확인 → 요청 모양 → (성인만) 성인 인증(adult_checks — verify-adult.ts가 쓴 것) → (성인만) 미성년 암시(앱과 같은 함수) → 하루 한도(chat_usage, 트랙마다 따로) → 모델 호출.
// 대화 내용은 저장·기록하지 않는다(남는 것은 계정·날짜·트랙별 호출 수뿐). 모델 이름과 성인 트랙 머리말은 코드가 아니라 환경 변수에 둔다(공개 저장소에 두지 않음):
//   CHAT_MODELS '{"general":{"quick":"…"},"adult":{"quick":"…","default":"…","complex":"…"}}'(값은 모델 이름, 성인 트랙은 그 모델만의 생각 설정을 붙인 {"model":"…","reasoning":{…}}도)
//   · 일반: ANTHROPIC_API_KEY · CHAT_FREE_DAILY_LIMIT(기본 80 — 무료 10턴에 요약·추천·다시 쓰기를 더한 넉넉한 상한). 생각 설정은 환경 변수가 아니라 아래 THINK(앱과 같은 값)
//   · 성인: OPENROUTER_API_KEY · CHAT_PREAMBLE_ADULT(선택) · CHAT_DAILY_LIMIT(기본 300) · CHAT_ALLOW_TEST_IDV(시험 채널 인증도 인정하려면 "1")

const OPENROUTER = "https://openrouter.ai/api/v1/chat/completions", ANTHROPIC = "https://api.anthropic.com/v1/messages";
const ROLES = ["system", "user", "assistant"], TIERS = ["quick", "default", "complex"], TRACKS = ["general", "adult"];
const MAX_MESSAGES = 200, MAX_CHARS = 600000; // 요청 하나의 크기 한도(기억력 40턴 + 시스템 글보다 넉넉하게)
// 일반 트랙(Claude)의 생각 설정: 이 세대 Claude는 생각이 기본으로 켜져 있고 생각 토큰도 max_tokens에서 빠짐 — 그대로 두면 본문이 한도에 잘려 상태창이 빠짐.
// 앱이 자기 키로 부를 때(src/js/ai/llm.js THINKING)와 같은 값이어야 함(단위 시험 chat-gate가 두 값이 같은지 봄): 대화는 effort low,
// room은 생각 몫으로 출력 한도에 더하는 토큰(쓰지 않은 만큼은 과금 없음). 앱은 관문에 room을 뺀 값(본문 몫)만 보냄
const THINK = { effort: "low", room: 2000 };

export const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const out = (status, body) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const fail = (status, code) => { throw { status, code }; };

// 환경 변수의 새 키는 JSON 사전({ default: "sb_…" }), 예전 프로젝트는 SUPABASE_SERVICE_ROLE_KEY·SUPABASE_ANON_KEY
function pickKey(json) { try { const o = JSON.parse(json || "{}"); return o.default || Object.values(o)[0] || ""; } catch { return ""; } }
// 새 secret 키(sb_…)는 JWT가 아니라 apikey 칸으로만 보냄 — 사용자 토큰을 섞으면 RLS를 따르게 됨
const adminHeaders = (key) => (key.startsWith("sb_") ? { apikey: key } : { apikey: key, Authorization: "Bearer " + key });

/**
 * 요청 하나를 처리. get(이름)은 환경 변수, f는 fetch(시험에서 바꿔 끼움), now는 지금 시각,
 * screen(messages)은 미성년 암시 판정(앱의 core/safety.js messagesMinorHint) — 넘기지 않으면 성인 트랙 요청을 모두 막는다(판정 없이 통과시키지 않음)
 */
export async function handle(req, get, f = fetch, now = () => new Date(), screen = () => true) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return out(405, { code: "bad_request" });
  try {
    const base = String(get("SUPABASE_URL") || "").replace(/\/+$/, "");
    const secret = pickKey(get("SUPABASE_SECRET_KEYS")) || get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const publicKey = pickKey(get("SUPABASE_PUBLISHABLE_KEYS")) || get("SUPABASE_ANON_KEY") || secret;
    let table = {}; try { table = JSON.parse(get("CHAT_MODELS") || "{}") || {}; } catch {}
    if (!base || !secret) fail(500, "not_configured");

    // 누구인지: 토큰을 인증 서버에 물어봄(토큰을 직접 풀지 않아 서명 키 교체와 상관없음)
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) fail(401, "login");
    const who = await f(base + "/auth/v1/user", { headers: { apikey: publicKey, Authorization: "Bearer " + token } });
    if (!who.ok) fail(401, "login");
    const uid = (await who.json().catch(() => ({}))).id;
    if (!uid) fail(401, "login");

    // 요청 모양
    const body = await req.json().catch(() => ({}));
    const msgs = body.messages, track = body.track, adult = track === "adult";
    if (!TRACKS.includes(track) || !TIERS.includes(body.tier) || !Array.isArray(msgs) || msgs.length < 2 || msgs.length > MAX_MESSAGES) fail(400, "bad_request");
    if (!msgs.every((m) => m && ROLES.includes(m.role) && typeof m.content === "string") || msgs[0].role !== "system" || msgs.slice(1).some((m) => m.role === "system")) fail(400, "bad_request");
    if (msgs.reduce((n, m) => n + m.content.length, 0) > MAX_CHARS) fail(400, "bad_request");
    // 그 트랙의 모델 표와 키. 일반 트랙은 표에 있는 등급(무료 모델)만 — 없는 등급은 이용자가 자기 키로 써야 함(need_key)
    const models = table[track] && typeof table[track] === "object" ? table[track] : null, modelKey = get(adult ? "OPENROUTER_API_KEY" : "ANTHROPIC_API_KEY") || "";
    if (!models || !modelKey) fail(500, "not_configured");
    const entry = typeof models[body.tier] === "string" ? { model: models[body.tier] } : models[body.tier] || {};
    const model = typeof entry.model === "string" ? entry.model : "";
    if (!model) fail(adult ? 500 : 403, adult ? "not_configured" : "need_key");
    const maxTokens = Math.min(8000, Math.max(256, Math.floor(+body.max_tokens) || 2000));

    const db = async (path, opt = {}) => {
      const r = await f(base + "/rest/v1/" + path, { ...opt, headers: { ...adminHeaders(secret), "Content-Type": "application/json", ...(opt.headers || {}) } });
      const j = await r.json().catch(() => null);
      if (!r.ok) { const missing = r.status === 404 || (j && /PGRST20[25]|42P01|42883/.test(String(j.code))); fail(missing ? 500 : 502, missing ? "no_table" : "upstream"); }
      return j;
    };

    if (adult) {
      // 성인 인증: 휴대폰 인증으로 성인 판정을 받았고 아직 만료되지 않은 계정만. 시험 채널(통신사 확인 없음)의 결과는 따로 켜야 인정
      const at = now().getTime(), allowTest = get("CHAT_ALLOW_TEST_IDV") === "1";
      const checks = (await db(`adult_checks?select=adult,test,expires_at&user_id=eq.${encodeURIComponent(uid)}&adult=eq.true&order=checked_at.desc&limit=5`)) || [];
      if (!checks.some((c) => c.adult === true && Date.parse(c.expires_at) > at && (!c.test || allowTest))) fail(403, "adult_required");
      // 미성년(또는 미성년으로 보이는) 인물·표현이 있으면 성인 트랙으로 보내지 않음 — 판정이 오류를 내도 막는 쪽
      let flagged = true; try { flagged = !!screen(msgs); } catch {}
      if (flagged) fail(422, "minor_blocked");
    }

    // 하루 한도: 회사 키로 부르는 호출이라 계정마다 트랙별로 하루 호출 수를 셈(본문·요약·추천 모두 1회) — 나중의 서버 원장이 이 자리를 대신함
    const limit = Math.max(1, Math.floor(+get(adult ? "CHAT_DAILY_LIMIT" : "CHAT_FREE_DAILY_LIMIT")) || (adult ? 300 : 80));
    const used = await db("rpc/bump_chat_usage", { method: "POST", body: JSON.stringify({ uid, tr: track }) });
    if (typeof used !== "number") fail(502, "upstream");
    if (used > limit) fail(429, "too_many");

    // 사용자 토큰·계정 정보는 모델 쪽으로 보내지 않음
    const rest = msgs.slice(1).map((m) => ({ role: m.role, content: m.content }));
    let up;
    try {
      if (adult) {
        // 성인 트랙 머리말(운영자가 비공개로 넣는 글)은 시스템 글 맨 앞에
        const pre = String(get("CHAT_PREAMBLE_ADULT") || "").trim();
        // 생각(reasoning) 토큰도 출력 한도에서 빠져, 그대로 두면 한도를 생각에 다 쓰고 본문 없이 끝나는 모델이 있음(2026-11-09 시험).
        // 기본은 '낮게' — '끄기'는 생각을 끌 수 없는 모델에서 400이 나고, '낮게'는 시험한 후보 모두가 받음. 그래도 한도를 다 쓰는 모델이 있어 모델마다 CHAT_MODELS의 reasoning으로 바꿈
        const reasoning = entry.reasoning && typeof entry.reasoning === "object" ? entry.reasoning : { effort: "low" };
        up = await f(OPENROUTER, { method: "POST", signal: req.signal, headers: { Authorization: "Bearer " + modelKey, "Content-Type": "application/json" },
          // data_collection deny: 입력을 학습·보관하는 제공자를 빼고 고름(맞는 제공자가 없으면 404 → not_configured)
          body: JSON.stringify({ model, messages: [{ role: "system", content: (pre ? pre + "\n\n" : "") + msgs[0].content }, ...rest], max_tokens: maxTokens, stream: true, reasoning, provider: { data_collection: "deny" } }) });
      } else {
        // 일반 트랙: 앱이 자기 키로 부를 때와 같은 Anthropic Messages 요청(머리말 없음, 생각 설정 THINK도 앱과 같은 값) — 키만 회사 것
        // 프롬프트 캐싱: cache_prefix가 시스템 글 안쪽을 가리키면 고정부(캐시 표시) + 나머지 블록 둘로
        const sysText = msgs[0].content, cut = Number.isInteger(body.cache_prefix) && body.cache_prefix > 0 && body.cache_prefix < sysText.length ? body.cache_prefix : 0;
        const system = cut ? [{ type: "text", text: sysText.slice(0, cut), cache_control: { type: "ephemeral" } }, { type: "text", text: sysText.slice(cut) }] : sysText;
        up = await f(ANTHROPIC, { method: "POST", signal: req.signal, headers: { "x-api-key": modelKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
          body: JSON.stringify({ model, max_tokens: maxTokens + THINK.room, output_config: { effort: THINK.effort }, stream: true, system, messages: rest }) });
      }
    } catch { fail(502, "upstream"); }
    if (up.status === 429) fail(429, "rate_limited");
    if ([401, 403, 404].includes(up.status)) fail(500, "not_configured"); // 키가 틀렸거나, 그 모델·제공자를 쓸 수 없음
    if (!up.ok || !up.body) fail(502, "upstream");
    return new Response(up.body, { status: 200, headers: { ...CORS, "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache" } });
  } catch (e) {
    if (e && e.code && e.status) return out(e.status, { code: e.code });
    return out(502, { code: "upstream" });
  }
}

if (typeof Deno !== "undefined") {
  // 미성년 판정은 앱과 같은 함수를 씀 — 배포된 사이트의 src/js/core/safety.js(아무것도 import하지 않는 순수 모듈)를 그대로 가져옴. 못 가져오면 함수가 뜨지 않음(막는 쪽)
  const { messagesMinorHint } = await import("https://20232497.github.io/HEARTSYNC/src/js/core/safety.js");
  Deno.serve((req) => handle(req, (k) => Deno.env.get(k), fetch, () => new Date(), messagesMinorHint));
}
