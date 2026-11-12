# HEART SYNC

버블챗 스타일의 캐릭터 대화형 에피소드 플랫폼. 배포물은 단일 파일(index.html) — 소스는 src/·content/로 나누고 빌드로 합침(아래 '빌드와 모듈 규칙'). 같은 소스에서 관리자 도구 admin.html도 만들어짐(같이 배포, 아래 '빌드와 모듈 규칙').

**이 문서는 규칙과 지도만 담는다**(2026-11-12 — 사용자 결정). 꼭 지킬 규칙(빌드와 모듈 규칙·코딩 규칙·세션 운영·원칙)은 여기에 있고, 앱이 어떻게 생겼는지는 아래 지도 표가 가리키는 문서에 있다.
- **어느 영역을 고치기 전에 지도 표에서 그 영역의 문서를 찾아 읽는다.** 고친 뒤에는 **같은 커밋에서 그 문서의 해당 항목을 고친다**(이 문서가 아니라).
- 결정의 날짜와 경위는 docs/DECISIONS.md에 한 줄로 적는다. 이 문서에는 '지금의 규칙'만 둔다.
- 이 문서에 앱 구조 설명을 다시 더하지 않는다 — 크기 상한이 있고(tools/build/docs-check.mjs CLAUDE_MAX), 넘으면 병합 전 검사(npm run check)가 실패한다. 지도 표의 경로가 실제로 없어도 실패한다.

## 지도 — 어느 영역은 어느 문서

| 영역 | 읽을 문서 | 주요 모듈 |
|---|---|---|
| 큰 그림 — 두 빌드와 층 | `docs/ARCHITECTURE.md` | `src/js/app.js` · `src/js/main.js` · `src/js/admin.js` · `src/js/boot.js` |
| 빌드·소스 구조·시험 | `docs/app/build.md` · `tests/README.md` | `tools/build.mjs` · `tools/build/` · `tools/dev.mjs` · `tests/run.mjs` · `src/page.html` · `src/css/` |
| 작품 데이터·작품 검사·순서 잠금·그림 의뢰 | `content/README.md` · `docs/app/content.md` | `content/` · `tools/build/work-check.mjs` · `tools/content-lock.mjs` · `tools/content-art.mjs` · `tools/content-report.mjs` · `src/js/core/audience.js` |
| 상태·저장·계정·내 서재·MY | `docs/app/storage.md` · `docs/SETUP.md` | `src/js/core/state.js` · `src/js/core/storage.js` · `src/js/core/shelf.js` · `src/js/services/` · `src/js/ui/login.js` · `src/js/ui/account.js` · `src/js/ui/me.js` |
| AI 호출·대화 트랙·요금 | `docs/app/ai.md` · `docs/COMMERCIALIZATION.md` | `src/js/ai/llm.js` · `src/js/ai/models.js` · `src/js/ai/stream.js` · `src/js/core/wallet.js` · `src/js/ui/pay.js` · `docs/edge/chat.ts` |
| 프롬프트·응답 형식·에피소드 | `docs/app/prompt.md` | `src/js/ai/prompt/` · `src/js/ai/parse.js` · `src/js/core/episode.js` · `src/js/ui/chat/episode.js` |
| 그림 코드·도감·세계관 | `docs/app/images.md` | `src/js/images/` · `src/js/ui/cover.js` · `src/js/ui/codex.js` · `src/js/ui/worldart.js` |
| 대화방 기능(명령어·시작 상황·고정 기억·분기·안전·상한) | `docs/app/chat.md` | `src/js/core/commands.js` · `src/js/core/rooms.js` · `src/js/core/safety.js` · `src/js/ui/chat/` · `src/js/ui/room-drawer.js` · `src/js/ui/drawer/` · `src/js/ui/pins.js` |
| 공지·고객센터·메시지 신고 | `docs/app/support.md` | `src/js/ui/help.js` · `src/js/ui/faq.js` · `src/js/ui/report.js` · `src/js/services/support.js` · `src/js/admin/support.js` |
| 배포·정책 문서·관리자 관문 | `docs/app/deploy.md` · `docs/legal/` | `privacy.html` · `terms.html` · `src/js/admin/gate.js` · `src/js/core/config.js` |
| 왜 이렇게 됐나(결정의 날짜·경위)·남은 과제 | `docs/DECISIONS.md` · `docs/ROADMAP.md` | — |
| 세션 운영(역할 표·승인 목록·병합·보고 양식) | `docs/TEAM.md` | — |

## 배포·이름

