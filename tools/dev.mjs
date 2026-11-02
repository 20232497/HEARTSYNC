// 개발 서버(npm run dev): src/·content/를 고치면 index.html을 다시 빌드하고 열린 브라우저를 새로 고침.
// 저장소 루트를 http://localhost:5173 으로 띄움(파일 모드와 같은 BYOK 동작). 빌드가 실패하면 화면 아래에 오류를 보여 줌.
//   node tools/dev.mjs [--port 5173]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BUILD = path.join(ROOT, "tools", "build.mjs");
const pi = process.argv.indexOf("--port");
const PORT = +(pi > 0 ? process.argv[pi + 1] : process.env.PORT) || 5173;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/x-icon",
  ".md": "text/plain; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".sql": "text/plain; charset=utf-8" };

/* 브라우저 쪽: 빌드가 끝나면 새로 고침, 실패하면 오류 표시, 런타임 오류는 index.html 줄 번호를 원본 모듈 파일:줄로 바꿔 콘솔에 보여 줌
   (.build/linemap.json). 오래된 브라우저에서도 돌게 ES5. 디스크의 index.html에는 넣지 않고 응답에만 붙임 */
const CLIENT = `<script>(function(){var es=new EventSource("/__dev/events"),box,map=null;
es.addEventListener("reload",function(){location.reload()});
es.addEventListener("fail",function(e){if(!box){box=document.createElement("pre");box.style.cssText="position:fixed;left:8px;right:8px;bottom:8px;z-index:2147483647;max-height:45vh;overflow:auto;margin:0;padding:12px 14px;border-radius:10px;background:#2a0d14;color:#ffd7df;font:12px/1.6 ui-monospace,monospace;white-space:pre-wrap";document.body.appendChild(box)}box.textContent=JSON.parse(e.data)});
fetch("/__dev/linemap").then(function(r){return r.json()}).then(function(m){map=m}).catch(function(){});
function where(line){if(!map)return"";for(var i=0;i<map.length;i++){var x=map[i];if(line>=x.start&&line<=x.end)return x.from+":"+(x.fromLine+line-x.start)}return""}
window.addEventListener("error",function(e){if(!e.lineno||String(e.filename||"").indexOf(location.pathname)<0)return;var w=where(e.lineno);if(w)console.error("[dev] 원본 위치 "+w+" — "+e.message)});
})();</script>`;

const clients = new Set();
const send = (event, data) => clients.forEach((res) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
let lastError = "";

/* 빌드는 매번 새 프로세스로(작품 work.js를 import하므로 같은 프로세스면 고친 내용이 캐시에 남음) */
let running = false, again = false;
function rebuild(reason) {
  if (running) { again = true; return; }
  running = true;
  const t = Date.now();
  const p = spawn(process.execPath, [BUILD], { cwd: ROOT });
  let out = "";
  p.stdout.on("data", (d) => out += d);
  p.stderr.on("data", (d) => out += d);
  p.on("close", (code) => {
    running = false;
    const text = out.trim();
    if (code === 0) {
      lastError = "";
      console.log(`${reason ? `[${reason}] ` : ""}${text} — ${Date.now() - t}ms`);
      send("reload", "");
    } else {
      lastError = text;
      console.error(`${reason ? `[${reason}] ` : ""}${text}`);
      send("fail", text);
    }
    if (again) { again = false; rebuild("이어서"); }
  });
}

/* src/·content/를 지켜봄(Windows·macOS·Node 20+ Linux는 recursive 지원) */
let timer = null;
for (const dir of ["src", "content"]) {
  fs.watch(path.join(ROOT, dir), { recursive: true }, (ev, file) => {
    if (!file || /(^|[\\/])\.|~$|\.swp$/.test(file)) return;
    if (/generated\.js$/.test(file)) return; // 빌드가 content/로 만드는 파일 — 다시 빌드를 일으키면 무한 반복
    clearTimeout(timer);
    timer = setTimeout(() => rebuild(`${dir}/${String(file).split(path.sep).join("/")}`), 120);
  });
}

http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/__dev/events") {
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" });
    res.write("retry: 1000\n\n");
    if (lastError) res.write(`event: fail\ndata: ${JSON.stringify(lastError)}\n\n`);
    clients.add(res);
    req.on("close", () => clients.delete(res));
    return;
  }
  if (url.pathname === "/__dev/linemap") {
    fs.readFile(path.join(ROOT, ".build", "linemap.json"), (err, buf) => {
      if (err) { res.writeHead(404).end("[]"); return; }
      res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" }).end(buf);
    });
    return;
  }
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith("/")) rel += "index.html";
  const file = path.resolve(ROOT, "." + rel);
  if (!file.startsWith(ROOT + path.sep) || /(^|[\\/])\./.test(path.relative(ROOT, file))) { res.writeHead(403).end("forbidden"); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("없는 파일: " + rel); return; }
    const type = TYPES[path.extname(file).toLowerCase()] || "application/octet-stream";
    if (file === path.join(ROOT, "index.html")) buf = Buffer.from(buf.toString("utf8").replace(/<\/html>\s*$/, CLIENT + "\n</html>\n"));
    res.writeHead(200, { "content-type": type, "cache-control": "no-store" }).end(buf);
  });
}).listen(PORT, "127.0.0.1", () => {
  console.log(`HEART SYNC 개발 서버: http://localhost:${PORT}/  (src/·content/를 고치면 다시 빌드하고 새로 고침, 끄려면 Ctrl+C)`);
  rebuild("시작");
});
