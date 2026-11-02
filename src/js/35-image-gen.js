/* ---------------------------------------------------------------- AI 이미지 생성: Runware API (SDXL 계열 모델, Danbooru 영문 태그 프롬프트)
   이름·설명은 한국어. 모델은 영문 태그만 알아들으므로 한글(외모·키워드북·직접 쓴 그림체)은 보내기 직전 ponyTags()가 영문 태그로 바꿈 */
/* 이미지 모델(Runware AIR). arch마다 품질 태그·수위 태그·CFG가 다름. 모두 Runware에서 실제 생성 확인(2026-10) */
const IMG_MODELS = [
  // 세미리얼은 CFG 7이면 인형처럼 인위적, 4.5면 표정을 안 따름 → 6 + 플라스틱·인형 피부 네거티브(2026-10·11 비교 생성으로 정함)
  { id: "civitai:548016@861939", name: "세미리얼 PonyXL (Run七八造 v2)", arch: "pony", cfg: 6, neg: "3d, cgi, plastic skin, doll, airbrushed, oversaturated, heavy makeup" },
  { id: "civitai:142601@686323", name: "한국 웹툰 PonyXL (ToonyStark)", arch: "pony" },
  { id: "civitai:827184@1761560", name: "애니 일러스트 (WAI Illustrious v14)", arch: "illustrious" },
  // Pony Diffusion V6 XL(Civitai 257749·버전 290640)은 Runware 자체 호스팅 ID "imagerouter:"로만 불러짐
  { id: "imagerouter:257749@290640", name: "Pony Diffusion V6 XL", arch: "pony", pos: "source_anime" }
];
const ARCH = {
  pony: { pos: "score_9, score_8_up, score_7_up", neg: "score_4, score_5, score_6, source_pony, source_furry", cfg: 7 },
  illustrious: { pos: "masterpiece, best quality, amazing quality, very aesthetic, absurdres, newest", neg: "bad quality, worst quality, worst detail, sketch, lowres, jpeg artifacts", cfg: 6 }
};
const imgModelInfo = (id) => IMG_MODELS.find((m) => m.id === id) || { id, name: id, arch: "pony" };
/* 그림체 프리셋: 모델 + 그림체 태그(그림체만 — 인물·구도·배경 태그를 넣으면 모든 그림이 그쪽으로 끌려감). 직접 입력·세트는 모델을 따로 고름 */
const IMG_STYLES = {
  webtoon: { name: "한국 웹툰 · 세미리얼", desc: "동양적인 얼굴과 자연스러운 반실사 채색. 로맨스·일상 웹툰 표지 느낌", model: IMG_MODELS[0].id, tags: "korean, semi-realistic, natural lighting, soft shading, realistic skin texture, natural makeup, detailed eyes" },
  mature: { name: "성인 웹툰 · 글래머", desc: "성숙한 인물, 부드러운 피부 음영과 영화 같은 조명. 19금 웹툰 표지 느낌(수위는 따로 골라요)", model: IMG_MODELS[0].id, tags: "korean, mature, semi-realistic, glamorous, soft skin shading, realistic skin texture, cinematic lighting, bokeh" },
  line: { name: "한국 웹툰 · 선화", desc: "또렷한 선과 깔끔한 셀 채색. 연재 웹툰 컷 느낌", model: IMG_MODELS[1].id, tags: "korean webtoon, manhwa, clean lineart, soft cel shading" },
  anime: { name: "애니 일러스트", desc: "선명한 색과 반짝이는 눈. 게임·라이트노벨 일러스트 느낌", model: IMG_MODELS[2].id, tags: "illustration, beautiful detailed eyes, detailed face, glossy lips, shiny hair, rich colors, cinematic lighting, light particles, depth of field" },
  oriental: { name: "동양 판타지", desc: "평면 채색과 가는 선, 붉은색·금색 위주. 무협·동양풍 일러스트 느낌", model: IMG_MODELS[2].id, tags: "oriental fantasy, flat color, cel shading, thin clean lineart, limited palette, crimson and gold" },
  custom: { name: "직접 입력", desc: "그림체를 한국어로 적어도 돼요. 만들 때 영문 태그로 바꿔 보내요", model: null, tags: "" }
};
const OLD_STYLES = { novel: "webtoon", none: "webtoon" }; // 예전 프리셋 이름 → 지금 이름
/* 그림체 세트: 그림 3장 + 그림체 문구 + 모델(S.settings.styleSets). imgStyle이 "set:<id>"면 세트를 씀 */
function activeSet() { const k = String(S.settings.imgStyle || ""); return k.startsWith("set:") ? (S.settings.styleSets || []).find((s) => "set:" + s.id === k) || null : null; }
function stylePreset() { return activeSet() ? null : IMG_STYLES[S.settings.imgStyle] || IMG_STYLES.webtoon; }
function styleLabel() { const s = activeSet(); return s ? "세트 · " + s.name : stylePreset().name; }
function imgStyleText() { const s = activeSet(); return (s ? s.prompt || "" : S.settings.imgStyle === "custom" ? S.settings.imgStyleCustom || "" : stylePreset().tags).trim(); }
/* 지금 그림체가 쓰는 모델: 프리셋은 고정, 세트·직접 입력은 고른 모델 */
function imgModelId() { const s = activeSet(); return (s ? s.model : stylePreset().model) || S.settings.imgModel || IMG_MODELS[0].id; }
function styleOptionsHTML() {
  const cur = S.settings.imgStyle;
  return [...Object.entries(IMG_STYLES).map(([k, p]) => [k, p.name]), ...(S.settings.styleSets || []).map((s) => ["set:" + s.id, "세트 · " + s.name])]
    .map(([k, l]) => `<option value="${esc(k)}" ${cur === k ? "selected" : ""}>${esc(l)}</option>`).join("");
}
/* 이름 앞부분이 같은 파일끼리(프롬1_…, 프롬2_…) 3장씩 묶음. 앞부분이 모두 다르면 이름 순서대로 3장씩 */
function groupStyleFiles(files) {
  const base = (n) => n.replace(/\.[^.]+$/, ""), split = (n) => /^(.+?)[_\-\s.](.*)$/.exec(base(n));
  const sorted = [...files].sort((a, b) => base(a.name).localeCompare(base(b.name), "ko", { numeric: true }));
  const key = (n) => (split(n)?.[1] || base(n).replace(/\d+$/, "")).trim() || base(n);
  const map = new Map();
  for (const f of sorted) { const k = key(f.name); if (!map.has(k)) map.set(k, []); map.get(k).push(f); }
  let groups = [...map.entries()].map(([k, fs]) => ({ k, fs, plain: false }));
  if (sorted.length > 1 && groups.every((g) => g.fs.length === 1)) groups = [{ k: "세트", fs: sorted, plain: true }];
  const out = [];
  for (const g of groups) for (let i = 0; i < g.fs.length; i += 3) {
    const fs = g.fs.slice(i, i + 3), desc = (split(fs[0].name)?.[2] || "").replace(/\d+$/, "").trim();
    const name = g.plain ? `세트 ${out.length + 1}` : g.k + (g.fs.length > 3 ? ` (${i / 3 + 1})` : "") + (desc ? ` · ${desc}` : "");
    out.push({ name: name.slice(0, 30), files: fs });
  }
  return out;
}
/* 브라우저만으로 ZIP 안의 그림 꺼내기 (무압축·deflate, 파일 이름 UTF-8/EUC-KR) */
async function unzipImages(file) {
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
/* 세트 이름으로 미리 고르는 문구·모델(그림을 읽기 전) — '애니'면 애니 일러스트, 그 밖은 한국 웹툰 세미리얼 */
const animeName = (name) => /애니|anime|만화|셀/i.test(name);
function guessStylePrompt(name) { return (animeName(name) ? IMG_STYLES.anime : IMG_STYLES.webtoon).tags; }
function guessStyleModel(name) { return (animeName(name) ? IMG_STYLES.anime : IMG_STYLES.webtoon).model; }
/* 표지 프롬프트: 세계관 작품은 주요 인물들이 모인 단체 표지, 1인 작품은 주인공 중심 */
function coverPrompt(c) {
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
const BAD_IMG_MODELS = ["civitai:257259@290640", "civitai:257749@290640"]; // 없는 모델·Runware가 못 불러오는 ID → 로드 때 고침
const RW_SIZES = { "4:5": [832, 1216], "3:4": [832, 1216], "1:1": [1024, 1024], "16:9": [1216, 832] };
const IMG_NEG = "text, watermark, signature, logo, deformed, bad anatomy, bad hands, missing fingers, extra digits, blurry, low quality";
// 미성년 태그는 수위와 상관없이 늘 네거티브에(CLAUDE.md 수위 원칙)
const NEG_MINOR = "child, loli, shota, underage, toddler, aged down";
/* 이미지 수위: 성인 확인(ageOK) 전·claude.ai 안에서는 항상 safe. pos는 Pony용, ill은 Illustrious용 rating 태그, neg는 그 수위에서 막을 태그 */
const RATINGS = {
  safe: { name: "전체이용가", pos: "rating_safe", ill: "general", neg: "nsfw, nude, explicit, questionable, rating_explicit, rating_questionable" },
  // 수위 태그는 짧게: nsfw·mature를 겹쳐 넣으면 모델이 프롬프트(표정·외모)보다 노출 쪽으로 끌려가 다른 인물처럼 그림(2026-11)
  questionable: { name: "세미 수위", pos: "rating_questionable", ill: "questionable", neg: "explicit, rating_explicit, school uniform" },
  explicit: { name: "성인 전용", pos: "rating_explicit", ill: "nsfw, explicit", neg: "school uniform" }
};
/* AI 그림 수위는 기본 전체이용가. 세미·성인은 성인 확인 뒤 직접 만든 칸의 수위나 시트·생성 창에서 고를 때만 */
function imgRating(want = "safe") { return ageOK() && RATINGS[want] ? want : "safe"; }
/* 시트별 그림 수위(이미지 슬롯의 기본 칸은 작품 id, 세계관 일러스트는 "w:" + id). 고른 적 없으면 전체이용가 */
function sheetRating(key) { return imgRating((S.settings.sheetRatings || {})[key]); }
function setSheetRating(key, v) { S.settings.sheetRatings = { ...(S.settings.sheetRatings || {}), [key]: v }; saveSettings(); }
/* 수위 고르기 칸: 성인 확인 전·claude.ai 안에서는 전체이용가로 잠그고 이유를 보여 줌 */
function ratingFieldHTML(id, cur, label = "수위") {
  const ok = ageOK(), v = ok ? imgRating(cur) : "safe";
  return `<div class="field rate-field"><label for="${id}">${esc(label)}</label><select id="${id}" ${ok ? "" : "disabled"}>${Object.entries(RATINGS).map(([k, r]) => `<option value="${k}" ${k === v ? "selected" : ""}>${esc(r.name)}</option>`).join("")}</select>${ok ? ""
    : `<p class="note">${IN_CLAUDE ? "claude.ai 안에서는 전체이용가만 만들 수 있어요." : "세미·성인 수위는 MY → 설정 → AI 연결에서 '만 19세 이상'을 켜고 설정 저장을 누르면 고를 수 있어요."}</p>`}</div>`;
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
const splitTags = (t) => String(t || "").split(/\s*,\s*/).map((x) => x.trim()).filter(Boolean);
/* 출연진 외모가 비었을 때: 캐릭터 설정의 "이름(나이, 성별)"과 "외모:" 부분으로 대신(성별이 틀린 1girl 기본값 방지) */
function personaWho(c) { const w = String(c?.persona || "").match(/\((\d{1,2})\s*,\s*([남여])\)/); return w ? `${w[1]}세 ${w[2] === "남" ? "남성" : "여성"}` : ""; }
function personaLook(c) {
  const look = (String(c?.persona || "").match(/외모\s*[:：]\s*([^\n]+)/) || [])[1] || "";
  return [personaWho(c), look.trim().replace(/[.。]\s*$/, "")].filter(Boolean).join(", ");
}
/* 인물 외모 태그 자리: 출연진 외모 → 비었으면 설정의 외모. 주인공(c) 외모에 성별이 없으면 설정의 "나이 성별"을 앞에 붙임 */
function castLook(cast, c) {
  const l = String(cast?.look || "").trim();
  if (!l) return personaLook(c);
  const who = cast.code === "c" && !/남성|여성|남자|여자|\b(?:male|female|girl|boy|man|woman)\b/i.test(l) ? personaWho(c) : "";
  return [who, l].filter(Boolean).join(", ");
}
/* 직접 추가하는 이미지 칸(S.settings.customSits = [{n, name, prompt, rating}]): 모든 인물에 공통, 번호는 15부터.
   성인 수위 칸은 성인 확인(ageOK) 때만 보이고, 대화에서는 성인 경로(unfilteredRoute)일 때만 AI에게 알려 줌 */
const CUSTOM_BASE = SIT.length, CUSTOM_MAX = 60;
function sitDef(n) { return n >= CUSTOM_BASE ? (S.settings.customSits || []).find((d) => d.n === n) || null : null; }
function sitName(n) { return SIT[n] || sitDef(n)?.name || "칸 " + n; }
function customSits() { return (S.settings.customSits || []).filter((d) => d.rating === "safe" || ageOK()); }
const slotNums = () => [...SIT.keys(), ...customSits().map((d) => d.n)]; // 슬롯 시트에 보이는 칸 번호
/* 상황 번호를 고르는 낱말(정규식 조각). AI가 그림을 빠뜨린 인물의 번호를 고를 때와, 유저 입력에서 번호 후보를 뽑을 때 씀 */
const SIT_KEYS = { 2: "웃|미소|싱긋|방긋|피식|킥킥|깔깔|농담|재밌", 3: "부끄|수줍|민망|얼굴이 (?:붉|빨개)|귀까지|빨개|장난|놀리|놀려|짓궂|칭찬|예쁘|예쁜|예뻐|귀여|귀엽",
  4: "울먹|울었|우는|눈물|슬프|슬퍼|흐느|서럽|그리워", 5: "놀라|놀란|깜짝|화들짝|헉|휘둥그|설마", 6: "화가|화를|화난|분노|노려|버럭|소리쳤|이를 악|짜증|열받|닥쳐",
  7: "삐졌|삐친|삐죽|토라|흥[,.!…]|볼을 부풀|서운|입을 내밀", 8: "무서|두려|겁에|겁먹|떨리|떨었|비명|공포|소름", 9: "다쳤|다친|부상|피를|피가|상처|쓰러",
  10: "치료|붕대|회복|응급", 11: "쉬자|쉬어|잠들|졸려|하품|휴식|기지개|낮잠", 12: "공격|휘둘|베었|베어|찔렀|쏘았|쐈|주먹|덤벼|전투|싸우",
  13: "각성|힘이 솟|눈빛이 변|폭주|기운이 치솟", 14: "설레|두근|심장이|가슴이 뛰|손을 잡|손잡|안아|포옹|고백|좋아해|데이트" };
// 추천 칸 이름별 낱말. 그 밖의 직접 만든 칸은 칸 이름 자체로 찾음
const SIT_KEYS_EXTRA = { 식사: "식사|밥|먹", 만남: "처음 뵙|반가워|반갑", 정색: "정색|굳은 얼굴|차갑게", 행복: "행복|기뻐|기쁘", 경계: "경계|의심|수상", 고민: "고민|생각에 잠|망설",
  지침: "지쳐|지친|피곤|녹초", 비웃음: "비웃|코웃음", 취함: "취했|취한|술잔|건배", 요리: "요리|부엌|앞치마", 게임: "게임", 카페: "카페|커피", 해변: "해변|바다|파도",
  놀이공원: "놀이공원|관람차", "밤 산책": "산책|밤길", 벚꽃: "벚꽃", 크리스마스: "크리스마스|성탄", "비 오는 날": "비가|우산|빗속", 영화관: "영화",
  손잡기: "손을 잡|손잡", 포옹: "안아|포옹|껴안|품에", 고백: "고백|좋아해|사랑해", 질투: "질투|샘이", 무릎베개: "무릎베개|무릎에 누", "키스 직전": "입술|입맞|키스", 잠옷: "잠옷|파자마", 수영복: "수영복|수영장" };
function sitKeys(n) {
  if (SIT_KEYS[n]) return SIT_KEYS[n];
  const d = sitDef(n); if (!d || !d.name.trim()) return "";
  return [SIT_KEYS_EXTRA[d.name.trim()], d.name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")].filter(Boolean).join("|");
}
/* 글 속 낱말로 상황 번호마다 점수(adult면 성인 수위 칸도 후보). 직접 만든 칸은 더 구체적이라 0.5 더함 */
function sitScores(text, adult) {
  const out = new Map(), s = String(text || "");
  if (!s.trim()) return out;
  for (const n of [...SIT.keys(), ...customSits().filter((d) => d.rating === "safe" || adult).map((d) => d.n)]) {
    const k = sitKeys(n); if (!k) continue;
    const hits = (s.match(new RegExp(k, "g")) || []).length;
    if (hits) out.set(n, hits + (n >= CUSTOM_BASE ? 0.5 : 0));
  }
  return out;
}
/* 유저 입력에 맞는 상황 번호 후보 두 개("3 부끄러움") — [이번 응답]에 붙여 AI가 고르게 */
function sitHints(text, adult) { return [...sitScores(text, adult)].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([n]) => n + " " + sitName(n)); }
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
function buildPonyPrompt(cast, i, c) { return savedParts(c, cast, i).flatMap((p) => p.tags.map((x) => x.strong ? `(${x.t}:1.3)` : x.t)).filter(Boolean).join(", "); }
const asTag = (t) => (typeof t === "string" ? { t, strong: false } : t);
/* 인물별로 저장한 태그(S.tagpacks[작품 id][인물 코드] = {look, sits: {칸 번호: {scene, extra, bg}}}, KV "tagpacks").
   기본 태그와의 차이 {add, del, strong}만 저장해서, 작품의 외모 설정이 바뀌어도 사용자가 고친 부분만 남음.
   인물(look)은 그 인물의 모든 칸에, 장면·추가·배경은 그 칸에만 */
function castPack(c, code) { return ((S.tagpacks || {})[c.id] || {})[code] || null; }
function savedParts(c, cast, i) {
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
function hasSavedTags(c, code, i) { const p = castPack(c, code); return !!(p && (p.look || (p.sits || {})[i])); }
function saveCastTags(c, cast, i, groups) {
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
function clearCastTags(c, cast, i) {
  const pack = castPack(c, cast.code); if (!pack) return;
  delete pack.look; if (pack.sits) delete pack.sits[i];
  if (!Object.keys(pack.sits || {}).length) delete S.tagpacks[c.id][cast.code];
  if (!Object.keys(S.tagpacks[c.id]).length) delete S.tagpacks[c.id];
  KV.set("tagpacks", S.tagpacks);
}
/* 태그 묶음 → 영문 프롬프트. 강조(★) 태그는 하나씩 번역해 "(태그:1.3)"로, 나머지는 묶음째 번역.
   인물(외모) 묶음은 수위와 상관없이 같은 길로 번역 — 수위마다 번역이 달라 머리색·옷이 바뀌던 문제 */
async function groupsPrompt(groups, adult) {
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
async function partsTags(parts, adult) {
  if (adult && minorHint(parts.flatMap((g) => g.tags.map((x) => asTag(x).t)).join(", "))) throw { code: "minor_block" };
  return groupsPrompt(parts, adult);
}
/* 칸을 지우면 모든 인물에 저장된 그 칸의 그림도 지움 */
function dropSitImages(n) {
  const clean = (images) => Object.values(images || {}).forEach((m) => { if (m && m[n]) { IMG.drop(m[n]); delete m[n]; } });
  Object.values(S.imgpacks).forEach(clean); KV.set("imgpacks", S.imgpacks);
  S.mine.forEach((c) => clean(c.images)); KV.set("mine", S.mine);
  if (S.mine.some((c) => c.publish)) publishCommunity();
}
/* 추천 칸 꾸러미: 기본 15칸에 없는 자주 쓰는 상황을 골라 한 번에 추가(태그는 영문, 추가한 뒤 '고치기'로 바꿀 수 있음).
   전체이용가·세미 수위만 — 노골적인 칸은 미리 채우지 않고 사용자가 직접 씀(CLAUDE.md 수위 원칙) */
const SIT_PRESETS = [
  { name: "일상·감정", items: [
    ["만남", "waving, greeting, smile, looking at viewer"], ["식사", "eating, holding chopsticks, sitting at table, food, happy"],
    ["대화", "talking, open mouth, hand gesture, looking at viewer"], ["정색", "serious, expressionless, cold stare, closed mouth"],
    ["행복", "happy, big smile, closed eyes, sparkle"], ["경계", "wary, narrowed eyes, frown, defensive posture"],
    ["고민", "thinking, hand on own chin, worried, looking to the side"], ["지침", "tired, exhausted, sweat, half-closed eyes, slouching"],
    ["비웃음", "smug, smirk, half-closed eyes, looking down at viewer"], ["취함", "drunk, blush, dazed, half-closed eyes, holding glass"],
    ["요리", "cooking, apron, kitchen, holding ladle"], ["게임", "playing video games, holding controller, sitting on floor, room"]] },
  { name: "장소·데이트", items: [
    ["카페", "cafe, sitting, holding cup, window, warm lighting"], ["해변", "beach, ocean, summer, sundress, wind, sunlight"],
    ["놀이공원", "amusement park, ferris wheel, holding balloon, smile"], ["밤 산책", "night, street lights, walking, city lights, scarf"],
    ["벚꽃", "cherry blossoms, falling petals, spring, park"], ["크리스마스", "christmas, santa hat, snow, christmas lights, holding gift"],
    ["비 오는 날", "rain, holding umbrella, wet hair, puddle, city street"], ["영화관", "movie theater, sitting, popcorn, dark, screen light on face"]] },
  { name: "로맨스", items: [
    ["손잡기", "pov, holding hands, blush, smile, looking at viewer"], ["포옹", "pov, hug, arms around viewer, happy, closed eyes"],
    ["고백", "confession, blush, nervous, holding letter, looking at viewer"], ["질투", "jealous, pout, crossed arms, looking away"],
    ["무릎베개", "lap pillow, looking down at viewer, pov, gentle smile"], ["키스 직전", "pov, incoming kiss, closed eyes, blush, close-up"]] },
  { name: "의상", items: [
    ["잠옷", "pajamas, bedroom, messy hair, sleepy, morning"], ["수영복", "swimsuit, pool, summer, water, sunlight"],
    ["메이드", "maid, maid headdress, apron, curtsey"], ["치어리더", "cheerleader, pom poms, energetic, smile"],
    ["마녀", "witch hat, witch, cape, magic, halloween"]] },
  { name: "세미 수위", rating: "questionable", items: [
    ["유혹", "seductive smile, half-closed eyes, finger to lips, looking at viewer, bedroom"],
    ["샤워 후", "after bath, wet hair, towel, steam, blush"], ["침대 위", "lying on bed, on side, looking at viewer, bedroom, soft lighting"]] }
];
function sitPresetSheet(after) {
  const have = new Set((S.settings.customSits || []).map((d) => d.name));
  const packs = SIT_PRESETS.filter((p) => !p.rating || ageOK());
  const ov = document.createElement("div"); ov.className = "overlay gen-ov";
  ov.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="sheet-head"><h2>추천 칸</h2><button class="icon-btn" data-x aria-label="닫기">${ICON.close}</button></div>
    <p class="sub" style="margin-top:0">고른 칸이 모든 인물에 생겨요. 추가한 뒤 '고치기'로 이름·프롬프트를 바꿀 수 있어요.</p>
    ${packs.map((p, pi) => `<div class="tgroup"><span class="lbl">${esc(p.name)}${p.rating ? " 🔞" : ""}</span><div class="tchips">${p.items.map(([n], ii) => `<label class="tchip pick${have.has(n) ? " on" : ""}"><input type="checkbox" data-pp="${pi}" data-pi="${ii}" ${have.has(n) ? "checked disabled" : ""}> ${esc(n)}</label>`).join("")}</div></div>`).join("")}
    <div class="cta-row"><button class="btn sm ghost" id="pall">모두 고르기</button><span class="spacer"></span><button class="btn ghost" data-x>취소</button><button class="btn pri" id="padd">추가</button></div></div>`;
  document.body.append(ov);
  const close = () => ov.remove();
  ov.addEventListener("click", (e) => { if (e.target === ov || e.target.closest("[data-x]")) close(); });
  const boxes = $$("[data-pp]", ov).filter((b) => !b.disabled);
  boxes.forEach((b) => b.onchange = () => b.parentElement.classList.toggle("on", b.checked));
  $("#pall", ov).onclick = () => boxes.forEach((b) => { b.checked = true; b.onchange(); });
  $("#padd", ov).onclick = () => {
    const picked = boxes.filter((b) => b.checked).map((b) => { const p = packs[+b.dataset.pp], [name, prompt] = p.items[+b.dataset.pi]; return { name, prompt, rating: p.rating || "safe" }; });
    if (!picked.length) { close(); return; }
    const list = S.settings.customSits, space = CUSTOM_MAX - list.length;
    if (space <= 0) { toast(`칸은 ${CUSTOM_MAX}개까지 추가할 수 있어요.`); return; }
    for (const d of picked.slice(0, space)) { let n = CUSTOM_BASE; while (list.some((x) => x.n === n)) n++; list.push({ n, ...d }); }
    saveSettings(); close(); after && after();
    toast(picked.length > space ? `${space}칸만 추가했어요(최대 ${CUSTOM_MAX}칸)` : `${picked.length}칸을 추가했어요`);
  };
}
/* 목록 글 → 칸 후보. 한 줄에 하나: "이름", "이름=번호", "번호 = 이름", "이름 | 프롬프트". 번호는 무시하고(15번부터 차례로) 프롬프트가 없으면 이름을 씀(만들 때 번역됨) */
function parseSitList(text) {
  const base = new Set(SIT), have = new Set((S.settings.customSits || []).map((d) => d.name)), seen = new Set(), out = [];
  for (const raw of String(text || "").split(/\r?\n/)) {
    let [name, prompt] = raw.split("|").map((x) => x.trim());
    name = (name || "").replace(/^\s*\d+\s*[=:.)]\s*/, "").replace(/\s*[=:]\s*\d+\s*$/, "").trim();
    if (!name || name.length > 12 || seen.has(name)) continue;
    seen.add(name);
    out.push({ name, prompt: prompt || name, dup: base.has(name) || have.has(name) });
  }
  return out;
}
/* 목록으로 칸 여러 개 추가: 글을 붙여 넣거나 .txt를 고르면 칸 후보를 보여 주고, 고른 것만 한 수위로 추가 */
function sitListSheet(after) {
  const ov = document.createElement("div"); ov.className = "overlay gen-ov";
  ov.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="sheet-head"><h2>목록으로 칸 추가</h2><button class="icon-btn" data-x aria-label="닫기">${ICON.close}</button></div>
    <p class="sub" style="margin-top:0">한 줄에 칸 하나. "키스", "키스=18", "18 = 키스", "키스 | 프롬프트" 모두 돼요. 번호는 15번부터 차례로 다시 매기고, 프롬프트가 없으면 칸 이름을 영문 태그로 바꿔 써요.</p>
    <div class="field"><label for="slt">칸 목록</label><textarea id="slt" maxlength="4000" style="min-height:120px" placeholder="예:\n카페 데이트\n비 오는 날 | 비에 젖은 머리, 투명 우산"></textarea></div>
    <div class="cta-row" style="margin-top:6px"><button class="btn sm" id="slf" type="button">.txt 파일 불러오기</button><input type="file" id="slfile" accept=".txt,text/plain" hidden></div>
    ${ratingFieldHTML("slr", "safe", "추가할 칸의 수위")}
    <div id="slpv"></div>
    <div class="cta-row"><span class="note" id="slc"></span><span class="spacer"></span><button class="btn ghost" data-x>취소</button><button class="btn pri" id="sladd" disabled>추가</button></div></div>`;
  document.body.append(ov);
  const close = () => ov.remove();
  ov.addEventListener("click", (e) => { if (e.target === ov || e.target.closest("[data-x]")) close(); });
  let items = [];
  const paint = () => {
    items = parseSitList($("#slt", ov).value);
    $("#slpv", ov).innerHTML = items.length ? `<div class="tgroup"><span class="lbl">추가할 칸 (누르면 빼기)</span><div class="tchips">${items.map((d, i) => `<label class="tchip pick${d.dup ? "" : " on"}"><input type="checkbox" data-sl="${i}" ${d.dup ? "disabled" : "checked"}> ${esc(d.name)}${d.dup ? " <small>이미 있음</small>" : ""}</label>`).join("")}</div></div>` : "";
    $$("[data-sl]", ov).forEach((b) => b.onchange = () => { b.parentElement.classList.toggle("on", b.checked); count(); });
    count();
  };
  const count = () => { const n = $$("[data-sl]", ov).filter((b) => b.checked).length, space = CUSTOM_MAX - S.settings.customSits.length; $("#slc", ov).textContent = n ? `${n}칸 · 남은 자리 ${space}칸` : ""; $("#sladd", ov).disabled = !n; };
  $("#slt", ov).oninput = paint;
  $("#slf", ov).onclick = () => $("#slfile", ov).click();
  $("#slfile", ov).onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const buf = await f.arrayBuffer();
    let t; try { t = new TextDecoder("utf-8", { fatal: true }).decode(buf); } catch { t = new TextDecoder("euc-kr").decode(buf); }
    $("#slt", ov).value = t.slice(0, 4000); paint();
  };
  $("#sladd", ov).onclick = () => {
    const rating = $("#slr", ov).value || "safe", list = S.settings.customSits;
    const picked = $$("[data-sl]", ov).filter((b) => b.checked).map((b) => items[+b.dataset.sl]);
    const ok = picked.filter((d) => rating === "safe" || !minorHint(d.name + "\n" + d.prompt)), blocked = picked.length - ok.length;
    const space = CUSTOM_MAX - list.length;
    if (space <= 0) { toast(`칸은 ${CUSTOM_MAX}개까지 추가할 수 있어요.`); return; }
    for (const d of ok.slice(0, space)) { let n = CUSTOM_BASE; while (list.some((x) => x.n === n)) n++; list.push({ n, name: d.name, prompt: d.prompt, rating }); }
    saveSettings(); close(); after && after();
    const added = Math.min(ok.length, space);
    toast(`${added}칸을 추가했어요${ok.length > space ? ` · 자리가 없어 ${ok.length - space}칸은 빠졌어요(최대 ${CUSTOM_MAX}칸)` : ""}${blocked ? ` · 미성년으로 보이는 표현이 있는 ${blocked}칸은 뺐어요` : ""}`);
  };
}
/* 직접 추가하는 칸 만들기·고치기. 슬롯 시트 위에 겹쳐 뜸 */
function sitEditor(def, after) {
  const ov = document.createElement("div"); ov.className = "overlay gen-ov";
  ov.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="sheet-head"><h2>${def ? "칸 고치기" : "이미지 칸 추가"}</h2><button class="icon-btn" data-x aria-label="닫기">${ICON.close}</button></div>
    <p class="sub" style="margin-top:0">모든 인물에 같은 칸이 생기고, 대화 중 AI가 이 칸의 그림을 넣을 수 있어요.</p>
    <div class="field"><label for="snm">칸 이름</label><input id="snm" maxlength="12" value="${esc(def?.name || "")}" placeholder="예: 수영복, 잠옷, 비 오는 날"></div>
    <div class="field"><label for="spr">프롬프트 <span class="note">한국어로 써도 돼요 · 인물 외모는 자동으로 붙어요</span></label><textarea id="spr" maxlength="600" style="min-height:90px" placeholder="예: 비에 젖은 머리, 투명 우산, 밤거리 네온">${esc(def?.prompt || "")}</textarea></div>
    ${ratingFieldHTML("srt", def?.rating || "safe")}${ageOK() ? `<p class="note" style="margin:-6px 0 0">성인 수위 칸은 성인 모드 대화방에서만 쓰여요. 미성년으로 보이는 표현은 막아요.</p>` : ""}
    <div class="cta-row">${def ? `<button class="btn danger" id="sdel">삭제</button>` : ""}<span class="spacer"></span><button class="btn ghost" data-x>취소</button><button class="btn pri" id="ssv">저장</button></div></div>`;
  document.body.append(ov);
  const close = () => ov.remove();
  ov.addEventListener("click", (e) => { if (e.target === ov || e.target.closest("[data-x]")) close(); });
  $("#snm", ov).focus();
  $("#ssv", ov).onclick = () => {
    const name = $("#snm", ov).value.trim(), prompt = $("#spr", ov).value.trim(), rating = $("#srt", ov)?.value || def?.rating || "safe";
    if (!name) return $("#snm", ov).focus();
    if (!prompt) return $("#spr", ov).focus();
    if (rating !== "safe" && minorHint(name + "\n" + prompt)) { toast(genErr({ code: "minor_block" })); return; }
    const list = S.settings.customSits;
    if (def) Object.assign(def, { name, prompt, rating });
    else {
      if (list.length >= CUSTOM_MAX) { toast(`칸은 ${CUSTOM_MAX}개까지 추가할 수 있어요.`); return; }
      let n = CUSTOM_BASE; while (list.some((d) => d.n === n)) n++;
      list.push({ n, name, prompt, rating });
    }
    saveSettings(); close(); after && after(); toast(def ? "칸을 고쳤어요" : "칸을 추가했어요");
  };
  const del = $("#sdel", ov);
  if (del) del.onclick = () => {
    if (!del.dataset.sure) { del.dataset.sure = "1"; del.textContent = "모든 인물의 이 칸 그림도 지워져요. 한 번 더 누르면 삭제"; return; }
    S.settings.customSits = S.settings.customSits.filter((d) => d !== def); dropSitImages(def.n); saveSettings(); close(); after && after(); toast("칸을 지웠어요");
  };
}
const hasHangul = (t) => /[가-힣]/.test(t);
/* 프롬프트 → Pony용 영문 태그. 영문 태그 조각은 그대로 두고, 한글이 든 조각만(이어진 것끼리 묶어) koTags()로 번역 */
async function ponyTags(text, adult = false) {
  const t = String(text || "").trim();
  if (!t || !hasHangul(t)) return t;
  const out = []; let buf = [];
  const flush = async () => { if (buf.length) { out.push(await koTags(buf.join(", "), adult)); buf = []; } };
  for (const part of t.split(/\s*,\s*/).filter(Boolean)) { if (hasHangul(part)) buf.push(part); else { await flush(); out.push(part); } }
  await flush();
  return out.filter(Boolean).join(", ");
}
/* 한글 설명 → 영문 Danbooru 태그(TAGS에 캐시해 같은 글은 한 번만). Claude로 번역하고, Claude 연결이 없거나 실패하면 OpenRouter 키로 한 번 더,
   그것도 안 되면 한글 낱말만 빼고 보냄. 성인 수위 그림(adult)은 처음부터 OpenRouter로(Claude에는 노출 태그 지시를 보내지 않음) */
let TAGS = {};
async function koTags(t, adult = false) {
  adult = adult && ageOK() && hasOpenRouterKey();
  const key = "4|" + (adult ? "A:" : "") + t; // 4|: 성인 번역을 DeepSeek로 바꾼 뒤(예전 라이트 모델 번역은 엉뚱한 머리색 등이 섞여 안 씀)
  if (TAGS[key]) return TAGS[key];
  const strip = () => t.replace(/[^\s,]*[가-힣][^\s,]*/g, " ").split(",").map((x) => x.replace(/\s+/g, " ").trim()).filter(Boolean).join(", ");
  try { await waitEngine(); } catch {}
  if (S.engine === "none" && !adult && !hasOpenRouterKey()) return strip();
  try {
    // 지시는 시스템(첫 메시지), 번역할 글은 유저 메시지로 — 지시와 글이 한 메시지면 OpenRouter 모델이 엉뚱한 글을 씀
    const msgs = [{ role: "user", content: `다음 그림 설명을 SDXL 그림 모델(Pony·Illustrious)용 영문 Danbooru 태그로 바꿔라.
- 영문 소문자 태그를 쉼표로만 이어 한 줄로 출력한다. 설명·따옴표·번호 없이 태그만.
- 원문 순서를 따른다.
- 인물은 모두 성인이다(인물이 있으면 adult 를 넣는다). 나이 숫자는 쓰지 말고, young·teen·petite처럼 어려 보이게 하는 낱말도 쓰지 않는다. ${adult ? "노출·성적 표현은 원문에 있는 만큼만 태그로 옮기고, 미성년으로 보이게 하는 태그는 넣지 않는다." : "노출·성적 표현 태그는 넣지 않는다."}
- 인물이 나오고 성별을 알 수 있으면 인원·성별 태그(1girl, 1boy, 2girls, 1boy 1girl 처럼)를 맨 앞에 넣고, 남자만 나오면 male focus도 넣는다.
- 설명 전체에 사람이 없고 동물·식물·풍경·사물만 있으면 no humans를 넣는다(동물이 주인공이면 animal focus도). 옷·소품·머리 모양처럼 인물의 일부만 설명하는 조각에는 넣지 않는다.
- 고유명사(작품·인물·장소 이름)는 빼고 외모·의상·표정·자세·장소·조명·분위기만 남긴다.
- 원문에 없는 표정·감정·자세 태그는 덧붙이지 않는다(예: '날카로운 눈매'는 sharp eyes일 뿐 serious expression이 아니다). 원문에 없는 머리색·옷도 지어내지 않는다.` }, { role: "user", content: t }];
    // 성인 수위는 Claude를 거치지 않고 OpenRouter로. 일반은 Claude → 안 되면 OpenRouter
    const usable = (o) => (o != null && /[a-z]/i.test(o) && !hasHangul(o) ? o : null); // 빈 답·태그가 아닌 답이면 다음으로
    let out = !adult && S.engine !== "none" ? usable(await llm(msgs, { tier: "quick", maxTokens: 500 }).catch(() => null)) : null;
    for (const model of OR_TAG_MODELS) {
      if (out != null || !hasOpenRouterKey()) break;
      out = usable(await openRouterStream(msgs, { model, maxTokens: 300, sampling: { temperature: 0.2, top_p: 0.9 }, retry: false }).catch(() => null));
    }
    const tags = String(out || "").replace(/\n+/g, ", ").replace(/["'`]/g, "").split(",").map((x) => x.replace(/_/g, " ").replace(/\s+/g, " ").trim())
      .filter((x) => x.length <= 40 && /^[a-z0-9 .:;!?&+\/()'-]+$/i.test(x)) // 태그가 아닌 조각(코드·다른 글자) 빼기
      .filter((x, i, a) => x && a.indexOf(x) === i && !/\b(young|younger|teen|teenage|child|kid|loli|shota|petite|little)\b/i.test(x)) // 중복·어려 보이게 하는 태그는 빼고
      .slice(0, 24).join(", "); // 모델이 같은 태그를 되풀이해도 그림 프롬프트를 잡아먹지 않게 24개까지
    if (!tags || hasHangul(tags)) return strip();
    TAGS[key] = tags;
    const keys = Object.keys(TAGS); if (keys.length > 300) keys.slice(0, keys.length - 300).forEach((k) => delete TAGS[k]);
    KV.set("ponytags", TAGS);
    return tags;
  } catch { return strip(); }
}
function uuid4() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16)); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
/* 그림 대상(번역된 태그 기준): "male" 남자만, "none" 사람 없음(no humans — 동물·식물·풍경), 그 밖은 "any" */
function imgSubject(tags) {
  const t = String(tags).toLowerCase().replace(/[()]/g, " ");
  const girl = /\b\d*girls?\b|\b(?:female|woman|women)\b/.test(t), boy = /\b\d*boys?\b|\b(?:male|man|men)\b/.test(t);
  if (girl || boy) return boy && !girl ? "male" : "any";
  return /\bno humans\b/.test(t) ? "none" : "any";
}
/* 대상별로 그림체에서 뺄 태그(여자·사람 얼굴 쪽으로 끌림)와 더할 네거티브 */
const SUBJ = {
  male: { strip: /makeup|lip|eyelash|glamorous|cute|kawaii|beautiful/i, neg: "1girl, female, breasts, makeup, lipstick, feminine" },
  none: { strip: /skin|makeup|lip|eye|face|hair|glamorous|mature|cute|kawaii|beautiful|portrait|body/i, neg: "1girl, 1boy, human, person, humanoid, anthro, kemonomimi, animal ears" }
};
/* 태그 정리: 중복 빼기(★강조한 태그가 있으면 같은 태그의 보통 판은 뺌), 사람이 있으면 no humans·animal focus 빼기(곁의 동물 번역에 딸려 옴), 남자만이면 male focus 보태기 */
function fixSubject(tags, subj) {
  const bare = (t) => t.toLowerCase().replace(/^\((.+):\d(?:\.\d+)?\)$/, "$1").trim();
  const list = splitTags(tags), strong = new Set(list.filter((t) => t.startsWith("(")).map(bare)), seen = new Set();
  const boyTag = list.some((t) => /\b\d*boys?\b/.test(bare(t)));
  const out = list.filter((t) => {
    const k = bare(t), low = t.toLowerCase();
    if ((!t.startsWith("(") && strong.has(k)) || seen.has(low) || (subj !== "none" && (k === "no humans" || k === "animal focus"))) return false;
    if (subj !== "male" && !boyTag && k === "male focus") return false; // 여자 그림에 번역이 잘못 붙인 male focus

    seen.add(low); return true;
  });
  if (subj === "male" && !out.some((t) => bare(t) === "male focus")) out.splice(out.findIndex((t) => /\b\d*boys?\b/.test(bare(t))) + 1, 0, "male focus");
  return out.join(", ");
}
/* Runware 이미지 생성 → Blob (IMG.put에 그대로 넣을 수 있음). 그림은 dataURI로 받아 두 번째 요청·CORS 문제를 피하고, URL로 오면 내려받음 */
async function runwareImage(prompt, { aspect = "4:5", rating = imgRating(), signal } = {}) {
  if (!hasRunwareKey()) throw { code: "no_key" };
  rating = imgRating(rating);
  const adult = rating !== "safe";
  if (adult && minorHint(prompt)) throw { code: "minor_block" };
  const rawTags = await ponyTags(prompt, adult), rawStyle = await ponyTags(imgStyleText(), adult);
  if (adult && minorHint(rawTags + ", " + rawStyle)) throw { code: "minor_block" };
  const subj = imgSubject(rawTags), Sb = SUBJ[subj] || {};
  const tags = fixSubject(rawTags, subj), style = splitTags(rawStyle).filter((t) => !(Sb.strip && Sb.strip.test(t))).join(", ");
  const [width, height] = RW_SIZES[aspect] || RW_SIZES["4:5"], R = RATINGS[rating], M = imgModelInfo(imgModelId()), A = ARCH[M.arch] || ARCH.pony;
  // 사람 없는 그림에는 수위의 adult·mature 태그를 빼야 사람이 끼어들지 않음
  const rpos = splitTags(M.arch === "illustrious" ? R.ill : R.pos).filter((t) => subj !== "none" || !/^(?:adult|mature|nsfw)$/.test(t)).join(", ");
  // 내용(장면·인물) 다음에 그림체 — 그림체가 앞이면 표정·자세가 묻힘. "(태그:1.3)" 강조가 있으면 Runware 가중치 문법(sdEmbeds)을 켬
  const task = { taskType: "imageInference", taskUUID: uuid4(),
    positivePrompt: [A.pos, rpos, M.pos, tags, style].filter(Boolean).join(", ").slice(0, 2900),
    ...(/\([^()]+:\d(?:\.\d+)?\)/.test(tags) ? { promptWeighting: "sdEmbeds" } : {}),
    negativePrompt: [A.neg, M.neg, IMG_NEG, NEG_MINOR, R.neg, Sb.neg].filter(Boolean).join(", "),
    model: M.id, width, height, numberResults: 1, steps: 28, CFGScale: M.cfg || A.cfg, scheduler: "Euler a",
    outputFormat: "WEBP", outputType: "dataURI", ...(adult ? {} : { checkNSFW: true }) };
  let j, res;
  for (let tries = 0; tries < 2; tries++) {
    try {
      res = await fetch(CFG.runwareUrl, { method: "POST", signal, headers: { "content-type": "application/json", ...(S.settings.runwareKey ? { authorization: "Bearer " + S.settings.runwareKey } : {}) }, body: JSON.stringify([task]) });
    } catch (e) { throw { code: e.name === "AbortError" ? "cancelled" : "network" }; }
    j = await res.json().catch(() => ({}));
    const err = (Array.isArray(j.errors) ? j.errors : j.error ? [j.error] : [])[0];
    const msg = err ? String([err.code, err.message, err.parameter].filter(Boolean).join(" ")) : "";
    // checkNSFW를 모르는 엔드포인트(프록시 등)면 한 번만 빼고 다시
    if (err && /checkNSFW/i.test(msg) && tries === 0) { delete task.checkNSFW; task.taskUUID = uuid4(); continue; }
    // Runware가 모델을 처음 불러올 때 가끔 실패함(failedModelLoad) → 새 작업 ID로 한 번 더
    if (err && /failedModelLoad/i.test(msg) && tries === 0) { task.taskUUID = uuid4(); continue; }
    if (!res.ok || err) {
      throw { code: res.status === 401 || res.status === 403 || /api.?key|auth/i.test(msg) ? "bad_key" : res.status === 402 || /credit|fund|balance|insufficient/i.test(msg) ? "no_funds"
        : res.status === 429 ? "rate_limited" : /model/i.test(msg) ? "bad_model" : "upstream_error", msg };
    }
    break;
  }
  const d = (j.data || []).find((x) => x && x.taskType === "imageInference") || (j.data || [])[0];
  if (!d) throw { code: "upstream_error", msg: "빈 응답" };
  if (!adult && d.NSFWContent) throw { code: "blocked" };
  try {
    if (d.imageDataURI || d.imageBase64Data) return await (await fetch(d.imageDataURI || `data:image/webp;base64,${d.imageBase64Data}`)).blob();
    if (d.imageURL) return await (await fetch(d.imageURL, { signal })).blob();
  } catch (e) { throw { code: e.name === "AbortError" ? "cancelled" : "image_fetch" }; }
  throw { code: "upstream_error", msg: "그림 없음" };
}
/* 그림 참조(kv:·/_blob/·data:) → data URL */
async function refDataURL(ref) {
  try {
    if (ref.startsWith("kv:")) return await IMG.load(ref.slice(3));
    if (ref.startsWith("/_blob/")) { const b = await (await fetch(ref)).blob(); return await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(b); }); }
    return validRef(ref) ? ref : null;
  } catch { return null; }
}
/* 그림체 세트 그림을 Claude(Anthropic API 키·서버 프록시)에게 보여 주고 공통 화풍만 Pony용 영문 태그로 받아옴 */
async function claudeStyleTags(refs) {
  if (!hasClaudeKey()) throw { code: "no_claude" };
  const content = [];
  for (const r of refs) {
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
function genErr(e) {
  return {
    no_key: "설정에서 Runware API 키를 먼저 넣어 주세요.",
    bad_key: "Runware API 키가 올바르지 않거나 권한이 없어요.",
    no_funds: "Runware 크레딧이 부족해요. Runware 대시보드(runware.ai)에서 충전해 주세요.",
    bad_model: "이미지 모델을 찾을 수 없어요. 설정에서 이미지 모델을 확인해 주세요." + (e?.msg ? ` (${String(e.msg).slice(0, 120)})` : ""),
    rate_limited: "요청이 너무 많아요. 잠시 후 다시 시도해 주세요.",
    blocked: "안전 필터에 걸려 이 그림은 쓰지 않았어요. 프롬프트를 바꿔 보세요.",
    minor_block: "미성년으로 보이는 표현(나이·학생·교복 등)이 있어 이 수위로는 만들지 않았어요. 전체이용가로 바꾸거나 표현을 고쳐 주세요.",
    image_fetch: "만든 그림을 내려받지 못했어요. 잠시 뒤 다시 시도해 주세요.",
    no_claude: "그림을 읽어 태그를 쓰려면 Anthropic API 키(또는 서버 연결)가 필요해요.",
    bad_claude: "Anthropic API 키가 올바르지 않거나 권한이 없어요.",
    network: window.claude?.use ? "claude.ai 안에서는 외부 API 호출이 막혀 Runware를 부를 수 없어요. 파일로 열어서 써 주세요." : "Runware에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.",
    cancelled: "생성을 취소했어요."
  }[e?.code] || "이미지를 만들지 못했어요." + (e?.msg ? ` (${String(e.msg).slice(0, 120)})` : "");
}
/* 다른 시트 위에 겹쳐 뜨는 생성 창. 프롬프트는 묶음별 태그 칩(누르면 ★강조, ×로 빼기, 칸에 한국어·영어로 더하기).
   그림체·품질·수위·금지 태그는 숨겨 두고 runwareImage가 붙임. parts가 없으면 prompt 문자열을 한 묶음으로. onUse(blob)가 끝나면 닫혀요 */
/* save: {c, cast, i}를 주면(이미지 슬롯) 고친 태그를 그 인물에 저장·기본값으로 되돌리는 줄을 보여 줌 */
function genImageSheet({ title = "AI로 이미지 만들기", prompt = "", parts, aspect = "4:5", rating, onUse, save }) {
  const model = imgModelInfo(imgModelId()).name;
  const toGroups = (ps) => { const gs = ps.map((g) => ({ ...g, tags: g.tags.map((t) => ({ ...asTag(t) })) })); if (!gs.some((g) => g.key === "extra")) gs.splice(1, 0, { key: "extra", label: "추가", tags: [] }); return gs; }; // 직접 더한 태그는 장면 바로 다음(앞쪽일수록 잘 반영됨)
  const groups = toGroups(parts || [{ key: "main", label: "프롬프트", tags: splitTags(prompt) }]);
  const ov = document.createElement("div"); ov.className = "overlay gen-ov";
  ov.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="sheet-head"><h2>${esc(title)}</h2><button class="icon-btn" data-x aria-label="닫기">${ICON.close}</button></div>
    <div id="gtags"></div>
    ${save ? `<div class="gen-save"><button type="button" class="btn sm pri" id="gsave">이 인물에 태그 저장</button><button type="button" class="btn sm ghost" id="greset">기본값으로</button><span class="note" id="gsaved"></span></div>` : ""}
    <p class="note" style="margin:8px 0 0">태그를 누르면 ★강조, ×는 빼기. ${S.engine === "none" && !hasOpenRouterKey() ? "AI 연결이 없어 한글은 빼고 보내요." : "한국어로 써도 영문 태그로 바꿔 보내요."}</p>
    <details class="gen-auto"><summary>자동으로 붙는 태그</summary><p class="note">그림체(${esc(styleLabel())}) · 품질 · 수위 · 금지(저품질·글자·미성년) 태그 · 모델 ${esc(model)}</p></details>
    ${ratingFieldHTML("grt", rating)}
    <div class="gen-pv" id="gpv"><span class="note">${hasRunwareKey() ? `비율 ${esc(aspect)} · 그림체 ${esc(styleLabel())}` : "설정에서 Runware API 키를 먼저 넣어 주세요."}</span></div>
    <div class="cta-row"><button class="btn ghost" data-x>닫기</button><span class="spacer"></span><button class="btn" id="gmk">생성</button><button class="btn pri" id="guse" disabled>이 이미지 쓰기</button></div></div>`;
  document.body.append(ov);
  const paintTags = (focusGroup) => {
    $("#gtags", ov).innerHTML = groups.map((g, gi) => `<div class="tgroup"><span class="lbl">${esc(g.label)}</span><div class="tchips">${g.tags.map((x, ti) => `<span class="tchip${x.strong ? " on" : ""}"><button type="button" data-tg="${gi}" data-ti="${ti}" title="눌러서 강조">${x.strong ? "★ " : ""}${esc(x.t)}</button><button type="button" class="tx" data-rg="${gi}" data-ri="${ti}" aria-label="${esc(x.t)} 빼기">×</button></span>`).join("")}<input class="tadd" data-ag="${gi}" maxlength="80" placeholder="+ 태그" aria-label="${esc(g.label)}에 태그 더하기"></div></div>`).join("");
    $$("[data-tg]", ov).forEach((b) => b.onclick = () => { const x = groups[+b.dataset.tg].tags[+b.dataset.ti]; x.strong = !x.strong; paintTags(); });
    $$("[data-rg]", ov).forEach((b) => b.onclick = () => { groups[+b.dataset.rg].tags.splice(+b.dataset.ri, 1); paintTags(); });
    $$("[data-ag]", ov).forEach((inp) => {
      const add = (refocus) => { const v = splitTags(inp.value); if (!v.length) return; groups[+inp.dataset.ag].tags.push(...v.map((t) => ({ t, strong: false }))); inp.value = ""; paintTags(refocus ? inp.dataset.ag : null); };
      inp.onkeydown = (e) => { if ((e.key === "Enter" || e.key === ",") && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); add(true); } };
      inp.onchange = () => add(false);
    });
    if (focusGroup != null) $(`[data-ag="${focusGroup}"]`, ov)?.focus();
  };
  paintTags();
  const buildPrompt = (adult) => groupsPrompt(groups, adult);
  if (save) {
    const { c, cast, i } = save, note = $("#gsaved", ov);
    const paintSaved = () => { note.textContent = hasSavedTags(c, cast.code, i) ? "저장한 태그를 쓰는 중이에요" : "기본 태그예요"; };
    $("#gsave", ov).onclick = () => { saveCastTags(c, cast, i, groups); paintSaved(); toast(`${cast.name}에 저장했어요. 인물 태그는 모든 칸에, 장면·추가·배경 태그는 이 칸에 써요`); };
    $("#greset", ov).onclick = () => { clearCastTags(c, cast, i); groups.splice(0, groups.length, ...toGroups(savedParts(c, cast, i))); paintTags(); paintSaved(); toast("기본 태그로 되돌렸어요"); };
    paintSaved();
  }
  let blob = null, url = "", ctl = null;
  const close = () => { ctl && ctl.abort(); url && URL.revokeObjectURL(url); ov.remove(); };
  ov.addEventListener("click", (e) => { if (e.target === ov || e.target.closest("[data-x]")) close(); });
  const pv = $("#gpv", ov), mk = $("#gmk", ov), use = $("#guse", ov);
  mk.onclick = async () => {
    if (!groups.some((g) => g.tags.length)) { toast("태그를 하나 이상 넣어 주세요."); return; }
    const rt = $("#grt", ov)?.value || "safe", adult = imgRating(rt) !== "safe";
    mk.disabled = use.disabled = true; pv.innerHTML = `<span class="note">만드는 중… 10~30초쯤 걸려요</span>`; ctl = new AbortController();
    try {
      if (adult && minorHint(groups.flatMap((g) => g.tags.map((x) => x.t)).join(", "))) throw { code: "minor_block" };
      blob = await runwareImage(await buildPrompt(adult), { aspect, rating: rt, signal: ctl.signal });
      url && URL.revokeObjectURL(url); url = URL.createObjectURL(blob);
      pv.innerHTML = `<img src="${url}" alt="생성된 이미지">`; use.disabled = false; mk.textContent = "다시 생성";
    } catch (e) { if (!ov.isConnected) return; blob = null; pv.innerHTML = `<span class="note">${esc(genErr(e))}</span>`; }
    finally { ctl = null; mk.disabled = false; }
  };
  use.onclick = async () => {
    if (!blob) return; use.disabled = true; toast("저장하는 중…");
    try { await onUse(blob); close(); } catch { use.disabled = false; toast("이미지를 저장하지 못했어요."); }
  };
  return ov;
}
