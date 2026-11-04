/* 관리자 빌드의 설정 이전(migrateImageSettings): 그림체·이미지 모델·그림체 세트의 예전 값을 지금 모양으로. boot({ migrate })로 넘겨 core/migrate 뒤에 돈다 */
import { saveSettings } from "../core/settings.js";
import { S } from "../core/state.js";
import { BAD_IMG_MODELS } from "../images/runware.js";
import { IMG_MODELS, IMG_STYLES, OLD_STYLES, builtinSet, guessStyleModel, guessStylePrompt } from "../images/styles.js";
import { IMG } from "../services/images.js";

export function migrateImageSettings(saved) {
  let moved = false;
  try {
    // 그림체를 아직 고른 적 없는 이전 설정은 웹소설 표지 세미리얼로 한 번 옮김
    if (saved && !saved.styleV2 && (!saved.imgStyle || saved.imgStyle === "none")) { S.settings.imgStyle = "novel"; moved = true; }
    // Gemini → Runware: 다른 서비스의 키는 옮기지 않고 지우고, Runware 모델(AIR id)이 아니면 기본 모델로
    if ("geminiKey" in S.settings) { delete S.settings.geminiKey; moved = true; }
    if (!/^[a-z][a-z0-9-]*:\d+@\d+$/i.test(String(S.settings.imgModel || "")) || BAD_IMG_MODELS.includes(S.settings.imgModel)) { S.settings.imgModel = IMG_MODELS[0].id; moved = true; }
    // 그림체: 예전 프리셋 이름은 새 이름으로, 세트에는 모델을 붙이고, 예전 기본 문구(인물·구도 태그가 섞인 것)는 새 그림체 문구로
    let st = S.settings.imgStyle;
    if (OLD_STYLES[st]) { st = S.settings.imgStyle = OLD_STYLES[st]; moved = true; }
    // 기본 화풍(2026-11-03): 예전 기본값(webtoon)을 그대로 쓰던 설정은 한 번 '자동'으로(직접 고른 다른 프리셋·세트는 그대로)
    if (!S.settings.styleV3) { if (st === "webtoon") st = S.settings.imgStyle = "auto"; S.settings.styleV3 = true; moved = true; }
    if (st !== "auto" && !(String(st).startsWith("sys:") && builtinSet(String(st).slice(4))) && !String(st).startsWith("set:") && !IMG_STYLES[st]) { S.settings.imgStyle = "auto"; moved = true; }
    S.settings.styleSets.forEach((x) => {
      if (x.overrides && !builtinSet(x.overrides)) { delete x.overrides; moved = true; }
      if (!x.model || BAD_IMG_MODELS.includes(x.model)) { x.model = guessStyleModel(x.name); moved = true; }
      // 예전 기본 문구(인물·구도 태그가 섞인 것, 인위적인 세미리얼 문구)는 지금 문구로
      if (/^(anime coloring, cel shading, sharp lineart|semi-realistic, 2\.5d, detailed face, porcelain skin|korean, semi-realistic, 2\.5d, detailed face, pale skin)/.test(x.prompt || "")) { x.prompt = guessStylePrompt(x.name); moved = true; }
      // 첫 애니 문구의 colorful(무지개 머리)·vivid colors("VIVID" 글자) → 지금 문구로
      if (/^illustration, beautiful detailed eyes, .*\b(colorful|vivid colors)\b/.test(x.prompt || "")) { x.prompt = guessStylePrompt(x.name); moved = true; }
    });
    // 따로 올렸던 '참고 그림'은 Runware(글로만 그림)에서 쓸 곳이 없어 저장 공간만 차지하므로 한 번 정리(그림체 세트 그림은 유지)
    if (S.settings.styleRefs.length) { S.settings.styleRefs.forEach((r) => IMG.drop(r)); S.settings.styleRefs = []; moved = true; }
  } catch {}
  if (moved) saveSettings();
}
