// 그림 총괄 페이지의 보관함 — 그린 후보를 이 PC의 보관함 폴더(tools/art.mjs의 LIB)에 쌓고, 다시 열어도 보이게 한다. 싣기는 후보 한 장을 작품 폴더로 보내는 일.
const HEAD = { "x-hs-art": "1" };
/** { "작품/코드": [{ url, path?, blob?, nsfw? }…(새것부터)] } — path가 있으면 보관함에 있는 그림 */
export const cands = {};
/** { 작품: [조각 파일 이름…] } — 단체 표지의 조각(배경·인물 원본과 오린 그림) */
export const parts = {};

export const api = async (url, init) => {
  const r = await fetch(url, init),
    d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "HTTP " + r.status);
  return d;
};
const where = (work, row) => `work=${encodeURIComponent(work.id)}&code=${encodeURIComponent(row.code)}`;
export const libUrl = (path) => "/lib?path=" + encodeURIComponent(path);

/** 보관함에 있는 후보와 조각을 읽는다(페이지를 열 때 한 번) */
export async function loadKept() {
  const d = await api("/api/kept");
  for (const [k, files] of Object.entries(d.cands)) cands[k] = files.map((f) => ({ url: libUrl(k + "/" + f), path: k + "/" + f }));
  Object.assign(parts, d.parts);
}
/** 새 후보를 목록 맨 앞에 — 노출로 판정된 그림은 보관함에 넣지 않는다(이번 화면에서만 보임) */
export async function addCand(work, row, blob, o = {}) {
  const k = work.id + "/" + row.code,
    c = { url: URL.createObjectURL(blob), blob, nsfw: !!o.nsfw };
  if (!o.nsfw) {
    const d = await api(`/api/keep?${where(work, row)}&seed=${o.seed || 0}`, { method: "POST", headers: { ...HEAD, "content-type": "image/webp" }, body: blob });
    c.path = k + "/" + d.file;
  }
  (cands[k] = cands[k] || []).unshift(c);
  return c;
}
/** 후보를 보관함의 휴지통(.trash)으로 */
export async function dropCand(k, c) {
  if (c.path) await api("/api/drop?path=" + encodeURIComponent(c.path), { method: "POST", headers: HEAD });
  cands[k] = (cands[k] || []).filter((x) => x !== c);
}
/** 후보 한 장을 작품 폴더에 싣는다 */
export async function saveCand(work, row, c) {
  const blob = c.blob || (await (await fetch(c.url)).blob());
  return api(`/api/save?${where(work, row)}`, { method: "POST", headers: { ...HEAD, "content-type": "image/webp" }, body: blob });
}
/** 단체 표지의 조각을 보관함에(자리마다 가장 최근 것 하나) */
export async function savePart(work, name, blob) {
  await api(`/api/part?work=${encodeURIComponent(work.id)}&name=${encodeURIComponent(name)}`, { method: "POST", headers: { ...HEAD, "content-type": blob.type }, body: blob });
  parts[work.id] = [...new Set([...(parts[work.id] || []), name])];
}
