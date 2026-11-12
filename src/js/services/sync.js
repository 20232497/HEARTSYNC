/* 처음 로그인 합치기(mergeGuest), 계정에서 다시 받기, 기기 지우기 */
import { emit } from "../core/events.js";
import { roomKey } from "../core/rooms.js";
import { applySettings } from "../core/settings.js";
import { gen } from "../core/state.js";
import { IDB, KV } from "../core/storage.js";
import { loadAll } from "./load.js";

/** 처음 로그인 '합치기': 계정 값 위에 이 기기에만 있던 대화방·페르소나를 더함(같은 id면 계정 값). @param {Record<string, unknown>} remote @param {{ rooms: object[], personas: object[] }} local */
export function mergeGuest(remote, local) {
  const list = (a) => (Array.isArray(a) ? a : []);
  const byId = (a, b) => {
    const ids = new Set(list(a).map((x) => x && x.id));
    return list(a).concat(list(b).filter((x) => x && !ids.has(x.id)));
  };
  KV.set(
    "rooms",
    byId(remote.rooms, local.rooms).sort((x, y) => (y.at || 0) - (x.at || 0))
  );
  local.rooms.forEach((r) => {
    if (!list(remote.rooms).some((x) => x.id === r.id)) {
      const v = KV.getLocal(roomKey(r.id));
      if (v) KV.set(roomKey(r.id), v);
    }
  });
  const ps = byId(
    remote.personas,
    list(local.personas).map((p) => Object.assign({}, p, { def: false }))
  );
  if (ps.length && !ps.some((p) => p.def)) ps[0].def = true;
  if (ps.length) KV.set("personas", ps);
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
  await IDB.clear();
  try {
    Object.keys(localStorage)
      .filter((k) => k.indexOf("hv1_") === 0)
      .forEach((k) => localStorage.removeItem(k));
  } catch {}
}
