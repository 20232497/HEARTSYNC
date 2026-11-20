/* 작품 표지(960×1280)의 프롬프트 조립 — 2026-11-16~20 사용자와 비교 생성으로 다시 정함(경위와 표는 ../README.md '표지'). 2026-11-14의 일상 화풍 기준 규칙을 대체한다.
   모델은 하나(Nova Orange — 남성향 애니 v9). 그 화풍의 감정 그림 칸 1 작업에서 **구도·표정 세기·빛**만 표지 값으로 바꾼다 — 얼굴·피부·마감 문구는 화풍 그대로(화풍이 바뀌면 표지도 따라감).
   표지는 네 유형(COVERS[작품].type): close 얼굴 가까이(가슴 위) · scene 한 명 + 배경 · group 세 사람(./cover-group.js — 배경과 인물을 따로 그려 오려 얹음) · symbol 상징물(사람 없음).
   받은 그림에는 표지 후처리(./cover-post.js) → 로고(./logo.js + ./logos.js) 순서로 입힌다.
   coverPlan(작품 id, 작품) → { type, mood, job | parts…, post }. Node에서만 돈다. 앱은 이 파일을 쓰지 않는다 */
import { emotionJob, assertSafe, isFem, MODEL } from "../../style-manime/code/assemble.js";
import { COVER_POST } from "./cover-post.js";

export const SIZE = { width: 960, height: 1280 };
export const HIRES = { w: 1344, h: 1792, strength: 0.4 }; // Runware는 64의 배수만 — 받은 뒤 960×1280으로 줄여 싣는다
export const Q = "masterpiece, best quality, amazing quality, very aesthetic, absurdres";
export const NQ = "bad quality, worst quality, worst detail, sketch, lowres, jpeg artifacts, text, watermark, signature, logo, border, letterboxed";
// 사람 없는 그림(배경·상징물)의 네거티브 — 동양풍 장면에 도리이·한자 간판이 끼어드는 모델 버릇도 막는다
export const NO_PEOPLE = ", 1girl, 1boy, (people:1.3), (person:1.3), human, crowd, character, face, silhouette, animal, creature, monster, horse, (torii:1.4), (japanese text:1.3), (kanji:1.2)";

/* ── 구도 ── 얼굴 가까이는 '가슴 위까지'(사용자 2026-11-16), 한 명 + 배경은 허리 위. 카메라 기울임은 약하게(0.25 — '그늘은 좋고 각도는 덜') */
export const FRAME = {
  close: "(fully clothed:1.2), (portrait:1.1), (upper body:1.2), (close-up:0.5), (head tilt:0.8), looking at viewer",
  scene: "(fully clothed:1.2), (upper body:1.2), (cowboy shot:0.5), (head tilt:0.5), looking at viewer"
};
const TILT = "(dutch angle:0.25)";

/* ── 빛 ── 어둡고 피폐하게 + 작품 색 조명을 세게('어두움은 좋고 색 조명을 더'). 밝은 작품(mood: "warm" — 편의점·하숙집)은 어둡게 하지 않는다('밝게 두기').
   color는 작품 색을 주된 빛과 가장자리 빛으로 옮긴 문구(가중치는 비교 생성으로 올린 값 그대로) */
const DEEP = "(chiaroscuro:1.15), (shadow on face:0.85), (side lighting:0.9), (dark background:0.9), (dim lighting:0.9), (dark:0.7), (low key:0.6), (muted colors:0.3)";
export const light = (color, mood) =>
  mood === "warm"
    ? `(cinematic lighting:1.3), (dramatic lighting:1.1), (chiaroscuro:0.95), (side lighting:0.9), (dim lighting:0.6), (muted colors:0.4), ${color}, (backlighting:0.5)`
    : `(cinematic lighting:1.3), (dramatic lighting:1.1), ${DEEP}, ${color}, (rim lighting:1.2), (colorful lighting:0.5), (backlighting:0.5)`;
/** 사람 없는 그림의 빛 — 밝은 작품은 햇빛 */
export const sceneLight = (color, mood) => (mood === "warm" ? "(cinematic lighting:1.1), (soft sunlight:1.0), (warm lighting:1.0), (rim light:0.9), (backlighting:0.5)" : light(color, mood));

/* ── 피폐미 ── 지친 눈매·창백한 피부(약하게), 흐트러진 머리(작품마다 hair), 무심한 시선. 옷은 여민 채(노출 없음), 성인 표시와 미성년 네거티브는 화풍 그대로.
   tired eyes는 눈을 감기기 쉬워 가중치를 낮게 둔다(감은 눈 네거티브는 화풍에 있음) */
