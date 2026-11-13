/* 남성향 애니 화풍(manime)의 프롬프트 조립 — 작품 데이터(cast[]·places[])를 칸에 끼워 긍정·부정 프롬프트와 생성 값을 만든다.
   인물마다 따로 손대지 않는다: 눈매·성격·나이·옷 낱말처럼 작품에 적힌 값에 따라 규칙이 갈린다. 값의 뜻과 정한 경위는 ../README.md.
   profileJob(인물, 장소) → 프로필(칸 0) · emotionJob(인물, 장소, 칸 1~14) → 감정 그림. 앱은 이 파일을 쓰지 않는다(그림은 앱 밖에서 만듦) */

export const MODEL = { air: "civitai:967405@1428332", name: "Nova Orange XL v6.0", steps: 28, cfg: 4, scheduler: "Euler a" };
/* 크기는 64의 배수(Runware) — 프로필 768×1152(2:3), 감정 1024×1024. 첫 그림을 hires 크기로 키워 같은 프롬프트로 다시 그린다(strength 0.4) */
export const SIZE = {
  profile: { width: 768, height: 1152, hires: { w: 1152, h: 1728, strength: 0.4 } },
  emotion: { width: 1024, height: 1024, hires: { w: 1536, h: 1536, strength: 0.4 } },
};
/* 후처리(post.js): 채도·대비 → 빛 번짐 → 부드러운 초점 → 밝은 곳에 연보라빛 */
export const POST = { filter: "saturate(1.4) contrast(1.06)", bloom: { k: 8, a: 0.3 }, blurK: 4, blurA: 0.1, tint: { mode: "soft-light", color: "#c4b6ff", a: 0.6 } };

const Q = "masterpiece, best quality, amazing quality, very aesthetic, absurdres";
const SUBJ = {
  f: "1girl, solo, (adult woman:1.2), (mature female:0.8), (beautiful woman:1.1)",
  m: "1boy, solo, (adult man:1.3), (mature male:0.6), (handsome:1.2)",
  elder: "1boy, solo, (adult man:1.3), (mature male:1.0), (handsome:1.2)", // 서른 넘은 남자 — 잘생긴 아저씨
};
const FIN =
  "(shiny hair:1.4), (hair strands:1.4), (detailed hair:1.3), (pale skin:1.2), (soft shading:1.3), (painterly:1.3), (semi-realistic:0.3), " +
  "(soft focus:0.4), (thin lineart:1.3), (depth of field:0.7), (vivid colors:0.8)";
const BODY = { f: { profile: "(large breasts:0.5), (narrow waist:0.6)", emotion: "(large breasts:0.6), (narrow waist:0.6)" }, m: "slender, (bishounen:1.0)", elder: "(broad shoulders:0.5)" };
/* 남성의 감정 그림 비율: 어깨가 넓고 머리가 작게(류건이 기준 — 사용자 2026-11-13). 태그에 broad shoulders가 없는 인물에만 붙인다. 프로필은 얼굴 구도라 그대로 */
const SHOULDERS = "(broad shoulders:1.1)";
const BODY_M_EMOTION = { m: "slender, (bishounen:1.0)", elder: "" };
const NEG_PROPORTION = ", (large head:1.3), (narrow shoulders:1.2)";
const FRAME = {
  profile: "(fully clothed:1.2), (close-up:1.0), (portrait:1.2), (from above:0.4), (head tilt:0.8), looking at viewer",
  emotion: "(fully clothed:1.2), (standing:1.0), (upper body:1.1), (from above:0.2), (head tilt:0.5), looking at viewer",
};
const LOOK = { away: "(looking away:0.9)", down: "(looking down:0.5)" };
const BG = {
  profile: "(dim lighting:0.9), (soft lighting:1.0), (rim light:0.8), (bloom:0.5), (dark background:1.1), (black background:0.6), (gradient background:0.8), simple background",
  emotion: "(dim lighting:0.8), (soft lighting:1.1), (rim light:0.6), (bloom:0.6)", // 낮 장소는 dim lighting을 뺌
};

