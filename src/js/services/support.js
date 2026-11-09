/* 고객센터 서버(SUPPORT): 공지사항 읽기·쓰기, 문의 남기기·내 문의·받은 문의·답변 — Supabase REST(표 notices·inquiries·admins, docs/supabase.sql).
   공지는 로그인 없이도 읽음(anon은 published만), 문의는 로그인한 본인 것만 쓰고 읽음(RLS). 관리자(admins 표에 있는 계정)만 공지를 쓰고 모든 문의를 보고 답한다.
   관리자 여부는 서버가 정한다(RLS의 is_admin()) — 관리자 도구 화면은 버튼을 보여 줄 뿐, admins 표에 없는 계정이 쓰면 서버가 거부한다(denied).
   공지는 마지막으로 받은 목록을 이 기기(hv1_notices)에 두어, 서버에 닿지 않아도(오프라인·claude.ai 안) 본 적 있는 공지는 보여 줌 */
import { SB } from "./supabase.js";
/** @typedef {import("../core/types.js").Notice} Notice */
/** @typedef {import("../core/types.js").Inquiry} Inquiry */

/** 문의 분류 [값, 이름] — docs/supabase.sql inquiries.category 제약 안의 값. 'adult'(성인 모드)는 예전 문의 때문에 서버 제약에만 남김(화면에선 '기타'로 보임). 'report'는 메시지 신고(REPORT_CAT — 말풍선 메뉴에서 접수, 문의 폼에서도 고를 수 있음) */
export const ASK_CATS = [["account", "계정·로그인"], ["pay", "요금·하트"], ["chat", "대화·AI"], ["image", "그림"], ["bug", "오류 신고"], ["suggest", "제안"], ["report", "신고"], ["etc", "기타"]];
/** 메시지 신고의 분류 값 */
export const REPORT_CAT = "report";
/** 신고 사유 [값, 이름, 우선] — 운영정책 등급에 맞춘 출시판 목록(법률 초안 docs/legal/ui-copy.md §8, 2026-11-10 사용자 결정). 우선(true)인 사유는 가장 급하게 처리할 것: 받은 문의 목록 맨 위에 따로 보임 */
export const REPORT_REASONS = [["minor", "미성년자 관련 성적 내용", true], ["selfharm", "자해·자살 조장", true], ["hate", "혐오·괴롭힘"], ["illegal", "불법 정보"], ["privacy", "개인정보 노출"], ["error", "오류·이상한 응답"], ["etc", "기타"]];
/** 신고 제목 "[신고] 사유 — 작품"(100자) — 제목의 사유로 우선 신고를 가려내므로(urgentReport) 만드는 곳과 읽는 곳을 한데 둠. @param {string} reason 사유 이름 @param {string} work 작품 이름 @returns {string} */
export const reportTitle = (reason, work) => `[신고] ${reason} — ${work}`.slice(0, 100);
/** 신고인지(분류가 신고이거나, 서버 제약을 고치기 전에 '기타'로 받은 [신고] 제목) — 목록의 배지에. @param {{category?: string, title?: string}} a @returns {boolean} */
export const isReport = (a) => !!a && (a.category === REPORT_CAT || /^\[신고\]/.test(a.title || ""));
/** 우선 처리할 신고인지 — 사유가 우선 등급(미성년자 관련·자해·자살 조장). @param {{category?: string, title?: string}} a @returns {boolean} */
export const urgentReport = (a) => isReport(a) && REPORT_REASONS.some((r) => r[2] && String(a.title || "").indexOf(reportTitle(r[1], "")) === 0);
/** 문의 상태 이름 */
export const ASK_STATUS = { open: "답변 대기", answered: "답변 완료", closed: "종료" };
/** 앱 밖 문의(로그인하지 않았거나 서버가 없을 때) — privacy.html의 개인정보 보호책임자 이메일과 같음 */
export const SUPPORT_MAIL = "heartsyncchat@gmail.com";
export const ASK_DAILY = 5; // 하루 문의 수(서버 트리거 inquiries_guard와 같은 값 — 서버가 진짜로 막고 화면은 안내만)
const NOTICE_COLS = "id,title,body,pinned,published,created_at,updated_at";
const ASK_COLS = "id,user_id,category,title,body,reply_to,meta,status,answer,answered_at,created_at";
const CACHE = "hv1_notices";