export const WORN = {
  f: "(melancholic:0.6), (pale skin:0.4), (tired eyes:0.3)",
  fWarm: "(melancholic:0.3), (pale skin:0.4), (tired eyes:0.2)",
  m: "(tired eyes:0.45), (bags under eyes:0.35), (melancholic:0.7), (jaded:0.5), (pale skin:0.5)"
};
export const GAZE = {
  f: "(aloof:0.6), (cold gaze:0.4), (looking down at viewer:0.5)",
  m: "(looking down at viewer:1.0), (cold gaze:0.7), (indifferent:0.7), (furrowed brow:0.4)"
};
const HAIR_DEFAULT = "(loose hair strands:0.9), (messy hair:0.9)";
const NEG_COVER = ", (simple background:1.2), (multiple swords:1.3)";
const NEG_DARK = ", (bright:1.2), (cheerful:1.2), (vivid colors:1.1)";

/* ── 작품마다 ── type 유형 · lead 대표 인물 코드 · pose 손짓·소품 · frame 구도(없으면 유형의 기본) · add 장면에 더할 낱말 · hair 흐트러짐(머리 모양에 맞춤) · color 색 조명
   · flat 카메라를 기울이지 않음 · level 아래에서 올려다보는 각도를 뺌 · swap [찾을 태그, 바꿀 태그] 표지에서만 인물 태그를 바꿈 · rep [찾을 문구, 바꿀 문구] · neg 눈으로 보고 더한 네거티브.
   함정(그리며 배움): 옷 낱말의 ink(먹빛)는 어두운 분위기 문구와 만나 뺨의 먹물 얼룩·문신이 됨 · red thread on ear는 뺨의 붉은 무늬가 됨 → 표지에서는 낱말을 바꾸고 얼굴 무늬를 막음
   · short hair와 shoulder-length hair가 같이 있으면 짧게 나옴(아델) · 배경 간판에는 글자·숫자가 그려짐(윤해라·서도윤) */
