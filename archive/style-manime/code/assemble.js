/* 남성향 애니 화풍(manime)의 프롬프트 조립 — 작품 데이터(cast[]·places[])를 칸에 끼워 긍정·부정 프롬프트와 생성 값을 만든다.
   인물마다 따로 손대지 않는다: 눈매·성격·나이·옷 낱말처럼 작품에 적힌 값에 따라 규칙이 갈린다. 값의 뜻과 정한 경위는 ../README.md.
   profileJob(인물, 장소) → 프로필(칸 0) · emotionJob(인물, 장소, 칸 1~14) → 감정 그림. 앱은 이 파일을 쓰지 않는다(그림은 앱 밖에서 만듦)
   v9(2026-11-19): 가볍고 만화 같던 v8을 반실사 만화 마감으로 바꿈 — 마감(FIN)·빛(BG)·얼굴(FACE_*·SKIN)·기본 표정(CALM)·정면 구도(FRAME)·후처리(POST). 견본은 ../samples */

import { TEMPER_EMO, LEAD_EMO } from "./expressions.js";
import { policyOf, liftOf, relax, MINOR_NEG } from "./exposure.js";
// 노출 수위를 정하는 값(늘 넣는 노출 네거티브·긴소매·옷 태그가 푸는 것)과 그리기 전 검사는 exposure.js — 여기서는 고른 정책(P)의 값을 제자리에 끼운다
export { assertSafe, assertAdult, policyOf } from "./exposure.js";

export const MODEL = { air: "civitai:967405@1428332", name: "Nova Orange XL v6.0", steps: 28, cfg: 4, scheduler: "Euler a" };
/* 크기는 64의 배수(Runware) — 프로필 768×1152(2:3), 감정 1024×1024. 첫 그림을 hires 크기로 키워 같은 프롬프트로 다시 그린다(strength 0.4) */
export const SIZE = {
  profile: { width: 768, height: 1152, hires: { w: 1152, h: 1728, strength: 0.4 } },
  emotion: { width: 1024, height: 1024, hires: { w: 1536, h: 1536, strength: 0.4 } },
};
/* 후처리(post.js): 채도·대비만 아주 조금 + 옅은 부드러운 초점. v8의 빛 번짐·연보라빛은 뺌(견본은 후처리 없이 그린 그림) */
export const POST = { filter: "saturate(1.04) contrast(1.06)", blurK: 3, blurA: 0.12 };
/* 감정 그림의 후처리: 대비를 더 올리고 조금 어둡게(얼굴 그늘과 가장자리 빛이 살게 — 사용자 2026-11-20 '너무 밝고 평평함') */
export const POST_EMOTION = { filter: "saturate(1.05) contrast(1.12) brightness(0.96)", blurK: 3, blurA: 0.12 };

const Q = "masterpiece, best quality, amazing quality, very aesthetic, absurdres";
const SUBJ = {
  f: "1girl, solo, (adult woman:1.2), (mature female:0.45), (beautiful woman:1.3)",
  m: "1boy, solo, (adult man:1.3), (mature male:0.4), (handsome:1.35)",
  elder: "1boy, solo, (adult man:1.3), (mature male:0.85), (handsome:1.35)", // 서른 넘은 남자 — 더 성숙하게(0.5에서는 35세가 스물 중반처럼 나옴 — 2026-11-20)
};
/* 마감: 반실사 만화(웹소설 표지) 칠 — 머리카락 결·얼굴 묘사·사실적인 명암. v8의 옅은 피부·가는 선·선명한 색(만화 같은 인상)은 뺌 */
const FIN =
  "(shiny hair:1.1), (hair strands:1.4), (detailed hair:1.3), (detailed face:1.3), (detailed skin:0.9), (semi-realistic:1.15), (manhwa:1.0), (digital painting:1.2), " +
  "(painterly:1.1), (realistic shading:1.0), (soft skin shading:1.0), (depth of field:1.1), (bokeh:0.7), (sharp focus:0.9)";
/* 몸: 여성은 가녀리게(가슴·허리 문구 대신 slender·slim). 소매 길이는 옷 설정대로(2026-11-26까지 붙이던 긴소매 강제는 뺌 — exposure.js) */
const BODY = { f: { profile: "slender, (slim:1.1)", emotion: "slender, (slim:1.2)" }, m: "slender, (bishounen:1.0)", elder: "(broad shoulders:0.5), (bishounen:0.5)" };
/* 남성의 감정 그림 비율: 어깨가 넓고 머리가 작게(류건이 기준 — 사용자 2026-11-13). 태그에 broad shoulders가 없는 인물에만 붙인다. 프로필은 얼굴 구도라 그대로 */
const SHOULDERS = "(broad shoulders:1.1)";
const BODY_M_EMOTION = { m: "slender, (bishounen:1.0)", elder: "slender, (bishounen:0.5)" };
const NEG_PROPORTION = ", (large head:1.3), (narrow shoulders:1.2)";
// 남자의 놀람·공포 — 이 악문 입과 이마 주름을 막음(성숙한 얼굴에서 과장돼 보임 — 사용자 2026-11-13)
// + 크게 뜬 둥근 눈과 얼굴 클로즈업은 성인 남자를 앳돼 보이게 함(카일 공포·카엘 놀람 — 2026-11-20) → 막음
const NEG_CALM_M = ", (forehead wrinkles:1.3), (clenched teeth:1.1), (round eyes:1.3), (big eyes:1.3), (close-up:1.3), (face focus:1.1)";
const FRAME = {
  // 정면샷(사용자 2026-11-19) — 위에서 내려다보는 각도를 뺌
  profile: "(fully clothed:1.2), (close-up:1.0), (portrait:1.2), (head tilt:0.8), (facing viewer:1.0), looking at viewer",
  emotion: "(fully clothed:1.2), (standing:1.0), (upper body:1.1), (head tilt:0.5), (facing viewer:1.0), looking at viewer",
};
const LOOK = { away: "(looking away:0.9)", down: "(looking down:0.5)" };
const BG = {
  profile: "(dim lighting:0.7), (cinematic lighting:1.1), (rim light:0.9), (dark background:1.1), (black background:0.6), (gradient background:0.8), simple background",
  // 감정 그림: 얼굴 그늘·가장자리 빛을 올리고 배경은 조금 어둡게(2026-11-20 — 처음 판은 '너무 밝고 평평', 더 어둡게 한 판은 '배경이 너무 어두움' → 그 중간). 낮 장소는 맨 앞의 dim lighting을 뺌
  emotion:
    "(dim lighting:0.8), (cinematic lighting:1.2), (dramatic lighting:0.9), (chiaroscuro:1.0), (side lighting:0.9), (shadow on face:0.5), (rim light:1.2), (backlighting:0.7), " +
    "(deep shadows:0.6), (high contrast:0.5), (low key:0.3), (dark background:0.4), (dim lighting:0.3)",
};

