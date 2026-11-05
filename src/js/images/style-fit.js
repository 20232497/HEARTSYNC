/* 내장 화풍을 그릴 내용(인물·장면 태그)에 맞추기: 머리색으로 피부·색조 문구 고르기, 앞머리 없는 인물은 앞머리 태그 빼기, 내용에 있는 것은 네거티브에서 빼기. 순수 함수 — tests/unit/style-fit.test.mjs */
const bare = (t) => String(t).toLowerCase().replace(/^\((.+):\d(?:\.\d+)?\)$/, "$1").trim();
const has = (text, word) => new RegExp("(^|[^a-z0-9])" + word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "($|[^a-z0-9])").test(text);
/* 괄호 안 쉼표는 나누지 않음 — "(3d, cgi, doll:1.2)" 같은 묶음 */
function splitTop(s) {
  const out = []; let depth = 0, cur = "";
  for (const ch of String(s || "")) {
    if (ch === "(") depth++; else if (ch === ")") depth--;
    if (ch === "," && depth === 0) { out.push(cur); cur = ""; } else cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}
/* 내용에 있는 것을 네거티브에서 뺌: 귀걸이·올림머리를 설정한 인물은 그대로 그리게. 묶음은 그대로 둠 */
export function dropNegConflicts(neg, tags) {
  const text = String(tags || "").toLowerCase();
  return splitTop(neg).filter((n) => { const b = bare(n); return b.includes(",") || !has(text, b); }).join(", ");
}
const BLACK_HAIR_RE = /(^|[^a-z])(?:black|dark) hair\b/i;
const PALE_HAIR_RE = /(^|[^a-z])(?:silver|grey|gray|white|ash) hair\b/i;
// 애쉬·플래티넘 금발은 paleTag가 있는 화풍(여성향 일상)에서만 옅은 머리로 침 — 남성향 일상의 머리색별 문구는 그대로
const ASH_BLOND_RE = /(^|[^a-z])(?:ash|platinum)[- ]blond(?:e)? hair\b/i;
const NO_BANGS_RE = /(^|[^a-z])(?:forehead|parted bangs|swept bangs|side-swept bangs|curtain bangs|no bangs|slicked back hair|hair slicked back)\b/i;
const DARK_SKIN_RE = /(^|[^a-z])(?:dark skin|tanned skin|tan skin|brown skin)\b/i;
/* 인물·장면 태그에 가중치를 줌(st.contentWeight, 표정 태그는 st.exprWeight — 없으면 그대로): 화풍 태그의 가중치가 크면(1.2~1.5) 가중치 없는 인물의 옷·머리·표정이 묻힘(여성향 일상 — 2026-11-06 작품 인물로 확인).
   인원·성별·배경 자리 태그와 이미 가중치가 있는 태그, 쉼표 없는 이모티콘(:d)과 괄호가 든 태그는 그대로.
   표정 태그를 내용 가중치만큼 올리면 입이 과하게 벌어지고 얼굴이 굳어 인위적으로 나옴(fd61). 시선 중 looking at viewer는 정면을 돕는 구도 태그라 내용 가중치를 그대로 받음 */
const EXPRESSION_RE = /\b(?:smil(?:e|ing)|smirk|grin|laugh(?:ing)?|giggling|happy|sad|angry|annoyed|irritated|flustered|nervous|worried|scared|surprised|shocked|shy|embarrassed|relieved|wistful|wary|despair|pleased|peaceful|calm|focused|determined|relaxed|drowsy|excited|moved|drunk|mischievous|playful|jealous|exhausted|injured|blush|blushing|tears?|crying|teary|frown|pout|sigh|yawning|expressionless|sweat|sweatdrop|wink|squinting|glaring)\b|(?:expression|gaze|glance|stare|mouth|lips|brow|eyebrows)$|(?:closed|half-lidded|half-closed|wide|narrowed|empty|sad|downturned|puppy|unfocused) eyes$|^looking (?!at viewer)/i;
const NO_WEIGHT_RE = /^(?:\d*boys?|\d*girls?|male focus|solo|no humans|animal focus|simple background|detailed background)$/i;
export function weighTags(tags, w, ew) {
  if (!w) return String(tags || "");
  return splitTop(tags).map((t) => {
    if (t.startsWith(":") || t.includes("(") || NO_WEIGHT_RE.test(t)) return t;
    if (EXPRESSION_RE.test(t)) return ew ? `(${t}:${ew})` : t;
    return `(${t}:${w})`;
  }).join(", ");
}
/* 그림체 {prompt, coolPrompt?, blackTag?, paleTag?, bangs?, bangsNeg?, fits?, neg?}와 내용 태그 → 실제로 쓸 {prompt, neg}.
   차가운 머리색(검정·은발·회색·흰색)은 피부를 더 하얗게 하는 coolPrompt, 그중 검정만 blackTag로 머리색을 진하게(은발이 검어지지 않게) */
export function fitStyle(st, tags) {
  const t = String(tags || "");
  let prompt = st.prompt || "", neg = st.neg || "";
  if (st.coolPrompt) {
    if (BLACK_HAIR_RE.test(t)) prompt = st.coolPrompt + (st.blackTag ? ", " + st.blackTag : "");
    else if (PALE_HAIR_RE.test(t) || (st.paleTag && ASH_BLOND_RE.test(t))) prompt = st.coolPrompt + (st.paleTag ? ", " + st.paleTag : "");
  }
  if (st.bangs && NO_BANGS_RE.test(t)) { prompt = prompt.replace(st.bangs + ", ", ""); neg = splitTop(neg).filter((n) => !splitTop(st.bangsNeg).includes(n)).join(", "); }
  if (DARK_SKIN_RE.test(t)) prompt = splitTop(prompt).filter((x) => !/(?:pale|fair|white) skin/.test(x)).join(", ");
  // 화풍이 정한 조건(st.fits): 내용이 when에 맞으면 태그 묶음을 빼거나(drop) 바꾸고(swap) 앞에 더하고(put) 네거티브를 뺌(negDrop) — 내용이 정한 머리 모양·표정·구도를 화풍이 덮지 않게
  for (const r of st.fits || []) {
    if (!r.when.test(t)) continue;
    for (const block of r.drop || []) prompt = prompt.includes(block + ", ") ? prompt.replace(block + ", ", "") : prompt.replace(", " + block, "");
    if (r.swap) prompt = prompt.replace(r.swap[0], r.swap[1]);
    if (r.put) prompt = r.put + ", " + prompt;
    if (r.negDrop) neg = splitTop(neg).filter((n) => !r.negDrop.includes(n)).join(", ");
  }
  return { prompt, neg: dropNegConflicts(neg, t) };
}
