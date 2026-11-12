/* 대화방 드로어의 첫 화면(대화방 관리): 대화 복사·내보내기·처음부터, 내 재화, 대화 구성, 다른 화면으로 가는 메뉴, 대화방 삭제. 틀은 ../room-drawer.js */
import { engineName } from "../../ai/llm.js";
import { LEN, MODELS } from "../../ai/models.js";
import { liveWork } from "../../core/character.js";
import { baseOpening } from "../../core/rooms.js";
import { S } from "../../core/state.js";
import { $, $$, esc, num } from "../../core/util.js";
import { FREE_DAILY, freeLeft, isPro, qShort } from "../../core/wallet.js";
import { copyText } from "../chat/log.js";
import { guideSheet } from "../codex.js";
import { coverHTML } from "../cover.js";
import { ICON } from "../icons.js";
import { openModelSheet } from "../model-sheet.js";
import { openRoomDrawer, restartRoom } from "../room-drawer.js";
import { deleteRoom, exportRoom, exportText, galleryItems } from "../room-tools.js";
import { confirmSheet } from "../sheet.js";
import { go } from "../shell.js";
import { loreSeen } from "../worldart.js";

/** 드로어 화면 'main'. @param {import("../room-drawer.js").DrawerCtx} x */
export function drawerMain({ r, c, body, cfg, q }) {
  const src = r.forkedFrom && S.rooms.some((x) => x.id === r.forkedFrom.roomId); // 분기한 방이고 원래 방이 아직 있으면 '원래 대화방' 버튼
  const live = liveWork(c),
    guide = live.guide; // 플레이 가이드는 최신 작품에서(예전 방의 사본에는 없을 수 있음)
  body.innerHTML =
    `<div class="quick">
        <button id="qCopy">${ICON.copy}대화 복사</button><button id="qExport">${ICON.down}대화 내보내기</button><button id="qNew">${ICON.redo}처음부터</button></div>
      <div class="sheet-head"><h3 class="lbl" style="flex:1;margin:0">내 재화</h3><button class="btn sm pri" id="topup">충전</button></div>
      <div class="purse">
        <div>오늘 무료 턴 <span class="spacer"></span><b>${isPro() ? "PLUS 무제한" : freeLeft() + " / " + FREE_DAILY}</b></div>
        <div>하트 <span class="spacer"></span><b>♥ ${num(S.wallet.hearts)}</b></div>
        <div>지금 설정 <span class="spacer"></span><span class="note">${MODELS[r.set.model].name} · 턴당 ${q.type === "heart" ? "♥" + q.n : qShort(q)}</span></div>
      </div>
      <h3 class="lbl" style="margin:16px 0 8px">대화 구성</h3>
      <button class="compo" id="compo">${coverHTML(c)}<span class="x"><b>${esc(c.title)}</b>` +
    `<span>${c.world_mode ? "세계관" : "캐릭터"} · ${esc(c.name)}</span><span>씬 · ${esc(r.opening || "기본")}</span></span></button>
      ${
        r.forkedFrom
          ? `<p class="note" style="margin:8px 0 0">이 방은 「${esc(baseOpening(r) || "기본")}」 대화의 한 장면에서 분기했어요.` +
            `${src ? ` <button class="btn sm ghost" id="forkSrc">원래 대화방</button>` : ""}</p>`
          : ""
      }
      <div class="menu-list">
        <button data-v="persona">내 페르소나<span class="v">${esc(r.persona.name)}</span></button>
        <div class="grp"></div>
        <button data-v="memory">장기기억` +
    (`<span class="v">${(r.pins || []).length ? `📌 ${r.pins.length} · ` : ""}` +
      `${cfg.auto ? `${Math.max(0, cfg.every - (r.sinceMem || 0))}턴 뒤 요약` : "자동 요약 꺼짐"}</span></button>
        <button data-v="note">유저노트<span class="v">${r.userNote ? "작성됨" : "비어 있음"}</span></button>
        <div class="grp"></div>
        <button id="mModel">AI 모델<span class="v">${MODELS[r.set.model].name}</span></button>
        <button data-v="output">출력 설정<span class="v">${LEN[r.set.len].name} · ${r.set.mem}턴</span></button>
        <div class="grp"></div>
        <button data-v="status">상태창</button>
        <button data-v="gallery">갤러리<span class="v">${galleryItems(r).length}장</span></button>
        ${(live.lore || []).length ? `<button data-v="lore">세계관 수첩<span class="v">${loreSeen(r, live.lore).size} / ${live.lore.length}</span></button>` : ""}
        <button data-v="bookmarks">북마크<span class="v">${(r.bookmarks || []).length}개</span></button>
        ${guide ? `<div class="grp"></div><button id="mGuide">플레이 가이드<span class="v">제작자의 안내</span></button>` : ""}
      </div>
      <button class="btn ghost danger block" id="delRoom" style="margin-top:16px">이 대화방 삭제</button>
      <p class="note" style="margin-top:8px">AI 연결: ${engineName()}</p>`);
  $$("[data-v]", body).forEach((b) => (b.onclick = () => openRoomDrawer(b.dataset.v)));
  $("#topup", body).onclick = () => go("store");
  $("#compo", body).onclick = () => go("c-" + c.id);
  if (src) $("#forkSrc", body).onclick = () => go("r-" + r.forkedFrom.roomId);
  if (guide) $("#mGuide", body).onclick = () => guideSheet(live);
  $("#mModel", body).onclick = () => openModelSheet();
  $("#qCopy", body).onclick = () => copyText(exportText(r), "대화 전체를 복사했어요");
  $("#qExport", body).onclick = () => exportRoom(r);
  $("#qNew", body).onclick = () => restartRoom(r);
  $("#delRoom", body).onclick = () =>
    confirmSheet("이 대화방을 삭제할까요?", "메시지와 기억이 모두 지워지고 되돌릴 수 없어요.", "삭제", () => deleteRoom(r.id));
}
