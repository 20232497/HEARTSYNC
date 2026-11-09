// @ts-nocheck — 의존성 없는 순수 JS(대시보드 편집기에 그대로 붙여 넣고, 단위 테스트가 Node에서 그대로 읽음)
// HEART SYNC 대화 관문 — Supabase Edge Function "chat". 성인 트랙 대화의 서버 쪽. 올리는 순서는 docs/SETUP.md '대화 관문 설정'.
//
// 왜 서버인가: 성인 트랙은 ① 외부 모델 키(OpenRouter)를 브라우저에 둘 수 없고 ② 성인 인증·미성년 판정을 브라우저가 하면 콘솔로 넘어갈 수 있어서,
// 판정과 모델 호출을 여기서만 한다. 일반 트랙(Claude)은 이 관문을 거치지 않는다 — 한 방은 한 트랙으로만 가고 서로 넘나들지 않는다(src/js/ai/models.js trackOf).
//
// 요청(POST, 로그인 토큰 필수): { track: "adult", tier: "quick"|"default"|"complex", max_tokens, messages: [{ role: "system", … }, { role: "user"|"assistant", … }] }
// 응답: 모델의 OpenAI 호환 스트림(text/event-stream)을 그대로 중계. 실패는 JSON { code } —
//   login · bad_request · adult_required · minor_blocked · too_many · rate_limited · not_configured · no_table · upstream
//
// 차례: 로그인 확인 → 요청 모양 → 성인 인증(adult_checks — verify-adult.ts가 쓴 것) → 미성년 암시(앱과 같은 함수) → 하루 한도(chat_usage) → 모델 호출.
// 대화 내용은 저장·기록하지 않는다(남는 것은 계정별 하루 호출 수뿐). 모델 이름과 성인 트랙 머리말은 코드가 아니라 환경 변수에 둔다(공개 저장소에 두지 않음):
//   OPENROUTER_API_KEY · CHAT_MODELS '{"adult":{"quick":"…","default":"…","complex":"…"}}'(값은 모델 이름, 또는 그 모델만의 생각 설정을 붙인 {"model":"…","reasoning":{…}})
//   · CHAT_PREAMBLE_ADULT(선택) · CHAT_DAILY_LIMIT(기본 300) · CHAT_ALLOW_TEST_IDV(시험 채널 인증도 인정하려면 "1")

const UPSTREAM = "https://openrouter.ai/api/v1/chat/completions";
const ROLES = ["system", "user", "assistant"], TIERS = ["quick", "default", "complex"];
const MAX_MESSAGES = 200, MAX_CHARS = 600000; // 요청 하나의 크기 한도(기억력 40턴 + 시스템 글보다 넉넉하게)

export const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const out = (status, body) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const fail = (status, code) => { throw { status, code }; };

// 환경 변수의 새 키는 JSON 사전({ default: "sb_…" }), 예전 프로젝트는 SUPABASE_SERVICE_ROLE_KEY·SUPABASE_ANON_KEY
function pickKey(json) { try { const o = JSON.parse(json || "{}"); return o.default || Object.values(o)[0] || ""; } catch { return ""; } }
// 새 secret 키(sb_…)는 JWT가 아니라 apikey 칸으로만 보냄 — 사용자 토큰을 섞으면 RLS를 따르게 됨
const adminHeaders = (key) => (key.startsWith("sb_") ? { apikey: key } : { apikey: key, Authorization: "Bearer " + key });

/**
 * 요청 하나를 처리. get(이름)은 환경 변수, f는 fetch(시험에서 바꿔 끼움), now는 지금 시각,
 * screen(messages)은 미성년 암시 판정(앱의 core/safety.js messagesMinorHint) — 넘기지 않으면 모든 요청을 막는다(판정 없이 통과시키지 않음)
 */
