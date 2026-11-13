/* 남성향 애니 화풍(manime)의 후처리 — 그림을 받은 뒤 브라우저 캔버스에서 입힌다. 값은 assemble.js의 POST.
   모델·태그로는 조절이 안 되는 것들: filter(채도·대비) → bloom(밝은 곳이 번지는 빛) → blur(부드러운 초점) → tint(밝은 곳에 연보라빛).
   ctx.filter는 Safari에서 안 된다 — 그림은 관리자가 데스크톱 Chrome에서 만든다. 앱은 이 파일을 쓰지 않는다 */
export async function stylePost(blob, p) {
  const url = URL.createObjectURL(blob);
  try {
    const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const w = im.width, h = im.height, cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    const g = cv.getContext("2d"); g.imageSmoothingQuality = "high";
    if (p.filter) g.filter = p.filter; // 예: "saturate(1.4) contrast(1.06)"
    g.drawImage(im, 0, 0); g.filter = "none";
    const small = (k) => { // 1/k로 줄인 사본 — 다시 키우면 흐려짐
      const sm = document.createElement("canvas"); sm.width = Math.round(w / k); sm.height = Math.round(h / k);
      const sg = sm.getContext("2d"); sg.imageSmoothingQuality = "high"; sg.drawImage(cv, 0, 0, sm.width, sm.height); return sm;
    };
    if (p.bloom) { // 흐린 사본을 screen으로 얹음
      const sm = small(p.bloom.k); g.globalCompositeOperation = "screen"; g.globalAlpha = p.bloom.a; g.drawImage(sm, 0, 0, w, h);
      g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
    }
    if (p.blurK) { const sm = small(p.blurK); g.globalAlpha = p.blurA; g.drawImage(sm, 0, 0, w, h); g.globalAlpha = 1; }
    if (p.tint) { // 색을 soft-light로 덮음 — 피부·흰 옷·배경에 연보라빛이 돎
      g.globalCompositeOperation = p.tint.mode || "soft-light"; g.globalAlpha = p.tint.a; g.fillStyle = p.tint.color; g.fillRect(0, 0, w, h);
      g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
    }
    return await new Promise((res) => cv.toBlob((b) => res(b || blob), "image/jpeg", 0.92));
  } catch { return blob; }
  finally { URL.revokeObjectURL(url); }
}