/* ── 얼굴 ── 여성: 공통 문구 + 눈매 규칙(작품 태그의 눈매 낱말) / 남성: 고운 미남, 서른 넘으면 턱선을 굵게 */
const FACE_F = "(long eyelashes:1.0), (thick eyelashes:0.8), (eyeliner:0.4), (detailed eyes:1.2), (detailed iris:1.2), (glowing eyes:0.6), (blush:1.3), (nose blush:1.1), (glossy lips:0.6)";
const EYES_M = "(half-closed eyes:0.9), (jitome:0.6), (tsurime:0.5)";
const FACE_M = {
  profile: "(long eyelashes:0.6), (detailed eyes:1.2), (detailed iris:1.2), (glowing eyes:0.5), (sharp jawline:0.5)",
  emotion: "(long eyelashes:0.6), (detailed eyes:1.2), (detailed iris:1.2), (pupils:0.8), (sharp jawline:0.5)", // 밝은 눈색은 glowing eyes에서 눈동자가 사라져 pupils로
};
const elderFace = (s) => s.replace("(long eyelashes:0.6), ", "").replace("(sharp jawline:0.5)", "(sharp jawline:0.9)");
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
export const TEMPERS = {
  도도: { f: "(smug:0.7), (smirk:0.5), closed mouth", m: "(smirk:0.5), closed mouth", hand: "(hand on own chin:0.6)" },
  장난: { f: "(smirk:0.4), (one eye closed:0.5), (parted lips:0.4)", m: "(grin:0.5)", hand: "(finger to mouth:0.7)" },
  해맑음: { f: "(smile:1.0), (open mouth:0.5), (happy:0.6)", m: "(smile:0.8)", hand: "(waving:0.5)" },
  수줍음: { f: "(nervous smile:0.7), (shy:0.6), closed mouth", m: "(nervous smile:0.6)", hand: "(own hands together:0.8)" },
  다정: { f: "(gentle smile:1.0), closed mouth", m: "(gentle smile:0.8), closed mouth", hand: "(hand on own chest:0.6)" },
  냉소: { f: "(smirk:0.5), (tired:0.5), closed mouth", m: "(smirk:0.4), closed mouth", hand: "(head rest:0.5)" },
  곧음: { f: "(serious:0.6), (light smile:0.4), closed mouth", m: "(serious:0.5), (light smile:0.4), closed mouth", hand: "" },
  차가움: { f: "(expressionless:0.5), (light smile:0.3), closed mouth", m: "(expressionless:0.4), (light smile:0.3), closed mouth", hand: "(tucking hair:0.6)" },
};
export const temperOf = (c) => (c.temper && TEMPERS[c.temper] ? c.temper : "");
const PROP_HAND = [[/glasses|eyewear/, "(adjusting eyewear:0.9)"], [/folding fan|\bfan\b/, "(holding fan:0.9)"]]; // 소품이 있으면 그 손동작이 먼저
/** 기본 표정(칸 0·1)과 눈 모양. 남자는 손동작을 넣지 않는다(소품만) */
export function charm(c) {
  const g = isFem(c) ? "f" : "m", p = TEMPERS[temperOf(c)], eye = eyeRule(c.tags), prop = PROP_HAND.find(([re]) => re.test(c.tags));
  const hand = prop ? prop[1] : p && g === "f" ? p.hand : "";
  return { emo: (p ? p[g] : g === "f" ? eye.emo : "(light smile:0.7), closed mouth") + (hand ? ", " + hand : ""), eyes: eye.eyes };
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
  5: { name: "놀람", eyes: { f: "(wide-eyed:1.2)", m: "(wide-eyed:1.0), (pupils:1.1)" }, sym: "(^^^:1.1)", neg: ", (day:1.2), (blue sky:1.1)",
    emo: { f: "(surprised:1.4), (open mouth:1.0), (raised eyebrows:0.8), (hands up:0.6)", m: "(surprised:1.3), (open mouth:0.8), (raised eyebrows:0.8)" } },
  6: { name: "분노", eyes: both("(glaring:1.0), (v-shaped eyebrows:1.1)"), hard: true, lowBlush: true, sym: "(anger vein:1.4)", emo: both("(angry:1.4), (frown:1.2), (clenched teeth:0.9), (crossed arms:0.8)") },
  7: { name: "삐침", look: "away", sym: "(anger vein:0.8), (squiggle:0.9)",
    emo: { f: "(pout:1.3), (puffed cheeks:0.9), (annoyed:0.9), (crossed arms:0.9)", m: "(annoyed:1.1), (frown:0.9), (pout:0.5), closed mouth, (crossed arms:0.9)" } },
  8: { name: "공포", eyes: { f: "(wide-eyed:1.1)", m: "(wide-eyed:0.9), (constricted pupils:0.7)" }, lowBlush: true, sym: "(sweatdrop:1.1)",
    emo: { f: "(scared:1.4), (trembling:0.9), (sweat:0.9), (turn pale:0.7), (open mouth:0.6), (hands on own chest:0.8)", m: "(scared:1.3), (sweat:0.9), (turn pale:0.6), (clenched teeth:0.7)" } },
  9: { name: "부상", eyes: both("(one eye closed:0.9)"), lowBlush: true, neg: ", blood, gore", // 팔 붕대는 소매를 걷게 해 겉옷이 사라짐 → 머리·볼·손
    emo: both("(pain:1.2), (grimace:0.9), (injury:0.9), (bandaged head:1.2), (bandaid on cheek:1.1), (bandaged hand:1.1), (holding own arm:1.0)") },
  10: { name: "회복", emo: both("(relieved:1.1), (gentle smile:1.1), closed mouth, (bandaid on cheek:1.1), (bandaged hand:0.9)") },
  11: { name: "휴식", eyes: both("(closed eyes:1.4)"), noEyeColor: true, sym: "(zzz:1.0)", neg: ", (open eyes:1.2), (pajamas:1.2), (bed:1.2), (pillow:1.2), (sleeping:1.0)", // sleeping은 잠옷·눕기를 부름
    face: { f: "(long eyelashes:1.0), (blush:1.0), (nose blush:0.8), (glossy lips:0.6)", m: "(long eyelashes:0.6), (sharp jawline:0.5)" },
    emo: both("(dozing:0.9), (relaxed:0.9), (light smile:0.5), closed mouth, (head tilt:0.9)") },
  12: { name: "공격", eyes: both("(glaring:0.8)"), hard: true, lowBlush: true, armed: true, // 이 칸만 무기를 듦(없으면 주먹)
    emo: (c) => "(serious:1.2), (fighting stance:1.0), (clenched teeth:0.5), " + (WEAPON.test(c.tags) ? "(holding weapon:1.1)" : "(clenched fist:1.0)") },
  13: { name: "각성", eyes: both("(glowing eyes:1.5)"), hard: true, lowBlush: true,
    emo: both("(serious:1.0), (aura:1.2), (electricity:0.9), (floating hair:1.2), (light particles:0.9), (outstretched hand:0.9)") },
  14: { name: "설렘", eyes: { f: "(half-closed eyes:0.5)", m: "(half-closed eyes:0.8)" }, sym: "(heart:1.6), (spoken heart:0.9)",
    emo: { f: "(blush:1.7), (light smile:1.0), (parted lips:0.6), (hand on own chest:1.0)", m: "(blush:0.9), (light smile:0.9), (hand on own neck:0.6)" } },
};

