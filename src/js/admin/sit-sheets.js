/* 상황 칸 편집: 추천 칸·목록으로 추가(표 붙여 넣기)·칸 고치기·코드 표 */
import { ageOK } from "../ai/adult.js";
import { SIT } from "../core/constants.js";
import { minorHint } from "../core/safety.js";
import { saveSettings } from "../core/settings.js";
import { S } from "../core/state.js";
import { $, $$, esc, toast } from "../core/util.js";
import { DIMS, DIM_NAMES, dimOf } from "../images/codes.js";
import { ratingFieldHTML } from "../images/rating.js";
import { genErr } from "../images/runware.js";
import { CODE_MAX, CUSTOM_MAX, allCustom, codeDefs, dropSitImages, freeSitNum, sitDef } from "../images/situations.js";
import { ICON } from "../ui/icons.js";

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
/* 목록 글 → 칸 후보. 한 줄에 하나: "이름", "이름=번호", "번호 = 이름", "이름 | 프롬프트", 또 `101: { title: "미소_지음", prompt: "입꼬리상승, …" },` 꼴(코드 표를 그대로 붙여 넣기).
   세 자리 번호(100~599)는 그대로 쓰고(같은 번호의 내장 코드는 덮음, 이미 있는 번호면 '이미 있음'), 두 자리 이하 번호는 무시하고 빈 번호(15~)를 줌.
   프롬프트가 없으면 이름을 씀(만들 때 번역됨). 이름의 밑줄은 띄어쓰기로 */
