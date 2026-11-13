/* 작품 표지(960×1280)의 프롬프트 조립 — 2026-11-14 사용자와 비교 생성으로 정함(경위와 표는 ../README.md '표지').
   표지는 여러 명을 그리지 않는다: 작품마다 대표 인물 한 명(LEADS), 구도·자세는 작품마다 다르게(SHOT).
   일상 화풍(Pony 계열)은 구도 문구를 잘 따르지 않아 두 단계로 그린다 — Nova Orange가 구도를 잡은 밑그림(guide)을 일상 화풍이 다시 그림(strength 0.75).
   애니(신님들)는 남성향 애니의 감정 그림 작업에서 구도 자리만 바꿔 바로 그린다.
   받은 그림에는 화풍 후처리(job.post) → 표지 후처리(./cover-post.js) → 로고(./logo.js + ./logos.js) 순서로 입힌다.
   coverJob(작품 id, 작품) → 작업 하나(일상은 guide가 붙음). Node에서만 돈다. 앱은 이 파일을 쓰지 않는다 */
import { emotionJob as animeEmotion, assertSafe as animeSafe } from "../../style-manime/code/assemble.js";
import { profileJob, assertSafe, castTags, isFem, seedOf, split, TEMPERS } from "../../style-mdaily/code/assemble.js";
import { styleOf } from "./place.js";

export const SIZE = { width: 960, height: 1280 };
const HIRES = { w: 1344, h: 1792 }; // Runware는 64의 배수만(1440×1920은 못 만듦) — 받은 뒤 960×1280으로 줄여 싣는다
const GUIDE = { model: "civitai:967405@1428332", cfg: 4, steps: 28, scheduler: "Euler a", strength: 0.75 }; // Nova Orange XL v6.0 — archive/style-manime

/* 구도·자세. 가까이(가슴 위)는 손짓 하나로 작품을 드러내고, 멀리는 장면이 곧 작품인 경우만(황제의 왕좌·기사의 맹세 — 사용자 '작품에 따라 섞기').
   쓰지 않는 것: 돌아보는 자세(뒤태가 도드라짐) · 팔짱(가슴이 도드라짐) · 목에 손(눈을 감고 조는 모습으로 나옴) · 가슴에 손을 얹은 갑옷(건틀릿이 갈고리처럼 나옴) */
export const SHOT = {
  plain: "(upper body:1.3), (looking at viewer:1.1)",
  tea: "(upper body:1.3), (holding cup:1.2), (teacup:1.1), (hand up:1.0), (looking at viewer:1.1)",
  book: "(upper body:1.3), (holding book:1.2), (book:1.0), (looking at viewer:1.1)",
  watch: "(upper body:1.3), (holding pocket watch:1.2), (pocket watch:1.1), (hand up:1.0), (looking at viewer:1.1)",
  mug: "(upper body:1.3), (holding cup:1.2), (coffee mug:1.1), (looking at viewer:1.2), (open eyes:1.0)",
  bowl: "(upper body:1.3), (holding bowl:1.2), (steam:0.9), (looking at viewer:1.1)",
  tuck: "(upper body:1.3), (tucking hair:1.2), (hand in own hair:1.0), (head tilt:1.0), (looking at viewer:1.1)",
  hush: "(upper body:1.3), (finger to mouth:1.2), (head tilt:1.1), (looking at viewer:1.1)",
  desk: "(upper body:1.2), sitting, (elbow rest:1.1), (head rest:1.2), (hand on own cheek:1.0), table, (looking at viewer:1.1), (from above:0.7)",
  blade: "(upper body:1.2), (holding sword:1.3), (sword:1.1), (blade in foreground:1.1), (looking at viewer:1.1), (dutch angle:1.1), (wind:1.0)",
  above: "(from above:1.4), (looking up:1.1), (looking at viewer:1.1), (upper body:1.2), (hand on own chest:1.0)",
  hilt: "(upper body:1.3), (hand on hilt:1.2), (sheathed sword:1.1), (wind:1.0), (floating hair:0.8), (looking at viewer:1.1)",
  goggles: "(upper body:1.2), (adjusting goggles:1.2), (hand on own head:1.0), (looking at viewer:1.1), (dutch angle:1.0)",
  throne: "(sitting:1.2), (throne:1.1), (crossed legs:1.0), (head rest:1.1), (looking at viewer:1.1), (cowboy shot:1.2)",
  vow: "(on one knee:1.2), (kneeling:1.1), (planted sword:1.2), (hands on hilt:1.1), (looking up:1.0), (looking at viewer:1.1), (from above:1.0), (cowboy shot:1.1)",
};
const FAR = { throne: 1, vow: 1 };

