/* 표지 로고 그리기 — 표지 후처리까지 끝난 캔버스(960×1280) 위에 작품별 로고(./logos.js)를 얹는다(브라우저 캔버스). 2026-11-16 사용자와 열한 차례 다듬은 엔진.
   줄 단위가 아니라 '항목'을 자유롭게 놓는다: 글자·이모티콘·네모·원·다각형·곡선(SVG 경로)·선·줄무늬·묶음(같이 기울임). 좌표는 960×1280 기준.
     공통: x, y, rot(도), skew, scale, alpha, blend · 색에 숫자를 쓰면 작품 색 pal[n](0 어두운 · 1 중간 · 2 강조)
     t 글자: t, font(FONTS의 키), px, maxW, fill(색 | [위…아래] | null), strokes[[색, 두께(px 비율), 빛색, 빛번짐]] 바깥부터, shadow[색, dx, dy], glow[색, 번짐], track 자간, vertical, lh, per 글자마다 [크기, 높이, 기울기]
     e 이모티콘: ch, px · r 네모: w, h, r, fill, stroke[색, 두께], glow · c 원: r · p 다각형: pts · d 곡선: d(SVG 경로) · l 선: x2, y2(상대) · stripes: w, h, c1, c2 · g 묶음: items
   글꼴은 Google Fonts(한글 웹폰트) — loadLogoFonts()가 한 번 건다. 못 불러온 글꼴은 missingFonts()로 알 수 있다(기본 글꼴로 그려지니 그 그림은 쓰지 않는다). 앱은 이 파일을 쓰지 않는다 */
export const FONT_FAMILIES = ["Black+Han+Sans","Do+Hyeon","Jua","East+Sea+Dokdo","Song+Myung","Gowun+Batang:wght@700","Noto+Serif+KR:wght@600","Nanum+Brush+Script","Yeon+Sung","Diphylleia","Hahmlet:wght@500","Nanum+Myeongjo:wght@700","Cinzel:wght@700","Orbitron:wght@800","Playfair+Display:ital,wght@1,500"];
export const FONTS_URL = "https://fonts.googleapis.com/css2?" + FONT_FAMILIES.map((f) => "family=" + f).join("&") + "&display=swap";
const W = 960,
  H = 1280;
const missing = new Set();
/** 그리는 동안 못 불러온 글꼴의 키 */
export const missingFonts = () => [...missing];
const EMOJI = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
const FONTS = { bhs: '400 PXpx "Black Han Sans"', dh: '400 PXpx "Do Hyeon"', jua: '400 PXpx "Jua"', dokdo: '400 PXpx "East Sea Dokdo"', song: '400 PXpx "Song Myung"', gowun: '700 PXpx "Gowun Batang"', serif6: '600 PXpx "Noto Serif KR"',
  brush: '400 PXpx "Nanum Brush Script"', yeon: '400 PXpx "Yeon Sung"', diph: '400 PXpx "Diphylleia"', hahm5: '500 PXpx "Hahmlet"', nmj7: '700 PXpx "Nanum Myeongjo"', play5: 'italic 500 PXpx "Playfair Display"', cinzel: '700 PXpx "Cinzel"', orbit: '800 PXpx "Orbitron"' };
