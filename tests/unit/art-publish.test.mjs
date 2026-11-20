// 그림 총괄 페이지의 '사이트에 올리기'(tools/art/publish.mjs) — 진짜 git으로 임시 저장소 셋(원격 흉내·올리는 작업 사본·남이 쓰는 사본)을 만들어 올리기 흐름을 끝까지 돌린다.
// GitHub(gh)만 흉내 낸다: PR 만들기·PR 상태(끝 커밋)·그 커밋의 워크플로 실행·병합(병합은 '남의 사본'에서 실제로 합쳐 원격에 올림). 진짜 GitHub에는 닿지 않는다.
// 보는 것: 그림만 올라가는지(이번에 만든 커밋만), 전용 사본이 아니거나 다른 파일이 섞이면 올리기 전에 멈추는지, 꼭 통과해야 하는 워크플로가 그 커밋에서 성공했을 때만 병합하는지,
// 검사가 떨어지면 병합하지 않고 다시 누르면 이어지는지, 그 사이 main이 바뀌면 다시 빌드해 맞추는지.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { HOME, MARK, REQUIRED, sortChanges, describe, verdict, isImage, status, publish } from "../../tools/art/publish.mjs";

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "hs-art-publish-"));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));
const ID = ["-c", "user.name=시험", "-c", "user.email=test@example.invalid", "-c", "init.defaultBranch=main", "-c", "core.autocrlf=false"];
const git = (cwd, ...a) => execFileSync("git", [...ID, ...a], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const put = (root, rel, data) => {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  fs.writeFileSync(path.join(root, rel), data);
};
/** 모양만 갖춘 가짜 webp(서명과 길이가 맞음) */
const webp = (tag) => {
  const body = Buffer.concat([Buffer.from("WEBP"), Buffer.from(tag.padEnd(12, "."))]),
    size = Buffer.alloc(4);
  size.writeUInt32LE(body.length);
  return Buffer.concat([Buffer.from("RIFF"), size, body]);
};
const walk = (d) =>
  fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)])) : [];
