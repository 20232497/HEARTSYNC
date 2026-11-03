/* 이미지 프롬프트 조립: 장면·인물·의상·배경 묶음(조합 키), 인물별 저장 태그, 표지·세계관 프롬프트 */
import { castLook } from "../core/cast.js";
import { minorHint } from "../core/safety.js";
import { S } from "../core/state.js";
import { KV } from "../core/storage.js";
import { keyOf, parseCodes, splitDims } from "./codes.js";
import { sitDef } from "./situations.js";
import { ponyTags } from "./tags.js";

/* 표지 프롬프트: 세계관 작품은 주요 인물들이 모인 단체 표지, 1인 작품은 주인공 중심 */
export function coverPrompt(c) {
  const cast = (c.cast || []).filter((x) => x.name), base = ["cinematic composition"]; // "cover art"는 제목 글자를 그려 넣어서 뺌
  if (c.world_mode && cast.length > 1) {
    const pick = cast.slice(0, 3); // SDXL은 3명이 넘으면 얼굴·몸이 뭉개져서 앞의 3명만
    const f = pick.filter((x) => /여성|여자|\bfemale\b|\bgirl/i.test(x.look || "")).length, m = pick.filter((x) => /남성|남자|\bmale\b|\bboy/i.test(x.look || "")).length;
    const who = [f ? (f > 1 ? `${f}girls` : "1girl") : "", m ? (m > 1 ? `${m}boys` : "1boy") : "", m && !f ? "male focus" : ""].filter(Boolean).join(", ") || "multiple characters";
    return [...base, who, "group shot", ...pick.map((x) => x.tags || x.look), c.oneLiner, "detailed background"].filter(Boolean).join(", ");
  }
  const look = castLook(cast[0], c);
  return [...base, ...whoTags(look), (cast[0] && cast[0].tags) || look, "upper body, looking at viewer", c.oneLiner, "detailed background"].filter(Boolean).join(", ");
}
/* 상황 번호(SIT 0~14) → 표정·자세 태그(Danbooru). 프롬프트 맨 앞(장면 자리)에 들어가야 모델이 따름 */
const SIT_PONY_TAGS = [
  "portrait, upper body, looking at viewer, light smile",                  // 0 프로필
  "neutral expression, closed mouth, upper body, looking at viewer",       // 1 기본
  "smile, open mouth, :d, laughing, closed eyes, happy",                   // 2 웃음
  "blush, embarrassed, shy, looking away, hand on own cheek, nose blush",  // 3 부끄러움
  "crying, streaming tears, sad, frown, looking down",                     // 4 슬픔
  "surprised, wide-eyed, open mouth, :o, shocked",                         // 5 놀람
  "angry, furious, clenched teeth, glaring, v-shaped eyebrows",            // 6 분노
  "pout, puffy cheeks, annoyed, looking away, crossed arms",               // 7 삐침
  "scared, frightened, trembling, wide-eyed, sweat",                       // 8 공포
  "injured, bandages, bruise, blood on face, exhausted, torn clothes",     // 9 부상
  "relieved, gentle smile, soft light, sparkle",                           // 10 회복
  "sleeping, closed eyes, lying down, peaceful, pillow",                   // 11 휴식
  "fighting stance, attacking, action pose, intense eyes, motion blur",    // 12 공격
  "glowing eyes, aura, magic, floating hair, power",                       // 13 각성
  "blush, loving gaze, gentle smile, hands on own chest"                   // 14 설렘
];
// 싸우는 장면(0 프로필·9 부상·12 공격·13 각성)이 아니면 외모의 무기를 뺌 — 무기가 있으면 모든 칸이 같은 무기 든 자세로 끌려감
const COMBAT_SITS = [0, 9, 12, 13];
const WEAPON_RE = /레이피어|장검|단검|대검|검$|칼$|비수|창$|활$|권총|리볼버|소총|라이플|총$|방패|배트$|쇠파이프|무기|\b(?:weapon|sword|rapier|katana|blade|dagger|knife|spear|bow|gun|pistol|revolver|rifle|shield|bat|pipe)s?\b/i;
// 의상 번호가 붙은 조합이면 외모 글의 옷 조각을 뺌 — 설정의 옷과 의상 코드가 겹치면 둘이 섞여 그려짐
const CLOTH_RE = /옷|복(?![가-힣])|드레스|셔츠|블라우스|정장|수트|슈트|코트|재킷|자켓|치마|스커트|바지|청바지|원피스|한복|제복|갑옷|갑주|로브|망토|가운|니트|후드|티셔츠|넥타이|구두|부츠|힐(?![가-힣])|샌들|장갑|모자|베레|두건|도포|무복|도복|기모노|유카타|\b(?:dress|shirt|blouse|suit|coat|jacket|skirt|pants|jeans|uniform|armor|robe|cloak|cape|gown|sweater|hoodie|t-shirt|tie|shoes|boots|heels|gloves|hat|cap|beret|hood|kimono|yukata|hanbok|outfit|clothes|clothing)\b/i;
export const splitTags = (t) => String(t || "").split(/\s*,\s*/).map((x) => x.trim()).filter(Boolean);
/* 외모 글 → 인원·성별 태그. 남자는 male focus까지 넣어야 Pony 계열이 여자로 바꿔 그리지 않음. 사람 낱말 없이 동물만 있으면 사람 없는 그림 */
const HUMAN_RE = /남성|여성|남자|여자|소년|소녀|청년|사람|인간|\d+\s*세|\b(?:male|female|man|woman|boy|girl|human|person)\b/i;
const ANIMAL_RE = /고양이|강아지|진돗개|늑대|여우|토끼|곰|사슴|호랑이|사자|까마귀|부엉이|올빼미|독수리|참새|비둘기|드래곤|뱀|물고기|고래|햄스터|다람쥐|판다|펭귄|동물|짐승|\b(?:cat|dog|puppy|kitten|wolf|fox|rabbit|bear|deer|tiger|lion|horse|bird|crow|owl|eagle|hawk|dragon|snake|fish|whale|hamster|squirrel|panda|penguin|animal|creature|beast)s?\b/i;
function whoTags(look) {
  const l = String(look || "");
  if (!HUMAN_RE.test(l) && ANIMAL_RE.test(l)) return ["no humans", "animal focus"];
  const boy = /남성|남자|\b(?:male|man|boy)\b/i.test(l) && !/여성|여자|\b(?:female|woman|girl)\b/i.test(l);
  return boy ? ["1boy", "male focus", "solo"] : ["1girl", "solo"];
}
/* 저장 태그(tagpacks)는 감정/행동 번호에 묶임 — 의상·장소는 칸 정의가 모든 인물에 공통이라 따로 저장하지 않음 */
const actKeyOf = (key) => keyOf(splitDims(parseCodes(String(key))).act) || "1";
/* 이미지 칸 프롬프트를 묶음별로: 장면(표정·자세) → 인물(성별·외모) → 의상(조합에 있을 때) → 배경(장소 번호가 있으면 그 장소).
   key는 번호(3) 또는 조합 키("3,404,501"). 장면이 앞에 와야 표정이 반영됨(2026-11 비교 생성으로 확인). 그림체·품질·수위 태그는 runwareImage가 뒤에 붙임.
   출연진에 영문 태그 tags가 있으면(오리지널 12작품은 전부, 1:1 작품은 lookTags) 외모 글 대신 번역 없이 그대로 써서 같은 인물이 매번 같은 생김새로 — 성별·인원(whoTags)은 한국어 look으로 */
