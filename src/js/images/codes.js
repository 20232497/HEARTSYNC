/* 그림 상황 코드(순수 — SIT 상수만 import해 Node 단위 테스트가 바로 씀): 번호 차원, 조합 태그 파싱, 조합 키, 의상·장소 이어 가기(applyDims·lastDims), 내장 코드(DIMS).
   번호 체계: 0~14 기본 감정(SIT) · 15~99 직접 만든 감정/행동 칸(customSits) · 100~399 세부 감정/행동 · 400~499 의상 · 500~599 장소.
   본문 태그 [[img:인물코드:3,404,501]] — 감정/행동(최대 둘) 뒤에 의상·장소를 쉼표로. 조합 키는 "감정(오름차순),의상,장소" 문자열이고
   번호가 하나면 그 번호 그대로("3")라 예전 슬롯 저장(images[코드][번호])과 호환. 400(기본 의상)·500(기본 배경)은 '설정대로 되돌리기'라 키에서는 빠짐.
   노골적인 코드는 내장하지 않음 — 사용자가 '목록으로 추가'에서 가져와 성인 수위로 둠(CLAUDE.md 수위 원칙). dimDef·DIMS·dimOf는 tools/build.mjs의 APP_RULES가 꺼내 씀 */
import { SIT } from "../core/constants.js";

export const DIM_NAMES = { act: "감정/행동", wear: "의상", place: "장소" };
export const RESET = { wear: 400, place: 500 }; // 의상·장소를 설정대로 되돌리는 번호
export const RANK = { safe: 0, questionable: 1, explicit: 2 };
export const maxRating = (list) => list.reduce((a, r) => (RANK[r] || 0) > (RANK[a] || 0) ? r : a, "safe");
/* 번호 → 차원. 600 이상은 쓰지 않음(감정/행동으로 봄) */
export function dimOf(n) { return n >= 400 && n < 500 ? "wear" : n >= 500 && n < 600 ? "place" : "act"; }
/* 내장 코드: 모든 인물에 공통. prompt는 영문 Danbooru 태그(번역 없이 바로 씀), keys는 유저 입력·지문에서 이 번호를 고를 때 보는 한국어 낱말(정규식 조각).
   rating이 questionable인 것은 성인 확인(ageOK) 뒤에만 보이고 세미 수위로 그림. 직접 만든 칸이 같은 번호를 쓰면 그 칸이 덮음 */
