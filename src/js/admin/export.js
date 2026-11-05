/* 작품 폴더로 내보내기(관리자 빌드만): 이 브라우저에 만든 그림(그림 칸·표지·세계관 일러스트)과 직접 만든 코드 표를 저장소의 content/ 폴더에 써서
   npm run build 뒤 사용자 사이트에 실리게 한다. 사용자가 그림을 만들지 않고, 관리자가 미리 만들어 둔 그림을 보는 구조(2026-11 결정).
     content/<f|m|all>/[<줄>/]<id>/images/<인물코드>-<조합키>.jpg   그림 칸 — 조합 키의 쉼표는 파일 이름에서 -(3-404-501)
     content/…/<id>/images/cover.jpg                                  대표 일러스트(표지)
     content/…/<id>/images/lore-<n>.jpg                               키워드북 n번째 항목의 세계관 일러스트(1부터)
     content/…/<id>/images/<인물코드>-<조합키>.mp4                    그 칸의 움짤(켜 둔 것만 — 꺼 둔 움짤은 사진만 보이므로 싣지 않음)
     content/codes.json                                                이미지 코드 표([{n, name, prompt, rating, keys?}] — 실린 코드 + 이 브라우저에서 만든 칸 가운데 전체이용가만. 성인 수위·관리자 전용(codes.admin.json) 코드는 공개 저장소에 싣지 않음)
     content/<aud>/<id>/work.js                                        스튜디오에서 만든 내 작품을 오리지널로 올릴 때(이미 있으면 덮어씀)
   쓰는 방법: Chrome·Edge는 폴더 고르기(File System Access API)로 저장소의 content 폴더에 바로 씀. 그 밖의 브라우저는 같은 구조의 ZIP을 내려받아 풀어 넣는다.
   빌드(tools/build.mjs)가 이 파일들을 찾아 ORIGINALS의 images·img·loreImages·motions와 CONTENT_CODES로 넣는다(content/README.md) */
import { audOf } from "../core/audience.js";
import { ORIGINALS } from "../content/index.js";
import { S } from "../core/state.js";
import { toast } from "../core/util.js";
import { parseCodes } from "../images/codes.js";
import { motionsOf } from "../images/motion.js";
import { imagesOf } from "../images/pick.js";
import { refDataURL } from "../images/runware.js";
import { allCustom, sitDef } from "../images/situations.js";
import { IMG, validMotion, validRef } from "../services/images.js";