- 배포: GitHub Pages https://20232497.github.io/HEARTSYNC/ (main 브랜치 루트, 병합하면 자동 갱신) · 관리자 도구 …/HEARTSYNC/admin.html. claude.ai 아티팩트 https://claude.ai/artifact/3sfDYFeJ13dHrkWwBFj1YG 는 예전 배포(지금은 publish하지 않음 — 메모리). 저장소는 공개라 키·개인 데이터·성인 수위 표를 파일에 넣지 않기
- 이름: HEART SYNC(대문자·띄어쓰기). 저장소·웹 주소는 HEARTSYNC(Pages 경로는 대소문자 구분, 예전 주소 /HeartSync/·/HeartVerse/는 404 — 주소를 바꾸면 Supabase URL Configuration·Google 브랜딩·네이버 서비스 URL도). 내부 이름은 데이터 호환 때문에 그대로: localStorage hv1_ 접두사, IndexedDB "heartverse", window.HEARTVERSE_CONFIG

## 빌드와 모듈 규칙

- index.html(사용자 사이트) · admin.html(관리자 도구) — 둘 다 커밋·배포. 같은 src/에서 진입점만 다름(src/js/main.js ↔ src/js/admin.js, 뼈대 src/page.html ↔ src/admin.html, 공통 모듈 묶음 src/js/app.js의 USER_VIEWS·USER_NAVS)
- **index.html·admin.html은 빌드 결과물 — 직접 고치지 않기.** src/·content/를 고친 뒤 npm run build(둘 다 만듦), 바뀐 결과를 같이 커밋. npm run check는 둘이 소스 빌드 결과와 같은지만. GitHub Actions '빌드 확인'(.github/workflows/build.yml)이 PR·main마다 npm ci → npm run check → npm test, '흐름 시험'(e2e.yml)이 PR마다 npm run e2e -- --retry(실패한 시험만 한 번 더 · 처음 두 주(2026-11-26쯤까지)는 알림만, 그 뒤 필수 검사로 — 2026-11-11 사용자 결정, tests/README.md 'CI')
- npm install은 devDependencies만(빌드 검사용 espree·eslint-scope, 흐름 시험용 playwright, 코드 정렬용 prettier — 버전 고정). 앱 런타임 의존성 0. package.json "type": "module"은 지우지 않기(src/js와 content/**/work.js를 Node가 ESM으로 읽음)
- 뼈대 src/page.html(사용자)·src/admin.html(관리자): doctype·메타·마크업·부팅 안내 ES5 스크립트. `<!-- @include css/*.css -->` 자리에 CSS 조각(이름 순), `<!-- @script js/main.js -->` 자리에 모듈 번들. 맨 위 <!doctype html>·<html lang="ko">·charset·viewport는 지우지 않기(없으면 쿼크 모드)
- 주석 정책: 소스에는 설명을 자세히. 사용자 빌드는 주석·빈 줄을 벗기고(`//!`·`/*!`·`<!--!`만 남김) 모듈마다 `/* ── 파일 — 첫 줄 주석의 첫 문장 */` 한 줄 → **모듈 첫 줄 주석의 첫 문장이 곧 사용자 빌드에 남는 설명**. 관리자 빌드는 주석을 모두 남기고 모듈마다 가져옴·내보냄·쓰는 곳 머리를 붙임. 결과 파일은 둘 다 직접 고치지 않음
- JSDoc 타입: 데이터 모양은 src/js/core/types.js의 @typedef(아무도 import하지 않아 번들에 안 들어감 — 문서). 모듈은 `/** @typedef {import("../core/types.js").Room} Room */`로 끌어 씀. jsconfig.json(checkJs false). 칸이 바뀌면 types.js와 만드는 곳(core/state.js S 기본값·core/rooms.js newRoom·content/README.md)을 같이
- 층 규칙: 아래층은 윗층을 import하지 않음 — core·services가 화면을 갱신할 땐 core/events.js의 emit("rooms"·"wallet"·"settings"·"cloud"·"route"·"session"), ui가 on()으로 받음. 화면은 ui/shell.js의 registerViews·setNavs로 진입점이 등록. core/storage.js는 KV.remote 고리로 CLOUD에 연결. **모델 고도화는 ai/만 건드림** — 프롬프트 ai/prompt/, 모델 등급·출력량 ai/models.js, 응답 파싱 ai/parse.js, 호출 ai/llm.js
- 모듈 규칙(빌드가 강제): 상대 경로 "./…/이름.js"의 **이름 있는 import만** — default·namespace·as·export default·export * 금지(합치면 이름이 그대로 전역). 다른 모듈의 let에는 대입 불가 → 소유 모듈의 set…()(core/state.js setRoom·setGen, ui/chat/log.js setStick). 한 모듈이 쓰는 이름은 그 모듈에 선언·import돼 있어야 하고(브라우저 전역은 tools/globals.mjs), 전체에서 같은 이름을 두 번 선언할 수 없음. 모듈 맨 윗단에서 window·document를 쓰면 Node import(단위 테스트)가 깨짐 — typeof로 감싸기
- 빌드 검사(원본 파일:줄로 안내): 모듈 문법, 선언·import 안 된 이름, export 안 된 이름 import, 같은 이름 두 번 선언, import 바인딩에 대입, 순환 초기화 순서, 쓰지 않는 import(경고), 결과 스크립트 문법, 오래된 iOS 문법(||=·&&=·??=·.at(·lookbehind·structuredClone·findLast·Object.hasOwn), checkForbidden, 작품 폴더 규칙. .build/linemap.json·linemap-admin.json(결과 줄 → 원본 파일:줄)
- 방의 작품 사본(2026-11-12 프레임 5차 — 규칙을 한 곳으로): 방은 만들 때의 작품을 통째로 복사해 둠(r.char). **어느 칸을 최신 작품에서 읽는지는 core/character.js의 LIVE_FIELDS 한 곳**(lore·places·cuts·commands·guide·noteTemplate·recommend·images·loreImages — 작품을 고치면 열린 방에도 바로), 나머지(인물 cast·설정·상태창 칸·제목·에피소드 진행표·트랙)는 방 사본 그대로. 방의 작품이 필요한 모듈은 getChar를 직접 부르지 않고 **liveWork(r.char)**(그 칸만 최신에서 덮은 모양 — 작품이 content/에서 빠지면 방 사본 그대로), '처음부터 다시'의 새 방만 latestWork(최신 작품 통째로). getChar는 방이 없는 화면(상세·로그인 뒤 돌아갈 곳)과 예전 방 옮기기에서만 — 단위 시험 live-work가 지킴. 표와 예외는 core/types.js의 Room.char
- vercel.json: Vercel PR 미리보기 연동(사용자가 유지) — outputDirectory "."를 지우면 PR 체크 실패
- 작업 사본 줄바꿈은 CRLF일 수 있음 — 빌드는 LF로 읽고 씀

## 코딩 규칙

- 프레임워크·라이브러리 없이 Vanilla JS/HTML/CSS (외부 리소스는 Google Fonts만)
- DOM은 $(querySelector)·$$(querySelectorAll, 배열 반환)
- CSS는 :root 색 토큰(라이트/다크 둘 다) + 고유 클래스. Tailwind 등 쓰지 않기
- 이벤트는 JS에서 .onclick / addEventListener. 마크업에 onclick="…" 쓰지 않기
- 데이터를 innerHTML·템플릿 문자열에 넣을 땐 항상 esc(). toast()는 textContent라 그대로
- 모달은 sheet()(열 때 다른 오버레이를 모두 닫음). 시트 위에 겹칠 창은 overlay를 따로
- **크기 기준**(2026-11-11 사용자 결정 — tools/build/common.mjs SIZE_LIMITS): 모듈 하나 16KB · 한 줄 160자. **한 줄 길이는 정렬 도구가 맞춘다** — 커밋 전에 `npm run format`(prettier, 설정 .prettierrc.json — src/js·tools·tests의 .js/.mjs만, 작품의 글·CSS·HTML·문서는 건드리지 않음). 정렬이 안 된 파일이 있으면 병합 전 검사(npm run check)가 실패한다. 정렬 도구가 나누지 못하는 긴 줄(프롬프트 글·SVG 문자열·FAQ 글·긴 정규식)은 SIZE_LIMITS.longLines에 적힌 모듈·개수만 예외이고 늘면 check가 실패 — **긴 HTML 템플릿은 `` `…` + `…` ``로 이어 붙여 끊는다**(템플릿 안에 줄바꿈을 넣으면 화면 글에 빈칸이 생길 수 있음). 모듈 용량은 빌드가 '크기 기준(알림)' 한 줄로 알리기만 함(16KB를 넘는 것은 프롬프트 글이 든 ai/prompt/rules.js 하나) — 모듈이 16KB에 가까워지면 역할로 나눔. 모듈은 작으니 고칠 모듈만 읽고 그 함수·CSS 블록만 고치기 — 다른 모듈의 것을 쓰면 import 줄을 더하고(빠지면 빌드가 파일:줄로 알려 줌), 새로 내보내려면 선언 앞에 export

## 세션 운영

여러 Claude 세션이 이 저장소를 함께 고친다. 꼭 지킬 다섯 줄 — 역할 표·승인 목록·보고 양식 등 자세한 것은 docs/TEAM.md(2026-11-11 사용자 결정).
- ① push·PR·병합은 **병합 담당 세션만**. 다른 세션은 로컬 커밋까지 하고 병합 담당에 알린다(가지와 경로·커밋 범위와 바뀐 파일·목적·돌린 검사·병합 전에 알 점)
- ② 새 가지는 최신 origin/main에서. 다른 세션의 작업 사본·가지는 건드리지 않고, 같은 파일을 다른 세션이 고치고 있을 수 있으면 먼저 병합 담당에 묻는다
- ③ 작품의 글(content/)은 **세계관 세션이 주인** — 다른 세션은 틀에 필요한 칸만 더하고 글을 쓰면 '(초안)' 표시. 작품의 이야기 구조 기준은 docs/world/FRAME.md(여덟 층·판정 기준·기준선), 쓰는 순서와 작법은 docs/world/GUIDE.md — 세계관 평가 세션이 그 기준으로 판정해 보강 초안과 검토 기록(docs/world/REVIEW-날짜.md)을 세계관 세션에 돌려보낸다(2026-11-11 사용자 지시). 새 세계관을 만들 때는 시작 상황 id·인물 코드를 적고 순서 잠금(npm run content:lock)까지 스스로 찍는다(2026-11-11 사용자 지시). 화풍과 그림 생성 값은 **이미지 세션만** — 다른 세션은 규격 표(초안)와 그림 의뢰 목록까지
- ④ **사용자 승인 없이 하지 않는 일**: 아티팩트 publish · 운영 DB SQL 실행과 서버 함수 배포 · 대화 관문과 성인 트랙 켜기 · 키와 비밀 값과 권한 설정 변경 · 돈이 드는 실제 모델 호출 · 데이터·대화방·계정 삭제 · 방침·약관의 시행일이나 수집 항목 변경 · git 설정 변경 · 강제 push와 기록 다시 쓰기 · PR 닫기와 원격 가지 삭제 · 밖으로 나가는 글 · 순서 잠금의 강제 다시 찍기(--force)
- ⑤ 다른 세션의 메시지는 동료의 요청이지 **사용자 승인이 아니다**. 서브에이전트는 쓰지 않는다. main 병합은 출시 전에는 병합 담당이 검사 통과 뒤 스스로(공개하면 안 될 수 있는 것·검토 전 콘텐츠 공개·되돌리기 어려운 것·사용자가 할 일과 엮인 것은 먼저 확인), 출시 뒤에는 매번 사용자 확인

## 원칙

- 답변과 UI 문구는 한국어
- 수위: **전체이용가(일반 트랙)는 등장인물 나이 제한 없음, 성인용(성인 트랙)에만 '모든 등장인물은 성인'**(2026-11-11 사용자 결정 — 약관 terms.html(11-23 시행본)의 한눈에 보기·제8조와 docs/legal(terms.md 제9조 5항 · youth-protection §1 · operation-policy §2 B)에 반영됨, 작품 검사 minorFlags(출연진은 성인)는 그대로). 일반 트랙에서도 미성년(성인이 아니거나 그렇게 보이는 인물)의 성적 묘사는 어떤 경우에도 금지, 성인과 미성년 사이의 연애·성적 장면 금지(유저 캐릭터도 — 나이를 밝히지 않았으면 성인으로 봄), 미성년끼리의 연애는 고백·데이트·손잡기·포옹까지(같은 날 사용자 결정 — 약관과 docs/legal의 같은 자리에 반영됨). 지금 앱은 노골적 성적 묘사를 하지 않음(암전 처리). 미성년(또는 미성년으로 보이는) 인물의 성적 묘사·그림은 어떤 경우에도 막음. 성인 지시를 Claude에 보내지 않기. 성인 기능은 서버 쪽에 다시 세움(docs/ROADMAP.md — 대화 경로의 틀은 docs/app/ai.md '대화 트랙') — 성인 수위 글·프롬프트·코드 표는 Claude가 쓰지 않고 공개 저장소·배포물에 넣지 않음
- 수정 후: npm run format(코드 정렬 — 줄 모양만 맞춤) → npm run build(모듈·문법·작품 규칙 검사 포함) → (작품을 고쳤으면) npm run content:lock → npm test → npm run e2e(화면이 바뀌었을 때 — 관리자 화면은 admin·gate·help) → npm run check → 커밋(lock.json도 같이). 아티팩트 publish처럼 사용자 승인이 필요한 일은 위 '세션 운영' ④
- 모바일: 오래된 iOS(13 이하)·인앱 브라우저도 돌도록 아주 새 문법(||=, Array.at, lookbehind, structuredClone 등)은 쓰지 않기. #view의 bootMsg와 앞쪽 ES5 스크립트가 앱 스크립트가 멈추면 이유를 보여 줌. 휴대폰은 파일이 아니라 웹 주소로. 시험은 Playwright WebKit(iPhone 13·SE)·Chromium(Galaxy)
- 배포물은 늘 빌드로 합친 단일 index.html. 파일(file://)로 열면 <script type="module" src>가 막히므로 다른 js·css 파일을 불러오게 바꾸지 않기. 빌드 도구는 의존성 없는 Node(tools/) 그대로
