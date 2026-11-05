/* 부팅(boot): 설정 이전 → 저장 데이터 읽기 → 셸·첫 화면 → 계정·capability 연결. 진입점(main.js·admin.js)이 부른다.
   opts.migrate(saved): 빌드마다 다른 추가 이전(관리자 빌드의 그림체 설정 이전) — core/migrate 뒤, 데이터를 읽기 전에 돈다 */
import { AUDS } from "./core/audience.js";
import { migrateSettings } from "./core/migrate.js";
import { roomKey } from "./core/rooms.js";
import { applySettings } from "./core/settings.js";
import { S, SAMPLE, gen, hasClaudeKey, setDB, setDownloads, setSample, setSamplePromise } from "./core/state.js";
import { KV } from "./core/storage.js";
import { $ } from "./core/util.js";
import { CLOUD } from "./services/cloud.js";
import { watchCommunity } from "./services/community.js";
import { IDV } from "./services/idv.js";
import { IMG } from "./services/images.js";
import { loadAll } from "./services/load.js";
import { SB } from "./services/supabase.js";
import { reloadFromCloud } from "./services/sync.js";
import { stopGen } from "./ui/chat/generate.js";
import { audSheet, viewHome } from "./ui/home.js";
import { finishIdv } from "./ui/idv.js";
import { afterLogin, newPasswordSheet } from "./ui/login.js";
import { closeOverlays } from "./ui/sheet.js";
import { renderRailRecent, renderShell, renderWalletChips, route } from "./ui/shell.js";

export async function boot(opts = {}) {
  const saved = migrateSettings();
  if (opts.migrate) opts.migrate(saved);
  applySettings();
  // 계정: 인증 메일·소셜 로그인에서 돌아왔으면(#access_token…) 먼저 세션으로 바꿈
  SB.load();
  const authType = SB.on() ? await SB.fromHash() : "";
  IDV.load();
  const idvBack = IDV.fromUrl(); // 휴대폰 인증창에서 돌아옴(?identityVerificationId=…) — 주소를 먼저 #me로 정리
  await loadAll();
  renderShell();
  // 처음 시작: 로그인 페이지(계정 서버가 있고, 로그인도 둘러보기도 안 했을 때) → 관심있는 대화 고르기
  const askLogin = SB.on() && !SB.s && !localStorage.getItem("hv1_guest") && !location.hash.startsWith("#r-");
  if (askLogin) { try { history.replaceState(null, "", location.pathname + location.search + "#login"); } catch {} }
  route();
  window.addEventListener("hashchange", route);
  if (idvBack) finishIdv(idvBack); else IDV.refresh();
  if (SB.s) afterLogin(!!authType).then(() => { if (authType === "recovery") newPasswordSheet(); else if (!AUDS[S.settings.audience] && !location.hash.startsWith("#r-")) audSheet(true); });
  else if (!askLogin && !AUDS[S.settings.audience] && !location.hash.startsWith("#r-")) audSheet(true);
  // 다른 기기에서 바꾼 것: 이 탭으로 돌아올 때 받아 오고, 떠날 때 못 올린 것을 올림
  document.addEventListener("visibilitychange", () => {
    if (!CLOUD.on) return;
    if (document.hidden) CLOUD.flush();
    else if (Date.now() - CLOUD.pulledAt > 20000 && !gen) CLOUD.pull().then((n) => { if (n) reloadFromCloud(); }).catch(() => {});
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if ($(".lightbox")) $(".lightbox").remove(); else if ($(".overlay")) closeOverlays(); else if (gen) stopGen();
  });

  // claude.ai 아티팩트 안이면 capability(sample·assets·downloads·db)를 연결. 밖이면 BYOK(키) 또는 연결 없음
  const hasClaude = !!(window.claude && typeof window.claude.use === "function");
  setSamplePromise((async () => {
    if (!hasClaude) { S.engine = hasClaudeKey() ? "byok" : "none"; return; }
    try { setSample(await window.claude.use("sample")); } catch { setSample(null); }
    if (SAMPLE) { S.engine = "sample"; try { const l = await SAMPLE.limits(); S.sampleTiers = Array.isArray(l?.modelTiers) ? l.modelTiers : null; } catch {} }
    else S.engine = hasClaudeKey() ? "byok" : "none";
  })().finally(() => { if ((location.hash.slice(1) || "home") === "home") viewHome(); }));

  if (hasClaude) {
    window.claude.use("assets").then((a) => { IMG.assets = a || null; }).catch(() => {});
    window.claude.use("downloads").then((d) => { setDownloads(d || null); }).catch(() => {});
    try {
      const [db, user] = await Promise.all([window.claude.use("db"), window.claude.use("user")]);
      if (db && user) {
        const id = await user.id();
        if (id) {
          setDB(db); KV.db = db; KV.uid = id; KV.dbOk = true;
          const remoteRooms = await KV.get("rooms");
          if (remoteRooms === undefined || remoteRooms === null) {
            ["wallet", "personas", "profile", "mine", "rooms", "imgpacks", "memcfg", "coverpacks", "lorepacks", "tagpacks"].forEach((k) => { const v = KV.getLocal(k); if (v !== undefined) KV.set(k, v); });
            S.rooms.forEach((r) => { const v = KV.getLocal(roomKey(r.id)); if (v) KV.set(roomKey(r.id), v); });
          } else { await loadAll(); renderRailRecent(); renderWalletChips(); if (!location.hash.startsWith("#r-")) route(); }
          watchCommunity();
        }
      }
    } catch {}
  }
}
