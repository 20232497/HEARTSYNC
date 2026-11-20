// 그림 총괄 페이지의 '사이트에 올리기' — 실은 그림을 빌드해 커밋하고, 올리고(push), PR을 만들고, GitHub 검사가 통과하면 main에 병합한다. 병합되면 GitHub Pages가 사이트를 다시 낸다.
// 사용자가 페이지에서 단추를 눌렀을 때만 돈다(2026-11-21 사용자 결정 — 사용자가 직접 올리는 그림은 '병합 담당 세션만 올린다'의 예외, docs/TEAM.md).
// 그림 전용 작업 사본(가지 art/site — npm run art:setup이 만듦)에서만 된다: 그 사본은 늘 main과 같고 바뀌는 것은 실은 그림뿐이라, 다른 작업이 딸려 올라가지 않는다.
// 올라가는 것은 content/…/images/의 그림과 빌드 결과(index.html·admin.html)뿐 — 그 밖에 바뀐 파일이 있으면 멈춘다. 검사가 떨어지면 병합하지 않고 PR을 열어 둔다.
// 중간에 끊겨도(창을 닫음·검사 실패) 단추를 다시 누르면 올리던 가지(art/upload-…)에서 이어서 한다.
// 명령은 run(프로그램, 인자, { allowFail }) → { code, out }으로만 부른다 — 단위 시험이 가짜 run으로 순서와 멈추는 자리를 본다.
export const HOME = "art/site";
const UPLOAD = /^art\/upload-\d{8}-\d{6}$/;
const IMG = /^content\/[\w/.-]+\/images\/[\w.-]+\.(webp|png|jpe?g)$/i;
const BUILT = ["index.html", "admin.html"];
const lines = (s) =>
  String(s)
    .split(/\r?\n/)
    .filter((l) => l.trim());

/** git status --porcelain 줄들 → 올릴 그림과 그 밖에 바뀐 파일(빌드 결과는 어느 쪽도 아님 — 올릴 때 다시 만든다) */
export function sortChanges(porcelain) {
  const images = [],
    others = [];
  for (const line of lines(porcelain)) {
    const p = line.slice(3).replace(/^"|"$/g, "").split(" -> ").pop();
    if (IMG.test(p)) images.push(p);
    else if (!BUILT.includes(p)) others.push(p);
  }
  return { images, others };
}
/** 커밋·PR 제목과 본문 — 작품마다 올리는 그림 이름 */
export function describe(images) {
  const by = {};
  for (const p of images) {
    const m = /^content\/(?:.*\/)?([\w-]+)\/images\/([\w.-]+)\.\w+$/.exec(p);
    (by[m[1]] = by[m[1]] || []).push(m[2]);
  }
  const ids = Object.keys(by).sort();
  return { title: `그림 싣기: 작품 ${ids.length}개 · ${images.length}장`, body: ids.map((id) => `- ${id}: ${by[id].sort().join(", ")}`).join("\n") };
}
/** gh pr checks의 결과 → "pass" · "pending" · "fail: 이름…" (검사가 아직 하나도 안 붙었으면 기다림) */
export function verdict(checks) {
  const bad = checks.filter((c) => c.bucket === "fail" || c.bucket === "cancel").map((c) => c.name);
  if (bad.length) return "fail: " + bad.join(", ");
  return !checks.length || checks.some((c) => c.bucket === "pending") ? "pending" : "pass";
}
const stamp = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);

/** 지금 상태 — 올릴 수 있는지와 올릴 그림. { branch, home, upload(지난번 올리기가 끝나지 않음), images, others } */
export async function status(run) {
  const git = async (...a) => (await run("git", a)).out;
  const branch = (await git("rev-parse", "--abbrev-ref", "HEAD")).trim();
  return { branch, home: branch === HOME, upload: UPLOAD.test(branch), ...sortChanges(await git("status", "--porcelain", "--untracked-files=all")) };
}

