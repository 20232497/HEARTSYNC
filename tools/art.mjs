// 그림 관리 페이지(이 PC 전용) — 작품마다 필요한 그림(표지·인물·장소)을 한 화면에서 그리고, 골라서 content/…/images/에 싣는다.
// 그림은 관리자만 만든다: 배포되는 index.html·admin.html에는 들어가지 않고(생성 서비스 주소는 빌드가 막음), 이 서버는 127.0.0.1에서만 듣는다.
// 필요한 그림 목록은 그림 의뢰 목록(content-art.mjs artRows)과 같고, 문구와 생성 값은 화풍 보관함의 규칙(archive/style-*)이 만든다 — 여기에는 값을 다시 적지 않는다.
// 생성 서비스(Runware) 키는 서버가 받지 않는다: 페이지가 그 브라우저의 localStorage에만 두고 생성 서비스로 바로 보낸다.
//   npm run art               → http://127.0.0.1:5199 (먼저 npm run build — 빌드가 만든 작품 목록을 읽음)
//   npm run art -- --port 5300
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ART_SPECS, artRows } from "./content-art.mjs";
import { PALETTES } from "../src/js/core/constants.js";
import { styleOf, placeJob, assertPlace } from "../archive/style-works/code/place.js";
import { coverJob, assertCover, leadOf } from "../archive/style-works/code/cover.js";
import { LOGOS } from "../archive/style-works/code/logos.js";
import { profileJob as animeProfile, emotionJob as animeEmotion, assertSafe as animeSafe } from "../archive/style-manime/code/assemble.js";
import { profileJob as dailyProfile, emotionJob as dailyEmotion, assertSafe as dailySafe } from "../archive/style-mdaily/code/assemble.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pi = process.argv.indexOf("--port"),
  PORT = pi >= 0 ? +process.argv[pi + 1] || 5199 : 5199;
const MAX_BODY = 8 * 1024 * 1024;
// 페이지가 가져다 쓰는 캔버스 코드(후처리·로고) — 이 표에 있는 파일만 내준다
const CODE = {
  "cover-post.js": "archive/style-works/code/cover-post.js",
  "logo.js": "archive/style-works/code/logo.js",
  "logos.js": "archive/style-works/code/logos.js",
  "post-anime.js": "archive/style-manime/code/post.js",
  "post-daily.js": "archive/style-mdaily/code/post.js"
};
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
  return all.map((c) => ({
    id: c.id,
    title: c.title || c.name,
    style: styleOf(c.id),
    pal: PALETTES[c.pal] || PALETTES[0],
    motif: c.motif || "",
    lead: leadOf(c.id, c).code,
    logo: !!LOGOS[c.id],
    rows: artRows(c).map((r) => ({ ...r, has: fs.existsSync(path.join(ROOT, r.path)), size: sizeOf(r.spec), can: CAN[r.spec] && r.tags }))
  }));
}
/** 그림 한 장의 작업 — vary는 '다시 그리기' 횟수(시드를 그만큼 옮김) */
function jobFor(c, row, vary) {
  const anime = styleOf(c.id) === "anime";
  let job;
  if (row.spec === "cover") job = assertCover(coverJob(c.id, c));
  else if (row.spec === "place") job = assertPlace(placeJob(c.id, c, +row.code.slice(2)));
  else {
    const m = /^([A-Z]+)(\d+)$/.exec(row.code),
      c0 = (c.cast || []).find((x) => x.code === m[1]);
    if (!c0) throw new Error("인물을 찾지 못했어요: " + row.code);
    const base = c0.of ? (c.cast || []).find((x) => x.code === c0.of) : null; // 다른 모습(폼)은 성격·나이가 없으면 본체 값
    const who = base ? { ...c0, temper: c0.temper || base.temper, age: c0.age === undefined ? base.age : c0.age } : c0;
    const place = (c.places || [])[0],
      slot = +m[2];
    if (anime) job = animeSafe(slot ? animeEmotion(who, place, slot) : animeProfile(who, place));
    else job = dailySafe(slot ? dailyEmotion(who, place, slot) : dailyProfile(who, place));
  }
  if (vary) {
    job = { ...job, seed: job.seed + vary * 101 };
    if (job.guide) job.guide = { ...job.guide, job: { ...job.guide.job, seed: job.guide.job.seed + vary * 101 } };
  }
  return { job, post: anime ? "anime" : "daily", cover: row.spec === "cover", size: sizeOf(row.spec) };
}

const send = (res, code, body, type) => {
  res.writeHead(code, { "content-type": type || "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};
const file = (res, abs) =>
  fs.existsSync(abs)
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
    req.on("data", (d) => ((n += d.length) > MAX_BODY ? (no(new Error("그림이 너무 커요(8MB까지)")), req.destroy()) : parts.push(d)));
    req.on("end", () => ok(Buffer.concat(parts)));
    req.on("error", no);
  });

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://127.0.0.1"),
    q = u.searchParams;
  try {
    if (req.method === "GET" && u.pathname === "/") return file(res, path.join(ROOT, "tools/art/index.html"));
    if (req.method === "GET" && u.pathname === "/app.js") return file(res, path.join(ROOT, "tools/art/app.js"));
    if (req.method === "GET" && u.pathname.startsWith("/code/")) {
      const rel = CODE[u.pathname.slice(6)];
      return rel ? file(res, path.join(ROOT, rel)) : send(res, 404, { error: "없는 파일" });
    }
    if (req.method === "GET" && u.pathname === "/api/works") return send(res, 200, listing(await works()));
    if (req.method === "GET" && u.pathname === "/api/job") {
      const { c, row } = findRow(await works(), q);
      return send(res, 200, jobFor(c, row, +q.get("vary") || 0));
    }
    // 실린 그림 보기 — 작품 폴더의 images/ 안 파일만
    if (req.method === "GET" && u.pathname === "/file") {
      const rel = q.get("path") || "",
        abs = path.resolve(ROOT, rel);
      if (!/^content\/[\w/.-]+\/images\/[\w.-]+\.(webp|png|jpe?g)$/i.test(rel) || !abs.startsWith(path.join(ROOT, "content") + path.sep))
        return send(res, 400, { error: "볼 수 없는 경로" });
      return file(res, abs);
    }
    // 고른 그림 싣기 — 이 페이지에서 온 요청만(다른 사이트가 이 주소로 보내는 요청을 막음), 경로는 의뢰 목록이 정한 그 자리뿐, webp만
    if (req.method === "POST" && u.pathname === "/api/save") {
      const origin = req.headers.origin || "";
      if (req.headers["x-hs-art"] !== "1" || (origin && !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin)))
        return send(res, 403, { error: "이 페이지에서만 실을 수 있어요" });
      const { row } = findRow(await works(), q),
        buf = await body(req);
      if (buf.length < 16 || buf.toString("latin1", 0, 4) !== "RIFF" || buf.toString("latin1", 8, 12) !== "WEBP")
        return send(res, 400, { error: "webp 그림이 아니에요" });
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
  console.log(`그림 관리 페이지: http://127.0.0.1:${PORT}  (이 PC에서만 열려요 · 끄려면 Ctrl+C)`);
  console.log("실은 그림은 npm run build 뒤에 사이트에 들어가요. 생성 서비스 키는 페이지에만 넣으세요(서버·저장소에 남지 않아요).");
});
