/* ---------------------------------------------------------------- 상수 */
const MARK = "===STATE===";
/* 배포 확장 지점: 이 파일보다 먼저 window.HEARTVERSE_CONFIG = { anthropicUrl, runwareUrl, openRouterUrl, serverKeys } 를 넣으면
   API 주소를 서버 프록시로 바꿀 수 있음. serverKeys: true면 사용자 키 없이 호출하고(키는 프록시가 붙임) 키 입력 없이도 대화·이미지 생성이 켜짐 */
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
// supabaseUrl·supabaseKey: 로그인·계정 저장용 Supabase 프로젝트(키는 publishable — 공개해도 되는 키, 데이터는 RLS로 본인만)
const CFG = Object.assign({ anthropicUrl: ANTHROPIC_URL, runwareUrl: "https://api.runware.ai/v1", openRouterUrl: "https://openrouter.ai/api/v1/chat/completions", serverKeys: false,
  supabaseUrl: "https://mblvphojbmxiuqnlxisi.supabase.co", supabaseKey: "sb_publishable_Ob5V1vSGC1g6FTRjSKTjUg_rtpAaGuW" },
  window.HEARTVERSE_CONFIG && typeof window.HEARTVERSE_CONFIG === "object" ? window.HEARTVERSE_CONFIG : {});
const hasClaudeKey = () => !!S.settings.apiKey || !!CFG.serverKeys;
const hasRunwareKey = () => !!S.settings.runwareKey || !!CFG.serverKeys;
const hasOpenRouterKey = () => !!S.settings.openRouterKey || !!CFG.serverKeys;
/* 성인 모드(OpenRouter) 등급별 모델: 라이트=quick, 스토리=default, 마스터=complex.
   마스터는 DeepSeek V3 — Magnum V4 72B(제공자 Mancer 하나)는 2026-11 시험에서 한국어가 깨지거나(3/3) 같은 줄을 되풀이하고 상태창을 안 쓰며 한 턴에 2분 걸려 뺌(직접 입력으로는 고를 수 있음) */
const OR_TIER = { quick: "thedrummer/rocinante-12b", default: "nousresearch/hermes-3-llama-3.1-70b", complex: "deepseek/deepseek-chat-v3-0324" };
// 샘플링을 안 보내면 제공자 기본값(높은 temperature)으로 한국어가 일본어·중국어·코드 조각으로 깨짐 → 늘 보냄(모르는 값은 OpenRouter가 뺌)
const OR_SAMPLING = { temperature: 0.8, top_p: 0.92, min_p: 0.05, repetition_penalty: 1.05 };
// 그림 태그 번역: 지시를 잘 따르는 순서. Hermes 3는 머리색 같은 없는 외모를 지어내서 쓰지 않음
const OR_TAG_MODELS = ["deepseek/deepseek-chat-v3-0324", "thedrummer/unslopnemo-12b"];
// 등급 모델을 OpenRouter가 못 줄 때(제공자 없음 등) 한 번 대신 쓰는 모델. Rocinante 12B는 2026-10 기준 제공자가 없음
const OR_BACKUP = { quick: "thedrummer/unslopnemo-12b" };
const OR_PRESETS = [["deepseek/deepseek-chat-v3-0324", "DeepSeek V3"], ["nousresearch/hermes-3-llama-3.1-70b", "Hermes 3 70B"], ["anthracite-org/magnum-v4-72b", "Magnum V4 72B"], ["meta-llama/llama-3.3-70b-instruct", "Llama 3.3 70B"]];
const OR_NAMES = Object.fromEntries([...OR_PRESETS, ["thedrummer/rocinante-12b", "Rocinante 12B"], ["thedrummer/unslopnemo-12b", "UnslopNemo 12B"]]);
const orModel = (tier) => String(S.settings.customUnfilteredModel || "").trim() || S.settings.unfilteredModels?.[tier] || OR_TIER[tier] || OR_TIER.default;
const orName = (id) => OR_NAMES[id] || String(id).split("/").pop();
const FREE_DAILY = 10, WELCOME = 30, PLUS_MONTHLY = 300;
const PLAN = { free: { memTurns: 20, memoMax: 3000, hist: 5, rooms: 3 }, pro: { memTurns: 40, memoMax: 10000, hist: 20, rooms: 99 } };
const MODELS = {
  lite:   { tier: "quick",   name: "라이트", badge: "매일 무료 " + FREE_DAILY + "턴", desc: "빠르고 가벼운 일상 대화", base: 1, memStep: 0 },
  story:  { tier: "default", name: "스토리", badge: "추천", desc: "풍부한 묘사와 안정적인 캐릭터 연기", base: 4, memStep: 1 },
  master: { tier: "complex", name: "마스터", badge: "최고 품질", desc: "한 편의 소설 같은 몰입감. 복잡한 세계관과 전투 계산에 강해요", base: 8, memStep: 2 }
};
// chars는 본문 분량, lines는 한 응답에 넣을 대사 줄 수(대화가 자주 오가게), tokens는 상태 JSON까지 담을 출력 한도
const LEN = { short: { name: "적게", mul: 0.75, desc: "짧고 빠른 티키타카", chars: "500~800자", lines: 4, tokens: 2000 },
  mid: { name: "보통", mul: 1, desc: "지문과 대사가 균형 있게", chars: "1000~1500자", lines: 6, tokens: 3200 },
  long: { name: "많게", mul: 1.5, desc: "소설처럼 길고 풍성하게", chars: "1800~2600자", lines: 10, tokens: 5000 } };
