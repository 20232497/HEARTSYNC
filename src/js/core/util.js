/* DOM·문자열·숫자 유틸, toast, 예상 못 한 오류 기록(reportError) */
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const uid = (p = "") => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const today = () => { const d = new Date(); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); };
export const won = (n) => "₩" + n.toLocaleString("ko-KR");
export const num = (n) => Number(n).toLocaleString("ko-KR");
export function ago(t) {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return "방금"; if (s < 3600) return Math.floor(s / 60) + "분 전"; if (s < 86400) return Math.floor(s / 3600) + "시간 전";
  return Math.floor(s / 86400) + "일 전";
}
export function toast(msg) {
  $$(".toast").forEach((t) => t.remove());
  const t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); t.textContent = msg; document.body.append(t);
  setTimeout(() => t.remove(), 2600);
}
/* 예상 못 한 오류가 나도 조용히 멈춘 것처럼 보이지 않게: 콘솔에 남기고 8초에 한 번만 안내 */
let errAt = 0;
function reportError(err) {
  if (!err || err.name === "AbortError" || err.code === "cancelled") return;
  console.error("[HEART SYNC]", err);
  if (Date.now() - errAt < 8000) return;
  errAt = Date.now(); toast("일시적인 오류가 있었어요. 계속되면 새로고침해 주세요.");
}
// 브라우저에서만(Node 단위 테스트가 이 모듈을 import할 수 있게)
if (typeof window !== "undefined") {
  window.addEventListener("error", (e) => { if (e.error) reportError(e.error); });
  window.addEventListener("unhandledrejection", (e) => reportError(e.reason));
}
