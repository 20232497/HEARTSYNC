// 그림 총괄 페이지의 '사이트에 올리기' — 실은 그림을 빌드해 커밋하고, 올리고(push), PR을 만들고, GitHub 검사가 통과하면 main에 병합한다. 병합되면 GitHub Pages가 사이트를 다시 낸다.
// 사용자가 페이지에서 단추를 눌렀을 때만 돈다(2026-11-21 사용자 결정 — 사용자가 직접 올리는 그림은 '병합 담당 세션만 올린다'의 예외, docs/TEAM.md).
// 공개 저장소에 올리는 일이라 다섯 가지를 지킨다:
//   ① 그림 전용 작업 사본에서만 — npm run art:setup이 만든 사본(표식 파일 MARK가 그 사본의 git 폴더에 있음)의 가지 art/site(늘 main과 같음)나 올리던 가지 art/upload-…에서만 돈다
//   ② 올라가는 커밋은 '이번에 이 도구가 만든 것'뿐 — 지난번에 만들고 올리지 못한 커밋이 남아 있으면 그 커밋은 버려두고(가지를 art/kept-…로 남김) 그림만 추려 새로 만든다
//   ③ 올리기 전에 확인한다(gate): 새로 올라갈 커밋 하나하나가 진짜 그림(커밋에 든 내용을 읽어 확인)의 더하기·바꾸기와 빌드 결과만 바꾸는지, 최신 main과 견준 최종 모습도 그것뿐인지,
//      빌드 결과가 지금 다시 빌드한 것과 같은지. 그리고 확인한 바로 그 커밋(sha)을 올린다
//   ④ 최신 main이 들어 있는 커밋만 병합한다 — main이 그 사이 바뀌었으면 합치고 다시 빌드해 올린 뒤 그 커밋의 검사를 다시 기다린다
//   ⑤ 꼭 통과해야 하는 워크플로(REQUIRED)가 '그 커밋의 PR 실행'에서 모두 성공했을 때만, --match-head-commit으로 그 커밋을 병합한다
// 검사가 떨어지면 병합하지 않고 PR을 열어 둔다. 중간에 끊겨도(창을 닫음·연결 끊김) 단추를 다시 누르면 이어서 한다.
// 못 막는 것: 마지막 확인과 병합 요청 사이(몇 초)에 main이 또 바뀌는 경우 — GitHub의 브랜치 보호(최신 상태·필수 검사 강제)가 막아 줄 자리다(저장소 설정).
// 명령은 run(프로그램, 인자, { allowFail, raw }) → { code, out }으로만 부른다(raw면 out이 Buffer) — 단위 시험이 진짜 git과 흉내 낸 gh로 순서와 멈추는 자리를 본다.
import fs from "node:fs";
import path from "node:path";

export const HOME = "art/site";
/** 그림 전용 작업 사본의 표식 — 그 사본의 git 폴더 안 파일(git rev-parse --git-path) */
export const MARK = "hs-art-site";
/** 꼭 통과해야 하는 워크플로 — 파일 경로로 본다(표시 이름·job 이름이 같은 다른 검사와 섞이지 않게). 둘 다 그 커밋의 PR 실행에서 성공해야 병합한다.
    워크플로 파일을 옮기거나 이름을 바꾸면 여기도 같이 고친다(안 고치면 올리기가 기다리다 멈춘다 — 병합되는 쪽으로 틀리지는 않음) */
export const REQUIRED = [".github/workflows/build.yml", ".github/workflows/e2e.yml"];
const UPLOAD = /^art\/upload-\d{8}-\d{6}$/;
const IMG = /^content\/[\w/.-]+\/images\/[\w.-]+\.(webp|png|jpe?g)$/i;
const BUILT = ["index.html"]; // 커밋되는 빌드 결과 — admin.html은 커밋하지 않음(.gitignore, M6 2026-11-26)
const isBuilt = (p) => BUILT.includes(p);
const rows = (s) => String(s).trim().split(/\r?\n/).filter(Boolean);

