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
const NO_BANGS_RE = /(^|[^a-z])(?:forehead|parted bangs|swept bangs|side-swept bangs|curtain bangs|no bangs|slicked back hair|hair slicked back)\b/i;
const DARK_SKIN_RE = /(^|[^a-z])(?:dark skin|tanned skin|tan skin|brown skin)\b/i;
/* 그림체 {prompt, coolPrompt?, blackTag?, bangs?, bangsNeg?, neg?}와 내용 태그 → 실제로 쓸 {prompt, neg}.
   차가운 머리색(검정·은발·회색·흰색)은 피부를 더 하얗게 하는 coolPrompt, 그중 검정만 blackTag로 머리색을 진하게(은발이 검어지지 않게) */
export function fitStyle(st, tags) {
  const t = String(tags || "");
  let prompt = st.prompt || "", neg = st.neg || "";
  if (st.coolPrompt) {
    if (BLACK_HAIR_RE.test(t)) prompt = st.coolPrompt + (st.blackTag ? ", " + st.blackTag : "");
    else if (PALE_HAIR_RE.test(t)) prompt = st.coolPrompt;
  }
  if (st.bangs && NO_BANGS_RE.test(t)) { prompt = prompt.replace(st.bangs + ", ", ""); neg = splitTop(neg).filter((n) => !splitTop(st.bangsNeg).includes(n)).join(", "); }
  if (DARK_SKIN_RE.test(t)) prompt = splitTop(prompt).filter((x) => !/(?:pale|fair|white) skin/.test(x)).join(", ");
  return { prompt, neg: dropNegConflicts(neg, t) };
}
