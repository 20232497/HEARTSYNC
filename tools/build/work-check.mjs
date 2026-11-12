// 작품 검사 — 작품 하나(work.js의 export default)가 규칙에 맞는지(checkWork): 필수 칸·분류·출연진 코드와 폼·비공개 칸·장소와 컷씬·본문 그림 태그·명령어·메타·키워드북·시작 상황·
// 트랙·미성년 인물·폴더와 성별. 그림 코드가 그 작품에서 맞는지 보는 codeRange는 그림 파일 검사(images-scan.mjs)도 같이 씀. 규칙을 더하면 tests/unit/content-check.test.mjs의 표에도 한 줄
import { AUD_DIRS, isObj, str } from "./common.mjs";
import { checkEpisode } from "./episode-check.mjs";

export function plainData(v, at, bad) {
  if (v === null || typeof v === "string" || typeof v === "boolean") return;
  if (typeof v === "number") {
    if (!Number.isFinite(v)) bad.push(at);
    return;
  }
  if (Array.isArray(v)) return v.forEach((x, i) => plainData(x, `${at}[${i}]`, bad));
  if (isObj(v)) return Object.keys(v).forEach((k) => plainData(v[k], `${at}.${k}`, bad));
  bad.push(at);
}

/* 그림 코드(글자 + 번호)가 이 작품에서 맞는지 검사하는 함수를 만듦 — 틀리면 이유 글, 맞으면 "".
   앱과 같은 코드 사전(images/codes.js codebook)으로: 인물 코드는 cast의 대문자 코드에 번호 0~14, MP<n>은 places의 n번째, EV<n>은 cuts의 n번째(1부터) */
export function codeRange(c, R) {
  const book = R.codebook({ ...c, cast: c.cast || [{ code: "C", name: c.name }] });
  return (code, n) => {
    const e = book[code];
    if (!e) return book[code.toUpperCase()] ? `코드는 대문자로 — ${code.toUpperCase()}${n}` : `코드 "${code}"가 cast에 없어요(장소는 MP, 컷씬은 EV)`;
    if (e.kind !== "cast" && !e.max) return `${code} 코드를 쓰려면 work.js에 ${e.field}(${e.label} 목록)를 적어 주세요`;
    if (n < e.min || n > e.max)
      return e.kind === "cast"
        ? `번호 ${n} — 그림 칸은 기본 감정 ${e.min}~${e.max}번이에요`
        : `${code}${n} — ${e.label}은 ${e.field}의 ${e.min}~${e.max}번이에요`;
    return "";
  };
}

