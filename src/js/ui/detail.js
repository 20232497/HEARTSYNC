/* 작품 상세 페이지: 표지·소개·세계관 일러스트·등장인물(누르면 도감 인물 시트)·장소·컷씬·명령어·시작 상황 → 새 대화 시작 */
import { ORIGINALS } from "../content/index.js";
import { getChar, normalizeChar } from "../core/character.js";
import { newRoom } from "../core/rooms.js";
import { S, room, setRoom } from "../core/state.js";
import { $, $$, ago, esc } from "../core/util.js";
import { FREE_DAILY, plan } from "../core/wallet.js";
import { IMG } from "../services/images.js";
import { bindCast, bindCodex, castGridHTML, codexHTML } from "./codex.js";
import { coverHTML, lightbox } from "./cover.js";
import { ICON } from "./icons.js";
import { plusSheet } from "./pay.js";
import { bindGo, go, topbar } from "./shell.js";
import { worldArtHTML } from "./worldart.js";

export function viewDetail(id) {
  const c = normalizeChar(getChar(id)), v = $("#view");
  if (!c) { v.innerHTML = `<div class="page">${topbar()}<div class="empty">캐릭터를 찾을 수 없어요. 삭제됐거나 아직 불러오는 중일 수 있어요.<br><button class="btn sm" data-go="home">홈으로</button></div></div>`; bindGo(v); return; }
  const rooms = S.rooms.filter((r) => r.charId === c.id);
  const persona = S.personas.find((p) => p.def) || S.personas[0];
  const creator = ORIGINALS.includes(c) ? "HEART SYNC 스튜디오" : (c.creator || "익명 크리에이터");
  const wa = worldArtHTML(c); // 키워드북이 없으면 칸을 숨김
  v.innerHTML = `<div class="page">
    ${topbar(`<button class="icon-btn" data-go="home" aria-label="뒤로">${ICON.back}</button>`)}
    <div class="detail">
      <div>${coverHTML(c, "", { vt: true })}</div>
      <div>
        <span class="note">${esc(c.cat)} · ${esc(creator)}${c.world_mode ? " · 세계관" : ""}</span>
        <h1>${esc(c.title)}</h1>
        <p class="lead">${esc(c.oneLiner)}</p>
        <div class="tags">${(c.tags || []).map((t) => `<span>#${esc(t)}</span>`).join("")}</div>
        <div class="box"><h3>소개</h3><p>${esc(c.desc)}</p></div>
        <div class="box" id="wArtBox" ${wa ? "" : 'style="display:none"'}><h3>세계관 일러스트</h3>${wa}</div>
        <div class="box"><h3>등장인물 <small>누르면 코드·감정 칸 안내</small> <button class="btn sm ghost" data-go="codex-${esc(c.id)}" style="float:right">도감</button></h3>
          <div class="cast">${castGridHTML(c)}</div></div>
        ${codexHTML(c)}
        <div class="box"><h3>${c.world_mode ? "게임 모드 · 시작 상황" : "시작 상황"}</h3><div class="openings">
          ${c.openings.map((o, i) => `<label class="opening"><input type="radio" name="op" value="${i}" ${i === 0 ? "checked" : ""}><b>${esc(o.title)}</b>
            <span>${esc(o.text.replace(/\[\[[^\]]*\]\]/g, "").replace(/[*"\[\]]/g, "").replace(/\s+/g, " ").slice(0, 120))}…</span></label>`).join("")}
        </div>
        <div class="field"><label for="pp">대화할 내 페르소나</label><select id="pp">${S.personas.map((p) => `<option value="${esc(p.id)}" ${p === persona ? "selected" : ""}>${esc(p.name)}${p.memo ? " · " + esc(p.memo) : ""}</option>`).join("")}</select></div>
        <div class="cta-row"><button class="btn pri big" id="start">새 대화 시작</button><button class="btn ghost sm" data-go="me">페르소나 관리</button></div>
        <p class="note" style="margin-top:8px">라이트 모델은 하루 ${FREE_DAILY}턴 무료. 상태창: ${c.fields.slice(0, 8).map(esc).join(" · ")}${c.fields.length > 8 ? " 외" : ""}</p>
        </div>
        ${rooms.length ? `<div class="box"><h3>내 대화방</h3><div class="cont">${rooms.map((r) => `<button data-room="${esc(r.id)}">${coverHTML(r)}<span class="x"><b>${esc(r.name)}</b><span>${esc(r.last)}</span></span><span class="note">${ago(r.at)}</span></button>`).join("")}</div></div>` : ""}
      </div>
    </div></div>`;
  bindGo(v); IMG.hydrate(v);
  $$("[data-room]", v).forEach((b) => b.onclick = () => go("r-" + b.dataset.room));
  $$("[data-wlb]", v).forEach((b) => b.onclick = () => { const i = b.querySelector("img"); if (i?.src) lightbox(i.src); });
  bindCast(v, c); bindCodex(v);
  $("#start").onclick = () => {
    if (rooms.length >= plan().rooms) return plusSheet("rooms");
    const opIdx = +(v.querySelector("input[name=op]:checked")?.value || 0);
    const p = S.personas.find((x) => x.id === $("#pp").value) || persona;
    setRoom(newRoom(c, opIdx, p)); go("r-" + room.id);
  };
}
