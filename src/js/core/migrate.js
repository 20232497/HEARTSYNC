/* 설정 이전(migrateSettings): localStorage의 예전 설정을 지금 모양으로 — 키 붙여넣기 실수, 직접 만든 칸 정리, 없앤 설정 지우기, 값 범위.
   그림체·이미지 모델 쪽 이전은 관리자 빌드의 admin/migrate.js(사용자 빌드에는 그 모듈이 없음) */
import { RATINGS } from "../images/rating.js";
import { CODE_MAX, CUSTOM_BASE } from "../images/situations.js";
import { cleanKeys, saveSettings } from "./settings.js";
import { S } from "./state.js";
import { clamp } from "./util.js";

/* 저장된 설정을 읽어 S.settings에 얹고 정리한다. 돌려주는 값: 읽은 원본(없으면 null) — 뒤이은 이전(관리자)이 참고 */
export function migrateSettings() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem("hv1_settings") || "null"); } catch {}
  if (s) S.settings = { ...S.settings, ...s, memCfg: { ...S.settings.memCfg, ...(s.memCfg || {}) } };
  let moved = false;
  try {
    // AI 그림 기본 수위가 전체이용가로 바뀜(2026-11): 예전 전체 기본 수위와 작품별로 골라 둔 수위를 한 번 비움
    if (!S.settings.imgSafeDefault) { delete S.settings.adultImgRating; S.settings.sheetRatings = {}; S.settings.imgSafeDefault = true; moved = true; }
    if (typeof S.settings.openRouterKey !== "string") { S.settings.openRouterKey = ""; moved = true; }
    if (typeof S.settings.runwareKey !== "string") { S.settings.runwareKey = ""; moved = true; }
    const orKey = S.settings.openRouterKey; cleanKeys(); if (orKey !== S.settings.openRouterKey) moved = true;
    if (!Array.isArray(S.settings.styleRefs)) S.settings.styleRefs = [];
    if (!Array.isArray(S.settings.styleSets)) S.settings.styleSets = [];
    S.settings.customSits = (Array.isArray(S.settings.customSits) ? S.settings.customSits : [])
      .filter((d) => d && Number.isInteger(d.n) && d.n >= CUSTOM_BASE && d.n < CODE_MAX && d.name && d.prompt).map((d) => ({ ...d, rating: RATINGS[d.rating] ? d.rating : "safe" }));
    // 없앤 설정: 테마(기기 설정을 따름), 등급별 OpenRouter 모델(늘 코드의 OR_TIER — ai/models.js의 orModel이 처리)
    for (const k of ["theme", "unfilteredModels"]) if (k in S.settings) { delete S.settings[k]; moved = true; }
    S.settings.fs = clamp(+S.settings.fs || 15.5, 13, 21);
    S.settings.chatLh = clamp(+S.settings.chatLh || 1.8, 1.4, 2.4);
  } catch {}
  if (moved) saveSettings();
  return s;
}
