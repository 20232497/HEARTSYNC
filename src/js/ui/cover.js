/* 표지·인물 그림 HTML(coverHTML·figHTML·portraitHTML), 라이트박스 */
import { MOTIFS, PALETTES, SIT_TINT } from "../core/constants.js";
import { S } from "../core/state.js";
import { esc } from "../core/util.js";
import { keyOf, parseCodes, splitDims } from "../images/codes.js";
import { pickImg } from "../images/pick.js";
import { keyName, knownCodes, sitName } from "../images/situations.js";
import { IMG } from "../services/images.js";

export function coverHTML(c, cls = "", opts = {}) {
  const pal = PALETTES[c.pal] || PALETTES[0], img = IMG.tag(S.coverpacks[c.charId || c.id] || c.img);
  const motif = MOTIFS[c.motif] ? c.motif : "glow";
  return `<div class="cover m-${motif} ${img ? "has-img" : ""} ${cls}" style="--c1:${pal[0]};--c2:${pal[1]};--c3:${pal[2]}" aria-hidden="true">${img}` +
    `<span class="glyph">${esc((c.glyph || c.name || "?").slice(0, 1))}</span>` +
    (opts.vt ? `<span class="vt">${esc(c.title)}</span>` : "") + (opts.cat ? `<span class="cat">${esc(c.cat)}</span>` : "") + `</div>`;
}
/* 그림이 없을 때의 아트 카드. key는 번호 또는 조합 키 — 색과 이름은 첫 감정/행동 번호로, 조합이면 +n */
export function artHTML(c, cast, key) {
  const pal = PALETTES[c.pal] || PALETTES[0], codes = parseCodes(String(key)), a = splitDims(codes).act, sit = a.length ? a[0] : (codes.length ? codes[0] : 1);
  return `<div class="artcard" style="--c1:${pal[0]};--c2:${pal[1]};--c3:${pal[2]};--tint:${SIT_TINT[sit] || "#c9b8ff"}"><span class="ac-g">${esc((cast.name || "?").slice(0, 1))}</span><span class="ac-s">${esc(sitName(sit))}${codes.length > 1 ? ` +${codes.length - 1}` : ""}</span><span class="ac-n">${esc(cast.name)}</span></div>`;
}
/* 태그의 번호들 → 그림 조합 키: 모르는 번호(지운 칸 등)는 빼고, 남는 게 없으면 1(기본) */
export function figKey(spec) { const codes = knownCodes(parseCodes(String(spec))); return keyOf(codes.length ? codes : [1]) || "1"; }
/* 장면 그림 figure의 속: 그림이 있으면 그림 + 이름 설명, 없으면 아트 카드. 대화 중 자동 생성이 다 되면 같은 것으로 바꿔 그림 */
export function figInner(c, cast, key, ref) { return ref ? `${IMG.tag(ref)}<figcaption>${esc(cast.name)} · ${esc(keyName(key))}</figcaption>` : artHTML(c, cast, key); }
export function figHTML(c, code, spec) {
  const cast = (c.cast || []).find((x) => x.code === code); if (!cast) return "";
  const key = figKey(spec), a = splitDims(parseCodes(key)).act;
  return `<figure class="scene-img" data-code="${code}" data-key="${key}" data-sit="${a.length ? a[0] : 1}">${figInner(c, cast, key, pickImg(c, code, key))}</figure>`;
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
