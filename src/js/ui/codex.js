/* 도감(코드 안내) 화면: 상세 페이지의 인물 시트(castSheet — 코드·다른 모습·감정 칩·외형·소개)와 장소·컷씬·명령어 카드(codexHTML·bindCodex).
   데이터는 작품의 cast·places·cuts·commands, 코드 해석은 images/codes.js의 codebook 하나 — 작품이 바뀌어도 이 틀 그대로 */
import { APP_COMMANDS } from "../core/commands.js";
import { SIT } from "../core/constants.js";
import { $, $$, esc } from "../core/util.js";
import { codebook, imgTag } from "../images/codes.js";
import { imagesOf, pickImg } from "../images/pick.js";
import { sitName } from "../images/situations.js";
import { IMG, validRef } from "../services/images.js";
import { copyText } from "./chat/log.js";
import { artHTML, lightbox } from "./cover.js";
import { ICON } from "./icons.js";
import { sheet } from "./sheet.js";
/** @typedef {import("../core/types.js").CastMember} CastMember */
/** @typedef {import("../core/types.js").Work} Work */

/* 인물 한 명의 감정 칸 그림 — 그 칸 그림만(대체 없음), 없으면 아트 카드 */
function slotHTML(c, x, sit) {
  const m = imagesOf(c)[x.code] || {}, ref = validRef(m[sit]) ? m[sit] : null;
  return `<figure class="scene-img">${ref ? `${IMG.tag(ref)}<figcaption>${esc(x.name)} · ${esc(sitName(sit))}</figcaption>` : artHTML(c, x, sit)}</figure>`;
}
/**
 * 인물 시트: 이름·코드 → 미리보기 → 외형·소개 → 다른 모습(폼) 칩 → 감정·행동 칩(그림이 준비된 칸은 ●, 누르면 미리보기가 바뀜).
 * @param {Work} c @param {CastMember} x
 */
export function castSheet(c, x) {
  const forms = c.cast.filter((y) => y.of === x.code), base = x.of ? c.cast.find((y) => y.code === x.of) : null;
  const m = imagesOf(c)[x.code] || {}, ready = new Set(Object.keys(m).filter((k) => validRef(m[k])).map(Number));
  const sh = sheet(`<div class="sheet-head"><h2>${esc(x.name)} <code class="code-chip">${esc(x.code)}</code></h2><button class="icon-btn" data-x aria-label="닫기">${ICON.close}</button></div>
    ${base ? `<p class="sub"><code class="code-chip">${esc(base.code)}</code> ${esc(base.name)}의 다른 모습</p>` : ""}
    <div class="codex-pv" id="cxPv">${slotHTML(c, x, 0)}</div>
    <div class="codex-meta">${x.look ? `<p><b>외형</b>${esc(x.look)}</p>` : ""}${x.desc ? `<p><b>소개</b>${esc(x.desc)}</p>` : ""}</div>
    ${forms.length ? `<h3 class="codex-h">다른 모습</h3><div class="codex-chips">${forms.map((f) => `<button type="button" class="chip" data-form="${esc(f.code)}"><code>${esc(f.code)}</code>${esc(f.name)}</button>`).join("")}</div>` : ""}
    <h3 class="codex-h">감정·행동 코드 <small>${ready.size ? "그림이 준비된 칸은 ●" : "아직 그림이 없어 카드로 보여요"}</small></h3>
    <div class="codex-chips">${SIT.map((s, i) => `<button type="button" class="chip${i === 0 ? " on" : ""}${ready.has(i) ? " ready" : ""}" data-sit="${i}"><code>${esc(x.code)}${i}</code>${esc(s)}</button>`).join("")}</div>
    <p class="note" style="margin-top:12px">대화 본문에서는 ${esc(imgTag(x.code, 3))}처럼 코드 하나가 그림 한 장이에요 — AI가 장면마다 골라 넣어요.</p>`, "wide");
  IMG.hydrate(sh);
  $$("[data-sit]", sh).forEach((b) => b.onclick = () => { $$("[data-sit]", sh).forEach((o) => o.classList.toggle("on", o === b)); const pv = $("#cxPv", sh); pv.innerHTML = slotHTML(c, x, +b.dataset.sit); IMG.hydrate(pv); });
  $$("[data-form]", sh).forEach((b) => b.onclick = () => { const f = c.cast.find((y) => y.code === b.dataset.form); if (f) castSheet(c, f); });
  $("#cxPv", sh).onclick = () => { const i = $("#cxPv img", sh); if (i && i.src) lightbox(i.src); };
}
/* 시리즈(장소 MP·컷씬 EV) 한 칸: 코드·이름·설명(장소 desc / 컷씬 when)과 그림 — 목록이 비면 빈 문자열 */
function seriesBox(c, code, e) {
  if (!e.max) return "";
  return `<div class="box"><h3>${esc(e.label)} <small>코드 ${esc(code)}1~${esc(code)}${e.max}</small></h3><div class="codex-grid">${e.items.map((it, i) => {
    const n = i + 1, ref = pickImg(c, code, n), name = it[e.nameKey] || code + n, sub = it.desc || it.when || "";
    return `<figure class="wcard">${ref ? `<button class="wpic" data-cxlb aria-label="${esc(name)} 크게 보기">${IMG.tag(ref)}</button>` : `<div class="wpic ph">${esc(code + n)}</div>`}<figcaption><b><code class="code-chip">${esc(code + n)}</code>${esc(name)}</b>${sub ? `<span>${esc(sub)}</span>` : ""}</figcaption></figure>`; }).join("")}</div></div>`;
}
/* 명령어 카드 한 장: !이름 · 종류(앱/이야기) · 제목 · 설명 · 복사 */
function cmdCard(cmd, title, desc, app) {
  return `<div class="cmd-card"><code class="cmd">!${esc(cmd)}</code><span class="pill${app ? "" : " gold"}">${app ? "앱" : "이야기"}</span><b>${esc(title)}</b><span>${esc(desc || "")}</span><button type="button" class="btn sm ghost" data-copy="!${esc(cmd)}">복사</button></div>`;
}
/** 상세 페이지 아래쪽 칸들: 장소(MP)·컷씬(EV) 목록(작품에 있을 때만)과 명령어 카드(앱 명령어 + 작품 명령어). @param {Work} c @returns {string} */
export function codexHTML(c) {
  const book = codebook(c);
  return seriesBox(c, "MP", book.MP) + seriesBox(c, "EV", book.EV) +
    `<div class="box"><h3>명령어 <small>대화방 입력창에 그대로 쳐요 — 앱 명령어는 하트를 쓰지 않아요</small></h3><div class="cmd-list">${APP_COMMANDS.map((x) => cmdCard(x.cmd, x.title, x.desc, true)).join("")}${(c.commands || []).map((x) => cmdCard(x.cmd, x.title, x.desc, false)).join("")}</div></div>`;
}
/** codexHTML의 복사 버튼·그림 크게 보기 연결. @param {HTMLElement} v */
export function bindCodex(v) {
  $$("[data-copy]", v).forEach((b) => b.onclick = () => copyText(b.dataset.copy, `${b.dataset.copy} 복사했어요 — 대화방 입력창에 붙여 넣으세요`));
  $$("[data-cxlb]", v).forEach((b) => b.onclick = () => { const i = b.querySelector("img"); if (i && i.src) lightbox(i.src); });
}
