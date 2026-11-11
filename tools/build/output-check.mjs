// 만든 결과(index.html·admin.html)의 검사: 인라인 스크립트 문법, 오래된 iOS에서 안 도는 문법(checkScripts), 들어가면 안 되는 것(checkForbidden)
import vm from "node:vm";
import { TARGETS } from "./common.mjs";

/* 오래된 iOS(13 이하)·인앱 브라우저에서 문법 오류가 나는 것들 */
const OLD_IOS = [[/\|\|=|&&=|\?\?=/, "논리 할당(||= &&= ??=)"], [/\.at\(/, "Array.at()"], [/\(\?<[=!]/, "정규식 lookbehind"],
  [/\bstructuredClone\b/, "structuredClone"], [/\.findLast(?:Index)?\(/, "findLast()"], [/\bObject\.hasOwn\(/, "Object.hasOwn()"]];

/* ---------------------------------------------------------------- 결과 검사: 인라인 스크립트 문법, 오래된 iOS 문법 */
function where(map, line, out) {
  const m = map.find((x) => line >= x.start && line <= x.end);
  return m ? `${m.from}:${m.fromLine + line - m.start}` : `${out}:${line}`;
}
export function checkScripts(html, map, out) {
  const errors = [], re = /<script>([\s\S]*?)<\/script>/g;
  let m, k = 0;
  while ((m = re.exec(html))) {
    k++;
    const startLine = html.slice(0, m.index + "<script>".length).split("\n").length; // 스크립트 첫 줄의 결과 줄 번호
    try { new vm.Script(m[1], { filename: `script${k}`, lineOffset: startLine - 1 }); }
    catch (e) {
      const ln = +(String(e.stack).match(new RegExp(`script${k}:(\\d+)`)) || [])[1];
      errors.push(`${ln ? where(map, ln, out) : `<script> ${k}번째`}: 문법 오류 — ${e.message}`);
    }
    m[1].split("\n").forEach((text, i) => {
      for (const [re2, name] of OLD_IOS) if (re2.test(text)) errors.push(`${where(map, startLine + i, out)}: 오래된 iOS에서 안 도는 문법(${name}) — CLAUDE.md '모바일'`);
    });
  }
  if (!k) errors.push(`${out}에 인라인 <script>가 없어요`);
  return errors;
}

/* 결과에 들어가면 안 되는 것(2026-11-08 정리 — 브라우저는 Anthropic 말고 다른 AI·그림 서비스를 부르지 않음, 성인 경로는 서버에 다시 세움: docs/ROADMAP.md).
   사용자 빌드(index.html)에는 관리자 모듈도 들어가지 않음 — 사용자 모듈이 admin/을 import하게 바뀌는 실수를 막음 */
const FORBIDDEN = [
  [/openrouter\.ai|runware\.ai/i, "외부 AI·그림 서비스 주소(OpenRouter·Runware)", "all"],
  [/\/\* ── src\/js\/admin\//, "관리자 모듈(src/js/admin/)", "user"]
];
export function checkForbidden(html, name) {
  return FORBIDDEN.filter(([re, , only]) => (only === "all" || only === name) && re.test(html)).map(([, what]) => `${TARGETS[name].out}에 들어가면 안 되는 것이 있어요: ${what}`);
}
