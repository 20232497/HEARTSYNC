// 순서 잠금(npm run content:lock): 작품마다 이미 공개된 식별자를 작품 폴더의 lock.json에 적어 두고, 빌드가 그것과 어긋나면 멈춘다(2026-11-11 사용자 결정 — 식별자 안정화).
// 왜: 장소·컷씬·키워드북 그림은 목록의 순번이 곧 코드(MP1·EV1·lore-1)다. 진행 중인 대화방의 글에는 [[MP2]] 같은 태그가, 내 서재의 수집 기록에는 코드 글자가 남아 있어서
//     목록 중간에 끼우거나 지우거나 순서를 바꾸면 그 방과 기록이 다른 장소·컷씬을 가리키게 된다. 시작 상황 id와 인물 코드는 없어지면 방이 끊긴다.
// 규칙(판정은 이 파일의 checkLock 하나 — 빌드와 이 명령이 같이 씀):
//   자리로 세는 목록(places·cuts·lore): 잠긴 자리는 그대로 있어야 함. 맨 뒤에 더하기와 이름 고치기는 자유. 중간에 끼우기·지우기·순서 바꾸기는 어긋남
//   이름표로 세는 목록(openings의 id·cast의 code): 잠긴 것이 지금도 있어야 함. 순서와 새로 더하기는 자유
//   한계: 맨 끝 항목을 지우고 새 항목을 더하면 '이름 고치기'와 구분되지 않는다(이름으로 추정하므로)
// 쓰는 법:
//   npm run content:lock                     모든 작품의 잠금을 지금 내용으로 찍음(뒤에 더한 것·고친 이름 반영). 어긋난 작품이 하나라도 있으면 아무것도 찍지 않고 멈춤
//   npm run content:lock -- --force <작품 id>  그 작품은 어긋나도 다시 찍음(바뀌는 자리를 표로 먼저 보여 줌) — 이미 만든 대화방이 끊길 수 있어 사용자 승인이 있을 때만(docs/TEAM.md)
// npm run build는 어긋나면 실패하고, 아직 안 잠긴 것은 한 줄로 알리기만 한다. npm run check(병합 전 검사·CI)는 '잠금이 최신이 아님'도 실패로 본다 — 작품을 고쳤으면 커밋 전에 이 명령을 한 번.
// npm run check는 **기준 가지(origin/main)의 잠금과도** 견준다(아래 readBaseLocks·checkBase) — 잠금 파일을 지우거나 손으로 고쳐 다시 찍는 우회를 막음.
//   사용자 승인을 받아 강제로 다시 찍은 가지는 그래서 check가 실패하는 것이 정상이고, 병합 담당이 승인을 확인한 뒤 병합한다(docs/TEAM.md).
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { SERIES } from "../src/js/core/constants.js";

export const LOCK_FILE = "lock.json";
const NOTE = "빌드가 지키는 순서 잠금 — 손으로 고치지 말고 npm run content:lock (content/README.md '순서 잠금')";
const seriesOf = (field) => Object.keys(SERIES).find((k) => SERIES[k].field === field) || field; // 예약 시리즈의 코드 글자(MP·EV)는 SERIES에서
/** 잠금에 들어가는 목록 — by: 자리(pos — 순번이 곧 코드) 또는 이름표(id), pick: 항목에서 잠글 글, code(n): 그 자리의 코드(안내 문구용) */
export const LOCK_LISTS = {
  places: { by: "pos", name: "장소", pick: (x) => x.name, code: (n) => seriesOf("places") + n },
  cuts: { by: "pos", name: "컷씬", pick: (x) => x.title, code: (n) => seriesOf("cuts") + n },
  lore: { by: "pos", name: "키워드북", pick: (x) => (Array.isArray(x.keys) ? x.keys[0] : undefined), code: (n) => "lore-" + n },
  openings: { by: "id", name: "시작 상황", pick: (x) => x.id },
  cast: { by: "id", name: "인물 코드", pick: (x) => x.code }
};
const list = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);

/** 작품의 지금 식별자들(잠금 파일에 적히는 모양) — { places: [이름…], cuts: [제목…], lore: [첫 키…], openings: [id…], cast: [코드…] }. @param {object} c 작품 */
export function lockOf(c) {
  const out = {};
  for (const k of Object.keys(LOCK_LISTS)) out[k] = (Array.isArray(c && c[k]) ? c[k] : []).map((x) => (x && typeof x === "object" ? LOCK_LISTS[k].pick(x) : undefined)).map((s) => (typeof s === "string" ? s : ""));
  return out;
}
/**
 * 잠금과 지금을 견줌(순수). errors: 어긋난 것(빌드 실패 사유 — 목록마다 첫 자리만 자세히, 나머지는 수로), changes: 잠금 명령이 찍을 것(뒤에 더한 것·고친 이름·새 이름표),
 * stale: 어긋나지는 않았지만 잠금이 지금과 다름(찍어야 함). 잠금이 없으면(새 작품) 전부 '아직 안 잠김'.
 * @param {Record<string, string[]>|null|undefined} lock @param {Record<string, string[]>} cur
 * @returns {{ errors: string[], changes: { key: string, code: string, from?: string, to: string }[], stale: boolean }}
 */
