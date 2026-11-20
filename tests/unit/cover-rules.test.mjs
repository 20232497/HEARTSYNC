// 표지 규칙(archive/style-works) — 모든 작품의 표지 계획이 뽑히고, 유형·빛·성인 표시·문구 길이·단체 합성 값이 규칙대로인지. 앱 코드가 아니라 그림 도구(npm run art)가 쓰는 규칙이다.
// 작품 글(content/)이 바뀌어 표지 손질 자리가 사라지면 여기서 알린다 — 그때는 archive/style-works/code/cover.js의 COVERS를 고친다.
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { COVERS, coverPlan, coverOf } from "../../archive/style-works/code/cover.js";
import { GROUPS, SEAT, UNIFY, groupPlan } from "../../archive/style-works/code/cover-group.js";
import { seatOf } from "../../archive/style-works/code/compose.js";
import { COVER_POST } from "../../archive/style-works/code/cover-post.js";
import { LOGOS } from "../../archive/style-works/code/logos.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const walk = (d) =>
  fs
    .readdirSync(d, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name === "work.js" ? [path.join(d, e.name)] : []));
const WORKS = {};
for (const f of walk(path.join(ROOT, "content"))) WORKS[path.basename(path.dirname(f))] = (await import(pathToFileURL(f).href)).default;
const plan = (id) => (coverOf(id, WORKS[id]).type === "group" ? groupPlan(id, WORKS[id]) : coverPlan(id, WORKS[id]));
const jobsOf = (p) => (p.parts ? Object.values(p.parts) : [p.job]);

test("표지 규칙: 모든 작품에 표지 설계와 로고가 있고, 설계 표에 없는 작품이 남아 있지 않음", () => {
  assert.deepEqual(Object.keys(COVERS).sort(), Object.keys(WORKS).sort(), "COVERS와 content/의 작품이 다름 — 새 작품이면 COVERS에 한 줄, 빠진 작품이면 지우기");
  for (const id of Object.keys(WORKS)) assert.ok(Array.isArray(LOGOS[id]) && LOGOS[id].length, id + ": 로고 설계가 없음");
  const n = (t) => Object.values(COVERS).filter((v) => v.type === t).length;
  assert.deepEqual([n("close"), n("scene"), n("group"), n("symbol")], [4, 4, 4, 2], "유형 배정(가까이 4 · 한 명 + 배경 4 · 단체 4 · 상징물 2)이 바뀜");
  assert.deepEqual(
    Object.keys(GROUPS).sort(),
    Object.keys(COVERS)
      .filter((id) => COVERS[id].type === "group")
      .sort()
  );
});

test("표지 규칙: 계획이 모두 뽑히고 문구가 3000자 안, 손질 자리가 살아 있음", () => {
  for (const id of Object.keys(WORKS)) {
    const p = plan(id);
    assert.ok(p.post && p.post.filter, id + ": 후처리 값이 없음");
    for (const j of jobsOf(p)) {
      assert.ok(j.pos.length <= 3000 && j.neg.length <= 3000, id + ": 문구가 3000자를 넘음");
      assert.deepEqual(j.miss || [], [], id + ": 작품 태그가 바뀌어 표지 손질(rep)이 안 먹음 — COVERS를 고치세요");
      assert.ok(j.width === 960 && j.height === 1280 && j.hires.w === 1344 && j.hires.h === 1792, id + ": 표지 크기가 다름");
      assert.ok(!/youthful/.test(j.pos), id + ": youthful은 쓰지 않음");
      assert.equal(j.post, undefined, id + ": 화풍 후처리가 남아 있음(표지는 표지 후처리만)");
    }
  }
});