export const COVERS = {
  yunhaera: {
    type: "close", lead: "YHR", pose: "(hand on own chin:1.0)", hair: "(loose hair strands:0.9), (hair strand over face:0.5)",
    color: "(pink lighting:1.25), (purple rim light:1.25), (neon city glow:0.95)", neg: ", (billboard:1.3), (sign:1.3), (poster:1.2), (numbers:1.2)"
  },
  geumseo: {
    type: "close", lead: "ADL", pose: "(holding book:1.1)", hair: "(messy hair:1.0), (hair over one eye:0.6), (loose hair strands:0.8)",
    color: "(blue lighting:1.15), (golden rim light:1.25), (candlelight:1.05)",
    rep: [["(short hair:1.1), (shoulder-length hair:1.1)", "(medium hair:1.2), (shoulder-length hair:1.3)"]], neg: ", (short hair:1.3), (very short hair:1.3)"
  },
  seodoyun: {
    type: "close", lead: "SDY", frame: "(fully clothed:1.2), (upper body:1.2), (cowboy shot:0.5), (head tilt:0.6), looking at viewer", level: true,
    pose: "(hand in own hair:0.9)", add: "(messy hair:1.0), (night:0.9), (window blinds:0.8), (office:0.7), (desk:0.6)",
    hair: "(messy hair:1.2), (disheveled hair:0.9), (hair over eyes:0.7)", color: "(blue lighting:1.15), (amber rim light:1.25), (neon light:0.95)",
    neg: ", (bright:1.1), (daylight:1.2), (neon sign:1.4), (sign:1.3), (chinese text:1.3), (cup:1.2), (tears:1.3), (close-up:1.2), (face focus:1.1)"
  },
  baekyeon: {
    type: "close", lead: "BY", pose: "(holding cup:1.1), (teacup:1.0)", hair: "(messy hair:1.0), (hair over one eye:0.6), (loose hair strands:0.8)",
    color: "(orange lighting:1.25), (red rim light:1.15), (lantern light:1.05)",
    swap: [["red thread on ear", "red tassel earring, single earring"], ["ink black durumagi", "black durumagi"]],
    neg: ", (blood:1.4), (blood on face:1.4), (facial mark:1.3), (facial tattoo:1.4), (scar:1.2), (cheek mark:1.3), (face paint:1.3), (tattoo:1.3), (face markings:1.3), (ink:1.4), (ink splatter:1.4), (stain:1.2), (dirty face:1.3)"
  },
  hangyeoul: {
    type: "scene", lead: "HGU", mood: "warm", flat: true, frame: "(fully clothed:1.2), (upper body:1.1), sitting, (head tilt:0.6), looking at viewer",
    pose: "(elbow rest:1.0), (head rest:1.1), counter", add: "(night:0.9)", color: "(teal lighting:0.8), (yellow rim light:0.9)",
    rep: [["(half-closed eyes:0.8), (narrow eyes:0.6)", "(half-closed eyes:0.6), (narrow eyes:0.5)"]] // 밝은 인물은 눈을 덜 가늘게
  },
  daeyeon: {
    type: "scene", lead: "IHW", pose: "(hand on own chest:1.0), (falling petals:0.8), (night:1.0)", hair: "(loose hair strands:0.9), (stray hair:0.7)",
    color: "(blue moonlight:1.25), (amber rim light:1.15), (torchlight:0.85)", neg: ", (forehead mark:1.3), (bindi:1.3)"
  },
  lethe: {
    type: "scene", lead: "CSH", pose: "(holding pocket watch:1.1), (pocket watch:1.0)", hair: "(loose hair strands:0.9), (hair falling over forehead:0.8), (messy hair:0.8)",
    color: "(teal lighting:1.25), (golden rim light:1.25)"
  },
  // 카엘: 한쪽 무릎을 꿇고 검을 몸 앞에 수직으로(사용자 2026-11-16)
  kael: {
    type: "scene", lead: "KAEL",
    frame: "(fully clothed:1.2), (kneeling:1.2), (on one knee:1.3), (sword planted in ground:1.2), (vertical sword:1.1), (both hands on hilt:1.2), (hands on hilt:1.1), (longsword:1.0), (cowboy shot:1.0), looking at viewer",
    hair: "(messy hair:1.1), (hair over eyes:0.6)", color: "(blue lighting:1.15), (golden rim light:1.25), (holy light:1.05)",
    neg: ", (squatting:1.3), (crouching:1.2), (hand on ground:1.3), (all fours:1.3), (sitting:1.1)"
  },
  godseats: { type: "group", mood: "dark", color: "(pink lighting:1.15), (purple rim light:1.25)" },
  hasuk: { type: "group", mood: "warm", color: "(warm lighting:1.0), (golden rim light:0.9)" },
  sipjeol: { type: "group", mood: "dark", color: "(orange lighting:1.15), (blue rim light:1.15)" },
  hwanghu: { type: "group", mood: "dark", color: "(golden lighting:1.25), (red rim light:1.15), (candlelight:0.95)" },
  // 상징물: 사람 없이 작품의 상징 장면만(주인공이 정해지지 않은 작품)
  minwon: {
    type: "symbol", seed: 9305, neg: ", (statue:1.3)",
    tags: "dark empty government office corridor at midnight, single glowing number ticket machine kiosk, one lit service window at the far end, row of empty plastic waiting chairs, flickering fluorescent ceiling light, deep shadows, light rays, eerie, teal and amber"
  },
  baekya: {
    type: "symbol", seed: 9301,
    tags: "armored train in a blizzard at night, snowstorm, headlight beam cutting through snow, endless snowfield, frost, orange glow from windows, dramatic clouds, post-apocalyptic, low angle, from below"
  }
};
/** 그 작품의 표지 설계 — 표에 없는 새 작품은 첫 인물을 가까이 잡은 기본 설계(정하면 COVERS에 적는다) */
export const coverOf = (workId, work) => COVERS[workId] || { type: "close", lead: ((work.cast || [])[0] || {}).code, color: "(rim light:1.1)" };
/** 대표 인물 코드(단체는 가운데 인물 — ./cover-group.js가 알려 줌, 상징물은 없음) */
export const leadOf = (workId, work) => ({ code: coverOf(workId, work).lead || "" });

const w = (tags, k) => tags.split(", ").filter(Boolean).map((t) => `(${t}:${k})`).join(", ");
const must = (s, a, b) => {
  const r = s.replace(a, b);
  if (r === s) throw new Error("표지 조립: 바꿀 자리를 못 찾았어요 — " + a);
  return r;
};
// 화풍(감정 그림)의 구도 자리와 빛 자리 — 화풍 코드가 이 문구를 바꾸면 여기서 던져 알려 준다
const FRAME0 = "(fully clothed:1.2), (standing:1.0), (upper body:1.1), (head tilt:0.5), (facing viewer:1.0), looking at viewer";
const LIGHT0 = /(\(sharp focus:0\.9\), ).*(, masterpiece, )/;
const BLUR0 = /\(blurry background:[\d.]+\)/; // 화풍의 장소 칸 끝(배경 흐림)
const SOLO0 = new RegExp(FRAME0.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ", .*?" + BLUR0.source);
const cut = (s, t) => s.replace(t + ", ", "").replace(", " + t, "");

