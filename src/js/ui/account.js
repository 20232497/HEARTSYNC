/* MY → 계정 칸: 처음 로그인 합치기(firstSync), 동기화 상태·로그아웃·계정 삭제 */
import { on } from "../core/events.js";
import { likedIds, mergeShelf, resetShelf } from "../core/shelf.js";
import { S } from "../core/state.js";
import { $, esc, toast } from "../core/util.js";
import { CLOUD, cloudStateText } from "../services/cloud.js";
import { SB, acctName, provName } from "../services/supabase.js";
import { mergeGuest, reloadFromCloud, wipeDevice } from "../services/sync.js";
import { viewMe } from "./me.js";
import { confirmSheet, sheet } from "./sheet.js";

/* 처음 로그인: 계정이 비었으면 이 기기 데이터를 올리고, 이 기기에만 있는 대화나 찜한 작품이 있으면 합칠지 물음(2026-11-10 사용자 결정: 찜도 묻기 —
   '계정 것만 쓰기'를 고르면 이 기기의 서재(찜·최근 본·수집 기록)를 버림. 최근 본·수집 기록만 있을 때는 묻지 않고 합침) */
export async function firstSync() {
  try { localStorage.removeItem(CLOUD.lastKey()); } catch {}
  const rows = await CLOUD.rows("");
  const remote = {}; rows.forEach((x) => { remote[x.key] = x.value; });
  if (!rows.some((x) => x.key !== "settings")) { await CLOUD.pushAll(); toast("이 기기의 데이터를 계정에 저장했어요"); return; }
  const local = { rooms: S.rooms, personas: S.personas };
  const has = (list, id) => (Array.isArray(list) ? list : []).some((x) => x && x.id === id);
  const onlyRooms = local.rooms.filter((r) => !has(remote.rooms, r.id));
  // 이 기기에서 찜한 작품 가운데 계정에 없는 것 — 계정의 서재 행은 동기화 날짜(SHELF.syncFrom) 뒤에만 있으므로 그 전에는 이 기기의 찜 전부
  const rs = mergeShelf(remote.shelf), onlyLikes = likedIds().filter((id) => !((rs.likes[id] || 0) > (rs.unlikes[id] || 0)));
  const use = async (merge) => {
    CLOUD.apply(rows);
    if (merge) { mergeGuest(remote, local); await CLOUD.pushAll([]); }
    await reloadFromCloud();
    toast(merge ? "이 기기의 데이터를 계정에 합쳤어요" : "계정 데이터를 불러왔어요");
  };
  if (!onlyRooms.length && !onlyLikes.length) return use(false);
  const what = [onlyRooms.length ? `대화 ${onlyRooms.length}개` : "", onlyLikes.length ? `찜한 작품 ${onlyLikes.length}개` : ""].filter(Boolean).join("와 ");
  const ov = sheet(`<h2>이 기기의 ${onlyRooms.length ? "대화를" : "찜을"} 합칠까요?</h2><p class="sub">계정에 이미 저장된 데이터가 있어요. 이 기기에만 있는 ${what}를 계정에 합칠 수 있어요. 계정에 있던 것은 그대로 남아요.</p>
    <div class="cta-row"><button class="btn ghost" id="mNo">계정 것만 쓰기</button><span class="spacer"></span><button class="btn pri" id="mYes">합치기</button></div>`);
  return new Promise((res) => {
    let done = false;
    const pick = async (merge) => { if (done) return; done = true; ov.remove(); await use(merge); res(); };
    $("#mYes", ov).onclick = () => pick(true); $("#mNo", ov).onclick = () => { resetShelf(); pick(false); }; // 이 기기의 찜·최근 본도 합치지 않음
    ov.addEventListener("click", (e) => { if (e.target === ov) pick(true); }); // 그냥 닫으면 아무것도 잃지 않게 합침
  });
}
on("cloud", () => { const el = $("#cloudState"); if (el) el.textContent = cloudStateText(); }); // 계정 저장 상태가 바뀌면 제목 옆 글을 갱신
export function accountBoxHTML() {
  if (!SB.on()) return "";
  if (!SB.s) return `<h2 class="sec">계정</h2><div class="box"><p>로그인하면 PC와 휴대폰에서 대화·설정이 그대로 이어져요.</p><div class="cta-row" style="margin-top:12px"><button class="btn pri" data-go="login">로그인 · 회원가입</button></div></div>`;
  return `<h2 class="sec">계정 <small id="cloudState">${esc(cloudStateText())}</small></h2><div class="box">
    <div class="acct-row"><span class="pill ok">로그인</span><b>${esc(acctName())}</b>${provName(SB.s.user.provider) ? `<span class="note">${esc(provName(SB.s.user.provider))}로 가입</span>` : ""}</div>
    <p class="note" style="margin-top:8px">API 키는 계정에 올리지 않아요. 다른 기기에서는 MY → AI 연결에 한 번 더 넣어 주세요.</p>
    <div class="cta-row" style="margin-top:12px"><button class="btn sm" id="cSync">지금 동기화</button><span class="spacer"></span><button class="btn sm ghost" id="cOut">로그아웃</button><button class="btn sm danger" id="cDel">계정 삭제</button></div></div>`;
}
export function bindAccount(v) {
  if (!$("#cSync", v)) return;
  $("#cSync", v).onclick = async (e) => {
    e.target.disabled = true;
    try { await CLOUD.flush(); const n = await CLOUD.pull(); if (n) await reloadFromCloud(); CLOUD.setState(CLOUD.noTable ? "notable" : "ok"); toast(CLOUD.noTable ? "계정 저장 표가 아직 없어요" : n ? `계정에서 ${n}개를 받았어요` : "이미 최신이에요"); }
    catch { if (!CLOUD.noTable) CLOUD.setState("err"); toast(CLOUD.noTable ? "계정 저장 표가 아직 없어요" : "동기화하지 못했어요"); }
    e.target.disabled = false;
  };
  $("#cOut", v).onclick = () => {
    const ov = sheet(`<h2>로그아웃할까요?</h2><p class="sub">계정에 저장된 데이터는 그대로예요. 이 기기의 데이터는 남겨 두거나 지울 수 있어요.</p>
      <div class="toggle"><label for="lwipe">이 기기의 데이터도 지우기 <span class="note">다른 사람과 같이 쓰는 기기라면 켜 주세요</span></label><input type="checkbox" id="lwipe"></div>
      <div class="cta-row" style="margin-top:14px"><span class="spacer"></span><button class="btn ghost" data-x>취소</button><button class="btn pri" id="lok">로그아웃</button></div>`);
    $("#lok", ov).onclick = async () => {
      const wipe = $("#lwipe", ov).checked; ov.remove();
      await CLOUD.flush(); CLOUD.stop(); await SB.signOut();
      if (wipe) { await wipeDevice(); location.reload(); return; }
      try { localStorage.setItem("hv1_guest", "1"); } catch {}
      toast("로그아웃했어요. 이 기기의 데이터는 남아 있어요"); viewMe();
    };
  };
  $("#cDel", v).onclick = () => confirmSheet("계정을 삭제할까요?", "계정과 계정에 저장된 대화·페르소나·설정이 모두 지워져요. 이 기기의 데이터는 남아요. 되돌릴 수 없어요.", "계정 삭제", async () => {
    try {
      const r = await SB.req("/rest/v1/rpc/delete_me", { method: "POST", body: "{}" });
      if (!r.ok) throw await r.json().catch(() => ({}));
      CLOUD.stop(); SB.keep(null); try { localStorage.setItem("hv1_guest", "1"); } catch {}
      toast("계정을 삭제했어요"); viewMe();
    } catch (x) { toast("계정을 삭제하지 못했어요" + (x && x.code === "PGRST202" ? " (docs/supabase.sql의 delete_me 함수가 없어요)" : "")); }
  });
}
