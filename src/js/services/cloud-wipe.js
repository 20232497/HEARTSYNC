/* 계정의 데이터를 모두 지움(wipeAccount — MY '모든 데이터 초기화'): 방 행은 삭제 표식으로 바꾸고 나머지 행은 지움. 대기열·전송 줄은 services/cloud.js의 CLOUD 것을 씀(모듈 크기 때문에 나눔) */
import { CLOUD } from "./cloud.js";
import { SB } from "./supabase.js";

/**
 * 방은 행을 없애는 대신 삭제 표식({ gone })으로 바꿔 둠 — 행이 없으면 그 방을 아직 가진 다른 기기가 다시 올려 되살림(표식에는 지운 때만 남음). 나머지 행은 지움.
 * 순서: 방이 아닌 행을 먼저 지우고 **방의 표식을 마지막에** — 표식이 곧 '지움'의 확정이라, 중간에 실패해도 방은 어느 기기에서도 사라지지 않음
 * (그때는 "half" — 부른 쪽이 이 기기의 것을 다시 올려 계정을 되돌림).
 * 시작부터 이 화면은 더 올리지 않음(CLOUD.wiped) — 지우는 사이의 저장(늦게 끝난 요약 등)이나 이어지는 기기 지우기가 방금 쓴 표식을 덮거나 지우지 않게. 실패하면 다시 풂.
 * 알려진 한계: 아직 표식을 받지 못한 다른 기기가 그 사이 방 본문을 올리면 표식을 덮음 — 서버의 표식 보호 트리거(docs/supabase.sql 끝의 초안)가 들어가야 막힘.
 * 마지막 요청이 서버에는 적용됐는데 응답만 잃으면 "half"로 보여 다시 올리게 됨(그 사이 표식을 받은 다른 기기는 방을 지운 뒤 — 다시 시도하면 맞춰짐).
 * @returns {Promise<"ok"|"fail"|"half">} fail: 아무것도 못 지움 · half: 방이 아닌 행만 지워짐
 */
export async function wipeAccount() {
  const C = CLOUD;
  if (!C.on || C.noTable) return "ok";
  const uid = C.uid,
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
    await call(q + "not.like.room-*", { method: "DELETE" });
    step = 1;
    await call(q + "like.room-*", { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ value: { gone: Date.now() } }) });
  } catch {
    if (C.uid !== uid) return "fail"; // 계정이 바뀜 — 지금 계정의 것은 아무것도 건드리지 않음(되돌려 올리기도 하지 않게)
    C.wiped = false;
    C.pending = Object.assign(kept, C.pending); // 기다리던 변경을 되돌려 놓고 다시 올림
    if (Object.keys(C.pending).length) C.timer = setTimeout(() => C.flush(), 800);
    return step ? "half" : "fail";
  }
  C.pending = {};
  C.tombs({});
  C.owed = null; // 덜 끝난 올리기 표시도 지움 — 새로고침 뒤에 다시 올리지 않게
  try {
    localStorage.removeItem("hv1_cloudowed");
  } catch {}
  return "ok";
}
