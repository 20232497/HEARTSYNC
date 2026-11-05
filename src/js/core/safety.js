/* 안전: 미성년 인물 막기(minorFlags·minorHint·roomMinorHint)·성인 인증 판정(idvPassed) — 순수 함수라 빌드의 작품 검사와 단위 테스트가 그대로 import */
/** @typedef {import("./types.js").CastMember} CastMember */
/** @typedef {import("./types.js").LoreEntry} LoreEntry */
/** @typedef {import("./types.js").Room} Room */
/** @typedef {import("./types.js").Work} Work */
/* 미성년 인물 막기: 출연진 외모나 캐릭터 설정 첫머리("이름(17, 여)")에 19세 미만 나이·학생 신분이 있으면 저장·공개하지 않음 */
/** 19세 미만·학생으로 보이는 인물 이름들(비면 통과). 저장·공개·빌드 검사가 같은 함수를 씀. @param {Work|{ cast?: CastMember[], persona?: string }} c @returns {string[]} */
export function minorFlags(c) {
  const out = [];
  for (const x of c.cast || []) if (minorHint([x.look, x.tags].join("\n"))) out.push(x.name || x.code);
  // 설정은 첫머리만 본다(뒤에 나오는 가족·과거 인물 언급은 막지 않음): 첫 "이름(나이", 그 밖의 첫머리 글
  const head = String(c.persona || "").slice(0, 120), pm = head.match(/([가-힣A-Za-z]{1,10})\s*\((\d{1,2}|열[가-힣]{1,2})\s*[,，)]/);
  if (pm && minorHint(pm[2] + "살")) out.push(pm[1]);
  else if (settingHint(head)) out.push(c.name || c.title || "설정");
  return [...new Set(out)];
}
/**
 * 휴대폰 성인 인증 결과가 지금 유효한지: 성인 판정 + 1년 안 + live 모드면 시험 채널 결과는 인정하지 않음(시험 채널은 통신사 확인 없이 통과함).
 * @param {{ adult: boolean, test: boolean, until: number }|null|undefined} rec @param {string} mode CFG.idv.mode @param {number} [now] @returns {boolean}
 */
export function idvPassed(rec, mode, now = Date.now()) { return !!rec && rec.adult === true && rec.until > now && (mode !== "live" || rec.test === false); }
/**
 * 글 속 미성년 암시(나이·학년·학생·아동·교복 낱말과 영문 태그). 성인 경로·Claude 거절 우회·성인 수위 그림을 막는 데 씀.
 * 글자로 찾는 것이라 모든 표현을 잡지는 못함 — 애매하면 막는 쪽으로 둠.
 * 여학생·남학생은 보지 않음: 대학생에게도 흔히 쓰는 말이라(2026-11-06 사용자 결정). 나이·학년·교복 같은 다른 표현과 함께 쓰면 그쪽이 잡고, 학생 신분의 성적 묘사 금지는 모델 규칙(ADULT_RULE)에 그대로 있음.
 * @param {string} t @returns {boolean}
 */
