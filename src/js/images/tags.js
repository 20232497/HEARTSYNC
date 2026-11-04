/* 한글 → Danbooru 영문 태그 번역(ponyTags·koTags)과 캐시(TAGS) */
import { ageOK } from "../ai/adult.js";
import { llm, waitEngine } from "../ai/llm.js";
import { OR_TAG_MODELS } from "../ai/models.js";
import { openRouterStream } from "../ai/openrouter.js";
import { S, hasOpenRouterKey } from "../core/state.js";
import { KV } from "../core/storage.js";
import { TAGS } from "./tags-cache.js";

const hasHangul = (t) => /[가-힣]/.test(t);
/* 프롬프트 → Pony용 영문 태그. 영문 태그 조각은 그대로 두고, 한글이 든 조각만(이어진 것끼리 묶어) koTags()로 번역 */
export async function ponyTags(text, adult = false) {
  const t = String(text || "").trim();
  if (!t || !hasHangul(t)) return t;
  const out = []; let buf = [];
  const flush = async () => { if (buf.length) { out.push(await koTags(buf.join(", "), adult)); buf = []; } };
  for (const part of t.split(/\s*,\s*/).filter(Boolean)) { if (hasHangul(part)) buf.push(part); else { await flush(); out.push(part); } }
  await flush();
  return out.filter(Boolean).join(", ");
}
/* 한글 설명 → 영문 Danbooru 태그(TAGS에 캐시해 같은 글은 한 번만). Claude로 번역하고, Claude 연결이 없거나 실패하면 OpenRouter 키로 한 번 더,
   그것도 안 되면 한글 낱말만 빼고 보냄. 성인 수위 그림(adult)은 처음부터 OpenRouter로(Claude에는 노출 태그 지시를 보내지 않음). 캐시 TAGS는 tags-cache.js */
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
