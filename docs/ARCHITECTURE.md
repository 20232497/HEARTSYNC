# HEART SYNC 아키텍처 — 두 빌드와 층 규칙

2026-11-08에 지금 개발에 필요한 부분만 남기고 정리했다(그림 생성·이미지 스튜디오·움짤·코드 표·성인 모드·API 키 금고·커뮤니티·휴대폰 인증 화면을 걷어 냄). 정리 전 코드와 그때까지의 점검 기록(2026-11-04 A단계 점검, 그림 흐름, 관리자 그림 생성 권한 등)은 git 태그 `archive/before-reset-2026-11-08`에 있다.

## 1. 한눈에

```
                 src/js (ES 모듈) + src/css + content/
                              │  npm run build (tools/build.mjs — 모듈 수·크기를 출력)
            ┌─────────────────┴──────────────────┐
   index.html  사용자 사이트(배포)          admin.html  관리자 도구(커밋·배포, /admin.html)
   main.js → app.js(사용자 모듈)            admin.js → app.js + admin/gate·support
   주석·빈 줄 없음, 모듈마다 한 줄 설명      주석 전부 + 모듈 머리(가져옴·내보냄·쓰는 곳)
   메뉴: 홈·대화·스토어·MY                   메뉴: 같음(+ 고객센터 관리, 웹 주소에서는 비밀번호 관문)
```

- 두 빌드는 **같은 저장소**(이 브라우저의 localStorage·IndexedDB, 로그인하면 Supabase 계정)를 쓴다.
- 관리자 도구 = 사용자 사이트 + `admin/gate.js`(웹 주소에서 비밀번호 관문, MY의 '관리자 잠그기') + `admin/support.js`(공지 쓰기·받은 문의 답변). 쓰기 권한 자체는 서버(Supabase RLS의 `is_admin()`)가 정한다.
- 빌드 검사 `checkForbidden`(tools/build.mjs): 두 결과 모두에 `openrouter.ai`·`runware.ai` 주소가 있으면 실패(브라우저는 Anthropic 말고 다른 AI·그림 서비스를 부르지 않음), `index.html`에 관리자 모듈 머리(`/* ── src/js/admin/`)가 있으면 실패.

## 2. 층과 규칙

```
core      config(잎) · constants · util · events · storage · state · shelf(내 서재 — 찜·최근 본·수집 기록) · target · cast · audience · wallet · character · safety · rooms · settings · migrate · commands(순수)  (types.js는 문서만 — 번들에 안 들어감)
content   index.js — 빌드가 만든 generated.js(ORIGINALS · HOME_ROWS)
services  supabase · cloud · sync · load · images · support
images    codes(그림 태그 읽기 — 순수) · situations(감정 칸 0~14 이름·낱말 점수 — 순수) · pick(인물·칸별 그림 찾기)
ai        models · llm · parse · prompt/{lore,rules,input,memory}
ui        icons · sheet · ext · shell · cover · home · detail · codex · chat/{render,log,cmdlist,view,generate,suggest} · pay · pins(고정 기억) · report(메시지 신고) · model-sheet · room-tools · room-drawer · worldart(보기) · chats · store · login · account · me · help · faq
admin     gate · support   (관리자 빌드만)
boot.js → app.js(USER_VIEWS · USER_NAVS) → main.js | admin.js
```

규칙(빌드가 강제하는 것은 ★):
- ★ 상대 경로의 이름 있는 import만, 다른 모듈의 `let`은 그 모듈의 `set…()`으로, 전체에서 같은 이름 두 번 선언 금지, 맨 윗단에서 뒤 모듈의 const 사용 금지(순환 의존).
- **아래층은 윗층을 import하지 않는다.** core·services가 화면을 갱신해야 하면 `core/events.js`의 `emit("rooms"|"wallet"|"settings"|"cloud"|"route"|"session")`를 부르고, ui가 `on()`으로 받는다(shell: rooms·wallet·route, account: cloud — settings는 services/cloud가 받아 계정에 올림, session은 지금 받는 곳 없음). `core/storage.js`는 `KV.remote` 고리로 CLOUD에 연결한다.
- **셸은 화면을 모른다.** `ui/shell.js`는 `registerViews({ home: viewHome, c: viewDetail, … })`·`setNavs([...])`로 등록된 것만 라우팅한다. 진입점(main.js·admin.js)이 `app.js`의 USER_VIEWS·USER_NAVS를 등록한다.
- **관리자 기능은 EXT 고리에 꽂는다.** `ui/ext.js`의 `EXT = { me: [], help: [] }` — `me(v)`는 MY의 `#meExt` 자리(관문의 잠그기 버튼, 답변 대기 문의 수), `help(tab, box, list)`는 공지 메뉴(`#notice`, 공지 쓰기 — 관리자 계정이면 바로 관리 화면)와 고객센터 탭(받은 문의). 사용자 화면 모듈은 자리만 두고 `runExt(...)`를 부른다. 사용자 빌드에는 꽂는 모듈이 없어 비어 있다.
- 설정 이전은 `core/migrate.js` 하나(`boot()`가 부름). 예전 그림·성인 설정 칸은 지우지 않고 그대로 둔다(쓰지 않을 뿐, 데이터 손실 없음).
- `core/target.js`의 `isAdmin()`은 문구·배지 같은 작은 차이에만 쓴다(기능 분기는 EXT·화면 등록으로).