/** 올리기 — ctx: { run, log(글), wait(ms), build(), now?, maxWaitMs? }. 끝나면 { url, count }. 멈출 일이 있으면 이유를 적어 던진다(PR 주소가 있으면 e.url) */
export async function publish(ctx) {
  const { run, log, wait, build } = ctx;
  const git = async (...a) => (await run("git", a)).out;
  const gh = async (...a) => (await run("gh", a)).out;
  const st = await status(run);
  let branch = st.branch,
    url = "",
    images = st.images;
  const fail = (text) => Object.assign(new Error(text), { url });
  // 이 PC의 git에 작성자 설정이 없으면 main의 가장 최근 커밋 작성자를 쓴다(설정은 바꾸지 않음) — 커밋과 병합 커밋에 붙인다
  let who = null;
  const signed = async (...a) => {
    if (!who) {
      const named = (await run("git", ["config", "user.name"], { allowFail: true })).out.trim(),
        w = named ? [] : lines(await git("log", "-1", "--no-merges", "--format=%an%n%ae", "origin/main"));
      who = w.length ? ["-c", "user.name=" + w[0], "-c", "user.email=" + w[1]] : [];
    }
    return [...who, ...a];
  };
  if (st.home) {
    if (st.others.length) throw fail("그림 말고 바뀐 파일이 있어요 — 올리지 않았어요: " + st.others.slice(0, 5).join(", "));
    if (!images.length) throw fail("올릴 그림이 없어요 — 먼저 후보에서 '싣기'를 눌러 주세요.");
    log("main과 맞추는 중…");
    await git("fetch", "origin", "--quiet");
    if ((await git("rev-list", "--count", "origin/main..HEAD")).trim() !== "0")
      throw fail("이 작업 사본에 main에 없는 커밋이 있어요 — 그림 전용 작업 사본이 맞는지 확인해 주세요.");
    await git("merge", "-q", "--ff-only", "origin/main"); // 바뀐 것이 그림뿐이라 그대로 앞으로 간다(같은 그림을 main이 바꿨으면 여기서 멈춤)
    log("빌드하는 중…");
    await build();
    const d = describe(images);
    branch = "art/upload-" + (ctx.now || stamp)();
    await git("checkout", "-q", "-b", branch);
    await git("add", "--", ...images, ...BUILT);
    await git(...(await signed("commit", "-q", "-m", d.title, "-m", d.body)));
  } else if (st.upload) {
    // 지난번 올리기가 끝나지 않음(검사 실패·창을 닫음·연결 끊김) → 그 가지에서 이어서
    log("지난번 올리기를 이어서 하는 중…");
    await git("fetch", "origin", "--quiet");
    images = sortChanges(
      lines(await git("diff", "--name-only", "origin/main...HEAD"))
        .map((p) => "A  " + p)
        .join("\n")
    ).images;
    const v = (await run("gh", ["pr", "view", branch, "--json", "url,state"], { allowFail: true })).out.trim();
    if (v.startsWith("{")) {
      const pr = JSON.parse(v);
      url = pr.url;
      if (pr.state === "CLOSED") throw fail("지난번 PR이 병합 없이 닫혀 있어요 — GitHub에서 확인해 주세요: " + url);
      if (pr.state === "MERGED") return goHome(git, log, branch, url, images.length);
    }
  } else throw fail(`올리기는 그림 전용 작업 사본(가지 ${HOME})에서만 돼요 — 지금 가지: ${branch}. 바탕화면의 '그림 총괄' 바로가기로 열어 주세요.`);
  if (!url) {
    const d = describe(images);
    log(`올리는 중… (${d.title})`);
    await git("push", "-q", "-u", "origin", branch);
    url = lines(
      await gh("pr", "create", "--base", "main", "--head", branch, "--title", d.title, "--body", d.body + "\n\n그림 총괄 페이지의 '사이트에 올리기'로 올림.")
    ).pop();
  }

  const deadline = Date.now() + (ctx.maxWaitMs || 25 * 60000);
  for (let round = 0; ; round++) {
    log("GitHub 검사를 기다리는 중… " + url);
    for (;;) {
      // gh pr checks는 검사가 도는 중이거나 떨어졌을 때 0이 아닌 값으로 끝난다 → 출력만 읽는다
      const out = (await run("gh", ["pr", "checks", url, "--json", "name,bucket"], { allowFail: true })).out.trim();
      const v = verdict(out.startsWith("[") ? JSON.parse(out) : []);
      if (v === "pass") break;
      if (v !== "pending") throw fail(`검사가 떨어져 병합하지 않았어요(${v.slice(6)}) — PR은 열어 뒀어요: ${url}`);
      if (Date.now() > deadline) throw fail("검사가 오래 걸려 기다리기를 멈췄어요 — 나중에 '사이트에 올리기'를 다시 누르면 이어서 확인해요: " + url);
      await wait(15000);
    }
    let m = JSON.parse(await gh("pr", "view", url, "--json", "mergeable,state"));
    for (let i = 0; m.mergeable === "UNKNOWN" && m.state === "OPEN" && i < 8; i++) {
      await wait(5000); // GitHub가 병합할 수 있는지 아직 계산하는 중
      m = JSON.parse(await gh("pr", "view", url, "--json", "mergeable,state"));
    }
    if (m.state === "MERGED") break;
    if (m.mergeable !== "CONFLICTING") {
      log("병합하는 중…");
      await gh("pr", "merge", url, "--merge");
      break;
    }
    // 기다리는 사이 main이 바뀜 — 겹치는 것이 빌드 결과뿐이면 main을 합치고 다시 빌드해 올린다(두 번까지)
    if (round >= 2) throw fail("main이 계속 바뀌어 병합하지 못했어요 — 잠시 뒤 다시 눌러 주세요: " + url);
    log("그 사이 main이 바뀌어 다시 맞추는 중…");
    await git("fetch", "origin", "--quiet");
    if ((await run("git", await signed("merge", "--no-edit", "origin/main"), { allowFail: true })).code) {
      const clash = lines(await git("diff", "--name-only", "--diff-filter=U"));
      if (clash.some((p) => !BUILT.includes(p))) {
        await git("merge", "--abort");
        throw fail(`main과 겹치는 파일이 있어 멈췄어요(${clash.join(", ")}) — PR은 열어 뒀어요: ${url}`);
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
    await git("push", "-q", "origin", branch);
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
