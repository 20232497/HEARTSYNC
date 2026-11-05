# tests/ — 시험

| 명령 | 무엇 | 걸리는 시간 |
|---|---|---|
| `npm test` | **단위 테스트** `tests/unit/*.test.mjs` — Node가 `src/js/` 모듈을 바로 import(브라우저 없음). 응답 파싱·키워드북·미성년 인물 막기·그림 조합 코드·그림 생성 관리자 관문·쓰지 않는 Runware 키 정리·빌드 검사(`checkNoGen`) | 1초 |
| `npm run e2e` | **흐름 시험** `tests/e2e/*.mjs` — Playwright(WebKit iPhone 13·SE, Chromium Galaxy)로 빌드된 `index.html`(사용자 사이트)과 `admin.html`(관리자 도구 — `admin`·`images`·`styles`)을 정적 서버에 띄워 실제 화면 흐름을 돈다. 처음 한 번 `npx playwright install webkit chromium` | 7~10분 |
| `npm run e2e chatflow` | 흐름 시험 하나만(이름 여러 개 가능) | |
| `npm run serve` | 저장소 루트를 정적 서버로만 띄움(휴대폰에서 같은 Wi-Fi로 열어 볼 때 등) | |

`npm run e2e`는 `npm run build`가 만든 `index.html`·`admin.html`을 시험하므로 **빌드 뒤에** 돌린다(`run.mjs`의 `PAGE`가 시험마다 어느 빌드를 여는지 정함). 스크린샷은 `tests/.shots/`(git에 안 들어감). 관리자 페이지는 `content/codes.admin.json`(git에 없음)을 읽는데, 그 파일이 없는 새 사본(worktree 등)에서는 시험 서버(`serve.mjs`)가 `content/codes.admin.example.json`을 대신 준다(2026-11-06, 전에는 404가 콘솔 오류로 잡혀 관리자 시험 셋이 실패했음).

## 흐름 시험(e2e)
- 모든 스크립트는 Supabase·카카오 로그인을 `page.route`로 흉내 내므로 실제 서버·계정은 건드리지 않고, 키·이메일은 모두 시험용 가짜 값이다. 계정을 흉내 내지 않는 시험도 `_offline.mjs`의 `noSupabase()`로 Supabase 요청을 빈 목록으로 받는다(로그인하지 않아도 MY가 공지사항을 확인하므로 — 2026-11-05).
- 스크립트는 결과를 JSON으로 찍기만 하고 늘 exit 0으로 끝난다. `tests/run.mjs`가 결과의 `fail`·`error`·`errors`·`errs`·`pageerror` 칸이 비었는지로 판정한다. 새 시험을 더할 땐 같은 모양으로 쓰고(`console.log(JSON.stringify(res))`, 오류는 위 칸 이름에), `run.mjs`의 `SUITES`에 한 줄 설명을 더한다.
- 인자: `node tests/e2e/<이름>.mjs <URL> [스크린샷 폴더]` (`mobile.mjs`는 URL 여러 개 + `SHOT_DIR` 환경변수).

