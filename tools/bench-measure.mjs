// 모델 시험 도구들이 같이 쓰는 측정(tools/model-bench.mjs · tools/prompt-bench.mjs): 응답 하나의 형식 지키기·한국어 비율·분량을 숫자로.
// 앱의 진짜 파서(ai/parse.js)와 코드 사전(images/codes.js)으로 재므로 앱이 읽는 그대로의 결과다. 개발 도구 — 앱·빌드에 들어가지 않음
import { dropEcho, looseJSON, splitReply } from "../src/js/ai/parse.js";
import { codebook, imgTags } from "../src/js/images/codes.js";

const count = (s, re) => (s.match(re) || []).length;
/**
 * @param {string} text 모델이 보낸 글 전체(본문 + 구분자 + 상태 JSON) @param {object} c 작품 @param {string} said 유저 입력 @param {string} persona 유저 캐릭터 이름
 * @returns 본문(body)·글자 수(chars)·상태창이 있고(state) 읽히는지(json)·채운 칸(fields)·추천 수(sug)·그림 태그 수(tags)와 잘못된 태그(badTags)·한국어 비율(ko)·대사 줄(lines)·유저 대사 대신 쓰기(asUser)·입력
 * 옮겨 적기(echo)
 */
export function measure(text, c, said, persona) {
  const { json } = splitReply(text),
    body = dropEcho(splitReply(text).body, said).trim(),
    plain = body.replace(/\[\[[^\]]*\]\]/g, "");
  const v = looseJSON(json),
    st = v && typeof v === "object" ? (v.status && typeof v.status === "object" ? v.status : v) : null,
    book = codebook(c),
    tags = imgTags(body);
  const ko = count(plain, /[가-힣]/g),
    latin = count(plain, /[A-Za-z]/g),
    han = count(plain, /[一-鿿]/g),
    kana = count(plain, /[぀-ヿ]/g),
    other = count(plain, /[Ѐ-ӿ฀-๿؀-ۿ]/g);
  return {
    body,
    chars: plain.length,
    state: !!json,
    json: !!st,
    fields: st ? c.fields.filter((f) => st[f] !== undefined && st[f] !== "").length + "/" + c.fields.length : "0/" + c.fields.length,
    sug: v && Array.isArray(v.suggestions) ? v.suggestions.length : 0,
    tags: tags.length,
    badTags: tags.filter((t) => !book[t.code] || t.sit < book[t.code].min || t.sit > book[t.code].max).length,
    ko: ko + latin + han + kana + other ? Math.round((ko / (ko + latin + han + kana + other)) * 100) : 0,
    latin,
    han,
    kana,
    other,
    lines: count(plain, /^.*["“].*$/gm),
    asUser: count(plain, new RegExp("^\\s*" + persona + "\\s*:", "gm")),
    echo: body.length < splitReply(text).body.trim().length
  };
}
