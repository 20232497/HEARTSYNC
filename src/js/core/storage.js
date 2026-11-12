/* 저장소: IndexedDB(IDB)와 KV(localStorage → 계정). 계정 저장은 KV.remote 고리로 — services/cloud.js가 꽂음(core는 services를 모름) */
import { toast } from "./util.js";

/* 브라우저 저장 공간이 가득 찼을 때 한 번만 알림(조용히 저장이 실패해 데이터가 사라지는 것을 막기 위해) */
let fullWarned = false;
function storageFull() {
  if (fullWarned) return;
  fullWarned = true;
  setTimeout(() => toast("브라우저 저장 공간이 가득 찼어요. 오래된 대화방이나 쓰지 않는 사진을 지워 주세요."), 0);
}
/* 큰 데이터(그림) 저장소: IndexedDB. localStorage(약 5MB)보다 훨씬 크고, 막혀 있으면(사생활 모드 등) null을 돌려 localStorage로 물러남 */
/**
 * IndexedDB "heartverse"/kv — 그림 본문용 큰 저장소.
 * open() → Promise<IDBDatabase|null>(막힌 브라우저면 null) · get(k) → Promise<unknown> · set(k, v) → Promise<boolean>(v가 undefined면 지움) · clear() · keys() →
 * Promise<string[]>
 */
export const IDB = {
  p: null,
  open() {
    if (!this.p)
      this.p = new Promise((res) => {
        try {
          const r = indexedDB.open("heartverse", 1);
          r.onupgradeneeded = () => r.result.createObjectStore("kv");
          r.onsuccess = () => res(r.result);
          r.onerror = () => res(null);
        } catch {
          res(null);
        }
      });
    return this.p;
  },
  async get(k) {
    const db = await this.open();
    if (!db) return undefined;
    return new Promise((res) => {
      try {
        const q = db.transaction("kv").objectStore("kv").get(k);
        q.onsuccess = () => res(q.result);
        q.onerror = () => res(undefined);
      } catch {
        res(undefined);
      }
    });
  },
  async set(k, v) {
    const db = await this.open();
    if (!db) return false;
    return new Promise((res) => {
      try {
        const t = db.transaction("kv", "readwrite"),
          s = t.objectStore("kv");
        if (v === undefined) s.delete(k);
        else s.put(v, k);
        t.oncomplete = () => res(true);
        t.onerror = t.onabort = () => {
          if (t.error?.name === "QuotaExceededError") storageFull();
          res(false);
        };
      } catch {
        res(false);
      }
    });
  },
  async clear() {
    const db = await this.open();
    if (!db) return;
    await new Promise((res) => {
      try {
        const t = db.transaction("kv", "readwrite");
        t.objectStore("kv").clear();
        t.oncomplete = t.onerror = t.onabort = () => res();
      } catch {
        res();
      }
    });
  },
  async keys() {
    const db = await this.open();
    if (!db) return [];
    return new Promise((res) => {
      try {
        const q = db.transaction("kv").objectStore("kv").getAllKeys();
        q.onsuccess = () => res((q.result || []).map(String));
        q.onerror = () => res([]);
      } catch {
        res([]);
      }
    });
  }
};
/**
 * 키·값 저장 — 항상 localStorage(hv1_ 접두사)에 쓰고, 로그인했으면 remote 고리(CLOUD.put)로 계정에도.
 * getLocal(k)·setLocal(k, v)는 이 기기만 · get(k) → Promise<unknown> · set(k, v, { local = true })(v가 undefined면 지움, IndexedDB에 둔 그림 본문은 local:false)
 * 값은 JSON으로 직렬화되는 것만. localStorage가 가득 차면 storageFull()이 한 번 알림
 */
export const KV = {
  remote: null, // (k, v) => … 계정 저장(services/cloud.js가 꽂음). 없으면 이 기기에만
  lkey: (k) => "hv1_" + k,
  getLocal(k) {
    try {
      const v = localStorage.getItem(this.lkey(k));
      return v ? JSON.parse(v) : undefined;
    } catch {
      return undefined;
    }
  },
  setLocal(k, v) {
    try {
      if (v === undefined) localStorage.removeItem(this.lkey(k));
      else localStorage.setItem(this.lkey(k), JSON.stringify(v));
    } catch (e) {
      if (e && (e.name === "QuotaExceededError" || e.code === 22)) storageFull();
    }
  },
  async get(k) {
    return this.getLocal(k);
  },
  set(k, v, { local = true } = {}) {
    if (local) this.setLocal(k, v);
    if (this.remote) this.remote(k, v);
  }
};
