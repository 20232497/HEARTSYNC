/* 대화방 관리 드로어(출력 설정·기억·갤러리·내보내기·삭제) */
import { ageOK, unfilteredRoute } from "../ai/adult.js";
import { engineName } from "../ai/llm.js";
import { LEN, MODELS } from "../ai/models.js";
import { maybeSummarize, memCfg, pushHist } from "../ai/prompt/memory.js";
import { speakerName } from "../ai/prompt/rules.js";
import { getChar, normalizeChar } from "../core/character.js";
import { curText, deletedRooms, newRoom, roomKey, saveRoom } from "../core/rooms.js";
import { saveSettings } from "../core/settings.js";
import { DOWNLOADS, S, gen, hasOpenRouterKey, room, setRoom } from "../core/state.js";
import { KV } from "../core/storage.js";
import { $, $$, clamp, esc, num, toast } from "../core/util.js";
import { FREE_DAILY, PLAN, freeLeft, isPro, plan, qShort, quote } from "../core/wallet.js";
import { imgTags } from "../images/codes.js";
import { imagesOf, pickImg } from "../images/pick.js";
import { keyName } from "../images/situations.js";
import { IMG, validRef } from "../services/images.js";
import { stopGen } from "./chat/generate.js";
import { copyText, renderLog } from "./chat/log.js";
import { statusBlock } from "./chat/render.js";
import { lastAi, updateComposer } from "./chat/view.js";
import { artHTML, coverHTML, lightbox, pavHTML } from "./cover.js";
import { ICON } from "./icons.js";
import { personaSheet } from "./me.js";
import { openModelSheet } from "./model-sheet.js";
import { plusSheet } from "./pay.js";
import { closeOverlays, confirmSheet } from "./sheet.js";
import { go, renderRailRecent } from "./shell.js";
import { openImageSlots } from "./slots.js";

