/* 그림체: 모델 목록·내장 기본 화풍(BUILTIN_SETS)·프리셋·세트(ZIP 가져오기, Claude가 그림체 태그 작성), 상황에 맞는 그림체 고르기(styleFor) */
import { CFG } from "../core/config.js";
import { S, hasClaudeKey } from "../core/state.js";
import { esc } from "../core/util.js";
import { refDataURL } from "./runware.js";
import { validRef } from "../services/images.js";
import { FDAILY, FRONT_WHEN } from "./style-fdaily.js";

/* ---------------------------------------------------------------- AI 이미지 생성: Runware API (SDXL 계열 모델, Danbooru 영문 태그 프롬프트)
   이름·설명은 한국어. 모델은 영문 태그만 알아들으므로 한글(외모·키워드북·직접 쓴 그림체)은 보내기 직전 ponyTags()가 영문 태그로 바꿈 */
/* 이미지 모델(Runware AIR). arch마다 품질 태그·수위 태그·CFG가 다름. 모두 Runware에서 실제 생성 확인(2026-10) */
export const IMG_MODELS = [
  // 세미리얼은 CFG 7이면 인형처럼 인위적, 4.5면 표정을 안 따름 → 6 + 플라스틱·인형 피부 네거티브(2026-10·11 비교 생성으로 정함)
  { id: "civitai:548016@861939", name: "세미리얼 PonyXL (Run七八造 v2)", arch: "pony", cfg: 6, neg: "3d, cgi, plastic skin, doll, airbrushed, oversaturated, heavy makeup" },
  { id: "civitai:142601@686323", name: "한국 웹툰 PonyXL (ToonyStark)", arch: "pony" },
  { id: "civitai:827184@1761560", name: "애니 일러스트 (WAI Illustrious v14)", arch: "illustrious" },
  // 기본 화풍의 반실사 모델(2026-11-03 비교 생성 — CyberRealistic·hPonyRealism·DTFMix·Zyntoon·CyberIllustrious·HoJ와 견줘 참고 그림의 윤기 있는 2.5D 마무리에 가장 가까움)
  { id: "civitai:1160480@1449034", name: "세미리얼 Illustrious (semILust v2)", arch: "illustrious" },
  // 여성향(남성 인물) 기본 화풍 모델(2026-11-04 체크포인트 19종 추가 비교 — 참고 그림의 부드러운 꽃미남에 가장 가깝고, 남자를 여자로 그리지 않음)
  { id: "civitai:959624@1074388", name: "2.5D 웹툰 SDXL (YabaL Mix)", arch: "sdxl" },
  // 남성향 애니 기본 화풍 모델(2026-11-04 WAI·Nova Anime·Nova Orange·Illustrious 2.0·Mistoon과 비교 — 참고 키 비주얼의 선명한 선과 회화적 고대비에 가장 가까움)
  { id: "civitai:140272@1617798", name: "애니 키 비주얼 (Hassaku XL v2.1)", arch: "illustrious" },
  // Pony Diffusion V6 XL(Civitai 257749·버전 290640)은 Runware 자체 호스팅 ID "imagerouter:"로만 불러짐
  { id: "imagerouter:257749@290640", name: "Pony Diffusion V6 XL", arch: "pony", pos: "source_anime" }
];
export const ARCH = {
  pony: { pos: "score_9, score_8_up, score_7_up", neg: "score_4, score_5, score_6, source_pony, source_furry", cfg: 7 },
  illustrious: { pos: "masterpiece, best quality, amazing quality, very aesthetic, absurdres, newest", neg: "bad quality, worst quality, worst detail, sketch, lowres, jpeg artifacts", cfg: 6 },
  sdxl: { pos: "masterpiece, best quality, highly detailed", neg: "worst quality, low quality, lowres", cfg: 7 }
};
export const imgModelInfo = (id) => IMG_MODELS.find((m) => m.id === id) || { id, name: id, arch: "pony" };
/* ---------------------------------------------------------------- 내장 기본 화풍(2026-11-03, 사용자가 준 참고 그림 59장 — 프롬1 남성향 일상 14·여성향 일상 10, 프롬2 남성향 애니 13·여성향 세계관 표지 11, 프롬3 남성향 세계관 표지 11)
   네 묶음(일상 둘·표지 둘)은 같은 한국 반실사 2.5D 계열이라 공통 중간값(SEMI)을 두고 묶음마다 조명·색·마무리만 더함. 애니 묶음만 다른 모델.
   참고 그림 자체는 외부 서비스 화면이라 저장소·배포물에 넣지 않고(CLAUDE.md), 뽑아낸 프롬프트·모델과 우리가 만든 견본(styles/<id>-n.jpg)만 둠.
   사용자가 같은 이름(match)의 세트를 ZIP으로 올리면 그 세트가 덮고(overrides), 세트를 지우면 다시 내장으로 돌아옴(effectiveSet). 태그는 그림체만(인물·구도·배경 금지).
   samples: 저장소 styles/<id>-1.jpg … 에 둔 견본 수(설정 카드에 보여 줌 — 없는 파일을 가리키면 404가 나므로 수를 맞춰 적음) */
