/* 상황 칸: 기본 0~14 + 직접 만든 칸(customSits — 내 칸과 작품 폴더에 실린 코드 표) + 내장 코드(DIMS: 1xx 감정/행동·4xx 의상·5xx 장소), 조합 키 이름·수위, 유저 입력 → 번호 점수(sitHints·dimPick) */
import { ageOK } from "../ai/adult.js";
import { CONTENT_CODES } from "../content/index.js";
import { RPG_ONLY_SITS, SIT } from "../core/constants.js";
import { S } from "../core/state.js";
import { KV } from "../core/storage.js";
import { DIMS, RESET, dimOf, freeNum, maxRating, parseCodes, usedNums } from "./codes.js";
import { dropMotionCodes } from "./motion.js";
import { sheetRating } from "./rating.js";
import { publishCommunity } from "../services/community.js";
import { IMG } from "../services/images.js";

/* 직접 추가하는 칸(S.settings.customSits = [{n, name, prompt, rating}]): 모든 인물에 공통.
   번호는 종류별 빈 번호(감정/행동 15~, 의상 410~, 장소 510~) 또는 목록으로 가져올 때 적은 세 자리 번호(100~599 — 같은 번호의 내장 코드를 덮음).
   성인 수위 칸은 성인 확인(ageOK) 때만 보이고, 대화에서는 성인 경로(unfilteredRoute)일 때만 AI에게 알려 줌.
   작품 폴더에 실린 코드 표(content/codes.json → CONTENT_CODES, shipped: true)는 모든 사용자에게 보이는 기본 칸이고, 같은 번호의 내 칸(customSits)이 있으면 그것이 덮는다.
   관리자 빌드는 여기에 관리자 전용 코드(EXTRA_CODES — admin/codes.js가 setExtraCodes로 꽂음, adminOnly: true)를 더 둔다. 우선순위: 내 칸 > 실린 표 > 관리자 전용 > 내장(DIMS) */
