// 작품 폴더의 images/를 읽어 그림 파일 이름이 규칙에 맞는지 보고 작품의 images·img·loreImages를 만듦(scanImages)
import fs from "node:fs";
import path from "node:path";
import { ROOT, visible } from "./common.mjs";
import { codeRange } from "./work-check.mjs";

/* 작품 폴더의 images/ → 작품의 images(코드 글자 → 번호 → content/… 경로)·img(cover.*)·loreImages(lore-<n>.* → n번째 키워드북 항목).
   파일 이름: <코드><번호>.webp|png|jpg — 인물 코드 + 감정 번호 0~14(HSY3.webp), 장소 MP<n>, 컷씬 EV<n>; cover.*, lore-<n>.* */
const IMG_EXT = /\.(webp|png|jpe?g)$/i;
export function scanImages(w, R, errors, warnings) {
  const dir = path.join(ROOT, w.rel, "images");
  if (!fs.existsSync(dir)) return;
  const c = w.c,
    lore = c.lore || [],
    range = codeRange(c, R);
  const images = {},
    loreImages = {};
  let img = "";
  for (const f of fs.readdirSync(dir).filter(visible).sort()) {
    const at = `${w.rel}/images/${f}`;
    if (!IMG_EXT.test(f)) {
      warnings.push(`${at}: 그림 파일(webp·png·jpg)이 아니라 지나쳐요`);
      continue;
    }
    const base = f.replace(IMG_EXT, "");
    let m;
    if (base === "cover") {
      if (img) errors.push(`${at}: 표지가 둘이에요(${img})`);
      img = at;
    } else if ((m = base.match(/^lore-(\d+)$/))) {
      const i = +m[1];
      if (i < 1 || i > lore.length) {
        errors.push(`${at}: 키워드북 항목은 1~${lore.length}번이에요`);
        continue;
      }
      const k = lore[i - 1].keys[0];
      if (loreImages[k]) errors.push(`${at}: 키워드북 ${i}번 항목의 그림이 둘이에요`);
      loreImages[k] = at;
    } else if ((m = base.match(/^([A-Za-z]+)(\d+)$/))) {
      const code = m[1],
        n = +m[2],
        why = range(code, n);
      if (why) {
        errors.push(`${at}: ${why}`);
        continue;
      }
      images[code] = images[code] || {};
      if (images[code][n]) errors.push(`${at}: ${code}${n} 그림이 둘이에요(${images[code][n]})`);
      images[code][n] = at;
    } else if (/^[a-z0-9]+-\d+$/.test(base))
      errors.push(`${at}: 예전 이름이에요 — 인물 코드 바로 뒤에 번호를 붙인 <코드><번호>.webp(예: HSY3.webp)로 바꿔 주세요`);
    else warnings.push(`${at}: 이름을 알 수 없어 지나쳐요 — <코드><번호>.webp(HSY3 · MP1 · EV2) · cover.webp · lore-<n>.webp`);
  }
  if (Object.keys(images).length) w.images = images;
  if (img) w.img = img;
  if (Object.keys(loreImages).length) w.loreImages = loreImages;
}