/* 비교 생성(2026-11-03, 6라운드 66장)으로 정함: 반실사 네 묶음은 semILust v2(Illustrious) — Run七八造(예전 기본)는 붓 자국이 보이는 일러스트, 포토리얼 계열은 사진처럼 나와서 뺌.
   남성향 일상은 2026-11-04 재조정 — realistic skin texture를 빼고 (semi-realistic:1.2)·(large eyes:1.1)·smooth glossy skin·airbrushed·soft focus·subsurface scattering, 모델도 YabaL로(semILust는 사진처럼 번들거리고 무대 조명을 끌어옴; 'idol-like'·'bust shot'은 각각 무대 배경·자세 충돌 때문에 뺌). 남성향 표지(mworld)만 semILust.
   여성향 인물은 사진 같은 성인 남성으로 치우쳐 (bishounen:1.2)·pretty boy·pale smooth skin으로 참고 그림의 부드러운 꽃미남 쪽으로 당김(realistic skin texture는 뺌).
   여성향 표지는 2026-11-04 체크포인트 19종을 더 비교해 YabaL Mix 2.5D XL(sdxl)로 — semILust·myzy Korean XL보다 참고 그림의 부드럽고 창백한 꽃미남에 가깝고 표지·의상 조합에서도 남자를 남자로 그림. 여성향 일상은 2026-11-06 Run七八造로 옮김(style-fdaily.js).
   표지는 장면 태그가 앞이라 조명 태그에 가중치. 여성향 표지에도 (bishounen:1.2)·pretty boy — semILust가 옷·머리 태그만 있는 남자(은발 기사·셰프)를 여자로 그려서(2026-11-04, coverPrompt의 (1boy:1.2)·masculine 앵커만으로는 부족, HoJ도 마찬가지). 애니는 2026-11-04 세밀 태그로 재비교(WAI·Nova Anime 12.5/5·Nova Orange·Illustrious 2.0·Mistoon·Hassaku) → Hassaku XL v2.1 + (intricate details:1.3)·sketchy brushwork·ink splatter·dark background. 'lightning' 태그는 모든 그림을 번개로 덮어서 뺌 */
const SEMI_L = "civitai:1160480@1449034", YABAL = "civitai:959624@1074388", HASSAKU = "civitai:140272@1617798", SEMI_SKIN = ", realistic skin texture";
const SEMI = "korean, semi-realistic, 2.5d, realistic proportions, glossy hair, detailed hair, soft skin shading" + SEMI_SKIN + ", detailed eyes, cinematic lighting, depth of field, high detail";
/* 남성향 일상(2026-11-05, 사용자와 19라운드 비교 생성으로 확정 — 고른 변형 g5·j1·v4·w2 + 하얀 느낌을 덜어낸 x3 + 후처리 t½·p2):
   모델 Run七八造 + Add More Details 0.3·KoreanAI 0.3, DPM++ 2M Karras 35 steps, CFG 5, 모델 기본 네거티브는 안 씀. 태그 하나하나가 이유 있음 —
   얇은 가닥·숱·빽빽한 앞머리(시스루·wispy는 이마가 드러나고 머리띠·비치는 옷이 생겨 네거티브로), 성숙한 얼굴·날티 나는 눈매(빽빽한 앞머리는 얼굴이 어려 보이게 함), source_anime·외곽선(실사·인형 느낌 빼기), 눈 색 차분하게.
   검은 머리는 피부를 더 하얗게(coolPrompt, 사용자 요청 — 차가운 머리색에는 흰 피부), 태그만으로는 안 먹어 색조까지 차갑게. 'jet black hair'는 비행기가 그려져 안 씀.
   전체 흐림과 밝기는 태그로 안 움직여 후처리(post, images/runware.js stylePost). 옷의 글자·무늬는 네거티브로도 다 막지 못함(알려진 한계) */
