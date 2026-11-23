/* 작품별 표지 로고 설계(11차 — 2026-11-16 사용자 확정, 단체·상징물 표지는 11-20). ./logo.js의 drawLogo가 읽는 항목 목록이다. 좌표는 960×1280 기준.
   제목은 **작고 가는 획** — 굵은 테 없이 어두운 번짐(halo)과 은은한 빛번짐만 깔고, 흰색에서 작품 색으로 흐르는 칠, 작은 윗줄 + 큰 아랫줄을 살짝 엇갈려, 가는 장식선과 반짝이를 더한다.
   물린 것: 굵은 겹테(8~10차) · 글자마다 크기와 높이를 흔드는 방식(9차). 밝고 유쾌한 갈래(편의점·신님들·하숙집)만 스티커 글씨를 작고 얇게 유지한다.
   글꼴 배정(확정): 90일 = 고운바탕 + 플레이페어 숫자 + 디필레이아 · 금서고 = 함렛 · 탐정 = 나눔명조 · 찻집 = 나눔붓글씨 · 편의점 = 도현 · 대연궁 = 연성 · 레테 = 본명조 + Cinzel · 기사 = 송명
     · 십절곡 = 독도 + 연성 · 황후 = 고운바탕 · 신님들 = 검은고딕 · 하숙집 = 주아 · 민원실 = 본명조 + Cinzel · 백야호 = 나눔명조
     · F급 던전 = 도현 + Orbit(2026-11-23 설계 — 표지를 그린 뒤 사용자 확인 전)
   LOGOS[작품] = 항목 목록(장식 → 글자 순서) · LOGO_PAL[작품] = 로고에만 쓰는 색(없으면 작품 색 — 상징물 표지는 더 어두운 바탕색) · LOGO_SHADE = 아래쪽 그늘 */
export const LOGO_SHADE = { from: 0.62, a: 0.88 };
export const LOGO_PAL = { minwon: ["#0c1418", "#2f6f73", "#f6d58e"], baekya: ["#0d1322", "#3b3f7a", "#d8c38a"] };
const T = (t, font, px, x, y, o) => ({ k: "t", t, font, px, x, y, ...o });
const R = (x, y, w, h, o) => ({ k: "r", x, y, w, h, ...o });
const G = (x, y, rot, items, o) => ({ k: "g", x, y, rot, items, ...o });
// 칠: 흰색 → 옅은 작품 색 → 작품 색 / 빛번짐 색
const M = { gold: ["#ffffff", "#fff3cf", "#f3cf7a"], silver: ["#ffffff", "#eef3fa", "#b9c9de"], mint: ["#ffffff", "#e3fbf0", "#9fe3c2"], pink: ["#ffffff", "#ffe3ec", "#f59ab8"], peach: ["#ffffff", "#ffeeda", "#f2b77a"] };
const GLOW = { gold: "#f3c66a", silver: "#8fc0ff", mint: "#6fe0b0", pink: "#ff7fb0", peach: "#ff9d5c" };
const HALO = ["rgba(6,6,12,0.45)", 0.06, "rgba(0,0,0,0.9)", 20];
const hero = (t, font, px, x, y, m, o) => T(t, font, px, x, y, { fill: M[m], strokes: [HALO, [GLOW[m], 0.016, GLOW[m], 22]], glow: [GLOW[m], 10], ...o });
const sub = (t, font, px, x, y, m, o) => T(t, font, px, x, y, { fill: [M[m][0], M[m][1]], strokes: [["rgba(6,6,12,0.45)", 0.1, "rgba(0,0,0,0.9)", 12]], track: 0.12, ...o });
const spark = (x, y, s) => ({ k: "p", x, y, pts: [[0, -2.6 * s], [0.4 * s, -0.4 * s], [2.6 * s, 0], [0.4 * s, 0.4 * s], [0, 2.6 * s], [-0.4 * s, 0.4 * s], [-2.6 * s, 0], [-0.4 * s, -0.4 * s]], fill: "#fff", glow: ["#fff", 12] });
// 가는 장식선: 한 줄로 흐르는 곡선(끝이 말림) — 제목 아래를 받침
const flo = (x, y, w, c, rot) => ({ k: "d", x, y, rot, d: `M ${-w / 2} 6 C ${-w * 0.3} -8, ${-w * 0.05} 14, ${w * 0.18} 2 C ${w * 0.32} -6, ${w * 0.44} -2, ${w / 2} -12 C ${w * 0.52} -22, ${w * 0.45} -24, ${w * 0.44} -15`, stroke: [c, 1.8], glow: [c, 8] });
const line = (x, y, w, c) => ({ k: "l", x: x - w / 2, y, x2: w, y2: 0, stroke: [c, 1.5], alpha: 0.85 });
const curls = (cx, cy, w, c) => [{ k: "d", x: cx - w / 2, y: cy, d: "M 0 0 c -30 -6, -70 -34, -112 -14 c -22 12, -8 34, 8 22 c 10 -8, 2 -18, -6 -14", stroke: [c, 1.8], glow: [c, 8] }, { k: "d", x: cx - w / 2 - 20, y: cy + 14, d: "M 0 0 c -24 10, -60 8, -86 -6", stroke: [c, 1.2], alpha: 0.7 },
  { k: "d", x: cx + w / 2, y: cy, d: "M 0 0 c 30 6, 70 34, 112 14 c 22 -12, 8 -34, -8 -22 c -10 8, -2 18, 6 14", stroke: [c, 1.8], glow: [c, 8] }, { k: "d", x: cx + w / 2 + 20, y: cy - 14, d: "M 0 0 c 24 -10, 60 -8, 86 6", stroke: [c, 1.2], alpha: 0.7 }];