const SIT = ["프로필", "기본", "웃음", "부끄러움", "슬픔", "놀람", "분노", "삐침", "공포", "부상", "회복", "휴식", "공격", "각성", "설렘"];
const SIT_TINT = ["#f5f0ff", "#9fb4ff", "#ffd166", "#ff8fab", "#7b96ff", "#ffe066", "#ff5d5d", "#c77dff", "#56cfe1", "#e63946", "#80ed99", "#a0c4ff", "#ff8c42", "#f9c74f", "#ff70a6"];
const PALETTES = [
  ["#1d2735", "#3c5a73", "#c9a46a"], ["#2a1720", "#7a2e48", "#f0b7c8"], ["#151a2e", "#3b3f7a", "#d8c38a"], ["#16222a", "#2f6f73", "#f6d58e"],
  ["#24130f", "#8c3b22", "#f2c48d"], ["#1a1a17", "#5a5a3c", "#d4c25a"], ["#1b1030", "#5b2a86", "#ff8ad8"], ["#0f2420", "#1f5c4a", "#a8e6c1"]
];
const MOTIFS = { rain: "비", city: "도시", stars: "별", glow: "불빛", petals: "꽃잎", ash: "잿빛", curtain: "무대" };
const CATS = ["로맨스", "판타지", "RPG", "미스터리", "일상", "시뮬레이션"];
/* 관심있는 대화(S.settings.audience): all 전체 · m 남성향(여성 캐릭터와의 대화) · f 여성향(남성 캐릭터와의 대화).
   작품의 aud가 없으면(예전 내 작품·커뮤니티) 출연진 외모의 성별로 짐작 — 여자만이면 m, 남자만이면 f, 섞이거나 모르면 all(전체에서만 보임) */
const AUDS = { all: { name: "전체", desc: "남녀 캐릭터" }, m: { name: "남성향", desc: "여성 캐릭터" }, f: { name: "여성향", desc: "남성 캐릭터" } };
function guessAud(c) {
  let f = 0, m = 0;
  (Array.isArray(c.cast) && c.cast.length ? c.cast : [{ code: "c", name: c.name, look: "" }]).forEach((x) => {
    const l = castLook(x, c);
    if (/여성|여자|\b(?:female|woman|girl)\b/i.test(l)) f++; else if (/남성|남자|\b(?:male|man|boy)\b/i.test(l)) m++;
  });
  return f && !m ? "m" : m && !f ? "f" : "all";
}
const audOf = (c) => !c ? "all" : AUDS[c.aud] ? c.aud : guessAud(c);
const audience = () => AUDS[S.settings.audience] ? S.settings.audience : "all";
const audOK = (c) => audience() === "all" || audOf(c) === audience();