export function minorHint(t) {
  // 글자만 겹치는 말을 먼저 지움: 칼로리·쇼타임 / 재벌 3세·2세 계획·중2병 / 군주 이름(헨리 8세·황제 레온 3세 — 뒤에 소녀·소년·성별이 오면 나이로 봄) / 15세 관람가 / 나이 차이(두 살 위) / 살아·살림·살인 사건 / 18세기·세상·세대
  // N세로 쓴 나이 자체는 지우지 않음: 인물 소개의 기본 표기(오리지널 작품의 출연진도 모두 N세)라, 빼면 '17살'은 막히고 '17세'는 통과함
  t = String(t || "").normalize("NFKC");
  const under = (re) => [...t.matchAll(re)].some((m) => +m[1] > 0 && +m[1] < 19);
  // 숫자 바로 뒤에 붙은 '살'은 뒤에 어떤 글자가 와도 나이(17살을·17살아) — 낱말을 지우기 전에 봄. 17살차이처럼 붙여 쓴 나이 차이만 뺌
  if (under(/(?:^|\D)(\d{1,2})[ \t]*살(?=[가-힣])(?!차이?|연상|연하|위|아래|밑|많|적[은다어]|어리|어린|더|터울)/g)) return true;
  t = t.replace(/칼로리|글로리|플로리|쇼타임|유아독존|세 살 버릇|중2병|청소년[ \t]*(?:관람[ \t]*)?불가|(?:재벌|오너|창업주|교포|이민|그룹|한인|재일|재미)[ \t]*\d세|2세[ \t]*(?:계획|소식|준비)|(?:루이[ \t]*1[0-8]|베네딕토[ \t]*16|엘리자베스[ \t]*[12]|(?:루이|헨리|찰스|조지|에드워드|제임스|윌리엄|리처드|나폴레옹|프리드리히|빌헬름|카를|표트르|니콜라이|알렉산드르|이반|람세스|앙리|필리프|펠리페)[ \t]*[1-9]|교황[ \t]+[가-힣]{1,8}[ \t]*\d{1,2}|(?:황제|선황|국왕|선왕|여왕)[ \t]+(?!나이|당시|올해|겨우|고작|아직|이제)[가-힣]{1,8}[ \t]*[1-9])세(?![ \t]*(?:소녀|소년|아이|여아|남아|여성|남성|여자|남자|[,，)/][ \t]*(?:여|남)))|\d{1,2}세[ \t]*(?:이상[ \t]*)?(?:관람가|이용가|등급)|(?:살|세)[ \t]*(?:차이?|연상|연하|위|아래|밑|많|적[은다어]|어리|어린(?![ \t]*(?:소녀|소년|아이|애|여자|남자|여아|남아))|더|터울)|살(?:아|았|려|리|린|릴|림|해|기|짝|결|점|갗|피|펴|폈|구(?!나)|벌|금|찌|쪘|찐|빼|빠|붙|덩|얼|며|랑)|살을(?=[ \t]*(?:빼|뺐|뺀|찌|쪘|찐|만지|만졌|만진|베|벴|벤|파고|꼬집|에는|도려|태|섞|맞대|비비|부비|뜯|물|깎|깍|떨|꼬))|살인[ \t]*(?:사건|범|마|자|귀|청부|미수|현장|죄|혐의|용의|동기|은|이|을|의|도|과)|세(?:기|대|트|계|상|력|월|자|금|수)/g, " ");
  // 숫자로 쓴 나이: 17세·17-year-old·17 y/o, 나이 17·연령 17·age 17 (앞에 숫자가 더 있으면 117살처럼 다른 수)
  if (under(/(?:^|\D)(\d{1,2})[ \t-]*(?:세|살|years?[ \t-]*olds?\b|yrs?[ \t-]*olds?\b|y[ \t]*[/.][ \t]*o\b|yo\b)/gi)
    || under(/(?:\baged?[ \t]*[:=]?|(?:나이|연령)[ \t]*(?:[:=]|은|는|이|가|도)?)[ \t]*(\d{1,2})(?!\d|[ \t]*(?:배|년|개|번|차))/gi)) return true;
  // 한글로 쓴 나이: 열일곱 살·일곱 살. 스물 넘으면·열아홉은 통과, '살'만 있으면 나이가 아님
  for (const m of t.matchAll(/(?:(스물|서른|마흔|쉰|예순|일흔|여든|아흔|백|천)[ \t]*)?(열[ \t]*)?(한|두|세|네|다섯|여섯|일곱|여덟|아홉)?[ \t]*(살|세)/g)) {
    const [, big, ten, one, unit] = m, n = (ten ? "열" : "") + (one || "");
    if (big || !n || n === "열아홉" || n === "한") continue; // '한 살'은 '한 살이라도'·'한 살 먹다' 같은 관용구가 대부분
    if (unit === "세" && !(ten && one)) continue; // 세는 '열일곱 세'만(네 세·두 세는 대개 다른 말)
    if (n.length === 1 && /[가-힣]/.test(t[m.index - 1] || "")) continue; // '위한 살인'·'그네 살'처럼 앞말의 끝 글자
    return true;
  }
  return /미성년|초등학생|초등생|중학생|고등학생|고교생|중고생|여고생|남고생|여중생|남중생|청소년|초딩|중딩|고딩|잼민이|교복|어린이|아동|유아|로리|쇼타/.test(t)
    // 학년: 고2·중3·초6, 고등학교 2학년, 2학년 3반 ('2학년'만은 대학생도 쓰니 보지 않음)
    || /(?:^|[^가-힣A-Za-z0-9])(?:고[1-3]|중[1-3]|초[1-6])(?![0-9A-Za-z])/.test(t)
    || /(?:고등학교|고교|여고|남고|중학교|여중|남중|초등학교|국민학교)[ \t]*(?:[1-6]|일|이|삼|사|오|육)[ \t]*학년|[1-6][ \t]*학년[ \t]*\d{1,2}[ \t]*반/.test(t)
    // 단위 없이 쓴 나이: 열일곱 소녀·나이 열일곱·열일곱이다, 십칠 세(이십 세·수십 세는 아님), 10대 소녀·10대 후반(50대·10대 기업은 아님)
    || /열(?:한|두|세|네|다섯|여섯|일곱|여덟)의?[ \t]*(?:소녀|소년)|(?:나이|연령)[ \t]*(?:[:=]|은|는|이|가|도)?[ \t]*열(?:한|두|세|네|다섯|여섯|일곱|여덟)|열(?:다섯|여섯|일곱|여덟)(?:이다|이야|이에요|이예요|입니다|이었|이던|이라|인[ \t])/.test(t)
    || /(?:^|[^이삼사오육칠팔구수몇백천])십[ \t]*[일이삼사오육칠팔]?[ \t]*(?:세|살)/.test(t)
    || /(?:(?:^|\D)10|(?:^|[^이삼사오육칠팔구수몇백천])십)[ \t]*대[ \t]*(?:소녀|소년|여자|남자|여성|남성|아이|초반|중반|후반)/.test(t)
    || /\b(?:child|children|kids?|loli|lolita|shota|toddler|underaged?|teens?|teenagers?|teenaged?|pre-?teens?|schoolgirls?|schoolboys?|school uniform|elementary school|middle school(?:ers?)?|junior high|high ?school(?:ers?)?|little girl|little boy|young girl|young boy|aged down|(?:ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen)[ \t-]*years?[ \t-]*old)\b/i.test(t);
}
/** 설정·장기기억처럼 오래 남는 글의 미성년 암시 — 어른 인물의 과거 이야기('중학생 때'·'열일곱 살 시절')는 빼고 본다. @param {string} t @returns {boolean} */
export function settingHint(t) { return minorHint(String(t || "").replace(/[^\s,.]+[ \t]*(?:때(?!문|리|렸|려)|시절|무렵)/g, " ")); }
/**
 * 대화방에 미성년 암시가 있는지 — 성인 경로(unfilteredRoute)와 거절 우회(canFallback)를 막는 기준. 세 겹으로 본다:
 * ① 작품의 인물(minorFlags) ② 모델이 이번 턴에 그대로 읽는 글(유저노트·상태창·기억력만큼의 대화)은 그대로
 * ③ 오래 남는 글(작품 설정·키워드북·유저 캐릭터·장기기억)과 유저가 예전에 쓴 말은 과거 이야기를 빼고 — 기억력 밖으로 밀어내 넘기지 못하게. 기억력 밖의 AI 글은 모델이 읽지 않아 보지 않음.
 * 키워드북의 동물 항목(kind creature)은 나이가 있어도 사람이 아니라 뺌.
 * @param {Room} r @param {LoreEntry[]} [lore] 지금 쓰는 키워드북(원본 작품의 최신 것) @returns {boolean}
 */
export function roomMinorHint(r, lore = r.char?.lore) {
  const c = r.char || {}, text = (m) => (m.role === "ai" ? m.alts?.[m.idx]?.text : m.text) || "";
  const msgs = (r.msgs || []).filter(text);
  if (minorFlags(c).length) return true;
  if (minorHint([r.userNote, ...Object.entries(r.status || {}).map(([k, v]) => k + ": " + v), ...msgs.slice(-((r.set?.mem || 10) * 2 + 1)).map(text)].join("\n"))) return true;
  return settingHint([c.title, c.oneLiner, c.desc, ...(c.tags || []), c.persona, c.world, c.speech, c.secret, r.directive, r.persona?.memo, r.persona?.desc, r.memory,
    ...(lore || []).filter((e) => e.kind !== "creature").flatMap((e) => [...(e.keys || []), e.text]), ...msgs.filter((m) => m.role === "user").map(text)].join("\n"));
}
