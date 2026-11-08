/* 안전: 미성년 인물 막기(minorFlags·minorHint) — 순수 함수라 빌드의 작품 검사와 단위 테스트가 그대로 import */
/** @typedef {import("./types.js").CastMember} CastMember */
/** @typedef {import("./types.js").Work} Work */
/* 미성년 인물 막기: 출연진 외모나 캐릭터 설정 첫머리("이름(17, 여)")에 19세 미만 나이·학생 신분이 있으면 저장·공개하지 않음 */
/** 19세 미만·학생으로 보이는 인물 이름들(비면 통과). 저장·공개·빌드 검사가 같은 함수를 씀. @param {Work|{ cast?: CastMember[], persona?: string }} c @returns {string[]} */
export function minorFlags(c) {
  const out = [], under = (n) => n > 0 && n < 19;
  for (const x of c.cast || []) {
    const t = String(x.look || ""), m = t.match(/(\d{1,2})\s*(?:세|살)/);
    if ((m && under(+m[1])) || /초등학생|중학생|고등학생|여고생|남고생|미성년/.test(t)) out.push(x.name || x.code);
  }
  // 설정 첫머리의 첫 "이름(나이" 만 본다(뒤에 나오는 가족·과거 인물 언급은 막지 않음)
  const pm = String(c.persona || "").slice(0, 120).match(/([가-힣A-Za-z]{1,10})\s*\((\d{1,2})\s*[,，)]/);
  if (pm && under(+pm[2])) out.push(pm[1]);
  return [...new Set(out)];
}
/* 글 속 미성년 암시(19세 미만 나이, 학생·아동 낱말, 그런 Danbooru 태그). 지금은 빌드의 작품 검사·단위 테스트가 쓰고, 성인 기능을 서버에 다시 세울 때 서버 판정이 같은 함수를 씀(docs/ROADMAP.md) */
/** 글 속 미성년 암시(나이·학생·아동·교복 낱말과 영문 태그). @param {string} t @returns {boolean} */
export function minorHint(t) {
  t = String(t || "");
  if ([...t.matchAll(/(\d{1,2})\s*(?:세|살|years?[\s-]*old|yo\b)/gi)].some((m) => +m[1] > 0 && +m[1] < 19)) return true;
  return /미성년|초등학생|중학생|고등학생|여고생|남고생|여중생|남중생|초딩|중딩|고딩|교복|어린이|아동|유아|로리|쇼타/.test(t)
    || /\b(?:child|children|kids?|loli|lolita|shota|toddler|underage|teen|teens|teenager|schoolgirl|schoolboy|school uniform|elementary school|middle school|high school|little girl|little boy|young girl|young boy|aged down)\b/i.test(t);
}
