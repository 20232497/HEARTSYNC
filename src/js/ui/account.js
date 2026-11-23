/* MY → 계정 칸: 처음 로그인 합치기(firstSync), 동기화 상태·로그아웃·계정 삭제 */
import { on } from "../core/events.js";
import { likedIds, mergeShelf, resetShelf } from "../core/shelf.js";
import { S } from "../core/state.js";
import { $, ago, esc, toast } from "../core/util.js";
import { CLOUD } from "../services/cloud.js";
import { pushAll } from "../services/cloud-push.js";
import { SB, acctName, provName } from "../services/supabase.js";
import { dropGuestRooms, mergeGuest, reloadFromCloud, wipeDevice } from "../services/sync.js";
import { viewMe } from "./me.js";
import { confirmSheet, sheet } from "./sheet.js";

/* 처음 로그인: 계정이 비었으면 이 기기 데이터를 올리고, 이 기기에만 있는 대화나 찜한 작품이 있으면 합칠지 물음(2026-11-10 사용자 결정: 찜도 묻기 —
   '계정 것만 쓰기'를 고르면 이 기기의 서재(찜·최근 본·수집 기록)를 버림. 최근 본·수집 기록만 있을 때는 묻지 않고 합침) */
export async function firstSync() {
  try {
    localStorage.removeItem(CLOUD.lastKey());
  } catch {}
  const rows = await CLOUD.rows("");
  const remote = {};
  rows.forEach((x) => {
    remote[x.key] = x.value;
  });
  if (!rows.some((x) => x.key !== "settings")) {
    await pushAll();
    toast("이 기기의 데이터를 계정에 저장했어요");
    return;
  }
  const local = { rooms: S.rooms, personas: S.personas };
  const has = (list, id) => (Array.isArray(list) ? list : []).some((x) => x && x.id === id);
  const onlyRooms = local.rooms.filter((r) => !has(remote.rooms, r.id));
  // 이 기기에서 찜한 작품 가운데 계정에 없는 것 — 계정의 서재 행은 동기화 날짜(SHELF.syncFrom) 뒤에만 있으므로 그 전에는 이 기기의 찜 전부
  const rs = mergeShelf(remote.shelf),
    onlyLikes = likedIds().filter((id) => !((rs.likes[id] || 0) > (rs.unlikes[id] || 0)));
  // 이 기기의 화면부터 맞추고 나서 계정에 올림 — 못 올리면 던져서 afterLogin이 '저장하지 못했어요' 상태로 둠(못 올린 것은 남아 15초 뒤 다시 올라감)
  const use = async (merge) => {
    await CLOUD.apply(rows);
    const g = merge ? await mergeGuest(remote, local) : null;
    if (!merge) dropGuestRooms(remote);
    await reloadFromCloud();
    if (merge) await pushAll(g.keys); // 합친 방의 본문(과 설정·그림)을 올림 — 못 올리면 던져서 '저장하지 못했어요' 상태로, 덜 끝난 표시가 남아 다시 올림
    const done =
      g && g.missed
        ? `이 기기의 데이터를 합쳤어요. 대화 ${g.missed}개는 읽지 못해 합치지 못했어요(이 기기에는 남아 있어요)`
        : "이 기기의 데이터를 계정에 합쳤어요";
    toast(merge ? done : "계정 데이터를 불러왔어요");
  };
  if (!onlyRooms.length && !onlyLikes.length) return use(false);
  const what = [onlyRooms.length ? `대화 ${onlyRooms.length}개` : "", onlyLikes.length ? `찜한 작품 ${onlyLikes.length}개` : ""].filter(Boolean).join("와 ");
  const ov =
    sheet(`<h2>이 기기의 ${onlyRooms.length ? "대화를" : "찜을"} 합칠까요?</h2><p class="sub">계정에 이미 저장된 데이터가 있어요. 이 기기에만 있는 ${what}를 계정에 합칠 수 있어요. 계정에 있던 것은 그대로 남아요.</p>
    <div class="cta-row"><button class="btn ghost" id="mNo">계정 것만 쓰기</button><span class="spacer"></span><button class="btn pri" id="mYes">합치기</button></div>`);
  return new Promise((res, rej) => {
    let done = false;
    const pick = (merge) => {
      if (done) return;
      done = true;
      ov.remove();
      use(merge).then(res, rej); // 올리기가 실패해도 기다리는 쪽(afterLogin)이 멈추지 않게
    };
    $("#mYes", ov).onclick = () => pick(true);
    $("#mNo", ov).onclick = () => {
      resetShelf();
      pick(false);
    }; // 이 기기의 찜·최근 본도 합치지 않음
    ov.onShut = () => pick(true); // 버튼이 아닌 길(배경·Esc·화면 이동)로 닫혀도 뒤처리가 끝나게 — 그냥 닫으면 아무것도 잃지 않게 합침(ui/sheet.js shut)
  });
}
/** MY → 계정에 보이는 동기화 상태 글. @returns {string} */
function cloudStateText() {
  if (!CLOUD.on) return "";
  if (CLOUD.state === "notable") return "⚠️ 계정 저장 표가 아직 없어요 (docs/supabase.sql을 실행해 주세요)";
  if (CLOUD.state === "err") return "⚠️ 계정에 저장하지 못했어요. 잠시 뒤 다시 시도해요";
  if (CLOUD.state === "sync") return "저장하는 중…";
  return CLOUD.at ? "계정에 저장됨 · " + ago(CLOUD.at) : "계정과 연결됨";
}
on("cloud", () => {
  const el = $("#cloudState");
  if (el) el.textContent = cloudStateText();
}); // 계정 저장 상태가 바뀌면 제목 옆 글을 갱신
export function accountBoxHTML() {
  if (!SB.on()) return "";
  if (!SB.s)
    return (
      `<h2 class="sec">계정</h2><div class="box"><p>로그인하면 PC와 휴대폰에서 대화·설정이 그대로 이어져요.</p>` +
      `<div class="cta-row" style="margin-top:12px"><button class="btn pri" data-go="login">로그인 · 회원가입</button></div></div>`
    );
  return (
    `<h2 class="sec">계정 <small id="cloudState">${esc(cloudStateText())}</small></h2><div class="box">
    <div class="acct-row"><span class="pill ok">로그인</span>` +
    `<b>${esc(acctName())}</b>${provName(SB.s.user.provider) ? `<span class="note">${esc(provName(SB.s.user.provider))}로 가입</span>` : ""}</div>
    <p class="note" style="margin-top:8px">API 키는 계정에 올리지 않아요. 다른 기기에서는 MY → AI 연결에 한 번 더 넣어 주세요.</p>
    <div class="cta-row" style="margin-top:12px"><button class="btn sm" id="cSync">지금 동기화</button><span class="spacer"></span>` +
    `<button class="btn sm ghost" id="cOut">로그아웃</button><button class="btn sm danger" id="cDel">계정 삭제</button></div></div>`
  );
}
/* 로그아웃: 먼저 못 올린 것을 올리고(도는 전송이 있으면 기다림), 그 결과를 보고 정함(2026-11-21 사용자 결정).
   - 다 올라갔으면 고른 대로(기기 데이터를 지우거나 남김).
   - 못 올린 것이 남았으면 멈추고 묻는 창 — 기기를 지우면 그 대화의 마지막 사본이 사라지고, 남겨도 다음 로그인 때 계정 것으로 덮일 수 있음.
   - '기기 데이터도 지우기'는 다 올라간 것을 확인했을 때만 함(계정 저장 표가 없는 설치도 계정에 사본이 없으니 지우지 않음). 지우지 않는 로그아웃은 표가 없어도 그대로 됨.
   - 지우는 로그아웃은 올리기 시작부터 새로고침까지 화면을 막음(veil) — 그사이에 바꾼 것은 계정에 닿지 못한 채 지워지므로 */
