/* 그림 저장(IMG): IndexedDB → localStorage, 축소(shrink), 참조 모양 검사(validRef) — 작품 폴더에 실린 그림(content/… 상대 경로)도 참조로 씀. 이용자가 올리는 그림은 페르소나 사진뿐 */
import { IDB, KV } from "../core/storage.js";
import { $$, uid } from "../core/util.js";
import { CLOUD } from "./cloud.js";
/** @typedef {import("../core/types.js").ImageRef} ImageRef */

/* 그림 참조: kv:img…(IndexedDB·계정) · data:image/… · content/…/images/x.webp(빌드가 작품 폴더에서 실은 그림, index.html 기준 상대 경로) */
/** @param {unknown} ref @returns {boolean} ImageRef 모양인지 */
export function validRef(ref) {
  return (
    typeof ref === "string" &&
    (/^kv:img[a-z0-9]{6,30}$/.test(ref) ||
      /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(ref) ||
      /^content\/(?!.*\.\.)[A-Za-z0-9_./-]+\.(webp|png|jpe?g)$/.test(ref))
  );
}
/**
 * 그림 저장소. put(file|Blob) → Promise<ImageRef>(축소해 IndexedDB·kv:) · load(k)/local(k) kv 그림 본문(data URL) · tag(ref) → <img> HTML(kv:는 data-kv로 두고 hydrate가 채움)
 * hydrate(root) data-kv 그림 채우기(없으면 계정에서 받음, 받기 전 img-wait·못 받으면 img-miss) · drop(ref) 지우기 · migrate() 예전 localStorage 그림 옮기기
 */
export const IMG = {
  cache: {},
  async put(file) {
    // 그림 본문은 IndexedDB에, 막힌 브라우저에서만 localStorage에(작게). 로그인했으면 KV.set이 계정에도 올림
    const idb = !!(await IDB.open());
    const data = await shrink(file, idb ? 960 : 560, idb ? 0.86 : 0.8);
    const key = uid("img");
    this.cache[key] = data;
    const saved = idb && (await IDB.set(key, data));
    KV.set(key, data, { local: !saved });
    return "kv:" + key;
  },
  /* kv: 그림 읽기 — 메모리 → IndexedDB → 예전 localStorage 순서 */
  async local(k) {
    if (this.cache[k]) return this.cache[k];
    let v = await IDB.get(k);
    if (typeof v !== "string") v = await KV.get(k);
    if (validRef(v)) this.cache[k] = v;
    return this.cache[k];
  },
  // 계정에서 받은 그림은 IndexedDB에도 둠(다음부터는 받지 않음)
  keep(k, v) {
    if (validRef(v)) {
      this.cache[k] = v;
      IDB.set(k, v);
    }
  },
  async load(k) {
    const v = await this.local(k);
    if (v || !CLOUD.on) return v;
    this.keep(k, await CLOUD.getOne(k)); // 다른 기기에서 올린 그림
    return this.cache[k];
  },
  drop(ref) {
    if (typeof ref === "string" && ref.startsWith("kv:")) {
      const k = ref.slice(3);
      KV.set(k, undefined);
      IDB.set(k, undefined);
      delete this.cache[k];
    }
  },
  /* 예전 버전이 localStorage에 넣어 둔 그림을 IndexedDB로 옮겨 localStorage 자리를 비움 */
  async migrate() {
    if (!(await IDB.open())) return 0;
    let n = 0;
    try {
      for (const lk of Object.keys(localStorage)) {
        if (!/^hv1_img[a-z0-9]{10,30}$/.test(lk)) continue;
        const k = lk.slice(4),
          v = KV.getLocal(k);
        if (typeof v === "string" && (await IDB.set(k, v))) {
          localStorage.removeItem(lk);
          n++;
        }
      }
    } catch {}
    return n;
  },
  tag(ref) {
    if (!validRef(ref)) return "";
    if (ref.startsWith("kv:")) {
      const k = ref.slice(3);
      return this.cache[k] ? `<img src="${this.cache[k]}" alt="">` : `<img data-kv="${k}" alt="">`;
    }
    return `<img src="${ref}" alt="" loading="lazy">`;
  },
  // 이 기기에 있는 그림은 바로, 없는 그림(다른 기기에서 올린 것)은 계정에서 받아 채움. 받는 동안 img-wait(반짝이는 자리), 끝내 못 받으면 img-miss(표지는 글자 표지로 되돌림)
  async hydrate(root = document) {
    const els = $$("img[data-kv]", root).map((el) => {
      const k = el.dataset.kv;
      el.removeAttribute("data-kv");
      el.classList.add("img-wait");
      return [el, k];
    });
    await Promise.all([...new Set(els.map((x) => x[1]))].map((k) => this.load(k).catch(() => null)));
    els.forEach(([el, k]) => {
      if (this.cache[k]) el.src = this.cache[k];
      el.classList.remove("img-wait");
      if (!el.src) {
        el.classList.add("img-miss");
        const cv = el.closest(".cover");
        if (cv) cv.classList.remove("has-img");
      }
    });
  }
};
function shrink(file, max, q) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height)),
          cv = document.createElement("canvas");
        cv.width = Math.round(img.width * k);
        cv.height = Math.round(img.height * k);
        cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
        res(cv.toDataURL("image/jpeg", q));
      };
      img.onerror = rej;
      img.src = fr.result;
    };
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
}
