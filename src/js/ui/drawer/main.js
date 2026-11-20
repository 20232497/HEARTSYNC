/* 대화방 드로어의 첫 화면(대화방 관리) — 묶음 카드: 이 대화(페르소나·즐겨찾기·상태창·북마크·검색) · 이 작품(작품 카드·가이드·갤러리·장소·세계관 수첩) ·
   대화 설정(모델·출력·표시·유저노트·장기기억) · 내 재화, 아래에 대화 복사·내보내기·처음부터와 대화방 삭제. 항목은 모두 한 번 눌러 닿음. 틀은 ../room-drawer.js */
import { engineName } from "../../ai/llm.js";
import { LEN, MODELS } from "../../ai/models.js";
import { liveWork } from "../../core/character.js";
import { LIMITS } from "../../core/constants.js";
import { baseOpening, setFav } from "../../core/rooms.js";
import { S } from "../../core/state.js";
import { $, $$, esc, num, toast } from "../../core/util.js";
import { FREE_DAILY, freeLeft, isPro, qShort } from "../../core/wallet.js";
import { copyText } from "../chat/log.js";
import { openSearch } from "../chat/search.js";
import { guideSheet } from "../codex.js";
import { coverHTML } from "../cover.js";
import { ICON } from "../icons.js";
import { openModelSheet } from "../model-sheet.js";
import { openRoomDrawer, restartRoom } from "../room-drawer.js";
import { deleteRoom, exportRoom, exportText, galleryItems } from "../room-tools.js";
import { confirmSheet } from "../sheet.js";
import { go } from "../shell.js";
import { loreSeen } from "../worldart.js";

/* 묶음 카드와 그 안의 한 줄(이름 · 지금 값 · ›) — attr는 그 줄이 여는 것(data-v="화면" 또는 id) */
const menuCard = (title, rows) => `<section class="menu-card"><h3 class="lbl">${title}</h3>${rows}</section>`;
const menuRow = (attr, label, val) => `<button class="row" ${attr}><span class="k">${label}</span>${val ? `<span class="v">${val}</span>` : ""}</button>`;

/** 드로어 화면 'main'. @param {import("../room-drawer.js").DrawerCtx} x */
export function drawerMain({ r, c, body, cfg, q }) {
  const src = r.forkedFrom && S.rooms.some((x) => x.id === r.forkedFrom.roomId); // 분기한 방이고 원래 방이 아직 있으면 '원래 대화방' 버튼
  const live = liveWork(c), // 플레이 가이드·장소·세계관 수첩은 최신 작품에서(예전 방의 사본에는 없을 수 있음)
    guide = live.guide,
    places = (live.places || []).length;
  const mem =
    `${(r.pins || []).length ? `📌 ${r.pins.length} · ` : ""}` + (cfg.auto ? `${Math.max(0, cfg.every - (r.sinceMem || 0))}턴 뒤 요약` : "자동 요약 꺼짐");
  body.innerHTML =
    menuCard(
      "이 대화",
      menuRow('data-v="persona"', "내 페르소나", esc(r.persona.name)) +
        menuRow(`id="mFav" aria-pressed="${!!r.fav}"`, "즐겨찾기", r.fav ? "★ 대화 목록 맨 위에 고정" : "꺼짐") +
        menuRow('data-v="status"', "상태창", "") +
        menuRow('data-v="bookmarks"', "북마크", (r.bookmarks || []).length + "개") +
        menuRow('id="mFind"', "대화 검색", "이 방의 글에서 찾기")
    ) +
    menuCard(
      "이 작품",
      `<button class="compo" id="compo">${coverHTML(c)}<span class="x"><b>${esc(c.title)}</b>` +
        `<span>${c.world_mode ? "세계관" : "캐릭터"} · ${esc(c.name)}</span><span>씬 · ${esc(r.opening || "기본")}</span></span></button>` +
        (r.forkedFrom
          ? `<p class="note" style="margin:0 0 8px">이 방은 「${esc(baseOpening(r) || "기본")}」 대화의 한 장면에서 분기했어요.` +
            `${src ? ` <button class="btn sm ghost" id="forkSrc">원래 대화방</button>` : ""}</p>`
          : "") +
        (guide ? menuRow('id="mGuide"', "플레이 가이드", "제작자의 안내") : "") +
        menuRow('data-v="gallery"', "갤러리", galleryItems(r).length + "장") +
        (places ? menuRow('data-v="places"', "장소", places + "곳") : "") +
        ((live.lore || []).length ? menuRow('data-v="lore"', "세계관 수첩", `${loreSeen(r, live.lore).size} / ${live.lore.length}`) : "")
    ) +
    menuCard(
      "대화 설정",
      menuRow('id="mModel"', "AI 모델", MODELS[r.set.model].name) +
        menuRow('data-v="output"', "출력 설정", `${LEN[r.set.len].name} · ${r.set.mem}턴${r.set.autoSug ? " · 추천 자동 받기" : ""}`) +
        menuRow('data-v="display"', "표시 설정", `글자 ${S.settings.fs}px · 줄 간격·글꼴`) +
        menuRow('data-v="note"', "유저노트", r.userNote ? "작성됨" : "비어 있음") +
        menuRow('data-v="memory"', "장기기억", mem)
    ) +
    `<section class="menu-card"><div class="sheet-head"><h3 class="lbl" style="flex:1;margin:0">내 재화</h3>` +
    `<button class="btn sm pri" id="topup">충전</button></div>
      <div class="purse">
        <div>오늘 무료 턴 <span class="spacer"></span><b>${isPro() ? "PLUS 무제한" : freeLeft() + " / " + FREE_DAILY}</b></div>
        <div>하트 <span class="spacer"></span><b>♥ ${num(S.wallet.hearts)}</b></div>
        <div>지금 설정 <span class="spacer"></span><span class="note">${MODELS[r.set.model].name} · 턴당 ${qShort(q)}</span></div>
      </div></section>
      <div class="quick">
        <button id="qCopy">${ICON.copy}대화 복사</button><button id="qExport">${ICON.down}대화 내보내기</button><button id="qNew">${ICON.redo}처음부터</button></div>
      <button class="btn ghost danger block" id="delRoom">이 대화방 삭제</button>
      <p class="note" style="margin-top:8px">AI 연결: ${engineName()}</p>`;
  $$("[data-v]", body).forEach((b) => (b.onclick = () => openRoomDrawer(b.dataset.v)));
  $("#topup", body).onclick = () => go("store");
  $("#compo", body).onclick = () => go("c-" + c.id);
  if (src) $("#forkSrc", body).onclick = () => go("r-" + r.forkedFrom.roomId);
  if (guide) $("#mGuide", body).onclick = () => guideSheet(live);
  $("#mModel", body).onclick = () => openModelSheet();
  $("#mFind", body).onclick = () => openSearch();
  $("#mFav", body).onclick = async () => {
    if (!(await setFav(r.id, !r.fav))) return toast(`즐겨찾기는 ${LIMITS.favRooms}개까지예요 — 대화 목록에서 하나를 풀고 다시 눌러 주세요`);
    openRoomDrawer("main"); // 바뀐 표시로 다시 그림
  };
  $("#qCopy", body).onclick = () => copyText(exportText(r), "대화 전체를 복사했어요");
  $("#qExport", body).onclick = () => exportRoom(r);
  $("#qNew", body).onclick = () => restartRoom(r);
  $("#delRoom", body).onclick = () =>
    confirmSheet("이 대화방을 삭제할까요?", "메시지와 기억이 모두 지워지고 되돌릴 수 없어요.", "삭제", () => deleteRoom(r.id));
}
