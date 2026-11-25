// 그림 총괄 페이지(이 PC 전용) — 모든 작품에 필요한 그림(표지·인물·감정 칸·장소)을 한 화면에서 그리고, 후보를 이 PC의 보관함에 모아 두고, 골라서 content/…/images/에 싣는다.
// 그림은 관리자만 만든다: 배포되는 index.html·admin.html에는 들어가지 않고(생성 서비스 주소는 빌드가 막음), 이 서버는 127.0.0.1에서만 듣는다.
// 필요한 그림 목록은 그림 의뢰 목록(content-art.mjs artRows)과 같고, 문구와 생성 값은 화풍 보관함의 규칙(archive/style-*)이 만든다 — 여기에는 값을 다시 적지 않는다.
// 생성 서비스(Runware) 키는 서버가 받지 않는다: 페이지가 그 브라우저의 localStorage에만 두고 생성 서비스로 바로 보낸다.
// 보관함: 그린 후보는 저장소 밖(기본 <홈>/HEARTSYNC-art — 커밋될 일이 없고 작업 사본이 지워져도 남음)에 작품/코드별로 쌓인다. 싣기는 그중 고른 한 장을 작품 폴더로 복사하는 일.
//   npm run art                    → http://127.0.0.1:5199 (먼저 npm run build — 빌드가 만든 작품 목록을 읽음)
//   npm run art -- --port 5300     포트 바꾸기
//   npm run art -- --lib D:/art    보관함 자리 바꾸기
//   npm run art -- --mock          연습 모드: 생성 서비스를 부르지 않고 자리 표시 그림으로 흐름만 돌려 봄(비용 0 — 실을 수 없음)
import http from "node:http";
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ART_SPECS, artRows } from "./content-art.mjs";
import { PALETTES } from "../src/js/core/constants.js";
import { styleOf, placeJob, assertPlace } from "../archive/style-works/code/place.js";
import { coverPlan, coverOf } from "../archive/style-works/code/cover.js";
import { groupPlan } from "../archive/style-works/code/cover-group.js";
import { LOGOS, LOGO_PAL } from "../archive/style-works/code/logos.js";
import { castSeed } from "../archive/style-works/code/seeds.js";
import { publish, status as siteStatus } from "./art/publish.mjs";
import { profileJob as animeProfile, emotionJob as animeEmotion, assertSafe as animeSafe } from "../archive/style-manime/code/assemble.js";
import {
  profileJob as dailyProfile,
  emotionJob as dailyEmotion,
  assertSafe as dailySafe,
  guided as dailyGuided
} from "../archive/style-mdaily/code/assemble.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name) => {
  const i = process.argv.indexOf("--" + name);
  return i >= 0 ? process.argv[i + 1] : "";
};
const PORT = +arg("port") || 5199,
  MOCK = process.argv.includes("--mock"),
  LIB = path.resolve(arg("lib") || path.join(os.homedir(), "HEARTSYNC-art") + (MOCK ? "-mock" : "")); // 연습 그림은 진짜 후보와 섞이지 않게 다른 폴더
const MAX_BODY = 12 * 1024 * 1024;
// 페이지가 가져다 쓰는 캔버스 코드(후처리·합성·로고) — 이 표에 있는 파일만 내준다
const CODE = {
  "cover-post.js": "archive/style-works/code/cover-post.js",
  "compose.js": "archive/style-works/code/compose.js",
  "logo.js": "archive/style-works/code/logo.js",
  "logos.js": "archive/style-works/code/logos.js",
  "post-anime.js": "archive/style-manime/code/post.js",
  "post-daily.js": "archive/style-mdaily/code/post.js"
};
const PAGE = ["app.js", "gen.js", "cover.js", "lib.js", "site.js"]; // tools/art/의 페이지 모듈
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg"
};

