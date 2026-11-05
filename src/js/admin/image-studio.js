/* 이미지 스튜디오(관리자 빌드만, #images — 작품 id를 붙이면 #images-<id>): 인물 그림을 만드는 한 곳. 예전의 이미지 슬롯 시트(기본 칸 격자)·조합 만들기·코드 표·코드 조합 테스트를 합쳤다.
   왼쪽 코드 목록(admin/image-codes.js — 감정·행동/의상/장소 갈래, 번호대 묶음, 이 인물의 그림 수, 고치기·추가·빈 칸 채우기, 선택 삭제)에서 번호를 눌러 조합을 만들고,
   오른쪽에서 그 조합의 지금 그림(올리기·바꾸기·삭제·움짤)·프롬프트·화풍·비율을 보고 그린다(admin/image-run.js). 결과는 저장 전까지 화면에만, '바로 저장'을 켜면 그린 즉시 저장.
   아래 갤러리는 이 인물에 저장된 그림 전부(누르면 그 조합을 고름) — 칸마다 크게·움짤 만들기(admin/motion-run.js)·사진 ↔ 움짤 바꾸기·삭제. 기본 0~14도 다른 코드와 똑같이 목록의 한 묶음이고 ✎로 고침.
   감정·행동 탭의 코드 목록 아래에 행동 코드 작성 구조 안내(codeGuideHTML).
   들어오는 길: 메뉴 '이미지', 작품 화면·상세(인물 초상·'이미지 관리')·대화방 메뉴·스튜디오의 openImages(작품, 인물 코드) */
import { ageOK } from "../ai/adult.js";
import { ORIGINALS } from "../content/index.js";
import { castLook } from "../core/cast.js";
import { getChar, normalizeChar } from "../core/character.js";
import { SIT } from "../core/constants.js";
import { saveSettings } from "../core/settings.js";
import { S, hasOpenRouterKey, hasRunwareKey } from "../core/state.js";
import { $, $$, esc, toast } from "../core/util.js";
import { DIMS, DIM_NAMES, MAX_ACT, fallbackKeys, keyOf, parseCodes, splitDims } from "../images/codes.js";
import { flipMotion, motionOf } from "../images/motion.js";
import { imagesOf, pickImg, putCastImage } from "../images/pick.js";
import { savedParts } from "../images/prompt.js";
import { RATINGS, ratingFieldHTML, setSheetRating, sheetRating } from "../images/rating.js";
import { countSitImages, dropSitImages, keyName, sitDef } from "../images/situations.js";
import { imgModelInfo, styleOptionsHTML } from "../images/styles.js";
import { IMG, validRef } from "../services/images.js";
import { copyText } from "../ui/chat/log.js";
import { artHTML, lightbox, picHTML, zoomPic } from "../ui/cover.js";
import { ICON } from "../ui/icons.js";
import { bindGo, go, topbar } from "../ui/shell.js";
import { genImageSheet } from "./gen-sheet.js";
import { codeGroups, codeStats, deletable, dimCount, groupHTML } from "./image-codes.js";
import { ISTATE, ctxOf, keyRating, pickStyle, promptText, resultHTML, runKeys, saveResult, uploadMany } from "./image-run.js";
import { MJOBS, jobId, motionSheet } from "./motion-run.js";
import { baseSitEditor, codeGuideHTML, sitEditor, sitListSheet, sitPresetSheet } from "./sit-sheets.js";