function slotParts(cast, key, c) {
  const codes = parseCodes(String(key)), d = splitDims(codes), acts = d.act.length ? d.act : [1], look = castLook(cast, c);
  const wear = d.wear ? sitDef(d.wear) : null, place = d.place ? sitDef(d.place) : null, combat = acts.some((n) => COMBAT_SITS.includes(n)), dressed = !!(wear && wear.prompt);
  let scene = []; acts.forEach((n) => splitTags(SIT_PONY_TAGS[n] || sitDef(n)?.prompt || "").forEach((t) => { if (!scene.includes(t)) scene.push(t); }));
  if (!scene.length) scene = splitTags(SIT_PONY_TAGS[1]);
  const out = [
    { key: "scene", label: "장면·표정", tags: scene },
    { key: "look", label: "인물", tags: [...whoTags(look), ...splitTags(cast.tags || look).filter((t) => (combat || !WEAPON_RE.test(t)) && !(dressed && CLOTH_RE.test(t)))] }
  ];
  if (dressed) out.push({ key: "wear", label: "의상", tags: splitTags(wear.prompt) });
  out.push({ key: "bg", label: "배경", tags: place && place.prompt ? splitTags(place.prompt) : [acts[0] === 0 ? "simple background" : "detailed background"] });
  return out;
}
export function buildPonyPrompt(cast, key, c) { return savedParts(c, cast, key).flatMap((p) => p.tags.map((x) => x.strong ? `(${x.t}:1.3)` : x.t)).filter(Boolean).join(", "); }
export const asTag = (t) => (typeof t === "string" ? { t, strong: false } : t);
/* 인물별로 저장한 태그(S.tagpacks[작품 id][인물 코드] = {look, sits: {감정 번호: {scene, extra, bg}}}, KV "tagpacks").
   기본 태그와의 차이 {add, del, strong}만 저장해서, 작품의 외모 설정이 바뀌어도 사용자가 고친 부분만 남음.
   인물(look)은 그 인물의 모든 칸에, 장면·추가·배경은 그 감정 번호에만(조합이면 감정 번호 부분). 의상 묶음은 저장하지 않음 */
