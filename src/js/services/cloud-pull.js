/* 계정에서 받기: 받은 행을 이 기기에 적용(applyRows)·열려 있어 넘어간 방을 다시 받기(retakeRows)·바뀐 행 받기(pullRows). CLOUD.apply·retake·pull이 이것을 부름(services/cloud.js) */
import { roomKey } from "../core/rooms.js";
import { shelfSyncOn } from "../core/shelf.js";
import { room, roomInUse, setRoom } from "../core/state.js";
import { KV } from "../core/storage.js";
import { CLOUD, SHELF_KEY, SYNCED_RE } from "./cloud.js";
import { mergeCloudSettings } from "./cloud-settings.js";
import { takeShelf } from "./cloud-shelf.js";
import { SB } from "./supabase.js";

/* 응답 생성·요약이 아직 쓰고 있는 방의 키인지(core/state.js roomInUse) — 그 일이 끝나면 들고 있던 방을 저장하므로 받은 것으로 덮지 않고 미룸 */
const using = (k) => k.indexOf("room-") === 0 && roomInUse(k.slice(5));
// 받은 행을 이 기기에 씀. 열려 있는 대화방은 덮지 않음(대화 중에 바뀌면 헷갈림). 바뀐 키 수를 돌려줌.
// hold: 이 받기를 시작할 때 올리는 중이던 키 — 받는 사이 올리기가 끝나도, 그 전에 읽힌 옛 값으로 덮지 않음(pull이 넘김).
// since: 이 받기를 시작할 때의 번호(CLOUD.seq) — 그 뒤에 이 기기에서 바뀐 키도 덮지 않음. 없으면 처음 로그인의 전부 받기(firstSync)
export async function applyRows(rows, hold, since) {
  const writes = []; // 방 본문은 큰 저장소에 쓰므로 끝나기를 기다림
  const full = since === undefined,
    newer = (k) => !full && (CLOUD.putSeq[k] || 0) > since;
  let n = 0;
  const open = room && location.hash === "#r-" + room.id ? roomKey(room.id) : "";
  rows.forEach((x) => {
    if (x.updated_at && x.updated_at > (localStorage.getItem(CLOUD.lastKey()) || ""))
      try {
        localStorage.setItem(CLOUD.lastKey(), x.updated_at);
      } catch {}
    if (x.key === SHELF_KEY) {
      if (shelfSyncOn() && takeShelf(x.value)) n++;
      return;
    } // 보내지 못한 것이 있어도 합침
    if (x.key in CLOUD.pending || CLOUD.sending.has(x.key) || (hold && hold.has(x.key)) || newer(x.key)) return; // 이 기기의 값이 올라가(올라갔거나) 계정 것을 대신함
    if (KV.writing(x.key)) {
      CLOUD.skip(x.key); // 본문을 쓰는 중(아직 대기열에 들어가기 전) — 그 쓰기가 되면 올라가 계정 것을 대신하고, 안 되면 다시 받을 것으로
      return;
    }
    if (x.key === open || using(x.key)) {
      CLOUD.skip(x.key); // 받은 자리 표시(커서)는 이미 이 행을 지나갔으므로 적어 두었다가 방에서 나오면(쓰던 일이 끝나면) 다시 받음
      return;
    }
    if (x.key === "settings") {
      mergeCloudSettings(x.value);
      n++;
      return;
    }
    // 예전 빌드가 따로 올리던 장기기억 설정 행: 처음 로그인의 전부 받기에서, 계정의 설정 행에 그 칸이 없을 때만 받아 설정으로 옮김(지금은 설정의 한 칸으로만 다님 —
    // 예전 행만 남은 계정에서 값을 잃지 않게). 바뀐 것만 받는 때에는 보지 않음 — 예전 빌드가 이 행만 고쳐도 지금 설정을 덮지 않게
    if (x.key === "memcfg") {
      if (full && x.value && typeof x.value === "object" && !rows.some((y) => y.key === "settings" && y.value && y.value.memCfg)) {
        mergeCloudSettings({ memCfg: x.value });
        n++;
      }
      return;
    }
    if (!SYNCED_RE.test(x.key)) return;
    if (room && x.key === roomKey(room.id)) setRoom(null); // 메모리에 든 옛 사본을 놓음 — 그대로 두면 그 방을 다시 열 때 옛 사본이 쓰이고, 저장하면 받은 것을 덮음
    writes.push(
      KV.put(x.key, x.value === null ? undefined : x.value).then((ok) => {
        if (ok) n++;
        else CLOUD.skip(x.key); // 이 기기에 쓰지 못함 — 받은 자리 표시는 이미 지나갔으므로 다시 받을 것으로 남김(retake)
      })
    );
  });
  await Promise.all(writes);
  CLOUD.pulledAt = Date.now();
  return n;
}
/**
 * 열려 있어서 넘어간 방(skipped)을 다시 받음 — 방에서 나온 뒤(boot.js의 화면 이동)와 받기(pull) 앞에 부름. 아직 열려 있는 방은 계속 보류,
 * 이 기기에 못 올린 변경이 있는 방은 그 값이 계정으로 올라가므로 받지 않음, 요청이 실패하면 다음에 다시. @returns {Promise<number>} 다시 받은 수
 */
