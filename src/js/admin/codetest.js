/* 코드 조합 이미지 테스트(관리자 빌드만, #codetest): 작품·인물을 고르고 감정/행동(조합엔 앞 2개)·의상·장소 코드를 눌러 조합 키를 만들고, 프롬프트 묶음을 확인한 뒤 Runware로 그려 본다.
   결과는 이 화면에만 쌓이고(저장 안 함, 새로 고치면 사라짐) '슬롯에 저장'을 누른 것만 그 인물의 그림(putCastImage — 내 작품 images·그 밖은 imgpacks)에 들어간다.
   '감정마다 한 장'은 고른 감정 하나하나에 같은 의상·장소를 붙여 차례로 그림(장당 약 $0.0025). 수위는 코드 수위의 최대(codeRating → imgRating: 성인 확인 전엔 늘 전체이용가).
   성인 수위 코드(2xx·3xx·406·408 — content/codes.admin.json의 관리자 전용 코드 포함)는 성인 확인 뒤에만 보이고, 한국어 프롬프트 번역에 OpenRouter 키가 필요(Claude에는 보내지 않음).
   화풍은 설정의 그림체(자동이면 작품 성향·인물 성별)이고, 이 화면에서만 다른 화풍으로 바꿔 볼 수 있다(설정은 바꾸지 않음) */
import { ageOK } from "../ai/adult.js";
import { ORIGINALS } from "../content/index.js";
import { audOf } from "../core/audience.js";
import { castLook } from "../core/cast.js";
import { getChar, normalizeChar } from "../core/character.js";
import { SIT } from "../core/constants.js";
import { S, hasOpenRouterKey, hasRunwareKey } from "../core/state.js";
import { $, $$, esc, toast, uid } from "../core/util.js";
import { DIM_NAMES, MAX_ACT, RESET, keyOf, parseCodes } from "../images/codes.js";
import { putCastImage } from "../images/pick.js";
import { lookIsMale, partsTags, savedParts } from "../images/prompt.js";
import { RATINGS, imgRating } from "../images/rating.js";
import { genErr, runwareImage } from "../images/runware.js";
import { codeDefs, codeRating, keyName } from "../images/situations.js";
import { imgModelInfo, styleFor, styleOptionsHTML } from "../images/styles.js";
import { IMG } from "../services/images.js";
import { copyText } from "../ui/chat/log.js";
import { lightbox } from "../ui/cover.js";
import { ICON } from "../ui/icons.js";
import { bindGo, topbar } from "../ui/shell.js";

/* 화면 상태 — 화면을 떠나도 세션 동안 남음(결과 그림은 object URL) */
const T = { work: "", cast: "", acts: [1], wear: null, place: null, aspect: "4:5", style: "", prompt: false, results: [] };
let busy = null; // { total, done, stop } — 생성 중

const nn = (n) => n !== null && n !== undefined;
const comboKey = () => keyOf([...T.acts.slice(0, MAX_ACT), T.wear, T.place].filter(nn)) || "1";
/* 이 화면에서 고른 화풍(설정은 바꾸지 않음): T.style이 비면 설정대로, 있으면 잠깐 바꿔 styleFor로 읽고 되돌림 */
function pickStyle(c, cast) {
  const ctx = { kind: "daily", aud: audOf(c), male: lookIsMale(castLook(cast, c)) };
  if (!T.style) return styleFor(ctx);
  const keep = S.settings.imgStyle; S.settings.imgStyle = T.style;
  try { return styleFor(ctx); } finally { S.settings.imgStyle = keep; }
}
const promptText = (c, cast, key) => savedParts(c, cast, key).filter((p) => p.tags.length).map((p) => `${p.label}: ${p.tags.map((x) => x.strong ? `(${x.t}:1.3)` : x.t).join(", ")}`).join("\n");