/* ── 얼굴 ── 여성: 공통 문구 + 눈매 규칙(작품 태그의 눈매 낱말) / 남성: 고운 미남, 서른 넘으면 턱선을 굵게 */
const FACE_F =
  "(long eyelashes:1.2), (eyeliner:0.5), (detailed eyes:1.2), (detailed iris:1.2), (blush:0.3), (glossy lips:0.9), (detailed nose:0.4), (beautiful detailed face:1.2), (delicate features:0.7)";
const EYES_M = "(half-closed eyes:0.9), (jitome:0.6), (tsurime:0.5)";
const FACE_M_MORE = "(thick eyebrows:0.4), (detailed nose:0.6), (lips:0.8), (hair between eyes:0.8), (handsome detailed face:1.1)";
const FACE_M = {
  profile: "(long eyelashes:0.6), (detailed eyes:1.2), (detailed iris:1.2), (pupils:0.8), (sharp jawline:0.6), " + FACE_M_MORE,
  emotion: "(long eyelashes:0.6), (detailed eyes:1.2), (detailed iris:1.2), (pupils:0.8), (sharp jawline:0.6), " + FACE_M_MORE,
};
const elderFace = (s) => s.replace("(long eyelashes:0.6), ", "").replace("(sharp jawline:0.6)", "(sharp jawline:0.95)");
/* 모든 칸의 얼굴에 더하는 것: 젊은 성인의 맑은 피부, 또렷한 눈동자, 입술 색('어리기보다 잘생김·예쁨 쪽으로' — 사용자 2026-11-16) */
// (youthful)은 뺌(2026-11-20) — 얼굴을 어린 쪽으로 끌고 네거티브의 (young:1.1)과 부딪침. 사용자의 나중 방향도 '어리기보다 잘생김·예쁨 쪽으로'
const SKIN = "(young adult:1.0), (beautiful eyes:0.9), (flawless skin:0.9), (clear skin:0.7), (beautiful detailed eyes:1.2), (eye reflection:0.7), (eyelashes:0.7)";
/** 서른 넘은 남자는 '젊은 성인' 대신 성숙한 인상 */
const skinOf = (tier) => (tier === "elder" ? SKIN.replace("(young adult:1.0), ", "(mature:0.5), (30 years old:0.6), ") : SKIN);
const LIPS = { f: "(pink lips:0.7), (lip gloss:0.6)", m: "(pale pink lips:0.4)" };
const EYE_RULE = [
  [/droopy eyes/, { eyes: "(tareme:0.8), (half-closed eyes:0.5)", emo: "(gentle smile:0.9), closed mouth" }],
  [/round eyes/, { eyes: "(half-closed eyes:0.2)", emo: "(smile:0.9), (parted lips:0.5)" }],
  [/upturned eyes/, { eyes: "(half-closed eyes:0.7), (tsurime:0.4)", emo: "(seductive smile:0.6), (parted lips:0.4)" }],
  [/narrow eyes/, { eyes: "(half-closed eyes:0.8), (jitome:0.4)", emo: "(light smile:0.5), closed mouth, (calm:0.6)" }],
  [/sharp eyes/, { eyes: "(half-closed eyes:0.6), (tsurime:0.3)", emo: "(smirk:0.5), closed mouth" }],
];
const EYE_DEFAULT = { eyes: "(half-closed eyes:0.6)", emo: "(light smile:0.7), (parted lips:0.4)" };
const eyeRule = (tags) => (EYE_RULE.find(([re]) => re.test(tags)) || [0, EYE_DEFAULT])[1];

/* ── 성격 → 기본 표정·손동작(칸 0·1) ── cast[].temper 값 그대로(작품이 정함). 값이 없으면 눈매 규칙의 기본 표정.
   성격 글(desc)의 낱말로 짐작하던 규칙은 없앴다 — 잘못 가릴 수 있었음('약초에 밝고' → 해맑음).
   TEMPERS의 키 여덟 개가 곧 temper 칸의 값 목록(빌드의 작품 검사와 같아야 함) */
