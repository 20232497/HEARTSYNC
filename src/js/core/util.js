/* DOM·문자열·숫자 유틸, toast, 예상 못 한 오류 기록(reportError) */
/** @typedef {import("./types.js").TimeoutSignal} TimeoutSignal */
export const $ = (s, el = document) => el.querySelector(s);
/** 모든 요소를 배열로. @param {string} s CSS 선택자 @param {ParentNode} [el=document] @returns {Element[]} */
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
/** HTML 이스케이프 — innerHTML·템플릿 문자열에 데이터를 넣을 때 늘 거침. @param {unknown} s @returns {string} */
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
/** 짧은 고유 id(접두사 + 시각 36진 + 난수). @param {string} [p=""] 접두사(r 대화방·m 메시지·p 페르소나·img 그림…) @returns {string} */
export const uid = (p = "") => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
/** @param {number} n @param {number} a 최소 @param {number} b 최대 @returns {number} */
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const today = () => {
  const d = new Date();
  return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
};
export const won = (n) => "₩" + n.toLocaleString("ko-KR");
export const num = (n) => Number(n).toLocaleString("ko-KR");
/** 상대 시각 글("3분 전"·"어제"). @param {number} t ms 시각 @returns {string} */
export function ago(t) {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return "방금";
  if (s < 3600) return Math.floor(s / 60) + "분 전";
  if (s < 86400) return Math.floor(s / 3600) + "시간 전";
  return Math.floor(s / 86400) + "일 전";
}
/* 시간 제한 신호: ms 안에 끝나지 않으면 abort하고 timedOut을 켬(취소와 구분). outer(사용자 취소 신호)가 abort되면 같이 abort.
   tick(ms)은 스트림 조각이 올 때마다 불러 멈춤 시간을 다시 재고, clear()는 끝났을 때 타이머를 멈춤 — 쓰는 곳: ai/llm.js·openrouter.js·images/runware.js·services/supabase.js */
/**
 * @param {number} ms 제한 시간
 * @param {AbortSignal} [outer] 사용자 취소 신호 — abort되면 같이 abort(timedOut은 false)
 * @returns {TimeoutSignal} signal을 fetch에 넘기고, 스트림이면 조각마다 tick(), 끝나면 clear()
 */
export function timeoutSignal(ms, outer) {
  const ctl = new AbortController(),
    fire = () => {
      t.timedOut = true;
      ctl.abort();
    };
  let timer = setTimeout(fire, ms);
  const t = {
    signal: ctl.signal,
    timedOut: false,
    clear() {
      clearTimeout(timer);
    },
    tick(next = ms) {
      clearTimeout(timer);
      timer = setTimeout(fire, next);
    }
  };
  if (outer) {
    if (outer.aborted) {
      clearTimeout(timer);
      ctl.abort();
    } else
      outer.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          ctl.abort();
        },
        { once: true }
      );
  }
  return t;
}
/* fetch 오류 → 오류 코드: 시간 초과면 timeout, 사용자 취소면 cancelled, 그 밖은 fallback */
/**
 * @param {unknown} e fetch·reader가 던진 오류
 * @param {TimeoutSignal|null} t 그 요청의 시간 제한 신호(없어도 됨)
 * @param {string} fallback AbortError가 아닐 때의 코드
 * @returns {string} "timeout" · "cancelled" · fallback
 */
export function abortCode(e, t, fallback) {
  return e && e.name === "AbortError" ? (t && t.timedOut ? "timeout" : "cancelled") : fallback;
}
/** 화면 아래 짧은 안내(2.6초). textContent로 넣으니 이스케이프 불필요. @param {string} msg @returns {void} */
export function toast(msg) {
  $$(".toast").forEach((t) => t.remove());
  const t = document.createElement("div");
  t.className = "toast";
  t.setAttribute("role", "status");
  t.textContent = msg;
  document.body.append(t);
  setTimeout(() => t.remove(), 2600);
}
/* 예상 못 한 오류가 나도 조용히 멈춘 것처럼 보이지 않게: 콘솔에 남기고 8초에 한 번만 안내 */
let errAt = 0;
function reportError(err) {
  if (!err || err.name === "AbortError" || err.code === "cancelled") return;
  console.error("[HEART SYNC]", err);
  if (Date.now() - errAt < 8000) return;
  errAt = Date.now();
  toast("일시적인 오류가 있었어요. 계속되면 새로고침해 주세요.");
}
// 브라우저에서만(Node 단위 테스트가 이 모듈을 import할 수 있게)
if (typeof window !== "undefined") {
  window.addEventListener("error", (e) => {
    if (e.error) reportError(e.error);
  });
  window.addEventListener("unhandledrejection", (e) => reportError(e.reason));
}