/** 빌드 흉내: 실린 그림 목록을 두 결과 파일에 적는다(진짜 빌드처럼 그림이 바뀌면 결과도 바뀜) */
const buildIn = (root) => {
  const list = walk(path.join(root, "content"))
    .map((f) => path.relative(root, f).replace(/\\/g, "/"))
    .filter((f) => /\/images\//.test(f))
    .sort()
    .join("\n");
  put(root, "index.html", "built\n" + list + "\n");
  put(root, "admin.html", "built-admin\n" + list + "\n");
};
const [BUILD, E2E] = REQUIRED;
/** 워크플로 실행 한 줄 — state: pass·fail·pending */
const runOf = (p, state, sha, more = {}) => ({
  path: p,
  head_sha: sha,
  event: "pull_request",
  status: state === "pending" ? "in_progress" : "completed",
  conclusion: state === "pass" ? "success" : state === "fail" ? "failure" : null,
  run_number: 1,
  ...more
});

/** 임시 저장소 셋과 gh 흉내. o: { checks: 검사 결과를 차례로(마지막 것이 되풀이됨 — "pass" 같은 글이면 두 워크플로 모두 그 상태, 함수면 (끝 커밋) → 실행 목록),
    moveMain: PR을 처음 볼 때 main을 한 번 움직임, mark: false면 전용 사본 표식을 두지 않음, ctx: 올리기에 덧붙일 값 } */
function world(name, o = {}) {
  const dir = path.join(TMP, name),
    origin = path.join(dir, "origin.git"),
    site = path.join(dir, "site"),
    other = path.join(dir, "other");
  fs.mkdirSync(dir, { recursive: true });
  git(dir, "init", "-q", "--bare", origin);
  git(dir, "init", "-q", other);
  put(other, "README.md", "작품\n");
  buildIn(other);
  git(other, "add", "-A");
  git(other, "commit", "-q", "-m", "처음");
  git(other, "branch", "-M", "main");
  git(other, "remote", "add", "origin", origin);
  git(other, "push", "-q", "origin", "main");
  git(dir, "clone", "-q", origin, site);
  git(site, "checkout", "-q", "-b", HOME);
  git(site, "config", "core.autocrlf", "false");
  if (o.mark !== false) fs.writeFileSync(path.resolve(site, git(site, "rev-parse", "--git-path", MARK)), "");
  const G = { pr: null, merged: false, calls: [], checks: [...(o.checks || ["pass"])], moved: !o.moveMain },
    log = [];
  let n = 0;
  const head = () => git(other, "ls-remote", "origin", "refs/heads/" + G.pr.head).split(/\s/)[0];
  const ok = (v) => ({ code: 0, out: typeof v === "string" ? v : JSON.stringify(v) });
  /** 남이 그 사이 main에 올림 — change(other)가 무엇을 바꿀지 */
  const pushMain = (change, msg) => {
    git(other, "fetch", "-q", "origin");
    git(other, "checkout", "-q", "main");
    git(other, "merge", "-q", "--ff-only", "origin/main");
    change(other);
    git(other, "add", "-A");
    git(other, "commit", "-q", "-m", msg);
    git(other, "push", "-q", "origin", "main");
  };
  const ghFake = (a) => {
    G.calls.push(a[0] === "api" ? "api runs" : a.slice(0, 2).join(" "));
    if (a[0] === "api") {
      const sha = /head_sha=([0-9a-f]+)/.exec(a[1])[1],
        c = G.checks.length > 1 ? G.checks.shift() : G.checks[0];
      return ok(typeof c === "function" ? c(sha) : [runOf(BUILD, c, sha), runOf(E2E, c, sha)]);
    }
    if (a[1] === "create") {
      G.pr = { head: a[a.indexOf("--head") + 1], title: a[a.indexOf("--title") + 1], url: "https://github.com/x/y/pull/1" };
      return ok("만들었어요\n" + G.pr.url + "\n");
    }
    if (a[1] === "view" && a.includes("url,state,baseRefName,headRefName"))
      return G.pr && G.pr.head === a[2]
        ? ok({ url: G.pr.url, state: G.merged ? "MERGED" : "OPEN", baseRefName: "main", headRefName: G.pr.head })
        : { code: 1, out: "" };
    if (a[1] === "view") {
      if (!G.merged && !G.moved) {
        // 누가 그 사이 main에 다른 그림을 올림 → 빌드 결과가 겹친다
        G.moved = true;
        pushMain((r) => {
          put(r, "content/f/other/images/cover.webp", webp("남의 그림"));
          buildIn(r);
        }, "남이 올린 그림");
      }
      return ok({ state: G.merged ? "MERGED" : "OPEN", headRefOid: head() });
    }
    if (a[1] === "merge") {
      const want = a[a.indexOf("--match-head-commit") + 1];
      if (want !== head()) throw new Error("검사한 커밋과 PR의 끝이 달라 병합하지 않음: " + want);
      git(other, "fetch", "-q", "origin");
      git(other, "checkout", "-q", "main");
      git(other, "merge", "-q", "--ff-only", "origin/main");
      git(other, "merge", "-q", "--no-ff", "--no-edit", "origin/" + G.pr.head); // 겹치면 여기서 던진다 — 올리기 쪽이 못 맞춘 것
      git(other, "push", "-q", "origin", "main");
      G.merged = true;
      return ok("");
    }
    throw new Error("흉내에 없는 gh 명령: " + a.join(" "));
  };
  const run = async (cmd, args, opt = {}) => {
    if (cmd === "gh") return ghFake(args);
    try {
      return { code: 0, out: execFileSync(cmd, args, { cwd: site, encoding: opt.raw ? "buffer" : "utf8", stdio: ["ignore", "pipe", "pipe"] }) };
    } catch (e) {
      if (opt.allowFail) return { code: e.status || 1, out: String(e.stdout || "") };
      throw new Error(`${cmd} ${args.join(" ")} — ${String(e.stderr || e.message).trim()}`);
    }
  };
  const ctx = {
    run,
    root: site,
    log: (t) => log.push(t),
    wait: async () => {},
    build: async () => buildIn(site),
    now: () => "20261121-00000" + ++n,
    ...(o.ctx || {})
  };
  const heads = () => git(other, "ls-remote", "--heads", "origin").split("\n").length;
  /** 원격의 어느 가지에도 그 경로를 건드린 커밋이 없는지 */
  const neverPushed = (p) => (git(other, "fetch", "-q", "origin"), git(other, "log", "--all", "--format=%h", "--", p) === "");
  return { site, other, origin, G, log, ctx, run, heads, pushMain, neverPushed };
}
const count = (w, what) => w.G.calls.filter((c) => c === what).length;

test("올리기: 줄 가르기·제목·검사 판정·그림 모양", () => {
  const s = sortChanges(
    "?? content/f/hwanghu/images/cover.webp\0 M content/m/godseats/images/HSY3.webp\0 M index.html\0 M src/js/app.js\0?? content/f/x/images/a b.webp\0 D content/f/x/note.txt\0"
  );
  assert.deepEqual(s.images, ["content/f/hwanghu/images/cover.webp", "content/m/godseats/images/HSY3.webp"]);
  assert.deepEqual(
    s.others,
    ["src/js/app.js", "content/f/x/images/a b.webp", "content/f/x/note.txt"],
    "빌드 결과는 빼고, 그림 이름 규칙에 안 맞는 것은 '다른 파일'로"
  );
  const d = describe(["content/f/fate/hwanghu/images/cover.webp", "content/f/fate/hwanghu/images/KAS0.webp", "content/m/godseats/images/HSY3.PNG"]);
  assert.equal(d.title, "그림 싣기: 작품 2개 · 3장");
  assert.equal(d.body, "- godseats: HSY3\n- hwanghu: KAS0, cover");
  const S = "a".repeat(40),
    r = (p, state, more) => runOf(p, state, S, more);
  assert.equal(verdict([], S), "pending", "실행이 아직 안 붙었으면 기다림");
  assert.equal(verdict([r(BUILD, "pass")], S), "pending", "흐름 시험이 아직 안 붙었으면 통과로 치지 않음");
  assert.equal(verdict([r(BUILD, "pass"), r(E2E, "pending")], S), "pending");
  assert.equal(verdict([r(BUILD, "pass"), r(E2E, "pass")], S), "pass");
  assert.equal(verdict([r(BUILD, "pass"), r(E2E, "pass"), r(".github/workflows/other.yml", "fail")], S), "pass", "꼭 통과해야 하는 워크플로만 본다");
  assert.equal(verdict([r(BUILD, "fail"), r(E2E, "pass")], S), "fail: build.yml");
  assert.equal(verdict([runOf(BUILD, "pass", "b".repeat(40)), runOf(E2E, "pass", "b".repeat(40))], S), "pending", "다른 커밋의 성공은 치지 않음");
  assert.equal(verdict([r(BUILD, "pass", { event: "push" }), r(E2E, "pass", { event: "workflow_dispatch" })], S), "pending", "PR 실행이 아닌 것은 치지 않음");
  assert.equal(
    verdict([r(BUILD, "pass"), r(E2E, "fail", { run_number: 1 }), r(E2E, "pass", { run_number: 2 })], S),
    "pass",
    "워크플로마다 가장 나중 실행을 봄"
  );
  assert.equal(verdict([r(BUILD, "pass"), r(E2E, "pass", { run_number: 1 }), r(E2E, "pending", { run_number: 2 })], S), "pending");
  const png = Buffer.concat([Buffer.from("\x89PNG\r\n\x1a\n", "latin1"), Buffer.alloc(12), Buffer.from([0, 0, 0, 0]), Buffer.from("IEND"), Buffer.alloc(4)]),
    jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16), Buffer.from([0xff, 0xd9])]);
  assert.ok(isImage(webp("x")) && isImage(png) && isImage(jpg));
  assert.ok(!isImage(Buffer.from("<!doctype html><html></html>")) && !isImage(Buffer.from("RIFF")), "그림이 아닌 것");
  assert.ok(
    !isImage(Buffer.concat([webp("x"), Buffer.from("뒤에 붙인 딴것")])) && !isImage(Buffer.concat([jpg, Buffer.from("x")])),
    "그림 뒤에 딴것을 붙인 파일"
  );
});