/* v9의 기본 표정(사용자 2026-11-16): 여자는 살짝 미소 지은 채 눈을 가늘게 뜸 / 남자는 웃지 않고 입술을 다문 채 내려다봄 — 귀여운 인상(장난·해맑음·수줍음·다정)의 남자는 눈을 갸름하게 뜨고 눈길을 부드럽게.
   성격마다 달랐던 v8의 표정(비웃음·이 드러낸 웃음 등)은 뺌 — 성격은 남자의 두 갈래와 여자의 손동작만 가름 */
const CALM = {
  f: "(light smile:0.9), (closed mouth:1.0), (half-closed eyes:0.8), (narrow eyes:0.6)",
  m: "(closed mouth:1.2), (expressionless:0.5), (half-closed eyes:0.8), (narrow eyes:0.9), (looking down at viewer:0.9)",
  mSoft: "(closed mouth:1.1), (half-closed eyes:0.7), (narrow eyes:0.9), (soft gaze:0.8)",
};
export const TEMPERS = {
  도도: { f: CALM.f, m: CALM.m, hand: "(hand on own chin:0.6)" },
  장난: { f: CALM.f, m: CALM.mSoft, hand: "(finger to mouth:0.7)" },
  해맑음: { f: CALM.f, m: CALM.mSoft, hand: "(waving:0.5)" },
  수줍음: { f: CALM.f, m: CALM.mSoft, hand: "(own hands together:0.8)" },
  다정: { f: CALM.f, m: CALM.mSoft, hand: "(hand on own chest:0.6)" },
  냉소: { f: CALM.f, m: CALM.m, hand: "(head rest:0.5)" },
  곧음: { f: CALM.f, m: CALM.m, hand: "" },
  차가움: { f: CALM.f, m: CALM.m, hand: "(tucking hair:0.6)" },
};
export const temperOf = (c) => (c.temper && TEMPERS[c.temper] ? c.temper : "");
const PROP_HAND = [[/glasses|eyewear/, "(adjusting eyewear:0.9)"], [/folding fan|\bfan\b/, "(holding fan:0.9)"]]; // 소품이 있으면 그 손동작이 먼저
/** 기본 표정(칸 0·1)과 눈 모양. 남자는 손동작을 넣지 않는다(소품만) */
export function charm(c) {
  const g = isFem(c) ? "f" : "m", p = TEMPERS[temperOf(c)], eye = eyeRule(c.tags), prop = PROP_HAND.find(([re]) => re.test(c.tags));
  const hand = prop ? prop[1] : p && g === "f" ? p.hand : "";
  return { emo: (p ? p[g] : CALM[g]) + (hand ? ", " + hand : ""), eyes: eye.eyes }; // 성격이 없으면 같은 기본 표정
}

