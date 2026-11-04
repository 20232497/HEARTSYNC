/* 설정 저장·적용(글자 크기·줄 간격 등 CSS 변수), API 키 붙여넣기 실수 고치기. 저장하면 "settings" 이벤트 — 계정 저장(cloud)·키 금고(vault)가 받음 */
import { emit } from "./events.js";
import { S } from "./state.js";
import { KV } from "./storage.js";

/* 키 붙여넣기 실수 잡기: OpenRouter 키 앞의 "sk-or-"가 빠졌으면 붙이고, 형식이 다른 키는 알려 줌 */
/** 붙여넣기 실수 고치기(sk-or- 빠진 OpenRouter 키) 후 형식이 다른 키 안내. @returns {string[]} 안내 문구(비면 이상 없음) */
export function cleanKeys() {
  const s = S.settings, warn = [];
  if (/^v1-[0-9a-f]{64}$/i.test(s.openRouterKey || "")) s.openRouterKey = "sk-or-" + s.openRouterKey;
  if (s.openRouterKey && !/^sk-or-/.test(s.openRouterKey)) warn.push("OpenRouter 키는 sk-or-로 시작해요");
  if (s.apiKey && !/^sk-ant-/.test(s.apiKey)) warn.push("Anthropic 키는 sk-ant-로 시작해요");
  return warn;
}
/** 설정 저장(localStorage + memcfg KV) 후 "settings" 이벤트(계정 저장·금고가 받음). @returns {void} */
export function saveSettings() { try { localStorage.setItem("hv1_settings", JSON.stringify(S.settings)); } catch {} KV.set("memcfg", S.settings.memCfg); emit("settings"); }
/* 채팅 설정을 화면에 반영(테마는 기기 설정을 따름) */
/** 채팅 글자 크기·줄 간격·지문 글꼴·장면 그림 보기를 CSS 변수와 html 클래스에 반영. @returns {void} */
export function applySettings() {
  const s = S.settings, root = document.documentElement;
  root.style.setProperty("--chat-fs", s.fs + "px");
  root.style.setProperty("--chat-lh", s.chatLh);
  root.style.setProperty("--narr-font", s.narrFont === "sans" ? "var(--sans)" : "var(--serif)");
  root.classList.toggle("no-scene-img", s.sceneImg === false);
}