export async function retakeRows() {
  const uid = CLOUD.uid,
    isOpen = (k) => !!room && location.hash === "#r-" + room.id && roomKey(room.id) === k;
  let n = 0;
  for (const k of [...CLOUD.skipped]) {
    if (!CLOUD.on || CLOUD.uid !== uid) break;
    if (isOpen(k) || using(k) || KV.writing(k)) continue; // 보류 — 방에서 나오거나 쓰던 일이 끝난 뒤에
    if (k in CLOUD.pending || CLOUD.sending.has(k)) {
      CLOUD.skip(k, false); // 이 기기의 값이 올라가 계정 것을 대신함
      continue;
    }
    const since = CLOUD.seq;
    let got = null;
    try {
      const r = await SB.req("/rest/v1/kv?select=value&key=eq." + encodeURIComponent(k));
      if (r.ok) got = await r.json();
    } catch {}
    if (CLOUD.uid !== uid) break;
    if (!got || isOpen(k) || using(k) || KV.writing(k)) continue; // 못 받았거나 그사이 다시 열었으면 다음에(적어 둔 채로)
    // 계정에 그 방이 없거나, 그사이 이 기기에서 고침(올리기까지 끝났어도) — 받을 것이 없음
    if (!got[0] || k in CLOUD.pending || CLOUD.sending.has(k) || (CLOUD.putSeq[k] || 0) > since) {
      CLOUD.skip(k, false);
      continue;
    }
    if (room && roomKey(room.id) === k) setRoom(null); // 쓰기 전에 놓음 — 쓰는 사이 그 방을 다시 열면 저장소에서 새로 읽음(쓰기 뒤의 값)
    if (await KV.put(k, got[0].value)) {
      CLOUD.skip(k, false);
      n++;
    } // 쓰지 못했으면 적어 둔 채로 — 다음에 다시
  }
  return n;
}
export async function pullRows() {
  const hold = new Set(CLOUD.sending),
    since = CLOUD.seq,
    again = await CLOUD.retake();
  let n = again + (await CLOUD.apply(await CLOUD.rows(localStorage.getItem(CLOUD.lastKey()) || ""), hold, since));
  // 로그인한 뒤(또는 날짜가 된 뒤) 처음 한 번: 바뀐 행만 받는 pull에는 서재 행이 안 올 수 있어 따로 받아 합침 — 날짜 전에 이 기기에만 쌓인 것이 이때 계정으로
  if (!CLOUD.shelfUp && shelfSyncOn()) {
    CLOUD.shelfUp = true;
    if (takeShelf(await CLOUD.getOne(SHELF_KEY))) n++;
  }
  return n;
}