/* ── 감정 칸 2~14 ── 눈(없으면 눈매 규칙)·표정과 손동작·시선·만화 기호. 칸의 뜻은 앱의 src/js/images/situations.js */
const both = (s) => ({ f: s, m: s });
const WEAPON = /rapier|sword|pistol|revolver|rifle|dagger|baton|staff|shield|gun/;
export const EMOTIONS = {
  2: { name: "웃음", eyes: { f: "(half-closed eyes:0.2)", m: "(half-closed eyes:0.4)" }, sym: "(sparkle:0.9)",
    emo: { f: "(smile:1.4), (:d:1.0), (open mouth:0.9), (laughing:0.9), (happy:1.0), (hand on own chest:0.6)", m: "(smile:1.3), (open mouth:0.7), (laughing:0.6), (happy:0.9)" } },
  3: { name: "부끄러움", look: "away", sym: "(flying sweatdrops:1.2)",
    emo: { f: "(embarrassed:1.3), (shy:1.0), (blush:1.7), (full-face blush:0.6), (wavy mouth:0.7), (hand on own cheek:0.9)", m: "(embarrassed:1.2), (blush:1.1), (wavy mouth:0.5), (scratching head:0.8)" } },
  4: { name: "슬픔", look: "down", eyes: both("(half-closed eyes:0.5)"), neg: ", (streaming tears:1.2), (sobbing:1.1)", // 눈물이 맺힌 정도
    emo: { f: "(sad:1.3), (tearing up:1.4), (teary eyes:1.2), (tears:1.0), (frown:0.8), closed mouth, (hand on own chest:0.6)", m: "(sad:1.2), (tearing up:1.2), (teary eyes:1.0), (tears:0.7), (frown:0.8), closed mouth" } },
  5: { name: "놀람", eyes: { f: "(wide-eyed:1.2)", m: "(wide-eyed:0.6), (pupils:1.0)" }, sym: "(^^^:1.1)", neg: ", (day:1.2), (blue sky:1.1)", negM: NEG_CALM_M,
    emo: { f: "(surprised:1.4), (open mouth:1.0), (raised eyebrows:0.8), (hands up:0.6)", m: "(surprised:1.3), (open mouth:0.5), (raised eyebrows:0.8)" } },
  6: { name: "분노", eyes: both("(glaring:1.0), (v-shaped eyebrows:1.1)"), hard: true, lowBlush: true, sym: "(anger vein:1.4)", emo: both("(angry:1.4), (frown:1.2), (clenched teeth:0.9), (crossed arms:0.8)") },
  7: { name: "삐침", look: "away", sym: "(anger vein:0.8), (squiggle:0.9)",
    emo: { f: "(pout:1.3), (puffed cheeks:0.9), (annoyed:0.9), (crossed arms:0.9)", m: "(annoyed:1.1), (frown:0.9), (pout:0.5), closed mouth, (crossed arms:0.9)" } },
  8: { name: "공포", eyes: { f: "(wide-eyed:1.1)", m: "(wide-eyed:0.8), (pupils:1.0)" }, lowBlush: true, sym: "(sweatdrop:1.1)", negM: NEG_CALM_M,
    emo: { f: "(scared:1.4), (trembling:0.9), (sweat:0.9), (turn pale:0.7), (open mouth:0.6), (hands on own chest:0.8)", m: "(scared:1.2), (sweat:0.9), (turn pale:0.5), (parted lips:0.8), (raised eyebrows:0.6)" } },
  9: { name: "부상", eyes: both("(one eye closed:0.9)"), lowBlush: true, neg: ", blood, gore", // 팔 붕대는 소매를 걷게 해 겉옷이 사라짐 → 머리·볼·손
    emo: both("(pain:1.2), (grimace:0.9), (injury:0.9), (bandaged head:1.2), (bandaid on cheek:1.1), (bandaged hand:1.1), (holding own arm:1.0)") },
  10: { name: "회복", emo: both("(relieved:1.1), (gentle smile:1.1), closed mouth, (bandaid on cheek:1.1), (bandaged hand:0.9)") },
  11: { name: "휴식", eyes: both("(closed eyes:1.4)"), noEyeColor: true, sym: "(zzz:1.0)", neg: ", (open eyes:1.2), (pajamas:1.2), (bed:1.2), (pillow:1.2), (sleeping:1.0)", // sleeping은 잠옷·눕기를 부름
    face: { f: "(long eyelashes:1.2), (blush:0.4), (glossy lips:0.9)", m: "(long eyelashes:0.6), (sharp jawline:0.6)" },
    emo: both("(dozing:0.9), (relaxed:0.9), (light smile:0.5), closed mouth, (head tilt:0.9)") },
  12: { name: "공격", eyes: both("(glaring:0.8)"), hard: true, lowBlush: true, armed: true, // 이 칸만 무기를 듦(없으면 주먹)
    emo: (c) => "(serious:1.2), (fighting stance:1.0), (clenched teeth:0.5), " + (WEAPON.test(c.tags) ? "(holding weapon:1.1)" : "(clenched fist:1.0)") },
  13: { name: "각성", eyes: both("(glowing eyes:1.5)"), hard: true, lowBlush: true,
    emo: both("(serious:1.0), (aura:1.2), (electricity:0.9), (floating hair:1.2), (light particles:0.9), (outstretched hand:0.9)") },
  14: { name: "설렘", eyes: { f: "(half-closed eyes:0.5)", m: "(half-closed eyes:0.8)" }, sym: "(heart:1.6), (spoken heart:0.9)",
    emo: { f: "(blush:1.7), (light smile:1.0), (parted lips:0.6), (hand on own chest:1.0)", m: "(blush:0.9), (light smile:0.9), (hand on own neck:0.6)" } },
};

/* ── 네거티브 ── */
const NEG_BASE = (g, P) =>
  [
    "lowres, bad anatomy, bad hands, text, error, missing fingers, extra digits, fewer digits, cropped, worst quality, low quality, signature, watermark, username, jpeg artifacts", // 품질
    MINOR_NEG, // 미성년 금지 — 늘 넣음(어느 트랙에서도)
    P.neg.base, // 노출·달라붙는 옷(노출 정책)
    "(wide shot:1.1), (full body:1.1), feet, knees, (thick thighs:1.1)", // 구도·과장
    "(thick lineart:1.1), (thick outlines:1.2), sketch, (cartoon:1.1), (anime screencap:1.1), (cel shading:1.1), (flat color:1.1), 3d, realistic, photorealistic", // 화풍
    g === "f" ? "(big head:1.2)" : "(big head:1.2), round face", // 성인 인상(여성은 부드러운 얼굴형을 두려고 round face를 막지 않음)
    "neon lights, (dark-skinned female:1.2), (dark-skinned male:1.2), tan, (blue skin:1.2), (grey skin:1.2)", // 색·피부
    "multiple girls, multiple boys, 2girls, 2boys, crowd, people, (from below:1.2), (latex:1.1)", // 혼자
  ].join(", ");
