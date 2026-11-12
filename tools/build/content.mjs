// content/ 폴더(작품·홈 줄)를 읽고 검사해 src/js/content/generated.js를 만듦(buildContent): 폴더 구조, 작품마다 checkWork·순서 잠금·그림 파일
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { LOCK_FILE, checkLock, lockOf, readLock } from "../content-lock.mjs";
import { AUD_DIRS, BuildError, CONTENT, GEN_FILE, isObj, jsSafe, readText, str, subdirs, visible, writeIfChanged } from "./common.mjs";
import { scanImages } from "./images-scan.mjs";
import { checkWork } from "./work-check.mjs";

/* ---------------------------------------------------------------- 작품(content/) → src/js/content/generated.js */
/* opt.enforceLock(기본 참): 순서 잠금(작품 폴더의 lock.json — tools/content-lock.mjs)과 어긋나면 실패. 잠금 명령은 거짓으로 불러 작품마다의 판정(locks)만 받아 감 */
export async function buildContent(R, opt = {}) {
  const errors = [],
    warnings = [],
    works = [],
    rows = [],
    locks = [],
    enforce = opt.enforceLock !== false;
  if (!fs.existsSync(CONTENT)) throw new BuildError(["content/ 폴더가 없어요"]);
  for (const f of fs.readdirSync(CONTENT, { withFileTypes: true })) {
    if (f.isDirectory() && visible(f.name) && !AUD_DIRS[f.name])
      errors.push(
        `content/${f.name}: 이 자리에는 ${Object.keys(AUD_DIRS)
          .map((k) => `${k}/(${AUD_DIRS[k]})`)
          .join("·")} 폴더만 둘 수 있어요`
      );
  }
  // 작품 폴더 = work.js가 있는 폴더. content/<aud>/<id>/ 이면 홈 줄 없이, content/<aud>/<줄>/<id>/ 이면 그 줄(_row.json)에 들어감
  const addWork = async (dir, wrel, id, aud, row) => {
    let mod;
    try {
      mod = await import(pathToFileURL(path.join(dir, "work.js")).href);
    } catch (e) {
      return errors.push(
        `${wrel}/work.js: 불러오지 못했어요 — ${String(e.stack || e)
          .split("\n")
          .slice(0, 3)
          .join(" / ")}`
      );
    }
    const before = errors.length;
    const c = checkWork(mod, { aud, row, id, wrel, R, errors, warnings });
    const dup = works.find((w) => w.c.id === id);
    if (dup) errors.push(`${wrel}: id "${id}"가 ${dup.rel}에도 있어요`);
    if (errors.length !== before) return;
    works.push({ c, aud, row, rel: wrel, order: mod.order });
    if (row) row.n++;
    // 순서 잠금: 공개된 장소·컷씬·키워드북의 자리와 시작 상황 id·인물 코드가 그대로인지(판정은 content-lock.mjs checkLock 하나)
    let lock = null;
    try {
      lock = readLock(dir);
    } catch (e2) {
      return errors.push(`${wrel}/${LOCK_FILE}: 읽지 못했어요 — ${e2.message}. 손으로 고쳤다면 되돌리고 npm run content:lock`);
    }
    const cur = lockOf(c),
      res = checkLock(lock, cur);
    locks.push({ id, rel: wrel, dir, lock, cur, res });
    if (enforce) res.errors.forEach((x) => errors.push(`${wrel}: 순서 잠금 — ${x}. 일부러 바꾸는 것이면 npm run content:lock -- --force ${id}`));
  };
  const readRow = (dir, grel, key) => {
    let r;
    try {
      r = JSON.parse(readText(path.join(dir, "_row.json")));
    } catch (e) {
      return (errors.push(`${grel}/_row.json: JSON 형식이 아니에요 — ${e.message}`), null);
    }
    if (!isObj(r) || !str(r.title)) return (errors.push(`${grel}/_row.json: "title"(홈에 보일 줄 제목)이 있어야 해요`), null);
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
      const dir = path.join(adir, name),
        grel = `content/${aud}/${name}`;
      if (has(dir, "work.js") && has(dir, "_row.json")) {
        errors.push(`${grel}: work.js(작품)와 _row.json(홈 줄)을 한 폴더에 같이 둘 수 없어요`);
        continue;
      }
      if (has(dir, "work.js")) {
        await addWork(dir, grel, name, aud, null);
        continue;
      }
      if (!has(dir, "_row.json")) {
        errors.push(`${grel}: work.js(작품 폴더)나 _row.json(홈 가로 줄 폴더)이 있어야 해요`);
        continue;
      }
      const row = readRow(dir, grel, name);
      for (const id of subdirs(dir)) {
        const wdir = path.join(dir, id),
          wrel = `${grel}/${id}`;
        if (!has(wdir, "work.js"))
          errors.push(`${wrel}: work.js가 없어요${has(wdir, "_row.json") ? "(줄 안에 줄은 둘 수 없어요)" : "(작품 폴더마다 work.js 하나)"}`);
        else await addWork(wdir, wrel, id, aud, row);
      }
    }
  }
  rows.filter((r) => !r.n).forEach((r) => warnings.push(`${r.rel}: 줄에 작품이 없어 홈에 안 보여요`));
  if (!errors.length && !works.length) errors.push("content/에 작품이 하나도 없어요");
  // 작품 폴더의 images/(밖에서 만든 그림을 이름 규칙대로 넣음) — content/README.md
  if (fs.existsSync(path.join(CONTENT, "codes.json")))
    warnings.push("content/codes.json: 코드 표는 더 쓰지 않아요(그림 코드는 인물 코드+감정 번호 한 토큰 — content/README.md) — 지워도 돼요");
  for (const w of works) scanImages(w, R, errors, warnings);
  if (errors.length) throw new BuildError(errors);

  const byOrder = (a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0);
  works.sort(byOrder);
  rows.sort(byOrder);
  const objs = works.map((w) => {
    const { c, aud, row, rel } = w,
      o = { ...c };
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
  const count = (a) => works.filter((w) => w.aud === a).length,
    pics = works.reduce(
      (a, w) => a + Object.values(w.images || {}).reduce((b, m) => b + Object.keys(m).length, 0) + (w.img ? 1 : 0) + Object.keys(w.loreImages || {}).length,
      0
    );
  const stale = locks.filter((w) => w.res.stale);
  return {
    warnings,
    locks,
    stats: {
      works: works.length,
      f: count("f"),
      m: count("m"),
      all: count("all"),
      rows: rows.length,
      pics,
      unlocked: stale.reduce((n, w) => n + Math.max(1, w.res.changes.length), 0),
      stale: stale.map((w) => w.id)
    }
  };
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