ICON.image = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/></svg>';
/* 사진 ↔ 움짤 바꾸기: 위아래로 도는 두 화살표 */
ICON.flip = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19.5 9.5A8 8 0 0 0 5.2 7.4"/><path d="M4.5 14.5a8 8 0 0 0 14.3 2.1"/><path d="M5 3.5v4h4"/><path d="M19 20.5v-4h-4"/></svg>';
const T = ISTATE, nn = (n) => n !== null && n !== undefined;
const onHere = () => (location.hash.slice(1) || "").split("-")[0] === "images";
let MO_TICK = null; // 움짤 만드는 중인 칸의 경과 시간을 1초마다 고침(화면은 다시 그리지 않음)
/* 작품·인물을 골라 스튜디오를 엶 */
export function openImages(c, code) { T.work = c.id; T.cast = code || (T.work === c.id ? T.cast : ""); go("images-" + c.id); }
const comboKey = () => keyOf([...T.acts.slice(0, MAX_ACT), T.wear, T.place].filter(nn)) || "1";
/* 조합 키 → 고른 번호들로 */
function loadKey(key) { const d = splitDims(parseCodes(String(key))); T.acts = d.act.length ? d.act : [1]; T.wear = d.wear || null; T.place = d.place || null; }
const flipBtn = (k, on) => `<button class="mo-flip${on ? " on" : ""}" data-flip="${esc(k)}" title="${on ? "지금 움짤이 보여요 — 누르면 사진으로" : "지금 사진이 보여요 — 누르면 움짤로"}" aria-label="사진과 움짤 바꾸기">${ICON.flip}</button>`;
const busyHTML = (id) => `<span class="mo-busy" data-mjob="${esc(id)}">움짤 만드는 중…</span>`;