export function viewCodeTest() {
  const v = $("#view");
  const works = [...ORIGINALS, ...S.mine].map((w) => normalizeChar(w));
  const c = works.find((w) => w.id === T.work) || works[0]; T.work = c.id;
  const cast = c.cast.find((x) => x.code === T.cast) || c.cast[0]; T.cast = cast.code;
  const defs = codeDefs(); // 성인 확인이면 성인 수위 코드도
  const acts = [...SIT.map((s, i) => ({ n: i, name: s, rating: "safe", base: true })), ...defs.filter((d) => d.dim === "act")];
  const wears = defs.filter((d) => d.dim === "wear" && d.n !== RESET.wear), places = defs.filter((d) => d.dim === "place" && d.n !== RESET.place);
  T.acts = T.acts.filter((n) => acts.some((d) => d.n === n)); if (!T.acts.length) T.acts = [1];
  if (nn(T.wear) && !wears.some((d) => d.n === T.wear)) T.wear = null;
  if (nn(T.place) && !places.some((d) => d.n === T.place)) T.place = null;
  const chip = (d, on) => `<button class="ct-chip${on ? " on" : ""}${d.rating !== "safe" ? " adult" : ""}" data-n="${d.n}" title="${esc(d.prompt || "")}">${d.n} ${esc(d.name)}${d.rating !== "safe" ? " 🔞" : ""}${d.adminOnly ? " <small>관리자</small>" : d.shipped ? " <small>표</small>" : d.builtin || d.base ? "" : " <small>내 칸</small>"}</button>`;
  const key = comboKey(), rt = imgRating(codeRating(parseCodes(key), c)), st = pickStyle(c, cast);
  const card = (r) => `<div class="ct-card" data-id="${r.id}"><div class="pic"><img src="${r.url}" alt="" data-lb="${r.id}"></div>
    <div class="cap"><b>${esc(r.castName)} · ${esc(r.name)}</b><span>${esc(r.key)} · ${RATINGS[r.rating].name} · ${esc(r.style)} · ${r.sec}초</span></div>
    <div class="bs"><button data-save="${r.id}" title="이 인물의 그림 칸에 저장(대화에서 보임)">슬롯에 저장</button><button data-tags="${r.id}">태그 복사</button><button data-del="${r.id}">빼기</button></div></div>`;
  v.innerHTML = `<div class="page">${topbar(`<button class="icon-btn" data-go="works" aria-label="작품 화면으로">${ICON.back}</button>`)}
    <h1 class="sec" style="margin-top:4px">코드 조합 테스트 <small>관리자 도구</small></h1>
    <div class="box">
      <div class="two"><div class="field" style="margin-top:0"><label for="ctW">작품</label><select id="ctW">${works.map((w) => `<option value="${esc(w.id)}" ${w.id === c.id ? "selected" : ""}>${esc(w.title)}</option>`).join("")}</select></div>
        <div class="field" style="margin-top:0"><label for="ctC">인물</label><select id="ctC">${c.cast.map((x) => `<option value="${esc(x.code)}" ${x.code === cast.code ? "selected" : ""}>${esc(x.name)} (${esc(x.code)})</option>`).join("")}</select></div></div>
      <p class="note" style="margin:0">외모: ${esc(castLook(cast, c) || "(없음)")}${cast.tags ? ` · 영문 태그 ${esc(cast.tags)}` : ""}</p>
      <p class="note" style="margin:6px 0 0">${hasRunwareKey() ? "✓ Runware 키" : "✗ Runware 키 없음 — MY → 설정 → 이미지 생성"} · ${ageOK() ? "✓ 성인 확인(세미·성인 코드 보임)" : "– 성인 확인 전(전체이용가 코드만 보임)"} · ${hasOpenRouterKey() ? "✓ OpenRouter 키(성인 수위 프롬프트 번역)" : "– OpenRouter 키 없음(성인 수위 프롬프트는 번역·생성 불가)"}</p>
    </div>
    <div class="ct-grid">
      <div class="box ct-col"><h3>${DIM_NAMES.act} <small>조합엔 앞 ${MAX_ACT}개 · '감정마다 한 장'은 고른 전부</small></h3><div class="ct-chips" id="ctA">${acts.map((d) => chip(d, T.acts.includes(d.n))).join("")}</div></div>
      <div class="box ct-col"><h3>${DIM_NAMES.wear} <small>하나</small></h3><div class="ct-chips" id="ctWe">${wears.map((d) => chip(d, T.wear === d.n)).join("")}</div></div>
      <div class="box ct-col"><h3>${DIM_NAMES.place} <small>하나</small></h3><div class="ct-chips" id="ctP">${places.map((d) => chip(d, T.place === d.n)).join("")}</div></div>
    </div>
    <div class="box" style="margin-top:12px">
      <div class="ct-combo"><code>[[img:${esc(cast.code)}:${esc(key)}]]</code><b>${esc(keyName(key))}</b><span class="pill">${RATINGS[rt].name}</span><span class="note">화풍 ${esc(st.name)} · 모델 ${esc(imgModelInfo(st.model).name)}</span></div>
      <div class="two" style="margin-top:8px"><div class="field"><label for="ctS">화풍 <span class="note">이 화면에서만 바꿔 봄</span></label><select id="ctS"><option value="">설정대로</option>${styleOptionsHTML()}</select></div>
        <div class="field"><label for="ctR">비율</label><select id="ctR">${["4:5", "3:4", "1:1", "16:9"].map((a) => `<option ${a === T.aspect ? "selected" : ""}>${a}</option>`).join("")}</select></div></div>
      <div class="cta-row" style="margin:0"><button class="btn sm" id="ctPrompt">${T.prompt ? "프롬프트 숨기기" : "프롬프트 보기"}</button><span class="spacer"></span>
        <button class="btn sm" id="ctEach">${busy ? "멈추기" : `감정마다 한 장 (${T.acts.length}장)`}</button><button class="btn sm pri" id="ctGo" ${busy ? "disabled" : ""}>이 조합 그리기</button></div>
      <pre class="ct-prompt" id="ctPre" ${T.prompt ? "" : "hidden"}>${esc(promptText(c, cast, key))}\n\n그림체: ${esc(st.prompt)}</pre>
      <p class="note" style="margin:8px 0 0">한국어 태그는 그릴 때 영문 Danbooru 태그로 번역돼요(전체이용가는 Claude, 세미·성인은 OpenRouter). 결과 카드의 '태그 복사'가 실제로 보낸 태그예요.</p>
    </div>
    <div class="sheet-head" style="margin-top:14px"><h2 style="flex:1">결과 <small>${T.results.length}장 · 저장하지 않음</small></h2>${T.results.length ? `<button class="btn sm ghost" id="ctClear">전부 지우기</button>` : ""}</div>
    <div class="ct-results" id="ctRes">${busy ? `<div class="ct-card busy"><div class="pic"></div><div class="cap"><b>생성 중…</b><span>${busy.done}/${busy.total}</span></div></div>` : ""}${T.results.map(card).join("")}</div>
  </div>`;
  bindGo(v);
  $("#ctS", v).value = T.style;
  $("#ctW", v).onchange = (e) => { T.work = e.target.value; T.cast = ""; viewCodeTest(); };
  $("#ctC", v).onchange = (e) => { T.cast = e.target.value; viewCodeTest(); };
  $("#ctS", v).onchange = (e) => { T.style = e.target.value; viewCodeTest(); };
  $("#ctR", v).onchange = (e) => { T.aspect = e.target.value; viewCodeTest(); };
  $$("#ctA .ct-chip", v).forEach((b) => b.onclick = () => { const n = +b.dataset.n; T.acts = T.acts.includes(n) ? T.acts.filter((x) => x !== n) : [...T.acts, n]; viewCodeTest(); });
  $$("#ctWe .ct-chip", v).forEach((b) => b.onclick = () => { const n = +b.dataset.n; T.wear = T.wear === n ? null : n; viewCodeTest(); });
  $$("#ctP .ct-chip", v).forEach((b) => b.onclick = () => { const n = +b.dataset.n; T.place = T.place === n ? null : n; viewCodeTest(); });
  $("#ctPrompt", v).onclick = () => { T.prompt = !T.prompt; viewCodeTest(); };
  $("#ctGo", v).onclick = () => run(c, cast, [key]);
  $("#ctEach", v).onclick = () => run(c, cast, [...new Set(T.acts.map((a) => keyOf([a, T.wear, T.place].filter(nn)) || "1"))]);
  const cl = $("#ctClear", v); if (cl) cl.onclick = () => { T.results.forEach((r) => URL.revokeObjectURL(r.url)); T.results = []; viewCodeTest(); };
  $$("[data-lb]", v).forEach((im) => im.onclick = () => lightbox(im.src));
  const find = (id) => T.results.find((r) => r.id === id);
  $$("[data-save]", v).forEach((b) => b.onclick = async () => {
    const r = find(b.dataset.save); if (!r) return;
    const w = getChar(r.workId); if (!w) { toast("작품을 찾을 수 없어요"); return; }
    try { putCastImage(normalizeChar(w), r.code, r.key, await IMG.put(r.blob)); b.textContent = "저장됨"; b.disabled = true; toast(`${r.castName}의 ${r.name} 칸에 저장했어요 — 대화·슬롯 시트에서 보여요`); }
    catch { toast("저장하지 못했어요"); }
  });
  $$("[data-tags]", v).forEach((b) => b.onclick = () => { const r = find(b.dataset.tags); if (r) copyText(r.tags, "보낸 태그를 복사했어요"); });
  $$("[data-del]", v).forEach((b) => b.onclick = () => { const r = find(b.dataset.del); if (!r) return; URL.revokeObjectURL(r.url); T.results = T.results.filter((x) => x !== r); viewCodeTest(); });
}
/* 조합 키 하나를 그려 결과 하나로 */
async function draw(c, cast, key) {
  const rt = imgRating(codeRating(parseCodes(key), c)), st = pickStyle(c, cast), t0 = Date.now();
  const tags = await partsTags(savedParts(c, cast, key), rt !== "safe");
  const blob = await runwareImage(tags, { aspect: T.aspect, rating: rt, style: st });
  return { id: uid("ct"), url: URL.createObjectURL(blob), blob, key, name: keyName(key), rating: rt, style: st.name, tags, sec: ((Date.now() - t0) / 1000).toFixed(1), workId: c.id, code: cast.code, castName: cast.name };
}
/* 조합 키들을 차례로 그림(멈추기 가능). 키·크레딧·모델 오류면 바로 멈춤 */
async function run(c, cast, keys) {
  if (busy) { busy.stop = true; return; }
  if (!hasRunwareKey()) { toast(genErr({ code: "no_key" })); return; }
  busy = { total: keys.length, done: 0, stop: false }; viewCodeTest();
  let err = null, ok = 0;
  for (const k of keys) {
    if (busy.stop) break;
    try { T.results.unshift(await draw(c, cast, k)); ok++; }
    catch (e) { err = e; if (["no_key", "bad_key", "no_funds", "bad_model", "network", "rate_limited", "minor_block", "timeout"].includes(e?.code)) break; }
    busy.done++;
    if ((location.hash.slice(1) || "") === "codetest") viewCodeTest();
  }
  const stopped = busy.stop; busy = null;
  if ((location.hash.slice(1) || "") === "codetest") viewCodeTest();
  toast(`${ok}장 그렸어요${stopped ? " (멈춤)" : err ? ` · ${genErr(err)}` : ""}`);
}
