/* 이미지 스튜디오(관리자 빌드만, #images — 작품 id를 붙이면 #images-<id>): 인물 그림을 만드는 한 곳. 예전의 이미지 슬롯 시트(기본 칸 격자)·조합 만들기·코드 표·코드 조합 테스트를 합쳤다.
   왼쪽 코드 목록(admin/image-codes.js — 감정·행동/의상/장소 갈래, 번호대 묶음, 이 인물의 그림 수, 고치기·추가·빈 칸 채우기)에서 번호를 눌러 조합을 만들고,
   오른쪽에서 그 조합의 지금 그림(올리기·바꾸기·삭제)·프롬프트·화풍·비율을 보고 그린다(admin/image-run.js). 결과는 저장 전까지 화면에만, '바로 저장'을 켜면 그린 즉시 저장.
   아래 갤러리는 이 인물에 저장된 그림 전부(누르면 그 조합을 고름). 기본 0~14도 다른 코드와 똑같이 목록의 한 묶음 — 따로 칸 격자를 두지 않는다.
   들어오는 길: 메뉴 '이미지', 작품 화면·상세(인물 초상·'이미지 관리')·대화방 메뉴·스튜디오의 openImages(작품, 인물 코드) */
import { ageOK } from "../ai/adult.js";
import { ORIGINALS } from "../content/index.js";
import { castLook } from "../core/cast.js";
import { getChar, normalizeChar } from "../core/character.js";
import { S, hasOpenRouterKey, hasRunwareKey } from "../core/state.js";
import { $, $$, esc, toast } from "../core/util.js";
import { DIMS, DIM_NAMES, MAX_ACT, fallbackKeys, keyOf, parseCodes, splitDims } from "../images/codes.js";
import { imagesOf, pickImg, putCastImage } from "../images/pick.js";
import { savedParts } from "../images/prompt.js";
import { RATINGS, ratingFieldHTML, setSheetRating, sheetRating } from "../images/rating.js";
import { keyName, sitDef } from "../images/situations.js";
import { imgModelInfo, styleOptionsHTML } from "../images/styles.js";
import { IMG, validRef } from "../services/images.js";
import { copyText } from "../ui/chat/log.js";
import { artHTML, lightbox } from "../ui/cover.js";
import { ICON } from "../ui/icons.js";
import { bindGo, go, topbar } from "../ui/shell.js";
import { genImageSheet } from "./gen-sheet.js";
import { codeGroups, codeStats, dimCount, groupHTML } from "./image-codes.js";
import { ISTATE, ctxOf, keyRating, pickStyle, promptText, resultHTML, runKeys, saveResult, uploadMany } from "./image-run.js";
import { sitEditor, sitListSheet, sitPresetSheet } from "./sit-sheets.js";

