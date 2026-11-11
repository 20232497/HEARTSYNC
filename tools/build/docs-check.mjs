// 문서 지킴이(npm run check가 부름): CLAUDE.md가 '규칙과 지도'로 남게 — 크기 상한, 지도 표가 가리키는 문서·모듈 경로와 영역 문서의 '다루는 모듈' 경로가 실제로 있는지.
// 왜: CLAUDE.md는 모든 세션이 시작할 때 통째로 읽는데, 앱 구조 설명과 날짜별 결정이 쌓여 이틀 만에 31KB → 63KB가 됐었다(2026-11-11 구조 평가). 그래서 설명은 영역 문서(docs/app/)로,
//     결정의 경위는 docs/DECISIONS.md로 옮기고(2026-11-12), 다시 불어나거나 지도가 낡으면 병합 전에 걸리게 함
/** CLAUDE.md의 크기 상한(바이트). 목표는 15KB 안팎(2026-11-11 사용자 결정) — 규칙 몇 줄이 늘 여유만 둠. 넘으면 내용을 영역 문서로 옮길 것(상한을 올리는 것은 사용자 결정) */
export const CLAUDE_MAX = 20 * 1024;
const MAP_HEAD = "\n## 지도", MODS_HEAD = "**이 문서가 다루는 모듈**:";
const ticks = (text) => [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1]);

/** CLAUDE.md의 지도 표('## 지도' 절)에 `…`로 적힌 경로들. 그 절이 없으면 null. @param {string} text @returns {string[]|null} */
export function mapPaths(text) {
  const i = ("\n" + text).indexOf(MAP_HEAD); if (i < 0) return null;
  const rest = ("\n" + text).slice(i + 1), j = rest.indexOf("\n## ", 1);
  return ticks(j < 0 ? rest : rest.slice(0, j));
}
/** 영역 문서의 '이 문서가 다루는 모듈' 줄에 적힌 경로들(그 줄이 없으면 빈 배열). @param {string} text @returns {string[]} */
export function docModules(text) {
  const line = text.split("\n").find((l) => l.startsWith(MODS_HEAD));
  return line ? ticks(line) : [];
}
/**
 * 문서 검사(순수 — 파일은 넘겨받은 함수로만 봄). @param {string|null} claude CLAUDE.md의 글(없으면 null)
 * @param {(p: string) => boolean} exists 저장소 루트 기준 경로가 있는지 @param {(p: string) => string|null} read 문서의 글(없으면 null)
 * @returns {{ errors: string[], note: string }} note = 통과했을 때 보여 줄 한 줄
 */
export function checkDocs(claude, exists, read) {
  const errors = [], kb = (n) => (n / 1024).toFixed(1) + "KB";
  if (claude === null) return { errors: ["CLAUDE.md가 없어요"], note: "" };
  const bytes = Buffer.byteLength(claude);
  if (bytes > CLAUDE_MAX) errors.push(`CLAUDE.md가 ${kb(bytes)}예요 — 상한 ${kb(CLAUDE_MAX)}. CLAUDE.md에는 규칙과 지도만 두고, 앱 구조 설명은 지도 표가 가리키는 영역 문서(docs/app/)에, 결정의 날짜와 경위는 docs/DECISIONS.md에 적어 주세요`);
  const paths = mapPaths(claude);
  if (!paths || !paths.length) { errors.push("CLAUDE.md에 '## 지도' 절의 표가 없어요 — 영역마다 읽을 문서와 주요 모듈을 `경로`로 적은 표가 있어야 해요"); return { errors, note: "" }; }
  paths.filter((p) => !exists(p)).forEach((p) => errors.push(`CLAUDE.md 지도 표의 경로가 없어요: ${p} — 파일을 옮기거나 지웠으면 표도 같이 고쳐 주세요`));
  let mods = 0;
  for (const doc of paths.filter((p) => /^docs\/app\/.+\.md$/.test(p) && exists(p))) {
    const list = docModules(read(doc) || "");
    if (!list.length) errors.push(`${doc}: '${MODS_HEAD}' 줄이 없어요 — 영역 문서는 맨 위에 다루는 모듈을 \`경로\`로 적어요`);
    list.filter((p) => !exists(p)).forEach((p) => errors.push(`${doc}의 '다루는 모듈' 경로가 없어요: ${p} — 모듈을 옮기거나 나눴으면 이 문서도 같이 고쳐 주세요`));
    mods += list.length;
  }
  return { errors, note: `CLAUDE.md ${kb(bytes)}(상한 ${kb(CLAUDE_MAX)}) · 지도 표의 경로 ${paths.length}개와 영역 문서의 모듈 경로 ${mods}개가 모두 있어요` };
}
