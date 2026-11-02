/* ✦ AI 추천 답변 펼치기 */
import { errCopy, llm } from "../../ai/llm.js";
import { speakerName } from "../../ai/prompt/rules.js";
import { curText, saveRoom } from "../../core/rooms.js";
import { room } from "../../core/state.js";
import { $, $$, esc } from "../../core/util.js";
import { lastAi } from "./view.js";
import { ICON } from "../icons.js";

/* AI 추천 답변: 평소엔 숨김, 버튼을 누르면 표시 (없으면 무료로 생성) */
export function hideSug() { const p = $("#sugPanel"); if (p) p.hidden = true; const b = $("#sugBtn"); if (b) { b.classList.remove("on"); b.setAttribute("aria-expanded", "false"); } }
export async function toggleSug() {
  const p = $("#sugPanel"), b = $("#sugBtn");
  if (!p.hidden) return hideSug();
  p.hidden = false; b.classList.add("on"); b.setAttribute("aria-expanded", "true");
  const r = room, m = lastAi(r), alt = m && m.alts[m.idx];
  const paint = (list) => {
    p.innerHTML = `<div class="head">✦ 이렇게 이어가 보세요 <span class="spacer"></span><button class="btn sm ghost" id="sugRe">${ICON.redo.replace("<svg", '<svg width="14" height="14"')} 새로 추천</button><button class="btn sm ghost" id="sugX" aria-label="추천 닫기">닫기</button></div>` +
      list.map((s) => `<button class="s" data-s="${esc(s)}">${esc(s)}</button>`).join("");
    $$("[data-s]", p).forEach((x) => x.onclick = () => { const inp = $("#inp"); inp.value = x.dataset.s; inp.oninput(); inp.focus(); hideSug(); });
    $("#sugX", p).onclick = hideSug;
    $("#sugRe", p).onclick = () => fetchSug(true);
  };
  const fetchSug = async (force) => {
    if (!alt) return;
    if (!force && alt.suggestions && alt.suggestions.length) return paint(alt.suggestions);
    p.innerHTML = `<div class="head">✦ 추천 대사를 만드는 중… <span class="thinking"><i></i><i></i><i></i></span></div>`;
    const recent = r.msgs.filter((x) => curText(x) && !x.sys).slice(-6).map((x) => (x.role === "ai" ? speakerName(r) : r.persona.name) + ": " + curText(x).replace(/\[\[img:[^\]]*\]\]/g, "").slice(0, 700)).join("\n\n");
    try {
      const v = await llm([{ role: "user", content: `롤플레이 「${r.char.title}」의 최근 대화다. 유저 캐릭터 ${r.persona.name}가 다음에 보낼 만한 행동·대사 3개를 제안하라.
- 서로 다른 방향(다정·도발·신중 등), 각 40자 이내, ${r.persona.name}의 1인칭 시점. 행동은 *별표*, 대사는 "큰따옴표".
- JSON {"suggestions":["…","…","…"]} 하나로만 답하라.

${recent}` }], { tier: "quick", json: true, room: r });
      const list = Array.isArray(v?.suggestions) ? v.suggestions.filter((s) => typeof s === "string").map((s) => s.slice(0, 80)).slice(0, 3) : [];
      if (!list.length) throw { code: "invalid_json" };
      alt.suggestions = list; saveRoom(r);
      if (room === r && !p.hidden) paint(list);
    } catch (e) { if (room === r && !p.hidden) p.innerHTML = `<div class="head">추천을 만들지 못했어요. ${esc(errCopy(e))}<span class="spacer"></span><button class="btn sm ghost" id="sugX">닫기</button></div>`; $("#sugX", p) && ($("#sugX", p).onclick = hideSug); }
  };
  fetchSug(false);
}