ICON.image = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/></svg>';
const T = ISTATE, nn = (n) => n !== null && n !== undefined;
const onHere = () => (location.hash.slice(1) || "").split("-")[0] === "images";
/* 작품·인물을 골라 스튜디오를 엶 */
export function openImages(c, code) { T.work = c.id; T.cast = code || (T.work === c.id ? T.cast : ""); go("images-" + c.id); }
const comboKey = () => keyOf([...T.acts.slice(0, MAX_ACT), T.wear, T.place].filter(nn)) || "1";
/* 조합 키 → 고른 번호들로 */
function loadKey(key) { const d = splitDims(parseCodes(String(key))); T.acts = d.act.length ? d.act : [1]; T.wear = d.wear || null; T.place = d.place || null; }

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
  const on = (n) => T.acts.includes(n) || T.wear === n || T.place === n;
  const cur = validRef(slots[key]) ? slots[key] : null, fb = cur ? null : fallbackKeys(key).find((k) => validRef(slots[k]));
  const saved = Object.keys(slots).filter((k) => validRef(slots[k])).sort((a, b) => a.localeCompare(b, "ko", { numeric: true }));
  const chip = (n, dim) => `<span class="is-sel"><b>${n}</b> ${esc(keyName(String(n)))}<button data-unsel="${dim}:${n}" aria-label="빼기">×</button></span>`;
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
      <section class="box is-codes" aria-label="코드 목록">
        <div class="is-tabs" role="tablist">${["act", "wear", "place"].map((d) => `<button role="tab" class="${T.tab === d ? "on" : ""}" data-tab="${d}" aria-selected="${T.tab === d}">${DIM_NAMES[d]} <small>${dimCount(d)}</small></button>`).join("")}</div>
        <input class="inp is-q" id="isQ" placeholder="번호·이름으로 찾기" aria-label="코드 찾기">
        <div class="is-list">${codeGroups(T.tab).map((g) => groupHTML(g, on, !!T.closed[g.id], st)).join("")}</div>
        <div class="cta-row" style="margin-top:10px"><button class="btn sm" id="isAdd">+ 코드 추가</button><button class="btn sm" id="isList">목록으로 추가</button><button class="btn sm ghost" id="isPreset">추천 코드</button></div>
      </section>
      <section class="box is-make" aria-label="조합과 생성">
        <div class="is-sels"><span class="lbl">${DIM_NAMES.act}</span>${T.acts.map((n, i) => chip(n, "act") + (i === MAX_ACT - 1 && T.acts.length > MAX_ACT ? `<span class="note">· 조합엔 앞 ${MAX_ACT}개</span>` : "")).join("")}
          <span class="lbl">${DIM_NAMES.wear}</span>${nn(T.wear) ? chip(T.wear, "wear") : `<span class="note">설정대로</span>`}<span class="lbl">${DIM_NAMES.place}</span>${nn(T.place) ? chip(T.place, "place") : `<span class="note">자동</span>`}</div>
        <div class="ct-combo"><code>[[img:${esc(cast.code)}:${esc(key)}]]</code><b>${esc(keyName(key))}</b><span class="pill">${RATINGS[rt].name}</span></div>
        <div class="is-now">
          <div class="pic">${cur ? IMG.tag(cur) : fb ? `<span class="fb">${IMG.tag(slots[fb])}</span>` : artHTML(c, cast, key)}</div>
          <div class="x"><b>${cur ? "이 조합의 그림" : "아직 그림 없음"}</b>
            <span class="note">${cur ? "대화에서 이 조합이 나오면 이 그림이 보여요." : fb ? `대화에서는 가까운 '${esc(keyName(fb))}' 그림으로 대신해요.` : "대화에서는 그림 대신 색 카드가 보여요."}</span>
            <div class="cta-row" style="margin-top:8px"><button class="btn sm" id="isUp">${cur ? "바꾸기(올리기)" : "그림 올리기"}</button>${cur ? `<button class="btn sm ghost" id="isRm">삭제</button>` : ""}</div></div>
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
    <p class="note" style="margin:0 0 8px">파일 이름을 3.png처럼 번호로, 조합은 3-404-501.png처럼 지으면 그 칸에 들어가요. 그림을 누르면 그 조합을 골라요.</p>
    <div class="is-gal">${saved.map((k) => `<div class="is-gi${k === key ? " on" : ""}"><button class="pic" data-load="${esc(k)}" aria-label="${esc(keyName(k))} 고르기">${IMG.tag(slots[k])}</button><span class="lb">${esc(keyName(k))}<small>${esc(k)}</small></span><div class="bs"><button data-zoom="${esc(k)}">크게</button><button data-gdel="${esc(k)}">삭제</button></div></div>`).join("") || `<p class="note">아직 저장한 그림이 없어요.</p>`}</div>
    <input type="file" id="isOne" accept="image/png,image/jpeg,image/webp" hidden><input type="file" id="isFiles" accept="image/png,image/jpeg,image/webp" multiple hidden>
  </div>`;
  bindGo(v); IMG.hydrate(v);
  const list = $(".is-list", v); list.scrollTop = keep.list; window.scrollTo(0, keep.y);
  bind(v, c, cast, key);
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
  $$("[data-pick]", v).forEach((b) => b.onclick = () => {
    const n = +b.dataset.pick, dim = T.tab;
    if (dim === "act") T.acts = T.acts.includes(n) ? T.acts.filter((x) => x !== n) : [...T.acts, n];
    else T[dim] = T[dim] === n ? null : n;
    re();
  });
  $$("[data-unsel]", v).forEach((b) => b.onclick = () => { const [dim, n] = b.dataset.unsel.split(":"); if (dim === "act") T.acts = T.acts.filter((x) => x !== +n); else T[dim] = null; re(); });
  $$("[data-edit]", v).forEach((b) => b.onclick = () => { const n = +b.dataset.edit; sitEditor(sitDef(n) || DIMS[n], re); });
  $("#isAdd", v).onclick = () => { sitEditor(null, re); const dm = $("#sdm"); if (dm) dm.value = T.tab; };
  $("#isList", v).onclick = () => sitListSheet(re);
  $("#isPreset", v).onclick = () => sitPresetSheet(re);
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
  const rm = $("#isRm", v); if (rm) rm.onclick = () => { if (!rm.dataset.sure) { rm.dataset.sure = "1"; rm.textContent = "한 번 더 누르면 삭제"; return; } putCastImage(c, cast.code, key, null); re(); };
  // 결과 카드
  const find = (id) => T.results.find((r) => r.id === id);
  $$("[data-lb]", v).forEach((im) => im.onclick = () => lightbox(im.src));
  $$("[data-save]", v).forEach((b) => b.onclick = async () => { const r = find(b.dataset.save); if (!r) return; try { await saveResult(r); re(); toast(`${r.castName}의 ${r.name} 칸에 저장했어요`); } catch { toast("저장하지 못했어요"); } });
  $$("[data-tags]", v).forEach((b) => b.onclick = () => { const r = find(b.dataset.tags); if (r) copyText(r.tags, "보낸 태그를 복사했어요"); });
  $$("[data-del]", v).forEach((b) => b.onclick = () => { const r = find(b.dataset.del); if (!r) return; URL.revokeObjectURL(r.url); T.results = T.results.filter((x) => x !== r); re(); });
  const cl = $("#isClear", v); if (cl) cl.onclick = () => { T.results.forEach((r) => URL.revokeObjectURL(r.url)); T.results = []; re(); };
  // 갤러리
  $$("[data-load]", v).forEach((b) => b.onclick = () => { loadKey(b.dataset.load); window.scrollTo(0, 0); re(); });
  $$("[data-zoom]", v).forEach((b) => b.onclick = () => { const i = b.closest(".is-gi").querySelector("img"); if (i?.src) lightbox(i.src); });
  $$("[data-gdel]", v).forEach((b) => b.onclick = () => { if (!b.dataset.sure) { b.dataset.sure = "1"; b.textContent = "정말?"; return; } putCastImage(c, cast.code, b.dataset.gdel, null); re(); });
  $("#isMany", v).onclick = () => $("#isFiles", v).click();
  $("#isFiles", v).onchange = async (e) => { await uploadMany(c, cast.code, [...e.target.files]); re(); };
}
