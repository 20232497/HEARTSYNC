/* 단체 표지 합성(브라우저 캔버스) — ./cover-group.js의 layout대로 ① 따로 그린 배경을 깔고 ② 배경을 지운 인물 셋을 머리 크기에 맞춰 얹고 ③ 그늘·색을 입힌다.
   돌려주는 캔버스(1344×1792)를 아주 약하게 다시 그려(UNIFY 0.1) 이은 뒤 표지 후처리(./cover-post.js)와 로고를 입힌다 — 그 호출은 그림 관리 페이지가 한다.
   앱은 이 파일을 쓰지 않는다 */
export const COMP_W = 1344,
  COMP_H = 1792;

/** 머리 비율 head = [정수리 위치 cf, 머리 높이 hf, 얼굴 가로 위치 fx](그림 크기에 대한 비율)와 자리 seat = { head, crown, cx }(화면에 대한 비율)로 그림이 놓일 곳을 정한다.
    돌려주는 값: cx 그림 가운데의 가로 자리 · h 그림 높이 · bottom 그림 아래 끝 · face 얼굴 빛을 줄 높이(그림 안) · fade 아래가 화면에 못 미치면 그늘로 풀어 줄 비율 */
export function seatOf(seat, head, flip, cxOver) {
  const [cf, hf, fx0] = head,
    fx = fx0 === undefined ? 0.5 : flip ? 1 - fx0 : fx0,
    h = seat.head / hf,
    top = seat.crown - cf * h,
    bottom = top + h;
  // cx는 화면 가로에 대한 비율이고 그림 너비는 높이 × (그림의 가로/세로)라, 얼굴이 가운데에서 벗어난 만큼을 높이 단위로 옮긴다(확정 표지 넷을 만든 식 그대로)
  return { cx: cxOver || seat.cx - (fx - 0.5) * h, h, bottom, face: cf + hf * 0.55, fade: bottom < 0.99 ? 0.16 : 0 };
}

/** 배경을 지운 인물 그림에서 머리 자리를 어림한다 — 정수리는 맨 위의 불투명한 줄, 얼굴 가로 위치는 윗부분의 무게 중심, 머리 높이는 목(가장 좁은 줄)까지.
    긴 머리·모자는 목이 가려 틀리기 쉽다 → 어림값일 뿐이고 페이지에서 손으로 고친다 */
export function measure(im) {
  const w = 168,
    h = Math.round((w * im.height) / im.width),
    cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const g = cv.getContext("2d", { willReadFrequently: true });
  g.drawImage(im, 0, 0, w, h);
  const a = g.getImageData(0, 0, w, h).data,
    rows = [];
  for (let y = 0; y < h; y++) {
    let n = 0,
      sx = 0;
    for (let x = 0; x < w; x++)
      if (a[(y * w + x) * 4 + 3] > 128) {
        n++;
        sx += x;
      }
    rows.push({ n, cx: n ? sx / n / w : 0.5 });
  }
  const tip = rows.findIndex((r) => r.n > w * 0.02);
  if (tip < 0) return [0.06, 0.23, 0.5];
  // 맨 위의 가는 줄(올려 묶은 머리·깃털)은 정수리가 아니다 → 머리 너비의 절반쯤 되는 첫 줄을 정수리로 본다
  const span = Math.max(...rows.slice(tip, tip + Math.round(h * 0.2)).map((r) => r.n)),
    top = tip + Math.max(0, rows.slice(tip).findIndex((r) => r.n >= span * 0.45));
  const band = rows.slice(top, top + Math.round(h * 0.14)).filter((r) => r.n),
    fx = band.reduce((s, r) => s + r.cx * r.n, 0) / band.reduce((s, r) => s + r.n, 0);
  let neck = -1,
    min = Infinity;
  const wide = Math.max(...rows.slice(top, top + Math.round(h * 0.12)).map((r) => r.n));
  for (let y = top + Math.round(h * 0.12); y < top + Math.round(h * 0.34) && y < h; y++)
    if (rows[y].n < min) {
      min = rows[y].n;
      neck = y;
    }
  const hf = neck > 0 && min < wide * 0.8 ? Math.min(0.31, Math.max(0.17, ((neck - top) / h) * 0.94)) : 0.23;
  return [+(top / h).toFixed(3), +hf.toFixed(3), +fx.toFixed(3)];
}