const LOGOUT_WAIT = 20000; // 올리기를 기다리는 한도 — 응답이 오다 멈춰도 로그아웃이 영영 안 끝나지 않게(넘으면 못 올린 것으로 보고 물음)
/* 지금 올릴 수 있는 것을 다 올림 — 처음 올리기가 덜 끝났으면(CLOUD.owed: 그림을 대기열에 넣기 전에 실패한 경우) 그것부터 다시. 결과는 CLOUD.flush와 같은 값 */
async function uploadAll() {
  if (CLOUD.owed)
    try {
      await pushAll(CLOUD.owed.keys || undefined); // 올리려던 키 그대로(없으면 이 기기의 것 전부)
    } catch {
      return CLOUD.noTable ? "notable" : "left";
    }
  return CLOUD.flush();
}
const flushSoon = () => Promise.race([uploadAll(), new Promise((r) => setTimeout(() => r("left"), LOGOUT_WAIT))]);
/* 화면 전체를 막는 가림막 — .overlay가 아니라서 Esc·화면 이동(closeOverlays)으로 닫히지 않음. 포인터는 덮어서, 키보드는 눌림을 가로채서 막음
   (뒤쪽 화면에 포커스가 남아 있으면 가려져 있어도 Enter·Tab으로 조작됨). 돌려준 함수를 부르면 걷힘 */
