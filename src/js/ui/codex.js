/* 도감(코드 안내): 독립 화면 viewCodex(#codex·#codex-<작품id> — 공통 표·앱 명령어·작품 고르기·인물·장소·컷씬·작품 명령어), 인물 시트(castSheet — 코드·다른 모습·감정 칩·외형·소개),
   상세 페이지에 끼우는 칸(codexHTML·castGridHTML·bindCodex). 데이터는 작품의 cast·places·cuts·commands, 코드 해석은 images/codes.js의 codebook 하나 — 작품이 바뀌어도 이 틀 그대로 */
import { ORIGINALS } from "../content/index.js";
import { AUDS, audOK, audience } from "../core/audience.js";
import { normalizeChar } from "../core/character.js";
import { COMMAND_KINDS, allCommands } from "../core/commands.js";
import { DEFAULT_CREATOR, SIT, SIT_TINT } from "../core/constants.js";
import { $, $$, esc } from "../core/util.js";
import { codebook, imgTag } from "../images/codes.js";
import { imagesOf, pickImg } from "../images/pick.js";
import { sitName } from "../images/situations.js";
import { IMG, validRef } from "../services/images.js";
import { copyText } from "./chat/log.js";
import { artHTML, coverHTML, lightbox, portraitHTML } from "./cover.js";
import { ICON } from "./icons.js";
import { sheet } from "./sheet.js";
import { bindGo, go, topbar } from "./shell.js";
/** @typedef {import("../core/types.js").CastMember} CastMember */
/** @typedef {import("../core/types.js").Work} Work */

/* 비공개(스포일러) 안내 — 감정 칩의 title·잠긴 장소·컷씬 카드에 같이 씀 */
const LOCK_NOTE = "대화에서 나오면 보여요";
/* 인물 한 명의 감정 칸 그림 — 그 칸 그림만(대체 없음), 없거나 비공개(codebook의 hidden) 칸이면 아트 카드 */
function slotHTML(c, x, sit) {
  const m = imagesOf(c)[x.code] || {}, lock = hiddenOf(c, x.code).includes(sit), ref = !lock && validRef(m[sit]) ? m[sit] : null;
  return `<figure class="scene-img">${ref ? `${IMG.tag(ref)}<figcaption>${esc(x.name)} · ${esc(sitName(sit))}</figcaption>` : artHTML(c, x, sit)}</figure>`;
}
/**
 * 인물 시트: 이름·코드 → 미리보기 → 외형·소개 → 다른 모습(폼) 칩 → 감정·행동 칩(그림이 준비된 칸은 ●, 누르면 미리보기가 바뀜).
 * @param {Work} c @param {CastMember} x
 */
