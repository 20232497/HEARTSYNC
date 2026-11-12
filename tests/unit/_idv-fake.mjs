// 시험 도우미(시험 목록에는 없음): 서버 쪽 함수(docs/edge/ — 휴대폰 성인 인증 verify-adult.ts · 대화 관문 chat.ts). 함수는 진짜 코드를 그대로 읽어 돌리고,
// 그 바깥(인증 서버·adult_checks 표·하루 한도 chat_usage·PortOne API·모델 서버)만 메모리로 흉내 낸다 — 표의 규칙은 docs/supabase.sql과 같음(앱은 본인 것 읽기만, 쓰기는 service 키만).
// 단위 테스트(tests/unit/verify-adult.test.mjs · chat-gate.test.mjs)가 쓴다. 실제 서버로는 아무것도 안 감.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const SB_URL = "https://mblvphojbmxiuqnlxisi.supabase.co";
export const A = "aaaaaaaa-0000-4000-8000-00000000000a",
  B = "bbbbbbbb-0000-4000-8000-00000000000b";
export const SECRET = "sb_secret_fake",
  PUBLISHABLE = "sb_publishable_fake",
  PORTONE_SECRET = "portone-secret-fake";
const edgeDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "docs", "edge");

/** 함수 파일을 그대로 불러옴(TS 문법 없이 쓴 파일이라 Node가 바로 읽음 — 어느 Node 버전에서나 되게 data: 주소로). */
export const loadEdge = (name = "verify-adult") =>
  import("data:text/javascript;base64," + fs.readFileSync(path.join(edgeDir, name + ".ts")).toString("base64"));

const res = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const PERSON = { name: "홍길동", phoneNumber: "01012345678", ci: "CI-VALUE", di: "DI-VALUE", gender: "MALE" };