export function parseSitList(text) {
  const base = new Set(SIT), list = allCustom(), have = new Set(list.map((d) => d.name)), nums = new Set(list.map((d) => d.n)), seen = new Set(), out = [];
  for (const raw of String(text || "").split(/\r?\n/)) {
    let n = null, name, prompt;
    const ts = raw.match(/^\s*(\d{1,3})\s*:\s*\{\s*title\s*:\s*["'`]([^"'`]*)["'`]\s*,\s*prompt\s*:\s*["'`]([^"'`]*)["'`]/);
    if (ts) { n = +ts[1]; name = ts[2]; prompt = ts[3]; }
    else {
      [name, prompt] = raw.split("|").map((x) => x.trim());
      const m1 = (name || "").match(/^\s*(\d{1,3})\s*[=:.)]\s*(.+)$/), m2 = (name || "").match(/^(.+?)\s*[=:]\s*(\d{1,3})\s*$/);
      if (m1) { n = +m1[1]; name = m1[2]; } else if (m2) { name = m2[1]; n = +m2[2]; }
    }
    name = String(name || "").replace(/_/g, " ").replace(/\s+/g, " ").trim().slice(0, 16);
    if (!name || seen.has(name)) continue;
    if (n !== null && (n < 100 || n >= CODE_MAX)) n = null;
    seen.add(name);
    out.push({ n, name, prompt: String(prompt || "").trim() || name, dup: base.has(name) || have.has(name) || (n !== null && nums.has(n)), over: n !== null && !!DIMS[n] });
  }
  return out;
}
/* 목록으로 칸 여러 개 추가: 글을 붙여 넣거나 .txt를 고르면 칸 후보를 보여 주고, 고른 것만 한 수위로 추가 */
export function sitListSheet(after) {
  const ov = document.createElement("div"); ov.className = "overlay gen-ov";
  ov.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="sheet-head"><h2>목록으로 칸 추가</h2><button class="icon-btn" data-x aria-label="닫기">${ICON.close}</button></div>
    <p class="sub" style="margin-top:0">한 줄에 칸 하나. "키스", "키스=18", "18 = 키스", "키스 | 프롬프트", 코드 표(<code>101: { title: "…", prompt: "…" }</code>) 모두 돼요. 세 자리 번호(100~599)는 그대로 쓰고(같은 번호의 내장 코드를 덮어요), 그 밖은 15번부터 빈 번호를 매겨요. 프롬프트가 없으면 칸 이름을 영문 태그로 바꿔 써요.</p>
    <div class="field"><label for="slt">칸 목록</label><textarea id="slt" maxlength="40000" style="min-height:120px" placeholder="예:\n카페 데이트\n비 오는 날 | 비에 젖은 머리, 투명 우산\n404: { title: &quot;오피스룩&quot;, prompt: &quot;펜슬 스커트, 블라우스&quot; },"></textarea></div>
    <div class="cta-row" style="margin-top:6px"><button class="btn sm" id="slf" type="button">.txt 파일 불러오기</button><input type="file" id="slfile" accept=".txt,.js,.ts,text/plain" hidden></div>
    ${ratingFieldHTML("slr", "safe", "추가할 칸의 수위")}
    <div id="slpv"></div>
    <div class="cta-row"><span class="note" id="slc"></span><span class="spacer"></span><button class="btn ghost" data-x>취소</button><button class="btn pri" id="sladd" disabled>추가</button></div></div>`;
  document.body.append(ov);
  const close = () => ov.remove();
  ov.addEventListener("click", (e) => { if (e.target === ov || e.target.closest("[data-x]")) close(); });
  let items = [];
  const paint = () => {
    items = parseSitList($("#slt", ov).value);
    $("#slpv", ov).innerHTML = items.length ? `<div class="tgroup"><span class="lbl">추가할 칸 (누르면 빼기)</span><div class="tchips">${items.map((d, i) => `<label class="tchip pick${d.dup ? "" : " on"}"><input type="checkbox" data-sl="${i}" ${d.dup ? "disabled" : "checked"}> ${esc(d.name)}${d.n !== null ? ` <small>${d.n}</small>` : ""}${d.dup ? " <small>이미 있음</small>" : d.over ? " <small>내장 덮어씀</small>" : ""}</label>`).join("")}</div></div>` : "";
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
    let added = 0, full = 0; const used = new Set(allCustom().map((d) => d.n)); // 실린 코드(content/codes.json)의 번호도 피함
    for (const d of ok) {
      if (list.length >= CUSTOM_MAX) { full++; continue; }
      const n = d.n !== null && !used.has(d.n) ? d.n : freeSitNum(d.n !== null ? dimOf(d.n) : "act");
      if (n < 0) { full++; continue; }
      list.push({ n, name: d.name, prompt: d.prompt, rating }); used.add(n); added++;
    }
    saveSettings(); close(); after && after();
    toast(`${added}칸을 추가했어요${full ? ` · 자리가 없어 ${full}칸은 빠졌어요(최대 ${CUSTOM_MAX}칸)` : ""}${blocked ? ` · 미성년으로 보이는 표현이 있는 ${blocked}칸은 뺐어요` : ""}`);
  };
}
/* 직접 추가하는 칸 만들기·고치기. 슬롯 시트 위에 겹쳐 뜸. 내장 코드(def.builtin)와 작품 폴더에 실린 코드(def.shipped)를 고치면 같은 번호의 내 칸을 만들어 덮음 — 실린 코드는 '코드 표 내보내기'로 다시 실음 */
export function sitEditor(def, after) {
  const ov = document.createElement("div"); ov.className = "overlay gen-ov";
  ov.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="sheet-head"><h2>${def ? (def.builtin ? "내장 코드 덮어쓰기" : def.shipped ? "실린 코드 고치기" : "칸 고치기") : "이미지 칸 추가"}</h2><button class="icon-btn" data-x aria-label="닫기">${ICON.close}</button></div>
    <p class="sub" style="margin-top:0">${def ? `번호 ${def.n} · ${DIM_NAMES[dimOf(def.n)]}${def.builtin ? " · 저장하면 이 번호의 내 칸이 생겨 내장 코드를 대신해요(지우면 되돌아와요)." : def.shipped ? " · 작품 폴더(content/codes.json)에 실린 코드예요. 저장하면 이 번호의 내 칸이 생겨 덮고, 작품 화면의 '코드 표 내보내기'로 다시 실어요." : ""}` : "모든 인물에 같은 칸이 생기고, 대화 중 AI가 이 칸의 그림을 넣을 수 있어요."}</p>
    ${def ? "" : `<div class="field"><label for="sdm">종류</label><select id="sdm"><option value="act">감정/행동 — 표정·자세·행동(번호 15~)</option><option value="wear">의상 — 감정 번호 뒤에 붙여 쓰는 옷(410~)</option><option value="place">장소 — 배경(510~)</option></select></div>`}
    <div class="field"><label for="snm">칸 이름</label><input id="snm" maxlength="16" value="${esc(def?.name || "")}" placeholder="예: 수영복, 잠옷, 비 오는 날"></div>
    <div class="field"><label for="spr">프롬프트 <span class="note">한국어로 써도 돼요 · 인물 외모는 자동으로 붙어요</span></label><textarea id="spr" maxlength="600" style="min-height:90px" placeholder="예: 비에 젖은 머리, 투명 우산, 밤거리 네온">${esc(def?.prompt || "")}</textarea></div>
    ${ratingFieldHTML("srt", def?.rating || "safe")}${ageOK() ? `<p class="note" style="margin:-6px 0 0">성인 수위 칸은 성인 모드 대화방에서만 쓰여요. 미성년으로 보이는 표현은 막아요.</p>` : ""}
    <div class="cta-row">${def && !def.builtin && !def.shipped ? `<button class="btn danger" id="sdel">삭제</button>` : ""}<span class="spacer"></span><button class="btn ghost" data-x>취소</button><button class="btn pri" id="ssv">저장</button></div></div>`;
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
    if (def && !def.builtin && !def.shipped) Object.assign(def, { name, prompt, rating });
    else {
      if (list.length >= CUSTOM_MAX) { toast(`칸은 ${CUSTOM_MAX}개까지 추가할 수 있어요.`); return; }
      const n = def ? def.n : freeSitNum($("#sdm", ov)?.value || "act");
      if (n < 0) { toast("이 종류의 빈 번호가 없어요. 쓰지 않는 칸을 지워 주세요."); return; }
      list.push({ n, name, prompt, rating, ...(def && def.keys ? { keys: def.keys } : {}) });
    }
    saveSettings(); close(); after && after(); toast(def ? "칸을 고쳤어요" : "칸을 추가했어요");
  };
  const del = $("#sdel", ov);
  if (del) del.onclick = () => {
    if (!del.dataset.sure) { del.dataset.sure = "1"; del.textContent = "모든 인물의 이 칸 그림도 지워져요. 한 번 더 누르면 삭제"; return; }
    S.settings.customSits = S.settings.customSits.filter((d) => d !== def); dropSitImages(def.n); saveSettings(); close(); after && after(); toast("칸을 지웠어요");
  };
}
/* 코드 표: 대화·슬롯에 쓰는 번호 전부(기본 0~14 · 직접 만든 칸 · 내장 코드)를 종류별로. 직접 만든 칸은 고치기, 내장 코드는 내 칸으로 덮어쓰기 */
export function codeTableSheet(after) {
  const ov = document.createElement("div"); ov.className = "overlay gen-ov";
  const paint = () => {
    const defs = codeDefs(), done = () => { paint(); after && after(); };
    const row = (n, nameHTML, prompt, btn) => `<tr><td class="num">${n}</td><td><b>${nameHTML}</b></td><td class="note" style="white-space:normal">${esc(prompt)}</td><td>${btn}</td></tr>`;
    const rows = (dim) => [
      ...(dim === "act" ? SIT.map((s, i) => row(i, esc(s), "기본 칸", "")) : []),
      ...defs.filter((d) => d.dim === dim).map((d) => row(d.n, esc(d.name) + (d.rating !== "safe" ? " 🔞" : "") + (d.builtin ? "" : d.shipped ? ' <span class="pill">작품 폴더</span>' : ' <span class="pill">내 칸</span>'), d.prompt || "(설정대로)",
        d.builtin ? `<button class="btn sm ghost" data-ov="${d.n}">덮어쓰기</button>` : `<button class="btn sm" data-ed="${d.n}">고치기</button>`))
    ].join("");
    ov.innerHTML = `<div class="sheet wide" role="dialog" aria-modal="true"><div class="sheet-head"><h2>이미지 코드 표</h2><button class="icon-btn" data-x aria-label="닫기">${ICON.close}</button></div>
      <p class="sub" style="margin-top:0">대화 중 AI가 [[img:인물코드:번호]]에 쓰는 번호예요. 감정/행동 번호 뒤에 의상·장소 번호를 쉼표로 붙이면 조합(예: 3,404,501)이고, 400·500은 설정대로 되돌리기예요. 세미·성인 수위 코드는 성인 모드 대화방에서만 AI에게 알려 줘요.</p>
      ${["act", "wear", "place"].map((dim) => `<h3 class="lbl" style="margin:12px 0 6px">${DIM_NAMES[dim]}</h3><table class="tbl code-tbl"><tbody>${rows(dim)}</tbody></table>`).join("")}
      <div class="cta-row"><button class="btn sm" id="ctAdd">+ 칸 추가</button><span class="spacer"></span><button class="btn ghost" data-x>닫기</button></div></div>`;
    $$("[data-ed]", ov).forEach((b) => b.onclick = () => sitEditor(sitDef(+b.dataset.ed), done));
    $$("[data-ov]", ov).forEach((b) => b.onclick = () => sitEditor(DIMS[+b.dataset.ov], done));
    $("#ctAdd", ov).onclick = () => sitEditor(null, done);
  };
  paint(); document.body.append(ov);
  ov.addEventListener("click", (e) => { if (e.target === ov || e.target.closest("[data-x]")) ov.remove(); });
}
