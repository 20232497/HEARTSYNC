/* 그림 수위: 등급 태그, 시트별 수위, 수위 선택 칸 HTML */
import { ageOK } from "../ai/adult.js";
import { IN_CLAUDE } from "../core/config.js";
import { saveSettings } from "../core/settings.js";
import { S } from "../core/state.js";
import { esc } from "../core/util.js";

/* 이미지 수위: 성인 확인(ageOK) 전·claude.ai 안에서는 항상 safe. pos는 Pony용, ill은 Illustrious용 rating 태그, neg는 그 수위에서 막을 태그 */
export const RATINGS = {
  safe: { name: "전체이용가", pos: "rating_safe", ill: "general", neg: "nsfw, nude, explicit, questionable, rating_explicit, rating_questionable" },
  // 수위 태그는 짧게: nsfw·mature를 겹쳐 넣으면 모델이 프롬프트(표정·외모)보다 노출 쪽으로 끌려가 다른 인물처럼 그림(2026-11)
  questionable: { name: "세미 수위", pos: "rating_questionable", ill: "questionable", neg: "explicit, rating_explicit, school uniform" },
  explicit: { name: "성인 전용", pos: "rating_explicit", ill: "nsfw, explicit", neg: "school uniform" }
};
/* AI 그림 수위는 기본 전체이용가. 세미·성인은 성인 확인 뒤 직접 만든 칸의 수위나 시트·생성 창에서 고를 때만 */
export function imgRating(want = "safe") { return ageOK() && RATINGS[want] ? want : "safe"; }
/* 시트별 그림 수위(이미지 슬롯의 기본 칸은 작품 id, 세계관 일러스트는 "w:" + id). 고른 적 없으면 전체이용가 */
export function sheetRating(key) { return imgRating((S.settings.sheetRatings || {})[key]); }
export function setSheetRating(key, v) { S.settings.sheetRatings = { ...(S.settings.sheetRatings || {}), [key]: v }; saveSettings(); }
/* 수위 고르기 칸: 성인 확인 전·claude.ai 안에서는 전체이용가로 잠그고 이유를 보여 줌 */
export function ratingFieldHTML(id, cur, label = "수위") {
  const ok = ageOK(), v = ok ? imgRating(cur) : "safe";
  return `<div class="field rate-field"><label for="${id}">${esc(label)}</label><select id="${id}" ${ok ? "" : "disabled"}>${Object.entries(RATINGS).map(([k, r]) => `<option value="${k}" ${k === v ? "selected" : ""}>${esc(r.name)}</option>`).join("")}</select>${ok ? ""
    : `<p class="note">${IN_CLAUDE ? "claude.ai 안에서는 전체이용가만 만들 수 있어요." : "세미·성인 수위는 MY → 설정 → AI 연결에서 '만 19세 이상'을 켜고 설정 저장을 누르면 고를 수 있어요."}</p>`}</div>`;
}
