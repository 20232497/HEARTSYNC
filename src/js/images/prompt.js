/* 이미지 프롬프트 조립: 장면·인물·의상·배경 묶음(조합 키), 인물별 저장 태그, 표지·세계관 프롬프트 */
import { castLook } from "../core/cast.js";
import { minorHint } from "../core/safety.js";
import { S } from "../core/state.js";
import { KV } from "../core/storage.js";
import { keyOf, parseCodes, splitDims } from "./codes.js";
import { sitDef } from "./situations.js";
import { ponyTags } from "./tags.js";

/* 표지 프롬프트: 세계관 작품은 주요 인물들이 모인 단체 표지, 1인 작품은 주인공 중심. 배경 분위기는 작품의 세계관 태그(artTags), 없으면 한 줄 소개 */
export function coverPrompt(c) {
  // 참고 표지(2026-11-04 사용자 ZIP)의 구조: 인물 상반신을 크게, 정면·시선, 배경은 분위기만 — "cover art"는 제목 글자를 그려 넣어서 뺌
  const cast = (c.cast || []).filter((x) => x.name), base = ["poster composition", "upper body"];
  if (c.world_mode && cast.length > 1) {
    const pick = cast.slice(0, 3); // SDXL은 3명이 넘으면 얼굴·몸이 뭉개져서 앞의 3명만
    const f = pick.filter((x) => /여성|여자|\bfemale\b|\bgirl/i.test(x.look || "")).length, m = pick.filter((x) => /남성|남자|\bmale\b|\bboy/i.test(x.look || "")).length;
    // 한쪽 성별만 있는 표지는 인원 태그에 가중치 + 성별 앵커 — 옷·머리 태그만 있으면 반실사 모델이 성별을 바꿔 그림(2026-11-04 비교 생성)
    // 여러 명이면 한 명만 크게 나오지 않게 인원 태그를 세게(1.4) + "N women side by side, all faces visible" (2026-11-04: 상반신 한 명 구도 → 허리 위 3인 구도 6장 중 4장 성공)
    const N = ["", "one", "two", "three"], grp = pick.length > 1 ? [`(${N[pick.length]} ${m && !f ? "men" : f && !m ? "women" : "people"} side by side:1.3)`, "all faces visible"] : [];
    const who = [f ? (f > 1 ? (m ? `${f}girls` : `(${f}girls:1.4), (multiple girls:1.2)`) : (m ? "1girl" : "(1girl:1.2)")) : "", m ? (m > 1 ? (f ? `${m}boys` : `(${m}boys:1.4), (multiple boys:1.2)`) : (f ? "1boy" : "(1boy:1.2)")) : "",
      m && !f ? "male focus, handsome men, masculine features" : f && !m ? "beautiful women, feminine" : ""].filter(Boolean).join(", ") || "multiple characters";
    return ["poster composition", "waist up", who, ...grp, "group portrait, looking at viewer", ...pick.map((x) => x.tags || x.look), c.artTags || c.oneLiner, "atmospheric background"].filter(Boolean).join(", ");
  }
  const look = castLook(cast[0], c), who = lookIsMale(look) ? ["(1boy:1.2)", "male focus", "solo", "handsome man, masculine features"] : ["(1girl:1.2)", "solo", "beautiful woman"];
  return [...base, ...who, (cast[0] && cast[0].tags) || look, "looking at viewer", c.artTags || c.oneLiner, "atmospheric background"].filter(Boolean).join(", ");
}
/* 상황 번호(SIT 0~14) → 표정·자세 태그(Danbooru). 프롬프트 맨 앞(장면 자리)에 들어가야 모델이 따름.
   2026-11-06 참고 일러스트에 맞춰 다시 씀(사용자 요청 — 표정이 굳고 인위적): furious·clenched teeth·:d·puffy cheeks·hand on own cheek처럼 얼굴을 일그러뜨리거나 어려 보이게 하는 태그를 빼고, 눈·눈썹·입을 은은하게. upper body는 얼굴이 크게 보여 표정이 잘 보임, 고개를 돌리는 looking away 대신 시선만 옮기는 looking to the side. 편안한 칸은 half-lidded eyes — 참고 일러스트의 눈이고, 눈을 크게 뜨면 정면에서 어려 보임(fd73 → fd74). 표정 태그에는 가중치가 붙지 않음(style-fit.js weighTags) — 눈물만 약해서 직접 올림 */
