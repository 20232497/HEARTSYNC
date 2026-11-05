// @ts-nocheck — 의존성 없는 순수 JS(대시보드 편집기에 그대로 붙여 넣고, 단위 테스트가 Node에서 그대로 읽음)
// HEART SYNC 휴대폰 성인 인증 확인 — Supabase Edge Function "verify-adult". 올리는 순서는 docs/SETUP.md '휴대폰 성인 인증 설정'.
//
// 왜 서버인가: 인증 결과를 조회하는 PortOne API Secret은 브라우저(공개 저장소의 정적 사이트)에 둘 수 없고,
// 브라우저가 "인증했어요"라고 말하는 값은 믿을 수 없어서, 결과 확인과 기록은 여기서만 한다. 표 adult_checks는 앱이 읽기만 할 수 있음(docs/supabase.sql).
//
// 요청(POST, 로그인 토큰 필수):
//   { action: "start" }             → { id }  이 계정에 묶인 인증 번호를 만듦 — 브라우저는 이 번호로 인증창을 연다
//   { action: "confirm", id }       → { adult, test, checkedAt, expiresAt }  PortOne에 물어 판정하고 기록(이미 판정했으면 그 결과)
// 실패: { code } — login·bad_request·not_configured·no_table·too_many·not_yours·not_verified·no_birth·portone_auth·upstream
//
// 저장하는 것은 성인 여부·시각·만료일·시험 채널 여부뿐. PortOne이 돌려주는 이름·전화번호·생년월일·CI는 나이 판정에만 쓰고 저장·기록·응답하지 않는다.

const PORTONE_API = "https://api.portone.io";
const DAILY_STARTS = 10; // 계정마다 하루에 시작할 수 있는 인증 수(실제 채널은 건당 비용이 나감)
const ID_RE = /^hs[0-9a-f]{32}$/; // KCP가 영문·숫자 40자 이하만 받아서 하이픈 없이

export const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const out = (status, body) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const fail = (status, code) => { throw { status, code }; };

// 청소년보호법 제2조: 청소년은 만 19세 미만, 다만 만 19세가 되는 해의 1월 1일을 맞이한 사람은 제외 → 출생연도 + 19 ≤ 올해(한국 시각).
// 읽을 수 없는 생년월일은 null(성인으로 치지 않음)
export function isAdultBirth(birthDate, now = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(birthDate || ""));
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3], year = new Date(now.getTime() + 9 * 3600000).getUTCFullYear();
  if (y < 1900 || y > year || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return y + 19 <= year;
}

// 환경 변수의 새 키는 JSON 사전({ default: "sb_…" }), 예전 프로젝트는 SUPABASE_SERVICE_ROLE_KEY·SUPABASE_ANON_KEY
function pickKey(json) { try { const o = JSON.parse(json || "{}"); return o.default || Object.values(o)[0] || ""; } catch { return ""; } }
// 새 secret 키(sb_…)는 JWT가 아니라 apikey 칸으로만 보냄 — 사용자 토큰을 섞으면 RLS를 따르게 됨
const adminHeaders = (key) => (key.startsWith("sb_") ? { apikey: key } : { apikey: key, Authorization: "Bearer " + key });

