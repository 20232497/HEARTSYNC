/* 저장된 데이터를 S에 읽어 들임(loadAll): 지갑·페르소나·대화방 목록·요약 설정·내 서재. 부팅과 계정에서 다시 받을 때 씀 */
import { mergeShelf } from "../core/shelf.js";
import { S } from "../core/state.js";
import { KV } from "../core/storage.js";
import { WELCOME, ledger, refreshFree } from "../core/wallet.js";
import { IMG } from "./images.js";

/** 저장된 데이터(지갑·페르소나·대화방 목록·요약 설정·내 서재)를 KV에서 읽어 S에 얹음. @returns {Promise<void>} */
export async function loadAll() {
  const [w, p, rooms, mc, shelf] = await Promise.all(["wallet", "personas", "rooms", "memcfg", "shelf"].map((k) => KV.get(k)));
  if (w && typeof w === "object") S.wallet = { ...S.wallet, ...w, history: Array.isArray(w.history) ? w.history : [], ledger: Array.isArray(w.ledger) ? w.ledger : [], ack: w.ack && typeof w.ack === "object" ? w.ack : {} };
  else if (!S.wallet.welcomed) { S.wallet.hearts = WELCOME; S.wallet.welcomed = true; ledger(WELCOME, "첫 방문 보너스"); KV.set("wallet", S.wallet); }
  if (Array.isArray(p) && p.length) S.personas = p.map((x) => ({ memo: "", img: "", ...x }));
  if (Array.isArray(rooms)) S.rooms = rooms;
  S.shelf = mergeShelf(shelf);
  IMG.migrate().catch(() => {});
  if (mc && typeof mc === "object") S.settings.memCfg = { ...S.settings.memCfg, ...mc };
  refreshFree();
}
