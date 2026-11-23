/* 처음 로그인 합치기(mergeGuest)·계정 것만 쓰기(dropGuestRooms), 계정에서 다시 받기, 기기 지우기 */
import { emit } from "../core/events.js";
import { roomKey } from "../core/rooms.js";
import { applySettings } from "../core/settings.js";
import { gen } from "../core/state.js";
import { IDB, KV } from "../core/storage.js";
import { loadAll } from "./load.js";

/** 처음 로그인 '합치기': 계정 값 위에 이 기기에만 있던 대화방·페르소나를 더함(같은 id면 계정 값). @param {Record<string, unknown>} remote @param {{ rooms: object[], personas: object[] }} local */
export async function mergeGuest(remote, local) {
  const list = (a) => (Array.isArray(a) ? a : []);
  const byId = (a, b) => {
    const ids = new Set(list(a).map((x) => x && x.id));
    return list(a).concat(list(b).filter((x) => x && !ids.has(x.id)));
  };
  // 이 기기에만 있던 방: 본문을 먼저 읽고(큰 저장소), 읽은 방만 목록에 더함 — 본문을 못 읽은 방을 목록에만 올리면 계정에 '본문 없는 방'이 생김
  const mine = [];
  let missed = 0;
  for (const r of local.rooms)
    if (!list(remote.rooms).some((x) => x.id === r.id)) {
      let v;
      try {
        v = await KV.get(roomKey(r.id), true);
      } catch {}
      if (v) mine.push(r);
      else missed++; // 본문을 읽지 못함(또는 없음) — 목록에 더하지 않음. 본문은 이 기기에 그대로
    }
  KV.set(
    "rooms",
    byId(remote.rooms, mine).sort((x, y) => (y.at || 0) - (x.at || 0))
  );
  const ps = byId(
    remote.personas,
    list(local.personas).map((p) => Object.assign({}, p, { def: false }))
  );
  if (ps.length && !ps.some((p) => p.def)) ps[0].def = true;
  if (ps.length) KV.set("personas", ps);
  return { keys: mine.map((r) => roomKey(r.id)), missed };
}
/**
 * 처음 로그인 '계정 것만 쓰기': 계정에 대화 목록 행이 없으면(올리다 실패한 계정 등) 이 기기의 목록을 비움 — 그대로 두면 이 기기의 목록이 남아 다음 저장 때 계정으로 다시 올라감.
 * 방 본문은 이 기기에 그대로 둠(2026-11-21 사용자 결정 — 목록에서만 뺌, 되살리는 화면은 아직 없음). 계정에 목록이 있으면 받은 목록이 이미 이 기기 것을 대신함(CLOUD.apply).
 * 페르소나·지갑은 건드리지 않음 — 계정에 없으면 이 기기 것을 계속 씀(비우면 이 기기에서도 사라짐). @param {Record<string, unknown>} remote 계정에서 받은 키 → 값
 */
export function dropGuestRooms(remote) {
  if (!Array.isArray(remote.rooms)) KV.setLocal("rooms", []);
}
/** 계정에서 받은 뒤 다시 읽고 화면 갱신(입력 중·대화방 안이면 화면은 그대로). @returns {Promise<void>} */
export async function reloadFromCloud() {
  await loadAll();
  applySettings();
  emit("rooms");
  emit("wallet");
  const h = location.hash.slice(1) || "home",
    typing = document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
  if (!gen && !typing && !h.startsWith("r-")) emit("route");
}
/** 이 기기의 HEART SYNC 데이터 전부 삭제(설정·키·그림 포함) — 같이 쓰는 기기에서 로그아웃할 때. @returns {Promise<void>} */
export async function wipeDevice() {
  const clean = await IDB.clear(); // 큰 저장소(방 본문·그림)를 비웠는지 — 못 비웠으면 부른 쪽이 알림
  try {
    Object.keys(localStorage)
      .filter((k) => k.indexOf("hv1_") === 0)
      .forEach((k) => localStorage.removeItem(k));
  } catch {}
  return clean;
}
