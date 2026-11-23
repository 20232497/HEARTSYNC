/* 처음 로그인의 올리기(pushAll): 이 기기의 데이터와 그림을 계정에 올림 — 계정이 비었을 때·합칠 때(ui/account.js firstSync). 전송은 CLOUD의 줄(한 번에 하나)에 세움 */
import { roomKey } from "../core/rooms.js";
import { S } from "../core/state.js";
import { IDB, KV } from "../core/storage.js";
import { CLOUD, IMG_KEY_RE, synced } from "./cloud.js";
import { cloudSettings } from "./cloud-settings.js";
import { validRef } from "./images.js";

/**
 * 이 기기의 모든 데이터를 계정에 올림(계정이 비었을 때·합칠 때). 그림은 계정에 없는 것만 읽어 **같은 대기열**(CLOUD.put)에 올림 — 전송은 한 번에 하나로 서고,
 * 실패하면 대기열에 남아 다시 올라가며, 로그아웃도 그것을 '못 올린 것'으로 봄(전에는 그림을 따로 보내, 실패한 그림이 대기열에 남지 않았음).
 * 그림 본문은 IndexedDB에, IndexedDB가 막힌 브라우저에서는 localStorage에 있음. 못 올렸으면 던짐 — 부른 쪽(처음 로그인)이 '저장했어요'라고 하지 않게.
 * @param {string[]} [keys] 올릴 KV 키(빼면 이 기기의 것 전부 — 방은 목록에 있는 것만, 주면 그 키와 설정·그림) @returns {Promise<void>}
 */
export async function pushAll(keys) {
  // 덜 끝난 표시(올리려던 키와 함께): 대기열에 넣기 전에 실패하면 대기열에는 흔적이 없음 — 표시가 남아 있으면 로그아웃·'지금 동기화'가 같은 키로 다시 올림(ui/account.js uploadAll)
  CLOUD.owed = { keys: keys || null };
  try {
    localStorage.setItem("hv1_cloudowed", JSON.stringify({ uid: CLOUD.uid, keys: keys || null }));
  } catch {}
  for (const k of keys || localKVKeys()) {
    const s0 = CLOUD.putSeq[k] || 0;
    let v;
    try {
      v = await KV.get(k, true); // 방 본문은 큰 저장소에서(못 읽으면 던짐 — '없음'과 구별), 그 밖은 localStorage에서
    } catch {
      throw { code: "push_failed" }; // 본문을 읽지 못함 — 목록만 올리고 저장했다고 하지 않게
    }
    // 읽는 사이 이 기기에서 바뀐 키는(대기열에 있든, 이미 올라갔든) 방금 읽은 옛 값으로 덮지 않음
    if (v !== undefined && !(k in CLOUD.pending) && !CLOUD.sending.has(k) && (CLOUD.putSeq[k] || 0) === s0) CLOUD.pending[k] = { v };
  }
  CLOUD.pending.settings = { v: cloudSettings() };
  if ((await CLOUD.flush()) !== "ok") throw { code: "push_failed" };
  const uid = CLOUD.uid,
    have = new Set(await CLOUD.imgKeys());
  let ls = [];
  try {
    ls = Object.keys(localStorage)
      .filter((k) => k.indexOf("hv1_img") === 0)
      .map((k) => k.slice(4));
  } catch {}
  const mine = Array.from(new Set((await IDB.keys()).concat(ls))).filter((k) => IMG_KEY_RE.test(k) && !have.has(k));
  // shortcut: 그림을 한꺼번에 대기열에 올림(페르소나 사진 몇 장), 그림이 많아지면 묶음마다 flush
  for (const k of mine) {
    let v = await IDB.get(k);
    if (typeof v !== "string") v = KV.getLocal(k);
    if (CLOUD.uid !== uid) throw { code: "push_failed" }; // 읽는 사이 계정이 바뀜
    if (typeof v === "string" && validRef(v)) CLOUD.put(k, v);
  }
  if ((await CLOUD.flush()) !== "ok") throw { code: "push_failed" };
  if (CLOUD.uid !== uid) return;
  CLOUD.owed = null;
  try {
    localStorage.removeItem("hv1_cloudowed");
  } catch {}
}
// 이 기기의 KV 키 중 계정과 주고받는 것(그림은 pushAll이 따로, 설정은 "settings" 키로 따로). 방 본문은 저장소를 훑지 않고 **이 기기의 목록(S.rooms)에 있는 방만** —
// 목록에 없는 본문(지우다 남은 것, '계정 것만 쓰기'로 목록에서 뺀 것)이 계정으로 올라가지 않게
function localKVKeys() {
  let ls = [];
  try {
    ls = Object.keys(localStorage)
      .filter((k) => k.indexOf("hv1_") === 0)
      .map((k) => k.slice(4))
      .filter((k) => k.indexOf("room-") !== 0);
  } catch {}
  return Array.from(new Set(ls.concat(S.rooms.map((r) => roomKey(r.id))))).filter(synced);
}
