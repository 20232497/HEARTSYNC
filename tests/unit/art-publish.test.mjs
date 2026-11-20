// 그림 총괄 페이지의 '사이트에 올리기'(tools/art/publish.mjs) — 진짜 git으로 임시 저장소 셋(원격 흉내·올리는 작업 사본·남이 쓰는 사본)을 만들어 올리기 흐름을 끝까지 돌린다.
// GitHub(gh)만 흉내 낸다: PR 만들기·검사 결과·병합(병합은 '남의 사본'에서 실제로 합쳐 원격에 올림). 진짜 GitHub에는 닿지 않는다.
// 보는 것: 그림만 올라가는지, 엉뚱한 가지·다른 파일이 있으면 멈추는지, 검사가 떨어지면 병합하지 않고 다시 누르면 이어지는지, 그 사이 main이 바뀌면 다시 빌드해 맞추는지.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { HOME, sortChanges, describe, verdict, status, publish } from "../../tools/art/publish.mjs";

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "hs-art-publish-"));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));
const ID = ["-c", "user.name=시험", "-c", "user.email=test@example.invalid", "-c", "init.defaultBranch=main", "-c", "core.autocrlf=false"];
const git = (cwd, ...a) => execFileSync("git", [...ID, ...a], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const put = (root, rel, text) => {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  fs.writeFileSync(path.join(root, rel), text);
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

/** 임시 저장소 셋과 gh 흉내. o: { checks: 검사 결과를 차례로(마지막 것이 되풀이됨), moveMain: 병합 직전에 main을 한 번 움직임 } */
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
  const G = { pr: null, merged: false, calls: [], checks: [...(o.checks || ["pass"])], moved: !o.moveMain },
    log = [];
  let n = 0;
  const ghFake = (a) => {
    G.calls.push(a.slice(0, 2).join(" "));
    if (a[1] === "create") {
      G.pr = { head: a[a.indexOf("--head") + 1], title: a[a.indexOf("--title") + 1], url: "https://example.invalid/pr/1" };
      return { code: 0, out: "만들었어요\n" + G.pr.url + "\n" };
    }
    if (a[1] === "checks") {
      const b = G.checks.length > 1 ? G.checks.shift() : G.checks[0];
      return { code: b === "pass" ? 0 : 8, out: JSON.stringify([{ name: "check", bucket: b }]) };
    }
    if (a[1] === "view" && a.includes("url,state"))
      return G.pr ? { code: 0, out: JSON.stringify({ url: G.pr.url, state: G.merged ? "MERGED" : "OPEN" }) } : { code: 1, out: "" };
    if (a[1] === "view") {
      if (G.merged) return { code: 0, out: JSON.stringify({ mergeable: "UNKNOWN", state: "MERGED" }) };
      if (!G.moved) {
        // 누가 그 사이 main에 다른 그림을 올림 → 빌드 결과가 겹친다
        G.moved = true;
        git(other, "pull", "-q", "origin", "main");
        put(other, "content/f/other/images/cover.webp", "남의 그림");
        buildIn(other);
        git(other, "add", "-A");
        git(other, "commit", "-q", "-m", "남이 올린 그림");
        git(other, "push", "-q", "origin", "main");
        return { code: 0, out: JSON.stringify({ mergeable: "CONFLICTING", state: "OPEN" }) };
      }
      return { code: 0, out: JSON.stringify({ mergeable: "MERGEABLE", state: "OPEN" }) };
    }
    if (a[1] === "merge") {
      git(other, "fetch", "-q", "origin");
      git(other, "checkout", "-q", "main");
      git(other, "merge", "-q", "--ff-only", "origin/main");
      git(other, "merge", "-q", "--no-ff", "--no-edit", "origin/" + G.pr.head); // 겹치면 여기서 던진다 — 올리기 쪽이 못 맞춘 것
      git(other, "push", "-q", "origin", "main");
      G.merged = true;
      return { code: 0, out: "" };
    }
    throw new Error("흉내에 없는 gh 명령: " + a.join(" "));
  };
  const run = async (cmd, args, opt = {}) => {
    if (cmd === "gh") return ghFake(args);
    try {
      return { code: 0, out: execFileSync(cmd, args, { cwd: site, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }) };
    } catch (e) {
      if (opt.allowFail) return { code: e.status || 1, out: String(e.stdout || "") };
      throw new Error(`${cmd} ${args.join(" ")} — ${String(e.stderr || e.message).trim()}`);
    }
  };
  git(site, "config", "core.autocrlf", "false");
  const ctx = { run, log: (t) => log.push(t), wait: async () => {}, build: async () => buildIn(site), now: () => "20261121-00000" + ++n };
  return { site, other, origin, G, log, ctx, run };
}

test("올리기: 줄 가르기·제목·검사 판정", () => {
  const s = sortChanges(
    '?? content/f/hwanghu/images/cover.webp\n M content/m/godseats/images/HSY3.webp\n M index.html\n M src/js/app.js\n?? "content/f/x/images/a b.webp"\n'
  );
  assert.deepEqual(s.images, ["content/f/hwanghu/images/cover.webp", "content/m/godseats/images/HSY3.webp"]);
  assert.deepEqual(s.others, ["src/js/app.js", "content/f/x/images/a b.webp"], "빌드 결과는 빼고, 그림 이름 규칙에 안 맞는 것은 '다른 파일'로");
  const d = describe(["content/f/fate/hwanghu/images/cover.webp", "content/f/fate/hwanghu/images/KAS0.webp", "content/m/godseats/images/HSY3.webp"]);
  assert.equal(d.title, "그림 싣기: 작품 2개 · 3장");
  assert.equal(d.body, "- godseats: HSY3\n- hwanghu: KAS0, cover");
  assert.equal(verdict([]), "pending", "검사가 아직 안 붙었으면 기다림");
  assert.equal(
    verdict([
      { name: "check", bucket: "pass" },
      { name: "e2e", bucket: "pending" }
    ]),
    "pending"
  );
  assert.equal(
    verdict([
      { name: "check", bucket: "pass" },
      { name: "x", bucket: "skipping" }
    ]),
    "pass"
  );
  assert.equal(
    verdict([
      { name: "check", bucket: "fail" },
      { name: "e2e", bucket: "cancel" },
      { name: "v", bucket: "pass" }
    ]),
    "fail: check, e2e"
  );
});

test("올리기: 실은 그림만 커밋해 올리고, 검사가 통과하면 병합한 뒤 전용 가지를 main과 맞춤", async () => {
  const w = world("happy", { checks: ["pending", "pending", "pass"] });
  put(w.site, "content/f/hwanghu/images/cover.webp", "표지");
  put(w.site, "content/f/hwanghu/images/KAS0.webp", "프로필");
  assert.deepEqual((await status(w.run)).images.sort(), ["content/f/hwanghu/images/KAS0.webp", "content/f/hwanghu/images/cover.webp"]);
  const r = await publish(w.ctx);
  assert.deepEqual(r, { url: "https://example.invalid/pr/1", count: 2 });
  assert.equal(w.G.pr.title, "그림 싣기: 작품 1개 · 2장");
  assert.equal(git(w.site, "rev-parse", "--abbrev-ref", "HEAD"), HOME, "전용 가지로 돌아옴");
  assert.equal(git(w.site, "rev-parse", "HEAD"), git(w.site, "rev-parse", "origin/main"), "main과 같음");
  assert.equal(git(w.site, "status", "--porcelain"), "", "남은 변경 없음");
  assert.equal(git(w.site, "branch", "--list", "art/upload-*"), "", "올리는 데 쓴 로컬 가지는 지움");
  assert.match(fs.readFileSync(path.join(w.site, "index.html"), "utf8"), /hwanghu\/images\/KAS0\.webp\ncontent\/f\/hwanghu\/images\/cover\.webp/);
  const files = git(w.site, "show", "--stat", "--format=", "HEAD^2").replace(/\r/g, "");
  assert.ok(/cover\.webp/.test(files) && /index\.html/.test(files) && !/README/.test(files), "커밋에는 그림과 빌드 결과만");
  assert.equal(git(w.site, "log", "-1", "--format=%an <%ae>", "HEAD^2"), "시험 <test@example.invalid>", "작성자 설정이 없으면 main의 최근 커밋 작성자");
  assert.ok(w.G.calls.filter((c) => c === "pr checks").length >= 3, "검사가 끝날 때까지 다시 봄");
});

test("올리기: 그림 말고 바뀐 파일·올릴 그림 없음·엉뚱한 가지에서는 아무것도 올리지 않고 멈춤", async () => {
  const w = world("refuse");
  await assert.rejects(publish(w.ctx), /올릴 그림이 없어요/);
  put(w.site, "content/f/hwanghu/images/cover.webp", "표지");
  put(w.site, "README.md", "딴 것을 고침\n");
  await assert.rejects(publish(w.ctx), /그림 말고 바뀐 파일이 있어요.*README\.md/);
  git(w.site, "checkout", "-q", "--", "README.md");
  git(w.site, "checkout", "-q", "-b", "feat/something");
  await assert.rejects(publish(w.ctx), /그림 전용 작업 사본\(가지 art\/site\)에서만/);
  assert.equal(w.G.pr, null, "PR을 만들지 않음");
  assert.equal(git(w.other, "ls-remote", "--heads", "origin").split("\n").length, 1, "원격에 올라간 가지 없음(main뿐)");
});

test("올리기: 검사가 떨어지면 병합하지 않고 PR을 열어 둠 — 다시 누르면 그 가지에서 이어서 병합", async () => {
  const w = world("fail-then-resume", { checks: ["pending", "fail"] });
  put(w.site, "content/m/godseats/images/HSY0.webp", "프로필");
  const e = await publish(w.ctx).then(
    () => null,
    (x) => x
  );
  assert.match(e.message, /검사가 떨어져 병합하지 않았어요\(check\)/);
  assert.equal(e.url, "https://example.invalid/pr/1");
  assert.equal(w.G.merged, false);
  const st = await status(w.run);
  assert.ok(st.upload && !st.home, "올리던 가지에 머묾: " + st.branch);
  w.G.checks = ["pass"]; // 검사를 다시 돌려 통과했다고 치고
  const r = await publish(w.ctx);
  assert.deepEqual(r, { url: "https://example.invalid/pr/1", count: 1 });
  assert.equal(w.G.calls.filter((c) => c === "pr create").length, 1, "PR을 다시 만들지 않음");
  assert.equal(git(w.site, "rev-parse", "--abbrev-ref", "HEAD"), HOME);
  assert.match(fs.readFileSync(path.join(w.site, "index.html"), "utf8"), /godseats\/images\/HSY0\.webp/);
});

test("올리기: 기다리는 사이 main이 바뀌면(빌드 결과가 겹침) main을 합치고 다시 빌드해 올린 뒤 병합", async () => {
  const w = world("main-moved", { moveMain: true });
  put(w.site, "content/f/hwanghu/images/cover.webp", "표지");
  const r = await publish(w.ctx);
  assert.equal(r.count, 1);
  assert.ok(w.log.some((t) => /main이 바뀌어 다시 맞추는 중/.test(t)));
  const built = fs.readFileSync(path.join(w.site, "index.html"), "utf8");
  assert.ok(/hwanghu\/images\/cover\.webp/.test(built) && /other\/images\/cover\.webp/.test(built), "두 쪽 그림이 모두 든 빌드 결과");
  assert.equal(git(w.site, "rev-parse", "HEAD"), git(w.site, "rev-parse", "origin/main"));
  assert.equal(git(w.site, "status", "--porcelain"), "");
});
