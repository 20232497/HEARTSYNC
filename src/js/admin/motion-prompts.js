/* 움짤 프롬프트 조립(관리자 빌드만, 순수 — Node 단위 테스트가 바로 씀): 칸의 번호들로 영상 모델에 보낼 문장을 만든다. 표 자체는 admin/motion-table.js.
   공식: 카메라(문장에 pov가 있으면 1인칭, 아니면 고정) → 인물·의상·장소(정적 묘사) → 코드별 움직임 → 호흡·얼굴·반복 마무리. 영상 모델은 Danbooru 낱말 나열보다 동명사 문장에 잘 반응한다.
   인물의 성별은 표를 고르는 데만 쓴다(남자면 MotionPrompts_Male을 먼저, 없으면 기본 표 — 감정·일상은 성별을 가리지 않음). 내 칸·기본 칸에 고쳐 둔 motion이 있으면 그것이 표보다 먼저.
   신체 물리 키워드는 넣지 않음, 세미·성인 수위 칸은 이 조립을 거치지 않음(CLAUDE.md 수위 원칙 — 거르는 곳은 admin/motion-run.js motionSafe). 표에 없는 칸은 IDLE_MOTION.
   정적 묘사는 번역 없이 영문 태그만 — 창을 열 때 바로 채우고 요금이 들지 않게(생김새는 첫 장면 사진이 이미 정함) */
import { DIMS, splitDims } from "../images/codes.js";
import { MotionPrompts, MotionPrompts_Male } from "./motion-table.js";

/* 코드별 문장을 쓰지 않는 칸(세미·성인 수위)의 기본 설명 */
export const MOTION_PROMPT = "subtle idle animation, the character breathes gently and blinks naturally, hair and clothes sway slightly in a soft breeze, same pose, same outfit, same face, camera fixed, smooth seamless loop";
/* 상대가 개입하는 행동(pov)은 1인칭 카메라 — 인물 본인의 팔이 꺾여 들어오지 않게 */
const CAMERA_POV = "First-person POV, shot from the perspective of the partner, partner's hands interacting with the character, cinematic close-up";
const CAMERA_LOCKED = "Camera locked on the dynamic action, cinematic close-up";
/* 마무리: 숨·눈·표정이 조금씩 움직여야 마네킹처럼 보이지 않음 */
const VIDEO_FINISH = "natural breathing, gentle blinking, subtle facial micro-expressions, hair and clothes moving slightly, same face, same outfit, smooth seamless loop";
export const IDLE_MOTION = "subtle breathing, slight body movement";
/* 대화 중 자동 움짤을 거는 번호대: 세부 감정·행동(100~399)과 의상(400~). 기본 0~14·직접 만든 칸 15~99·장소 501~만 있는 칸은 사진 그대로 */
export const VIDEO_CODE_MIN = 100, VIDEO_CODE_MAX = 500;
/** 칸의 번호들 가운데 움짤 번호대가 있는지. 수위는 따로 봄(motionSafe). @param {number[]} codes @returns {boolean} */
export const wantsVideo = (codes) => codes.some((n) => n >= VIDEO_CODE_MIN && n <= VIDEO_CODE_MAX);

/* 표의 base_prompt는 내장 코드의 그림 프롬프트로 — 표 하나만 고치면 그림과 움짤이 같이 바뀌게. 전체이용가 코드만, 사용자 빌드의 DIMS는 그대로(사용자 사이트는 그림을 만들지 않음) */
for (const k of Object.keys(MotionPrompts)) { const d = DIMS[k], b = MotionPrompts[k].base_prompt; if (d && d.rating === "safe" && b) d.prompt = b; }

/**
 * @typedef {Object} MotionOpts
 * @property {boolean} [male] 남자 인물이면 남성 표를 먼저 봄
 * @property {(n: number) => ({prompt?: string, motion?: string}|null|undefined)} [def] 번호 → 고쳐 둔 코드 정의(내 칸·기본 칸)
 */
/** 번호 하나의 움직임 행: 고쳐 둔 motion → (남자면) 남성 표 → 기본 표. 없으면 null. @param {number} n @param {MotionOpts} [o] @returns {{base_prompt: string, motion_en: string}|null} */
export function motionRow(n, o = {}) {
  const d = o.def && o.def(n);
  if (d && d.motion) return { base_prompt: d.prompt || "", motion_en: d.motion };
  return (o.male && MotionPrompts_Male[n]) || MotionPrompts[n] || null;
}
/** 번호들 가운데 움직임 행이 있는 감정/행동 코드가 있는지 — 움짤 창의 '이 코드에 맞춰 채웠어요'. @param {number[]} codes @param {MotionOpts} [o] @returns {boolean} */
export function hasMotionCode(codes, o) { return splitDims(codes).act.some((n) => !!motionRow(n, o)); }
/** 태그 묶음(savedParts)에서 정적 묘사만: 인물·의상·장소의 영문 태그(한글 태그는 번역해야 하니 뺌). @returns {string} */
export function sceneTags(parts) {
  return parts.filter((g) => ["look", "wear", "bg"].includes(g.key)).flatMap((g) => g.tags.map((x) => x.t)).filter((t) => t && !/[ㄱ-힣]/.test(t)).join(", ");
}
/** 번호들 + 정적 묘사 → 영상 프롬프트. 감정/행동이 둘이면 움직임도 둘 다, 어느 하나에 pov가 있으면 1인칭 카메라. @param {number[]} codes @param {string} [scene] @param {MotionOpts} [o] @returns {string} */
export function buildVideoPrompt(codes, scene = "", o = {}) {
  const rows = splitDims(codes).act.map((n) => motionRow(n, o)).filter(Boolean);
  const pov = rows.some((r) => /\bpov\b/i.test(r.base_prompt + " " + r.motion_en));
  return [pov ? CAMERA_POV : CAMERA_LOCKED, scene && "Featuring " + scene, (rows.map((r) => r.motion_en).join(", ") || IDLE_MOTION) + ", " + VIDEO_FINISH].filter(Boolean).join(". ");
}
