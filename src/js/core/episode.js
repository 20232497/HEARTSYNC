/* 에피소드 진행 장치(순수 — 화면·저장과 무관): 작품의 episode(장·사건·결말)와 방의 진행 상태 r.ep로 이번 응답에 줄 지시(epPlan), 응답 뒤 다음 상태(epAfter), 갈림길 고르기(epPick), 결말 판정(epEnding).
   '언제'는 앱이, '어떻게'는 AI가: 장마다 기간 at [a, b] — a턴 전에는 서두르지 않고, a~b 사이에는 흐름이 닿으면, b턴에는 반드시 매듭. AI는 상태 JSON의 _ep.done으로 목표를 이뤘는지 알림(안 알려도 b턴에 넘어감).
   사건은 조건(최근 글에 낱말 keys가 나옴·게이지 gauge)이 맞을 때, 조건 없는 사건은 EP.quiet턴 동안 사건이 없었을 때 — 한 턴에 하나, 한 번씩. 갈림길을 고르지 않고 EP.wait턴이 지나면 기본 보기.
   결말은 마지막 장이 끝나면 위에서부터 조건(갈림길·게이지·본 사건)이 맞는 첫 결말 — 마지막 결말은 조건이 없는 기본 결말(빌드가 검사). 결말을 정한 다음 응답이 결말 장면이고, 그 뒤 방은 끝남(over) */
/** @typedef {import("./types.js").Episode} Episode */
/** @typedef {import("./types.js").EpState} EpState */
/** @typedef {import("./types.js").EpPlan} EpPlan */

/** 게이지 조건의 모양: "<50"·">=60"(비교 기호 + 0~999) — 사건의 gauge·결말의 when.gauge. 빌드 검사도 이것으로(APP_RULES) */
export const GAUGE_COND_RE = /^(<=|>=|<|>)\s*(\d{1,3})$/;
/** quiet: 조건 없는 사건이 나오기 전에 사건 없이 지나야 하는 턴 수 · wait: 갈림길에서 고르지 않을 때 기다려 주는 턴 수(지나면 기본 보기) */
export const EP = { quiet: 3, wait: 2 };

/** 게이지 값이 조건에 맞는지 — 조건 모양이 틀리거나 값이 숫자가 아니면 거짓. @param {string} cond @param {unknown} v @returns {boolean} */
export function gaugeOK(cond, v) {
  const m = GAUGE_COND_RE.exec(String(cond || "").trim());
  if (!m || typeof v !== "number") return false;
  const n = +m[2];
  return m[1] === "<" ? v < n : m[1] === "<=" ? v <= n : m[1] === ">" ? v > n : v >= n;
}
/** 새 에피소드 방의 진행 상태(core/rooms.js newRoom). @returns {EpState} */
export function epInit() { return { t: 0, beat: 0, picks: {}, seen: [], ask: "", askAt: 0, evAt: 0, end: "", over: false }; }
const copy = (st) => JSON.parse(JSON.stringify(st));
/** 갈림길 id로 그 갈림길. @param {Episode} ep @param {string} id */
export function choiceOf(ep, id) { for (const b of ep.beats) if (b.choice && b.choice.id === id) return b.choice; return null; }
const fallbackOpt = (ch) => (ch.options.find((o) => o.default) || ch.options[0]).id;
/** 결말 판정 — 위에서부터 조건이 모두 맞는 첫 결말, 없으면 마지막(기본) 결말. @param {Episode} ep @param {EpState} st @param {unknown} gauge @returns {import("./types.js").EpEnding} */
export function epEnding(ep, st, gauge) {
  const ok = (w) => (!w.choice || Object.keys(w.choice).every((k) => st.picks[k] === w.choice[k]))
    && (w.gauge === undefined || gaugeOK(w.gauge, gauge))
    && (!w.events || w.events.every((id) => st.seen.indexOf(id) >= 0));
  return ep.endings.find((e) => !e.when || ok(e.when)) || ep.endings[ep.endings.length - 1];
}
function pickEvent(ep, st, turn, recent, gauge) {
  const b = ep.beats[st.beat], text = String(recent || "");
  const open = (ep.events || []).filter((e) => st.seen.indexOf(e.id) < 0 && (!e.beat || e.beat === b.id));
  const hit = open.find((e) => (e.keys && e.keys.some((k) => text.indexOf(k) >= 0)) || (e.gauge !== undefined && gaugeOK(e.gauge, gauge)));
  if (hit) return hit;
  return turn - st.evAt >= EP.quiet && turn >= b.at[0] ? open.find((e) => !e.keys && e.gauge === undefined) || null : null;
}
/**
 * 이번 응답에 줄 지시(상태는 바꾸지 않음). 프롬프트(ai/prompt/rules.js)가 글로 옮기고, 응답이 끝나면 같은 것을 epAfter에 넘김.
 * @param {Episode} ep @param {EpState} st @param {string} recent 최근 글(직전 응답 + 이번 유저 입력 — 사건의 낱말을 찾는 곳) @param {unknown} gauge 지금 게이지
 * @returns {EpPlan}
 */
