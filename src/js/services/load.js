/* 저장된 데이터를 S에 읽어 들임(loadAll): 지갑·페르소나·프로필·내 작품·대화방 목록·그림 칸·요약 설정·표지·세계관·저장 태그. 부팅과 계정에서 다시 받을 때 씀 */
import { normalizeChar } from "../core/character.js";
import { S } from "../core/state.js";
import { KV } from "../core/storage.js";
import { WELCOME, ledger, refreshFree } from "../core/wallet.js";
import { TAGS, setTags } from "../images/tags-cache.js";
import { IMG } from "./images.js";

export async function loadAll() {
  const [w, p, pr, mine, rooms, packs, mc, cps, lps, tps] = await Promise.all(["wallet", "personas", "profile", "mine", "rooms", "imgpacks", "memcfg", "coverpacks", "lorepacks", "tagpacks"].map((k) => KV.get(k)));
  if (cps && typeof cps === "object") S.coverpacks = cps;
  if (tps && typeof tps === "object") S.tagpacks = tps;
  if (lps && typeof lps === "object") S.lorepacks = lps;
  if (w && typeof w === "object") S.wallet = { ...S.wallet, ...w, history: Array.isArray(w.history) ? w.history : [], ledger: Array.isArray(w.ledger) ? w.ledger : [], ack: w.ack && typeof w.ack === "object" ? w.ack : {} };
  else if (!S.wallet.welcomed) { S.wallet.hearts = WELCOME; S.wallet.welcomed = true; ledger(WELCOME, "첫 방문 보너스"); KV.set("wallet", S.wallet); }
  if (Array.isArray(p) && p.length) S.personas = p.map((x) => ({ memo: "", img: "", ...x }));
  if (pr && typeof pr === "object") S.profile = pr;
  if (Array.isArray(mine)) S.mine = mine.map(normalizeChar);
  if (Array.isArray(rooms)) S.rooms = rooms;
  if (packs && typeof packs === "object") S.imgpacks = packs;
  IMG.migrate().catch(() => {});
  KV.get("ponytags").then((t) => { if (t && typeof t === "object") setTags({ ...t, ...TAGS }); }).catch(() => {});
  if (mc && typeof mc === "object") S.settings.memCfg = { ...S.settings.memCfg, ...mc };
  refreshFree();
}
