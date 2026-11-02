/* 그림 저장(IMG): assets → IndexedDB → data URL, 축소(shrink), 공개용 참조만 남기기 */
import { IDB, KV } from "../core/storage.js";
import { $$, uid } from "../core/util.js";
import { CLOUD } from "./cloud.js";

export function validRef(ref) {
  return typeof ref === "string" && (/^\/_blob\/[A-Za-z0-9_-]{8,80}$/.test(ref) || /^kv:img[a-z0-9]{6,30}$/.test(ref) || /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(ref));
}
export const IMG = {
  assets: null, cache: {},
  async put(file) {
    if (this.assets) {
      try { const blob = await shrink(file, 960, 0.86, true); const r = await this.assets.upload(blob); if (r && r.id) return "/_blob/" + r.id; } catch {}
    }
    // 그림 본문은 IndexedDB에(로컬 전용이면 더 크게), 계정 저장(db)이 되면 db에도. 둘 다 안 될 때만 localStorage
    const idb = !!(await IDB.open()), big = idb && !KV.dbOk;
    const data = await shrink(file, big ? 960 : 560, big ? 0.86 : 0.8, false);
    const key = uid("img"); this.cache[key] = data;
    const saved = idb && await IDB.set(key, data);
    KV.set(key, data, { local: !saved });
    return "kv:" + key;
  },
  /* kv: 그림 읽기 — 메모리 → IndexedDB → (계정 db·예전 localStorage) 순서 */
  async local(k) {
    if (this.cache[k]) return this.cache[k];
    let v = await IDB.get(k);
    if (typeof v !== "string") v = await KV.get(k);
    if (typeof v === "string" && validRef(v)) this.cache[k] = v;
    return this.cache[k];
  },
  // 계정에서 받은 그림은 IndexedDB에도 둠(다음부터는 받지 않음)
  keep(k, v) { if (typeof v === "string" && validRef(v)) { this.cache[k] = v; IDB.set(k, v); } },
  async load(k) {
    const v = await this.local(k);
    if (v || !CLOUD.on) return v;
    this.keep(k, await CLOUD.getOne(k)); // 다른 기기에서 만든 그림
    return this.cache[k];
  },
  drop(ref) { if (typeof ref === "string" && ref.startsWith("kv:")) { const k = ref.slice(3); KV.set(k, undefined); IDB.set(k, undefined); delete this.cache[k]; } },
  /* 예전 버전이 localStorage에 넣어 둔 그림을 IndexedDB로 옮겨 localStorage 자리를 비움 */
  async migrate() {
    if (!(await IDB.open())) return 0;
    let n = 0;
    try {
      for (const lk of Object.keys(localStorage)) {
        if (!/^hv1_img[a-z0-9]{10,30}$/.test(lk)) continue;
        const k = lk.slice(4), v = KV.getLocal(k);
        if (typeof v === "string" && await IDB.set(k, v)) { localStorage.removeItem(lk); n++; }
      }
    } catch {}
    return n;
  },
  tag(ref) {
    if (!validRef(ref)) return "";
    if (ref.startsWith("kv:")) { const k = ref.slice(3); return this.cache[k] ? `<img src="${this.cache[k]}" alt="">` : `<img data-kv="${k}" alt="">`; }
    return `<img src="${ref}" alt="" loading="lazy">`;
  },
  // 이 기기에 있는 그림은 바로, 없는 그림(다른 기기에서 만든 것)은 계정에서 한 번에 받아 채움
  async hydrate(root = document) {
    const els = $$("img[data-kv]", root).map((el) => { const k = el.dataset.kv; el.removeAttribute("data-kv"); return [el, k]; }), miss = [];
    for (const [el, k] of els) { const v = await this.local(k); if (v) el.src = v; else if (miss.indexOf(k) < 0) miss.push(k); }
    if (!miss.length || !CLOUD.on) return;
    const got = await CLOUD.getMany(miss);
    Object.keys(got).forEach((k) => this.keep(k, got[k]));
    els.forEach(([el, k]) => { if (miss.indexOf(k) >= 0 && this.cache[k]) el.src = this.cache[k]; });
  }
};
function shrink(file, max, q, asBlob) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => { const img = new Image(); img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height)), cv = document.createElement("canvas");
      cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
      if (asBlob) cv.toBlob((b) => b ? res(b) : rej(new Error("blob")), "image/jpeg", q); else res(cv.toDataURL("image/jpeg", q)); };
      img.onerror = rej; img.src = fr.result; };
    fr.onerror = rej; fr.readAsDataURL(file);
  });
}
export function pubLore(m) { const out = {}; for (const [k, ref] of Object.entries(m || {}).slice(0, 40)) if (typeof ref === "string" && ref.startsWith("/_blob/") && validRef(ref)) out[String(k).slice(0, 20)] = ref; return out; }
/* 커뮤니티: pub/<내 id> 문서 하나에 내 공개 캐릭터를 모아 둔다 (모두 읽기, 본인만 쓰기) */
export function pubImages(images) {
  const out = {};
  for (const [code, m] of Object.entries(images || {})) for (const [k, ref] of Object.entries(m || {})) if (typeof ref === "string" && ref.startsWith("/_blob/") && validRef(ref)) (out[code] = out[code] || {})[k] = ref;
  return out;
}
