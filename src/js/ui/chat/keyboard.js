/* 휴대폰 자판 위에 대화방을 맞춤(2026-11-26 프레임 7차 C1) — visualViewport가 있는 브라우저만, 없으면 지금 그대로. 대화방 화면(ui/chat/view.js)이 그린 뒤 부름.
   아이폰은 자판이 열려도 레이아웃 높이가 그대로라(뼈대의 interactive-widget=resizes-content는 안드로이드 크롬만 받음) 머리가 밀려 올라가고 입력창이 가려짐 →
   자판이 열린 동안 대화방을 보이는 영역(visualViewport)에 고정. 함정 셋: ① 레이아웃이 이미 줄어든 브라우저(resizes-content)에서는 한 번 더 줄이지 않음 —
   가린 높이(innerHeight − 보이는 높이)가 작으면 손대지 않고, 입력창 아래의 안전 영역은 자판이 덮으므로 그때만 빼지 않음(.kb-open) ② 확대(scale ≠ 1)하면 풀고, resize와
   scroll을 같이 봄 ③ 높이가 바뀔 때마다 맨 아래로 보내지 않음 — 맨 아래를 따라가던 중(ui/chat/log.js stick)일 때만. 방을 나가면 리스너와 임시 스타일을 치움 */
import { $ } from "../../core/util.js";
import { stick } from "./log.js";

const KB_MIN = 100; // 이만큼 넘게 가려져야 자판으로 봄(주소창이 접히고 펴지는 정도는 무시)
let kbChat = null,
  kbBound = null; // 맞추는 대화방 요소 · 리스너를 단 visualViewport
/** 대화방 요소를 자판 위에 맞추기 시작 — 같은 방을 다시 그려도 새 요소로 바꿔 끼움. @param {HTMLElement|null} chat */
export function fitKeyboard(chat) {
  const vv = typeof window !== "undefined" ? window.visualViewport : null;
  if (!vv || !chat) return;
  kbChat = chat;
  if (kbBound !== vv) {
    kbStop();
    kbChat = chat;
    kbBound = vv;
    vv.addEventListener("resize", kbFit);
    vv.addEventListener("scroll", kbFit);
    window.addEventListener("hashchange", kbLeave);
  }
  kbFit();
}
function kbFit() {
  const vv = kbBound,
    c = kbChat;
  if (!vv || !c || !c.isConnected) return kbStop();
  const hidden = window.innerHeight - vv.height;
  if (vv.scale !== 1 || hidden < KB_MIN) return kbClear(c);
  const box = $("#view").getBoundingClientRect(); // 넓은 화면(태블릿)은 왼쪽 메뉴 옆 자리 그대로
  c.style.position = "fixed";
  c.style.top = vv.offsetTop + "px";
  c.style.left = box.left + "px";
  c.style.width = box.width + "px";
  c.style.height = vv.height + "px";
  c.classList.add("kb-open");
  const log = $("#log", c);
  if (log && stick) log.scrollTop = log.scrollHeight;
}
function kbClear(c) {
  if (!c.classList.contains("kb-open")) return;
  ["position", "top", "left", "width", "height"].forEach((k) => c.style.removeProperty(k));
  c.classList.remove("kb-open");
  const log = $("#log", c);
  if (log && stick) log.scrollTop = log.scrollHeight;
}
function kbLeave() {
  if (!location.hash.startsWith("#r-")) kbStop();
}
function kbStop() {
  if (kbChat) kbClear(kbChat);
  if (kbBound) {
    kbBound.removeEventListener("resize", kbFit);
    kbBound.removeEventListener("scroll", kbFit);
    window.removeEventListener("hashchange", kbLeave);
  }
  kbChat = kbBound = null;
}