export function epPlan(ep, st, recent, gauge) {
  const turn = st.t + 1, out = { turn, n: st.beat + 1, beat: null, phase: "", event: null, ask: null, ending: null };
  if (st.over) return out;
  if (st.end) { out.ending = ep.endings.find((e) => e.id === st.end) || null; return out; }
  const b = ep.beats[st.beat]; if (!b) return out;
  out.beat = b;
  if (st.ask) { out.ask = choiceOf(ep, st.ask); return out; } // 갈림길 앞에서는 새 사건을 넣지 않음
  out.phase = turn >= b.at[1] ? "due" : turn >= b.at[0] ? "open" : "early";
  out.event = pickEvent(ep, st, turn, recent, gauge);
  return out;
}
function advance(ep, st, gauge) {
  st.beat += 1;
  if (st.beat >= ep.beats.length) st.end = epEnding(ep, st, gauge).id;
}
function choose(ep, st, id, gauge) { st.picks[st.ask] = id; st.ask = ""; advance(ep, st, gauge); }
/**
 * 응답 하나가 끝난 뒤의 상태(새 객체). 결말을 정해 둔 상태였으면 이번 응답이 결말 장면 → 끝(over).
 * @param {Episode} ep @param {EpState} st0 응답 전 상태 @param {EpPlan} plan 이 응답 전에 epPlan이 준 것 @param {{ done?: boolean, pick?: string }|undefined} rep AI가 알린 _ep @param {unknown} gauge 응답 뒤의 게이지
 * @returns {EpState}
 */
export function epAfter(ep, st0, plan, rep, gauge) {
  const st = copy(st0), turn = st.t + 1;
  if (st.over) return st;
  st.t = turn;
  if (st.end) { st.over = true; return st; }
  if (plan && plan.event) { st.seen.push(plan.event.id); st.evAt = turn; }
  if (st.ask) {
    const ch = choiceOf(ep, st.ask), pick = rep && rep.pick;
    const id = !ch ? "" : ch.options.some((o) => o.id === pick) ? pick : turn - st.askAt >= EP.wait ? fallbackOpt(ch) : "";
    if (id) choose(ep, st, id, gauge);
    return st;
  }
  const b = ep.beats[st.beat];
  if (b && ((rep && rep.done && turn >= b.at[0]) || turn >= b.at[1])) {
    if (b.choice) { st.ask = b.choice.id; st.askAt = turn; } else advance(ep, st, gauge);
  }
  return st;
}
/** 갈림길 카드를 눌렀을 때 — 그 보기를 고르고 다음 장으로(마지막 장이면 결말을 정함). 맞지 않는 보기면 그대로. 새 객체. @param {Episode} ep @param {EpState} st0 @param {string} id 보기 id @param {unknown} gauge @returns {EpState} */
export function epPick(ep, st0, id, gauge) {
  const st = copy(st0), ch = st.ask ? choiceOf(ep, st.ask) : null;
  if (ch && ch.options.some((o) => o.id === id)) choose(ep, st, id, gauge);
  return st;
}
/**
 * 외전(끝난 에피소드를 이어받는 자유 대화 — core/rooms.js sideRoom, 2026-11-11 사용자 결정)의 갈래 — 표는 여기 한 곳(화면·방 제목·프롬프트·첫 추천이 같이 씀).
 * 적힌 순서가 고르는 화면의 순서이고 첫째가 기본. 인물 중심 둘이 먼저(사용자 결정 '외전은 인물과의 추가 대화와 다른 인물의 시각에서 사건을 보는 이야기 위주로').
 * who: 인물을 골라야 하는지 · label·desc: 고르는 화면 · title(n): 방 제목 · line(n): 프롬프트 고정부 [외전]의 지시 · sug(n): 첫 추천(// 연출 지시 — LIMITS.suggestion자 이내).
 * 인물 이름 뒤에는 조사가 갈리지 않게 '의'·'에게'만 씀(docs/app/chat.md '화면 이동·예시 문구').
 */
