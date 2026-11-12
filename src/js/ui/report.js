/* 메시지 신고(reportSheet): AI 말풍선 메뉴의 '신고' → 사유(일곱 가지 가운데 하나를 골라야 보냄 — 미리 골라 두지 않음)·덧붙일 말·'이 메시지 앞부분을 함께 보내기'(기본 켜짐, 끌 수 있음) → 문의 표에 '신고' 분류로 접수(SUPPORT.report).
   로그인하지 않았으면 메일 안내 */
import { LIMITS } from "../core/constants.js";
import { curText } from "../core/rooms.js";
import { $, $$, esc, toast } from "../core/util.js";
import { IMG_TAG_RE } from "../images/codes.js";
import { SB } from "../services/supabase.js";
import { REPORT_REASONS, SUPPORT, SUPPORT_MAIL, reportTitle, supportErr } from "../services/support.js";
import { docUrl } from "./help.js";
import { closeOverlays, sheet } from "./sheet.js";
import { bindGo } from "./shell.js";
/** @typedef {import("../core/types.js").Room} Room */

/** 신고에 담을 메시지 앞부분 — 그림 태그를 빼고 공백을 줄여 LIMITS.reportQuote자까지. @param {string} text @returns {string} */
export function reportQuote(text) {
  return String(text || "")
    .replace(IMG_TAG_RE, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, LIMITS.reportQuote);
}
/**
 * 신고 시트. 보내는 것: 사유·작품 이름·(적었으면) 덧붙일 말·(켜 두었으면) 그 메시지의 앞부분 — 대화 전체나 다른 메시지는 보내지 않음.
 * @param {Room} r @param {{alts?: {text: string}[], idx?: number, text?: string}} m 신고할 메시지
 */
export function reportSheet(r, m) {
  const mail = `<a href="mailto:${SUPPORT_MAIL}">${SUPPORT_MAIL}</a>`;
  if (!SB.on() || !SB.s) {
    const ov = sheet(`<h2>이 메시지 신고</h2><p class="sub">신고는 로그인한 뒤 보낼 수 있어요. 로그인하지 않고 알리려면 ${mail}로 메일을 보내 주세요.</p>
      ${SB.on() ? `<div class="cta-row"><span class="spacer"></span><button class="btn pri" data-go="login">로그인 · 회원가입</button></div>` : ""}`);
    bindGo(ov);
    return;
  }
  const quote = reportQuote(curText(m));
  const ov = sheet(
    `<h2>이 메시지 신고</h2><p class="sub">운영자가 확인해요. 답변은 MY → 고객센터 → 문의하기의 '내 문의'에서 볼 수 있어요.</p>
    <div class="rp-why" id="rpWhy" role="group" aria-label="신고 사유">` +
      `${REPORT_REASONS.map(([k, l]) => `<button type="button" class="chip" data-why="${k}" ` + `aria-pressed="false">${esc(l)}</button>`).join("")}</div>
    <div class="field" style="margin-top:12px"><label for="rpNote">덧붙일 말 <span class="note">선택</span></label>` +
      `<textarea id="rpNote" maxlength="500" style="min-height:70px" placeholder="어떤 점이 문제였는지 적어 주시면 확인이 빨라요."></textarea></div>
    <div class="toggle" style="margin-top:12px"><label for="rpQuote">이 메시지 앞부분(${LIMITS.reportQuote}자)을 함께 보내기 ` +
      `<span class="note">끄면 사유와 작품 이름만 보내요</span></label><input type="checkbox" id="rpQuote" checked></div>
    <blockquote class="rp-quote" id="rpPv">${esc(quote)}</blockquote>
    <p class="lerr" id="rpErr" role="alert"></p>
    <div class="cta-row" style="margin-top:6px"><span class="note">신고 내용은 문의와 같이 보관해요 · ` +
      `<a href="${docUrl("privacy.html")}#items" target="_blank" rel="noopener">개인정보처리방침</a></span><span class="spacer"></span>` +
      `<button class="btn pri" id="rpSend">신고 보내기</button></div>`
  );
  let why = ""; // 사유는 미리 골라 두지 않음 — 급한 사유가 실수로 접수되지 않게
  $$("[data-why]", ov).forEach(
    (b) =>
      (b.onclick = () => {
        why = b.dataset.why;
        $$("[data-why]", ov).forEach((o) => {
          o.classList.toggle("on", o === b);
          o.setAttribute("aria-pressed", o === b);
        });
      })
  );
  $("#rpQuote", ov).onchange = (e) => {
    $("#rpPv", ov).hidden = !e.target.checked;
  };
  $("#rpSend", ov).onclick = async (e) => {
    const btn = e.currentTarget,
      err = $("#rpErr", ov),
      picked = REPORT_REASONS.find((x) => x[0] === why),
      note = $("#rpNote", ov).value.trim();
    if (!picked) {
      err.textContent = "신고 사유를 골라 주세요.";
      return;
    }
    const reason = picked[1];
    const body = [
      `사유: ${reason}`,
      `작품: ${r.char.title} (${r.char.id})`,
      note ? "\n" + note : "",
      $("#rpQuote", ov).checked && quote ? "\n[신고한 메시지 앞부분]\n" + quote : ""
    ]
      .filter(Boolean)
      .join("\n");
    btn.disabled = true;
    err.textContent = "";
    try {
      await SUPPORT.report({ title: reportTitle(reason, r.char.title), body });
      closeOverlays();
      toast("신고를 접수했어요. 답변은 고객센터의 '내 문의'에서 볼 수 있어요");
    } catch (x) {
      err.textContent = supportErr(x);
      btn.disabled = false;
    }
  };
}