function castPack(c, code) { return ((S.tagpacks || {})[c.id] || {})[code] || null; }
export function savedParts(c, cast, key) {
  const pack = castPack(c, cast.code) || {}, sd = (pack.sits || {})[actKeyOf(key)] || {};
  const apply = (tags, d) => {
    if (!d) return tags.map(asTag);
    const del = d.del || [], add = d.add || [], strong = d.strong || [];
    return [...tags.filter((t) => !del.includes(t)), ...add.filter((t) => !tags.includes(t))].map((t) => ({ t, strong: strong.includes(t) }));
  };
  const out = slotParts(cast, key, c).map((g) => ({ ...g, tags: apply(g.tags, g.key === "look" ? pack.look : g.key === "wear" ? null : sd[g.key]) }));
  out.splice(1, 0, { key: "extra", label: "추가", tags: apply([], sd.extra) }); // 직접 더한 태그는 장면 바로 다음
  return out;
}
export function hasSavedTags(c, code, key) { const p = castPack(c, code); return !!(p && (p.look || (p.sits || {})[actKeyOf(key)])); }
export function saveCastTags(c, cast, key, groups) {
  const base = slotParts(cast, key, c), baseOf = (k) => (base.find((g) => g.key === k) || { tags: [] }).tags, ak = actKeyOf(key);
  const diff = (k) => {
    const g = groups.find((x) => x.key === k); if (!g) return null;
    const b = baseOf(k), cur = g.tags.map((x) => x.t);
    const d = { add: cur.filter((t) => !b.includes(t)), del: b.filter((t) => !cur.includes(t)), strong: g.tags.filter((x) => x.strong).map((x) => x.t) };
    return d.add.length || d.del.length || d.strong.length ? d : null;
  };
  S.tagpacks[c.id] = S.tagpacks[c.id] || {};
  const pack = S.tagpacks[c.id][cast.code] = { sits: {}, ...(S.tagpacks[c.id][cast.code] || {}) };
  const look = diff("look"); if (look) pack.look = look; else delete pack.look;
  const sd = {}; ["scene", "extra", "bg"].forEach((k) => { const d = diff(k); if (d) sd[k] = d; });
  if (Object.keys(sd).length) pack.sits[ak] = sd; else delete pack.sits[ak];
  if (!pack.look && !Object.keys(pack.sits).length) delete S.tagpacks[c.id][cast.code];
  if (!Object.keys(S.tagpacks[c.id]).length) delete S.tagpacks[c.id];
  KV.set("tagpacks", S.tagpacks);
}
export function clearCastTags(c, cast, key) {
  const pack = castPack(c, cast.code); if (!pack) return;
  delete pack.look; if (pack.sits) delete pack.sits[actKeyOf(key)];
  if (!Object.keys(pack.sits || {}).length) delete S.tagpacks[c.id][cast.code];
  if (!Object.keys(S.tagpacks[c.id]).length) delete S.tagpacks[c.id];
  KV.set("tagpacks", S.tagpacks);
}
/* 태그 묶음 → 영문 프롬프트. 강조(★) 태그는 하나씩 번역해 "(태그:1.3)"로, 나머지는 묶음째 번역.
   인물(외모) 묶음은 수위와 상관없이 같은 길로 번역 — 수위마다 번역이 달라 머리색·옷이 바뀌던 문제 */
export async function groupsPrompt(groups, adult) {
  const out = [];
  for (const g of groups) {
    const ad = g.key === "look" ? false : adult, tags = g.tags.map(asTag);
    for (const x of tags.filter((y) => y.strong)) out.push(...splitTags(await ponyTags(x.t, ad)).map((t) => /[():]/.test(t) ? t : `(${t}:1.3)`));
    const plain = tags.filter((y) => !y.strong).map((y) => y.t);
    if (plain.length) out.push(await ponyTags(plain.join(", "), ad));
  }
  return out.filter(Boolean).join(", ");
}
/* 빈 칸 채우기·대화 중 자동 생성용: 묶음별로 영문 태그로 바꿔 이어 붙임(인물별 저장 태그·강조 포함) */
export async function partsTags(parts, adult) {
  if (adult && minorHint(parts.flatMap((g) => g.tags.map((x) => asTag(x).t)).join(", "))) throw { code: "minor_block" };
  return groupsPrompt(parts, adult);
}
/* 세계관 일러스트: 키워드북 항목에 영문 tags가 있으면 설명 대신 그대로 */
export function lorePrompt(c, e) { return ["scenery, wide shot, detailed background, atmospheric lighting, no text", e.tags || e.text].filter(Boolean).join(", "); }
