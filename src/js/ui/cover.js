/* 표지·인물 그림 HTML(coverHTML·figHTML·portraitHTML), 라이트박스 */
import { MOTIFS, PALETTES, SIT, SIT_TINT } from "../core/constants.js";
import { S } from "../core/state.js";
import { esc } from "../core/util.js";
import { pickImg } from "../images/pick.js";
import { sitDef, sitName } from "../images/situations.js";
import { IMG } from "../services/images.js";

export function coverHTML(c, cls = "", opts = {}) {
  const pal = PALETTES[c.pal] || PALETTES[0], img = IMG.tag(S.coverpacks[c.charId || c.id] || c.img);
  const motif = MOTIFS[c.motif] ? c.motif : "glow";
  return `<div class="cover m-${motif} ${img ? "has-img" : ""} ${cls}" style="--c1:${pal[0]};--c2:${pal[1]};--c3:${pal[2]}" aria-hidden="true">${img}` +
    `<span class="glyph">${esc((c.glyph || c.name || "?").slice(0, 1))}</span>` +
    (opts.vt ? `<span class="vt">${esc(c.title)}</span>` : "") + (opts.cat ? `<span class="cat">${esc(c.cat)}</span>` : "") + `</div>`;
}
export function artHTML(c, cast, sit) {
  const pal = PALETTES[c.pal] || PALETTES[0];
  return `<div class="artcard" style="--c1:${pal[0]};--c2:${pal[1]};--c3:${pal[2]};--tint:${SIT_TINT[sit] || "#fff"}"><span class="ac-g">${esc((cast.name || "?").slice(0, 1))}</span><span class="ac-s">${esc(sitName(sit))}</span><span class="ac-n">${esc(cast.name)}</span></div>`;
}
export function figHTML(c, code, sit) {
  const cast = (c.cast || []).find((x) => x.code === code); if (!cast) return "";
  sit = sit | 0; if (sit < 0 || (sit >= SIT.length && !sitDef(sit))) sit = 1; // 모르는 번호는 기본 칸으로
  const ref = pickImg(c, code, sit);
  return ref ? `<figure class="scene-img" data-code="${code}" data-sit="${sit}">${IMG.tag(ref)}<figcaption>${esc(cast.name)} · ${esc(sitName(sit))}</figcaption></figure>`
    : `<figure class="scene-img" data-code="${code}" data-sit="${sit}">${artHTML(c, cast, sit)}</figure>`;
}
export function portraitHTML(c, cast) {
  const ref = pickImg(c, cast.code, 0);
  return `<div class="portrait thumb-art">${ref ? IMG.tag(ref) : artHTML(c, cast, 0)}</div>`;
}
export function lightbox(src) {
  const lb = document.createElement("div"); lb.className = "lightbox"; lb.innerHTML = `<img src="${esc(src)}" alt="확대 이미지">`;
  lb.onclick = () => lb.remove(); document.body.append(lb);
}
export function pavHTML(p) { const img = IMG.tag(p.img); return `<div class="pav">${img || esc((p.name || "?").slice(0, 1))}</div>`; }