/* ── 네거티브 ── */
const NEG_BASE = (g) =>
  [
    "lowres, bad anatomy, bad hands, text, error, missing fingers, extra digits, fewer digits, cropped, worst quality, low quality, signature, watermark, username, jpeg artifacts", // 품질
    "child, loli, shota, underage, toddler, aged down, baby face, (young:1.1), (teenager:1.1), chibi", // 미성년 금지 — 늘 넣음
    "nsfw, nude, (cleavage:1.3), revealing clothes, (no pants:1.4), (bottomless:1.3), (naked sweater:1.2), (sweater dress:1.2), (plunging neckline:1.2), (bare legs:1.3), huge breasts, " +
      "(side slit:1.3), pelvic curtain, (skin tight:1.2), (impossible clothes:1.2), (covered navel:1.2), cameltoe, (bodysuit:1.1)", // 노출·달라붙는 옷
    "(wide shot:1.1), (full body:1.1), feet, knees, (thick thighs:1.1)", // 구도·과장
    "(thick lineart:1.1), (thick outlines:1.2), sketch, (cartoon:1.1), (anime screencap:1.1), (cel shading:1.1), (flat color:1.1), 3d, realistic, photorealistic", // 화풍
    g === "f" ? "(big head:1.2)" : "(big head:1.2), round face", // 성인 인상(여성은 부드러운 얼굴형을 두려고 round face를 막지 않음)
    "neon lights, (dark-skinned female:1.2), (dark-skinned male:1.2), tan, (blue skin:1.2), (grey skin:1.2)", // 색·피부
    "multiple girls, multiple boys, 2girls, 2boys, crowd, people, (from below:1.2), (latex:1.1)", // 혼자
  ].join(", ");
