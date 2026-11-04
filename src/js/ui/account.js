/* MY → 계정 칸: 처음 로그인 합치기(firstSync), 동기화 상태·로그아웃·계정 삭제 */
import { on } from "../core/events.js";
import { saveSettings } from "../core/settings.js";
import { S } from "../core/state.js";
import { KV } from "../core/storage.js";
import { $, esc, toast } from "../core/util.js";
import { CLOUD, cloudStateText } from "../services/cloud.js";
import { SB, acctName, provName } from "../services/supabase.js";
import { guestPics, mergeGuest, reloadFromCloud, wipeDevice } from "../services/sync.js";
import { VAULT } from "../services/vault.js";
import { paintVault, phraseSheet, vaultHTML, vaultSheet } from "./login.js";
import { viewMe } from "./me.js";
import { confirmSheet, sheet } from "./sheet.js";

export async function firstSync() {
  try { localStorage.removeItem(CLOUD.lastKey()); } catch {}
  const rows = await CLOUD.rows("");
  const remote = {}; rows.forEach((x) => { remote[x.key] = x.value; });
  // 계정이 비었으면 이 기기 데이터가 계정의 첫 데이터(API 키는 잠가서 따로 — VAULT)
  if (!rows.some((x) => x.key !== "settings" && x.key !== "vault")) { await CLOUD.pushAll(); await VAULT.take(remote.vault || null, true); toast("이 기기의 데이터를 계정에 저장했어요"); return; }
  const local = { rooms: S.rooms, mine: S.mine, personas: S.personas, imgpacks: S.imgpacks, coverpacks: S.coverpacks, lorepacks: S.lorepacks, tagpacks: S.tagpacks, ponytags: KV.getLocal("ponytags"),
    customSits: S.settings.customSits, styleSets: S.settings.styleSets };
  const has = (list, id) => (Array.isArray(list) ? list : []).some((x) => x && x.id === id);
  const onlyRooms = local.rooms.filter((r) => !has(remote.rooms, r.id)), onlyMine = local.mine.filter((c) => !has(remote.mine, c.id)), pics = guestPics(remote, local);
  const use = async (merge) => {
    CLOUD.apply(rows);
    await VAULT.take(CLOUD.takeVault() || null, true);
    if (merge) { mergeGuest(remote, local); await CLOUD.pushAll([]); }
    await reloadFromCloud();
    toast(merge ? "이 기기의 데이터를 계정에 합쳤어요" : "계정 데이터를 불러왔어요");
  };
  if (!onlyRooms.length && !onlyMine.length && !pics) return use(false);
  const what = [onlyRooms.length ? `대화 ${onlyRooms.length}개` : "", onlyMine.length ? `작품 ${onlyMine.length}개` : "", pics ? `그림 ${pics}장` : ""].filter(Boolean).join("·");
  const ov = sheet(`<h2>이 기기의 데이터를 합칠까요?</h2><p class="sub">계정에 이미 저장된 데이터가 있어요. 이 기기에만 있는 데이터(${what})를 계정에 합칠 수 있어요. 계정에 있던 것은 그대로 남아요.</p>
    <div class="cta-row"><button class="btn ghost" id="mNo">계정 것만 쓰기</button><span class="spacer"></span><button class="btn pri" id="mYes">합치기</button></div>`);
  return new Promise((res) => {
    let done = false;
    const pick = async (merge) => { if (done) return; done = true; ov.remove(); await use(merge); res(); };
    $("#mYes", ov).onclick = () => pick(true); $("#mNo", ov).onclick = () => pick(false);
    ov.addEventListener("click", (e) => { if (e.target === ov) pick(true); }); // 그냥 닫으면 아무것도 잃지 않게 합침
  });
}
on("cloud", () => { const el = $("#cloudState"); if (el) el.textContent = cloudStateText(); }); // 계정 저장 상태가 바뀌면 제목 옆 글을 갱신
export function accountBoxHTML() {
  if (!SB.on()) return "";
  if (!SB.s) return `<h2 class="sec">계정</h2><div class="box"><p>로그인하면 PC와 휴대폰에서 대화·작품·설정이 그대로 이어져요.</p><div class="cta-row" style="margin-top:12px"><button class="btn pri" data-go="login">로그인 · 회원가입</button></div></div>`;
  return `<h2 class="sec">계정 <small id="cloudState">${esc(cloudStateText())}</small></h2><div class="box">
    <div class="acct-row"><span class="pill ok">로그인</span><b>${esc(acctName())}</b>${provName(SB.s.user.provider) ? `<span class="note">${esc(provName(SB.s.user.provider))}로 가입</span>` : ""}</div>
    <div class="toggle" style="margin-top:12px"><label for="syncKeys">API 키도 계정에 저장 <span class="note">켜 두면 휴대폰에서 키를 다시 넣지 않아도 돼요</span></label><input type="checkbox" id="syncKeys" ${S.settings.syncKeys !== false ? "checked" : ""}></div>
    <div id="vaultBox" class="vault-box">${vaultHTML()}</div>
    <div class="cta-row" style="margin-top:12px"><button class="btn sm" id="cSync">지금 동기화</button><span class="spacer"></span><button class="btn sm ghost" id="cOut">로그아웃</button><button class="btn sm danger" id="cDel">계정 삭제</button></div></div>`;
}
export function bindAccount(v) {
  if (!$("#syncKeys", v)) return;
  paintVault();
  $("#syncKeys", v).onchange = async (e) => {
    S.settings.syncKeys = e.target.checked; saveSettings(); paintVault();
    if (!e.target.checked) { VAULT.drop().catch(() => {}); toast("API 키는 이 기기에만 둬요. 계정에 있던 키는 지웠어요"); return; }
    if (!VAULT.canWrite()) { toast("API 키는 이 기기에만 있어요"); if (VAULT.ok()) { if (VAULT.phrase()) phraseSheet(); else vaultSheet(); } return; }
    try { await VAULT.take(await VAULT.remote(), true); toast("API 키를 암호화해서 계정에 저장해요"); } catch { toast("계정에 저장하지 못했어요. 잠시 뒤 다시 해 주세요"); }
  };
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
  $("#cDel", v).onclick = () => confirmSheet("계정을 삭제할까요?", "계정과 계정에 저장된 대화·작품·설정·그림이 모두 지워져요. 이 기기의 데이터는 남아요. 되돌릴 수 없어요.", "계정 삭제", async () => {
    try {
      const r = await SB.req("/rest/v1/rpc/delete_me", { method: "POST", body: "{}" });
      if (!r.ok) throw await r.json().catch(() => ({}));
      CLOUD.stop(); SB.keep(null); VAULT.forget(); try { localStorage.setItem("hv1_guest", "1"); } catch {}
      toast("계정을 삭제했어요"); viewMe();
    } catch (x) { toast("계정을 삭제하지 못했어요" + (x && x.code === "PGRST202" ? " (docs/supabase.sql의 delete_me 함수가 없어요)" : "")); }
  });
}
