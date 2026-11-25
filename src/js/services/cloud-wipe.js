/* 계정의 데이터를 모두 지움(wipeAccount — MY '모든 데이터 초기화')과 그 '전부 지움' 표식을 다른 기기가 받기(takeWipe·noteWipe). 대기열·전송 줄은 services/cloud.js의 CLOUD 것을 씀(모듈 크기 때문에 나눔) */
import { isTomb } from "../core/room-list.js";
import { toast } from "../core/util.js";
import { CLOUD } from "./cloud.js";
import { SB } from "./supabase.js";
import { clearDevice } from "./sync.js";

/* '전부 지움' 표식 행(값 { gone: 지운 때 }) — 계정을 지울 때 올림. 이 계정과 맞춰 오던 다른 기기가 다음 받기에서 보면 그 기기의 대화·하트·페르소나·찜도 지움
   (2026-11-25 사용자 결정 — 전에는 표식이 방에만 있어, 다른 기기에 남은 지갑·페르소나·찜이 그 기기가 고치면 다시 올라왔음) */
export const WIPE_KEY = "wipe";
const wipeAt = (rows) => {
  const w = rows.find((x) => x.key === WIPE_KEY);
  return w && isTomb(w.value) ? w.value.gone : 0;
};
/* 이 기기가 이미 따른(스스로 올렸거나 처음 로그인에서 본) 표식의 '지운 때' — 같은 표식은 다시 따르지 않음. 기기마다 시계가 달라 크기는 견주지 않고 같은지만 봄 */
const seenKey = () => "hv1_cloudwipe_" + CLOUD.uid;
/* at 없이: 적힌 값 · at을 주면 적고, 적혔는지 확인해 돌려줌(적히지 않으면 새로고침할 때마다 같은 표식을 또 따르게 됨) */
function seen(at) {
  try {
    if (at === undefined) return localStorage.getItem(seenKey()) || "";
    localStorage.setItem(seenKey(), String(at));
    return localStorage.getItem(seenKey()) === String(at);
  } catch {
    return at === undefined ? "" : false;
  }
}

/**
 * 방은 행을 없애는 대신 삭제 표식({ gone })으로 바꿔 둠 — 행이 없으면 그 방을 아직 가진 다른 기기가 다시 올려 되살림(표식에는 지운 때만 남음). 나머지 행은 지움.
 * 순서: 방이 아닌 행을 지움 → 방의 표식 → **'전부 지움' 표식을 맨 뒤에**. 방의 표식이 곧 '지움'의 확정이라 그 전에 실패하면 방은 어느 기기에서도 사라지지 않고
 * (그때는 "half" — 부른 쪽이 이 기기의 것을 다시 올려 계정을 되돌림), '전부 지움' 표식은 계정 지우기가 다 된 뒤에만 올라가 다른 기기가 덜 지워진 계정을 보고 자기 것을 지우지 않음.
 * 지난 초기화의 '전부 지움' 표식은 새 표식으로 바뀔 때까지 지우지 않음 — 이번 지우기가 중간에 실패해도, 지난 초기화를 아직 따르지 않은 기기가 받을 수 있게.
 * 그 표식만 못 올리면(한 번 더 해 보고) "ok"로 둠 — 다른 기기는 자기 것을 지우지 않는 예전 동작으로 물러남. 나중에 다시 올리지 않는 까닭: 그사이 다른 기기가 새로 초기화했으면
 * 늦게 올린 옛 표식이 새 표식을 덮어, 새 표식을 따른 기기들이 그 뒤에 만든 것까지 또 지움(서버가 표식의 순서를 확인하기 전에는 막을 수 없음 — Codex 검토).
 * 시작부터 이 화면은 더 올리지 않음(CLOUD.wiped) — 지우는 사이의 저장(늦게 끝난 요약 등)이나 이어지는 기기 지우기가 방금 쓴 표식을 덮거나 지우지 않게. 실패하면 다시 풂.
 * 알려진 한계: 아직 표식을 받지 못한 다른 기기가 그 사이 방 본문이나 페르소나·지갑을 올리면 계정에 다시 생김 — 서버 쪽 확인(docs/supabase.sql 끝의 트리거 초안)이 들어가야 막힘.
 * 방의 표식 요청이 서버에는 적용됐는데 응답만 잃으면 "half"로 보여 다시 올리게 됨(그 사이 표식을 받은 다른 기기는 방을 지운 뒤 — 다시 시도하면 맞춰짐).
 * @returns {Promise<"ok"|"fail"|"half">} fail: 아무것도 못 지움 · half: 방이 아닌 행만 지워짐
 */
