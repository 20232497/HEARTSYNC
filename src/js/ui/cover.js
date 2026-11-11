/* 표지·장면 그림 HTML(coverHTML·figHTML·portraitHTML·artHTML — 그림이 없으면 색 카드), 그림 태그 해석(tagInfo), 라이트박스 */
import { liveWork } from "../core/character.js";
import { MOTIFS, PALETTES, SIT_TINT } from "../core/constants.js";
import { esc } from "../core/util.js";
import { codebook } from "../images/codes.js";
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
/* 그림이 없을 때의 아트 카드 — 칸 번호의 색과 이름(label을 주면 칸 이름 대신: 장소·컷씬) */
export function artHTML(c, cast, sit, label) {
  const pal = PALETTES[c.pal] || PALETTES[0];
  return `<div class="artcard" style="--c1:${pal[0]};--c2:${pal[1]};--c3:${pal[2]};--tint:${SIT_TINT[sit] || "#c9b8ff"}"><span class="ac-g">${esc((cast.name || "?").slice(0, 1))}</span><span class="ac-s">${esc(label || sitName(sit))}</span><span class="ac-n">${esc(cast.name)}</span></div>`;
}
/**
 * 그림 태그(imgTags의 한 항목) 해석 — 인물이면 감정 칸(모르는 번호는 1 기본), MP면 작품 places의 n번째, EV면 cuts의 n번째. 작품에 없는 코드는 null.
 * @param {import("../core/types.js").Work} c @param {{code: string, sit: number}} t
 * @returns {{kind: "cast"|"place"|"cut", code: string, sit: number, name: string, label: string, ref: string|null}|null}
 */
export function tagInfo(c, t) {
  // 인물은 방 안의 작품 사본(예전 방도 그 인물로 그림), 장소·컷씬 목록은 최신 작품에서(작품을 고치면 열린 방에도 바로)
  const e = codebook(liveWork(c))[t.code];
  if (!e) return null;
  if (e.kind === "cast") {
    const sit = t.sit <= e.max ? t.sit : 1;
    return { kind: e.kind, code: t.code, sit, name: e.name, label: sitName(sit), ref: pickImg(c, t.code, sit) };
  }
  const item = (e.items || [])[t.sit - 1];
  if (!item) return null;
  return { kind: e.kind, code: t.code, sit: t.sit, name: item[e.nameKey] || t.code + t.sit, label: e.label, ref: pickImg(c, t.code, t.sit) };
}
/* 본문 태그 [[코드번호]]의 그림: 인물은 그 칸 → 1 → 0 순으로 있는 그림, 장소·컷씬은 그 번호의 그림, 없으면 아트 카드. 작품에 없는 코드는 빈 문자열 */
export function figHTML(c, t) {
  const i = tagInfo(c, t); if (!i) return "";
  return `<figure class="scene-img${i.kind === "cast" ? "" : " " + i.kind}" data-code="${esc(i.code)}" data-sit="${i.sit}">${i.ref ? `${IMG.tag(i.ref)}<figcaption>${esc(i.name)} · ${esc(i.label)}</figcaption>` : artHTML(c, { name: i.name }, i.sit, i.kind === "cast" ? "" : i.label)}</figure>`;
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