const fontOf = (k, px) => FONTS[k].replace("PX", px) + ", " + EMOJI;
const C = (c, pal) => (typeof c === "number" ? pal[c] : c);
const fillOf = (g, f, pal, y0, y1) => { if (!Array.isArray(f)) return C(f, pal); const gr = g.createLinearGradient(0, y0, 0, y1); f.forEach((c, i) => gr.addColorStop(i / (f.length - 1), C(c, pal))); return gr; };
function paint(g, it, pal, y0, y1) {
  if (it.glow) { g.shadowColor = C(it.glow[0], pal); g.shadowBlur = it.glow[1]; }
  if (it.fill !== undefined && it.fill !== null) { g.fillStyle = fillOf(g, it.fill, pal, y0, y1); g.fill(); }
  g.shadowBlur = 0;
  if (it.stroke) { g.strokeStyle = C(it.stroke[0], pal); g.lineWidth = it.stroke[1]; g.lineCap = "round"; if (it.dash) g.setLineDash(it.dash); g.stroke(); g.setLineDash([]); }
}
async function text(g, it, pal) {
  let px = it.px; const key = it.font || "bhs"; if (!FONTS[key]) throw new Error("없는 글꼴 키: " + key);
  // 웹폰트는 글자 묶음별로 나뉘어 온다 → 이 글자들로 불러오고 이 글자들로 확인한다(다른 글자로 확인하면 멀쩡한 글꼴도 없는 것으로 나옴)
  await document.fonts.load(fontOf(key, 40), it.t); if (!document.fonts.check(FONTS[key].replace("PX", 40), it.t)) missing.add(key);
  const set = () => { g.font = fontOf(key, px); if ("letterSpacing" in g) g.letterSpacing = (it.track || 0) * px + "px"; };
  set(); if (it.maxW && !it.vertical) { const w = g.measureText(it.t).width; if (w > it.maxW) { px *= it.maxW / w; set(); } }
  g.textAlign = it.align || "center"; g.textBaseline = "middle"; g.lineJoin = "round"; g.miterLimit = 2;
  const chars = it.vertical ? [...it.t.replace(/ /g, "")] : [it.t], lh = px * (it.lh || 1.04);
  let each = (fn) => chars.forEach((ch, i) => fn(ch, it.vertical ? (i - (chars.length - 1) / 2) * lh : 0));
  if (it.per) { const cs = [...it.t], P = (i) => it.per[i] || [1, 0, 0]; let ws, tot;
    const meas = () => { ws = cs.map((ch, i) => { g.font = fontOf(key, px * P(i)[0]); return g.measureText(ch).width * (1 + (it.gap || 0)); }); tot = ws.reduce((a, b) => a + b, 0); };
    meas(); if (it.maxW && tot > it.maxW) { px *= it.maxW / tot; meas(); }
    let x = -tot / 2; const gl = cs.map((ch, i) => { const o = { ch, x: x + ws[i] / 2, y: px * (P(i)[1] || 0), s: P(i)[0], rot: P(i)[2] || 0 }; x += ws[i]; return o; }); const base = px;
    each = (fn) => gl.forEach((o) => { g.save(); g.translate(o.x, o.y); if (o.rot) g.rotate((o.rot * Math.PI) / 180); px = base * o.s; g.font = fontOf(key, px); fn(o.ch, 0); g.restore(); px = base; }); }
  if (it.shadow) each((ch, y) => { g.fillStyle = g.strokeStyle = C(it.shadow[0], pal); g.lineWidth = px * ((it.strokes && it.strokes[0][1]) || 0.02); const dx = px * it.shadow[1], dy = px * it.shadow[2]; g.strokeText(ch, dx, y + dy); g.fillText(ch, dx, y + dy); });
  for (const [c, w, gc, gb] of it.strokes || []) each((ch, y) => { if (gc !== undefined) { g.shadowColor = C(gc, pal); g.shadowBlur = gb; } g.strokeStyle = C(c, pal); g.lineWidth = px * w; g.strokeText(ch, 0, y); g.shadowBlur = 0; });
  if (it.fill !== null) each((ch, y) => { if (it.glow) { g.shadowColor = C(it.glow[0], pal); g.shadowBlur = it.glow[1]; } g.fillStyle = fillOf(g, it.fill === undefined ? "#fff" : it.fill, pal, y - px / 2, y + px / 2); g.fillText(ch, 0, y); g.shadowBlur = 0; });
  if ("letterSpacing" in g) g.letterSpacing = "0px";
}
async function item(g, it, pal) {
  g.save(); g.translate(it.x || 0, it.y || 0); if (it.rot) g.rotate((it.rot * Math.PI) / 180); if (it.skew) g.transform(1, 0, it.skew, 1, 0, 0); if (it.scale) g.scale(it.scale, it.scale);
  if (it.alpha !== undefined) g.globalAlpha *= it.alpha; if (it.blend) g.globalCompositeOperation = it.blend;
  if (it.k === "g") for (const c of it.items) await item(g, c, pal);
  else if (it.k === "t") await text(g, it, pal);
  else if (it.k === "e") { g.font = `${it.px}px ${EMOJI}`; g.textAlign = "center"; g.textBaseline = "middle"; g.shadowColor = "rgba(0,0,0,.55)"; g.shadowBlur = it.px * 0.1; g.fillStyle = "#fff"; g.fillText(it.ch, 0, 0); }
  else if (it.k === "r") { g.beginPath(); g.roundRect(-it.w / 2, -it.h / 2, it.w, it.h, it.r || 0); paint(g, it, pal, -it.h / 2, it.h / 2); }
  else if (it.k === "c") { g.beginPath(); g.arc(0, 0, it.r, 0, 6.2832); paint(g, it, pal, -it.r, it.r); }
  else if (it.k === "p") { g.beginPath(); it.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); if (!it.open) g.closePath(); const ys = it.pts.map((p) => p[1]); paint(g, it, pal, Math.min(...ys), Math.max(...ys)); }
  else if (it.k === "d") { const p = new Path2D(it.d); if (it.glow) { g.shadowColor = C(it.glow[0], pal); g.shadowBlur = it.glow[1]; } if (it.fill) { g.fillStyle = fillOf(g, it.fill, pal, -40, 40); g.fill(p); } if (it.stroke) { g.strokeStyle = C(it.stroke[0], pal); g.lineWidth = it.stroke[1]; g.lineCap = "round"; g.stroke(p); } g.shadowBlur = 0; }
  else if (it.k === "l") { g.beginPath(); g.moveTo(0, 0); g.lineTo(it.x2, it.y2); paint(g, it, pal, 0, 1); }
  else if (it.k === "stripes") { const w = it.w, h = it.h, s = h * 1.2; g.beginPath(); g.rect(-w / 2, -h / 2, w, h); g.clip(); g.fillStyle = it.c2; g.fillRect(-w / 2, -h / 2, w, h); g.fillStyle = it.c1;
    for (let x = -w / 2 - h; x < w / 2 + h; x += s * 2) { g.beginPath(); g.moveTo(x, h / 2); g.lineTo(x + s, h / 2); g.lineTo(x + s + h, -h / 2); g.lineTo(x + h, -h / 2); g.closePath(); g.fill(); } }
  g.restore();
}

