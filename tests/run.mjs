// 흐름 시험(npm run e2e): 저장소 루트를 정적 서버로 띄우고 tests/e2e/*.mjs를 차례로 돌린 뒤, 각 스크립트가 찍은 결과 JSON의
// 오류 칸(fail·error·errors·errs·pageerror)이 비었는지로 통과를 판정한다(스크립트 자체는 늘 exit 0으로 끝남).
// 브라우저가 없으면 먼저: npx playwright install webkit chromium
//   node tests/run.mjs            전부
//   node tests/run.mjs chatflow   하나만(이름 여러 개 가능)
// 스크린샷은 tests/.shots/ (git에 안 들어감)
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { serve, ROOT } from "./serve.mjs";

const SUITES = {
  social: "소셜 로그인·가입, 기기 그림 넘기기·합치기, 키 잠금 암호(Supabase를 page.route로 흉내)",
  vault: "API 키 금고: 가입·다른 기기 로그인·메일 링크 기기 잠김·비밀번호 재설정·로그아웃",
  cloud2: "계정 저장: 올리기·받기·서버 표 제약(kv_no_plain_keys·kv_vault_sealed)",
  audience: "관심있는 대화(전체·남성향·여성향) 첫 시작 창 → 홈 필터 → 설정 → 신작 대화방",
  chatflow: "대화방: 스트리밍 표시, 자동 스크롤 끔/켬, AI 추천 수동, 출력 설정, 설정 페이지",
  mobile: "휴대폰 셸: iPhone 13·SE(WebKit)·Galaxy(Chromium)에서 표준 모드·탭바·가로 넘침 없음",
  file: "파일(file://)로 열어도 부팅·홈(전체·여성향·남성향)·상세가 그려짐 — 단일 파일 배포(BYOK) 확인",
  views: "스모크: 다섯 화면·오리지널 전부의 상세·각 작품의 대화방(오프닝·상태창·입력창)·드로어와 시트 9종이 오류 없이 그려짐",
  images: "그림 조합 코드: [[img:코드:3,404,501]] 그리기, 의상·장소 이어 가기·되돌리기, 빠진 태그 자동 채움, 대화 중 자동 생성(가짜 Runware), 조합 갤러리·코드 표",
  styles: "기본 화풍: 자동 고르기(성향·성별·표지), ZIP 이름 묶기·내장 화풍 맞추기, 세트로 덮어쓰기 → 되돌리기·다시 지정·지우기, 설정 카드, 생성 창의 화풍 이름"
};
const BAD_KEYS = ["fail", "error", "errors", "errs", "pageerror"];
const only = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const names = only.length ? only : Object.keys(SUITES);
for (const n of names) if (!SUITES[n]) { console.error(`모르는 시험: ${n} (가능: ${Object.keys(SUITES).join(", ")})`); process.exit(2); }
if (!fs.existsSync(path.join(ROOT, "index.html"))) { console.error("index.html이 없어요 — 먼저 npm run build"); process.exit(2); }
const shots = path.join(ROOT, "tests", ".shots");
fs.mkdirSync(shots, { recursive: true });

const bad = (v) => Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && v !== "" && v !== false;
function problems(obj, at = "") { // 결과 객체를 훑어 오류 칸을 모음(기기별로 중첩된 것도)
  const out = [];
  if (!obj || typeof obj !== "object") return out;
  for (const [k, v] of Object.entries(obj)) {
    if (BAD_KEYS.includes(k) && bad(v)) out.push(`${at}${k}: ${JSON.stringify(v).slice(0, 220)}`);
    else if (v && typeof v === "object" && !Array.isArray(v)) out.push(...problems(v, `${at}${k}.`));
  }
  return out;
}
const run = (name, url) => new Promise((resolve) => {
  const t0 = Date.now(), args = [path.join(ROOT, "tests", "e2e", `${name}.mjs`), url];
  if (name !== "mobile") args.push(shots);
  const p = spawn(process.execPath, args, { cwd: ROOT, env: { ...process.env, SHOT_DIR: shots } });
  let out = "", err = "";
  p.stdout.on("data", (d) => out += d); p.stderr.on("data", (d) => err += d);
  const timer = setTimeout(() => { p.kill(); err += "\n(5분 시간 초과)"; }, 300000);
  p.on("close", (code) => {
    clearTimeout(timer);
    const results = out.split(/\r?\n/).filter((l) => l.startsWith("{")).flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });
    // social·vault·cloud2는 결과를 여러 줄 JSON 하나로 찍음
    if (!results.length && out.trim().startsWith("{")) { try { results.push(JSON.parse(out)); } catch {} }
    const issues = results.flatMap((r) => problems(r, r.dev ? `[${r.dev}] ` : ""));
    if (code !== 0) issues.push(`exit ${code}`);
    if (err.trim()) issues.push("stderr: " + err.trim().split("\n")[0].slice(0, 200));
    if (!results.length) issues.push("결과 JSON이 없어요");
    resolve({ name, sec: ((Date.now() - t0) / 1000).toFixed(1), results: results.length, issues });
  });
});

const { url, close } = await serve(ROOT);
console.log(`정적 서버 ${url} · 시험 ${names.length}개`);
let failed = 0;
for (const name of names) {
  const r = await run(name, url);
  if (r.issues.length) { failed++; console.log(`✗ ${name} (${r.sec}초) — ${SUITES[name]}`); r.issues.forEach((x) => console.log("    " + x)); }
  else console.log(`✓ ${name} (${r.sec}초, 결과 ${r.results}건) — ${SUITES[name]}`);
}
await close();
console.log(failed ? `\n${failed}개 시험 실패` : "\n모두 통과");
process.exit(failed ? 1 : 0);
