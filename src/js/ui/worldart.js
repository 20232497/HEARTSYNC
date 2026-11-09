/* 세계관 일러스트 보기: 상세 페이지의 키워드북 항목별 그림 갤러리(worldArtHTML) — 항목마다 종류(인물·장소…)·이름·설명과 그림(원래 비율 그대로).
   그림은 작품 폴더의 images/lore-<n>.*(빌드가 loreImages로 실음) */
import { getChar } from "../core/character.js";
import { esc } from "../core/util.js";
import { IMG } from "../services/images.js";

/* 키워드북 항목의 종류(작품 work.js의 lore[].kind) — 상세 카드의 머리표. 빌드가 이 키로 검사(APP_RULES) */
export const LORE_KINDS = { person: "인물", creature: "동물·존재", place: "장소", item: "물건", event: "사건", group: "세력", concept: "설정" };
export function loreImg(c, key) { const live = getChar(c.id) || c; return (live.loreImages || {})[key] || ""; }
export function worldArtHTML(c) {
  const lore = (getChar(c.id) || c).lore || [];
  if (!lore.length) return "";
  return `<div class="wgal">${lore.map((e) => { const ref = loreImg(c, e.keys[0]), kind = LORE_KINDS[e.kind] || ""; return `<figure class="wcard">${ref ? `<button class="wpic" data-wlb="${esc(e.keys[0])}" aria-label="${esc(e.keys[0])} 크게 보기">${IMG.tag(ref)}</button>` : `<div class="wpic ph">${esc(e.keys[0])}</div>`}<figcaption><b>${kind ? `<small class="wkind">${kind}</small>` : ""}${esc(e.keys[0])}</b><span>${esc(e.text)}</span></figcaption></figure>`; }).join("")}</div>`;
}