const dimDef = (n, name, prompt, keys, rating) => [n, { n, name, prompt, keys: keys || "", rating: rating || "safe", dim: dimOf(n), builtin: true }];
/* 전체이용가 행의 prompt는 관리자 빌드에서 admin/motion-table.js의 base_prompt가 덮음(admin/motion-prompts.js) — 여기를 고쳐도 표에 같은 번호가 있으면 관리자 도구는 표를 따름 */
export const DIMS = Object.fromEntries([
  // 100번대: 세부 감정·일상
  dimDef(101, "미소", "smile, soft expression, gentle eyes, warm atmosphere, happy", "미소|싱긋|빙긋|방긋"),
  dimDef(102, "분노 표출", "furrowed brow, cold eyes, stern expression, hostile, glaring", "적대|노려보|분노"),
  dimDef(103, "당황", "panicked, nervous sweat, flushed face, averting eyes, stiff posture", "당황|허둥|어쩔 줄|말문이"),
  dimDef(104, "달아오름", "heavy breathing, flushed, wet eyes, half-closed eyes, blush", "달아오|숨이 가빠|젖은 눈|열이 오", "questionable"),
  dimDef(105, "취기", "drunk, glazed eyes, unsteady, blush, languid", "취했|취한|술에 취|비틀거"),
  dimDef(106, "오열", "tears, sobbing, head down, sad eyes, trembling lips", "오열|흐느|울음을 터|눈물이 터"),
  dimDef(107, "수줍음", "blush, looking away, fidgeting fingers, shy, faint smile", "수줍|쑥스|머뭇"),
  dimDef(108, "차가운 정색", "expressionless, cold stare, crossed arms, distant, looking down at viewer", "정색|냉담|차갑게|싸늘"),
  dimDef(109, "탈진", "panting, sitting on ground, sweat, slumped, heavy breathing", "탈진|헐떡|주저앉|녹초"),
  dimDef(110, "질투", "pout, side glance, crossed arms, possessive, sulking", "질투|샘이 나|샘나"),
  dimDef(111, "유혹", "licking lips, sultry gaze, seductive pose, bedroom eyes, leaning close", "유혹|도발|요염|끈적", "questionable"),
  dimDef(112, "애교", "looking up at viewer, puppy eyes, clinging, cute, cheek press", "애교|부비|달라붙|칭얼"),
  dimDef(113, "거부", "hand blocking, turning head away, grimace, resisting, pushing away", "밀쳐|밀어내|거부|뿌리치"),
  dimDef(114, "허탈", "empty eyes, blank expression, listless, sigh, slumped shoulders", "허탈|공허|멍하니|무기력"),
  dimDef(115, "안도", "relieved, relaxed shoulders, deep breath, soft smile, hand on own chest", "안도|한숨 돌|가슴을 쓸어"),
  dimDef(116, "장난", "wink, tongue out, playful smile, mischievous, teasing", "장난스|윙크|메롱|능청"),
  dimDef(117, "애틋함", "wistful eyes, gentle touch, tender, affectionate, eye contact", "애틋|그리워|그립|아련"),
  dimDef(118, "경계", "side glance, narrowed eyes, leaning back, defensive stance, tense", "경계|의심|수상|미심쩍"),
  dimDef(119, "절망", "head in hands, staring at floor, collapsed posture, despair, tear stains", "절망|좌절|무너져|주저앉아 울"),
  dimDef(120, "환희", "big smile, hands together, bright expression, excited, sparkling eyes", "환희|기뻐|기쁘|신이 나|신나"),
  dimDef(121, "경악", "open mouth, wide eyes, stepping back, hand over own mouth, frozen", "경악|기겁|헉|소스라"),
  dimDef(122, "식사", "eating, holding wine glass, tableware, food, satisfied expression", "식사|먹|마시|와인|술잔|건배"),
  dimDef(123, "게임", "looking at monitor, serious expression, typing, holding controller, focused", "게임|컨트롤러|모니터|키보드"),
  dimDef(124, "졸음", "closed eyes, nodding off, yawning, calm breathing, rubbing eyes", "졸려|졸음|하품|잠들|꾸벅"),
  dimDef(125, "독서", "turning page, glasses, writing, focused eyebrows, quiet", "책을|독서|공부|필기|읽"),
  dimDef(126, "잡담", "light hand gesture, talking, eye contact, listening, nodding", "잡담|수다|대화를 나"),
  dimDef(127, "쓰다듬 받음", "closed eyes, pleased expression, hand on head, soft hair, warmth", "쓰다듬|머리를 토닥|토닥"),
  dimDef(128, "무릎베개", "lap pillow, lying on lap, looking down at viewer, peaceful face, intimate", "무릎베개|무릎에 누|무릎을 베"),
  dimDef(129, "간지럼", "flinching, giggling, dodging, cheerful", "간지럼|간지러|까르르"),
  dimDef(130, "토라짐", "turning away, pursed lips, puffed cheeks, not looking, sulking", "토라|삐졌|삐친|흥,"),
  dimDef(131, "요리", "apron, kitchen utensils, focused, tasting, homely atmosphere", "요리|부엌|앞치마|베이킹|주방"),
  dimDef(132, "스마트폰", "phone screen glow, typing on phone, looking at phone, lowered eyes, nonchalant", "스마트폰|휴대폰|핸드폰|문자를|메시지를 보"),
  dimDef(133, "기지개", "arms raised, stretching, closed eyes, languid, flexible", "기지개|스트레칭"),
  dimDef(134, "단장", "looking in mirror, applying lipstick, brushing hair, getting ready, dressed up", "화장|거울 앞|립스틱|단장|꾸미"),
  dimDef(135, "음악 감상", "earphones, nodding to rhythm, closed eyes, calm, humming", "음악|이어폰|노래를 들|흥얼"),
  dimDef(136, "심호흡", "deep breath, chest rising, calming down, closed eyes, composing oneself", "심호흡|숨을 고르|진정"),
  dimDef(137, "초조", "checking watch, tapping foot, looking around, biting lip, restless", "초조|안절부절|시계를|입술을 깨"),
  dimDef(138, "억지 미소", "forced smile, stiff smile, sad eyes, hidden pain, trembling", "억지로 웃|억지웃음|애써 웃"),
  dimDef(139, "감동", "overwhelmed expression, tears streaming, bright smile, hands together, sparkling eyes", "감동|벅차|울컥|코끝이"),
  dimDef(140, "짜증", "hand on own forehead, deep sigh, sharp glare, irritated, standing on one leg", "짜증|신경질|이마를 짚|성가"),
  // 400번대: 의상. 400은 '설정대로'(프롬프트 없음). 체육복·알몸 같은 것은 내장하지 않음
  dimDef(400, "기본 의상", "", ""),
  dimDef(401, "비키니", "micro bikini, string bikini, wet, beach", "비키니|수영복", "questionable"),
  dimDef(402, "바니걸", "bunny suit, fishnet pantyhose, rabbit ears, highleg leotard, bunny tail", "바니걸|토끼 귀", "questionable"),
  dimDef(403, "메이드", "maid, maid headdress, apron, frills, lace", "메이드"),
  dimDef(404, "오피스룩", "office lady, pencil skirt, blouse, glasses, black pantyhose, formal", "오피스|정장|블라우스|출근"),
  dimDef(405, "오버핏 셔츠", "oversized shirt, off shoulder, bare legs, morning light, loose fit", "셔츠 한 장|셔츠만|오버핏", "questionable"),
  dimDef(407, "란제리", "lingerie, see-through, lace underwear, garter belt", "란제리|속옷 차림", "questionable"),
  // 500번대: 장소. 500은 '자동 배경'(프롬프트 없음)
  dimDef(500, "기본 배경", "", ""),
  dimDef(501, "침실", "bedroom, king bed, mood lamp, fluffy blanket, dim lighting", "침실|침대"),
  dimDef(502, "샤워실", "shower room, running water, steam, foggy mirror, wet hair", "샤워|욕실", "questionable"),
  dimDef(503, "소파", "sofa, living room, leather couch, lying on couch, spacious room", "소파|거실"),
  dimDef(504, "차 안", "car interior, car seat, tinted windows, night, intimate space", "차 안|조수석|운전석"),
  dimDef(505, "영화관", "movie theater, screen glow, back row seats, dark, hushed", "영화관|극장|스크린"),
  dimDef(506, "화장실 칸", "restroom stall, tiled wall, narrow stall, leaning on door", "화장실"),
  dimDef(507, "야외", "outdoors, nature scenery, night air, wind, open sky", "야외|들판|숲속|공원|밤하늘")
]);
export const MAX_ACT = 2; // 한 태그의 감정/행동 번호 최대 수
const isReset = (n) => n === RESET.wear || n === RESET.place;
/* "101,404,501" 또는 숫자 → 번호 배열(중복·이상한 값 제거, 순서 유지) */
export function parseCodes(spec) {
  const out = [];
  for (const p of String(spec === undefined || spec === null ? "" : spec).split(",")) {
    const t = p.trim(); if (!/^\d{1,3}$/.test(t)) continue;
    const n = +t; if (out.indexOf(n) < 0) out.push(n);
  }
  return out;
}
/* 번호 배열 → { act: [...], wear: n|null, place: n|null }. 의상·장소는 마지막 것이 이김(400·500도 그대로 남김 — applyDims가 되돌리기로 읽음), 감정/행동은 MAX_ACT개까지 */
export function splitDims(codes) {
  const d = { act: [], wear: null, place: null };
  for (const n of codes) { const k = dimOf(n); if (k === "act") { if (d.act.length < MAX_ACT) d.act.push(n); } else d[k] = n; }
  return d;
}
/* 조합 키: 감정/행동(오름차순) → 의상 → 장소, 400·500은 뺌. 번호 하나면 "3" 그대로(예전 슬롯 키와 같음) */
export function keyOf(codes) {
  const d = splitDims(Array.isArray(codes) ? codes : parseCodes(codes));
  return [...d.act.slice().sort((a, b) => a - b), d.wear, d.place].filter((n) => n !== null && n !== undefined && !isReset(n)).join(",");
}
/* 조합 키에서 '그림 찾기' 폴백 후보 순서: 조합 그대로 → 감정/행동만 → 첫 감정 번호 → 1 기본 → 0 프로필 */
export function fallbackKeys(key) {
  const k = keyOf(String(key)), d = splitDims(parseCodes(k)), actKey = d.act.slice().sort((a, b) => a - b).join(",");
  const out = [k];
  if (actKey && actKey !== k) out.push(actKey);
  if (d.act.length > 1) out.push(String(d.act[0]));
  for (const x of ["1", "0"]) if (out.indexOf(x) < 0) out.push(x);
  return out.filter(Boolean);
}
/* 본문의 그림 태그: code(인물), codes(번호들), key(조합 키), sit(첫 감정/행동 번호 — 예전 코드 호환), wear·place(400·500이면 되돌리기) */
export const IMG_TAG_RE = /\[\[img:([a-z0-9]+):([\d,]+)\]\]/gi;
export function imgTags(text) {
  return [...String(text || "").matchAll(IMG_TAG_RE)].map((m) => {
    const codes = parseCodes(m[2]), d = splitDims(codes);
    return { code: m[1].toLowerCase(), codes, key: keyOf(codes), sit: d.act.length ? d.act[0] : 1, wear: d.wear, place: d.place, raw: m[0] };
  });
}
/* 지금까지의 글(메시지 본문 배열)에서 인물별 현재 의상·장소. applyDims가 태그에 조합을 다 적어 두므로 그 인물의 마지막 태그가 현재 상태 */
export function lastDims(texts) {
  const d = {};
  (texts || []).forEach((t) => imgTags(t).forEach((x) => { d[x.code] = { wear: x.wear === RESET.wear ? null : x.wear, place: x.place === RESET.place ? null : x.place }; }));
  return d;
}
/* 이번 응답 본문의 태그에 인물별 의상·장소를 입힘: 태그에 의상·장소 번호가 있으면 그걸로 바꾸고(400·500은 설정대로 되돌림), 없으면 이어지는 것을 덧붙여
   본문에 그대로 남김 — 갤러리·내보내기·다시 그리기·다른 기기가 같은 조합을 봄. dims는 lastDims(이전 메시지들) */
