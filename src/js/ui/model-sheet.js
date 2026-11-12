/* 모델 선택 시트: 모델마다 턴당 하트·무료 턴 안내, 앱 기본 추천(스토리 '추천')과 작품이 직접 고른 모델의 '권장' 배지(work.js recommend) */
import { LEN, MODELS, recommendSet } from "../ai/models.js";
import { liveWork } from "../core/character.js";
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
export function setModel(k) {
  room.set.model = k;
  saveRoom(room);
  updateComposer();
}
export function openModelSheet() {
  const r = room,
    rec = recommendSet(liveWork(r.char)); // 작품이 직접 적은 권장 모델(없으면 배지 없음) — 최신 작품에서
  const card = (k) => {
    const m = MODELS[k],
      q = quote({ ...r.set, model: k }); // q.list = 정가(listPrice), q.n = 지금 낼 하트
    const price =
      q.type === "free"
        ? `오늘 무료 ${freeLeft()}턴 남음 · 이후 턴당 ♥${q.list}`
        : q.type === "plus"
          ? `PLUS 무제한 <s>턴당 ♥${q.list}</s>`
          : isPro() && q.n < q.list
            ? `턴당 <s>♥${q.list}</s>♥${q.n}`
            : `턴당 ♥${q.n}`;
    const free = k === "lite" ? "무료 턴은 자정에 다시 채워져요" : "무료 턴은 라이트 모델에만 있어요";
    return (
      `<button class="model-card ${r.set.model === k ? "on" : ""}" data-m="${k}"><span class="k">${esc(m.badge)}</span>` +
      `<b>${m.name}${k === rec ? ' <span class="pill ok">권장</span>' : ""}${isPro() && k !== "lite" ? ' <span class="pill gold">PLUS -50%</span>' : ""}</b>` +
      `<p>${esc(m.desc)}</p><div class="price">${price}<small>${free}</small></div><span class="chk">✓</span></button>`
    );
  };
  const ov = sheet(
    `<div class="sheet-head"><h2>AI 모델 선택</h2><button class="icon-btn" data-x aria-label="닫기">${ICON.close}</button></div>
    <p class="sub">턴당 비용은 모델, 출력량(${LEN[r.set.len].name}), 기억력(${r.set.mem}턴)에 따라 달라져요. 실패한 응답은 자동 환불돼요.${rec ? " <b>권장</b>은 이 작품의 제작자가 고른 모델이에요." : ""}</p>
    <div class="purse" style="margin-bottom:12px"><div>보유 하트 <span class="spacer"></span><b>♥ ${num(S.wallet.hearts)}</b>` +
      `<button class="btn sm pri" id="topup" style="margin-left:8px">충전</button></div></div>
    ${Object.keys(MODELS).map(card).join("")}
    <div class="cta-row"><button class="btn ghost" id="outSet">출력 설정 바꾸기</button><span class="spacer"></span>` +
      `<button class="btn pri" id="apply">적용</button></div>`
  );
  let pick = r.set.model;
  $$("[data-m]", ov).forEach(
    (b) =>
      (b.onclick = () => {
        pick = b.dataset.m;
        $$("[data-m]", ov).forEach((x) => x.classList.toggle("on", x === b));
      })
  );
  $("#apply", ov).onclick = () => {
    ov.remove();
    setModel(pick);
    toast(MODELS[pick].name + " 모델로 바꿨어요");
  };
  $("#topup", ov).onclick = () => go("store");
  $("#outSet", ov).onclick = () => openRoomDrawer("output");
}
