/* Runware API 호출(runwareImage): 모델·수위·네거티브 조립, 대상별 보정, 오류 문구 */
import { CFG } from "../core/config.js";
import { minorHint } from "../core/safety.js";
import { S, hasRunwareKey } from "../core/state.js";
import { splitTags } from "./prompt.js";
import { RATINGS, imgRating } from "./rating.js";
import { ARCH, imgModelInfo, styleFor } from "./styles.js";
import { ponyTags } from "./tags.js";
import { IMG, validRef } from "../services/images.js";

export const BAD_IMG_MODELS = ["civitai:257259@290640", "civitai:257749@290640"];
 // 없는 모델·Runware가 못 불러오는 ID → 로드 때 고침
const RW_SIZES = { "4:5": [832, 1216], "3:4": [832, 1216], "1:1": [1024, 1024], "16:9": [1216, 832] };
const IMG_NEG = "text, watermark, signature, logo, deformed, bad anatomy, bad hands, missing fingers, extra digits, blurry, low quality";
// 미성년 태그는 수위와 상관없이 늘 네거티브에(CLAUDE.md 수위 원칙)
const NEG_MINOR = "child, loli, shota, underage, toddler, aged down";
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
/* Runware 이미지 생성 → Blob (IMG.put에 그대로 넣을 수 있음). 그림은 dataURI로 받아 두 번째 요청·CORS 문제를 피하고, URL로 오면 내려받음.
   style은 styleFor(ctx)가 고른 {prompt, model} — 없으면 설정의 그림체 그대로(styleFor()) */
export async function runwareImage(prompt, { aspect = "4:5", rating = imgRating(), signal, style: styleOpt } = {}) {
  if (!hasRunwareKey()) throw { code: "no_key" };
  rating = imgRating(rating);
  const adult = rating !== "safe", st = styleOpt || styleFor();
  if (adult && minorHint(prompt)) throw { code: "minor_block" };
  const rawTags = await ponyTags(prompt, adult), rawStyle = await ponyTags(st.prompt || "", adult);
  if (adult && minorHint(rawTags + ", " + rawStyle)) throw { code: "minor_block" };
  const subj = imgSubject(rawTags), Sb = SUBJ[subj] || {};
  const tags = fixSubject(rawTags, subj), style = splitTags(rawStyle).filter((t) => !(Sb.strip && Sb.strip.test(t))).join(", ");
  const [width, height] = RW_SIZES[aspect] || RW_SIZES["4:5"], R = RATINGS[rating], M = imgModelInfo(st.model), A = ARCH[M.arch] || ARCH.pony;
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
export async function refDataURL(ref) {
  try {
    if (ref.startsWith("kv:")) return await IMG.load(ref.slice(3));
    if (ref.startsWith("/_blob/")) { const b = await (await fetch(ref)).blob(); return await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(b); }); }
    return validRef(ref) ? ref : null;
  } catch { return null; }
}
export function genErr(e) {
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