/** 인물을 찾아 표지용 태그 바꾸기(swap)를 입힌다 — 작품 태그에서 그 낱말이 사라졌으면 그대로 둔다 */
export function castOf(work, code, swap) {
  let c = (work.cast || []).find((x) => x.code === code);
  if (!c) throw new Error(`표지 인물을 찾지 못했어요: ${work.id || ""} ${code}`);
  for (const [a, b] of swap || []) if (c.tags.split(", ").includes(a)) c = { ...c, tags: c.tags.split(", ").map((t) => (t === a ? b : t)).join(", ") };
  return c;
}
/** 화풍의 칸 1 작업을 표지 인물 문구로 — v: COVERS의 한 줄(또는 단체의 인물 한 명), o: { frame, mood, color, place, solo(오려 붙일 인물 — 배경 없이, 시선 문구 없이), away(옆을 봄) } */
export function styled(c, v, o) {
  const fem = isFem(c),
    dark = o.mood !== "warm",
    j = assertSafe(emotionJob(c, o.place, 1));
  const shot = [v.frame || o.frame, v.pose, v.add, v.flat || o.solo ? "" : TILT, o.away ? "" : "(looking at viewer:1.1)"].filter(Boolean).join(", ");
  // 오려 붙일 인물은 구도 자리 뒤의 장소 칸(배경 흐림까지)을 통째로 단순한 배경으로 바꾼다 — 장소에 딸린 네거티브(젖은 옷·낮밤)는 그대로 남는다
  let pos = o.solo ? must(j.pos, SOLO0, () => shot + ", (simple background:1.4), (grey background:1.2)") : must(j.pos, FRAME0, shot);
  const miss = (v.rep || []).filter(([a]) => !pos.includes(a)).map(([a]) => a); // 작품 태그가 바뀌어 손질 자리가 사라졌으면 건너뛰고 알림(jobs.mjs check)
  for (const [a, b] of v.rep || []) pos = pos.replace(a, b);
  if (dark) pos = pos.replace("(light smile:0.9)", "(light smile:0.7)").replace("(expressionless:0.5)", "(expressionless:0.7)"); // 어두운 표지는 덜 웃고 더 무심하게
  const worn = dark ? [fem ? WORN.f : WORN.m + (o.solo ? "" : ", (hair over eyes:0.4)"), v.hair || HAIR_DEFAULT, GAZE[fem ? "f" : "m"]] : o.solo || !fem ? [] : [WORN.fWarm];
  if (worn.length) pos = must(pos, "(flawless skin:0.9)", [...worn, "(flawless skin:0.9)"].join(", "));
  pos = must(pos, LIGHT0, (m, a, b) => a + (o.solo && !dark ? "(cinematic lighting:1.3), (dramatic lighting:1.1), (chiaroscuro:0.8), (side lighting:0.8), " + o.color + ", (backlighting:0.5)" : light(o.color, o.mood)) + b);
  if (o.solo) {
    // 오려 붙일 인물: 내려다보는 시선과 어두운 배경 문구를 뺌(배경은 따로 그려 깐다)
    pos = cut(pos.replace(/\(looking down at viewer:[\d.]+\), /g, ""), "(dark background:0.9)");
  } else {
    if (v.type === "scene") pos = must(pos, BLUR0, "(detailed background:1.1), (depth of field:0.7)");
    if (!fem && !v.level) pos = must(pos, "(flawless skin:0.9)", "(from below:0.3), (flawless skin:0.9)"); // 남자는 살짝 올려다보는 각도
  }
  // 밝은 작품은 화풍(감정 그림)의 '밝음 막기'를 뺀다 — 밝게 두는 표지라서
  const neg = (dark ? j.neg : j.neg.replace(", (bright:1.1)", "")) + (o.solo ? ", (multiple swords:1.3)" : NEG_COVER) + (dark ? NEG_DARK : "") + (v.neg || "");
  const { post, ...base } = j; // 화풍 후처리 대신 표지 후처리를 입힌다
  return { ...base, pos, neg, ...SIZE, hires: { ...HIRES }, ...(miss.length ? { miss } : {}) };
}
/** 사람 없는 그림(단체의 배경) — tags는 장면 낱말, 마감은 화풍의 칠에서 머리·얼굴 문구를 뺀 것(넣으면 사람 머리가 그려짐) */
export function sceneJob(tags, color, mood, seed) {
  const fin = "(semi-realistic:1.15), (digital painting:1.2), (painterly:1.1), (realistic shading:1.0), (depth of field:1.0), (sharp focus:0.9)";
  const pos = [Q, "(no humans:1.4), scenery, (wide shot:1.2), (high angle:0.5), (perspective:1.1)", w(tags, 1.1), fin, sceneLight(color, mood), "(detailed background:1.2)"].join(", ");
  const neg = NQ + NO_PEOPLE + ", (from below:1.2), (aerial view:1.3), (map:1.2), (abstract:1.2), (girl:1.4), (lying:1.4), (hair:1.3), (body:1.3), (sign:1.2), (neon sign:1.3)";
  return { model: MODEL.air, pos, neg, cfg: MODEL.cfg, steps: MODEL.steps, scheduler: MODEL.scheduler, seed, ...SIZE, hires: { ...HIRES } };
}
/* 상징물 표지의 마감과 빛 — 2026-11-16에 확정된 두 장(민원실·백야호)을 그린 문구 그대로(그 뒤의 인물 마감 값으로 바꾸지 않음 — 다시 그려 확인하지 않았다) */
const SYMBOL_FIN =
  "(shiny hair:1.0), (hair strands:1.3), (detailed hair:1.2), (pale skin:1.0), (semi-realistic:0.8), (digital painting:1.1), (painterly:1.2), (soft shading:1.1), (soft skin shading:1.0), " +
  "(soft focus:0.4), (depth of field:1.0), (bokeh:0.5), (muted colors:0.5)";
