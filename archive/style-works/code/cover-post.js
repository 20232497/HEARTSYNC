/* 표지 후처리 — 화풍 후처리(style-*/code/post.js)까지 끝난 표지 그림 위에 한 번 더 입힌다(브라우저 캔버스). 2026-11-14 사용자가 네 단계를 보고 '빛 번짐과 입자까지'를 고름.
   색·대비를 조금 올리고(filter) → 밝은 곳이 번지게(bloom) → 작품 색(pal: [어두운, 중간, 강조])을 위에서 아래로 은은하게(grade) → 작품 무늬(motif)의 입자 → 가장자리를 작품의 어두운 색으로(vignette).
   ctx.filter를 쓴다 — Safari에서는 안 되니 그림을 만드는 PC의 크롬 계열에서만 돌린다(앱은 이 파일을 쓰지 않는다) */
export const COVER_POST = { filter: "saturate(1.18) contrast(1.14)", bloom: { k: 5, a: 0.28 }, grade: 0.3, vignette: 0.5, particles: true };
export const COVER_W = 960,
  COVER_H = 1280;

const star = (g, x, y, s) => {
  g.beginPath();
  for (const [dx, dy] of [[0, -2.4], [0.5, -0.5], [2.4, 0], [0.5, 0.5], [0, 2.4], [-0.5, 0.5], [-2.4, 0], [-0.5, -0.5]]) g.lineTo(x + dx * s, y + dy * s);
  g.closePath();
  g.fill();
};
/* 무늬별 입자(늘 같은 자리 — 씨앗 고정): rain 빗줄기 · petals 꽃잎 · stars/curtain 별빛 · ash 재 · glow/city 빛망울 */
function particles(g, motif, pal, W, H) {
  let s = 12345;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const n = { petals: 40, stars: 60, glow: 30, rain: 80, ash: 70, city: 36, curtain: 44 }[motif] || 36;
  g.save();
  g.globalCompositeOperation = "screen";
  for (let i = 0; i < n; i++) {
    const x = rnd() * W,
      y = rnd() * H * (motif === "rain" ? 1 : 0.9),
      r = rnd();
    if (motif === "rain") {
      g.strokeStyle = `rgba(200,220,255,${0.1 + r * 0.2})`;
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x - 14 - r * 20, y + 60 + r * 80);
      g.stroke();
    } else if (motif === "petals") {
      g.save();
      g.translate(x, y);
      g.rotate(r * 6.28);
      g.fillStyle = pal[2];
      g.globalAlpha = 0.3 + r * 0.4;
      g.beginPath();
      g.ellipse(0, 0, 6 + r * 12, 3 + r * 5, 0, 0, 6.28);
      g.fill();
      g.restore();
    } else if (motif === "stars" || motif === "curtain") {
      g.fillStyle = "#fff";
      g.globalAlpha = 0.35 + r * 0.5;
      g.shadowColor = pal[2];
      g.shadowBlur = 12;
      star(g, x, y, 1.5 + r * 4.5);
      g.shadowBlur = 0;
    } else {
      const ash = motif === "ash";
      g.globalAlpha = ash ? 0.3 + r * 0.4 : 0.08 + r * 0.2;
      g.fillStyle = ash ? "#e8eef4" : pal[2];
      g.filter = ash ? "none" : `blur(${2 + r * 6}px)`;
      g.beginPath();
      g.arc(x, y, ash ? 1 + r * 3 : 6 + r * 24, 0, 6.28);
      g.fill();
      g.filter = "none";
    }
  }
  g.restore();
}
/** 그림(Image·canvas) → 표지 크기의 새 캔버스. pal은 색 셋, motif는 작품의 무늬 */
export function coverPost(src, pal, motif, p = COVER_POST) {
  const W = COVER_W,
    H = COVER_H,
    cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const g = cv.getContext("2d");
  g.imageSmoothingQuality = "high";
  g.filter = p.filter || "none";
  g.drawImage(src, 0, 0, W, H);
  g.filter = "none";
  const layer = (mode, alpha, fill) => {
    g.globalCompositeOperation = mode;
    g.globalAlpha = alpha;
    fill();
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  };
  if (p.bloom) {
    const bm = document.createElement("canvas");
    bm.width = Math.round(W / p.bloom.k);
    bm.height = Math.round(H / p.bloom.k);
    const bg = bm.getContext("2d");
    bg.filter = "brightness(0.8) contrast(1.7)";
    bg.drawImage(cv, 0, 0, bm.width, bm.height);
    layer("screen", p.bloom.a, () => g.drawImage(bm, 0, 0, W, H));
  }
  if (p.grade) {
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, pal[2]);
    gr.addColorStop(0.45, pal[1]);
    gr.addColorStop(1, pal[0]);
    layer("soft-light", p.grade, () => ((g.fillStyle = gr), g.fillRect(0, 0, W, H)));
  }
  if (p.particles) particles(g, motif, pal, W, H);
  if (p.vignette) {
    const v = g.createRadialGradient(W / 2, H * 0.4, H * 0.3, W / 2, H * 0.4, H * 0.86);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, pal[0]);
    layer("multiply", p.vignette, () => ((g.fillStyle = v), g.fillRect(0, 0, W, H)));
  }
  return cv;
}
