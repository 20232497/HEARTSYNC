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
    else if (gen) stopGen();
  });
}
