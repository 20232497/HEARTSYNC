/* 장기기억: N턴마다 요약·압축(maybeSummarize), 요약 지침 */
import { llm } from "../llm.js";
import { speakerName } from "./rules.js";
import { curText, saveRoom } from "../../core/rooms.js";
import { S } from "../../core/state.js";
import { $, $$, toast } from "../../core/util.js";
import { plan } from "../../core/wallet.js";

/* ---------------------------------------------------------------- 장기기억: N턴마다 자동 요약, 한도 초과 시 압축 후 히스토리 보관 */
let summarizing = false;
export function memCfg() { const c = S.settings.memCfg; return { ...c, limit: Math.min(c.limit, plan().memoMax) }; }
export function pushHist(r, text, label) {
  if (!text || !text.trim()) return;
  r.memHist = [{ at: Date.now(), label, text }, ...(r.memHist || [])].slice(0, plan().hist);
}
export async function maybeSummarize(r, manual = false) {
  const cfg = memCfg();
  if (summarizing) return;
  if (!manual && (!cfg.auto || (r.sinceMem || 0) < cfg.every)) return;
  const n = manual ? Math.max(1, r.sinceMem || cfg.every) : cfg.every;
  const msgs = r.msgs.filter((m) => !m.sys && curText(m)).slice(-(n * 2));
  if (!msgs.length) return;
  summarizing = true; flagMemo(true, "장기기억을 정리하는 중…");
  const to = r.turn || 0, from = Math.max(1, to - n + 1);
  const guide = cfg.guide === "custom" && cfg.custom.trim() ? cfg.custom.trim() : "사건 순서가 드러나게 쓰고 ① 무슨 일이 왜 일어났는지(원인→결과) ② 인물별 감정과 관계가 어떻게, 무엇 때문에 바뀌었는지 ③ 약속·밝혀진 과거와 비밀·얻거나 잃은 물건과 능력·중요한 수치 ④ 아직 풀리지 않은 떡밥과 갈등을 빠짐없이 남긴다.";
  try {
    const excerpt = msgs.map((m) => (m.role === "ai" ? speakerName(r) : r.persona.name) + ": " + curText(m).replace(/\[\[img:[^\]]*\]\]/g, "").replace(/\s+/g, " ").slice(0, 900)).join("\n");
    const v = await llm([{ role: "user", content: `롤플레이 「${r.char.title}」의 최근 ${n}턴을 장기기억용으로 요약하라. 유저 캐릭터 이름은 ${r.persona.name}.
요약 지침: ${guide}
JSON {"title":"이 구간의 짧은 제목(15자 이내)","summary":"4~8문장 요약"} 하나로만 답하라.

[직전까지의 기억 끝부분]
${(r.memory || "(없음)").slice(-800)}

[이번 구간 대화]
${excerpt}` }], { tier: "quick", json: true, room: r });
    if (!v || typeof v.summary !== "string") throw 0;
    r.memory = ((r.memory || "").trim() + `\n\n[${from}-${to}턴] ${String(v.title || "").slice(0, 30)}\n${v.summary.trim()}`).trim();
    // 요약하는 동안 진행된 턴은 다음 요약 몫으로 남김(0으로 지우면 그 턴들이 요약에서 빠짐)
    r.sinceMem = Math.max(0, (r.sinceMem || 0) - n);
    if (r.memory.length > cfg.limit) {
      pushHist(r, r.memory, "압축 전 기억");
      flagMemo(true, "기억이 길어져 압축하는 중…");
      const snap = r.memory;
      const c2 = await llm([{ role: "user", content: `다음 장기기억 노트를 ${Math.round(cfg.limit * 0.6)}자 이내로 압축하라. [a-b턴] 구간 표시는 합쳐도 되지만 사건 순서는 유지하고, 관계·약속·비밀·능력·수치·떡밥을 우선 남겨라. JSON {"memory":"..."} 하나로만 답하라.\n\n${r.memory}` }], { tier: "quick", json: true, room: r });
      // 압축하는 사이 기억이 바뀌었으면(직접 고침 등) 덮어쓰지 않고 다음 요약 때 다시 압축
      if (r.memory !== snap) {}
      else if (c2 && typeof c2.memory === "string" && c2.memory.trim()) r.memory = c2.memory.trim().slice(0, cfg.limit);
      else r.memory = r.memory.slice(-cfg.limit);
    }
    saveRoom(r);
    if (manual) toast("장기기억을 업데이트했어요");
  } catch (e) { if (manual) toast("요약하지 못했어요. 잠시 뒤 다시 시도해 주세요."); }
  finally { summarizing = false; flagMemo(false); }
}
function flagMemo(on, txt) {
  $$(".memo-flag").forEach((x) => x.remove());
  if (on && $(".chat")) { const f = document.createElement("div"); f.className = "memo-flag"; f.textContent = txt; $(".chat").append(f); }
}
