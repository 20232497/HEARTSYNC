/* 설정 저장·적용(글자 크기·줄 간격 등 CSS 변수), API 키 붙여넣기 실수 고치기 */
import { S } from "./state.js";
import { KV } from "./storage.js";
import { CLOUD, cloudSettings } from "../services/cloud.js";
import { VAULT } from "../services/vault.js";

/* 키 붙여넣기 실수 잡기: OpenRouter 키 앞의 "sk-or-"가 빠졌으면 붙이고, 형식이 다른 키는 알려 줌 */
export function cleanKeys() {
  const s = S.settings, warn = [];
  if (/^v1-[0-9a-f]{64}$/i.test(s.openRouterKey || "")) s.openRouterKey = "sk-or-" + s.openRouterKey;
  if (s.openRouterKey && !/^sk-or-/.test(s.openRouterKey)) warn.push("OpenRouter 키는 sk-or-로 시작해요");
  if (s.apiKey && !/^sk-ant-/.test(s.apiKey)) warn.push("Anthropic 키는 sk-ant-로 시작해요");
  return warn;
}
export function saveSettings() { try { localStorage.setItem("hv1_settings", JSON.stringify(S.settings)); } catch {} KV.set("memcfg", S.settings.memCfg); CLOUD.put("settings", cloudSettings()); VAULT.save(); }
/* 채팅 설정을 화면에 반영(테마는 기기 설정을 따름) */
export function applySettings() {
  const s = S.settings, root = document.documentElement;
  root.style.setProperty("--chat-fs", s.fs + "px");
  root.style.setProperty("--chat-lh", s.chatLh);
  root.style.setProperty("--narr-font", s.narrFont === "sans" ? "var(--sans)" : "var(--serif)");
  root.classList.toggle("no-scene-img", s.sceneImg === false);
}
