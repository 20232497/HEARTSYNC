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
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as espree from "espree";
import * as scope from "eslint-scope";
import { BROWSER_GLOBALS } from "./globals.mjs";
import { LOCK_FILE, checkBase, checkLock, lockOf, readBaseLocks, readLock } from "./content-lock.mjs";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src"), JS = path.join(SRC, "js"), CONTENT = path.join(ROOT, "content");
const GEN_FILE = path.join(JS, "content", "generated.js"), BUILD_DIR = path.join(ROOT, ".build");

/* 빌드 대상: page(뼈대, src/ 아래) → out(저장소 루트). strip이면 주석·빈 줄을 벗기고, doc이면 모듈마다 설명 머리를 붙임 */
export const TARGETS = {
  user: { page: "page.html", out: "index.html", strip: true, doc: false, linemap: "linemap.json", label: "사용자 사이트" },
  admin: { page: "admin.html", out: "admin.html", strip: false, doc: true, linemap: "linemap-admin.json", label: "관리자 도구" }
};
/* 폴더 이름이 곧 작품의 aud(관심있는 대화) 값 */
export const AUD_DIRS = { f: "여성향(남성 캐릭터와의 대화)", m: "남성향(여성 캐릭터와의 대화)", all: "전체(남녀가 섞임)" };
/* 빌드 검사에 쓰는 앱 규칙 — src/js에서 같은 코드를 꺼내 쓴다(규칙이 두 군데로 갈라지지 않게) */
const APP_RULES = ["SIT", "CODE_RE", "SERIES", "codebook", "APP_COMMANDS", "PALETTES", "MOTIFS", "CATS", "LIMITS", "LORE", "FREE_DAILY", "MODELS", "guessAud", "personaWho", "personaLook", "castLook", "minorFlags", "minorHint", "settingHint", "LORE_KINDS", "OPENING_ID_RE"];
/* 오래된 iOS(13 이하)·인앱 브라우저에서 문법 오류가 나는 것들 */
const OLD_IOS = [[/\|\|=|&&=|\?\?=/, "논리 할당(||= &&= ??=)"], [/\.at\(/, "Array.at()"], [/\(\?<[=!]/, "정규식 lookbehind"],
  [/\bstructuredClone\b/, "structuredClone"], [/\.findLast(?:Index)?\(/, "findLast()"], [/\bObject\.hasOwn\(/, "Object.hasOwn()"]];

export class BuildError extends Error { constructor(list) { super(list.join("\n")); this.list = list; } }

const readText = (p) => fs.readFileSync(p, "utf8").replace(/^﻿/, "").replace(/\r\n?/g, "\n");
const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");
const visible = (name) => !name.startsWith(".") && !name.startsWith("_");
const subdirs = (dir) => fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory() && visible(d.name)).map((d) => d.name).sort();
const writeIfChanged = (p, text) => { if (!fs.existsSync(p) || readText(p) !== text) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); return true; } return false; };

/* ---------------------------------------------------------------- 주석 벗기기(사용자 빌드) */
const KEEP_CSS = /\/\*(?!!)[\s\S]*?\*\//g;          // 지울 CSS 주석(/*! 는 남김)
const KEEP_HTML = /<!--(?!!)(?![\s@]*@)[\s\S]*?-->/g; // 지울 HTML 주석(<!--! 와 @include·@script 자리는 남김)
/* 글을 줄로 나눠 빈 줄을 버리고, 남긴 줄마다 원본 줄 번호를 돌려줌 */
function compact(text) {
  const lines = text.split("\n"), kept = [], src = [];
  lines.forEach((l, i) => { const t = l.replace(/\s+$/, ""); if (t.trim()) { kept.push(t); src.push(i + 1); } });
  return { text: kept.join("\n") + (kept.length ? "\n" : ""), src };
}

/* ---------------------------------------------------------------- 뼈대(src/page.html·admin.html) 펼치기 */
const INCLUDE = /^\s*<!--\s*@include\s+(\S+)\s*-->\s*$/, SCRIPT = /^\s*<!--\s*@script\s+(\S+)\s*-->\s*$/;

function includeFiles(pattern, page) {
  const m = pattern.match(/^([\w-]+(?:\/[\w-]+)*)\/\*(\.\w+)$/);
  if (!m) throw new BuildError([`${page}: @include ${pattern} — "폴더/*.확장자" 모양만 쓸 수 있어요`]);
  const dir = path.join(SRC, m[1]);
  if (!fs.existsSync(dir)) throw new BuildError([`${page}: @include ${pattern} — src/${m[1]} 폴더가 없어요`]);
  // 파일 이름 순서가 곧 들어가는 순서(앞의 두 자리 번호). _로 시작하면 뺌. 하위 폴더는 따로 @include
  return fs.readdirSync(dir).filter((f) => f.endsWith(m[2]) && visible(f)).sort().map((f) => path.join(dir, f));
}
/* 조각은 앞뒤 빈 줄 없이 두고, 조각 사이에 빈 줄 하나를 넣어 잇는다 */
const tidy = (text) => text.replace(/^\n+/, "").replace(/\n*$/, "\n");

async function assemble(t) {
  const page = `src/${t.page}`, PAGE = path.join(SRC, t.page);
  const out = [], map = []; // map: 결과 줄 → 원본 파일:줄(오류 위치 안내용). 같은 파일에서 이어지는 줄은 한 구간으로
  let line = 1, css = 0, bundle = null;
  const push = (text, from, fromLine = 1) => {
    const n = text.split("\n").length - 1;
    if (n > 0) map.push({ start: line, end: line + n - 1, from, fromLine });
    out.push(text); line += n;
  };
  const pushMapped = (text, src, from) => { // src[i] = 결과 i번째 줄의 원본 줄 번호(빈 줄을 지운 뒤라 띄엄띄엄)
    if (!src) return push(text, from, 1);
    let s = 0;
    for (let i = 1; i <= src.length; i++) if (i === src.length || src[i] !== src[i - 1] + 1) { map.push({ start: line + s, end: line + i - 1, from, fromLine: src[s] }); s = i; }
    out.push(text); line += src.length;
  };
  const tpl = readText(PAGE).split("\n");
  if (tpl[tpl.length - 1] === "") tpl.pop();
  for (let i = 0; i < tpl.length; i++) {
    const inc = tpl[i].match(INCLUDE), scr = tpl[i].match(SCRIPT);
    if (inc) {
      const files = includeFiles(inc[1], page).map((f) => ({ f, text: readText(f) })).filter((x) => x.text.trim());
      files.forEach(({ f, text }, k) => {
        if (k && !t.strip) push("\n", "(빈 줄)");
        if (t.strip) { const c = compact(text.replace(KEEP_CSS, "")); if (c.src.length) pushMapped(c.text, c.src, rel(f)); }
        else push(tidy(text), rel(f), text.match(/^\n*/)[0].length + 1);
        css++;
      });
    } else if (scr) {
      if (bundle) throw new BuildError([`${page}: @script는 한 번만`]);
      bundle = bundleModules(path.join(SRC, scr[1]), t, page);
      bundle.pieces.forEach((p) => { push(p.header, "(모듈 머리)"); pushMapped(p.text, p.src, p.rel); });
    } else {
      let l = tpl[i];
      if (t.strip) { const had = KEEP_HTML.test(l); KEEP_HTML.lastIndex = 0; l = l.replace(KEEP_HTML, ""); if (had && !l.trim()) continue; }
      push(l + "\n", page, i + 1);
    }
  }
  if (!bundle) throw new BuildError([`${page}에 <!-- @script js/… --> 자리가 없어요`]);
  return { html: out.join(""), map, css, bundle };
}

/* ---------------------------------------------------------------- 모듈 번들러 */
const parseModule = (code, file) => {
  try { return espree.parse(code, { ecmaVersion: 2022, sourceType: "module", range: true, loc: true, comment: true }); }
  catch (e) { throw new BuildError([`${rel(file)}:${e.lineNumber || "?"}: 문법 오류 — ${e.message.replace(/\s*\(\d+:\d+\)$/, "")}`]); }
};
const patNames = (p) => p.type === "Identifier" ? [p.name] : p.type === "ObjectPattern" ? p.properties.flatMap((x) => x.type === "RestElement" ? patNames(x.argument) : patNames(x.value))
  : p.type === "ArrayPattern" ? p.elements.filter(Boolean).flatMap(patNames) : p.type === "AssignmentPattern" ? patNames(p.left) : p.type === "RestElement" ? patNames(p.argument) : [];
const declOf = (d) => d.type === "FunctionDeclaration" ? [[d.id.name, "function"]] : d.type === "ClassDeclaration" ? [[d.id.name, "class"]]
  : d.type === "VariableDeclaration" ? d.declarations.flatMap((x) => patNames(x.id).map((n) => [n, "var"])) : [];

function loadModule(file, mods, errors, chain) {
  if (mods.has(file)) return mods.get(file);
  if (!fs.existsSync(file)) { errors.push(`${chain}: ${rel(file)} 파일이 없어요`); return null; }
  const code = readText(file), ast = parseModule(code, file), r = rel(file);
  const info = { file, rel: r, code, ast, comments: ast.comments || [], imports: [], importOrder: [], declared: new Map(), exports: new Map(), bindings: new Map(), cuts: [] };
  mods.set(file, info);
  for (const st of ast.body) {
    if (st.type === "ImportDeclaration") {
      const spec = st.source.value;
      if (!/^\.\.?\//.test(spec) || !spec.endsWith(".js")) errors.push(`${r}:${st.loc.start.line}: import는 "./…/이름.js" 상대 경로만 (${spec})`);
      const target = path.resolve(path.dirname(file), spec);
      const names = [];
      for (const s of st.specifiers) {
        if (s.type !== "ImportSpecifier") { errors.push(`${r}:${st.loc.start.line}: default·namespace import는 쓸 수 없어요 — import { 이름 } 만`); continue; }
        if (s.imported.name !== s.local.name) errors.push(`${r}:${st.loc.start.line}: import { ${s.imported.name} as ${s.local.name} } — 이름을 바꿔 들여올 수 없어요(합칠 때 이름이 그대로 전역이 됨)`);
        names.push(s.local.name); info.bindings.set(s.local.name, { from: target, line: s.loc.start.line });
      }
      info.imports.push({ target, names, line: st.loc.start.line }); info.importOrder.push(target);
      info.cuts.push({ range: st.range, blank: true });
    } else if (st.type === "ExportNamedDeclaration") {
      if (st.source) { errors.push(`${r}:${st.loc.start.line}: export … from 은 쓸 수 없어요 — import한 뒤 export { 이름 } 으로`); continue; }
      if (st.declaration) {
        for (const [n, kind] of declOf(st.declaration)) { info.declared.set(n, { kind, line: st.loc.start.line }); info.exports.set(n, kind); }
        info.cuts.push({ range: [st.range[0], st.declaration.range[0]], blank: false });
      } else {
        for (const s of st.specifiers) {
          if (s.exported.name !== s.local.name) errors.push(`${r}:${st.loc.start.line}: export { ${s.local.name} as ${s.exported.name} } — 이름을 바꿔 내보낼 수 없어요`);
          info.exports.set(s.local.name, info.declared.get(s.local.name)?.kind || (info.bindings.has(s.local.name) ? "reexport" : null));
          if (!info.exports.get(s.local.name)) errors.push(`${r}:${st.loc.start.line}: export { ${s.local.name} } — 이 모듈에 선언도 import도 없는 이름`);
        }
        info.cuts.push({ range: st.range, blank: true });
      }
    } else if (st.type === "ExportDefaultDeclaration" || st.type === "ExportAllDeclaration") errors.push(`${r}:${st.loc.start.line}: export default / export * 는 쓸 수 없어요 — 이름 있는 export만`);
    else for (const [n, kind] of declOf(st)) info.declared.set(n, { kind, line: st.loc.start.line });
  }
  // 스코프 분석: 자유 변수, import 바인딩에 대입, 맨 윗단에서의 참조
  const sm = scope.analyze(ast, { ecmaVersion: 2022, sourceType: "module" });
  const moduleScope = sm.globalScope.childScopes.find((s) => s.type === "module");
  for (const ref of sm.globalScope.through) {
    const n = ref.identifier.name;
    if (!BROWSER_GLOBALS.has(n)) errors.push(`${r}:${ref.identifier.loc.start.line}: "${n}"는 선언도 import도 안 된 이름이에요 — 다른 모듈의 것이면 import { ${n} } from "…", 브라우저 전역이면 tools/globals.mjs에 추가`);
  }
  for (const v of moduleScope.variables) {
    if (v.defs[0]?.type !== "ImportBinding") continue;
    const w = v.references.find((x) => x.isWrite());
    if (w) errors.push(`${r}:${w.identifier.loc.start.line}: import한 "${v.name}"에 대입할 수 없어요 — 그 모듈이 내보내는 set…() 함수를 쓰세요`);
    if (!v.references.length) info.unused = (info.unused || []).concat(v.name);
  }
  const inFunction = (s) => { for (; s && s !== moduleScope; s = s.upper) if (/^(function|class-field-initializer|class-static-block)$/.test(s.type)) return true; return false; };
  info.evalRefs = []; // 함수 밖(모듈을 읽을 때 바로 실행되는 자리)에서 쓰는 import 이름
  for (const s of sm.scopes) {
    if (s === sm.globalScope || inFunction(s)) continue;
    for (const ref of s.references) if (ref.resolved?.defs[0]?.type === "ImportBinding") info.evalRefs.push({ name: ref.identifier.name, line: ref.identifier.loc.start.line });
  }
  for (const t of info.importOrder) loadModule(t, mods, errors, `${r}`);
  return info;
}

/* 모듈 첫 줄 주석의 첫 문장 — 사용자 빌드의 모듈 머리에 씀 */
function summaryOf(m) {
  const c = m.comments.find((x) => x.loc.start.line === 1); if (!c) return "";
  let t = c.value.replace(/^!/, "").replace(/\s+/g, " ").trim();
  const i = t.search(/\.(\s|$)/); if (i > 0) t = t.slice(0, i);
  if (t.length > 100) t = t.slice(0, 98).replace(/\s+\S*$/, "") + "…";
  return t;
}
/* 관리자 빌드의 모듈 머리: 파일, 가져오는 것(모듈별 이름), 내보내는 것, 이 모듈을 쓰는 모듈 */
function docHeader(m, order) {
  const bar = "═".repeat(100), pad = "   ";
  const imps = m.imports.filter((i) => i.names.length).map((i) => `${rel(i.target)} { ${i.names.join(", ")} }`);
  const exps = [...m.exports.keys()], by = order.filter((o) => o !== m && o.importOrder.includes(m.file)).map((o) => o.rel);
  const lines = [`/* ${bar}`, `${pad}${m.rel}`];
  if (imps.length) lines.push(`${pad}가져옴: ${imps[0]}`, ...imps.slice(1).map((x) => `${pad}        ${x}`));
  if (exps.length) lines.push(`${pad}내보냄: ${exps.join(", ")}`);
  lines.push(`${pad}쓰는 곳: ${by.length ? by.join(", ") : "(진입점 — 아무도 import하지 않음)"}`);
  lines.push(`${pad}${bar} */`);
  return lines.join("\n") + "\n";
}

function bundleModules(entry, t, page) {
  const errors = [], warnings = [], mods = new Map();
  if (!fs.existsSync(entry)) throw new BuildError([`진입 모듈 ${rel(entry)}이 없어요`]);
  loadModule(entry, mods, errors, page);
  if (errors.length) throw new BuildError(errors);
  // 순서: 진입점에서 import 순서대로 깊이 우선, 의존 모듈이 먼저(진입점이 맨 뒤)
  const order = [], state = new Map();
  const visit = (file) => {
    if (state.get(file)) return; state.set(file, 1);
    for (const x of mods.get(file).importOrder) visit(x);
    state.set(file, 2); order.push(mods.get(file));
  };
  visit(entry);
  // 같은 이름 두 번 선언 / import ↔ export / 순환 의존의 초기화 순서
  const owner = new Map();
  for (const m of order) for (const [n, d] of m.declared) {
    if (owner.has(n)) errors.push(`${m.rel}:${d.line}: "${n}"가 ${owner.get(n)}에도 선언돼 있어요 — 합치면 하나의 스크립트라 이름이 겹치면 안 돼요`);
    else owner.set(n, m.rel);
  }
  const pos = new Map(order.map((m, i) => [m.file, i]));
  for (const m of order) {
    for (const imp of m.imports) {
      const x = mods.get(imp.target); if (!x) continue;
      for (const n of imp.names) if (!x.exports.has(n)) errors.push(`${m.rel}:${imp.line}: ${x.rel}은 "${n}"을 내보내지 않아요${x.declared.has(n) ? ` — ${x.rel}:${x.declared.get(n).line}의 선언 앞에 export를 붙이세요` : ""}`);
    }
    for (const ref of m.evalRefs) {
      const b = m.bindings.get(ref.name), x = b && mods.get(b.from); if (!x) continue;
      const kind = x.exports.get(ref.name);
      if (kind !== "function" && pos.get(x.file) > pos.get(m.file)) errors.push(`${m.rel}:${ref.line}: 맨 윗단에서 "${ref.name}"을 쓰는데 그걸 내보내는 ${x.rel}이 순환 의존 때문에 뒤에 와요(초기화 전 접근) — 함수 안으로 옮기거나 import 고리를 끊으세요`);
    }
    if (m.unused) warnings.push(`${m.rel}: 쓰지 않는 import ${m.unused.join(", ")}`);
  }
  if (errors.length) throw new BuildError([...new Set(errors)]);
  // 출력: import/export(와 사용자 빌드는 주석)를 벗기되 줄 수는 유지 → 사용자 빌드는 빈 줄을 지우고 원본 줄 번호를 남김
  const pieces = order.map((m) => {
    const cuts = [...m.cuts];
    if (t.strip) for (const c of m.comments) {
      if (c.value.startsWith("!")) continue; // //! 와 /*! 는 남김
      if (cuts.some((k) => c.range[0] < k.range[1] && k.range[0] < c.range[1])) continue; // import/export 문 안의 주석은 그 문과 함께 사라짐
      cuts.push({ range: c.range, blank: true });
    }
    let text = m.code;
    for (const c of cuts.sort((a, b) => b.range[0] - a.range[0])) {
      const orig = text.slice(c.range[0], c.range[1]);
      text = text.slice(0, c.range[0]) + (c.blank ? "\n".repeat((orig.match(/\n/g) || []).length) : "") + text.slice(c.range[1]);
    }
    text = text.replace(/\n*$/, "\n");
    if (t.strip) { const c = compact(text), s = summaryOf(m); return { rel: m.rel, header: `/* ── ${m.rel}${s ? " — " + s : ""} */\n`, text: c.text, src: c.src }; }
    return { rel: m.rel, header: t.doc ? docHeader(m, order) : `/* ── ${m.rel} */\n`, text, src: null };
  });
  return { pieces, warnings, count: order.length };
}

/* ---------------------------------------------------------------- 앱 규칙 꺼내기(작품 검사용) */
export function appRules() {
  const files = [];
  (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith(".js") && p !== GEN_FILE) files.push(p); } })(JS);
  const lines = files.flatMap((f) => readText(f).split("\n")), parts = [];
  for (const name of APP_RULES) {
    const fn = new RegExp(`^(?:export )?function\\s+${name}\\s*\\(`), cn = new RegExp(`^(?:export )?const\\s+${name}\\s*=`);
    const i = lines.findIndex((l) => fn.test(l) || cn.test(l));
    if (i < 0) throw new BuildError([`src/js에서 ${name}을(를) 찾지 못했어요 — 이름을 바꿨다면 tools/build.mjs의 APP_RULES도 고쳐 주세요`]);
    let j = i;
    if (fn.test(lines[i])) { if (!/}\s*$/.test(lines[i])) while (j < lines.length && lines[j] !== "}") j++; }
    else while (j < lines.length && !/;\s*(\/\/.*)?$/.test(lines[j])) j++; // 줄 끝 주석은 허용
    parts.push(lines.slice(i, j + 1).join("\n").replace(/^export /, ""));
  }
  const ctx = vm.createContext({});
  try { vm.runInContext(`"use strict";\n${parts.join("\n")}\nglobalThis.R = { ${APP_RULES.join(", ")} };`, ctx); }
  catch (e) { throw new BuildError([`src/js의 앱 규칙(${APP_RULES.join(", ")})을 읽지 못했어요 — ${e.message}`]); }
  return ctx.R;
}

