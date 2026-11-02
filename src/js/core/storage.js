/* 저장소: IndexedDB(IDB)와 KV(localStorage → db → 계정) */
import { toast } from "./util.js";
import { CLOUD } from "../services/cloud.js";

/* 브라우저 저장 공간이 가득 찼을 때 한 번만 알림(조용히 저장이 실패해 데이터가 사라지는 것을 막기 위해) */
let fullWarned = false;
function storageFull() {
  if (fullWarned) return; fullWarned = true;
  setTimeout(() => toast("브라우저 저장 공간이 가득 찼어요. 오래된 대화방이나 쓰지 않는 그림·세트를 지워 주세요."), 0);
}
/* 큰 데이터(그림) 저장소: IndexedDB. localStorage(약 5MB)보다 훨씬 크고, 막혀 있으면(사생활 모드 등) null을 돌려 localStorage로 물러남 */
export const IDB = {
  p: null,
  open() {
    if (!this.p) this.p = new Promise((res) => {
      try { const r = indexedDB.open("heartverse", 1); r.onupgradeneeded = () => r.result.createObjectStore("kv"); r.onsuccess = () => res(r.result); r.onerror = () => res(null); }
      catch { res(null); }
    });
    return this.p;
  },
  async get(k) {
    const db = await this.open(); if (!db) return undefined;
    return new Promise((res) => { try { const q = db.transaction("kv").objectStore("kv").get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(undefined); } catch { res(undefined); } });
  },
  async set(k, v) {
    const db = await this.open(); if (!db) return false;
    return new Promise((res) => {
      try { const t = db.transaction("kv", "readwrite"), s = t.objectStore("kv"); if (v === undefined) s.delete(k); else s.put(v, k); t.oncomplete = () => res(true); t.onerror = t.onabort = () => { if (t.error?.name === "QuotaExceededError") storageFull(); res(false); }; }
      catch { res(false); }
    });
  },
  async clear() {
    const db = await this.open(); if (!db) return;
    await new Promise((res) => { try { const t = db.transaction("kv", "readwrite"); t.objectStore("kv").clear(); t.oncomplete = t.onerror = t.onabort = () => res(); } catch { res(); } });
  },
  async keys() {
    const db = await this.open(); if (!db) return [];
    return new Promise((res) => { try { const q = db.transaction("kv").objectStore("kv").getAllKeys(); q.onsuccess = () => res((q.result || []).map(String)); q.onerror = () => res([]); } catch { res([]); } });
  }
};
export const KV = {
  db: null, uid: null, dbOk: false, queues: {},
  lkey: (k) => "hv1_" + k,
  getLocal(k) { try { const v = localStorage.getItem(this.lkey(k)); return v ? JSON.parse(v) : undefined; } catch { return undefined; } },
  setLocal(k, v) {
    try { if (v === undefined) localStorage.removeItem(this.lkey(k)); else localStorage.setItem(this.lkey(k), JSON.stringify(v)); }
    catch (e) { if (e && (e.name === "QuotaExceededError" || e.code === 22)) storageFull(); }
  },
  ref(k) { return this.db.doc("data/users/" + this.uid + "/" + k); },
  async get(k) {
    if (this.dbOk) {
      try { const s = await this.ref(k).get(); if (s.exists) { const v = s.data().v; this.setLocal(k, v); return v; } } catch {}
    }
    return this.getLocal(k);
  },
  set(k, v, { local = true } = {}) {
    if (local) this.setLocal(k, v);
    CLOUD.put(k, v);
    if (!this.dbOk) return;
    const q = this.queues[k] || (this.queues[k] = { busy: false, next: undefined, has: false });
    q.next = v; q.has = true;
    if (q.busy) return;
    (async () => {
      q.busy = true;
      while (q.has) {
        const val = q.next; q.has = false;
        try { if (val === undefined) await this.ref(k).delete(); else await this.ref(k).set({ v: val, at: Date.now() }); }
        catch (e) { if (e instanceof TypeError || (e && (e.code === "permission_denied" || e.code === "invalid_argument"))) { this.dbOk = false; q.has = false; } }
      }
      q.busy = false;
    })();
  }
};
