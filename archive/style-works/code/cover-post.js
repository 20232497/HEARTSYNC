/* 표지 후처리(브라우저 캔버스) — 받은 표지 그림에 입힌 뒤 표지 크기(960×1280)로 줄인다. 2026-11-16~20 사용자와 비교 생성으로 정한 값(2026-11-14의 빛 번짐·입자·색 덮기는 뺌 — 빛은 문구가 만든다).
   표지는 화풍 후처리(각 화풍 폴더의 code/post.js)를 거치지 않고 이 값만 입힌다. 그 위에 로고(./logo.js)가 얹힌다.
   ctx.filter는 Safari에서 안 된다 — 그림은 관리자가 데스크톱 Chrome에서 만든다. 앱은 이 파일을 쓰지 않는다 */
/* filter 채도·대비·밝기 → lift 검은 곳을 아주 조금 띄움(screen) + soft 은은한 빛(soft-light) → blur 1/blurK로 줄인 사본을 blurA만큼 얹어 초점을 부드럽게
   dark 어두운 한 명 표지 · warm 밝은 작품(편의점·하숙집) · group 어두운 단체 표지(합성에서 이미 어둡게 해서 덜 누름) · symbol 상징물 */
export const COVER_POST = {
  dark: { filter: "saturate(1.02) contrast(1.13) brightness(0.93)", lift: "rgb(3,3,5)", soft: 0.02, blurK: 3, blurA: 0.18 },
  warm: { filter: "saturate(1.06) contrast(1.1)", lift: "rgb(4,4,6)", soft: 0.02, blurK: 3, blurA: 0.18 },
  group: { filter: "saturate(1.03) contrast(1.12) brightness(0.97)", lift: "rgb(4,4,6)", soft: 0.02, blurK: 3, blurA: 0.18 },
  symbol: { filter: "saturate(1.05) contrast(1.07)", lift: "rgb(5,5,7)", soft: 0.03, blurK: 3, blurA: 0.25 }
};
export const COVER_W = 960,
  COVER_H = 1280;

/** 그림(Image·canvas) → 후처리한 표지 크기의 새 캔버스 */
export function coverPost(src, p = COVER_POST.dark) {
  const w = src.naturalWidth || src.width,
    h = src.naturalHeight || src.height,
    cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const g = cv.getContext("2d");
  g.imageSmoothingQuality = "high";
  if (p.filter) g.filter = p.filter;
  g.drawImage(src, 0, 0, w, h);
  g.filter = "none";
  if (p.lift) {
    g.globalCompositeOperation = "screen";
    g.fillStyle = p.lift;
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = "soft-light";
    g.globalAlpha = p.soft || 0;
    g.fillStyle = "#fff";
    g.fillRect(0, 0, w, h);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  }
  if (p.blurK) {
    const sm = document.createElement("canvas");
    sm.width = Math.round(w / p.blurK);
    sm.height = Math.round(h / p.blurK);
    const sg = sm.getContext("2d");
    sg.imageSmoothingQuality = "high";
    sg.drawImage(cv, 0, 0, sm.width, sm.height);
    g.globalAlpha = p.blurA;
    g.drawImage(sm, 0, 0, w, h);
    g.globalAlpha = 1;
  }
  const out = document.createElement("canvas");
  out.width = COVER_W;
  out.height = COVER_H;
  const og = out.getContext("2d");
  og.imageSmoothingQuality = "high";
  og.drawImage(cv, 0, 0, COVER_W, COVER_H);
  return out;
}
