/* 노출 정책 — 그림의 노출 수위를 정하는 값을 한 표에 모은다(2026-11-23 사용자 결정: 과한 노출은 막되 목선과 적당한 가슴골은 허용.
   2026-11-26 사용자 결정: 가슴 노출은 낮추되 어깨·팔·민소매·쇄골·다리처럼 적당히 드러나는 살은 막지 않는다).
   조립 코드(assemble.js)는 여기서 고른 정책의 값을 제자리에 끼우기만 한다. 값의 뜻과 눈으로 보는 기준은 ../README.md '노출 정책'.

   고정(어느 트랙에서도 풀지 않음): 성인 표시(ADULT_MARK)와 미성년 네거티브(MINOR_NEG), 그린 뒤 눈으로 하는 성인 외관 확인.
   트랙: 이 저장소에는 일반 트랙(general)의 정책만 있다. 성인 트랙의 값은 여기에 적지 않는다(공개 저장소 — CLAUDE.md '원칙').
         그림을 만드는 쪽은 policyOf(트랙)으로 정책을 고르고, 모르는 트랙이면 던진다.

   일반 트랙이 막는 것: 가슴(가슴골·깊은 목선·크기 과장)·비치는 옷·속옷·벗은 몸·달라붙는 옷·젖은 옷·찢어진 옷. 어깨·팔·쇄골·다리는 막지 않는다 — 옷 설정이 드러내면 드러난다.
   푸는 방식: 작품 태그에 그 옷이 적힌 그림 한 장에서만 그 옷과 부딪치는 네거티브를 뺀다(rules).
   '강조'는 이미지 세션이 인물을 따로 지정(accent)했을 때만 — 표지에는 쓰지 않는다(목록에서 가입 전 방문자가 보는 그림). */

/** 성인 표시 — 긍정 문구에 꼭 있어야 한다 */
export const ADULT_MARK = /\(adult (woman|man):1\.[23]\)/;
/** 미성년 금지 네거티브 — 늘 넣는다 */
export const MINOR_NEG = "child, loli, shota, underage, toddler, aged down, baby face, (young:1.1), (teenager:1.1), chibi";
const MINOR_NEED = ["child", "loli", "shota", "underage", "toddler", "aged down", "teenager", "chibi", "(big head:1.2)"];

const GENERAL = {
  /* 늘 넣는 노출 네거티브 — 자리마다 한 줄(assemble.js가 끼우는 자리 이름). 같은 낱말이 여러 줄에 겹쳐 있는 것은 그려서 정한 값이라 그대로 둔다 */
  neg: {
    // 노출·달라붙는 옷(공통)
    base:
      "nsfw, nude, (cleavage:1.3), revealing clothes, (no pants:1.4), (bottomless:1.3), (naked sweater:1.2), (sweater dress:1.2), (plunging neckline:1.2), huge breasts, " +
      "(side slit:1.3), pelvic curtain, (skin tight:1.2), (impossible clothes:1.2), (covered navel:1.2), cameltoe, (bodysuit:1.1)",
    skin:
      ", (cleavage:1.5), (see-through:1.4), (see-through clothes:1.3), (open clothes:1.3), (open shirt:1.2), (unbuttoned:1.2), (downblouse:1.4), (lingerie:1.3), (bra:1.3)",
    // 여성 — 굴곡 과장과 뚫린 옷. 어깨·팔·쇄골은 막지 않는다(2026-11-26)
    f: ", (large breasts:1.5), (huge breasts:1.5), (curvy:1.3), (wide hips:1.2), (clothing cutout:1.5)",
    // 남성 — 풀어 헤친 셔츠. sleeveless는 노출이 아니라 옷을 지키는 값: 조끼 차림이 소매 없는 옷으로 그려짐(장태산) — 민소매를 적은 옷은 rules가 푼다
    m: ", (open shirt:1.4), (unbuttoned shirt:1.3), (bare chest:1.5), (pectorals:1.3), (sleeveless:1.5)",
    neck: ", (plunging neckline:1.3)", // 여성의 목선
    // 물가 장소(폭포·강·비)는 흰 옷을 젖어 비치게 그림(십절곡 낙혼폭 — 2026-11-14) → 젖은 옷·비치는 옷을 막음
    wet: ", (wet clothes:1.4), (see-through:1.5), (wet shirt:1.4), (wet:1.1)",
    // 누더기 옷(patched ragged clothes)은 가슴께가 찢어져 살이 보임(화린 — 2026-11-14) → 기운 옷으로만
    torn: ", (torn clothes:1.4), (clothing cutout:1.4), (torn shirt:1.4)",
  },
  /* 옷 태그 → 그 그림에서만 빼는 네거티브(가중치를 뺀 이름). who가 있으면 그 성별만.
     풀지 않는 것: 깊게 파인 목선(plunging neckline)·옷 안이 내려다보이는 각도(downblouse)·비치는 옷·속옷·크기 과장(huge breasts)·풀어 헤친 셔츠(open shirt)·맨가슴.
     조끼(vest)만 적힌 옷은 풀지 않는다 — 밑에 입은 옷(tank top)을 적어야 한다. 옷 이름만으로는 목선을 열지 않는다(evening dress처럼 목선이 정해지지 않은 말) */
  rules: [
    { name: "민소매", who: "m", when: /\btank top\b|\bsleeveless\b/, lift: ["sleeveless"] },
    // 목선 '열림'(여성): 재단 안에서 보이는 가슴골까지 — 깊은 목선과 크기 과장은 계속 막힌다
    { name: "목선", who: "f", when: /\bv-neck\b|\bscoop neck\b|\bsquare neck(line)?\b|\bsweetheart neckline\b|\boff[- ]shoulder\b|\bstrapless\b/, lift: ["cleavage"] },
    { name: "풀어 둔 깃", who: "m", when: /\bopen collar\b|\bpartially unbuttoned\b/, lift: ["unbuttoned shirt", "unbuttoned"] },
  ],
  /* 목선 '강조'(여성) — 이미지 세션이 지정한 인물만("인물코드:이름"). 목선을 열고 '가녀리게'의 가슴 크기 억제 하나(large breasts)를 뺀다. 표지에는 쓰지 않는다.
     2026-11-23에 그려 보니 같은 시드에서 '열림'과 거의 같은 그림이 나왔다(이 값만으로는 강조가 되지 않음). 긍정 cleavage 태그는 넣지 않기로 한 상태라 지정 없이 둔다 */
  accent: [],
  accentLift: ["cleavage", "large breasts"],
  /* 그리기 전 검사가 네거티브에서 찾는 것 — [찾을 글, 그 이름]. 이름이 그 그림에서 풀린 것이면 건너뛴다 */
  need: [
    ["nsfw", "nsfw"],
    ["nude", "nude"],
    ["revealing clothes", "revealing clothes"],
    ["(plunging neckline:1.2)", "plunging neckline"],
    ["(downblouse:1.4)", "downblouse"],
    ["(see-through:1.4)", "see-through"],
    ["(lingerie:1.3)", "lingerie"],
    ["huge breasts", "huge breasts"],
    ["(cleavage:1.5)", "cleavage"],
  ],
};
const POLICIES = { general: GENERAL };

