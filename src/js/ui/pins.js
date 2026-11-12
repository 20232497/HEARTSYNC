/* 고정 기억(핀): 이용자가 한 줄로 박아 두는 '꼭 기억할 것' — 고정 시트(pinSheet)와 드로어 장기기억의 목록(pinsHTML·bindPins).
   방의 r.pins [{ id, text, at, msgId? }]에 저장하고 프롬프트 변동부의 [고정 기억]으로 매 턴 그대로 보냄(요약·압축은 건드리지 않음). 한도는 글자 LIMITS.pin, 개수 plan().pins —
   PLUS가 끝나 한도보다 많이 남은 줄은 지우지 않고 '보관 중'으로 보이며 AI에는 앞의 한도 개수만 감(ai/prompt/rules.js) */
import { LIMITS } from "../core/constants.js";
import { curText, saveRoom } from "../core/rooms.js";
import { $, $$, esc, num, toast, uid } from "../core/util.js";
import { PLAN, isPro, plan } from "../core/wallet.js";
import { ICON } from "./icons.js";
import { plusSheet } from "./pay.js";
import { sheet } from "./sheet.js";
/** @typedef {import("../core/types.js").Message} Message */
/** @typedef {import("../core/types.js").Pin} Pin */
/** @typedef {import("../core/types.js").Room} Room */

/* 메시지 앞부분을 한 줄로(그림 태그·서식 기호를 빼고) — 고정 시트의 처음 값. 이용자가 고쳐서 저장함 */
const seed = (m) =>
  curText(m)
    .replace(/\[\[[^\]]*\]\]/g, " ")
    .replace(/[*"“”]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
/**
 * 고정 기억 시트 — 새로 고정(m을 주면 그 메시지 앞부분을 채움, 없으면 빈 칸)하거나 pin을 고침. 저장하면 after().
 * 개수가 한도(plan().pins)면 새로 고정하지 않고 안내(무료는 PLUS 안내, PLUS는 알림).
 * @param {Room} r @param {Message|null} m @param {() => void} [after] @param {Pin} [pin] 고칠 항목
 */
export function pinSheet(r, m, after, pin) {
  const pins = r.pins || [];
  if (!pin && pins.length >= plan().pins) {
    if (isPro()) toast(`고정 기억은 대화방마다 ${plan().pins}개까지예요. 덜 중요한 것을 지우고 다시 해 주세요.`);
    else plusSheet("pins");
    return;
  }
  const ov = sheet(
    `<div class="sheet-head"><h2>${pin ? "고정 기억 고치기" : "기억에 고정"}</h2><button class="icon-btn" data-x aria-label="닫기">${ICON.close}</button></div>
    <p class="sub">꼭 기억해야 할 것을 한 줄로 적어 두면, 요약으로 흐려지지 않고 매 턴 그대로 AI에게 전해져요. (${pins.length + (pin ? 0 : 1)} / ${plan().pins}개)</p>
    <div class="field"><label for="pinTa" style="display:flex">고정할 내용<span class="spacer"></span>` +
      `<span class="memo-count" id="pinCnt"></span></label>` +
      (`<textarea id="pinTa" maxlength="${LIMITS.pin}" style="min-height:96px" placeholder="예: 첫눈 오는 날 다시 만나기로 약속했다.">` +
        `${esc(pin ? pin.text : m ? seed(m) : "")}</textarea></div>
    <div class="cta-row"><span class="spacer"></span><button class="btn ghost" data-x>취소</button><button class="btn pri" id="pinSave">저장</button></div>`)
  );
  const ta = $("#pinTa", ov),
    upd = () => {
      $("#pinCnt", ov).textContent = num(ta.value.length) + " / " + num(LIMITS.pin);
    };
  ta.oninput = upd;
  upd();
  ta.focus();
  $("#pinSave", ov).onclick = () => {
    const text = ta.value.replace(/\s+/g, " ").trim().slice(0, LIMITS.pin);
    if (!text) {
      ta.focus();
      return;
    }
    if (pin) pin.text = text;
    else r.pins = pins.concat({ id: uid("pin"), text, at: Date.now(), ...(m ? { msgId: m.id } : {}) });
    saveRoom(r);
    ov.remove();
    toast(pin ? "고정 기억을 고쳤어요" : "기억에 고정했어요. 다음 턴부터 반영돼요.");
    after && after();
  };
}
/** 드로어 장기기억의 '고정 기억' 탭: 목록(수정·삭제)과 한도, 직접 추가 버튼. @param {Room} r @returns {string} */
export function pinsHTML(r) {
  const pins = r.pins || [],
    max = plan().pins,
    over = Math.max(0, pins.length - max);
  return (
    `<b>압축하지 않고 매 턴 그대로 전하는 기억이에요</b>` +
    (`<p class="note" style="margin:4px 0 12px">대화의 말풍선 아래 📌 고정으로 담거나 여기서 직접 적어요. ${pins.length} / ${plan().pins}개 · 각 ` +
      `${num(LIMITS.pin)}자${!isPro() ? ` (PLUS ${PLAN.pro.pins}개)` : ""}</p>
    ${
      over
        ? `<p class="note" id="pinOver" style="margin:-6px 0 12px">지금 한도(${max}개)를 넘은 ${over}개는 ` +
          `<b>보관 중</b>이에요 — AI에는 앞의 ${max}개만 전해요. 덜 중요한 것을 지우면 뒤의 것이 올라오고, PLUS가 되면 모두 다시 전해요.</p>`
        : ""
    }
    ${
      pins.length
        ? `<div class="pin-list">${pins
            .map(
              (p, i) =>
                `<div class="pin-row${i >= max ? " off" : ""}">` +
                `<p>${i >= max ? '<span class="pill">보관 중</span> ' : ""}${esc(p.text)}</p>` +
                `<button class="btn sm ghost" data-pined="${esc(p.id)}">수정</button>` +
                `<button class="btn sm ghost danger" data-pindel="${esc(p.id)}">삭제</button></div>`
            )
            .join("")}</div>`
        : `<div class="empty">아직 고정한 기억이 없어요. 약속·비밀·호칭처럼 잊으면 안 되는 것을 고정해 두세요.</div>`
    }
    <button class="btn block" id="pinAdd" style="margin-top:10px">+ 고정 기억 추가</button>`)
  );
}
/** pinsHTML의 버튼 연결 — 바뀌면 repaint(). @param {HTMLElement} body @param {Room} r @param {() => void} repaint */
export function bindPins(body, r, repaint) {
  $("#pinAdd", body).onclick = () => pinSheet(r, null, repaint);
  $$("[data-pined]", body).forEach(
    (b) =>
      (b.onclick = () =>
        pinSheet(
          r,
          null,
          repaint,
          (r.pins || []).find((p) => p.id === b.dataset.pined)
        ))
  );
  $$("[data-pindel]", body).forEach(
    (b) =>
      (b.onclick = () => {
        r.pins = (r.pins || []).filter((p) => p.id !== b.dataset.pindel);
        saveRoom(r);
        repaint();
      })
  );
}