// 서버 오류 → { code }: notable(표가 없음 — docs/supabase.sql을 아직 안 돌림) · denied(권한 — 관리자가 아니거나 로그인이 풀림) · limit(하루 문의 수) · check(표의 제약에 걸림 — 예: 서버가 아직 모르는 분류) · server
async function fail(r) {
  const j = await r.json().catch(() => ({})), c = String(j.code || ""), m = String(j.message || j.msg || "");
  if (c === "PGRST205" || c === "42P01" || r.status === 404) return { code: "notable" };
  if (/too_many_inquiries/.test(m)) return { code: "limit" };
  if (c === "23514") return { code: "check", msg: m.slice(0, 120) };
  if (c === "42501" || r.status === 401 || r.status === 403 || /row-level security|permission denied/i.test(m)) return { code: "denied" };
  return { code: "server", msg: m.slice(0, 120) || "HTTP " + r.status };
}
// 요청 하나: 서버가 없으면 off, 연결 실패는 net
async function call(path, opt) {
  if (!SB.on()) throw { code: "off" };
  let r; try { r = await SB.req(path, opt); } catch { throw { code: "net" }; }
  if (!r.ok) throw await fail(r);
  return r.status === 204 ? null : r.json().catch(() => null);
}
const uidOf = () => (SB.s && SB.s.user && SB.s.user.id) || "";
const rep = { Prefer: "return=representation" };

/** 오류 code → 안내 문구. @param {{code?: string, msg?: string}} e @returns {string} */
export function supportErr(e) {
  const c = e && e.code;
  if (c === "off") return "계정 서버에 연결되지 않은 곳이에요(claude.ai 안·서버 설정 없음).";
  if (c === "net") return "서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.";
  if (c === "notable") return "고객센터 표가 아직 없어요(운영자가 docs/supabase.sql을 실행해야 해요).";
  if (c === "limit") return `문의는 하루 ${ASK_DAILY}건까지 남길 수 있어요. 내일 다시 해 주세요.`;
  if (c === "denied") return "권한이 없어요. 로그인 상태를 확인해 주세요.";
  return "처리하지 못했어요" + (e && e.msg ? ": " + e.msg : ".");
}

/**
 * 고객센터 REST. notices() 공지 목록(고정 먼저·최신순) · saveNotice/dropNotice(관리자) · ask() 문의 남기기 · mine() 내 문의 · inbox()/answer()/dropAsk() 받은 문의(관리자) · amAdmin()/adminStatus()
 */
