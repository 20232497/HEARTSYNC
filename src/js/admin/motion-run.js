/* 움짤 만들기(관리자 빌드만): 저장한 사진 한 장을 첫 장면으로 Runware 영상 생성(videoInference — 이미지 → 영상)을 돌려 몇 초짜리 반복 영상을 만들고, 그 칸의 움짤로 저장한다(켜짐).
   요청은 비동기(deliveryMethod "async") — 보낸 뒤 getResponse로 몇 초마다 물어 videoURL을 받아 내려받고 IMG.putVideo(브라우저가 내려받기를 막으면 Runware의 임시 주소를 그대로 씀 — 오래 두면 사라짐).
   모델은 VIDEO_MODELS(싼 순 — 실패한 생성은 Runware가 청구하지 않음). 전체이용가 칸은 안전 검사를 켜고, 성인 수위 칸은 성인 확인 뒤에만·사진 설명·외모에 미성년 표현이 있으면 보내지 않음.
   만드는 중인 일은 MJOBS(작품|인물|칸 → 진행 상태)에 있고, 스튜디오가 그 칸에 '움짤 만드는 중'을 보여 줌. 화면을 떠나도 계속되고 끝나면 저장 */
import { ageOK } from "../ai/adult.js";
import { castLook } from "../core/cast.js";
import { CFG } from "../core/config.js";
import { TIMEOUT } from "../core/constants.js";
import { minorHint } from "../core/safety.js";
import { S, hasRunwareKey } from "../core/state.js";
import { $, esc, timeoutSignal, abortCode, toast } from "../core/util.js";
import { keyOf, parseCodes } from "../images/codes.js";
import { motionOf, putMotion } from "../images/motion.js";
import { imagesOf } from "../images/pick.js";
import { assertAdmin } from "../images/gen-guard.js";
import { imgRating } from "../images/rating.js";
import { NEG_MINOR, genErr, uuid4 } from "../images/runware.js";
import { codeRating, keyName } from "../images/situations.js";
import { IMG } from "../services/images.js";
import { ICON } from "../ui/icons.js";

