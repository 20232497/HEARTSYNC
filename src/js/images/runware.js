/* Runware API 호출(runwareImage): 모델·수위·네거티브 조립, 대상별 보정, 오류 문구 */
import { CFG } from "../core/config.js";
import { TIMEOUT } from "../core/constants.js";
import { minorHint } from "../core/safety.js";
import { S, hasRunwareKey } from "../core/state.js";
import { abortCode, timeoutSignal } from "../core/util.js";
import { splitTags } from "./prompt.js";
import { RATINGS, imgRating } from "./rating.js";
import { assertAdmin } from "./gen-guard.js";
import { fitStyle, weighTags } from "./style-fit.js";
import { ARCH, imgModelInfo, styleFor } from "./styles.js";
import { ponyTags } from "./tags.js";
import { IMG, validRef } from "../services/images.js";

export const BAD_IMG_MODELS = ["civitai:257259@290640", "civitai:257749@290640"];
 // 없는 모델·Runware가 못 불러오는 ID → 로드 때 고침
const RW_SIZES = { "4:5": [832, 1216], "3:4": [832, 1216], "1:1": [1024, 1024], "16:9": [1216, 832] };
export const IMG_NEG = "text, watermark, signature, logo, deformed, bad anatomy, bad hands, missing fingers, extra digits, blurry, low quality";
// 미성년 태그는 수위와 상관없이 늘 네거티브에(CLAUDE.md 수위 원칙)
export const NEG_MINOR = "child, loli, shota, underage, toddler, aged down";
export function uuid4() {
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
export const SUBJ = {
  // female·woman·eyeshadow 등: 여성 인물용 화풍(남성향 일상)으로 남자나 풍경을 그릴 때 여자가 끼어들지 않게
  male: { strip: /makeup|lip|eyelash|glamorous|cute|kawaii|beautiful|female|woman|eyeshadow|eyeliner|blush/i, neg: "1girl, female, breasts, makeup, lipstick, feminine" },
  none: { strip: /korean|skin|makeup|lip|eye|pupil|face|facial|jawline|v-shaped|cheek|nose|mouth|bangs|blush|hair|glamorous|mature|female|woman|cute|kawaii|beautiful|portrait|body/i, neg: "1girl, 1boy, human, person, humanoid, anthro, kemonomimi, animal ears" }
};
/* 내장 화풍의 후처리(style.post): 그림을 받은 뒤 브라우저에서 입힘 — 모델·태그로는 조절이 안 되는 전체 밝기와 흐림(2026-11-05 비교 생성으로 정함).
   lift·soft: 옅은 빛을 screen으로 더하고 중간톤을 soft-light로 올림. blurK·blurA: 1/blurK로 줄였다 키운 사본을 blurA만큼 겹침(ctx.filter는 Safari에서 안 됨).
   veil: 가운데에서 가장자리로 갈수록 채도를 빼고(saturation) 살짝 어둡게(multiply) 회색 막을 씌움 — 인물의 색은 남기고 전체를 회색조로(여성향 일상). 실패하면 원본 */
async function stylePost(blob, p) {
  const url = URL.createObjectURL(blob);
  try {
    const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const w = im.width, h = im.height, cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    const g = cv.getContext("2d"); g.imageSmoothingQuality = "high"; g.drawImage(im, 0, 0);
    if (p.lift) {
      g.globalCompositeOperation = "screen"; g.fillStyle = p.lift; g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = "soft-light"; g.globalAlpha = p.soft || 0; g.fillStyle = "#fff"; g.fillRect(0, 0, w, h);
      g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
    }
    if (p.blurK) {
      const sm = document.createElement("canvas"); sm.width = Math.round(w / p.blurK); sm.height = Math.round(h / p.blurK);
      const sg = sm.getContext("2d"); sg.imageSmoothingQuality = "high"; sg.drawImage(cv, 0, 0, sm.width, sm.height);
      g.globalAlpha = p.blurA; g.drawImage(sm, 0, 0, w, h); g.globalAlpha = 1;
    }
    if (p.veil) {
      const v = p.veil, r = g.createRadialGradient(w * 0.5, h * 0.4, h * 0.12, w * 0.5, h * 0.4, h * 0.8), grey = (a) => `rgba(128,128,128,${a})`;
      r.addColorStop(0, grey(v.center)); r.addColorStop(0.45, grey(v.center)); r.addColorStop(1, grey(v.edge));
      g.globalCompositeOperation = "saturation"; g.fillStyle = r; g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = "multiply"; g.fillStyle = v.mul; g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = "source-over"; g.globalAlpha = v.a; g.fillStyle = v.color; g.fillRect(0, 0, w, h); g.globalAlpha = 1;
    }
    return await new Promise((res) => cv.toBlob((b) => res(b || blob), "image/jpeg", 0.92));
  } catch { return blob; }
  finally { URL.revokeObjectURL(url); }
}
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
  await assertAdmin(); // 관리자 계정만(images/gen-guard.js) — 키를 확인하기 전에
  if (!hasRunwareKey()) throw { code: "no_key" };
  rating = imgRating(rating);
  const adult = rating !== "safe", st0 = styleOpt || styleFor();
  if (adult && minorHint(prompt)) throw { code: "minor_block" };
  const rawTags = await ponyTags(prompt, adult), subj = imgSubject(rawTags), Sb = SUBJ[subj] || {};
  // 사람 없는 그림은 화풍이 따로 정한 모델·문구로 — 인물 위주 화풍은 고양이만 시켜도 사람을 함께 그림(2026-11-05, 남성향 일상). 후처리는 같게
  const st = subj === "none" && st0.noHumans ? { ...st0.noHumans, post: st0.post } : st0, fit = fitStyle(st, rawTags), rawStyle = await ponyTags(fit.prompt, adult), G = st.gen || {};
  if (adult && minorHint(rawTags + ", " + rawStyle)) throw { code: "minor_block" };
  // 사람 없는 그림은 no humans를 강하게 — 인물 위주 모델·화풍은 고양이만 시켜도 사람을 함께 그림(2026-11-05)
  const tags = weighTags(fixSubject(rawTags, subj).replace(/(^|, )no humans(?=,|$)/, subj === "none" ? "$1(no humans:1.4)" : "$1no humans"), st.contentWeight, st.exprWeight), style = splitTags(rawStyle).filter((t) => !(Sb.strip && Sb.strip.test(t))).join(", ");
  const [width, height] = RW_SIZES[aspect] || RW_SIZES["4:5"], R = RATINGS[rating], M = imgModelInfo(st.model), A = ARCH[M.arch] || ARCH.pony;
  // 사람 없는 그림에는 수위의 adult·mature 태그를 빼야 사람이 끼어들지 않음
  const rpos = splitTags(M.arch === "illustrious" ? R.ill : R.pos).filter((t) => subj !== "none" || !/^(?:adult|mature|nsfw)$/.test(t)).join(", ");
  // 내용(장면·인물) 다음에 그림체 — 그림체가 앞이면 표정·자세가 묻힘. 내용이나 그림체에 "(태그:1.3)" 강조가 있으면 Runware 가중치 문법(sdEmbeds)을 켬
  const task = { taskType: "imageInference", taskUUID: uuid4(),
    positivePrompt: [A.pos, rpos, M.pos, tags, style].filter(Boolean).join(", ").slice(0, 2900),
    ...(/\([^()]+:\d(?:\.\d+)?\)/.test(tags + ", " + style + ", " + fit.neg) ? { promptWeighting: "sdEmbeds" } : {}),
    // 여러 명 태그(3girls·3boys…)가 있으면 네거티브에 solo·1girl·1boy — 표지에서 한 명만 크게 그리던 것(2026-11-04). 화풍의 네거티브(fit.neg)는 맨 뒤
    negativePrompt: [A.neg, G.modelNeg === false ? "" : M.neg, IMG_NEG, NEG_MINOR, R.neg, Sb.neg, /\b[2-9](?:girls|boys)\b/.test(tags) ? "solo, 1girl, 1boy" : "", fit.neg].filter(Boolean).join(", "),
    // 샘플러·스텝·CFG·LoRA는 내장 화풍이 정할 수 있음(style.gen·style.lora) — 없으면 모델·아키텍처 기본값
    model: M.id, width, height, numberResults: 1, steps: G.steps || 28, CFGScale: G.cfg || M.cfg || A.cfg, scheduler: G.scheduler || "Euler a",
    ...(Array.isArray(st.lora) && st.lora.length ? { lora: st.lora.map((l) => ({ model: l.model, weight: +l.weight || 1 })) } : {}),
    outputFormat: "WEBP", outputType: "dataURI", ...(adult ? {} : { checkNSFW: true }) };
  let j, res;
  for (let tries = 0; tries < 2; tries++) {
    const T = timeoutSignal(TIMEOUT.image, signal); // 생성 한 건의 시간 제한(보통 10~40초) — 넘으면 {code:"timeout"}
    try {
      res = await fetch(CFG.runwareUrl, { method: "POST", signal: T.signal, headers: { "content-type": "application/json", ...(S.settings.runwareKey ? { authorization: "Bearer " + S.settings.runwareKey } : {}) }, body: JSON.stringify([task]) });
      j = await res.json().catch(() => ({}));
    } catch (e) { throw { code: abortCode(e, T, "network") }; }
    finally { T.clear(); }
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
  let T2 = null;
  const done = (blob) => st.post ? stylePost(blob, st.post) : blob;
  try {
    if (d.imageDataURI || d.imageBase64Data) return await done(await (await fetch(d.imageDataURI || `data:image/webp;base64,${d.imageBase64Data}`)).blob());
    if (d.imageURL) { T2 = timeoutSignal(TIMEOUT.api * 3, signal); return await done(await (await fetch(d.imageURL, { signal: T2.signal })).blob()); }
  } catch (e) { throw { code: abortCode(e, T2, "image_fetch") }; }
  finally { if (T2) T2.clear(); }
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
    admin_login: "그림은 관리자 계정만 만들 수 있어요. MY → 계정에서 관리자 계정으로 로그인해 주세요.",
    admin_only: "이 계정은 관리자로 확인되지 않아 그림을 만들 수 없어요(Supabase admins 표에 없거나 서버에 닿지 못함).",
    no_key: "설정에서 Runware API 키를 먼저 넣어 주세요.",
    bad_key: "Runware API 키가 올바르지 않거나 권한이 없어요.",
    no_funds: "Runware 크레딧이 부족해요. Runware 대시보드(runware.ai)에서 충전해 주세요.",
    bad_model: "이미지 모델을 찾을 수 없어요. 설정에서 이미지 모델을 확인해 주세요." + (e?.msg ? ` (${String(e.msg).slice(0, 120)})` : ""),
    rate_limited: "요청이 너무 많아요. 잠시 후 다시 시도해 주세요.",
    blocked: "안전 필터에 걸려 이 그림은 쓰지 않았어요. 프롬프트를 바꿔 보세요.",
    minor_block: "미성년으로 보이는 표현(나이·학생·교복 등)이 있어 이 수위로는 만들지 않았어요. 전체이용가로 바꾸거나 표현을 고쳐 주세요.",
    image_fetch: "만든 그림을 내려받지 못했어요. 잠시 뒤 다시 시도해 주세요.",
    timeout: "그림을 만드는 데 너무 오래 걸려 멈췄어요(2분). 잠시 뒤 다시 시도해 주세요.",
    no_claude: "그림을 읽어 태그를 쓰려면 Anthropic API 키(또는 서버 연결)가 필요해요.",
    bad_claude: "Anthropic API 키가 올바르지 않거나 권한이 없어요.",
    network: window.claude?.use ? "claude.ai 안에서는 외부 API 호출이 막혀 Runware를 부를 수 없어요. 파일로 열어서 써 주세요." : "Runware에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.",
    cancelled: "생성을 취소했어요."
  }[e?.code] || "이미지를 만들지 못했어요." + (e?.msg ? ` (${String(e.msg).slice(0, 120)})` : "");
}
