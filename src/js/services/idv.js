/* 휴대폰 성인 인증(IDV): 인증 결과 읽기·이 기기 캐시, PortOne 인증창 열기, 결과 확인 요청.
   브라우저는 창만 연다 — 결과를 조회하는 API Secret은 Edge Function(docs/edge/verify-adult.ts)에만 있고, 표 adult_checks는 앱이 읽기만 할 수 있어서 자기 결과를 꾸며 넣지 못한다.
   단, 지금은 AI를 브라우저에서 사용자 키로 부르므로 이 판정(ai/adult.js ageOK)도 브라우저 안의 일 — 콘솔을 고치면 넘어갈 수 있고, 서버가 AI를 부르는 단계에서 서버 판정으로 옮겨야 진짜 관문이 됨(docs/ROADMAP.md).
   CFG.idv.mode가 off면(기본) 아무 요청도 하지 않고 자기 확인을 그대로 쓴다. SDK(cdn.portone.io)는 '인증' 버튼을 눌렀을 때만 불러온다 — 외부 리소스 규칙의 예외(CLAUDE.md) */
import { CFG, idvOn } from "../core/config.js";
import { emit, on } from "../core/events.js";
import { S } from "../core/state.js";
import { SB } from "./supabase.js";
/** @typedef {import("../core/types.js").IdvRecord} IdvRecord */

const IDV_FN = "/functions/v1/verify-adult", IDV_SDK = "https://cdn.portone.io/v2/browser-sdk.js";
// 판정이 끝난 것 중 가장 최근 하나 — 나중 결과가 미성년이면 예전 통과를 덮음
const IDV_ROWS = "/rest/v1/adult_checks?select=adult,test,checked_at,expires_at&checked_at=not.is.null&order=checked_at.desc&limit=1";
const NOT_READY = "인증 서버가 아직 준비되지 않았어요. 잠시 뒤 다시 해 주세요.";
const IDV_MSG = {
  net: "서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.",
  login: "로그인이 풀렸어요. 다시 로그인해 주세요.",
  no_function: NOT_READY, not_configured: NOT_READY, no_table: NOT_READY, portone_auth: NOT_READY,
  too_many: "인증은 하루 10번까지 시도할 수 있어요. 내일 다시 해 주세요.",
  not_verified: "인증이 끝나지 않았어요. 다시 시도해 주세요.",
  no_birth: "인증 기관에서 생년월일을 받지 못했어요. 다시 시도해 주세요.",
  not_yours: "이 계정에서 시작한 인증이 아니에요. 다시 시도해 주세요.",
  sdk: "인증창을 불러오지 못했어요. 인터넷 연결이나 광고 차단 설정을 확인해 주세요."
};
/** 오류 → 안내 문구. @param {{ code?: string, msg?: string }} e @returns {string} */
export const idvMsg = (e) => (e && e.msg) || IDV_MSG[e && e.code] || "인증을 마치지 못했어요. 잠시 뒤 다시 해 주세요.";

function loadPortOne() {
  if (window.PortOne) return Promise.resolve(window.PortOne);
  return new Promise((ok, no) => {
    const s = document.createElement("script"); s.src = IDV_SDK;
    s.onload = () => (window.PortOne ? ok(window.PortOne) : no({ code: "sdk" }));
    s.onerror = () => no({ code: "sdk" });
    document.head.appendChild(s);
  });
}
const idvRec = (uid, x) => ({ uid, adult: x.adult === true, test: x.test !== false, at: Date.parse(x.checked_at) || 0, until: Date.parse(x.expires_at) || 0 });

