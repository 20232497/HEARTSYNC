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
  // 장기기억 설정의 원본은 설정(memCfg 칸) 하나. 설정에 그 칸이 없는 예전 설치에서만 따로 두던 사본(hv1_memcfg)을 읽어 설정으로 옮김 — 사본은 지우지 않고 더 쓰지 않음
  if (!s || !s.memCfg)
    try {
      const old = JSON.parse(localStorage.getItem("hv1_memcfg") || "null");
      if (old && typeof old === "object") {
        S.settings.memCfg = { ...S.settings.memCfg, ...old };
        moved = true;
      }
    } catch {}
  try {
    // 없앤 설정: 등급별 OpenRouter 모델
    for (const k of ["unfilteredModels"])
      if (k in S.settings) {
        delete S.settings[k];
        moved = true;
      }
    // 화면 테마: "light"·"dark"만(고르지 않았으면 칸이 없음 = 기기 설정을 따름). 예전 빌드가 남긴 다른 값은 지움
    if ("theme" in S.settings && S.settings.theme !== "light" && S.settings.theme !== "dark") {
      delete S.settings.theme;
      moved = true;
    }
    S.settings.fs = clamp(+S.settings.fs || 15.5, 13, 21);
    S.settings.chatLh = clamp(+S.settings.chatLh || 1.8, 1.4, 2.4);
  } catch {}
  if (moved) saveSettings();
}