const MD_BANGS = "(full bangs:1.3), dense bangs, long bangs, bangs reaching eyes, bangs covering forehead, hair between eyes";
/* 2026-11-06 정리(사용자 요청 — 표정이 굳고 인위적, 정면으로): 고정 표정(pouty lips·half-closed eyes·light blush·sharp eyes·cat eyes)과 짙은 눈가·입술(eyeshadow·thin winged eyeliner)을 빼고 표정은 코드에 맡김, 같은 뜻 태그를 줄여 프롬프트 1171 → 약 900자, 맨 앞에 정면(MD_FRONT — 여성향보다 약하게: 1.6이면 얼굴이 인형처럼 대칭이 됨, fd63 → fd72. 각도·행동·시선을 정한 장면은 뺌, style-fit.js sceneMoves). 내용 가중치 1.2 — 없으면 옷·올려 묶은 머리가 묻힘. 정면 + 빽빽한 앞머리는 어려 보여(fd73) 성숙 태그를 올리고 큰 눈·moe를 막음 — 코드의 half-lidded eyes와 함께 성인으로 읽힘(fd74) */
const MD_FRONT = "(facing viewer:1.35), (straight-on:1.25), (front view:1.1)";
const MD_HEAD = "source_anime, (digital illustration:1.4), (anime illustration:1.3), (thin outlines:1.2), korean, 2.5d, soft gradient shading, smooth skin, soft bloom, soft focus";
/* 얼굴 모양은 인물 태그가 정함(사용자 요청 — 다 비슷한 얼굴로 나옴, fd81·fd82): 화풍이 눈매·눈썹·턱선까지 정하고 빽빽한 앞머리가 이마·눈썹을 가리면 옷과 머리색만 다른 한 얼굴이 됨. 그래서 여기엔 성인 인상과 작은 코·입만 두고, 작품의 인물 tags에 눈매(narrow·sharp·droopy·round·upturned eyes)·눈썹(thin·thick·straight·arched·soft eyebrows)·앞머리(parted·side-swept·curtain bangs, forehead — NO_BANGS_RE가 빽빽한 앞머리를 풂)·점을 넣음 */
const MD_FACE = "small nose, small mouth, long eyelashes, (mature female:1.45), (adult woman:1.45), (28 years old:1.25), mature face, slender face";
const MD_HAIR = `(very thin hair strands:1.3), (voluminous hair:1.2), (many fine hair strands:1.3), ${MD_BANGS}, silky hair`;
const MD_TAIL = "(low contrast:1.2), soft diffused light, brighter exposure, lifted shadows, (muted eye color:1.2), natural eyes, (pastel colors:1.1)";
const mdPrompt = (tone, skin, end = "") => [MD_FRONT, MD_HEAD, `low contrast, muted ${tone} palette, gentle lighting`, MD_FACE, MD_HAIR, skin, MD_TAIL].join(", ") + end;
const MD_BANGS_NEG = "(side-swept bangs:1.3), swept bangs, asymmetrical bangs, (forehead:1.4), (see-through bangs:1.3), sparse bangs, wispy bangs, gaps in bangs";
export const BUILTIN_SETS = [
  { id: "mdaily", name: "프롬1 남성향 일상", kind: "daily", aud: "m", match: /프롬\s*1.*남성향|남성향.*일상/, model: IMG_MODELS[0].id, samples: 3,
    desc: "참고 그림 프롬1(남성향 일상)에 맞춘 화풍 — 2.5D 일러스트, 정면, 가늘고 풍성한 머리 가닥과 빽빽한 앞머리(인물이 앞머리를 정했으면 그것을 따름), 성숙한 인상, 차분한 색과 전체적인 흐림. 눈매·눈썹은 인물 태그가, 표정은 코드가 정함. 검은 머리는 피부를 더 하얗게. 남성향 작품(여성 인물)의 인물 그림 기본값",
    prompt: mdPrompt("warm", "(pale skin:1.15), (fair skin:1.05)"),
    coolPrompt: mdPrompt("cool", "(pale skin:1.2), (fair skin:1.15)", ", cool lighting"), blackTag: "(black hair:1.3)",
    bangs: MD_BANGS, bangsNeg: MD_BANGS_NEG, fits: [{ when: FRONT_WHEN, moves: true, drop: [MD_FRONT] }, { moves: true, negDrop: ["(outstretched hand:1.3)", "(raised hands:1.2)", "(index finger raised:1.3)", "pointing"] }], contentWeight: 1.2, exprWeight: 1.1,
    neg: `(3d, cgi, plastic skin, doll:1.2), high contrast, harsh shadows, underexposed, glowing eyes, vivid eye color, hime cut, hairband, headband, hair ornament, earrings, (see-through clothes:1.3), hair over one eye, windblown hair, thin hair, clumped hair, (baby face:1.3), (childish face:1.2), round face, chubby cheeks, ${MD_BANGS_NEG}, (graphic print:1.3), (text on clothes:1.3), emblem, (pendant:1.2), (cross necklace:1.2), brooch, badge, tanned skin, dark skin, (realistic:1.3), photo, (photorealistic:1.3), skin pores, skin texture, nose shadow, source_cartoon, monochrome, greyscale, (twintails:1.3), (hair bun:1.2), updo, animal ears, (red eyeshadow:1.3), (eyeshadow:1.3), eye makeup, (heavy makeup:1.2), (red lips:1.2), (eye bags:1.3), (red eyelids:1.2), (under-eye shadow:1.2), (framed picture:1.5), (picture frame:1.5), (ornate frame:1.5), (gold frame:1.4), (painting (object):1.4), (wall art:1.3), (framed:1.4), border, poster, (outstretched hand:1.3), (raised hands:1.2), (index finger raised:1.3), pointing, (large eyes:1.3), big eyes, (moe:1.3), (cute:1.2), (youthful:1.3), (teen:1.4), (young:1.3)`,
    lora: [{ model: "civitai:390892@1286572", weight: 0.3 }, { model: "civitai:690861@773211", weight: 0.3 }],
    gen: { cfg: 5, steps: 35, scheduler: "DPM++ 2M Karras", modelNeg: false },
    noHumans: { model: YABAL, prompt: "2.5d, (illustration:1.3), cel-painterly shading, cinematic lighting, depth of field, high detail, soft bloom, low contrast, muted warm palette, soft diffused light" },
    post: { lift: "rgb(11,11,15)", soft: 0.08, blurK: 3, blurA: 0.6 } },
  // 값은 images/style-fdaily.js(2026-11-06, 43라운드 비교 생성으로 정함)
  { id: "fdaily", name: "프롬1 여성향 일상", kind: "daily", aud: "f", match: /프롬\s*1.*여성향|여성향.*일상/, model: IMG_MODELS[0].id, samples: 3,
    desc: "참고 그림 프롬1(여성향 일상)에 맞춘 화풍 — 가벼운 일러스트, 정면, 리프컷, 근육질 몸과 굵은 목, 성숙한 인상, 회색으로 덮은 차분한 색. 표정은 코드가 정함. 인물이 자기 머리 모양·표정을 정했으면 그것을 따름. 여성향 작품(남성 인물)의 인물 그림 기본값",
    ...FDAILY,
    // 사람 없는 그림: Run七八造는 동물만 시켜도 사람을 함께 그림. WAI가 Hassaku보다 동물 얼굴·자세를 잘 그리고 작가 표기가 필요 없음(fd44), YabaL은 그림 판매 불가라 안 씀
    noHumans: { model: IMG_MODELS[2].id, prompt: "(digital illustration:1.3), (soft painting:1.2), painterly, (flat color:1.1), soft edges, low contrast, soft warm palette, gentle lighting, soft diffused light, soft bloom" } },
  { id: "manime", name: "프롬2 남성향 애니", kind: "anime", aud: "m", match: /애니|anime/i, model: HASSAKU, samples: 3,
    desc: "프롬2(남성향 애니) 13장 — 애니 키 비주얼: 또렷한 선화와 회화적 하이라이트, 높은 대비와 선명한 색, 어두운 배경 위 빛 입자·먹 튀김 효과. 자동으로는 쓰지 않고 고르면 Hassaku 애니 모델로 그려요",
    prompt: "(anime key visual:1.3), (intricate details:1.4), extremely detailed, detailed lineart, sketchy brushwork, ink splatter, painterly highlights, cel shading, (high contrast:1.3), vivid colors, dramatic lighting, glowing particles, light streaks, dark background, shiny hair, (detailed face:1.3), (beautiful detailed eyes:1.4), tsurime, long eyelashes, glossy lips, defined nose, dramatic face lighting" },
  { id: "fworld", name: "프롬2 여성향 세계관", kind: "world", aud: "f", match: /프롬\s*2.*여성향|여성향.*(?:세계관|표지)/, model: YABAL, samples: 3,
    desc: "프롬2(여성향 세계관 표지) 11장 — 어둡고 로맨틱한 저조도 조명(촛불·달빛), 차분하고 깊은 색, 반실사 남성 인물. 여성향 작품의 표지·세계관 일러스트 기본값",
    prompt: SEMI.replace(SEMI_SKIN, "") + ", handsome, (bishounen:1.2), pretty boy, youthful, delicate facial features, pale smooth skin, sharp jawline, soft painterly shading, cinematic cover illustration, (low-key lighting:1.2), dim lighting, candlelight, moonlight, dark romantic atmosphere, rich muted palette, (dramatic chiaroscuro:1.3), (high contrast:1.2), deep shadows, strong directional light, vignette, alluring, sultry gaze" },
  { id: "mworld", name: "프롬3 남성향 세계관", kind: "world", aud: "m", match: /프롬\s*3.*남성향|남성향.*(?:세계관|표지)/, model: YABAL, samples: 3,
    desc: "프롬3(남성향 세계관 표지) 11장 — 남성향 일상과 같은 인물 화풍에 네온·무대 조명의 림라이트, 선명한 채도와 윤기, 보케. 남성향 작품의 표지·세계관 일러스트 기본값",
    prompt: SEMI.replace(SEMI_SKIN, "") + ", (semi-realistic:1.2), korean beauty, (large eyes:1.1), soft gaze, glossy lips, natural makeup, smooth glossy skin, airbrushed, cinematic cover illustration, (dramatic rim lighting:1.2), neon lights, stage lighting, vivid saturated colors, glossy finish, bokeh, (dramatic chiaroscuro:1.3), (high contrast:1.2), deep shadows, strong directional light, vignette, alluring, sultry gaze" }
];
export const builtinSet = (id) => BUILTIN_SETS.find((b) => b.id === id) || null;
/* 세트 이름이 내장 화풍 이름과 맞으면 그 id(ZIP 폴더 이름 프롬1_남성향_일상 …) */
export function matchBuiltin(name) { const b = BUILTIN_SETS.find((x) => x.match.test(String(name || ""))); return b ? b.id : ""; }
/* 내장 화풍의 실제 값: 사용자의 세트가 덮고 있으면(overrides) 그 세트의 문구·모델, 아니면 내장 */
export function overridingSet(id) { return (S.settings.styleSets || []).find((s) => s && s.overrides === id) || null; }
export function effectiveSet(id) {
  const b = builtinSet(id); if (!b) return null;
  const o = overridingSet(id);
  return o ? { ...b, prompt: o.prompt || b.prompt, model: o.model || b.model, over: o } : b;
}
/* 상황에 맞는 내장 화풍 id: 표지·세계관(world)은 작품 성향으로, 인물(daily)은 작품 성향 → 없으면(전체) 인물 성별로. 남성향 작품의 남자 인물은 여성향 일상으로 — 남성향 일상은 여성 인물 전용 태그라 남자도 여자처럼 그림(2026-11-05).
   여성향 작품의 여자 인물(male이 false)은 남성향 일상으로 — 여성향 일상도 남성 전용 태그(muscular male·masculine)가 됨(2026-11-06). 애니는 자동으로 고르지 않음 */
