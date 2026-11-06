/* 상황 칸(이미지 코드) 편집: 추천 칸·목록으로 추가(표 붙여 넣기)·칸 고치기·기본 0~14 고치기·작성 구조 안내 — 이미지 스튜디오(admin/image-studio.js)의 코드 목록 위에 겹쳐 뜸.
   행동 코드 작성 구조: 번호: { title, base_prompt, motion_en } — 칸 이름 name·프롬프트 prompt·움직임 motion으로 저장. motion은 전체이용가 코드만 저장함(세미·성인 수위 칸의 움짤은 MOTION_PROMPT) */
import { ageOK } from "../ai/adult.js";
import { SIT } from "../core/constants.js";
import { minorHint } from "../core/safety.js";
import { saveSettings } from "../core/settings.js";
import { S } from "../core/state.js";
import { $, $$, esc, toast } from "../core/util.js";
import { DIMS, DIM_NAMES, dimOf } from "../images/codes.js";
import { baseSit, baseSitDefault } from "../images/prompt.js";
import { ratingFieldHTML } from "../images/rating.js";
import { genErr } from "../images/runware.js";
import { CODE_MAX, CUSTOM_MAX, allCustom, dropSitImages, freeSitNum } from "../images/situations.js";
import { ICON } from "../ui/icons.js";
import { MotionPrompts } from "./motion-table.js";

/* 행동 코드 작성 구조 안내 — 코드를 만드는 곳마다 같은 글. short면 구조·예시만(이미지 스튜디오의 코드 목록 아래), 아니면 칸마다 설명까지(코드 추가·목록으로 추가) */
const CODE_FORM = '번호: { title: "코드 이름", base_prompt: "그림 태그", motion_en: "움직임 문장" },';
const CODE_SAMPLE = '101: { title: "미소_지음", base_prompt: "smile, soft expression, gentle eyes, warm atmosphere, happy", motion_en: "smiling softly, gentle eyes blinking, warm and happy facial expression" },';
export function codeGuideHTML(short) {
  return `<div class="code-guide"><b>행동 코드 작성 구조</b><p class="note">행동 코드는 아래 구조로 작성해 주세요. '목록으로 추가'에는 이 모양 그대로 붙여 넣으면 돼요.</p>
    <code>${esc(CODE_FORM)}</code>${short ? "" : `<ul class="note"><li><b>title</b> 코드 이름 — 밑줄은 띄어쓰기로 보여요</li>
      <li><b>base_prompt</b> 정지 그림에 쓸 영문 태그 — 쉼표로 나눠요. 인물 외모는 자동으로 붙으니 표정·자세·상황만</li>
      <li><b>motion_en</b> 움짤에 쓸 영어 문장 — smiling softly처럼 -ing 꼴로. 전체이용가 코드에만 쓰여요</li>
      <li>상대가 개입하는 행동은 base_prompt나 motion_en에 pov를 넣으면 카메라가 1인칭으로 바뀌어요</li></ul>`}
    <span class="note">예시</span><code>${esc(CODE_SAMPLE)}</code></div>`;
}

