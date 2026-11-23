/* 저장된 데이터를 S에 읽어 들임(loadAll): 지갑·페르소나·대화방 목록·내 서재(장기기억 설정은 설정의 한 칸 — core/migrate.js와 계정의 settings 행). 부팅과 계정에서 다시 받을 때 씀 */
import { sortRooms } from "../core/rooms.js";
import { mergeShelf } from "../core/shelf.js";
import { S } from "../core/state.js";
import { KV } from "../core/storage.js";
import { WELCOME, ledger, refreshFree } from "../core/wallet.js";
import { IMG } from "./images.js";

/** 저장된 데이터(지갑·페르소나·대화방 목록·내 서재)를 KV에서 읽어 S에 얹음. @returns {Promise<void>} */
export async function loadAll() {
  const [w, p, rooms, shelf] = await Promise.all(["wallet", "personas", "rooms", "shelf"].map((k) => KV.get(k)));
  if (w && typeof w === "object")
    S.wallet = {
      ...S.wallet,
      ...w,
      history: Array.isArray(w.history) ? w.history : [],
      ledger: Array.isArray(w.ledger) ? w.ledger : [],
      ack: w.ack && typeof w.ack === "object" ? w.ack : {}
    };
  else if (!S.wallet.welcomed) {
    S.wallet.hearts = WELCOME;
    S.wallet.welcomed = true;
    ledger(WELCOME, "첫 방문 보너스");
    KV.set("wallet", S.wallet);
  }
  if (Array.isArray(p) && p.length) S.personas = p.map((x) => ({ memo: "", img: "", ...x }));
  if (Array.isArray(rooms)) S.rooms = sortRooms(rooms); // 즐겨찾기 먼저 — 예전 버전이나 다른 기기가 저장한 목록은 최근 순으로만 서 있을 수 있음
  S.shelf = mergeShelf(shelf);
  IMG.migrate().catch(() => {});
  refreshFree();
  KV.moveBodies().catch(() => {}); // 예전 설치가 localStorage에 둔 방 본문을 큰 저장소로(뒤에서, 기다리지 않음)
}
