/* 그림체: 모델 목록·프리셋·세트(ZIP 가져오기, Claude가 그림체 태그 작성) */
import { CFG } from "../core/config.js";
import { S, hasClaudeKey } from "../core/state.js";
import { esc } from "../core/util.js";
import { refDataURL } from "./runware.js";
import { validRef } from "../services/images.js";

/* ---------------------------------------------------------------- AI 이미지 생성: Runware API (SDXL 계열 모델, Danbooru 영문 태그 프롬프트)
   이름·설명은 한국어. 모델은 영문 태그만 알아들으므로 한글(외모·키워드북·직접 쓴 그림체)은 보내기 직전 ponyTags()가 영문 태그로 바꿈 */
/* 이미지 모델(Runware AIR). arch마다 품질 태그·수위 태그·CFG가 다름. 모두 Runware에서 실제 생성 확인(2026-10) */
export const IMG_MODELS = [
  // 세미리얼은 CFG 7이면 인형처럼 인위적, 4.5면 표정을 안 따름 → 6 + 플라스틱·인형 피부 네거티브(2026-10·11 비교 생성으로 정함)
  { id: "civitai:548016@861939", name: "세미리얼 PonyXL (Run七八造 v2)", arch: "pony", cfg: 6, neg: "3d, cgi, plastic skin, doll, airbrushed, oversaturated, heavy makeup" },
  { id: "civitai:142601@686323", name: "한국 웹툰 PonyXL (ToonyStark)", arch: "pony" },
  { id: "civitai:827184@1761560", name: "애니 일러스트 (WAI Illustrious v14)", arch: "illustrious" },
  // Pony Diffusion V6 XL(Civitai 257749·버전 290640)은 Runware 자체 호스팅 ID "imagerouter:"로만 불러짐
  { id: "imagerouter:257749@290640", name: "Pony Diffusion V6 XL", arch: "pony", pos: "source_anime" }
];
export const ARCH = {
  pony: { pos: "score_9, score_8_up, score_7_up", neg: "score_4, score_5, score_6, source_pony, source_furry", cfg: 7 },
  illustrious: { pos: "masterpiece, best quality, amazing quality, very aesthetic, absurdres, newest", neg: "bad quality, worst quality, worst detail, sketch, lowres, jpeg artifacts", cfg: 6 }
};
export const imgModelInfo = (id) => IMG_MODELS.find((m) => m.id === id) || { id, name: id, arch: "pony" };
/* 그림체 프리셋: 모델 + 그림체 태그(그림체만 — 인물·구도·배경 태그를 넣으면 모든 그림이 그쪽으로 끌려감). 직접 입력·세트는 모델을 따로 고름 */
export const IMG_STYLES = {
  webtoon: { name: "한국 웹툰 · 세미리얼", desc: "동양적인 얼굴과 자연스러운 반실사 채색. 로맨스·일상 웹툰 표지 느낌", model: IMG_MODELS[0].id, tags: "korean, semi-realistic, natural lighting, soft shading, realistic skin texture, natural makeup, detailed eyes" },
  mature: { name: "성인 웹툰 · 글래머", desc: "성숙한 인물, 부드러운 피부 음영과 영화 같은 조명. 19금 웹툰 표지 느낌(수위는 따로 골라요)", model: IMG_MODELS[0].id, tags: "korean, mature, semi-realistic, glamorous, soft skin shading, realistic skin texture, cinematic lighting, bokeh" },
  line: { name: "한국 웹툰 · 선화", desc: "또렷한 선과 깔끔한 셀 채색. 연재 웹툰 컷 느낌", model: IMG_MODELS[1].id, tags: "korean webtoon, manhwa, clean lineart, soft cel shading" },
  anime: { name: "애니 일러스트", desc: "선명한 색과 반짝이는 눈. 게임·라이트노벨 일러스트 느낌", model: IMG_MODELS[2].id, tags: "illustration, beautiful detailed eyes, detailed face, glossy lips, shiny hair, rich colors, cinematic lighting, light particles, depth of field" },
  oriental: { name: "동양 판타지", desc: "평면 채색과 가는 선, 붉은색·금색 위주. 무협·동양풍 일러스트 느낌", model: IMG_MODELS[2].id, tags: "oriental fantasy, flat color, cel shading, thin clean lineart, limited palette, crimson and gold" },
  custom: { name: "직접 입력", desc: "그림체를 한국어로 적어도 돼요. 만들 때 영문 태그로 바꿔 보내요", model: null, tags: "" }
};
export const OLD_STYLES = { novel: "webtoon", none: "webtoon" };
 // 예전 프리셋 이름 → 지금 이름
