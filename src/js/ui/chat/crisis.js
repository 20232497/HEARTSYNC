/* 위기 안내 카드(docs/legal/ui-copy.md §7의 글자 그대로) — 위기 신호(core/safety.js crisisDue)가 보인 유저 메시지 바로 아래, 그 턴 AI 답의 위. 닫을 수 있고 대화는 그대로 이어짐.
   기록은 이 화면의 기억에만 둠(방·계정에 저장하지 않음 — 저장하면 처리방침의 수집 항목이 늘어남): 새로 고치면 카드는 사라지고 24시간 셈도 다시 시작해 한 번 더 띄우는 쪽으로 틀림.
   카드는 '방 id/메시지 id'로 셈 — 분기한 방은 메시지 id를 그대로 복사하므로 방 id까지 봐야 한쪽에서 닫은 것이 다른 쪽에 번지지 않음.
   청소년 회원 판(둘째 줄 아래 청소년상담 1388을 먼저)은 회원 나이를 알게 될 때(프레임 9차 라 — 서버 관문) */
import { crisisDue } from "../../core/safety.js";

const crisisOpen = new Set(), // 카드를 띄운 '방 id/메시지 id'(닫으면 뺌)
  crisisLast = new Map(); // 방 id → 이 방에서 마지막으로 띄운 시각
/**
 * 보내는(또는 고쳐 보내는·다시 시도하는) 유저 메시지에 카드를 붙일지 보고 붙임. 이미 떠 있는 카드는 그대로 둠 —
 * 고쳐 보낸 글이 같은 정도의 신호여서 24시간 셈에 걸려도, 고치기가 실패해 원문으로 돌아가도 카드가 사라지지 않게.
 * @param {{ id: string }} r 방 @param {{ id: string, text: string }} u @returns {void}
 */
export function markCrisis(r, u) {
  const k = r.id + "/" + u.id,
    now = Date.now();
  if (crisisOpen.has(k) || !crisisDue(u.text, crisisLast.get(r.id) || 0, now)) return;
  crisisLast.set(r.id, now);
  crisisOpen.add(k);
}
/** '닫기'. @param {string} roomId @param {string} id 유저 메시지 id */
export const closeCrisis = (roomId, id) => crisisOpen.delete(roomId + "/" + id);
const telLink = (n) => `<a href="tel:${n}">${n}</a>`;
/** 카드 HTML — 띄운 메시지가 아니면 빈 글. @param {string} roomId @param {string} id 유저 메시지 id @param {number} i 메시지 순번(닫기 버튼의 data-i) @returns {string} */
export function crisisHTML(roomId, id, i) {
  if (!crisisOpen.has(roomId + "/" + id)) return "";
  return (
    `<aside class="crisis" aria-label="도움을 받을 수 있는 곳"><b>혹시 많이 힘드신가요?</b>` +
    `<p>혼자 견디지 않아도 돼요. 지금 바로 이야기할 수 있는 곳이 있어요.</p>` +
    `<ul><li>📞 자살예방상담전화 ${telLink("109")} (24시간)</li><li>📞 정신건강위기상담전화 ${telLink("1577-0199")}</li>` +
    `<li>🚨 위급하면 ${telLink("112")} · ${telLink("119")}</li></ul>` +
    `<button class="btn sm" data-act="crisis-x" data-i="${i}">닫기</button></aside>`
  );
}
