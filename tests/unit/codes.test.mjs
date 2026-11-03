// 그림 상황 코드(src/js/images/codes.js) 단위 테스트 — 번호 차원·조합 키·태그 파싱·폴백 순서·의상·장소 이어 가기·빈 번호
import { test } from "node:test";
import assert from "node:assert/strict";
import { DIMS, RESET, applyDims, baseName, dimOf, fallbackKeys, freeNum, imgTags, keyOf, lastDims, maxRating, parseCodes, splitDims, usedNums, MAX_ACT } from "../../src/js/images/codes.js";

test("dimOf: 400번대는 의상, 500번대는 장소, 나머지는 감정/행동", () => {
  assert.equal(dimOf(3), "act"); assert.equal(dimOf(101), "act"); assert.equal(dimOf(404), "wear"); assert.equal(dimOf(501), "place"); assert.equal(dimOf(999), "act");
});
test("DIMS: 내장 코드는 영문 태그·수위·차원을 갖고, 400·500만 프롬프트가 비며, 노골적인 번호(406·408)는 없다", () => {
  for (const d of Object.values(DIMS)) {
    if (d.n === RESET.wear || d.n === RESET.place) assert.equal(d.prompt, "");
    else assert.match(d.prompt, /^[a-z0-9 ,:()'-]+$/i, d.n + " 프롬프트는 영문 태그");
    assert.ok(["safe", "questionable"].includes(d.rating), d.n + " 내장 코드는 전체이용가·세미만");
    assert.equal(d.dim, dimOf(d.n)); assert.ok(d.builtin);
  }
  assert.equal(DIMS[406], undefined); assert.equal(DIMS[408], undefined);
  assert.equal(DIMS[404].dim, "wear"); assert.equal(DIMS[501].dim, "place");
});
test("parseCodes: 쉼표 목록·숫자·공백·잘못된 조각", () => {
  assert.deepEqual(parseCodes("101, 404,501"), [101, 404, 501]);
  assert.deepEqual(parseCodes(3), [3]);
  assert.deepEqual(parseCodes("101,101,abc,1234,,7"), [101, 7]);
  assert.deepEqual(parseCodes(""), []); assert.deepEqual(parseCodes(null), []);
});
test("splitDims·keyOf: 감정은 최대 2개, 의상·장소는 마지막 것, 키는 감정 오름차순 → 의상 → 장소, 400·500은 키에서 빠짐", () => {
  assert.deepEqual(splitDims([404, 102, 501, 101, 103]), { act: [102, 101], wear: 404, place: 501 });
  assert.equal(MAX_ACT, 2);
  assert.equal(keyOf([501, 404, 102, 101]), "101,102,404,501");
  assert.equal(keyOf("3"), "3", "번호 하나면 그대로(예전 슬롯 키)");
  assert.equal(keyOf([404, 501]), "404,501");
  assert.equal(keyOf([3, 400, 500]), "3"); assert.equal(keyOf([400]), "");
  assert.equal(keyOf([]), "");
});
test("fallbackKeys: 조합 → 감정만 → 첫 감정 → 1 → 0", () => {
  assert.deepEqual(fallbackKeys("101,102,404,501"), ["101,102,404,501", "101,102", "101", "1", "0"]);
  assert.deepEqual(fallbackKeys("3"), ["3", "1", "0"]);
  assert.deepEqual(fallbackKeys(1), ["1", "0"]);
  assert.deepEqual(fallbackKeys("404,501"), ["404,501", "1", "0"]);
  assert.deepEqual(fallbackKeys("400"), ["1", "0"]);
});
test("imgTags: 3자리·쉼표 배열을 읽고 sit은 첫 감정 번호(예전 코드 호환)", () => {
  const t = imgTags("*문*\n\n[[img:ks:404,101,501]]\n\n카시안: \"…\"\n\n[[img:lu:0]]");
  assert.equal(t.length, 2);
  assert.deepEqual(t[0], { code: "ks", codes: [404, 101, 501], key: "101,404,501", sit: 101, wear: 404, place: 501, raw: "[[img:ks:404,101,501]]" });
  assert.equal(t[1].key, "0"); assert.equal(t[1].sit, 0); assert.equal(t[1].wear, null);
  assert.equal(imgTags("그림 없음").length, 0);
});
test("lastDims·applyDims: 의상·장소는 다음 응답으로 이어지고, 바꾸면 바뀌고, 400·500으로 되돌린다", () => {
  const hist = ["[[img:ks:0]]", "*…*\n[[img:ks:3,404,501]]\n[[img:lu:2]]"];
  assert.deepEqual(lastDims(hist), { ks: { wear: 404, place: 501 }, lu: { wear: null, place: null } });
  const dims = lastDims(hist);
  assert.equal(applyDims("[[img:ks:2]]\n카시안: \"…\"\n[[img:lu:5]]", dims), "[[img:ks:2,404,501]]\n카시안: \"…\"\n[[img:lu:5]]");
  assert.equal(applyDims("[[img:ks:2,403]]", dims), "[[img:ks:2,403,501]]", "의상만 바꾸면 장소는 이어짐");
  assert.equal(applyDims("[[img:ks:2,400]]\n[[img:ks:7]]", dims), "[[img:ks:2,501]]\n[[img:ks:7,501]]", "400은 기본 의상으로 되돌리고 같은 응답의 다음 태그에도 적용");
  assert.equal(applyDims("[[img:ks:500]]", dims), "[[img:ks:404]]", "감정 없이 되돌리기만 쓰면 의상만 남음");
  assert.equal(applyDims("[[img:LU:400]]", {}), "[[img:lu:1]]", "남는 번호가 없으면 1(기본), 코드는 소문자로");
  assert.deepEqual(dims, lastDims(hist), "applyDims는 받은 dims를 바꾸지 않음");
});
test("freeNum·usedNums: 종류별 빈 번호는 내장 코드를 피하고, 자리가 없으면 -1", () => {
  const used = usedNums([{ n: 15 }, { n: 16 }, { n: 410 }]);
  assert.equal(freeNum(used, "act"), 17); assert.equal(freeNum(used, "wear"), 411); assert.equal(freeNum(used, "place"), 510);
  assert.ok(used.has(404) && used.has(101), "내장 번호도 쓰는 번호");
  const full = new Set(Array.from({ length: 600 }, (_, i) => i));
  assert.equal(freeNum(full, "act"), -1); assert.equal(freeNum(full, "wear"), -1);
  const wearFull = new Set(Array.from({ length: 100 }, (_, i) => 410 + i)); assert.equal(freeNum(wearFull, "wear"), 401, "410~499가 차면 내장 뒤 401~409");
});
test("maxRating·baseName", () => {
  assert.equal(maxRating(["safe", "questionable", "safe"]), "questionable"); assert.equal(maxRating([]), "safe"); assert.equal(maxRating(["explicit", "questionable"]), "explicit");
  assert.equal(baseName(2), "웃음"); assert.equal(baseName(101), "미소"); assert.equal(baseName(404), "오피스룩"); assert.equal(baseName(77), "");
});
