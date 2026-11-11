// 뼈대(src/page.html·admin.html)를 펼치고 ES 모듈을 한 스크립트로 묶음: @include CSS 조각, @script 모듈 번들(import를 따라 순서를 정하고 import/export 줄을 벗김),
// 사용자 빌드의 주석 벗기기. 모듈 검사(선언·import 안 된 이름, 같은 이름 두 번, import 바인딩에 대입, 순환 초기화 순서)도 여기서
import fs from "node:fs";
import path from "node:path";
import * as espree from "espree";
import * as scope from "eslint-scope";
import { BROWSER_GLOBALS } from "../globals.mjs";
import { BuildError, SRC, readText, rel, visible } from "./common.mjs";

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

export async function assemble(t) {
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