export function checkLock(lock, cur) {
  const errors = [], changes = [];
  for (const key of Object.keys(LOCK_LISTS)) {
    const L = LOCK_LISTS[key], was = list(lock && lock[key]), now = list(cur[key]), bad = [];
    if (L.by === "id") {
      was.forEach((id) => { if (!now.includes(id)) bad.push(`${L.name} ${id}이(가) 없어졌어요 — 이미 만든 대화방이 이것을 가리켜요. 고치지 말고 그대로 두세요`); });
      now.forEach((id) => { if (!was.includes(id)) changes.push({ key, code: id, to: id }); });
    } else {
      was.forEach((name, i) => {
        const code = L.code(i + 1);
        if (i >= now.length) return bad.push(`${code} '${name}'이(가) 없어졌어요(목록이 줄었어요) — 공개된 항목은 지우지 않아요`);
        if (now[i] === name) return;
        const moved = now.indexOf(name);
        if (moved >= 0) return bad.push(`${code} '${name}'이(가) ${L.code(moved + 1)} 자리로 밀렸어요 — 새 항목은 맨 뒤에 더하고 순서는 바꾸지 않아요`);
        if (was.includes(now[i])) return bad.push(`${code} '${name}'이(가) 지워져 뒤의 번호가 당겨졌어요(지금 그 자리는 '${now[i]}') — 공개된 항목은 지우지 않아요`);
        changes.push({ key, code, from: name, to: now[i] }); // 이름 고치기 — 통과
      });
      now.slice(was.length).forEach((name, j) => changes.push({ key, code: L.code(was.length + j + 1), to: name }));
    }
    if (bad.length) errors.push(bad[0] + (bad.length > 1 ? ` (이 목록에서 어긋난 자리 ${bad.length}곳)` : ""));
  }
  const same = Object.keys(LOCK_LISTS).every((k) => JSON.stringify(list(lock && lock[k])) === JSON.stringify(list(cur[k])));
  return { errors, changes, stale: !errors.length && !same };
}
/** 작품 폴더의 잠금 파일 읽기 — 없으면 null, JSON이 아니면 던짐. @param {string} dir @returns {Record<string, string[]>|null} */
export function readLock(dir) {
  const f = path.join(dir, LOCK_FILE);
  if (!fs.existsSync(f)) return null;
  const o = JSON.parse(fs.readFileSync(f, "utf8").replace(/^﻿/, ""));
  if (!o || typeof o !== "object" || Array.isArray(o)) throw new Error("사전 모양이 아니에요");
  return o;
}
/** 잠금 파일에 쓸 글(항목마다 한 줄 — 뒤에 더하면 줄 하나만 늘어 병합이 쉬움). @param {Record<string, string[]>} cur @returns {string} */
export const lockText = (cur) => JSON.stringify({ _: NOTE, ...cur }, null, 2) + "\n";
/** 강제로 다시 찍을 때 보여 줄 표: 자리마다 '코드 · 전 이름 → 새 이름', 없어지는 이름표. @returns {string[]} */
export function forceTable(lock, cur) {
  const rows = [];
  for (const key of Object.keys(LOCK_LISTS)) {
    const L = LOCK_LISTS[key], was = list(lock && lock[key]), now = list(cur[key]);
    if (L.by === "id") was.filter((id) => !now.includes(id)).forEach((id) => rows.push(`${L.name} ${id} · 없어짐`));
    else for (let i = 0; i < Math.max(was.length, now.length); i++) if (was[i] !== now[i]) rows.push(`${L.code(i + 1)} · ${was[i] === undefined ? "(없음)" : "'" + was[i] + "'"} → ${now[i] === undefined ? "(없어짐)" : "'" + now[i] + "'"}`);
  }
  return rows;
}

/* ---------------------------------------------------------------- 기준 가지와 견주기(npm run check)
   작업 폴더의 lock.json만 믿으면, 순서를 바꾼 뒤 그 파일을 지우거나 손으로 고치고 다시 찍어 우회할 수 있다 — 그래서 git에 기록된 잠금과도 견준다.
   기준은 '지금(HEAD)이 기준 가지에서 갈라진 자리'(merge-base)의 잠금: 가지를 딴 뒤 main에 더해진 항목 때문에 헛실패하지 않게. PR의 CI는 병합한 모습을 받아 오므로 그때는 main 그대로와 견줌 */
/**
 * 기준 가지의 잠금들을 git에서 읽음. git이 없거나(압축을 푼 폴더) 가지를 못 읽으면 null.
 * @param {string} ref 기준 가지(예: origin/main) @param {string} cwd 저장소 폴더
 * @returns {{ at: string, locks: { id: string, rel: string, lock: Record<string, string[]> }[] } | null} at = 견준 커밋
 */
