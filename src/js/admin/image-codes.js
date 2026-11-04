/* 이미지 스튜디오의 코드 목록(관리자 빌드만): 감정·행동 / 의상 / 장소 세 갈래를 번호대별 묶음으로 나누고, 고른 인물에게 그 코드의 그림이 몇 장 있는지 함께 보여 준다.
   묶음 — 감정·행동: 기본 0~14 · 직접 만든 칸 15~99 · 100번대 · 200번대 · 300번대 / 의상 4xx / 장소 5xx(400·500은 '설정대로 되돌리기'라 뺌).
   보이는 코드는 codeDefs()(성인 확인 전엔 전체이용가만) — 내 칸 > 작품 폴더 코드 표 > 관리자 전용 > 내장 순으로 같은 번호를 덮은 결과 */
import { SIT } from "../core/constants.js";
import { esc } from "../core/util.js";
import { DIM_NAMES, RESET, parseCodes } from "../images/codes.js";
import { RATINGS } from "../images/rating.js";
import { codeDefs } from "../images/situations.js";
import { validRef } from "../services/images.js";

/* 감정·행동 번호대 묶음(이름은 번호대만 — 묶음의 뜻은 관리자가 만든 칸 이름으로 드러남) */
const ACT_BANDS = [[0, SIT.length, "기본 감정 0~14", "모든 작품의 기본 칸 — 첫 등장은 0, 그림이 없을 때는 1·0으로 대신해요"], [SIT.length, 100, "직접 만든 칸 15~99"], [100, 200, "100번대"], [200, 300, "200번대"], [300, 400, "300번대"]];
/* 갈래(act·wear·place) → 묶음 [{id, name, hint, items: [{n, name, prompt, rating, src, edit}]}] */
export function codeGroups(dim) {
  const defs = codeDefs().filter((d) => d.dim === dim && d.n !== RESET.wear && d.n !== RESET.place);
  const src = (d) => d.builtin ? "내장" : d.adminOnly ? "관리자" : d.shipped ? "실림" : "내 칸";
  const item = (d) => ({ n: d.n, name: d.name, prompt: d.prompt || "", rating: d.rating || "safe", src: src(d), def: d });
  if (dim !== "act") return [{ id: dim, name: DIM_NAMES[dim] + (dim === "wear" ? " 4xx" : " 5xx"), hint: dim === "wear" ? "감정 번호 뒤에 붙여 옷을 바꿔요" : "감정 번호 뒤에 붙여 배경을 바꿔요", items: defs.map(item) }];
  const base = SIT.map((name, n) => ({ n, name, prompt: "", rating: "safe", src: "기본", def: null }));
  return ACT_BANDS.map(([a, b, name, hint], i) => ({ id: "act" + i, name, hint: hint || "", items: i === 0 ? base : defs.filter((d) => d.n >= a && d.n < b).map(item) })).filter((g) => g.items.length);
}
/* 인물 한 명의 그림 칸({조합 키: 참조})에서 번호마다: 그 번호 하나짜리 그림이 있는지(exact)와 그 번호가 든 그림 수(count) */
export function codeStats(slots) {
  const st = {};
  for (const k of Object.keys(slots || {})) {
    if (!validRef(slots[k])) continue;
    const codes = parseCodes(k);
    for (const n of codes) { const s = st[n] || (st[n] = { exact: false, count: 0 }); s.count++; if (codes.length === 1) s.exact = true; }
  }
  return st;
}
/* 그 갈래에서 보이는 코드 수 */
export const dimCount = (dim) => codeGroups(dim).reduce((a, g) => a + g.items.length, 0);
/* 묶음 하나의 HTML. on(n)은 지금 조합에 든 번호인지, closed면 접힘, st는 codeStats 결과 */
export function groupHTML(g, on, closed, st) {
  const filled = g.items.filter((d) => (st[d.n] || {}).exact).length;
  return `<div class="is-group${closed ? " closed" : ""}" data-group="${g.id}">
    <div class="is-gh"><button class="is-fold" data-fold="${g.id}" aria-expanded="${!closed}"><b>${esc(g.name)}</b><small>${g.items.length}개 · 그림 ${filled}</small></button>
      ${g.items.length > filled ? `<button class="btn sm ghost" data-fill="${g.id}" title="이 묶음에서 그림이 없는 코드를 하나씩 AI로 그려 저장">빈 칸 ${g.items.length - filled}개 채우기</button>` : ""}</div>
    ${g.hint ? `<p class="note is-hint">${esc(g.hint)}</p>` : ""}
    <div class="is-rows">${g.items.map((d) => rowHTML(d, on(d.n), st[d.n])).join("")}</div></div>`;
}
function rowHTML(d, on, s) {
  const adult = d.rating !== "safe";
  return `<div class="is-code${on ? " on" : ""}${adult ? " adult" : ""}${s && s.exact ? " filled" : ""}" data-row="${d.n}" data-find="${esc((d.n + " " + d.name).toLowerCase())}">
    <button class="is-pick" data-pick="${d.n}" title="${esc(d.prompt || d.name)}"><span class="num">${d.n}</span><span class="nm">${esc(d.name)}</span>${adult ? `<span class="rt">${RATINGS[d.rating] ? esc(RATINGS[d.rating].name) : "성인"}</span>` : ""}${d.src !== "기본" && d.src !== "내장" ? `<span class="src">${d.src}</span>` : ""}</button>
    <span class="cnt" title="이 인물의 그림 중 이 번호가 든 것">${s ? s.count + "장" : ""}</span>
    ${d.src === "기본" ? "" : `<button class="is-ed" data-edit="${d.n}" aria-label="${esc(d.name)} 고치기" title="이름·프롬프트·수위 고치기">✎</button>`}</div>`;
}
