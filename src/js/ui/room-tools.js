/* 대화방 도구(드로어가 씀): 대화에 나온 그림 모으기(galleryItems)·수집 기록에 적기(collectSeen)·그 장면으로 가기(jumpTo)·대화 내보내기(exportText·exportRoom)·대화방 삭제(deleteRoom) */
import { speakerName } from "../ai/prompt/rules.js";
import { curText, deletedRooms, roomKey } from "../core/rooms.js";
import { markSeen } from "../core/shelf.js";
import { S, gen, room, setRoom } from "../core/state.js";
import { KV } from "../core/storage.js";
import { $ } from "../core/util.js";
import { IMG_TAG_RE, fallbackSits, imgTags } from "../images/codes.js";
import { imagesOf } from "../images/pick.js";
import { stopGen } from "./chat/generate.js";
import { copyText } from "./chat/log.js";
import { tagInfo } from "./cover.js";
import { go, renderRailRecent } from "./shell.js";
/** @typedef {import("../core/types.js").Room} Room */

/** 대화에 나온 그림 태그를 처음 나온 순서로(같은 코드번호는 한 번) — 인물·장소·컷씬 모두, 작품에 없는 코드는 뺌. 각 항목은 tagInfo + 그 메시지 id. @param {Room} r */
export function galleryItems(r) {
  const out = [],
    seen = new Set();
  r.msgs.forEach((m) =>
    imgTags(curText(m)).forEach((t) => {
      const k = t.code + t.sit;
      if (seen.has(k)) return;
      const i = tagInfo(r.char, t);
      if (i) {
        seen.add(k);
        out.push({ ...i, id: m.id });
      }
    })
  );
  return out;
}
/**
 * 이 방에 나온 그림 코드를 내 서재의 수집 기록에 적음(방을 열 때·응답이 끝날 때·즉답 뒤) — 도감의 '모은 그림'과 비공개 그림 풀림이 이것을 봄.
 * 그 칸 그림이 없어 다른 칸 그림(1 기본·0 프로필)이 대신 나왔으면 실제로 보인 그 칸도 함께 적음.
 * @param {Room} r
 */
export function collectSeen(r) {
  const imgs = imagesOf(r.char),
    codes = [];
  galleryItems(r).forEach((it) => {
    codes.push(it.code + it.sit);
    const m = imgs[it.code] || {},
      shown = it.ref ? fallbackSits(it.sit, it.code).find((k) => m[k] === it.ref) : undefined;
    if (shown !== undefined && shown !== it.sit) codes.push(it.code + shown);
  });
  markSeen(r.char.id, codes);
}
/** 그 메시지로 스크롤하고 잠깐 강조. @param {string} id 메시지 id */
export function jumpTo(id) {
  const el = $(`.msg[data-id="${id}"]`);
  if (!el) return;
  el.scrollIntoView({ block: "center" });
  el.classList.add("flash");
  setTimeout(() => el.classList.remove("flash"), 1400);
}
/** 대화 전체를 글로(그림 태그는 [이미지: 이름 · 칸]으로). @param {Room} r @returns {string} */
export function exportText(r) {
  const head = `${r.char.title} — ${r.opening || ""}\n${r.persona.name}(으)로 플레이 · ${new Date().toLocaleString("ko-KR")}\n\n`;
  return (
    head +
    r.msgs
      .filter((m) => curText(m) && !m.sys)
      .map(
        (m) =>
          `${m.role === "ai" ? speakerName(r) : r.persona.name}: ${curText(m).replace(IMG_TAG_RE, (raw) => {
            const t = imgTags(raw)[0],
              i = t && tagInfo(r.char, t);
            return i ? `[이미지: ${i.name} · ${i.label}]` : "";
          })}`
      )
      .join("\n\n")
  );
}
/** 대화를 txt 파일로 내려받기(막히면 복사). @param {Room} r */
export async function exportRoom(r) {
  const data = exportText(r),
    filename = `HEART_SYNC_${r.char.title.replace(/[^\w가-힣]+/g, "_")}_${new Date().toISOString().slice(0, 10)}.txt`;
  try {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([data], { type: "text/plain" }));
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  } catch {
    copyText(data, "내보내기가 막혀 있어서 대신 복사했어요");
  }
}
/** 대화방 삭제 — 진행 중 응답을 멈추고, 지운 방으로 적어(되살아나지 않게) 목록에서 빼고 대화 목록으로. @param {string} id */
export function deleteRoom(id) {
  deletedRooms.add(id);
  if (gen && room && room.id === id) stopGen();
  KV.set(roomKey(id), undefined);
  S.rooms = S.rooms.filter((r) => r.id !== id);
  KV.set("rooms", S.rooms);
  renderRailRecent();
  if (room && room.id === id) setRoom(null);
  go("chats");
}
