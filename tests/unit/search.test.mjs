// 대화 검색(src/js/ui/chat/search.js searchRoom): 지금 보이는 버전의 본문에서만, 대소문자 없이, 그림 태그는 빼고, 최근 것부터 — 찾은 말과 앞뒤 글
import { test } from "node:test";
import assert from "node:assert/strict";
import { searchRoom } from "../../src/js/ui/chat/search.js";

const room = (msgs) => ({ char: { name: "가람", world_mode: false }, persona: { name: "지호" }, msgs });
const ai = (id, text, more = []) => ({ id, role: "ai", idx: 0, alts: [{ text, status: { 속마음: "상태창의 비밀" } }, ...more] });
const me = (id, text, sys) => ({ id, role: "user", text, ...(sys ? { sys: true } : {}) });

test("searchRoom: 최근 메시지부터, 말한 쪽 이름과 찾은 말의 앞뒤 글 — 대소문자를 가리지 않고 그림 태그는 뺌", () => {
  const r = room([ai("a1", '[[GRM0]]\n\n*비가 내린다.*\n\n"Hello, 처음 뵙겠습니다."'), me("u1", "hello 반가워요"), ai("a2", "다른 이야기.")]);
  const hits = searchRoom(r, "  HELLO ");
  assert.deepEqual(
    hits.map((h) => [h.id, h.who, h.hit]),
    [
      ["u1", "지호", "hello"],
      ["a1", "가람", "Hello"]
    ]
  );
  assert.equal(hits[1].pre, '*비가 내린다.* "', "그림 태그는 빠지고 줄바꿈은 빈칸 하나로");
  assert.equal(hits[1].post, ', 처음 뵙겠습니다."');
  assert.deepEqual(searchRoom(r, "GRM0"), [], "그림 태그 속 글은 찾지 않음");
  assert.deepEqual(searchRoom(r, ""), []);
  assert.deepEqual(searchRoom(r, "   "), []);
});
test("searchRoom: 지금 보이는 버전만 — 다시 쓰기 전의 글·상태창 글·'이어서 쓰기' 표시는 찾지 않음", () => {
  const two = ai("a1", "예전 버전의 단서", [{ text: "지금 버전의 열쇠" }]);
  two.idx = 1;
  const r = room([two, me("s1", "(이어서)", true)]);
  assert.deepEqual(searchRoom(r, "단서"), []);
  assert.equal(searchRoom(r, "열쇠").length, 1);
  assert.deepEqual(searchRoom(r, "비밀"), [], "상태창");
  assert.deepEqual(searchRoom(r, "이어서"), [], "이어서 쓰기 표시");
});
test("searchRoom: 긴 글은 앞뒤를 줄여 …을 붙이고, 결과는 60건까지", () => {
  const long = "가".repeat(80) + "열쇠" + "나".repeat(200);
  const one = searchRoom(room([ai("a1", long)]), "열쇠")[0];
  assert.ok(one.pre.startsWith("…") && one.pre.length === 31, "앞 30자 + …");
  assert.ok(one.post.endsWith("…") && one.post.length === 61, "뒤 60자 + …");
  const many = room(Array.from({ length: 80 }, (_, i) => me("u" + i, "열쇠 " + i)));
  const hits = searchRoom(many, "열쇠");
  assert.equal(hits.length, 60);
  assert.equal(hits[0].id, "u79", "최근 것부터");
});
