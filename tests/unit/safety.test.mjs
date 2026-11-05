// 안전 규칙(src/js/core/safety.js) 단위 테스트 — 미성년 인물은 어떤 설정에서도 막는다(CLAUDE.md '원칙')
import { test } from "node:test";
import assert from "node:assert/strict";
import { idvPassed, minorFlags, minorHint } from "../../src/js/core/safety.js";

test("minorFlags: 출연진 외모의 19세 미만 나이·학생 신분, 설정 첫머리의 '이름(나이'를 잡는다", () => {
  assert.deepEqual(minorFlags({ cast: [{ code: "a", name: "A", look: "17세 여성" }, { code: "b", name: "B", look: "25세 남성" }], persona: "" }), ["A"]);
  assert.deepEqual(minorFlags({ cast: [{ code: "a", name: "A", look: "여고생 교복" }], persona: "" }), ["A"]);
  assert.deepEqual(minorFlags({ cast: [], persona: "한겨울(16, 여). 편의점 알바" }), ["한겨울"]);
  assert.deepEqual(minorFlags({ cast: [{ code: "c", name: "서도윤", look: "29세 남성" }], persona: "서도윤(29, 남). 탐정" }), []);
});
test("minorFlags: 설정 뒤쪽의 가족·과거 인물 나이는 보지 않는다", () => {
  const persona = "백연(외견 28세, 실제 나이 천 살 이상, 남). " + "x".repeat(130) + " 동생 백화(12, 여)는 오래전에 죽었다";
  assert.deepEqual(minorFlags({ cast: [{ code: "c", name: "백연", look: "28세 남성" }], persona }), []);
});
test("minorHint: 글 속 19세 미만 나이·학생·아동 낱말과 영문 태그", () => {
  assert.equal(minorHint("17세 소녀가"), true);
  assert.equal(minorHint("1girl, school uniform"), true);
  assert.equal(minorHint("교복을 입은"), true);
  assert.equal(minorHint("1girl, 25 years old, office lady"), false);
  assert.equal(minorHint("19세 성인"), false);
  assert.equal(minorHint(""), false);
});
test("idvPassed: 성인 판정 + 기간 안 + live 모드는 실제 채널 결과만", () => {
  const now = 1000, ok = { adult: true, test: false, until: 2000 };
  assert.equal(idvPassed(ok, "live", now), true);
  assert.equal(idvPassed(ok, "test", now), true);
  assert.equal(idvPassed({ ...ok, test: true }, "test", now), true);
  assert.equal(idvPassed({ ...ok, test: true }, "live", now), false);
  assert.equal(idvPassed({ ...ok, adult: false }, "test", now), false);
  assert.equal(idvPassed({ ...ok, until: 1000 }, "test", now), false);
  assert.equal(idvPassed({ ...ok, adult: "true" }, "test", now), false);
  assert.equal(idvPassed({ ...ok, test: undefined }, "live", now), false);
  assert.equal(idvPassed(null, "test", now), false);
});