/* 대표 인물과 구도. 대표는 그 작품에서 가장 예쁘거나 그림이 가장 자연스럽거나 개성 있는 인물(사용자 — 첫 인물이 대표로 애매한 작품이 있음).
   뒤 칸은 눈으로 보고 고친 손질: gpos·gneg 밑그림 문구 · pos·neg 본 그림 문구 · gseed·seed 시드 · strength 밑그림을 따르는 정도(낮을수록 밑그림대로)
   · tags [찾을 말, 바꿀 말] 표지에서만 인물 태그를 바꿈 */
export const LEADS = {
  godseats: { code: "HSY", shot: "blade", seed: 2 },
  hangyeoul: { code: "HGU", shot: "desk", neg: ", (people in background:1.6), (crowd:1.5), (2boys:1.5), (multiple boys:1.5), (customer:1.4)", seed: 6, strength: 0.6 }, // 뒤에 손님이 그려짐
  yunhaera: { code: "YHR", shot: "tuck" },
  sipjeol: { code: "NGS", shot: "hilt" },
  daeyeon: { code: "IHW", shot: "above", gpos: ", (white hanbok:1.3), (white jeogori:1.3)", gneg: ", (blue hanbok:1.4), (blue clothes:1.3), (blue shirt:1.3)", pos: ", (white hanbok:1.3), (white jeogori:1.3)", neg: ", (blue hanbok:1.4), (blue clothes:1.3)", gseed: 5 }, // 한복이 하늘색으로 나옴
  // 홍 여사의 머리는 사용자가 '촘촘한 일자 앞머리(풀뱅)·반묶음'으로 정함 — 세계관 세션이 인물 태그를 바꾸면 tags 칸을 지운다. 눈이 붉게 나와 금빛을 올림
  minwon: { code: "HME", shot: "hush", tags: ["hair bun, hairpin", "(blunt bangs:1.3), (straight bangs:1.2), (full bangs:1.2), (half updo:1.3), long hair, straight hair, hairpin"], eyes: ["(golden eyes:0.7)", "(golden eyes:1.1), (yellow eyes:1.0)"], neg: ", (red eyes:1.4)" },
  baekya: { code: "SHJ", shot: "goggles" },
  hwanghu: { code: "KAS", shot: "throne" },
  kael: { code: "KAEL", shot: "vow" },
  lethe: { code: "CSH", shot: "watch" },
  seodoyun: { code: "SDY", shot: "mug", gneg: ", (closed eyes:1.4), (sleeping:1.3)", neg: ", (closed eyes:1.4), (sleeping:1.3)" },
  hasuk: { code: "KTH", shot: "bowl" },
  baekyeon: { code: "BY", shot: "tea", gseed: -10, seed: -10 },
  geumseo: { code: "ADL", shot: "book", gseed: -10, seed: -10 },
};
/** 그 작품의 대표와 구도 — 표에 없는 새 작품은 첫 인물·기본 구도(대표를 정하면 LEADS에 적는다) */
export const leadOf = (workId, work) => LEADS[workId] || { code: ((work.cast || [])[0] || {}).code, shot: "plain" };

const Q = "masterpiece, best quality, amazing quality, very aesthetic, absurdres, newest, general";
const NQ = "bad quality, worst quality, worst detail, sketch, lowres, jpeg artifacts, text, watermark, signature, logo, border, letterboxed";
const SAFE = ", bad anatomy, bad hands, extra fingers, child, loli, shota, underage, toddler, aged down, baby face, nsfw, nude, (cleavage:1.5), (see-through:1.4), chibi, (big head:1.2), (from behind:1.3), (ass:1.5), (bent over:1.4), (downblouse:1.5), (bare legs:1.3), (thighs:1.3), (off shoulder:1.4)";
const NEG_POSE_F = ", (from behind:1.3), (bent over:1.4), (downblouse:1.5), (bare legs:1.3)";
/* 남자(사용자: 부자연스럽고 느끼함 → 자연스럽게·선을 유하게, 그 뒤 '너무 무뚝뚝함' → 은은한 미소)
   · 표정: smirk·half-lidded·mischievous·confident gaze를 쓰지 않고 입을 다문 은은한 미소 · 얼굴선: 화풍 문구의 날카로운 턱·좁은 눈·근육 가중치를 낮춤(성인 표시는 그대로)
   · 가까이 잡은 표지는 키우지 않음(키우면 선이 딱딱해짐) — 멀리 잡은 표지만 0.3으로 키워 얼굴을 살림 */