/** git status --porcelain -z --no-renames의 출력 → 올릴 그림과 그 밖에 바뀐 파일(빌드 결과는 어느 쪽도 아님 — 올릴 때 다시 만든다) */
export function sortChanges(z) {
  const images = [],
    others = [];
  for (const e of String(z).split(/\0|\r?\n/)) {
    if (!e.trim()) continue;
    const p = e.slice(3);
    if (IMG.test(p)) images.push(p);
    else if (!isBuilt(p)) others.push(p);
  }
  return { images, others };
}
/** 커밋·PR 제목과 본문 — 작품마다 올리는 그림 이름 */
export function describe(images) {
  const by = {};
  for (const p of images) {
    const m = /^content\/(?:.*\/)?([^/]+)\/images\/(.+)\.\w+$/.exec(p);
    (by[m[1]] = by[m[1]] || []).push(m[2]);
  }
  const ids = Object.keys(by).sort();
  return { title: `그림 싣기: 작품 ${ids.length}개 · ${images.length}장`, body: ids.map((id) => `- ${id}: ${by[id].sort().join(", ")}`).join("\n") };
}
/** 그 커밋(sha)의 워크플로 실행 목록(GitHub actions/runs) → "pass" · "pending" · "fail: 파일…".
    그 커밋의 PR 실행만 본다(다른 커밋·다른 이벤트의 성공은 치지 않음. branch를 주면 그 가지에서 연 PR의 실행만). 워크플로마다 가장 나중 실행을 보고,
    꼭 통과해야 하는 것이 아직 없거나 도는 중이면 기다린다 */
export function verdict(runs, sha, branch = "", required = REQUIRED) {
  const last = {};
  for (const r of runs) {
    if (r.head_sha !== sha || r.event !== "pull_request" || (branch && r.head_branch !== branch)) continue;
    if (!last[r.path] || r.run_number > last[r.path].run_number) last[r.path] = r;
  }
  const bad = required.filter((p) => last[p] && last[p].status === "completed" && last[p].conclusion !== "success");
  if (bad.length) return "fail: " + bad.map((p) => path.posix.basename(p)).join(", ");
  return required.every((p) => last[p] && last[p].status === "completed" && last[p].conclusion === "success") ? "pass" : "pending";
}
/** 내용이 그림(webp·png·jpeg) 파일의 모양인지 — 앞의 서명과 끝(webp는 적힌 길이, png·jpeg는 끝 표시)을 본다. 그림 이름만 붙인 다른 파일, 그림 뒤에 딴것을 붙인 파일을 걸러 낸다 */
export function isImage(buf) {
  const n = buf.length,
    s = (a, b) => buf.toString("latin1", a, b);
  if (n < 16) return false;
  if (s(0, 4) === "RIFF" && s(8, 12) === "WEBP") return buf.readUInt32LE(4) + 8 === n;
  if (s(0, 8) === "\x89PNG\r\n\x1a\n") return s(n - 8, n - 4) === "IEND";
  return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff && buf[n - 2] === 0xff && buf[n - 1] === 0xd9;
}
const stamp = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
const chunks = (list, n) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n));

/** 지금 상태 — { branch, site(그림 전용 작업 사본), home(가지 art/site), upload(올리던 가지), images, others } */
export async function status(run, root) {
  const git = async (...a) => (await run("git", a)).out;
  const branch = (await git("rev-parse", "--abbrev-ref", "HEAD")).trim(),
    mark = path.resolve(root, (await git("rev-parse", "--git-path", MARK)).trim());
  return {
    branch,
    site: fs.existsSync(mark),
    home: branch === HOME,
    upload: UPLOAD.test(branch),
    ...sortChanges(await git("status", "--porcelain", "-z", "--no-renames", "--untracked-files=all"))
  };
}

