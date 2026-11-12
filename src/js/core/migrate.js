/* 설정 이전(migrateSettings): localStorage의 예전 설정을 지금 모양으로 — 없앤 설정 지우기, 값 범위.
   예전 빌드의 그림·성인 설정 칸(customSits·styleSets·isAgeVerified 등)은 지우지 않고 그대로 둠 — 쓰는 코드가 없어 아무 영향이 없고, 지우면 계정에 있던 값까지 사라짐 */
import { saveSettings } from "./settings.js";
import { S } from "./state.js";
import { clamp } from "./util.js";

/** 저장된 설정을 읽어 S.settings에 얹고 정리한다. @returns {void} */
export function migrateSettings() {
  let s = null;
  try {
    s = JSON.parse(localStorage.getItem("hv1_settings") || "null");
  } catch {}
  if (s) S.settings = { ...S.settings, ...s, memCfg: { ...S.settings.memCfg, ...(s.memCfg || {}) } };
  let moved = false;
  try {
    // 없앤 설정: 테마(기기 설정을 따름), 등급별 OpenRouter 모델
    for (const k of ["theme", "unfilteredModels"])
      if (k in S.settings) {
        delete S.settings[k];
        moved = true;
      }
    S.settings.fs = clamp(+S.settings.fs || 15.5, 13, 21);
    S.settings.chatLh = clamp(+S.settings.chatLh || 1.8, 1.4, 2.4);
  } catch {}
  if (moved) saveSettings();
}