export const CUSTOM_BASE = SIT.length, CUSTOM_MAX = 200, CODE_MAX = 600;
export let EXTRA_CODES = []; // 관리자 전용 코드(사용자 빌드에서는 늘 빔)
export function setExtraCodes(v) { return (EXTRA_CODES = Array.isArray(v) ? v : []); }
/* 직접 만든 칸 전부(내 칸 + 실린 코드 표 + 관리자 전용, 번호가 겹치면 앞의 것). 관리자 도구의 '코드 표 내보내기'는 이 중 전체이용가·관리자 전용이 아닌 것만 codes.json으로 씀 */
export function allCustom() {
  const out = [...(S.settings.customSits || [])], has = new Set(out.map((d) => d.n));
  for (const d of [...CONTENT_CODES, ...EXTRA_CODES]) if (!has.has(d.n)) { out.push(d); has.add(d.n); }
  for (const d of out) if (!d.dim) d.dim = dimOf(d.n); // 직접 만든 칸·실린 코드는 dim이 없어 코드 표·조합 선택(dim으로 거름)에서 빠지던 것
  return out;
}
const customList = allCustom;
/* 칸 정의: 직접 만든 칸 → 내장 코드(DIMS). 기본 0~14는 null */
export function sitDef(n) { return n >= CUSTOM_BASE ? customList().find((d) => d.n === n) || DIMS[n] || null : null; }
export function sitName(n) { return SIT[n] || sitDef(n)?.name || "칸 " + n; }
/* 조합 키("3,404,501") → "부끄러움 · 오피스룩 · 침실" */
export function keyName(key) { return parseCodes(key).map(sitName).join(" · ") || SIT[1]; }
export const knownCodes = (codes) => codes.filter((n) => n < CUSTOM_BASE || !!sitDef(n)); // 모르는 번호(지운 칸 등)는 뺌
export function customSits() { return customList().filter((d) => d.rating === "safe" || ageOK()); }
/* 내장 코드 가운데 보이는 것(직접 만든 칸이 같은 번호를 덮으면 뺌) */
export function builtinSits() { const own = new Set(customList().map((d) => d.n)); return Object.values(DIMS).filter((d) => !own.has(d.n) && (d.rating === "safe" || ageOK())); }
/* 쓸 수 있는 칸 정의 전부(기본 0~14 제외, 번호 순). adult가 거짓이면 전체이용가만 — 대화 규칙(unfilteredRoute)·번호 후보에 씀 */
export function codeDefs(adult = ageOK()) { return [...customSits(), ...builtinSits()].filter((d) => d.rating === "safe" || adult).sort((a, b) => a.n - b.n); }
export const slotNums = () => [...SIT.keys(), ...customSits().filter((d) => d.n < 100).map((d) => d.n)]; // 슬롯 시트의 칸 격자(기본 + 직접 만든 감정/행동 칸). 세 자리 코드·조합은 조합 갤러리에
export function freeSitNum(dim = "act") { return freeNum(usedNums(customList()), dim); }
/* 번호들의 그림 수위: 기본 0~14는 그 작품의 시트 수위(기본 전체이용가), 그 밖은 칸 정의의 수위 — 가장 높은 것 */
export function codeRating(codes, c) { return maxRating(codes.map((n) => n < CUSTOM_BASE ? sheetRating(c.id) : (sitDef(n)?.rating || "safe"))); }
/* 이 작품이 쓰는 번호인지: RPG 전용 칸은 cat이 RPG인 작품에서만 AI 번호 목록·낱말 후보에 넣음. 이미 쓴 태그와 스튜디오에서 직접 고른 조합은 막지 않음 */
export const sitFits = (n, c) => RPG_ONLY_SITS.indexOf(n) < 0 || !!(c && c.cat === "RPG");
/* 상황 번호를 고르는 낱말(정규식 조각). AI가 그림을 빠뜨린 인물의 번호를 고를 때와, 유저 입력에서 번호 후보를 뽑을 때 씀 */
const SIT_KEYS = { 2: "웃|미소|싱긋|방긋|피식|킥킥|깔깔|농담|재밌", 3: "부끄|수줍|민망|얼굴이 (?:붉|빨개)|귀까지|빨개|장난|놀리|놀려|짓궂|칭찬|예쁘|예쁜|예뻐|귀여|귀엽",
  4: "울먹|울었|우는|눈물|슬프|슬퍼|흐느|서럽|그리워", 5: "놀라|놀란|깜짝|화들짝|헉|휘둥그|설마", 6: "화가|화를|화난|분노|노려|버럭|소리쳤|이를 악|짜증|열받|닥쳐",
  7: "삐졌|삐친|삐죽|토라|흥[,.!…]|볼을 부풀|서운|입을 내밀", 8: "무서|두려|겁에|겁먹|떨리|떨었|비명|공포|소름", 9: "다쳤|다친|부상|피를|피가|상처|쓰러",
  10: "치료|붕대|회복|응급", 11: "쉬자|쉬어|잠들|졸려|하품|휴식|기지개|낮잠", 12: "공격|휘둘|베었|베어|찔렀|쏘았|쐈|주먹|덤벼|전투|싸우",
  13: "각성|힘이 솟|눈빛이 변|폭주|기운이 치솟", 14: "설레|두근|심장이|가슴이 뛰|손을 잡|손잡|안아|포옹|고백|좋아해|데이트" };
// 추천 칸 이름별 낱말. 그 밖의 직접 만든 칸은 칸 이름 자체로(내장 코드는 keys로) 찾음
const SIT_KEYS_EXTRA = { 식사: "식사|밥|먹", 만남: "처음 뵙|반가워|반갑", 정색: "정색|굳은 얼굴|차갑게", 행복: "행복|기뻐|기쁘", 경계: "경계|의심|수상", 고민: "고민|생각에 잠|망설",
  지침: "지쳐|지친|피곤|녹초", 비웃음: "비웃|코웃음", 취함: "취했|취한|술잔|건배", 요리: "요리|부엌|앞치마", 게임: "게임", 카페: "카페|커피", 해변: "해변|바다|파도",
  놀이공원: "놀이공원|관람차", "밤 산책": "산책|밤길", 벚꽃: "벚꽃", 크리스마스: "크리스마스|성탄", "비 오는 날": "비가|우산|빗속", 영화관: "영화",
  손잡기: "손을 잡|손잡", 포옹: "안아|포옹|껴안|품에", 고백: "고백|좋아해|사랑해", 질투: "질투|샘이", 무릎베개: "무릎베개|무릎에 누", "키스 직전": "입술|입맞|키스", 잠옷: "잠옷|파자마", 수영복: "수영복|수영장" };
