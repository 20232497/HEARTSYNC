/* 부팅(boot): 설정 이전 → 저장 데이터 읽기 → 셸·첫 화면 → 계정 연결. 진입점(main.js·admin.js)이 부른다 */
import { migrateSettings } from "./core/migrate.js";
import { applySettings } from "./core/settings.js";
import { gen } from "./core/state.js";
import { $ } from "./core/util.js";
import { CLOUD } from "./services/cloud.js";
import { loadAll } from "./services/load.js";
import { SB } from "./services/supabase.js";
import { reloadFromCloud } from "./services/sync.js";
import { stopGen } from "./ui/chat/generate.js";
import { askAud } from "./ui/home.js";
import { afterLogin, bootBack, newPasswordSheet } from "./ui/login.js";
import { closeOverlays } from "./ui/sheet.js";
import { renderShell, route } from "./ui/shell.js";

/* 부팅이 던지면 '불러오는 중…'에 머물지 않게 이유를 보여 줌 — 뼈대의 앞쪽 ES5 스크립트는 error 이벤트만 받아, 약속이 거부된 것은 못 봄.
   첫 화면이 이미 그려진 뒤(#bootMsg가 없음)의 실패는 전처럼 전역 처리기(core/util.js)로 */
export function bootFail(e) {
  const m = typeof document !== "undefined" ? document.getElementById("bootMsg") : null;
  if (!m) throw e;
  console.error("[HEART SYNC] 부팅 실패", e);
  m.textContent = "화면을 불러오지 못했어요. 새로고침해 주세요. (" + ((e && e.message) || "알 수 없는 오류") + ")";
}
export async function boot() {
  migrateSettings();
  applySettings();
  // 계정: 인증 메일·소셜 로그인에서 돌아왔으면(#access_token…) 먼저 세션으로 바꿈
  SB.load();
  const authType = SB.on() ? await SB.fromHash() : "";
  await loadAll();
  renderShell();
  // 처음 시작: 로그인 페이지(계정 서버가 있고, 로그인도 둘러보기도 안 했을 때) → 관심있는 대화 고르기
  const askLogin = SB.on() && !SB.s && !localStorage.getItem("hv1_guest") && !location.hash.startsWith("#r-");
  bootBack(askLogin); // 작품 주소로 처음 들어왔으면 로그인·둘러보기 뒤 그 작품으로
  route();
  window.addEventListener("hashchange", route);
  // 방을 열어 둔 사이 다른 기기가 그 방을 고쳤으면(받기가 덮지 않고 넘어감) 방에서 나올 때 그 방만 다시 받음
  window.addEventListener("hashchange", () => {
    if (CLOUD.on && CLOUD.skipped.size) CLOUD.retake();
  });
  if (SB.s)
    afterLogin(!!authType).then(() => {
      if (authType === "recovery") newPasswordSheet();
      else askAud();
    });
  else if (!askLogin) askAud();
  // 다른 기기에서 바꾼 것: 이 탭으로 돌아올 때 받아 오고, 떠날 때 못 올린 것을 올림
  document.addEventListener("visibilitychange", () => {
    if (!CLOUD.on) return;
    if (document.hidden) CLOUD.flush();
    else if (Date.now() - CLOUD.pulledAt > 20000 && !gen)
      CLOUD.pull()
        .then((n) => {
          if (n) reloadFromCloud();
        })
        .catch(() => {});
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if ($(".lightbox")) $(".lightbox").remove();
    else if ($(".overlay")) closeOverlays();
    else if (gen && location.hash === "#r-" + gen.roomId) stopGen(); // 그 방을 보고 있을 때만 — 떠난 방의 답은 다른 화면의 Esc로 멈추지 않음
  });
}
