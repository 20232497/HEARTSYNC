/* AI 표시: 대화 화면 머리의 배지 · AI 말풍선의 접근성 이름 · 첫 대화 전 한 번의 안내 · 내보낸 파일의 첫 줄.
   문구는 docs/legal/ui-copy.md §6의 글자 그대로 — 고칠 때는 그 문서(주인은 법률 세션)와 같이. 그림에 붙는 표기 두 줄은 그림이 실릴 때(docs/ROADMAP.md) */
import { saveSettings } from "../core/settings.js";
import { S } from "../core/state.js";

/** 대화 화면 머리에 늘 보이는 배지 */
export const AI_BADGE = "AI 캐릭터";
/** 첫 대화를 시작하기 전 한 번 보이는 안내(계정에 한 번 — 로그인하지 않았으면 이 기기에 한 번)와 그 버튼 */
export const AI_NOTICE =
  "캐릭터의 답은 생성형 AI가 만들어요. 작품 설정에 따른 허구이고, 틀리거나 이상한 답을 할 수 있어요. 진지하게 물으면 캐릭터는 자기가 AI라는 걸 숨기지 않아요.";
export const AI_NOTICE_OK = "알겠어요";
/** 대화를 내보낸 파일의 첫 줄 */
export const AI_EXPORT_LINE = "※ 이 파일의 캐릭터 대사와 서술은 생성형 AI(HEART SYNC)가 만든 것입니다.";
/** AI 말풍선의 접근성 이름. @param {string} name 화자 이름 @returns {string} */
export function aiLabel(name) {
  return "AI 응답: " + name;
}
/** 첫 대화 전 안내를 아직 보지 않았는지 — 본 시각은 S.settings.aiSeen(계정에 올라가는 설정 칸이라 다른 기기에서 봤으면 다시 뜨지 않음). @returns {boolean} */
export function aiNoticeNeeded() {
  return !S.settings.aiSeen;
}
/** 안내를 봤다고 적음('알겠어요'를 눌렀을 때). @returns {void} */
export function ackAiNotice() {
  if (S.settings.aiSeen) return;
  S.settings.aiSeen = Date.now();
  saveSettings();
}
