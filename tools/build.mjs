// HEART SYNC 빌드: src/(뼈대·CSS·ES 모듈)와 content/(작품 폴더)를 합쳐 저장소 루트에 한 파일씩 만든다 — 대상(TARGETS) 둘:
//   user  → index.html  사용자 사이트. GitHub Pages·로컬 파일(file://)·claude.ai artifact가 그대로 띄우는 배포물. 주석을 벗기고 빈 줄을 지워 작게(아래 '주석 정책')
//   admin → admin.html  관리자 도구(커밋·배포됨 — 웹에서는 비밀번호 관문 src/js/admin/gate.js). 같은 소스 + src/js/admin/ 모듈. 주석을 모두 남기고 모듈마다 설명 머리(가져옴·내보냄·쓰는 곳)를 붙임
//   node tools/build.mjs                 둘 다 만들기 (npm run build)
//   node tools/build.mjs --only user     하나만 (Vercel은 사용자 사이트만)
//   node tools/build.mjs --check         index.html·admin.html이 지금 소스로 만든 결과와 같은지만 확인 (npm run check, GitHub Actions)
//
// 모듈 번들: 진입점(src/js/main.js 또는 admin.js)에서 import를 따라가며 모듈을 읽고, 의존 모듈이 먼저 오도록 순서를 정한 뒤 import/export 줄만 벗겨
// 이어 붙인다(모듈 안의 줄 번호는 그대로 — 사용자 빌드는 빈 줄을 지우므로 .build/linemap.json으로 원본 줄을 찾는다). 그 전에 검사한다 —
// 선언도 import도 안 된 이름, export 안 된 이름 import, 같은 이름 두 번 선언, import한 바인딩에 대입, 맨 윗단(함수 밖)에서 뒤에 오는 모듈의 const/class 사용(순환 의존),
// 인라인 스크립트 문법, 오래된 iOS 문법.
//
// 주석 정책(사용자 요청 2026-11): 소스(src/)에는 설명을 자세히 쓴다. 사용자 빌드는 JS·CSS·HTML 주석을 모두 벗기되 `//!`·`/*!`·`<!--!`로 시작하는 것만 남기고,
// 모듈마다 `/* ── 파일 — 첫 줄 설명의 첫 문장 */` 한 줄을 붙인다. 관리자 빌드는 주석을 모두 남긴다. 결과 파일은 둘 다 고치지 않는다(src/를 고치고 다시 빌드).
//
// 파일 구성(2026-11-12 프레임 5차 — 한 파일이던 것을 역할별로 나눔, 코드는 그대로 옮김): 이 파일은 진입점(대상 하나 만들기 build·전부 buildAll·명령줄)이고 나머지는 tools/build/ 에
//   common.mjs        폴더 위치·TARGETS·AUD_DIRS·BuildError·읽기 쓰기 도우미
//   bundle.mjs        뼈대 펼치기 + 모듈 번들러(모듈 검사) + 주석 벗기기
//   app-rules.mjs     작품 검사에 쓰는 앱 규칙을 src/js에서 꺼냄(APP_RULES)
//   content.mjs       content/ 읽기 → generated.js (폴더 구조·순서 잠금)
//   work-check.mjs    작품 하나의 검사(checkWork) · episode-check.mjs 에피소드 진행표 · images-scan.mjs 그림 파일 이름
//   output-check.mjs  결과 검사(스크립트 문법·오래된 iOS 문법·들어가면 안 되는 것)
// 다른 도구와 시험이 가져다 쓰는 이름(ROOT·TARGETS·AUD_DIRS·BuildError·appRules·buildContent·checkWork·scanImages·checkForbidden·build·buildAll)은 전처럼 이 파일에서 내보냄
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { appRules } from "./build/app-rules.mjs";
import { assemble } from "./build/bundle.mjs";
import { BUILD_DIR, BuildError, LS, PS, ROOT, SIZE_LIMITS, SRC, TARGETS, readText } from "./build/common.mjs";
import { buildContent } from "./build/content.mjs";
import { checkDocs } from "./build/docs-check.mjs";
import { checkForbidden, checkScripts } from "./build/output-check.mjs";
import { checkBase, readBaseLocks } from "./content-lock.mjs";