/* ---------------------------------------------------------------- 작품(content/) → src/js/content/generated.js */
const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
const str = (v) => typeof v === "string" && v.trim() !== "";
function plainData(v, at, bad) {
  if (v === null || typeof v === "string" || typeof v === "boolean") return;
  if (typeof v === "number") { if (!Number.isFinite(v)) bad.push(at); return; }
  if (Array.isArray(v)) return v.forEach((x, i) => plainData(x, `${at}[${i}]`, bad));
  if (isObj(v)) return Object.keys(v).forEach((k) => plainData(v[k], `${at}.${k}`, bad));
  bad.push(at);
}

/* opt.enforceLock(기본 참): 순서 잠금(작품 폴더의 lock.json — tools/content-lock.mjs)과 어긋나면 실패. 잠금 명령은 거짓으로 불러 작품마다의 판정(locks)만 받아 감 */
export async function buildContent(R, opt = {}) {
  const errors = [], warnings = [], works = [], rows = [], locks = [], enforce = opt.enforceLock !== false;
  if (!fs.existsSync(CONTENT)) throw new BuildError(["content/ 폴더가 없어요"]);
  for (const f of fs.readdirSync(CONTENT, { withFileTypes: true })) {
    if (f.isDirectory() && visible(f.name) && !AUD_DIRS[f.name]) errors.push(`content/${f.name}: 이 자리에는 ${Object.keys(AUD_DIRS).map((k) => `${k}/(${AUD_DIRS[k]})`).join("·")} 폴더만 둘 수 있어요`);
  }
  // 작품 폴더 = work.js가 있는 폴더. content/<aud>/<id>/ 이면 홈 줄 없이, content/<aud>/<줄>/<id>/ 이면 그 줄(_row.json)에 들어감
  const addWork = async (dir, wrel, id, aud, row) => {
    let mod;
    try { mod = await import(pathToFileURL(path.join(dir, "work.js")).href); }
    catch (e) { return errors.push(`${wrel}/work.js: 불러오지 못했어요 — ${String(e.stack || e).split("\n").slice(0, 3).join(" / ")}`); }
    const before = errors.length;
    const c = checkWork(mod, { aud, row, id, wrel, R, errors, warnings });
    const dup = works.find((w) => w.c.id === id);
    if (dup) errors.push(`${wrel}: id "${id}"가 ${dup.rel}에도 있어요`);
    if (errors.length !== before) return;
    works.push({ c, aud, row, rel: wrel, order: mod.order }); if (row) row.n++;
    // 순서 잠금: 공개된 장소·컷씬·키워드북의 자리와 시작 상황 id·인물 코드가 그대로인지(판정은 content-lock.mjs checkLock 하나)
    let lock = null;
    try { lock = readLock(dir); } catch (e2) { return errors.push(`${wrel}/${LOCK_FILE}: 읽지 못했어요 — ${e2.message}. 손으로 고쳤다면 되돌리고 npm run content:lock`); }
    const cur = lockOf(c), res = checkLock(lock, cur);
    locks.push({ id, rel: wrel, dir, lock, cur, res });
    if (enforce) res.errors.forEach((x) => errors.push(`${wrel}: 순서 잠금 — ${x}. 일부러 바꾸는 것이면 npm run content:lock -- --force ${id}`));
  };
  const readRow = (dir, grel, key) => {
    let r;
    try { r = JSON.parse(readText(path.join(dir, "_row.json"))); } catch (e) { return errors.push(`${grel}/_row.json: JSON 형식이 아니에요 — ${e.message}`), null; }
    if (!isObj(r) || !str(r.title)) return errors.push(`${grel}/_row.json: "title"(홈에 보일 줄 제목)이 있어야 해요`), null;
    if (r.sub !== undefined && typeof r.sub !== "string") errors.push(`${grel}/_row.json: "sub"는 글이어야 해요`);
    if (r.order !== undefined && !Number.isFinite(r.order)) errors.push(`${grel}/_row.json: "order"는 숫자여야 해요`);
    const extra = Object.keys(r).filter((k) => !["title", "sub", "order"].includes(k));
    if (extra.length) warnings.push(`${grel}/_row.json: 쓰지 않는 칸 ${extra.join(", ")}`);
    if (!/^[a-z0-9][a-z0-9_-]*$/.test(key)) errors.push(`${grel}: 줄 폴더 이름은 영문 소문자·숫자·-·_로(이름이 곧 작품의 row 값)`);
    const dup = rows.find((x) => x.key === key);
    if (dup) errors.push(`${grel}: 같은 이름의 줄이 ${dup.rel}에도 있어요 — 줄 폴더 이름은 f·m·all 전체에서 하나만`);
    const row = { key, title: r.title, sub: r.sub || "", order: r.order, rel: grel, n: 0 };
    rows.push(row);
    return row;
  };
  const has = (dir, f) => fs.existsSync(path.join(dir, f));
  for (const aud of Object.keys(AUD_DIRS)) {
    const adir = path.join(CONTENT, aud);
    if (!fs.existsSync(adir)) continue;
    for (const name of subdirs(adir)) {
      const dir = path.join(adir, name), grel = `content/${aud}/${name}`;
      if (has(dir, "work.js") && has(dir, "_row.json")) { errors.push(`${grel}: work.js(작품)와 _row.json(홈 줄)을 한 폴더에 같이 둘 수 없어요`); continue; }
      if (has(dir, "work.js")) { await addWork(dir, grel, name, aud, null); continue; }
      if (!has(dir, "_row.json")) { errors.push(`${grel}: work.js(작품 폴더)나 _row.json(홈 가로 줄 폴더)이 있어야 해요`); continue; }
      const row = readRow(dir, grel, name);
      for (const id of subdirs(dir)) {
        const wdir = path.join(dir, id), wrel = `${grel}/${id}`;
        if (!has(wdir, "work.js")) errors.push(`${wrel}: work.js가 없어요${has(wdir, "_row.json") ? "(줄 안에 줄은 둘 수 없어요)" : "(작품 폴더마다 work.js 하나)"}`);
        else await addWork(wdir, wrel, id, aud, row);
      }
    }
  }
  rows.filter((r) => !r.n).forEach((r) => warnings.push(`${r.rel}: 줄에 작품이 없어 홈에 안 보여요`));
  if (!errors.length && !works.length) errors.push("content/에 작품이 하나도 없어요");
  // 작품 폴더의 images/(밖에서 만든 그림을 이름 규칙대로 넣음) — content/README.md
  if (fs.existsSync(path.join(CONTENT, "codes.json"))) warnings.push("content/codes.json: 코드 표는 더 쓰지 않아요(그림 코드는 인물 코드+감정 번호 한 토큰 — content/README.md) — 지워도 돼요");
  for (const w of works) scanImages(w, R, errors, warnings);
  if (errors.length) throw new BuildError(errors);

  const byOrder = (a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0);
  works.sort(byOrder);
  rows.sort(byOrder);
  const objs = works.map((w) => {
    const { c, aud, row, rel } = w, o = { ...c };
    if (row && o.row === undefined) o.row = row.key;
    if (o.aud === undefined) o.aud = aud;
    if (w.images) o.images = w.images; // 작품 폴더 images/의 그림(content/… 상대 경로) — 사용자는 이 그림을 봄
    if (w.img) o.img = w.img;
    if (w.loreImages) o.loreImages = w.loreImages;
    return `/* ${rel.slice("content/".length)} */ ${ser(o, "")}`;
  });
  const code = `/* 빌드가 content/ 폴더로 만든 작품 데이터 — 직접 고치지 말고 content/<f|m|all>/…/work.js를 고치세요(content/README.md). git에 넣지 않음 */
export const ORIGINALS = [
${objs.join(",\n")}
];
// 홈의 가로 줄(content/<aud>/<줄>/_row.json) — 관심있는 대화에 맞는 작품이 있을 때만 보임
export const HOME_ROWS = [
${rows.map((r) => "  " + JSON.stringify({ key: r.key, title: r.title, sub: r.sub })).join(",\n")}
];
`;
  writeIfChanged(GEN_FILE, jsSafe(code));
  const count = (a) => works.filter((w) => w.aud === a).length, pics = works.reduce((a, w) => a + Object.values(w.images || {}).reduce((b, m) => b + Object.keys(m).length, 0) + (w.img ? 1 : 0) + Object.keys(w.loreImages || {}).length, 0);
  const stale = locks.filter((w) => w.res.stale);
  return { warnings, locks, stats: { works: works.length, f: count("f"), m: count("m"), all: count("all"), rows: rows.length, pics, unlocked: stale.reduce((n, w) => n + Math.max(1, w.res.changes.length), 0), stale: stale.map((w) => w.id) } };
}

