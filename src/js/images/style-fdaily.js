/* 여성향 일상 화풍(남성 인물 전용)의 값: 태그·네거티브·LoRA·생성 설정·후처리·그림 내용별 조건(fits). 아무것도 import하지 않는 순수 데이터 — tests/unit/style-fdaily.test.mjs */
/* 2026-11-06 사용자와 43라운드 비교 생성으로 정함(참고 그림 프롬1_여성향_일상). 모델은 Run七八造 v2(styles.js에서 지정), Add More Details 0.1 + KoreanAI 0.3 + Age Slider 0.5.
   방향: 가벼운 일러스트(D안 — 실사 느낌을 뺌)·정면·리프컷·근육질 몸과 굵은 목·섹시한 인상·수염 자국 없음·회색 베일.

   태그 순서가 곧 결과다. 앱은 내용(장면·인물) 뒤에 화풍을 붙이므로(runwareImage) 머리색·옷은 내용이 정하고, 화풍 안에서는
   목·몸을 머리보다 앞에 둠 — 머리를 앞에 두면 몸이 가늘어지고, 몸을 앞에 둬도 short hair라야 8장 모두 머리 길이가 고르게 나옴(fd41·fd42).

   쓰면 안 되는 낱말(비교 생성에서 확인). 이름에 "lip"이 든 태그는 SUBJ.male.strip이 조용히 지움(flipped·clip·thin lips — 그래서 ends curving outward):
   wolf cut·leaf → 짐승 귀·나뭇잎 / navy → 제복 / 머리 태그의 collar → 초커 / plain t-shirt → 무늬(white undershirt를 씀) / sweater + neck → 터틀넥 /
   adam's apple → 사과 / bomber jacket → 패치 / ash hair → 진갈색(grey hair를 씀) / hair sheen → 갈색으로 번짐 / hair down·loose hair → 머리가 길어짐 /
   soft brush strokes → 손에 붓 / shoulder-length hair → 들쭉날쭉. 눈 색 네거티브(purple·green eyes)는 다른 눈을 빨갛게 만들어 안 씀.
   인물의 옷이 설정과 달라지면 작품 태그에 색과 옷을 쉬운 낱말로 더하면 잡힘(fd47·fd49·fd50): black three-piece suit만으로는 흰 정장 → black suit, white shirt / black military uniform만으로는 진녹색 → black jacket / feather-trimmed coat·black robe는 가슴이 드러남 → black shirt·high collar, closed robe(closed robe만으로는 안 닫힘 — 백연은 white shirt까지, fd55). 고개가 조금 돌아가면 태그보다 시드를 바꿈.
   알려진 한계: 실내 장면에 액자가 자주 걸림(painted background·soft painting은 원인이 아니었음), 눈가 붉은 기(참고 그림 일부에도 있음), 회색 머리는 다른 색보다 어려 보이기 쉬워 만든 그림을 보고 고를 것, 티셔츠·후드의 글자 무늬, 눈 색을 안 정한 인물은 파란 눈이 되기도 함, 두 번째 시드 배경의 얼룩, 눈물·겁먹은 표정은 약함, 넘긴 머리는 일부만 넘어감 */
const FD_NECK = "(thick neck:1.5), (muscular neck:1.35), (trapezius:1.35), (wide neck:1.25)";
// 정장은 목이 길어야 어울림(사용자 요청) — 깃에 묻혀 짧아 보임
const FD_NECK_SUIT = "(long neck:1.3), (thick neck:1.25)";
const FD_BODY = "(muscular male:1.35), (muscular:1.3), (thick arms:1.25), (broad chest:1.25), (broad shoulders:1.45), (pectorals:1.1)";
// 리프컷: 목에 닿는 길이, 가운데 쪽 가르마에서 앞머리가 바깥으로 흐르고 옆머리 끝이 바깥으로 말림
const FD_HAIR = "(short hair:1.15), (hair reaching neck:1.25), (parted bangs:1.3), (curtained hair:1.3), (sidelocks:1.25), (long bangs:1.2), (bangs falling over forehead:1.25), (ends curving outward:1.25), (layered hair:1.25), (tapered ends:1.15), (soft curved layers:1.15), (hair covering ears:1.2)";
const FD_GAZE = "(intense gaze:1.2), charismatic, confident";
const FD_SEXY = "(seductive smile:1.2), (smoldering gaze:1.2), (sultry:1.3), (sharp gaze:1.1), closed mouth";
const FD_SHOT = "(cowboy shot:1.3)";
// 정면(사용자 요청 — 사선이면 표정이 잘 안 보임). 약하면 고개가 조금 돌아가서 강하게(fd53), from side 등을 네거티브에 더해도 나아지지 않아 네거티브 한도만 씀
const FD_ANGLE = "(facing viewer:1.6), (straight-on:1.5), (front view:1.3), (head straight:1.2)";
const fdPrompt = (tone, skin, end = "") => ["adult man", FD_NECK, FD_BODY, FD_HAIR,
  "source_anime, (digital illustration:1.5), (anime illustration:1.45), (anime coloring:1.25), (illustration:1.3), (soft painting:1.35), painterly, (colored lineart:1.25), (soft edges:1.2), korean, 2d, (simple shading:1.35), (flat color:1.25)",
  `low contrast, soft ${tone} palette, gentle lighting`,
  "(mature male:1.3), (mature face:1.25), (masculine:1.25), (sharp jawline:1.25), (narrow eyes:1.2), almond eyes, (sharp eyebrows:1.1), sharp facial features, (33 years old:1.2), (simple nose:1.35), (adult male build:1.3), (masculine features:1.3), large frame",
  FD_GAZE, "(fine hair strands:1.4), (soft hair:1.3), (airy hair:1.15)", skin,
  "soft diffused light, brighter exposure, lifted shadows, (natural eye color:1.1), (eye highlights:1.2), (anime eyes:1.1), (soft colors:1.1), airy" + end,
  FD_SEXY, "(smooth skin:1.35), (warm skin tone:1.1), (high key lighting:1.05), soft bloom, (illustrated background:1.2), (soft cel shading:1.2)", FD_SHOT, FD_ANGLE].join(", ");

