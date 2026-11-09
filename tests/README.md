# tests/ — 시험

| 명령 | 무엇 | 걸리는 시간 |
|---|---|---|
| `npm test` | **단위 테스트** `tests/unit/*.test.mjs` — Node가 `src/js/` 모듈을 바로 import(브라우저 없음). 응답 파싱·키워드북·미성년 인물 막기·그림 태그 읽기와 감정 칸 낱말 점수·네트워크 시간 제한·서버에 남겨 둔 성인 인증 함수 | 1초 |
| `npm run e2e` | **흐름 시험** `tests/e2e/*.mjs` — Playwright(WebKit iPhone 13·SE, Chromium Galaxy)로 빌드된 `index.html`(사용자 사이트)과 `admin.html`(관리자 도구 — `admin`)을 정적 서버에 띄워 실제 화면 흐름을 돈다. 처음 한 번 `npx playwright install webkit chromium` | 4~5분 |
| `npm run e2e chatflow` | 흐름 시험 하나만(이름 여러 개 가능) | |
| `npm run serve` | 저장소 루트를 정적 서버로만 띄움(휴대폰에서 같은 Wi-Fi로 열어 볼 때 등) | |

`page.evaluate: Execution context was destroyed, most likely because of a navigation`이 Chromium에서 드물게 나면 먼저 실제 이동인지 본다 — Playwright는 평가의 프로토콜 오류를 모두 이 문구로 바꾸는데, 이동 없이 `Promise was collected`인 경우가 있다(평가가 돌려준 약속이 끝나는 순간 GC가 돎. `DEBUG=pw:protocol`로 진짜 오류가 보임). 그때는 다시 돌리면 되고, 자주 나면 그 `evaluate(async …)`를 시작·기다리기·읽기로 나눈다.