/* 그림 코드(글자 + 번호)가 이 작품에서 맞는지 검사하는 함수를 만듦 — 틀리면 이유 글, 맞으면 "".
   앱과 같은 코드 사전(images/codes.js codebook)으로: 인물 코드는 cast의 대문자 코드에 번호 0~14, MP<n>은 places의 n번째, EV<n>은 cuts의 n번째(1부터) */
function codeRange(c, R) {
  const book = R.codebook({ ...c, cast: c.cast || [{ code: "C", name: c.name }] });
  return (code, n) => {
    const e = book[code];
    if (!e) return book[code.toUpperCase()] ? `코드는 대문자로 — ${code.toUpperCase()}${n}` : `코드 "${code}"가 cast에 없어요(장소는 MP, 컷씬은 EV)`;
    if (e.kind !== "cast" && !e.max) return `${code} 코드를 쓰려면 work.js에 ${e.field}(${e.label} 목록)를 적어 주세요`;
    if (n < e.min || n > e.max) return e.kind === "cast" ? `번호 ${n} — 그림 칸은 기본 감정 ${e.min}~${e.max}번이에요` : `${code}${n} — ${e.label}은 ${e.field}의 ${e.min}~${e.max}번이에요`;
    return "";
  };
}
/* 작품 폴더의 images/ → 작품의 images(코드 글자 → 번호 → content/… 경로)·img(cover.*)·loreImages(lore-<n>.* → n번째 키워드북 항목).
   파일 이름: <코드><번호>.webp|png|jpg — 인물 코드 + 감정 번호 0~14(HSY3.webp), 장소 MP<n>, 컷씬 EV<n>; cover.*, lore-<n>.* */