/** 올리기 — ctx: { run, root, log(글), wait(ms), build(), now?, maxWaitMs? }. 끝나면 { url, count }. 멈출 일이 있으면 이유를 적어 던진다(PR 주소가 있으면 e.url) */
export async function publish(ctx) {
  const { run, root, log, wait, build } = ctx;
  const git = async (...a) => (await run("git", a)).out;
  const gh = async (...a) => (await run("gh", a)).out;
  const yes = async (...a) => !(await run("git", a, { allowFail: true })).code;
  const rev = async (x) => (await git("rev-parse", x)).trim();
  const now = ctx.now || stamp;
  let url = "";
  const fail = (text) => Object.assign(new Error(text), { url });
  // 이 PC의 git에 작성자 설정이 없으면 main의 가장 최근 커밋 작성자를 쓴다(설정은 바꾸지 않음) — 커밋과 병합 커밋에 붙인다
  let who = null;
  const signed = async (...a) => {
    if (!who) {
      const named = (await run("git", ["config", "user.name"], { allowFail: true })).out.trim(),
        w = named ? [] : rows(await git("log", "-1", "--no-merges", "--format=%an%n%ae", "origin/main"));
      who = w.length === 2 ? ["-c", "user.name=" + w[0], "-c", "user.email=" + w[1]] : [];
    }
    return [...who, ...a];
  };
  /** 두 모습의 차이가 그림(더하기·바꾸기 — 커밋에 든 내용이 그림 파일인지 읽어 봄)과 빌드 결과의 수정뿐인지. 그림 경로들을 into에 모은다 */
  const only = async (from, to, into) => {
    const t = (await git("diff", "--no-renames", "--raw", "--no-abbrev", "-z", from, to)).split("\0");
    for (let i = 0; i + 1 < t.length; i += 2) {
      const [, mode, , blob, kind] = t[i].replace(/^:/, "").split(" "),
        p = t[i + 1];
      if (isBuilt(p) && kind === "M" && mode === "100644") continue;
      if (!IMG.test(p)) throw fail("올리려는 커밋에 그림이 아닌 파일이 들어 있어 올리지 않았어요: " + p);
      if ((kind !== "A" && kind !== "M") || mode !== "100644") throw fail("그림을 더하거나 바꾸는 것만 올려요(지우기·연결 파일은 올리지 않음): " + p);
      if (!isImage((await run("git", ["cat-file", "blob", blob], { raw: true })).out)) throw fail("그림 파일이 아니에요(이름만 그림이거나 깨진 파일): " + p);
      into.add(p);
    }
  };
  /** 빌드는 작업 폴더의 파일로 한다 — 커밋하지 않은 변경(그림이든 소스든)이 있으면 그것이 빌드 결과에 섞여 올라가므로 빌드 전에 멈춘다(빌드 결과 index.html은 빼고 봄 — admin.html은 .gitignore라 안 보임) */
  const clean = async () => {
    const left = await status(run, root);
    if (left.images.length || left.others.length)
      throw fail("작업 사본에 커밋하지 않은 변경이 있어 멈췄어요: " + [...left.images, ...left.others].slice(0, 5).join(", "));
  };
  /** ③ 올릴 커밋(sha)을 먼저 못 박고 확인한다 — 아니면 던진다(이 커밋들은 아직 올리지 않은 때). { sha, images }를 돌려주고, 올리는 것도 이 sha다.
      새 커밋(origin/main에 없는 것)마다: main을 합친 커밋은 둘째 부모(이미 공개된 main의 커밋)와, 나머지는 부모와 견준다. 그리고 최신 main이 들어 있으면 main과 견준 최종 모습도 본다
      (옛 main을 다시 합쳐 최신 main의 파일을 되돌린 커밋은 커밋별 차이에는 안 보이고 여기서 걸린다) */
  const gate = async () => {
    const sha = await rev("HEAD"),
      base = await rev("origin/main"),
      images = new Set();
    const commits = rows(await git("rev-list", base + ".." + sha));
    if (!commits.length) throw fail("올릴 커밋이 없어요.");
    for (const c of commits) {
      const parents = rows(await git("rev-list", "--parents", "-n", "1", c))[0]
        .split(" ")
        .slice(1);
      if (parents.length < 1 || parents.length > 2 || (parents.length === 2 && !(await yes("merge-base", "--is-ancestor", parents[1], base))))
        throw fail("올리던 가지에 이 도구가 만들지 않은 커밋이 있어 올리지 않았어요: " + c.slice(0, 9));
      await only(parents[parents.length - 1], c, images);
    }
    if (await yes("merge-base", "--is-ancestor", base, sha)) await only(base, sha, new Set());
    if (!images.size) throw fail("올릴 그림이 없어요.");
    // 커밋된 빌드 결과가 지금 다시 빌드한 것과 같은지(손으로 고친 결과물이 올라가지 않게)
    await clean();
    await build();
    if ((await git("status", "--porcelain", "--", ...BUILT)).trim()) {
      await git("checkout", "-q", "--", ...BUILT);
      throw fail("커밋된 빌드 결과가 다시 빌드한 것과 달라 올리지 않았어요.");
    }
    if ((await rev("HEAD")) !== sha) throw fail("확인하는 사이에 작업 사본의 커밋이 바뀌어 올리지 않았어요 — 다시 눌러 주세요.");
    return { sha, images: [...images] };
  };
  /** ④ main을 합치고 다시 빌드 — 겹치는 것이 빌드 결과뿐일 때만(그 밖이면 되돌리고 멈춤).
      올려 둔 커밋(from)에서만 이어 간다: 기다리는 사이 작업 사본에 쌓인 커밋은 올리지 않고 그대로 둔 채 멈춘다 */
  const sync = async (from) => {
    if ((await rev("HEAD")) !== from) throw fail("기다리는 사이에 작업 사본의 커밋이 바뀌어 멈췄어요(바뀐 것은 그대로 뒀어요) — PR은 열어 뒀어요: " + url);
    await clean();
    if (!(await yes(...(await signed("merge", "--no-edit", "origin/main"))))) {
      const clash = (await git("diff", "--name-only", "-z", "--diff-filter=U")).split("\0").filter(Boolean);
      if (!clash.length || !clash.every(isBuilt)) {
        await run("git", ["merge", "--abort"], { allowFail: true });
        throw fail(`main과 맞추지 못했어요(${clash.join(", ") || "병합이 시작되지 않음"}) — PR은 열어 뒀어요: ${url}`);
      }
      await build();
      await git("add", "--", ...BUILT);
      await git(...(await signed("commit", "-q", "--no-edit")));
    } else {
      await build(); // 겹치지 않아도 그림 목록이 달라졌을 수 있어 다시 빌드
      if ((await git("status", "--porcelain", "--", ...BUILT)).trim()) {
        await git("add", "--", ...BUILT);
        await git(...(await signed("commit", "-q", "-m", "main과 맞춘 뒤 다시 빌드")));
      }
    }
  };

  const st = await status(run, root);
  let branch = st.branch;
  if (!st.site || !(st.home || st.upload))
    throw fail(`올리기는 그림 전용 작업 사본에서만 돼요 — 바탕화면의 'HEART SYNC 그림 총괄' 바로가기로 열어 주세요.(지금 가지: ${branch})`);
  await git("fetch", "origin", "--quiet");
  if (st.upload) {
    // 지난번 올리기가 끝나지 않음(검사 실패·창을 닫음·연결 끊김) → 이어서. 하다 만 병합과 빌드 결과(늘 다시 만드는 것 — 손으로 고치지 않는 파일)는 되돌린다
    log("지난번 올리기를 이어서 하는 중…");
    if (await yes("rev-parse", "-q", "--verify", "MERGE_HEAD")) await git("merge", "--abort");
    await git("reset", "-q", "--", ...BUILT);
    await git("checkout", "-q", "--", ...BUILT);
    if ((await git("rev-list", "--count", "origin/main..HEAD")).trim() === "0") {
      if ((await git("rev-list", "--count", HOME + "..HEAD")).trim() !== "0") {
        // 올린 것이 이미 main에 들어감(병합 뒤 정리하기 전에 끊김) → 정리만
        const done = sortChanges(
          rows(await git("diff", "--name-only", HOME + "...HEAD"))
            .map((p) => "A  " + p)
            .join("\0")
        ).images.length;
        return goHome(git, log, branch, "", done);
      }
      // 가지만 만들고 커밋하기 전에 끊김 → 전용 가지로 돌아가(바뀐 그림은 그대로 따라옴) 처음부터 다시
      await git("checkout", "-q", HOME);
      await git("branch", "-q", "-D", branch);
      return publish(ctx);
    }
    const left = await status(run, root);
    if (left.images.length || left.others.length)
      throw fail("올리던 가지에 커밋하지 않은 변경이 있어 멈췄어요: " + [...left.images, ...left.others].slice(0, 5).join(", "));
    const remote = "refs/remotes/origin/" + branch;
    if (await yes("rev-parse", "-q", "--verify", remote)) {
      // ② 올린 뒤에 더 쌓인 커밋(올리지 못한 것)은 올리지 않는다 — art/kept-…에 남겨 두고 올라가 있는 데서 이어 간다
      if ((await rev("HEAD")) !== (await rev(remote))) {
        if (!(await yes("merge-base", "--is-ancestor", "HEAD", remote))) {
          const keep = "art/kept-" + now();
          await git("branch", "-q", keep, "HEAD");
          log(`올리지 못한 커밋은 ${keep}에 남겨 두고, 올라가 있는 데서 이어 가요`);
        }
        await git("reset", "-q", "--hard", remote);
      }
    } else {
      // ② 한 번도 올리지 못한 커밋이 남아 있음 → 그 커밋들은 올리지 않는다. 그림만 추려 전용 가지에서 새로 만든다(예전 가지는 이름을 바꿔 남겨 둠)
      const old = await rev("HEAD"),
        keep = "art/kept-" + now(),
        imgs = sortChanges(
          rows(await git("diff", "--name-only", "--diff-filter=AM", "origin/main...HEAD"))
            .map((p) => "A  " + p)
            .join("\0")
        ).images;
      log(`올리지 못한 커밋이 남아 있어 그림만 추려 새로 만들어요(예전 가지는 ${keep}로 남김)`);
      await git("checkout", "-q", HOME);
      await git("branch", "-q", "-m", branch, keep);
      for (const part of chunks(imgs, 80)) await git("checkout", "-q", old, "--", ...part);
      await git("reset", "-q");
      return publish(ctx);
    }
  } else {
    if (st.others.length) throw fail("그림 말고 바뀐 파일이 있어요 — 올리지 않았어요: " + st.others.slice(0, 5).join(", "));
    if (!st.images.length) throw fail("올릴 그림이 없어요 — 먼저 후보에서 '싣기'를 눌러 주세요.");
    // 가지를 만들기 전에 먼저 본다(지워진 그림·그림이 아닌 파일) — 여기서 멈추면 아무것도 바뀌지 않는다
    for (const p of st.images) {
      const f = path.join(root, p);
      if (!fs.existsSync(f)) throw fail("지워진 그림이 있어요 — 지우기는 올리지 않아요: " + p);
      if (fs.lstatSync(f).isSymbolicLink() || !isImage(fs.readFileSync(f))) throw fail("그림 파일이 아니에요(이름만 그림이거나 깨진 파일): " + p);
    }
    if ((await git("rev-list", "--count", "origin/main..HEAD")).trim() !== "0")
      throw fail("이 작업 사본에 main에 없는 커밋이 있어요 — 그림 전용 작업 사본이 맞는지 확인해 주세요.");
    log("main과 맞추는 중…");
    await git("merge", "-q", "--ff-only", "origin/main"); // 바뀐 것이 그림뿐이라 그대로 앞으로 간다(같은 그림을 main이 바꿨으면 여기서 멈춤)
    log("빌드하는 중…");
    await build();
    const d = describe(st.images);
    branch = "art/upload-" + now();
    await git("checkout", "-q", "-b", branch);
    for (const part of chunks(st.images, 80)) await git("add", "--", ...part); // 한 번에 다 넣으면 Windows의 명령 길이 한도에 걸릴 수 있음
    await git("add", "--", ...BUILT);
    await git(...(await signed("commit", "-q", "-m", d.title, "-m", d.body)));
  }
  let { sha, images } = await gate();
  const d = describe(images),
    push = () => git("push", "-q", "origin", sha + ":refs/heads/" + branch); // 확인한 바로 그 커밋을 올린다(이미 올라가 있으면 아무 일도 없다)
  log(`올리는 중… (${d.title})`);
  await push();
  const seen = (await run("gh", ["pr", "view", branch, "--json", "url,state,baseRefName,headRefName"], { allowFail: true })).out.trim();
  if (seen.startsWith("{")) {
    const pr = JSON.parse(seen);
    url = pr.url;
    if (pr.baseRefName !== "main" || pr.headRefName !== branch) throw fail("이 가지의 PR이 main으로 가는 것이 아니에요 — GitHub에서 확인해 주세요: " + url);
    if (pr.state === "CLOSED") throw fail("지난번 PR이 병합 없이 닫혀 있어요 — GitHub에서 확인해 주세요: " + url);
    if (pr.state === "MERGED") return goHome(git, log, branch, url, images.length);
  } else
    url = rows(
      await gh("pr", "create", "--base", "main", "--head", branch, "--title", d.title, "--body", d.body + "\n\n그림 총괄 페이지의 '사이트에 올리기'로 올림.")
    ).pop();

  const deadline = Date.now() + (ctx.maxWaitMs || 25 * 60000),
    behind = async () => !(await yes("merge-base", "--is-ancestor", "origin/main", sha));
  log("GitHub 검사를 기다리는 중… " + url);
  for (let synced = 0; ;) {
    await git("fetch", "origin", "--quiet");
    if (await behind()) {
      // ④ 그 사이 main이 바뀜 → 합치고 다시 빌드해 올린 뒤, 새 커밋의 검사를 기다린다(세 번까지)
      if (synced++ >= 3) throw fail("main이 계속 바뀌어 병합하지 못했어요 — 잠시 뒤 다시 눌러 주세요: " + url);
      log("그 사이 main이 바뀌어 다시 맞추는 중…");
      await sync(sha);
      ({ sha, images } = await gate());
      await push();
      log("GitHub 검사를 기다리는 중… " + url);
      continue;
    }
    const pr = JSON.parse(await gh("pr", "view", url, "--json", "state,headRefOid,baseRefName"));
    if (pr.state === "MERGED") break;
    if (pr.state !== "OPEN") throw fail("PR이 닫혀 있어요 — GitHub에서 확인해 주세요: " + url);
    if (pr.baseRefName !== "main") throw fail("PR이 main으로 가는 것이 아니에요 — GitHub에서 확인해 주세요: " + url);
    if (pr.headRefOid === sha) {
      // ⑤ 그 커밋(sha)의 PR 워크플로 실행을 직접 읽는다 — 실행마다 어느 커밋·어느 가지·어느 워크플로 파일의 것인지 적혀 온다
      const q = `repos/{owner}/{repo}/actions/runs?head_sha=${sha}&event=pull_request&per_page=100`,
        pick = ".workflow_runs | map({path, head_sha, head_branch, event, status, conclusion, run_number})",
        out = (await run("gh", ["api", q, "--jq", pick], { allowFail: true })).out.trim();
      const v = verdict(out.startsWith("[") ? JSON.parse(out) : [], sha, branch);
      if (v.startsWith("fail")) throw fail(`검사가 떨어져 병합하지 않았어요(${v.slice(6)}) — PR은 열어 뒀어요: ${url}`);
      if (v === "pass") {
        await git("fetch", "origin", "--quiet");
        if (await behind()) continue; // 병합 직전에 main이 또 바뀜 → 다시 맞춘다
        // 이 가지로 연 PR이 (닫힌 것까지 쳐서) 이것 하나뿐인지 — 같은 커밋으로 다른 곳에 가는 PR이 있었으면 그쪽 검사의 성공과 가를 수 없다
        const prs = JSON.parse(await gh("pr", "list", "--head", branch, "--state", "all", "--json", "url,baseRefName"));
        if (prs.length !== 1 || prs[0].url !== url || prs[0].baseRefName !== "main")
          throw fail("이 가지로 연 PR이 이것 하나가 아니라 병합하지 않았어요 — GitHub에서 확인해 주세요: " + url);
        log("병합하는 중…");
        await gh("pr", "merge", url, "--merge", "--match-head-commit", sha);
        break;
      }
    }
    if (Date.now() > deadline) throw fail("검사가 오래 걸려 기다리기를 멈췄어요 — 나중에 '사이트에 올리기'를 다시 누르면 이어서 확인해요: " + url);
    await wait(15000);
  }
  return goHome(git, log, branch, url, images.length);
}
/** 병합된 뒤 — 전용 가지로 돌아와 main과 맞추고, 올리는 데 쓴 로컬 가지를 지운다(원격 가지는 두어 둠) */
async function goHome(git, log, branch, url, count) {
  log("정리하는 중…");
  await git("fetch", "origin", "--quiet");
  await git("checkout", "-q", HOME);
  await git("merge", "-q", "--ff-only", "origin/main");
  await git("branch", "-q", "-d", branch);
  return { url, count };
}