export async function wipeAccount() {
  const C = CLOUD;
  if (!C.on || C.noTable) return "ok";
  const uid = C.uid,
    at = Date.now(),
    q = "/rest/v1/kv?user_id=eq." + encodeURIComponent(uid) + "&key=";
  const call = async (path, opts) => {
    const r = await SB.req(path, opts);
    if (C.uid !== uid) throw 0;
    await C.check(r);
  };
  C.wiped = true;
  clearTimeout(C.timer);
  const kept = C.pending; // 아직 못 올린 변경 — 지우기에 성공하면 버리고, 실패하면 되돌려 놓음
  C.pending = {};
  let step = 0;
  try {
    await (C.busy || Promise.resolve()).then(
      () => {},
      () => {}
    );
    if (C.uid !== uid) throw 0; // 기다리는 사이 계정이 바뀜 — 그 계정의 대기열을 건드리지 않음
    Object.assign(kept, C.pending); // 그 전송이 실패해 되돌려 넣은 것도 같이 들고 있음
    C.pending = {};
    await call(q + "not.like.room-*&key=neq." + WIPE_KEY, { method: "DELETE" });
    step = 1;
    await call(q + "like.room-*", { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ value: { gone: at } }) });
  } catch {
    if (C.uid !== uid) return "fail"; // 계정이 바뀜 — 지금 계정의 것은 아무것도 건드리지 않음(되돌려 올리기도 하지 않게)
    C.wiped = false;
    C.pending = Object.assign(kept, C.pending); // 기다리던 변경을 되돌려 놓고 다시 올림
    if (Object.keys(C.pending).length) C.timer = setTimeout(() => C.flush(), 800);
    return step ? "half" : "fail";
  }
  C.pending = {};
  seen(at); // 스스로 올린 표식은 따르지 않음(새로고침 뒤의 받기가 이 기기를 또 지우지 않게)
  for (let i = 0; i < 2; i++)
    try {
      await call("/rest/v1/kv?on_conflict=user_id,key", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify([{ user_id: uid, key: WIPE_KEY, value: { gone: at } }])
      });
      break;
    } catch {
      if (C.uid !== uid) break;
    }
  if (C.uid !== uid) return "ok"; // 계정 쪽은 끝남 — 부른 쪽(ui/me.js)이 계정이 바뀐 것을 보고 이 기기는 지우지 않음
  C.tombs({});
  C.owed = null; // 덜 끝난 올리기 표시도 지움 — 새로고침 뒤에 다시 올리지 않게
  try {
    localStorage.removeItem("hv1_cloudowed");
  } catch {}
  return "ok";
}

/** 처음 로그인의 전부 받기(ui/account.js firstSync): 계정의 '전부 지움' 표식은 따르지 않고 본 것으로만 적음 — 이 기기의 것은 '합칠까요?'가 정함(그 뒤의 받기가 지우지 않게) */
export function noteWipe(rows) {
  const at = wipeAt(rows);
  if (at) seen(at);
}
/**
 * 바뀐 행 받기(services/cloud-pull.js applyRows — 방의 표식을 처리한 뒤)에서: 아직 따르지 않은 '전부 지움' 표식이 왔으면 이 기기의 데이터를 지우고 받은 자리 표시까지 지운 뒤
 * 새로고침 — 새로고침 뒤에는 계정의 것을 처음부터 다시 받아 계정과 같아짐(받은 나머지 행은 쓰지 않음). '못 올린 표식'(방·전부 지움)은 남겨 새로고침 뒤 올림 —
 * 올리는 중이던 방 본문이 계정의 표식을 덮었을 수 있음(cloud-pull.js가 적어 둠). 다 지우지 못하면 알리고, 이 화면은 더 올리지 않은 채 다음 받기에서 다시 함.
 * 알려진 한계: 표식을 받기 전에 이 기기가 올린 것(페르소나·지갑 등)이 계정 지우기 뒤에 도착하면 계정에 남아 새로고침 뒤 다시 받음 — 서버 쪽 확인이 들어가야 막힘
 * @returns {Promise<boolean>} 표식을 따랐는지(따랐으면 부른 쪽은 받은 행을 쓰지 않음)
 */
export async function takeWipe(rows) {
  const C = CLOUD,
    uid = C.uid,
    at = wipeAt(rows);
  if (!at || seen() === String(at)) return false;
  if (C.wiped) return true; // 이미 지우는 중(이 기기의 초기화나 겹친 받기) — 받은 행은 쓰지 않음
  C.wiped = true; // 지우는 사이의 저장이 계정에 다시 올라가지 않게(새로고침하면 풂)
  clearTimeout(C.timer);
  C.pending = {};
  await (C.busy || Promise.resolve()).then(
    () => {},
    () => {}
  ); // 도는 전송이 끝난 뒤에 — 새로고침 뒤 올릴 방의 표식이 그 전송보다 늦게 도착하게
  if (C.uid !== uid) return true; // 기다리는 사이 계정이 바뀜 — 지금 계정의 것은 건드리지 않음
  if (!(await clearDevice())) {
    toast("다른 기기에서 모든 데이터를 초기화했는데, 이 기기의 데이터를 다 지우지 못했어요. 이 사이트를 연 다른 탭을 닫고 새로고침해 주세요");
    return true;
  }
  if (!seen(at)) {
    toast("다른 기기에서 모든 데이터를 초기화해서 이 기기의 데이터도 지웠어요. 새로고침해 주세요"); // 따른 것을 적지 못함 — 저절로 새로고침하면 되풀이될 수 있음
    return true;
  }
  try {
    [C.lastKey(), C.skipKey(), "hv1_cloudowed"].forEach((k) => localStorage.removeItem(k));
    localStorage.setItem("hv1_wipenote", "1"); // 새로고침 뒤에 알림(services/cloud.js start)
  } catch {}
  location.reload();
  return true;
}
