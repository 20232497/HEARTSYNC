/* 상황 칸 편집: 추천 칸·목록으로 추가·칸 고치기 */
import { ageOK } from "../ai/adult.js";
import { SIT } from "../core/constants.js";
import { minorHint } from "../core/safety.js";
import { saveSettings } from "../core/settings.js";
import { S } from "../core/state.js";
import { $, $$, esc, toast } from "../core/util.js";
import { ratingFieldHTML } from "../images/rating.js";
import { genErr } from "../images/runware.js";
import { CUSTOM_BASE, CUSTOM_MAX, dropSitImages } from "../images/situations.js";
import { ICON } from "./icons.js";

/* 추천 칸 꾸러미: 기본 15칸에 없는 자주 쓰는 상황을 골라 한 번에 추가(태그는 영문, 추가한 뒤 '고치기'로 바꿀 수 있음).
   전체이용가·세미 수위만 — 노골적인 칸은 미리 채우지 않고 사용자가 직접 씀(CLAUDE.md 수위 원칙) */
const SIT_PRESETS = [
  { name: "일상·감정", items: [
    ["만남", "waving, greeting, smile, looking at viewer"], ["식사", "eating, holding chopsticks, sitting at table, food, happy"],
    ["대화", "talking, open mouth, hand gesture, looking at viewer"], ["정색", "serious, expressionless, cold stare, closed mouth"],
    ["행복", "happy, big smile, closed eyes, sparkle"], ["경계", "wary, narrowed eyes, frown, defensive posture"],
    ["고민", "thinking, hand on own chin, worried, looking to the side"], ["지침", "tired, exhausted, sweat, half-closed eyes, slouching"],
    ["비웃음", "smug, smirk, half-closed eyes, looking down at viewer"], ["취함", "drunk, blush, dazed, half-closed eyes, holding glass"],
    ["요리", "cooking, apron, kitchen, holding ladle"], ["게임", "playing video games, holding controller, sitting on floor, room"]] },
  { name: "장소·데이트", items: [
    ["카페", "cafe, sitting, holding cup, window, warm lighting"], ["해변", "beach, ocean, summer, sundress, wind, sunlight"],
    ["놀이공원", "amusement park, ferris wheel, holding balloon, smile"], ["밤 산책", "night, street lights, walking, city lights, scarf"],
    ["벚꽃", "cherry blossoms, falling petals, spring, park"], ["크리스마스", "christmas, santa hat, snow, christmas lights, holding gift"],
    ["비 오는 날", "rain, holding umbrella, wet hair, puddle, city street"], ["영화관", "movie theater, sitting, popcorn, dark, screen light on face"]] },
  { name: "로맨스", items: [
    ["손잡기", "pov, holding hands, blush, smile, looking at viewer"], ["포옹", "pov, hug, arms around viewer, happy, closed eyes"],
    ["고백", "confession, blush, nervous, holding letter, looking at viewer"], ["질투", "jealous, pout, crossed arms, looking away"],
    ["무릎베개", "lap pillow, looking down at viewer, pov, gentle smile"], ["키스 직전", "pov, incoming kiss, closed eyes, blush, close-up"]] },
  { name: "의상", items: [
    ["잠옷", "pajamas, bedroom, messy hair, sleepy, morning"], ["수영복", "swimsuit, pool, summer, water, sunlight"],
    ["메이드", "maid, maid headdress, apron, curtsey"], ["치어리더", "cheerleader, pom poms, energetic, smile"],
    ["마녀", "witch hat, witch, cape, magic, halloween"]] },
  { name: "세미 수위", rating: "questionable", items: [
    ["유혹", "seductive smile, half-closed eyes, finger to lips, looking at viewer, bedroom"],
    ["샤워 후", "after bath, wet hair, towel, steam, blush"], ["침대 위", "lying on bed, on side, looking at viewer, bedroom, soft lighting"]] }
];
export function sitPresetSheet(after) {
  const have = new Set((S.settings.customSits || []).map((d) => d.name));
  const packs = SIT_PRESETS.filter((p) => !p.rating || ageOK());
  const ov = document.createElement("div"); ov.className = "overlay gen-ov";
  ov.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="sheet-head"><h2>추천 칸</h2><button class="icon-btn" data-x aria-label="닫기">${ICON.close}</button></div>
    <p class="sub" style="margin-top:0">고른 칸이 모든 인물에 생겨요. 추가한 뒤 '고치기'로 이름·프롬프트를 바꿀 수 있어요.</p>
    ${packs.map((p, pi) => `<div class="tgroup"><span class="lbl">${esc(p.name)}${p.rating ? " 🔞" : ""}</span><div class="tchips">${p.items.map(([n], ii) => `<label class="tchip pick${have.has(n) ? " on" : ""}"><input type="checkbox" data-pp="${pi}" data-pi="${ii}" ${have.has(n) ? "checked disabled" : ""}> ${esc(n)}</label>`).join("")}</div></div>`).join("")}
    <div class="cta-row"><button class="btn sm ghost" id="pall">모두 고르기</button><span class="spacer"></span><button class="btn ghost" data-x>취소</button><button class="btn pri" id="padd">추가</button></div></div>`;
  document.body.append(ov);
  const close = () => ov.remove();
  ov.addEventListener("click", (e) => { if (e.target === ov || e.target.closest("[data-x]")) close(); });
  const boxes = $$("[data-pp]", ov).filter((b) => !b.disabled);
  boxes.forEach((b) => b.onchange = () => b.parentElement.classList.toggle("on", b.checked));
  $("#pall", ov).onclick = () => boxes.forEach((b) => { b.checked = true; b.onchange(); });
  $("#padd", ov).onclick = () => {
    const picked = boxes.filter((b) => b.checked).map((b) => { const p = packs[+b.dataset.pp], [name, prompt] = p.items[+b.dataset.pi]; return { name, prompt, rating: p.rating || "safe" }; });
    if (!picked.length) { close(); return; }
    const list = S.settings.customSits, space = CUSTOM_MAX - list.length;
    if (space <= 0) { toast(`칸은 ${CUSTOM_MAX}개까지 추가할 수 있어요.`); return; }
    for (const d of picked.slice(0, space)) { let n = CUSTOM_BASE; while (list.some((x) => x.n === n)) n++; list.push({ n, ...d }); }
    saveSettings(); close(); after && after();
    toast(picked.length > space ? `${space}칸만 추가했어요(최대 ${CUSTOM_MAX}칸)` : `${picked.length}칸을 추가했어요`);
  };
}
/* 목록 글 → 칸 후보. 한 줄에 하나: "이름", "이름=번호", "번호 = 이름", "이름 | 프롬프트". 번호는 무시하고(15번부터 차례로) 프롬프트가 없으면 이름을 씀(만들 때 번역됨) */
function parseSitList(text) {
  const base = new Set(SIT), have = new Set((S.settings.customSits || []).map((d) => d.name)), seen = new Set(), out = [];
  for (const raw of String(text || "").split(/\r?\n/)) {
    let [name, prompt] = raw.split("|").map((x) => x.trim());
    name = (name || "").replace(/^\s*\d+\s*[=:.)]\s*/, "").replace(/\s*[=:]\s*\d+\s*$/, "").trim();
    if (!name || name.length > 12 || seen.has(name)) continue;
    seen.add(name);
    out.push({ name, prompt: prompt || name, dup: base.has(name) || have.has(name) });
  }
  return out;
}
/* 목록으로 칸 여러 개 추가: 글을 붙여 넣거나 .txt를 고르면 칸 후보를 보여 주고, 고른 것만 한 수위로 추가 */
export function sitListSheet(after) {
  const ov = document.createElement("div"); ov.className = "overlay gen-ov";
  ov.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="sheet-head"><h2>목록으로 칸 추가</h2><button class="icon-btn" data-x aria-label="닫기">${ICON.close}</button></div>
    <p class="sub" style="margin-top:0">한 줄에 칸 하나. "키스", "키스=18", "18 = 키스", "키스 | 프롬프트" 모두 돼요. 번호는 15번부터 차례로 다시 매기고, 프롬프트가 없으면 칸 이름을 영문 태그로 바꿔 써요.</p>
    <div class="field"><label for="slt">칸 목록</label><textarea id="slt" maxlength="4000" style="min-height:120px" placeholder="예:\n카페 데이트\n비 오는 날 | 비에 젖은 머리, 투명 우산"></textarea></div>
    <div class="cta-row" style="margin-top:6px"><button class="btn sm" id="slf" type="button">.txt 파일 불러오기</button><input type="file" id="slfile" accept=".txt,text/plain" hidden></div>
    ${ratingFieldHTML("slr", "safe", "추가할 칸의 수위")}
    <div id="slpv"></div>
    <div class="cta-row"><span class="note" id="slc"></span><span class="spacer"></span><button class="btn ghost" data-x>취소</button><button class="btn pri" id="sladd" disabled>추가</button></div></div>`;
  document.body.append(ov);
  const close = () => ov.remove();
  ov.addEventListener("click", (e) => { if (e.target === ov || e.target.closest("[data-x]")) close(); });
  let items = [];
  const paint = () => {
    items = parseSitList($("#slt", ov).value);
    $("#slpv", ov).innerHTML = items.length ? `<div class="tgroup"><span class="lbl">추가할 칸 (누르면 빼기)</span><div class="tchips">${items.map((d, i) => `<label class="tchip pick${d.dup ? "" : " on"}"><input type="checkbox" data-sl="${i}" ${d.dup ? "disabled" : "checked"}> ${esc(d.name)}${d.dup ? " <small>이미 있음</small>" : ""}</label>`).join("")}</div></div>` : "";
    $$("[data-sl]", ov).forEach((b) => b.onchange = () => { b.parentElement.classList.toggle("on", b.checked); count(); });
    count();
  };
  const count = () => { const n = $$("[data-sl]", ov).filter((b) => b.checked).length, space = CUSTOM_MAX - S.settings.customSits.length; $("#slc", ov).textContent = n ? `${n}칸 · 남은 자리 ${space}칸` : ""; $("#sladd", ov).disabled = !n; };
  $("#slt", ov).oninput = paint;
  $("#slf", ov).onclick = () => $("#slfile", ov).click();
  $("#slfile", ov).onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const buf = await f.arrayBuffer();
    let t; try { t = new TextDecoder("utf-8", { fatal: true }).decode(buf); } catch { t = new TextDecoder("euc-kr").decode(buf); }
    $("#slt", ov).value = t.slice(0, 4000); paint();
  };
  $("#sladd", ov).onclick = () => {
    const rating = $("#slr", ov).value || "safe", list = S.settings.customSits;
    const picked = $$("[data-sl]", ov).filter((b) => b.checked).map((b) => items[+b.dataset.sl]);
    const ok = picked.filter((d) => rating === "safe" || !minorHint(d.name + "\n" + d.prompt)), blocked = picked.length - ok.length;
    const space = CUSTOM_MAX - list.length;
    if (space <= 0) { toast(`칸은 ${CUSTOM_MAX}개까지 추가할 수 있어요.`); return; }
    for (const d of ok.slice(0, space)) { let n = CUSTOM_BASE; while (list.some((x) => x.n === n)) n++; list.push({ n, name: d.name, prompt: d.prompt, rating }); }
    saveSettings(); close(); after && after();
    const added = Math.min(ok.length, space);
    toast(`${added}칸을 추가했어요${ok.length > space ? ` · 자리가 없어 ${ok.length - space}칸은 빠졌어요(최대 ${CUSTOM_MAX}칸)` : ""}${blocked ? ` · 미성년으로 보이는 표현이 있는 ${blocked}칸은 뺐어요` : ""}`);
  };
}
/* 직접 추가하는 칸 만들기·고치기. 슬롯 시트 위에 겹쳐 뜸 */
export function sitEditor(def, after) {
  const ov = document.createElement("div"); ov.className = "overlay gen-ov";
  ov.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="sheet-head"><h2>${def ? "칸 고치기" : "이미지 칸 추가"}</h2><button class="icon-btn" data-x aria-label="닫기">${ICON.close}</button></div>
    <p class="sub" style="margin-top:0">모든 인물에 같은 칸이 생기고, 대화 중 AI가 이 칸의 그림을 넣을 수 있어요.</p>
    <div class="field"><label for="snm">칸 이름</label><input id="snm" maxlength="12" value="${esc(def?.name || "")}" placeholder="예: 수영복, 잠옷, 비 오는 날"></div>
    <div class="field"><label for="spr">프롬프트 <span class="note">한국어로 써도 돼요 · 인물 외모는 자동으로 붙어요</span></label><textarea id="spr" maxlength="600" style="min-height:90px" placeholder="예: 비에 젖은 머리, 투명 우산, 밤거리 네온">${esc(def?.prompt || "")}</textarea></div>
    ${ratingFieldHTML("srt", def?.rating || "safe")}${ageOK() ? `<p class="note" style="margin:-6px 0 0">성인 수위 칸은 성인 모드 대화방에서만 쓰여요. 미성년으로 보이는 표현은 막아요.</p>` : ""}
    <div class="cta-row">${def ? `<button class="btn danger" id="sdel">삭제</button>` : ""}<span class="spacer"></span><button class="btn ghost" data-x>취소</button><button class="btn pri" id="ssv">저장</button></div></div>`;
  document.body.append(ov);
  const close = () => ov.remove();
  ov.addEventListener("click", (e) => { if (e.target === ov || e.target.closest("[data-x]")) close(); });
  $("#snm", ov).focus();
  $("#ssv", ov).onclick = () => {
    const name = $("#snm", ov).value.trim(), prompt = $("#spr", ov).value.trim(), rating = $("#srt", ov)?.value || def?.rating || "safe";
    if (!name) return $("#snm", ov).focus();
    if (!prompt) return $("#spr", ov).focus();
    if (rating !== "safe" && minorHint(name + "\n" + prompt)) { toast(genErr({ code: "minor_block" })); return; }
    const list = S.settings.customSits;
    if (def) Object.assign(def, { name, prompt, rating });
    else {
      if (list.length >= CUSTOM_MAX) { toast(`칸은 ${CUSTOM_MAX}개까지 추가할 수 있어요.`); return; }
      let n = CUSTOM_BASE; while (list.some((d) => d.n === n)) n++;
      list.push({ n, name, prompt, rating });
    }
    saveSettings(); close(); after && after(); toast(def ? "칸을 고쳤어요" : "칸을 추가했어요");
  };
  const del = $("#sdel", ov);
  if (del) del.onclick = () => {
    if (!del.dataset.sure) { del.dataset.sure = "1"; del.textContent = "모든 인물의 이 칸 그림도 지워져요. 한 번 더 누르면 삭제"; return; }
    S.settings.customSits = S.settings.customSits.filter((d) => d !== def); dropSitImages(def.n); saveSettings(); close(); after && after(); toast("칸을 지웠어요");
  };
}