const NEG_F = ", (old:1.2), (middle-aged:1.2), (wrinkles:1.2), nasolabial folds, eye bags";
const NEG_M = ", facial hair, beard, stubble, old man, (wrinkles:1.1), (old:1.2), (middle-aged:1.2), burly, (young boy:1.3), (shota:1.4), (long hair:1.2)";
const NEG_LINE = ", (thick outlines:1.4), (bold lineart:1.2), (black outline:1.2)";
// v9: 만화 같은 칠·큰 눈·빛나는 눈을 막음(반실사 만화 마감). 여성의 굴곡 과장과 드러난 어깨·팔, 남성의 풀어 헤친 셔츠는 노출 정책(neg.f·neg.m)
const NEG_FLAT = ", (flat color:1.2), (cel shading:1.3), (anime screencap:1.3), (cartoon:1.2), (big eyes:1.2), (moe:1.2), (glowing eyes:1.2), (harsh shadows:1.1), (from behind:1.3)";
// 기본 표정 칸(0·1)에서만: 감은 눈·둥근 눈·벌린 입(남자는 웃음도)을 막음 — 감정 칸은 그 표정을 써야 하므로 넣지 않음
const NEG_CALM = {
  f: ", (closed eyes:1.4), (sleeping:1.3), (round eyes:1.2), (open mouth:1.2), (teeth:1.2), (grin:1.2)",
  m: ", (closed eyes:1.4), (sleeping:1.3), (large eyes:1.3), (round eyes:1.2), (open mouth:1.2), (teeth:1.2), (grin:1.2), (smile:1.2), (smirk:1.3)",
};
const NEG_SOFT = ", (glaring:1.2), (angry:1.1), (sanpaku:1.1)"; // 여성 — 노려보는 눈 막기(분노·공격·각성 칸은 뺌)
const NEG_LEAN = ", (leaning forward:1.2), (bent over:1.2)";
const NEG_POSE = ", (sitting:1.3), (leaning forward:1.2), (bent over:1.2), (lying:1.2), (desk:0.8), (leaning on table:1.2), (arms on table:1.2), (arm support:1.1), (elbow rest:1.1)";
const NEG_ARMS = ", (holding gun:1.2), (holding weapon:1.1), (aiming:1.2)";
const NEG_DAY = ", (day:1.2), (daylight:1.1), (blue sky:1.1)";
const NEG_HAIR_BLEED = ", (multicolored hair:1.2), streaked hair, colored inner hair, gradient hair"; // 눈색 가중이 높아 눈색이 머리로 번짐
// 감정 그림: 밝게 날아간 그림·옷의 글자
const NEG_LIGHT = ", (overexposed:1.3), (flat lighting:1.3), (washed out:1.2), (bright:1.1), (white sky:1.2), (white background:1.3)";
const NEG_TEXT = ", (text on clothes:1.3), (logo:1.3), (text:1.4)";
const NEG_TRAIN = ", (train:1.3), (locomotive:1.3), (railroad tracks:1.2)";
// 물가 장소의 젖은 옷, 누더기 옷의 찢어진 자리를 막는 네거티브는 노출 정책(neg.wet·neg.torn)
const NEG_SHORT_CAPE = ", (capelet:1.4), (short cape:1.3), (shoulder cape:1.3)";
const TWO_TONE = /multicolored hair|streaked hair|gradient hair|two-tone hair|colored inner hair/;

/* ── 인물 칸 ── 작품 태그 그대로 ×1.1, 눈색 ×1.0, 수염 ×0.7 + 앞머리·속옷 규칙 */
export const isFem = (c) => (c.gender ? c.gender === "f" : !/남성/.test(c.look || ""));
/** 겉보기 나이: cast[].age(정수)가 있으면 그 값, 없으면 look 글의 'N세' */
export const ageOf = (c) => (Number.isInteger(c.age) ? c.age : Number((/(\d+)세/.exec(c.look || "") || [0, 0])[1]));
/** 남자의 나이대: 겉보기 나이가 30 이상이면 "elder"(성숙한 얼굴·가르마), 아니면 "m" */
export const tierOf = (c) => (isFem(c) ? "f" : ageOf(c) >= 30 ? "elder" : "m");
const EYE_SHAPE = /sharp|round|bright|narrow|droopy|upturned|tired|half-closed|closed/;
const FACIAL = /^(stubble|beard|mustache|goatee|facial hair)$/;
const CLOTH = /jacket|coat|uniform|cloak|cardigan|shirt|dress|hanbok|robe|pants|jeans|skirt|turtleneck|suit|armor|vest/;
/* 눈색은 덜 선명하게(v8은 1.4) · 수염과 흉터는 또렷이(설정인데 안 보였음 — 2026-11-20) · boost: 감정 그림에서 옷 낱말을 세게(칸마다 옷 색이 바뀌던 것을 줄임) */
const weight = (t, boost) => (/ eyes$/.test(t) && !EYE_SHAPE.test(t) ? 1.0 : FACIAL.test(t) ? 1.3 : /\bscar\b/.test(t) ? 1.4 : boost && CLOTH.test(t) ? 1.25 : 1.1);
const castTags = (tags, boost) => tags.split(", ").map((t) => `(${t}:${weight(t, boost)})`).join(", ");
/* 앞머리: 이마를 드러내는 인물(forehead)은 가운데 가르마, 이미 앞머리가 있으면 그대로, 그 밖은 눈을 덮는 앞머리(여)·시스루 앞머리(남)·가르마(서른 넘은 남자) */
const PART = "(hair parted in the middle:1.1), (center parting:1.0)";
const NEG_PART = ", (swept bangs:1.2), (side-swept bangs:1.2), (asymmetrical bangs:1.1), (hair slicked back:1.1)";
const BANGS = {
  f: { add: "(blunt bangs:1.0), (long bangs:0.9), (eyes visible through hair:1.1)", neg: ", (forehead:1.2), (parted bangs:1.1), (swept bangs:1.2), (hair slicked back:1.1), (short bangs:1.2)" },
  m: { add: "(see-through bangs:1.2), (blunt bangs:0.6)", neg: ", (forehead:1.2), (swept bangs:1.2), (hair slicked back:1.1)" },
  elder: { add: "(hair parted in the middle:0.9), (curtained hair:0.8)", neg: ", (hair slicked back:1.1)" },
};
const SWEPT = /^(side-swept bangs|swept bangs|parted bangs|asymmetrical bangs|hair slicked back)$/;
const OWN_BANGS = /blunt bangs|curtain bangs|hair over one eye|hair between eyes|hime cut/;
// 이마가 벗어진 머리 — 앞머리·가르마 규칙을 넣지 않고 이마를 드러낸다(가르마가 이마를 덮어 58세가 서른처럼 나옴 — 2026-11-24)
const BARE_BROW = /receding hairline|balding|\bbald\b/;
const NEG_BARE_BROW = ", (bangs:1.2), (hair between eyes:1.2), (curtained hair:1.1)";
function hairRule(tags, tier) {
  const ts = tags.split(", ");
  if (BARE_BROW.test(tags)) return { tags, add: "(forehead:1.1)", neg: NEG_BARE_BROW };
  if (ts.includes("forehead")) return { tags: ts.filter((t) => !/^(side-swept bangs|swept bangs)$/.test(t)).join(", "), add: PART, neg: NEG_PART };
  if (OWN_BANGS.test(tags)) return { tags, add: "", neg: "" };
  return { tags: ts.filter((t) => !SWEPT.test(t)).join(", "), ...BANGS[tier] };
}
const HAIR_ALL = "(messy hair:0.7), (floating hair:0.4)";
const HAIR_LENGTH = /short hair|long hair|ponytail|braid|bun|bob cut|hair up|updo/; // 남자는 머리 길이 낱말이 없으면 짧은 머리
const OUTER = /cardigan|coat|jacket|cape|cloak|blazer/;
const TOP = /shirt|blouse|turtleneck|sweater|uniform|suit|dress|hanbok|jeogori|hanfu|robe|kimono|vest|overalls|top/;
const BOTTOM_TAG = /(^| )(pants|skirt|jeans|shorts|trousers|leggings)$/; // 프로필은 하의가 안 보임 — 두면 하의 색이 윗옷에 번짐
const WEAPON_TAG = /rapier|sword|pistol|revolver|rifle|dagger|baton|staff|shield|gun\b|dual wielding/; // 공격 칸 말고는 무기 낱말을 뺌(손은 손동작에)
/* 속옷 층: 태그에 적혀 있으면 그대로. 정장·카디건인데 셔츠가 없으면 흰 셔츠, 겹옷깃 옷(한푸·도복·로브)인데 속옷이 없으면 흰 속옷(감정 그림) */
const inner = (tags) =>
  /suit|cardigan|blazer/.test(tags) && !/shirt|blouse|turtleneck|sweater/.test(tags)
    ? tags + ", white shirt"
    : /hanfu|martial arts uniform|robe/.test(tags) && !/undershirt|shirt/.test(tags)
      ? tags + ", white undershirt"
      : tags;