test("올리기: 실은 그림만 커밋해 올리고, 그 커밋의 워크플로가 모두 성공하면 병합한 뒤 전용 가지를 main과 맞춤", async () => {
  const w = world("happy", { checks: ["pending", (sha) => [runOf(BUILD, "pass", sha)], "pass"] });
  put(w.site, "content/f/hwanghu/images/cover.webp", webp("표지"));
  put(w.site, "content/f/hwanghu/images/KAS0.webp", webp("프로필"));
  const st = await status(w.run, w.site);
  assert.ok(st.site && st.home && !st.upload);
  assert.deepEqual(st.images.sort(), ["content/f/hwanghu/images/KAS0.webp", "content/f/hwanghu/images/cover.webp"]);
  const r = await publish(w.ctx);
  assert.deepEqual(r, { url: "https://github.com/x/y/pull/1", count: 2 });
  assert.equal(w.G.pr.title, "그림 싣기: 작품 1개 · 2장");
  assert.equal(git(w.site, "rev-parse", "--abbrev-ref", "HEAD"), HOME, "전용 가지로 돌아옴");
  assert.equal(git(w.site, "rev-parse", "HEAD"), git(w.site, "rev-parse", "origin/main"), "main과 같음");
  assert.equal(git(w.site, "status", "--porcelain"), "", "남은 변경 없음");
  assert.equal(git(w.site, "branch", "--list", "art/upload-*"), "", "올리는 데 쓴 로컬 가지는 지움");
  assert.match(fs.readFileSync(path.join(w.site, "index.html"), "utf8"), /hwanghu\/images\/KAS0\.webp\ncontent\/f\/hwanghu\/images\/cover\.webp/);
  const files = git(w.site, "show", "--stat", "--format=", "HEAD^2").replace(/\r/g, "");
  assert.ok(/cover\.webp/.test(files) && /index\.html/.test(files) && !/README/.test(files), "커밋에는 그림과 빌드 결과만");
  assert.equal(git(w.site, "log", "-1", "--format=%an <%ae>", "HEAD^2"), "시험 <test@example.invalid>", "작성자 설정이 없으면 main의 최근 커밋 작성자");
  assert.ok(count(w, "api runs") >= 3, "두 워크플로가 모두 성공할 때까지 다시 봄");
  assert.equal(count(w, "pr merge"), 1);
});

