/* 감정 칸 0~14의 이름과 낱말 점수(순수): 유저 입력·지문 → 번호 후보(sitHints — [이번 응답]에 붙임, sitScores — 그림을 빠뜨린 인물의 번호 고르기) */
import { SIT } from "../core/constants.js";

/** 칸 번호 → 이름(모르는 번호는 1 기본). @param {number} n @returns {string} */
export function sitName(n) {
  return SIT[n] || SIT[1];
}
/* 칸을 고르는 낱말(정규식 조각). 12 공격은 맨손·무기 모두 */
const SIT_KEYS = {
  2: "웃|미소|싱긋|방긋|피식|킥킥|깔깔|농담|재밌|환희|기뻐|기쁘|신이 나|신나",
  3: "부끄|수줍|쑥스|머뭇|민망|얼굴이 (?:붉|빨개)|귀까지|빨개|장난|놀리|놀려|짓궂|칭찬|예쁘|예쁜|예뻐|귀여|귀엽",
  4: "울먹|울었|우는|눈물|슬프|슬퍼|흐느|오열|울음을 터|서럽|그리워",
  5: "놀라|놀란|깜짝|화들짝|헉|휘둥그|설마|경악|기겁|소스라",
  6: "화가|화를|화난|분노|노려|적대|버럭|소리쳤|이를 악|짜증|신경질|이마를 짚|성가|열받|닥쳐",
  7: "삐졌|삐친|삐죽|토라|흥[,.!…]|볼을 부풀|서운|입을 내밀|질투|샘이 나|샘나",
  8: "무서|두려|겁에|겁먹|떨리|떨었|비명|공포|소름",
  9: "다쳤|다친|부상|피를|피가|상처|쓰러",
  10: "치료|붕대|회복|응급",
  11: "쉬자|쉬어|잠들|졸려|하품|휴식|기지개|낮잠",
  12: "공격|휘둘|베었|베어|찔렀|쏘았|쐈|겨누|겨눠|겨눴|조준|방아쇠|사격|발사|총구|활시위|주먹|맨손|때렸|후려|걷어차|덤벼|전투|싸우",
  13: "각성|힘이 솟|눈빛이 변|폭주|기운이 치솟",
  14: "설레|두근|심장이|가슴이 뛰|손을 잡|손잡|안아|포옹|고백|좋아해|데이트"
};
const SIT_RE = Object.fromEntries(Object.entries(SIT_KEYS).map(([n, k]) => [n, new RegExp(k, "g")]));
/** 글 속 낱말로 칸 번호마다 점수(맞은 수). @param {string} text @returns {Map<number, number>} */
export function sitScores(text) {
  const out = new Map(),
    s = String(text || "");
  if (!s.trim()) return out;
  for (const n of Object.keys(SIT_RE)) {
    const hits = (s.match(SIT_RE[n]) || []).length;
    if (hits) out.set(+n, hits);
  }
  return out;
}
/** 유저 입력에 맞는 번호 후보 둘("3 부끄러움") — [이번 응답]에 붙여 AI가 고르게. @param {string} text @returns {string[]} */
export function sitHints(text) {
  return [...sitScores(text)]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([n]) => n + " " + sitName(n));
}
