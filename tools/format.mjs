// 코드 정렬(npm run format · npm run format:check): 정렬 도구 prettier로 src/js·tools·tests의 .js/.mjs를 한 모양으로 맞춘다 — 한 줄 160자(.prettierrc.json).
// 병합 전 검사(npm run check)도 이 파일의 runFormat으로 정렬 여부를 본다(정렬 안 된 파일이 있으면 실패 — 2026-11-11 사용자 결정, 프레임 5차 2부).
// 정렬 대상은 FORMAT_GLOBS 한 곳. 작품의 글(content/)·CSS·HTML·문서·빌드 결과물은 정렬하지 않는다(.prettierignore)
//   node tools/format.mjs           고쳐 씀(커밋 전에 한 번)
//   node tools/format.mjs --check   정렬 안 된 파일만 알림(고치지 않음)
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const FORMAT_GLOBS = ["src/js/**/*.js", "tools/**/*.mjs", "tests/**/*.mjs"];
/**
 * prettier를 돌림. @param {boolean} write 참이면 고쳐 쓰고, 거짓이면 정렬 안 된 파일을 찾기만
 * @returns {{ ok: boolean, files: string[], missing: boolean, err: string }} files = 정렬 안 된 파일(찾기만 할 때), missing = prettier가 깔려 있지 않음
 */
export function runFormat(write) {
  const bin = path.join(ROOT, "node_modules", "prettier", "bin", "prettier.cjs");
  if (!fs.existsSync(bin)) return { ok: false, files: [], missing: true, err: "" };
  try {
    // 찾기만 할 때는 정렬 안 된 파일 이름이 stdout으로 나옴(--log-level warn을 주면 그 이름까지 숨겨져서 주지 않음)
    execFileSync(process.execPath, [bin, ...(write ? ["--write", "--log-level", "warn"] : ["--list-different"]), ...FORMAT_GLOBS], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    return { ok: true, files: [], missing: false, err: "" };
  } catch (e) {
    return {
      ok: false,
      files: String(e.stdout || "")
        .split(/\r?\n/)
        .filter(Boolean),
      missing: false,
      err: String(e.stderr || "").trim()
    };
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes("--check"),
    r = runFormat(!check);
  if (r.missing) console.error("✗ 정렬 도구(prettier)가 깔려 있지 않아요 — npm ci");
  else if (r.ok) console.log(check ? "✓ 코드 정렬이 맞아요" : "✓ 정렬했어요 — 바뀐 파일이 있으면 같이 커밋하세요(npm run build도 다시)");
  else if (r.files.length) console.error(`✗ 정렬이 안 된 파일 ${r.files.length}개 — npm run format\n` + r.files.map((f) => "  - " + f).join("\n"));
  else console.error("✗ 정렬 도구가 실패했어요(문법 오류일 수 있어요)\n" + r.err);
  process.exit(r.ok ? 0 : 1);
}
