/* 순수 상수: 응답 구분자(MARK), 상황 이름(SIT)·표지 색·무늬·장르, 요금 상수 — 다른 모듈을 import하지 않음 */
export const MARK = "===STATE===";
/* 요금: 하루 무료 턴(라이트), 첫 방문 하트, PLUS 월 지급 하트 — 계산은 core/wallet.js, 모델 표(ai/models.js)도 이 값을 씀 */
export const FREE_DAILY = 10,
  WELCOME = 30,
  PLUS_MONTHLY = 300;
/* 네트워크 시간 제한(ms): connect 응답 머리가 올 때까지 · stall 스트림 조각 사이 · api Supabase 요청 하나. 넘으면 {code:"timeout"}(core/util.js timeoutSignal)
   think: 성인 트랙 관문에서 첫 글자가 올 때까지의 조각 사이 — 답 전에 오래 생각하는 모델이 있어 stall보다 넉넉히(첫 글자 뒤에는 stall) */
export const TIMEOUT = { connect: 45000, stall: 60000, think: 150000, api: 20000 };
export const SIT = ["프로필", "기본", "웃음", "부끄러움", "슬픔", "놀람", "분노", "삐침", "공포", "부상", "회복", "휴식", "공격", "각성", "설렘"];
/** 예약 시리즈(인물 코드로 못 씀): 코드 글자 → { kind 종류, field 작품의 목록 칸, label 사람이 보는 이름, nameKey 항목의 이름 칸 }. 번호는 목록의 n번째(1부터).
    해석은 images/codes.js(codebook·seriesCode)가 맡고, 표만 여기에 둠(core/rooms.js도 씀) */
export const SERIES = {
  MP: { kind: "place", field: "places", label: "장소", nameKey: "name" },
  EV: { kind: "cut", field: "cuts", label: "컷씬", nameKey: "title" }
};
export const SIT_TINT = [
  "#f5f0ff",
  "#9fb4ff",
  "#ffd166",
  "#ff8fab",
  "#7b96ff",
  "#ffe066",
  "#ff5d5d",
  "#c77dff",
  "#56cfe1",
  "#e63946",
  "#80ed99",
  "#a0c4ff",
  "#ff8c42",
  "#f9c74f",
  "#ff70a6"
];
export const PALETTES = [
  ["#1d2735", "#3c5a73", "#c9a46a"],
  ["#2a1720", "#7a2e48", "#f0b7c8"],
  ["#151a2e", "#3b3f7a", "#d8c38a"],
  ["#16222a", "#2f6f73", "#f6d58e"],
  ["#24130f", "#8c3b22", "#f2c48d"],
  ["#1a1a17", "#5a5a3c", "#d4c25a"],
  ["#1b1030", "#5b2a86", "#ff8ad8"],
  ["#0f2420", "#1f5c4a", "#a8e6c1"]
];
export const MOTIFS = { rain: "비", city: "도시", stars: "별", glow: "불빛", petals: "꽃잎", ash: "잿빛", curtain: "무대" };
export const CATS = ["로맨스", "판타지", "RPG", "미스터리", "일상", "시뮬레이션"];
/* 키워드북이 한 턴에 AI에게 넘기는 양(2026-11-09 사용자 결정 — 참고: 베이비챗 동시 5개·항목 500자): scan 최근 몇 개의 메시지에서 키워드를 찾는지 ·
   max·budget 상시(always) + 키워드로 걸린 항목을 합친 개수·글자 수 상한(넘치는 항목은 그 턴에 건너뜀 — ai/prompt/lore.js matchLore). 빌드가 상시 항목의 합을 이 값으로 검사 */
export const LORE = { scan: 3, max: 8, budget: 2500 };
/* 화면 예시 문구의 기본값 — 예시는 보고 있는 작품의 인물로 만들고(core/character.js exampleCast), 작품이 하나도 없을 때만 이 값. EXAMPLE_SIT은 예시에 쓰는 감정 번호 */
export const EXAMPLE_CAST = { code: "ABC", name: "주인공" },
  EXAMPLE_SIT = 3;
/* 작품이 제작자(work.js creator)를 적지 않았을 때 보이는 이름 */
/** 내 서재(찜·최근 본·수집 기록, core/shelf.js): recent 최근 본 작품을 몇 개까지 · syncFrom 계정에도 올리기 시작하는 날(개인정보처리방침 시행일과 같은 날 — 미루려면 이 날짜와 privacy.html의 시행일을 같이) */
export const SHELF = { recent: 12, syncFrom: "2026-11-23" };
/** 시작 상황 id 모양(work.js openings[].id): 영문 소문자로 시작하는 소문자·숫자·하이픈 2~24자. 대화방이 시작 상황을 제목이 아니라 이것으로 기억함 — 제목은 고쳐도 되고 id는 고치지 않음(순서 잠금이 지킴) */
export const OPENING_ID_RE = /^[a-z][a-z0-9-]{1,23}$/;
export const DEFAULT_CREATOR = "HEART SYNC 스튜디오";
/* 글자 수 상한 — 작품 데이터는 빌드가 검사하고(APP_RULES), 화면의 입력 칸은 maxlength와 "n / 한도"에 씀.
   guide 작품의 플레이 가이드(work.js guide) · personaDesc 페르소나 상세 정보 · userNote 유저노트(대화방마다 하나) ·
   memory 장기기억 기본 한도(무료 요금제 PLAN.free.memoMax와 요약 설정 memCfg.limit의 기본값 — 넘으면 압축, PLUS는 PLAN.pro.memoMax까지) ·
   pin 고정 기억 한 줄의 글자 수(개수는 요금제 PLAN.free/pro.pins — core/wallet.js) ·
   reply 즉답 명령어가 보여 주는 글(commands[].text) · suggestion 시작 상황의 첫 답변 추천 한 줄(openings[].suggestions — 최대 3개) · lead 시작 직후 연출 지시(openings[].lead.text)의 글자 수 ·
   leadTurns 그 지시가 이어질 수 있는 최대 턴 수 */
export const LIMITS = {
  guide: 1000,
  personaDesc: 1000,
  userNote: 2000,
  memory: 2000,
  pin: 200,
  reply: 1000,
  suggestion: 40,
  lead: 500,
  leadTurns: 20,
  reportQuote: 300
};
