/* 순수 상수: 응답 구분자(MARK), 상황 이름(SIT)·표지 색·무늬·장르 — 다른 모듈을 import하지 않음 */
export const MARK = "===STATE===";
export const SIT = ["프로필", "기본", "웃음", "부끄러움", "슬픔", "놀람", "분노", "삐침", "공포", "부상", "회복", "휴식", "공격", "각성", "설렘"];
export const SIT_TINT = ["#f5f0ff", "#9fb4ff", "#ffd166", "#ff8fab", "#7b96ff", "#ffe066", "#ff5d5d", "#c77dff", "#56cfe1", "#e63946", "#80ed99", "#a0c4ff", "#ff8c42", "#f9c74f", "#ff70a6"];
export const PALETTES = [
  ["#1d2735", "#3c5a73", "#c9a46a"], ["#2a1720", "#7a2e48", "#f0b7c8"], ["#151a2e", "#3b3f7a", "#d8c38a"], ["#16222a", "#2f6f73", "#f6d58e"],
  ["#24130f", "#8c3b22", "#f2c48d"], ["#1a1a17", "#5a5a3c", "#d4c25a"], ["#1b1030", "#5b2a86", "#ff8ad8"], ["#0f2420", "#1f5c4a", "#a8e6c1"]
];
export const MOTIFS = { rain: "비", city: "도시", stars: "별", glow: "불빛", petals: "꽃잎", ash: "잿빛", curtain: "무대" };
export const CATS = ["로맨스", "판타지", "RPG", "미스터리", "일상", "시뮬레이션"];
