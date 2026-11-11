/* 대화방 드로어의 장기기억 화면: 현재 기억(자동 업데이트·지금 요약하기)·고정 기억·히스토리·요약 설정 네 탭. 틀은 ../room-drawer.js */
import { maybeSummarize, pushHist } from "../../ai/prompt/memory.js";
import { saveRoom } from "../../core/rooms.js";
import { saveSettings } from "../../core/settings.js";
import { S } from "../../core/state.js";
import { $, $$, clamp, esc, num, toast } from "../../core/util.js";
import { PLAN, isPro, plan } from "../../core/wallet.js";
import { plusSheet } from "../pay.js";
import { bindPins, pinsHTML } from "../pins.js";
import { openRoomDrawer } from "../room-drawer.js";

/** 드로어 화면 'memory'. @param {import("../room-drawer.js").DrawerCtx} x */
export function drawerMemory({ r, ov, body, cfg }) {
    let tab = "cur";
    const paint = () => {
      const tabs = `<div class="tabs" role="tablist">${[["cur", "현재 기억"], ["pin", "고정 기억"], ["hist", "히스토리"], ["cfg", "요약 설정"]].map(([k, l]) => `<button role="tab" data-tab="${k}" class="${tab === k ? "on" : ""}">${l}</button>`).join("")}</div>`;
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
      } else if (tab === "pin") {
        body.innerHTML = tabs + pinsHTML(r);
        bindPins(body, r, () => { openRoomDrawer("memory"); const b = $('[data-tab="pin"]'); if (b) b.click(); }); // 시트가 드로어를 닫으므로 다시 열어 이 탭으로
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