const EXPR_M = { warm: "(gentle smile:1.35), (closed mouth:1.2), (soft gaze:1.2)", cool: "(light smile:1.3), (closed mouth:1.2), (soft gaze:1.2)", cold: "(light smile:1.25), (closed mouth:1.2), (soft gaze:1.2)" };
const exprM = (temper) => (temper === "차가움" ? EXPR_M.cold : /도도|냉소|곧음/.test(temper || "") ? EXPR_M.cool : EXPR_M.warm);
const NEG_M = ", (smirk:1.3), (smug:1.3), (half-lidded eyes:1.2), (seductive smile:1.3), (raised eyebrow:1.2), (glossy skin:1.2), (shiny skin:1.2), (from behind:1.3)";
const SOFT_M = [["(sharp jawline:1.45)", "(sharp jawline:1.0)"], ["(prominent jawline:1.3), ", ""], ["(narrow eyes:1.35)", "(narrow eyes:1.0)"], ["(small eyes:1.2), ", ""], ["(mature male:1.5)", "(mature male:1.1)"],
  ["(mature face:1.45)", "(mature face:1.0)"], ["(masculine:1.4)", "(masculine:1.1)"], ["(muscular male:1.3)", "(muscular male:1.0)"], ["(thick neck:1.4)", "(thick neck:1.1)"]];
const SOFT_M_ADD = ", (soft features:1.2), (gentle eyes:1.1), (soft lineart:1.2)";
const GUIDE_M = "1boy, solo, (adult man:1.2), handsome, (soft features:1.1)",
  GUIDE_M_NEG = ", (mature male:1.1), old, wrinkles, (muscular:1.2), (thick arms:1.2), smirk, smug, (claws:1.3)";
/* 여자(사용자: 조금 더 가녀리게 → 한 단계 더). 밑그림에 어깨·팔·허리 문구(narrow shoulders·thin arms·thin waist)를 넣으면 어깨가 드러난 옷·소매 없는 옷이 나온다
   → 밑그림은 slender·slim과 긴소매만 넣고 드러난 어깨·트임을 세게 막는다. 가녀림은 본 그림(일상 화풍 문구)에서 올린다 */
const GUIDE_F = "1girl, solo, (adult woman:1.2), (mature female:0.8), slender, (slim:1.2), (long sleeves:1.3)";
const NEG_SLIM = ", (large breasts:1.5), (huge breasts:1.5), (curvy:1.3), (plump:1.2), (wide hips:1.2), (broad shoulders:1.3), (muscular female:1.3), (thick arms:1.3), (bare shoulders:1.6), (bare arms:1.5), (sleeveless:1.6), (collarbone:1.4), (low neckline:1.5), (shoulder cutout:1.6), (detached sleeves:1.5), (clothing cutout:1.5), (off-shoulder shirt:1.6)";
const SLIM_F = [["(slender body:1.25)", "(slender body:1.6)"], ["(slim:1.15)", "(slim:1.45)"], ["(narrow shoulders:1.1)", "(narrow shoulders:1.4), (delicate:1.3), (thin arms:1.2), (thin waist:1.1)"]];
const LIGHT_F = "(cinematic lighting:1.1), (rim light:1.0), (depth of field:1.0)",
  LIGHT_M = "(depth of field:1.0)";
const ANIME_SLIM = ", slender, (slim:1.2), (long sleeves:1.3)",
  ANIME_NEG_F = ", (from behind:1.3), (large breasts:1.5), (huge breasts:1.5), (curvy:1.3), (wide hips:1.2), (thick thighs:1.3), (plump:1.2), (bare shoulders:1.6), (bare arms:1.5), (sleeveless:1.6), (shoulder cutout:1.6), (detached sleeves:1.5), (clothing cutout:1.5)";

const w = (tags, k) => tags.split(", ").filter(Boolean).map((t) => `(${t}:${k})`).join(", ");
const must = (s, a, b) => {
  if (!s.includes(a)) throw new Error("표지 조립: 바꿀 문구를 못 찾았어요 — " + a);
  return s.replace(a, b);
};
const shotOf = (lead, c) => {
  const s = SHOT[lead.shot];
  if (!s) throw new Error("없는 구도예요: " + lead.shot);
  return /rapier/.test(c.tags) ? s.replace("(holding sword:1.3), (sword:1.1)", "(holding rapier:1.3), (rapier:1.1)") : s;
};

