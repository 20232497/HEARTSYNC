// 시험용 정적 서버(의존성 없음): 저장소 루트를 http://127.0.0.1:<포트>/ 로 띄움. 휴대폰처럼 웹 주소로 열어야 하는 흐름을 시험할 때 씀.
//   node tests/serve.mjs [포트]     (포트를 비우면 비어 있는 포트를 골라 주소를 출력)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8" };

/* git에 없는 파일의 대역: 관리자 전용 코드 표(content/codes.admin.json)가 없으면 예시 표를 줌 — 새로 받은 저장소에서도 관리자 도구의 fetch가 404 콘솔 오류를 내지 않아 흐름 시험이 통과하고, 그 길도 함께 시험됨. 실제 파일이 있으면 그것을 씀 */
const STAND_IN = { "/content/codes.admin.json": "content/codes.admin.example.json" };

/* 서버를 띄우고 { url, close } 를 돌려줌. root는 띄울 폴더(기본 저장소 루트) */
export function serve(root = ROOT, port = 0) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
      if (p.endsWith("/")) p += "index.html";
      const file = path.resolve(root, "." + p);
      if (!file.startsWith(root + path.sep) || /(^|[\\/])\./.test(path.relative(root, file))) { res.writeHead(403).end(); return; }
      fs.readFile(fs.existsSync(file) || !STAND_IN[p] ? file : path.resolve(root, STAND_IN[p]), (err, buf) => {
        if (err) { res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("없는 파일: " + p); return; }
        res.writeHead(200, { "content-type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream", "cache-control": "no-store" }).end(buf);
      });
    });
    server.on("error", reject);
    server.listen(port, "127.0.0.1", () => resolve({ url: `http://127.0.0.1:${server.address().port}/`, close: () => new Promise((r) => server.close(r)) }));
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { url } = await serve(ROOT, +(process.argv[2] || 0));
  console.log(`정적 서버: ${url}  (끄려면 Ctrl+C)`);
}