export const SIDE = {
  talk: { who: true, label: "그 인물과 더 이야기하기", desc: "결말 뒤, 고른 인물과 단둘이 못다 한 이야기를 나눠요",
    title: (n) => `외전 · ${n}의 이야기`,
    line: (n) => `결말 뒤, ${n}의 곁에서 단둘이 이어 가는 대화다. 이 인물은 에피소드에서 함께 겪은 일과 유저가 고른 길, 결말을 모두 기억하고, 그 일로 달라진 마음에서 말을 건다. 새 사건을 크게 벌이기보다 두 사람의 대화·감정·관계에 집중한다 — 그때 하지 못한 말, 숨겼던 속내, 앞으로의 약속. 다른 인물은 필요할 때만 잠깐 나오고, 대사와 속마음(💭)은 ${n}의 것을 중심으로 쓴다.`,
    sug: (n) => [`// 결말 뒤, ${n}의 곁에 다시 마주 앉는다`, `// ${n}에게 그때 하지 못한 말을 꺼낸다`, `// ${n}의 속내 — 왜 그때 그랬는지 묻는다`] },
  pov: { who: true, label: "그 인물의 눈으로 다시 보기", desc: "같은 사건을 그 인물의 시점에서 — 그때 느낀 것과 숨긴 사정",
    title: (n) => `외전 · ${n}의 시점`,
    line: (n) => `에피소드의 사건을 처음부터 ${n}의 시점으로 다시 본다. 아래 '있었던 일'의 순서를 따라 한 장면씩, 유저가 겪은 장면을 ${n}의 눈으로 다시 그리고 유저가 보지 못한 곳(${n}만 있던 자리·혼자 남은 밤·남몰래 한 선택)을 채운다. 서술의 중심은 이 인물의 내면 — 그때의 감정, 말하지 못한 사정, 유저를 어떻게 보았는지. 일어난 일과 결말은 바꾸지 않는다. 유저는 그대로 유저 캐릭터로 참여하고, 유저의 입력은 그 장면 속 행동이나 ${n}에게 건네는 말로 받는다.`,
    sug: (n) => [`// ${n}의 시점 — 유저를 처음 본 날`, `// ${n}의 시점 — 갈림길의 그 순간`, `// ${n}의 밤 — 결말 그날, 혼자 남아`] },
  after: { who: false, label: "결말 뒤의 이야기", desc: "결말이 남긴 것에서 모두의 그 뒤를 이어 가요",
    title: () => "외전 · 결말 뒤",
    line: () => "결말 뒤의 시간을 그린다. 결말이 남긴 것(상처·약속·달라진 관계)에서 출발해 유저와 인물들의 그 뒤를 이어 간다.",
    sug: () => ["// 며칠이 지난 아침에서 시작", "// 결말 그날 밤, 모두가 흩어진 뒤", "// 한 계절이 지나 다시 만난다"] }
};
/** 에피소드의 대략 분량(마지막 장의 마감 턴) — 상세 페이지·목록의 '약 n턴'. @param {Episode} ep @returns {number} */
export const epLength = (ep) => ep.beats[ep.beats.length - 1].at[1];
