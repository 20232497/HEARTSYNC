// 방의 작품을 '지금 읽을 모양'으로(src/js/core/character.js liveWork·latestWork·LIVE_FIELDS): 어느 칸을 최신 작품에서 읽고 어느 칸이 방 사본에 굳는지,
// 작품이 content/에서 빠지면 방 사본으로 돌아가는지 — 그리고 '방의 작품'을 다른 길(getChar·ORIGINALS)로 찾는 모듈이 새로 생기지 않는지(규칙이 다시 흩어지지 않게)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import assert from "node:assert/strict";
import { ORIGINALS } from "../../src/js/content/index.js";
import { LIVE_FIELDS, getChar, latestWork, liveWork } from "../../src/js/core/character.js";

const live = ORIGINALS[0];
/** 최신 작품과 모든 칸이 어긋난 방 사본 — 칸마다 '사본' 표시를 넣어 어느 쪽에서 읽었는지 가림 */
const copy = () => ({
  ...JSON.parse(JSON.stringify(live)),
  title: "사본 제목",
  persona: "사본 설정",
  world: "사본 세계",
  fields: ["사본 칸"],
  gauge: "사본 칸",
  cast: [{ code: "ZZ", name: "사본 인물", hidden: [3] }],
  episode: { beats: [], endings: [] },
  lore: [{ keys: ["사본 키"], text: "사본" }],
  places: [{ name: "사본 장소" }],
  cuts: [{ title: "사본 컷씬" }],
  commands: [{ cmd: "사본", title: "사본", prompt: "사본" }],
  guide: "사본 가이드",
  noteTemplate: "사본 양식",
  recommend: "사본 모델",
  images: { ZZ: { 0: "사본.webp" } },
  loreImages: { "사본 키": "사본.webp" }
});

test("liveWork: LIVE_FIELDS의 칸은 최신 작품에서, 나머지(인물·설정·상태창 칸·제목·에피소드)는 방 사본에서 — 방 사본은 건드리지 않음", () => {
  const c = copy(),
    before = JSON.stringify(c),
    w = liveWork(c);
  assert.deepEqual(LIVE_FIELDS, ["lore", "places", "cuts", "commands", "guide", "noteTemplate", "recommend", "images", "loreImages"]);
  for (const k of LIVE_FIELDS) assert.equal(w[k], live[k], `${k}는 최신 작품의 것(없으면 undefined 그대로)`);
  for (const k of ["id", "title", "persona", "world", "fields", "gauge", "cast", "episode"]) assert.equal(w[k], c[k], `${k}는 방 사본의 것`);
  assert.notEqual(w, c);
  assert.equal(JSON.stringify(c), before, "방 사본이 바뀌지 않음");
});
test("liveWork·latestWork: 작품이 content/에서 빠졌으면(id를 못 찾으면) 방 사본 그대로", () => {
  const gone = { ...copy(), id: "zz-gone" };
  assert.equal(getChar("zz-gone"), undefined);
  assert.equal(liveWork(gone), gone);
  assert.equal(latestWork(gone), gone);
});
test("latestWork: 새 방('처음부터 다시')은 방 사본이 아니라 최신 작품 통째로", () => {
  assert.equal(latestWork(copy()), live);
});

/* 지킴이: '방의 작품'은 liveWork·latestWork로만 찾는다. getChar를 직접 부르거나 작품 목록(ORIGINALS)을 들여오는 모듈은 아래 표의 것뿐 —
   방이 없는 화면(상세·도감·홈·로그인 뒤 돌아갈 곳)과, 예전 방을 옮길 때 최신 출연진의 코드를 보는 core/rooms.js의 upgradeCodes. 표에 없는 모듈이 쓰면 실패 */
const ALLOW = {
  "getChar(": { "core/character.js": 3, "core/rooms.js": 1, "ui/detail.js": 1, "ui/login.js": 1 },
  "ORIGINALS": { "content/index.js": true, "core/character.js": true, "ui/codex.js": true, "ui/detail.js": true, "ui/home.js": true }
};
test("지킴이: getChar 호출과 ORIGINALS 사용은 허용한 모듈에만(방의 작품은 liveWork·latestWork로)", () => {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "src", "js"),
    files = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".js") && e.name !== "generated.js") files.push(p);
    }
  })(root);
  const count = (text, word) => text.split(word).length - 1,
    found = { "getChar(": {}, "ORIGINALS": {} };
  for (const f of files) {
    const rel = path.relative(root, f).split(path.sep).join("/"),
      code = fs
        .readFileSync(f, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/.*$/gm, "$1"); // 주석 속 언급은 세지 않음
    for (const word of Object.keys(found)) {
      const n = count(code, word);
      if (n) found[word][rel] = n;
    }
  }
  assert.deepEqual(
    found["getChar("],
    ALLOW["getChar("],
    "getChar를 부르는 자리가 바뀜 — 방의 작품이면 liveWork(방 사본)·latestWork(새 방)를 쓰고, 방이 없는 화면이면 이 표에 더하세요"
  );
  assert.deepEqual(
    Object.keys(found.ORIGINALS).sort(),
    Object.keys(ALLOW.ORIGINALS).sort(),
    "작품 목록(ORIGINALS)을 쓰는 모듈이 바뀜 — 방의 작품을 찾으려는 것이면 liveWork로"
  );
});