export async function handle(req, get, f = fetch, now = () => new Date(), screen = () => true) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return out(405, { code: "bad_request" });
  try {
    const base = String(get("SUPABASE_URL") || "").replace(/\/+$/, "");
    const secret = pickKey(get("SUPABASE_SECRET_KEYS")) || get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const publicKey = pickKey(get("SUPABASE_PUBLISHABLE_KEYS")) || get("SUPABASE_ANON_KEY") || secret;
    const modelKey = get("OPENROUTER_API_KEY") || "";
    let models = {}; try { models = (JSON.parse(get("CHAT_MODELS") || "{}") || {}).adult || {}; } catch {}
    if (!base || !secret || !modelKey) fail(500, "not_configured");

    // 누구인지: 토큰을 인증 서버에 물어봄(토큰을 직접 풀지 않아 서명 키 교체와 상관없음)
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) fail(401, "login");
    const who = await f(base + "/auth/v1/user", { headers: { apikey: publicKey, Authorization: "Bearer " + token } });
    if (!who.ok) fail(401, "login");
    const uid = (await who.json().catch(() => ({}))).id;
    if (!uid) fail(401, "login");

    // 요청 모양: 이 관문은 성인 트랙만 받는다(일반 트랙을 이쪽 모델로 돌리는 길을 두지 않음)
    const body = await req.json().catch(() => ({}));
    const msgs = body.messages;
    if (body.track !== "adult" || !TIERS.includes(body.tier) || !Array.isArray(msgs) || msgs.length < 2 || msgs.length > MAX_MESSAGES) fail(400, "bad_request");
    if (!msgs.every((m) => m && ROLES.includes(m.role) && typeof m.content === "string") || msgs[0].role !== "system" || msgs.slice(1).some((m) => m.role === "system")) fail(400, "bad_request");
    if (msgs.reduce((n, m) => n + m.content.length, 0) > MAX_CHARS) fail(400, "bad_request");
    const entry = typeof models[body.tier] === "string" ? { model: models[body.tier] } : models[body.tier] || {};
    const model = typeof entry.model === "string" ? entry.model : "";
    if (!model) fail(500, "not_configured");
    const maxTokens = Math.min(8000, Math.max(256, Math.floor(+body.max_tokens) || 2000));

    const db = async (path, opt = {}) => {
      const r = await f(base + "/rest/v1/" + path, { ...opt, headers: { ...adminHeaders(secret), "Content-Type": "application/json", ...(opt.headers || {}) } });
      const j = await r.json().catch(() => null);
      if (!r.ok) { const missing = r.status === 404 || (j && /PGRST20[25]|42P01|42883/.test(String(j.code))); fail(missing ? 500 : 502, missing ? "no_table" : "upstream"); }
      return j;
    };

    // 성인 인증: 휴대폰 인증으로 성인 판정을 받았고 아직 만료되지 않은 계정만. 시험 채널(통신사 확인 없음)의 결과는 따로 켜야 인정
    const at = now().getTime(), allowTest = get("CHAT_ALLOW_TEST_IDV") === "1";
    const checks = (await db(`adult_checks?select=adult,test,expires_at&user_id=eq.${encodeURIComponent(uid)}&adult=eq.true&order=checked_at.desc&limit=5`)) || [];
    if (!checks.some((c) => c.adult === true && Date.parse(c.expires_at) > at && (!c.test || allowTest))) fail(403, "adult_required");

    // 미성년(또는 미성년으로 보이는) 인물·표현이 있으면 성인 트랙으로 보내지 않음 — 판정이 오류를 내도 막는 쪽
    let flagged = true; try { flagged = !!screen(msgs); } catch {}
    if (flagged) fail(422, "minor_blocked");

    // 하루 한도: 회사 키로 부르는 호출이라 계정마다 하루 호출 수를 셈(본문·요약·추천 모두 1회) — 나중의 서버 원장이 이 자리를 대신함
    const limit = Math.max(1, Math.floor(+get("CHAT_DAILY_LIMIT")) || 300);
    const used = await db("rpc/bump_chat_usage", { method: "POST", body: JSON.stringify({ uid }) });
    if (typeof used !== "number") fail(502, "upstream");
    if (used > limit) fail(429, "too_many");

    // 성인 트랙 머리말(운영자가 비공개로 넣는 글)은 시스템 글 맨 앞에. 사용자 토큰·계정 정보는 모델 쪽으로 보내지 않음
    const pre = String(get("CHAT_PREAMBLE_ADULT") || "").trim();
    const send = [{ role: "system", content: (pre ? pre + "\n\n" : "") + msgs[0].content }, ...msgs.slice(1).map((m) => ({ role: m.role, content: m.content }))];
    // 생각(reasoning) 토큰도 출력 한도에서 빠져, 그대로 두면 한도를 생각에 다 쓰고 본문 없이 끝나는 모델이 있음(2026-11-09 시험).
    // 기본은 '낮게' — '끄기'는 생각을 끌 수 없는 모델에서 400이 나고, '낮게'는 시험한 후보 모두가 받음. 그래도 한도를 다 쓰는 모델이 있어 모델마다 CHAT_MODELS의 reasoning으로 바꿈
    const reasoning = entry.reasoning && typeof entry.reasoning === "object" ? entry.reasoning : { effort: "low" };
    let up;
    try {
      up = await f(UPSTREAM, { method: "POST", signal: req.signal, headers: { Authorization: "Bearer " + modelKey, "Content-Type": "application/json" },
        // data_collection deny: 입력을 학습·보관하는 제공자를 빼고 고름(맞는 제공자가 없으면 404 → not_configured)
        body: JSON.stringify({ model, messages: send, max_tokens: maxTokens, stream: true, reasoning, provider: { data_collection: "deny" } }) });
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
