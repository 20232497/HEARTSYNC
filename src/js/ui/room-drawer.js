/* 대화방 관리 드로어의 틀: 드로어를 열고(openRoomDrawer) 화면마다의 그리기는 ui/drawer/의 모듈(main 대화방 관리 · memory 장기기억 · settings 페르소나·유저노트·출력 설정 · browse 상태창·갤러리·장소·북마크·세계관 수첩)에 맡김, '처음부터 다시'(restartRoom) — 내보내기·삭제·그림 모으기는 room-tools.js */
import { memCfg } from "../ai/prompt/memory.js";
import { latestWork, normalizeChar } from "../core/character.js";
import { newRoom, openingIndex } from "../core/rooms.js";
import { S, room, setRoom } from "../core/state.js";
import { $ } from "../core/util.js";
import { plan, quote } from "../core/wallet.js";
import { drawerBookmarks, drawerGallery, drawerLore, drawerPlaces, drawerStatus } from "./drawer/browse.js";
import { drawerMain } from "./drawer/main.js";
import { drawerMemory } from "./drawer/memory.js";
import { drawerNote, drawerOutput, drawerPersona } from "./drawer/settings.js";
import { ICON } from "./icons.js";
import { plusSheet } from "./pay.js";
import { closeOverlays, confirmSheet } from "./sheet.js";
import { go } from "./shell.js";

/* ---------------------------------------------------------------- 대화방 관리 드로어 */
/** 처음부터 다시: 확인 뒤 같은 작품(최신)·같은 시작 상황으로 새 방 — 작품당 방 수 한도를 넘으면 PLUS 안내. 드로어와 에피소드의 결말 카드가 씀. @param {import("../core/types.js").Room} r */
export function restartRoom(r) {
  confirmSheet("처음부터 다시 시작할까요?", "같은 작품·씬으로 새 대화방을 만들어요. 지금 대화는 목록에 남아요.", "새로 시작", () => {
    const c0 = normalizeChar(latestWork(r.char)); if (S.rooms.filter((x) => x.charId === c0.id).length >= plan().rooms) return plusSheet("rooms");
    setRoom(newRoom(c0, openingIndex(c0, r), r.persona)); go("r-" + room.id);
  });
}
export function openRoomDrawer(view = "main") {
  closeOverlays();
  const r = room, c = r.char;
  const ov = document.createElement("div"); ov.className = "overlay drawer-ov";
  const titles = { main: "대화방 관리", persona: "내 페르소나", memory: "장기기억", note: "유저노트", output: "출력 설정", status: "상태창", gallery: "갤러리", places: "장소", bookmarks: "북마크", lore: "세계관 수첩" };
  ov.innerHTML = `<aside class="drawer" role="dialog" aria-label="${titles[view]}"><div class="sheet-head">${view !== "main" ? `<button class="icon-btn" id="dBack" aria-label="뒤로">${ICON.back}</button>` : ""}<h2>${titles[view]}</h2><button class="icon-btn" data-x aria-label="닫기">${ICON.close}</button></div><div id="dBody"></div></aside>`;
  document.body.append(ov);
  ov.addEventListener("click", (e) => { if (e.target === ov || e.target.closest("[data-x]")) ov.remove(); });
  const back = $("#dBack", ov); if (back) back.onclick = () => openRoomDrawer("main");
  const body = $("#dBody", ov), cfg = memCfg(), q = quote(r.set);
  // 화면마다의 그리기 — 넘기는 것(DrawerCtx): r 방 · c 방의 작품 사본 · ov 드로어를 덮는 겹(닫을 때 씀) · body 그릴 자리 · cfg 요약 설정(memCfg) · q 지금 설정의 턴당 값(quote)
  const views = { main: drawerMain, persona: drawerPersona, memory: drawerMemory, note: drawerNote, output: drawerOutput, status: drawerStatus, gallery: drawerGallery, places: drawerPlaces, bookmarks: drawerBookmarks, lore: drawerLore };
  if (views[view]) views[view]({ r, c, ov, body, cfg, q });
}
/** @typedef {{ r: import("../core/types.js").Room, c: import("../core/types.js").Work, ov: HTMLElement, body: HTMLElement, cfg: ReturnType<typeof memCfg>, q: ReturnType<typeof quote> }} DrawerCtx 드로어 화면 함수가 받는 것 */
