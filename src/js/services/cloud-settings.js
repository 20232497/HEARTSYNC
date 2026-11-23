/* 계정에 올리는 설정의 모양: 기기마다 따로 두는 칸과 API 키 칸을 빼고 올리고(cloudSettings), 받을 때도 그 칸은 계정 것을 받지 않음(mergeCloudSettings) */
import { S } from "../core/state.js";
/** @typedef {import("../core/types.js").Settings} Settings */

const DEVICE_SETTINGS = ["fs", "enterSend", "theme"]; // 화면 테마도 기기마다 따로(낮에 쓰는 기기와 밤에 쓰는 기기가 다를 수 있음)
/* API 키 칸은 계정에 올리지 않음 — 서버 표의 kv_no_plain_keys 제약도 settings에 이 칸이 있으면 거부. 예전 빌드의 그림·성인 키 칸도 기기에 남아 있을 수 있어 함께 뺌 */
const KEY_FIELDS = ["apiKey", "runwareKey", "openRouterKey"];
/** 계정에 올릴 설정 — 기기별 칸(fs·enterSend)과 API 키 칸은 뺌(서버 제약 kv_no_plain_keys). @returns {Partial<Settings>} */
export function cloudSettings() {
  const s = Object.assign({}, S.settings);
  DEVICE_SETTINGS.concat(KEY_FIELDS).forEach((k) => delete s[k]);
  return s;
}
/** 계정에서 받은 설정을 이 기기의 설정에 얹고 저장(기기별 칸·키 칸은 받지 않음). @param {unknown} v */
export function mergeCloudSettings(v) {
  if (!v || typeof v !== "object") return;
  // 기기별 칸과 키 칸은 계정 것을 받지 않음 — 이 기기에 그 칸이 없어도(화면 테마를 '기기 설정'으로 둔 것) 예전 빌드가 계정에 남긴 값이 들어오지 않게
  const incoming = Object.assign({}, v);
  DEVICE_SETTINGS.concat(KEY_FIELDS).forEach((k) => delete incoming[k]);
  const next = Object.assign({}, S.settings, incoming);
  next.memCfg = Object.assign({}, S.settings.memCfg, incoming.memCfg); // 장기기억 설정은 칸마다 합침(계정 값에 없는 칸은 이 기기의 값·기본값)
  delete next.keysLocal;
  S.settings = next;
  try {
    localStorage.setItem("hv1_settings", JSON.stringify(S.settings));
  } catch {}
}