export function viewImages(arg) {
  if (arg && getChar(arg)) T.work = arg;
  const v = $("#view"), works = [...ORIGINALS, ...S.mine].map((w) => normalizeChar(w));
  const c = works.find((w) => w.id === T.work) || works[0]; T.work = c.id;
  const cast = c.cast.find((x) => x.code === T.cast) || c.cast[0]; T.cast = cast.code;
  const all = imagesOf(c), slots = all[cast.code] || {}, st = codeStats(slots), key = comboKey(), rt = keyRating(c, key), style = pickStyle(c, cast);
  // 지금 고른 번호가 목록에서 사라졌으면(코드를 지웠거나 성인 확인을 풀었음) 뺌
  const visible = new Set(["act", "wear", "place"].flatMap((d) => codeGroups(d).flatMap((g) => g.items.map((x) => x.n))));
  T.acts = T.acts.filter((n) => visible.has(n)); if (!T.acts.length) T.acts = [1];
  if (nn(T.wear) && !visible.has(T.wear)) T.wear = null;
  if (nn(T.place) && !visible.has(T.place)) T.place = null;
  if (T.del) [...T.del].forEach((n) => { if (!visible.has(n)) T.del.delete(n); });
  const on = (n) => T.acts.includes(n) || T.wear === n || T.place === n;
  const cur = validRef(slots[key]) ? slots[key] : null, fb = cur ? null : fallbackKeys(key).find((k) => validRef(slots[k]));
  const curMo = cur ? motionOf(c, cast.code, key) : null, curJob = MJOBS[jobId(c, cast.code, key)];
  const saved = Object.keys(slots).filter((k) => validRef(slots[k])).sort((a, b) => a.localeCompare(b, "ko", { numeric: true }));
  const chip = (n, dim) => `<span class="is-sel"><b>${n}</b> ${esc(keyName(String(n)))}<button data-unsel="${dim}:${n}" aria-label="빼기">×</button></span>`;
  const picked = T.acts.length > 1 || T.acts[0] !== 1 || nn(T.wear) || nn(T.place);
  const canDel = (S.settings.customSits || []).length > 0, delN = T.del ? T.del.size : 0, delImgs = delN ? countSitImages([...T.del]) : 0;
  const busy = T.busy;
  const keep = { list: $(".is-list", v)?.scrollTop || 0, y: window.scrollY };
  v.innerHTML = `<div class="page is-page">${topbar(`<button class="icon-btn" data-go="works" aria-label="작품 화면으로">${ICON.back}</button>`)}
    <h1 class="sec" style="margin-top:4px">이미지 스튜디오 <small>관리자 도구</small></h1>
    <div class="box is-head">
      <div class="is-top"><div class="field" style="margin:0"><label for="isW">작품</label><select id="isW">${works.map((w) => `<option value="${esc(w.id)}" ${w.id === c.id ? "selected" : ""}>${esc(w.title)}</option>`).join("")}</select></div>
        <p class="note is-keys">${hasRunwareKey() ? "✓ Runware 키" : "✗ Runware 키 없음 — MY → 설정 → 이미지 생성"} · ${ageOK() ? "✓ 성인 확인(세미·성인 코드 보임)" : "– 성인 확인 전(전체이용가 코드만)"} · ${hasOpenRouterKey() ? "✓ OpenRouter(성인 수위 번역)" : "– OpenRouter 키 없음"}</p></div>
      <div class="is-cast">${c.cast.map((x) => { const n = Object.values(all[x.code] || {}).filter(validRef).length, ref = pickImg(c, x.code, 0); return `<button class="is-who${x.code === cast.code ? " on" : ""}" data-who="${esc(x.code)}"><span class="av">${ref ? IMG.tag(ref) : artHTML(c, x, 0)}</span><b>${esc(x.name)}</b><small>${esc(x.code)} · ${n}장</small></button>`; }).join("")}</div>
      <p class="note" style="margin:6px 0 0">외모: ${esc(castLook(cast, c) || "(없음)")}${cast.tags ? ` · 영문 태그 ${esc(cast.tags)}` : ""}</p>
    </div>
    <div class="is-main">
      <section class="box is-codes${T.del ? " deleting" : ""}" aria-label="코드 목록">
        <div class="is-tabs" role="tablist">${["act", "wear", "place"].map((d) => `<button role="tab" class="${T.tab === d ? "on" : ""}" data-tab="${d}" aria-selected="${T.tab === d}">${DIM_NAMES[d]} <small>${dimCount(d)}</small></button>`).join("")}</div>
        <input class="inp is-q" id="isQ" placeholder="번호·이름으로 찾기" aria-label="코드 찾기">
        <div class="is-list">${codeGroups(T.tab).map((g) => groupHTML(g, on, !!T.closed[g.id], st, T.del)).join("")}</div>
        ${T.del ? `<div class="is-delbar"><div class="x"><b>${delN}개 선택</b><span class="note">${delN ? `${delImgs ? `이 코드가 든 그림 ${delImgs}장(모든 작품·인물, 움짤 포함)도 함께 지워져요.` : "이 코드로 저장한 그림은 없어요."} 내장 번호를 덮어쓴 칸은 지우면 내장 코드로 돌아가요.` : "지울 코드를 고르세요 — 직접 만들었거나 목록으로 들여온 코드만 지울 수 있어요. 탭을 바꿔도 고른 것은 남아요."}</span></div>
          <div class="cta-row"><button class="btn sm ghost" id="isDelX">취소</button><button class="btn sm danger" id="isDelGo" ${delN ? "" : "disabled"}>선택 삭제</button></div></div>`
        : `<div class="cta-row" style="margin-top:10px"><button class="btn sm" id="isAdd">+ 코드 추가</button><button class="btn sm" id="isList">목록으로 추가</button><button class="btn sm ghost" id="isPreset">추천 코드</button>${canDel ? `<span class="spacer"></span><button class="btn sm ghost" id="isDelMode" title="직접 만들었거나 목록으로 들여온 코드를 골라 한 번에 지우기">선택 삭제</button>` : ""}</div>
        ${T.tab === "act" ? codeGuideHTML(true) : ""}`}
      </section>
      <section class="box is-make" aria-label="조합과 생성">
        <div class="is-sels"><span class="lbl">${DIM_NAMES.act}</span>${T.acts.map((n, i) => chip(n, "act") + (i === MAX_ACT - 1 && T.acts.length > MAX_ACT ? `<span class="note">· 조합엔 앞 ${MAX_ACT}개</span>` : "")).join("")}
          <span class="lbl">${DIM_NAMES.wear}</span>${nn(T.wear) ? chip(T.wear, "wear") : `<span class="note">설정대로</span>`}<span class="lbl">${DIM_NAMES.place}</span>${nn(T.place) ? chip(T.place, "place") : `<span class="note">자동</span>`}
          ${picked ? `<button class="btn sm ghost is-clr" id="isSelClr" title="고른 감정·의상·장소를 모두 빼고 기본(1)으로">모두 빼기</button>` : ""}</div>
        <div class="ct-combo"><code>[[img:${esc(cast.code)}:${esc(key)}]]</code><b>${esc(keyName(key))}</b><span class="pill">${RATINGS[rt].name}</span></div>
        <div class="is-now">
          <div class="pic">${cur ? picHTML(cur, curMo && curMo.on ? curMo.ref : null) : fb ? `<span class="fb">${IMG.tag(slots[fb])}</span>` : artHTML(c, cast, key)}${curMo ? `<span class="mo-badge">${curMo.on ? "움짤" : "사진"}</span>` : ""}${curJob ? busyHTML(jobId(c, cast.code, key)) : ""}</div>
          <div class="x"><b>${cur ? (curMo && curMo.on ? "이 조합의 움짤" : "이 조합의 그림") : "아직 그림 없음"}</b>
            <span class="note">${cur ? (curMo ? `대화에서 이 조합이 나오면 ${curMo.on ? "움짤" : "사진"}이 보여요. ⟳로 바꿔요.` : "대화에서 이 조합이 나오면 이 그림이 보여요.") : fb ? `대화에서는 가까운 '${esc(keyName(fb))}' 그림으로 대신해요.` : "대화에서는 그림 대신 색 카드가 보여요."}</span>
            <div class="cta-row" style="margin-top:8px"><button class="btn sm" id="isUp">${cur ? "바꾸기(올리기)" : "그림 올리기"}</button>${cur ? `<button class="btn sm" data-mo="${esc(key)}" ${curJob ? "disabled" : ""}>${curMo ? "움짤 ✓" : "움짤 만들기"}</button>${curMo ? flipBtn(key, curMo.on) : ""}<button class="btn sm ghost" id="isRm">삭제</button>` : ""}</div></div>
        </div>
        <div class="two"><div class="field"><label for="isS">화풍 <span class="note">${esc(style.name)} · ${esc(imgModelInfo(style.model).name)}</span></label><select id="isS"><option value="">설정대로</option>${styleOptionsHTML()}</select></div>
          <div class="field"><label for="isR">비율</label><select id="isR">${["4:5", "3:4", "1:1", "16:9"].map((a) => `<option ${a === T.aspect ? "selected" : ""}>${a}</option>`).join("")}</select></div></div>
        ${ratingFieldHTML("isRt", sheetRating(c.id), "기본 감정(0~14) 그림 수위 — 다른 코드는 그 코드의 수위")}
        <label class="is-auto"><input type="checkbox" id="isAuto" ${T.autoSave ? "checked" : ""}> 그린 그림 바로 저장 <span class="note">끄면 결과에서 골라 저장</span></label>
        <div class="cta-row"><button class="btn sm ghost" id="isPrompt">${T.prompt ? "프롬프트 숨기기" : "프롬프트 보기"}</button><button class="btn sm ghost" id="isTags" title="태그를 고쳐 이 인물에 저장하거나 한 장 그려 봄">태그 고치기</button><span class="spacer"></span>
          ${T.acts.length > 1 ? `<button class="btn sm" id="isEach" ${busy ? "disabled" : ""}>감정마다 한 장 (${T.acts.length})</button>` : ""}<button class="btn sm pri" id="isGo">${busy ? `멈추기 · ${busy.done}/${busy.total}` : "이 조합 그리기"}</button></div>
        <pre class="ct-prompt" ${T.prompt ? "" : "hidden"}>${esc(promptText(c, cast, key))}\n\n그림체: ${esc(style.prompt)}</pre>
        ${busy ? `<p class="note is-busy">그리는 중 · ${esc(keyName(busy.key))} (${busy.done + 1}/${busy.total})</p>` : ""}
      </section>
    </div>
    ${T.results.length ? `<div class="sheet-head" style="margin-top:14px"><h2 style="flex:1">결과 <small>${T.results.length}장 · ${T.results.filter((r) => r.saved).length}장 저장</small></h2><button class="btn sm ghost" id="isClear">결과 비우기</button></div>
      <div class="ct-results">${T.results.map(resultHTML).join("")}</div>` : ""}
    <div class="sheet-head" style="margin-top:14px"><h2 style="flex:1">${esc(cast.name)}의 그림 <small>${saved.length}장</small></h2><button class="btn sm" id="isMany">여러 장 올리기</button></div>
    <p class="note" style="margin:0 0 8px">파일 이름을 3.png처럼 번호로, 조합은 3-404-501.png처럼 지으면 그 칸에 들어가요. 그림을 누르면 그 조합을 골라요. '움짤'로 그 사진을 몇 초짜리 영상으로 만들고, ⟳로 사진과 움짤 중 대화에 보일 것을 바꿔요.</p>
    <div class="is-gal">${saved.map((k) => { const mo = motionOf(c, cast.code, k), id = jobId(c, cast.code, k), job = MJOBS[id];
      return `<div class="is-gi${k === key ? " on" : ""}${mo && mo.on ? " mo-on" : ""}"><button class="pic" data-load="${esc(k)}" aria-label="${esc(keyName(k))} 고르기">${picHTML(slots[k], mo && mo.on ? mo.ref : null)}${mo ? `<span class="mo-badge">${mo.on ? "움짤" : "사진"}</span>` : ""}${job ? busyHTML(id) : ""}</button><span class="lb">${esc(keyName(k))}<small>${esc(k)}</small></span>
        <div class="bs"><button data-zoom="${esc(k)}">크게</button><button data-mo="${esc(k)}" ${job ? "disabled" : ""} title="${mo ? "움짤 다시 만들기·지우기" : "이 사진으로 움짤 만들기"}">움짤</button>${mo ? flipBtn(k, mo.on) : ""}<button data-gdel="${esc(k)}">삭제</button></div></div>`; }).join("") || `<p class="note">아직 저장한 그림이 없어요.</p>`}</div>
    <input type="file" id="isOne" accept="image/png,image/jpeg,image/webp" hidden><input type="file" id="isFiles" accept="image/png,image/jpeg,image/webp" multiple hidden>
  </div>`;
  bindGo(v); IMG.hydrate(v);
  const list = $(".is-list", v); list.scrollTop = keep.list; window.scrollTo(0, keep.y);
  bind(v, c, cast, key);
  tickJobs();
}
/* 움짤 만드는 중인 칸의 글을 1초마다 고침(경과 시간·진행률). 일이 없으면 멈춤 */
function tickJobs() {
  const paint = () => {
    const ids = Object.keys(MJOBS), els = $$("[data-mjob]");
    els.forEach((el) => { const j = MJOBS[el.dataset.mjob]; if (j) el.textContent = `${j.status} · ${Math.round((Date.now() - j.t0) / 1000)}초${j.progress ? ` · ${j.progress}%` : ""}`; });
    if (!ids.length || !onHere()) { clearInterval(MO_TICK); MO_TICK = null; }
    // 대화 중 자동 움짤처럼 이 화면 밖에서 시작한 일은 끝나도 다시 그려 주는 곳이 없으니 여기서
    if (onHere() && els.some((el) => !MJOBS[el.dataset.mjob])) viewImages();
  };
  paint();
  if (Object.keys(MJOBS).length && !MO_TICK) MO_TICK = setInterval(paint, 1000);
}
function bind(v, c, cast, key) {
  const re = () => { if (onHere()) viewImages(); };
  $("#isS", v).value = T.style;
  $("#isW", v).onchange = (e) => { T.work = e.target.value; T.cast = ""; go("images-" + T.work); };
  $$("[data-who]", v).forEach((b) => b.onclick = () => { T.cast = b.dataset.who; re(); });
  $$("[data-tab]", v).forEach((b) => b.onclick = () => { T.tab = b.dataset.tab; $(".is-list", v).scrollTop = 0; re(); });
  // 찾기는 다시 그리지 않고 줄만 숨김(입력 칸 포커스 유지)
  $("#isQ", v).oninput = (e) => { const q = e.target.value.trim().toLowerCase(); $$(".is-code", v).forEach((r) => { r.hidden = !!q && !r.dataset.find.includes(q); }); $$(".is-group", v).forEach((g) => g.classList.toggle("searching", !!q)); };
  $$("[data-fold]", v).forEach((b) => b.onclick = () => { const id = b.dataset.fold; T.closed[id] = !T.closed[id]; b.closest(".is-group").classList.toggle("closed", T.closed[id]); b.setAttribute("aria-expanded", String(!T.closed[id])); });
  // 선택 삭제 모드: 줄을 누르거나 체크하면 고름/뺌, 묶음의 '전체 선택'
  const toggleDel = (n) => { if (T.del.has(n)) T.del.delete(n); else T.del.add(n); re(); };
  $$("[data-pick]", v).forEach((b) => b.onclick = () => {
    const n = +b.dataset.pick, dim = T.tab;
    if (T.del) { if (b.closest(".is-code").querySelector(".is-chk")) toggleDel(n); return; }
    if (dim === "act") T.acts = T.acts.includes(n) ? T.acts.filter((x) => x !== n) : [...T.acts, n];
    else T[dim] = T[dim] === n ? null : n;
    re();
  });
  $$("[data-chk]", v).forEach((b) => b.onchange = () => toggleDel(+b.dataset.chk));
  $$("[data-gsel]", v).forEach((b) => b.onclick = () => {
    const g = codeGroups(T.tab).find((x) => x.id === b.dataset.gsel); if (!g) return;
    const ns = g.items.filter(deletable).map((d) => d.n), allOn = ns.every((n) => T.del.has(n));
    ns.forEach((n) => { if (allOn) T.del.delete(n); else T.del.add(n); }); re();
  });
  const dm = $("#isDelMode", v); if (dm) dm.onclick = () => { T.del = new Set(); re(); };
  const dx = $("#isDelX", v); if (dx) dx.onclick = () => { T.del = null; re(); };
  const dg = $("#isDelGo", v); if (dg) dg.onclick = () => {
    const ns = [...T.del]; if (!ns.length) return;
    if (!dg.dataset.sure) { dg.dataset.sure = "1"; dg.textContent = `한 번 더 누르면 ${ns.length}개 삭제`; return; }
    S.settings.customSits = (S.settings.customSits || []).filter((d) => ns.indexOf(d.n) < 0);
    dropSitImages(ns); saveSettings(); T.del = null; re(); toast(`코드 ${ns.length}개를 지웠어요`);
  };
  $$("[data-unsel]", v).forEach((b) => b.onclick = () => { const [dim, n] = b.dataset.unsel.split(":"); if (dim === "act") T.acts = T.acts.filter((x) => x !== +n); else T[dim] = null; re(); });
  const clr = $("#isSelClr", v); if (clr) clr.onclick = () => { T.acts = [1]; T.wear = null; T.place = null; re(); };
  $$("[data-edit]", v).forEach((b) => b.onclick = () => { const n = +b.dataset.edit; if (n < SIT.length) baseSitEditor(n, re); else sitEditor(sitDef(n) || DIMS[n], re); });
  const add = $("#isAdd", v); if (add) add.onclick = () => { sitEditor(null, re); const sd = $("#sdm"); if (sd) sd.value = T.tab; };
  const lst = $("#isList", v); if (lst) lst.onclick = () => sitListSheet(re);
  const pre = $("#isPreset", v); if (pre) pre.onclick = () => sitPresetSheet(re);
  // 묶음의 빈 칸 채우기: 그림이 없는 번호마다, 지금 고른 다른 갈래(의상·장소 / 감정)를 붙인 조합으로 그려 바로 저장
  $$("[data-fill]", v).forEach((b) => b.onclick = () => {
    const g = codeGroups(T.tab).find((x) => x.id === b.dataset.fill); if (!g) return;
    const st = codeStats(imagesOf(c)[cast.code] || {}), acts = T.acts.slice(0, MAX_ACT);
    const keys = g.items.filter((d) => !(st[d.n] || {}).exact).map((d) => keyOf(T.tab === "act" ? [d.n, T.wear, T.place].filter(nn) : T.tab === "wear" ? [...acts, d.n, T.place].filter(nn) : [...acts, T.wear, d.n].filter(nn)));
    runKeys(c, cast, [...new Set(keys)].filter((k) => !validRef((imagesOf(c)[cast.code] || {})[k])), true, re);
  });
  $("#isGo", v).onclick = () => runKeys(c, cast, [key], T.autoSave, re);
  const each = $("#isEach", v); if (each) each.onclick = () => runKeys(c, cast, [...new Set(T.acts.map((a) => keyOf([a, T.wear, T.place].filter(nn)) || "1"))], T.autoSave, re);
  $("#isS", v).onchange = (e) => { T.style = e.target.value; re(); };
  $("#isR", v).onchange = (e) => { T.aspect = e.target.value; };
  const rs = $("#isRt", v); if (rs) rs.onchange = () => { setSheetRating(c.id, rs.value); re(); };
  $("#isAuto", v).onchange = (e) => { T.autoSave = e.target.checked; };
  $("#isPrompt", v).onclick = () => { T.prompt = !T.prompt; re(); };
  $("#isTags", v).onclick = () => genImageSheet({ title: `${cast.name} · ${keyName(key)}`, parts: savedParts(c, cast, key), save: { c, cast, i: key }, aspect: T.aspect, rating: keyRating(c, key), ctx: ctxOf(c, cast),
    onUse: async (blob) => { putCastImage(c, cast.code, key, await IMG.put(blob)); re(); toast("이 조합에 저장했어요"); } });
  // 지금 조합의 그림 올리기·삭제
  $("#isUp", v).onclick = () => $("#isOne", v).click();
  $("#isOne", v).onchange = async (e) => { const f = e.target.files[0]; if (!f) return; toast("올리는 중…"); try { putCastImage(c, cast.code, key, await IMG.put(f)); re(); toast("그림을 넣었어요"); } catch { toast("이미지를 읽지 못했어요. PNG·JPG로 다시 올려 주세요."); } };
  const rm = $("#isRm", v); if (rm) rm.onclick = () => { if (!rm.dataset.sure) { rm.dataset.sure = "1"; rm.textContent = motionOf(c, cast.code, key) ? "한 번 더 — 사진·움짤 삭제" : "한 번 더 누르면 삭제"; return; } putCastImage(c, cast.code, key, null); re(); };
  // 움짤: 만들기 창 · 사진 ↔ 움짤 바꾸기
  $$("[data-mo]", v).forEach((b) => b.onclick = () => motionSheet(c, cast, b.dataset.mo, re));
  $$("[data-flip]", v).forEach((b) => b.onclick = (e) => { e.stopPropagation(); const on = flipMotion(c, cast.code, b.dataset.flip); re(); toast(on ? "움짤로 바꿨어요 — 대화에서도 움짤이 보여요" : "사진으로 바꿨어요"); });
  // 결과 카드
  const find = (id) => T.results.find((r) => r.id === id);
  $$("[data-lb]", v).forEach((im) => im.onclick = () => lightbox(im.src));
  $$("[data-save]", v).forEach((b) => b.onclick = async () => { const r = find(b.dataset.save); if (!r) return; try { await saveResult(r); re(); toast(`${r.castName}의 ${r.name} 칸에 저장했어요`); } catch { toast("저장하지 못했어요"); } });
  $$("[data-tags]", v).forEach((b) => b.onclick = () => { const r = find(b.dataset.tags); if (r) copyText(r.tags, "보낸 태그를 복사했어요"); });
  $$("[data-del]", v).forEach((b) => b.onclick = () => { const r = find(b.dataset.del); if (!r) return; URL.revokeObjectURL(r.url); T.results = T.results.filter((x) => x !== r); re(); });
  const cl = $("#isClear", v); if (cl) cl.onclick = () => { T.results.forEach((r) => URL.revokeObjectURL(r.url)); T.results = []; re(); };
  // 갤러리
  $$("[data-load]", v).forEach((b) => b.onclick = () => { loadKey(b.dataset.load); window.scrollTo(0, 0); re(); });
  $$("[data-zoom]", v).forEach((b) => b.onclick = () => zoomPic(b.closest(".is-gi").querySelector(".pic")));
  $$("[data-gdel]", v).forEach((b) => b.onclick = () => { if (!b.dataset.sure) { b.dataset.sure = "1"; b.textContent = motionOf(c, cast.code, b.dataset.gdel) ? "사진·움짤 삭제?" : "정말?"; return; } putCastImage(c, cast.code, b.dataset.gdel, null); re(); });
  $("#isMany", v).onclick = () => $("#isFiles", v).click();
  $("#isFiles", v).onchange = async (e) => { await uploadMany(c, cast.code, [...e.target.files]); re(); };
}