## 3. 그림을 싣는 길

```
앱 밖에서 그림 만들기(남성향 일상 화풍은 archive/style-mdaily/의 프롬프트)
   └─▶ content/<aud>/[줄/]<id>/images/<인물코드><0~14>.webp(HSY3) · MP<n>.webp · EV<n>.webp · cover.* · lore-<n>.*
         npm run build (scanImages)
           └─▶ ORIGINALS[].images · img · loreImages  (content/… 상대 경로)
                 imagesOf · coverHTML · loreImg가 그대로 <img src>로 그림
```

- 그림 하나 = 코드 한 토큰(`images/codes.js`): 인물 코드(영문 대문자 1~4자, `cast[].code`) 뒤에 감정 칸 번호 0~14(`core/constants.js`의 SIT) — `HSY3`. 본문 태그는 `[[HSY3]]`, 그림 파일은 `HSY3.webp`. 예약 시리즈 `MP<n>`(장소, 작품 `places`)·`EV<n>`(컷씬, `cuts`). 그림이 없으면 인물은 1 기본 → 0 프로필 순으로 찾고, 그것도 없으면 글자 카드(`ui/cover.js` artHTML). 예전 대화의 `[[img:ks:3,404,501]]`은 읽을 수 있고(sitOf — 처음 나오는 0~14 번호), 방을 열 때 `core/rooms.js` migrateRoom이 새 코드로 바꾼다.
- 코드 해석의 단일 출처는 `images/codes.js`의 `codebook(작품)`이다 — 프롬프트(`ai/prompt/rules.js`)·렌더러(`ui/cover.js` tagInfo)·갤러리·빌드 검사(`tools/build.mjs` APP_RULES)·도감(`ui/codex.js`)이 같은 사전을 읽는다. 작품은 데이터(`cast`·`places`·`cuts`·`commands`)만 적는다. 비공개(스포일러) 플래그(`cast[].hidden` 감정 번호 배열, `places[]`·`cuts[]`의 `hidden` 참거짓)도 `codebook` 항목의 `hidden`(번호 배열) 하나로 해석한다 — 도감·상세·장소 목록이 그 번호를 가리고, 대화에서 한 번 본 그림은 그 뒤로 도감·상세·장소 목록에서도 보인다(본 기록은 내 서재의 수집 기록 — `core/shelf.js`의 `S.shelf.seen`, 적는 곳은 `ui/room-tools.js`의 `collectSeen`). 명령어도 두 층이다: 앱 명령어(`core/commands.js` APP_COMMANDS — 화면형은 드로어를 열고, 연출형은 AI에 공통 연출 지시)와 작품 명령어(`commands` — AI 연출 지시). 도감 카드·도움말·입력창 `!` 목록(`ui/chat/cmdlist.js`)은 `allCommands(작품)` 한 목록을 같이 쓴다.
- 참조 모양(`services/images.js`의 `validRef`): `kv:img…` · `data:image/…` · `content/…/images/x.webp|png|jpg`. content/ 경로는 index.html 기준 상대 경로라 GitHub Pages·file:// 모두 같은 폴더 구조면 보인다.
- 이용자가 올리는 그림은 페르소나 사진뿐이다(`IMG.put` → IndexedDB, 로그인했으면 계정에도 `img…` 행으로).

## 4. 주석 정책

| | 소스 `src/` | 사용자 빌드 `index.html` | 관리자 빌드 `admin.html` |
|---|---|---|---|
| JS | 자세히(모듈 첫 줄 = 책임, 함수 위 = 왜) | 모두 벗김, `//!`·`/*!`만 남김. 모듈마다 `/* ── 파일 — 첫 줄 설명의 첫 문장 */` | 모두 남김 + 모듈 머리(가져옴·내보냄·쓰는 곳) |
| CSS | 조각 머리 `/* ── 이름 */` | 모두 벗김(`/*!`만) | 모두 남김 |
| HTML | 뼈대 설명 | `<!--!` 빌드 안내만 | 모두 남김 |
| 빈 줄 | 자유 | 지움 | 그대로 |

