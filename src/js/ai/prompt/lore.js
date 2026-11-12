/* 키워드북: 이번 턴에 AI에게 넘길 항목 고르기(matchLore — 순수). 작품의 lore[]는 { keys, text, kind?, tags?, always?, order?, not?, also? }.
   규칙은 여기 한 곳: 상시(always) 항목은 늘, 그 밖은 최근 글에 keys가 나왔을 때(also가 있으면 그중 하나도 함께, not의 낱말이 나오면 빼고).
   순서는 order 큰 것부터(같으면 적힌 순서), 예산은 LORE(core/constants.js — 상시 + 키워드 항목을 합쳐 max개·budget자). 넘치는 항목은 자르지 않고 그 턴에 건너뜀 */
import { LORE } from "../../core/constants.js";
/** @typedef {import("../../core/types.js").LoreEntry} LoreEntry */

const has = (hay, words) => (words || []).some((k) => hay.includes(String(k).toLowerCase()));
/**
 * 이번 턴에 넘길 키워드북 항목 — 상시 항목이 앞, 키워드로 걸린 항목이 뒤(둘은 e.always로 가름: 상시는 프롬프트 고정부, 걸린 것은 변동부와 말풍선 📖).
 * @param {LoreEntry[]|undefined} lore @param {string[]} texts 최근 메시지 글(buildInput이 LORE.scan개를 넘김) @returns {LoreEntry[]}
 */
export function matchLore(lore, texts) {
  const hay = (texts || []).join("\n").toLowerCase(),
    all = (lore || []).map((e, i) => ({ e, i }));
  // order 큰 것부터, 같으면 적힌 순서(sort가 안정적이지 않은 오래된 엔진에서도 같게 i로 가름)
  const byOrder = (a, b) => (b.e.order || 0) - (a.e.order || 0) || a.i - b.i;
  const always = all.filter((x) => x.e.always).sort(byOrder);
  const hit = all.filter((x) => !x.e.always && has(hay, x.e.keys) && (!(x.e.also || []).length || has(hay, x.e.also)) && !has(hay, x.e.not)).sort(byOrder);
  const out = [];
  let chars = 0;
  for (const x of always.concat(hit)) {
    const n = String(x.e.text || "").length;
    if (out.length >= LORE.max || chars + n > LORE.budget) continue; // 넘치면 건너뛰고 더 짧은 다음 항목을 봄
    out.push(x.e);
    chars += n;
  }
  return out;
}