export function autoSetId(ctx = {}) {
  const aud = ctx.aud === "m" || ctx.aud === "f" ? ctx.aud : (ctx.male ? "f" : "m");
  return ctx.kind === "world" ? (aud === "f" ? "fworld" : "mworld") : (ctx.male || (aud === "f" && ctx.male !== false) ? "fdaily" : "mdaily");
}
/* 그림체 프리셋: 모델 + 그림체 태그(그림체만 — 인물·구도·배경 태그를 넣으면 모든 그림이 그쪽으로 끌려감). 직접 입력·세트는 모델을 따로 고름 */
export const IMG_STYLES = {
  webtoon: { name: "한국 웹툰 · 세미리얼", desc: "동양적인 얼굴과 자연스러운 반실사 채색. 로맨스·일상 웹툰 표지 느낌", model: IMG_MODELS[0].id, tags: "korean, semi-realistic, natural lighting, soft shading, realistic skin texture, natural makeup, detailed eyes" },
  mature: { name: "성인 웹툰 · 글래머", desc: "성숙한 인물, 부드러운 피부 음영과 영화 같은 조명. 19금 웹툰 표지 느낌(수위는 따로 골라요)", model: IMG_MODELS[0].id, tags: "korean, mature, semi-realistic, glamorous, soft skin shading, realistic skin texture, cinematic lighting, bokeh" },
  line: { name: "한국 웹툰 · 선화", desc: "또렷한 선과 깔끔한 셀 채색. 연재 웹툰 컷 느낌", model: IMG_MODELS[1].id, tags: "korean webtoon, manhwa, clean lineart, soft cel shading" },
  anime: { name: "애니 일러스트", desc: "선명한 색과 반짝이는 눈. 게임·라이트노벨 일러스트 느낌", model: IMG_MODELS[2].id, tags: "illustration, beautiful detailed eyes, detailed face, glossy lips, shiny hair, rich colors, cinematic lighting, light particles, depth of field" },
  oriental: { name: "동양 판타지", desc: "평면 채색과 가는 선, 붉은색·금색 위주. 무협·동양풍 일러스트 느낌", model: IMG_MODELS[2].id, tags: "oriental fantasy, flat color, cel shading, thin clean lineart, limited palette, crimson and gold" },
  custom: { name: "직접 입력", desc: "그림체를 한국어로 적어도 돼요. 만들 때 영문 태그로 바꿔 보내요", model: null, tags: "" }
};
export const OLD_STYLES = { novel: "webtoon", none: "webtoon" };
 // 예전 프리셋 이름 → 지금 이름
