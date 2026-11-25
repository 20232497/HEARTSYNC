// 인물별 씨앗(archive/style-works/code/seeds.js) — 그림 도구(npm run art)가 인물 그림의 시드를 먼저 찾는 표. 표의 값이 시드 꼴이고,
// 지금 content/에 있는 작품이면 그 인물 코드가 출연진에 있는지 본다(작품이 아직 합쳐지지 않았으면 건너뜀 — 표가 작품보다 먼저 들어올 수 있음).
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { CAST_SEEDS, castSeed } from "../../archive/style-works/code/seeds.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const walk = (d) =>
  fs
    .readdirSync(d, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name === "work.js" ? [path.join(d, e.name)] : []));
const WORKS = {};
for (const f of walk(path.join(ROOT, "content"))) WORKS[path.basename(path.dirname(f))] = (await import(pathToFileURL(f).href)).default;

test("인물별 씨앗: 표의 키와 값이 작품 id · 인물 코드 · 양의 정수 시드", () => {
  for (const [id, row] of Object.entries(CAST_SEEDS)) {
    assert.match(id, /^[a-z0-9_-]+$/, id + ": 작품 id 꼴이 아님");
    for (const [code, seed] of Object.entries(row)) {
      assert.match(code, /^[A-Z]+$/, id + "/" + code + ": 인물 코드 꼴이 아님");
      assert.ok(Number.isInteger(seed) && seed > 0, id + "/" + code + ": 시드가 양의 정수가 아님");
    }
  }
});

test("인물별 씨앗: content/에 있는 작품이면 그 인물이 출연진에 있음", () => {
  for (const [id, row] of Object.entries(CAST_SEEDS)) {
    if (!WORKS[id]) continue;
    const codes = new Set((WORKS[id].cast || []).map((c) => c.code));
    for (const code of Object.keys(row)) assert.ok(codes.has(code), id + ": 출연진에 " + code + "가 없음(코드가 바뀌었으면 표도)");
  }
});

test("인물별 씨앗: 표에 없는 작품·인물은 undefined(화풍의 기본 씨앗)", () => {
  assert.equal(castSeed("__none__", "AAA"), undefined);
  const [id, row] = Object.entries(CAST_SEEDS)[0];
  assert.equal(castSeed(id, Object.keys(row)[0]), Object.values(row)[0]);
  assert.equal(castSeed(id, "__NONE__"), undefined);
});
