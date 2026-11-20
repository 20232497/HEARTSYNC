// 그림 총괄 페이지 열기 — 바탕화면 바로가기가 부른다(npm run art:open). 그림 전용 작업 사본(가지 art/site)을 main과 맞추고, 빌드하고, 서버를 켜고, 브라우저에 페이지를 연다.
// 이미 켜져 있으면 브라우저만 연다. 올리던 일이 남아 있거나(가지 art/upload-…) 아직 안 올린 그림이 있으면 main과 맞추지 않고 그대로 연다(페이지의 '사이트에 올리기'가 이어서 함).
// 그림 전용 작업 사본이 아닌 곳에서 돌려도 열리지만, 거기서는 '사이트에 올리기'가 눌리지 않는다(tools/art/publish.mjs).
//   node tools/art-launch.mjs [--port 5199] [--no-open]
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { HOME } from "./art/publish.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pi = process.argv.indexOf("--port"),
  PORT = pi >= 0 ? +process.argv[pi + 1] || 5199 : 5199,
  URL0 = `http://127.0.0.1:${PORT}/`;
const say = (t) => console.log("· " + t);
const git = (...a) => execFileSync("git", a, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const open = () => {
  if (process.argv.includes("--no-open")) return;
  // Windows: start, macOS: open, 그 밖: xdg-open — 못 열어도 주소는 찍어 둔다
  const [cmd, args] = process.platform === "win32" ? ["cmd", ["/c", "start", "", URL0]] : [process.platform === "darwin" ? "open" : "xdg-open", [URL0]];
  try {
    spawn(cmd, args, { stdio: "ignore", detached: true }).unref();
  } catch {
    /* 주소를 직접 열면 됨 */
  }
};

const up = await fetch(URL0 + "api/meta").then(
  (r) => r.ok,
  () => false
);
if (up) {
  say("이미 켜져 있어요 — 브라우저만 열어요: " + URL0);
  open();
  process.exit(0);
}
try {
  const branch = git("rev-parse", "--abbrev-ref", "HEAD");
  if (branch === HOME) {
    say("main과 맞추는 중…");
    git("fetch", "origin", "--quiet");
    // 안 올린 그림이 있어도 새 파일뿐이면 그대로 앞으로 간다. 겹치면 그대로 두고 연다
    if (git("rev-list", "--count", "origin/main..HEAD") === "0") git("merge", "-q", "--ff-only", "origin/main");
  } else say(`지금 가지는 ${branch} — main과 맞추지 않고 그대로 열어요.`);
} catch (e) {
  say(
    "main과 맞추지 못했어요(인터넷 연결·겹친 파일) — 그대로 열어요: " +
      String((e && e.stderr) || (e && e.message) || e)
        .trim()
        .split("\n")[0]
  );
}
if (!fs.existsSync(path.join(ROOT, "node_modules", "espree"))) {
  say("빌드 도구를 받는 중…(처음 한 번, 1~2분)");
  execFileSync(process.platform === "win32" ? "npm.cmd" : "npm", ["ci"], { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" });
}
say("빌드하는 중…");
execFileSync(process.execPath, ["tools/build.mjs"], { cwd: ROOT, stdio: ["ignore", "ignore", "inherit"] });
await import("./art.mjs"); // 서버가 켜진다(끄려면 이 창을 닫거나 Ctrl+C)
setTimeout(open, 600);