export const CONTENT = { dir: null }; // 고른 content 폴더 핸들(이 세션 동안)
export const canPickDir = () => typeof window.showDirectoryPicker === "function";
/* content 폴더 고르기: 안에 f·m·all 가운데 하나라도 있어야 content 폴더로 본다 */
export async function pickContentDir() {
  const h = await window.showDirectoryPicker({ id: "heartsync-content", mode: "readwrite" });
  let ok = false;
  for (const k of ["f", "m", "all"]) { try { await h.getDirectoryHandle(k); ok = true; break; } catch {} }
  if (!ok) { toast("저장소의 content 폴더를 골라 주세요(안에 f·m·all 폴더가 있어요)"); return null; }
  CONTENT.dir = h; return h;
}
/* 작품의 폴더 경로: 오리지널은 빌드가 적어 둔 aud·row, 내 작품은 성향으로(줄 없이) */
export function workPath(c) {
  const orig = ORIGINALS.find((x) => x.id === c.id);
  return orig ? [orig.aud || "all", orig.row, orig.id].filter(Boolean) : [audOf(c), c.id];
}
const extOf = (dataURL) => (/^data:image\/png/.test(dataURL) ? "png" : /^data:image\/webp/.test(dataURL) ? "webp" : "jpg");
const fileKey = (key) => parseCodes(String(key)).join("-");
/* 이 작품의 그림 전부 → [{ path(images/ 아래 파일 이름), data(data URL) }]. 이 브라우저에 본문이 있는 그림(kv:·data:)만 — /_blob/(claude.ai)은 여기서 못 읽고, content/…(이미 실린 그림)는 다시 쓰지 않음 */
export async function workFiles(c) {
  const out = [], mine = S.mine.find((m) => m.id === c.id);
  const add = async (name, ref) => { if (!validRef(ref) || String(ref).startsWith("/_blob/") || String(ref).startsWith("content/")) return; const d = await refDataURL(ref); if (typeof d === "string" && d.startsWith("data:image/")) out.push({ path: `images/${name}.${extOf(d)}`, data: d }); };
  // 성인 수위·관리자 전용 코드가 든 조합 그림은 사용자 사이트에 싣지 않음(그 코드는 codes.json에도 안 실려 빌드가 번호를 모름)
  const imgs = imagesOf(c), skipKey = (key) => parseCodes(String(key)).some((n) => { const d = sitDef(n); return !!d && (d.adminOnly || d.rating !== "safe"); });
  for (const code of Object.keys(imgs)) for (const key of Object.keys(imgs[code])) if (!skipKey(key)) await add(`${code}-${fileKey(key)}`, imgs[code][key]);
  // 켜 둔 움짤은 같은 이름의 .mp4로(사진이 함께 있어야 보임 — 빌드가 경고)
  const mos = motionsOf(c);
  for (const code of Object.keys(mos)) for (const key of Object.keys(mos[code])) {
    const m = mos[code][key]; if (!m.on || skipKey(key) || !validMotion(m.ref) || /^(content\/|\/_blob\/)/.test(m.ref)) continue;
    const d = await motionData(m.ref); if (d) out.push({ path: `images/${code}-${fileKey(key)}.${/^data:video\/webm/.test(d) ? "webm" : "mp4"}`, data: d });
  }
  await add("cover", mine ? mine.img : S.coverpacks[c.id]);
  const lore = c.lore || [], lp = mine ? (mine.loreImages || {}) : (S.lorepacks[c.id] || {});
  for (let i = 0; i < lore.length; i++) await add(`lore-${i + 1}`, lp[lore[i].keys[0]]);
  return out;
}
/* 움짤 본문 → data:video/… (kv:는 이 기기·계정에서, Runware 임시 주소는 내려받기 — 브라우저가 막거나 사라졌으면 null) */
async function motionData(ref) {
  try {
    if (ref.startsWith("kv:")) return await IMG.load(ref.slice(3));
    if (ref.startsWith("data:")) return ref;
    const b = await (await fetch(ref)).blob(); if (!/^video\//.test(b.type)) return null;
    return await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(b); });
  } catch { return null; }
}
/* 내 작품을 work.js로(오리지널로 올릴 때). 그림·공개 여부 같은 기기 데이터는 빼고 작품 내용만 */
export function workSource(c) {
  const o = { ...c }; ["images", "img", "loreImages", "motions", "publish", "creator", "updated", "aud", "row"].forEach((k) => delete o[k]);
  return `/* ${c.title} — 스튜디오에서 내보냄(${new Date().toISOString().slice(0, 10)}). 폴더 이름이 id, 맨 위 폴더가 aud(content/README.md) */\nexport default ${JSON.stringify(o, null, 2)};\n`;
}
/* 사용자 사이트에 실을 코드 표 → codes.json 글: 전체이용가이고 관리자 전용이 아닌 것만(성인 수위 코드는 공개 저장소·사용자 빌드에 넣지 않음 — 빠진 수는 codesDropped). 빌드가 CONTENT_CODES로 다시 싣는다 */
export const codesDropped = () => allCustom().filter((d) => d.rating !== "safe" || d.adminOnly).length;
export function codesSource() {
  const list = allCustom().filter((d) => d.rating === "safe" && !d.adminOnly).sort((a, b) => a.n - b.n).map((d) => ({ n: d.n, name: d.name, prompt: d.prompt || "", ...(d.keys ? { keys: d.keys } : {}), ...(d.motion ? { motion: d.motion } : {}), rating: "safe" }));
  return JSON.stringify(list, null, 2) + "\n";
}
const dataBytes = (d) => Uint8Array.from(atob(d.slice(d.indexOf(",") + 1)), (ch) => ch.charCodeAt(0));
async function writeFile(dir, name, bytes) { const f = await dir.getFileHandle(name, { create: true }), w = await f.createWritable(); await w.write(bytes); await w.close(); }
async function dirOf(root, parts) { let d = root; for (const p of parts) d = await d.getDirectoryHandle(p, { create: true }); return d; }
/* 작품 하나를 content 폴더에 씀(내 작품이면 work.js도). 돌려주는 값: 쓴 파일 수 */
export async function exportWork(c) {
  const files = await workFiles(c), parts = workPath(c), mine = S.mine.find((m) => m.id === c.id);
  if (!files.length && !mine) { toast("이 브라우저에 만들어 둔 그림이 없어요"); return 0; }
  if (CONTENT.dir) {
    const wd = await dirOf(CONTENT.dir, parts);
    if (mine) await writeFile(wd, "work.js", new TextEncoder().encode(workSource(mine)));
    const id = await dirOf(wd, ["images"]);
    for (const f of files) await writeFile(id, f.path.slice("images/".length), dataBytes(f.data));
    return files.length + (mine ? 1 : 0);
  }
  const zip = [...files.map((f) => ({ path: parts.join("/") + "/" + f.path, bytes: dataBytes(f.data) }))];
  if (mine) zip.push({ path: parts.join("/") + "/work.js", bytes: new TextEncoder().encode(workSource(mine)) });
  download(`content-${c.id}.zip`, makeZip(zip)); return zip.length;
}
export async function exportCodes() {
  const bytes = new TextEncoder().encode(codesSource());
  if (CONTENT.dir) { await writeFile(CONTENT.dir, "codes.json", bytes); return true; }
  download("codes.json", new Blob([bytes], { type: "application/json" })); return true;
}
function download(name, blob) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
/* 압축하지 않는(stored) ZIP — 그림은 이미 압축돼 있어 충분. 파일 이름은 UTF-8(플래그 0x800) */
function makeZip(files) {
  const enc = new TextEncoder(), locals = [], centrals = []; let off = 0;
  const u16 = (n) => [n & 255, (n >> 8) & 255], u32 = (n) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];
  const now = new Date(), dt = u16(((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xffff), dd = u16((((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xffff);
  for (const f of files) {
    const name = enc.encode(f.path), crc = crc32(f.bytes), size = f.bytes.length;
    const head = [...u32(0x04034b50), ...u16(20), ...u16(0x800), ...u16(0), ...dt, ...dd, ...u32(crc), ...u32(size), ...u32(size), ...u16(name.length), ...u16(0)];
    locals.push(new Uint8Array(head), name, f.bytes);
    centrals.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x800), ...u16(0), ...dt, ...dd, ...u32(crc), ...u32(size), ...u32(size), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)]), name);
    off += head.length + name.length + size;
  }
  const cdSize = centrals.reduce((a, b) => a + b.length, 0);
  const end = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(cdSize), ...u32(off), ...u16(0)]);
  return new Blob([...locals, ...centrals, end], { type: "application/zip" });
}
let CRC_TABLE = null;
function crc32(bytes) {
  if (!CRC_TABLE) { CRC_TABLE = new Uint32Array(256); for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC_TABLE[i] = c >>> 0; } }
  let c = 0xffffffff; for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
