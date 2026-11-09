/* 순수 상수: 응답 구분자(MARK), 상황 이름(SIT)·표지 색·무늬·장르, 요금 상수 — 다른 모듈을 import하지 않음 */
export const MARK = "===STATE===";
/* 요금: 하루 무료 턴(라이트), 첫 방문 하트, PLUS 월 지급 하트 — 계산은 core/wallet.js, 모델 표(ai/models.js)도 이 값을 씀 */
export const FREE_DAILY = 10, WELCOME = 30, PLUS_MONTHLY = 300;
/* 네트워크 시간 제한(ms): connect 응답 머리가 올 때까지 · stall 스트림 조각 사이 · api Supabase 요청 하나. 넘으면 {code:"timeout"}(core/util.js timeoutSignal) */
export const TIMEOUT = { connect: 45000, stall: 60000, api: 20000 };
export const SIT = ["프로필", "기본", "웃음", "부끄러움", "슬픔", "놀람", "분노", "삐침", "공포", "부상", "회복", "휴식", "공격", "각성", "설렘"];
export const SIT_TINT = ["#f5f0ff", "#9fb4ff", "#ffd166", "#ff8fab", "#7b96ff", "#ffe066", "#ff5d5d", "#c77dff", "#56cfe1", "#e63946", "#80ed99", "#a0c4ff", "#ff8c42", "#f9c74f", "#ff70a6"];
export const PALETTES = [
  ["#1d2735", "#3c5a73", "#c9a46a"], ["#2a1720", "#7a2e48", "#f0b7c8"], ["#151a2e", "#3b3f7a", "#d8c38a"], ["#16222a", "#2f6f73", "#f6d58e"],
  ["#24130f", "#8c3b22", "#f2c48d"], ["#1a1a17", "#5a5a3c", "#d4c25a"], ["#1b1030", "#5b2a86", "#ff8ad8"], ["#0f2420", "#1f5c4a", "#a8e6c1"]
];
export const MOTIFS = { rain: "비", city: "도시", stars: "별", glow: "불빛", petals: "꽃잎", ash: "잿빛", curtain: "무대" };
export const CATS = ["로맨스", "판타지", "RPG", "미스터리", "일상", "시뮬레이션"];
/* 작품이 제작자(work.js creator)를 적지 않았을 때 보이는 이름 */
export const DEFAULT_CREATOR = "HEART SYNC 스튜디오";
/* 글자 수 상한 — 작품 데이터는 빌드가 검사하고(APP_RULES), 화면의 입력 칸은 maxlength와 "n/한도"에 씀. guide: 작품의 플레이 가이드(work.js guide) */
export const LIMITS = { guide: 1000 };