/** 인물 칸과 그에 딸린 네거티브. tags는 칸에 맞게 걸러 낸 작품 태그 */
const BODY_MARK = / on (forearm|arm|hand|back)s?$|^sleeves rolled up$/; // 팔·손의 흉터 같은 낱말은 얼굴로 옮겨 붙음 → 뺌(가슴 위 구도라 보이지도 않음)
function person(c, tags0, boost, P) {
  const tags = tags0.split(", ").filter((t) => !BODY_MARK.test(t)).join(", ");
  const tier = tierOf(c), man = tier !== "f";
  const hr = hairRule(man && !HAIR_LENGTH.test(tags) ? tags.replace(/ hair, /, " hair, short hair, ") : tags, tier);
  const facial = man && tags.split(", ").some((t) => FACIAL.test(t));
  const pos = castTags(hr.tags, boost) + (facial ? ", (facial hair:0.6)" : "") + (hr.add ? ", " + hr.add : "") + ", " + HAIR_ALL + (OUTER.test(tags) && !TOP.test(tags) ? ", (shirt:1.1)" : "");
  let sex = man ? NEG_M : NEG_F;
  if (man && tags.split(", ").some((t) => FACIAL.test(t))) sex = sex.replace(", facial hair, beard, stubble,", ", (long beard:1.2), (mustache:1.1),"); // 수염이 설정인 인물
  const tail =
    hr.neg + (TWO_TONE.test(tags) ? "" : NEG_HAIR_BLEED) + (/long (cloak|cape|poncho)/.test(tags) ? NEG_SHORT_CAPE : "") + (/ragged|tattered|torn/.test(tags) ? P.neg.torn : "");
  return { tier, man, g: man ? "m" : "f", pos, negHead: NEG_BASE(man ? "m" : "f", P) + sex + P.neg.skin + NEG_LINE + NEG_FLAT + (man ? P.neg.m : P.neg.f), negTail: tail };
}

/* ── 장소 칸(감정 그림) ── 작품의 장소 태그 ×1.1. 사람·클로즈업·기차 낱말은 뺀다(혼자 서 있는 그림). 시간 낱말이 없으면 밤 */
const PLACE_DROP = /martial artists|spectators|duel|crowd|couple|woman|\bman\b|people|figure|silhouette|hands|close-up|back view/;
// 장소에 사는 동물(탐정사무소의 'gray cat on desk')은 인물 그림마다 따라 나옴 → 감정 그림에서는 빼고 막음(장소 그림에는 그대로)
const PLACE_ANIMAL = /\b(cat|kitten|dog|puppy|bird|crow|horse|fox|rabbit|animal)s?\b/;
const NEG_ANIMAL = ", (cat:1.3), (animal:1.2)";
const WATER = /waterfall|river|\bsea\b|ocean|\blake\b|\brain|\bwet\b|pond|beach|\bpool\b|hot spring|\bbath|stream/;
const VEHICLE = /^(steam locomotive|locomotive|steam train|train)$/; // 기차 그 자체만 — 'train car infirmary'처럼 열차 안인 장소는 그대로
const TIME = /night|dawn|dusk|sunset|sunrise|morning|afternoon|evening|midnight|twilight|moonlight|\bday\b|daytime|noon|sunlight/;
const DARK = /night|moonlight|midnight|dusk|twilight|evening/;
/** 감정 그림에 넣는 장소 낱말(사람·동물·기차를 뺀 것) — 일상 화풍이 애니 화풍으로 그리는 인물의 배경을 제 문구로 짤 때도 같은 낱말만 쓴다(뺀 동물이 다시 들어가지 않게) */
export const placeKept = (tags) => tags.split(", ").filter((t) => t && !PLACE_DROP.test(t) && !PLACE_ANIMAL.test(t) && !VEHICLE.test(t));
/** 감정 그림의 장소 문구 — 일상 화풍(style-mdaily)이 이 문구를 통째로 찾아 제 배경 문구로 바꾼다 */
export function placeBlock(tags) {
  const ts = placeKept(tags).map((t) => `(${t}:1.1)`);
  if (!TIME.test(tags)) ts.push("night");
  return ts.join(", ") + ", (blurry background:1.2)";
}

