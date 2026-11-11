# tests/ — 시험

| 명령 | 무엇 | 걸리는 시간 |
|---|---|---|
| `npm test` | **단위 테스트** `tests/unit/*.test.mjs` — Node가 `src/js/` 모듈을 바로 import(브라우저 없음). 응답 파싱·키워드북·미성년 인물 막기·그림 태그 읽기와 감정 칸 낱말 점수·네트워크 시간 제한·서버에 남겨 둔 성인 인증 함수 | 1초 |
| `npm run e2e` | **흐름 시험** `tests/e2e/*.mjs` — Playwright(WebKit iPhone 13·SE, Chromium Galaxy)로 빌드된 `index.html`(사용자 사이트)과 `admin.html`(관리자 도구 — `admin`)을 정적 서버에 띄워 실제 화면 흐름을 돈다. 처음 한 번 `npx playwright install webkit chromium` | 4~5분 |
| `npm run e2e chatflow` | 흐름 시험 하나만(이름 여러 개 가능). `-- --retry`를 붙이면 실패한 시험만 한 번 더 돌림(CI가 씀) | |
| `npm run serve` | 저장소 루트를 정적 서버로만 띄움(휴대폰에서 같은 Wi-Fi로 열어 볼 때 등) | |

`page.evaluate: Execution context was destroyed, most likely because of a navigation`이 Chromium에서 드물게 나면 먼저 실제 이동인지 본다 — Playwright는 평가의 프로토콜 오류를 모두 이 문구로 바꾸는데, 이동 없이 `Promise was collected`인 경우가 있다(평가가 돌려준 약속이 끝나는 순간 GC가 돎. `DEBUG=pw:protocol`로 진짜 오류가 보임). 그때는 다시 돌리면 되고, 자주 나면 그 `evaluate(async …)`를 시작·기다리기·읽기로 나눈다.

`npm run e2e`는 `npm run build`가 만든 `index.html`·`admin.html`을 시험하므로 **빌드 뒤에** 돌린다(`run.mjs`의 `PAGE`가 시험마다 어느 빌드를 여는지 정함). 스크린샷은 `tests/.shots/`(git에 안 들어감).

## CI(GitHub Actions)에서 도는 것
| 워크플로 | 언제 | 무엇 |
|---|---|---|
| **빌드 확인**(`.github/workflows/build.yml`) | PR마다 · main에 들어갈 때 | `npm ci` → `npm run check`(모듈·작품 검사, `index.html`·`admin.html`이 소스와 같은지, 순서 잠금이 최신인지, **기준 가지의 잠금과 맞는지** — `LOCK_BASE`로 PR이 들어갈 가지를 알려 줌) → `npm test` |
| **흐름 시험**(`.github/workflows/e2e.yml`) | PR마다 · 직접 실행 | `npm ci` → 브라우저 두 종과 한글 글꼴 설치 → `npm run e2e -- --retry`(실패한 시험만 한 번 더 — 두 번 다 실패해야 실패, 다시 돌려 통과한 시험은 경고 줄로 남음). 실패하면 `tests/.shots`의 스크린샷을 `e2e-shots`로 올려 둠(7일). 시간대는 `Asia/Seoul` |

- **흐름 시험은 처음 두 주(2026-11-26쯤까지) '알림만'** 이에요(2026-11-11 사용자 결정) — 필수 검사가 아니라 실패해도 병합을 막지 않고, 병합 담당이 실패 내용을 보고 판단해요. 헛실패가 드물다는 것이 확인되면 필수 검사로 바꿔요. 지정은 GitHub 저장소 설정이라 **사용자가 직접** 해요: 저장소 → Settings → Branches(또는 Rules → Rulesets) → `main` 규칙 → *Require status checks to pass* → 검사 이름 `e2e`(흐름 시험)와 `check`(빌드 확인)를 고름.
- 흐름 시험의 실행 환경은 `ubuntu-24.04`로 고정해 뒀어요 — `ubuntu-latest`(26.04)에는 지금 Playwright(1.56.1)가 WebKit을 깔지 못해요. Playwright를 올릴 때 워크플로의 `runs-on`도 그 판이 지원하는 ubuntu로 같이 올려요. 빌드 확인은 node와 git만 써서 `ubuntu-latest` 그대로예요.
- 이 PC와 CI의 차이: CI는 리눅스(ubuntu)·`HS_ADMIN_PW` 없음(`gate`의 맞는 비밀번호 입력은 건너뜀). CI에서만 깨지는 시험이 나오면 시험을 느슨하게 고치지 말고 CI 환경 값을 맞춰요(시간대·글꼴 — 워크플로의 `env`).

