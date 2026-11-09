/* 남성향 일상 화풍의 후처리 — src/js/images/runware.js의 stylePost를 그대로 떼어 둔 사본(2026-11-08). 브라우저 캔버스에서 그림을 받은 뒤 입힘 */
/* 내장 화풍의 후처리(style.post): 그림을 받은 뒤 브라우저에서 입힘 — 모델·태그로는 조절이 안 되는 전체 밝기와 흐림(2026-11-05 비교 생성으로 정함).
   lift·soft: 옅은 빛을 screen으로 더하고 중간톤을 soft-light로 올림. blurK·blurA: 1/blurK로 줄였다 키운 사본을 blurA만큼 겹침(ctx.filter는 Safari에서 안 됨).
   veil: 가운데에서 가장자리로 갈수록 채도를 빼고(saturation) 살짝 어둡게(multiply) 회색 막을 씌움 — 인물의 색은 남기고 전체를 회색조로(여성향 일상). 실패하면 원본 */
export async function stylePost(blob, p) {
  const url = URL.createObjectURL(blob);
  try {
    const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const w = im.width, h = im.height, cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    const g = cv.getContext("2d"); g.imageSmoothingQuality = "high"; g.drawImage(im, 0, 0);
    if (p.lift) {
      g.globalCompositeOperation = "screen"; g.fillStyle = p.lift; g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = "soft-light"; g.globalAlpha = p.soft || 0; g.fillStyle = "#fff"; g.fillRect(0, 0, w, h);
      g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
    }
    if (p.blurK) {
      const sm = document.createElement("canvas"); sm.width = Math.round(w / p.blurK); sm.height = Math.round(h / p.blurK);
      const sg = sm.getContext("2d"); sg.imageSmoothingQuality = "high"; sg.drawImage(cv, 0, 0, sm.width, sm.height);
      g.globalAlpha = p.blurA; g.drawImage(sm, 0, 0, w, h); g.globalAlpha = 1;
    }
    if (p.veil) {
      const v = p.veil, r = g.createRadialGradient(w * 0.5, h * 0.4, h * 0.12, w * 0.5, h * 0.4, h * 0.8), grey = (a) => `rgba(128,128,128,${a})`;
      r.addColorStop(0, grey(v.center)); r.addColorStop(0.45, grey(v.center)); r.addColorStop(1, grey(v.edge));
      g.globalCompositeOperation = "saturation"; g.fillStyle = r; g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = "multiply"; g.fillStyle = v.mul; g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = "source-over"; g.globalAlpha = v.a; g.fillStyle = v.color; g.fillRect(0, 0, w, h); g.globalAlpha = 1;
    }
    return await new Promise((res) => cv.toBlob((b) => res(b || blob), "image/jpeg", 0.92));
  } catch { return blob; }
  finally { URL.revokeObjectURL(url); }
}