const IMG_EXT = /\.(webp|png|jpe?g)$/i;
export function scanImages(w, R, errors, warnings) {
  const dir = path.join(ROOT, w.rel, "images");
  if (!fs.existsSync(dir)) return;
  const c = w.c, lore = c.lore || [], range = codeRange(c, R);
  const images = {}, loreImages = {}; let img = "";
  for (const f of fs.readdirSync(dir).filter(visible).sort()) {
    const at = `${w.rel}/images/${f}`;
    if (!IMG_EXT.test(f)) { warnings.push(`${at}: 그림 파일(webp·png·jpg)이 아니라 지나쳐요`); continue; }
    const base = f.replace(IMG_EXT, "");
    let m;
    if (base === "cover") { if (img) errors.push(`${at}: 표지가 둘이에요(${img})`); img = at; }
    else if ((m = base.match(/^lore-(\d+)$/))) {
      const i = +m[1];
      if (i < 1 || i > lore.length) { errors.push(`${at}: 키워드북 항목은 1~${lore.length}번이에요`); continue; }
      const k = lore[i - 1].keys[0];
      if (loreImages[k]) errors.push(`${at}: 키워드북 ${i}번 항목의 그림이 둘이에요`);
      loreImages[k] = at;
    } else if ((m = base.match(/^([A-Za-z]+)(\d+)$/))) {
      const code = m[1], n = +m[2], why = range(code, n);
      if (why) { errors.push(`${at}: ${why}`); continue; }
      images[code] = images[code] || {};
      if (images[code][n]) errors.push(`${at}: ${code}${n} 그림이 둘이에요(${images[code][n]})`);
      images[code][n] = at;
    } else if (/^[a-z0-9]+-\d+$/.test(base)) errors.push(`${at}: 예전 이름이에요 — 인물 코드 바로 뒤에 번호를 붙인 <코드><번호>.webp(예: HSY3.webp)로 바꿔 주세요`);
    else warnings.push(`${at}: 이름을 알 수 없어 지나쳐요 — <코드><번호>.webp(HSY3 · MP1 · EV2) · cover.webp · lore-<n>.webp`);
  }
  if (Object.keys(images).length) w.images = images;
  if (img) w.img = img;
  if (Object.keys(loreImages).length) w.loreImages = loreImages;
}