/* 값싼 순. res는 Runware의 resolution(입력 사진 비율을 따름), dur은 고를 수 있는 길이(초), extra는 모델별 설정(2026-11 Runware 문서의 모델 스키마 기준) */
export const VIDEO_MODELS = [
  { k: "seed480", id: "bytedance:2@2", name: "Seedance 1.0 Pro Fast · 480p", price: "5초 약 $0.03", res: "480p", dur: [3, 5, 8], extra: { providerSettings: { bytedance: { cameraFixed: true } } } },
  { k: "seed720", id: "bytedance:2@2", name: "Seedance 1.0 Pro Fast · 720p", price: "5초 약 $0.07", res: "720p", dur: [3, 5, 8], extra: { providerSettings: { bytedance: { cameraFixed: true } } } },
  { k: "wan720", id: "alibaba:wan@2.6-flash", name: "Wan 2.6 Flash · 720p", price: "5초 약 $0.13", res: "720p", dur: [3, 5, 8], neg: true, extra: { providerSettings: { alibaba: { audio: false } } } },
  { k: "h3lite", id: "minimax:h3@lite", name: "MiniMax H3 Lite · 480p", price: "5초 약 $0.13", res: "480p", dur: [4, 5, 8], extra: {} }
];
export const MOTION_PROMPT = "subtle idle animation, the character breathes gently and blinks naturally, hair and clothes sway slightly in a soft breeze, same pose, same outfit, same face, camera fixed, smooth seamless loop";
/* 고른 모델·길이·움직임 설명(세션 동안 기억) */
export const MSTATE = { model: "seed480", dur: 5, prompt: MOTION_PROMPT };
/* 만드는 중인 일: "작품|인물|칸" → { t0, status, progress } */
export const MJOBS = {};
export const jobId = (c, code, key) => [c.id, code, keyOf(String(key))].join("|");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* 저장한 사진(kv:·/_blob/·content/·data:) → data URL(영상 생성의 첫 장면) */
async function photoData(ref) {
  if (ref.startsWith("kv:")) return await IMG.load(ref.slice(3));
  if (ref.startsWith("data:")) return ref;
  const b = await (await fetch(ref)).blob();
  return await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(b); });
}
/* Runware에 작업 하나 보내고 그 작업의 응답 행(없으면 null)을 돌려줌. 오류는 runwareImage와 같은 코드로 */
async function rwTask(task) {
  // 생성 작업만 관리자 확인(images/gen-guard.js). 결과를 묻는 getResponse는 막지 않음 — 이미 청구된 작업이라, 기다리는 사이 로그인이 풀려도 만든 움짤을 받아야 함
  if (task.taskType !== "getResponse") await assertAdmin();
  const T = timeoutSignal(TIMEOUT.api * 2);
  let res, j;
  try {
    res = await fetch(CFG.runwareUrl, { method: "POST", signal: T.signal, headers: { "content-type": "application/json", ...(S.settings.runwareKey ? { authorization: "Bearer " + S.settings.runwareKey } : {}) }, body: JSON.stringify([task]) });
    j = await res.json().catch(() => ({}));
  } catch (e) { throw { code: abortCode(e, T, "network") }; }
  finally { T.clear(); }
  const err = (Array.isArray(j.errors) ? j.errors : j.error ? [j.error] : []).find((x) => !x.taskUUID || x.taskUUID === task.taskUUID);
  const msg = err ? String([err.code, err.message, err.parameter].filter(Boolean).join(" ")) : "";
  if (!res.ok || err) {
    throw { code: res.status === 401 || res.status === 403 || /api.?key|auth/i.test(msg) ? "bad_key" : res.status === 402 || /credit|fund|balance|insufficient/i.test(msg) ? "no_funds"
      : res.status === 429 ? "rate_limited" : /model/i.test(msg) && !/moderat|content|safety|nsfw/i.test(msg) ? "bad_model" : /moderat|safety|nsfw|sensitive/i.test(msg) ? "blocked" : "upstream_error", msg };
  }
  return (j.data || []).find((x) => x && x.taskUUID === task.taskUUID) || null;
}
/* 그 칸의 움짤 만들기 → 저장(켜짐). repaint는 진행할 때마다 부름. 돌려주는 값: 저장했으면 true */
export async function makeMotion(c, cast, key, opts, repaint = () => {}) {
  const k = keyOf(String(key)), id = jobId(c, cast.code, k);
  if (MJOBS[id]) { toast("이 칸의 움짤은 이미 만드는 중이에요"); return false; }
  const ref = (imagesOf(c)[cast.code] || {})[k];
  const M = VIDEO_MODELS.find((m) => m.k === opts.model) || VIDEO_MODELS[0];
  const rating = imgRating(codeRating(parseCodes(k), c)), safe = rating === "safe";
  const job = MJOBS[id] = { t0: Date.now(), status: "보내는 중", progress: 0 };
  repaint();
  try {
    if (!hasRunwareKey()) throw { code: "no_key" };
    if (!ref) throw { code: "upstream_error", msg: "저장한 사진이 없어요" };
    if (!safe && (!ageOK() || minorHint(opts.prompt + "\n" + castLook(cast, c) + "\n" + keyName(k)))) throw { code: "minor_block" };
    const image = await photoData(ref);
    if (typeof image !== "string" || !/^data:image\//.test(image)) throw { code: "upstream_error", msg: "사진을 읽지 못했어요" };
    const task = { taskType: "videoInference", taskUUID: uuid4(), model: M.id, positivePrompt: String(opts.prompt || MOTION_PROMPT).slice(0, 1500),
      ...(M.neg ? { negativePrompt: "distorted face, extra limbs, morphing, flicker, text, watermark, " + NEG_MINOR } : {}),
      inputs: { frameImages: [{ image, frame: "first" }] }, resolution: M.res, duration: M.dur.includes(+opts.dur) ? +opts.dur : 5,
      outputType: "URL", outputFormat: "MP4", deliveryMethod: "async", includeCost: true, ...(safe ? { safety: { checkContent: true } } : {}), ...M.extra };
    let row = await rwTask(task);
    // 다 될 때까지 몇 초마다 물음(보통 30초~2분, 6분이 넘으면 멈춤). 같은 작업을 다시 보내면 또 청구되니 getResponse만
    job.status = "만드는 중"; repaint();
    await sleep(8000);
    while (!row || row.status !== "success") {
      if (Date.now() - job.t0 > 360000) throw { code: "timeout" };
      try { row = await rwTask({ taskType: "getResponse", taskUUID: task.taskUUID }); }
      catch (e) { if (e && (e.code === "network" || e.code === "timeout" || e.code === "rate_limited")) { row = null; } else throw e; }
      if (row && row.status === "error") throw { code: "upstream_error", msg: row.message || "" };
      if (row && typeof row.progress === "number") job.progress = row.progress; // 진행률은 스튜디오의 1초 타이머가 그림(다시 그리지 않음)
      if (!row || row.status !== "success") await sleep(Date.now() - job.t0 > 120000 ? 6000 : 4000);
    }
    if (safe && row.NSFWContent) throw { code: "blocked" };
    if (!row.videoURL) throw { code: "upstream_error", msg: "영상 주소 없음" };
    job.status = "받는 중"; repaint();
    let saved;
    try {
      const T = timeoutSignal(TIMEOUT.api * 3), blob = await (await fetch(row.videoURL, { signal: T.signal })).blob(); T.clear();
      if (!/^video\//.test(blob.type)) throw new Error("type");
      saved = await IMG.putVideo(blob);
    } catch (e) {
      if (e && e.code === "too_big") throw e;
      saved = { ref: row.videoURL, local: false, remote: true }; // 브라우저가 내려받기를 막음 → 임시 주소
    }
    // 기다리는 사이 사진이 바뀌었으면(지움·바꿈) 저장하지 않음
    if ((imagesOf(c)[cast.code] || {})[k] !== ref) { toast("사진이 바뀌어서 만든 움짤은 버렸어요"); return false; }
    putMotion(c, cast.code, k, saved.ref, { on: true, local: saved.local });
    toast(saved.remote ? `${cast.name} · ${keyName(k)} 움짤을 만들었어요 — Runware 임시 주소라 오래 두면 사라질 수 있어요` : `${cast.name} · ${keyName(k)} 움짤을 만들었어요${row.cost ? ` ($${(+row.cost).toFixed(3)})` : ""}${saved.local ? " — 커서 이 기기에만 저장" : ""}`);
    return true;
  } catch (e) {
    toast(motionErr(e));
    return false;
  } finally { delete MJOBS[id]; repaint(); }
}
export function motionErr(e) {
  if (e && e.code === "too_big") return "움짤이 너무 커서 저장하지 못했어요(이 브라우저는 IndexedDB를 쓸 수 없어요).";
  if (e && e.code === "timeout") return "움짤을 만드는 데 6분이 넘게 걸려 멈췄어요. 잠시 뒤 다시 해 보세요.";
  if (e && e.code === "blocked") return "안전 검사에 걸려 이 움짤은 쓰지 않았어요. 움직임 설명을 바꾸거나 다른 모델로 해 보세요.";
  return genErr(e).replace("이미지를 만들지 못했어요", "움짤을 만들지 못했어요");
}
/* 움짤 창: 모델·길이·움직임 설명을 고르고 만들기. 이 칸에 움짤이 있으면 미리 보기와 '움짤 지우기' */
export function motionSheet(c, cast, key, after) {
  const k = keyOf(String(key)), ref = (imagesOf(c)[cast.code] || {})[k], mo = motionOf(c, cast.code, k), M = VIDEO_MODELS.find((m) => m.k === MSTATE.model) || VIDEO_MODELS[0];
  const ov = document.createElement("div"); ov.className = "overlay gen-ov";
  ov.innerHTML = `<div class="sheet mo-sheet" role="dialog" aria-modal="true"><div class="sheet-head"><h2>움짤 만들기 <small>${esc(cast.name)} · ${esc(keyName(k))}</small></h2><button class="icon-btn" data-x aria-label="닫기">${ICON.close}</button></div>
    <div class="mo-prev"><figure><span class="pic">${IMG.tag(ref)}</span><figcaption>사진(첫 장면)</figcaption></figure>${mo ? `<figure><span class="pic">${IMG.vtag(mo.ref)}</span><figcaption>지금 움짤 · ${mo.on ? "켜짐" : "꺼짐(사진이 보임)"}</figcaption></figure>` : ""}</div>
    <p class="note">저장한 사진을 첫 장면으로 몇 초짜리 반복 영상을 만들어요(보통 30초~2분). 다 되면 이 칸의 움짤로 저장되고 켜져요 — 갤러리의 ⟳ 단추로 사진과 번갈아 쓸 수 있어요. 실패한 생성은 청구되지 않아요.${mo ? " 새로 만들면 지금 움짤은 바뀌어요." : ""}</p>
    <div class="two"><div class="field"><label for="moM">모델</label><select id="moM">${VIDEO_MODELS.map((m) => `<option value="${m.k}" ${m.k === M.k ? "selected" : ""}>${esc(m.name)} — ${esc(m.price)}</option>`).join("")}</select></div>
      <div class="field"><label for="moD">길이</label><select id="moD"></select></div></div>
    <div class="field"><label for="moP">움직임 설명 <span class="note">영어로 쓰면 더 정확해요</span></label><textarea id="moP" rows="3">${esc(MSTATE.prompt)}</textarea>
      <div class="cta-row" style="margin-top:6px"><button class="btn sm ghost" id="moReset">기본 설명으로</button></div></div>
    <div class="cta-row">${mo ? `<button class="btn danger" id="moDel">움짤 지우기</button>` : ""}<span class="spacer"></span><button class="btn ghost" data-x>취소</button><button class="btn pri" id="moGo" ${ref ? "" : "disabled"}>${mo ? "다시 만들기" : "만들기"}</button></div></div>`;
  document.body.append(ov); IMG.hydrate(ov);
  const close = () => ov.remove();
  ov.addEventListener("click", (e) => { if (e.target === ov || e.target.closest("[data-x]")) close(); });
  const durs = () => { const m = VIDEO_MODELS.find((x) => x.k === $("#moM", ov).value) || VIDEO_MODELS[0]; $("#moD", ov).innerHTML = m.dur.map((d) => `<option value="${d}" ${d === MSTATE.dur ? "selected" : ""}>${d}초</option>`).join(""); if (!m.dur.includes(MSTATE.dur)) $("#moD", ov).value = String(m.dur.includes(5) ? 5 : m.dur[0]); };
  durs();
  $("#moM", ov).onchange = durs;
  $("#moReset", ov).onclick = () => { $("#moP", ov).value = MOTION_PROMPT; };
  const del = $("#moDel", ov);
  if (del) del.onclick = () => { if (!del.dataset.sure) { del.dataset.sure = "1"; del.textContent = "한 번 더 누르면 지워요(사진은 그대로)"; return; } putMotion(c, cast.code, k, null); close(); after && after(); toast("움짤을 지웠어요 — 사진이 보여요"); };
  $("#moGo", ov).onclick = () => {
    Object.assign(MSTATE, { model: $("#moM", ov).value, dur: +$("#moD", ov).value, prompt: $("#moP", ov).value.trim() || MOTION_PROMPT });
    close();
    makeMotion(c, cast, k, MSTATE, () => after && after());
  };
}