/* ── 나이 든 남자(40·50 이상) ── 서른 넘은 남자(elder)의 문구는 서른 초반까지만 맞는다(58세가 서른처럼 나옴 — 사용자 2026-11-24 '나이 문제').
   다 조립한 문구에서 나이를 막는 것(늙음·주름 네거티브, 30세·흠 없는 피부·미소년)을 빼고 나이 문구를 넣는다. 성인 표시와 미성년 네거티브(young boy·shota)는 그대로.
   바꿀 자리가 문구에 없으면 던진다 — 위의 SUBJ·SKIN·BODY·NEG_M을 고치면 여기도 같이. 여성은 나이 든 인물이 이 화풍의 작품에 없어 정하지 않음.
   그려서 본 것: 58세(반석호). 40대는 인물이 없어 못 그려 봄 */
const AGED_M = [
  { from: 50, mature: 1.2, add: "(middle-aged man:1.15), (crow's feet:1.05), (nasolabial folds:1.1)" },
  { from: 40, mature: 1.15, add: "(middle-aged man:1.05), (smile lines:1.0)" },
];
const AGED_NEG = "old man, (wrinkles:1.1), (old:1.2), (middle-aged:1.2), ";
/** 이 인물에 쓰는 나이 단계(없으면 null) — 남자 40·50 이상 */
export const agedOf = (c) => (isFem(c) ? null : AGED_M.find((t) => ageOf(c) >= t.from) || null);
function aged(c, pos, neg) {
  if (BARE_BROW.test(c.tags)) pos = pos.replace("(hair between eyes:0.8), ", ""); // 얼굴 문구의 '눈 사이 머리'가 벗어진 이마를 덮음
  const t = agedOf(c);
  if (!t) return [pos, neg];
  const swap = (s, a, b) => {
    if (!s.includes(a)) throw new Error("나이 규칙: 문구에 없어요 — " + a);
    return s.replace(a, b);
  };
  pos = swap(pos, "(mature male:0.85)", `(mature male:${t.mature})`);
  pos = swap(pos, "(mature:0.5), (30 years old:0.6), ", `(${ageOf(c)} years old:1.1), ${t.add}, `);
  pos = swap(pos, "(flawless skin:0.9), (clear skin:0.7), ", "");
  pos = swap(pos, ", (bishounen:0.5)", "");
  return [pos, swap(neg, AGED_NEG, "")];
}

/** 인물마다 시드 하나 — 칸마다 구도와 옷이 바뀌지 않게(인물 코드의 글자 합) */
export const seedOf = (c) => 7500 + ([...c.code].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 400);
/** lift: 이 그림에서 뺀 노출 네거티브의 이름(노출 정책 — 옷 태그·강조 지정). 뺀 것이 있을 때만 작업에 적어 둔다(그리기 전 검사 assertSafe가 읽음) */
const job = (kind, pos, neg, seed, lift) => ({
  pos, neg: relax(neg, lift), model: MODEL.air, steps: MODEL.steps, cfg: MODEL.cfg, scheduler: MODEL.scheduler, seed, ...SIZE[kind], post: kind === "emotion" ? POST_EMOTION : POST,
  ...(lift.length ? { lift } : {}),
});

/** 칸의 연기 — 눈·표정과 손동작·구도 자리(시선). 화풍과 상관없이 '무엇을 하고 있나'만 고른다: 감정 그림이 쓰고, 일상 화풍(style-mdaily)이 같은 구도·표정을 내려고 가져다 쓴다.
    칸 0은 프로필(얼굴 구도 + 기본 표정), 칸 1과 표정이 없는 칸은 기본 표정(base). o.symbols === false면 만화 기호를 뺀다. look은 시선을 돌린 칸의 방향(away·down — 마주 보면 빈 글) */
