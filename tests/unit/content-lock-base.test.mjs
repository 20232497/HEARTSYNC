// 순서 잠금 — 기준 가지와 견주기(tools/content-lock.mjs checkBase·readBaseLocks): 작업 폴더의 lock.json을 지우거나 손으로 고쳐 다시 찍는 우회가 걸리는지,
// 뒤에 더하기·이름 고치기·폴더 옮기기는 그대로 통과하는지, git에서 '갈라진 자리'의 잠금을 읽는지(임시 저장소로 — 이 저장소의 git 설정·기록은 건드리지 않음)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { LOCK_FILE, checkBase, lockOf, lockText, readBaseLocks } from "../../tools/content-lock.mjs";

const work = () => ({
  cast: [{ code: "AAA", name: "가" }], openings: [{ id: "first", title: "하나" }],
  places: [{ name: "광장" }, { name: "서고" }, { name: "온실" }], cuts: [{ title: "첫 만남" }], lore: [{ keys: ["왕"], text: "…" }]
});
const base = () => [{ id: "zz", rel: "content/f/zz", lock: lockOf(work()) }];
/** 지금 작품(buildContent가 돌려주는 모양) — change로 작품을 고치고, relock이면 작업 폴더의 잠금도 그 내용으로 다시 찍힌 상태(우회한 모습) */
const now = (change, o = {}) => { const c = work(); if (change) change(c); const cur = lockOf(c); return [{ id: "zz", rel: o.rel || "content/f/zz", lock: o.lock === null ? null : o.relock ? cur : lockOf(work()), cur }]; };

test("checkBase: 그대로·뒤에 더하기·이름 고치기·폴더 옮기기는 통과", () => {
  assert.deepEqual(checkBase(base(), now()), { errors: [], notes: [] });
  assert.deepEqual(checkBase(base(), now((c) => { c.places.push({ name: "지하실" }); c.places[1].name = "큰 서고"; c.openings.push({ id: "second", title: "둘" }); }, { relock: true })), { errors: [], notes: [] });
  assert.deepEqual(checkBase(base(), now(null, { rel: "content/f/line/zz" })), { errors: [], notes: [] });
  assert.deepEqual(checkBase([], now()), { errors: [], notes: [] }, "기준 가지에 없던 새 작품은 견줄 것이 없음");
});
test("checkBase: 순서를 바꾸고 작업 폴더의 잠금을 다시 찍어도(파일을 지우고 찍거나 손으로 고쳐도) 기준 가지의 잠금과 어긋나 걸림", () => {
  const swapped = checkBase(base(), now((c) => { c.places.reverse(); }, { relock: true }));
  assert.equal(swapped.errors.length, 1);
  assert.match(swapped.errors[0], /^content\/f\/zz: MP1 '광장'이\(가\) MP3 자리로 밀렸어요/);
  assert.match(checkBase(base(), now((c) => { c.places.pop(); }, { relock: true })).errors[0], /^content\/f\/zz: MP3 '온실'이\(가\) 없어졌어요/);
  assert.match(checkBase(base(), now((c) => { c.openings[0].id = "renamed"; }, { relock: true })).errors[0], /^content\/f\/zz: 시작 상황 first이\(가\) 없어졌어요/);
  // 폴더를 옮기면서 순서를 바꿔도 작품 id로 짝지어 걸림(안내는 지금 경로로)
  assert.match(checkBase(base(), now((c) => { c.cuts.unshift({ title: "새 컷씬" }); }, { relock: true, rel: "content/f/line/zz" })).errors[0], /^content\/f\/line\/zz: EV1 '첫 만남'이\(가\) EV2 자리로 밀렸어요/);
});
test("checkBase: 기준 가지에 있던 잠금 파일이 없어지면 실패, 작품이 통째로 없어지면 알리기만(작품 id는 잠그지 않음)", () => {
  const gone = checkBase(base(), now(null, { lock: null }));
  assert.equal(gone.errors.length, 1);
  assert.match(gone.errors[0], /^content\/f\/zz: lock\.json이 없어졌어요/);
  const none = checkBase(base(), []);
  assert.deepEqual(none.errors, []);
  assert.match(none.notes[0], /작품 zz\(content\/f\/zz\)이\(가\) 지금은 없어요/);
});

/* readBaseLocks: 임시 git 저장소에서 — main에 잠금 둘을 커밋하고 가지를 딴 뒤, main에는 항목을 더하고 가지에서는 잠금 파일을 지움 */
const hasGit = (() => { try { execFileSync("git", ["--version"], { stdio: "ignore" }); return true; } catch (e) { return false; } })();
const tmp = [];
after(() => tmp.forEach((d) => fs.rmSync(d, { recursive: true, force: true })));
test("readBaseLocks: 지금 가지가 기준 가지에서 갈라진 자리의 lock.json을 읽음(그 뒤 기준 가지에 더해진 것은 견주지 않음), 못 읽으면 null", { skip: !hasGit && "git이 없음" }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hs-lock-")); tmp.push(dir);
  const git = (...a) => execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "-c", "core.autocrlf=false", ...a], { cwd: dir, stdio: "pipe", encoding: "utf8" });
  const put = (rel, lock) => { fs.mkdirSync(path.join(dir, rel), { recursive: true }); fs.writeFileSync(path.join(dir, rel, LOCK_FILE), lockText(lock)); };
  assert.equal(readBaseLocks("main", dir), null, "git 저장소가 아닌 폴더");
  git("init", "-q"); git("symbolic-ref", "HEAD", "refs/heads/main");
  put("content/f/zz", lockOf(work())); put("content/m/line/yy", lockOf({ places: [{ name: "항구" }] }));
  fs.writeFileSync(path.join(dir, "content", LOCK_FILE), "{}"); // 작품 폴더가 아닌 자리의 같은 이름 파일도 '폴더/lock.json' 꼴이면 읽음 — id는 폴더 이름
  git("add", "-A"); git("commit", "-q", "-m", "base");
  const forkAt = git("rev-parse", "HEAD").trim();
  git("branch", "feature");
  const more = work(); more.places.push({ name: "지하실" }); put("content/f/zz", lockOf(more));
  git("add", "-A"); git("commit", "-q", "-m", "main moves on");
  git("checkout", "-q", "feature");
  fs.rmSync(path.join(dir, "content/f/zz", LOCK_FILE)); git("add", "-A"); git("commit", "-q", "-m", "lock removed on the branch");
  const r = readBaseLocks("main", dir);
  assert.equal(r.at, forkAt, "갈라진 자리(merge-base)");
  assert.deepEqual(r.locks.map((x) => [x.id, x.rel]).sort(), [["content", "content"], ["yy", "content/m/line/yy"], ["zz", "content/f/zz"]]);
  assert.deepEqual(r.locks.find((x) => x.id === "zz").lock.places, ["광장", "서고", "온실"], "가지를 딴 뒤 main에 더해진 '지하실'은 없음");
  assert.equal(readBaseLocks("no-such-branch", dir), null, "없는 가지");
});
