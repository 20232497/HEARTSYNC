// HEART SYNC 빌드: src/(뼈대·CSS·ES 모듈)와 content/(작품 폴더)를 합쳐 저장소 루트에 index.html 한 파일을 만든다.
// 배포물은 늘 이 한 파일(클래식 스크립트 하나) — GitHub Pages·로컬 파일(file://)·claude.ai artifact가 그대로 띄운다.
//   node tools/build.mjs           index.html 만들기 (npm run build)
//   node tools/build.mjs --check   index.html이 지금 소스로 만든 결과와 같은지만 확인 (npm run check, GitHub Actions)
//
// 모듈 번들: src/js/main.js에서 import를 따라가며 모듈을 읽고, 의존 모듈이 먼저 오도록 순서를 정한 뒤 import/export 줄만 벗겨
// 이어 붙인다(모듈 안의 줄 번호는 그대로). 그 전에 검사한다 — 선언도 import도 안 된 이름, export 안 된 이름 import, 같은 이름 두 번 선언,
// import한 바인딩에 대입, 맨 윗단(함수 밖)에서 뒤에 오는 모듈의 const/class 사용(순환 의존), 인라인 스크립트 문법, 오래된 iOS 문법.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as espree from "espree";
import * as scope from "eslint-scope";
import { BROWSER_GLOBALS } from "./globals.mjs";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src"), JS = path.join(SRC, "js"), CONTENT = path.join(ROOT, "content"), OUT = path.join(ROOT, "index.html");
const PAGE = path.join(SRC, "page.html"), GEN_FILE = path.join(JS, "content", "generated.js"), BUILD_DIR = path.join(ROOT, ".build");

