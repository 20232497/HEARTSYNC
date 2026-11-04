/* 처음 로그인·다른 기기와 합치기(mergeGuest·fillIn·mergeSits), 다시 받기, 기기 지우기 */
import { emit } from "../core/events.js";
import { roomKey } from "../core/rooms.js";
import { applySettings, saveSettings } from "../core/settings.js";
import { S, gen } from "../core/state.js";
import { IDB, KV } from "../core/storage.js";
import { dimOf, freeNum, keyOf, parseCodes, usedNums } from "../images/codes.js";
import { CUSTOM_MAX } from "../images/situations.js";
import { CLOUD } from "./cloud.js";
import { validRef } from "./images.js";
import { loadAll } from "./load.js";
import { SB } from "./supabase.js";

// 예전 버전은 계정에서 그림 칸 연결(imgpacks)을 받지 않아 기기마다 따로 놀았음 → 기기·계정마다 한 번, 계정 것과 합쳐(이 기기 것이 우선) 다시 올림
/** 예전 로그인 기기의 imgpacks를 계정과 한 번 합쳐 다시 올림(기기·계정마다 한 번). @param {boolean} fresh @returns {Promise<boolean>} 했으면 true */
export async function fixImgpacks(fresh) {
  const flag = "hv1_cloudfix_" + CLOUD.uid;
  try { if (localStorage.getItem(flag)) return false; } catch { return false; }
  let changed = false;
  if (!fresh) {
    const r = await SB.req("/rest/v1/kv?select=value&key=eq.imgpacks"); await CLOUD.check(r);
    const j = await r.json(), remote = j[0] ? j[0].value : null, mine = KV.getLocal("imgpacks") || {};
    const merged = fillIn(mine, remote);
    changed = JSON.stringify(merged) !== JSON.stringify(mine);
    if (changed || (Object.keys(mine).length && JSON.stringify(merged) !== JSON.stringify(remote))) KV.set("imgpacks", merged);
  }
  try { localStorage.setItem(flag, "1"); } catch {}
  return changed;
}
function isObj(x) { return !!x && typeof x === "object" && !Array.isArray(x); }
// a는 그대로 두고 빈 자리만 b로 채움 — 객체는 안쪽까지(그림 칸 하나하나)
function fillIn(a, b) {
  const out = Object.assign({}, isObj(a) ? a : {});
  Object.keys(isObj(b) ? b : {}).forEach((k) => { const x = out[k], y = b[k]; if (x == null || x === "") out[k] = y; else if (isObj(x) && isObj(y)) out[k] = fillIn(x, y); });
  return out;
}
// 이 기기에만 있는 그림 수(작품 그림 칸·표지·세계관 일러스트 중 계정에서 비어 있는 자리 + 계정에 없는 그림체 세트의 그림)
/** 계정에 없고 이 기기에만 있는 그림 수(합치기 안내에 씀). @param {Record<string, unknown>} remote 계정 값 @param {Record<string, unknown>} local 이 기기 값 @returns {number} */
export function guestPics(remote, local) {
  let n = 0;
  const walk = (a, b) => Object.keys(b || {}).forEach((k) => { const y = isObj(a) ? a[k] : undefined; if (isObj(b[k])) walk(y, b[k]); else if (validRef(b[k]) && !y) n++; });
  walk(remote.imgpacks, guestPacks(remote, local).imgpacks);
  ["coverpacks", "lorepacks"].forEach((k) => walk(remote[k], local[k]));
  const rs = isObj(remote.settings) && Array.isArray(remote.settings.styleSets) ? remote.settings.styleSets : [];
  (local.styleSets || []).forEach((x) => { if (x && !rs.some((y) => y && y.id === x.id)) n += (x.refs || []).filter(validRef).length; });
  return n;
}
// 직접 만든 이미지 칸(15번~, 의상 4xx·장소 5xx): 계정 칸에 이 기기에만 있는 칸을 더함. 같은 이름이면 계정 번호로, 번호만 겹치면 같은 종류의 빈 번호(내장 코드 번호는 피함)로 옮김
// → { sits, move: {이 기기 번호: 계정 번호(자리가 없으면 -1)} }
function mergeSits(remote, local) {
  const sits = (Array.isArray(remote) ? remote : []).slice(), move = {}, num = {};
  sits.forEach((d) => { num[d.name] = d.n; });
  (Array.isArray(local) ? local : []).forEach((d) => {
    if (!d || !Number.isInteger(d.n)) return;
    if (d.name in num) { if (num[d.name] !== d.n) move[d.n] = num[d.name]; return; }
    let n = d.n;
    if (sits.some((x) => x.n === n)) n = freeNum(usedNums(sits), dimOf(d.n));
    if (sits.length >= CUSTOM_MAX || n < 0) { move[d.n] = -1; return; }
    sits.push(Object.assign({}, d, { n })); num[d.name] = n;
    if (n !== d.n) move[d.n] = n;
  });
  return { sits, move };
}
// 칸 번호로 된 객체({번호 또는 조합 키 "3,404,501": 값})의 번호를 옮김(-1이 든 키는 뺌)
function moveSits(o, move) {
  if (!isObj(o)) return o;
  const out = {};
  Object.keys(o).forEach((k) => {
    const codes = parseCodes(k).map((n) => n in move ? move[n] : n);
    if (!codes.length || codes.indexOf(-1) >= 0) return;
    const to = keyOf(codes); if (to && !(to in out && out[to])) out[to] = o[k];
  });
  return out;
}
// 이 기기의 그림 칸(imgpacks[작품][인물][칸])·저장 태그를 계정의 칸 번호에 맞춤 → { sits(합친 칸 정의), imgpacks, tagpacks }
// 계정 설정에 직접 만든 칸 목록이 없으면 이 기기 목록이 그대로 남음
function guestPacks(remote, local) {
  const rs = isObj(remote.settings) && Array.isArray(remote.settings.customSits) ? remote.settings.customSits : local.customSits;
  const ms = mergeSits(rs, local.customSits), mv = Object.keys(ms.move).length;
  const each = (packs, f) => { const out = {}; Object.keys(packs || {}).forEach((c) => { const by = packs[c]; out[c] = {}; Object.keys(isObj(by) ? by : {}).forEach((code) => { out[c][code] = mv ? f(by[code]) : by[code]; }); }); return out; };
  return { sits: ms.sits, imgpacks: each(local.imgpacks, (o) => moveSits(o, ms.move)), tagpacks: each(local.tagpacks, (t) => isObj(t) ? Object.assign({}, t, { sits: moveSits(t.sits, ms.move) }) : t) };
}
// 계정 값 위에 이 기기에만 있던 대화·작품·페르소나·그림 연결을 더함(같은 것이 있으면 계정 값)
/** 처음 로그인 '합치기': 같은 것은 계정 값, 그림·표지·세계관·태그는 빈 자리만 채움, 직접 만든 칸은 번호를 맞춰 합침. @param {Record<string, unknown>} remote @param {Record<string, unknown>} local */
export function mergeGuest(remote, local) {
  const list = (a) => Array.isArray(a) ? a : [];
  const byId = (a, b) => { const ids = new Set(list(a).map((x) => x && x.id)); return list(a).concat(list(b).filter((x) => x && !ids.has(x.id))); };
  KV.set("rooms", byId(remote.rooms, local.rooms).sort((x, y) => (y.at || 0) - (x.at || 0)));
  local.rooms.forEach((r) => { if (!list(remote.rooms).some((x) => x.id === r.id)) { const v = KV.getLocal(roomKey(r.id)); if (v) KV.set(roomKey(r.id), v); } });
  KV.set("mine", byId(remote.mine, local.mine));
  const ps = byId(remote.personas, list(local.personas).map((p) => Object.assign({}, p, { def: false })));
  if (ps.length && !ps.some((p) => p.def)) ps[0].def = true;
  if (ps.length) KV.set("personas", ps);
  // 직접 만든 칸·그림체 세트(설정)도 합침 — 칸 번호가 옮겨지면 그 칸의 그림·저장 태그도 같이 옮김
  const gp = guestPacks(remote, local);
  const sets = list(S.settings.styleSets), add = list(local.styleSets).filter((x) => x && !sets.some((y) => y && y.id === x.id));
  if (gp.sits.length !== list(S.settings.customSits).length || add.length) { S.settings.customSits = gp.sits; S.settings.styleSets = sets.concat(add); saveSettings(); }
  const packs = { imgpacks: gp.imgpacks, motionpacks: local.motionpacks, coverpacks: local.coverpacks, lorepacks: local.lorepacks, tagpacks: gp.tagpacks, ponytags: local.ponytags };
  // 계정 값은 그대로 두고 빈 자리만 이 기기 값으로(같은 인물의 다른 칸 그림도 살림)
  Object.keys(packs).forEach((k) => { if (packs[k] && Object.keys(packs[k]).length) KV.set(k, fillIn(remote[k], packs[k])); });
}
// 계정에서 받은 것을 화면에 반영(입력 중이거나 응답을 받는 중이면 화면은 그대로)
/** 계정에서 받은 뒤 다시 읽고 화면 갱신(입력 중·대화방 안이면 화면은 그대로). @returns {Promise<void>} */
export async function reloadFromCloud() {
  await loadAll(); applySettings(); emit("rooms"); emit("wallet");
  const h = location.hash.slice(1) || "home", typing = document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
  if (!gen && !typing && !h.startsWith("r-") && !h.startsWith("studio")) emit("route");
}
// 이 기기의 HEART SYNC 데이터 전부(설정·키·그림 포함)를 지움 — 같이 쓰는 기기에서 로그아웃할 때
/** 이 기기의 HEART SYNC 데이터 전부 삭제(설정·키·그림 포함). @returns {Promise<void>} */
export async function wipeDevice() {
  await IDB.clear();
  try { Object.keys(localStorage).filter((k) => k.indexOf("hv1_") === 0).forEach((k) => localStorage.removeItem(k)); } catch {}
}