/** 트랙의 노출 정책 — 모르는 트랙이면 던진다(값 없이 그리지 않게) */
export function policyOf(track = "general") {
  const p = POLICIES[track];
  if (!p) throw new Error(`노출 정책이 없는 트랙이에요: ${track} — 이 저장소에는 일반 트랙(general)의 정책만 있어요`);
  return p;
}
/** 정책이 풀어 줄 수 있는 네거티브 이름 전부 */
export const liftable = (P) => [...new Set([...P.rules.flatMap((r) => r.lift), ...P.accentLift])];
/** 이 인물의 그림에서 뺄 네거티브 이름들 — 작품 태그의 옷과 강조 지정에서. o.accent === false면 강조를 쓰지 않는다(표지) */
export function liftOf(c, fem, P, o = {}) {
  const lift = new Set(),
    g = fem ? "f" : "m";
  for (const r of P.rules) if ((!r.who || r.who === g) && r.when.test(c.tags || "")) r.lift.forEach((t) => lift.add(t));
  if (fem && o.accent !== false && P.accent.includes(c.code + ":" + c.name)) P.accentLift.forEach((t) => lift.add(t));
  return [...lift];
}
const bare = (t) => t.trim().replace(/^\((.+):[\d.]+\)$/, "$1");
/** 네거티브에서 그 이름의 낱말을 뺀다(가중치와 상관없이, 여러 줄에 겹친 것 모두). 뺄 것이 없으면 글자 그대로 */
export const relax = (neg, lift) => (lift.length ? neg.split(", ").filter((t) => !lift.includes(bare(t))).join(", ") : neg);

/** 어느 트랙에서도 꼭 있어야 하는 것 — 성인·혼자 표시와 미성년 네거티브. 빠졌으면 던진다 */
export function assertAdult(j) {
  if (!ADULT_MARK.test(j.pos) || !/\bsolo\b/.test(j.pos)) throw new Error("성인·혼자 표시가 없어요");
  for (const t of MINOR_NEED) if (!j.neg.includes(t)) throw new Error("네거티브에 없어요: " + t);
  return j;
}
/** 그리기 전에 부를 것 — 고정 검사(assertAdult)에 더해, 고른 트랙의 노출 네거티브가 빠지지 않았는지.
    빠져도 되는 것은 그 그림이 풀었다고 적은 것(j.lift)뿐이고, 그것도 정책이 풀어 줄 수 있는 이름이어야 한다 */
export function assertSafe(j, track) {
  assertAdult(j);
  const P = policyOf(track),
    lift = j.lift || [],
    ok = liftable(P);
  for (const t of lift) if (!ok.includes(t)) throw new Error("정책이 풀어 주지 않는 네거티브를 뺐어요: " + t);
  for (const [text, name] of P.need) if (!lift.includes(name) && !j.neg.includes(text)) throw new Error("네거티브에 없어요: " + text);
  return j;
}
