/* 움짤 프롬프트 조립(관리자 빌드만, 순수 — Node 단위 테스트가 바로 씀): 칸의 번호들로 영상 모델에 보낼 문장을 만든다.
   공식: 카메라 → 인물·의상·장소(정적 묘사) → 코드별 움직임(MOTIONS) → 호흡·얼굴·반복 마무리. 영상 모델은 Danbooru 낱말 나열보다 동명사 문장에 잘 반응한다.
   표는 전체이용가 감정·일상과 가벼운 스킨십만 담는다 — 세미 수위(104·111)와 성행위 코드의 움직임은 넣지 않음(CLAUDE.md 수위 원칙, tests/unit/motion-prompts.test.mjs가 범위를 고정). 표에 없는 칸은 IDLE_MOTION.
   정적 묘사는 번역 없이 영문 태그만 — 창을 열 때 바로 채우고 요금이 들지 않게(생김새는 첫 장면 사진이 이미 정함) */
import { splitDims } from "../images/codes.js";

/* 코드별 문장을 쓰지 않는 칸(세미·성인 수위)의 기본 설명 */
export const MOTION_PROMPT = "subtle idle animation, the character breathes gently and blinks naturally, hair and clothes sway slightly in a soft breeze, same pose, same outfit, same face, camera fixed, smooth seamless loop";
const VIDEO_CAMERA = "Static camera locked on the character, same framing";
/* 마무리: 숨·눈·표정이 조금씩 움직여야 마네킹처럼 보이지 않음 */
const VIDEO_FINISH = "natural breathing, gentle blinking, subtle facial micro-expressions, hair and clothes moving slightly, same face, same outfit, smooth seamless loop";
export const IDLE_MOTION = "slight body movement, same pose";
/* 감정/행동 번호 → 움직임. 의상(4xx)·장소(5xx)는 움직임이 없어 정적 묘사로만 들어감 */
export const MOTIONS = {
  101: "smiling softly, gentle eyes blinking, warm and happy facial expression",
  102: "glaring intensely, sharp hostile eye movement, frowning deeply",
  103: "looking around in panic, sweating heavily, stiff and tense body movement, blushing deeply",
  105: "swaying sluggishly, glazed eyes looking around, flushed cheeks",
  106: "shoulders shaking violently from crying, tears streaming down cheeks, lips trembling, head bowing down",
  107: "fidgeting nervously, looking away shyly, faint smile appearing, cheeks blushing",
  108: "staring coldly without expression, arms crossed tightly, looking down with a distant gaze",
  109: "panting heavily, slumped posture, chest rising and falling rapidly from exhaustion, sweat dripping",
  110: "pouting angrily, casting side glances, crossing arms with a jealous expression, sulking movement",
  112: "looking up with puppy eyes, clinging affectionately, rubbing cheek against viewer",
  113: "pushing away forcefully, turning head in rejection, defensive grimacing facial expression",
  114: "empty eyes staring blankly, listless sighing, shoulders slumping in emptiness",
  115: "taking a deep breath of relief, soft smile forming, body relaxing peacefully",
  116: "winking playfully, sticking tongue out teasingly, mischievous smile spreading",
  117: "staring affectionately with wistful eyes, gentle touching motion, longing gaze",
  118: "narrowing eyes warily, leaning back defensively, tense and suspicious posture",
  119: "collapsing in despair, burying head in hands, crying uncontrollably, tear stains forming",
  120: "smiling brightly, clapping hands together in excitement, eyes sparkling with joy",
  121: "eyes widening in shock, mouth opening in gasp, stepping back, hands covering mouth",
  122: "chewing food with a satisfied expression, holding and moving wine glass gently",
  123: "staring intently at monitor, fingers moving rapidly on controller, focused gaming expression",
  124: "nodding off to sleep, rubbing eyes sleepily, yawning wide, eyes slowly closing",
  125: "turning book pages, adjusting glasses, focused reading expression, quiet movement",
  126: "talking animatedly, making light hand gestures, maintaining eye contact while speaking",
  127: "closing eyes contentedly while being patted on the head, head moving gently under the touch, soft hair swaying",
  128: "lying peacefully on lap, looking up softly at viewer, relaxed breathing",
  129: "flinching and squirming from tickling, giggling happily, dodging playfully",
  130: "turning head away with puffed cheeks, sulking and pouting, avoiding eye contact",
  131: "stirring food in kitchen, wearing apron, tasting food carefully with a concentrated look",
  132: "typing rapidly on phone screen, screen glow illuminating face, indifferent scrolling motion",
  133: "stretching arms high, languid body movement, closing eyes comfortably",
  134: "applying lipstick carefully, looking in mirror, getting dressed up motion",
  135: "head nodding to music rhythm, wearing earphones, humming with closed eyes",
  136: "taking a deep calming breath, closing eyes to compose oneself, chest expanding",
  137: "checking watch anxiously, looking around restlessly, biting lip in nervousness",
  138: "forcing a stiff smile, sad eyes trembling, lips quivering slightly",
  139: "crying tears of joy, smiling brightly while moved, eyes sparkling with emotion",
  140: "sighing in irritation, putting hand on forehead, sharp annoyed glare",
  // 가벼운 스킨십(관리자 코드 표에 있을 때만 쓰임)
  201: "hugging warmly, rubbing back gently, swaying softly",
  202: "pecking lightly on the lips, gentle kissing motion, eyes closing softly",
  213: "fingers intertwining tightly, hands gripping with strength, subtle warm movement",
  214: "kissing forehead and cheek affectionately, loving gaze, gentle touch",
  215: "hugging warmly from behind, swaying gently together",
  216: "rubbing cheeks together affectionately, smiling warmly, face pressing close"
};
/** 번호들 가운데 표에 움직임이 있는 감정/행동 코드가 있는지 — 대화 중 자동 움짤이 이 칸을 만들지 정할 때. @param {number[]} codes */
export function hasMotionCode(codes) { return splitDims(codes).act.some((n) => !!MOTIONS[n]); }
/** 태그 묶음(savedParts)에서 정적 묘사만: 인물·의상·장소의 영문 태그(한글 태그는 번역해야 하니 뺌). @returns {string} */
export function sceneTags(parts) {
  return parts.filter((g) => ["look", "wear", "bg"].includes(g.key)).flatMap((g) => g.tags.map((x) => x.t)).filter((t) => t && !/[ㄱ-힣]/.test(t)).join(", ");
}
/** 번호들 + 정적 묘사 → 영상 프롬프트. 감정/행동이 둘이면 움직임도 둘 다. @param {number[]} codes @param {string} [scene] @returns {string} */
export function buildVideoPrompt(codes, scene = "") {
  const moves = splitDims(codes).act.map((n) => MOTIONS[n]).filter(Boolean);
  return [VIDEO_CAMERA, scene && "Featuring " + scene, (moves.join(", ") || IDLE_MOTION) + ", " + VIDEO_FINISH].filter(Boolean).join(". ");
}
