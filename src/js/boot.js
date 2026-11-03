/* 부팅: 저장 데이터 읽기(loadAll), capability·계정 연결, 첫 화면 */
import { OR_TIER } from "./ai/models.js";
import { AUDS } from "./core/audience.js";
import { normalizeChar } from "./core/character.js";
import { roomKey } from "./core/rooms.js";
import { applySettings, cleanKeys, saveSettings } from "./core/settings.js";
import { S, SAMPLE, gen, hasClaudeKey, setDB, setDownloads, setSample, setSamplePromise } from "./core/state.js";
import { KV } from "./core/storage.js";
import { $, clamp } from "./core/util.js";
import { WELCOME, ledger, refreshFree } from "./core/wallet.js";
import { RATINGS } from "./images/rating.js";
import { BAD_IMG_MODELS } from "./images/runware.js";
import { CODE_MAX, CUSTOM_BASE } from "./images/situations.js";
import { IMG_MODELS, IMG_STYLES, OLD_STYLES, guessStyleModel, guessStylePrompt } from "./images/styles.js";
import { TAGS, setTags } from "./images/tags.js";
import { CLOUD } from "./services/cloud.js";
import { IMG } from "./services/images.js";
import { SB } from "./services/supabase.js";
import { reloadFromCloud } from "./services/sync.js";
import { stopGen } from "./ui/chat/generate.js";
import { audSheet, viewHome } from "./ui/home.js";
import { afterLogin, newPasswordSheet } from "./ui/login.js";
import { closeOverlays } from "./ui/sheet.js";
import { renderRailRecent, renderShell, renderWalletChips, route } from "./ui/shell.js";
import { watchCommunity } from "./ui/studio.js";

