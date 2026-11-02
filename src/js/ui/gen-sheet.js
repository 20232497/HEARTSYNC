/* AI 이미지 생성 창(태그 칩 편집·인물에 태그 저장) */
import { minorHint } from "../core/safety.js";
import { S, hasOpenRouterKey, hasRunwareKey } from "../core/state.js";
import { $, $$, esc, toast } from "../core/util.js";
import { asTag, clearCastTags, groupsPrompt, hasSavedTags, saveCastTags, savedParts, splitTags } from "../images/prompt.js";
import { imgRating, ratingFieldHTML } from "../images/rating.js";
import { genErr, runwareImage } from "../images/runware.js";
import { imgModelId, imgModelInfo, styleLabel } from "../images/styles.js";
import { ICON } from "./icons.js";

/* 다른 시트 위에 겹쳐 뜨는 생성 창. 프롬프트는 묶음별 태그 칩(누르면 ★강조, ×로 빼기, 칸에 한국어·영어로 더하기).
   그림체·품질·수위·금지 태그는 숨겨 두고 runwareImage가 붙임. parts가 없으면 prompt 문자열을 한 묶음으로. onUse(blob)가 끝나면 닫혀요 */
/* save: {c, cast, i}를 주면(이미지 슬롯) 고친 태그를 그 인물에 저장·기본값으로 되돌리는 줄을 보여 줌 */
export function genImageSheet({ title = "AI로 이미지 만들기", prompt = "", parts, aspect = "4:5", rating, onUse, save }) {
  const model = imgModelInfo(imgModelId()).name;
  const toGroups = (ps) => { const gs = ps.map((g) => ({ ...g, tags: g.tags.map((t) => ({ ...asTag(t) })) })); if (!gs.some((g) => g.key === "extra")) gs.splice(1, 0, { key: "extra", label: "추가", tags: [] }); return gs; }; // 직접 더한 태그는 장면 바로 다음(앞쪽일수록 잘 반영됨)
  const groups = toGroups(parts || [{ key: "main", label: "프롬프트", tags: splitTags(prompt) }]);
  const ov = document.createElement("div"); ov.className = "overlay gen-ov";
  ov.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="sheet-head"><h2>${esc(title)}</h2><button class="icon-btn" data-x aria-label="닫기">${ICON.close}</button></div>
    <div id="gtags"></div>
    ${save ? `<div class="gen-save"><button type="button" class="btn sm pri" id="gsave">이 인물에 태그 저장</button><button type="button" class="btn sm ghost" id="greset">기본값으로</button><span class="note" id="gsaved"></span></div>` : ""}
    <p class="note" style="margin:8px 0 0">태그를 누르면 ★강조, ×는 빼기. ${S.engine === "none" && !hasOpenRouterKey() ? "AI 연결이 없어 한글은 빼고 보내요." : "한국어로 써도 영문 태그로 바꿔 보내요."}</p>
    <details class="gen-auto"><summary>자동으로 붙는 태그</summary><p class="note">그림체(${esc(styleLabel())}) · 품질 · 수위 · 금지(저품질·글자·미성년) 태그 · 모델 ${esc(model)}</p></details>
    ${ratingFieldHTML("grt", rating)}
    <div class="gen-pv" id="gpv"><span class="note">${hasRunwareKey() ? `비율 ${esc(aspect)} · 그림체 ${esc(styleLabel())}` : "설정에서 Runware API 키를 먼저 넣어 주세요."}</span></div>
    <div class="cta-row"><button class="btn ghost" data-x>닫기</button><span class="spacer"></span><button class="btn" id="gmk">생성</button><button class="btn pri" id="guse" disabled>이 이미지 쓰기</button></div></div>`;
  document.body.append(ov);
  const paintTags = (focusGroup) => {
    $("#gtags", ov).innerHTML = groups.map((g, gi) => `<div class="tgroup"><span class="lbl">${esc(g.label)}</span><div class="tchips">${g.tags.map((x, ti) => `<span class="tchip${x.strong ? " on" : ""}"><button type="button" data-tg="${gi}" data-ti="${ti}" title="눌러서 강조">${x.strong ? "★ " : ""}${esc(x.t)}</button><button type="button" class="tx" data-rg="${gi}" data-ri="${ti}" aria-label="${esc(x.t)} 빼기">×</button></span>`).join("")}<input class="tadd" data-ag="${gi}" maxlength="80" placeholder="+ 태그" aria-label="${esc(g.label)}에 태그 더하기"></div></div>`).join("");
    $$("[data-tg]", ov).forEach((b) => b.onclick = () => { const x = groups[+b.dataset.tg].tags[+b.dataset.ti]; x.strong = !x.strong; paintTags(); });
    $$("[data-rg]", ov).forEach((b) => b.onclick = () => { groups[+b.dataset.rg].tags.splice(+b.dataset.ri, 1); paintTags(); });
    $$("[data-ag]", ov).forEach((inp) => {
      const add = (refocus) => { const v = splitTags(inp.value); if (!v.length) return; groups[+inp.dataset.ag].tags.push(...v.map((t) => ({ t, strong: false }))); inp.value = ""; paintTags(refocus ? inp.dataset.ag : null); };
      inp.onkeydown = (e) => { if ((e.key === "Enter" || e.key === ",") && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); add(true); } };
      inp.onchange = () => add(false);
    });
    if (focusGroup != null) $(`[data-ag="${focusGroup}"]`, ov)?.focus();
  };
  paintTags();
  const buildPrompt = (adult) => groupsPrompt(groups, adult);
  if (save) {
    const { c, cast, i } = save, note = $("#gsaved", ov);
    const paintSaved = () => { note.textContent = hasSavedTags(c, cast.code, i) ? "저장한 태그를 쓰는 중이에요" : "기본 태그예요"; };
    $("#gsave", ov).onclick = () => { saveCastTags(c, cast, i, groups); paintSaved(); toast(`${cast.name}에 저장했어요. 인물 태그는 모든 칸에, 장면·추가·배경 태그는 이 칸에 써요`); };
    $("#greset", ov).onclick = () => { clearCastTags(c, cast, i); groups.splice(0, groups.length, ...toGroups(savedParts(c, cast, i))); paintTags(); paintSaved(); toast("기본 태그로 되돌렸어요"); };
    paintSaved();
  }
  let blob = null, url = "", ctl = null;
  const close = () => { ctl && ctl.abort(); url && URL.revokeObjectURL(url); ov.remove(); };
  ov.addEventListener("click", (e) => { if (e.target === ov || e.target.closest("[data-x]")) close(); });
  const pv = $("#gpv", ov), mk = $("#gmk", ov), use = $("#guse", ov);
  mk.onclick = async () => {
    if (!groups.some((g) => g.tags.length)) { toast("태그를 하나 이상 넣어 주세요."); return; }
    const rt = $("#grt", ov)?.value || "safe", adult = imgRating(rt) !== "safe";
    mk.disabled = use.disabled = true; pv.innerHTML = `<span class="note">만드는 중… 10~30초쯤 걸려요</span>`; ctl = new AbortController();
    try {
      if (adult && minorHint(groups.flatMap((g) => g.tags.map((x) => x.t)).join(", "))) throw { code: "minor_block" };
      blob = await runwareImage(await buildPrompt(adult), { aspect, rating: rt, signal: ctl.signal });
      url && URL.revokeObjectURL(url); url = URL.createObjectURL(blob);
      pv.innerHTML = `<img src="${url}" alt="생성된 이미지">`; use.disabled = false; mk.textContent = "다시 생성";
    } catch (e) { if (!ov.isConnected) return; blob = null; pv.innerHTML = `<span class="note">${esc(genErr(e))}</span>`; }
    finally { ctl = null; mk.disabled = false; }
  };
  use.onclick = async () => {
    if (!blob) return; use.disabled = true; toast("저장하는 중…");
    try { await onUse(blob); close(); } catch { use.disabled = false; toast("이미지를 저장하지 못했어요."); }
  };
  return ov;
}
