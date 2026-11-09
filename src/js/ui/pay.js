/* 결제 안내: 하트 부족·PLUS 시트, 보내기 전 요금 확인(ensurePay) */
import { LEN, MODELS } from "../ai/models.js";
import { S, room } from "../core/state.js";
import { $, $$, esc, num, toast, today, won } from "../core/util.js";
import { FREE_DAILY, PLAN, PLUS_MONTHLY, freeLeft, quote, saveWallet } from "../core/wallet.js";
import { renderLog } from "./chat/log.js";
import { updateComposer } from "./chat/view.js";
import { setModel } from "./model-sheet.js";
import { sheet } from "./sheet.js";
import { PACKS, PLUS, buyPack, checkout } from "./store.js";

/* 결제 확인 → 견적 반환 (null이면 보내지 않음) */
export async function ensurePay(r) {
  const q = quote(r.set);
  if (q.type === "heart" && S.wallet.hearts < q.n) { paywall(q, r); return null; }
  if (q.type === "heart") {
    const key = r.set.model === "lite" ? "lite-" + today() : "m-" + r.set.model;
    if (!S.wallet.ack[key]) {
      const ok = await askPay(q, r); if (!ok) return null;
      Object.keys(S.wallet.ack).forEach((k) => { if (k.startsWith("lite-")) delete S.wallet.ack[k]; });
      S.wallet.ack[key] = true; saveWallet();
    }
  }
  return quote(r.set);
}
function askPay(q, r) {
  return new Promise((resolve) => {
    const lite = r.set.model === "lite", m = MODELS[r.set.model];
    const ov = sheet(lite
      ? `<h2>오늘 무료 ${FREE_DAILY}턴을 다 썼어요</h2><p class="sub">지금부터 라이트 모델은 한 턴에 <b>♥${q.n}</b>이 사용돼요. 무료 턴은 자정에 다시 채워져요.</p>
         <div class="purse"><div>보유 하트 <span class="spacer"></span><b>♥ ${num(S.wallet.hearts)}</b></div><div>이 하트로 약 <span class="spacer"></span><b>${Math.floor(S.wallet.hearts / q.n)}턴</b></div></div>
         <div class="cta-row"><button class="btn gold" id="toPlus">PLUS로 무제한</button><span class="spacer"></span><button class="btn ghost" data-x>그만하기</button><button class="btn pri" id="ok">♥${q.n}로 계속</button></div>`
      : `<h2>${m.name} 모델은 하트를 써요</h2><p class="sub">지금 설정(출력량 ${LEN[r.set.len].name} · 기억력 ${r.set.mem}턴)으로 한 턴에 <b>♥${q.n}</b>이 사용돼요. 실패하면 자동으로 돌려드려요. 이 안내는 한 번만 보여요.</p>
         <div class="purse"><div>보유 하트 <span class="spacer"></span><b>♥ ${num(S.wallet.hearts)}</b></div><div>이 하트로 약 <span class="spacer"></span><b>${Math.floor(S.wallet.hearts / q.n)}턴</b></div></div>
         <div class="cta-row"><button class="btn ghost" id="toLite">라이트로 바꾸기</button><span class="spacer"></span><button class="btn ghost" data-x>취소</button><button class="btn pri" id="ok">♥${q.n}로 보내기</button></div>`);
    let done = false; const fin = (v) => { if (!done) { done = true; resolve(v); } };
    new MutationObserver((_, obs) => { if (!ov.isConnected) { obs.disconnect(); fin(false); } }).observe(document.body, { childList: true });
    $("#ok", ov).onclick = () => { fin(true); ov.remove(); };
    const tp = $("#toPlus", ov); if (tp) tp.onclick = () => { fin(false); checkout(PLUS); };
    const tl = $("#toLite", ov); if (tl) tl.onclick = () => { fin(false); ov.remove(); setModel("lite"); toast("라이트 모델로 바꿨어요"); };
  });
}
function paywall(q, r) {
  const lite = quote({ ...r.set, model: "lite" });
  const ov = sheet(`<h2>하트가 부족해요</h2><p class="sub">이번 턴에 ♥${q.n}이 필요한데 지금 ♥${num(S.wallet.hearts)}이 있어요.</p>
    <div class="minipacks">${PACKS.slice(0, 3).map((p) => `<button data-pack="${p.id}"><b>♥ ${num(p.n + p.bonus)}</b><span class="note">${MODELS[r.set.model].name} 약 ${Math.floor((p.n + p.bonus) / q.list)}턴</span><span class="p">${won(p.price)}</span></button>`).join("")}</div>
    <div class="member" style="padding:16px"><div class="row"><b style="font-family:var(--display);font-size:18px">HEART SYNC<em style="font-style:normal;color:#f0b54a">+</em></b><span class="spacer"></span><span>${won(PLUS.price)}/월</span></div>
      <p style="margin:6px 0 12px;color:#e9dfcf;font-size:13px">라이트 무제한 · 스토리·마스터 50% 할인 · 매달 ♥${PLUS_MONTHLY}</p><button class="btn gold block" id="upPlus">PLUS 시작하기</button></div>
    ${r.set.model !== "lite" ? `<button class="btn ghost block" id="toLite" style="margin-top:8px">라이트 모델로 계속하기 (${lite.type === "free" ? "오늘 무료 " + freeLeft() + "턴 남음" : "턴당 ♥" + lite.n})</button>` : ""}
    <button class="btn ghost block" data-x style="margin-top:4px">닫기</button>`);
  $$("[data-pack]", ov).forEach((b) => b.onclick = () => buyPack(b.dataset.pack, afterBuy));
  $("#upPlus", ov).onclick = () => checkout(PLUS, afterBuy);
  const tl = $("#toLite", ov); if (tl) tl.onclick = () => { ov.remove(); setModel("lite"); };
}
function afterBuy() { if (room && $("#logInner")) { renderLog(); updateComposer(); } }
export function plusSheet(reason) {
  const copy = {
    rooms: ["대화방을 더 만들 수 없어요", `무료 요금제는 캐릭터당 대화방 ${PLAN.free.rooms}개까지예요. 기존 대화방을 지우거나 PLUS로 무제한 만들 수 있어요.`],
    pins: ["고정 기억을 더 담으려면 PLUS가 필요해요", `무료 요금제는 대화방마다 고정 기억 ${PLAN.free.pins}개까지예요. 덜 중요한 것을 지우거나, PLUS로 ${PLAN.pro.pins}개까지 고정할 수 있어요.`],
    mem: ["더 오래 기억하려면 PLUS가 필요해요", `무료 요금제는 기억력 ${PLAN.free.memTurns}턴, 장기기억 ${num(PLAN.free.memoMax)}자까지예요. PLUS는 ${PLAN.pro.memTurns}턴, ${num(PLAN.pro.memoMax)}자까지 기억해요.`]
  }[reason];
  const ov = sheet(`<h2>${esc(copy[0])}</h2><p class="sub">${esc(copy[1])}</p>
    <div class="member" style="padding:16px"><div class="row"><b style="font-family:var(--display);font-size:18px">HEART SYNC<em style="font-style:normal;color:#f0b54a">+</em></b><span class="spacer"></span><span>${won(PLUS.price)}/월</span></div>
    <p style="margin:6px 0 12px;color:#e9dfcf;font-size:13px">라이트 무제한 · 스토리·마스터 50% 할인 · 매달 ♥${PLUS_MONTHLY} · 기억 3배 이상</p><button class="btn gold block" id="upPlus">PLUS 시작하기</button></div>
    <button class="btn ghost block" data-x style="margin-top:8px">닫기</button>`);
  $("#upPlus", ov).onclick = () => checkout(PLUS, afterBuy);
}