export function castSheet(c, x) {
  const forms = c.cast.filter((y) => y.of === x.code), base = x.of ? c.cast.find((y) => y.code === x.of) : null;
  const m = imagesOf(c)[x.code] || {}, ready = new Set(Object.keys(m).filter((k) => validRef(m[k])).map(Number)), hid = new Set(hiddenOf(c, x.code));
  const sh = sheet(`<div class="sheet-head"><h2>${esc(x.name)} <code class="code-chip">${esc(x.code)}</code></h2><button class="icon-btn" data-x aria-label="닫기">${ICON.close}</button></div>
    ${base ? `<p class="sub"><code class="code-chip">${esc(base.code)}</code> ${esc(base.name)}의 다른 모습</p>` : ""}
    <div class="codex-pv" id="cxPv">${slotHTML(c, x, 0)}</div>
    <div class="codex-meta">${x.look ? `<p><b>외형</b>${esc(x.look)}</p>` : ""}${x.desc ? `<p><b>소개</b>${esc(x.desc)}</p>` : ""}</div>
    ${forms.length ? `<h3 class="codex-h">다른 모습</h3><div class="codex-chips">${forms.map((f) => `<button type="button" class="chip" data-form="${esc(f.code)}"><code>${esc(f.code)}</code>${esc(f.name)}</button>`).join("")}</div>` : ""}
    <h3 class="codex-h">감정·행동 코드 <small>${ready.size ? "그림이 준비된 칸은 ●" : "아직 그림이 없어 카드로 보여요"}${hid.size ? ` · 🔒는 ${LOCK_NOTE}` : ""}</small></h3>
    <div class="codex-chips">${SIT.map((s, i) => `<button type="button" class="chip${i === 0 ? " on" : ""}${hid.has(i) ? " locked" : ready.has(i) ? " ready" : ""}" data-sit="${i}"${hid.has(i) ? ` title="${LOCK_NOTE}"` : ""}><code>${esc(x.code)}${i}</code>${esc(s)}</button>`).join("")}</div>
    <p class="note" style="margin-top:12px">대화 본문에서는 ${esc(imgTag(x.code, 3))}처럼 코드 하나가 그림 한 장이에요 — AI가 장면마다 골라 넣어요.</p>`, "wide");
  IMG.hydrate(sh);
  $$("[data-sit]", sh).forEach((b) => b.onclick = () => { $$("[data-sit]", sh).forEach((o) => o.classList.toggle("on", o === b)); const pv = $("#cxPv", sh); pv.innerHTML = slotHTML(c, x, +b.dataset.sit); IMG.hydrate(pv); });
  $$("[data-form]", sh).forEach((b) => b.onclick = () => { const f = c.cast.find((y) => y.code === b.dataset.form); if (f) castSheet(c, f); });
  $("#cxPv", sh).onclick = () => { const i = $("#cxPv img", sh); if (i && i.src) lightbox(i.src); };
}
/** 인물 카드 격자(상세 페이지·도감 공용): 본체만(폼은 시트 안 칩), 이름 아래 코드 칩. 누르는 건 bindCast. @param {Work} c @returns {string} */
export function castGridHTML(c) {
  return c.cast.filter((x) => !x.of).map((x) => `<button data-cast="${esc(x.code)}" title="${esc(x.look || x.name)}">${portraitHTML(c, x)}<b>${esc(x.name)}</b><code class="code-chip">${esc(x.code)}</code></button>`).join("");
}
/** 인물 카드를 누르면 인물 시트. @param {HTMLElement} v @param {Work} c */
export function bindCast(v, c) {
  $$("[data-cast]", v).forEach((b) => b.onclick = () => { const x = c.cast.find((y) => y.code === b.dataset.cast); if (x) castSheet(c, x); });
}
/* 코드 글자의 비공개 번호들(codebook의 hidden) — 작품에 없는 코드는 빈 배열 */
function hiddenOf(c, code) { const e = codebook(c)[code]; return e ? e.hidden : []; }
/* 시리즈(장소 MP·컷씬 EV) 한 칸: 코드·이름·설명(장소 desc / 컷씬 when)과 그림 — 목록이 비면 빈 문자열. 비공개 항목은 코드만 남긴 잠긴 카드(이름·설명·그림 모두 가림) */
function seriesBox(c, code, e) {
  if (!e.max) return "";
  return `<div class="box"><h3>${esc(e.label)} <small>코드 ${esc(code)}1~${esc(code)}${e.max}</small></h3><div class="codex-grid">${e.items.map((it, i) => {
    const n = i + 1;
    if (e.hidden.includes(n)) return `<figure class="wcard locked"><div class="wpic ph">🔒</div><figcaption><b><code class="code-chip">${esc(code + n)}</code>숨겨진 ${esc(e.label)}</b><span>${LOCK_NOTE}</span></figcaption></figure>`;
    const ref = pickImg(c, code, n), name = it[e.nameKey] || code + n, sub = it.desc || it.when || "";
    return `<figure class="wcard">${ref ? `<button class="wpic" data-cxlb aria-label="${esc(name)} 크게 보기">${IMG.tag(ref)}</button>` : `<div class="wpic ph">${esc(code + n)}</div>`}<figcaption><b><code class="code-chip">${esc(code + n)}</code>${esc(name)}</b>${sub ? `<span>${esc(sub)}</span>` : ""}</figcaption></figure>`; }).join("")}</div></div>`;
}
/* 명령어 카드 한 장: !이름 · 종류 배지(COMMAND_KINDS — 앱·연출·이야기) · 제목 · 설명 · 복사. x는 allCommands의 한 항목 */
function cmdCard(x) {
  const k = COMMAND_KINDS[x.kind];
  return `<div class="cmd-card"><code class="cmd">!${esc(x.cmd)}</code><span class="pill${x.kind === "work" ? " gold" : x.kind === "direct" ? " ok" : ""}" title="${esc(k.note)}">${esc(k.name)}</span><b>${esc(x.title)}</b><span>${esc(x.desc)}</span><button type="button" class="btn sm ghost" data-copy="!${esc(x.cmd)}">복사</button></div>`;
}
const cmdList = (list) => `<div class="cmd-list">${list.map(cmdCard).join("")}</div>`;
const KIND_LEGEND = Object.keys(COMMAND_KINDS).map((k) => `'${COMMAND_KINDS[k].name}' ${COMMAND_KINDS[k].note}`).join(" · ");
/** 상세 페이지 아래쪽 칸들: 장소(MP)·컷씬(EV) 목록(작품에 있을 때만)과 명령어 카드(앱 명령어 + 작품 명령어). @param {Work} c @returns {string} */
export function codexHTML(c) {
  const book = codebook(c);
  return seriesBox(c, "MP", book.MP) + seriesBox(c, "EV", book.EV) +
    `<div class="box"><h3>명령어 <small>대화방 입력창에 !를 치면 목록이 떠요</small></h3>${cmdList(allCommands(c))}<p class="note" style="margin-top:8px">${esc(KIND_LEGEND)}</p></div>`;
}
/** codexHTML·viewCodex의 복사 버튼·그림 크게 보기 연결. @param {HTMLElement} v */
export function bindCodex(v) {
  $$("[data-copy]", v).forEach((b) => b.onclick = () => copyText(b.dataset.copy, `${b.dataset.copy} 복사했어요 — 대화방 입력창에 붙여 넣으세요`));
  $$("[data-cxlb]", v).forEach((b) => b.onclick = () => { const i = b.querySelector("img"); if (i && i.src) lightbox(i.src); });
}
/** 작품 메타 한 줄(상세 페이지 머리·도감 작품 칸 공용): 제작자(work.js creator, 없으면 DEFAULT_CREATOR) · 공개일(publishedAt) · 독점 배지(exclusive). @param {Work} c @returns {string} */
export function metaHTML(c) {
  return `${esc(c.creator || DEFAULT_CREATOR)}${c.publishedAt ? ` · ${esc(String(c.publishedAt).replace(/-/g, "."))} 공개` : ""}${c.exclusive ? ' <span class="pill gold">독점</span>' : ""}`;
}
/** 플레이 가이드 칸 — 제작자가 독자에게 주는 안내문(work.js guide, 줄바꿈 그대로). 없으면 빈 문자열. 상세 페이지·도감 공용. @param {Work} c @returns {string} */
export function guideHTML(c) { return c.guide ? `<div class="box"><h3>플레이 가이드 <small>제작자의 안내</small></h3><p class="guide">${esc(c.guide)}</p></div>` : ""; }
/** 플레이 가이드 시트(대화방 드로어의 '플레이 가이드'). @param {Work} c */
export function guideSheet(c) {
  sheet(`<div class="sheet-head"><h2>플레이 가이드</h2><button class="icon-btn" data-x aria-label="닫기">${ICON.close}</button></div><p class="sub">${esc(c.title)}</p><p class="guide">${esc(c.guide || "")}</p>`);
}
/* 한 작품의 도감: 작품 머리(표지·제목·상세로) → 플레이 가이드 → 인물 카드 → 장소·컷씬 → 작품 명령어 */
function workCodexHTML(c) {
  const book = codebook(c), cmds = allCommands(c).filter((x) => x.kind === "work");
  return `<div class="codex-work">${coverHTML(c)}<div><b>${esc(c.title)}</b><span class="note">${esc(c.cat)}${c.world_mode ? " · 세계관" : ""} · 인물 ${c.cast.filter((x) => !x.of).length}명 · ${metaHTML(c)}</span></div><button class="btn sm ghost" data-go="c-${esc(c.id)}">작품 보기</button></div>
    ${guideHTML(c)}
    <div class="box"><h3>등장인물 <small>누르면 코드·감정 칸·소개</small></h3><div class="cast">${castGridHTML(c)}</div></div>
    ${seriesBox(c, "MP", book.MP)}${seriesBox(c, "EV", book.EV)}
    ${cmds.length ? `<div class="box"><h3>이 작품의 명령어 <small>치면 AI가 그 장면을 열어요</small></h3>${cmdList(cmds)}</div>` : ""}`;
}
/**
 * 도감 화면(#codex · #codex-<작품id>): 공통 표(그림 코드 읽는 법·감정 칸 0~14·앱 명령어) + 작품 고르기(관심있는 대화로 거름) → 그 작품의 인물·장소·컷씬·작품 명령어.
 * @param {string} [id] 작품 id(없거나 걸러졌으면 첫 작품)
 */