function veil(text) {
  const el = document.createElement("div"),
    block = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };
  el.className = "veil";
  el.setAttribute("role", "status");
  el.textContent = text;
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  document.addEventListener("keydown", block, true);
  document.body.append(el);
  return () => {
    document.removeEventListener("keydown", block, true);
    el.remove();
  };
}
async function logout(wipe) {
  const lift = wipe ? veil("계정에 올리는 중이에요…") : null;
  const up = await flushSoon();
  if (up === "ok" || (!wipe && up !== "left")) return finishLogout(wipe, lift); // 지우는 길이면 가림막은 새로고침까지 그대로
  if (lift) lift();
  const why =
      up === "left"
        ? "방금 바꾼 대화나 설정이 계정에 올라가지 않았어요. 연결을 확인하고 다시 올려 주세요."
        : "지금은 이 기기의 데이터를 계정에 저장할 수 없어요.",
    later = "다음에 로그인할 때 계정에 있던 것으로 바뀔 수 있어요.",
    then = wipe
      ? "이 기기의 데이터를 지우면 그 내용이 사라져서, 다 올라가기 전에는 지우지 않아요. 지우지 않고 로그아웃해도 " + later
      : "그대로 로그아웃하면 이 기기에는 남지만, " + later;
  const ov = sheet(
    `<h2>계정에 아직 올리지 못한 것이 있어요</h2><p class="sub">${why} ${then}</p>` +
      `<div class="cta-row"><button class="btn ghost" data-x>취소</button><span class="spacer"></span>` +
      `<button class="btn" id="lKeep">${wipe ? "지우지 않고 로그아웃" : "그대로 로그아웃"}</button>` +
      `<button class="btn pri" id="lRetry">다시 올리기</button></div>`
  );
  $("#lKeep", ov).onclick = () => {
    ov.remove();
    finishLogout(false);
  };
  $("#lRetry", ov).onclick = async (e) => {
    e.target.disabled = true;
    const lift2 = wipe ? veil("계정에 올리는 중이에요…") : null;
    const again = await flushSoon();
    if (again === "ok" && ov.isConnected) {
      ov.remove();
      return finishLogout(wipe, lift2);
    }
    if (lift2) lift2();
    e.target.disabled = false;
    if (ov.isConnected) toast("아직 올리지 못했어요. 연결을 확인해 주세요"); // 기다리는 사이 창이 닫혔으면(취소) 아무것도 하지 않음
  };
}
async function finishLogout(wipe, lift) {
  CLOUD.stop();
  await SB.signOut();
  if (wipe) {
    if (await wipeDevice()) return location.reload();
    // 큰 저장소를 비우지 못함(브라우저가 열어 주지 않음) — 지웠다고 하지 않고 알림. 확인을 누르면 새로고침
    if (lift) lift();
    const ov = sheet(
      `<h2>이 기기의 데이터를 다 지우지 못했어요</h2><p class="sub">브라우저가 저장소를 열어 주지 않아 대화 일부가 이 기기에 남아 있을 수 있어요. ` +
        `같이 쓰는 기기라면 브라우저 설정에서 이 사이트의 데이터를 지워 주세요.</p>` +
        `<div class="cta-row"><span class="spacer"></span><button class="btn pri" data-x>확인</button></div>`
    );
    ov.onShut = () => location.reload();
    return;
  }
  try {
    localStorage.setItem("hv1_guest", "1");
  } catch {}
  toast("로그아웃했어요. 이 기기의 데이터는 남아 있어요");
  viewMe();
}
export function bindAccount(v) {
  if (!$("#cSync", v)) return;
  $("#cSync", v).onclick = async (e) => {
    e.target.disabled = true;
    try {
      if ((await uploadAll()) === "left") throw 0; // 올리지 못한 것이 있으면 '이미 최신'이라고 하지 않음(처음 올리기가 덜 끝났으면 그것부터)
      const n = await CLOUD.pull();
      if (n) await reloadFromCloud();
      CLOUD.setState(CLOUD.noTable ? "notable" : "ok");
      toast(CLOUD.noTable ? "계정 저장 표가 아직 없어요" : n ? `계정에서 ${n}개를 받았어요` : "이미 최신이에요");
    } catch {
      if (!CLOUD.noTable) CLOUD.setState("err");
      toast(CLOUD.noTable ? "계정 저장 표가 아직 없어요" : "동기화하지 못했어요");
    }
    e.target.disabled = false;
  };
  $("#cOut", v).onclick = () => {
    const ov = sheet(
      `<h2>로그아웃할까요?</h2><p class="sub">계정에 저장된 데이터는 그대로예요. 이 기기의 데이터는 남겨 두거나 지울 수 있어요.</p>
      <div class="toggle"><label for="lwipe">이 기기의 데이터도 지우기 <span class="note">다른 사람과 같이 쓰는 기기라면 켜 주세요</span></label><input type="checkbox" id="lwipe"></div>
      <div class="cta-row" style="margin-top:14px"><span class="spacer"></span><button class="btn ghost" data-x>취소</button>` +
        `<button class="btn pri" id="lok">로그아웃</button></div>`
    );
    $("#lok", ov).onclick = () => {
      const wipe = $("#lwipe", ov).checked;
      ov.remove();
      logout(wipe);
    };
  };
  $("#cDel", v).onclick = () =>
    confirmSheet(
      "계정을 삭제할까요?",
      "계정과 계정에 저장된 대화·페르소나·설정이 모두 지워져요. 이 기기의 데이터는 남아요. 되돌릴 수 없어요.",
      "계정 삭제",
      async () => {
        try {
          const r = await SB.req("/rest/v1/rpc/delete_me", { method: "POST", body: "{}" });
          if (!r.ok) throw await r.json().catch(() => ({}));
          CLOUD.stop();
          SB.keep(null);
          try {
            localStorage.setItem("hv1_guest", "1");
          } catch {}
          toast("계정을 삭제했어요");
          viewMe();
        } catch (x) {
          toast("계정을 삭제하지 못했어요" + (x && x.code === "PGRST202" ? " (docs/supabase.sql의 delete_me 함수가 없어요)" : ""));
        }
      }
    );
}
