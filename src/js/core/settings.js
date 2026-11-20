/* 설정 저장·적용(글자 크기·줄 간격 등 CSS 변수), API 키 형식 안내. 저장하면 "settings" 이벤트 — 계정 저장(services/cloud.js)이 받음 */
import { emit } from "./events.js";
import { S } from "./state.js";
import { KV } from "./storage.js";

/** 형식이 다른 키 안내. @returns {string[]} 안내 문구(비면 이상 없음) */
export function cleanKeys() {
  const s = S.settings,
    warn = [];
  if (s.apiKey && !/^sk-ant-/.test(s.apiKey)) warn.push("Anthropic 키는 sk-ant-로 시작해요");
  return warn;
}
/** 설정 저장(localStorage + memcfg KV) 후 "settings" 이벤트(계정 저장이 받음). @returns {void} */
export function saveSettings() {
  try {
    localStorage.setItem("hv1_settings", JSON.stringify(S.settings));
  } catch {}
  KV.set("memcfg", S.settings.memCfg);
  emit("settings");
}
/**
 * 채팅 글자 크기·줄 간격·지문 글꼴·장면 그림 보기를 CSS 변수와 html 클래스에, 화면 테마를 html의 data-theme에 반영.
 * 테마는 "light"·"dark"를 골랐을 때만 속성을 걸고, 고르지 않았으면 떼어 기기 설정을 따름(css/10-base.css) — 뼈대의 앞쪽 스크립트가 같은 일을 화면이 그려지기 전에 함.
 * @returns {void}
 */
export function applySettings() {
  const s = S.settings,
    root = document.documentElement;
  if (s.theme === "light" || s.theme === "dark") root.setAttribute("data-theme", s.theme);
  else root.removeAttribute("data-theme");
  root.style.setProperty("--chat-fs", s.fs + "px");
  root.style.setProperty("--chat-lh", s.chatLh);
  root.style.setProperty("--narr-font", s.narrFont === "sans" ? "var(--sans)" : "var(--serif)");
  root.classList.toggle("no-scene-img", s.sceneImg === false);
}
