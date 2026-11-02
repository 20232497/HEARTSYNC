/* 이미지 프롬프트 조립: 인물·장면·배경 묶음, 인물별 저장 태그, 표지·세계관 프롬프트 */
import { castLook } from "../core/cast.js";
import { minorHint } from "../core/safety.js";
import { S } from "../core/state.js";
import { KV } from "../core/storage.js";
import { sitDef } from "./situations.js";
import { ponyTags } from "./tags.js";

/* 표지 프롬프트: 세계관 작품은 주요 인물들이 모인 단체 표지, 1인 작품은 주인공 중심 */
export function coverPrompt(c) {
  const cast = (c.cast || []).filter((x) => x.name), base = ["cinematic composition"]; // "cover art"는 제목 글자를 그려 넣어서 뺌
  if (c.world_mode && cast.length > 1) {
    const pick = cast.slice(0, 3); // SDXL은 3명이 넘으면 얼굴·몸이 뭉개져서 앞의 3명만
    const f = pick.filter((x) => /여성|여자|\bfemale\b|\bgirl/i.test(x.look || "")).length, m = pick.filter((x) => /남성|남자|\bmale\b|\bboy/i.test(x.look || "")).length;
    const who = [f ? (f > 1 ? `${f}girls` : "1girl") : "", m ? (m > 1 ? `${m}boys` : "1boy") : "", m && !f ? "male focus" : ""].filter(Boolean).join(", ") || "multiple characters";
    return [...base, who, "group shot", ...pick.map((x) => x.look), c.oneLiner, "detailed background"].filter(Boolean).join(", ");
  }
  const look = castLook(cast[0], c);
  return [...base, ...whoTags(look), look, "upper body, looking at viewer", c.oneLiner, "detailed background"].filter(Boolean).join(", ");
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
export const splitTags = (t) => String(t || "").split(/\s*,\s*/).map((x) => x.trim()).filter(Boolean);
/* 이미지 칸 프롬프트를 묶음별로: 장면(표정·자세) → 인물(성별·외모) → 배경. 장면이 앞에 와야 표정이 반영됨(2026-11 비교 생성으로 확인).
   그림체·품질·수위 태그는 runwareImage가 뒤에 붙임 */
/* 외모 글 → 인원·성별 태그. 남자는 male focus까지 넣어야 Pony 계열이 여자로 바꿔 그리지 않음. 사람 낱말 없이 동물만 있으면 사람 없는 그림 */
const HUMAN_RE = /남성|여성|남자|여자|소년|소녀|청년|사람|인간|\d+\s*세|\b(?:male|female|man|woman|boy|girl|human|person)\b/i;
const ANIMAL_RE = /고양이|강아지|진돗개|늑대|여우|토끼|곰|사슴|호랑이|사자|까마귀|부엉이|올빼미|독수리|참새|비둘기|드래곤|뱀|물고기|고래|햄스터|다람쥐|판다|펭귄|동물|짐승|\b(?:cat|dog|puppy|kitten|wolf|fox|rabbit|bear|deer|tiger|lion|horse|bird|crow|owl|eagle|hawk|dragon|snake|fish|whale|hamster|squirrel|panda|penguin|animal|creature|beast)s?\b/i;
function whoTags(look) {
  const l = String(look || "");
  if (!HUMAN_RE.test(l) && ANIMAL_RE.test(l)) return ["no humans", "animal focus"];
  const boy = /남성|남자|\b(?:male|man|boy)\b/i.test(l) && !/여성|여자|\b(?:female|woman|girl)\b/i.test(l);
  return boy ? ["1boy", "male focus", "solo"] : ["1girl", "solo"];
}
function slotParts(cast, i, c) {
  const look = castLook(cast, c);
  return [
    { key: "scene", label: "장면·표정", tags: splitTags(SIT_PONY_TAGS[i] || sitDef(i)?.prompt || SIT_PONY_TAGS[1]) },
    { key: "look", label: "인물", tags: [...whoTags(look), ...splitTags(look).filter((t) => COMBAT_SITS.includes(i) || !WEAPON_RE.test(t))] },
    { key: "bg", label: "배경", tags: [i === 0 ? "simple background" : "detailed background"] }
  ];
}
export function buildPonyPrompt(cast, i, c) { return savedParts(c, cast, i).flatMap((p) => p.tags.map((x) => x.strong ? `(${x.t}:1.3)` : x.t)).filter(Boolean).join(", "); }
export const asTag = (t) => (typeof t === "string" ? { t, strong: false } : t);
/* 인물별로 저장한 태그(S.tagpacks[작품 id][인물 코드] = {look, sits: {칸 번호: {scene, extra, bg}}}, KV "tagpacks").
   기본 태그와의 차이 {add, del, strong}만 저장해서, 작품의 외모 설정이 바뀌어도 사용자가 고친 부분만 남음.
   인물(look)은 그 인물의 모든 칸에, 장면·추가·배경은 그 칸에만 */
function castPack(c, code) { return ((S.tagpacks || {})[c.id] || {})[code] || null; }
export function savedParts(c, cast, i) {
  const pack = castPack(c, cast.code) || {}, sd = (pack.sits || {})[i] || {};
  const apply = (tags, d) => {
    if (!d) return tags.map(asTag);
    const del = d.del || [], add = d.add || [], strong = d.strong || [];
    return [...tags.filter((t) => !del.includes(t)), ...add.filter((t) => !tags.includes(t))].map((t) => ({ t, strong: strong.includes(t) }));
  };
  const out = slotParts(cast, i, c).map((g) => ({ ...g, tags: apply(g.tags, g.key === "look" ? pack.look : sd[g.key]) }));
  out.splice(1, 0, { key: "extra", label: "추가", tags: apply([], sd.extra) }); // 직접 더한 태그는 장면 바로 다음
  return out;
}
export function hasSavedTags(c, code, i) { const p = castPack(c, code); return !!(p && (p.look || (p.sits || {})[i])); }
export function saveCastTags(c, cast, i, groups) {
  const base = slotParts(cast, i, c), baseOf = (k) => (base.find((g) => g.key === k) || { tags: [] }).tags;
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
  if (Object.keys(sd).length) pack.sits[i] = sd; else delete pack.sits[i];
  if (!pack.look && !Object.keys(pack.sits).length) delete S.tagpacks[c.id][cast.code];
  if (!Object.keys(S.tagpacks[c.id]).length) delete S.tagpacks[c.id];
  KV.set("tagpacks", S.tagpacks);
}
export function clearCastTags(c, cast, i) {
  const pack = castPack(c, cast.code); if (!pack) return;
  delete pack.look; if (pack.sits) delete pack.sits[i];
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
/* 빈 칸 채우기용: 묶음별로 영문 태그로 바꿔 이어 붙임(인물별 저장 태그·강조 포함) */
export async function partsTags(parts, adult) {
  if (adult && minorHint(parts.flatMap((g) => g.tags.map((x) => asTag(x).t)).join(", "))) throw { code: "minor_block" };
  return groupsPrompt(parts, adult);
}
export function lorePrompt(c, e) { return ["scenery, wide shot, detailed background, atmospheric lighting, no text", e.text].filter(Boolean).join(", "); }