export { appRules } from "./build/app-rules.mjs";
export { AUD_DIRS, BuildError, ROOT, TARGETS } from "./build/common.mjs";
export { buildContent } from "./build/content.mjs";
export { scanImages } from "./build/images-scan.mjs";
export { checkForbidden } from "./build/output-check.mjs";
export { checkWork } from "./build/work-check.mjs";

/* 대상 하나를 만든다(content/는 buildAll이 먼저). 결과 HTML과 줄 지도를 돌려주고 지도는 .build/에도 남김 */
export async function build(name = "user") {
  const t = TARGETS[name];
  if (!t) throw new BuildError([`모르는 빌드 대상 ${name} (가능: ${Object.keys(TARGETS).join(", ")})`]);
  if (!fs.existsSync(path.join(SRC, t.page))) throw new BuildError([`src/${t.page}이 없어요`]);
  const { html: raw, map, css, bundle } = await assemble(t);
  const html = raw
    .replace(/<\/script(?![\s>])/gi, "<\\/script")
    .split(LS)
    .join("\\u2028")
    .split(PS)
    .join("\\u2029");
  const errors = checkScripts(html, map, t.out);
  errors.push(...checkForbidden(html, name));
  if (errors.length) throw new BuildError(errors);
  fs.mkdirSync(BUILD_DIR, { recursive: true });
  fs.writeFileSync(path.join(BUILD_DIR, t.linemap), JSON.stringify(map));
  return { name, out: path.join(ROOT, t.out), file: t.out, html, map, css, modules: bundle.count, warnings: bundle.warnings, sizes: bundle.sizes };
}
/** 크기 기준 요약 한 줄(알림 — 경고·실패 아님): 용량 기준을 넘는 모듈 수(큰 것 셋의 이름)와 기준보다 긴 줄 수. 두 빌드에 같이 든 모듈은 한 번만 셈. @param {{ rel: string, bytes: number, long: number }[]} sizes */
export function sizeNote(sizes) {
  const all = [...new Map(sizes.map((s) => [s.rel, s])).values()],
    kb = (n) => (n / 1024).toFixed(1) + "KB";
  const big = all.filter((s) => s.bytes > SIZE_LIMITS.moduleBytes).sort((a, b) => b.bytes - a.bytes),
    long = all.filter((s) => s.long),
    lines = long.reduce((n, s) => n + s.long, 0);
  return `크기 기준(알림): ${kb(SIZE_LIMITS.moduleBytes)}를 넘는 모듈 ${big.length}개${
    big.length
      ? `(${big
          .slice(0, 3)
          .map((s) => `${s.rel.replace("src/js/", "")} ${kb(s.bytes)}`)
          .join(", ")}${big.length > 3 ? " …" : ""})`
      : ""
  } · ${SIZE_LIMITS.lineChars}자를 넘는 줄 ${lines}개(모듈 ${long.length}/${all.length}개)`;
}
/* content/ 검사·생성 한 번 + 대상들 */
export async function buildAll(names = Object.keys(TARGETS)) {
  const content = await buildContent(appRules());
  const outs = [];
  for (const n of names) outs.push(await build(n));
  return { content, outs };
}

