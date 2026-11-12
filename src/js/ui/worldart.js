/* 세계관 카드: 상세 페이지의 키워드북 항목별 그림 갤러리(worldArtHTML)와 대화방 드로어의 세계관 수첩(loreSeen·loreCard) — 항목마다 종류(인물·장소…)·이름·설명과 그림(원래 비율 그대로).
   그림은 작품 폴더의 images/lore-<n>.*(빌드가 loreImages로 실음) */
import { liveWork } from "../core/character.js";
import { esc } from "../core/util.js";
import { IMG } from "../services/images.js";
/** @typedef {import("../core/types.js").LoreEntry} LoreEntry */
/** @typedef {import("../core/types.js").Room} Room */
/** @typedef {import("../core/types.js").Work} Work */

/* 키워드북 항목의 종류(작품 work.js의 lore[].kind) — 상세 카드의 머리표. 빌드가 이 키로 검사(APP_RULES) */
export const LORE_KINDS = { person: "인물", creature: "동물·존재", place: "장소", item: "물건", event: "사건", group: "세력", concept: "설정" };
export function loreImg(c, key) {
  return (liveWork(c).loreImages || {})[key] || "";
}
/**
 * 키워드북 카드 한 장. 그림을 누르면 크게(data-wlb — 쓰는 화면이 lightbox를 연결).
 * @param {Work} c @param {LoreEntry} e @param {boolean} [open] 거짓이면 종류와 ???만(세계관 수첩에서 아직 대화에 안 나온 항목 — 이름·설명·그림은 내보내지 않음)
 * @param {boolean} [ph] 거짓이면 그림 없는 항목의 빈 그림 자리를 뺌(좁은 드로어용)
 */
export function loreCard(c, e, open = true, ph = true) {
  const key = e.keys[0],
    kind = LORE_KINDS[e.kind] || "",
    ref = open ? loreImg(c, key) : "";
  const pic = ref
    ? `<button class="wpic" data-wlb="${esc(key)}" aria-label="${esc(key)} 크게 보기">${IMG.tag(ref)}</button>`
    : open && ph
      ? `<div class="wpic ph">${esc(key)}</div>`
      : "";
  return (
    `<figure class="wcard${open ? "" : " locked"}">${pic}<figcaption>` +
    `<b>${kind ? `<small class="wkind">${kind}</small>` : ""}${open ? esc(key) : "???"}</b>${open ? `<span>${esc(e.text)}</span>` : ""}</figcaption></figure>`
  );
}
/** 상세 페이지의 세계관 일러스트 — 키워드북이 없으면 빈 문자열(칸을 숨김). @param {Work} c @returns {string} */
export function worldArtHTML(c) {
  const lore = liveWork(c).lore || [];
  return lore.length ? `<div class="wgal">${lore.map((e) => loreCard(c, e)).join("")}</div>` : "";
}
/**
 * 이 대화방에서 AI가 꺼내 쓴 키워드북 항목의 번호들(세계관 수첩). 응답마다(다시 쓴 버전 포함) 저장된 alt.lore — 말풍선 아래 📖의 키워드 — 로 찾고,
 * 상시 항목(always — 키워드 없이 늘 AI에 가는 항목, 📖에는 안 뜸)은 처음부터 펼친 것으로 봄.
 * @param {Room} r @param {LoreEntry[]} lore 작품의 키워드북(최신 작품) @returns {Set<number>}
 */
export function loreSeen(r, lore) {
  const used = new Set();
  (r.msgs || []).forEach((m) => (m.alts || []).forEach((a) => (a.lore || []).forEach((k) => used.add(k))));
  const out = new Set();
  lore.forEach((e, i) => {
    if (e.always || e.keys.some((k) => used.has(k))) out.add(i);
  });
  return out;
}
