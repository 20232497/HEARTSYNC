// 에피소드(core/episode.js — 장·사건·갈림길·결말을 앱이 정하는 순수 엔진)와 외전(core/rooms.js sideRoom), 프롬프트에 들어가는 자리(ai/prompt/rules.js)
// 작품의 실제 에피소드에 기대지 않게 시험용 에피소드를 씀
import { test } from "node:test";
import assert from "node:assert/strict";
import { rulesParts } from "../../src/js/ai/prompt/rules.js";
import { ORIGINALS } from "../../src/js/content/index.js";
import { EP, SIDE, epAfter, epEnding, epInit, epLength, epPick, epPlan } from "../../src/js/core/episode.js";
import { newRoom, sideRoom } from "../../src/js/core/rooms.js";

const EPI = {
  beats: [
    { id: "one", title: "하나", goal: "첫 장 목표", at: [2, 4] },
    { id: "two", title: "둘", goal: "둘째 장 목표", at: [5, 8], choice: { id: "way", ask: "어느 길로?", options: [{ id: "left", label: "왼쪽" }, { id: "right", label: "오른쪽", default: true }] } },
    { id: "three", title: "셋", goal: "마지막 장 목표", at: [9, 10] }
  ],
  events: [
    { id: "kw", title: "낱말 사건", text: "불이 번진다", keys: ["불"] },
    { id: "danger", title: "위험 사건", text: "자객", gauge: ">=80" },
    { id: "quiet", title: "조용한 사건", text: "편지가 온다", beat: "one" }
  ],
  endings: [
    { id: "doom", title: "파멸", brief: "파멸 줄거리", when: { gauge: ">=95" } },
    { id: "left-end", title: "왼쪽 끝", brief: "왼쪽 줄거리", when: { choice: { way: "left" } } },
    { id: "plain", title: "기본 끝", brief: "기본 줄거리" }
  ]
};
/** 한 턴: 응답 전 계획 → 응답 뒤 상태(앱이 하는 순서 그대로) */
const turn = (st, rep, gauge = 40, recent = "") => { const plan = epPlan(EPI, st, recent, gauge); return { plan, st: epAfter(EPI, st, plan, rep, gauge) }; };
/** 갈림길 앞까지: 첫 장은 2턴째에, 둘째 장은 5턴째에 AI가 '이뤘다'고 알림 */
const toChoice = () => { let st = epInit(); for (let i = 1; i <= 5; i++) st = turn(st, { done: i === 2 || i === 5 }).st; return st; };