/* 폴더 이름이 곧 작품의 aud(관심있는 대화) 값 */
export const AUD_DIRS = { f: "여성향(남성 캐릭터와의 대화)", m: "남성향(여성 캐릭터와의 대화)", all: "전체(남녀가 섞임)" };
/* 빌드 검사에 쓰는 앱 규칙 — src/js에서 같은 코드를 꺼내 쓴다(규칙이 두 군데로 갈라지지 않게) */
const APP_RULES = ["SIT", "PALETTES", "MOTIFS", "CATS", "guessAud", "personaWho", "personaLook", "castLook", "minorFlags", "dimOf", "dimDef", "DIMS"];
/* 오래된 iOS(13 이하)·인앱 브라우저에서 문법 오류가 나는 것들 */
const OLD_IOS = [[/\|\|=|&&=|\?\?=/, "논리 할당(||= &&= ??=)"], [/\.at\(/, "Array.at()"], [/\(\?<[=!]/, "정규식 lookbehind"],
  [/\bstructuredClone\b/, "structuredClone"], [/\.findLast(?:Index)?\(/, "findLast()"], [/\bObject\.hasOwn\(/, "Object.hasOwn()"]];

export class BuildError extends Error { constructor(list) { super(list.join("\n")); this.list = list; } }

const readText = (p) => fs.readFileSync(p, "utf8").replace(/^﻿/, "").replace(/\r\n?/g, "\n");
const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");
const visible = (name) => !name.startsWith(".") && !name.startsWith("_");
const subdirs = (dir) => fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory() && visible(d.name)).map((d) => d.name).sort();
const writeIfChanged = (p, text) => { if (!fs.existsSync(p) || readText(p) !== text) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); return true; } return false; };

/* ---------------------------------------------------------------- 뼈대(src/page.html) 펼치기 */
const INCLUDE = /^\s*<!--\s*@include\s+(\S+)\s*-->\s*$/, SCRIPT = /^\s*<!--\s*@script\s+(\S+)\s*-->\s*$/;

function includeFiles(pattern) {
  const m = pattern.match(/^([\w-]+(?:\/[\w-]+)*)\/\*(\.\w+)$/);
  if (!m) throw new BuildError([`src/page.html: @include ${pattern} — "폴더/*.확장자" 모양만 쓸 수 있어요`]);
  const dir = path.join(SRC, m[1]);
  if (!fs.existsSync(dir)) throw new BuildError([`src/page.html: @include ${pattern} — src/${m[1]} 폴더가 없어요`]);
  // 파일 이름 순서가 곧 들어가는 순서(앞의 두 자리 번호). _로 시작하면 뺌
  return fs.readdirSync(dir).filter((f) => f.endsWith(m[2]) && visible(f)).sort().map((f) => path.join(dir, f));
}
/* 조각은 앞뒤 빈 줄 없이 두고, 조각 사이에 빈 줄 하나를 넣어 잇는다 */
const tidy = (text) => text.replace(/^\n+/, "").replace(/\n*$/, "\n");

async function assemble() {
  const out = [], map = []; // map: 결과 줄 → 원본 파일(오류 위치 안내용)
  let line = 1, css = 0, bundle = null;
  const push = (text, from, fromLine = 1) => {
    const n = text.split("\n").length - 1;
    map.push({ start: line, end: line + n - 1, from, fromLine });
    out.push(text); line += n;
  };
  const tpl = readText(PAGE).split("\n");
  if (tpl[tpl.length - 1] === "") tpl.pop();
  for (let i = 0; i < tpl.length; i++) {
    const inc = tpl[i].match(INCLUDE), scr = tpl[i].match(SCRIPT);
    if (inc) {
      const files = includeFiles(inc[1]).map((f) => ({ f, text: readText(f) })).filter((x) => x.text.trim());
      files.forEach(({ f, text }, k) => { if (k) push("\n", "(빈 줄)"); push(tidy(text), rel(f), text.match(/^\n*/)[0].length + 1); css++; });
    } else if (scr) {
      if (bundle) throw new BuildError(["src/page.html: @script는 한 번만"]);
      bundle = bundleModules(path.join(SRC, scr[1]));
      bundle.pieces.forEach((p) => { push(p.header, "(모듈 머리)"); push(p.text, p.rel, 1); });
    } else push(tpl[i] + "\n", "src/page.html", i + 1);
  }
  if (!bundle) throw new BuildError(["src/page.html에 <!-- @script js/main.js --> 자리가 없어요"]);
  return { html: out.join(""), map, css, bundle };
}

/* ---------------------------------------------------------------- 모듈 번들러 */
const parseModule = (code, file) => {
  try { return espree.parse(code, { ecmaVersion: 2022, sourceType: "module", range: true, loc: true }); }
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
  const info = { file, rel: r, code, ast, imports: [], importOrder: [], declared: new Map(), exports: new Map(), bindings: new Map(), cuts: [] };
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

function bundleModules(entry) {
  const errors = [], warnings = [], mods = new Map();
  if (!fs.existsSync(entry)) throw new BuildError([`진입 모듈 ${rel(entry)}이 없어요`]);
  loadModule(entry, mods, errors, "src/page.html");
  if (errors.length) throw new BuildError(errors);
  // 순서: 진입점에서 import 순서대로 깊이 우선, 의존 모듈이 먼저(진입점이 맨 뒤)
  const order = [], state = new Map();
  const visit = (file) => {
    if (state.get(file)) return; state.set(file, 1);
    for (const t of mods.get(file).importOrder) visit(t);
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
      const t = mods.get(imp.target); if (!t) continue;
      for (const n of imp.names) if (!t.exports.has(n)) errors.push(`${m.rel}:${imp.line}: ${t.rel}은 "${n}"을 내보내지 않아요${t.declared.has(n) ? ` — ${t.rel}:${t.declared.get(n).line}의 선언 앞에 export를 붙이세요` : ""}`);
    }
    for (const ref of m.evalRefs) {
      const b = m.bindings.get(ref.name), t = b && mods.get(b.from); if (!t) continue;
      const kind = t.exports.get(ref.name);
      if (kind !== "function" && pos.get(t.file) > pos.get(m.file)) errors.push(`${m.rel}:${ref.line}: 맨 윗단에서 "${ref.name}"을 쓰는데 그걸 내보내는 ${t.rel}이 순환 의존 때문에 뒤에 와요(초기화 전 접근) — 함수 안으로 옮기거나 import 고리를 끊으세요`);
    }
    if (m.unused) warnings.push(`${m.rel}: 쓰지 않는 import ${m.unused.join(", ")}`);
  }
  if (errors.length) throw new BuildError([...new Set(errors)]);
  // 출력: import/export 벗기기(줄 수 유지)
  const pieces = order.map((m) => {
    let text = m.code;
    for (const c of [...m.cuts].sort((a, b) => b.range[0] - a.range[0])) {
      const orig = text.slice(c.range[0], c.range[1]);
      text = text.slice(0, c.range[0]) + (c.blank ? "\n".repeat((orig.match(/\n/g) || []).length) : "") + text.slice(c.range[1]);
    }
    text = text.replace(/\n*$/, "\n");
    return { rel: m.rel, header: `/* ── ${m.rel} */\n`, text };
  });
  return { pieces, warnings, count: order.length };
}

/* ---------------------------------------------------------------- 앱 규칙 꺼내기(작품 검사용) */
function appRules() {
  const files = [];
  (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith(".js") && p !== GEN_FILE) files.push(p); } })(JS);
  const lines = files.flatMap((f) => readText(f).split("\n")), parts = [];
  for (const name of APP_RULES) {
    const fn = new RegExp(`^(?:export )?function\\s+${name}\\s*\\(`), cn = new RegExp(`^(?:export )?const\\s+${name}\\s*=`);
    const i = lines.findIndex((l) => fn.test(l) || cn.test(l));
    if (i < 0) throw new BuildError([`src/js에서 ${name}을(를) 찾지 못했어요 — 이름을 바꿨다면 tools/build.mjs의 APP_RULES도 고쳐 주세요`]);
    let j = i;
    if (fn.test(lines[i])) { if (!/}\s*$/.test(lines[i])) while (j < lines.length && lines[j] !== "}") j++; }
    else while (j < lines.length && !/;\s*$/.test(lines[j])) j++;
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