test("올리기: 전용 사본이 아니거나, 그림 말고 바뀐 파일·그림이 아닌 파일이 있으면 아무것도 올리지 않고 멈춤", async () => {
  const no = world("no-mark", { mark: false });
  put(no.site, "content/f/hwanghu/images/cover.webp", webp("표지"));
  await assert.rejects(publish(no.ctx), /그림 전용 작업 사본에서만/);
  const w = world("refuse");
  await assert.rejects(publish(w.ctx), /올릴 그림이 없어요/);
  put(w.site, "content/f/hwanghu/images/cover.webp", webp("표지"));
  put(w.site, "README.md", "딴 것을 고침\n");
  await assert.rejects(publish(w.ctx), /그림 말고 바뀐 파일이 있어요.*README\.md/);
  git(w.site, "add", "README.md"); // 미리 스테이징해 둔 것도 마찬가지
  await assert.rejects(publish(w.ctx), /그림 말고 바뀐 파일이 있어요.*README\.md/);
  git(w.site, "reset", "-q", "HEAD", "README.md");
  git(w.site, "checkout", "-q", "--", "README.md");
  put(w.site, "content/f/hwanghu/images/KAS0.webp", "<script>그림이 아님</script>");
  await assert.rejects(publish(w.ctx), /그림 파일이 아니에요.*KAS0\.webp/);
  put(w.site, "content/f/hwanghu/images/KAS0.webp", Buffer.concat([webp("프로필"), Buffer.from("뒤에 붙인 딴것")]));
  await assert.rejects(publish(w.ctx), /그림 파일이 아니에요.*KAS0\.webp/);
  fs.rmSync(path.join(w.site, "content/f/hwanghu/images/KAS0.webp"));
  git(w.site, "checkout", "-q", "-b", "feat/something");
  await assert.rejects(publish(w.ctx), /그림 전용 작업 사본에서만/);
  for (const x of [no, w]) {
    assert.equal(x.G.pr, null, "PR을 만들지 않음");
    assert.equal(x.heads(), 1, "원격에 올라간 가지 없음(main뿐)");
    assert.equal(git(x.site, "branch", "--list", "art/upload-*"), "", "올리는 가지도 만들지 않음");
  }
});

