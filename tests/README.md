# tests/ — 시험

| 명령 | 무엇 | 걸리는 시간 |
|---|---|---|
| `npm test` | **단위 테스트** `tests/unit/*.test.mjs` — Node가 `src/js/` 모듈을 바로 import(브라우저 없음). 응답 파싱·키워드북·미성년 인물 막기 | 1초 |
| `npm run e2e` | **흐름 시험** `tests/e2e/*.mjs` — Playwright(WebKit iPhone 13·SE, Chromium Galaxy)로 빌드된 `index.html`을 정적 서버에 띄워 실제 화면 흐름을 돈다. 처음 한 번 `npx playwright install webkit chromium` | 3~5분 |
| `npm run e2e chatflow` | 흐름 시험 하나만(이름 여러 개 가능) | |
| `npm run serve` | 저장소 루트를 정적 서버로만 띄움(휴대폰에서 같은 Wi-Fi로 열어 볼 때 등) | |

`npm run e2e`는 `npm run build`가 만든 `index.html`을 시험하므로 **빌드 뒤에** 돌린다. 스크린샷은 `tests/.shots/`(git에 안 들어감).

## 흐름 시험(e2e)
- 모든 스크립트는 Supabase·카카오 로그인을 `page.route`로 흉내 내므로 실제 서버·계정은 건드리지 않고, 키·이메일은 모두 시험용 가짜 값이다.
- 스크립트는 결과를 JSON으로 찍기만 하고 늘 exit 0으로 끝난다. `tests/run.mjs`가 결과의 `fail`·`error`·`errors`·`errs`·`pageerror` 칸이 비었는지로 판정한다. 새 시험을 더할 땐 같은 모양으로 쓰고(`console.log(JSON.stringify(res))`, 오류는 위 칸 이름에), `run.mjs`의 `SUITES`에 한 줄 설명을 더한다.
- 인자: `node tests/e2e/<이름>.mjs <URL> [스크린샷 폴더]` (`mobile.mjs`는 URL 여러 개 + `SHOT_DIR` 환경변수).

| 스크립트 | 보는 것 |
|---|---|
| `social.mjs` | 카카오·네이버·Google 버튼, 안 켠 공급자 안내, 이메일 없는 소셜 가입, PC 게스트 그림 → 계정, 휴대폰 합치기, 키 잠금 암호(정하기·틀림·잊음·stale), 취소 오류 |
| `vault.mjs` | API 키 금고: PC 가입 → 계정엔 암호문만 → 휴대폰 로그인으로 받음 → 메일 링크 기기는 잠김 → 비밀번호 입력·재설정 → 키 저장 끄기 → 로그아웃 |
| `cloud2.mjs` | 계정 저장 올리기·받기, 서버 표 제약(`kv_no_plain_keys`·`kv_vault_sealed`) |
| `audience.mjs` | 관심있는 대화 첫 시작 창 → 여성향 고르기 → 홈 필터·대표 작품·가로 줄 → 설정 → 신작 대화방 |
| `chatflow.mjs` | 대화방 스트리밍(가짜 llm), 자동 스크롤 끔/켬, ✦ AI 추천 수동, 출력 설정 카드, 설정 페이지 |
| `mobile.mjs` | 휴대폰 셸: 표준 모드 문서, bootMsg 사라짐, 탭바, 가로 넘침 0 |
| `file.mjs` | 파일(file://)로 열어도 부팅·홈(전체·여성향·남성향 대표 작품 4개씩, 가로 줄)·상세가 그려짐 — 단일 파일 배포(BYOK 모드)가 깨지지 않았는지 |
| `views.mjs` | 스모크(Desktop Chrome·iPhone 13): 홈·대화·만들기·스토어·MY, 오리지널 작품 전부의 상세, 각 작품의 첫 시작 상황으로 연 대화방(오프닝 본문·상태창·입력창), 드로어(기본·출력 설정)·모델·이미지 슬롯·세계관 일러스트·페르소나·관심있는 대화·추천 칸·PLUS·확인 시트가 오류 없이 열림. 모듈 분리 뒤 어느 화면에서든 ReferenceError가 나면 여기서 잡힘 |

## 단위 테스트(unit)
`node:test`. 모듈이 `window`·`document`를 맨 윗단에서 건드리지 않아야 Node에서 import된다 — 순수 모듈(`core/constants`·`core/cast`·`core/safety`·`ai/parse`·`ai/prompt/lore`)이 그렇다. 새 테스트는 `tests/unit/<모듈>.test.mjs`.