/** 휴대폰 성인 인증 상태·요청. 지금 결과는 S.idv(로그인한 계정 것만 — 로그아웃·계정 바뀜은 "session" 이벤트로 맞춤), 바뀌면 emit("idv"). */
export const IDV = {
  busy: false, seq: 0,
  cacheKey(uid) { return "hv1_idv_" + uid; },
  /** 이 기기에 둔 지난 결과를 읽음(서버에 닿기 전·오프라인에도 판정할 수 있게 — 곧 refresh가 서버 값으로 덮음). @returns {void} */
  load() {
    S.idv = null;
    const uid = SB.s && SB.s.user && SB.s.user.id;
    if (!idvOn() || !uid) return;
    try { const v = JSON.parse(localStorage.getItem(this.cacheKey(uid)) || "null"); if (v && v.uid === uid) S.idv = v; } catch {}
  },
  /** @param {IdvRecord|null} rec @param {string} uid @returns {void} */
  keep(rec, uid) {
    S.idv = rec;
    try { if (rec) localStorage.setItem(this.cacheKey(uid), JSON.stringify(rec)); else localStorage.removeItem(this.cacheKey(uid)); } catch {}
    emit("idv");
  },
  /** 서버의 결과로 맞춤 — 못 닿으면 이 기기 값을 그대로 둠. @returns {Promise<void>} */
  async refresh() {
    const uid = SB.s && SB.s.user && SB.s.user.id, seq = this.seq;
    if (!idvOn() || !SB.on() || !uid) return;
    let rows;
    try { const r = await SB.req(IDV_ROWS); if (!r.ok) return; rows = await r.json(); } catch { return; }
    // 그사이 로그아웃·계정이 바뀌었거나, 방금 끝난 인증이 더 새 값이면 버림
    if (!Array.isArray(rows) || seq !== this.seq || !SB.s || SB.s.user.id !== uid) return;
    this.keep(rows[0] ? idvRec(uid, rows[0]) : null, uid);
  },
  async call(body) {
    let r;
    try { r = await SB.req(IDV_FN, { method: "POST", body: JSON.stringify(body) }); } catch { throw { code: "net" }; }
    const j = await r.json().catch(() => ({}));
    if (r.ok) return j;
    throw { code: IDV_MSG[j.code] ? j.code : r.status === 404 ? "no_function" : r.status === 401 ? "login" : "upstream" };
  },
  /** 인증 번호로 서버에 판정을 맡기고 결과를 둠. @param {string} id @returns {Promise<IdvRecord>} */
  async confirm(id) {
    const uid = SB.s.user.id, j = await this.call({ action: "confirm", id });
    this.seq++;
    const rec = idvRec(uid, { adult: j.adult, test: j.test, checked_at: j.checkedAt, expires_at: j.expiresAt });
    this.keep(rec, uid);
    return rec;
  },
  /**
   * 인증창을 열고 끝까지. PC는 창이 닫히면 이어지고, 휴대폰은 redirectUrl로 페이지째 떠났다가 돌아옴(fromUrl) — 그때는 끝나지 않는 Promise.
   * @returns {Promise<IdvRecord|null>} 결과(이미 진행 중이면 null) @throws {{ code?: string, msg?: string }}
   */
  async run() {
    if (this.busy) return null;
    this.busy = true; emit("idv");
    try {
      const { id } = await this.call({ action: "start" });
      const sdk = await loadPortOne();
      const res = await sdk.requestIdentityVerification({ storeId: CFG.idv.storeId, channelKey: CFG.idv.channelKey, identityVerificationId: id, redirectUrl: SB.site() });
      if (!res) return null;
      if (res.code) throw { code: "failed", msg: String(res.message || "인증을 마치지 못했어요.").slice(0, 120) };
      return await this.confirm(id);
    } finally { this.busy = false; emit("idv"); }
  },
  /**
   * 휴대폰 인증창에서 돌아왔으면(?identityVerificationId=…) 그 값을 꺼내고 주소를 MY로 정리.
   * @returns {{ id: string, failed: boolean }|null}
   */
  fromUrl() {
    if (!idvOn()) return null;
    const q = new URLSearchParams(location.search), id = q.get("identityVerificationId");
    if (!id) return null;
    try { history.replaceState(null, "", location.pathname + "#me"); } catch {}
    return { id, failed: !!q.get("code") };
  }
};
// 로그인·로그아웃·계정 바뀜(services/supabase.js keep): 그 계정의 결과로 바꿔 끼움
on("session", () => { if (!idvOn()) return; IDV.load(); emit("idv"); IDV.refresh(); });