export function viewCodex(id) {
  const v = $("#view"), pool = ORIGINALS.map(normalizeChar).filter(audOK);
  const c = pool.find((x) => x.id === id) || pool[0] || null;
  v.innerHTML = `<div class="page">${topbar()}<h1 class="sec" style="margin-top:4px">도감 <small>인물 코드·감정 칸·장소·컷씬·명령어</small></h1>
    <div class="box"><h3>그림 코드 읽는 법</h3><p class="codex-how">대화 속 그림 한 장은 코드 한 토큰이에요. <code class="code-chip">HSY3</code>은 인물 코드 <b>HSY</b> + 감정·행동 번호 <b>3</b>(부끄러움). 다른 모습(폼)은 다른 인물 코드로, 장소는 <code class="code-chip">MP1</code>, 컷씬은 <code class="code-chip">EV1</code>처럼 1부터 번호를 매겨요.</p>
      <div class="sit-table">${SIT.map((s, i) => `<span class="sit-chip" style="--tint:${SIT_TINT[i]}"><i></i><code>${i}</code>${esc(s)}</span>`).join("")}</div></div>
    <div class="box"><h3>공통 명령어 <small>어느 작품에서나 · 대화방 입력창에 !를 치면 목록이 떠요</small></h3>${cmdList(allCommands(null))}<p class="note" style="margin-top:8px">${esc(KIND_LEGEND)}</p></div>
    <h2 class="sec" id="cxWorks">작품 <small>${esc(AUDS[audience()].name)}${audience() !== "all" ? " — MY → 설정에서 바꿀 수 있어요" : ""}</small></h2>
    ${pool.length ? `<div class="chips" style="margin-bottom:12px">${pool.map((x) => `<button class="chip${c && x.id === c.id ? " on" : ""}" data-work="${esc(x.id)}">${esc(x.title)}</button>`).join("")}</div>` : `<div class="empty">지금 관심있는 대화에 맞는 작품이 없어요. <button class="btn sm" data-go="me">설정 바꾸기</button></div>`}
    ${c ? workCodexHTML(c) : ""}</div>`;
  bindGo(v); IMG.hydrate(v); bindCodex(v);
  $$("[data-work]", v).forEach((b) => b.onclick = () => go("codex-" + b.dataset.work));
  if (c) bindCast(v, c);
  // 작품을 지정해 들어왔으면(칩을 눌렀거나 상세의 '도감') 공통 표를 건너뛰고 작품 칸부터 — 라우터(shell.js route)가 새 주소를 맨 위로 올린 다음 틱에 옮김
  if (id && c) setTimeout(() => { const h = $("#cxWorks", v); if (h && v.contains(h)) h.scrollIntoView({ block: "start" }); }, 0);
}
