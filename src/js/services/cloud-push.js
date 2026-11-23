/* 처음 로그인의 올리기(pushAll): 이 기기의 데이터와 그림을 계정에 올림 — 계정이 비었을 때·합칠 때(ui/account.js firstSync). 전송은 CLOUD의 줄(한 번에 하나)에 세움 */
import { IDB, KV } from "../core/storage.js";
import { CLOUD, IMG_KEY_RE, synced } from "./cloud.js";
import { cloudSettings } from "./cloud-settings.js";
import { validRef } from "./images.js";

/**
 * 이 기기의 모든 데이터를 계정에 올림(계정이 비었을 때·합칠 때). 그림은 계정에 없는 것만 읽어 **같은 대기열**(CLOUD.put)에 올림 — 전송은 한 번에 하나로 서고,
 * 실패하면 대기열에 남아 다시 올라가며, 로그아웃도 그것을 '못 올린 것'으로 봄(전에는 그림을 따로 보내, 실패한 그림이 대기열에 남지 않았음).
 * 그림 본문은 IndexedDB에, IndexedDB가 막힌 브라우저에서는 localStorage에 있음. 못 올렸으면 던짐 — 부른 쪽(처음 로그인)이 '저장했어요'라고 하지 않게.
 * @param {string[]} [keys] 올릴 KV 키(빼면 이 기기의 것 전부, []이면 대기열에 든 것과 설정·그림만) @returns {Promise<void>}
 */
export async function pushAll(keys) {
  // 덜 끝난 표시: 그림을 대기열에 넣기 전에(그림 목록 조회 등) 실패하면 대기열에는 흔적이 없음 — 표시가 남아 있으면 로그아웃·'지금 동기화'가 다시 올림(ui/account.js)
  CLOUD.owed = true;
  try {
    localStorage.setItem("hv1_cloudowed", CLOUD.uid);
  } catch {}
  (keys || localKVKeys()).forEach((k) => {
    const v = KV.getLocal(k);
    if (v !== undefined) CLOUD.pending[k] = { v };
  });
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
  CLOUD.owed = false;
  try {
    localStorage.removeItem("hv1_cloudowed");
  } catch {}
}
// 이 기기 KV 키 중 계정과 주고받는 것(그림은 pushAll이 따로, 설정은 "settings" 키로 따로)
function localKVKeys() {
  try {
    return Object.keys(localStorage)
      .filter((k) => k.indexOf("hv1_") === 0)
      .map((k) => k.slice(4))
      .filter(synced);
  } catch {
    return [];
  }
}