async function works() {
  const gen = path.join(ROOT, "src/js/content/generated.js");
  if (!fs.existsSync(gen)) throw new Error("src/js/content/generated.js가 없어요 — 먼저 npm run build");
  // 작품을 고친 뒤 다시 빌드하면 새로 읽히도록 파일 시각을 주소에 붙임
  const { ORIGINALS } = await import(pathToFileURL(path.join(ROOT, "src/js/content/index.js")).href + "?t=" + fs.statSync(gen).mtimeMs);
  return ORIGINALS;
}
const sizeOf = (spec) => {
  const [w, h] = ART_SPECS[spec].size.split("×").map(Number);
  return { w, h };
};
// 어느 종류를 그릴 수 있는지 — 컷씬·세계관 일러스트는 아직 규칙이 없다(archive/style-works/README.md)
const CAN = { cover: true, profile: true, cast: true, place: true, cut: false, lore: false };
/** 화면에 보낼 작품 목록 — 실렸는지는 빌드 결과가 아니라 지금 파일이 있는지로 본다(싣자마자 표시가 바뀜) */
function listing(all) {
  return all.map((c) => {
    const cv = coverOf(c.id, c),
      pal = PALETTES[c.pal] || PALETTES[0];
    return {
      id: c.id,
      title: c.title || c.name,
      style: styleOf(c.id),
      pal,
      logoPal: LOGO_PAL[c.id] || pal,
      cover: cv.type,
      lead: cv.lead || "",
      logo: !!LOGOS[c.id],
      // 표지는 인물 태그가 없어도 그린다(상징물·단체) — 나머지는 그림용 태그가 있어야 함
      rows: artRows(c).map((r) => ({
        ...r,
        has: fs.existsSync(path.join(ROOT, r.path)),
        size: sizeOf(r.spec),
        guide: guideOf(c, r), // 일상 화풍으로 그릴 때 밑그림 단계가 붙는 칸 — 페이지의 값 어림이 한 장을 더 센다
        can: CAN[r.spec] && (r.spec === "cover" || r.tags)
      }))
    };
  });
}
/** 인물 그림 칸이 일상 화풍에서 밑그림 단계를 거치는지(규칙은 화풍의 조립 코드 한 곳 — guided) */
function guideOf(c, row) {
  const m = row.spec === "cover" || row.spec === "place" ? null : /^([A-Z]+)(\d+)$/.exec(row.code || ""),
    who = m && (c.cast || []).find((x) => x.code === m[1]);
  return !!who && dailyGuided(who, +m[2]);
}
const shift = (j, vary) =>
  vary ? { ...j, seed: j.seed + vary * 101, ...(j.guide ? { guide: { ...j.guide, job: { ...j.guide.job, seed: j.guide.job.seed + vary * 101 } } } : {}) } : j;
/** 그림 한 장의 작업 — vary는 '다시 그리기' 횟수(시드를 그만큼 옮김), style은 인물 그림의 화풍을 바꿔 그려 볼 때("anime"·"daily", 없으면 작품의 화풍) */
function jobFor(c, row, vary, style) {
  if (row.spec === "cover") {
    // 표지는 한 모델(표지 규칙) — 단체는 그릴 작업 넷과 합성 값, 나머지는 작업 하나
    if (coverOf(c.id, c).type === "group") {
      const p = groupPlan(c.id, c);
      for (const k of Object.keys(p.parts)) p.parts[k] = shift(p.parts[k], vary);
      return { plan: p, cover: true, size: sizeOf(row.spec) };
    }
    const p = coverPlan(c.id, c);
    return { plan: { ...p, job: shift(p.job, vary) }, cover: true, size: sizeOf(row.spec) };
  }
  const anime = (style || styleOf(c.id)) === "anime";
  let job;
  if (row.spec === "place") job = assertPlace(placeJob(c.id, c, +row.code.slice(2)));
  else {
    const m = /^([A-Z]+)(\d+)$/.exec(row.code),
      c0 = (c.cast || []).find((x) => x.code === m[1]);
    if (!c0) throw new Error("인물을 찾지 못했어요: " + row.code);
    const base = c0.of ? (c.cast || []).find((x) => x.code === c0.of) : null; // 다른 모습(폼)은 성격·나이가 없으면 본체 값
    const who = base ? { ...c0, temper: c0.temper || base.temper, age: c0.age === undefined ? base.age : c0.age } : c0;
    const place = (c.places || [])[0],
      slot = +m[2];
    const seed = castSeed(c.id, c0.code),
      o = seed ? { seed } : {}; // 인물별 씨앗(style-works/code/seeds.js) — 없으면 화풍 규칙의 기본 씨앗
    if (anime) job = animeSafe(slot ? animeEmotion(who, place, slot, o) : animeProfile(who, place, o));
    else job = dailySafe(slot ? dailyEmotion(who, place, slot, o) : dailyProfile(who, place, o));
  }
  // 장소 그림의 후처리는 작품의 화풍을 따른다(인물 화풍만 바꿔 그려 보는 것)
  // 작업이 스스로 후처리의 종류를 적어 왔으면 그것으로(일상 화풍 작품의 남성 인물은 애니 화풍으로 그려 애니 후처리 → 그 위에 일상 화풍의 흐림 — job.postAs·job.haze)
  const post = job.postAs || ((row.spec === "place" ? styleOf(c.id) === "anime" : anime) ? "anime" : "daily");
  return { job: shift(job, vary), post, cover: false, size: sizeOf(row.spec) };
}

