// 그림 총괄 페이지를 혼자 쓰기 위한 준비(이 PC에서 한 번 — npm run art:setup). 저장소 밖에 두 가지를 만든다:
//   ① 그림 전용 작업 사본 <홈>/HEARTSYNC-art-site (가지 art/site, 늘 main과 같게 두는 곳 — 여기서 그림을 싣고 올린다. 다른 작업 사본·세션의 일과 섞이지 않는다)
//   ② 바탕화면 바로가기 'HEART SYNC 그림 총괄' → 보관함의 '그림 총괄 열기.cmd' → 전용 작업 사본에서 node tools/art-launch.mjs
// 다시 돌려도 된다(있는 것은 그대로 둔다). 지우려면 바로가기와 cmd를 지우고 `git worktree remove <홈>/HEARTSYNC-art-site`.
//   node tools/art-setup.mjs [--site <폴더>] [--no-shortcut]
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { HOME, MARK } from "./art/publish.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (n) => {
  const i = process.argv.indexOf("--" + n);
  return i >= 0 ? process.argv[i + 1] : "";
};
const SITE = path.resolve(arg("site") || path.join(os.homedir(), "HEARTSYNC-art-site")),
  LIB = path.join(os.homedir(), "HEARTSYNC-art"),
  CMD = path.join(LIB, "그림 총괄 열기.cmd");
const git = (cwd, ...a) => execFileSync("git", a, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const say = (t) => console.log("· " + t);

const mark = () => path.resolve(SITE, git(SITE, "rev-parse", "--git-path", MARK));
if (fs.existsSync(SITE)) {
  // 있는 폴더는 우리가 만든 사본(표식이 있거나, 이 저장소의 작업 사본이면서 전용 가지)일 때만 쓴다 — 남의 폴더를 전용 사본으로 삼지 않는다
  // 이 저장소의 작업 사본인지는 git 공용 폴더가 같은지로 본다(이름만 같은 다른 저장소를 쓰지 않게)
  const common = (dir) => fs.realpathSync(path.resolve(dir, git(dir, "rev-parse", "--git-common-dir")));
  const ours =
    fs.existsSync(path.join(SITE, ".git")) &&
    common(SITE) === common(ROOT) &&
    (fs.existsSync(mark()) || git(SITE, "rev-parse", "--abbrev-ref", "HEAD") === HOME);
  if (!ours) throw new Error("이미 있는 폴더인데 그림 전용 작업 사본이 아니에요 — 다른 자리를 --site로 주세요: " + SITE);
  say("그림 전용 작업 사본이 이미 있어요: " + SITE);
} else {
  say("그림 전용 작업 사본을 만드는 중… " + SITE);
  git(ROOT, "fetch", "origin", "--quiet");
  // 전용 가지가 이미 있으면 그대로 쓴다(되감지 않음), 없으면 main에서 새로
  const has = git(ROOT, "branch", "--list", HOME) !== "";
  git(ROOT, "worktree", "add", ...(has ? [SITE, HOME] : ["-b", HOME, SITE, "origin/main"]));
}
fs.writeFileSync(mark(), "그림 총괄 페이지의 '사이트에 올리기'가 도는 작업 사본(tools/art-setup.mjs)\n");
fs.mkdirSync(LIB, { recursive: true });
// 창을 닫으면 서버도 꺼진다. 오류가 나면 창이 바로 닫히지 않게 멈춰 둔다. (한글이 깨지지 않게 UTF-8로)
const body =
  `@echo off\r\nchcp 65001 >nul\r\ntitle HEART SYNC 그림 총괄\r\ncd /d "${SITE.replace(/%/g, "%%")}" || (echo 그림 전용 작업 사본을 찾지 못했어요. & pause & exit /b 1)\r\n` +
  `set B=\r\nfor /f "delims=" %%b in ('git rev-parse --abbrev-ref HEAD') do set B=%%b\r\n` +
  `if not exist tools\\art-launch.mjs if "%B%"=="${HOME}" (\r\n  git fetch origin --quiet\r\n  git merge -q --ff-only origin/main\r\n)\r\n` +
  `if not exist tools\\art-launch.mjs (\r\n  echo 그림 총괄 페이지가 아직 main에 들어오지 않았어요. 병합된 뒤에 다시 열어 주세요.\r\n  pause\r\n  exit /b 1\r\n)\r\n` +
  `node tools\\art-launch.mjs\r\nif errorlevel 1 pause\r\n`;
fs.writeFileSync(CMD, body, "utf8"); // BOM 없이 — 있으면 첫 줄이 깨진다
say("여는 파일: " + CMD);
if (process.platform === "win32" && !process.argv.includes("--no-shortcut")) {
  // 바탕화면 자리는 Windows에 묻는다(OneDrive로 옮겨져 있을 수 있음)
  const ps =
    `$d=[Environment]::GetFolderPath('Desktop');$s=(New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $d 'HEART SYNC 그림 총괄.lnk'));` +
    `$s.TargetPath='${CMD.replace(/'/g, "''")}';$s.WorkingDirectory='${SITE.replace(/'/g, "''")}';$s.Description='그림을 그리고 골라 사이트에 올리기';$s.Save();Write-Output $s.FullName`;
  say("바탕화면 바로가기: " + execFileSync("powershell.exe", ["-NoProfile", "-Command", ps], { encoding: "utf8" }).trim());
}
say("끝. 바로가기를 더블클릭하면 서버가 켜지고 브라우저에 페이지가 열려요.");