const arc = (cx, cy, r, c) => [{ k: "d", x: cx, y: cy, d: `M ${-r} 0 A ${r} ${r * 0.42} 0 0 1 ${r} 0`, stroke: [c, 1.4], alpha: 0.6, glow: [c, 6] }, { k: "d", x: cx, y: cy + 10, d: `M ${-r * 0.82} 0 A ${r * 0.82} ${r * 0.34} 0 0 1 ${r * 0.82} 0`, stroke: [c, 1], alpha: 0.4 }];
const star = (x, y, s) => ({ k: "p", x, y, pts: [[0, -4.2 * s], [0.3 * s, -0.3 * s], [2.2 * s, 0], [0.3 * s, 0.3 * s], [0, 4.2 * s], [-0.3 * s, 0.3 * s], [-2.2 * s, 0], [-0.3 * s, -0.3 * s]], fill: "#fff", glow: ["#fff", 18] });
const dust = (cx, cy, w, c) => [[-0.52, -0.5, 3], [-0.36, 0.62, 2], [-0.12, -0.78, 2.4], [0.2, 0.7, 2], [0.4, -0.66, 3], [0.56, 0.4, 2.2], [0.05, -0.95, 1.6], [-0.6, 0.2, 1.8]].map(([a, b, r]) => ({ k: "c", x: cx + a * w, y: cy + b * 90, r, fill: c, glow: [c, 10], alpha: 0.85 }));
const orn = (cx, cy, w, c, o = {}) => [...(o.arc ? arc(cx, cy - 78, w * 0.62, c) : []), ...(o.curl === 0 ? [] : curls(cx, cy, w, c)), ...dust(cx, cy, w, c), star(cx - w / 2 + 6, cy - 62, 7), star(cx + w / 2 + 14, cy + 46, 5)];
const ORN = { yunhaera: [505, 1128, 430, "#ffb3cd"], geumseo: [440, 1085, 470, "#f3cf7a", { arc: 1 }], seodoyun: [480, 1080, 400, "#b9c9de"], baekyeon: [520, 1135, 470, "#f2b77a", { curl: 0 }], daeyeon: [480, 1085, 500, "#b9c9de"], lethe: [480, 1085, 440, "#9fe3c2", { arc: 1 }], kael: [480, 1128, 660, "#f3cf7a", { arc: 1 }], sipjeol: [480, 1085, 440, "#f2b77a"], hwanghu: [480, 1128, 650, "#f3cf7a", { arc: 1 }], minwon: [480, 1080, 620, "#b9c9de"], baekya: [480, 1080, 420, "#b9c9de", { arc: 1 }] };
const LOGO = {
  // 계약 기간 / 90일 — 가는 이탤릭 숫자와 디필레이아
  yunhaera: [G(480, 1120, -4, [sub("계약 기간", "gowun", 50, -150, -118, "pink", { track: 0.2 }), hero("90", "play5", 215, -70, 0, "pink"), hero("일", "diph", 128, 150, 22, "pink"), flo(10, 104, 420, "#ffb3cd", 0)]), spark(205, 1030, 7), spark(745, 1085, 5), spark(640, 1215, 4)],
  // 금서고 / 의 사서 — 함렛 보통 굵기, 아랫줄을 오른쪽으로 엇갈림
  geumseo: [hero("금서고", "hahm5", 150, 440, 1085, "gold", { track: 0.04 }), sub("의 사서", "hahm5", 70, 640, 1186, "gold", { track: 0.1 }), flo(470, 1236, 440, "#f3cf7a", 0), spark(225, 1030, 7), spark(760, 1090, 5), spark(330, 1200, 4)],
  // 흑우 / 탐정사무소 — 나눔명조
  seodoyun: [hero("흑우", "nmj7", 170, 480, 1080, "silver", { track: 0.1 }), line(480, 1162, 300, "#b9c9de"), sub("탐정사무소", "nmj7", 50, 480, 1198, "silver", { track: 0.42 }), spark(640, 1010, 7), spark(300, 1125, 4)],
  // 여우가 내리는 / 차 — 붓글씨, 살짝 올려 씀
  baekyeon: [G(480, 1120, -5, [sub("여우가 내리는", "brush", 100, -130, -108, "peach", { track: 0.02 }), hero("차", "brush", 280, 185, 28, "peach"), flo(0, 122, 400, "#f2b77a", 0)]), spark(300, 1090, 7), spark(735, 1010, 5), spark(690, 1215, 4)],
  // 새벽 두 시의 / 편의점 — 밝은 작품은 스티커 글씨를 유지하되 작고 테를 얇게
  hangyeoul: [G(480, 1150, -4, [G(-205, -128, 0, [R(0, 0, 156, 42, { r: 9, fill: "#0d1114", glow: ["#0d1114", 14] }), T("AM 02:00", "orbit", 26, 0, 2, { fill: "#7dffb0" })]),
    T("새벽 두 시의", "dh", 62, -105, -72, { fill: ["#fff", "#d9ffee"], strokes: [["#0c2b22", 0.16, "#7dffb0", 16]] }), T("편의점", "dh", 150, 0, 30, { fill: ["#ffffff", "#ffffff", "#aef3d2"], strokes: [["#0c2b22", 0.13, "#7dffb0", 26], ["#1f7a5a", 0.06]] }), spark(215, -30, 6)])],
  // 대연궁 / 검시록 — 연성, 붉은 가는 줄
  daeyeon: [hero("대연궁", "yeon", 158, 480, 1085, "silver", { track: 0.06 }), line(480, 1166, 250, "#d2424c"), sub("검시록", "yeon", 62, 480, 1205, "gold", { track: 0.5 }), spark(250, 1020, 7), spark(730, 1110, 4)],
  // HOTEL / 레테 / 마흔아홉 번째 밤 — 본명조 중간 굵기, 넓은 자간
  lethe: [sub("HOTEL", "cinzel", 36, 480, 985, "mint", { track: 0.7 }), hero("레테", "serif6", 165, 480, 1085, "mint", { track: 0.22 }), line(480, 1168, 320, "#9fe3c2"), sub("마흔아홉 번째 밤", "serif6", 40, 480, 1204, "mint", { track: 0.3 }), spark(715, 1015, 7), spark(260, 1130, 4)],
  // 몰락한 제국의 / 마지막 기사 — 송명
  kael: [sub("몰락한 제국의", "song", 52, 400, 1035, "gold", { track: 0.16 }), hero("마지막 기사", "song", 128, 480, 1128, "gold", { track: 0.03, maxW: 660 }), flo(480, 1204, 500, "#f3cf7a", 0), spark(170, 1085, 7), spark(800, 1165, 5)],
  // ── 단체 표지 네 작품(같은 방식: 가는 획·빛 테두리·장식 / 밝고 유쾌한 갈래는 스티커 글씨를 작고 얇게)
  sipjeol: [hero("십절곡", "dokdo", 250, 480, 1085, "peach", { track: 0.04 }), line(480, 1166, 260, "#d2424c"), sub("백 일의 봉문", "yeon", 50, 480, 1204, "peach", { track: 0.3 }), spark(250, 1020, 7), spark(735, 1110, 4)],
  hwanghu: [sub("계약", "gowun", 54, 250, 1034, "gold", { track: 0.3 }), hero("황후의 백 일", "gowun", 122, 480, 1128, "gold", { track: 0.02, maxW: 660 }), flo(480, 1204, 500, "#f3cf7a", 0), spark(170, 1085, 7), spark(800, 1165, 5)],
  godseats: [G(480, 1150, -4, [G(-235, -132, 0, [R(0, 0, 120, 42, { r: 9, fill: "#ff2d55", glow: ["#ff2d55", 16] }), T("LIVE", "bhs", 28, 0, 2, { fill: "#fff" })]), T("신님들,", "bhs", 64, -150, -72, { fill: ["#fff", "#ffd6f1"], strokes: [["#2a0f3d", 0.16, "#ff8ad8", 16]] }),
    T("관전 매너 좀", "bhs", 128, 0, 30, { maxW: 640, fill: ["#ffffff", "#ffffff", "#ffc4ea"], strokes: [["#2a0f3d", 0.13, "#ff8ad8", 26], ["#7a2e9a", 0.06]] }), spark(300, -40, 6)])],
  hasuk: [G(480, 1150, -3, [T("서촌 오월", "jua", 64, -140, -76, { fill: ["#fffdf5", "#ffe9b8"], strokes: [["#3b2412", 0.16, "#ffcf7a", 16]] }), T("하숙집", "jua", 156, 0, 30, { fill: ["#fffdf5", "#fff3d0", "#ffc266"], strokes: [["#3b2412", 0.13, "#ffcf7a", 24], ["#8a4b22", 0.06]] }), spark(230, -30, 6)])],
  // F급 던전, 오늘도 / 영업합니다 — 간판 글씨(도현)로 '영업합니다'를 크게, 영업 중 팻말(OPEN)을 붙임. 작업등의 호박색(2026-11-23 설계)
  fdungeon: [G(480, 1150, -4, [G(-238, -134, 0, [R(0, 0, 124, 42, { r: 9, fill: "#17110a", glow: ["#17110a", 14] }), T("OPEN", "orbit", 26, 0, 2, { fill: "#ffcf6a" })]),
    T("F급 던전, 오늘도", "dh", 58, -62, -70, { fill: ["#fffdf5", "#ffeccc"], strokes: [["#3a1c0a", 0.16, "#ffb347", 16]] }),
    T("영업합니다", "dh", 128, 0, 26, { maxW: 640, fill: ["#ffffff", "#fff3d0", "#ffb347"], strokes: [["#3a1c0a", 0.13, "#ffb347", 26], ["#9a4a12", 0.06]] }), spark(272, -30, 6)])],
  // ── 상징물 표지 두 작품
  minwon: [hero("야간 민원실", "serif6", 118, 480, 1080, "silver", { track: 0.04, maxW: 660 }), line(480, 1160, 300, "#f3cf7a"), sub("B 1", "cinzel", 56, 480, 1204, "gold", { track: 0.5 }), spark(215, 1025, 7), spark(760, 1120, 4)],
  baekya: [hero("백야호", "nmj7", 168, 480, 1080, "silver", { track: 0.1 }), line(480, 1164, 300, "#b9c9de"), sub("열세 번째 겨울", "nmj7", 46, 480, 1202, "silver", { track: 0.36 }), spark(700, 1010, 7), spark(260, 1125, 4)],
};
export const LOGOS = Object.fromEntries(Object.keys(LOGO).map((id) => [id, [...(ORN[id] ? orn(...ORN[id]) : []), ...LOGO[id]]]));