/* ── 보관함 ── <LIB>/<작품>/<코드>/<시각>.webp(후보) · <LIB>/<작품>/cover-parts/<자리>-<raw|cut>.<webp|png>(단체 표지의 조각 — 다시 붙일 때 다시 그리지 않음) · <LIB>/log.jsonl(그린 기록) */
const ID = /^[a-z0-9_-]+$/i,
  KEPT = /^\d{8}-\d{6}(-\d+)?\.webp$/,
  ROLE = /^(bg-raw\.webp|(left|mid|right)-(raw\.webp|cut\.png))$/;
const WRITING = ".writing"; // 단체 표지의 조각 묶음을 쓰는 중이라는 표식(안에 묶음 번호)
const isWebp = (b) => b.length > 16 && b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP";
const isPng = (b) => b.length > 16 && b.toString("latin1", 1, 4) === "PNG";
const stamp = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
function keep(work, code, buf, meta) {
  const dir = path.join(LIB, work, code);
  fs.mkdirSync(dir, { recursive: true });
  if (!inLib(dir)) throw new Error("보관함 밖을 가리키는 폴더예요: " + work + "/" + code);
  let name = stamp() + ".webp";
  for (let n = 2; fs.existsSync(path.join(dir, name)); n++) name = stamp() + "-" + n + ".webp";
  fs.writeFileSync(path.join(dir, name), buf);
  fs.appendFileSync(path.join(LIB, "log.jsonl"), JSON.stringify({ at: new Date().toISOString(), work, code, file: name, bytes: buf.length, ...meta }) + "\n");
  return name;
}
/** 보관함의 후보 전부 — { "작품/코드": [파일…(새것부터)] } 와 단체 표지 조각 { 작품: [파일…] } */
function kept() {
  const cands = {},
    parts = {};
  if (!fs.existsSync(LIB)) return { cands, parts };
  for (const w of fs.readdirSync(LIB, { withFileTypes: true })) {
    if (!w.isDirectory() || !ID.test(w.name)) continue;
    for (const c of fs.readdirSync(path.join(LIB, w.name), { withFileTypes: true })) {
      if (!c.isDirectory()) continue;
      const files = fs.readdirSync(path.join(LIB, w.name, c.name));
      if (c.name === "cover-parts")
        parts[w.name] = files.includes(WRITING) ? [] : files.filter((f) => ROLE.test(f)); // 쓰다 만 묶음은 내지 않는다
      else if (ID.test(c.name)) {
        const list = files
          .filter((f) => KEPT.test(f))
          .sort()
          .reverse();
        if (list.length) cands[w.name + "/" + c.name] = list;
      }
    }
  }
  return { cands, parts };
}
/** 폴더가 정말 보관함 안에 있는지 — 보관함 안에 밖을 가리키는 연결(심볼릭 링크·정션)이 있으면 그 너머는 읽지도 쓰지도 않는다 */
function inLib(dir) {
  if (!fs.existsSync(dir) || !fs.existsSync(LIB)) return false;
  const real = fs.realpathSync(dir),
    root = fs.realpathSync(LIB);
  return real === root || real.startsWith(root + path.sep);
}
/** 보관함 안의 파일 경로 — 작품/코드/파일 또는 작품/cover-parts/파일만 */
function libPath(rel) {
  const m = /^([a-z0-9_-]+)\/([a-z0-9_-]+)\/([\w.-]+)$/i.exec(rel || "");
  if (!m || !(m[2] === "cover-parts" ? ROLE.test(m[3]) : KEPT.test(m[3]))) return "";
  return inLib(path.join(LIB, m[1], m[2])) ? path.join(LIB, m[1], m[2], m[3]) : "";
}

