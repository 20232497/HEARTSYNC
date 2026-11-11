/* 대화방 드로어에서 내가 정하는 화면: 내 페르소나 고르기·유저노트·출력 설정(기억력·출력량·리롤 지침·자동 스크롤). 틀은 ../room-drawer.js */
import { LEN, MODELS } from "../../ai/models.js";
import { exampleCast, liveWork } from "../../core/character.js";
import { LIMITS } from "../../core/constants.js";
import { saveRoom } from "../../core/rooms.js";
import { S } from "../../core/state.js";
import { $, $$, esc, num, toast } from "../../core/util.js";
import { PLAN, freeLeft, isPro, plan, qShort, quote } from "../../core/wallet.js";
import { IMG } from "../../services/images.js";
import { renderLog } from "../chat/log.js";
import { updateComposer } from "../chat/view.js";
import { pavHTML } from "../cover.js";
import { personaSheet } from "../me.js";
import { plusSheet } from "../pay.js";
import { openRoomDrawer } from "../room-drawer.js";

/** 드로어 화면 'persona'. @param {import("../room-drawer.js").DrawerCtx} x */
export function drawerPersona({ r, body }) {
    const paint = () => {
      body.innerHTML = `<p class="note">이 대화방에서 연기할 페르소나를 골라요. AI는 메모와 상세 정보를 보고 나를 대해요.</p>
        <div class="avatar-pick" style="margin:12px 0">${pavHTML(r.persona)}<div><b style="font-size:17px">${esc(r.persona.name)}</b><div class="note">${esc(r.persona.memo || "")}</div></div></div>
        ${r.persona.desc ? `<div class="setcard"><h4>상세 정보</h4><p style="margin:0;white-space:pre-wrap;font-size:13.5px">${esc(r.persona.desc)}</p></div>` : ""}
        <h3 class="lbl" style="margin:16px 0 8px">페르소나 목록</h3><div class="plist">${S.personas.map((p) => `<div class="prow ${p.id === r.persona.id ? "on" : ""}">${pavHTML(p)}<div class="x" data-pick="${esc(p.id)}" role="button" tabindex="0"><b>${esc(p.name)}${p.id === r.persona.id ? ' <span class="chk">✓</span>' : ""}</b><span>${esc(p.memo || p.desc || "설명 없음")}</span></div><button class="btn sm ghost" data-ed="${esc(p.id)}">수정</button></div>`).join("")}</div>
        <button class="btn block" id="padd" style="margin-top:8px">+ 페르소나 추가</button>`;
      IMG.hydrate(body);
      $$("[data-pick]", body).forEach((b) => b.onclick = () => { const p = S.personas.find((x) => x.id === b.dataset.pick); r.persona = { id: p.id, name: p.name, memo: p.memo || "", desc: p.desc || "", img: p.img || "" }; saveRoom(r); paint(); renderLog(); toast(p.name + "(으)로 바꿨어요"); });
      $$("[data-ed]", body).forEach((b) => b.onclick = () => personaSheet(S.personas.find((x) => x.id === b.dataset.ed), () => openRoomDrawer("persona")));
      $("#padd", body).onclick = () => personaSheet(null, () => openRoomDrawer("persona"));
    };
    paint();
}
/** 드로어 화면 'note'. @param {import("../room-drawer.js").DrawerCtx} x */
export function drawerNote({ r, c, body }) {
    const tplText = liveWork(c).noteTemplate; // 작품이 준 유저노트 양식(work.js noteTemplate) — 있을 때만 '양식 넣기'
    body.innerHTML = `<p class="note">AI가 매 턴 가장 먼저 참고하는 메모예요. 관계 설정, 피하고 싶은 전개, 원하는 분위기 등을 적어 두세요.</p>
      <div class="field"><label for="noteTa">유저노트</label><textarea id="noteTa" maxlength="${LIMITS.userNote}" style="min-height:260px" placeholder="예: 나는 ${esc(exampleCast(c).name)}의 오랜 친구다. / 대화 위주로, 장면 전환은 천천히.">${esc(r.userNote || "")}</textarea><div class="memo-count" id="nCnt"></div></div>
      ${tplText ? `<button class="btn sm ghost" id="tpl" style="margin-top:6px">이 작품의 양식 넣기</button>` : ""}
      <button class="btn pri block" id="noteSave" style="margin-top:12px">저장</button>`;
    const ta = $("#noteTa", body), cnt = $("#nCnt", body); const upd = () => cnt.textContent = num(ta.value.length) + " / " + num(LIMITS.userNote); ta.oninput = upd; upd();
    const tpl = $("#tpl", body); if (tpl) tpl.onclick = () => { ta.value = ((ta.value ? ta.value + "\n\n" : "") + tplText).slice(0, LIMITS.userNote); upd(); ta.focus(); };
    $("#noteSave", body).onclick = () => { r.userNote = ta.value.trim().slice(0, LIMITS.userNote); saveRoom(r); toast("유저노트를 저장했어요"); openRoomDrawer("main"); };
}
/** 드로어 화면 'output'. @param {import("../room-drawer.js").DrawerCtx} x */
export function drawerOutput({ r, body }) {
    const s = { ...r.set };
    const paint = () => {
      const q2 = quote(s), maxMem = plan().memTurns;
      body.innerHTML = `<b>출력되는 대화의 품질과 분량을 설정해 보세요</b><p class="note" style="margin:4px 0 12px">기억력과 출력량이 높을수록 턴당 하트가 늘어나요. 라이트 모델은 기억력에 따른 추가 비용이 없어요.</p>
        <div class="setcard"><h4>기억력</h4><p class="d">캐릭터가 최근 대화를 얼마나 많이 그대로 읽을지 정해요. 그 이전은 장기기억으로 기억해요.</p>
          <div class="stepper"><button id="mM" aria-label="줄이기" ${s.mem <= 5 ? "disabled" : ""}>−</button><output>${s.mem}</output><button id="mP" aria-label="늘리기">+</button></div><div class="res">${s.mem}턴까지 기억해요.${!isPro() ? ` (무료 최대 ${PLAN.free.memTurns}턴 · PLUS ${PLAN.pro.memTurns}턴)` : ""}</div></div>
        <div class="setcard"><h4>출력량</h4><p class="d">캐릭터가 한 번에 얼마나 길게 답할지 정해요.</p>
          <div class="seg">${Object.entries(LEN).map(([k, l]) => `<button data-len="${k}" class="${s.len === k ? "on" : ""}">${l.name}<small>${l.chars}</small></button>`).join("")}</div><div class="res">${LEN[s.len].desc}</div></div>
        <div class="setcard"><div class="toggle"><div><h4>리롤 지침</h4><p class="d" style="margin:4px 0 0">다시 쓰기를 누르면 방향을 적는 창을 띄워요.</p></div><input type="checkbox" id="rr" ${s.rerollAsk ? "checked" : ""}></div></div>
        <div class="setcard"><div class="toggle"><div><h4>자동 스크롤</h4><p class="d" style="margin:4px 0 0">켜면 답이 써지는 동안 화면이 맨 아래를 따라 내려가요. 끄면 보낼 때 한 번만 내려가고, 답은 읽는 속도에 맞춰 직접 내려 보면 돼요.</p></div><input type="checkbox" id="as" ${s.autoScroll ? "checked" : ""}></div></div>
        <div class="setcard"><h4>예상 비용</h4><table class="tbl"><tbody>${Object.keys(MODELS).map((k) => { const qq = quote({ ...s, model: k }); return `<tr><td>${MODELS[k].name}${k === s.model ? ' <span class="pill">사용 중</span>' : ""}</td><td class="num">${qq.type === "free" ? "무료 (" + freeLeft() + "턴 남음)" : qq.type === "plus" ? "PLUS 무제한" : "♥" + qq.n + " / 턴"}</td></tr>`; }).join("")}</tbody></table></div>
        <button class="btn pri block" id="oSave" style="margin-top:12px">저장 · 지금 모델 턴당 ${qShort(q2)}</button>`;
      $("#mM", body).onclick = () => { s.mem = Math.max(5, s.mem - 5); paint(); };
      $("#mP", body).onclick = () => { if (s.mem + 5 > maxMem) return plusSheet("mem"); s.mem += 5; paint(); };
      $$("[data-len]", body).forEach((b) => b.onclick = () => { s.len = b.dataset.len; paint(); });
      $("#rr", body).onchange = (e) => { s.rerollAsk = e.target.checked; };
      $("#oSave", body).onclick = () => { r.set = { ...r.set, ...s, rerollAsk: $("#rr", body).checked, autoScroll: $("#as", body).checked }; delete r.set.sugAuto; saveRoom(r); updateComposer(); toast("출력 설정을 저장했어요"); openRoomDrawer("main"); };
    };
    paint();
}