/* ---------------------------------------------------------------- 명령줄 */
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2),
    check = argv.includes("--check"),
    oi = argv.indexOf("--only");
  const names = oi >= 0 ? [argv[oi + 1]] : Object.keys(TARGETS);
  try {
    const { content, outs } = await buildAll(names);
    [...new Set([...content.warnings, ...outs.flatMap((o) => o.warnings)])].forEach((x) => console.warn("⚠ " + x));
    const s = content.stats;
    console.log(`작품 ${s.works}개(여성향 ${s.f} · 남성향 ${s.m} · 전체 ${s.all}), 홈 줄 ${s.rows}개, 실린 그림 ${s.pics}장`);
    let fail = false;
    // 순서 잠금이 지금 내용보다 뒤처져 있으면(뒤에 더한 항목·고친 이름): 빌드는 알리기만 하고, 병합 전 검사(--check)는 실패로 — main에 들어간 것은 모두 잠긴 상태가 되게(2026-11-11 사용자 결정)
    if (s.stale.length) {
      const what = `순서 잠금: 아직 안 잠긴 것 ${s.unlocked}개(작품 ${s.stale.join(", ")})`;
      if (check) {
        fail = true;
        console.error(`✗ ${what} — npm run content:lock을 돌려 lock.json을 같이 커밋하세요.`);
      } else console.log(`${what} — 커밋 전에 npm run content:lock`);
    }
    // 병합 전 검사는 기준 가지의 잠금과도 견줌(content-lock.mjs checkBase) — 작업 폴더의 lock.json을 지우거나 손으로 고쳐 다시 찍는 우회를 막음.
    // 기준 가지는 origin/main, CI는 LOCK_BASE로 알려 줌(그때는 못 읽으면 실패). git이 없는 폴더에서는 건너뛰고 알리기만
    if (check) {
      const ref = process.env.LOCK_BASE || "origin/main",
        base = readBaseLocks(ref, ROOT);
      if (!base && process.env.LOCK_BASE) {
        fail = true;
        console.error(`✗ 순서 잠금: 기준 가지(${ref})를 읽지 못했어요 — 가지를 받아 왔는지(기록 전체) 확인하세요.`);
      } else if (!base) console.log(`순서 잠금: 기준 가지(${ref})를 읽지 못해 견주기를 건너뛰었어요(git이 없거나 가지를 받아 오지 않음)`);
      else {
        const r = checkBase(base.locks, content.locks),
          at = `${ref} ${base.at.slice(0, 7)}`;
        r.notes.forEach((x) => console.log("순서 잠금: " + x));
        if (r.errors.length) {
          fail = true;
          console.error(
            `✗ 순서 잠금이 기준 가지(${at})의 잠금과 어긋나요 — 잠금 파일을 지우거나 고쳐 다시 찍어도 이미 공개된 자리는 바뀌지 않아요\n` +
              r.errors.map((x) => "  - " + x).join("\n") +
              "\n  새 항목은 맨 뒤에 더하고 순서는 그대로 두세요. 사용자 승인을 받아 강제로 다시 찍은 것이면 이 검사는 실패하는 것이 정상이에요 — 병합 담당이 승인을 확인하고 병합해요(docs/TEAM.md)."
          );
        } else console.log(`✓ 순서 잠금이 기준 가지(${at})의 잠금 ${base.locks.length}개와 맞아요`);
      }
    }
    for (const o of outs) {
      const cur = fs.existsSync(o.out) ? readText(o.out) : null,
        same = cur === o.html;
      const info = `${(Buffer.byteLength(o.html) / 1024).toFixed(0)}KB · CSS ${o.css}개 · 모듈 ${o.modules}개`;
      if (check) {
        if (!same) {
          fail = true;
          console.error(
            `✗ ${o.file}이 src/·content/로 만든 결과와 달라요. ${o.file}을 직접 고쳤거나 빌드를 안 했어요 → npm run build 후 ${o.file}도 같이 커밋하세요.`
          );
        } else console.log(`✓ ${o.file}이 소스와 같아요 (${info})`);
      } else {
        if (!same) fs.writeFileSync(o.out, o.html);
        console.log(`${same ? "= " + o.file + " 그대로" : "✓ " + o.file + " 만듦"} (${info} · ${TARGETS[o.name].label})`);
      }
    }
    console.log(sizeNote(outs.flatMap((o) => o.sizes)));
    // 병합 전 검사는 문서도 봄(build/docs-check.mjs): CLAUDE.md의 크기 상한, 지도 표와 영역 문서가 가리키는 경로가 실제로 있는지
    if (check) {
      const at = (p) => path.join(ROOT, p),
        text = (p) => (fs.existsSync(at(p)) ? readText(at(p)) : null),
        d = checkDocs(text("CLAUDE.md"), (p) => fs.existsSync(at(p)), text);
      if (d.errors.length) {
        fail = true;
        console.error("✗ 문서 검사\n" + d.errors.map((x) => "  - " + x).join("\n"));
      } else console.log("✓ " + d.note);
    }
    if (fail) process.exit(1);
  } catch (e) {
    if (!(e instanceof BuildError)) throw e;
    console.error("✗ 빌드 실패\n" + e.list.map((x) => "  - " + x).join("\n"));
    process.exit(1);
  }
}