`npm run e2e`는 `npm run build`가 만든 `index.html`·`admin.html`을 시험하므로 **빌드 뒤에** 돌린다(`run.mjs`의 `PAGE`가 시험마다 어느 빌드를 여는지 정함). 스크린샷은 `tests/.shots/`(git에 안 들어감).

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
| `help.mjs` | 공지·고객센터(사용자 사이트 + 관리자 도구, 가짜 Supabase는 docs/supabase.sql의 RLS·열 권한·트리거와 같은 규칙): MY의 고객센터·약관 칸과 '새 공지' → 공지 메뉴(공개만·고정 먼저·본문 주소 링크, 예전 주소 `#help-notice`는 `#notice`로) → FAQ 찾기 → 둘러보기면 로그인 안내 → 문의 남기기(보내는 칸은 열 권한 안의 것만, 앱 정보는 기본 꺼짐)·하루 5건·지우기 → 사용자 빌드에 관리자 함수 없음 → 관리자 도구: 로그인 안 함·관리자 아닌 계정은 읽기만 + 로그인 안내, 관리자는 공지 메뉴를 누르면 바로 관리 화면 — 비공개 공지·새 공지·고치기·지우기·받은 문의 답변(답변 완료로)·MY 답변 대기 수 → 사용자에게 답이 보임 → iPhone 13 가로 넘침 0 → 메시지 신고(대화방 AI 말풍선의 신고 → 사유·덧붙일 말·메시지 앞부분 300자(끄면 안 감) → 예전 서버 제약이면 기타 분류로 접수·SQL 실행 뒤에는 신고 분류 → 내 문의·관리자의 받은 문의에 신고 배지 → 로그인 안 했으면 로그인·메일 안내) |
| `audience.mjs` | 관심있는 대화 첫 시작 창 → 여성향 고르기 → 홈 필터·대표 작품·가로 줄 → 설정 → 신작 대화방 |
| `firstvisit.mjs` | 첫 방문(Desktop Chrome·iPhone 13, 가짜 Supabase·소셜 왕복): 작품 주소(`#c-<id>`)로 들어와 `#login-c-<id>` → 둘러보기·이메일 로그인·소셜 로그인(취소·안 켠 공급자)·인증 메일과 재설정 링크(새 탭) 뒤 그 작품이 열리고 로그인 화면이 방문 기록에 안 남음, 새로 고침해도 갈 곳이 남음, 없는 작품은 홈, 공지 주소(`#notice` → `#login-notice`)도 둘러보기·로그인 뒤 그리로, 작품·공지가 아닌 주소·꾸민 값·1시간 지난 `hv1_back`은 안 씀, 메뉴로 나가면 갈 곳이 사라짐, 관심있는 대화 시트는 작품·공지를 가리지 않고 홈에 처음 갈 때(계정에 고른 값이 있으면 묻지 않음), `hv1_back`은 계정에 안 올라감. 이 스크립트는 값을 직접 비교해 `errors`에 쌓음 |
| (도구) `tools/prompt-bench.mjs` | 시험 목록에는 없음 — 프롬프트 세 블록의 형식 지키기와 프롬프트 캐싱 적중·절감을 진짜 Anthropic 호출로 잼(`ANTHROPIC_API_KEY` 필요, 돈이 듦). `--dry`는 키 없이 작품별 고정부·변동부 글자 수만 |
| `chatflow.mjs` | 입력창 `!` 명령어 목록(↓·Enter로 채움), 대화방 스트리밍(가짜 llm), 자동 스크롤 끔/켬, 고정 기억(📌 고정 → 방에 한 줄 → 다음 턴 프롬프트의 [고정 기억]), 즉답 명령어(AI 호출 없이 두 메시지·하트와 턴 그대로), 좋아요 토글·분기(방 수 +1·메시지 수 일치·원래 방 그대로·그 메시지까지의 고정 기억만), ✦ AI 추천 수동, 출력 설정 카드, 설정 페이지 |
| `tracks.mjs` | 트랙별 대화 경로(iPhone 13·Galaxy, 관문·Anthropic을 route로 흉내): 성인 트랙 방(`char.track = "adult"`)의 본문·새 추천·장기기억 요약이 모두 서버 대화 관문으로만 가고 Anthropic으로는 한 번도 안 감, 관문 요청 모양(track·tier·system 첫 메시지·로그인 토큰)과 암전 지시가 빠진 프롬프트, 미성년 암시·로그인 없음·관문 주소 없음은 보내지 않고 안내, 관문의 거절(성인 인증·하루 한도) 안내와 무료 턴 환불, 일반 트랙 방은 내 키가 있으면 Anthropic으로 바로, 키가 없으면 관문의 무료 길(Anthropic 모양 스트림·로그인 없으면 안내·서버에 없는 등급과 무료 길이 없는 서버는 키 안내) |
| `mobile.mjs` | 휴대폰 셸: 표준 모드 문서, bootMsg 사라짐, 탭바, 가로 넘침 0 |
| `file.mjs` | 파일(file://)로 열어도 부팅·홈(전체·여성향·남성향 대표 작품 4개씩, 가로 줄)·상세가 그려짐 — 단일 파일 배포(BYOK 모드)가 깨지지 않았는지 |
| `views.mjs` | 스모크(사용자 사이트, Desktop Chrome·iPhone 13): 홈·대화·도감·공지·스토어·MY, 오리지널 작품 전부의 상세, 각 작품의 첫 시작 상황으로 연 대화방(오프닝 본문·상태창·입력창), 드로어(기본·출력 설정)·모델·페르소나·관심있는 대화·PLUS·확인 시트가 오류 없이 열림. 틀 확인(가짜 데이터): 플레이 가이드 칸이 데이터와 맞는지, 비공개(hidden) 칸이 가려지는지, 작품 메타 줄, 권장 모델 배지, 설정 상한(LIMITS)과 입력 칸, 내 서재(상세의 찜 버튼 → 홈의 '찜한 작품' 줄·'최근 본 작품' 줄·같은 줄의 다른 작품·관심있는 대화로 거름). 모듈 분리 뒤 어느 화면에서든 ReferenceError가 나면 여기서 잡힘 |
| `art.mjs` | 그림이 실린 작품의 흐름(Desktop Chrome·iPhone 13 — 저장소에 그림이 0장이라 **가짜 그림으로 틀만**: 작품에 `images`·장소·컷씬·비공개 칸을 주입하고 `content/…/images/*` 요청을 가로채 작은 PNG를 돌려줌): 본문 태그 → `<img>`(그 칸 그림이 없으면 1 기본 그림)·실제로 불러와짐, 갤러리·장소 목록, 도감 카드와 인물 시트 미리보기, 비공개 그림은 대화에서 본 뒤에야 도감에서도 열림(안 본 것은 그대로 잠김), 수집 기록(`S.shelf.seen`)과 '모은 그림 n / m', 인물 시트의 '본 칸 ✓' |
| `scroll.mjs` | 화면 이동 스크롤(Desktop Chrome·iPhone 13, `#view`): 홈을 내려 작품을 누르면 상세는 맨 위부터, 상단 뒤로·브라우저 뒤로·홈 메뉴로 돌아오면 보던 자리, 앞으로 가면 다시 맨 위, 같은 주소를 다시 그리면(`route()`·`go` 같은 주소·`emit("route")`·`reloadFromCloud()`) 그대로, 메뉴·고객센터 탭·다른 작품으로 옮기면 맨 위, 대화방은 `#view` 맨 위·`#log` 맨 아래. 값을 직접 비교해 `errors`에 쌓음 |

## 단위 테스트(unit)
`node:test`. 모듈이 `window`·`document`를 맨 윗단에서 건드리지 않아야 Node에서 import된다 — 순수 모듈(`core/constants`·`core/cast`·`core/safety`·`core/util`·`ai/parse`·`ai/prompt/lore`·`images/codes`·`images/situations`)이 그렇다. 새 테스트는 `tests/unit/<모듈>.test.mjs`. 맨 윗단에서 `window`·`localStorage`를 읽는 모듈을 시험하려면 import 전에 그 전역만 가짜로 깔아 둔다.

| 파일 | 보는 것 |
|---|---|
| `codes.test.mjs` | 그림 태그 읽기(`images/codes.js` — `sitOf`: 0~14는 그대로, 예전 조합·세 자리 코드는 처음 나오는 0~14 번호, 없으면 1 · `imgTags` · `fallbackSits` 그 칸 → 1 → 0 · `sitName`)와 감정 칸 낱말 점수(`images/situations.js` `sitScores`·`sitHints`) |
| `lore.test.mjs` | 키워드북(`ai/prompt/lore.js` matchLore — 상시·우선순위·제외 낱말·보조 키와 한 턴 예산) |
| `rules.test.mjs` | 프롬프트 세 블록(`ai/prompt/rules.js` rulesParts — 고정부가 턴이 바뀌어도 글자 하나까지 같은지, 이용자가 쓴 글은 변동부에만, 이미 등장한 인물에는 인물 코드만), 시작 상황의 선택 칸(place·suggestions·lead), 프롬프트 캐싱 스위치(`ai/llm.js`) |
| `commands.test.mjs` | 대화방 명령어(`core/commands.js` — 앱·연출·이야기·즉답 구분, 입력창 ! 목록, AI에 보낼 글) |
| `shelf.test.mjs` | 내 서재(`core/shelf.js` — 여러 기기 값을 합치는 mergeShelf, 계정 동기화 날짜 관문 shelfSyncOn과 **개인정보처리방침 시행일이 같은 날인지**, 찜 켜고 끄기·최근 본·수집 기록) |
| `content-report.test.mjs` | 작품 완성도 보고서(`tools/content-report.mjs`)의 셈과 얕은 칸 판정 |
| `parse.test.mjs` | 응답 파싱(`ai/parse.js` — 구분자 변형·끊긴 JSON·다인원 칸) |
| `safety.test.mjs` | 미성년 인물 막기(`core/safety.js` minorFlags·minorHint) |
| `util.test.mjs` | 네트워크 시간 제한(`core/util.js` timeoutSignal·abortCode) |
| `verify-adult.test.mjs` | 서버에 남겨 둔 휴대폰 성인 인증 Edge Function(`docs/edge/verify-adult.ts` — 지금 앱은 부르지 않음). 진짜 함수 코드에 가짜 인증 서버·`adult_checks` 표·PortOne API를 끼움 — 도우미 `_idv-fake.mjs`(시험 목록에는 없음) |
| `chat-gate.test.mjs` | 성인 트랙의 서버 대화 관문 Edge Function(`docs/edge/chat.ts`). 진짜 함수 코드에 가짜 인증 서버·표·모델 서버(`_idv-fake.mjs`)를 끼워: 통과한 요청의 중계(회사 키·서버 설정의 모델·머리말·계정 정보는 안 보냄), 로그인, 성인 인증(없음·미성년·만료·남의 것·시험 채널), 미성년 암시(판정이 없거나 오류면 막음), 요청 모양, 하루 한도, 설정 누락, 모델 서버 오류, 일반 트랙의 무료 길(성인 인증 없이 통과·Anthropic으로만·없는 등급은 need_key·한도는 트랙마다 따로) |
| `stream.test.mjs` | AI 응답 스트림 읽기(`ai/stream.js` — 조각 사이에서 끊긴 줄·한글, Anthropic·OpenAI 호환 조각 해석, 내용 필터는 거절)와 트랙 고르기(`ai/models.js` trackOf) |
| `input.test.mjs` | 한 턴의 요청 묶음(`ai/prompt/input.js` buildInput): 직전 응답 하나에만 상태창을 출력 형식 그대로 붙이는지(앱의 파서가 그대로 읽음), 마지막 입력에 상태창으로 마치라는 다짐이 있는지 |