그래서 **모듈 첫 줄 주석의 첫 문장**이 사용자 빌드에 남는 유일한 설명이다 — 짧고 정확하게 쓴다. 줄 번호는 `.build/linemap.json`(사용자, 빈 줄을 지워 한 모듈이 여러 구간)·`linemap-admin.json`(관리자)으로 원본에 맞춘다(`npm run dev`가 콘솔에 원본 파일:줄을 찍음).

CSS는 `src/css/`의 12조각(10-base … 72-help)이 두 빌드 공통이고, 관리자 빌드만 `src/css/admin/`의 58-gate·73-support를 더한다.

## 5. 결정과 남은 일

- **작품 만들기(스튜디오)·커뮤니티 공개는 없다.** 작품은 `content/`에 폴더로 더한다(content/README.md).
- **성인 기능은 서버에 다시 세운다.** 브라우저가 사용자 키로 AI를 부르는 동안의 판정은 브라우저 안의 일이라 진짜 관문이 될 수 없다. `docs/edge/verify-adult.ts`(휴대폰 성인 인증 Edge Function)와 Supabase 표 `adult_checks`는 그때 쓰려고 남겨 두었고, 지금 앱은 부르지 않는다(docs/ROADMAP.md). 미성년 보호 규칙(`core/safety.js`의 minorFlags·minorHint)은 그대로 있고, 빌드의 작품 검사도 쓴다.
- **대화 트랙(2026-11-09).** 방의 트랙은 작품 사본 `r.char.track`으로 굳는다(`ai/models.js` `trackOf`). `ai/llm.js`의 `llm(…, { room })`이 일반 트랙은 Anthropic으로, 성인 트랙은 서버 대화 관문(`CFG.chatUrl` → `docs/edge/chat.ts`)으로만 보낸다 — 두 경로는 서로 대신하지 않고, 스트림 해석만 `ai/stream.js`의 `anthropicEvent`·`openaiEvent`로 갈린다. 관문은 로그인 → 성인 인증(`adult_checks`) → 미성년 암시(`core/safety.js` `messagesMinorHint` — 앱과 같은 함수) → 하루 한도(`chat_usage`) → 모델 호출 순서로 판정하고, 모델 이름·키·성인 트랙 머리말은 서버 환경 변수에만 둔다. `content/`의 작품은 일반 트랙만 둘 수 있다(빌드 검사).
- 다음: 작품마다 그림을 만들어 `content/`에 싣기, 실린 그림이 많아지면 `images/` 폴더 크기와 첫 화면 로딩(lazy)을 보기.

## 6. 외부 점검(Gemini 제안, 2026-11-05) 반영 여부

| 제안 | 판단 | 이유 |
|---|---|---|
| 1단계 Vite로 이행, 모듈별 CSS import, 동적 import(lazy) | **보류** | 배포물은 file://·GitHub Pages·claude.ai에서 그대로 도는 **단일 파일**이어야 함(여러 파일·동적 import는 file://에서 CORS로 막힘). 지금 빌드는 두 대상·주석 정책·TDZ·오래된 iOS 문법·작품 폴더 검사를 이미 하고 런타임 의존성 0을 지킴 |
| 2단계 Proxy 반응형 저장소, 데이터 주도 렌더링 | **보류** | S를 Proxy로 바꾸면 모든 모듈에 닿고, 스트리밍 중 수백 번 바뀌는 상태를 자동 재렌더하면 스크롤·포커스 흐름이 깨짐. 층 사이 결합은 §2의 이벤트 버스·EXT 고리로 풀었고, 화면은 명시적 render 함수가 가장 읽기 쉬움 |
| 3단계 content/와 Supabase를 한 데이터 층으로, 캐시 우선 fetch | **보류** | 작품은 큐레이션해 빌드에 싣는 정적 데이터(12작품), Supabase는 사용자별 데이터만. 서버에서 작품을 받으면 file://·오프라인 부팅이 깨짐. 작품이 수십 개를 넘으면 그때 다시 봄 |
| 4단계 낙관적 UI·스켈레톤·타임아웃/재시도 | **부분 적용** | 낙관적 UI와 오류 줄 + 다시 시도는 이미 있었음. 더한 것: **네트워크 시간 제한**(연결·스트림 멈춤·Supabase 요청 — TIMEOUT·timeoutSignal), 끊긴 응답의 본문 보존, 그림 자리 스켈레톤(img-wait/img-miss) |
| 5단계 JSDoc 타입·@typedef 스키마 | **적용** | `src/js/core/types.js`에 데이터 모양 @typedef, core·ai·services의 공개 함수·객체에 @param·@returns·@throws, `jsconfig.json`(checkJs false — 검사가 아니라 편집기·AI용 문서). 사용자 빌드는 주석을 벗기므로 크기 비용 0 |