export const SUPPORT = {
  admin: null, // amAdmin() 결과(계정마다) { uid, yes }
  /** 마지막으로 받은 공지(이 기기). @returns {Notice[]} */
  cached() { try { const a = JSON.parse(localStorage.getItem(CACHE) || "[]"); return Array.isArray(a) ? a : []; } catch { return []; } },
  /** 공지 목록 — 고정 공지 먼저, 최신순 50개. 관리자에게는 비공개 공지도 옴(RLS). @returns {Promise<Notice[]>} @throws {{code: string}} */
  async notices() {
    const list = (await call(`/rest/v1/notices?select=${NOTICE_COLS}&order=pinned.desc,created_at.desc&limit=50`)) || [];
    try { localStorage.setItem(CACHE, JSON.stringify(list.filter((n) => n.published !== false).slice(0, 20))); } catch {}
    return list;
  },
  /** 공지 쓰기·고치기(관리자). id가 있으면 고침. @param {Partial<Notice>} n @returns {Promise<Notice>} @throws {{code: string}} */
  async saveNotice(n) {
    const body = { title: n.title, body: n.body || "", pinned: !!n.pinned, published: n.published !== false };
    const j = n.id ? await call(`/rest/v1/notices?id=eq.${+n.id}&select=${NOTICE_COLS}`, { method: "PATCH", headers: rep, body: JSON.stringify(body) })
      : await call(`/rest/v1/notices?select=${NOTICE_COLS}`, { method: "POST", headers: rep, body: JSON.stringify(body) });
    if (!Array.isArray(j) || !j.length) throw { code: "denied" }; // RLS에 걸린 PATCH는 오류 없이 0행
    return j[0];
  },
  /** 공지 지우기(관리자). @param {number} id @returns {Promise<void>} */
  async dropNotice(id) {
    const j = await call(`/rest/v1/notices?id=eq.${+id}&select=id`, { method: "DELETE", headers: rep });
    if (!Array.isArray(j) || !j.length) throw { code: "denied" };
  },
  /** 문의 남기기(로그인 필요). @param {{category: string, title: string, body: string, reply_to?: string, meta?: object|null}} a @returns {Promise<Inquiry>} @throws {{code: string}} */
  async ask(a) {
    if (!uidOf()) throw { code: "denied" };
    const body = { category: a.category, title: a.title, body: a.body, reply_to: a.reply_to || null, meta: a.meta || null };
    const j = await call(`/rest/v1/inquiries?select=${ASK_COLS}`, { method: "POST", headers: rep, body: JSON.stringify(body) });
    return Array.isArray(j) ? j[0] : j;
  },
  /**
   * 메시지 신고 — 문의 표에 '신고' 분류로(하루 문의 수에 같이 셈). 서버 제약이 아직 예전 것이면(분류 'report'를 모름 — docs/SETUP.md '메시지 신고 분류'의 SQL을 실행하기 전)
   * '기타'로 다시 보내 접수는 되게 함(제목의 [신고]로 구분 — isReport).
   * @param {{title: string, body: string}} a @returns {Promise<Inquiry>} @throws {{code: string}}
   */
  async report(a) {
    try { return await this.ask({ category: REPORT_CAT, title: a.title, body: a.body }); }
    catch (e) { if (!e || e.code !== "check") throw e; return this.ask({ category: "etc", title: a.title, body: a.body }); }
  },
  /** 내 문의(최신순 50개) — 관리자도 자기 것만(받은 문의는 inbox). @returns {Promise<Inquiry[]>} */
  async mine() {
    const u = uidOf(); if (!u) return [];
    return (await call(`/rest/v1/inquiries?select=${ASK_COLS}&user_id=eq.${encodeURIComponent(u)}&order=created_at.desc&limit=50`)) || [];
  },
  /** 내 문의 지우기. @param {number} id @returns {Promise<void>} */
  async dropAsk(id) {
    const j = await call(`/rest/v1/inquiries?id=eq.${+id}&select=id`, { method: "DELETE", headers: rep });
    if (!Array.isArray(j) || !j.length) throw { code: "denied" };
  },
  /** 받은 문의(관리자) — status를 주면 그 상태만, 최신순 100개. @param {string} [status] @returns {Promise<Inquiry[]>} */
  async inbox(status) {
    return (await call(`/rest/v1/inquiries?select=${ASK_COLS}${status ? "&status=eq." + encodeURIComponent(status) : ""}&order=created_at.desc&limit=100`)) || [];
  },
  /** 답변·상태 저장(관리자). 답을 쓰면 서버가 answered_at을 채우고 답변 대기를 답변 완료로 바꿈. @param {number} id @param {{answer?: string|null, status?: string}} p @returns {Promise<Inquiry>} */
  async answer(id, p) {
    const body = {}; if ("answer" in p) body.answer = p.answer || null; if (p.status) body.status = p.status;
    const j = await call(`/rest/v1/inquiries?id=eq.${+id}&select=${ASK_COLS}`, { method: "PATCH", headers: rep, body: JSON.stringify(body) });
    if (!Array.isArray(j) || !j.length) throw { code: "denied" };
    return j[0];
  },
  /**
   * 이 계정이 관리자인지(admins 표에 자기 행이 보이는지) — '모름'을 따로 돌려줌. 관리 화면을 바로 열지는 서버가 '예'라고 답했을 때만 정하도록.
   * 모름: 연결 실패·표가 없음·권한 오류·응답이 목록이 아님·묻는 사이 로그인이 풀리거나 계정이 바뀜(그 답은 물어본 계정에 대한 답이 아님).
   * '맞음'만 기억 — SQL Editor로 admins에 넣은 뒤 새로 고침 없이 바로 반영되게.
   * @returns {Promise<boolean|null>} 참·거짓은 서버의 답(로그인 안 했으면 거짓), null은 모름
   */
  async adminStatus() {
    const u = uidOf(); if (!u) return false;
    if (this.admin && this.admin.uid === u && this.admin.yes) return true;
    let j; try { j = await call(`/rest/v1/admins?select=user_id&user_id=eq.${encodeURIComponent(u)}`); } catch { return null; }
    if (!Array.isArray(j) || uidOf() !== u) return null;
    this.admin = { uid: u, yes: j.length > 0 };
    return this.admin.yes;
  },
  /** 이 계정이 관리자라고 확인됐는지(모르면 거짓). @returns {Promise<boolean>} */
  async amAdmin() { return (await this.adminStatus()) === true; }
};
