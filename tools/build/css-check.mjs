// 오래된 아이폰에서도 읽고 누를 수 있게 지키는 CSS 검사(2026-11-24 사용자 결정 — 제대로 보이는 기준은 iOS 16.4 이상, 그 아래는 읽고 누를 수 있게만).
//   ① inset 약칭을 쓰지 않음(iOS 14.5 미만은 모름 — 선언이 버려져 자리를 못 잡음) → top·right·bottom·left로
//   ② backdrop-filter 앞에(같은 규칙 안) -webkit-backdrop-filter — iOS 18 미만은 접두사 붙은 것만 앎
//   ③ color-mix()는 @supports (color:color-mix(in srgb, red, blue)) { … } 안에만, 그리고 그 밖에 같은 선택자·같은 속성의 평범한 선언이 있어야 함.
//      '앞에 평범한 선언을 한 줄 더'로는 안 됨: 우리 color-mix()에는 var()가 들어 있어서, 오래된 사파리는 그 선언을 버리지 못하고(값을 나중에야 앎)
//      쓸 때 가서 무효가 되면 앞의 선언이 아니라 '없음'(배경이면 투명)으로 떨어짐. @supports 블록은 통째로 건너뛰므로 밖의 선언이 그대로 남음
//   ④ 규칙 안의 규칙(CSS 중첩)을 쓰지 않음 — 사파리 16.5 미만은 모름(기준인 16.4에서도 깨짐)
// 문법 검사가 아니라 이 넷만 본다. src/css의 조각만 봄 — JS 템플릿과 뼈대의 style 속성은 보지 않음. JS의 오래된 문법은 output-check.mjs.

/* 주석은 같은 길이의 빈칸으로, 따옴표 글은 같은 길이의 _로(줄 번호·위치 유지 — 그 안의 { } ; 와 함수 이름에 속지 않게) */
const mask = (t, keepQuoted) =>
  // 한 번에 훑음 — 먼저 나온 쪽이 이김(따옴표 안의 /* 가 주석을 열지 않고, 주석 안의 따옴표가 글을 열지 않게). keepQuoted: 따옴표 글은 그대로(선택자를 읽을 때)
  t.replace(/\/\*[\s\S]*?\*\/|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, (m) =>
    m[1] === "*" && m[0] === "/" ? m.replace(/[^\n]/g, " ") : keepQuoted ? m : m[0] + "_".repeat(m.length - 2) + m[0]
  );