export function checkWork(mod, { aud, row, id, wrel, R, errors, warnings }) {
  const e = (m) => errors.push(`${wrel}: ${m}`),
    w = (m) => warnings.push(`${wrel}: ${m}`);
  const c = mod.default;
  if (!isObj(c)) {
    e("work.js는 export default { … } 로 작품 하나를 내보내야 해요");
    return null;
  }
  const extra = Object.keys(mod).filter((k) => !["default", "order"].includes(k));
  if (extra.length) w(`빌드가 쓰지 않는 export: ${extra.join(", ")}`);
  if (mod.order !== undefined && !Number.isFinite(mod.order)) e("export const order 는 숫자여야 해요");
  const bad = [];
  plainData(c, "작품", bad);
  if (bad.length) return (e(`글·숫자·참거짓·배열·객체만 쓸 수 있어요(함수·undefined·NaN 안 됨): ${bad.slice(0, 5).join(", ")}`), null);

  if (c.id !== id) e(`id("${c.id}")가 폴더 이름("${id}")과 달라요 — 폴더 이름과 id를 같게`);
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(id)) e("폴더 이름(=id)은 영문 소문자·숫자·-·_로");
  for (const k of ["name", "title", "oneLiner", "desc", "persona"]) if (!str(c[k])) e(`"${k}"가 비었어요`);
  for (const k of ["world", "speech", "secret", "glyph", "gauge"]) if (c[k] !== undefined && typeof c[k] !== "string") e(`"${k}"는 글이어야 해요`);
  if (!R.CATS.includes(c.cat)) e(`cat("${c.cat}")은 ${R.CATS.join("·")} 중 하나`);
  if (!Number.isInteger(c.pal) || !R.PALETTES[c.pal]) e(`pal은 0~${R.PALETTES.length - 1}`);
  if (!R.MOTIFS[c.motif]) e(`motif("${c.motif}")는 ${Object.keys(R.MOTIFS).join("·")} 중 하나`);
  if ([...String(c.glyph || "")].length !== 1) w("glyph는 한 글자(표지 가운데 글자)");
  if (!Array.isArray(c.tags) || c.tags.some((t) => !str(t))) e("tags는 글 배열");
  if (!Array.isArray(c.fields) || !c.fields.length || c.fields.some((t) => !str(t))) e("fields(상태창 칸 이름)는 글 배열");
  else if (str(c.gauge) && !c.fields.includes(c.gauge)) w(`gauge("${c.gauge}")가 fields에 없어요`);

  // aud·row는 폴더가 정함 — 적었다면 폴더와 같아야
  if (c.aud !== undefined && c.aud !== aud) e(`aud("${c.aud}")가 폴더(${aud}/)와 달라요 — aud는 폴더가 정하니 지우거나 작품 폴더를 ${c.aud}/로 옮기세요`);
  if (c.row !== undefined) {
    if (!row) e(`row("${c.row}")를 쓰려면 _row.json이 있는 줄 폴더에 넣으세요(지금 폴더는 줄이 아님)`);
    else if (c.row !== row.key) e(`row("${c.row}")가 줄 폴더(${row.key}/)와 달라요 — row는 폴더가 정하니 지우세요`);
  }

  // 출연진: 없으면 앱이 설정의 "외모:" 줄로 한 명(code C)을 만든다(src/js/content/index.js) — 검사도 같은 모양으로
  let cast = c.cast;
  if (cast === undefined) cast = [{ code: "C", name: c.name, look: (String(c.persona || "").match(/외모:\s*([^\n]+)/) || [])[1] || "" }];
  else if (!Array.isArray(cast) || !cast.length) {
    e("cast는 출연진 배열(한 명 이상)");
    cast = [];
  }
  const codes = new Set();
  cast.forEach((x, i) => {
    if (!isObj(x) || typeof x.code !== "string" || !str(x.name)) return e(`cast[${i}]: { code: "영문 대문자 1~4자", name, look } 모양이어야 해요`);
    // 인물 코드: 영문 대문자 1~4자(images/codes.js CODE_RE) — 번호와 붙여 HSY3처럼 쓰니 숫자는 안 됨. MP·EV는 장소·컷씬 예약 코드
    if (!R.CODE_RE.test(x.code))
      return e(`cast[${i}](${x.name}).code "${x.code}" — 인물 코드는 영문 대문자 1~4자예요(숫자 없이, 예: HSY). 그림 태그·파일은 번호와 붙여 HSY3처럼 써요`);
    if (R.SERIES[x.code]) return e(`cast[${i}](${x.name}).code "${x.code}"는 예약 코드예요(MP 장소 · EV 컷씬) — 다른 글자로`);
    if (codes.has(x.code)) e(`cast 코드 "${x.code}"가 겹쳐요`);
    codes.add(x.code);
    if (x.look !== undefined && typeof x.look !== "string") e(`cast[${i}].look은 글이어야 해요`);
    if (x.desc !== undefined && typeof x.desc !== "string") e(`cast[${i}].desc(도감 소개)는 글이어야 해요`);
    if (x.tags !== undefined && (typeof x.tags !== "string" || /[가-힣]/.test(x.tags)))
      e(`cast[${i}].tags는 영문 Danbooru 태그 글이어야 해요(한국어 외모는 look에)`);
    // 비공개(스포일러) 감정 칸: 도감·상세에서 가리고 대화에 나온 방에서만 보임(images/codes.js codebook의 hidden). 0 프로필은 인물 카드라 숨길 수 없음
    if (x.hidden !== undefined) {
      const max = R.SIT.length - 1;
      if (!Array.isArray(x.hidden) || x.hidden.some((n) => !Number.isInteger(n) || n < 0 || n > max))
        e(`cast[${i}](${x.name}).hidden은 숨길 감정 번호 배열이에요(1~${max} 정수, 예: [13])`);
      else {
        if (new Set(x.hidden).size !== x.hidden.length) e(`cast[${i}](${x.name}).hidden에 같은 번호가 두 번 있어요`);
        if (x.hidden.includes(0)) e(`cast[${i}](${x.name}).hidden — 0(프로필)은 숨길 수 없어요(인물 카드에 쓰는 그림)`);
      }
    }
  });
  // 다른 모습(폼): of는 같은 출연진의 본체 코드 — 폼의 폼은 안 됨
  cast.forEach((x, i) => {
    if (!isObj(x) || x.of === undefined) return;
    const base = cast.find((y) => isObj(y) && y !== x && y.code === x.of);
    if (typeof x.of !== "string" || !base) e(`cast[${i}](${x.name}).of "${x.of}" — 본체 인물의 코드여야 해요`);
    else if (base.of !== undefined) e(`cast[${i}](${x.name}).of "${x.of}" — 폼의 폼은 둘 수 없어요(본체 코드로)`);
  });
  // 장소·컷씬 목록(선택): 순서가 곧 코드 번호 — places[0]이 MP1, cuts[0]이 EV1
  const engOk = (t) => t === undefined || (typeof t === "string" && !/[가-힣]/.test(t)),
    boolOk = (v) => v === undefined || typeof v === "boolean";
  if (
    c.places !== undefined &&
    (!Array.isArray(c.places) ||
      c.places.some((p) => !isObj(p) || !str(p.name) || (p.desc !== undefined && typeof p.desc !== "string") || !engOk(p.tags) || !boolOk(p.hidden)))
  )
    e('places(장소)는 [{ name: "장소 이름", desc?: "설명", tags?: "영문 태그", hidden?: true(비공개) }, …] — 순서대로 MP1, MP2…');
  if (
    c.cuts !== undefined &&
    (!Array.isArray(c.cuts) ||
      c.cuts.some((x) => !isObj(x) || !str(x.title) || (x.when !== undefined && typeof x.when !== "string") || !engOk(x.tags) || !boolOk(x.hidden)))
  )
    e('cuts(컷씬)는 [{ title: "제목", when?: "나오는 조건", tags?: "영문 태그", hidden?: true(비공개) }, …] — 순서대로 EV1, EV2…');
  // 장소 이름·컷씬 제목·키워드북 첫 키는 작품 안에서 겹치지 않게 — 순서 잠금이 이름으로 '밀렸는지·이름만 고쳤는지'를 가리고(tools/content-lock.mjs), 키워드북 그림은 첫 키로 이어짐
  for (const [k, pick, what] of [
    ["places", (x) => x.name, "장소 이름"],
    ["cuts", (x) => x.title, "컷씬 제목"],
    ["lore", (x) => (Array.isArray(x.keys) ? x.keys[0] : ""), "키워드북의 첫 키"]
  ]) {
    const names = (Array.isArray(c[k]) ? c[k] : []).map((x) => (isObj(x) ? pick(x) : "")),
      dup = names.find((x, i) => str(x) && names.indexOf(x) !== i);
    if (dup) e(`${k}: ${what} "${dup}"이(가) 두 번 나와요 — 작품 안에서 겹치지 않게 적어 주세요`);
  }
  // 본문의 그림 태그는 [[코드번호]] 한 토큰 — 코드가 cast(대문자)·places(MP)·cuts(EV)에 있고 번호가 범위 안인지(시작 상황 본문·즉답 명령어의 글이 같이 씀)
  const tagRange = codeRange({ ...c, cast }, R);
  const checkTags = (text, at) => {
    for (const m of String(text).matchAll(/\[\[([^\]]*)\]\]/g)) {
      const tok = m[1],
        t = tok.match(/^([A-Za-z]+)(\d{1,2})$/);
      if (!t) {
        e(
          `${at}: [[${tok}]] — 그림 태그는 [[코드번호]] 한 토큰이에요(예: [[${(cast[0] || {}).code || "HSY"}0]])${/^img:/i.test(tok) ? ". 예전 [[img:코드:번호]] 모양은 더 쓰지 않아요" : ""}`
        );
        continue;
      }
      const why = tagRange(t[1], +t[2]);
      if (why) e(`${at}: [[${tok}]] — ${why}`);
    }
  };
  // 작품 명령어(선택): 대화방에서 !cmd를 치면 prompt가 AI에 연출 지시로 가거나(이야기), text를 AI 없이 바로 보여 줌(즉답) — 둘 중 하나(core/commands.js). 앱 명령어 이름·별칭(APP_COMMANDS)과 겹치면 안 됨
  if (c.commands !== undefined) {
    const reserved = new Set(R.APP_COMMANDS.flatMap((x) => [x.cmd, ...x.alias]).map((s) => s.toLowerCase())),
      seenCmd = new Set();
    if (!Array.isArray(c.commands)) e('commands(명령어)는 [{ cmd: "이름", title: "제목", desc?: "설명", prompt: "AI 지시" 또는 text: "바로 보여 줄 글" }, …]');
    else
      c.commands.forEach((x, i) => {
        if (!isObj(x) || !str(x.cmd) || !str(x.title) || (x.desc !== undefined && typeof x.desc !== "string"))
          return e(`commands[${i}]: { cmd, title, desc?, prompt 또는 text } 모양이어야 해요(cmd·title은 글)`);
        if ((x.prompt !== undefined) === (x.text !== undefined) || !str(x.prompt !== undefined ? x.prompt : x.text))
          return e(`commands[${i}](${x.cmd}): prompt(AI에게 주는 지시)와 text(AI 없이 바로 보여 줄 글) 중 하나만, 글로 적어요`);
        if (x.text !== undefined) {
          if (x.text.length > R.LIMITS.reply) e(`commands[${i}](${x.cmd}).text가 ${x.text.length}자예요 — 즉답 글은 ${R.LIMITS.reply}자 이내`);
          checkTags(x.text, `commands[${i}](${x.cmd}).text`);
        }
        if (!/^[^\s!！/]+$/.test(x.cmd)) e(`commands[${i}].cmd "${x.cmd}" — 공백·!·/ 없이 이름만 적어요(예: "퀘스트" → 대화에서 !퀘스트)`);
        const k = x.cmd.toLowerCase();
        if (reserved.has(k)) e(`commands[${i}].cmd "${x.cmd}"는 앱 명령어 이름이에요(${[...reserved].join("·")}) — 다른 이름으로`);
        if (seenCmd.has(k)) e(`commands[${i}].cmd "${x.cmd}"가 겹쳐요`);
        seenCmd.add(k);
      });
  }
  // 작품 메타(선택): 제작자 이름·독점 여부·공개일 — 상세 페이지 머리와 도감 작품 칸에 보임(ui/codex.js metaHTML)
  if (c.creator !== undefined && !str(c.creator)) e("creator(제작자 이름)는 비어 있지 않은 글이어야 해요");
  if (c.exclusive !== undefined && typeof c.exclusive !== "boolean") e("exclusive(독점 여부)는 참거짓(true·false)이어야 해요");
  if (c.publishedAt !== undefined) {
    const d = typeof c.publishedAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(c.publishedAt) ? new Date(c.publishedAt + "T00:00:00Z") : null;
    if (!d || isNaN(d) || d.toISOString().slice(0, 10) !== c.publishedAt) e(`publishedAt("${c.publishedAt}")은 "YYYY-MM-DD" 모양의 실제 날짜여야 해요(공개일)`);
  }
  // 권장 모델(선택): 모델 선택 시트의 '권장' 배지 — ai/models.js MODELS의 키(없으면 앱이 RECOMMEND_DEFAULT)
  if (c.recommend !== undefined && !Object.prototype.hasOwnProperty.call(R.MODELS, c.recommend))
    e(`recommend("${c.recommend}")는 ${Object.keys(R.MODELS).join("·")} 중 하나(권장 모델)`);
  // 플레이 가이드(선택): 제작자가 독자에게 주는 안내문 — 상세·도감·대화방 드로어에 줄바꿈 그대로 보임(마크다운 없음)
  if (c.guide !== undefined && (!str(c.guide) || c.guide.length > R.LIMITS.guide))
    e(`guide(플레이 가이드)는 ${R.LIMITS.guide}자 이내의 글이어야 해요${typeof c.guide === "string" ? `(지금 ${c.guide.length}자)` : ""}`);
  // 유저노트 양식(선택): 대화방 유저노트의 '이 작품의 양식 넣기'가 넣는 글 — 유저노트 한도 안이어야
  if (c.noteTemplate !== undefined && (!str(c.noteTemplate) || c.noteTemplate.length > R.LIMITS.userNote))
    e(
      `noteTemplate(유저노트 양식)는 ${R.LIMITS.userNote}자 이내의 글이어야 해요${typeof c.noteTemplate === "string" ? `(지금 ${c.noteTemplate.length}자)` : ""}`
    );
  if (c.lookTags !== undefined && (typeof c.lookTags !== "string" || /[가-힣]/.test(c.lookTags))) e("lookTags는 영문 Danbooru 태그 글이어야 해요");
  if (c.lookTags !== undefined && c.cast !== undefined) w("cast가 있으면 lookTags는 쓰이지 않아요 — cast[].tags에 적어 주세요");
  if (
    c.lore !== undefined &&
    (!Array.isArray(c.lore) ||
      c.lore.some(
        (x) =>
          !isObj(x) ||
          !Array.isArray(x.keys) ||
          !x.keys.length ||
          x.keys.some((k) => !str(k)) ||
          !str(x.text) ||
          (x.tags !== undefined && typeof x.tags !== "string")
      ))
  )
    e('lore(키워드북)는 [{ keys: ["키워드", …], text: "설명", kind?: "종류", tags?: "영문 태그" }, …]');
  else {
    // 키워드북 규칙(ai/prompt/lore.js matchLore와 같은 상수 LORE): 상시(always)·우선순위(order)·제외 낱말(not)·보조 키(also)
    const strs = (v) => v === undefined || (Array.isArray(v) && v.length > 0 && v.every(str));
    (c.lore || []).forEach((x, i) => {
      const at = `lore[${i}](${x.keys[0]})`;
      if (x.always !== undefined && typeof x.always !== "boolean") e(`${at}.always(상시 주입)는 참거짓이어야 해요`);
      if (x.order !== undefined && !Number.isFinite(x.order)) e(`${at}.order(우선순위 — 클수록 먼저)는 숫자여야 해요`);
      if (!strs(x.not)) e(`${at}.not(이 낱말이 나오면 넣지 않음)은 글 배열이어야 해요`);
      if (!strs(x.also)) e(`${at}.also(keys와 함께 나와야 하는 낱말)는 글 배열이어야 해요`);
      if (x.always === true && (x.not !== undefined || x.also !== undefined))
        e(`${at}: 상시(always) 항목에는 not·also를 쓸 수 없어요 — 상시 항목은 조건 없이 늘 들어가요`);
      if (x.text.length > R.LORE.budget) e(`${at}.text가 ${x.text.length}자예요 — 한 턴 예산(${R.LORE.budget}자)보다 길어 한 번도 들어가지 못해요`);
    });
    const al = (c.lore || []).filter((x) => x.always === true),
      sum = al.reduce((n, x) => n + x.text.length, 0);
    if (al.length > R.LORE.max || sum > R.LORE.budget)
      e(`키워드북의 상시(always) 항목이 ${al.length}개·${sum}자예요 — 한 턴 예산(${R.LORE.max}개·${R.LORE.budget}자) 안이어야 늘 들어갈 수 있어요`);
    else if (al.length && sum > R.LORE.budget / 2)
      w(`키워드북의 상시(always) 항목이 ${sum}자로 한 턴 예산(${R.LORE.budget}자)의 절반을 넘어요 — 키워드로 걸리는 항목이 들어갈 자리가 줄어요`);
  }
  (Array.isArray(c.lore) ? c.lore : []).forEach((x, i) => {
    if (!isObj(x) || !Array.isArray(x.keys) || !str(x.text)) return; // 모양 오류는 위에서 이미 알림
    // 세계관 일러스트: 종류(kind)는 상세 카드 머리표·AI 구도를 정하고, tags는 번역 없이 그대로 프롬프트에 들어가므로 영문만
    if (x.kind !== undefined && !R.LORE_KINDS[x.kind]) e(`lore[${i}](${x.keys[0]}).kind("${x.kind}")는 ${Object.keys(R.LORE_KINDS).join("·")} 중 하나`);
    if (typeof x.tags === "string" && /[가-힣]/.test(x.tags)) e(`lore[${i}](${x.keys[0]}).tags는 영문 태그 글이어야 해요(한국어 설명은 text에)`);
    if (x.tags === undefined || x.kind === undefined) w(`lore[${i}](${x.keys[0]})에 kind·tags가 없어요 — 세계관 일러스트를 만들 때 쓸 종류·영문 낱말이에요`);
  });
  if (c.artTags !== undefined && (typeof c.artTags !== "string" || /[가-힣]/.test(c.artTags)))
    e("artTags(세계관 태그)는 영문 태그 글이어야 해요 — 시대·장소·분위기 낱말");
  if (!Array.isArray(c.openings) || !c.openings.length) e("openings(시작 상황)가 하나 이상 있어야 해요");
  else
    c.openings.forEach((o, i) => {
      if (!isObj(o) || !str(o.title) || !str(o.text)) return e(`openings[${i}]: title·text가 있어야 해요`);
      // 시작 상황 id: 대화방이 제목이 아니라 이것으로 시작 상황을 기억함(제목은 고쳐도 됨) — 필수, 작품 안에서 겹치지 않게
      if (typeof o.id !== "string" || !R.OPENING_ID_RE.test(o.id))
        e(
          `openings[${i}](${o.title}).id${o.id === undefined ? "가 없어요" : `("${o.id}")가 모양에 안 맞아요`} — 영문 소문자로 시작하는 소문자·숫자·하이픈 2~24자(예: id: "first-night"). 화면에는 안 보이고, 한 번 공개하면 고치지 않아요`
        );
      else if (c.openings.findIndex((x) => isObj(x) && x.id === o.id) !== i) e(`openings[${i}].id("${o.id}")가 앞의 시작 상황과 겹쳐요`);
      if (o.directive !== undefined && typeof o.directive !== "string") e(`openings[${i}].directive는 글이어야 해요`);
      // 시작 상황의 선택 칸: 배경 장소(places의 n번째)·첫 답변 추천(최대 3개)·시작 직후 N턴 동안만 주는 연출 지시
      const nPlaces = Array.isArray(c.places) ? c.places.length : 0;
      if (o.place !== undefined && !(Number.isInteger(o.place) && o.place >= 1 && o.place <= nPlaces))
        e(`openings[${i}].place(${o.place}) — 배경 장소는 places의 1~${nPlaces}번째 번호예요${nPlaces ? "" : "(places가 없으면 쓸 수 없어요)"}`);
      if (
        o.suggestions !== undefined &&
        (!Array.isArray(o.suggestions) ||
          !o.suggestions.length ||
          o.suggestions.length > 3 ||
          o.suggestions.some((s) => !str(s) || s.length > R.LIMITS.suggestion))
      )
        e(`openings[${i}].suggestions(첫 답변 추천)는 글 1~3개, 각 ${R.LIMITS.suggestion}자 이내`);
      if (
        o.lead !== undefined &&
        !(
          isObj(o.lead) &&
          str(o.lead.text) &&
          o.lead.text.length <= R.LIMITS.lead &&
          Number.isInteger(o.lead.turns) &&
          o.lead.turns >= 1 &&
          o.lead.turns <= R.LIMITS.leadTurns
        )
      )
        e(`openings[${i}].lead(시작 연출)는 { text: "지시"(${R.LIMITS.lead}자 이내), turns: 1~${R.LIMITS.leadTurns} }`);
      if (o.status !== undefined && (!isObj(o.status) || Object.values(o.status).some((v) => typeof v !== "string" && typeof v !== "number")))
        e(`openings[${i}].status는 { "칸 이름": 글 또는 숫자 }`);
      else if (o.status && Array.isArray(c.fields)) {
        const miss = Object.keys(o.status).filter((k) => !c.fields.includes(k));
        if (miss.length) w(`openings[${i}].status의 ${miss.join(", ")} 칸이 fields에 없어요`);
      }
      checkTags(o.text, `openings[${i}]`);
    });

  if (c.episode !== undefined) checkEpisode(c.episode, e, R);
  // 공개 저장소의 작품은 일반 트랙만 — 성인 트랙 작품은 서버 쪽 비공개 데이터로만 둠(CLAUDE.md 원칙)
  if (c.track !== undefined && c.track !== "general") e(`track: "${c.track}" — content/의 작품은 일반 트랙만 둘 수 있어요(track 칸을 지우거나 "general")`);
  // 앱과 같은 규칙: 미성년 인물 막기(minorFlags), 출연진 성별로 짐작한 aud(guessAud) — 다른 오류가 있어도 늘 검사
  if (!cast.length || !cast.every(isObj)) return c;
  const probe = { ...c, cast };
  const minors = R.minorFlags(probe);
  if (minors.length) e(`19세 미만이거나 학생으로 보이는 인물이 있어요: ${minors.join(", ")} — 모든 인물은 성인이어야 해요(minorFlags)`);
  const guess = R.guessAud(probe);
  if (aud !== "all" && guess !== "all" && guess !== aud)
    e(`출연진 외모가 모두 ${guess === "m" ? "여성" : "남성"}이에요 — ${guess}/ 폴더(${AUD_DIRS[guess]})가 맞지 않나요?`);
  if (aud === "all" && guess !== "all") w(`출연진 외모가 모두 ${guess === "m" ? "여성" : "남성"}이에요 — ${guess}/ 폴더가 더 맞을 수 있어요`);
  return c;
}