export function checkWork(mod, { aud, row, id, wrel, R, errors, warnings }) {
  const e = (m) => errors.push(`${wrel}: ${m}`), w = (m) => warnings.push(`${wrel}: ${m}`);
  const c = mod.default;
  if (!isObj(c)) { e("work.js는 export default { … } 로 작품 하나를 내보내야 해요"); return null; }
  const extra = Object.keys(mod).filter((k) => !["default", "order"].includes(k));
  if (extra.length) w(`빌드가 쓰지 않는 export: ${extra.join(", ")}`);
  if (mod.order !== undefined && !Number.isFinite(mod.order)) e("export const order 는 숫자여야 해요");
  const bad = [];
  plainData(c, "작품", bad);
  if (bad.length) return e(`글·숫자·참거짓·배열·객체만 쓸 수 있어요(함수·undefined·NaN 안 됨): ${bad.slice(0, 5).join(", ")}`), null;

  if (c.id !== id) e(`id("${c.id}")가 폴더 이름("${id}")과 달라요 — 폴더 이름과 id를 같게`);
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(id)) e("폴더 이름(=id)은 영문 소문자·숫자·-·_로");
  for (const k of ["name", "title", "oneLiner", "desc", "persona"]) if (!str(c[k])) e(`"${k}"가 비었어요`);
  for (const k of ["world", "speech", "secret", "glyph", "gauge"]) if (c[k] !== undefined && typeof c[k] !== "string") e(`"${k}"는 글이어야 해요`);
  if (!R.CATS.includes(c.cat)) e(`cat("${c.cat}")은 ${R.CATS.join("·")} 중 하나`);
  if (!Number.isInteger(c.pal) || !R.PALETTES[c.pal]) e(`pal은 0~${R.PALETTES.length - 1}`);
  if (!R.MOTIFS[c.motif]) e(`motif("${c.motif}")는 ${Object.keys(R.MOTIFS).join("·")} 중 하나`);
  if ([...String(c.glyph || "")].length !== 1) w("glyph는 한 글자(표지 가운데 글자)");
  if (!Array.isArray(c.tags) || c.tags.some((t) => !str(t))) e("tags는 글 배열");
  if (!Array.isArray(c.fields) || !c.fields.length || c.fields.some((t) => !str(t))) e("fields(상태창 칸 이름)는 글 배열");
  else if (str(c.gauge) && !c.fields.includes(c.gauge)) w(`gauge("${c.gauge}")가 fields에 없어요`);

  // aud·row는 폴더가 정함 — 적었다면 폴더와 같아야
  if (c.aud !== undefined && c.aud !== aud) e(`aud("${c.aud}")가 폴더(${aud}/)와 달라요 — aud는 폴더가 정하니 지우거나 작품 폴더를 ${c.aud}/로 옮기세요`);
  if (c.row !== undefined) {
    if (!row) e(`row("${c.row}")를 쓰려면 _row.json이 있는 줄 폴더에 넣으세요(지금 폴더는 줄이 아님)`);
    else if (c.row !== row.key) e(`row("${c.row}")가 줄 폴더(${row.key}/)와 달라요 — row는 폴더가 정하니 지우세요`);
  }

  // 출연진: 없으면 앱이 설정의 "외모:" 줄로 한 명(code C)을 만든다(src/js/content/index.js) — 검사도 같은 모양으로
  let cast = c.cast;
  if (cast === undefined) cast = [{ code: "C", name: c.name, look: (String(c.persona || "").match(/외모:\s*([^\n]+)/) || [])[1] || "" }];
  else if (!Array.isArray(cast) || !cast.length) { e("cast는 출연진 배열(한 명 이상)"); cast = []; }
  const codes = new Set();
  cast.forEach((x, i) => {
    if (!isObj(x) || typeof x.code !== "string" || !str(x.name)) return e(`cast[${i}]: { code: "영문 대문자 1~4자", name, look } 모양이어야 해요`);
    // 인물 코드: 영문 대문자 1~4자(images/codes.js CODE_RE) — 번호와 붙여 HSY3처럼 쓰니 숫자는 안 됨. MP·EV는 장소·컷씬 예약 코드
    if (!R.CODE_RE.test(x.code)) return e(`cast[${i}](${x.name}).code "${x.code}" — 인물 코드는 영문 대문자 1~4자예요(숫자 없이, 예: HSY). 그림 태그·파일은 번호와 붙여 HSY3처럼 써요`);
    if (R.SERIES[x.code]) return e(`cast[${i}](${x.name}).code "${x.code}"는 예약 코드예요(MP 장소 · EV 컷씬) — 다른 글자로`);
    if (codes.has(x.code)) e(`cast 코드 "${x.code}"가 겹쳐요`);
    codes.add(x.code);
    if (x.look !== undefined && typeof x.look !== "string") e(`cast[${i}].look은 글이어야 해요`);
    if (x.desc !== undefined && typeof x.desc !== "string") e(`cast[${i}].desc(도감 소개)는 글이어야 해요`);
    if (x.tags !== undefined && (typeof x.tags !== "string" || /[가-힣]/.test(x.tags))) e(`cast[${i}].tags는 영문 Danbooru 태그 글이어야 해요(한국어 외모는 look에)`);
    // 비공개(스포일러) 감정 칸: 도감·상세에서 가리고 대화에 나온 방에서만 보임(images/codes.js codebook의 hidden). 0 프로필은 인물 카드라 숨길 수 없음
    if (x.hidden !== undefined) {
      const max = R.SIT.length - 1;
      if (!Array.isArray(x.hidden) || x.hidden.some((n) => !Number.isInteger(n) || n < 0 || n > max)) e(`cast[${i}](${x.name}).hidden은 숨길 감정 번호 배열이에요(1~${max} 정수, 예: [13])`);
      else {
        if (new Set(x.hidden).size !== x.hidden.length) e(`cast[${i}](${x.name}).hidden에 같은 번호가 두 번 있어요`);
        if (x.hidden.includes(0)) e(`cast[${i}](${x.name}).hidden — 0(프로필)은 숨길 수 없어요(인물 카드에 쓰는 그림)`);
      }
    }
  });
  // 다른 모습(폼): of는 같은 출연진의 본체 코드 — 폼의 폼은 안 됨
  cast.forEach((x, i) => {
    if (!isObj(x) || x.of === undefined) return;
    const base = cast.find((y) => isObj(y) && y !== x && y.code === x.of);
    if (typeof x.of !== "string" || !base) e(`cast[${i}](${x.name}).of "${x.of}" — 본체 인물의 코드여야 해요`);
    else if (base.of !== undefined) e(`cast[${i}](${x.name}).of "${x.of}" — 폼의 폼은 둘 수 없어요(본체 코드로)`);
  });
  // 장소·컷씬 목록(선택): 순서가 곧 코드 번호 — places[0]이 MP1, cuts[0]이 EV1
  const engOk = (t) => t === undefined || (typeof t === "string" && !/[가-힣]/.test(t)), boolOk = (v) => v === undefined || typeof v === "boolean";
  if (c.places !== undefined && (!Array.isArray(c.places) || c.places.some((p) => !isObj(p) || !str(p.name) || (p.desc !== undefined && typeof p.desc !== "string") || !engOk(p.tags) || !boolOk(p.hidden))))
    e('places(장소)는 [{ name: "장소 이름", desc?: "설명", tags?: "영문 태그", hidden?: true(비공개) }, …] — 순서대로 MP1, MP2…');
  if (c.cuts !== undefined && (!Array.isArray(c.cuts) || c.cuts.some((x) => !isObj(x) || !str(x.title) || (x.when !== undefined && typeof x.when !== "string") || !engOk(x.tags) || !boolOk(x.hidden))))
    e('cuts(컷씬)는 [{ title: "제목", when?: "나오는 조건", tags?: "영문 태그", hidden?: true(비공개) }, …] — 순서대로 EV1, EV2…');
  // 장소 이름·컷씬 제목·키워드북 첫 키는 작품 안에서 겹치지 않게 — 순서 잠금이 이름으로 '밀렸는지·이름만 고쳤는지'를 가리고(tools/content-lock.mjs), 키워드북 그림은 첫 키로 이어짐
  for (const [k, pick, what] of [["places", (x) => x.name, "장소 이름"], ["cuts", (x) => x.title, "컷씬 제목"], ["lore", (x) => (Array.isArray(x.keys) ? x.keys[0] : ""), "키워드북의 첫 키"]]) {
    const names = (Array.isArray(c[k]) ? c[k] : []).map((x) => (isObj(x) ? pick(x) : "")), dup = names.find((x, i) => str(x) && names.indexOf(x) !== i);
    if (dup) e(`${k}: ${what} "${dup}"이(가) 두 번 나와요 — 작품 안에서 겹치지 않게 적어 주세요`);
  }
  // 본문의 그림 태그는 [[코드번호]] 한 토큰 — 코드가 cast(대문자)·places(MP)·cuts(EV)에 있고 번호가 범위 안인지(시작 상황 본문·즉답 명령어의 글이 같이 씀)
  const tagRange = codeRange({ ...c, cast }, R);
  const checkTags = (text, at) => {
    for (const m of String(text).matchAll(/\[\[([^\]]*)\]\]/g)) {
      const tok = m[1], t = tok.match(/^([A-Za-z]+)(\d{1,2})$/);
      if (!t) { e(`${at}: [[${tok}]] — 그림 태그는 [[코드번호]] 한 토큰이에요(예: [[${(cast[0] || {}).code || "HSY"}0]])${/^img:/i.test(tok) ? ". 예전 [[img:코드:번호]] 모양은 더 쓰지 않아요" : ""}`); continue; }
      const why = tagRange(t[1], +t[2]); if (why) e(`${at}: [[${tok}]] — ${why}`);
    }
  };
  // 작품 명령어(선택): 대화방에서 !cmd를 치면 prompt가 AI에 연출 지시로 가거나(이야기), text를 AI 없이 바로 보여 줌(즉답) — 둘 중 하나(core/commands.js). 앱 명령어 이름·별칭(APP_COMMANDS)과 겹치면 안 됨
  if (c.commands !== undefined) {
    const reserved = new Set(R.APP_COMMANDS.flatMap((x) => [x.cmd, ...x.alias]).map((s) => s.toLowerCase())), seenCmd = new Set();
    if (!Array.isArray(c.commands)) e('commands(명령어)는 [{ cmd: "이름", title: "제목", desc?: "설명", prompt: "AI 지시" 또는 text: "바로 보여 줄 글" }, …]');
    else c.commands.forEach((x, i) => {
      if (!isObj(x) || !str(x.cmd) || !str(x.title) || (x.desc !== undefined && typeof x.desc !== "string")) return e(`commands[${i}]: { cmd, title, desc?, prompt 또는 text } 모양이어야 해요(cmd·title은 글)`);
      if ((x.prompt !== undefined) === (x.text !== undefined) || !str(x.prompt !== undefined ? x.prompt : x.text)) return e(`commands[${i}](${x.cmd}): prompt(AI에게 주는 지시)와 text(AI 없이 바로 보여 줄 글) 중 하나만, 글로 적어요`);
      if (x.text !== undefined) { if (x.text.length > R.LIMITS.reply) e(`commands[${i}](${x.cmd}).text가 ${x.text.length}자예요 — 즉답 글은 ${R.LIMITS.reply}자 이내`); checkTags(x.text, `commands[${i}](${x.cmd}).text`); }
      if (!/^[^\s!！/]+$/.test(x.cmd)) e(`commands[${i}].cmd "${x.cmd}" — 공백·!·/ 없이 이름만 적어요(예: "퀘스트" → 대화에서 !퀘스트)`);
      const k = x.cmd.toLowerCase();
      if (reserved.has(k)) e(`commands[${i}].cmd "${x.cmd}"는 앱 명령어 이름이에요(${[...reserved].join("·")}) — 다른 이름으로`);
      if (seenCmd.has(k)) e(`commands[${i}].cmd "${x.cmd}"가 겹쳐요`);
      seenCmd.add(k);
    });
  }
  // 작품 메타(선택): 제작자 이름·독점 여부·공개일 — 상세 페이지 머리와 도감 작품 칸에 보임(ui/codex.js metaHTML)
  if (c.creator !== undefined && !str(c.creator)) e("creator(제작자 이름)는 비어 있지 않은 글이어야 해요");
  if (c.exclusive !== undefined && typeof c.exclusive !== "boolean") e("exclusive(독점 여부)는 참거짓(true·false)이어야 해요");
  if (c.publishedAt !== undefined) {
    const d = typeof c.publishedAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(c.publishedAt) ? new Date(c.publishedAt + "T00:00:00Z") : null;
    if (!d || isNaN(d) || d.toISOString().slice(0, 10) !== c.publishedAt) e(`publishedAt("${c.publishedAt}")은 "YYYY-MM-DD" 모양의 실제 날짜여야 해요(공개일)`);
  }
  // 권장 모델(선택): 모델 선택 시트의 '권장' 배지 — ai/models.js MODELS의 키(없으면 앱이 RECOMMEND_DEFAULT)
  if (c.recommend !== undefined && !Object.prototype.hasOwnProperty.call(R.MODELS, c.recommend)) e(`recommend("${c.recommend}")는 ${Object.keys(R.MODELS).join("·")} 중 하나(권장 모델)`);
  // 플레이 가이드(선택): 제작자가 독자에게 주는 안내문 — 상세·도감·대화방 드로어에 줄바꿈 그대로 보임(마크다운 없음)
  if (c.guide !== undefined && (!str(c.guide) || c.guide.length > R.LIMITS.guide)) e(`guide(플레이 가이드)는 ${R.LIMITS.guide}자 이내의 글이어야 해요${typeof c.guide === "string" ? `(지금 ${c.guide.length}자)` : ""}`);
  // 유저노트 양식(선택): 대화방 유저노트의 '이 작품의 양식 넣기'가 넣는 글 — 유저노트 한도 안이어야
  if (c.noteTemplate !== undefined && (!str(c.noteTemplate) || c.noteTemplate.length > R.LIMITS.userNote)) e(`noteTemplate(유저노트 양식)는 ${R.LIMITS.userNote}자 이내의 글이어야 해요${typeof c.noteTemplate === "string" ? `(지금 ${c.noteTemplate.length}자)` : ""}`);
  if (c.lookTags !== undefined && (typeof c.lookTags !== "string" || /[가-힣]/.test(c.lookTags))) e("lookTags는 영문 Danbooru 태그 글이어야 해요");
  if (c.lookTags !== undefined && c.cast !== undefined) w("cast가 있으면 lookTags는 쓰이지 않아요 — cast[].tags에 적어 주세요");
  if (c.lore !== undefined && (!Array.isArray(c.lore) || c.lore.some((x) => !isObj(x) || !Array.isArray(x.keys) || !x.keys.length || x.keys.some((k) => !str(k)) || !str(x.text) || (x.tags !== undefined && typeof x.tags !== "string"))))
    e("lore(키워드북)는 [{ keys: [\"키워드\", …], text: \"설명\", kind?: \"종류\", tags?: \"영문 태그\" }, …]");
  else {
    // 키워드북 규칙(ai/prompt/lore.js matchLore와 같은 상수 LORE): 상시(always)·우선순위(order)·제외 낱말(not)·보조 키(also)
    const strs = (v) => v === undefined || (Array.isArray(v) && v.length > 0 && v.every(str));
    (c.lore || []).forEach((x, i) => {
      const at = `lore[${i}](${x.keys[0]})`;
      if (x.always !== undefined && typeof x.always !== "boolean") e(`${at}.always(상시 주입)는 참거짓이어야 해요`);
      if (x.order !== undefined && !Number.isFinite(x.order)) e(`${at}.order(우선순위 — 클수록 먼저)는 숫자여야 해요`);
      if (!strs(x.not)) e(`${at}.not(이 낱말이 나오면 넣지 않음)은 글 배열이어야 해요`);
      if (!strs(x.also)) e(`${at}.also(keys와 함께 나와야 하는 낱말)는 글 배열이어야 해요`);
      if (x.always === true && (x.not !== undefined || x.also !== undefined)) e(`${at}: 상시(always) 항목에는 not·also를 쓸 수 없어요 — 상시 항목은 조건 없이 늘 들어가요`);
      if (x.text.length > R.LORE.budget) e(`${at}.text가 ${x.text.length}자예요 — 한 턴 예산(${R.LORE.budget}자)보다 길어 한 번도 들어가지 못해요`);
    });
    const al = (c.lore || []).filter((x) => x.always === true), sum = al.reduce((n, x) => n + x.text.length, 0);
    if (al.length > R.LORE.max || sum > R.LORE.budget) e(`키워드북의 상시(always) 항목이 ${al.length}개·${sum}자예요 — 한 턴 예산(${R.LORE.max}개·${R.LORE.budget}자) 안이어야 늘 들어갈 수 있어요`);
    else if (al.length && sum > R.LORE.budget / 2) w(`키워드북의 상시(always) 항목이 ${sum}자로 한 턴 예산(${R.LORE.budget}자)의 절반을 넘어요 — 키워드로 걸리는 항목이 들어갈 자리가 줄어요`);
  }
  (Array.isArray(c.lore) ? c.lore : []).forEach((x, i) => {
    if (!isObj(x) || !Array.isArray(x.keys) || !str(x.text)) return; // 모양 오류는 위에서 이미 알림
    // 세계관 일러스트: 종류(kind)는 상세 카드 머리표·AI 구도를 정하고, tags는 번역 없이 그대로 프롬프트에 들어가므로 영문만
    if (x.kind !== undefined && !R.LORE_KINDS[x.kind]) e(`lore[${i}](${x.keys[0]}).kind("${x.kind}")는 ${Object.keys(R.LORE_KINDS).join("·")} 중 하나`);
    if (typeof x.tags === "string" && /[가-힣]/.test(x.tags)) e(`lore[${i}](${x.keys[0]}).tags는 영문 태그 글이어야 해요(한국어 설명은 text에)`);
    if (x.tags === undefined || x.kind === undefined) w(`lore[${i}](${x.keys[0]})에 kind·tags가 없어요 — 세계관 일러스트를 만들 때 쓸 종류·영문 낱말이에요`);
  });
  if (c.artTags !== undefined && (typeof c.artTags !== "string" || /[가-힣]/.test(c.artTags))) e("artTags(세계관 태그)는 영문 태그 글이어야 해요 — 시대·장소·분위기 낱말");
  if (!Array.isArray(c.openings) || !c.openings.length) e("openings(시작 상황)가 하나 이상 있어야 해요");
  else c.openings.forEach((o, i) => {
    if (!isObj(o) || !str(o.title) || !str(o.text)) return e(`openings[${i}]: title·text가 있어야 해요`);
    // 시작 상황 id: 대화방이 제목이 아니라 이것으로 시작 상황을 기억함(제목은 고쳐도 됨) — 필수, 작품 안에서 겹치지 않게
    if (typeof o.id !== "string" || !R.OPENING_ID_RE.test(o.id)) e(`openings[${i}](${o.title}).id${o.id === undefined ? "가 없어요" : `("${o.id}")가 모양에 안 맞아요`} — 영문 소문자로 시작하는 소문자·숫자·하이픈 2~24자(예: id: "first-night"). 화면에는 안 보이고, 한 번 공개하면 고치지 않아요`);
    else if (c.openings.findIndex((x) => isObj(x) && x.id === o.id) !== i) e(`openings[${i}].id("${o.id}")가 앞의 시작 상황과 겹쳐요`);
    if (o.directive !== undefined && typeof o.directive !== "string") e(`openings[${i}].directive는 글이어야 해요`);
    // 시작 상황의 선택 칸: 배경 장소(places의 n번째)·첫 답변 추천(최대 3개)·시작 직후 N턴 동안만 주는 연출 지시
    const nPlaces = Array.isArray(c.places) ? c.places.length : 0;
    if (o.place !== undefined && !(Number.isInteger(o.place) && o.place >= 1 && o.place <= nPlaces)) e(`openings[${i}].place(${o.place}) — 배경 장소는 places의 1~${nPlaces}번째 번호예요${nPlaces ? "" : "(places가 없으면 쓸 수 없어요)"}`);
    if (o.suggestions !== undefined && (!Array.isArray(o.suggestions) || !o.suggestions.length || o.suggestions.length > 3 || o.suggestions.some((s) => !str(s) || s.length > R.LIMITS.suggestion))) e(`openings[${i}].suggestions(첫 답변 추천)는 글 1~3개, 각 ${R.LIMITS.suggestion}자 이내`);
    if (o.lead !== undefined && !(isObj(o.lead) && str(o.lead.text) && o.lead.text.length <= R.LIMITS.lead && Number.isInteger(o.lead.turns) && o.lead.turns >= 1 && o.lead.turns <= R.LIMITS.leadTurns)) e(`openings[${i}].lead(시작 연출)는 { text: "지시"(${R.LIMITS.lead}자 이내), turns: 1~${R.LIMITS.leadTurns} }`);
    if (o.status !== undefined && (!isObj(o.status) || Object.values(o.status).some((v) => typeof v !== "string" && typeof v !== "number")))
      e(`openings[${i}].status는 { "칸 이름": 글 또는 숫자 }`);
    else if (o.status && Array.isArray(c.fields)) {
      const miss = Object.keys(o.status).filter((k) => !c.fields.includes(k));
      if (miss.length) w(`openings[${i}].status의 ${miss.join(", ")} 칸이 fields에 없어요`);
    }
    checkTags(o.text, `openings[${i}]`);
  });

  // 공개 저장소의 작품은 일반 트랙만 — 성인 트랙 작품은 서버 쪽 비공개 데이터로만 둠(CLAUDE.md 원칙)
  if (c.track !== undefined && c.track !== "general") e(`track: "${c.track}" — content/의 작품은 일반 트랙만 둘 수 있어요(track 칸을 지우거나 "general")`);
  // 앱과 같은 규칙: 미성년 인물 막기(minorFlags), 출연진 성별로 짐작한 aud(guessAud) — 다른 오류가 있어도 늘 검사
  if (!cast.length || !cast.every(isObj)) return c;
  const probe = { ...c, cast };
  const minors = R.minorFlags(probe);
  if (minors.length) e(`19세 미만이거나 학생으로 보이는 인물이 있어요: ${minors.join(", ")} — 모든 인물은 성인이어야 해요(minorFlags)`);
  const guess = R.guessAud(probe);
  if (aud !== "all" && guess !== "all" && guess !== aud) e(`출연진 외모가 모두 ${guess === "m" ? "여성" : "남성"}이에요 — ${guess}/ 폴더(${AUD_DIRS[guess]})가 맞지 않나요?`);
  if (aud === "all" && guess !== "all") w(`출연진 외모가 모두 ${guess === "m" ? "여성" : "남성"}이에요 — ${guess}/ 폴더가 더 맞을 수 있어요`);
  return c;
}