const NEG_F = ", (old:1.2), (middle-aged:1.2), (wrinkles:1.2), nasolabial folds, eye bags";
const NEG_M = ", facial hair, beard, stubble, old man, (wrinkles:1.1), (old:1.2), (middle-aged:1.2), burly, (young boy:1.3), (shota:1.4), (long hair:1.2)";
const NEG_SKIN =
  ", (cleavage:1.5), (see-through:1.4), (see-through clothes:1.3), (open clothes:1.3), (open shirt:1.2), (unbuttoned:1.2), (downblouse:1.4), (lingerie:1.3), (bra:1.3), " +
  "(bare shoulders:1.2), (off shoulder:1.2)";
const NEG_LINE = ", (thick outlines:1.4), (bold lineart:1.2), (black outline:1.2)";
const NEG_SOFT = ", (glaring:1.2), (angry:1.1), (sanpaku:1.1)"; // 여성 — 노려보는 눈 막기(분노·공격·각성 칸은 뺌)
const NEG_NECK = ", (collarbone:1.1), (plunging neckline:1.3)";
const NEG_LEAN = ", (leaning forward:1.2), (bent over:1.2)";
const NEG_POSE = ", (sitting:1.3), (leaning forward:1.2), (bent over:1.2), (lying:1.2), (desk:0.8), (leaning on table:1.2), (arms on table:1.2), (arm support:1.1), (elbow rest:1.1)";
const NEG_ARMS = ", (holding gun:1.2), (holding weapon:1.1), (aiming:1.2)";
const NEG_DAY = ", (day:1.2), (daylight:1.1), (blue sky:1.1)";
const NEG_HAIR_BLEED = ", (multicolored hair:1.2), streaked hair, colored inner hair, gradient hair"; // 눈색 가중이 높아 눈색이 머리로 번짐
const NEG_TRAIN = ", (train:1.3), (locomotive:1.3), (railroad tracks:1.2)";
const NEG_SHORT_CAPE = ", (capelet:1.4), (short cape:1.3), (shoulder cape:1.3)";
const TWO_TONE = /multicolored hair|streaked hair|gradient hair|two-tone hair|colored inner hair/;

