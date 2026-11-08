/* 모델 선택 시트 */
import { LEN, MODELS } from "../ai/models.js";
import { saveRoom } from "../core/rooms.js";
import { S, room } from "../core/state.js";
import { $, $$, esc, num, toast } from "../core/util.js";
import { freeLeft, isPro, quote } from "../core/wallet.js";
import { updateComposer } from "./chat/view.js";
import { ICON } from "./icons.js";
import { openRoomDrawer } from "./room-drawer.js";
import { sheet } from "./sheet.js";
import { go } from "./shell.js";

/* 모델 선택 시트 */
export function setModel(k) { room.set.model = k; saveRoom(room); updateComposer(); }
export function openModelSheet() {
  const r = room;
  const card = (k) => {
    const m = MODELS[k], q = quote({ ...r.set, model: k });
    const price = q.type === "free" ? `오늘 무료 ${freeLeft()}턴 남음 · 이후 ♥${q.list}/턴` : q.type === "plus" ? `PLUS 무제한` : (isPro() && q.n < q.list ? `<s>♥${q.list}</s>♥${q.n} / 턴` : `♥${q.n} / 턴`);
    return `<button class="model-card ${r.set.model === k ? "on" : ""}" data-m="${k}"><span class="k">${esc(m.badge)}</span><b>${m.name}${isPro() && k !== "lite" ? ' <span class="pill gold">PLUS -50%</span>' : ""}</b><p>${esc(m.desc)}</p><div class="price">${price}</div><span class="chk">✓</span></button>`;
  };
  const ov = sheet(`<div class="sheet-head"><h2>AI 모델 선택</h2><button class="icon-btn" data-x aria-label="닫기">${ICON.close}</button></div>
    <p class="sub">턴당 비용은 모델, 출력량(${LEN[r.set.len].name}), 기억력(${r.set.mem}턴)에 따라 달라져요. 실패한 응답은 자동 환불돼요.</p>
    <div class="purse" style="margin-bottom:12px"><div>보유 하트 <span class="spacer"></span><b>♥ ${num(S.wallet.hearts)}</b><button class="btn sm pri" id="topup" style="margin-left:8px">충전</button></div></div>
    ${Object.keys(MODELS).map(card).join("")}
    <div class="cta-row"><button class="btn ghost" id="outSet">출력 설정 바꾸기</button><span class="spacer"></span><button class="btn pri" id="apply">적용</button></div>`);
  let pick = r.set.model;
  $$("[data-m]", ov).forEach((b) => b.onclick = () => { pick = b.dataset.m; $$("[data-m]", ov).forEach((x) => x.classList.toggle("on", x === b)); });
  $("#apply", ov).onclick = () => { ov.remove(); setModel(pick); toast(MODELS[pick].name + " 모델로 바꿨어요"); };
  $("#topup", ov).onclick = () => go("store");
  $("#outSet", ov).onclick = () => openRoomDrawer("output");
}