/* ── 연습 모드: 생성 서비스 대신 자리 표시 그림(SVG)을 돌려준다 — 흐름·합성·보관함을 돈 안 들이고 돌려 볼 때 */
function mockImage(task) {
  const w = task.width || 960,
    h = task.height || 1280,
    hue = (task.seed || 0) % 360;
  const uri = (svg) => "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
  if (task.taskType === "removeBackground")
    return uri(
      `<svg xmlns="http://www.w3.org/2000/svg" width="1344" height="1792"><ellipse cx="672" cy="330" rx="150" ry="190" fill="#c9b8a8"/><rect x="622" y="500" width="100" height="80" fill="#c9b8a8"/>` +
        `<path d="M300 1792 L380 640 Q672 540 964 640 L1044 1792 Z" fill="#5a5f7a"/></svg>`
    );
  const label = String(task.positivePrompt || "")
    .slice(0, 46)
    .replace(/[<&>]/g, " ");
  return uri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="hsl(${hue},32%,${task.seedImage ? 34 : 26}%)"/>` +
      `<circle cx="${w / 2}" cy="${h * 0.36}" r="${w * 0.2}" fill="hsl(${hue},40%,62%)"/><text x="50%" y="${h * 0.72}" fill="#fff" font-size="${w / 28}" text-anchor="middle">연습 · ${w}×${h} · seed ${task.seed || "-"}</text>` +
      `<text x="50%" y="${h * 0.78}" fill="#ddd" font-size="${w / 44}" text-anchor="middle">${label}</text></svg>`
  );
}

/* ── 사이트에 올리기(./art/publish.mjs) ── 한 번에 하나만. 페이지가 진행 글을 /api/site로 읽는다 */
const run = (cmd, args, o = {}) =>
  new Promise((ok, no) =>
    execFile(
      cmd,
      args,
      { cwd: ROOT, maxBuffer: 64 * 1024 * 1024, windowsHide: true, timeout: o.timeout || 3 * 60000, encoding: o.raw ? "buffer" : "utf8" },
      (e, out, err) => {
        if (e && !o.allowFail)
          return no(
            new Error(
              `${cmd} ${args.slice(0, 3).join(" ")} — ${String(err || e.message)
                .trim()
                .slice(-400)}`
            )
          );
        ok({ code: e ? e.code || 1 : 0, out: o.raw ? out : String(out) });
      }
    )
  );
const job = { running: false, log: [], error: "", url: "", done: null };
const LOCK = path.join(LIB, ".publishing.lock");
/** 올리는 중인지 — 이 창이든 같은 PC의 다른 창이든(잠금 파일이 45분 넘게 남아 있으면 죽은 것으로 본다) */
const publishing = () => job.running || (fs.existsSync(LOCK) && Date.now() - fs.statSync(LOCK).mtimeMs < 45 * 60000);
/** 올리기 잠금을 잡는다 — 파일을 '없을 때만 만들기'로 한 번에(확인과 만들기 사이에 다른 창이 끼어들지 못하게). 못 잡으면 false */
function lock() {
  try {
    fs.mkdirSync(LIB, { recursive: true });
    if (fs.existsSync(LOCK) && Date.now() - fs.statSync(LOCK).mtimeMs >= 45 * 60000) fs.rmSync(LOCK, { force: true }); // 죽은 올리기가 남긴 것
    fs.writeFileSync(LOCK, String(process.pid), { flag: "wx" });
    return true;
  } catch {
    return false;
  }
}
function startPublish() {
  Object.assign(job, { running: true, log: [], error: "", url: "", done: null });
  publish({
    run,
    root: ROOT,
    log: (t) => job.log.push(t),
    wait: (ms) => new Promise((r) => setTimeout(r, ms)),
    build: () => run(process.execPath, ["tools/build.mjs"], { timeout: 10 * 60000 })
  })
    .then((d) => Object.assign(job, { done: d, url: d.url }))
    .catch((e) => Object.assign(job, { error: String((e && e.message) || e), url: (e && e.url) || "" }))
    .finally(() => {
      job.running = false;
      fs.rmSync(LOCK, { force: true });
    });
}

const send = (res, code, body, type) => {
  res.writeHead(code, { "content-type": type || "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};
const file = (res, abs) =>
  abs && fs.existsSync(abs)
    ? send(res, 200, fs.readFileSync(abs), TYPES[path.extname(abs).toLowerCase()] || "application/octet-stream")
    : send(res, 404, { error: "없는 파일" });
function findRow(all, q) {
  const c = all.find((x) => x.id === q.get("work")),
    row = c && artRows(c).find((r) => r.code === q.get("code"));
  if (!row) throw new Error("없는 작품·코드예요: " + q.get("work") + " " + q.get("code"));
  return { c, row };
}
const body = (req) =>
  new Promise((ok, no) => {
    const parts = [];
    let n = 0;
    req.on("data", (d) => ((n += d.length) > MAX_BODY ? (no(new Error("그림이 너무 커요(12MB까지)")), req.destroy()) : parts.push(d)));
    req.on("end", () => ok(Buffer.concat(parts)));
    req.on("error", no);
  });
// 쓰는 요청은 이 페이지에서 온 것만(다른 사이트가 이 주소로 보내는 요청을 막음)
const HOSTS = ["127.0.0.1:" + PORT, "localhost:" + PORT];
const ours = (req, browser) =>
  req.headers["x-hs-art"] === "1" &&
  HOSTS.includes(req.headers.host || "") &&
  (req.headers.origin ? req.headers.origin === "http://" + req.headers.host : !browser); // browser: 페이지에서 누른 것만 받는 요청(올리기)

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://127.0.0.1"),
    q = u.searchParams,
    get = req.method === "GET",
    post = req.method === "POST";
  // 이 서버의 주소로 온 요청만 받는다(읽기도) — 다른 이름을 이 PC로 돌려 붙이는 수법(DNS 리바인딩)으로 보관함·상태를 읽지 못하게
  if (!HOSTS.includes(req.headers.host || "")) return send(res, 403, { error: "이 주소(127.0.0.1)로만 열 수 있어요" });
  try {
    if (get && u.pathname === "/") return file(res, path.join(ROOT, "tools/art/index.html"));
    if (get && PAGE.includes(u.pathname.slice(1))) return file(res, path.join(ROOT, "tools/art", u.pathname.slice(1)));
    if (get && u.pathname.startsWith("/code/")) return file(res, CODE[u.pathname.slice(6)] ? path.join(ROOT, CODE[u.pathname.slice(6)]) : "");
    if (get && u.pathname === "/api/meta") return send(res, 200, { mock: MOCK, lib: LIB, root: ROOT });
    if (get && u.pathname === "/api/works") return send(res, 200, listing(await works()));
    if (get && u.pathname === "/api/job") {
      const { c, row } = findRow(await works(), q);
      return send(res, 200, jobFor(c, row, +q.get("vary") || 0, q.get("style") || ""));
    }
    if (get && u.pathname === "/api/kept") return send(res, 200, kept());
    // 올릴 수 있는지(그림 전용 작업 사본인지)·올릴 그림·진행 중인 올리기
    if (get && u.pathname === "/api/site") return send(res, 200, { ...(await siteStatus(run, ROOT)), job, mock: MOCK });
    if (get && u.pathname === "/lib") return file(res, libPath(q.get("path")));
    // 실린 그림 보기 — 작품 폴더의 images/ 안 파일만
    if (get && u.pathname === "/file") {
      const rel = q.get("path") || "",
        abs = path.resolve(ROOT, rel);
      if (!/^content\/[\w/.-]+\/images\/[\w.-]+\.(webp|png|jpe?g)$/i.test(rel) || !abs.startsWith(path.join(ROOT, "content") + path.sep))
        return send(res, 400, { error: "볼 수 없는 경로" });
      return file(res, abs);
    }
    if (post && !ours(req)) return send(res, 403, { error: "이 페이지에서만 할 수 있어요" });
    if (post && u.pathname === "/mock") {
      if (!MOCK) return send(res, 404, { error: "연습 모드가 아니에요" });
      const tasks = JSON.parse((await body(req)).toString("utf8"));
      // 진짜 생성 서비스처럼: 배경 지우기(removeBackground)의 응답은 taskType이 imageBackgroundRemoval로 온다(이 차이로 실제 모드의 단체 표지가 멈췄었음 — 2026-11-23)
      const typeOf = (t) => (t.taskType === "removeBackground" ? "imageBackgroundRemoval" : t.taskType);
      return send(res, 200, {
        data: tasks.map((t) => ({ taskType: typeOf(t), taskUUID: t.taskUUID, imageDataURI: mockImage(t), cost: 0, NSFWContent: false }))
      });
    }
    // 사이트에 올리기 — 빌드·커밋·올리기·PR·검사 통과 시 병합. 연습 모드에서는 하지 않는다
    if (post && u.pathname === "/api/site") {
      if (MOCK) return send(res, 400, { error: "연습 모드에서는 올릴 수 없어요" });
      if (!ours(req, true)) return send(res, 403, { error: "이 페이지의 단추로만 올릴 수 있어요" });
      if (job.running || !lock()) return send(res, 409, { error: "이미 올리는 중이에요(다른 창일 수도 있어요)" });
      startPublish();
      return send(res, 200, { ok: true });
    }
    // 후보를 보관함에 — 의뢰 목록에 있는 작품·코드만, webp만
    if (post && u.pathname === "/api/keep") {
      const { c, row } = findRow(await works(), q),
        buf = await body(req);
      if (!isWebp(buf)) return send(res, 400, { error: "webp 그림이 아니에요" });
      return send(res, 200, { ok: true, file: keep(c.id, row.code, buf, { seed: +q.get("seed") || 0, mock: MOCK || undefined }) });
    }
    // 그리다 실패한 까닭을 보관함 기록(log.jsonl)에 남긴다 — 가끔 나는 실패를 나중에 살펴볼 수 있게(그림은 없음).
    // 페이지에서 보낸 것만, 짧은 글만 받고, 긴 글자열(키·작업 번호)은 지운다. 기록의 event: "fail"로 후보 기록과 구분된다
    if (post && u.pathname === "/api/fail") {
      if (!ours(req, true) || +req.headers["content-length"] > 2048) return send(res, 403, { error: "이 페이지에서 보낸 짧은 글만 받아요" });
      const { c, row } = findRow(await works(), q),
        why = (await body(req))
          .toString("utf8")
          .replace(/[A-Za-z0-9_-]{16,}/g, "…")
          .slice(0, 300);
      fs.mkdirSync(LIB, { recursive: true });
      fs.appendFileSync(
        path.join(LIB, "log.jsonl"),
        JSON.stringify({ at: new Date().toISOString(), event: "fail", work: c.id, code: row.code, fail: why, mock: MOCK || undefined }) + "\n"
      );
      return send(res, 200, { ok: true });
    }
    // 단체 표지의 조각(배경·인물 원본과 오린 그림) — 자리마다 가장 최근 것 하나
    if (post && u.pathname === "/api/part") {
      const { c } = findRow(await works(), new URLSearchParams({ work: q.get("work"), code: "cover" })),
        name = q.get("name") || "",
        buf = await body(req);
      if (!ROLE.test(name) || !(name.endsWith(".png") ? isPng(buf) : isWebp(buf))) return send(res, 400, { error: "조각 이름·형식이 맞지 않아요" });
      const dir = path.join(LIB, c.id, "cover-parts");
      fs.mkdirSync(dir, { recursive: true });
      if (!inLib(dir)) return send(res, 400, { error: "보관함 밖을 가리키는 폴더예요" });
      // 묶음째 쓰기(bundle = 묶음 번호): 첫 조각(fresh)에 예전 조각을 지우고 표식(.writing)에 번호를 적는다. 그 뒤의 조각은 같은 번호만 받고(다른 창이 쓰는 묶음과 섞이지 않게),
      // 마지막 조각(last)까지 쓴 뒤에 표식을 지운다 — 표식이 있는 동안은 보관함 목록에 내지 않아 '자리 맞추기'에 뜨지 않는다. 번호 없이 오는 것은 조각 하나만 바꾸는 쓰기
      const mark = path.join(dir, WRITING),
        bundle = q.get("bundle") || "",
        now = fs.existsSync(mark) ? fs.readFileSync(mark, "utf8") : "";
      if (bundle && !/^[a-z0-9-]{8,40}$/i.test(bundle)) return send(res, 400, { error: "묶음 번호가 맞지 않아요" });
      const stale = now && Date.now() - fs.statSync(mark).mtimeMs > 600000; // 10분 넘게 멈춘 표식은 버려진 것(창을 닫음)
      if (now && now !== bundle && !(stale && q.get("fresh") && bundle))
        return send(res, 409, { error: "다른 창에서 이 작품의 조각을 쓰고 있어요 — 그쪽이 끝난 뒤에 다시 해 주세요" });
      if (!now && bundle && !q.get("fresh")) return send(res, 409, { error: "조각 묶음이 시작되지 않았어요 — 다시 눌러 주세요" });
      if (q.get("fresh") && bundle && now !== bundle) {
        for (const old of fs.readdirSync(dir)) if (ROLE.test(old)) fs.rmSync(path.join(dir, old));
        fs.writeFileSync(mark, bundle);
      }
      fs.writeFileSync(path.join(dir, name), buf);
      if (q.get("last") && bundle) fs.rmSync(mark, { force: true });
      return send(res, 200, { ok: true });
    }
    // 후보 버리기 — 지우지 않고 보관함의 .trash/로 옮긴다
    if (post && u.pathname === "/api/drop") {
      const abs = libPath(q.get("path"));
      if (!abs || !fs.existsSync(abs) || !KEPT.test(path.basename(abs))) return send(res, 400, { error: "없는 후보예요" });
      const to = path.join(LIB, ".trash", Date.now() + "__" + (q.get("path") || "").replace(/\//g, "__")); // 같은 이름을 두 번 버려도 덮어쓰지 않게
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.renameSync(abs, to);
      return send(res, 200, { ok: true });
    }
    // 고른 그림 싣기 — 경로는 의뢰 목록이 정한 그 자리뿐, webp만. 연습 그림은 싣지 않는다
    if (post && u.pathname === "/api/save") {
      if (MOCK) return send(res, 400, { error: "연습 모드의 그림은 실을 수 없어요" });
      const busy = () => (publishing() ? send(res, 409, { error: "사이트에 올리는 중에는 실을 수 없어요 — 끝난 뒤에 다시 눌러 주세요" }) || true : false); // 올리는 사이 그림이 바뀌지 않게
      if (busy()) return;
      const { row } = findRow(await works(), q),
        buf = await body(req);
      if (!isWebp(buf)) return send(res, 400, { error: "webp 그림이 아니에요" });
      if (busy()) return; // 그림을 받는 사이 올리기가 시작됐을 수 있다 — 쓰기 직전에 한 번 더
      const abs = path.join(ROOT, row.path);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, buf);
      console.log(`실음: ${row.path} (${Math.round(buf.length / 1024)}KB)`);
      return send(res, 200, { ok: true, path: row.path, bytes: buf.length });
    }
    send(res, 404, { error: "없는 주소" });
  } catch (e) {
    send(res, 500, { error: String((e && e.message) || e) });
  }
});
server.listen(PORT, "127.0.0.1", () => {
  console.log(`그림 총괄 페이지: http://127.0.0.1:${PORT}  (이 PC에서만 열려요 · 끄려면 Ctrl+C)${MOCK ? "  [연습 모드 — 생성 서비스를 부르지 않아요]" : ""}`);
  console.log(`보관함: ${LIB}`);
  console.log("실은 그림은 npm run build 뒤에 사이트에 들어가요. 생성 서비스 키는 페이지에만 넣으세요(서버·저장소에 남지 않아요).");
});
