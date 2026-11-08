/* 표지·인물 그림 HTML(coverHTML·figHTML·portraitHTML·artHTML — 그림이 없으면 색 카드), 라이트박스 */
import { MOTIFS, PALETTES, SIT_TINT } from "../core/constants.js";
import { esc } from "../core/util.js";
import { sitOf } from "../images/codes.js";
import { pickImg } from "../images/pick.js";
import { sitName } from "../images/situations.js";
import { IMG } from "../services/images.js";

export function coverHTML(c, cls = "", opts = {}) {
  const pal = PALETTES[c.pal] || PALETTES[0], img = IMG.tag(c.img);
  const motif = MOTIFS[c.motif] ? c.motif : "glow";
  return `<div class="cover m-${motif} ${img ? "has-img" : ""} ${cls}" style="--c1:${pal[0]};--c2:${pal[1]};--c3:${pal[2]}" aria-hidden="true">${img}` +
    `<span class="glyph">${esc((c.glyph || c.name || "?").slice(0, 1))}</span>` +
    (opts.vt ? `<span class="vt">${esc(c.title)}</span>` : "") + (opts.cat ? `<span class="cat">${esc(c.cat)}</span>` : "") + `</div>`;
}
/* 그림이 없을 때의 아트 카드 — 칸 번호의 색과 이름 */
export function artHTML(c, cast, sit) {
  const pal = PALETTES[c.pal] || PALETTES[0];
  return `<div class="artcard" style="--c1:${pal[0]};--c2:${pal[1]};--c3:${pal[2]};--tint:${SIT_TINT[sit] || "#c9b8ff"}"><span class="ac-g">${esc((cast.name || "?").slice(0, 1))}</span><span class="ac-s">${esc(sitName(sit))}</span><span class="ac-n">${esc(cast.name)}</span></div>`;
}
/* 본문 태그 [[img:코드:번호]]의 그림: 그 칸 → 1 → 0 순으로 있는 그림, 없으면 아트 카드 */
export function figHTML(c, code, spec) {
  const cast = (c.cast || []).find((x) => x.code === code); if (!cast) return "";
  const sit = sitOf(spec), ref = pickImg(c, code, sit);
  return `<figure class="scene-img" data-code="${code}" data-sit="${sit}">${ref ? `${IMG.tag(ref)}<figcaption>${esc(cast.name)} · ${esc(sitName(sit))}</figcaption>` : artHTML(c, cast, sit)}</figure>`;
}
export function portraitHTML(c, cast) {
  const ref = pickImg(c, cast.code, 0);
  return `<div class="portrait thumb-art">${ref ? IMG.tag(ref) : artHTML(c, cast, 0)}</div>`;
}
/* 크게 보기 */
export function lightbox(src) {
  const lb = document.createElement("div"); lb.className = "lightbox";
  lb.innerHTML = `<img src="${esc(src)}" alt="확대 이미지">`;
  lb.onclick = () => lb.remove(); document.body.append(lb);
}
/* 그림 칸을 누르면 크게 */
export function zoomPic(box) { const i = box.querySelector("img"); if (i && i.src) lightbox(i.src); }
export function pavHTML(p) { const img = IMG.tag(p.img); return `<div class="pav">${img || esc((p.name || "?").slice(0, 1))}</div>`; }