export function fakeWorld(envOver = {}) {
  const env = {
    SUPABASE_URL: SB_URL,
    SUPABASE_SECRET_KEYS: JSON.stringify({ default: SECRET }),
    SUPABASE_PUBLISHABLE_KEYS: JSON.stringify({ default: PUBLISHABLE }),
    PORTONE_API_SECRET: PORTONE_SECRET,
    ...envOver
  };
  const w = {
    rows: [],
    calls: [],
    tokens: { tokA: A, tokB: B },
    noTable: false,
    // 대화 관문: 모델 서버가 돌려줄 것({ status, sse } · { throws: true }), 계정별 오늘 호출 수, 한도 함수가 없는 서버 흉내
    upstream: { status: 200, sse: 'data: {"choices":[{"delta":{"content":"안녕"}}]}\n\ndata: [DONE]\n\n' },
    usage: {},
    noUsage: false,
    modelCalls: () => w.calls.filter((c) => c.url.includes("openrouter.ai")),
    // 일반 트랙의 무료 길: Anthropic이 돌려줄 것({ status, sse })
    claude: {
      status: 200,
      sse: 'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"안녕"}}\n\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}\n\n'
    },
    claudeCalls: () => w.calls.filter((c) => c.url.includes("api.anthropic.com")),
    // PortOne이 돌려줄 값: { status, birthDate, type }(type 없으면 channel 칸도 없음) · { http: 숫자 } · { throws: true }
    portone: { status: "VERIFIED", birthDate: "1990-05-05", type: "TEST" },
    env: (k) => env[k],
    add(row) {
      const r = { created_at: new Date().toISOString(), checked_at: null, adult: null, test: null, expires_at: null, ...row };
      w.rows.push(r);
      return r;
    },
    portoneCalls: () => w.calls.filter((c) => c.url.includes("api.portone.io")),
    async fetch(url, opt = {}) {
      const u = new URL(url),
        h = new Headers(opt.headers || {}),
        m = opt.method || "GET";
      w.calls.push({ url: String(url), method: m, headers: Object.fromEntries(h), body: opt.body });
      const bearer = (h.get("authorization") || "").replace(/^Bearer\s+/i, "");
      if (u.host === "api.portone.io") {
        if (w.portone.throws) throw new TypeError("network");
        if (w.portone.http) return res(w.portone.http, { type: "ERROR" });
        if (h.get("authorization") !== "PortOne " + PORTONE_SECRET) return res(401, { type: "UNAUTHORIZED" });
        const id = decodeURIComponent(u.pathname.split("/").pop()),
          p = w.portone;
        return res(200, {
          status: p.status,
          id: p.id || id,
          ...(p.type ? { channel: { type: p.type, pgProvider: "PG_PROVIDER_KCP_V2", pgMerchantId: "AO6R1" } } : {}),
          ...(p.status === "VERIFIED" ? { verifiedCustomer: { ...PERSON, ...(p.birthDate ? { birthDate: p.birthDate } : {}) } } : {})
        });
      }
      if (u.host === "openrouter.ai") {
        if (w.upstream.throws) throw new TypeError("network");
        if (w.upstream.status !== 200) return res(w.upstream.status, { error: { message: "x" } });
        return new Response(w.upstream.sse, { status: 200, headers: { "Content-Type": "text/event-stream" } });
      }
      if (u.host === "api.anthropic.com") {
        if (w.claude.status !== 200) return res(w.claude.status, { type: "error", error: { message: "x" } });
        return new Response(w.claude.sse, { status: 200, headers: { "Content-Type": "text/event-stream" } });
      }
      if (u.pathname === "/rest/v1/rpc/bump_chat_usage") {
        // service 키만 부를 수 있음(docs/supabase.sql의 grant)
        if (w.noUsage) return res(404, { code: "PGRST202", message: "Could not find the function" });
        if (![SECRET, env.SUPABASE_SERVICE_ROLE_KEY].includes(h.get("apikey")) || w.tokens[bearer])
          return res(403, { code: "42501", message: "permission denied" });
        const b = JSON.parse(opt.body || "{}"),
          k = b.uid + "/" + b.tr; // 계정·트랙마다 따로 셈
        return res(200, (w.usage[k] = (w.usage[k] || 0) + 1));
      }
      if (u.pathname === "/auth/v1/user") {
        if (![PUBLISHABLE, SECRET, env.SUPABASE_SERVICE_ROLE_KEY].includes(h.get("apikey")) || !w.tokens[bearer]) return res(401, { msg: "invalid token" });
        return res(200, { id: w.tokens[bearer], email: "x@example.test" });
      }
      if (u.pathname === "/rest/v1/adult_checks") {
        if (w.noTable) return res(404, { code: "PGRST205", message: "Could not find the table" });
        const service = [SECRET, env.SUPABASE_SERVICE_ROLE_KEY].includes(h.get("apikey")) && !w.tokens[bearer],
          uid = w.tokens[bearer];
        if (!service && !uid) return res(401, { code: "42501", message: "permission denied" });
        if (!service && m !== "GET") return res(403, { code: "42501", message: "permission denied" }); // 앱에는 쓰기 권한이 없음
        const pass = (r) => {
          for (const [k, v] of u.searchParams) {
            if (["select", "order", "limit"].includes(k)) continue;
            if (v.startsWith("eq.") && String(r[k]) !== v.slice(3)) return false;
            if (v.startsWith("gte.") && !(Date.parse(r[k]) >= Date.parse(v.slice(4)))) return false;
            if (v === "is.null" && r[k] !== null) return false;
            if (v === "not.is.null" && r[k] === null) return false;
          }
          return true;
        };
        let hit = w.rows.filter((r) => (service || r.user_id === uid) && pass(r));
        const show = (r) => {
          const s = u.searchParams.get("select");
          return s ? Object.fromEntries(s.split(",").map((k) => [k, r[k]])) : { ...r };
        };
        if (m === "GET") {
          if ((u.searchParams.get("order") || "").startsWith("checked_at.desc"))
            hit = [...hit].sort((a, b) => Date.parse(b.checked_at) - Date.parse(a.checked_at));
          return res(200, hit.slice(0, +u.searchParams.get("limit") || undefined).map(show));
        }
        const body = JSON.parse(opt.body || "{}");
        if (m === "POST") {
          w.add(body);
          return new Response(null, { status: 201 });
        }
        if (m === "PATCH") {
          hit.forEach((r) => Object.assign(r, body));
          return res(200, /representation/.test(h.get("prefer") || "") ? hit.map((r) => ({ ...r })) : []);
        }
      }
      return res(404, { code: "NOT_FOUND" });
    }
  };
  return w;
}