const SYMBOL_LIGHT = "(cinematic lighting:1.2), (dramatic lighting:0.9), (rim light:0.9), (backlighting:0.5), (dim lighting:0.5), (volumetric lighting:1.1), (fog:0.8), (detailed background:1.2)";
function symbolJob(v) {
  const pos = [Q, "(no humans:1.3), scenery", w(v.tags, 1.1), SYMBOL_FIN, SYMBOL_LIGHT].join(", ");
  return { model: MODEL.air, pos, neg: NQ + NO_PEOPLE + ", (bright:1.1), (flat lighting:1.2)" + (v.neg || ""), cfg: MODEL.cfg, steps: MODEL.steps, scheduler: MODEL.scheduler, seed: v.seed, ...SIZE, hires: { ...HIRES } };
}

/** 한 장으로 끝나는 표지(가까이·한 명 + 배경·상징물)의 계획. 단체는 ./cover-group.js의 groupPlan */
export function coverPlan(workId, work) {
  const v = coverOf(workId, work);
  if (v.type === "group") throw new Error("단체 표지는 cover-group.js의 groupPlan으로 뽑아요: " + workId);
  if (v.type === "symbol") return { type: v.type, mood: "dark", job: assertCover(symbolJob(v)), post: COVER_POST.symbol };
  const mood = v.mood || "dark",
    c = castOf({ ...work, id: workId }, v.lead, v.swap);
  const job = styled(c, v, { frame: FRAME[v.type], mood, color: v.color, place: (work.places || [])[0] });
  return { type: v.type, mood, lead: v.lead, job: assertCover(job), post: COVER_POST[mood] };
}
/** 만든 표지 작업이 지킬 것을 지키는지: 인물 그림은 성인 표시·한 사람·미성년과 노출 네거티브, 사람 없는 그림은 사람 네거티브, 문구 길이(Runware는 3000자까지) */
export function assertCover(j) {
  if (/\(no humans:/.test(j.pos)) {
    for (const t of ["1girl", "1boy", "(people:1.3)"]) if (!j.neg.includes(t)) throw new Error("사람 네거티브가 없어요: " + t);
  } else {
    if (!/adult (wo)?man/.test(j.pos) || !/\bsolo\b/.test(j.pos)) throw new Error("성인 표시·solo가 없어요");
    for (const t of ["child", "loli", "shota", "underage", "toddler", "aged down", "nsfw", "nude"]) if (!j.neg.includes(t)) throw new Error("네거티브에 없어요: " + t);
  }
  if (j.pos.length > 3000 || j.neg.length > 3000) throw new Error(`문구가 3000자를 넘어요(긍정 ${j.pos.length} · 부정 ${j.neg.length})`);
  return j;
}