test("장의 시간: 시작 턴 전에는 '이뤘다'를 받아도 그대로, 시작 턴부터는 받으면 넘어가고, 마감 턴에는 받지 않아도 넘어감", () => {
  let st = epInit();
  assert.equal(epPlan(EPI, st, "", 40).phase, "early");
  st = turn(st, { done: true }).st; assert.equal(st.beat, 0, "1턴(시작 턴 2 전)");
  assert.equal(epPlan(EPI, st, "", 40).phase, "open");
  st = turn(st, { done: true }).st; assert.equal(st.beat, 1, "2턴에 이뤘다");
  let s2 = epInit(); for (let i = 1; i <= 3; i++) s2 = turn(s2, {}).st;
  assert.equal(s2.beat, 0); assert.equal(epPlan(EPI, s2, "", 40).phase, "due");
  s2 = turn(s2, {}).st; assert.equal(s2.beat, 1, "마감 턴 4에 저절로");
  assert.equal(epLength(EPI), 10);
});
test("사건: 낱말·게이지가 맞으면 바로, 조건 없는 사건은 EP.quiet턴 조용할 때 — 한 번씩, 장이 맞을 때만", () => {
  const st = epInit();
  assert.equal(epPlan(EPI, st, "", 40).event, null);
  assert.equal(epPlan(EPI, st, "창고에 불이 붙었다", 40).event.id, "kw");
  assert.equal(epPlan(EPI, st, "", 85).event.id, "danger");
  let s = st; for (let i = 1; i < EP.quiet; i++) s = turn(s, {}).st;
  const r = turn(s, {}); assert.equal(r.plan.event.id, "quiet", EP.quiet + "턴째에 조용한 사건");
  assert.deepEqual(r.st.seen, ["quiet"]); assert.equal(r.st.evAt, EP.quiet);
  assert.equal(epPlan(EPI, { ...r.st, beat: 1 }, "", 40).event, null, "beat가 다른 장이면 안 일어남(이미 본 것도)");
  const k = turn(st, {}, 40, "불"); assert.equal(turn(k.st, {}, 40, "또 불").plan.event, null, "같은 사건은 한 번만");
});
test("갈림길: 장 목표를 이루면 묻고(사건 없이), AI가 알린 보기·카드로 고르거나, EP.wait턴 뒤에는 기본 보기", () => {
  const st = toChoice();
  assert.equal(st.ask, "way"); assert.equal(st.beat, 1);
  const p = epPlan(EPI, st, "불", 99); assert.equal(p.ask.id, "way"); assert.equal(p.event, null);
  assert.equal(turn(st, { pick: "nope" }).st.ask, "way", "없는 보기는 무시");
  const byAi = turn(st, { pick: "left" }).st; assert.deepEqual([byAi.ask, byAi.beat, byAi.picks.way], ["", 2, "left"]);
  const byCard = epPick(EPI, st, "left"); assert.deepEqual([byCard.beat, byCard.picks.way], [2, "left"]); assert.equal(st.ask, "way", "원래 상태는 그대로");
  assert.equal(epPick(EPI, st, "nope").ask, "way");
  let w = st; for (let i = 1; i < EP.wait; i++) { w = turn(w, {}).st; assert.equal(w.ask, "way"); }
  w = turn(w, {}).st; assert.equal(w.picks.way, "right", "기본 보기(default)");
});
test("결말: 마지막 장이 끝날 때 정하고(위에서부터 맞는 첫 결말, 없으면 마지막), 다음 응답이 결말 장면 → 끝", () => {
  const run = (pick, gauge) => { let s = epPick(EPI, toChoice(), pick); while (!s.end) s = turn(s, {}, gauge).st; return s; };
  assert.equal(run("left", 40).end, "left-end");
  assert.equal(run("right", 40).end, "plain");
  assert.equal(run("left", 99).end, "doom", "게이지 조건이 위에 있으면 먼저");
  const s = run("left", 40), p = epPlan(EPI, s, "", 40);
  assert.equal(p.ending.id, "left-end"); assert.equal(p.event, null);
  const over = epAfter(EPI, s, p, {}, 40); assert.equal(over.over, true);
  assert.deepEqual(epAfter(EPI, over, epPlan(EPI, over, "", 40), {}, 40), over, "끝난 뒤에는 그대로");
  assert.equal(epEnding(EPI, { ...epInit(), picks: {}, seen: [] }, 40).id, "plain");
});