async function buildContent(R) {
  const errors = [], warnings = [], works = [], rows = [];
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
    if (errors.length === before) { works.push({ c, aud, row, rel: wrel, order: mod.order }); if (row) row.n++; }
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
  if (errors.length) throw new BuildError(errors);

  const byOrder = (a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0);
  works.sort(byOrder);
  rows.sort(byOrder);
  const objs = works.map(({ c, aud, row, rel }) => {
    const o = { ...c };
    if (row && o.row === undefined) o.row = row.key;
    if (o.aud === undefined) o.aud = aud;
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
  const count = (a) => works.filter((w) => w.aud === a).length;
  return { warnings, stats: { works: works.length, f: count("f"), m: count("m"), all: count("all"), rows: rows.length } };
}

function checkWork(mod, { aud, row, id, wrel, R, errors, warnings }) {
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

  // 출연진: 없으면 앱이 설정의 "외모:" 줄로 한 명(code c)을 만든다(src/js/content/index.js) — 검사도 같은 모양으로
  let cast = c.cast;
  if (cast === undefined) cast = [{ code: "c", name: c.name, look: (String(c.persona || "").match(/외모:\s*([^\n]+)/) || [])[1] || "" }];
  else if (!Array.isArray(cast) || !cast.length) { e("cast는 출연진 배열(한 명 이상)"); cast = []; }
  const codes = new Set();
  cast.forEach((x, i) => {
    if (!isObj(x) || !/^[a-z0-9]+$/.test(x.code || "") || !str(x.name)) return e(`cast[${i}]: { code: "영문 소문자·숫자", name, look } 모양이어야 해요`);
    if (codes.has(x.code)) e(`cast 코드 "${x.code}"가 겹쳐요`);
    codes.add(x.code);
    if (x.look !== undefined && typeof x.look !== "string") e(`cast[${i}].look은 글이어야 해요`);
    if (x.tags !== undefined && (typeof x.tags !== "string" || /[가-힣]/.test(x.tags))) e(`cast[${i}].tags는 영문 Danbooru 태그 글이어야 해요(한국어 외모는 look에)`);
  });
  if (c.lookTags !== undefined && (typeof c.lookTags !== "string" || /[가-힣]/.test(c.lookTags))) e("lookTags는 영문 Danbooru 태그 글이어야 해요");
  if (c.lookTags !== undefined && c.cast !== undefined) w("cast가 있으면 lookTags는 쓰이지 않아요 — cast[].tags에 적어 주세요");
  if (c.lore !== undefined && (!Array.isArray(c.lore) || c.lore.some((x) => !isObj(x) || !Array.isArray(x.keys) || !x.keys.length || x.keys.some((k) => !str(k)) || !str(x.text) || (x.tags !== undefined && typeof x.tags !== "string"))))
    e("lore(키워드북)는 [{ keys: [\"키워드\", …], text: \"설명\", tags?: \"영문 태그\" }, …]");
  if (!Array.isArray(c.openings) || !c.openings.length) e("openings(시작 상황)가 하나 이상 있어야 해요");
  else c.openings.forEach((o, i) => {
    if (!isObj(o) || !str(o.title) || !str(o.text)) return e(`openings[${i}]: title·text가 있어야 해요`);
    if (o.directive !== undefined && typeof o.directive !== "string") e(`openings[${i}].directive는 글이어야 해요`);
    if (o.status !== undefined && (!isObj(o.status) || Object.values(o.status).some((v) => typeof v !== "string" && typeof v !== "number")))
      e(`openings[${i}].status는 { "칸 이름": 글 또는 숫자 }`);
    else if (o.status && Array.isArray(c.fields)) {
      const miss = Object.keys(o.status).filter((k) => !c.fields.includes(k));
      if (miss.length) w(`openings[${i}].status의 ${miss.join(", ")} 칸이 fields에 없어요`);
    }
    for (const m of o.text.matchAll(/\[\[img:([^\]:]+):([\d,]+)\]\]/g)) {
      if (!codes.has(m[1])) e(`openings[${i}]: [[img:${m[1]}:${m[2]}]]의 인물 코드가 cast에 없어요`);
      const bad = m[2].split(",").filter((n) => n !== "" && +n >= R.SIT.length && !R.DIMS[+n]);
      if (bad.length) e(`openings[${i}]: [[img:${m[1]}:${m[2]}]] — ${bad.join(",")}은(는) 기본 상황 번호(0~${R.SIT.length - 1})도 내장 코드(1xx·4xx·5xx)도 아니에요`);
    }
  });

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
function where(map, line) {
  const m = map.find((x) => line >= x.start && line <= x.end);
  return m ? `${m.from}:${m.fromLine + line - m.start}` : `index.html:${line}`;
}
function checkScripts(html, map) {
  const errors = [], re = /<script>([\s\S]*?)<\/script>/g;
  let m, k = 0;
  while ((m = re.exec(html))) {
    k++;
    const startLine = html.slice(0, m.index + "<script>".length).split("\n").length; // 스크립트 첫 줄의 결과 줄 번호
    try { new vm.Script(m[1], { filename: `script${k}`, lineOffset: startLine - 1 }); }
    catch (e) {
      const ln = +(String(e.stack).match(new RegExp(`script${k}:(\\d+)`)) || [])[1];
      errors.push(`${ln ? where(map, ln) : `<script> ${k}번째`}: 문법 오류 — ${e.message}`);
    }
    m[1].split("\n").forEach((text, i) => {
      for (const [re2, name] of OLD_IOS) if (re2.test(text)) errors.push(`${where(map, startLine + i)}: 오래된 iOS에서 안 도는 문법(${name}) — CLAUDE.md '모바일'`);
    });
  }
  if (!k) errors.push("index.html에 인라인 <script>가 없어요");
  return errors;
}

export async function build() {
  if (!fs.existsSync(PAGE)) throw new BuildError(["src/page.html이 없어요"]);
  const content = await buildContent(appRules());
  const { html: raw, map, css, bundle } = await assemble();
  const html = raw.replace(/<\/script(?![\s>])/gi, "<\\/script").split(LS).join("\\u2028").split(PS).join("\\u2029");
  const errors = checkScripts(html, map);
  if (errors.length) throw new BuildError(errors);
  fs.mkdirSync(BUILD_DIR, { recursive: true });
  fs.writeFileSync(path.join(BUILD_DIR, "linemap.json"), JSON.stringify(map));
  return { html, stats: content.stats, warnings: [...content.warnings, ...bundle.warnings], css, modules: bundle.count };
}

/* ---------------------------------------------------------------- 명령줄 */
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes("--check");
  try {
    const { html, stats, warnings, css, modules } = await build();
    warnings.forEach((x) => console.warn("⚠ " + x));
    const cur = fs.existsSync(OUT) ? readText(OUT) : null;
    const kb = (Buffer.byteLength(html) / 1024).toFixed(0) + "KB";
    const summary = ` · CSS ${css}개 · 모듈 ${modules}개 · 작품 ${stats.works}개(여성향 ${stats.f} · 남성향 ${stats.m} · 전체 ${stats.all}), 홈 줄 ${stats.rows}개`;
    if (check) {
      if (cur !== html) {
        console.error("✗ index.html이 src/·content/로 만든 결과와 달라요. index.html을 직접 고쳤거나 빌드를 안 했어요 → npm run build 후 index.html도 같이 커밋하세요.");
        process.exit(1);
      }
      console.log(`✓ index.html이 소스와 같아요 (${kb}${summary})`);
    } else {
      if (cur !== html) fs.writeFileSync(OUT, html);
      console.log(`${cur === html ? "= index.html 그대로" : "✓ index.html 만듦"} (${kb}${summary})`);
    }
  } catch (e) {
    if (!(e instanceof BuildError)) throw e;
    console.error("✗ 빌드 실패\n" + e.list.map((x) => "  - " + x).join("\n"));
    process.exit(1);
  }
}