export async function loadAll() {
  const [w, p, pr, mine, rooms, packs, mc, cps, lps, tps] = await Promise.all(["wallet", "personas", "profile", "mine", "rooms", "imgpacks", "memcfg", "coverpacks", "lorepacks", "tagpacks"].map((k) => KV.get(k)));
  if (cps && typeof cps === "object") S.coverpacks = cps;
  if (tps && typeof tps === "object") S.tagpacks = tps;
  if (lps && typeof lps === "object") S.lorepacks = lps;
  if (w && typeof w === "object") S.wallet = { ...S.wallet, ...w, history: Array.isArray(w.history) ? w.history : [], ledger: Array.isArray(w.ledger) ? w.ledger : [], ack: w.ack && typeof w.ack === "object" ? w.ack : {} };
  else if (!S.wallet.welcomed) { S.wallet.hearts = WELCOME; S.wallet.welcomed = true; ledger(WELCOME, "첫 방문 보너스"); KV.set("wallet", S.wallet); }
  if (Array.isArray(p) && p.length) S.personas = p.map((x) => ({ memo: "", img: "", ...x }));
  if (pr && typeof pr === "object") S.profile = pr;
  if (Array.isArray(mine)) S.mine = mine.map(normalizeChar);
  if (Array.isArray(rooms)) S.rooms = rooms;
  if (packs && typeof packs === "object") S.imgpacks = packs;
  IMG.migrate().catch(() => {});
  KV.get("ponytags").then((t) => { if (t && typeof t === "object") setTags({ ...t, ...TAGS }); }).catch(() => {});
  if (mc && typeof mc === "object") S.settings.memCfg = { ...S.settings.memCfg, ...mc };
  refreshFree();
}
export async function boot() {
  try { const s = JSON.parse(localStorage.getItem("hv1_settings") || "null"); if (s) S.settings = { ...S.settings, ...s, memCfg: { ...S.settings.memCfg, ...(s.memCfg || {}) }, unfilteredModels: { ...OR_TIER } }; // 등급별 모델은 화면에서 고치지 않으므로 늘 코드의 OR_TIER
    // AI 그림 기본 수위가 전체이용가로 바뀜(2026-11): 예전 전체 기본 수위와 작품별로 골라 둔 수위를 한 번 비움
    if (!S.settings.imgSafeDefault) { delete S.settings.adultImgRating; S.settings.sheetRatings = {}; S.settings.imgSafeDefault = true; saveSettings(); }
    if (typeof S.settings.openRouterKey !== "string") S.settings.openRouterKey = "";
    const orKey = S.settings.openRouterKey; cleanKeys(); if (orKey !== S.settings.openRouterKey) saveSettings();
    // 그림체를 아직 고른 적 없는 이전 설정은 웹소설 표지 세미리얼로 한 번 옮김
    if (s && !s.styleV2 && (!s.imgStyle || s.imgStyle === "none")) S.settings.imgStyle = "novel";
    if (!Array.isArray(S.settings.styleRefs)) S.settings.styleRefs = [];
    if (!Array.isArray(S.settings.styleSets)) S.settings.styleSets = [];
    S.settings.customSits = (Array.isArray(S.settings.customSits) ? S.settings.customSits : [])
      .filter((d) => d && Number.isInteger(d.n) && d.n >= CUSTOM_BASE && d.n < CODE_MAX && d.name && d.prompt).map((d) => ({ ...d, rating: RATINGS[d.rating] ? d.rating : "safe" }));
    // Gemini → Runware: 다른 서비스의 키는 옮기지 않고 지우고, Runware 모델(AIR id)이 아니면 Pony로
    let moved = false;
    if ("geminiKey" in S.settings) { delete S.settings.geminiKey; moved = true; }
    if (!/^[a-z][a-z0-9-]*:\d+@\d+$/i.test(String(S.settings.imgModel || "")) || BAD_IMG_MODELS.includes(S.settings.imgModel)) { S.settings.imgModel = IMG_MODELS[0].id; moved = true; }
    // 그림체: 예전 프리셋 이름은 새 이름으로, 세트에는 모델을 붙이고, 예전 기본 문구(인물·구도 태그가 섞인 것)는 새 그림체 문구로
    const st = S.settings.imgStyle;
    if (OLD_STYLES[st]) { S.settings.imgStyle = OLD_STYLES[st]; moved = true; }
    else if (!String(st).startsWith("set:") && !IMG_STYLES[st]) { S.settings.imgStyle = "webtoon"; moved = true; }
    S.settings.styleSets.forEach((x) => {
      if (!x.model || BAD_IMG_MODELS.includes(x.model)) { x.model = guessStyleModel(x.name); moved = true; }
      // 예전 기본 문구(인물·구도 태그가 섞인 것, 인위적인 세미리얼 문구)는 지금 문구로
      if (/^(anime coloring, cel shading, sharp lineart|semi-realistic, 2\.5d, detailed face, porcelain skin|korean, semi-realistic, 2\.5d, detailed face, pale skin)/.test(x.prompt || "")) { x.prompt = guessStylePrompt(x.name); moved = true; }
      // 첫 애니 문구의 colorful(무지개 머리)·vivid colors("VIVID" 글자) → 지금 문구로
      if (/^illustration, beautiful detailed eyes, .*\b(colorful|vivid colors)\b/.test(x.prompt || "")) { x.prompt = guessStylePrompt(x.name); moved = true; }
    });
    if ("theme" in S.settings) { delete S.settings.theme; moved = true; } // 테마 설정은 없앰(기기 설정을 따름)
    S.settings.fs = clamp(+S.settings.fs || 15.5, 13, 21);
    S.settings.chatLh = clamp(+S.settings.chatLh || 1.8, 1.4, 2.4);
    if (typeof S.settings.runwareKey !== "string") S.settings.runwareKey = "";
    // 따로 올렸던 '참고 그림'은 Runware(글로만 그림)에서 쓸 곳이 없어 저장 공간만 차지하므로 한 번 정리(그림체 세트 그림은 유지)
    if (S.settings.styleRefs.length) { S.settings.styleRefs.forEach((r) => IMG.drop(r)); S.settings.styleRefs = []; moved = true; }
    if (moved) saveSettings(); } catch {}
  applySettings();
  // 계정: 인증 메일·소셜 로그인에서 돌아왔으면(#access_token…) 먼저 세션으로 바꿈
  SB.load();
  const authType = SB.on() ? await SB.fromHash() : "";
  await loadAll();
  renderShell();
  // 처음 시작: 로그인 페이지(계정 서버가 있고, 로그인도 둘러보기도 안 했을 때) → 관심있는 대화 고르기
  const askLogin = SB.on() && !SB.s && !localStorage.getItem("hv1_guest") && !location.hash.startsWith("#r-");
  if (askLogin) { try { history.replaceState(null, "", location.pathname + location.search + "#login"); } catch {} }
  route();
  window.addEventListener("hashchange", route);
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
