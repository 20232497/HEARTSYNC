/* 그림 저장(IMG): assets → IndexedDB → data URL, 축소(shrink), 공개용 참조만 남기기. 참조 모양은 validRef(움짤 영상은 validMotion) — 작품 폴더에 실린 그림(content/… 상대 경로)도 참조로 씀 */
import { IDB, KV } from "../core/storage.js";
import { $$, uid } from "../core/util.js";
import { CLOUD } from "./cloud.js";
/** @typedef {import("../core/types.js").ImageRef} ImageRef */
/** @typedef {import("../core/types.js").ImagesMap} ImagesMap */

/* 그림 참조: /_blob/<id>(claude.ai assets) · kv:img…(IndexedDB·계정) · data:image/… · content/…/images/x.webp(빌드가 작품 폴더에서 실은 그림, index.html 기준 상대 경로) */
/** @param {unknown} ref @returns {boolean} ImageRef 모양인지 */
export function validRef(ref) {
  return typeof ref === "string" && (/^\/_blob\/[A-Za-z0-9_-]{8,80}$/.test(ref) || /^kv:img[a-z0-9]{6,30}$/.test(ref) || /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(ref)
    || /^content\/(?!.*\.\.)[A-Za-z0-9_./-]+\.(webp|png|jpe?g)$/.test(ref));
}
/* 움짤(짧은 반복 영상) 참조: 그림과 같은 저장소 모양(/_blob/ · kv:img… — 본문이 data:video/…) + 작품 폴더의 content/….mp4|webm + Runware가 준 임시 주소(내려받기가 막혔을 때만) */
const VIDEO_DATA = /^data:video\/(mp4|webm|quicktime);base64,[A-Za-z0-9+/=]+$/;
/** @param {unknown} ref @returns {boolean} 움짤 참조 모양인지 */
export function validMotion(ref) {
  return typeof ref === "string" && (/^\/_blob\/[A-Za-z0-9_-]{8,80}$/.test(ref) || /^kv:img[a-z0-9]{6,30}$/.test(ref) || VIDEO_DATA.test(ref)
    || /^content\/(?!.*\.\.)[A-Za-z0-9_./-]+\.(mp4|webm)$/.test(ref) || /^https:\/\/vm\.runware\.ai\/[A-Za-z0-9_./-]+\.(mp4|webm|mov)$/.test(ref));
}
const bodyOK = (v) => typeof v === "string" && (validRef(v) || VIDEO_DATA.test(v));
/* 계정에 함께 올릴 움짤 본문의 최대 크기(글자 수) — 넘으면 이 기기(IndexedDB)에만 두고 작품 폴더로 내보내 싣는다(계정 저장은 1.5MB씩 보냄) */
const CLOUD_VIDEO_MAX = 1400000;
/**
 * 그림 저장소. put(file|Blob) → Promise<ImageRef>(assets면 /_blob/, 아니면 축소해 IndexedDB·kv:) · load(k)/local(k) kv 그림 본문(data URL) · tag(ref) → <img> HTML(kv:는 data-kv로 두고 hydrate가 채움)
 * hydrate(root) data-kv 그림 채우기(없으면 계정에서 받음, 받기 전 img-wait·못 받으면 img-miss) · drop(ref) 지우기 · keep(k, v) 계정에서 받은 그림을 IDB에 · migrate() 예전 localStorage 그림 옮기기
 */
