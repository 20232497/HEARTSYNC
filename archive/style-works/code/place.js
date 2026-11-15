/* 장소 그림(사람 없는 풍경)의 프롬프트 조립과 '작품 → 화풍' 나누기 — 2026-11-14 사용자와 비교 생성으로 정함(경위와 표는 ../README.md).
   화풍 나누기: 신님들(godseats)만 남성향 애니, 나머지 작품은 모두 일상(사용자 '일단은 신님들만 애니로' — 바뀔 수 있어 이 한 곳에 둠).
   장소는 두 화풍 모두 Nova Orange로 그린다(일상 화풍의 Pony 계열은 풍경·구도를 잘 따르지 않음). 마감 문구와 후처리만 화풍에 맞춘다.
   placeJob(작품 id, 작품, 장소 번호 1~) → 작업 하나. Node에서만 돈다(일상 화풍 값을 읽음). 앱은 이 파일을 쓰지 않는다 */
import { MODEL, POST as ANIME_POST } from "../../style-manime/code/assemble.js";
import { STYLE } from "../../style-mdaily/code/assemble.js";

export const ANIME_WORKS = ["godseats"];
export const styleOf = (workId) => (ANIME_WORKS.includes(workId) ? "anime" : "daily");
// 규격: 3:2 가로. Runware는 64의 배수만 받는다 — 1152×768로 그리고 1728×1152로 키워 다시 그림(tools/content-art.mjs ART_SPECS.place)
export const SIZE = { width: 1152, height: 768, hires: { w: 1728, h: 1152, strength: 0.4 } };

const Q = "masterpiece, best quality, amazing quality, very aesthetic, absurdres, newest, general";
const NQ = "bad quality, worst quality, worst detail, sketch, lowres, jpeg artifacts, text, watermark, signature, logo, border, letterboxed";
const NO_PEOPLE = ", 1girl, 1boy, (people:1.3), (person:1.3), human, crowd, character, face, silhouette";
// 장소 태그에 든 사람 낱말은 뺀다 — 장소 그림에는 사람이 없다(인물 그림의 배경은 화풍 코드가 따로 거름)
const PEOPLE = /martial artists?( seated)?|spectators?|duel|hooded figures?|lone knight|army|crowd|people|figures?/;
const DARK = /night|midnight|evening|dusk|twilight|moonlight/;
// 구도: 정면에서 넓게(사용자 2026-11-14 — 한눈에 알아보기 쉽고 대화 배경으로도 무난)
const FRAME = "(no humans:1.3), scenery, (wide shot:1.1)";
/* 마감: 애니는 인물 그림과 같은 채색 문구, 일상은 일상 인물의 톤(낮은 대비·밝은 노출·부드러운 초점·차분한 색)에 맞춘 값(T1 — 두 값을 그려 비교해 고름) */
const FIN_ANIME = "(soft shading:1.3), (painterly:1.3), (thin lineart:1.3), (depth of field:0.5), (vivid colors:0.8), (detailed background:1.2)";
const LIGHT_DAY = "soft diffused light, brighter exposure, lifted shadows",
  LIGHT_NIGHT = "soft lamp light, dim lighting";
const FIN_DAILY = `(semi-realistic:1.3), (soft focus:0.6), (low contrast:1.1), ${LIGHT_DAY}, (muted colors:0.9), (soft shading:1.2), (painterly:1.0), (depth of field:0.8), light haze`;
/* 모델 버릇: 동양풍 장소에 도리이·후지산·한자 간판이 끼어든다(십절곡 비무대 · 을지로 골목) → 일본풍은 모든 장소에서 기본으로 막는다.
   전통 한국 건물(hanok·joseon…)은 다다미·쇼지 방으로 굳어 나와 한옥 묘사를 더하고 일본식 방을 더 세게 막는다 — 마루의 창호는 그래도 쇼지와 닮게 나온다(남은 과제) */
const NEG_JAPAN = ", (torii:1.4), (shrine:1.2), (mount fuji:1.3), (japanese architecture:1.2), (tatami:1.3), (japanese text:1.3), (kanji:1.2), (kana:1.2)";
const TRAD = /hanok|joseon|traditional korean|gisaeng|bukchon/;
const TRAD_POS = "(korean traditional architecture:1.2), (hanok:1.1), (east asian architecture:0.9), (giwa tiled roof:1.0), (wooden lattice doors with white paper:1.0), (exposed wooden rafters:0.9)";
const TRAD_NEG = ", (japanese architecture:1.4), (japanese room:1.4), (shoji:1.3), (noren:1.2), (futon:1.2), (kotatsu:1.2), (engawa:1.2)";

const w = (tags, k) => tags.split(", ").filter(Boolean).map((t) => `(${t}:${k})`).join(", ");
/** 작품 색조: 화풍 태그(artTags)가 색 두 가지로 끝나면(teal and amber · deep blue and gold …) 그 작품의 모든 장소에 약하게 넣는다 */
export const tone = (work) => (/(?:^|, )((?:[a-z]+ )?[a-z]+ and [a-z]+)$/.exec(work.artTags || "") || [])[1] || "";

/** 장소 그림 작업 — n은 places[]의 순서(1부터, 코드 MP<n>과 같음) */
export function placeJob(workId, work, n) {
  const pl = (work.places || [])[n - 1];
  if (!pl || !pl.tags) throw new Error(`장소 태그가 없어요: ${workId} MP${n}`);
  const tags = pl.tags.split(", ").filter((t) => !PEOPLE.test(t)).join(", "),
    dark = DARK.test(tags),
    trad = TRAD.test(tags),
    anime = styleOf(workId) === "anime",
    tn = tone(work);
  const fin = anime ? FIN_ANIME : dark ? FIN_DAILY.replace(LIGHT_DAY, LIGHT_NIGHT) : FIN_DAILY;
  const night = dark ? (anime ? "(night:1.1), (dim lighting:0.9)" : "(night:1.1)") : "";
  return {
    pos: [Q, FRAME, w(tags, 1.1), trad ? TRAD_POS : "", tn ? `(${tn}:0.8)` : "", night, fin].filter(Boolean).join(", "),
    neg: NQ + NO_PEOPLE + NEG_JAPAN + (dark ? ", (day:1.2), (blue sky:1.1)" : "") + (trad ? TRAD_NEG : ""),
    model: MODEL.air,
    steps: MODEL.steps,
    cfg: MODEL.cfg,
    scheduler: MODEL.scheduler,
    seed: 9100 + n,
    width: SIZE.width,
    height: SIZE.height,
    hires: SIZE.hires,
    post: anime ? ANIME_POST : STYLE.f.post, // 받은 그림에 입히는 후처리 — 애니는 style-manime/code/post.js, 일상은 style-mdaily/code/post.js
  };
}
/** 만든 장소 작업이 지킬 것을 지키는지: 사람 없음 표시와 사람 네거티브, 크기는 64의 배수 */
export function assertPlace(j) {
  if (!j.pos.includes("(no humans:1.3)") || !j.neg.includes("(people:1.3)")) throw new Error("사람 없음 표시가 없어요");
  for (const v of [j.width, j.height, j.hires.w, j.hires.h]) if (v % 64) throw new Error("크기가 64의 배수가 아니에요: " + v);
  if (PEOPLE.test(j.pos.replace("(no humans:1.3)", ""))) throw new Error("장소 문구에 사람 낱말이 남았어요");
  return j;
}