/* ---------------------------------------------------------------- 대화방 관리 드로어 */
export function openRoomDrawer(view = "main") {
  closeOverlays();
  const r = room, c = r.char;
  const ov = document.createElement("div"); ov.className = "overlay drawer-ov";
  const titles = { main: "대화방 관리", persona: "내 페르소나", memory: "장기기억", note: "유저노트", output: "출력 설정", status: "상태창", gallery: "갤러리", bookmarks: "북마크" };
  ov.innerHTML = `<aside class="drawer" role="dialog" aria-label="${titles[view]}"><div class="sheet-head">${view !== "main" ? `<button class="icon-btn" id="dBack" aria-label="뒤로">${ICON.back}</button>` : ""}<h2>${titles[view]}</h2><button class="icon-btn" data-x aria-label="닫기">${ICON.close}</button></div><div id="dBody"></div></aside>`;
  document.body.append(ov);
  ov.addEventListener("click", (e) => { if (e.target === ov || e.target.closest("[data-x]")) ov.remove(); });
  const back = $("#dBack", ov); if (back) back.onclick = () => openRoomDrawer("main");
  const body = $("#dBody", ov), cfg = memCfg(), q = quote(r.set);
  if (view === "main") {
    const imgs = imagesOf(c), filled = Object.values(imgs).reduce((a, m) => a + Object.values(m).filter(validRef).length, 0);
    body.innerHTML = `<div class="quick">
        <button id="qCopy">${ICON.copy}대화 복사</button><button id="qExport">${ICON.down}대화 내보내기</button><button id="qNew">${ICON.redo}처음부터</button></div>
      <div class="sheet-head"><h3 class="lbl" style="flex:1;margin:0">내 재화</h3><button class="btn sm pri" id="topup">충전</button></div>
      <div class="purse">
        <div>오늘 무료 턴 <span class="spacer"></span><b>${isPro() ? "PLUS 무제한" : freeLeft() + " / " + FREE_DAILY}</b></div>
        <div>하트 <span class="spacer"></span><b>♥ ${num(S.wallet.hearts)}</b></div>
        <div>지금 설정 <span class="spacer"></span><span class="note">${MODELS[r.set.model].name} · 턴당 ${q.type === "heart" ? "♥" + q.n : qShort(q)}</span></div>
      </div>
      <h3 class="lbl" style="margin:16px 0 8px">대화 구성</h3>
      <button class="compo" id="compo">${coverHTML(c)}<span class="x"><b>${esc(c.title)}</b><span>${c.world_mode ? "세계관" : "캐릭터"} · ${esc(c.name)}</span><span>씬 · ${esc(r.opening || "기본")}</span></span></button>
      <div class="menu-list">
        <button data-v="persona">내 페르소나<span class="v">${esc(r.persona.name)}</span></button>
        <div class="grp"></div>
        <button data-v="memory">장기기억<span class="v">${cfg.auto ? `${Math.max(0, cfg.every - (r.sinceMem || 0))}턴 뒤 요약` : "자동 요약 꺼짐"}</span></button>
        <button data-v="note">유저노트<span class="v">${r.userNote ? "작성됨" : "비어 있음"}</span></button>
        <div class="grp"></div>
        <button id="mModel">AI 모델<span class="v">${MODELS[r.set.model].name}</span></button>
        <button data-v="output">출력 설정<span class="v">${LEN[r.set.len].name} · ${r.set.mem}턴</span></button>
        <div class="grp"></div>
        <button data-v="status">상태창</button>
        <button data-v="gallery">갤러리<span class="v">${galleryItems(r).length}장</span></button>
        <button data-v="bookmarks">북마크<span class="v">${(r.bookmarks || []).length}개</span></button>
        <button id="mImg">이미지 슬롯<span class="v">${filled}장 등록</span></button>
      </div>
      <button class="btn ghost danger block" id="delRoom" style="margin-top:16px">이 대화방 삭제</button>
      <p class="note" style="margin-top:8px">AI 연결: ${engineName()}${unfilteredRoute(r) ? " · 🔞 성인 모드(OpenRouter)" : ""}</p>`;
    $$("[data-v]", body).forEach((b) => b.onclick = () => openRoomDrawer(b.dataset.v));
    $("#topup", body).onclick = () => go("store");
    $("#compo", body).onclick = () => go("c-" + c.id);
    $("#mModel", body).onclick = () => openModelSheet();
    $("#mImg", body).onclick = () => openImageSlots(getChar(c.id) || c);
    $("#qCopy", body).onclick = () => copyText(exportText(r), "대화 전체를 복사했어요");
    $("#qExport", body).onclick = () => exportRoom(r);
    $("#qNew", body).onclick = () => confirmSheet("처음부터 다시 시작할까요?", "같은 작품·씬으로 새 대화방을 만들어요. 지금 대화는 목록에 남아요.", "새로 시작", () => {
      const c0 = normalizeChar(getChar(c.id) || c); if (S.rooms.filter((x) => x.charId === c0.id).length >= plan().rooms) return plusSheet("rooms");
      setRoom(newRoom(c0, Math.max(0, c0.openings.findIndex((o) => o.title === r.opening)), r.persona)); go("r-" + room.id); });
    $("#delRoom", body).onclick = () => confirmSheet("이 대화방을 삭제할까요?", "메시지와 기억이 모두 지워지고 되돌릴 수 없어요.", "삭제", () => deleteRoom(r.id));
  }
  else if (view === "persona") {
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
  else if (view === "memory") {
    let tab = "cur";
    const paint = () => {
      const tabs = `<div class="tabs" role="tablist">${[["cur", "현재 기억"], ["hist", "히스토리"], ["cfg", "요약 설정"]].map(([k, l]) => `<button role="tab" data-tab="${k}" class="${tab === k ? "on" : ""}">${l}</button>`).join("")}</div>`;
      if (tab === "cur") {
        body.innerHTML = tabs + `<b>현재 대화방에 적용 중인 기억이에요</b><p class="note" style="margin:4px 0 12px">설정한 요약 주기마다 지금까지 나눈 대화를 자동으로 요약해 업데이트해요.</p>
          <div class="setcard"><div class="toggle"><label for="mAuto">자동 업데이트</label><input type="checkbox" id="mAuto" ${cfg.auto ? "checked" : ""}></div>
            <div class="toggle" style="border-top:1px solid var(--line);padding-top:9px"><span>다음 업데이트까지</span><b>${cfg.auto ? Math.max(0, cfg.every - (r.sinceMem || 0)) + "턴 남음" : "꺼짐"}</b></div></div>
          <div class="field"><label for="memTa" style="display:flex">내용<span class="spacer"></span><span class="memo-count" id="memCnt"></span></label><textarea id="memTa" style="min-height:260px" maxlength="${cfg.limit}">${esc(r.memory || "")}</textarea></div>
          <div class="cta-row"><button class="btn" id="memNow">지금 요약하기</button><span class="spacer"></span><button class="btn pri" id="memSave">저장</button></div>
          ${!isPro() ? `<p class="note" style="margin-top:10px">무료 ${num(PLAN.free.memoMax)}자 · PLUS는 ${num(PLAN.pro.memoMax)}자까지 기억해요.</p>` : ""}`;
        const ta = $("#memTa", body), cnt = $("#memCnt", body); const upd = () => cnt.textContent = num(ta.value.length) + " / " + num(cfg.limit); ta.oninput = upd; upd();
        $("#mAuto", body).onchange = (e) => { S.settings.memCfg.auto = e.target.checked; saveSettings(); openRoomDrawer("memory"); };
        $("#memSave", body).onclick = () => { if (ta.value !== (r.memory || "")) { pushHist(r, r.memory, "수정 전 기억"); r.memory = ta.value.slice(0, cfg.limit); saveRoom(r); } toast("저장했어요. 다음 턴부터 반영돼요."); };
        $("#memNow", body).onclick = async () => { r.memory = ta.value; ov.remove(); await maybeSummarize(r, true); };
      } else if (tab === "hist") {
        const h = r.memHist || [];
        let sel = -1;
        const ph = () => {
          body.innerHTML = tabs + `<b>이전 기억들을 확인하고 불러올 수 있어요</b><p class="note" style="margin:4px 0 12px">기억을 골라 현재 기억에 불러올 수 있어요. ${plan().hist}개를 넘으면 오래된 기억부터 지워져요. (${h.length}/${plan().hist})</p>
            ${h.length ? h.map((x, i) => `<div class="hist-item ${sel === i ? "on" : ""}" data-h="${i}" role="button" tabindex="0"><div class="t">${new Date(x.at).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })} · ${esc(x.label)} · ${num(x.text.length)}자</div><p>${esc(x.text)}</p></div>`).join("") : `<div class="empty">아직 히스토리가 없어요. 기억이 한도를 넘어 압축되거나 직접 수정하면 이전 기억이 여기에 보관돼요.</div>`}
            ${h.length ? `<div class="cta-row"><button class="btn danger" id="hDel" ${sel < 0 ? "disabled" : ""}>삭제</button><span class="spacer"></span><button class="btn pri" id="hApply" ${sel < 0 ? "disabled" : ""}>현재 기억으로 적용</button></div>` : ""}`;
          bindTabs();
          $$("[data-h]", body).forEach((b) => b.onclick = () => { sel = +b.dataset.h; ph(); });
          const hd = $("#hDel", body); if (hd) hd.onclick = () => { h.splice(sel, 1); r.memHist = h; sel = -1; saveRoom(r); ph(); };
          const ha = $("#hApply", body); if (ha) ha.onclick = () => { const x = h[sel]; pushHist(r, r.memory, "불러오기 전 기억"); r.memory = x.text.slice(0, cfg.limit); saveRoom(r); toast("현재 기억으로 불러왔어요"); tab = "cur"; paint(); };
        };
        ph(); return;
      } else {
        const c0 = S.settings.memCfg;
        body.innerHTML = tabs + `<p class="note">*설정한 내용은 모든 대화방에 일괄 적용돼요.</p>
          <div class="setcard"><h4>요약 주기</h4><div class="stepper"><button id="evM" aria-label="줄이기">−</button><output id="evV">${c0.every}</output><button id="evP" aria-label="늘리기">+</button></div><div class="res">${c0.every}턴마다 기억을 요약해요.</div></div>
          <div class="setcard"><h4>요약 글자 수</h4><p class="d">글자 수를 넘으면 압축되고, 압축 전 기억은 히스토리에 보관돼요.</p><div class="stepper"><button id="lmM" aria-label="줄이기">−</button><output>${num(Math.min(c0.limit, plan().memoMax))}</output><button id="lmP" aria-label="늘리기">+</button></div><div class="res">기억을 ${num(Math.min(c0.limit, plan().memoMax))}자까지 유지해요.${!isPro() ? ` (PLUS ${num(PLAN.pro.memoMax)}자)` : ""}</div></div>
          <div class="setcard"><h4>요약 지침</h4><div class="seg"><button data-g="auto" class="${c0.guide !== "custom" ? "on" : ""}">자동</button><button data-g="custom" class="${c0.guide === "custom" ? "on" : ""}">직접 입력</button></div>
            ${c0.guide === "custom" ? `<label class="sr" for="gTa">요약 지침</label><textarea id="gTa" class="inp" maxlength="400" style="min-height:90px" placeholder="예: 전투 수치와 획득 아이템은 빠짐없이, 감정 묘사는 짧게">${esc(c0.custom)}</textarea>` : `<div class="res">기억을 요약하는 지침을 자동으로 설정해요.</div>`}</div>
          <button class="btn pri block" id="cfgSave" style="margin-top:12px">적용</button>`;
        bindTabs();
        const step = (k, d, lo, hi) => { c0[k] = clamp(c0[k] + d, lo, hi); paint(); };
        $("#evM", body).onclick = () => step("every", -1, 2, 20); $("#evP", body).onclick = () => step("every", 1, 2, 20);
        $("#lmM", body).onclick = () => step("limit", -1000, 1000, plan().memoMax);
        $("#lmP", body).onclick = () => { if (c0.limit >= plan().memoMax) return plusSheet("mem"); step("limit", 1000, 1000, plan().memoMax); };
        $$("[data-g]", body).forEach((b) => b.onclick = () => { c0.guide = b.dataset.g; paint(); });
        $("#cfgSave", body).onclick = () => { const g = $("#gTa", body); if (g) c0.custom = g.value.trim(); saveSettings(); toast("요약 설정을 적용했어요"); };
        return;
      }
      bindTabs();
    };
    const bindTabs = () => $$("[data-tab]", body).forEach((b) => b.onclick = () => { tab = b.dataset.tab; paint(); });
    paint();
  }
  else if (view === "note") {
    body.innerHTML = `<p class="note">AI가 매 턴 가장 먼저 참고하는 메모예요. 관계 설정, 금지하고 싶은 전개, 커스텀 모드 설정 등을 적어 두세요.</p>
      <div class="field"><label for="noteTa">유저노트</label><textarea id="noteTa" maxlength="2000" style="min-height:260px" placeholder="예: 서윤과 나는 대학 펜싱부 선후배 사이였다. / 전투는 짧게, 대화 위주로.">${esc(r.userNote || "")}</textarea><div class="memo-count" id="nCnt"></div></div>
      ${c.world_mode ? `<button class="btn sm ghost" id="tpl" style="margin-top:6px">커스텀 모드 양식 넣기</button>` : ""}
      <button class="btn pri block" id="noteSave" style="margin-top:12px">저장</button>`;
    const ta = $("#noteTa", body), cnt = $("#nCnt", body); const upd = () => cnt.textContent = num(ta.value.length) + " / 2,000"; ta.oninput = upd; upd();
    const tpl = $("#tpl", body); if (tpl) tpl.onclick = () => { ta.value = (ta.value ? ta.value + "\n\n" : "") + "## 커스텀 모드\n- 시작 위치: 1층 붕괴한 서울\n- 초기 파티: \n- 상황: \n- 파티원과의 관계: \n- 특전: "; upd(); ta.focus(); };
    $("#noteSave", body).onclick = () => { r.userNote = ta.value.trim(); saveRoom(r); toast("유저노트를 저장했어요"); openRoomDrawer("main"); };
  }
  else if (view === "output") {
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
        ${ageOK() ? `<div class="setcard"><div class="toggle"><div><h4>🔞 이 대화방에서 성인 무검열 서사 허용</h4><p class="d" style="margin:4px 0 0">${hasOpenRouterKey() ? "켜면 이 대화방은 OpenRouter 모델로 수위 제한 없이 써요." : "MY → 설정에 OpenRouter API 키를 넣어야 적용돼요."}${!S.settings.contentFilter ? " 지금은 설정에서 기본 수위 제한을 해제해 둬서 모든 대화방에 적용 중이에요." : ""} 미성년 인물·암시가 있는 턴은 수위와 상관없이 보호 모드로 써요.</p></div><input type="checkbox" id="au" ${s.allowUnfiltered ? "checked" : ""}></div></div>` : ""}
        <div class="setcard"><h4>예상 비용</h4><table class="tbl"><tbody>${Object.keys(MODELS).map((k) => { const qq = quote({ ...s, model: k }); return `<tr><td>${MODELS[k].name}${k === s.model ? ' <span class="pill">사용 중</span>' : ""}</td><td class="num">${qq.type === "free" ? "무료 (" + freeLeft() + "턴 남음)" : qq.type === "plus" ? "PLUS 무제한" : "♥" + qq.n + " / 턴"}</td></tr>`; }).join("")}</tbody></table></div>
        <button class="btn pri block" id="oSave" style="margin-top:12px">저장 · 지금 모델 턴당 ${qShort(q2)}</button>`;
      $("#mM", body).onclick = () => { s.mem = Math.max(5, s.mem - 5); paint(); };
      $("#mP", body).onclick = () => { if (s.mem + 5 > maxMem) return plusSheet("mem"); s.mem += 5; paint(); };
      $$("[data-len]", body).forEach((b) => b.onclick = () => { s.len = b.dataset.len; paint(); });
      $("#rr", body).onchange = (e) => { s.rerollAsk = e.target.checked; };
      const au = $("#au", body); if (au) au.onchange = (e) => { s.allowUnfiltered = e.target.checked; };
      $("#oSave", body).onclick = () => { r.set = { ...r.set, ...s, rerollAsk: $("#rr", body).checked, autoScroll: $("#as", body).checked }; delete r.set.sugAuto; saveRoom(r); updateComposer(); toast("출력 설정을 저장했어요"); openRoomDrawer("main"); };
    };
    paint();
  }
  else if (view === "status") {
    const a = lastAi(r);
    body.innerHTML = (statusBlock(c, r.status, a?.statusBefore, { open: true }) || `<p class="note">아직 상태창이 없어요.</p>`) +
      `<div class="box" style="margin-top:12px"><h3>나 · ${esc(r.persona.name)}</h3><p>${esc(r.persona.desc || r.persona.memo || "설명 없음")}</p></div>
       <p class="note" style="margin-top:12px">진행 ${r.turn || 0}턴 · 메시지 ${r.msgs.length}개 · AI가 최근 ${r.set.mem}턴을 직접 읽어요.</p>`;
  }
  else if (view === "gallery") {
    const items = galleryItems(r);
    body.innerHTML = items.length ? `<p class="note" style="margin-bottom:10px">이 대화에 나온 장면 이미지 ${items.length}장. 누르면 크게 보거나 그 장면으로 가요.</p><div class="gallery">${items.map((it, k) => {
      const cast = c.cast.find((x) => x.code === it.code), ref = pickImg(c, it.code, it.key);
      return `<button data-g="${k}" title="${esc(cast?.name || "")} · ${esc(keyName(it.key))}">${ref ? IMG.tag(ref) : artHTML(c, cast || { name: "?" }, it.key)}</button>`; }).join("")}</div>`
      : `<div class="empty">아직 장면 이미지가 없어요. 대화 중에 인물이 등장하거나 감정이 크게 바뀌면 이미지가 나와요.</div>`;
    IMG.hydrate(body);
    $$("[data-g]", body).forEach((b) => b.onclick = () => { const it = items[+b.dataset.g], im = $("img", b); if (im && im.src) lightbox(im.src); else { ov.remove(); jumpTo(it.id); } });
  }
  else if (view === "bookmarks") {
    const list = (r.bookmarks || []).map((id) => r.msgs.find((m) => m.id === id)).filter(Boolean);
    body.innerHTML = list.length ? list.map((m) => `<button class="bm" data-j="${m.id}"><b>${m.role === "ai" ? esc(speakerName(r)) : esc(r.persona.name)}</b>${esc(curText(m).replace(/\[\[img:[^\]]*\]\]/g, "").replace(/[*"]/g, "").replace(/\s+/g, " ").slice(0, 120))}…</button>`).join("")
      : `<div class="empty">북마크한 장면이 없어요. 메시지 아래 ☆ 북마크를 눌러 담아 두세요.</div>`;
    $$("[data-j]", body).forEach((b) => b.onclick = () => { ov.remove(); jumpTo(b.dataset.j); });
  }
}
function galleryItems(r) {
  const out = [], seen = new Set();
  r.msgs.forEach((m) => imgTags(curText(m)).forEach((t) => { const k = t.code + ":" + t.key; if (!seen.has(k) && (r.char.cast || []).some((x) => x.code === t.code)) { seen.add(k); out.push({ ...t, id: m.id }); } }));
  return out;
}
function jumpTo(id) { const el = $(`.msg[data-id="${id}"]`); if (!el) return; el.scrollIntoView({ block: "center" }); el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 1400); }
function exportText(r) {
  const head = `${r.char.title} — ${r.opening || ""}\n${r.persona.name}(으)로 플레이 · ${new Date().toLocaleString("ko-KR")}\n\n`;
  return head + r.msgs.filter((m) => curText(m) && !m.sys).map((m) => `${m.role === "ai" ? speakerName(r) : r.persona.name}: ${curText(m).replace(/\[\[img:([a-z0-9]+):([\d,]+)\]\]/gi, (_, a, b) => `[이미지: ${(r.char.cast.find((x) => x.code === a.toLowerCase()) || {}).name || a} · ${keyName(b)}]`)}`).join("\n\n");
}
async function exportRoom(r) {
  const data = exportText(r), filename = `HEART_SYNC_${r.char.title.replace(/[^\w가-힣]+/g, "_")}_${new Date().toISOString().slice(0, 10)}.txt`;
  if (DOWNLOADS) { try { await DOWNLOADS.save({ filename, data }); } catch (e) { if (e?.code !== "cancelled" && e?.code !== "declined") toast("내보내지 못했어요. 대화 복사를 써 주세요."); } return; }
  try { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([data], { type: "text/plain" })); a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
  catch { copyText(data, "내보내기가 막혀 있어서 대신 복사했어요"); }
}
function deleteRoom(id) {
  deletedRooms.add(id);
  if (gen && room && room.id === id) stopGen();
  KV.set(roomKey(id), undefined);
  S.rooms = S.rooms.filter((r) => r.id !== id); KV.set("rooms", S.rooms); renderRailRecent();
  if (room && room.id === id) setRoom(null);
  go("chats");
}