const P = { id: "p1", name: "지호", memo: "", desc: "" };
const epRoom = () => { const c = JSON.parse(JSON.stringify(ORIGINALS[0])); c.episode = JSON.parse(JSON.stringify(EPI)); return newRoom(c, 0, P); };
test("외전: 끝난 에피소드 방만 — 대화를 그대로 이어받고 진행 상태는 버린 자유 대화방, 갈래마다 제목·첫 추천", () => {
  const r = epRoom();
  assert.ok(r.ep && !r.ep.over, "에피소드 작품의 새 방에는 진행 상태");
  assert.equal(sideRoom(r, "after"), null, "끝나지 않은 방");
  r.ep = { ...r.ep, end: "plain", over: true };
  r.msgs.push({ id: "u1", role: "user", text: "끝" }, { id: "a1", role: "ai", idx: 0, alts: [{ text: "결말 장면", status: r.status, suggestions: [] }], statusBefore: r.status });
  const who = r.char.cast[0], f = sideRoom(r, "pov", who.code);
  assert.equal(sideRoom(r, "pov", ""), null, "인물이 필요한 갈래");
  assert.ok(f && f.id !== r.id);
  assert.equal(f.ep, undefined); assert.equal(f.forkedFrom, undefined);
  assert.deepEqual(f.side, { kind: "pov", who: who.code, from: r.id, ending: "plain", endTitle: "기본 끝", picks: {}, seen: [] });
  assert.equal(Object.keys(SIDE)[0], "talk", "인물과 더 이야기하기가 기본(첫째)");
  assert.equal(f.sideAfter, "a1"); assert.equal(f.msgs.length, r.msgs.length);
  assert.equal(f.opening, SIDE.pov.title(who.name));
  assert.deepEqual(f.msgs[f.msgs.length - 1].alts[0].suggestions, SIDE.pov.sug(who.name));
  assert.ok(r.ep.over && !r.side, "원래 방은 그대로");
  const a = sideRoom(r, "after"); assert.equal(a.opening, SIDE.after.title("")); assert.equal(a.side.who, undefined);
});
test("프롬프트: 에피소드 방은 고정부에 장 목록(진행이 바뀌어도 그대로), 변동부에 [에피소드 진행], 꼬리에 _ep — 외전 방은 고정부에 [외전]만", () => {
  const r = epRoom(), a = rulesParts(r);
  assert.ok(a.fixed.includes("[에피소드 — 끝이 있는 이야기]") && a.fixed.includes("「하나」 첫 장 목표"));
  assert.ok(a.vary.includes("[에피소드 진행") && a.vary.includes("1장 / 3장"));
  assert.ok(a.tail.includes('"_ep"'));
  r.ep = epPick(EPI, toChoice(), "left"); r.turn = 6;
  const b = rulesParts(r);
  assert.equal(b.fixed, a.fixed, "장이 넘어가도 고정부는 같음");
  assert.ok(b.vary.includes("3장 / 3장") && b.vary.includes("→ 왼쪽"));
  r.ep = { ...r.ep, end: "left-end" };
  const c = rulesParts(r); assert.ok(c.vary.includes("이번 응답으로 이야기를 끝낸다") && c.vary.includes("왼쪽 줄거리")); assert.ok(!c.tail.includes('"_ep"'), "결말 장면에는 _ep를 묻지 않음");
  r.ep = { ...r.ep, over: true };
  r.msgs.push({ id: "a9", role: "ai", idx: 0, alts: [{ text: "끝", status: r.status, suggestions: [] }], statusBefore: r.status });
  const f = sideRoom(r, "after"), s = rulesParts(f);
  assert.ok(s.fixed.includes("[외전 — 결말 뒤의 이야기]") && s.fixed.includes("「왼쪽 끝」"));
  assert.ok(s.fixed.includes("에피소드에서 있었던 일") && s.fixed.includes("1장 「하나」 첫 장 목표") && s.fixed.includes("'어느 길로?' → 왼쪽") && s.fixed.includes("결말 「왼쪽 끝」: 왼쪽 줄거리"), "외전 고정부에 원래 에피소드의 요약");
  const t = rulesParts(sideRoom(r, "talk", r.char.cast[0].code)); assert.ok(t.fixed.includes("[외전 — 그 인물과 더 이야기하기 · " + r.char.cast[0].name + "]"));
  assert.ok(!s.fixed.includes("[에피소드 —") && !s.vary.includes("[에피소드 진행") && !s.tail.includes('"_ep"'));
});
test("작품: 에피소드를 적은 작품은 결말이 둘 이상이고 마지막 결말만 조건이 없음(빌드 검사와 같은 규칙)", () => {
  const eps = ORIGINALS.filter((c) => c.episode);
  assert.ok(eps.length >= 1);
  for (const c of eps) {
    const e = c.episode.endings; assert.ok(e.length >= 2, c.id);
    assert.ok(e.slice(0, -1).every((x) => x.when) && !e[e.length - 1].when, c.id);
  }
});