/* 선택자를 견줄 모양으로: 빈칸을 하나로, 결합자·쉼표 둘레의 빈칸은 뗌(.a > .b와 .a>.b는 같은 것) */
const selOf = (s) =>
  s
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s*([>+~,])\s*/g, "$1");
/* color-mix()를 아는 브라우저에서만 열리는 조건 — 이 모양 하나만 인정(not·or가 붙거나 var()가 든 조건은 오래된 브라우저에서도 열릴 수 있음) */
const MIX_SUPPORTS = "@supports(color:color-mix(insrgb,red,blue))";
/* 블록 안의 선언들 — 괄호 밖의 ;에서 나눔(url(data:…;base64,…) 안의 ;는 값의 일부). at은 블록 안에서의 시작 위치 */
function declsOf(body) {
  const out = [];
  let depth = 0,
    from = 0;
  for (let i = 0; i <= body.length; i++) {
    const ch = body[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    if (i < body.length && (ch !== ";" || depth)) continue;
    const raw = body.slice(from, i),
      c = raw.indexOf(":");
    if (c > 0)
      out.push({
        prop: raw.slice(0, c).trim().toLowerCase(),
        value: raw
          .slice(c + 1)
          .trim()
          .toLowerCase(),
        at: from + (raw.length - raw.trimStart().length)
      });
    from = i + 1;
  }
  return out;
}
/* 글을 규칙들로 — @media·@supports 같은 묶음 안으로 들어감. mix: color-mix()를 조건으로 건 @supports 안의 규칙인지. nested: 규칙 안에 규칙이 든 것(CSS 중첩) */
/* src는 주석·따옴표를 가린 글(위치 찾기용), text는 주석만 가린 글(선택자는 여기서 — 따옴표까지 가리면 [data-x="a"]와 [data-x="b"]가 같아 보임). top: 어느 묶음에도 들지 않은 규칙 */
function rulesOf(src, text) {
  const rules = [],
    nested = [];
  const walk = (from, to, mix, top) => {
    let start = from;
    for (let i = from; i < to; i++) {
      if (src[i] === ";") start = i + 1; // @import 같은 한 줄 문장
      if (src[i] !== "{") continue;
      let depth = 1,
        j = i + 1;
      for (; j < to && depth; j++) depth += src[j] === "{" ? 1 : src[j] === "}" ? -1 : 0;
      const pre = selOf(text.slice(start, i)),
        a = i + 1,
        b = depth ? j : j - 1;
      if (!src.slice(a, b).includes("{")) rules.push({ sel: pre, at: a, mix, top, decls: declsOf(src.slice(a, b)) });
      else if (pre[0] === "@") walk(a, b, mix || pre.toLowerCase().replace(/\s+/g, "") === MIX_SUPPORTS, false);
      else nested.push({ sel: pre, at: i });
      i = j - 1;
      start = j;
    }
  };
  walk(0, src.length, false, true);
  return { rules, nested };
}
const hasMix = (d) => d.value.includes("color-mix(");
/**
 * @param {string} file 오류 글에 쓸 경로(저장소 루트 기준) @param {string} text CSS 글
 * @returns {string[]} 오류 글(원본 파일:줄로 시작) — 없으면 빈 배열
 */
export function cssErrors(file, text) {
  const src = mask(text),
    errors = [],
    { rules, nested } = rulesOf(src, mask(text, true));
  const at = (i) => `${file}:${src.slice(0, i).split("\n").length}`;
  nested.forEach((n) => errors.push(`${at(n.at)}: 규칙 안에 규칙을 넣지 않아요(CSS 중첩 — 사파리 16.5 미만은 몰라요): ${n.sel}`));
  // 어느 묶음에도 들지 않은 규칙에 평범한 선언이 있는 "선택자|속성" — @media 안에만 있는 선언은 그 조건 밖의 화면에서 물러날 줄이 못 됨
  const plain = new Set();
  rules.forEach((r) => r.top && r.decls.forEach((d) => !hasMix(d) && plain.add(r.sel + "|" + d.prop)));
  for (const r of rules) {
    const seen = [];
    for (const d of r.decls) {
      const here = at(r.at + d.at);
      if (d.prop === "inset") errors.push(`${here}: inset 약칭은 오래된 아이폰(iOS 14.5 미만)이 몰라 자리를 못 잡아요 — top·right·bottom·left로 적어 주세요`);
      if (d.prop === "backdrop-filter" && !seen.includes("-webkit-backdrop-filter"))
        errors.push(`${here}: backdrop-filter 앞에 -webkit-backdrop-filter를 같이 적어 주세요 — iOS 18 미만은 접두사가 붙은 것만 알아 흐림 효과가 없어요`);
      if (hasMix(d) && !r.mix)
        errors.push(
          `${here}: color-mix()는 @supports (color:color-mix(in srgb, red, blue)) { … } 안에만 적어요 — var()가 든 선언은 오래된 아이폰(iOS 16.2 미만)이 ` +
            `버리지 못해, 앞에 평범한 선언이 있어도 ${d.prop}이(가) 통째로 사라져요`
        );
      else if (hasMix(d) && !plain.has(r.sel + "|" + d.prop))
        errors.push(
          `${here}: 이 @supports 밖에(다른 묶음 안도 아닌 맨 바깥에) 같은 선택자(${r.sel})의 평범한 ${d.prop} 선언을 적어 주세요 — 오래된 아이폰은 이 블록을 건너뛰어요`
        );
      seen.push(d.prop);
    }
  }
  return errors;
}
