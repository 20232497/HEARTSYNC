/* 환경·연결: 서버 프록시 설정 CFG(window.HEARTVERSE_CONFIG), claude.ai 안인지(IN_CLAUDE) — 아무것도 import하지 않는 잎 모듈(다른 모듈이 맨 윗단에서 CFG를 써도 안전) */
/** @typedef {import("./types.js").Config} Config */
/* 배포 확장 지점: 이 파일보다 먼저 window.HEARTVERSE_CONFIG = { anthropicUrl, runwareUrl, openRouterUrl, serverKeys } 를 넣으면
   API 주소를 서버 프록시로 바꿀 수 있음. serverKeys: true면 사용자 키 없이 호출하고(키는 프록시가 붙임) 키 입력 없이도 대화·이미지 생성이 켜짐 */
export const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
// supabaseUrl·supabaseKey: 로그인·계정 저장용 Supabase 프로젝트(키는 publishable — 공개해도 되는 키, 데이터는 RLS로 본인만)
// idv: 휴대폰 성인 인증(PortOne). mode off 자기 확인 그대로 · test 시험 채널 결과도 인정 · live 실제 채널 결과만. storeId·channelKey는 브라우저에 넣으라고 만든 공개 값(API Secret은 Supabase 함수에만 — docs/SETUP.md)
/** 연결 설정 — window.HEARTVERSE_CONFIG가 덮음(서버 프록시 배포 때). @type {Config} */
export const CFG = Object.assign({ anthropicUrl: ANTHROPIC_URL, runwareUrl: "https://api.runware.ai/v1", openRouterUrl: "https://openrouter.ai/api/v1/chat/completions", serverKeys: false,
  supabaseUrl: "https://mblvphojbmxiuqnlxisi.supabase.co", supabaseKey: "sb_publishable_Ob5V1vSGC1g6FTRjSKTjUg_rtpAaGuW",
  idv: { mode: "off", storeId: "", channelKey: "" } },
  window.HEARTVERSE_CONFIG && typeof window.HEARTVERSE_CONFIG === "object" ? window.HEARTVERSE_CONFIG : {});
/** 휴대폰 성인 인증을 쓰는지(모드·상점·채널이 다 있을 때). @returns {boolean} */
export const idvOn = () => !!(CFG.idv && (CFG.idv.mode === "test" || CFG.idv.mode === "live") && CFG.idv.storeId && CFG.idv.channelKey);
/* ---------------------------------------------------------------- 성인 모드
   claude.ai 안(아티팩트)에서는 켜지 않음. 성인 서사는 OpenRouter 모델로만 보내고 Claude에는 성인 지시를 보내지 않음.
   미성년(19세 미만·학생·아동) 암시는 수위와 상관없이 성인 경로·우회·성인 수위 그림에서 뺌 */
export const IN_CLAUDE = !!(window.claude && typeof window.claude.use === "function");
