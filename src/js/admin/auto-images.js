/* 대화 중 그림 자동 생성(관리자 빌드만): 한 턴의 응답이 끝나면(EXT.afterTurn) 이번 응답의 [[img]] 태그 가운데 그 조합(감정·의상·장소)의 그림이 아직 없는 것을
   Runware로 만들어 인물 그림(내 작품 images·그 밖은 imgpacks)에 저장하고, 화면에 보이는 그 자리(figure[data-code][data-key])를 바꿔 그린다.
   켜는 곳: 이미지 설정 '대화 중 장면 그림 자동 생성'(S.settings.autoImg). 한 응답에 최대 AUTO_MAX장, 같은 조합은 한 번만 — 있는 조합은 다시 만들지 않으므로
   같은 감정·의상·장소가 반복되면 요금이 들지 않음. claude.ai 안(IN_CLAUDE)·Runware 키 없음·장면 이미지 끔이면 하지 않음.
   수위는 번호들의 수위(codeRating → imgRating: 성인 확인 전엔 늘 전체이용가). 만든 그림은 '작품 폴더에 저장'(admin/export.js)으로 content/에 실을 수 있다 */
import { audOf } from "../core/audience.js";
import { castLook } from "../core/cast.js";
import { IN_CLAUDE } from "../core/config.js";
import { S, hasRunwareKey } from "../core/state.js";
import { $, $$, toast } from "../core/util.js";
import { imgTags, parseCodes } from "../images/codes.js";
import { hasImg, putCastImage } from "../images/pick.js";
import { lookIsMale, partsTags, savedParts } from "../images/prompt.js";
import { imgRating } from "../images/rating.js";
import { genErr, runwareImage } from "../images/runware.js";
import { codeRating } from "../images/situations.js";
import { styleFor } from "../images/styles.js";
import { IMG } from "../services/images.js";
import { figInner, figKey, lightbox } from "../ui/cover.js";
import { EXT } from "../ui/ext.js";

const AUTO_MAX = 4, autoBusy = new Set();
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
EXT.afterTurn.push((r, body) => { autoImages(r, body).catch(() => {}); });