| 스크립트 | 보는 것 |
|---|---|
| `social.mjs` | 카카오·네이버·Google 버튼, 안 켠 공급자 안내, 이메일 없는 소셜 가입, PC 게스트 그림 → 계정, 휴대폰 합치기, 키 잠금 암호(정하기·틀림·잊음·stale), 취소 오류 |
| `vault.mjs` | API 키 금고: PC 가입 → 계정엔 암호문만 → 휴대폰 로그인으로 받음 → 메일 링크 기기는 잠김 → 비밀번호 입력·재설정 → 키 저장 끄기 → 로그아웃. 쓰지 않는 Runware 키 지우기(일반 이용자·잠긴 기기·관리자 계정·로그인 전·관리자 관문을 지난 브라우저) |
| `cloud2.mjs` | 계정 저장 올리기·받기, 서버 표 제약(`kv_no_plain_keys`·`kv_vault_sealed`) |
| `help.mjs` | 공지·고객센터(사용자 사이트 + 관리자 도구, 가짜 Supabase는 docs/supabase.sql의 RLS·열 권한·트리거와 같은 규칙): MY의 고객센터·약관 칸과 '새 공지' → 공지 메뉴(공개만·고정 먼저·본문 주소 링크, 예전 주소 `#help-notice`는 `#notice`로) → FAQ 찾기 → 둘러보기면 로그인 안내 → 문의 남기기(보내는 칸은 열 권한 안의 것만, 앱 정보는 기본 꺼짐)·하루 5건·지우기 → 사용자 빌드에 관리자 함수 없음 → 관리자 도구: 로그인 안 함·관리자 아닌 계정은 읽기만 + 로그인 안내(SQL·UID 없음), 관리자는 공지 메뉴를 누르면 바로 비공개 공지·새 공지·고치기·지우기, 받은 문의 답변(답변 완료로)·MY 답변 대기 수 → 사용자에게 답이 보임 → iPhone 13 가로 넘침 0, 탭바 사용자 5칸·관리자 8칸(320px에서도 글자가 한 줄) |
| `idv.mjs` | 휴대폰 성인 인증(함수는 진짜 코드 `docs/edge/verify-adult.ts`, 가짜 SDK·PortOne API·표는 `_idv-fake.mjs`): 꺼져 있으면 자기 확인 그대로·요청 없음 → 켜면 자기 확인 불인정·둘러보기는 로그인 안내 → PC 인증(SDK는 누를 때만, 수위 옵션이 열림, 표에 개인정보 없음) → 다시 열기·꾸민 기기 캐시를 서버 값이 덮음·로그아웃·다른 계정 → 미성년·취소·미완료·SDK 실패·하루 10번·함수 없음 → 만료 → live는 시험 결과 불인정 → iPhone 13 리디렉션·주소 정리·꾸민 주소 → 파일로 열기 → 관리자 도구 |
| `audience.mjs` | 관심있는 대화 첫 시작 창 → 여성향 고르기 → 홈 필터·대표 작품·가로 줄 → 설정 → 신작 대화방 |
| `firstvisit.mjs` | 첫 방문(Desktop Chrome·iPhone 13, 가짜 Supabase·소셜 왕복): 작품 주소(`#c-<id>`)로 들어와 `#login-c-<id>` → 둘러보기·이메일 로그인·소셜 로그인(취소·안 켠 공급자)·인증 메일과 재설정 링크(새 탭) 뒤 그 작품이 열리고 로그인 화면이 방문 기록에 안 남음, 새로 고침해도 갈 곳이 남음, 없는 작품은 홈, 작품이 아닌 주소·꾸민 값·1시간 지난 `hv1_back`은 안 씀, 계정에만 있는 내 작품은 받아 온 뒤 열림, 메뉴로 나가면 갈 곳이 사라짐, 관심있는 대화 시트는 작품을 가리지 않고 홈에 처음 갈 때(계정에 고른 값이 있으면 묻지 않음), `hv1_back`은 계정에 안 올라감. 이 스크립트는 값을 직접 비교해 `errors`에 쌓음 |
| `chatflow.mjs` | 대화방 스트리밍(가짜 llm), 자동 스크롤 끔/켬, ✦ AI 추천 수동, 출력 설정 카드, 설정 페이지 |
| `minor.mjs` | 미성년 관문(iPhone 13·Galaxy, OpenRouter·Claude 호출은 가짜): 대화 앞부분·설정 칸의 나이가 성인 경로를 끄고 시스템 규칙·요청 경로가 같이 바뀜, Claude 거절을 우회하지 않음, 출력 설정의 보호 모드 안내, 다시 쓰기 지침. 표현 표는 단위 테스트 `safety.test.mjs` |
| `mobile.mjs` | 휴대폰 셸: 표준 모드 문서, bootMsg 사라짐, 탭바, 가로 넘침 0 |
| `file.mjs` | 파일(file://)로 열어도 부팅·홈(전체·여성향·남성향 대표 작품 4개씩, 가로 줄)·상세가 그려짐 — 단일 파일 배포(BYOK 모드)가 깨지지 않았는지 |
| `gate.mjs` | 가짜 https 호스트(`heartsync.test`)에서 ① 관리자 비밀번호 관문: 틀리면 거부·기억하면 바로 부팅·사용자 사이트에는 없음 ② 그림 생성 관문(다른 흐름 시험은 127.0.0.1이라 건너뜀): 로그인 안 함·비관리자는 연속 그리기가 첫 칸에서 멈추고, 생성 창·자동 생성·움짤 생성도 태그 번역과 Runware 요청이 나가지 않음(자동 생성 안내는 한 번만), 움짤 결과 묻기는 로그인이 풀려도 됨, `admins`에 넣으면 새로 고침 없이 그려짐 |
| `admin.mjs` | 관리자 도구(admin.html, Desktop Chrome·iPhone 13): 메뉴 여덟(홈·대화·공지·작품·이미지·만들기·스토어·MY)과 화면이 그려지는지, 작품 화면의 목록·전부 저장·코드 표 내보내기, 스튜디오의 관심있는 대화 칸, 상세의 일러스트 관리·이미지 관리·작품 폴더에 저장 버튼, 드로어의 이미지 버튼, 시트(코드 편집기·세계관 일러스트·추천 칸·생성 창·페르소나)와 페르소나 시트의 'AI로 만들기', MY의 이미지 생성 설정·크리에이터 프로필, 이미지 스튜디오(인물 칩·코드 목록 묶음·의상·장소를 고르면 조합 키·프롬프트 보기·찾기·묶음 접기, 성인 확인 뒤 관리자 전용 코드 수 = 런타임에 읽은 `EXTRA_CODES`, 가짜 내 칸 둘로 선택 삭제(체크 칸·묶음 전체 선택·두 번 눌러 삭제 → 그 코드의 그림도 지워짐)·조합 모두 빼기, 가짜 움짤로 갤러리의 움짤 표시·⟳·움짤 만들기 창 — 실제 생성은 누르지 않음), 비밀번호 관문이 로컬 주소에서는 서지 않음. 이어서 **사용자 빌드**(index.html)를 열어 메뉴가 다섯(홈·대화·공지·스토어·MY)이고 그 자리들이 비어 있으며 관리자 함수(`viewStudio`·`viewImages`·`openImages`·`codeGroups`·`genImageSheet`·`viewWorks`·`runwareImage`·`gate`·`makeMotion`·`motionSheet`)가 없고 `EXTRA_CODES`가 비었는지 |
| `images.mjs` | (admin.html) 그림 조합 코드(Desktop Chrome·iPhone 13): 가짜 llm이 `[[img:코드:3,404,501]]`을 쓰면 figure에 조합 키가 붙고, 다음 턴에 감정만 쓰면 의상·장소가 이어지고(시스템 프롬프트의 '지금 이어지는 의상·장소'), 400으로 되돌리고, 태그를 빠뜨린 인물은 지문의 장소 낱말(소파 → 503)로 자동 태그. 자동 생성을 켜고 가짜 `runwareImage`(캔버스 PNG)로 없는 조합만 한 번 만들어 그 자리가 그림으로 바뀌는지, 같은 조합은 다시 만들지 않는지, 이미지 스튜디오(그 인물의 갤러리에 자동 생성한 조합 그림이 있고 누르면 그 조합이 골라짐·파일 이름 → 조합 키 `nameKey`)·드로어 갤러리, 움짤(가짜 영상 본문 kv:를 켜면 대화 그림이 사진 위에 blob 주소 영상을 겹치고, ⟳로 끄면 사진만, 사진을 바꾸면 움짤과 본문이 지워짐) |
| `styles.mjs` | (admin.html) 기본 화풍(Desktop Chrome·iPhone 13): 설정 기본값 '자동'이 남성향·여성향·전체(인물 성별)·표지에 맞는 내장 화풍(`sys:mdaily` …)을 고르는지, ZIP 파일 이름을 세트로 묶고 이름으로 내장 화풍을 맞추는지(`groupStyleFiles`·`matchBuiltin`), 같은 이름의 세트가 덮으면 그 문구·모델을 쓰고 '내장으로 되돌리기'·'덮어쓸 기본 화풍' 바꾸기·세트 삭제로 내장에 돌아오는지, 설정의 기본 화풍 카드 5개, 생성 창이 ctx에 맞는 화풍 이름을 보여 주는지 |
| `views.mjs` | 스모크(사용자 사이트, Desktop Chrome·iPhone 13): 홈·대화·공지·스토어·MY, 오리지널 작품 전부의 상세, 각 작품의 첫 시작 상황으로 연 대화방(오프닝 본문·상태창·입력창), 드로어(기본·출력 설정)·모델·페르소나·관심있는 대화·PLUS·확인 시트가 오류 없이 열림. 모듈 분리 뒤 어느 화면에서든 ReferenceError가 나면 여기서 잡힘 |

## 단위 테스트(unit)
`node:test`. 모듈이 `window`·`document`를 맨 윗단에서 건드리지 않아야 Node에서 import된다 — 순수 모듈(`core/constants`·`core/cast`·`core/safety`·`ai/parse`·`ai/prompt/lore`·`images/codes`·`images/style-fit`)이 그렇다. 새 테스트는 `tests/unit/<모듈>.test.mjs`. 맨 윗단에서 `window`·`localStorage`를 읽는 모듈(`images/gen-guard` → `services/supabase`)은 `gen-guard.test.mjs`처럼 import 전에 그 전역만 가짜로 깔아 둔다.
