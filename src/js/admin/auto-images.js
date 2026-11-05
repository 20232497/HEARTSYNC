/* 대화 중 그림 자동 생성(관리자 빌드만): 한 턴의 응답이 끝나면(EXT.afterTurn) 이번 응답의 [[img]] 태그 가운데 그 조합(감정·의상·장소)의 그림이 아직 없는 것을
   Runware로 만들어 인물 그림(내 작품 images·그 밖은 imgpacks)에 저장하고, 화면에 보이는 그 자리(figure[data-code][data-key])를 바꿔 그린다.
   켜는 곳: 이미지 설정 '대화 중 장면 그림 자동 생성'(S.settings.autoImg). 한 응답에 최대 AUTO_MAX장, 같은 조합은 한 번만 — 있는 조합은 다시 만들지 않으므로
   같은 감정·의상·장소가 반복되면 요금이 들지 않음. claude.ai 안(IN_CLAUDE)·Runware 키 없음·장면 이미지 끔이면 하지 않음.
   수위는 번호들의 수위(codeRating → imgRating: 성인 확인 전엔 늘 전체이용가). 만든 그림은 '작품 폴더에 저장'(admin/export.js)으로 content/에 실을 수 있다.
   그림이 끝나면 장면 움짤(autoMotions — 이미지 설정 '장면 움짤도 자동으로', S.settings.autoMotion, 기본 꺼짐): 영상 모델은 사진을 첫 장면으로 쓰므로 그림이 있는 칸만,
   번호대 100~500(admin/motion-prompts.js wantsVideo)이 든 칸 가운데 전체이용가만(motionSafe — 세미·성인 수위 코드에는 자동으로 걸지 않음).
   한 응답에 최대 AUTO_MOTION_MAX개, 가장 싼 모델로 5초. 움짤이 이미 있는 칸(꺼 둔 것도)과 이번 세션에 시도한 칸은 다시 만들지 않음 */
import { audOf } from "../core/audience.js";
import { castLook } from "../core/cast.js";
import { IN_CLAUDE } from "../core/config.js";
import { S, hasRunwareKey, room } from "../core/state.js";
import { $, $$, toast } from "../core/util.js";
import { imgTags, parseCodes } from "../images/codes.js";
import { genAccess } from "../images/gen-guard.js";
import { motionOf } from "../images/motion.js";
import { hasImg, pickKey, putCastImage } from "../images/pick.js";
import { lookIsMale, partsTags, savedParts } from "../images/prompt.js";
import { imgRating } from "../images/rating.js";
import { genErr, runwareImage } from "../images/runware.js";
import { codeRating } from "../images/situations.js";
import { styleFor } from "../images/styles.js";
import { IMG } from "../services/images.js";
import { figInner, figKey, lightbox, showOf, zoomPic } from "../ui/cover.js";
import { EXT } from "../ui/ext.js";
import { wantsVideo } from "./motion-prompts.js";
import { MJOBS, VIDEO_MODELS, jobId, makeMotion, motionPromptOf, motionSafe } from "./motion-run.js";