export const SIT_PONY_TAGS = [
  "upper body, looking at viewer, light smile, half-lidded eyes, relaxed expression, soft gaze", // 0 프로필
  "upper body, looking at viewer, relaxed expression, half-lidded eyes, closed mouth, soft gaze", // 1 기본
  "upper body, looking at viewer, happy, smile, half-lidded eyes, closed mouth", // 2 웃음
  "upper body, looking to the side, blush, embarrassed, shy smile, half-lidded eyes, closed mouth", // 3 부끄러움
  "upper body, looking at viewer, sad, (tears:1.2), teary eyes, downturned eyes, parted lips", // 4 슬픔
  "upper body, looking at viewer, surprised, wide eyes, raised eyebrows, parted lips", // 5 놀람
  "upper body, looking at viewer, angry, furrowed brow, glaring, frown, closed mouth", // 6 분노
  "upper body, looking to the side, pout, annoyed, furrowed brow, crossed arms", // 7 삐침
  "upper body, looking at viewer, scared, worried, wide eyes, raised inner eyebrows, parted lips, sweat", // 8 공포
  "upper body, looking at viewer, injured, bandages, bruise, pained expression, parted lips", // 9 부상
  "upper body, looking at viewer, relieved, gentle smile, half-lidded eyes, relaxed expression, soft light", // 10 회복
  "sleeping, closed eyes, lying down, peaceful, pillow", // 11 휴식
  "fighting stance, clenched hands, action pose, determined, intense gaze, closed mouth", // 12 공격(맨손·무기 모두) — 맨손 기준. 무기가 있는 인물은 slotParts가 주먹 낱말을 빼고 무기를 쥔 자세로(WEAPON_AIM)
  "upper body, glowing eyes, aura, magic, floating hair, intense gaze", // 13 각성
  "upper body, looking at viewer, blush, gentle smile, half-lidded eyes, soft gaze, relaxed expression" // 14 설렘
];
/* 기본 0~14를 고친 값(S.settings.baseSits[번호] = {prompt?, motion?} — 이미지 스튜디오의 ✎, 계정에도 저장). 이름은 SIT 그대로(AI 규칙이 이름으로 번호를 찾음), 수위는 작품마다(sheetRating) */
export const baseSit = (n) => { const o = (S.settings.baseSits || {})[n]; return o && typeof o === "object" ? o : null; };
export const baseSitDefault = (n) => SIT_PONY_TAGS[n] || "";
/* 감정/행동 번호 → 장면 태그 글: 고친 기본 칸 → 기본 칸 → 칸 정의 */
const sceneOf = (n) => (baseSit(n) || {}).prompt || SIT_PONY_TAGS[n] || sitDef(n)?.prompt || "";
// 싸우는 장면(0 프로필·9 부상·12 공격·13 각성)이 아니면 외모의 무기를 뺌 — 무기가 있으면 모든 칸이 같은 무기 든 자세로 끌려감
const COMBAT_SITS = [0, 9, 12, 13];
/* 무기 낱말: 쉼표로 나눈 태그 한 조각을 봄 — 그래서 검$·칼$처럼 끝을 봐도 '검은 머리'에 걸리지 않음. 한글은 끝을 봐서 도끼눈에 걸리지 않게, hair bow·bow tie는 무기가 아니라서 bow는 혼자 있을 때만, gunslinger·whipped cream은 낱말 경계로 빠짐. club은 뜻이 여럿이라 넣지 않음 */
const WEAPON_RE = /레이피어|장검|단검|대검|검$|칼$|비수|창$|활$|권총|리볼버|소총|라이플|총$|석궁|방패|배트$|쇠파이프|도리깨|타구봉|곤봉$|몽둥이$|도끼$|철퇴$|망치$|채찍$|낫$|언월도|무기|^bows?$|\bbow and arrows?\b|\b(?:cross|long)bows?\b|\b(?:long|great|short)?swords?\b|\b(?:weapon|rapier|katana|blade|dagger|knife|spear|gun|handgun|shotgun|pistol|revolver|rifle|musket|flintlock|shield|bat|baton|pipe|flail|axe|mace|hammer|whip|scythe|lance|halberd|naginata|glaive|polearm|trident|(?:bamboo|iron|wooden) staff)s?\b/i;
/* 12 공격은 맨손·무기 모두: 장면 태그는 맨손 기준이고, 무기 낱말이 있는 인물은 주먹 낱말(FIST_RE)을 빼고 무기를 쥠 — fighting stance가 있으면 무기를 줘도 주먹을 쥠(fd97) */
const ATTACK_SITS = [12], FIST_RE = /^(?:fighting stance|clenched hands?|raised fists?)$/i;
/* 총은 넷으로 나눔(사용자 요청 — 권총과 리볼버를 구분): 긴 총 → 리볼버 → 쌍권총 → 권총 순서로 봄. 저격총·엽총 같은 한글은 끝이 총이라 권총 줄보다 먼저 봐야 함 */
const SNIPER_RE = /sniper|저격/i, LONG_GUN_RE = /rifle|musket|shotgun|소총|라이플|저격|엽총|산탄|기관총|장총|머스킷/i, REVOLVER_RE = /revolver|리볼버/i, DUAL_GUN_RE = /pistols\b|쌍권총/i, PISTOL_RE = /gun|pistol|flintlock|권총|총$/i;
const POLE_RE = /halberd|polearm|lance|naginata|glaive|trident|언월도/i, BOW_RE = /bow|활$/i, CROSSBOW_RE = /crossbow|석궁/i, WHIP_RE = /whip|채찍$/i, SCYTHE_RE = /scythe|낫$/i, AXE_RE = /axe|도끼$/i, HAMMER_RE = /hammer|mace|망치$|철퇴$/i;
/* 공격 칸의 무기 낱말 앞에 붙이는 '쥔 모습': holding sword·holding gun처럼 Danbooru 낱말에 가중치까지 있어야 손에 그려짐 — holding rapier·장면의 holding weapon만으로는 빈손(fd96~fd100). 소총에 holding gun을 쓰면 권총으로 나옴, 쌍권총에 holding handgun을 쓰면 한 자루만 나옴(fd119) */
const WEAPON_GRIP = [[/dagger|비수|단검/i, "holding dagger"], [/knife/i, "holding knife"], [/sword|rapier|katana|blade|레이피어|장검|대검|검$|칼$/i, "holding sword"], [LONG_GUN_RE, "holding rifle"], [REVOLVER_RE, "holding revolver"], [DUAL_GUN_RE, "holding gun"], [PISTOL_RE, "holding handgun"], [/shield|방패/i, "holding shield"], [POLE_RE, "holding polearm"], [/spear|창$/i, "holding spear"], [CROSSBOW_RE, "holding crossbow"], [BOW_RE, "holding bow"], [WHIP_RE, "holding whip"], [SCYTHE_RE, "holding scythe"], [AXE_RE, "holding axe"], [HAMMER_RE, "holding hammer"], [/flail|도리깨/i, "holding flail"], [/staff|타구봉/i, "holding staff"]];
const gripOf = (t) => "(" + (WEAPON_GRIP.find((g) => g[0].test(t)) || [null, "holding weapon"])[1] + ":1.4)";
/* 무기를 쥔 공격 자세(사용자 요청 — 무기 모습이 보이게, 긴 무기·총은 앞으로, 자연스럽게). 위 줄이 먼저.
   쥔 낱말과 무기 낱말은 장면 맨 앞으로 옮기고 인물 묶음에서는 뺌 — 인물 묶음에 두면 칼을 등 뒤에 지거나 손이 빔(fd114 → fd115). 몸을 비스듬히 틀고(three-quarter view) 무기를 대각선으로 쥐면 자연스럽고 무기 전체가 보임.
   낱말은 비교 생성으로 고름(fd103~fd122): pointing …은 칼 대신 큰 손가락을 그림, arms raised는 팔을 어색하게 치켜듦, foreshortening·incoming attack·sword aimed는 듣지 않음, full body는 맨발에 칼 두 자루. 칼끝이 정면을 향하지는 않고 소총은 어깨에 대고 조준하지는 못함 — 시드마다 다르니 저장 전에 눈으로 볼 것.
   총 낱말의 함정(fd119·fd120): wooden grip은 배경을 나무판으로 바꾸고, western revolver·six-shooter는 다른 인물을 그리고, trigger guard는 군인을 그리기도 함. flintlock을 더해도 부싯돌 총으로 보이지 않아 넣지 않음 */