const sheet = (w, h) => {
  const o = document.createElement("canvas");
  o.width = w;
  o.height = h;
  return o;
};
/** 인물 그림 한 장에 장면 색(곱하기)·얼굴 빛(soft-light — screen은 검은 머리를 갈색으로 만든다)·아래 풀림·좌우 뒤집기를 입힌다 */
function dress(im, c, s, at) {
  let src = im;
  const tint = c.tint || s.tint;
  if (tint || s.face) {
    const o = sheet(im.width, im.height),
      og = o.getContext("2d");
    og.drawImage(im, 0, 0);
    if (tint) {
      og.globalCompositeOperation = "multiply";
      og.fillStyle = tint;
      og.fillRect(0, 0, o.width, o.height);
    }
    if (s.face) {
      const fx = o.width * (c.head[2] === undefined ? 0.5 : c.head[2]),
        fy = o.height * at.face,
        fr = og.createRadialGradient(fx, fy, 0, fx, fy, o.height * 0.3);
      fr.addColorStop(0, "rgba(255,244,232," + Math.min(0.85, s.face * 2) + ")");
      fr.addColorStop(1, "rgba(255,238,220,0)");
      og.globalCompositeOperation = "soft-light";
      og.fillStyle = fr;
      og.fillRect(0, 0, o.width, o.height);
    }
    og.globalCompositeOperation = "destination-in"; // 색을 입힌 뒤 원래 모양으로 다시 오림
    og.drawImage(im, 0, 0);
    src = o;
  }
  if (at.fade) {
    const o = sheet(src.width, src.height),
      og = o.getContext("2d"),
      y0 = o.height * (1 - at.fade),
      fg = og.createLinearGradient(0, y0, 0, o.height);
    og.drawImage(src, 0, 0);
    fg.addColorStop(0, "rgba(0,0,0,0)");
    fg.addColorStop(1, "rgba(0,0,0,1)");
    og.globalCompositeOperation = "destination-out";
    og.fillStyle = fg;
    og.fillRect(0, y0, o.width, o.height * at.fade);
    src = o;
  }
  if (c.flip) {
    const o = sheet(src.width, src.height),
      og = o.getContext("2d");
    og.translate(o.width, 0);
    og.scale(-1, 1);
    og.drawImage(src, 0, 0);
    src = o;
  }
  return src;
}

/** layout(cover-group.js)과 그림들 { bg, left, mid, right }(인물은 배경을 지운 것)로 합친 캔버스를 만든다. layout.chars[].head·flip·cx는 페이지에서 고친 값일 수 있다 */
export function composeGroup(s, imgs) {
  const W = COMP_W,
    H = COMP_H,
    cv = sheet(W, H),
    g = cv.getContext("2d");
  g.imageSmoothingQuality = "high";
  {
    // 배경: 키우고(zoom) 보는 자리(at)를 맞춘 뒤 위로 올린다(shift) — 아래 빈 곳은 배경의 맨 아래 띠를 늘려 채움(인물과 제목 그늘이 가림)
    const bi = imgs.bg,
      z = s.view.zoom || 1,
      at = s.view.at || [0.5, 0.5],
      sh = s.view.shift || [0, 0];
    const dx = Math.min(0, Math.max(W - W * z, -(z - 1) * W * at[0] + sh[0] * W)),
      dy = Math.min(0, -(z - 1) * H * at[1] + sh[1] * H),
      gap = H - (dy + H * z);
    g.filter = s.bgFilter || "none";
    g.drawImage(bi, dx, dy, W * z, H * z);
    if (gap > 0) g.drawImage(bi, 0, bi.height * 0.9, bi.width, bi.height * 0.1, dx, dy + H * z - 2, W * z, gap + 4);
    g.filter = "none";
  }
  for (const c of s.chars) {
    const im = imgs[c.role],
      at = seatOf(s.seat[c.role], c.head, c.flip, c.cx),
      h = at.h * H,
      w = (h * im.width) / im.height;
    g.save();
    if (s.halo) {
      g.shadowColor = "rgba(0,0,0," + s.halo + ")";
      g.shadowBlur = 30;
      g.shadowOffsetY = 10;
    }
    g.filter = c.filter || "none";
    g.drawImage(dress(im, c, s, at), at.cx * W - w / 2, at.bottom * H - h, w, h);
    g.restore();
    g.filter = "none";
  }
  if (s.floor) {
    const fg = g.createLinearGradient(0, H * 0.5, 0, H);
    fg.addColorStop(0, "rgba(0,0,0,0)");
    fg.addColorStop(1, "rgba(0,0,0," + s.floor + ")");
    g.fillStyle = fg;
    g.fillRect(0, H * 0.5, W, H * 0.5);
  }
  if (s.vig) {
    const vg = g.createRadialGradient(W / 2, H * 0.42, H * 0.3, W / 2, H * 0.42, H * 0.82);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0," + s.vig + ")");
    g.fillStyle = vg;
    g.fillRect(0, 0, W, H);
  }
  if (s.grade && s.grade.color) {
    g.globalCompositeOperation = "soft-light";
    g.globalAlpha = s.grade.a;
    g.fillStyle = s.grade.color;
    g.fillRect(0, 0, W, H);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  }
  return cv;
}