const AUTO_MAX = 4, autoBusy = new Set();
export const AUTO_MOTION_MAX = 2;
const motionTried = new Set();
let autoDenied = false; // 권한 없음 안내를 이미 띄웠는지 — 턴마다 되풀이하지 않음
export const autoImgOn = () => !!S.settings.autoImg && !IN_CLAUDE && hasRunwareKey() && S.settings.sceneImg !== false;
const figsOf = (code, key) => $$(`#logInner figure.scene-img[data-code="${code}"][data-key="${key}"]`).filter((f) => !$("img", f));
export async function autoImages(r, body) {
  if (!autoImgOn()) return;
  const c = r.char, jobs = [];
  for (const t of imgTags(body)) {
    const cast = (c.cast || []).find((x) => x.code === t.code); if (!cast) continue;
    const key = figKey(t.codes.join(",")), id = `${c.id}|${t.code}|${key}`;
    if (autoBusy.has(id) || jobs.some((j) => j.id === id) || hasImg(c, t.code, key)) continue;
    jobs.push({ id, cast, key, codes: parseCodes(key) });
  }
  if (!jobs.length) return;
  // 태그 번역(사용자 키로 요금이 듦)·생성 전에 관리자 확인 — 관리자가 아니면 아무것도 보내지 않고 한 번만 알림
  const access = await genAccess();
  if (!access.ok) { if (!autoDenied) toast("장면 그림을 만들지 못했어요 · " + genErr(access)); autoDenied = true; return; }
  autoDenied = false;
  let err = null;
  await Promise.all(jobs.slice(0, AUTO_MAX).map(async (j) => {
    autoBusy.add(j.id); figsOf(j.cast.code, j.key).forEach((f) => f.classList.add("gen"));
    try {
      const rt = imgRating(codeRating(j.codes, c)), adult = rt !== "safe";
      const style = styleFor({ kind: "daily", aud: audOf(c), male: lookIsMale(castLook(j.cast, c)) }); // 기본 화풍(자동): 작품 성향 → 인물 성별
      const ref = await IMG.put(await runwareImage(await partsTags(savedParts(c, j.cast, j.key), adult), { aspect: "4:5", rating: rt, style }));
      putCastImage(c, j.cast.code, j.key, ref);
      figsOf(j.cast.code, j.key).forEach((f) => { f.innerHTML = figInner(c, j.cast, j.key, ref); IMG.hydrate(f); $$("img", f).forEach((im) => im.onclick = () => lightbox(im.src)); });
    } catch (e) { err = e; }
    finally { autoBusy.delete(j.id); figsOf(j.cast.code, j.key).forEach((f) => f.classList.remove("gen")); }
  }));
  if (err && err.code !== "cancelled") toast("장면 그림을 만들지 못했어요 · " + genErr(err));
}
export const autoMotionOn = () => !!S.settings.autoMotion && !IN_CLAUDE && hasRunwareKey() && S.settings.sceneImg !== false;
/* 움짤이 다 되면 지금 방에서 그 칸을 보여 주는 자리(폴백 포함)를 바꿔 그림. 다른 작품의 방으로 옮겼으면 같은 인물 코드라도 그 방의 그림이 아니니 건드리지 않음 */
function paintMotionFigs(c, cast, pk) {
  if (!room || room.char.id !== c.id) return;
  $$(`#logInner figure.scene-img[data-code="${cast.code}"]`).filter((f) => pickKey(c, cast.code, f.dataset.key) === pk).forEach((f) => {
    const s = showOf(c, cast.code, f.dataset.key);
    f.innerHTML = figInner(c, cast, f.dataset.key, s.ref, s.mo); IMG.hydrate(f);
    f.onclick = (e) => { if (e.target.closest("img, video")) zoomPic(f); };
  });
}
export async function autoMotions(r, body) {
  if (!autoMotionOn()) return;
  const c = r.char, jobs = [];
  for (const t of imgTags(body)) {
    const cast = (c.cast || []).find((x) => x.code === t.code); if (!cast) continue;
    const pk = pickKey(c, t.code, figKey(t.codes.join(","))); if (pk === null) continue; // 조합 그림이 없으면 대화에서 대신 보이는 칸(폴백 1·0은 번호대 밖이라 아래에서 걸러짐)
    const codes = parseCodes(pk), id = jobId(c, t.code, pk);
    if (!wantsVideo(codes) || !motionSafe(codes, c)) continue;
    if (motionTried.has(id) || MJOBS[id] || motionOf(c, t.code, pk) || jobs.some((j) => j.id === id)) continue;
    jobs.push({ id, cast, pk });
  }
  if (!jobs.length) return;
  const access = await genAccess();
  if (!access.ok) { if (!autoDenied) toast("장면 움짤을 만들지 못했어요 · " + genErr(access)); autoDenied = true; return; }
  autoDenied = false;
  await Promise.all(jobs.slice(0, AUTO_MOTION_MAX).map(async (j) => {
    motionTried.add(j.id);
    if (await makeMotion(c, j.cast, j.pk, { model: VIDEO_MODELS[0].k, dur: 5, prompt: motionPromptOf(c, j.cast, j.pk) })) paintMotionFigs(c, j.cast, j.pk);
  }));
}
EXT.afterTurn.push((r, body) => { autoImages(r, body).catch(() => {}).then(() => autoMotions(r, body)).catch(() => {}); });
