/* 유저 메시지 끝에 붙는 [이번 응답] 지시(buildInput)와 [이미 쓴 문장](usedOpeners) */
import { unfilteredRoute } from "../adult.js";
import { LEN } from "../models.js";
import { matchLore } from "./lore.js";
import { rulesPrompt } from "./rules.js";
import { getChar } from "../../core/character.js";
import { curText } from "../../core/rooms.js";
import { sitHints } from "../../images/situations.js";
/** @typedef {import("../../core/types.js").LLMMessage} LLMMessage */
/** @typedef {import("../../core/types.js").Message} Message */
/** @typedef {import("../../core/types.js").Room} Room */
/** @typedef {import("../../core/types.js").StatusMap} StatusMap */

/* 최근 AI 응답 2개의 단락 첫머리(앞 24자): 모델이 같은 시작·묘사를 되풀이하지 않게 rulesPrompt에 보여 줌. 시스템 메시지([…])는 형식이라 뺌 */
/** 직전 AI 응답 2개의 단락 첫머리(최대 12개) — [이미 쓴 문장]으로 반복을 막음. @param {Message[]} hist @returns {string[]} */
export function usedOpeners(hist) {
  const out = [];
  for (const m of hist.filter((x) => x.role === "ai" && curText(x)).slice(-2))
    for (const p of curText(m).split(/\n+/)) {
      const t = p.replace(/\[\[img:[^\]]*\]\]/g, "").trim();
      if (t.startsWith("[")) continue;
      const s = t.replace(/^[^:"“*]{1,14}:\s*/, "").replace(/^[*"“\s]+/, "").replace(/[*"”\s]+$/, "").trim();
      if (s.length >= 8) out.push(s.slice(0, 24));
    }
  return [...new Set(out)].slice(-12);
}
/**
 * 한 턴의 AI 요청 메시지 묶음(시스템 규칙 + 기억력만큼의 대화 + [이번 응답] 지시).
 * @param {Room} r @param {number} uptoIdx 이 번호 앞의 메시지까지 @param {StatusMap} statusBefore @param {string} [direction] 다시 쓰기 방향
 * @returns {LLMMessage[] & { lore?: string[] }} lore는 반영된 키워드(말풍선 아래 📖)
 */
export function buildInput(r, uptoIdx, statusBefore, direction) {
  const hist = r.msgs.slice(0, uptoIdx).filter((m) => curText(m));
  const recent = hist.slice(-(r.set.mem * 2 + 1));
  const lore = matchLore(getChar(r.char.id)?.lore || r.char.lore, recent.slice(-3).map((m) => (m.role === "ai" ? curText(m) : m.text) || ""));
  const len = LEN[r.set.len] || LEN.mid;
  const out = [{ role: "user", content: rulesPrompt(r, lore, hist) }];
  out.lore = lore.map((e) => e.keys[0]);
  recent.forEach((m, i) => {
    const last = i === recent.length - 1;
    if (m.role === "ai") { out.push({ role: "assistant", content: curText(m) }); return; }
    let t = m.sys ? "// 직전 장면에서 자연스럽게 이어서 다음 장면을 써라. 유저의 행동은 쓰지 않는다." : m.text;
    // 분량·대화·새 전개 지시는 시스템 프롬프트에도 있지만, 모델이 가장 잘 따르는 마지막 입력 옆에 한 번 더
    if (last) t = `[현재 상태창 — 이번 장면은 여기서 출발한다]\n${JSON.stringify(statusBefore || {})}\n\n[${r.persona.name}의 입력]\n${t}${direction ? "\n\n// 다시 쓰기 지침: " + direction : ""}\n\n[이번 응답] 위 입력을 본문에 다시 옮겨 적지 말고 그 직후의 반응부터 쓴다. 본문 ${len.chars}, 대사 ${len.lines}줄 이상을 주고받고, 직전 응답과 다른 새 전개를 넣는다. 나오는 인물마다 [[img:코드:번호]]를 한 장씩 넣는다(의상·장소가 바뀌면 번호 뒤에 쉼표로)${(() => { const h = m.sys ? [] : sitHints(m.text, unfilteredRoute(r)); return h.length ? `(유저 입력에 맞는 번호 후보: ${h.join(", ")})` : ""; })()}.`;
    out.push({ role: "user", content: t });
  });
  return out;
}