/* 그림체 세트: 그림 여러 장 + 그림체 문구 + 모델(S.settings.styleSets = [{id, name, refs, prompt, model, overrides?}]). imgStyle이 "set:<id>"면 세트를 씀 */
export function activeSet() { const k = String(S.settings.imgStyle || ""); return k.startsWith("set:") ? (S.settings.styleSets || []).find((s) => "set:" + s.id === k) || null : null; }
/* 지금 쓸 그림체 {id, name, prompt, model}. 설정이 '기본 화풍(자동)'이면 ctx(kind daily·world, aud, male)에 맞는 내장 화풍(덮어쓴 세트가 있으면 그것),
   "sys:<id>"면 그 내장 화풍, "set:<id>"면 사용자의 세트, 그 밖은 프리셋·직접 입력 — 어디서 그리든 이 함수 하나로 정함 */
export function styleFor(ctx = {}) {
  const k = String(S.settings.imgStyle || "auto");
  // 내장 화풍은 머리색별 문구·네거티브·LoRA·샘플러·후처리도 정할 수 있음(남성향 일상) — 사용자의 세트가 덮으면 그 세트의 문구·모델만
  const sys = (id) => { const s = effectiveSet(id) || effectiveSet(autoSetId(ctx)), { coolPrompt, blackTag, paleTag, bangs, bangsNeg, fits, contentWeight, exprWeight, neg, lora, gen, post, noHumans } = s.over ? {} : s;
    return { id: "sys:" + s.id, name: `기본 화풍 · ${s.name}${s.over ? " (내 세트)" : ""}`, prompt: s.prompt, model: s.model || IMG_MODELS[0].id, coolPrompt, blackTag, paleTag, bangs, bangsNeg, fits, contentWeight, exprWeight, neg, lora, gen, post, noHumans }; };
  if (k === "auto") return sys(autoSetId(ctx));
  if (k.startsWith("sys:")) return sys(k.slice(4));
  if (k.startsWith("set:")) { const s = activeSet(); if (s) return { id: k, name: "세트 · " + s.name, prompt: s.prompt || "", model: s.model || S.settings.imgModel || IMG_MODELS[0].id }; return sys(autoSetId(ctx)); }
  if (k === "custom") return { id: k, name: IMG_STYLES.custom.name, prompt: S.settings.imgStyleCustom || "", model: S.settings.imgModel || IMG_MODELS[0].id };
  const p = IMG_STYLES[k] || IMG_STYLES.webtoon;
  return { id: k, name: p.name, prompt: p.tags, model: p.model };
}
export function styleLabel() { return styleFor().name; }
export function imgStyleText() { return styleFor().prompt.trim(); }
/* 지금 그림체가 쓰는 모델: 내장·프리셋은 고정, 세트·직접 입력은 고른 모델 */
export function imgModelId() { return styleFor().model; }
export function styleOptionsHTML() {
  const cur = String(S.settings.imgStyle || "auto");
  return [["auto", "기본 화풍 (자동 — 작품 성향·인물에 맞춰)"], ...BUILTIN_SETS.map((b) => ["sys:" + b.id, `기본 화풍 · ${b.name}${overridingSet(b.id) ? " (내 세트로 덮음)" : ""}`]),
    ...Object.entries(IMG_STYLES).map(([k, p]) => [k, p.name]), ...(S.settings.styleSets || []).map((s) => ["set:" + s.id, "세트 · " + s.name])]
    .map(([k, l]) => `<option value="${esc(k)}" ${cur === k ? "selected" : ""}>${esc(l)}</option>`).join("");
}
/* 이름 앞부분이 같은 파일끼리(프롬1_남성향_일상1.png, 프롬1_남성향_일상2.png …) 한 세트로(그림은 SET_REFS장까지). 앞부분이 모두 다르면 전부 한 세트 */
export const SET_REFS = 8;
export function groupStyleFiles(files) {
  const base = (n) => n.replace(/\.[^.]+$/, ""), stem = (n) => base(n).replace(/\s*[\(\[]?\d+[\)\]]?\s*$/, "").replace(/[_\-\s.]+$/, "").trim();
  const sorted = [...files].sort((a, b) => base(a.name).localeCompare(base(b.name), "ko", { numeric: true }));
  const map = new Map();
  for (const f of sorted) { const k = stem(f.name) || base(f.name); if (!map.has(k)) map.set(k, []); map.get(k).push(f); }
  let groups = [...map.entries()].map(([k, fs]) => ({ k, fs }));
  if (sorted.length > 1 && groups.every((g) => g.fs.length === 1)) groups = [{ k: "세트", fs: sorted }];
  return groups.map((g) => ({ name: g.k.slice(0, 30), files: g.fs.slice(0, SET_REFS) }));
}
/* 브라우저만으로 ZIP 안의 그림 꺼내기 (무압축·deflate, 파일 이름 UTF-8/EUC-KR) */
export async function unzipImages(file) {
  const buf = new Uint8Array(await file.arrayBuffer()), dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength), out = [];
  let e = buf.length - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error("zip");
  const count = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true);
  const dec = (bytes, utf) => { if (utf) return new TextDecoder().decode(bytes); try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { return new TextDecoder("euc-kr").decode(bytes); } };
  for (let i = 0; i < count && dv.getUint32(p, true) === 0x02014b50; i++) {
    const flags = dv.getUint16(p + 8, true), method = dv.getUint16(p + 10, true), size = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), lho = dv.getUint32(p + 42, true);
    const name = dec(buf.subarray(p + 46, p + 46 + nlen), flags & 0x800); p += 46 + nlen + xlen + clen;
    const short = name.split("/").pop();
    if (!/\.(png|jpe?g|webp)$/i.test(short) || /(^|\/)(__MACOSX|\.)/.test(name)) continue;
    const start = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true), data = buf.subarray(start, start + size);
    if (method === 8 && typeof DecompressionStream !== "function") throw { code: "nozip" };
    const bytes = method === 0 ? data : method === 8 ? new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer()) : null;
    if (bytes) out.push(new File([bytes], short, { type: /\.png$/i.test(short) ? "image/png" : /\.webp$/i.test(short) ? "image/webp" : "image/jpeg" }));
  }
  return out;
}
/* 세트 이름으로 미리 고르는 문구·모델(그림을 읽기 전) — 내장 화풍 이름과 맞으면 그 화풍, '애니'면 애니 일러스트, 그 밖은 한국 웹툰 세미리얼 */
const animeName = (name) => /애니|anime|만화|셀/i.test(name);
export function guessStylePrompt(name) { const b = builtinSet(matchBuiltin(name)); return b ? b.prompt : (animeName(name) ? IMG_STYLES.anime : IMG_STYLES.webtoon).tags; }
export function guessStyleModel(name) { const b = builtinSet(matchBuiltin(name)); return b ? b.model : (animeName(name) ? IMG_STYLES.anime : IMG_STYLES.webtoon).model; }
/* 그림체 세트 그림(앞 4장)을 Claude(Anthropic API 키·서버 프록시)에게 보여 주고 공통 화풍만 Pony용 영문 태그로 받아옴 */
export async function claudeStyleTags(refs) {
  if (!hasClaudeKey()) throw { code: "no_claude" };
  const content = [];
  for (const r of (refs || []).slice(0, 4)) {
    const d = validRef(r) && await refDataURL(r), m = typeof d === "string" && d.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/);
    if (m) content.push({ type: "image", source: { type: "base64", media_type: m[1], data: m[2] } });
  }
  if (!content.length) throw { code: "upstream_error", msg: "그림 없음" };
  content.push({ type: "text", text: `위 ${content.length}장은 한 그림체 세트다. SDXL 그림 모델(Pony·Illustrious)에 넣을 '그림체 태그'를 영문 Danbooru 태그로 써라.
- ${content.length}장에 공통된 화풍만: 그림 장르(korean webtoon·semi-realistic·anime illustration 등), 얼굴 표현 방식(동양적 이목구비·반실사 얼굴·애니풍 눈 등), 선, 채색 방식, 명암·하이라이트, 조명, 색감, 질감
- 구도·자세·배경·소품·옷·머리 모양과 색, 신체 특징·노출·성적 요소, 인물·작품·작가·서비스 이름, 그림 속 글자는 쓰지 않는다(그림마다 달라야 하는 내용이라 넣으면 모든 그림이 같아짐). score_·rating_·source_ 태그도 쓰지 않는다
- 소문자 태그 10~18개를 쉼표로만 이어 한 줄로. 설명 없이 태그만` });
  let res;
  try {
    res = await fetch(CFG.anthropicUrl, { method: "POST", headers: { "content-type": "application/json", "anthropic-version": "2023-06-01", ...(S.settings.apiKey ? { "x-api-key": S.settings.apiKey, "anthropic-dangerous-direct-browser-access": "true" } : {}) },
      body: JSON.stringify({ model: "claude-haiku-5-5", max_tokens: 400, messages: [{ role: "user", content }] }) });
  } catch { throw { code: "network" }; }
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw { code: res.status === 401 || res.status === 403 ? "bad_claude" : res.status === 429 ? "rate_limited" : "upstream_error", msg: j.error?.message || "" };
  const text = (j.content || []).map((x) => x.text || "").join("").replace(/\n+/g, ", ").replace(/["'`]/g, "").replace(/\s+/g, " ").trim();
  if (!text) throw { code: "blocked" };
  return text.slice(0, 600);
}