export function applyDims(body, dims) {
  const cur = {}; Object.keys(dims || {}).forEach((k) => { cur[k] = { wear: dims[k].wear || null, place: dims[k].place || null }; });
  return String(body).replace(IMG_TAG_RE, (raw, code, spec) => {
    code = code.toLowerCase();
    const d = splitDims(parseCodes(spec)), s = cur[code] = cur[code] || { wear: null, place: null };
    if (d.wear !== null) s.wear = d.wear === RESET.wear ? null : d.wear;
    if (d.place !== null) s.place = d.place === RESET.place ? null : d.place;
    const all = [...d.act, s.wear, s.place].filter((n) => n !== null && n !== undefined);
    return `[[img:${code}:${all.length ? all.join(",") : "1"}]]`;
  });
}
/* 빈 번호: 직접 만든 감정/행동은 15~99 → 101~399, 의상은 410~499 → 401~409, 장소는 510~599 → 501~509(내장 번호 뒤부터). 없으면 -1 */
export function freeNum(used, dim) {
  const ranges = dim === "wear" ? [[410, 500], [401, 410]] : dim === "place" ? [[510, 600], [501, 510]] : [[SIT.length, 100], [101, 400]];
  for (const [a, b] of ranges) for (let n = a; n < b; n++) if (!used.has(n)) return n;
  return -1;
}
/* 쓰고 있는 번호(직접 만든 칸 + 내장 코드) — 새 번호를 줄 때 내장 코드를 가리지 않게 */
export const usedNums = (list) => new Set([...(list || []).map((d) => d.n), ...Object.keys(DIMS).map(Number)]);
/* 코드 이름(기본·내장만 — 직접 만든 칸은 situations.sitName이 customSits까지 봄) */
export function baseName(n) { return SIT[n] || (DIMS[n] && DIMS[n].name) || ""; }