/* 그림체 세트: 그림 3장 + 그림체 문구 + 모델(S.settings.styleSets). imgStyle이 "set:<id>"면 세트를 씀 */
export function activeSet() { const k = String(S.settings.imgStyle || ""); return k.startsWith("set:") ? (S.settings.styleSets || []).find((s) => "set:" + s.id === k) || null : null; }
function stylePreset() { return activeSet() ? null : IMG_STYLES[S.settings.imgStyle] || IMG_STYLES.webtoon; }
export function styleLabel() { const s = activeSet(); return s ? "세트 · " + s.name : stylePreset().name; }
export function imgStyleText() { const s = activeSet(); return (s ? s.prompt || "" : S.settings.imgStyle === "custom" ? S.settings.imgStyleCustom || "" : stylePreset().tags).trim(); }
/* 지금 그림체가 쓰는 모델: 프리셋은 고정, 세트·직접 입력은 고른 모델 */
export function imgModelId() { const s = activeSet(); return (s ? s.model : stylePreset().model) || S.settings.imgModel || IMG_MODELS[0].id; }
export function styleOptionsHTML() {
  const cur = S.settings.imgStyle;
  return [...Object.entries(IMG_STYLES).map(([k, p]) => [k, p.name]), ...(S.settings.styleSets || []).map((s) => ["set:" + s.id, "세트 · " + s.name])]
    .map(([k, l]) => `<option value="${esc(k)}" ${cur === k ? "selected" : ""}>${esc(l)}</option>`).join("");
}
/* 이름 앞부분이 같은 파일끼리(프롬1_…, 프롬2_…) 3장씩 묶음. 앞부분이 모두 다르면 이름 순서대로 3장씩 */
export function groupStyleFiles(files) {
  const base = (n) => n.replace(/\.[^.]+$/, ""), split = (n) => /^(.+?)[_\-\s.](.*)$/.exec(base(n));
  const sorted = [...files].sort((a, b) => base(a.name).localeCompare(base(b.name), "ko", { numeric: true }));
  const key = (n) => (split(n)?.[1] || base(n).replace(/\d+$/, "")).trim() || base(n);
  const map = new Map();
  for (const f of sorted) { const k = key(f.name); if (!map.has(k)) map.set(k, []); map.get(k).push(f); }
  let groups = [...map.entries()].map(([k, fs]) => ({ k, fs, plain: false }));
  if (sorted.length > 1 && groups.every((g) => g.fs.length === 1)) groups = [{ k: "세트", fs: sorted, plain: true }];
  const out = [];
  for (const g of groups) for (let i = 0; i < g.fs.length; i += 3) {
    const fs = g.fs.slice(i, i + 3), desc = (split(fs[0].name)?.[2] || "").replace(/\d+$/, "").trim();
    const name = g.plain ? `세트 ${out.length + 1}` : g.k + (g.fs.length > 3 ? ` (${i / 3 + 1})` : "") + (desc ? ` · ${desc}` : "");
    out.push({ name: name.slice(0, 30), files: fs });
  }
  return out;
}
/* 브라우저만으로 ZIP 안의 그림 꺼내기 (무압축·deflate, 파일 이름 UTF-8/EUC-KR) */
export async function unzipImages(file) {
  const buf = new Uint8Array(await file.arrayBuffer()), dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength), out = [];
  let e = buf.length - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error("zip");
  const count = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true);
  const dec = (bytes, utf) => { if (utf) return new TextDecoder().decode(bytes); try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { return new TextDecoder("euc-kr").decode(bytes); } };
  for (let i = 0; i < count && dv.getUint32(p, true) === 0x02014b50; i++) {
    const flags = dv.getUint16(p + 8, true), method = dv.getUint16(p + 10, true), size = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), lho = dv.getUint32(p + 42, true);
    const name = dec(buf.subarray(p + 46, p + 46 + nlen), flags & 0x800); p += 46 + nlen + xlen + clen;
    const short = name.split("/").pop();
    if (!/\.(png|jpe?g|webp)$/i.test(short) || /(^|\/)(__MACOSX|\.)/.test(name)) continue;
    const start = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true), data = buf.subarray(start, start + size);
    if (method === 8 && typeof DecompressionStream !== "function") throw { code: "nozip" };
    const bytes = method === 0 ? data : method === 8 ? new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer()) : null;
    if (bytes) out.push(new File([bytes], short, { type: /\.png$/i.test(short) ? "image/png" : /\.webp$/i.test(short) ? "image/webp" : "image/jpeg" }));
  }
  return out;
}
/* 세트 이름으로 미리 고르는 문구·모델(그림을 읽기 전) — '애니'면 애니 일러스트, 그 밖은 한국 웹툰 세미리얼 */
const animeName = (name) => /애니|anime|만화|셀/i.test(name);
export function guessStylePrompt(name) { return (animeName(name) ? IMG_STYLES.anime : IMG_STYLES.webtoon).tags; }
export function guessStyleModel(name) { return (animeName(name) ? IMG_STYLES.anime : IMG_STYLES.webtoon).model; }
/* 그림체 세트 그림을 Claude(Anthropic API 키·서버 프록시)에게 보여 주고 공통 화풍만 Pony용 영문 태그로 받아옴 */
export async function claudeStyleTags(refs) {
  if (!hasClaudeKey()) throw { code: "no_claude" };
  const content = [];
  for (const r of refs) {
    const d = validRef(r) && await refDataURL(r), m = typeof d === "string" && d.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/);
    if (m) content.push({ type: "image", source: { type: "base64", media_type: m[1], data: m[2] } });
  }
  if (!content.length) throw { code: "upstream_error", msg: "그림 없음" };
  content.push({ type: "text", text: `위 ${content.length}장은 한 그림체 세트다. SDXL 그림 모델(Pony·Illustrious)에 넣을 '그림체 태그'를 영문 Danbooru 태그로 써라.
- ${content.length}장에 공통된 화풍만: 그림 장르(korean webtoon·semi-realistic·anime illustration 등), 얼굴 표현 방식(동양적 이목구비·반실사 얼굴·애니풍 눈 등), 선, 채색 방식, 명암·하이라이트, 조명, 색감, 질감
- 구도·자세·배경·소품·옷·머리 모양과 색, 신체 특징·노출·성적 요소, 인물·작품·작가·서비스 이름, 그림 속 글자는 쓰지 않는다(그림마다 달라야 하는 내용이라 넣으면 모든 그림이 같아짐). score_·rating_·source_ 태그도 쓰지 않는다
- 소문자 태그 10~18개를 쉼표로만 이어 한 줄로. 설명 없이 태그만` });
  let res;
  try {
    res = await fetch(CFG.anthropicUrl, { method: "POST", headers: { "content-type": "application/json", "anthropic-version": "2023-06-01", ...(S.settings.apiKey ? { "x-api-key": S.settings.apiKey, "anthropic-dangerous-direct-browser-access": "true" } : {}) },
      body: JSON.stringify({ model: "claude-haiku-5-5", max_tokens: 400, messages: [{ role: "user", content }] }) });
  } catch { throw { code: "network" }; }
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw { code: res.status === 401 || res.status === 403 ? "bad_claude" : res.status === 429 ? "rate_limited" : "upstream_error", msg: j.error?.message || "" };
  const text = (j.content || []).map((x) => x.text || "").join("").replace(/\n+/g, ", ").replace(/["'`]/g, "").replace(/\s+/g, " ").trim();
  if (!text) throw { code: "blocked" };
  return text.slice(0, 600);
}