/** 표지 작업 — 일상은 guide(밑그림 작업과 strength)가 붙고, 애니는 바로 그린다 */
export function coverJob(workId, work) {
  const lead = leadOf(workId, work),
    place = (work.places || [])[0];
  let c = (work.cast || []).find((x) => x.code === lead.code);
  if (!c) throw new Error(`대표 인물을 찾지 못했어요: ${workId} ${lead.code}`);
  if (lead.tags && c.tags.includes(lead.tags[0])) c = { ...c, tags: c.tags.replace(lead.tags[0], lead.tags[1]) };
  const fem = isFem(c),
    shot = shotOf(lead, c);
  if (styleOf(workId) === "anime") {
    const { hires, ...j } = animeSafe(animeEmotion(c, place, 1)); // 구도 자리만 바꿈 — 화풍 문구·후처리는 원래 그대로
    return { ...j, pos: must(j.pos, "(upper body:1.1)", shot + (fem ? ANIME_SLIM : "")), neg: j.neg + (fem ? ANIME_NEG_F : ", (from behind:1.3)"), seed: j.seed + (lead.seed || 0), ...SIZE, hires: { ...HIRES, strength: 0.4 } };
  }
  const expr = fem ? TEMPERS[c.temper] || "light smile" : exprM(c.temper),
    scene = [shot, expr, fem ? LIGHT_F : LIGHT_M].join(", ");
  const guide = {
    model: GUIDE.model,
    pos: [Q, fem ? GUIDE_F : GUIDE_M, castTags(c).replace(/\(([^()]+):0\.7\)/g, "$1"), scene, "(fully clothed:1.2)", w((place && place.tags) || "", 1.0)].filter(Boolean).join(", ") + (lead.gpos || ""),
    neg: NQ + SAFE + (lead.gneg || "") + (fem ? NEG_SLIM : GUIDE_M_NEG),
    cfg: GUIDE.cfg,
    steps: GUIDE.steps,
    scheduler: GUIDE.scheduler,
    seed: seedOf(c) + (fem ? 43 : 41) + (lead.gseed || 0),
    ...SIZE,
  };
  // 일상 화풍의 프로필 작업에서 구도·표정 자리만 표지 구도로 바꾼다(화풍 문구·네거티브·후처리는 그대로). 표지는 배경을 덜 흐리게
  const j = assertSafe(profileJob(c, place, { size: SIZE })),
    head = /^(.*?rating_safe, )(.*?)(, 1(?:girl|boy))/.exec(j.pos);
  if (!head) throw new Error("표지 조립: 프로필 문구의 구도 자리를 못 찾았어요");
  let pos = j.pos.replace(head[2], split(scene).map((t) => (t.includes("(") ? t : `(${t}:1.2)`)).join(", "));
  pos = must(pos, "(blurry background:1.5), (depth of field:1.3)", "(blurry background:1.1), (depth of field:1.1)");
  if (lead.eyes && pos.includes(lead.eyes[0])) pos = pos.replace(lead.eyes[0], lead.eyes[1]);
  for (const [a, b] of fem ? SLIM_F : SOFT_M) pos = pos.replace(a, b); // 없으면 그대로(인물마다 문구가 다름)
  pos += (fem ? "" : SOFT_M_ADD) + (lead.pos || "");
  const neg = j.neg + (fem ? NEG_POSE_F + NEG_SLIM : NEG_M + (/armor/.test(c.tags) ? ", (claws:1.3)" : "")) + (lead.neg || "");
  const far = FAR[lead.shot];
  return { ...j, pos, neg, seed: seedOf(c) + 41 + (lead.seed || 0), ...(fem ? { hires: { ...HIRES, strength: 0.4 } } : far ? { hires: { ...HIRES, strength: 0.3 } } : {}), guide: { job: guide, strength: lead.strength || GUIDE.strength } };
}
/** 만든 표지 작업이 지킬 것을 지키는지: 성인 표시·한 사람·미성년과 노출 네거티브(밑그림도), 문구 길이(Runware는 3000자까지) */
export function assertCover(j) {
  for (const x of j.guide ? [j, j.guide.job] : [j]) {
    if (!/adult (wo)?man/.test(x.pos) || !/\bsolo\b/.test(x.pos)) throw new Error("성인 표시·solo가 없어요");
    for (const t of ["child", "loli", "shota", "underage", "toddler", "aged down", "nsfw", "nude"]) if (!x.neg.includes(t)) throw new Error("네거티브에 없어요: " + t);
    if (x.pos.length > 3000 || x.neg.length > 3000) throw new Error(`문구가 3000자를 넘어요(긍정 ${x.pos.length} · 부정 ${x.neg.length})`);
  }
  return j;
}
