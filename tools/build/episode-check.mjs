// 작품 검사 — 에피소드형 작품의 진행표(work.js episode): 장·갈림길과 보기·사건·결말과 그 조건. checkWork가 부름(시험은 tests/unit/content-check.test.mjs의 EP_RULES)
import { isObj, str } from "./common.mjs";

/* 에피소드형 작품의 진행표(work.js episode — 앱은 src/js/core/episode.js가 읽음, 모양은 core/types.js Episode).
   id(장·갈림길·보기·사건·결말)는 시작 상황 id와 같은 모양(OPENING_ID_RE), 같은 종류 안에서 겹치지 않게. 장의 기간 at [a, b]는 1 ≤ a ≤ b, 장의 시작 a는 앞 장보다 늦거나 같게.
   결말은 2~8개, 마지막만 조건(when) 없는 기본 결말(가운데에 조건 없는 결말이 있으면 뒤의 결말에 닿을 수 없음). when의 갈림길·보기·사건은 있는 것만 */
export function checkEpisode(ep, e, R) {
  const at = "episode",
    ID = R.OPENING_ID_RE,
    idOk = (v) => typeof v === "string" && ID.test(v),
    arr = (v) => (Array.isArray(v) ? v : []);
  const idMsg = (where, v) => `${where}.id${v === undefined ? "가 없어요" : `("${v}")가 모양에 안 맞아요`} — 영문 소문자로 시작하는 소문자·숫자·하이픈 2~24자`;
  if (!isObj(ep)) return e(`${at}는 { beats: [장…], events?: [사건…], endings: [결말…] } 모양이어야 해요`);
  const beats = arr(ep.beats),
    events = arr(ep.events),
    ends = arr(ep.endings),
    choices = new Map(),
    dup = (list, what) => {
      const seen = new Set();
      list.forEach((x) => {
        if (isObj(x) && typeof x.id === "string") {
          if (seen.has(x.id)) e(`${at}: ${what} id "${x.id}"가 겹쳐요`);
          seen.add(x.id);
        }
      });
    };
  if (beats.length < 2 || beats.length > 8) e(`${at}.beats(장)는 2~8개예요(지금 ${beats.length}개)`);
  let prevA = 0;
  beats.forEach((b, i) => {
    const w = `${at}.beats[${i}]`;
    if (!isObj(b) || !str(b.title) || !str(b.goal))
      return e(`${w}: { id, title(장 제목), goal(이 장의 목표 — AI에게 주는 글), at: [시작 턴, 마감 턴], choice? } 모양이어야 해요`);
    if (!idOk(b.id)) e(idMsg(w, b.id));
    if (b.goal.length > 300) e(`${w}.goal이 ${b.goal.length}자예요 — 300자 이내`);
    const [a, z] = Array.isArray(b.at) ? b.at : [];
    if (!(Array.isArray(b.at) && b.at.length === 2 && Number.isInteger(a) && Number.isInteger(z) && a >= 1 && z >= a && z <= 120))
      e(`${w}.at은 [시작 턴, 마감 턴] — 1 ≤ 시작 ≤ 마감 ≤ 120인 정수 둘`);
    else {
      if (a < prevA) e(`${w}.at의 시작(${a})이 앞 장의 시작(${prevA})보다 빨라요 — 장은 차례로 열려요`);
      prevA = a;
    }
    if (b.choice === undefined) return;
    const ch = b.choice,
      opts = isObj(ch) ? arr(ch.options) : [];
    if (!isObj(ch) || !str(ch.ask) || ch.ask.length > 60) return e(`${w}.choice는 { id, ask(60자 이내의 물음), options: [{ id, label, default? } 2~4개] }`);
    if (!idOk(ch.id)) e(idMsg(`${w}.choice`, ch.id));
    else if (choices.has(ch.id)) e(`${at}: 갈림길 id "${ch.id}"가 겹쳐요`);
    else choices.set(ch.id, new Set());
    if (opts.length < 2 || opts.length > 4) e(`${w}.choice.options(보기)는 2~4개예요`);
    opts.forEach((o, j) => {
      if (!isObj(o) || !str(o.label) || o.label.length > R.LIMITS.suggestion)
        return e(`${w}.choice.options[${j}]: { id, label(${R.LIMITS.suggestion}자 이내 — 카드에 보이고 누르면 유저의 말로 보내짐), default? }`);
      if (!idOk(o.id)) e(idMsg(`${w}.choice.options[${j}]`, o.id));
      else if (choices.has(ch.id)) {
        if (choices.get(ch.id).has(o.id)) e(`${w}.choice: 보기 id "${o.id}"가 겹쳐요`);
        choices.get(ch.id).add(o.id);
      }
      if (o.default !== undefined && o.default !== true) e(`${w}.choice.options[${j}].default는 true만(기본 보기 하나에)`);
    });
    if (opts.filter((o) => isObj(o) && o.default).length > 1) e(`${w}.choice: 기본 보기(default)는 하나만`);
  });
  dup(beats, "장");
  const beatIds = new Set(beats.filter(isObj).map((b) => b.id));
  if (ep.events !== undefined && !Array.isArray(ep.events)) e(`${at}.events는 사건 배열`);
  if (events.length > 20) e(`${at}.events(사건)는 20개까지`);
  events.forEach((x, i) => {
    const w = `${at}.events[${i}]`;
    if (!isObj(x) || !str(x.title) || !str(x.text) || x.text.length > 300)
      return e(`${w}: { id, title(화면의 사건 띠), text(AI에게 주는 지시, 300자 이내), beat?, keys?, gauge? }`);
    if (!idOk(x.id)) e(idMsg(w, x.id));
    if (x.beat !== undefined && !beatIds.has(x.beat)) e(`${w}.beat("${x.beat}")는 beats의 장 id여야 해요`);
    if (x.keys !== undefined && (!Array.isArray(x.keys) || !x.keys.length || x.keys.some((k) => !str(k))))
      e(`${w}.keys는 낱말 배열(최근 글에 나오면 사건이 일어남)`);
    if (x.gauge !== undefined && !R.GAUGE_COND_RE.test(String(x.gauge))) e(`${w}.gauge("${x.gauge}")는 "<50"·">=80" 같은 게이지 조건`);
  });
  dup(events, "사건");
  const evIds = new Set(events.filter(isObj).map((x) => x.id));
  if (ends.length < 2 || ends.length > 8) e(`${at}.endings(결말)는 2~8개예요(지금 ${ends.length}개)`);
  ends.forEach((x, i) => {
    const w = `${at}.endings[${i}]`,
      last = i === ends.length - 1;
    if (!isObj(x) || !str(x.title) || !str(x.brief) || x.brief.length > R.LIMITS.lead)
      return e(`${w}: { id, title(결말 이름), brief(결말 장면에서 AI에게 주는 줄거리, ${R.LIMITS.lead}자 이내), when? }`);
    if (!idOk(x.id)) e(idMsg(w, x.id));
    if (last && x.when !== undefined) return e(`${w}(마지막 결말)에는 when을 쓰지 않아요 — 다른 결말의 조건이 하나도 맞지 않을 때 가는 기본 결말이에요`);
    if (last) return;
    const c = x.when;
    if (!isObj(c) || !(c.choice || c.gauge !== undefined || c.events))
      return e(`${w}.when이 필요해요 — { choice?: { 갈림길 id: 보기 id }, gauge?: "<50", events?: [사건 id] } 중 하나 이상(조건 없는 결말은 맨 마지막 하나만)`);
    if (c.choice !== undefined) {
      if (!isObj(c.choice) || !Object.keys(c.choice).length) e(`${w}.when.choice는 { 갈림길 id: 보기 id }`);
      else
        Object.keys(c.choice).forEach((k) => {
          if (!choices.has(k)) e(`${w}.when.choice: 갈림길 "${k}"가 없어요`);
          else if (!choices.get(k).has(c.choice[k])) e(`${w}.when.choice: 갈림길 "${k}"에 보기 "${c.choice[k]}"가 없어요`);
        });
    }
    if (c.gauge !== undefined && !R.GAUGE_COND_RE.test(String(c.gauge))) e(`${w}.when.gauge("${c.gauge}")는 "<50"·">=80" 같은 게이지 조건`);
    if (c.events !== undefined && (!Array.isArray(c.events) || c.events.some((id) => !evIds.has(id)))) e(`${w}.when.events는 events의 사건 id 배열`);
  });
  dup(ends, "결말");
}
