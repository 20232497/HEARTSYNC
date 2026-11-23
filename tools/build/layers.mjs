// 층 방향 검사: 아래층 모듈이 윗층 모듈을 import하지 않는지 모듈의 자리(폴더)로 본다(CLAUDE.md '층 규칙' — 전에는 문서의 약속일 뿐 빌드가 보지 않았음).
// 층(아래 → 위): core → content → services·images·ai → ui → admin → 진입점(src/js 바로 아래의 app.js·main.js·admin.js·boot.js).
// 같은 층끼리와 윗층 → 아래층은 자유. 사용자 빌드에는 admin/ 모듈이 들어가지 않아야 한다.

/** src/js 아래 첫 폴더 이름 → 층 번호. 표에 없는 폴더(대소문자가 다른 이름도)와 src/js 밖의 파일은 오류 — 새 폴더를 만들면 여기에 층을 적는다 */
export const LAYERS = { core: 0, content: 1, services: 2, images: 2, ai: 2, ui: 3, admin: 4 };
const ENTRY = "진입점",
  TOP = 5;
/**
 * 알려진 예외(아래층 파일 → 윗층 파일). 늘리지 않는 것이 원칙이고, 늘릴 때는 docs/app/build.md의 '층 방향 검사'에 이유를 같이 적는다.
 * - core/rooms.js·core/wallet.js → ai/models.js: 새 방의 기본 모델·턴 값이 모델 표(MODELS·LEN)에서 나옴. 표를 core로 내리면 '모델 고도화는 ai/만 건드림'이 깨져 그대로 둠
 * - core/character.js → content/index.js: 작품 찾기(getChar)가 빌드가 모은 작품 목록(ORIGINALS)을 읽음
 */
export const LAYER_EXCEPTIONS = {
  "core/rooms.js": ["ai/models.js"],
  "core/wallet.js": ["ai/models.js"],
  "core/character.js": ["content/index.js"]
};
/* 자리(at)는 소스 루트(src/js) 기준 경로 — "core/rooms.js"·"main.js". 루트 밖이면 "../…"로 시작해 표에 없는 폴더가 됨 */
const dirOf = (p) => (p.indexOf("/") < 0 ? ENTRY : p.slice(0, p.indexOf("/")));
const known = (p) => dirOf(p) === ENTRY || Object.keys(LAYERS).includes(dirOf(p));
const layerOf = (p) => (dirOf(p) === ENTRY ? TOP : LAYERS[dirOf(p)]);
/**
 * @param {{ rel: string, at: string, imports: { at: string, line: number }[] }[]} mods 번들에 든 모듈 — rel은 오류 글에 쓸 경로(저장소 루트 기준),
 *   at은 소스 루트(진입점의 폴더) 기준 경로(번들러가 실제 경로로 계산해 넘김 — 경로 글에서 "src/js/"를 찾아 자르지 않음)
 * @param {{ admin?: boolean }} [opt] admin이 아니면(사용자 빌드) admin/ 모듈이 들어 있는 것도 오류
 * @returns {string[]} 오류 글(원본 파일:줄로 시작) — 없으면 빈 배열
 */
export function layerErrors(mods, opt = {}) {
  const errors = [];
  for (const m of mods) {
    if (!known(m.at)) {
      errors.push(
        `${m.rel}: 층 표에 없는 자리예요 — 모듈은 src/js의 ${Object.keys(LAYERS).join("·")} 폴더나 바로 아래에 두고, ` +
          `새 폴더를 만들면 tools/build/layers.mjs의 LAYERS에 층을 적어 주세요(폴더 이름은 대소문자까지 같아야 해요)`
      );
      continue;
    }
    if (!opt.admin && dirOf(m.at) === "admin")
      errors.push(`${m.rel}: 사용자 빌드에 관리자 모듈(admin/)이 들어갔어요 — 관리자 화면은 진입점 src/js/admin.js에서만 불러요`);
    for (const imp of m.imports) {
      // 표에 없는 대상은 그 모듈의 줄에서 알림
      if (!known(imp.at) || layerOf(imp.at) <= layerOf(m.at) || (LAYER_EXCEPTIONS[m.at] || []).includes(imp.at)) continue;
      errors.push(
        `${m.rel}:${imp.line}: 아래층(${dirOf(m.at)})이 윗층(${dirOf(imp.at)})의 ${imp.at}를 import해요 — 화면을 갱신하려면 core/events.js의 emit을, ` +
          `윗층의 값이 필요하면 그 값을 넘겨받거나 아래층으로 옮기세요(층 순서: core → content → services·images·ai → ui → admin → 진입점)`
      );
    }
  }
  return errors;
}
