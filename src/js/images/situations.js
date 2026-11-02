/* 상황 칸: 기본 0~14 + 직접 만든 칸(customSits), 유저 입력 → 상황 번호 점수(sitHints) */
import { ageOK } from "../ai/adult.js";
import { SIT } from "../core/constants.js";
import { S } from "../core/state.js";
import { KV } from "../core/storage.js";
import { IMG } from "../services/images.js";
import { publishCommunity } from "../ui/studio.js";

/* 직접 추가하는 이미지 칸(S.settings.customSits = [{n, name, prompt, rating}]): 모든 인물에 공통, 번호는 15부터.
   성인 수위 칸은 성인 확인(ageOK) 때만 보이고, 대화에서는 성인 경로(unfilteredRoute)일 때만 AI에게 알려 줌 */
export const CUSTOM_BASE = SIT.length, CUSTOM_MAX = 60;
export function sitDef(n) { return n >= CUSTOM_BASE ? (S.settings.customSits || []).find((d) => d.n === n) || null : null; }
export function sitName(n) { return SIT[n] || sitDef(n)?.name || "칸 " + n; }
export function customSits() { return (S.settings.customSits || []).filter((d) => d.rating === "safe" || ageOK()); }
export const slotNums = () => [...SIT.keys(), ...customSits().map((d) => d.n)];
 // 슬롯 시트에 보이는 칸 번호
/* 상황 번호를 고르는 낱말(정규식 조각). AI가 그림을 빠뜨린 인물의 번호를 고를 때와, 유저 입력에서 번호 후보를 뽑을 때 씀 */
const SIT_KEYS = { 2: "웃|미소|싱긋|방긋|피식|킥킥|깔깔|농담|재밌", 3: "부끄|수줍|민망|얼굴이 (?:붉|빨개)|귀까지|빨개|장난|놀리|놀려|짓궂|칭찬|예쁘|예쁜|예뻐|귀여|귀엽",
  4: "울먹|울었|우는|눈물|슬프|슬퍼|흐느|서럽|그리워", 5: "놀라|놀란|깜짝|화들짝|헉|휘둥그|설마", 6: "화가|화를|화난|분노|노려|버럭|소리쳤|이를 악|짜증|열받|닥쳐",
  7: "삐졌|삐친|삐죽|토라|흥[,.!…]|볼을 부풀|서운|입을 내밀", 8: "무서|두려|겁에|겁먹|떨리|떨었|비명|공포|소름", 9: "다쳤|다친|부상|피를|피가|상처|쓰러",
  10: "치료|붕대|회복|응급", 11: "쉬자|쉬어|잠들|졸려|하품|휴식|기지개|낮잠", 12: "공격|휘둘|베었|베어|찔렀|쏘았|쐈|주먹|덤벼|전투|싸우",
  13: "각성|힘이 솟|눈빛이 변|폭주|기운이 치솟", 14: "설레|두근|심장이|가슴이 뛰|손을 잡|손잡|안아|포옹|고백|좋아해|데이트" };
// 추천 칸 이름별 낱말. 그 밖의 직접 만든 칸은 칸 이름 자체로 찾음
const SIT_KEYS_EXTRA = { 식사: "식사|밥|먹", 만남: "처음 뵙|반가워|반갑", 정색: "정색|굳은 얼굴|차갑게", 행복: "행복|기뻐|기쁘", 경계: "경계|의심|수상", 고민: "고민|생각에 잠|망설",
  지침: "지쳐|지친|피곤|녹초", 비웃음: "비웃|코웃음", 취함: "취했|취한|술잔|건배", 요리: "요리|부엌|앞치마", 게임: "게임", 카페: "카페|커피", 해변: "해변|바다|파도",
  놀이공원: "놀이공원|관람차", "밤 산책": "산책|밤길", 벚꽃: "벚꽃", 크리스마스: "크리스마스|성탄", "비 오는 날": "비가|우산|빗속", 영화관: "영화",
  손잡기: "손을 잡|손잡", 포옹: "안아|포옹|껴안|품에", 고백: "고백|좋아해|사랑해", 질투: "질투|샘이", 무릎베개: "무릎베개|무릎에 누", "키스 직전": "입술|입맞|키스", 잠옷: "잠옷|파자마", 수영복: "수영복|수영장" };
function sitKeys(n) {
  if (SIT_KEYS[n]) return SIT_KEYS[n];
  const d = sitDef(n); if (!d || !d.name.trim()) return "";
  return [SIT_KEYS_EXTRA[d.name.trim()], d.name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")].filter(Boolean).join("|");
}
/* 글 속 낱말로 상황 번호마다 점수(adult면 성인 수위 칸도 후보). 직접 만든 칸은 더 구체적이라 0.5 더함 */
export function sitScores(text, adult) {
  const out = new Map(), s = String(text || "");
  if (!s.trim()) return out;
  for (const n of [...SIT.keys(), ...customSits().filter((d) => d.rating === "safe" || adult).map((d) => d.n)]) {
    const k = sitKeys(n); if (!k) continue;
    const hits = (s.match(new RegExp(k, "g")) || []).length;
    if (hits) out.set(n, hits + (n >= CUSTOM_BASE ? 0.5 : 0));
  }
  return out;
}
/* 유저 입력에 맞는 상황 번호 후보 두 개("3 부끄러움") — [이번 응답]에 붙여 AI가 고르게 */
export function sitHints(text, adult) { return [...sitScores(text, adult)].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([n]) => n + " " + sitName(n)); }
/* 칸을 지우면 모든 인물에 저장된 그 칸의 그림도 지움 */
export function dropSitImages(n) {
  const clean = (images) => Object.values(images || {}).forEach((m) => { if (m && m[n]) { IMG.drop(m[n]); delete m[n]; } });
  Object.values(S.imgpacks).forEach(clean); KV.set("imgpacks", S.imgpacks);
  S.mine.forEach((c) => clean(c.images)); KV.set("mine", S.mine);
  if (S.mine.some((c) => c.publish)) publishCommunity();
}