function sitKeys(n) {
  if (SIT_KEYS[n]) return SIT_KEYS[n];
  const d = sitDef(n); if (!d || !d.name.trim()) return "";
  return [SIT_KEYS_EXTRA[d.name.trim()], d.keys, d.name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")].filter(Boolean).join("|");
}
/* 글 속 낱말로 번호마다 점수(adult면 성인 수위 칸도 후보). 직접 만든 칸·내장 코드는 더 구체적이라 0.5 더함. 400·500(되돌리기)은 뽑지 않음 */
export function sitScores(text, adult, c) {
  const out = new Map(), s = String(text || "");
  if (!s.trim()) return out;
  for (const n of [...SIT.keys(), ...codeDefs(adult).map((d) => d.n)]) {
    if (n === RESET.wear || n === RESET.place || !sitFits(n, c)) continue;
    const k = sitKeys(n); if (!k) continue;
    const hits = (s.match(new RegExp(k, "g")) || []).length;
    if (hits) out.set(n, hits + (n >= CUSTOM_BASE ? 0.5 : 0));
  }
  return out;
}
/* 글에서 의상·장소 번호 하나씩(가장 많이 맞는 것). 없으면 null */
export function dimPick(text, adult, sc = sitScores(text, adult)) {
  const out = { wear: null, place: null }, best = { wear: 0, place: 0 };
  sc.forEach((v, n) => { const k = dimOf(n); if (k !== "act" && v > best[k]) { best[k] = v; out[k] = n; } });
  return out;
}
/* 유저 입력에 맞는 번호 후보: 감정/행동 둘("3 부끄러움") + 의상·장소("의상 404 오피스룩") — [이번 응답]에 붙여 AI가 고르게 */
export function sitHints(text, adult, c) {
  const sc = sitScores(text, adult, c), out = [...sc].filter(([n]) => dimOf(n) === "act").sort((a, b) => b[1] - a[1]).slice(0, 2).map(([n]) => n + " " + sitName(n));
  const d = dimPick(text, adult, sc);
  if (d.wear) out.push(`의상 ${d.wear} ${sitName(d.wear)}`);
  if (d.place) out.push(`장소 ${d.place} ${sitName(d.place)}`);
  return out;
}
/* 칸을 지우면 모든 인물에 저장된 그 칸의 그림(그 번호가 든 조합도)도 지움 */
export function dropSitImages(n) {
  const ns = [].concat(n), hit = (k) => parseCodes(k).some((x) => ns.indexOf(x) >= 0);
  const clean = (images) => Object.values(images || {}).forEach((m) => { if (!m) return; Object.keys(m).forEach((k) => { if (hit(k)) { IMG.drop(m[k]); delete m[k]; } }); });
  Object.values(S.imgpacks).forEach(clean); KV.set("imgpacks", S.imgpacks);
  S.mine.forEach((c) => clean(c.images)); KV.set("mine", S.mine);
  if (S.mine.some((c) => c.publish)) publishCommunity();
  dropMotionCodes(ns);
}
/** 지울 코드 번호가 든 그림 수(모든 작품·인물, 내 계정의 그림 칸만 — 작품 폴더에 실린 그림은 파일이라 그대로). @param {number[]} ns @returns {number} */
export function countSitImages(ns) {
  let n = 0;
  const walk = (images) => Object.values(images || {}).forEach((m) => Object.keys(m || {}).forEach((k) => { if (parseCodes(k).some((x) => ns.indexOf(x) >= 0)) n++; }));
  Object.values(S.imgpacks).forEach(walk); S.mine.forEach((c) => walk(c.images));
  return n;
}