/* 그림 내용이 정한 것은 화풍이 덮지 않음(fitStyle이 차례로 적용). 작품의 인물은 대부분 자기 머리 모양·표정 칸이 있음 */
const FD_FITS = [
  // 정장: 목 태그 바꾸고 긴 목 네거티브를 뺌. swimsuit·bodysuit는 앞 글자 때문에 걸리지 않음
  { when: /(^|[^a-z])(?:suit|tuxedo)\b/i, swap: [FD_NECK, FD_NECK_SUIT], negDrop: ["(long neck:1.3)"] },
  // 자기 머리 모양이 있는 인물(짧은 머리·넘긴 머리·묶은 머리…)은 리프컷을 뺌. neat·soft·messy·wavy hair는 모양이 아니라 결이라 그대로 둠
  { when: /(^|[^a-z])(?:(?:very )?short hair|medium hair|(?:very )?long hair|permed hair|slicked back hair|hair slicked back|swept back hair|(?:low |high )?ponytail|half updo|updo|hair bun|braids?|twintails|undercut|buzz cut|crew cut|bob cut|bowl cut|mullet|mohawk|pompadour|afro|bald|shaved head|hair over eyes|hair over one eye|forehead)\b/i,
    drop: [FD_HAIR], negDrop: ["(forehead:1.2)", "swept back hair"] },
  // 넘긴 머리·아주 짧은 머리는 가중치 1.3으로도 앞머리가 내려와 더 강조함(fd46·fd47)
  { when: /(^|[^a-z])(?:slicked back hair|hair slicked back|swept back hair)\b/i, put: "(slicked back hair:1.5), (forehead:1.3)" },
  { when: /(^|[^a-z])(?:very short hair|buzz cut|crew cut)\b/i, put: "(very short hair:1.5)" },
  // 뚜렷한 감정 칸(울음·분노·놀람·공포·큰 웃음·수면·싸움…)이면 섹시한 미소·자신만만한 눈빛을 뺌 — 빼지 않으면 표정을 따르지 않음. 은은한 미소·설렘·기본 칸은 그대로
  { when: /(^|[^a-z])(?:cry|crying|tears|streaming tears|sad|frown|angry|furious|glaring|clenched teeth|surprised|shocked|wide-eyed|scared|frightened|trembling|pout|pouting|annoyed|laughing|open mouth|embarrassed|shy|injured|sleeping|closed eyes|fighting stance|attacking)\b/i,
    drop: [FD_SEXY, FD_GAZE], negDrop: ["(pouting:1.4)", "grin", "teeth"] },
  // 구도·각도를 정한 장면은 그대로
  { when: /(^|[^a-z])(?:close-up|portrait|upper body|waist up|full body|lower body|cowboy shot|lying|sleeping|action pose)\b/i, drop: [FD_SHOT] },
  { when: /(^|[^a-z])(?:from behind|from above|from below|from side|three-quarter view|profile|lying|sleeping)\b/i, drop: [FD_ANGLE] }
];