test("올리기: 올리지 못한 채 남아 있던 커밋은 올리지 않는다 — 그림만 추려 새 커밋으로(다른 파일이 섞인 커밋·중간에 지운 파일·손으로 고친 빌드 결과는 공개되지 않음)", async () => {
  const w = world("leftover");
  git(w.site, "checkout", "-q", "-b", "art/upload-20261121-000008");
  put(w.site, "content/f/hwanghu/images/cover.webp", webp("표지"));
  put(w.site, "src/secret.js", "딸려 올라가면 안 되는 것\n");
  put(w.site, "index.html", "손으로 고친 결과물\n");
  git(w.site, "add", "-A");
  git(w.site, "commit", "-q", "-m", "섞인 커밋");
  fs.rmSync(path.join(w.site, "src/secret.js"));
  git(w.site, "add", "-A");
  git(w.site, "commit", "-q", "-m", "지움"); // 마지막 모습에는 없어도, 가지를 그대로 올리면 중간 커밋이 공개된다
  const r = await publish(w.ctx);
  assert.equal(r.count, 1);
  assert.ok(w.neverPushed("src/secret.js"), "다른 파일이 든 커밋은 원격 어디에도 올라가지 않음");
  assert.match(git(w.site, "branch", "--list", "art/kept-*"), /art\/kept-/, "예전 가지는 지우지 않고 이름을 바꿔 남김");
  assert.equal(fs.readFileSync(path.join(w.site, "index.html"), "utf8"), "built\ncontent/f/hwanghu/images/cover.webp\n", "빌드 결과는 새로 만든 것");
  assert.ok(w.log.some((t) => /그림만 추려 새로 만들어요/.test(t)));
});

test("올리기: 이미 올라가 있는 가지의 커밋도 다시 본다 — 그림 아닌 파일이 든 커밋, 최신 main의 파일을 되돌린 병합 커밋이 있으면 PR을 만들지 않고 멈춤", async () => {
  const w = world("pushed-bad");
  git(w.site, "checkout", "-q", "-b", "art/upload-20261121-000008");
  put(w.site, "content/f/hwanghu/images/cover.webp", webp("표지"));
  put(w.site, "src/secret.js", "누가 따로 올려 둔 것\n");
  buildIn(w.site);
  git(w.site, "add", "-A");
  git(w.site, "commit", "-q", "-m", "섞인 커밋");
  git(w.site, "push", "-q", "origin", "HEAD:refs/heads/art/upload-20261121-000008"); // 도구 밖에서 올라간 가지
  await assert.rejects(publish(w.ctx), /그림이 아닌 파일이 들어 있어 올리지 않았어요: src\/secret\.js/);
  assert.equal(w.G.pr, null);

  const v = world("evil-merge");
  const old = git(v.site, "rev-parse", "origin/main");
  git(v.site, "checkout", "-q", "-b", "art/upload-20261121-000008");
  put(v.site, "content/f/hwanghu/images/cover.webp", webp("표지"));
  buildIn(v.site);
  git(v.site, "add", "-A");
  git(v.site, "commit", "-q", "-m", "그림 싣기");
  v.pushMain((r) => put(r, "README.md", "main에서 고친 글\n"), "main의 다른 변경");
  git(v.site, "fetch", "-q", "origin");
  git(v.site, "merge", "-q", "--no-edit", "origin/main"); // 최신 main이 들어옴
  git(v.site, "checkout", "-q", old, "--", "README.md"); // 옛 main을 다시 합친 것처럼 꾸며 README를 옛 내용으로 되돌린 병합 커밋
  const evil = git(v.site, "commit-tree", git(v.site, "write-tree"), "-p", "HEAD", "-p", old, "-m", "되돌리는 병합");
  git(v.site, "reset", "-q", "--hard", evil);
  git(v.site, "push", "-q", "origin", "HEAD:refs/heads/art/upload-20261121-000008");
  await assert.rejects(publish(v.ctx), /그림이 아닌 파일이 들어 있어 올리지 않았어요: README\.md/);
  assert.equal(v.G.pr, null);
});

test("올리기: 꼭 통과해야 하는 워크플로가 붙지 않으면 다른 것이 성공해도 병합하지 않음", async () => {
  const w = world("no-required", { checks: [(sha) => [runOf(BUILD, "pass", sha), runOf(".github/workflows/other.yml", "pass", sha)]], ctx: { maxWaitMs: -1 } });
  put(w.site, "content/f/hwanghu/images/cover.webp", webp("표지"));
  await assert.rejects(publish(w.ctx), /검사가 오래 걸려 기다리기를 멈췄어요/);
  assert.equal(count(w, "pr merge"), 0);
  assert.equal(w.G.merged, false);
});

