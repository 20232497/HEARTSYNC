/* 키워드북: 스튜디오 글 ↔ 항목, 최근 메시지에서 키워드 찾기(matchLore) */
/** @typedef {import("../../core/types.js").LoreEntry} LoreEntry */
/* 키워드북: 한 줄에 "키워드1, 키워드2 | 설명". 최근 대화에 키워드가 나온 항목만 프롬프트에 넣는다 */
/** 스튜디오 글(한 줄에 "키워드1, 키워드2 | 설명") → 키워드북. @param {string} text @returns {LoreEntry[]} 최대 40개 */
export function parseLore(text) {
  const out = [];
  String(text).split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 40).forEach((l) => {
    const k = l.indexOf("|"); if (k < 0) return;
    const keys = l.slice(0, k).split(",").map((x) => x.trim().slice(0, 20)).filter(Boolean).slice(0, 6), body = l.slice(k + 1).trim().slice(0, 400);
    if (keys.length && body) out.push({ keys, text: body });
  });
  return out;
}
/** 키워드북 → 스튜디오 글. @param {LoreEntry[]|undefined} lore @returns {string} */
export function loreText(lore) { return (lore || []).map((e) => e.keys.join(", ") + " | " + e.text).join("\n"); }
/** 최근 글에 키워드가 나온 항목(최대 6개). @param {LoreEntry[]|undefined} lore @param {string[]} texts @returns {LoreEntry[]} */
export function matchLore(lore, texts) {
  const hay = texts.join("\n").toLowerCase();
  return (lore || []).filter((e) => e.keys.some((k) => hay.includes(k.toLowerCase()))).slice(0, 6);
}
