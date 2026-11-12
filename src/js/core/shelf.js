/* 내 서재(S.shelf): 찜한 작품·최근 본 작품·대화에서 본 그림 코드(수집 기록). 이 기기에 저장하고 SHELF.syncFrom 날짜부터 계정에도 — 여러 기기의 값은 덮지 않고 합침(mergeShelf, 순수) */
import { SHELF } from "./constants.js";
import { S } from "./state.js";
import { KV } from "./storage.js";
/** @typedef {import("./types.js").Shelf} Shelf */

const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
const sorted = (o) => {
  const out = {};
  Object.keys(o)
    .sort()
    .forEach((k) => {
      out[k] = o[k];
    });
  return out;
};
// 시각 표 둘을 합침 — 같은 작품이면 더 늦은 시각
function later(a, b) {
  const out = {};
  [obj(a), obj(b)].forEach((o) =>
    Object.keys(o).forEach((k) => {
      const t = +o[k] || 0;
      if (t > (out[k] || 0)) out[k] = t;
    })
  );
  return out;
}
/**
 * 서재 둘을 합쳐 정돈된 모양으로(하나만 주면 정돈만, 안 주면 빈 서재).
 * 찜(likes)·찜 해제(unlikes)·최근 본(recent)은 작품마다 더 늦은 시각 — 그래서 다른 기기에서 찜을 푼 것도 전해짐. 수집 기록(seen)·모은 결말(ends)은 합집합.
 * 최근 본은 SHELF.recent개까지. 키 순서를 맞춰 내므로 JSON 글로 같은지 비교할 수 있고, 합치는 순서와 무관.
 * @param {Partial<Shelf>|null} [a] @param {Partial<Shelf>|null} [b] @returns {Shelf}
 */
export function mergeShelf(a, b) {
  const x = obj(a),
    y = obj(b),
    all = later(x.recent, y.recent),
    recent = {};
  Object.keys(all)
    .sort((p, q) => all[q] - all[p] || (p < q ? -1 : 1))
    .slice(0, SHELF.recent)
    .forEach((k) => {
      recent[k] = all[k];
    });
  const union = (key) => {
    const out = {};
    [obj(x[key]), obj(y[key])].forEach((o) =>
      Object.keys(o).forEach((id) => {
        out[id] = Array.from(new Set((out[id] || []).concat(Array.isArray(o[id]) ? o[id].map(String) : []))).sort();
      })
    );
    return sorted(out);
  };
  return {
    likes: sorted(later(x.likes, y.likes)),
    unlikes: sorted(later(x.unlikes, y.unlikes)),
    recent: sorted(recent),
    seen: union("seen"),
    ends: union("ends")
  };
}
/** 서재를 계정에도 올리는 날짜가 됐는지(이 기기의 날짜로 SHELF.syncFrom부터). @param {Date} [now] @returns {boolean} */
export function shelfSyncOn(now) {
  const p = SHELF.syncFrom.split("-").map(Number);
  return (now || new Date()) >= new Date(p[0], p[1] - 1, p[2]);
}
/** 찜한 작품인지. @param {string} id @returns {boolean} */
export const liked = (id) => (S.shelf.likes[id] || 0) > (S.shelf.unlikes[id] || 0);
const newestFirst = (o) => Object.keys(o).sort((p, q) => o[q] - o[p]);
/** 찜한 작품 id — 나중에 찜한 것 먼저. @returns {string[]} */
export const likedIds = () => newestFirst(S.shelf.likes).filter(liked);
/** 최근 본 작품 id — 방금 본 것 먼저. @returns {string[]} */
export const recentIds = () => newestFirst(S.shelf.recent);
function save() {
  S.shelf = mergeShelf(S.shelf);
  KV.set("shelf", S.shelf);
}
/** 찜 켜고 끄기 — 바뀐 뒤의 상태를 돌려줌. @param {string} id @returns {boolean} */
export function toggleLike(id) {
  const on = !liked(id);
  (on ? S.shelf.likes : S.shelf.unlikes)[id] = Math.max(Date.now(), (S.shelf.likes[id] || 0) + 1, (S.shelf.unlikes[id] || 0) + 1); // 시계가 같거나 뒤로 가도 방금 누른 쪽이 이기게
  save();
  return on;
}
/** 상세 페이지를 열 때 '최근 본 작품'에 적음(이미 맨 앞이면 그대로 — 같은 화면을 다시 그릴 때 저장을 되풀이하지 않게). @param {string} id */
export function touchRecent(id) {
  if (recentIds()[0] === id) return;
  S.shelf.recent[id] = Date.now();
  save();
}
/** 이 작품의 대화에서 본 그림 코드들("HSY3"·"MP1"…) — 도감의 수집 기록. @param {string} id @returns {Set<string>} */
export const seenSet = (id) => new Set(S.shelf.seen[id] || []);
/** 대화에 나온 그림 코드를 수집 기록에 더함 — 새 코드가 있을 때만 저장하고 true. @param {string} id @param {string[]} codes @returns {boolean} */
export function markSeen(id, codes) {
  const have = seenSet(id),
    add = codes.filter((k) => !have.has(k));
  if (!add.length) return false;
  S.shelf.seen[id] = (S.shelf.seen[id] || []).concat(add);
  save();
  return true;
}
/** 이 작품에서 본 결말 id들 — 에피소드형 작품의 '모은 결말'. @param {string} id @returns {Set<string>} */
export const endsSet = (id) => new Set((S.shelf.ends || {})[id] || []);
/** 결말을 본 것으로 적음(에피소드 방이 끝날 때 — ui/chat/generate.js). @param {string} id 작품 id @param {string} end 결말 id */
export function markEnding(id, end) {
  if (!end || endsSet(id).has(end)) return;
  S.shelf.ends = S.shelf.ends || {};
  S.shelf.ends[id] = (S.shelf.ends[id] || []).concat(end);
  save();
}
/** 이 기기의 서재를 비움(계정에는 보내지 않음) — 처음 로그인에서 '계정 것만 쓰기'를 골랐을 때. */
export function resetShelf() {
  S.shelf = mergeShelf();
  KV.setLocal("shelf", undefined);
}
