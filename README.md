# HEART SYNC

버블챗 스타일의 캐릭터 대화형 에피소드 플랫폼. 작품(세계관·캐릭터)을 고르고 내 페르소나로 대화하면 AI가 장면·상태창·장면 그림과 함께 이야기를 이어 갑니다.

## 주소
| | 주소 | 비고 |
|---|---|---|
| **사용자 사이트** | https://20232497.github.io/HEARTSYNC/ | 휴대폰도 이 주소로(내려받은 파일·GitHub 코드 화면에서는 안 돌아요) |
| **관리자 도구** | https://20232497.github.io/HEARTSYNC/admin.html | 비밀번호 필요. 작품 그림·이미지 코드 표를 만들어 `content/`에 싣는 곳 |
| 데모(claude.ai) | https://claude.ai/artifact/3sfDYFeJ13dHrkWwBFj1YG | 비공개 아티팩트 |

API 키(Anthropic·Runware·OpenRouter)는 MY → 설정에 넣으면 각자 브라우저(또는 로그인한 계정의 암호화 금고)에만 저장돼요.

## 무엇을 하나
- **작품과 대화**: 오리지널 세계관 12편(남성향·여성향 군상극, 1:1 캐릭터), 시작 상황 선택, 지문/대사 서식, 상태창, 다시 쓰기·버전·수정·북마크, AI 추천 답변, 장기기억 자동 요약, 키워드북
- **장면 그림**: 매 응답 인물마다 상황에 맞는 그림 한 장 — `[[img:인물코드:번호]]` 코드(기본 감정 15종 + 세부 감정·일상 40종 + 의상·장소)를 조합해 미리 만들어 둔 그림을 보여 줘요. 그림은 관리자가 만들어 싣고 사용자는 보기만 해요
- **로그인·계정 저장**: 이메일 또는 카카오·네이버·Google(Supabase). 대화·작품·설정·그림이 PC와 휴대폰에서 이어지고, API 키는 비밀번호로 잠근 금고로만 올라가요
- **관심있는 대화**: 전체·남성향·여성향을 고르면 홈에 그쪽 작품만
- **요금(데모)**: 라이트 모델 하루 10턴 무료, 하트·PLUS는 데모 결제
- **성인 모드**(로컬·시험용): 성인 확인 + OpenRouter 키일 때만 무검열 서사·성인 수위 그림. 미성년 인물·암시는 어떤 설정에서도 차단
- **관리자 도구**: 스튜디오(작품 만들기), 이미지 슬롯·세계관 일러스트·표지 AI 생성(Runware), 그림체 세트, 코드 표, 코드 조합 테스트, '작품 폴더에 저장'으로 `content/`에 싣기

## 개발
처음 한 번 `npm install`(빌드 검사용 파서와 Playwright — 앱 런타임 의존성은 0).

| 명령 | 하는 일 |
|---|---|
| `npm run build` | `src/`·`content/`를 합쳐 `index.html`(사용자)·`admin.html`(관리자)을 만듦(모듈·문법·작품 폴더 검사 포함) |
| `npm run dev` | http://localhost:5173 (관리자는 /admin.html) — 저장할 때마다 다시 빌드하고 새로 고침 |
| `npm run check` | 두 결과 파일이 지금 소스와 같은지(GitHub Actions '빌드 확인'이 PR·main마다 실행) |
| `npm test` | 단위 테스트(1초) |
| `npm run e2e` | Playwright 흐름 시험 11종(5~8분, 처음엔 `npx playwright install webkit chromium`) |

규칙 세 가지:
1. **`index.html`·`admin.html`은 빌드 결과물** — 직접 고치지 말고 `src/`·`content/`를 고친 뒤 빌드해서 같이 커밋
2. **배포물은 파일 하나** — 모듈 파일로 나누지 않아요(file://·GitHub Pages·claude.ai에서 그대로 돌아야 함). 소스는 ES 모듈 80개, 빌드가 import 순서로 이어 붙여요
3. **주석**: 소스에는 자세히. 사용자 빌드는 주석을 벗기고 모듈마다 한 줄 설명만, 관리자 빌드는 전부 남겨요

```
src/page.html · src/admin.html   뼈대(사용자 · 관리자)
src/css/                          화면별 CSS, css/admin/ 관리자 전용
src/js/core → content → services · images · ai → ui → admin → boot   층 순서(아래층은 윗층을 모름)
src/js/main.js · admin.js         진입점 둘
content/<f|m|all>/…/work.js       작품 폴더(이미지는 images/, 코드 표는 codes.json)
tools/build.mjs · dev.mjs         빌드 · 개발 서버      tests/   단위·흐름 시험
```

## 문서
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — 층 규칙, 두 빌드, 그림이 사용자에게 가는 흐름, 주석 정책, 점검 기록
- [docs/SETUP.md](docs/SETUP.md) — 배포 주소, 관리자 비밀번호, Supabase 계정 서버·소셜 로그인 설정, Vercel
- [content/README.md](content/README.md) — 작품 폴더 만드는 법, 그림·코드 표 싣기
- [tests/README.md](tests/README.md) — 시험 목록
- [docs/ROADMAP.md](docs/ROADMAP.md) · [docs/COMMERCIALIZATION.md](docs/COMMERCIALIZATION.md) — 남은 과제, 상용화 단계
- [privacy.html](privacy.html) — 개인정보처리방침