/* ── 인물 칸 ── 작품 태그 그대로 ×1.1, 눈색 ×1.4, 수염 ×0.7 + 앞머리·속옷 규칙 */
export const isFem = (c) => (c.gender ? c.gender === "f" : !/남성/.test(c.look || ""));
/** 겉보기 나이: cast[].age(정수)가 있으면 그 값, 없으면 look 글의 'N세' */
export const ageOf = (c) => (Number.isInteger(c.age) ? c.age : Number((/(\d+)세/.exec(c.look || "") || [0, 0])[1]));
/** 남자의 나이대: 겉보기 나이가 30 이상이면 "elder"(성숙한 얼굴·가르마), 아니면 "m" */
export const tierOf = (c) => (isFem(c) ? "f" : ageOf(c) >= 30 ? "elder" : "m");
const EYE_SHAPE = /sharp|round|bright|narrow|droopy|upturned|tired|half-closed|closed/;
const FACIAL = /^(stubble|beard|mustache|goatee|facial hair)$/;
const weight = (t) => (/ eyes$/.test(t) && !EYE_SHAPE.test(t) ? 1.4 : FACIAL.test(t) ? 0.7 : 1.1);
const castTags = (tags) => tags.split(", ").map((t) => `(${t}:${weight(t)})`).join(", ");
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
function hairRule(tags, tier) {
  const ts = tags.split(", ");
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
function person(c, tags) {
  const tier = tierOf(c), man = tier !== "f";
  const hr = hairRule(man && !HAIR_LENGTH.test(tags) ? tags.replace(/ hair, /, " hair, short hair, ") : tags, tier);
  const pos = castTags(hr.tags) + (hr.add ? ", " + hr.add : "") + ", " + HAIR_ALL + (OUTER.test(tags) && !TOP.test(tags) ? ", (shirt:1.1)" : "");
  let sex = man ? NEG_M : NEG_F;
  if (man && tags.split(", ").some((t) => FACIAL.test(t))) sex = sex.replace(", facial hair, beard, stubble,", ", (long beard:1.2), (mustache:1.1),"); // 수염이 설정인 인물
  const tail = hr.neg + (TWO_TONE.test(tags) ? "" : NEG_HAIR_BLEED) + (/long (cloak|cape|poncho)/.test(tags) ? NEG_SHORT_CAPE : "");
  return { tier, man, g: man ? "m" : "f", pos, negHead: NEG_BASE(man ? "m" : "f") + sex + NEG_SKIN + NEG_LINE, negTail: tail };
}

/* ── 장소 칸(감정 그림) ── 작품의 장소 태그 ×1.1. 사람·클로즈업·기차 낱말은 뺀다(혼자 서 있는 그림). 시간 낱말이 없으면 밤 */
const PLACE_DROP = /martial artists|spectators|duel|crowd|couple|woman|\bman\b|people|figure|silhouette|hands|close-up|back view/;
const VEHICLE = /^(steam locomotive|locomotive|steam train|train)$/; // 기차 그 자체만 — 'train car infirmary'처럼 열차 안인 장소는 그대로
const TIME = /night|dawn|dusk|sunset|sunrise|morning|afternoon|evening|midnight|twilight|moonlight|\bday\b|daytime|noon|sunlight/;
const DARK = /night|moonlight|midnight|dusk|twilight|evening/;
function placeBlock(tags) {
  const ts = tags.split(", ").filter((t) => t && !PLACE_DROP.test(t) && !VEHICLE.test(t)).map((t) => `(${t}:1.1)`);
  if (!TIME.test(tags)) ts.push("night");
  return ts.join(", ") + ", (blurry background:1)";
}

/** 인물마다 시드 하나 — 칸마다 구도와 옷이 바뀌지 않게(인물 코드의 글자 합) */
export const seedOf = (c) => 7500 + ([...c.code].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 400);
const job = (kind, pos, neg, seed) => ({ pos, neg, model: MODEL.air, steps: MODEL.steps, cfg: MODEL.cfg, scheduler: MODEL.scheduler, seed, ...SIZE[kind], post: POST });

/** 프로필(칸 0): 얼굴이 화면을 채우는 구도 + 어두운 단색 배경. place는 쓰지 않는다(자리만 맞춤) */
export function profileJob(c, place, o = {}) {
  const p = person(c, c.tags.split(", ").filter((t) => !BOTTOM_TAG.test(t)).join(", ")), ch = charm(c);
  const face = p.man ? EYES_M + ", " + (p.tier === "elder" ? elderFace(FACE_M.profile) : FACE_M.profile) : ch.eyes + ", " + FACE_F;
  const body = p.man ? BODY[p.tier] : BODY.f.profile;
  const pos = [SUBJ[p.tier], p.pos, ch.emo, FRAME.profile, face, body, FIN, BG.profile, Q].join(", ");
  return job("profile", pos, p.negHead + p.negTail + (p.man ? "" : NEG_SOFT + NEG_NECK + NEG_LEAN), o.seed || 7301);
}

/** 감정 그림(칸 1~14): 가슴까지 + 작품의 장소. 칸 1은 인물의 기본 표정 */
export function emotionJob(c, place, slot, o = {}) {
  const E = EMOTIONS[slot] || {}, tags0 = E.armed ? c.tags : c.tags.split(", ").filter((t) => !WEAPON_TAG.test(t)).join(", ");
  const p = person(c, inner(tags0)), g = p.g, ch = charm(c), elder = p.tier === "elder";
  const eyes = (E.eyes && E.eyes[g]) || (p.man ? EYES_M : ch.eyes);
  let face = E.face ? E.face[g] : p.man ? FACE_M.emotion : FACE_F;
  if (elder) face = elderFace(face);
  if (E.lowBlush) face = face.replace("(blush:1.3), (nose blush:1.1)", "(blush:0.5)"); // 화난 얼굴의 진한 홍조는 수줍어 보임
  const emo = slot === 1 || !E.emo ? ch.emo : (typeof E.emo === "function" ? E.emo(c) : E.emo[g]) + (E.sym && o.symbols !== false ? ", " + E.sym : "");
  const frame = E.look ? FRAME.emotion.replace("looking at viewer", LOOK[E.look]) : FRAME.emotion;
  const day = TIME.test(place.tags) && !DARK.test(place.tags);
  const body = p.man ? [/broad shoulders/.test(c.tags) ? "" : SHOULDERS, BODY_M_EMOTION[p.tier]].filter(Boolean).join(", ") : BODY.f.emotion;
  let pos = [SUBJ[p.tier], p.pos, emo, frame, placeBlock(place.tags), eyes + ", " + face, body, FIN, day ? BG.emotion.replace("(dim lighting:0.8), ", "") : BG.emotion, Q]
    .filter(Boolean)
    .join(", ");
  if (E.noEyeColor) pos = pos.replace(/\((?:[a-z ]+) eyes:1\.4\), /, ""); // 자는 칸은 눈색 태그를 뺌(눈을 뜨게 함)
  const neg =
    p.negHead + p.negTail + (!p.man && !E.hard ? NEG_SOFT : "") + (p.man ? "" : NEG_NECK) + (day ? "" : NEG_DAY) + NEG_POSE + (E.armed ? "" : NEG_ARMS) + (E.neg || "") +
    (place.tags.split(", ").some((t) => VEHICLE.test(t)) ? NEG_TRAIN : "") +
    (p.man ? NEG_PROPORTION : "");
  return job("emotion", pos, neg, o.seed || seedOf(c));
}

/** 꼭 있어야 하는 것 — 성인 표시와 미성년·노출 네거티브. 빠졌으면 던진다(그리기 전에 부를 것) */
export function assertSafe(j) {
  if (!/\(adult (woman|man):1\.[23]\)/.test(j.pos) || !/\bsolo\b/.test(j.pos)) throw new Error("성인·혼자 표시가 없어요");
  for (const t of ["child", "loli", "shota", "underage", "aged down", "teenager", "nsfw", "nude", "(cleavage:1.5)", "revealing clothes", "chibi", "(big head:1.2)"])
    if (!j.neg.includes(t)) throw new Error("네거티브에 없어요: " + t);
  return j;
}
