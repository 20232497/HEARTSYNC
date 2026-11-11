/* 작품 상세 페이지: 표지·제목·찜 → 시작 상황과 새 대화 시작·내 대화방 → 소개·플레이 가이드·명령어 → 그림이 있는 칸(등장인물·장소·컷씬·세계관 일러스트), 아래에 같은 줄의 다른 작품.
   새 대화 칸을 소개 위에 둠 — 시작 버튼이 세계관 일러스트·등장인물·도감 아래로 묻혀 있었음(2026-11-11 사용자 요청). 글로 읽는 칸(소개·가이드·명령어)을 먼저, 그림은 그 뒤로 이어서 */
import { MODELS } from "../ai/models.js";
import { HOME_ROWS, ORIGINALS } from "../content/index.js";
import { audOK } from "../core/audience.js";
import { getChar, normalizeChar } from "../core/character.js";
import { defaultSet, newRoom } from "../core/rooms.js";
import { liked, toggleLike, touchRecent } from "../core/shelf.js";
import { S, room, setRoom } from "../core/state.js";
import { $, $$, ago, esc, toast } from "../core/util.js";
import { FREE_DAILY, plan, qShort, quote } from "../core/wallet.js";
import { IMG } from "../services/images.js";
import { bindCast, bindCodex, castGridHTML, collectHTML, commandsHTML, guideHTML, metaHTML, placesHTML } from "./codex.js";
import { coverHTML, lightbox } from "./cover.js";
import { rowHTML } from "./home.js";
import { ICON } from "./icons.js";
import { plusSheet } from "./pay.js";
import { bindGo, go, topbar } from "./shell.js";
import { worldArtHTML } from "./worldart.js";

export function viewDetail(id) {
  const c = normalizeChar(getChar(id)), v = $("#view");
  if (!c) { v.innerHTML = `<div class="page">${topbar()}<div class="empty">캐릭터를 찾을 수 없어요. 삭제됐거나 아직 불러오는 중일 수 있어요.<br><button class="btn sm" data-go="home">홈으로</button></div></div>`; bindGo(v); return; }
  const rooms = S.rooms.filter((r) => r.charId === c.id);
  const persona = S.personas.find((p) => p.def) || S.personas[0];
  const wa = worldArtHTML(c); // 키워드북이 없으면 칸을 숨김
  const set0 = defaultSet(c), q0 = quote(set0); // 새 대화방이 시작하는 모델(작품의 권장 모델)과 그 턴당 비용
  const row = HOME_ROWS.find((w) => w.key === c.row), near = row ? ORIGINALS.filter((x) => x.row === c.row && x.id !== c.id && audOK(x)) : []; // 같은 홈 줄의 다른 작품(줄이 없는 작품은 칸을 숨김)
  const likeHTML = (on) => `${ICON.mark}<span>${on ? "찜한 작품" : "찜하기"}</span>`;
  touchRecent(c.id);
  v.innerHTML = `<div class="page">
    ${topbar(`<button class="icon-btn" data-go="home" aria-label="뒤로">${ICON.back}</button>`)}
    <div class="detail">
      <div>${coverHTML(c, "", { vt: true })}</div>
      <div>
        <span class="note">${esc(c.cat)}${c.world_mode ? " · 세계관" : ""} · ${metaHTML(c)}</span>
        <h1>${esc(c.title)}</h1>
        <p class="lead">${esc(c.oneLiner)}</p>
        <div class="tags">${(c.tags || []).map((t) => `<span>#${esc(t)}</span>`).join("")}</div>
        <button class="btn sm ghost like-btn" id="like" aria-pressed="${liked(c.id)}">${likeHTML(liked(c.id))}</button>
        <div class="box"><h3>${c.world_mode ? "게임 모드 · 시작 상황" : "시작 상황"}</h3><div class="openings">
          ${c.openings.map((o, i) => `<label class="opening"><input type="radio" name="op" value="${i}" ${i === 0 ? "checked" : ""}><b>${esc(o.title)}${o.place && (c.places || [])[o.place - 1] ? ` <span class="pill">장소 · ${esc(c.places[o.place - 1].name)}</span>` : ""}</b>
            <span>${esc(o.text.replace(/\[\[[^\]]*\]\]/g, "").replace(/[*"\[\]]/g, "").replace(/\s+/g, " ").slice(0, 120))}…</span></label>`).join("")}
        </div>
        <div class="field"><label for="pp">대화할 내 페르소나</label><select id="pp">${S.personas.map((p) => `<option value="${esc(p.id)}" ${p === persona ? "selected" : ""}>${esc(p.name)}${p.memo ? " · " + esc(p.memo) : ""}</option>`).join("")}</select></div>
        <div class="cta-row"><button class="btn pri big" id="start">새 대화 시작</button><button class="btn ghost sm" data-go="me">페르소나 관리</button></div>
        <p class="note" style="margin-top:8px">새 대화는 ${esc(MODELS[set0.model].name)} 모델(${q0.type === "heart" ? "턴당 ♥" + q0.n : qShort(q0)})로 시작해요 — 대화방에서 바꿀 수 있어요. 라이트 모델은 하루 ${FREE_DAILY}턴 무료. 상태창: ${c.fields.slice(0, 8).map(esc).join(" · ")}${c.fields.length > 8 ? " 외" : ""}</p>
        </div>
        ${rooms.length ? `<div class="box"><h3>내 대화방</h3><div class="cont">${rooms.map((r) => `<button data-room="${esc(r.id)}">${coverHTML(r)}<span class="x"><b>${esc(r.name)}</b><span>${esc(r.last)}</span></span><span class="note">${ago(r.at)}</span></button>`).join("")}</div></div>` : ""}
        <div class="box"><h3>소개</h3><p>${esc(c.desc)}</p></div>
        ${guideHTML(c)}
        ${commandsHTML(c)}
        <div class="box"><h3>등장인물 <small>누르면 코드·감정 칸 안내</small>${collectHTML(c)} <button class="btn sm ghost" data-go="codex-${esc(c.id)}" style="float:right">도감</button></h3>
          <div class="cast">${castGridHTML(c)}</div></div>
        ${placesHTML(c)}
        <div class="box" id="wArtBox" ${wa ? "" : 'style="display:none"'}><h3>세계관 일러스트</h3>${wa}</div>
      </div>
    </div>
    ${rowHTML("같은 줄의 다른 작품", row ? row.title : "", near, "rowNear")}</div>`;
  bindGo(v); IMG.hydrate(v);
  $$("[data-char]", v).forEach((b) => b.onclick = () => go("c-" + b.dataset.char));
  $("#like").onclick = (e) => { const b = e.currentTarget, on = toggleLike(c.id); b.setAttribute("aria-pressed", on); b.innerHTML = likeHTML(on); toast(on ? "찜했어요 — 홈의 '찜한 작품'에서 볼 수 있어요" : "찜을 풀었어요"); };
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
