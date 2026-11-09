/* 환경·연결: 서버 프록시·계정 서버 설정 CFG(window.HEARTVERSE_CONFIG) — 아무것도 import하지 않는 잎 모듈(다른 모듈이 맨 윗단에서 CFG를 써도 안전) */
/** @typedef {import("./types.js").Config} Config */
/* 배포 확장 지점: 이 파일보다 먼저 window.HEARTVERSE_CONFIG = { anthropicUrl, serverKeys } 를 넣으면
   API 주소를 서버 프록시로 바꿀 수 있음. serverKeys: true면 사용자 키 없이 호출하고(키는 프록시가 붙임) 키 입력 없이도 대화가 켜짐 */
export const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
// supabaseUrl·supabaseKey: 로그인·계정 저장용 Supabase 프로젝트(키는 publishable — 공개해도 되는 키, 데이터는 RLS로 본인만)
/** 연결 설정 — window.HEARTVERSE_CONFIG가 덮음(서버 프록시 배포 때). @type {Config} */
// chatUrl: 성인 트랙의 서버 대화 관문 주소(Supabase Edge Function "chat" — docs/edge/chat.ts). 비어 있으면 성인 트랙은 꺼져 있음(준비 중 안내)
export const CFG = Object.assign({ anthropicUrl: ANTHROPIC_URL, serverKeys: false, chatUrl: "",
  supabaseUrl: "https://mblvphojbmxiuqnlxisi.supabase.co", supabaseKey: "sb_publishable_Ob5V1vSGC1g6FTRjSKTjUg_rtpAaGuW" },
  typeof window !== "undefined" && window.HEARTVERSE_CONFIG && typeof window.HEARTVERSE_CONFIG === "object" ? window.HEARTVERSE_CONFIG : {});