export function readBaseLocks(ref, cwd) {
  const git = (...a) => execFileSync("git", a, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 1 << 26 });
  try {
    const at = git("merge-base", "HEAD", ref).trim();
    const files = git("ls-tree", "-r", "--name-only", "-z", at, "--", "content").split("\0").filter((f) => f.endsWith("/" + LOCK_FILE));
    return { at, locks: files.map((f) => { const rel = f.slice(0, -LOCK_FILE.length - 1); return { id: rel.split("/").pop(), rel, lock: JSON.parse(git("show", `${at}:${f}`).replace(/^﻿/, "")) }; }) };
  } catch (e) { return null; }
}
/**
 * 기준 가지의 잠금과 지금 작품을 견줌(순수 — 판정은 checkLock 그대로). 작품은 id(폴더 이름)로 짝지음: 폴더를 옮겨도 같은 작품.
 * errors: 기준 가지에 잠금이 있던 작품의 잠금 파일이 없어졌거나, 지금 작품이 그 잠금과 어긋남. notes: 알리기만 하는 것(작품이 없어짐 — 작품 id는 잠그지 않음)
 * @param {{ id: string, rel: string, lock: Record<string, string[]> }[]} base readBaseLocks의 locks
 * @param {{ id: string, rel: string, lock: object|null, cur: Record<string, string[]> }[]} works buildContent가 돌려준 locks
 * @returns {{ errors: string[], notes: string[] }}
 */
export function checkBase(base, works) {
  const errors = [], notes = [];
  for (const b of base) {
    const w = works.find((x) => x.id === b.id);
    if (!w) { notes.push(`기준 가지에 있던 작품 ${b.id}(${b.rel})이(가) 지금은 없어요 — 작품 id는 잠그지 않지만, 이미 만든 대화방은 이 작품을 찾지 못하게 돼요`); continue; }
    if (!w.lock) errors.push(`${w.rel}: ${LOCK_FILE}이 없어졌어요 — 잠금 파일은 지우지 않아요(되돌린 뒤 npm run content:lock)`);
    checkLock(b.lock, w.cur).errors.forEach((x) => errors.push(`${w.rel}: ${x}`));
  }
  return { errors, notes };
}

async function main() {
  const argv = process.argv.slice(2), fi = argv.indexOf("--force"), force = fi >= 0 ? argv[fi + 1] || "" : "";
  if (fi >= 0 && !force) { console.error("--force 뒤에 작품 id를 적어 주세요(예: npm run content:lock -- --force hwanghu)"); process.exit(1); }
  const { buildContent, appRules, BuildError } = await import("./build.mjs"); // 작품을 읽고 검사하는 길은 빌드와 같은 것(잠금 판정만 여기서)
  let locks;
  try { locks = (await buildContent(appRules(), { enforceLock: false })).locks; }
  catch (e) { if (!(e instanceof BuildError)) throw e; console.error("✗ 작품 검사에 걸려 잠금을 찍지 않았어요\n" + e.list.map((x) => "  - " + x).join("\n")); process.exit(1); }
  if (force && !locks.some((w) => w.id === force)) { console.error(`✗ 작품 "${force}"가 없어요 (있는 작품: ${locks.map((w) => w.id).join(", ")})`); process.exit(1); }
  const blocked = locks.filter((w) => w.res.errors.length && w.id !== force);
  if (blocked.length) {
    console.error("✗ 순서 잠금과 어긋난 작품이 있어 아무것도 찍지 않았어요\n" + blocked.flatMap((w) => w.res.errors.map((x) => `  - ${w.rel}: ${x}`)).join("\n") +
      "\n  새 항목은 목록 맨 뒤에 더해 주세요. 정말 순서를 바꿔야 하면(이미 만든 대화방이 끊길 수 있어요) npm run content:lock -- --force <작품 id>");
    process.exit(1);
  }
  let n = 0;
  for (const w of locks) {
    const forced = w.id === force && w.res.errors.length > 0;
    if (!forced && !w.res.stale) continue;
    if (forced) console.log(`! ${w.rel}: 어긋난 채로 다시 찍어요 — 바뀌는 자리\n` + forceTable(w.lock, w.cur).map((x) => "    " + x).join("\n"));
    fs.writeFileSync(path.join(w.dir, LOCK_FILE), lockText(w.cur));
    const ch = w.res.changes, added = ch.filter((x) => x.from === undefined), renamed = ch.filter((x) => x.from !== undefined);
    console.log(`✓ ${w.rel}/${LOCK_FILE}` + (forced ? " (강제)" : `${added.length ? ` · 새로 잠금 ${added.length}개(${added.slice(0, 4).map((x) => x.code).join(", ")}${added.length > 4 ? " …" : ""})` : ""}${renamed.length ? ` · 고친 이름 ${renamed.length}개` : ""}${!ch.length ? " · 순서만 맞춤" : ""}`));
    n++;
  }
  console.log(n ? `잠금 파일 ${n}개를 찍었어요 — 같이 커밋해 주세요` : `모든 작품(${locks.length}개)의 잠금이 최신이에요`);
}
// 맨 윗단에서 기다리지 않음(await 없음): main이 불러오는 build.mjs가 이 파일을 다시 import하므로, 여기서 기다리면 서로를 기다리다 멈춤
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((e) => { console.error(e); process.exit(1); });