export function acting(c, slot, o = {}) {
  const man = !isFem(c), g = man ? "m" : "f", ch = charm(c);
  if (!slot) return { g, E: {}, eyes: man ? EYES_M : ch.eyes, emo: ch.emo, frame: FRAME.profile, look: "", base: true };
  const E = EMOTIONS[slot] || {};
  const T = slot > 1 ? (TEMPER_EMO[temperOf(c)] || {})[slot] : null; // 대표 칸은 성격별 표정(expressions.js), 없으면 공통 표정
  const L = slot > 1 ? (LEAD_EMO[c.code + ":" + c.name] || {})[slot] : null; // 작품의 대표 인물은 그 인물만의 버릇·소품
  const eyes = (L && L.eyes) || (T && T.eyes && T.eyes[g]) || (E.eyes && E.eyes[g]) || (man ? EYES_M : ch.eyes);
  const own = L ? L.emo : T ? T[g] : typeof E.emo === "function" ? E.emo(c) : E.emo && E.emo[g];
  const base = slot === 1 || !E.emo;
  const emo = base ? ch.emo : own + (E.sym && o.symbols !== false ? ", " + E.sym : "");
  const look = (L && L.look) || (T && T.look) || E.look; // "viewer"는 마주 봄
  const turned = !!(look && LOOK[look]);
  return { g, E, eyes, emo, frame: turned ? FRAME.emotion.replace("looking at viewer", LOOK[look]) : FRAME.emotion, look: turned ? look : "", base };
}
/** 그 연기에 딸린 네거티브(표정) — 화풍의 것(빛·옷·비율·자세)은 뺀 것. 일상 화풍이 쓴다: 기본 표정 칸의 감은 눈·벌린 입, 여성의 노려보는 눈, 칸마다의 것(감정 그림의 네거티브와 같은 조건) */
export function actingNeg(c, slot) {
  const g = isFem(c) ? "f" : "m", E = EMOTIONS[slot] || {};
  return (slot <= 1 || !E.emo ? NEG_CALM[g] : "") + (g === "f" && !E.hard ? NEG_SOFT : "") + (E.neg || "") + (g === "m" ? E.negM || "" : "");
}

/** 프로필(칸 0): 얼굴이 화면을 채우는 구도 + 어두운 단색 배경. place는 쓰지 않는다(자리만 맞춤). o: { seed, track(노출 정책의 트랙 — 없으면 일반), accent: false면 강조를 쓰지 않음 } */
export function profileJob(c, place, o = {}) {
  const P = policyOf(o.track), lift = liftOf(c, isFem(c), P, o);
  const p = person(c, c.tags.split(", ").filter((t) => !BOTTOM_TAG.test(t)).join(", "), false, P), ch = charm(c);
  const face = (p.man ? EYES_M + ", " + (p.tier === "elder" ? elderFace(FACE_M.profile) : FACE_M.profile) : ch.eyes + ", " + FACE_F) + ", " + skinOf(p.tier) + ", " + LIPS[p.g];
  const body = p.man ? BODY[p.tier] : BODY.f.profile;
  const pos = [SUBJ[p.tier], p.pos, ch.emo, FRAME.profile, face, body, FIN, BG.profile, Q].join(", ");
  const [pos1, neg1] = aged(c, pos, p.negHead + p.negTail + NEG_CALM[p.g] + (p.man ? "" : NEG_SOFT + P.neg.neck + NEG_LEAN));
  return job("profile", pos1, neg1, o.seed || 7301, lift);
}

/** 감정 그림(칸 1~14): 가슴까지 + 작품의 장소. 칸 1은 인물의 기본 표정. o는 profileJob과 같음(+ symbols: false면 만화 기호를 뺌) */
export function emotionJob(c, place, slot, o = {}) {
  const P = policyOf(o.track), lift = liftOf(c, isFem(c), P, o);
  const E = EMOTIONS[slot] || {}, tags0 = E.armed ? c.tags : c.tags.split(", ").filter((t) => !WEAPON_TAG.test(t)).join(", ");
  const p = person(c, inner(tags0), true, P), g = p.g, elder = p.tier === "elder";
  const { eyes, emo, frame } = acting(c, slot, o);
  let face = E.face ? E.face[g] : p.man ? FACE_M.emotion : FACE_F;
  if (elder) face = elderFace(face);
  if (E.lowBlush) face = face.replace("(blush:0.3)", "(blush:0.1)"); // 화난 얼굴의 홍조는 수줍어 보임
  face += ", " + skinOf(p.tier) + ", " + LIPS[g];
  const day = TIME.test(place.tags) && !DARK.test(place.tags);
  const body = p.man ? [/broad shoulders/.test(c.tags) ? "" : SHOULDERS, BODY_M_EMOTION[p.tier]].filter(Boolean).join(", ") : BODY.f.emotion;
  let pos = [SUBJ[p.tier], p.pos, emo, frame, placeBlock(place.tags), eyes + ", " + face, body, FIN, day ? BG.emotion.replace("(dim lighting:0.8), ", "") : BG.emotion, Q]
    .filter(Boolean)
    .join(", ");
  if (E.noEyeColor) pos = pos.replace(/\((?:[a-z ]+) eyes:1\), /, ""); // 자는 칸은 눈색 태그를 뺌(눈을 뜨게 함)
  const neg =
    p.negHead + p.negTail + (slot === 1 || !E.emo ? NEG_CALM[g] : "") + (!p.man && !E.hard ? NEG_SOFT : "") + (p.man ? "" : P.neg.neck) + (day ? "" : NEG_DAY) + NEG_POSE + (E.armed ? "" : NEG_ARMS) + (E.neg || "") +
    (place.tags.split(", ").some((t) => VEHICLE.test(t)) ? NEG_TRAIN : "") +
    (WATER.test(place.tags) ? P.neg.wet : "") +
    (place.tags.split(", ").some((t) => PLACE_ANIMAL.test(t)) ? NEG_ANIMAL : "") +
    NEG_LIGHT + NEG_TEXT +
    (p.man ? NEG_PROPORTION + (E.negM || "") : "");
  const [pos1, neg1] = aged(c, pos, neg);
  return job("emotion", pos1, neg1, o.seed || seedOf(c), lift);
}
