/* 세계관 일러스트 보기: 상세 페이지의 키워드북 항목별 그림 갤러리(worldArtHTML). 그림은 내 작품이면 작품(loreImages)에, 그 밖은 내 계정(lorepacks)에 있음.
   올리기·AI 생성·삭제는 관리자 빌드의 admin/worldart.js(openWorldArt) */
import { getChar } from "../core/character.js";
import { S } from "../core/state.js";
import { esc } from "../core/util.js";
import { IMG } from "../services/images.js";

export function loreImg(c, key) { const live = getChar(c.id) || c; return (S.lorepacks[c.id] || {})[key] || (live.loreImages || {})[key] || ""; }
export function worldArtHTML(c) {
  const lore = (getChar(c.id) || c).lore || [];
  if (!lore.length) return "";
  return `<div class="wgal">${lore.map((e) => { const ref = loreImg(c, e.keys[0]); return `<figure class="wcard">${ref ? `<button class="wpic" data-wlb="${esc(e.keys[0])}" aria-label="${esc(e.keys[0])} 크게 보기">${IMG.tag(ref)}</button>` : `<div class="wpic ph">${esc(e.keys[0])}</div>`}<figcaption><b>${esc(e.keys[0])}</b><span>${esc(e.text)}</span></figcaption></figure>`; }).join("")}</div>`;
}
