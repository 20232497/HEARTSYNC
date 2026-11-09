/* 키워드북: 최근 메시지에서 키워드 찾기(matchLore) — 작품의 lore[]는 { keys, text, kind?, tags? } */
/** @typedef {import("../../core/types.js").LoreEntry} LoreEntry */
/** 최근 글에 키워드가 나온 항목(최대 6개). @param {LoreEntry[]|undefined} lore @param {string[]} texts @returns {LoreEntry[]} */
export function matchLore(lore, texts) {
  const hay = texts.join("\n").toLowerCase();
  return (lore || []).filter((e) => e.keys.some((k) => hay.includes(k.toLowerCase()))).slice(0, 6);
}