test("올리기: 검사가 떨어지면 병합하지 않고 PR을 열어 둠 — 다시 누르면 그 가지에서 이어서 병합", async () => {
  const w = world("fail-then-resume", { checks: ["pending", "fail"] });
  put(w.site, "content/m/godseats/images/HSY0.webp", webp("프로필"));
  const e = await publish(w.ctx).then(
    () => null,
    (x) => x
  );
  assert.match(e.message, /검사가 떨어져 병합하지 않았어요\(build\.yml, e2e\.yml\)/);
  assert.equal(e.url, "https://github.com/x/y/pull/1");
  assert.equal(w.G.merged, false);
  const st = await status(w.run, w.site);
  assert.ok(st.upload && !st.home, "올리던 가지에 머묾: " + st.branch);
  put(w.site, "index.html", "하다 만 빌드 결과\n"); // 남아 있어도 되돌리고 이어 감
  w.G.checks = ["pass"]; // 검사를 다시 돌려 통과했다고 치고
  const r = await publish(w.ctx);
  assert.deepEqual(r, { url: "https://github.com/x/y/pull/1", count: 1 });
  assert.equal(count(w, "pr create"), 1, "PR을 다시 만들지 않음");
  assert.equal(git(w.site, "rev-parse", "--abbrev-ref", "HEAD"), HOME);
  assert.match(fs.readFileSync(path.join(w.site, "index.html"), "utf8"), /godseats\/images\/HSY0\.webp/);
});

test("올리기: 가지만 만들고 커밋 전에 끊겼으면 처음부터 다시, 올리던 가지에 다른 변경이 남아 있으면 멈춤, 병합 뒤 정리 전에 끊겼으면 정리만", async () => {
  const w = world("interrupted");
  put(w.site, "content/f/hwanghu/images/cover.webp", webp("표지"));
  git(w.site, "checkout", "-q", "-b", "art/upload-20261121-000007"); // 커밋 전에 끊긴 모양
  assert.equal((await publish(w.ctx)).count, 1);
  assert.equal(git(w.site, "branch", "--list", "art/upload-*"), "");

  const v = world("dirty-resume", { checks: ["fail"] });
  put(v.site, "content/f/hwanghu/images/cover.webp", webp("표지"));
  await assert.rejects(publish(v.ctx), /검사가 떨어져/);
  put(v.site, "content/f/hwanghu/images/KAS1.webp", webp("나중에 실은 것"));
  v.G.checks = ["pass"];
  await assert.rejects(publish(v.ctx), /올리던 가지에 커밋하지 않은 변경이 있어 멈췄어요.*KAS1\.webp/);
  assert.equal(count(v, "pr merge"), 0);

  const m = world("merged-then-cut", { checks: ["fail"] });
  put(m.site, "content/f/hwanghu/images/cover.webp", webp("표지"));
  await assert.rejects(publish(m.ctx), /검사가 떨어져/);
  await m.run("gh", ["pr", "merge", m.G.pr.url, "--merge", "--match-head-commit", git(m.site, "rev-parse", "HEAD")]); // GitHub에서 병합된 뒤 창이 닫힌 모양
  assert.equal((await publish(m.ctx)).count, 1);
  assert.equal(git(m.site, "rev-parse", "--abbrev-ref", "HEAD"), HOME);
  assert.equal(git(m.site, "rev-parse", "HEAD"), git(m.site, "rev-parse", "origin/main"));
  assert.equal(count(m, "pr create"), 1, "다시 올리지 않음");
});

test("올리기: 기다리는 사이 main이 바뀌면(빌드 결과가 겹침) main을 합치고 다시 빌드해 올린 뒤, 새 커밋의 실행을 보고 병합", async () => {
  const w = world("main-moved", { moveMain: true });
  put(w.site, "content/f/hwanghu/images/cover.webp", webp("표지"));
  const r = await publish(w.ctx);
  assert.equal(r.count, 1);
  assert.ok(w.log.some((t) => /main이 바뀌어 다시 맞추는 중/.test(t)));
  const built = fs.readFileSync(path.join(w.site, "index.html"), "utf8");
  assert.ok(/hwanghu\/images\/cover\.webp/.test(built) && /other\/images\/cover\.webp/.test(built), "두 쪽 그림이 모두 든 빌드 결과");
  assert.equal(git(w.site, "rev-parse", "HEAD"), git(w.site, "rev-parse", "origin/main"));
  assert.equal(git(w.site, "status", "--porcelain"), "");
  assert.equal(count(w, "pr merge"), 1, "검사한 커밋과 PR의 끝이 같을 때만 병합됨(흉내가 확인)");
});