/** 요청 하나를 처리. get(이름)은 환경 변수, f는 fetch(시험에서 바꿔 끼움), now는 지금 시각 */
export async function handle(req, get, f = fetch, now = () => new Date()) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return out(405, { code: "bad_request" });
  try {
    const base = String(get("SUPABASE_URL") || "").replace(/\/+$/, "");
    const secret = pickKey(get("SUPABASE_SECRET_KEYS")) || get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const publicKey = pickKey(get("SUPABASE_PUBLISHABLE_KEYS")) || get("SUPABASE_ANON_KEY") || secret;
    const apiSecret = get("PORTONE_API_SECRET") || "";
    if (!base || !secret || !apiSecret) fail(500, "not_configured");

    // 누구인지: 토큰을 인증 서버에 물어봄(토큰을 직접 풀지 않아 서명 키 교체와 상관없음)
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) fail(401, "login");
    const who = await f(base + "/auth/v1/user", { headers: { apikey: publicKey, Authorization: "Bearer " + token } });
    if (!who.ok) fail(401, "login");
    const uid = (await who.json().catch(() => ({}))).id;
    if (!uid) fail(401, "login");

    const db = async (path, opt = {}) => {
      const r = await f(base + "/rest/v1/adult_checks" + path, { ...opt, headers: { ...adminHeaders(secret), "Content-Type": "application/json", ...(opt.headers || {}) } });
      const j = await r.json().catch(() => null);
      if (!r.ok) { const noTable = r.status === 404 || (j && /PGRST205|42P01/.test(String(j.code))); fail(noTable ? 500 : 502, noTable ? "no_table" : "upstream"); }
      return j || [];
    };

    const body = await req.json().catch(() => ({}));
    if (body.action === "start") {
      const since = new Date(now().getTime() - 86400000).toISOString();
      const used = await db(`?select=id&user_id=eq.${uid}&created_at=gte.${encodeURIComponent(since)}`);
      if (used.length >= DAILY_STARTS) fail(429, "too_many");
      const id = "hs" + crypto.randomUUID().replace(/-/g, "");
      await db("", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ id, user_id: uid }) });
      return out(200, { id });
    }
    if (body.action !== "confirm" || !ID_RE.test(String(body.id || ""))) fail(400, "bad_request");

    // 이 계정이 만든 번호만 — 남의 인증 번호를 가져와 쓰지 못하게
    const [row] = await db(`?select=id,checked_at,adult,test,expires_at&id=eq.${body.id}&user_id=eq.${uid}`);
    if (!row) fail(404, "not_yours");
    const result = (x) => out(200, { adult: x.adult, test: x.test, checkedAt: x.checked_at, expiresAt: x.expires_at });
    if (row.checked_at) return result(row); // 창이 닫히며 두 번 불려도 같은 결과

    const qs = get("PORTONE_STORE_ID") ? "?storeId=" + encodeURIComponent(get("PORTONE_STORE_ID")) : "";
    const p = await f(`${PORTONE_API}/identity-verifications/${body.id}${qs}`, { headers: { Authorization: "PortOne " + apiSecret } });
    if (p.status === 401 || p.status === 403) fail(500, "portone_auth");
    if (p.status === 404) fail(409, "not_verified");
    if (!p.ok) fail(502, "upstream");
    const iv = await p.json().catch(() => ({}));
    if (iv.status !== "VERIFIED" || iv.id !== body.id) fail(409, "not_verified");
    const adult = isAdultBirth(iv.verifiedCustomer && iv.verifiedCustomer.birthDate, now());
    if (adult === null) fail(422, "no_birth");

    // 시험 채널은 통신사 확인 없이 통과하므로 표시해 둠 — 앱의 live 모드는 test 행을 인정하지 않음. 모르면 시험으로 침
    const test = !iv.channel || iv.channel.type !== "LIVE";
    const at = now(), until = new Date(at.getTime());
    until.setUTCFullYear(until.getUTCFullYear() + 1); // 시행령 제17조 제2항: 확인 후 1년까지 회원 확인으로 갈음
    const patch = { adult, test, checked_at: at.toISOString(), expires_at: adult ? until.toISOString() : null };
    const [saved] = await db(`?id=eq.${body.id}&user_id=eq.${uid}&checked_at=is.null`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(patch) });
    if (saved) return result(saved);
    const [again] = await db(`?select=id,checked_at,adult,test,expires_at&id=eq.${body.id}&user_id=eq.${uid}`); // 동시에 온 다른 요청이 먼저 기록함
    return result(again || patch);
  } catch (e) {
    if (e && e.code && e.status) return out(e.status, { code: e.code });
    return out(502, { code: "upstream" });
  }
}

if (typeof Deno !== "undefined") Deno.serve((req) => handle(req, (k) => Deno.env.get(k)));