test("표지 규칙: 인물 표지는 성인 표시·한 사람·미성년과 노출 네거티브, 어두운 표지는 깊은 그늘과 작품 색 조명, 밝은 작품은 어둡게 하지 않음", () => {
  for (const [id, v] of Object.entries(COVERS)) {
    if (v.type !== "close" && v.type !== "scene") continue;
    const { job, mood, post } = plan(id);
    assert.match(job.pos, /^1(girl|boy), solo, \(adult (wo)?man:1\.[23]\)/, id);
    for (const t of ["child", "loli", "shota", "underage", "toddler", "aged down", "nsfw", "nude", "(cleavage:1.5)"])
      assert.ok(job.neg.includes(t), id + ": 네거티브에 없음 — " + t);
    assert.ok(job.pos.includes(v.color), id + ": 작품 색 조명이 없음");
    assert.ok(job.pos.includes("(fully clothed:1.2)"), id + ": 옷을 여민 표시가 없음");
    if (mood === "warm") {
      assert.ok(!job.pos.includes("(dark:0.7)") && !job.neg.includes("(cheerful:1.2)"), id + ": 밝은 작품인데 어둡게 함");
      assert.equal(post, COVER_POST.warm);
    } else {
      assert.ok(
        job.pos.includes("(chiaroscuro:1.15)") && job.pos.includes("(rim lighting:1.2)") && job.neg.includes("(bright:1.2)"),
        id + ": 어두운 표지의 빛 문구가 없음"
      );
      assert.equal(post, COVER_POST.dark);
    }
    assert.ok(job.pos.includes(v.type === "scene" ? "(detailed background:1.1)" : "(blurry background:"), id + ": 배경 문구가 유형과 다름");
  }
});

test("표지 규칙: 상징물은 사람 없이, 단체는 배경 하나와 오려 붙일 인물 셋(단순한 배경 · 양옆은 옆을 봄)", () => {
  for (const [id, v] of Object.entries(COVERS)) {
    const p = plan(id);
    if (v.type === "symbol") {
      assert.ok(p.job.pos.includes("(no humans:1.3)") && p.job.neg.includes("(people:1.3)"), id);
      continue;
    }
    if (v.type !== "group") continue;
    assert.deepEqual(Object.keys(p.parts).sort(), ["bg", "left", "mid", "right"]);
    assert.ok(
      p.parts.bg.pos.includes("(no humans:1.4)") && !/hair|detailed face|skin/.test(p.parts.bg.pos),
      id + ": 배경 문구에 머리·얼굴·피부 마감 낱말이 있음(사람 머리가 그려짐)"
    );
    for (const role of ["left", "mid", "right"]) {
      const j = p.parts[role];
      assert.match(j.pos, /^1(girl|boy), solo, \(adult (wo)?man:1\.[23]\)/, id + " " + role);
      assert.ok(
        j.pos.includes("(simple background:1.4)") && !j.pos.includes("(blurry background:") && !j.pos.includes("(dark background:0.9)"),
        id + " " + role + ": 단순한 배경이 아님"
      );
      assert.ok(!/looking down at viewer/.test(j.pos) && j.pos.includes("standing"), id + " " + role + ": 서 있는 정면·반측면 구도가 아님");
      assert.equal(j.pos.includes("(looking at viewer:1.1)"), role === "mid", id + " " + role + ": 가운데만 정면을 봄");
      assert.equal(j.neg.includes("(eye contact:1.3)"), role !== "mid");
    }
    assert.ok(p.final.strength === UNIFY && UNIFY <= 0.1, id + ": 잇는 세기는 0.1까지만(넘으면 눈색·머리색이 바뀜)");
    assert.deepEqual(
      p.layout.chars.map((c) => c.role),
      ["left", "right", "mid"],
      "가운데를 마지막에 얹어 양옆 어깨를 덮음"
    );
    assert.equal(p.post, COVER_POST[p.mood === "warm" ? "warm" : "group"]);
  }
});

test("표지 규칙: 단체의 자리 계산 — 머리 높이와 정수리 높이가 자리에 맞고, 뒤집으면 얼굴 가로 위치도 뒤집힘", () => {
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  const at = seatOf(SEAT.mid, [0.08, 0.21, 0.5], 0);
  assert.ok(near(at.h * 0.21, SEAT.mid.head) && near(at.bottom - at.h + 0.08 * at.h, SEAT.mid.crown) && near(at.cx, 0.5));
  const a = seatOf(SEAT.left, [0.1, 0.2, 0.6], 0),
    b = seatOf(SEAT.left, [0.1, 0.2, 0.6], 1);
  assert.ok(near(a.cx, SEAT.left.cx - 0.1 * a.h) && near(b.cx, SEAT.left.cx + 0.1 * b.h), "얼굴이 그림 가운데에서 벗어난 만큼 그림을 옮김");
  assert.ok(near(seatOf(SEAT.right, [0.07, 0.2, 0.49], 1, 0.85).cx, 0.85), "자리 덮어쓰기");
  assert.ok(seatOf(SEAT.left, [0.03, 0.3], 0).fade > 0 && seatOf(SEAT.mid, [0.03, 0.2], 0).fade === 0, "아래가 화면에 못 미치는 그림만 아래를 풀어 줌");
});