const WEAPON_STANCE = "three-quarter view, looking at viewer, (fighting stance:1.2)", GUN_POSE = "three-quarter view, looking at viewer, (aiming:1.3)", RIFLE_POSE = GUN_POSE + ", rifle raised, rifle stock on shoulder, long barrel";
const WEAPON_AIM = [
  [SNIPER_RE, RIFLE_POSE + ", scope, finger on trigger"],
  [LONG_GUN_RE, RIFLE_POSE + ", finger on trigger"],
  [REVOLVER_RE, GUN_POSE + ", revolver cylinder, long barrel, one-handed, arm extended forward, finger on trigger"],
  [DUAL_GUN_RE, "(dual wielding:1.4), two guns, gun in each hand, " + GUN_POSE + ", arms apart, arms extended forward, finger on trigger"],
  [PISTOL_RE, "handgun, semi-automatic pistol, " + GUN_POSE + ", two-handed, arms extended forward, finger on trigger"],
  [/dagger|knife|비수|단검/i, WEAPON_STANCE + ", one-handed, blade forward, wind"],
  [/sword|rapier|katana|blade|레이피어|장검|대검|검$|칼$/i, WEAPON_STANCE + ", two-handed, sword held diagonally, unsheathed, long blade, wind"],
  [POLE_RE, WEAPON_STANCE + ", two-handed, huge weapon, weapon over shoulder, wind"],
  [/spear|창$/i, WEAPON_STANCE + ", two-handed, spear held diagonally, wind"],
  [/staff|타구봉/i, WEAPON_STANCE + ", two-handed, staff held diagonally, wind"],
  [CROSSBOW_RE, GUN_POSE + ", two-handed, arms extended forward, finger on trigger"],
  [BOW_RE, "archery, (drawing bow:1.3), arrow, bowstring, bow raised, three-quarter view, looking at viewer"],
  [WHIP_RE, WEAPON_STANCE + ", one-handed, wind"],
  [SCYTHE_RE, WEAPON_STANCE + ", two-handed, huge weapon, weapon over shoulder, wind"],
  [AXE_RE, WEAPON_STANCE + ", two-handed, huge weapon, weapon over shoulder, wind"],
  [HAMMER_RE, WEAPON_STANCE + ", two-handed, huge weapon, weapon over shoulder, wind"],
  [/baton|flail|pipe|\bbat\b|도리깨|쇠파이프|배트$|곤봉$|몽둥이$/i, WEAPON_STANCE + ", two-handed, weapon held diagonally, wind"],
  [/shield|방패/i, WEAPON_STANCE + ", shield raised, shield in front of body, wind"]
];
// 의상 번호가 붙은 조합이면 외모 글의 옷 조각을 뺌 — 설정의 옷과 의상 코드가 겹치면 둘이 섞여 그려짐
const CLOTH_RE = /옷|복(?![가-힣])|드레스|셔츠|블라우스|정장|수트|슈트|코트|재킷|자켓|치마|스커트|바지|청바지|원피스|한복|제복|갑옷|갑주|로브|망토|가운|니트|후드|티셔츠|넥타이|구두|부츠|힐(?![가-힣])|샌들|장갑|모자|베레|두건|도포|무복|도복|기모노|유카타|\b(?:dress|shirt|blouse|suit|coat|jacket|skirt|pants|jeans|uniform|armor|robe|cloak|cape|gown|sweater|hoodie|t-shirt|tie|shoes|boots|heels|gloves|hat|cap|beret|hood|kimono|yukata|hanbok|outfit|clothes|clothing)\b/i;
export const splitTags = (t) => String(t || "").split(/\s*,\s*/).map((x) => x.trim()).filter(Boolean);
/* 외모 글 → 인원·성별 태그. 남자는 male focus까지 넣어야 Pony 계열이 여자로 바꿔 그리지 않음. 사람 낱말 없이 동물만 있으면 사람 없는 그림 */
const HUMAN_RE = /남성|여성|남자|여자|소년|소녀|청년|사람|인간|\d+\s*세|\b(?:male|female|man|woman|boy|girl|human|person)\b/i;
const ANIMAL_RE = /고양이|강아지|진돗개|늑대|여우|토끼|곰|사슴|호랑이|사자|까마귀|부엉이|올빼미|독수리|참새|비둘기|드래곤|뱀|물고기|고래|햄스터|다람쥐|판다|펭귄|동물|짐승|\b(?:cat|dog|puppy|kitten|wolf|fox|rabbit|bear|deer|tiger|lion|horse|bird|crow|owl|eagle|hawk|dragon|snake|fish|whale|hamster|squirrel|panda|penguin|animal|creature|beast)s?\b/i;
export const lookIsMale = (look) => /남성|남자|\b(?:male|man|boy|1boy)\b/i.test(String(look || "")) && !/여성|여자|\b(?:female|woman|girl|1girl)\b/i.test(String(look || ""));
function whoTags(look) {
  const l = String(look || "");
  if (!HUMAN_RE.test(l) && ANIMAL_RE.test(l)) return ["no humans", "animal focus"];
  return lookIsMale(l) ? ["1boy", "male focus", "solo"] : ["1girl", "solo"];
}
/* 저장 태그(tagpacks)는 감정/행동 번호에 묶임 — 의상·장소는 칸 정의가 모든 인물에 공통이라 따로 저장하지 않음 */
const actKeyOf = (key) => keyOf(splitDims(parseCodes(String(key))).act) || "1";
/* 이미지 칸 프롬프트를 묶음별로: 장면(표정·자세) → 인물(성별·외모) → 의상(조합에 있을 때) → 배경(장소 번호가 있으면 그 장소).
   key는 번호(3) 또는 조합 키("3,404,501"). 장면이 앞에 와야 표정이 반영됨(2026-11 비교 생성으로 확인). 그림체·품질·수위 태그는 runwareImage가 뒤에 붙임.
   출연진에 영문 태그 tags가 있으면(오리지널 12작품은 전부, 1:1 작품은 lookTags) 외모 글 대신 번역 없이 그대로 써서 같은 인물이 매번 같은 생김새로 — 성별·인원(whoTags)은 한국어 look으로 */