/** 글꼴 묶음을 문서에 건다(한 번만) — 로고를 그리기 전에 부른다 */
export async function loadLogoFonts(doc = document) {
  if (doc.getElementById("hs-logo-fonts")) return;
  const l = doc.createElement("link");
  l.id = "hs-logo-fonts";
  l.rel = "stylesheet";
  l.href = FONTS_URL;
  doc.head.appendChild(l);
  await new Promise((res) => {
    l.onload = res;
    l.onerror = res;
  });
}
/** 캔버스(960×1280)에 로고를 얹는다. 먼저 아래쪽을 작품의 어두운 색으로 덮어 글자가 읽히게 한다(shade: 시작 높이 비율·진하기) */
export async function drawLogo(cv, items, pal, shade = { from: 0.62, a: 0.88 }) {
  const g = cv.getContext("2d");
  missing.clear(); // 이번에 그리는 로고의 글꼴만 본다
  g.save();
  g.scale(cv.width / W, cv.height / H);
  const sh = g.createLinearGradient(0, H * shade.from, 0, H);
  sh.addColorStop(0, "rgba(0,0,0,0)");
  sh.addColorStop(1, pal[0]);
  g.globalAlpha = shade.a;
  g.fillStyle = sh;
  g.fillRect(0, H * shade.from, W, H * (1 - shade.from));
  g.globalAlpha = 1;
  for (const it of items) await item(g, it, pal);
  g.restore();
  return cv;
}
