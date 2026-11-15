/* 표지 로고 그리기 — 표지 후처리까지 끝난 캔버스(960×1280) 위에 작품별 로고(./logos.js)를 얹는다(브라우저 캔버스). 2026-11-14 사용자와 여섯 차례 다듬음.
   로고는 줄 단위가 아니라 '항목'을 자유롭게 놓는다. 좌표는 960×1280 기준, 색에 숫자를 쓰면 작품 색 pal[n]([어두운, 중간, 강조]).
     공통: x, y, rot(도), skew, alpha, blend
     t 글자: t, font(FONTS의 열쇠), px, maxW(넘으면 줄임), fill(색 | [위, 아래] | null = 테만), strokes [[색, 두께(px 비율), 빛색, 빛번짐]] 바깥부터, shadow [색, dx, dy], glow [색, 번짐], track, vertical, lh
     e 이모티콘: ch, px · r 네모: w, h, r, fill, stroke [색, 두께], glow, dash · c 원: r · p 다각형: pts · l 선: x2, y2(상대) · stripes 줄무늬: w, h, c1, c2 · g 묶음: items(같이 옮기고 기울임)
   글꼴은 Google Fonts(모두 OFL)에서 받는다. 이모티콘은 그 PC의 글꼴로 그려진다(Windows는 Segoe UI Emoji) — PC가 바뀌면 모양이 달라진다(../README.md '남은 과제') */