export const FDAILY = {
  prompt: fdPrompt("warm", "(pale skin:1.3), (fair skin:1.2)"),
  coolPrompt: fdPrompt("cool", "(pale skin:1.35), (fair skin:1.25)", ", cool lighting"),
  blackTag: "(black hair:1.45), (cool-toned hair:1.1)",
  // 회색·은발·애쉬 금발은 어려 보이기 쉬워 성숙 태그를 뒤에 더함(fd39 — 다른 머리색은 없어도 됨)
  paleTag: "(mature male:1.5), (mature face:1.45), (sharp jawline:1.45), (prominent jawline:1.3), (narrow eyes:1.35), (small eyes:1.2), (thick eyebrows:1.2), (33 years old:1.35), (masculine:1.4)",
  fits: FD_FITS,
  // 인물·장면 태그의 가중치(weighTags) — 없으면 화풍에 묻혀 작품 인물의 옷·머리가 바뀌고 표정이 모두 같아짐(fd44 → fd45). 군복 색이 가끔 진녹색으로 번지는 것은 남은 한계
  contentWeight: 1.3,
  // Runware는 네거티브 전체가 3000자를 넘으면 거부함 — 고정 부분(품질·미성년·남자 대상) 약 350자를 빼고 이 값은 2625자까지. 안전 태그(young·teen·baby face·bare chest…)는 줄이지 말 것
  neg: "(3d, cgi, plastic skin, doll:1.2), high contrast, underexposed, glowing eyes, vivid eye color, (earrings:1.4), (see-through clothes:1.3), sheer clothes, transparent clothes, thin hair, sparse hair, clumped hair, chunky hair strands, (baby face:1.3), (childish face:1.2), round face, chubby cheeks, (graphic print:1.5), (text on clothes:1.5), tanned skin, dark skin, (realistic:1.5), photo, (photorealistic:1.5), skin pores, skin texture, source_cartoon, monochrome, greyscale, (long hair:1.5), old man, wrinkles, (necklace:1.4), necktie, red eyeshadow, eye makeup, blush, nose blush, teenage, (tired:1.3), (sleepy:1.3), (exhausted:1.2), (eye bags:1.3), (dark circles:1.3), (under-eye shadow:1.2), (red eyelids:1.2), (bloodshot eyes:1.2), gaunt, hollow cheeks, curly hair, (large eyes:1.4), big eyes, round eyes, (sparkling eyes:1.2), v-shaped jawline, pointy chin, narrow chin, (bob cut:1.4), blunt bangs, (androgynous:1.3), (red lips:1.2), pink lips, lipstick, blue eyes, (pretty boy:1.3), (bishounen:1.3), boyish, innocent, youthful, (young:1.3), (teen:1.4), adolescent, (narrow shoulders:1.4), (slim shoulders:1.3), skinny, slender, small frame, (soft face:1.3), (open shirt:1.4), unbuttoned shirt, (bare chest:1.5), cleavage, shirtless, topless, nipples, swept back hair, (bowl cut:1.4), (mushroom cut:1.4), (feminine:1.4), thin eyebrows, (delicate features:1.3), (feminine face:1.4), (print on clothes:1.5), grin, teeth, (pouting:1.4), (piercing:1.4), (choker:1.4), (eyeshadow:1.3), (glossy lips:1.3), (shiny nose:1.2), (oily skin:1.2), (blue hair:1.4), (blue highlights:1.4), (brown highlights:1.2), (thick outlines:1.3), (bold lineart:1.3), (rosy cheeks:1.3), (messy hair:1.3), (tousled hair:1.3), (hair over eyes:1.3), (hair between eyes:1.2), (wide face:1.3), (short face:1.3), (small mouth:1.2), (full lips:1.2), (puffy hair:1.4), (voluminous hair:1.4), (fluffy hair:1.3), (school uniform:1.4), (thin neck:1.4), (slender neck:1.4), (long neck:1.3), (thin arms:1.3), lanky, (bokeh:1.3), (blurry background:1.2), (golden hair:1.3), (shirt print:1.4), (gradient hair:1.5), (multicolored hair:1.5), (turtleneck:1.4), (stubble:1.5), (five o'clock shadow:1.5), (facial hair:1.5), (beard:1.4), (hair tie:1.4), (low ponytail:1.5), (ponytail:1.4), (hair over chest:1.3), (scarf:1.4), (2boys:1.5), (multiple boys:1.4), (faceless male:1.4), (animal ears:1.5), (pointy ears:1.4), (stray hairs:1.3), (flyaway hair:1.3), nose shadow, (shiny clothes:1.2), (heavy shading:1.3), (hard shadows:1.3), nose highlight, (black outlines:1.2), (forehead:1.2), (outstretched hand:1.3), (hair bun:1.4), (framed picture:1.4), (wavy hair:1.3)",
  lora: [{ model: "civitai:390892@1286572", weight: 0.1 }, { model: "civitai:690861@773211", weight: 0.3 }, { model: "civitai:468265@539667", weight: 0.5 }],
  gen: { cfg: 4.5, steps: 35, scheduler: "DPM++ 2M Karras", modelNeg: false },
  // veil: 가장자리로 갈수록 채도를 빼는 회색 베일(가운데 인물의 색은 남김) — 남성향 일상의 흰 막에 대응(사용자 요청). 값은 stylePost(images/runware.js)가 씀
  post: { lift: "rgb(18,18,22)", soft: 0.12, blurK: 3, blurA: 0.6, veil: { center: 0.03, edge: 0.3, mul: "rgb(242,242,244)", a: 0.04, color: "rgb(128,128,132)" } }
};