function slotParts(cast, key, c) {
  const codes = parseCodes(String(key)), d = splitDims(codes), acts = d.act.length ? d.act : [1], look = castLook(cast, c);
  const wear = d.wear ? sitDef(d.wear) : null, place = d.place ? sitDef(d.place) : null, combat = acts.some((n) => COMBAT_SITS.includes(n)), dressed = !!(wear && wear.prompt), weapons = splitTags(cast.tags || look).filter((t) => WEAPON_RE.test(t)), armed = acts.some((n) => ATTACK_SITS.includes(n)) && weapons.length > 0;
  let scene = []; acts.forEach((n) => splitTags(sceneOf(n)).forEach((t) => { if (!scene.includes(t)) scene.push(t); }));
  if (!scene.length) scene = splitTags(sceneOf(1));
  const aim = armed ? WEAPON_AIM.find((r) => weapons.some((t) => r[0].test(t))) : null, held = aim ? weapons.filter((t) => aim[0].test(t)) : [];
  if (armed) {
    const rest = scene.filter((t) => !FIST_RE.test(t) && !(aim && t === "action pose"));
    // sword at hip처럼 자리가 붙은 낱말은 칼을 뒤로 보내서 무기만(fd115 → fd116)
    // 무기 낱말이 둘이면(improvised shield, bus door shield) 쥔 낱말은 한 번만
    scene = aim ? [...new Set(held.flatMap((t) => [gripOf(t), t.replace(/\s+at hip$/i, "")])), ...splitTags(aim[1]), "cowboy shot", ...rest] : ["holding weapon", ...rest];
  }
  const out = [
    { key: "scene", label: "장면·표정", tags: scene },
    { key: "look", label: "인물", tags: [...whoTags(look), ...splitTags(cast.tags || look).filter((t) => (combat || !WEAPON_RE.test(t)) && !held.includes(t) && !(dressed && CLOTH_RE.test(t))).flatMap((t) => armed && !aim && WEAPON_RE.test(t) ? [gripOf(t), t] : [t])] }
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
/* 장면·추가 묶음만 영문으로 — 화풍이 행동·시선을 정한 칸을 가리는 데 씀(runwareImage의 scene, style-fit.js sceneMoves). 인물·옷 태그가 섞이면 모든 칸이 행동으로 보임. 번역은 partsTags와 같은 글이라 캐시에서 나옴 */
export const poseTags = (parts, adult) => groupsPrompt(parts.filter((g) => g.key === "scene" || g.key === "extra"), adult);
/* 세계관 일러스트 구도: 키워드북 항목의 종류(kind — ui/worldart.js LORE_KINDS)마다. 인물은 상반신 초상, 동물·괴물은 그 존재, 장소는 사람 없는 풍경, 물건은 정물 클로즈업, 사건·세력·설정은 장면 */
const LORE_SHOT = {
  person: "upper body, portrait, detailed background",
  creature: "no humans, animal focus, solo, detailed background",
  place: "scenery, no humans, wide shot, detailed background",
  item: "still life, close-up, object focus, no humans, detailed",
  event: "dramatic scene, cinematic composition, wide shot",
  group: "cinematic composition, wide shot, detailed background",
  concept: "symbolic, cinematic composition, atmospheric"
};
/* 세계관 일러스트(키워드북 항목, 16:9): 구도 → 항목 영문 태그 → 작품의 세계관 태그(artTags — 시대·장소·분위기 낱말). 단어 꼴이라 번역 없이 그대로 감.
   태그가 없는 항목(내 작품 키워드북)은 예전처럼 풍경 구도 + 설명 글(생성 창에서 한국어 → 영문 태그로 번역) */
export function lorePrompt(c, e) {
  const shot = LORE_SHOT[e.kind] || "scenery, wide shot, detailed background";
  return [shot, e.tags || e.text, c.artTags, "atmospheric lighting, no text"].filter(Boolean).join(", ");
}
