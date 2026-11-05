/* 홈: 대표 작품·가로 줄·둘러보기, 관심있는 대화 고르기 */
import { HOME_ROWS, ORIGINALS } from "../content/index.js";
import { AUDS, audOK, audOf, audience } from "../core/audience.js";
import { CATS } from "../core/constants.js";
import { on } from "../core/events.js";
import { saveSettings } from "../core/settings.js";
import { S } from "../core/state.js";
import { $, $$, ago, esc, toast } from "../core/util.js";
import { IMG } from "../services/images.js";
import { coverHTML } from "./cover.js";
import { ICON } from "./icons.js";
import { closeOverlays, sheet } from "./sheet.js";
import { bindGo, go, topbar } from "./shell.js";

export function cardHTML(c) {
  const info = c.world_mode && (c.cast || []).length > 1 ? `<span class="cast-n">👥 ${c.cast.length}인 · 🎬 ${(c.openings || []).length}</span>` : "";
  const aud = audience() === "all" && audOf(c) !== "all" ? `<span class="aud-tag">${AUDS[audOf(c)].name}</span>` : "";
  return `<button class="card" data-char="${esc(c.id)}"><div style="position:relative">${coverHTML(c, "", { vt: true, cat: true })}${info}</div>
    <span class="t">${esc(c.name)}</span><span class="d">${esc(c.oneLiner)}</span>
    <span class="meta">${aud}${(c.tags || []).slice(0, 3).map((t) => `<span>#${esc(t)}</span>`).join("")}</span></button>`;
}
/* 관심있는 대화 고르기: 처음 시작할 때(first) 한 번, 홈·설정에서 바꿀 수 있음 */
export function audSegHTML() {
  return `<div class="seg aud-seg">${Object.keys(AUDS).map((k) => `<button type="button" data-aud="${k}" class="${audience() === k ? "on" : ""}">${AUDS[k].name}<small>${AUDS[k].desc}</small></button>`).join("")}</div>`;
}
export function setAudience(k) { S.settings.audience = AUDS[k] ? k : "all"; saveSettings(); }
export function audSheet(first) {
  const ov = sheet(`<h2>관심있는 대화</h2><p class="sub">${first ? "어떤 대화를 보고 싶으세요? " : ""}고른 쪽 작품만 홈에 보여요. MY → 설정에서 언제든 바꿀 수 있어요.</p>${audSegHTML()}`);
  $$("[data-aud]", ov).forEach((b) => b.onclick = () => { setAudience(b.dataset.aud); closeOverlays(); if ((location.hash.slice(1) || "home") === "home") viewHome(); toast(`${AUDS[audience()].name} 작품을 보여 드릴게요`); });
  if (first) setAudience(audience()); // 닫기만 해도 다시 묻지 않게 '전체'로 정해 둠
}
// 처음 시작할 때 묻기. 작품·대화방 주소로 바로 들어왔으면 그 화면을 가리지 않고 홈에 처음 갈 때 묻는다(시트는 홈에 보일 작품을 고르는 것)
let audLater = false;
export function askAud() {
  if (AUDS[S.settings.audience]) return;
  if (/^#[cr]-/.test(location.hash)) audLater = true; else audSheet(true);
}
export function viewHome() {
  const v = $("#view");
  const match = (c) => (S.cat === "전체" || c.cat === S.cat) && (!S.q || [c.name, c.title, c.oneLiner, ...(c.tags || [])].join(" ").toLowerCase().includes(S.q.toLowerCase()));
  // 내가 만든 작품은 관심있는 대화와 상관없이 늘 보임
  const pool = ORIGINALS.filter(audOK), originals = pool.filter(match), mine = S.mine.filter(match), comm = S.community.filter((c) => !S.mine.some((m) => m.id === c.id)).filter(audOK).filter(match);
  const hidden = audience() !== "all" && (ORIGINALS.length > pool.length);
  // 대표 작품: 전체면 여성향·남성향을 번갈아, 아니면 고른 쪽 앞에서 4개
  const hero = audience() !== "all" ? pool.slice(0, 4) : (() => { const f = pool.filter((c) => audOf(c) === "f"), m = pool.filter((c) => audOf(c) !== "f"), out = [];
    for (let i = 0; out.length < 4 && (i < f.length || i < m.length); i++) { if (f[i]) out.push(f[i]); if (m[i] && out.length < 4) out.push(m[i]); } return out; })();
  v.innerHTML = `<div class="page">
    ${topbar(`<label class="search">${ICON.search}<span class="sr">캐릭터 검색</span><input id="q" placeholder="캐릭터, 작품, 태그 검색" value="${esc(S.q)}"></label>`)}
    ${S.engine === "none" ? `<div class="engine-warn">AI 연결이 아직 없어요. claude.ai에서 열면 바로 대화할 수 있고, 파일로 열었다면 <b>MY → 설정</b>에서 Anthropic API 키를 넣어 주세요.</div>` : ""}
    ${!S.q ? `<div class="hero">${hero.map((c) => `
      <button class="hero-card" data-char="${esc(c.id)}">${coverHTML(c, "", { vt: true })}
        <div class="body"><span class="k">${c.isNew ? "NEW · " : ""}${esc(c.cat)} · HEART SYNC 오리지널</span><h3>${esc(c.title)}</h3><p>${esc(c.desc)}</p>
        <span class="who">${c.world_mode ? "세계관 입장하기" : esc(c.name) + "와 대화하기"} →</span></div></button>`).join("")}</div>` : ""}
    ${S.rooms.length && !S.q ? `<h2 class="sec">이어서 대화하기</h2><div class="cont">${S.rooms.slice(0, 4).map((r) => `
      <button data-room="${esc(r.id)}">${coverHTML(r)}<span class="x"><b>${esc(r.name)}</b><span>${esc(r.last)}</span></span><span class="note">${ago(r.at)}</span></button>`).join("")}</div>` : ""}
    ${!S.q && S.cat === "전체" ? HOME_ROWS.map((w) => { const sv = pool.filter((c) => c.row === w.key); return sv.length ? `<h2 class="sec">${esc(w.title)} <small>${esc(w.sub)}</small></h2><div class="row-scroll">${sv.map(cardHTML).join("")}</div>` : ""; }).join("") : ""}
    <h2 class="sec">둘러보기 <small>관심있는 대화</small></h2>
    ${audSegHTML()}
    <div class="chips" style="margin-top:10px">${["전체", ...CATS].map((c) => `<button class="chip ${S.cat === c ? "on" : ""}" data-cat="${c}">${c}</button>`).join("")}</div>
    <h2 class="sec">HEART SYNC 오리지널 <small>에디터가 직접 만든 작품</small></h2>
    ${originals.length ? `<div class="grid">${originals.map(cardHTML).join("")}</div>` : `<div class="empty">조건에 맞는 오리지널 작품이 없어요.${hidden ? `<br>지금은 ${AUDS[audience()].name} 작품만 보여요.<br><button class="btn sm" data-aud="all">전체 보기</button>` : ""}</div>`}
    <h2 class="sec">커뮤니티 신작 <small>${S.community.length ? "크리에이터가 공개한 캐릭터" : ""}</small></h2>
    ${comm.length ? `<div class="grid">${comm.map(cardHTML).join("")}</div>` :
      `<div class="empty">아직 공개된 캐릭터가 없어요.</div>`}
    ${mine.length ? `<h2 class="sec">내가 만든 캐릭터</h2><div class="grid">${mine.map(cardHTML).join("")}</div>` : ""}
  </div>`;
  $$("[data-char]", v).forEach((b) => b.onclick = () => go("c-" + b.dataset.char));
  $$("[data-room]", v).forEach((b) => b.onclick = () => go("r-" + b.dataset.room));
  $$("[data-cat]", v).forEach((b) => b.onclick = () => { S.cat = b.dataset.cat; viewHome(); });
  $$("[data-aud]", v).forEach((b) => b.onclick = () => { setAudience(b.dataset.aud); viewHome(); });
  const q = $("#q"); q.oninput = () => { S.q = q.value; const pos = q.selectionStart; viewHome(); const n = $("#q"); n.focus(); n.setSelectionRange(pos, pos); };
  bindGo(v); IMG.hydrate(v);
  if (audLater) { audLater = false; askAud(); }
}
on("community", () => { if ((location.hash.slice(1) || "home") === "home") viewHome(); }); // 커뮤니티 작품을 받으면 홈을 다시 그림
