/* 일상 화풍 두 개의 프롬프트 조립 — 남성향 일상(여성 인물)·여성향 일상(남성 인물). 작품 데이터(cast[]·places[])를 칸에 끼워 긍정·부정 프롬프트와 생성 값을 만든다.
   그림 값(화풍 문구·네거티브·LoRA·후처리)은 보관본 그대로 읽는다: ../mdaily-v6.json(여성) · ../../style-fdaily/fdaily-v7.json(남성) · 고정 태그와 칸 태그는 ../mdaily.json.
   이 파일은 그 값을 인물마다 손대지 않고 쓰는 규칙이다 — 2026-11-13 사용자와 비교 생성으로 정함(경위와 표는 ../README.md '조립 규칙').
   profileJob(인물, 장소) → 프로필(칸 0) · emotionJob(인물, 장소, 칸 1~14) → 감정 그림. Node에서만 돈다(값 파일을 읽음). 앱은 이 파일을 쓰지 않는다 */
import fs from "node:fs";
import { fitStyle, weighTags } from "./style-fit.js";

const J = (rel) => JSON.parse(fs.readFileSync(new URL(rel, import.meta.url), "utf8"));
const toRe = (s) => {
  const m = /^\/(.*)\/([a-z]*)$/.exec(s);
  return new RegExp(m[1], m[2]);
};
const load = (rel) => {
  const j = J(rel);
  return { ...j, fits: j.fits.map((x) => (x.when ? { ...x, when: toRe(x.when) } : x)) };
};
const BASE = J("../mdaily.json");
export const FIX = BASE.fixed; // 품질·수위·규격·미성년 금지 태그
export const SCENES = BASE.sceneTags; // 칸 0~14의 장면·표정 태그(보관본)
export const STYLE = { f: load("../mdaily-v6.json"), m: load("../../style-fdaily/fdaily-v7.json") };
/* 그림 규격(tools/content-art.mjs ART_SPECS) — 프로필 768×1152, 감정 1024×1024. 멀리 잡는 휴식 칸만 1536으로 키워 다시 그린다(얼굴이 작아져 무너짐) */
export const SIZE = { profile: { width: 768, height: 1152 }, emotion: { width: 1024, height: 1024 } };
const HIRES = { w: 1536, h: 1536, strength: 0.4 };
const AGE_LORA = "civitai:468265@539667"; // Age Slider(Pony) — 여성향 일상 보관본이 0.4로 쓰던 것
const MALE = { strip: /makeup|lip|eyelash|glamorous|cute|kawaii|beautiful|female|woman|eyeshadow|eyeliner|blush/i, neg: "1girl, female, breasts, makeup, lipstick, feminine" };

/* ── 정한 값(사용자 2026-11-13) ── */
const EYE_W = 0.7; // 눈색은 은은하게(작품 태그의 눈색을 낮은 가중치로)
const EXPR_W = 1.35; // 감정 칸의 표정은 보관본(1.1·1.15)보다 한 단계 뚜렷하게 — 만화 기호는 넣지 않음
const SLOT_EXPR = { 6: 1.2, 8: 1.2 }; // 분노·공포는 조금 약하게(놀람은 1.35 그대로)
const FRAME_F = "(cowboy shot:1.3)"; // 여성 감정 그림은 얼굴만 가깝게 잡혀서 가슴까지로
/* 칸 태그를 바꾼 것: 공포는 입을 다물고 식은땀이 살짝 */
export const SCENE_FIX = { 8: "upper body, looking at viewer, scared, worried, wide eyes, raised inner eyebrows, closed mouth, (sweat:1.4), (sweatdrop:1.1)" };