## 흐름 시험(e2e)
- 모든 스크립트는 Supabase·카카오 로그인을 `page.route`로 흉내 내므로 실제 서버·계정은 건드리지 않고, 키·이메일은 모두 시험용 가짜 값이다. 계정을 흉내 내지 않는 시험도 `_offline.mjs`의 `noSupabase()`로 Supabase 요청을 빈 목록으로 받는다(로그인하지 않아도 MY가 공지사항을 확인하므로).
- 스크립트는 결과를 JSON으로 찍기만 하고 늘 exit 0으로 끝난다. `tests/run.mjs`가 결과의 `fail`·`error`·`errors`·`errs`·`pageerror` 칸이 비었는지로 판정한다. 새 시험을 더할 땐 같은 모양으로 쓰고(`console.log(JSON.stringify(res))`, 오류는 위 칸 이름에), `run.mjs`의 `SUITES`에 한 줄 설명을 더한다.
- 인자: `node tests/e2e/<이름>.mjs <URL> [스크린샷 폴더]` (`mobile.mjs`는 URL 여러 개 + `SHOT_DIR` 환경변수).

| 스크립트 | 보는 것 |
|---|---|
| `gate.mjs` | 관리자 비밀번호 관문: 가짜 https 호스트(`heartsync.test` — 저장소 파일을 그대로 줌, 실제 네트워크 없음)에서 관문이 서고 레일이 숨음, 틀린 비밀번호는 거부, 기억(`hv1_admin`)이 있으면 바로 부팅, 사용자 사이트에는 관문이 없음. 맞는 비밀번호 입력은 환경변수 `HS_ADMIN_PW`가 있을 때만(저장소에 비밀번호를 적지 않으려고) |
| `admin.mjs` | 관리자 도구(admin.html, Desktop Chrome·iPhone 13): 메뉴 다섯(홈·대화·공지·스토어·MY)과 공지·고객센터 화면·작품 상세가 그려지는지, 관문·고객센터 관리 함수가 있고 로컬 주소에서는 관문이 서지 않는지. 이어서 **사용자 빌드**(index.html)를 열어 메뉴가 같고 관리자 함수(`gate`·`gateNeeded`·`lockAdmin`·`noticeSheet`·`loadInbox`)가 없으며 MY의 `#meExt` 자리가 비었는지 |
| `social.mjs` | 로그인 화면의 카카오·네이버·Google 버튼(아이폰 SE 폭), 안 켠 공급자 안내, PC 게스트 대화·페르소나 사진 → 이메일 없는 카카오 가입(계정이 비어 전부 올라감, 올리지 않는 칸은 없음), 휴대폰 게스트 대화 → 로그인 → 합치기, PC가 받으면 휴대폰 페르소나 사진도 보임, API 키는 어디에도 안 올라감, 취소 오류 안내 |
| `cloud2.mjs` | 계정 저장: PC 게스트 → 이메일 가입(이 기기 데이터를 올림) → 휴대폰 로그인으로 대화·그림 받음 → 휴대폰 새 대화를 PC가 받음 → 내 서재(찜)의 날짜 관문: 날짜 전에는 계정에 안 올라가고, 날짜 뒤에는 두 기기의 찜이 합쳐지며 찜을 푼 것도 전해짐(시험이 `SHELF.syncFrom`을 바꿔 양쪽을 봄) → API 키는 계정에 안 올라감(서버 표 제약 `kv_no_plain_keys`) → 휴대폰 로그아웃(기기 지우기) → 갤럭시 게스트 대화 합치기 → 계정 삭제 |
| `help.mjs` | 공지·고객센터(사용자 사이트 + 관리자 도구, 가짜 Supabase는 docs/supabase.sql의 RLS·열 권한·트리거와 같은 규칙): MY의 고객센터·약관 칸과 '새 공지' → 공지 메뉴(공개만·고정 먼저·본문 주소 링크, 예전 주소 `#help-notice`는 `#notice`로) → FAQ 찾기 → 둘러보기면 로그인 안내 → 문의 남기기(보내는 칸은 열 권한 안의 것만, 앱 정보는 기본 꺼짐)·하루 5건·지우기 → 사용자 빌드에 관리자 함수 없음 → 관리자 도구: 로그인 안 함·관리자 아닌 계정은 읽기만 + 로그인 안내, 관리자는 공지 메뉴를 누르면 바로 관리 화면 — 비공개 공지·새 공지·고치기·지우기·받은 문의 답변(답변 완료로)·MY 답변 대기 수 → 사용자에게 답이 보임 → iPhone 13 가로 넘침 0 → 메시지 신고(대화방 AI 말풍선의 신고 → 사유 일곱 가지 가운데 하나(고르지 않으면 보내지 않음)·덧붙일 말·메시지 앞부분 300자(끄면 안 감) → 예전 서버 제약이면 기타 분류로 접수·SQL 실행 뒤에는 신고 분류 → 내 문의·관리자의 받은 문의에 신고 배지, 우선 사유(미성년자 관련 등)는 관리자 목록 맨 위에 따로·MY에 건수 → 로그인 안 했으면 로그인·메일 안내) |
| `audience.mjs` | 관심있는 대화 첫 시작 창 → 여성향 고르기 → 홈 필터·대표 작품·가로 줄 → 설정 → 신작 대화방 |
| `firstvisit.mjs` | 첫 방문(Desktop Chrome·iPhone 13, 가짜 Supabase·소셜 왕복): 작품 주소(`#c-<id>`)로 들어와 `#login-c-<id>` → 둘러보기·이메일 로그인·소셜 로그인(취소·안 켠 공급자)·인증 메일과 재설정 링크(새 탭) 뒤 그 작품이 열리고 로그인 화면이 방문 기록에 안 남음, 새로 고침해도 갈 곳이 남음, 없는 작품은 홈, 공지 주소(`#notice` → `#login-notice`)도 둘러보기·로그인 뒤 그리로, 작품·공지가 아닌 주소·꾸민 값·1시간 지난 `hv1_back`은 안 씀, 메뉴로 나가면 갈 곳이 사라짐, 관심있는 대화 시트는 작품·공지를 가리지 않고 홈에 처음 갈 때(계정에 고른 값이 있으면 묻지 않음), `hv1_back`은 계정에 안 올라감. 이 스크립트는 값을 직접 비교해 `errors`에 쌓음 |
| (도구) `tools/prompt-bench.mjs` | 시험 목록에는 없음 — 프롬프트 세 블록의 형식 지키기와 프롬프트 캐싱 적중·절감을 진짜 Anthropic 호출로 잼(`ANTHROPIC_API_KEY` 필요, 돈이 듦). `--dry`는 키 없이 작품별 고정부·변동부 글자 수만 |
| `chatflow.mjs` | 입력창 `!` 명령어 목록(↓·Enter로 채움), 대화방 스트리밍(가짜 llm), 자동 스크롤 끔/켬, 고정 기억(📌 고정 → 방에 한 줄 → 다음 턴 프롬프트의 [고정 기억]), 즉답 명령어(AI 호출 없이 두 메시지·하트와 턴 그대로), 좋아요 토글·분기(방 수 +1·메시지 수 일치·원래 방 그대로·그 메시지까지의 고정 기억만), ✦ AI 추천 수동, 출력 설정 카드, 설정 페이지 |
| `tracks.mjs` | 트랙별 대화 경로(iPhone 13·Galaxy, 관문·Anthropic을 route로 흉내): 성인 트랙 방(`char.track = "adult"`)의 본문·새 추천·장기기억 요약이 모두 서버 대화 관문으로만 가고 Anthropic으로는 한 번도 안 감, 관문 요청 모양(track·tier·system 첫 메시지·로그인 토큰)과 암전 지시가 빠진 프롬프트, 미성년 암시·로그인 없음·관문 주소 없음은 보내지 않고 안내, 관문의 거절(성인 인증·하루 한도) 안내와 무료 턴 환불, 일반 트랙 방은 내 키가 있으면 Anthropic으로 바로, 키가 없으면 관문의 무료 길(Anthropic 모양 스트림·로그인 없으면 안내·서버에 없는 등급과 무료 길이 없는 서버는 키 안내) |
| `mobile.mjs` | 휴대폰 셸: 표준 모드 문서, bootMsg 사라짐, 탭바, 가로 넘침 0 |
| `file.mjs` | 파일(file://)로 열어도 부팅·홈(전체·여성향·남성향 대표 작품 4개씩, 가로 줄)·상세가 그려짐 — 단일 파일 배포(BYOK 모드)가 깨지지 않았는지 |
| `views.mjs` | 스모크(사용자 사이트, Desktop Chrome·iPhone 13): 홈·대화·도감·공지·스토어·MY, 오리지널 작품 전부의 상세, 각 작품의 첫 시작 상황으로 연 대화방(오프닝 본문·상태창·입력창), 드로어(기본·출력 설정)·모델·페르소나·관심있는 대화·PLUS·확인 시트가 오류 없이 열림. 틀 확인(가짜 데이터): 플레이 가이드 칸이 데이터와 맞는지, 비공개(hidden) 칸이 가려지는지, 작품 메타 줄, 권장 모델 배지, 설정 상한(LIMITS)과 입력 칸, 시작 상황 id(작품이 제목을 고치고 순서를 바꿔도 처음부터 다시가 같은 시작 상황으로), 내 서재(상세의 찜 버튼 → 홈의 '찜한 작품' 줄·'최근 본 작품' 줄·같은 줄의 다른 작품·관심있는 대화로 거름). 모듈 분리 뒤 어느 화면에서든 ReferenceError가 나면 여기서 잡힘 |
| `art.mjs` | 그림이 실린 작품의 흐름(Desktop Chrome·iPhone 13 — 저장소에 그림이 0장이라 **가짜 그림으로 틀만**: 작품에 `images`·장소·컷씬·비공개 칸을 주입하고 `content/…/images/*` 요청을 가로채 작은 PNG를 돌려줌): 본문 태그 → `<img>`(그 칸 그림이 없으면 1 기본 그림)·실제로 불러와짐, 갤러리·장소 목록, 도감 카드와 인물 시트 미리보기, 비공개 그림은 대화에서 본 뒤에야 도감에서도 열림(안 본 것은 그대로 잠김), 수집 기록(`S.shelf.seen`)과 '모은 그림 n / m', 인물 시트의 '본 칸 ✓' |
| `episode.mjs` | 에피소드형 작품(iPhone 13·Galaxy, 가짜 llm — 턴 수만 당겨 놓고): 상세의 '에피소드 시작'이 등장인물보다 위·에피소드 안내의 결말 이름(모두 보임), 장 막대, 갈림길 카드(보기 4개 → 누르면 그 말로 보내고 다음 장·프롬프트에 고른 길), 마감 턴에 결말을 정함 → 결말 장면 → 결말 카드(입력창 숨김·모은 결말·ep0/ep1), 외전 시트(갈래 셋 — 기본은 '그 인물과 더 이야기하기'·인물 칸) → 새 자유 방(장 막대 없음·구분 표시·첫 추천·고정부 [외전]과 '있었던 일'), 대화 목록의 결말·외전, 홈 카드의 에피소드·인원(폼 빼고) |
| `inject.mjs` | 주입(XSS) — 화면은 `innerHTML`로 그리고 '`esc()`를 쓴다'는 약속으로 지키므로, 그 약속이 빠진 자리를 잡는다. 자리마다 이름표를 단 악성 글(속성 깨기 `"'>`·`<img onerror>`·`<script>`·`</textarea>`·`<svg onload>`·`javascript:` 링크·따옴표가 든 주소)을 넣고 화면을 돌며 ① 실행되지 않음(`window.__xss`가 안 불림·대화 상자 없음) ② 주입한 글에서 온 요소·`on…` 속성·`javascript:` 주소가 DOM에 없음 ③ 그 글이 **글자 그대로 보임**(자리마다 적어도 한 화면 — 안 보이면 시험이 그 자리에 닿지 못한 것이라 실패). 사용자 사이트(Desktop Chrome·iPhone 13, 화면 55곳): 페르소나, 가짜 작품의 모든 글 칸(제목·소개·가이드·제작자·태그·상태창 칸 이름·인물·장소·컷씬·명령어·키워드북·시작 상황과 첫 답변 추천·에피소드 진행표의 장 제목과 갈림길과 사건과 결말 이름 — 외부 제작자를 받을 때에 대비), 에피소드 방(장 막대·사건 띠·갈림길 카드·결말 카드·외전 고르기 시트·외전 방과 첫 장면 제안 — 화면이 실제로 열렸는지도 봄), 대화방(유저 메시지·AI 본문과 상태창 값과 추천·가짜 응답 스트리밍·즉답 명령어·유저노트·고정 기억·장기기억과 히스토리·오류 줄·신고 인용문·드로어의 모든 화면), 공지·내 문의(가짜 Supabase), 검색어, 주소(`#c-…` 등)와 소셜 로그인 오류 문구. 관리자 도구(Desktop Chrome): 공지 관리와 고치기 시트, 받은 문의·신고(제목·본문·답장 주소·앱 정보), 관리자가 아닌 계정 안내의 이메일. **새 화면이나 데이터 칸을 더하면 이 시험의 '넣는 자리'와 '도는 화면'에도 더한다** |
| `scroll.mjs` | 화면 이동 스크롤(Desktop Chrome·iPhone 13, `#view`): 홈을 내려 작품을 누르면 상세는 맨 위부터, 상단 뒤로·브라우저 뒤로·홈 메뉴로 돌아오면 보던 자리, 앞으로 가면 다시 맨 위, 같은 주소를 다시 그리면(`route()`·`go` 같은 주소·`emit("route")`·`reloadFromCloud()`) 그대로, 메뉴·고객센터 탭·다른 작품으로 옮기면 맨 위, 대화방은 `#view` 맨 위·`#log` 맨 아래. 값을 직접 비교해 `errors`에 쌓음 |

## 단위 테스트(unit)
`node:test`. 모듈이 `window`·`document`를 맨 윗단에서 건드리지 않아야 Node에서 import된다 — 순수 모듈(`core/constants`·`core/cast`·`core/safety`·`core/util`·`ai/parse`·`ai/prompt/lore`·`images/codes`·`images/situations`)이 그렇다. 새 테스트는 `tests/unit/<모듈>.test.mjs`. 맨 윗단에서 `window`·`localStorage`를 읽는 모듈을 시험하려면 import 전에 그 전역만 가짜로 깔아 둔다.

| 파일 | 보는 것 |
|---|---|
| `codes.test.mjs` | 그림 태그 읽기(`images/codes.js` — `sitOf`: 0~14는 그대로, 예전 조합·세 자리 코드는 처음 나오는 0~14 번호, 없으면 1 · `imgTags` · `fallbackSits` 그 칸 → 1 → 0 · `sitName`)와 감정 칸 낱말 점수(`images/situations.js` `sitScores`·`sitHints`) |
| `lore.test.mjs` | 키워드북(`ai/prompt/lore.js` matchLore — 상시·우선순위·제외 낱말·보조 키와 한 턴 예산) |
| `rules.test.mjs` | 프롬프트 세 블록(`ai/prompt/rules.js` rulesParts — 고정부가 턴이 바뀌어도 글자 하나까지 같은지, 이용자가 쓴 글은 변동부에만, 이미 등장한 인물에는 인물 코드만), 시작 상황의 선택 칸(place·suggestions·lead), 프롬프트 캐싱 스위치(`ai/llm.js`) |
| `commands.test.mjs` | 대화방 명령어(`core/commands.js` — 앱·연출·이야기·즉답 구분, 입력창 ! 목록, AI에 보낼 글) |
| `rooms.test.mjs` | 대화방(`core/rooms.js`): 방이 시작 상황을 찾는 순서 `openingIndex`(id 우선 · 제목 대체 · 못 찾으면 첫째), 분기한 방이 id를 가져가는지, 작품의 시작 상황 id가 모양에 맞고 겹치지 않는지 |
| `live-work.test.mjs` | 방의 작품을 지금 읽을 모양으로(`core/character.js` `liveWork`·`latestWork`·`LIVE_FIELDS`): 최신 작품에서 읽는 칸과 방 사본에 굳는 칸, 작품이 `content/`에서 빠지면 방 사본 그대로, '처음부터 다시'는 최신 작품 통째로. **지킴이**: `getChar` 호출과 `ORIGINALS` 사용이 허용한 모듈(방이 없는 화면·예전 방 옮기기)에만 있는지 — 방의 작품을 다른 길로 찾는 모듈이 생기면 실패 |
| `shelf.test.mjs` | 내 서재(`core/shelf.js` — 여러 기기 값을 합치는 mergeShelf, 계정 동기화 날짜 관문 shelfSyncOn과 **개인정보처리방침 시행일이 같은 날인지**, 찜 켜고 끄기·최근 본·수집 기록) |
| `content-lock.test.mjs` | 순서 잠금(`tools/content-lock.mjs`)의 판정 `checkLock`: 맨 뒤에 더하기·이름 고치기·새 시작 상황과 인물은 통과(잠금만 뒤처짐), 중간에 끼우기·지우기·순서 바꾸기·id와 코드 없애기는 어긋남, 잠금 없는 새 작품, 알려진 한계, 강제 다시 찍기의 표 |
| `content-lock-base.test.mjs` | 순서 잠금 — 기준 가지와 견주기(`tools/content-lock.mjs` `checkBase`·`readBaseLocks`, `npm run check`가 부름): 순서를 바꾸고 작업 폴더의 잠금을 다시 찍어도(파일을 지우고 찍거나 손으로 고쳐도) 걸리는지, 잠금 파일이 없어지면 실패·작품이 없어지면 알리기만, 뒤에 더하기·이름 고치기·폴더 옮기기는 통과, 임시 git 저장소에서 '갈라진 자리'의 잠금을 읽는지(그 뒤 기준 가지에 더해진 것은 견주지 않음·못 읽으면 null) |
| `content-check.test.mjs` | 작품 검사 규칙(`tools/build/`의 `work-check`·`episode-check`·`images-scan`·`output-check` — `checkWork`·`checkEpisode`·`scanImages`·`checkForbidden`): 통과하는 가짜 작품 하나를 **한 칸씩만 망가뜨려** 규칙마다 기대한 오류가 나는지(작품 규칙 115줄 — 모듈 모양·필수 칸·출연진 코드와 폼·비공개 칸·장소와 컷씬·본문 그림 태그·명령어·메타·키워드북·시작 상황·트랙·미성년 인물·폴더와 성별, 에피소드 진행표 `checkEpisode` 46줄 — 장·갈림길과 보기·사건·결말과 그 조건, 그림 파일 이름 11줄), 경고로만 알리는 것, 통과해야 하는 모양, 금지 주소와 사용자 빌드의 관리자 모듈 머리. 규칙을 새로 더하면 '규칙 자리 수' 시험이 실패하므로 표에 줄을 더하고 수를 고친다. 폴더 구조 검사(`buildContent`의 줄 폴더·`_row.json`)와 모듈 번들 검사는 아직 시험이 없음 |
| `docs-check.test.mjs` | 문서 지킴이(`tools/build/docs-check.mjs` — `npm run check`가 부름): CLAUDE.md의 크기 상한(`CLAUDE_MAX` 20KB), 지도 표('## 지도')와 영역 문서(docs/app/)의 '이 문서가 다루는 모듈'이 가리키는 경로가 실제로 있는지 — 가짜 문서로 판정을 보고, 지금 저장소의 문서가 통과하는지도 봄(CLAUDE.md가 다시 불어나거나 모듈을 옮기고 문서를 안 고치면 걸림) |
| `build-size.test.mjs` | 빌드의 크기 기준(`tools/build/common.mjs` `SIZE_LIMITS` — 모듈 16KB·한 줄 160자): 번들에 든 모듈마다 용량과 긴 줄 수를 재는지(빌드가 만든 `generated.js`는 빼고), 요약 한 줄 `sizeNote`의 셈. 지금은 알림만이라 '넘으면 실패'는 보지 않음 |
| `content-art.test.mjs` | 그림 의뢰 목록(`tools/content-art.mjs`): 가짜 작품 하나로 줄 수·종류·넣을 경로·우선순위(직접 적힌 그림·배경 장소)·비공개·실림·태그 표시와 합계, 규격 표가 모두 초안이고 README '그림 싣기'와 같은 크기인지·적힌 비율이 크기와 맞는지 |
| `content-report.test.mjs` | 작품 완성도 보고서(`tools/content-report.mjs`)의 셈과 얕은 칸 판정 |
| `parse.test.mjs` | 응답 파싱(`ai/parse.js` — 구분자 변형·끊긴 JSON·다인원 칸) |
| `safety.test.mjs` | 미성년 인물 막기(`core/safety.js` minorFlags·minorHint) |
| `util.test.mjs` | 네트워크 시간 제한(`core/util.js` timeoutSignal·abortCode) |
| `verify-adult.test.mjs` | 서버에 남겨 둔 휴대폰 성인 인증 Edge Function(`docs/edge/verify-adult.ts` — 지금 앱은 부르지 않음). 진짜 함수 코드에 가짜 인증 서버·`adult_checks` 표·PortOne API를 끼움 — 도우미 `_idv-fake.mjs`(시험 목록에는 없음) |
| `chat-gate.test.mjs` | 성인 트랙의 서버 대화 관문 Edge Function(`docs/edge/chat.ts`). 진짜 함수 코드에 가짜 인증 서버·표·모델 서버(`_idv-fake.mjs`)를 끼워: 통과한 요청의 중계(회사 키·서버 설정의 모델·머리말·계정 정보는 안 보냄), 로그인, 성인 인증(없음·미성년·만료·남의 것·시험 채널), 미성년 암시(판정이 없거나 오류면 막음), 요청 모양, 하루 한도, 설정 누락, 모델 서버 오류, 일반 트랙의 무료 길(성인 인증 없이 통과·Anthropic으로만·없는 등급은 need_key·한도는 트랙마다 따로·생각 설정이 앱의 `THINKING`과 같은 값인지 — 본문 몫에 생각 몫을 더한 `max_tokens`와 `output_config.effort`) |
| `stream.test.mjs` | AI 응답 스트림 읽기(`ai/stream.js` — 조각 사이에서 끊긴 줄·한글, Anthropic·OpenAI 호환 조각 해석, 내용 필터는 거절)와 트랙 고르기(`ai/models.js` trackOf) |
| `input.test.mjs` | 한 턴의 요청 묶음(`ai/prompt/input.js` buildInput): 직전 응답 하나에만 상태창을 출력 형식 그대로 붙이는지(앱의 파서가 그대로 읽음), 마지막 입력에 상태창으로 마치라는 다짐이 있는지 |