export const IMG = {
  assets: null, cache: {}, vurl: {},
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
  /* 움짤 저장: assets면 그대로 올리고, 아니면 data URL로 IndexedDB에(작으면 계정에도). 돌려주는 값: { ref, local(계정에 안 올림) } */
  async putVideo(blob) {
    if (this.assets) { try { const r = await this.assets.upload(blob); if (r && r.id) return { ref: "/_blob/" + r.id, local: false }; } catch {} }
    const data = await blobURL(blob), key = uid("img"); this.cache[key] = data;
    const saved = !!(await IDB.open()) && await IDB.set(key, data), small = data.length <= CLOUD_VIDEO_MAX;
    if (small) KV.set(key, data, { local: !saved }); else if (!saved) throw { code: "too_big" };
    return { ref: "kv:" + key, local: !small };
  },
  /* kv: 그림 읽기 — 메모리 → IndexedDB → (계정 db·예전 localStorage) 순서 */
  async local(k) {
    if (this.cache[k]) return this.cache[k];
    let v = await IDB.get(k);
    if (typeof v !== "string") v = await KV.get(k);
    if (bodyOK(v)) this.cache[k] = v;
    return this.cache[k];
  },
  // 계정에서 받은 그림은 IndexedDB에도 둠(다음부터는 받지 않음)
  keep(k, v) { if (bodyOK(v)) { this.cache[k] = v; IDB.set(k, v); } },
  async load(k) {
    const v = await this.local(k);
    if (v || !CLOUD.on) return v;
    this.keep(k, await CLOUD.getOne(k)); // 다른 기기에서 만든 그림
    return this.cache[k];
  },
  drop(ref) { if (typeof ref === "string" && ref.startsWith("kv:")) { const k = ref.slice(3); KV.set(k, undefined); IDB.set(k, undefined); delete this.cache[k]; if (this.vurl[k]) { URL.revokeObjectURL(this.vurl[k]); delete this.vurl[k]; } } },
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
  /* 움짤 <video>(소리 없이 반복 재생). kv: 본문은 hydrate가 blob 주소로 바꿔 채움 — data: 영상은 iOS Safari가 재생하지 못함 */
  vtag(ref) {
    if (!validMotion(ref)) return "";
    const a = 'class="mo" muted loop autoplay playsinline preload="auto" disablepictureinpicture';
    if (ref.startsWith("kv:")) { const k = ref.slice(3); return this.vurl[k] ? `<video ${a} src="${this.vurl[k]}"></video>` : `<video ${a} data-vkv="${k}"></video>`; }
    if (ref.startsWith("data:")) return `<video ${a} src="${ref}"></video>`;
    return `<video ${a} src="${ref}"></video>`;
  },
  /* kv: 움짤 본문 → blob 주소(한 번 만들면 재사용) */
  async videoURL(k) {
    if (this.vurl[k]) return this.vurl[k];
    const v = await this.load(k);
    if (typeof v !== "string" || !VIDEO_DATA.test(v)) return null;
    try { this.vurl[k] = URL.createObjectURL(await (await fetch(v)).blob()); } catch { return null; }
    return this.vurl[k];
  },
  // 이 기기에 있는 그림은 바로, 없는 그림(다른 기기에서 만든 것)은 계정에서 한 번에 받아 채움. 받는 동안 img-wait(반짝이는 자리), 끝내 못 받으면 img-miss(표지는 글자 표지로 되돌림)
  async hydrate(root = document) {
    const els = $$("img[data-kv]", root).map((el) => { const k = el.dataset.kv; el.removeAttribute("data-kv"); el.classList.add("img-wait"); return [el, k]; }), miss = [];
    for (const [el, k] of els) { const v = await this.local(k); if (v) { el.src = v; el.classList.remove("img-wait"); } else if (miss.indexOf(k) < 0) miss.push(k); }
    if (miss.length && CLOUD.on) { try { const got = await CLOUD.getMany(miss); Object.keys(got).forEach((k) => this.keep(k, got[k])); } catch {} }
    els.forEach(([el, k]) => {
      if (!el.src && this.cache[k]) el.src = this.cache[k];
      el.classList.remove("img-wait");
      if (!el.src) { el.classList.add("img-miss"); const cv = el.closest(".cover"); if (cv) cv.classList.remove("has-img"); }
    });
    // 움짤: 본문을 blob 주소로(못 받으면 숨겨 아래의 사진이 보임)
    for (const el of $$("video[data-vkv]", root)) {
      const k = el.dataset.vkv; el.removeAttribute("data-vkv");
      const u = await this.videoURL(k);
      if (u) { el.src = u; el.play && el.play().catch(() => {}); } else el.classList.add("img-miss");
    }
  }
};
function blobURL(blob) { return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(blob); }); }
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
/** 공개용 세계관 일러스트 — /_blob/ 참조만 남김(kv:는 남의 기기에 없음). @param {Record<string, ImageRef>} m @returns {Record<string, ImageRef>} */
export function pubLore(m) { const out = {}; for (const [k, ref] of Object.entries(m || {}).slice(0, 40)) if (typeof ref === "string" && ref.startsWith("/_blob/") && validRef(ref)) out[String(k).slice(0, 20)] = ref; return out; }
/* 커뮤니티: pub/<내 id> 문서 하나에 내 공개 캐릭터를 모아 둔다 (모두 읽기, 본인만 쓰기) */
/** 공개용 인물 그림 — /_blob/ 참조만. @param {ImagesMap} images @returns {ImagesMap} */
export function pubImages(images) {
  const out = {};
  for (const [code, m] of Object.entries(images || {})) for (const [k, ref] of Object.entries(m || {})) if (typeof ref === "string" && ref.startsWith("/_blob/") && validRef(ref)) (out[code] = out[code] || {})[k] = ref;
  return out;
}