export const split = (s) => {
  const out = [];
  let d = 0,
    cur = "";
  for (const ch of String(s || "")) {
    if (ch === "(") d++;
    else if (ch === ")") d--;
    if (ch === "," && d === 0) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
};
const dropTags = (s, list) =>
  split(s)
    .filter((t) => !list.includes(t))
    .join(", ");
export const isFem = (c) => (c.gender ? c.gender === "f" : !/남성/.test(c.look || ""));
export const ageOf = (c) => (Number.isInteger(c.age) ? c.age : Number((/(\d+)세/.exec(c.look || "") || [0, 0])[1]));
export const seedOf = (c) => 7500 + ([...c.code].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 400); // 인물마다 시드 하나 — 칸마다 옷·구도가 덜 바뀜

/* ── 인물 태그 ── 손을 들게 하는 낱말(… on hands · holding …)과 팔·다리 자국(얼굴 흉터로 번짐), 몸 낱말(화풍 몫)을 빼고,
   모델이 딴 뜻으로 읽는 낱말을 바꾸고, 눈색은 낮은 가중치로 */
const HAND_TAG = /\b(?:on|in) (?:hands?|forearms?|arms?|legs?|back)$|^holding /,
  BODY_TAG = /^(?:toned arms|toned body|muscular|abs)$/;
const CAST_SWAP = [[/^reading glasses$/, "glasses"]]; // reading → 책을 들고 읽음
const EYE_COLOR = /^(?:[a-z-]+ )?(?:blue|green|purple|violet|amber|golden|gold|yellow|grey|gray|brown|red|pink|orange|black|hazel|aqua|teal|silver|crimson|emerald)(?:-[a-z]+)? eyes$/;
export function castTags(c) {
  return split(c.tags)
    .filter((t) => !HAND_TAG.test(t) && !BODY_TAG.test(t))
    .map((t) => CAST_SWAP.reduce((a, [re, to]) => a.replace(re, to), t))
    .map((t) => (EYE_COLOR.test(t) ? `(${t}:${EYE_W})` : t))
    .join(", ");
}
/* 옷 규칙: 멜빵 작업복·앞치마만 적히고 윗옷이 없으면 민소매로 그려짐 → 긴소매 셔츠. 셔츠 종류가 안 적힌 남자는 칸마다 티셔츠·풀어 헤친 셔츠로 바뀜 → 깃 달린 셔츠 */
const UNDER = /overalls|apron|suspenders/,
  TOP = /shirt|blouse|sweater|turtleneck|hoodie|jacket|coat|uniform/;
const FACIAL = /stubble|beard|mustache|goatee|facial hair/;
const NEG_CLOTHES_M = "(bare shoulders:1.4), (off shoulder:1.4), (sleeveless:1.3), (pectorals:1.3), (collarbone:1.2), (open collar:1.3), (unbuttoned shirt:1.3)";

/* ── 장소 ── 작품의 places[].tags → 사람 낱말과 그림에서 또렷해지는 센 낱말을 빼고, 모델이 모르는 낱말을 바꾸고, 앞에서 다섯 개를 0.8로. 실내면 indoors.
   밤 장소(night·evening…)는 밤으로: 밤 낱말을 더하고 화풍의 밝은 빛 문구를 전등빛으로 바꾸고 낮 네거티브를 넣는다 */
const PEOPLE = /crowd|people|customers?|audience|spectators?|passers?by|\bman\b|\bwoman\b|\bgirl\b|\bboy\b/;
const STRONG = /neon|bokeh|bottles?|sign\b|close-up|portrait/;
const PLACE_SWAP = [
  [/\bhanok\b/g, "traditional korean house"],
  [/^late night$/, "night"],
];
const INDOOR = /interior|indoors|\broom\b|office|store|shop|\bhall\b|library|lobby|\bcell\b|infirmary|teahouse|bedroom|cathedral|counter|kitchen|classroom|corridor|basement/;
const DARK = /night|midnight|evening|dusk|twilight|moonlight/;
const BG = "(blurry background:1.5), (depth of field:1.3), light haze";
const LIGHT_DAY = "soft diffused light, brighter exposure, lifted shadows",
  LIGHT_NIGHT = "soft lamp light, dim lighting";
const NEG_DAY = "(day:1.2), daylight, sunlight, (blue sky:1.2)";
const NEG_PEOPLE = "(crowd:1.3), (people in background:1.3), (multiple people:1.3), (2girls:1.3), (2boys:1.3)";
export function placeTags(tags) {
  const src = String(tags || "");
  const list = src
    .split(", ")
    .map((t) => PLACE_SWAP.reduce((a, [re, to]) => a.replace(re, to), t.trim()))
    .filter((t) => t && !PEOPLE.test(t) && !STRONG.test(t));
  const out = list.slice(0, 5).map((t) => `(${t}:0.8)`);
  if (INDOOR.test(src) && !/indoors/.test(src)) out.unshift("(indoors:0.8)");
  return out.join(", ");
}

/* ── 나이 ── 화풍 문구는 28세로 고정돼 있어 나이 든 인물이 젊게 나온다 → cast[].age로 나이 문구와 나이 LoRA를 단계별로(사용자: '인상 좋은 중년', 40대는 조금 더, 30대는 조금만).
   50 이상은 주름·늙음 네거티브를 빼고 중년 낱말을 더한다. 33 미만은 보관본 그대로. 여성은 글만으로는 나이가 안 변해 40부터 나이 LoRA를 더한다.
   그려서 본 것: 남 58(1.5)·36·35·34·33(1.2), 여 45(1.5). 남자 40대(1.35)와 여자 50 이상은 인물이 없어 못 그려 봄 */
const OLD = ["old man", "wrinkles", "(wrinkles:1.3)", "(nasolabial folds:1.3)", "(crow's feet:1.2)", "(youthful:1.3)", "youthful", "(young:1.3)"];
export function ageTier(g, age) {
  if (age >= 50) return { w: 1.3, lora: 1.5, add: g === "m" ? "(middle-aged man:1.3)" : "(middle-aged woman:1.2)", negDrop: OLD };
  if (age >= 40) return { w: 1.3, lora: g === "m" ? 1.35 : 1.5, negDrop: OLD.slice(0, 5) };
  if (age >= 33) return { w: 1.2, lora: g === "m" ? 1.2 : 0 };
  return null;
}
function ageFit(g, age, pos, neg, lora) {
  const t = ageTier(g, age);
  if (!t) return { pos, neg, lora };
  pos = pos.replace(/\(28 years old:[\d.]+\)/, `(${age} years old:${t.w})`) + (t.add ? ", " + t.add : "");
  neg = dropTags(neg, t.negDrop || []);
  if (lora.some((l) => l.model === AGE_LORA)) lora = lora.map((l) => (l.model === AGE_LORA ? { ...l, weight: t.lora } : l));
  else if (t.lora) lora = [...lora, { model: AGE_LORA, weight: t.lora }];
  return { pos, neg, lora };
}

/* ── 성격 → 기본 표정(칸 0·1) ── cast[].temper 값 그대로. 낱말은 style-fit.js의 EXPRESSION_RE가 표정으로 아는 것만 —
   모르는 낱말은 행동으로 읽혀 정면 태그가 빠진다. grin·open mouth는 이를 보이며 크게 웃어 쓰지 않는다. 키 여덟 개는 빌드의 작품 검사(CAST_TEMPERS)와 같아야 함 */
export const TEMPERS = {
  도도: "smirk, half-lidded eyes, closed mouth, confident gaze",
  장난: "playful smile, closed mouth, mischievous gaze",
  해맑음: "happy, bright smile, closed mouth",
  수줍음: "shy smile, nervous, closed mouth, soft gaze",
  다정: "gentle smile, relaxed expression, closed mouth, soft gaze",
  냉소: "smirk, half-lidded eyes, closed mouth, unimpressed gaze",
  곧음: "calm, focused, closed mouth, steady gaze",
  차가움: "expressionless, calm, closed mouth, cool gaze",
};
const baseScene = (c, slot) => (TEMPERS[c.temper] ? "upper body, looking at viewer, " + TEMPERS[c.temper] : slot ? SCENES[1] : STYLE[isFem(c) ? "f" : "m"].sceneTag0);

/* ── 휴식(칸 11) ── 얼굴 가까이가 아니라 멀리서 몸 전체(사용자). 남성은 소파에 푹 기대 앉은 모습. 여성은 몸 전체를 잡으면 치마 아래 맨다리가 크게 나와
   담요를 덮는데, 이 모델은 문구만으로는 담요를 넣으면 얼굴 가까이만 그린다 → 구도를 잘 따르는 모델(남성향 애니의 Nova Orange)로 밑그림을 먼저 그리고(guide),
   그 그림을 밑그림으로 이 화풍이 다시 그린다(strength 0.75). 밑그림이 앉은 자세로 나오면 가깝게 나오기도 해서 시드를 바꿔 고른다 */
const FAR = "(close-up:1.4), (portrait:1.3), (upper body:1.3), (cowboy shot:1.2)";
const REST = {
  m: {
    scene: "(full body:1.5), (wide shot:1.4), sleeping, closed eyes, (reclining:1.3), (slouching:1.2), sitting on sofa, (leaning back:1.3), (head back:1.1), arms at sides, relaxed, peaceful",
    neg: FAR + ", (barefoot:1.3), (stiff:1.2), (sitting upright:1.3), (arms crossed:1.2)",
  },
  f: {
    scene: "(full body:1.5), (wide shot:1.4), (from side:1.1), sleeping, closed eyes, lying on sofa, (blanket:1.3), (covered with blanket:1.3), peaceful",
    neg: FAR + ", (barefoot:1.4), (bare legs:1.5), (thighs:1.4), (feet:1.3), (panties:1.5), upskirt",
  },
};
const GUIDE = {
  model: "civitai:967405@1428332", // Nova Orange XL v6.0 — archive/style-manime
  q: "masterpiece, best quality, amazing quality, very aesthetic, absurdres, newest, general",
  subj: "1girl, solo, (adult woman:1.2), (mature female:0.8)",
  scene: "(full body:1.4), (wide shot:1.3), (from side:1.1), sleeping, closed eyes, lying on sofa, (blanket:1.4), (covered with blanket:1.4), (blanket over legs:1.3), pillow, indoors, living room, dim lighting, night",
  neg:
    "bad quality, worst quality, worst detail, sketch, lowres, jpeg artifacts, text, watermark, signature, bad anatomy, bad hands, child, loli, shota, underage, toddler, aged down, baby face, nsfw, nude, " +
    "(cleavage:1.5), (bare legs:1.5), (barefoot:1.4), (feet:1.3), (thighs:1.4), (panties:1.5), upskirt, (close-up:1.4), (portrait:1.3), (upper body:1.3), chibi, (big head:1.2), multiple girls",
  strength: 0.75,
};
const guideJob = (c, seed) => ({
  model: GUIDE.model,
  pos: [GUIDE.q, GUIDE.subj, c.tags, GUIDE.scene].join(", "),
  neg: GUIDE.neg,
  cfg: 4,
  steps: 28,
  scheduler: "Euler a",
  seed,
  width: 1024,
  height: 1024,
});

/* ── 조립 ── 순서는 보관본 그대로: 품질 → 수위 → 장면·표정 → 인원 + 인물 태그 → (남) 앞쪽 몸 문구 → 배경 → 화풍 문구 */
function build(c, place, scene, kind, slot, negAdd) {
  const g = isFem(c) ? "f" : "m",
    st = STYLE[g],
    male = g === "m";
  if (male) scene = dropTags(scene, ["half-lidded eyes"]); // 남성은 피곤해 보여 뺌(보관본 v7)
  if (!male && kind === "emotion" && /upper body/.test(scene)) scene = FRAME_F + ", " + scene; // 눕거나 싸우는 칸은 그 칸의 구도 그대로
  const subj = male ? "1boy, male focus, solo" : "1girl, solo",
    cast = castTags(c),
    raw = [scene, subj, cast].join(", ");
  const fit = fitStyle(st, raw, scene);
  let style = fit.prompt;
  if (male) style = split(style).filter((t) => !MALE.strip.test(t)).join(", ");
  const tags = (place && place.tags) || "",
    dark = DARK.test(tags);
  if (dark) style = style.replace(LIGHT_DAY, LIGHT_NIGHT);
  const bg = [BG, placeTags(tags), dark ? "(night:1.2), (dark:0.8)" : ""].filter(Boolean).join(", ");
  const shirt = male && /\bshirt\b/.test(c.tags) && !/t-shirt|v-neck|turtleneck|collared shirt/.test(c.tags) ? ", (collared shirt:1.2), (buttons:1.0)" : "";
  const lead = male ? st.lead.tags + ", (fully clothed:1.2)" + shirt : "";
  const under = UNDER.test(c.tags) && !TOP.test(c.tags) ? "(long sleeves:1.2), (shirt:1.2)" : "";
  // 표정 가중치는 칸(장면) 태그에만 올린다 — 인물 태그의 눈썹·입술 낱말은 보관본 가중치 그대로
  const content = [weighTags(scene, st.contentWeight, SLOT_EXPR[slot] || EXPR_W), subj, weighTags(cast, st.contentWeight, st.exprWeight), under].filter(Boolean).join(", ");
  const pos = [FIX.qualityPos, FIX.ratingPos, content, lead, bg, style].filter(Boolean).join(", ");
  if (male && FACIAL.test(c.tags)) fit.neg = dropTags(fit.neg, ["(stubble:1.5)", "(facial hair:1.5)", "(beard:1.4)"]); // 수염 낱말이 있는 남자
  const neg = [FIX.qualityNeg, dropTags(FIX.IMG_NEG, ["blurry"]), FIX.NEG_MINOR, FIX.ratingNeg, male ? MALE.neg : "", fit.neg, NEG_PEOPLE, male ? NEG_CLOTHES_M : "", dark ? NEG_DAY : "", negAdd || ""]
    .filter(Boolean)
    .join(", ");
  const a = ageFit(g, ageOf(c), pos, neg, st.lora);
  return { g, st, ...a };
}
const job = (b, kind, seed, o) => ({
  pos: b.pos,
  neg: b.neg,
  model: b.st.model.id,
  steps: b.st.gen.steps,
  cfg: b.st.gen.cfg,
  scheduler: b.st.gen.scheduler,
  lora: b.lora,
  seed,
  ...(o.size || SIZE[kind]),
  post: b.st.post, // 받은 그림에 입히는 후처리 — ./post.js stylePost
});

/** 프로필(칸 0) — 가슴까지, 성격별 기본 표정, 작품의 장소를 흐린 배경으로 */
export function profileJob(c, place, o = {}) {
  return job(build(c, place, baseScene(c, 0), "profile", 0), "profile", o.seed || seedOf(c), o);
}
/** 감정 그림(칸 1~14) — 정사각, 가슴까지. 칸 11(휴식)은 몸 전체: hires로 키우고, 여성은 guide(밑그림 작업과 strength)가 붙는다 */
export function emotionJob(c, place, slot, o = {}) {
  const seed = o.seed || seedOf(c);
  if (slot === 11) {
    const g = isFem(c) ? "f" : "m",
      j = { ...job(build(c, place, REST[g].scene, "emotion", 11, REST[g].neg), "emotion", seed, o), hires: HIRES };
    return g === "f" ? { ...j, guide: { job: guideJob(c, seed), strength: GUIDE.strength } } : j;
  }
  const scene = slot === 1 ? baseScene(c, 1) : SCENE_FIX[slot] || SCENES[slot];
  return job(build(c, place, scene, "emotion", slot), "emotion", seed, o);
}
/** 만든 작업이 지킬 것을 지키는지: 성인 표시, 한 사람, 미성년·노출 네거티브(밑그림 작업도) */
export function assertSafe(j) {
  for (const x of j.guide ? [j, j.guide.job] : [j]) {
    if (!/adult (wo)?man/.test(x.pos) || !/\bsolo\b/.test(x.pos)) throw new Error("성인 표시·solo가 없어요");
    for (const t of ["child", "loli", "shota", "underage", "toddler", "aged down", "nsfw", "nude"]) if (!x.neg.includes(t)) throw new Error("네거티브에 없어요: " + t);
  }
  return j;
}
