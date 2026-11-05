/* 이미지 스튜디오의 그리기(관리자 빌드만): 조합 키를 Runware로 그려 결과 카드로 쌓거나(저장 전까지 화면에만, object URL) 바로 인물 그림 칸에 저장, 여러 장 차례로(멈추기 가능), 파일 이름으로 여러 장 올리기.
   수위는 코드 수위의 최대(codeRating → imgRating: 성인 확인 전엔 늘 전체이용가), 성인 수위면 태그 번역은 OpenRouter(Claude에는 보내지 않음 — images/tags.js).
   화풍은 설정의 그림체(자동이면 작품 성향·인물 성별)이고, 스튜디오에서 고른 화풍(ISTATE.style)은 S.settings.imgStyle을 잠깐 바꿔 styleFor로 읽고 되돌림(설정은 그대로) */
import { audOf } from "../core/audience.js";
import { castLook } from "../core/cast.js";
import { S, hasRunwareKey } from "../core/state.js";
import { esc, toast, uid } from "../core/util.js";
import { keyOf, parseCodes } from "../images/codes.js";
import { assertAdmin } from "../images/gen-guard.js";
import { putCastImage } from "../images/pick.js";
import { lookIsMale, partsTags, savedParts } from "../images/prompt.js";
import { RATINGS, imgRating } from "../images/rating.js";
import { genErr, runwareImage } from "../images/runware.js";
import { codeRating, keyName, knownCodes, slotNums } from "../images/situations.js";
import { styleFor } from "../images/styles.js";
import { IMG } from "../services/images.js";

/* 스튜디오 상태 — 화면을 떠나도 세션 동안 남음. acts는 고른 순서(조합엔 앞 MAX_ACT개), wear·place는 하나 또는 null, del은 코드 선택 삭제 모드일 때 고른 번호(Set) */
export const ISTATE = { work: "", cast: "", tab: "act", acts: [1], wear: null, place: null, aspect: "4:5", style: "", autoSave: false, prompt: false, closed: {}, results: [], busy: null, del: null };
const STOP_ON = ["admin_login", "admin_only", "no_key", "bad_key", "no_funds", "bad_model", "network", "rate_limited", "minor_block", "timeout"];

export const ctxOf = (c, cast) => ({ kind: "daily", aud: audOf(c), male: lookIsMale(castLook(cast, c)) });
export const keyRating = (c, key) => imgRating(codeRating(parseCodes(String(key)), c));
/* 스튜디오에서 고른 화풍(비면 설정대로) */
export function pickStyle(c, cast) {
  const ctx = ctxOf(c, cast);
  if (!ISTATE.style) return styleFor(ctx);
  const keep = S.settings.imgStyle; S.settings.imgStyle = ISTATE.style;
  try { return styleFor(ctx); } finally { S.settings.imgStyle = keep; }
}
/* 프롬프트 묶음을 읽기 좋은 글로(장면·추가·인물·의상·배경) */
export const promptText = (c, cast, key) => savedParts(c, cast, key).filter((p) => p.tags.length).map((p) => `${p.label}: ${p.tags.map((x) => x.strong ? `(${x.t}:1.3)` : x.t).join(", ")}`).join("\n");

/* 조합 키 하나를 그려 결과 하나로 */
async function draw(c, cast, key) {
  await assertAdmin(); // 태그 번역(사용자 키로 요금이 듦)보다 먼저 — runwareImage의 확인은 번역 뒤에 옴
  const rt = keyRating(c, key), st = pickStyle(c, cast), t0 = Date.now();
  const tags = await partsTags(savedParts(c, cast, key), rt !== "safe");
  const blob = await runwareImage(tags, { aspect: ISTATE.aspect, rating: rt, style: st });
  return { id: uid("is"), url: URL.createObjectURL(blob), blob, key, name: keyName(key), rating: rt, style: st.name, tags, sec: ((Date.now() - t0) / 1000).toFixed(1), c, code: cast.code, castName: cast.name, saved: false };
}
/* 결과를 그 인물의 그림 칸에 저장(같은 키의 예전 그림은 바뀜) */
export async function saveResult(r) { putCastImage(r.c, r.code, r.key, await IMG.put(r.blob)); r.saved = true; }
/* 조합 키들을 차례로 그림. save면(빈 칸 채우기·바로 저장) 그린 즉시 저장. 진행할 때마다 repaint(). 다시 부르면 멈춤 */
export async function runKeys(c, cast, keys, save, repaint) {
  if (ISTATE.busy) { ISTATE.busy.stop = true; return; }
  if (!hasRunwareKey()) { toast(genErr({ code: "no_key" })); return; }
  if (!keys.length) { toast("그릴 칸이 없어요"); return; }
  const busy = ISTATE.busy = { total: keys.length, done: 0, stop: false, code: cast.code, key: keys[0] }; repaint();
  let err = null, ok = 0;
  for (const k of keys) {
    if (busy.stop) break;
    busy.key = k; repaint();
    try { const r = await draw(c, cast, k); if (save) await saveResult(r); ISTATE.results.unshift(r); ok++; }
    catch (e) { err = e; if (STOP_ON.includes(e?.code)) break; }
    busy.done++;
  }
  ISTATE.busy = null; repaint();
  toast(`${ok}장 그렸어요${save && ok ? " · 저장함" : ""}${busy.stop ? " (멈춤)" : err ? ` · ${genErr(err)}` : ""}`);
}
/* 파일 이름 끝의 번호(2, ks_3, 3-404-501 …) → 조합 키. 모르는 번호가 섞였거나 슬롯이 아닌 두 자리 번호면 "" */
export function nameKey(name) {
  const base = String(name).replace(/\.[^.]+$/, "").toLowerCase(), m = base.match(/(\d{1,3}(?:[-,]\d{1,3})*)$/);
  const codes = m ? parseCodes(m[1].replace(/-/g, ",")) : [];
  if (!codes.length || knownCodes(codes).length !== codes.length || (codes.length === 1 && codes[0] < 100 && !slotNums().includes(codes[0]))) return "";
  return keyOf(codes);
}
/* 여러 장 올리기: 파일 이름으로 칸을 정해 그 인물에 저장 */
export async function uploadMany(c, code, files) {
  let ok = 0, skip = 0; toast(files.length + "장을 올리는 중…");
  for (const f of files) {
    const k = nameKey(f.name); if (!k) { skip++; continue; }
    try { putCastImage(c, code, k, await IMG.put(f)); ok++; } catch { skip++; }
  }
  toast(`${ok}장 등록${skip ? `, ${skip}장은 번호를 알 수 없어 건너뛰었어요` : ""}`);
}
/* 결과 카드 */
export function resultHTML(r) {
  return `<div class="ct-card" data-id="${r.id}"><div class="pic"><img src="${r.url}" alt="" data-lb="${r.id}"></div>
    <div class="cap"><b>${esc(r.castName)} · ${esc(r.name)}</b><span>${esc(r.key)} · ${RATINGS[r.rating].name} · ${esc(r.style)} · ${r.sec}초</span></div>
    <div class="bs"><button data-save="${r.id}" ${r.saved ? "disabled" : ""} title="이 인물의 그림 칸에 저장(대화에서 보임)">${r.saved ? "저장됨" : "저장"}</button><button data-tags="${r.id}">태그 복사</button><button data-del="${r.id}">빼기</button></div></div>`;
}
