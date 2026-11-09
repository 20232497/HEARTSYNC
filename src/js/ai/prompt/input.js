/* 유저 메시지 끝에 붙는 [이번 응답] 지시(buildInput)와 [이미 쓴 문장](usedOpeners) */
import { LEN } from "../models.js";
import { matchLore } from "./lore.js";
import { rulesPrompt } from "./rules.js";
import { getChar } from "../../core/character.js";
import { commandText } from "../../core/commands.js";
import { LORE, MARK } from "../../core/constants.js";
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
      const t = p.replace(/\[\[[^\]]*\]\]/g, "").trim();
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
  const lore = matchLore(getChar(r.char.id)?.lore || r.char.lore, recent.slice(-LORE.scan).map((m) => (m.role === "ai" ? curText(m) : m.text) || ""));
  const len = LEN[r.set.len] || LEN.mid;
  const out = [{ role: "user", content: rulesPrompt(r, lore, hist) }];
  out.lore = lore.filter((e) => !e.always).map((e) => e.keys[0]); // 말풍선 📖에는 키워드로 걸린 것만(상시 항목은 늘 들어가므로 뺌)
  // 직전 응답 하나에는 그때의 상태창을 출력 형식 그대로 붙여 보냄 — 기록 속 응답이 모두 본문으로만 끝나면 그 모양을 따라 상태창을 빼먹는 모델이 많음(2026-11-09 모델 시험).
  // 추천 답변이 없던 응답(시작 상황 등)에는 형식을 보이기 위한 보기 셋을 넣음
  const lastAi = [...recent].reverse().find((m) => m.role === "ai");
  const stateTail = (m) => { const a = m.alts[m.idx] || {}; return `\n${MARK}\n` + JSON.stringify({ status: a.status || m.statusBefore || {}, suggestions: (a.suggestions || []).length ? a.suggestions : ["조금 더 가까이 다가간다", "솔직하게 속마음을 말한다", "화제를 돌려 상황을 살핀다"] }); };
  recent.forEach((m, i) => {
    const last = i === recent.length - 1;
    if (m.role === "ai") { out.push({ role: "assistant", content: curText(m) + (m === lastAi ? stateTail(m) : "") }); return; }
    // 앱 연출형 명령어(!시간경과 등)·작품 명령어(!퀘스트 등)는 그 명령의 prompt를 연출 지시(//)로 바꿔 보냄 — 화면의 말풍선은 친 그대로
    let t = m.sys ? "// 직전 장면에서 자연스럽게 이어서 다음 장면을 써라. 유저의 행동은 쓰지 않는다." : commandText(m.text, getChar(r.char.id) || r.char);
    // 분량·대화·새 전개 지시는 시스템 프롬프트에도 있지만, 모델이 가장 잘 따르는 마지막 입력 옆에 한 번 더
    if (last) t = `[현재 상태창 — 이번 장면은 여기서 출발한다]\n${JSON.stringify(statusBefore || {})}\n\n[${r.persona.name}의 입력]\n${t}${direction ? "\n\n// 다시 쓰기 지침: " + direction : ""}\n\n[이번 응답] 위 입력을 본문에 다시 옮겨 적지 말고 그 직후의 반응부터 쓴다. 본문 ${len.chars}, 대사 ${len.lines}줄 이상을 주고받고, 직전 응답과 다른 새 전개를 넣는다. 나오는 인물마다 [[코드번호]]를 한 장씩 넣는다${(() => { const h = m.sys ? [] : sitHints(m.text); return h.length ? `(유저 입력에 맞는 번호 후보: ${h.join(", ")})` : ""; })()}. 본문이 끝나면 한 줄에 ${MARK}를 쓰고 그 아래 상태 JSON 한 개로 응답을 마친다(빠뜨리지 않는다).`;
    out.push({ role: "user", content: t });
  });
  return out;
}