export const FONT_FAMILIES = ["Black+Han+Sans", "Do+Hyeon", "Gowun+Batang:wght@700", "Noto+Serif+KR:wght@900", "Cinzel:wght@700", "Orbitron:wght@800", "Playfair+Display:ital,wght@1,900"];
export const FONTS_URL = "https://fonts.googleapis.com/css2?" + FONT_FAMILIES.map((f) => "family=" + f).join("&") + "&display=swap";
const EMOJI = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
const FONTS = { bhs: '400 PXpx "Black Han Sans"', dh: '400 PXpx "Do Hyeon"', gowun: '700 PXpx "Gowun Batang"', serif: '900 PXpx "Noto Serif KR"', cinzel: '700 PXpx "Cinzel"', orbit: '800 PXpx "Orbitron"', play: 'italic 900 PXpx "Playfair Display"' };
const fontOf = (k, px) => {
  if (!FONTS[k]) throw new Error("없는 글꼴 열쇠예요: " + k);
  return FONTS[k].replace("PX", px) + ", " + EMOJI;
};
const C = (c, pal) => (typeof c === "number" ? pal[c] : c);
const fillOf = (g, f, pal, y0, y1) => {
  if (!Array.isArray(f)) return C(f, pal);
  const gr = g.createLinearGradient(0, y0, 0, y1);
  f.forEach((c, i) => gr.addColorStop(i / (f.length - 1), C(c, pal)));
  return gr;
};
function paint(g, it, pal, y0, y1) {
  if (it.glow) {
    g.shadowColor = C(it.glow[0], pal);
    g.shadowBlur = it.glow[1];
  }
  if (it.fill !== undefined && it.fill !== null) {
    g.fillStyle = fillOf(g, it.fill, pal, y0, y1);
    g.fill();
  }
  g.shadowBlur = 0;
  if (it.stroke) {
    g.strokeStyle = C(it.stroke[0], pal);
    g.lineWidth = it.stroke[1];
    g.lineCap = "round";
    if (it.dash) g.setLineDash(it.dash);
    g.stroke();
    g.setLineDash([]);
  }
}
async function text(g, it, pal) {
  let px = it.px;
  const key = it.font || "bhs";
  await document.fonts.load(fontOf(key, 40), it.t); // 그 글자가 든 글꼴 조각을 받아 둠
  const set = () => {
    g.font = fontOf(key, px);
    if ("letterSpacing" in g) g.letterSpacing = (it.track || 0) * px + "px";
  };
  set();
  if (it.maxW && !it.vertical) {
    const wd = g.measureText(it.t).width;
    if (wd > it.maxW) ((px *= it.maxW / wd), set());
  }
  g.textAlign = it.align || "center";
  g.textBaseline = "middle";
  g.lineJoin = "round";
  g.miterLimit = 2;
  const chars = it.vertical ? [...it.t.replace(/ /g, "")] : [it.t],
    lh = px * (it.lh || 1.04);
  const each = (fn) => chars.forEach((ch, i) => fn(ch, it.vertical ? (i - (chars.length - 1) / 2) * lh : 0));
  if (it.shadow)
    each((ch, y) => {
      g.fillStyle = g.strokeStyle = C(it.shadow[0], pal);
      g.lineWidth = px * ((it.strokes && it.strokes[0][1]) || 0.02);
      g.strokeText(ch, px * it.shadow[1], y + px * it.shadow[2]);
      g.fillText(ch, px * it.shadow[1], y + px * it.shadow[2]);
    });
  for (const [c, wd, gc, gb] of it.strokes || [])
    each((ch, y) => {
      if (gc !== undefined) ((g.shadowColor = C(gc, pal)), (g.shadowBlur = gb));
      g.strokeStyle = C(c, pal);
      g.lineWidth = px * wd;
      g.strokeText(ch, 0, y);
      g.shadowBlur = 0;
    });
  if (it.fill !== null)
    each((ch, y) => {
      if (it.glow) ((g.shadowColor = C(it.glow[0], pal)), (g.shadowBlur = it.glow[1]));
      g.fillStyle = fillOf(g, it.fill === undefined ? "#fff" : it.fill, pal, y - px / 2, y + px / 2);
      g.fillText(ch, 0, y);
      g.shadowBlur = 0;
    });
  if ("letterSpacing" in g) g.letterSpacing = "0px";
}
async function item(g, it, pal) {
  g.save();
  g.translate(it.x || 0, it.y || 0);
  if (it.rot) g.rotate((it.rot * Math.PI) / 180);
  if (it.skew) g.transform(1, 0, it.skew, 1, 0, 0);
  if (it.alpha !== undefined) g.globalAlpha *= it.alpha;
  if (it.blend) g.globalCompositeOperation = it.blend;
  if (it.k === "g") for (const c of it.items) await item(g, c, pal);
  else if (it.k === "t") await text(g, it, pal);
  else if (it.k === "e") {
    g.font = `${it.px}px ${EMOJI}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.shadowColor = "rgba(0,0,0,.55)";
    g.shadowBlur = it.px * 0.1;
    g.fillStyle = "#fff";
    g.fillText(it.ch, 0, 0);
  } else if (it.k === "r") {
    g.beginPath();
    g.roundRect(-it.w / 2, -it.h / 2, it.w, it.h, it.r || 0);
    paint(g, it, pal, -it.h / 2, it.h / 2);
  } else if (it.k === "c") {
    g.beginPath();
    g.arc(0, 0, it.r, 0, 6.2832);
    paint(g, it, pal, -it.r, it.r);
  } else if (it.k === "p") {
    g.beginPath();
    it.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    const ys = it.pts.map((p) => p[1]);
    paint(g, it, pal, Math.min(...ys), Math.max(...ys));
  } else if (it.k === "l") {
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(it.x2, it.y2);
    paint(g, it, pal, 0, 1);
  } else if (it.k === "stripes") {
    const wd = it.w,
      h = it.h,
      s = h * 1.2;
    g.beginPath();
    g.rect(-wd / 2, -h / 2, wd, h);
    g.clip();
    g.fillStyle = it.c2;
    g.fillRect(-wd / 2, -h / 2, wd, h);
    g.fillStyle = it.c1;
    for (let x = -wd / 2 - h; x < wd / 2 + h; x += s * 2) {
      g.beginPath();
      g.moveTo(x, h / 2);
      g.lineTo(x + s, h / 2);
      g.lineTo(x + s + h, -h / 2);
      g.lineTo(x + h, -h / 2);
      g.closePath();
      g.fill();
    }
  } else throw new Error("없는 항목 종류예요: " + it.k);
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
  await new Promise((res) => ((l.onload = res), (l.onerror = res)));
}
/** 캔버스(960×1280)에 로고를 얹는다. 먼저 아래쪽 절반을 작품의 어두운 색으로 덮어 글자가 읽히게 한다(shade: 시작 높이 비율·진하기) */
export async function drawLogo(cv, items, pal, shade = { from: 0.5, a: 0.9 }) {
  const g = cv.getContext("2d"),
    W = cv.width,
    H = cv.height;
  const sh = g.createLinearGradient(0, H * shade.from, 0, H);
  sh.addColorStop(0, "rgba(0,0,0,0)");
  sh.addColorStop(1, pal[0]);
  g.globalAlpha = shade.a;
  g.fillStyle = sh;
  g.fillRect(0, H * shade.from, W, H * (1 - shade.from));
  g.globalAlpha = 1;
  for (const it of items) await item(g, it, pal);
  return cv;
}
