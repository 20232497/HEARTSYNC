/* MY의 휴대폰 성인 인증 칸: 상태·인증 버튼, 휴대폰 인증창에서 돌아온 결과 마무리 */
import { ageOK } from "../ai/adult.js";
import { CFG } from "../core/config.js";
import { on } from "../core/events.js";
import { idvPassed } from "../core/safety.js";
import { S } from "../core/state.js";
import { $, esc, toast } from "../core/util.js";
import { IDV, idvMsg } from "../services/idv.js";
import { SB } from "../services/supabase.js";
import { bindGo } from "./shell.js";

const idvDay = (t) => new Date(t).toLocaleDateString("ko-KR");
const TOO_YOUNG = "성인 모드는 만 19세가 되는 해부터 쓸 수 있어요.";
function idvInner() {
  const mode = CFG.idv.mode, rec = S.idv, pass = idvPassed(rec, mode);
  const testNote = mode === "test" ? `<p class="d"><span class="pill gold">시험 모드</span> 실제 본인 확인이 아니에요. 인증 흐름을 시험하는 모의 인증이에요.</p>` : "";
  if (!SB.s) return `<p class="d">성인 모드는 휴대폰 본인인증을 마친 계정에서 쓸 수 있어요. 먼저 로그인해 주세요.</p>${testNote}<div><button class="btn sm" data-go="login">로그인 · 회원가입</button></div>`;
  const state = pass ? `<div class="acct-row"><span class="pill ok">인증 완료</span><span class="note">${esc(idvDay(rec.until))}까지 · 1년마다 다시 인증해요</span></div>`
    : !rec ? `<p class="d">성인 모드를 쓰려면 휴대폰 본인인증이 필요해요.</p>`
    : !rec.adult ? `<p class="d">${TOO_YOUNG}</p>`
    : rec.until <= Date.now() ? `<p class="d">인증 기간(1년)이 지났어요. 다시 인증해 주세요.</p>`
    : `<p class="d">시험 모드에서 한 인증은 효력이 없어요. 다시 인증해 주세요.</p>`;
  const act = pass ? ""
    : location.protocol === "file:" ? `<p class="d">파일로 열면 인증창을 쓸 수 없어요. <a href="${esc(SB.site())}" target="_blank" rel="noopener">웹 주소</a>에서 같은 계정으로 인증하면 여기에도 적용돼요.</p>`
    : `<div><button class="btn sm pri" id="idvGo" ${IDV.busy ? "disabled" : ""}>${IDV.busy ? "인증하는 중…" : "휴대폰으로 성인 인증"}</button></div>
       <p class="d">인증은 포트원과 본인인증 기관이 처리해요. HEART SYNC는 성인 여부·인증 시각·만료일만 저장하고, 이름·전화번호·생년월일은 저장하지 않아요.</p>`;
  return state + testNote + act;
}
function idvResult(r) { return !r.adult ? TOO_YOUNG : `성인 인증을 마쳤어요 (${idvDay(r.until)}까지)${r.test ? " · 시험 모드" : ""}`; }
async function startIdv() {
  try { const r = await IDV.run(); if (r) toast(idvResult(r)); }
  catch (e) { toast(idvMsg(e)); }
}
function paintIdv() {
  const box = $("#idvBox"); if (!box) return;
  box.innerHTML = idvInner(); bindGo(box);
  const go = $("#idvGo", box); if (go) go.onclick = startIdv;
  ["#unfilterChk", "#fallbackChk"].forEach((s) => { const x = $(s); if (x) x.disabled = !ageOK(); }); // 인증을 마쳐야 수위 해제 옵션을 고를 수 있음
}
on("idv", paintIdv);
/** MY의 '성인 인증 · 수위' 안에 들어가는 자리(자기 확인 체크 대신 — CFG.idv를 켰을 때만). @returns {string} */
export const idvBoxHTML = () => `<div class="idv-box" id="idvBox"></div>`;
/** MY를 그린 뒤 칸을 채움. @returns {void} */
export const bindIdv = paintIdv;
/**
 * 휴대폰 인증창에서 돌아왔을 때(boot) 결과를 확인. 주소의 문구는 누구나 꾸며 보낼 수 있어 화면에 그대로 쓰지 않음.
 * @param {{ id: string, failed: boolean }} back
 * @returns {Promise<void>}
 */
export async function finishIdv(back) {
  if (!SB.s) { toast("로그인이 풀렸어요. 다시 로그인한 뒤 인증해 주세요."); return; }
  if (back.failed) { toast("인증을 마치지 못했어요. 취소했거나 실패했어요."); return; }
  try { toast(idvResult(await IDV.confirm(back.id))); } catch (e) { toast(idvMsg(e)); }
}
