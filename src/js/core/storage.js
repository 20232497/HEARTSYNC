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
  // 열기가 멈추면(다른 탭이 막는 등) 5초 뒤 없는 것으로 봄 — 기다리는 저장·계정 올리기가 영영 멈추지 않게. 못 열었으면 기억해 두지 않고 다음에 다시 시도(잠깐의 장애일 수 있음)
  open() {
    if (!this.p) {
      const p = new Promise((res) => {
        let over = false;
        const done = (db) => {
          if (over) {
            if (db) db.close(); // 제한 시간이 지난 뒤에 열린 연결 — 쓰지 않으니 닫음(열어 두면 다른 탭의 판올림·삭제를 막음)
            return;
          }
          over = true;
          clearTimeout(t);
          res(db);
        };
        const t = setTimeout(() => done(null), 5000);
        try {
          const r = indexedDB.open("heartverse", 1);
          r.onupgradeneeded = () => r.result.createObjectStore("kv");
          r.onsuccess = () => done(r.result);
          r.onerror = r.onblocked = () => done(null);
        } catch {
          done(null);
        }
      });
      this.p = p;
      p.then((db) => {
        if (!db && this.p === p) this.p = null;
      });
    }
    return this.p;
  },
  /**
   * 없을 때만 넣음(있으면 건드리지 않음) — 확인과 넣기가 한 번의 요청이라, 그사이 다른 탭이 쓴 값을 덮지 않음(예전 방 본문을 옮길 때).
   * @returns {Promise<"added"|"exists"|"fail">}
   */
  async add(k, v) {
    const db = await this.open();
    if (!db) return "fail";
    return new Promise((res) => {
      try {
        const t = db.transaction("kv", "readwrite"),
          q = t.objectStore("kv").add(v, k);
        let exists = false;
        q.onerror = (e) => {
          if (q.error && q.error.name === "ConstraintError") {
            exists = true;
            e.preventDefault(); // 이미 있음은 실패가 아님 — 트랜잭션을 중단시키지 않음
          }
        };
        t.oncomplete = () => res(exists ? "exists" : "added");
        t.onerror = t.onabort = () => res(exists ? "exists" : "fail");
      } catch {
        res("fail");
      }
    });
  },
  // strict: 읽지 못한 것(열기·조회 실패)을 '없음'과 구별해 던짐 — 없는 것으로 알고 넘어가면 안 되는 곳(계정에 올리기)이 씀
  async get(k, strict) {
    const db = await this.open();
    if (!db) {
      if (strict) throw new Error("idb");
      return undefined;
    }
    return new Promise((res, rej) => {
      const fail = () => (strict ? rej(new Error("idb")) : res(undefined));
      try {
        const q = db.transaction("kv").objectStore("kv").get(k);
        q.onsuccess = () => res(q.result);
        q.onerror = fail;
      } catch {
        fail();
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
  // 비웠는지를 돌려줌 — 기기 지우기(같이 쓰는 기기에서 로그아웃)가 '지웠다'고 하기 전에 확인함. 못 열었으면: 방 본문을 여기 두던 기기는 실패, 아니면 비울 것이 없음
  async clear() {
    const db = await this.open();
    if (!db) return !usesIdb();
    return new Promise((res) => {
      try {
        const t = db.transaction("kv", "readwrite");
        t.objectStore("kv").clear();
        t.oncomplete = () => res(true);
        t.onerror = t.onabort = () => res(false);
      } catch {
        res(false);
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
/* 방 본문(room-<id>)의 저장소 — 대화가 쌓이면 localStorage(약 5MB)가 먼저 차므로 큰 저장소(IndexedDB)에 둠(2026-11-23). 목록(rooms)·지갑 등 작은 키는 그대로 localStorage.
   - 읽기: IndexedDB → 없으면 예전 설치가 localStorage에 둔 본문. 옛 본문은 읽을 때 IndexedDB에 '없을 때만' 넣고(IDB.add — 다른 탭이 그사이 쓴 새 본문을 덮지 않음),
     **들어간 것을 확인한 뒤에만**, 읽은 그대로일 때만 옛 키를 지움(계정 올리기도 최근 시각 갱신도 없음).
   - 쓰기·지우기: 성공했는지를 돌려줌(true·false) — 부른 쪽(core/rooms.js saveRoom)이 실패를 알리고 목록을 되돌림. 지우기는 양쪽 모두.
   - IndexedDB가 막힌 브라우저(사생활 모드 등)는 localStorage로 같은 약속 — 단, 한 번이라도 큰 저장소에 본문을 둔 기기(hv1_bodies)는 못 열어도 localStorage로
     물러나지 않고 실패로 알림(두 곳에 다른 판이 생기지 않게). 저장소가 아예 없는 환경(Node 단위 시험)은 메모리에. */
const BODY_RE = /^room-/;
const bodyMem = new Map();
let bodyWrites = Promise.resolve(); // 진행 중인 본문 쓰기의 줄 — KV.settled()가 이것을 기다림
const noStore = () => typeof localStorage === "undefined";
const bodyBusy = new Map(); // 지금 쓰는 중인 본문의 키 → 겹친 수(계정 받기가 그 키를 덮지 않게 — KV.writing)
const bodyVer = new Map(); // 키 → 쓰기를 시작한 횟수. 읽는 사이 쓰기가 끼었는지 보려고(KV.stamp — 방을 여는 쪽이 옛 본문을 메모리에 올리지 않게)
function bodyDrop(k) {
  try {
    localStorage.removeItem("hv1_" + k);
  } catch {}
}
function bodyRaw(k) {
  try {
    return localStorage.getItem("hv1_" + k);
  } catch {
    return null;
  }
}
/* 이 기기가 방 본문을 큰 저장소에 두기 시작했다는 표시(hv1_bodies). 그 뒤로는 큰 저장소를 못 열어도 localStorage에 쓰지 않음 —
   두 곳에 서로 다른 판이 생기면 다음에 큰 저장소의 옛 판이 읽힘. 못 열면 저장 실패로 알림(다시 저장) */
const usesIdb = () => bodyRaw("bodies") === "idb";
function markIdb() {
  if (usesIdb()) return;
  try {
    localStorage.setItem("hv1_bodies", "idb");
  } catch {}
}
async function bodyGet(k, strict) {
  if (await IDB.open()) {
    const v = await IDB.get(k, strict);
    if (v !== undefined) return v;
    // 예전 설치가 localStorage에 둔 본문: 큰 저장소에 '없을 때만' 넣음 — 그사이 다른 탭이 새 본문을 썼으면 그것을 쓰고, 옛 사본은 읽은 그대로일 때만 지움
    const raw = bodyRaw(k);
    if (raw === null) return undefined;
    let old;
    try {
      old = JSON.parse(raw);
    } catch {
      return undefined;
    }
    const r = await IDB.add(k, old);
    if (r === "exists") return IDB.get(k);
    if (r === "added") {
      markIdb();
      if (bodyRaw(k) === raw) bodyDrop(k);
    }
    return old;
  }
  if (strict && usesIdb()) throw new Error("idb"); // 본문을 큰 저장소에 두는 기기인데 지금 못 엶 — '없음'이 아니라 '못 읽음'
  return noStore() ? bodyMem.get(k) : KV.getLocal(k);
}
async function bodySet(k, v) {
  bodyVer.set(k, (bodyVer.get(k) || 0) + 1);
  if (await IDB.open()) {
    const ok = await IDB.set(k, v);
    if (ok) {
      markIdb();
      bodyDrop(k); // 옛 사본이 남아 있으면 지움 — 두 곳에 다른 판이 남지 않게
    }
    return ok;
  }
  if (noStore()) {
    if (v === undefined) bodyMem.delete(k);
    else bodyMem.set(k, v);
    return true;
  }
  if (usesIdb()) return false; // 큰 저장소를 쓰던 기기인데 지금 못 엶 — localStorage로 물러나지 않고 실패로 알림
  try {
    if (v === undefined) localStorage.removeItem("hv1_" + k);
    else localStorage.setItem("hv1_" + k, JSON.stringify(v));
    return true;
  } catch (e) {
    if (e && (e.name === "QuotaExceededError" || e.code === 22)) storageFull();
    return false;
  }
}
/**
 * 키·값 저장 — 항상 localStorage(hv1_ 접두사)에 쓰고, 로그인했으면 remote 고리(CLOUD.put)로 계정에도.
 * getLocal(k)·setLocal(k, v)는 이 기기의 localStorage만 · get(k) → Promise<unknown> · set(k, v, { local = true })(v가 undefined면 지움, IndexedDB에 둔 그림 본문은 local:false)
 * **방 본문(room-<id>)은 get·set·put이 큰 저장소(IndexedDB)로 보냄**(위 bodyGet·bodySet) — getLocal·setLocal로는 읽고 쓰지 않음(예전 설치의 사본만 보임).
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
  async get(k, strict) {
    return BODY_RE.test(k) ? bodyGet(k, strict) : this.getLocal(k);
  },
  // 방 본문(room-<id>)은 큰 저장소에 쓰고 Promise<boolean>(저장됐는지)을 돌려줌 — 저장된 뒤에만 계정에 올림. 그 밖의 키는 전처럼 바로
  set(k, v, { local = true } = {}) {
    if (local && BODY_RE.test(k)) {
      bodyBusy.set(k, (bodyBusy.get(k) || 0) + 1); // 쓰기 시작부터 '쓰는 중' — 끝나 계정 대기열에 들어갈 때까지 계정 받기가 이 키를 덮지 않게
      const end = () => {
        const n = (bodyBusy.get(k) || 0) - 1;
        if (n > 0) bodyBusy.set(k, n);
        else bodyBusy.delete(k);
      };
      const p = bodySet(k, v).then(
        (ok) => {
          if (ok && this.remote) this.remote(k, v);
          end();
          return ok;
        },
        () => {
          end();
          return false;
        }
      );
      const done = () =>
        p.then(
          () => {},
          () => {}
        );
      bodyWrites = bodyWrites.then(done, done);
      return p;
    }
    if (local) this.setLocal(k, v);
    if (this.remote) this.remote(k, v);
  },
  /** 이 방 본문에 쓰기를 시작한 횟수 — 읽기 앞뒤로 견줘 그사이 쓰기가 끼었는지 봄. @param {string} k @returns {number} */
  stamp(k) {
    return bodyVer.get(k) || 0;
  },
  /** 이 방 본문을 지금 쓰는 중인지(KV.set을 시작해 아직 안 끝남). @param {string} k @returns {boolean} */
  writing(k) {
    return bodyBusy.has(k);
  },
  /** 지금까지 시작한 방 본문 쓰기가 모두 끝나면(계정 대기열에 들어갔으면) 풀림 — 계정 올리기(CLOUD.flush)가 저장 직후의 본문을 빼먹지 않게 기다림. @returns {Promise<void>} */
  settled() {
    return bodyWrites;
  },
  /** 이 기기에만 씀(계정에 올리지 않음) — 방 본문은 큰 저장소로. 계정에서 받은 값을 적용할 때 씀. @returns {Promise<boolean>} 저장됐는지 */
  async put(k, v) {
    if (BODY_RE.test(k)) return bodySet(k, v);
    this.setLocal(k, v);
    return true;
  },
  /** 예전 설치가 localStorage에 둔 방 본문을 큰 저장소로 옮김(부팅 뒤 한가할 때 — 열지 않은 방도 localStorage 자리를 비우게). 막혀 있으면 아무것도 안 함. @returns {Promise<void>} */
  async moveBodies() {
    if (!(await IDB.open())) return;
    let old = [];
    try {
      old = Object.keys(localStorage).filter((k) => k.indexOf("hv1_room-") === 0);
    } catch {}
    for (const k of old) await bodyGet(k.slice(4));
  }
};
