// 흐름 시험(npm run e2e): 저장소 루트를 정적 서버로 띄우고 tests/e2e/*.mjs를 차례로 돌린 뒤, 각 스크립트가 찍은 결과 JSON의
// 오류 칸(fail·error·errors·errs·pageerror)이 비었는지로 통과를 판정한다(스크립트 자체는 늘 exit 0으로 끝남).
// 시험마다 어느 빌드를 여는지(page) 정한다 — 기본은 사용자 사이트 index.html, 관리자 도구 시험(admin)은 admin.html.
// 브라우저가 없으면 먼저: npx playwright install webkit chromium
//   node tests/run.mjs            전부
//   node tests/run.mjs chatflow   하나만(이름 여러 개 가능)
//   node tests/run.mjs --retry    실패한 시험만 한 번 더 돌림(CI가 씀 — 시간 초과 같은 헛실패에 대비. 다시 돌려 통과한 시험은 끝에 따로 알림)
// 스크린샷은 tests/.shots/ (git에 안 들어감)
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { serve, ROOT } from "./serve.mjs";

const ADMIN = "admin.html"; // 관리자 도구 빌드(npm run build가 함께 만듦)
const PAGE = { admin: ADMIN };
const SUITES = {
  gate: "관리자 관문: 가짜 https 호스트에서 비밀번호 관문이 서고(레일 숨김), 틀리면 거부, 기억하면 바로 부팅, MY의 잠그기 버튼, 사용자 사이트에는 없음(HS_ADMIN_PW가 있으면 맞는 비밀번호 입력도)",
  admin: "관리자 도구(admin.html): 사용자 화면이 모두 그려지고 고객센터 관리가 붙음 + 사용자 빌드에는 관리자 함수가 없음",
  social: "소셜 로그인·가입, 처음 로그인 대화 합치기(Supabase를 page.route로 흉내)",
  cloud2: "계정 저장: 올리기·받기·내 서재(찜)의 날짜 관문과 합치기·API 키는 올리지 않음",
  help: "공지·고객센터: 공지 메뉴(공개만·고정 먼저·새 공지 표시·예전 주소), MY의 고객센터·약관 칸, FAQ 찾기, 문의 남기기·하루 5건·지우기, 관리자 도구의 공지 메뉴(관리자 계정은 바로 관리 화면·그 밖은 읽기와 로그인 안내)·받은 문의 답변, 대화방 메시지 신고(예전 서버 제약이면 '기타'로·고친 뒤 '신고' 분류·관리자 목록의 배지·비로그인 안내)(Supabase를 page.route로 흉내)",
  audience: "관심있는 대화(전체·남성향·여성향) 첫 시작 창 → 홈 필터 → 설정 → 신작 대화방",
  firstvisit: "첫 방문: 작품·공지 주소로 들어와도 둘러보기·이메일·소셜 로그인·메일 링크 뒤 그곳이 열림, 없는 작품은 홈, 관심있는 대화 시트는 홈에 처음 갈 때(Supabase를 page.route로 흉내)",
  chatflow: "대화방: 입력창 ! 명령어 목록, 스트리밍 표시, 자동 스크롤 끔/켬, 고정 기억, 즉답 명령어, 좋아요·분기, AI 추천 수동, 출력 설정, 설정 페이지",
  tracks: "트랙별 대화 경로: 성인 트랙 방은 서버 대화 관문으로만(본문·추천·요약), 일반 트랙 방은 내 키가 있으면 Anthropic으로 바로·없으면 관문의 무료 길, 막히면 안내하고 무료 턴을 돌려줌(관문·Anthropic을 route로 흉내)",
  mobile: "휴대폰 셸: iPhone 13·SE(WebKit)·Galaxy(Chromium)에서 표준 모드·탭바·가로 넘침 없음",
  file: "파일(file://)로 열어도 부팅·홈(전체·여성향·남성향)·상세가 그려짐 — 단일 파일 배포(BYOK) 확인",
  views: "스모크(사용자 사이트): 여섯 화면·오리지널 전부의 상세·각 작품의 대화방(오프닝·상태창·입력창)·드로어와 시트 6종이 오류 없이 그려짐",
  art: "그림이 실린 작품(가짜 그림으로 틀만): 본문 태그 → 그림·갤러리·장소 목록·도감 미리보기, 비공개 그림은 대화에서 본 뒤 도감에서도 열림, 수집 기록과 모은 그림 n / m",
  inject: "주입(XSS): 이용자 글·AI 응답·공지와 문의·작품 데이터 자리마다 악성 글을 넣고 사용자 사이트와 관리자 도구의 화면을 돌아 — 실행되지 않고, 주입한 글에서 온 요소·속성이 없고, 글자 그대로 보임",
  scroll: "화면 이동 스크롤: 새 화면은 맨 위부터, 같은 주소를 다시 그리면 보던 자리, 홈으로 돌아오면 보던 자리, 대화방 #log는 그대로"
};
const BAD_KEYS = ["fail", "error", "errors", "errs", "pageerror"];
const only = process.argv.slice(2).filter((a) => !a.startsWith("-")), retry = process.argv.includes("--retry"), flaky = [];
const names = only.length ? only : Object.keys(SUITES);
for (const n of names) if (!SUITES[n]) { console.error(`모르는 시험: ${n} (가능: ${Object.keys(SUITES).join(", ")})`); process.exit(2); }
if (!fs.existsSync(path.join(ROOT, "index.html"))) { console.error("index.html이 없어요 — 먼저 npm run build"); process.exit(2); }
if (names.some((n) => PAGE[n]) && !fs.existsSync(path.join(ROOT, ADMIN))) { console.error(`${ADMIN}이 없어요 — 먼저 npm run build`); process.exit(2); }
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
  const t0 = Date.now(), args = [path.join(ROOT, "tests", "e2e", `${name}.mjs`), url + (PAGE[name] || "")];
  if (name !== "mobile") args.push(shots);
  const p = spawn(process.execPath, args, { cwd: ROOT, env: { ...process.env, SHOT_DIR: shots } });
  let out = "", err = "";
  p.stdout.on("data", (d) => out += d); p.stderr.on("data", (d) => err += d);
  const timer = setTimeout(() => { p.kill(); err += "\n(5분 시간 초과)"; }, 300000);
  p.on("close", (code) => {
    clearTimeout(timer);
    const results = out.split(/\r?\n/).filter((l) => l.startsWith("{")).flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });
    // social·cloud2는 결과를 여러 줄 JSON 하나로 찍음
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
  let r = await run(name, url);
  if (r.issues.length && retry) { // 그 시험만 한 번 더 — 두 번 다 실패해야 실패
    console.log(`↻ ${name} (${r.sec}초) 실패 — 한 번 다시 돌려요`); r.issues.forEach((x) => console.log("    " + x));
    r = await run(name, url); if (!r.issues.length) flaky.push(name);
  }
  if (r.issues.length) { failed++; console.log(`✗ ${name} (${r.sec}초) — ${SUITES[name]}`); r.issues.forEach((x) => console.log("    " + x)); }
  else console.log(`✓ ${name} (${r.sec}초, 결과 ${r.results}건) — ${SUITES[name]}`);
}
await close();
// 다시 돌려 통과한 시험은 따로 알림(GitHub Actions에서는 경고 줄로 — 헛실패가 얼마나 잦은지 보려고)
if (flaky.length) console.log(`${process.env.GITHUB_ACTIONS ? "::warning title=흐름 시험::" : ""}다시 돌려 통과한 시험: ${flaky.join(", ")} — 자주 나오면 그 시험을 고쳐야 해요`);
console.log(failed ? `\n${failed}개 시험 실패` : "\n모두 통과");
process.exit(failed ? 1 : 0);