/* 추천 칸 꾸러미: 기본 15칸·내장 코드에 없는 자주 쓰는 상황을 골라 한 번에 추가(태그는 영문, 추가한 뒤 '고치기'로 바꿀 수 있음).
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
    ["놀이공원", "amusement park, ferris wheel, holding balloon, smile"], ["밤 산책", "night, street lights, full body, walking, mid-stride, one leg forward, shoes, city lights, scarf"],
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
  const have = new Set([...allCustom().map((d) => d.name), ...Object.values(DIMS).map((d) => d.name)]); // 같은 이름의 내장 코드가 있으면 이미 있는 것으로
  const packs = SIT_PRESETS.filter((p) => !p.rating || ageOK());
  const ov = document.createElement("div"); ov.className = "overlay gen-ov";
  ov.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="sheet-head"><h2>추천 칸</h2><button class="icon-btn" data-x aria-label="닫기">${ICON.close}</button></div>
    <p class="sub" style="margin-top:0">고른 칸이 모든 인물에 생겨요. 추가한 뒤 '고치기'로 이름·프롬프트를 바꿀 수 있어요. 내장 코드(코드 표)에 이미 있는 이름은 흐리게 보여요.</p>
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
    const list = S.settings.customSits; let added = 0;
    for (const d of picked) { const n = list.length < CUSTOM_MAX ? freeSitNum("act") : -1; if (n < 0) break; list.push({ n, ...d }); added++; }
    if (!added) { toast(`칸은 ${CUSTOM_MAX}개까지 추가할 수 있어요.`); return; }
    saveSettings(); close(); after && after();
    toast(picked.length > added ? `${added}칸만 추가했어요(최대 ${CUSTOM_MAX}칸)` : `${picked.length}칸을 추가했어요`);
  };
}
/* 코드 표 한 행의 칸들: title: "…", base_prompt: "…" — 값 안의 다른 따옴표(partner's)와 \" 도 그대로 읽음 */
function rowFields(s) {
  const out = {}, re = /(\w+)\s*:\s*(["'`])((?:\\.|(?!\2)[^\\])*)\2/g;
  let m; while ((m = re.exec(s))) out[m[1]] = m[3].replace(/\\(.)/g, "$1");
  return out;
}
/* 표를 통째로 붙여 넣을 때의 껍데기(export const …, 주석, 닫는 괄호)는 칸이 아님 */
const NOT_A_ROW = /^\s*(?:export\b|const\b|let\b|var\b|\/\/|\/\*|\*|[{}[\]])/;
/* 목록 글 → 칸 후보. 한 줄에 하나: "이름", "이름=번호", "번호 = 이름", "이름 | 프롬프트", 또 작성 구조 `101: { title: "미소_지음", base_prompt: "…", motion_en: "…" },`(코드 표를 그대로 붙여 넣기 — 한 행이 여러 줄이어도 됨, base_prompt 대신 예전 이름 prompt도 읽음).
   세 자리 번호(100~599)는 그대로 쓰고(같은 번호의 내장 코드는 덮음, 이미 있는 번호면 '이미 있음'), 두 자리 이하 번호는 무시하고 빈 번호(15~)를 줌.
   프롬프트가 없으면 이름을 씀(만들 때 번역됨). 이름의 밑줄은 띄어쓰기로 */
export function parseSitList(text) {
  const base = new Set(SIT), list = allCustom(), have = new Set(list.map((d) => d.name)), nums = new Set(list.map((d) => d.n)), seen = new Set(), out = [];
  const flat = String(text || "").replace(/\{[^{}]*\}/g, (m) => m.replace(/\s*\r?\n\s*/g, " ")); // 여러 줄에 걸친 행을 한 줄로
  for (const raw of flat.split(/\r?\n/)) {
    if (NOT_A_ROW.test(raw)) continue;
    let n = null, name, prompt, motion = "";
    const ts = raw.match(/^\s*(\d{1,3})\s*:\s*\{(.*)$/);
    if (ts) { const f = rowFields(ts[2]); n = +ts[1]; name = f.title; prompt = f.base_prompt || f.prompt; motion = String(f.motion_en || "").trim(); }
    else {
      [name, prompt] = raw.split("|").map((x) => x.trim());
      const m1 = (name || "").match(/^\s*(\d{1,3})\s*[=:.)]\s*(.+)$/), m2 = (name || "").match(/^(.+?)\s*[=:]\s*(\d{1,3})\s*$/);
      if (m1) { n = +m1[1]; name = m1[2]; } else if (m2) { name = m2[1]; n = +m2[2]; }
    }
    name = String(name || "").replace(/_/g, " ").replace(/\s+/g, " ").trim().slice(0, 16);
    if (!name || seen.has(name)) continue;
    if (n !== null && (n < 100 || n >= CODE_MAX)) n = null;
    seen.add(name);
    out.push({ n, name, prompt: String(prompt || "").trim() || name, ...(motion ? { motion } : {}), dup: base.has(name) || have.has(name) || (n !== null && nums.has(n)), over: n !== null && !!DIMS[n] });
  }
  return out;
}
/* 목록으로 칸 여러 개 추가: 글을 붙여 넣거나 .txt를 고르면 칸 후보를 보여 주고, 고른 것만 한 수위로 추가 */
export function sitListSheet(after) {
  const ov = document.createElement("div"); ov.className = "overlay gen-ov";
  ov.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="sheet-head"><h2>목록으로 칸 추가</h2><button class="icon-btn" data-x aria-label="닫기">${ICON.close}</button></div>
    <p class="sub" style="margin-top:0">한 줄에 칸 하나. "키스", "키스=18", "18 = 키스", "키스 | 프롬프트", 아래 작성 구조 모두 돼요. 세 자리 번호(100~599)는 그대로 쓰고(같은 번호의 내장 코드를 덮어요), 그 밖은 15번부터 빈 번호를 매겨요. 프롬프트가 없으면 칸 이름을 영문 태그로 바꿔 써요.</p>
    <div class="field"><label for="slt">칸 목록</label><textarea id="slt" maxlength="40000" style="min-height:120px" placeholder="예:\n카페 데이트\n비 오는 날 | 비에 젖은 머리, 투명 우산\n120: { title: &quot;환희&quot;, base_prompt: &quot;big smile, sparkling eyes&quot;, motion_en: &quot;smiling brightly&quot; },"></textarea></div>
    <div class="cta-row" style="margin-top:6px"><button class="btn sm" id="slf" type="button">.txt 파일 불러오기</button><input type="file" id="slfile" accept=".txt,.js,.ts,text/plain" hidden></div>
    ${ratingFieldHTML("slr", "safe", "추가할 칸의 수위")}
    <div id="slpv"></div>
    <div class="cta-row"><span class="note" id="slc"></span><span class="spacer"></span><button class="btn ghost" data-x>취소</button><button class="btn pri" id="sladd" disabled>추가</button></div>
    ${codeGuideHTML()}</div>`;
  document.body.append(ov);
  const close = () => ov.remove();
  ov.addEventListener("click", (e) => { if (e.target === ov || e.target.closest("[data-x]")) close(); });
  let items = [];
  const paint = () => {
    items = parseSitList($("#slt", ov).value);
    $("#slpv", ov).innerHTML = items.length ? `<div class="tgroup"><span class="lbl">추가할 칸 (누르면 빼기)</span><div class="tchips">${items.map((d, i) => `<label class="tchip pick${d.dup ? "" : " on"}"><input type="checkbox" data-sl="${i}" ${d.dup ? "disabled" : "checked"}> ${esc(d.name)}${d.n !== null ? ` <small>${d.n}</small>` : ""}${d.motion ? " <small>움직임</small>" : ""}${d.dup ? " <small>이미 있음</small>" : d.over ? " <small>내장 덮어씀</small>" : ""}</label>`).join("")}</div></div>` : "";
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
    $("#slt", ov).value = t.slice(0, 40000); paint();
  };
  $("#sladd", ov).onclick = () => {
    const rating = $("#slr", ov).value || "safe", list = S.settings.customSits;
    const picked = $$("[data-sl]", ov).filter((b) => b.checked).map((b) => items[+b.dataset.sl]);
    const ok = picked.filter((d) => rating === "safe" || !minorHint(d.name + "\n" + d.prompt)), blocked = picked.length - ok.length;
    let added = 0, full = 0, noMotion = 0; const used = new Set(allCustom().map((d) => d.n)); // 실린 코드(content/codes.json)의 번호도 피함
    for (const d of ok) {
      if (list.length >= CUSTOM_MAX) { full++; continue; }
      const n = d.n !== null && !used.has(d.n) ? d.n : freeSitNum(d.n !== null ? dimOf(d.n) : "act");
      if (n < 0) { full++; continue; }
      if (d.motion && rating !== "safe") noMotion++;
      list.push({ n, name: d.name, prompt: d.prompt, rating, ...(d.motion && rating === "safe" ? { motion: d.motion } : {}) }); used.add(n); added++;
    }
    saveSettings(); close(); after && after();
    toast(`${added}칸을 추가했어요${full ? ` · 자리가 없어 ${full}칸은 빠졌어요(최대 ${CUSTOM_MAX}칸)` : ""}${blocked ? ` · 미성년으로 보이는 표현이 있는 ${blocked}칸은 뺐어요` : ""}${noMotion ? ` · 움직임은 전체이용가 코드에만 저장돼서 ${noMotion}칸은 뺐어요` : ""}`);
  };
}
/* 고칠 칸의 움직임 칸에 채울 문장: 고쳐 둔 것 → 표 */
const tableMo = (def) => (def && (def.motion || (MotionPrompts[def.n] || {}).motion_en)) || "";
/* 기본 0~14 고치기: 그림 태그·움직임만(S.settings.baseSits). 이름은 SIT 그대로 — AI 규칙이 이름으로 번호를 찾고 표정 낱말도 이름에 묶여 있음. 수위는 작품마다라 스튜디오의 '기본 감정 그림 수위'로 */
export function baseSitEditor(n, after) {
  const cur = baseSit(n) || {}, def0 = baseSitDefault(n);
  const ov = document.createElement("div"); ov.className = "overlay gen-ov";
  ov.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="sheet-head"><h2>기본 코드 고치기 <small>${n} ${esc(SIT[n])}</small></h2><button class="icon-btn" data-x aria-label="닫기">${ICON.close}</button></div>
    <p class="sub" style="margin-top:0">모든 작품·인물의 이 코드에 적용돼요. 이미 저장한 그림은 그대로이고, 새로 그릴 때부터 바뀌어요. 이름은 AI가 번호를 찾는 데 쓰여 바꿀 수 없어요.</p>
    <div class="field"><label for="bsP">프롬프트 <span class="note">base_prompt · 한국어로 써도 돼요 · 인물 외모는 자동으로 붙어요</span></label><textarea id="bsP" maxlength="600" style="min-height:90px">${esc(cur.prompt || def0)}</textarea></div>
    <div class="field"><label for="bsM">움직임 <span class="note">motion_en · 움짤에 쓸 영어 문장 · 비워 두면 가만히 숨 쉬는 움직임 · 이 칸의 수위가 전체이용가일 때만 쓰여요</span></label><textarea id="bsM" maxlength="400" style="min-height:60px" placeholder="예: blushing and looking away shyly">${esc(cur.motion || "")}</textarea></div>
    <div class="cta-row"><button class="btn ghost" id="bsR" ${baseSit(n) ? "" : "disabled"}>기본값으로</button><span class="spacer"></span><button class="btn ghost" data-x>취소</button><button class="btn pri" id="bsS">저장</button></div>
    ${codeGuideHTML()}</div>`;
  document.body.append(ov);
  const close = () => ov.remove();
  ov.addEventListener("click", (e) => { if (e.target === ov || e.target.closest("[data-x]")) close(); });
  const put = (o) => {
    const all = S.settings.baseSits = S.settings.baseSits || {};
    if (o) all[n] = o; else delete all[n];
    saveSettings(); close(); after && after();
  };
  $("#bsR", ov).onclick = () => { put(null); toast("기본값으로 돌렸어요"); };
  $("#bsS", ov).onclick = () => {
    const prompt = $("#bsP", ov).value.trim(), motion = $("#bsM", ov).value.trim();
    if (!prompt) return $("#bsP", ov).focus();
    // 기본값과 같은 것은 저장하지 않음 — 고친 것이 없으면 '수정' 표시도 없게
    const o = { ...(prompt !== def0 ? { prompt } : {}), ...(motion ? { motion } : {}) };
    put(Object.keys(o).length ? o : null); toast("기본 코드를 고쳤어요");
  };
}
/* 직접 추가하는 칸 만들기·고치기. 슬롯 시트 위에 겹쳐 뜸. 내장 코드(def.builtin)와 작품 폴더에 실린 코드(def.shipped)를 고치면 같은 번호의 내 칸을 만들어 덮음 — 실린 코드는 '코드 표 내보내기'로 다시 실음 */
export function sitEditor(def, after) {
  const ov = document.createElement("div"); ov.className = "overlay gen-ov";
  ov.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="sheet-head"><h2>${def ? (def.builtin ? "내장 코드 덮어쓰기" : def.adminOnly ? "관리자 전용 코드 고치기" : def.shipped ? "실린 코드 고치기" : "칸 고치기") : "이미지 칸 추가"}</h2><button class="icon-btn" data-x aria-label="닫기">${ICON.close}</button></div>
    <p class="sub" style="margin-top:0">${def ? `번호 ${def.n} · ${DIM_NAMES[dimOf(def.n)]}${def.builtin ? " · 저장하면 이 번호의 내 칸이 생겨 내장 코드를 대신해요(지우면 되돌아와요)." : def.adminOnly ? " · 관리자 전용 코드(content/codes.admin.json)예요. 저장하면 이 번호의 내 칸이 생겨 덮고 관리자 전용 표시는 유지돼요 — 사용자 사이트에는 실리지 않아요." : def.shipped ? " · 작품 폴더(content/codes.json)에 실린 코드예요. 저장하면 이 번호의 내 칸이 생겨 덮고, 작품 화면의 '코드 표 내보내기'로 다시 실어요." : ""}` : "모든 인물에 같은 칸이 생기고, 대화 중 AI가 이 칸의 그림을 넣을 수 있어요."}</p>
    ${def ? "" : `<div class="field"><label for="sdm">종류</label><select id="sdm"><option value="act">감정/행동 — 표정·자세·행동(번호 15~)</option><option value="wear">의상 — 감정 번호 뒤에 붙여 쓰는 옷(410~)</option><option value="place">장소 — 배경(510~)</option></select></div>`}
    <div class="field"><label for="snm">칸 이름</label><input id="snm" maxlength="16" value="${esc(def?.name || "")}" placeholder="예: 수영복, 잠옷, 비 오는 날"></div>
    <div class="field"><label for="spr">프롬프트 <span class="note">base_prompt · 한국어로 써도 돼요 · 인물 외모는 자동으로 붙어요</span></label><textarea id="spr" maxlength="600" style="min-height:90px" placeholder="예: 비에 젖은 머리, 투명 우산, 밤거리 네온">${esc(def?.prompt || "")}</textarea></div>
    <div class="field" id="smoF"><label for="smo">움직임 <span class="note">motion_en · 움짤에 쓸 영어 문장 · 비워 두면 가만히 숨 쉬는 움직임</span></label><textarea id="smo" maxlength="400" style="min-height:60px" placeholder="예: smiling softly, gentle eyes blinking">${esc(tableMo(def))}</textarea></div>
    ${ratingFieldHTML("srt", def?.rating || "safe")}<p class="note" id="smoN" style="margin:-6px 0 0" hidden>움직임 문장은 전체이용가 코드에만 저장돼요.</p>${ageOK() ? `<p class="note" style="margin:-6px 0 0">성인 수위 칸은 성인 모드 대화방에서만 쓰여요. 미성년으로 보이는 표현은 막아요.</p>` : ""}
    <div class="cta-row">${def && !def.builtin && !def.shipped ? `<button class="btn danger" id="sdel">삭제</button>` : ""}<span class="spacer"></span><button class="btn ghost" data-x>취소</button><button class="btn pri" id="ssv">저장</button></div>
    ${!def || dimOf(def.n) === "act" ? codeGuideHTML() : ""}</div>`;
  document.body.append(ov);
  const close = () => ov.remove();
  ov.addEventListener("click", (e) => { if (e.target === ov || e.target.closest("[data-x]")) close(); });
  $("#snm", ov).focus();
  // 움직임 칸은 감정/행동 코드이고 전체이용가일 때만
  const isAct = () => def ? dimOf(def.n) === "act" : ($("#sdm", ov)?.value || "act") === "act", ratingNow = () => $("#srt", ov)?.value || def?.rating || "safe";
  const syncMo = () => { $("#smoF", ov).hidden = !isAct() || ratingNow() !== "safe"; $("#smoN", ov).hidden = !isAct() || ratingNow() === "safe"; };
  syncMo();
  if ($("#srt", ov)) $("#srt", ov).onchange = syncMo;
  if ($("#sdm", ov)) $("#sdm", ov).onchange = syncMo;
  $("#ssv", ov).onclick = () => {
    const name = $("#snm", ov).value.trim(), prompt = $("#spr", ov).value.trim(), rating = ratingNow();
    if (!name) return $("#snm", ov).focus();
    if (!prompt) return $("#spr", ov).focus();
    if (rating !== "safe" && minorHint(name + "\n" + prompt)) { toast(genErr({ code: "minor_block" })); return; }
    const list = S.settings.customSits;
    // 표와 같은 문장이면 저장하지 않음 — 표가 바뀌면 따라가게
    const typed = isAct() && rating === "safe" ? $("#smo", ov).value.trim() : "", motion = typed && typed !== ((def && MotionPrompts[def.n]) || {}).motion_en ? typed : "";
    if (def && !def.builtin && !def.shipped) { Object.assign(def, { name, prompt, rating }); if (motion) def.motion = motion; else delete def.motion; }
    else {
      if (list.length >= CUSTOM_MAX) { toast(`칸은 ${CUSTOM_MAX}개까지 추가할 수 있어요.`); return; }
      const n = def ? def.n : freeSitNum($("#sdm", ov)?.value || "act");
      if (n < 0) { toast("이 종류의 빈 번호가 없어요. 쓰지 않는 칸을 지워 주세요."); return; }
      list.push({ n, name, prompt, rating, ...(motion ? { motion } : {}), ...(def && def.keys ? { keys: def.keys } : {}), ...(def && def.adminOnly ? { adminOnly: true } : {}) });
    }
    saveSettings(); close(); after && after(); toast(def ? "칸을 고쳤어요" : "칸을 추가했어요");
  };
  const del = $("#sdel", ov);
  if (del) del.onclick = () => {
    if (!del.dataset.sure) { del.dataset.sure = "1"; del.textContent = "모든 인물의 이 칸 그림도 지워져요. 한 번 더 누르면 삭제"; return; }
    S.settings.customSits = S.settings.customSits.filter((d) => d !== def); dropSitImages(def.n); saveSettings(); close(); after && after(); toast("칸을 지웠어요");
  };
}
