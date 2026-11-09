/* 응답 파싱: 본문/상태창 나누기(splitReply), 끊긴 JSON 고치기, 다인원 칸 합치기, 입력 되풀이 제거(dropEcho) */
import { MARK } from "../core/constants.js";
import { clamp } from "../core/util.js";
/** @typedef {import("../core/types.js").StatusMap} StatusMap */
/** @typedef {import("../core/types.js").Work} Work */

export function looseJSON(t) {
  try { return JSON.parse(t); } catch {}
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch {} }
  return undefined;
}
/* 모델이 유저 입력을 본문 첫 줄에 다시 옮겨 적으면(조금 바꿔 쓴 것 포함, 글자 2개씩 묶어 70% 이상 같으면) 그 줄을 뺌 */
/** @param {string} body 응답 본문 @param {string} said 직전 유저 입력 @returns {string} */
export function dropEcho(body, said) {
  const m = /^\s*([^\n]+)\n/.exec(body); if (!m || !said) return body;
  const norm = (s) => s.replace(/[\s*"“”'‘’.,!?…~]/g, ""), a = norm(m[1]), b = norm(said);
  if (a.length < 6 || b.length < 6 || a.length > b.length * 1.3 + 4) return body;
  const grams = (s) => { const g = new Set(); for (let i = 0; i < s.length - 1; i++) g.add(s.slice(i, i + 2)); return g; };
  const ga = grams(a), gb = grams(b); let hit = 0; ga.forEach((g) => { if (gb.has(g)) hit++; });
  return hit / ga.size >= 0.7 ? body.slice(m[0].length).replace(/^\s+/, "") : body;
}
/* 응답 나누기: 본문 / 상태 JSON. 구분자가 변형("=== STATE ===")되거나 빠진 채 JSON(또는 ```json)만 붙어도 찾아냄 */
/** @param {string} t 응답 전체 @returns {{ body: string, json: string }} 본문과 상태 JSON 글(없으면 "") */
export function splitReply(t) {
  t = String(t || "");
  let i = t.indexOf(MARK), len = MARK.length;
  if (i < 0) { const m = /\n[ \t]*={2,}[ \t]*STATE[ \t]*={2,}[ \t]*/i.exec(t); if (m) { i = m.index; len = m[0].length; } }
  if (i < 0) { const m = /\n[ \t]*(?:```(?:json)?\s*)?\{\s*"status"\s*:/.exec(t); if (m) { i = m.index; len = 0; } }
  if (i < 0) return { body: t, json: "" };
  // JSON 뒤에 붙은 장면 그림 태그([[HSY3]]·예전 [[img:ks:0]])는 본문으로 옮김(일부 모델이 맨 끝에 씀)
  const json = t.slice(i + len), late = json.match(/\[\[[A-Za-z0-9:,]+\]\]/g) || [];
  return { body: t.slice(0, i) + (late.length ? "\n\n" + late.join("\n") : ""), json: late.length ? json.replace(/\*?\[\[[A-Za-z0-9:,]+\]\]\*?/g, "") : json };
}
/* 토큰 한도 등으로 중간에 끊긴 JSON 복구: 열린 문자열·괄호를 닫고, 값 없이 끝난 키나 쉼표는 버림 */
function repairJSON(s) {
  const a = s.indexOf("{"); if (a < 0) return "";
  let out = "", str = false, esc = false; const st = [];
  for (const ch of s.slice(a)) {
    out += ch;
    if (str) { if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === '"') str = false; continue; }
    if (ch === '"') str = true;
    else if (ch === "{" || ch === "[") st.push(ch === "{" ? "}" : "]");
    else if (ch === "}" || ch === "]") { st.pop(); if (!st.length) return out; }
  }
  if (str) out += '"';
  // 객체 안에서 값 없이 끝난 키("키" 또는 "키":)는 버림. 배열 안 끝 문자열은 값이니 살림
  if (st[st.length - 1] === "}") out = out.replace(/([,{])\s*"[^"]*"\s*:?\s*$/, "$1");
  out = out.replace(/,\s*$/, "").replace(/:\s*$/, ': ""');
  while (st.length) out += st.pop();
  return out;
}
/* "이화 5 · 설련 0" 같은 여러 인물 수치 칸 읽기 (문자열 또는 {"이화": 5}) */
/** @param {unknown} v "이름 n · 이름 n" 문자열 또는 { 이름: n } @param {boolean} [strict=true] 이름에 숫자가 아닌 글자가 있어야 짝으로 봄 @returns {Array<[string, number]>} */
export function multiPairs(v, strict = true) {
  if (v && typeof v === "object" && !Array.isArray(v)) return Object.entries(v).map(([k, n]) => [String(k).trim(), Number(n)]).filter(([k, n]) => k && Number.isFinite(n));
  if (typeof v !== "string") return [];
  const out = [];
  for (const p of v.split(/\s*[·,|/]\s*/).filter(Boolean)) {
    const m = (strict ? /^(.+?)\s*[:：]?\s*(-?\d+)\s*$/ : /^(.+?)\s*[:：]?\s*(-?\d+)/).exec(p.trim());
    // 이름에 숫자가 아닌 글자가 있어야 인물 수치("60/100"을 "6 0 · 1 0"으로 읽던 문제)
    if (m && /[^\d\s.+%-]/.test(m[1])) out.push([m[1].trim(), Number(m[2])]); else if (strict) return [];
  }
  return out;
}
/* 여러 인물 수치 합치기: 빠진 인물은 직전 값 유지, 한 사람당 한 턴 -10~+8, 0~100. 직전 값이 그런 형식이 아니면 null */
function mergeMulti(prev, next) {
  const a = multiPairs(prev); if (a.length < 2) return null;
  const b = new Map(multiPairs(next, false)), seen = new Set();
  const res = a.map(([k, pv]) => { seen.add(k); const nv = b.get(k); return [k, Number.isFinite(nv) ? clamp(Math.round(clamp(nv, pv - 10, pv + 8)), 0, 100) : pv]; });
  for (const [k, nv] of b) if (!seen.has(k) && res.length < 12) res.push([k, clamp(Math.round(nv), 0, 100)]);
  return res.map(([k, n]) => `${k} ${n}`).join(" · ");
}
/* 상태 값으로 객체·배열이 오면 표시용 문자열로 */
function flatValue(o) { const p = multiPairs(o); return (p.length ? p.map(([k, n]) => `${k} ${n}`).join(" · ") : Array.isArray(o) ? o.join(", ") : JSON.stringify(o)).slice(0, 200); }
/**
 * 응답에서 상태창·추천 답변 읽기 — 빈 값은 직전 값 유지, 게이지는 한 턴에 -10~+8, 다인원 칸은 빠진 인물을 직전 값으로.
 * @param {string} text 응답 전체 @param {Work} c @param {StatusMap} [before] 직전 상태창
 * @returns {{ status: StatusMap, suggestions: string[] }}
 */
export function parseState(text, c, before) {
  const out = { status: { ...(before || {}) }, suggestions: [] };
  const { json } = splitReply(text);
  if (!json) return out;
  let v = looseJSON(json);
  if (!v || typeof v !== "object") v = looseJSON(repairJSON(json));
  if (!v || typeof v !== "object") return out;
  // "status"로 감싸지 않고 항목을 바로 쓴 응답도 받아 줌
  const st = v.status && typeof v.status === "object" ? v.status : c.fields.some((f) => f in v) ? v : null;
  if (st) {
    for (const f of c.fields) {
      const nv = st[f]; if (nv === undefined || nv === null || nv === "") continue;
      out.status[f] = mergeMulti(before?.[f], nv) ?? (typeof nv === "string" ? nv.slice(0, 200) : typeof nv === "object" ? flatValue(nv) : nv);
    }
    if (typeof before?.[c.gauge] === "number") {
      const g = Number(st[c.gauge]), prev = before[c.gauge];
      out.status[c.gauge] = Number.isFinite(g) ? clamp(Math.round(clamp(g, prev - 10, prev + 8)), 0, 100) : prev;
    }
  }
  if (Array.isArray(v.suggestions)) out.suggestions = v.suggestions.filter((s) => typeof s === "string").map((s) => s.replace(/^\s*\d+[.)]\s*/, "").slice(0, 80)).filter(Boolean).slice(0, 3);
  return out;
}