/* 작품 객체를 사람이 읽고 diff로 보기 좋은 JSON으로: 두 단계까지만 줄을 나누고 그 아래(시작 상황·키워드 하나)는 한 줄 */
function ser(v, ind) {
  const prim = (x) => x === null || typeof x !== "object";
  if (Array.isArray(v)) {
    if (!v.length || ind.length >= 4 || v.every(prim)) return JSON.stringify(v);
    const i2 = ind + "  ";
    return "[\n" + v.map((x) => i2 + ser(x, i2)).join(",\n") + "\n" + ind + "]";
  }
  if (v && typeof v === "object") {
    const ks = Object.keys(v);
    if (!ks.length || ind.length >= 4) return JSON.stringify(v);
    const i2 = ind + "  ";
    return "{\n" + ks.map((k) => i2 + JSON.stringify(k) + ": " + ser(v[k], i2)).join(",\n") + "\n" + ind + "}";
  }
  return JSON.stringify(v);
}
/* <script> 안에 넣어도 안전하게: "</script"가 태그를 닫지 않게, U+2028·2029(오래된 브라우저에서 문자열 안 줄바꿈 오류)는 이스케이프 */
const LS = String.fromCharCode(0x2028), PS = String.fromCharCode(0x2029);
const jsSafe = (s) => s.replace(/<\//g, "<\\/").split(LS).join("\\u2028").split(PS).join("\\u2029");

/* ---------------------------------------------------------------- 결과 검사: 인라인 스크립트 문법, 오래된 iOS 문법 */
function where(map, line, out) {
  const m = map.find((x) => line >= x.start && line <= x.end);
  return m ? `${m.from}:${m.fromLine + line - m.start}` : `${out}:${line}`;
}
function checkScripts(html, map, out) {
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

/* 대상 하나를 만든다(content/는 buildAll이 먼저). 결과 HTML과 줄 지도를 돌려주고 지도는 .build/에도 남김 */
export async function build(name = "user") {
  const t = TARGETS[name];
  if (!t) throw new BuildError([`모르는 빌드 대상 ${name} (가능: ${Object.keys(TARGETS).join(", ")})`]);
  if (!fs.existsSync(path.join(SRC, t.page))) throw new BuildError([`src/${t.page}이 없어요`]);
  const { html: raw, map, css, bundle } = await assemble(t);
  const html = raw.replace(/<\/script(?![\s>])/gi, "<\\/script").split(LS).join("\\u2028").split(PS).join("\\u2029");
  const errors = checkScripts(html, map, t.out);
  errors.push(...checkForbidden(html, name));
  if (errors.length) throw new BuildError(errors);
  fs.mkdirSync(BUILD_DIR, { recursive: true });
  fs.writeFileSync(path.join(BUILD_DIR, t.linemap), JSON.stringify(map));
  return { name, out: path.join(ROOT, t.out), file: t.out, html, map, css, modules: bundle.count, warnings: bundle.warnings };
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
  const argv = process.argv.slice(2), check = argv.includes("--check"), oi = argv.indexOf("--only");
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
      if (check) { fail = true; console.error(`✗ ${what} — npm run content:lock을 돌려 lock.json을 같이 커밋하세요.`); }
      else console.log(`${what} — 커밋 전에 npm run content:lock`);
    }
    // 병합 전 검사는 기준 가지의 잠금과도 견줌(content-lock.mjs checkBase) — 작업 폴더의 lock.json을 지우거나 손으로 고쳐 다시 찍는 우회를 막음.
    // 기준 가지는 origin/main, CI는 LOCK_BASE로 알려 줌(그때는 못 읽으면 실패). git이 없는 폴더에서는 건너뛰고 알리기만
    if (check) {
      const ref = process.env.LOCK_BASE || "origin/main", base = readBaseLocks(ref, ROOT);
      if (!base && process.env.LOCK_BASE) { fail = true; console.error(`✗ 순서 잠금: 기준 가지(${ref})를 읽지 못했어요 — 가지를 받아 왔는지(기록 전체) 확인하세요.`); }
      else if (!base) console.log(`순서 잠금: 기준 가지(${ref})를 읽지 못해 견주기를 건너뛰었어요(git이 없거나 가지를 받아 오지 않음)`);
      else {
        const r = checkBase(base.locks, content.locks), at = `${ref} ${base.at.slice(0, 7)}`;
        r.notes.forEach((x) => console.log("순서 잠금: " + x));
        if (r.errors.length) {
          fail = true;
          console.error(`✗ 순서 잠금이 기준 가지(${at})의 잠금과 어긋나요 — 잠금 파일을 지우거나 고쳐 다시 찍어도 이미 공개된 자리는 바뀌지 않아요\n` + r.errors.map((x) => "  - " + x).join("\n") +
            "\n  새 항목은 맨 뒤에 더하고 순서는 그대로 두세요. 사용자 승인을 받아 강제로 다시 찍은 것이면 이 검사는 실패하는 것이 정상이에요 — 병합 담당이 승인을 확인하고 병합해요(docs/TEAM.md).");
        } else console.log(`✓ 순서 잠금이 기준 가지(${at})의 잠금 ${base.locks.length}개와 맞아요`);
      }
    }
    for (const o of outs) {
      const cur = fs.existsSync(o.out) ? readText(o.out) : null, same = cur === o.html;
      const info = `${(Buffer.byteLength(o.html) / 1024).toFixed(0)}KB · CSS ${o.css}개 · 모듈 ${o.modules}개`;
      if (check) {
        if (!same) { fail = true; console.error(`✗ ${o.file}이 src/·content/로 만든 결과와 달라요. ${o.file}을 직접 고쳤거나 빌드를 안 했어요 → npm run build 후 ${o.file}도 같이 커밋하세요.`); }
        else console.log(`✓ ${o.file}이 소스와 같아요 (${info})`);
      } else {
        if (!same) fs.writeFileSync(o.out, o.html);
        console.log(`${same ? "= " + o.file + " 그대로" : "✓ " + o.file + " 만듦"} (${info} · ${TARGETS[o.name].label})`);
      }
    }
    if (fail) process.exit(1);
  } catch (e) {
    if (!(e instanceof BuildError)) throw e;
    console.error("✗ 빌드 실패\n" + e.list.map((x) => "  - " + x).join("\n"));
    process.exit(1);
  }
}
