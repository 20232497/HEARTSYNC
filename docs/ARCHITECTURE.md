# HEART SYNC 아키텍처 — 2026-11-04 점검과 두 빌드

사용자 요청(2026-11-04) 세 가지를 반영한 결과를 적어 둔다: ① 아키텍처 점검 뒤 합칠 것은 합치고 나눌 것은 나누기, ② 관리자 모드와 사용자 사이트 분리(그림은 관리자가 미리 만들어 두고 사용자는 보기만), ③ 주석 정책(관리자 빌드는 자세히, 사용자 빌드는 필요한 것만 짧게).

## 1. 한눈에

```
                 src/js (ES 모듈) + src/css + content/
                              │  npm run build (tools/build.mjs — 모듈 수·크기를 출력)
            ┌─────────────────┴──────────────────┐
   index.html  사용자 사이트(배포)          admin.html  관리자 도구(커밋·배포, /admin.html)
   main.js → app.js(사용자 모듈)            admin.js → app.js + admin/
   주석·빈 줄 없음, 모듈마다 한 줄 설명      주석 전부 + 모듈 머리(가져옴·내보냄·쓰는 곳)
   메뉴: 홈·대화·스토어·MY                   메뉴: 홈·대화·작품·이미지·만들기·스토어·MY
```

- 두 빌드는 **같은 저장소**(이 브라우저의 localStorage·IndexedDB, 로그인하면 Supabase 계정)를 쓴다. 관리자 도구에서 만든 그림·코드 표는 그 브라우저에만 있으므로 **작품 폴더에 저장**으로 `content/`에 써서 빌드에 실어야 사용자에게 보인다(§4).
- 사용자 빌드에는 Runware·이미지 프롬프트·태그 번역·그림체·스튜디오 모듈이 들어가지 않는다. 빌드 검사 `checkNoGen`이 강제한다(들어가면 빌드 실패).

## 2. 층과 규칙

```
core      config(잎) · constants · util · events · storage · state · target · cast · audience · wallet · character · safety · rooms · settings · migrate
content   index.js — 빌드가 만든 generated.js(ORIGINALS · HOME_ROWS · CONTENT_CODES)
services  supabase · cloud · vault · sync · load · community · images · support · idv
images    codes · rating · pick · motion · situations · tags-cache        (관리자만) styles · style-fit · style-fdaily · prompt · tags · runware · gen-guard
ai        models · llm · adult · openrouter · parse · prompt/{lore,rules,input,memory}
ui        icons · sheet · ext · shell · cover · home · detail · chat/{render,log,view,generate,suggest} · pay · model-sheet · room-drawer · worldart · chats · store · login · account · me · help · faq · idv
admin     studio · image-studio · image-codes · image-run · motion-run · motion-prompts · motion-table · sit-sheets · gen-sheet · worldart · image-settings · works · tools · auto-images · export · migrate · codes · gate · support
boot.js → app.js(USER_VIEWS · USER_NAVS) → main.js | admin.js
```

규칙(빌드가 강제하는 것은 ★):
- ★ 상대 경로의 이름 있는 import만, 다른 모듈의 `let`은 그 모듈의 `set…()`으로, 전체에서 같은 이름 두 번 선언 금지, 맨 윗단에서 뒤 모듈의 const 사용 금지(순환 의존).
- **아래층은 윗층을 import하지 않는다.** core·services가 화면을 갱신해야 하면 `core/events.js`의 `emit("rooms"|"wallet"|"settings"|"vault"|"cloud"|"community"|"route")`를 부르고, ui가 `on()`으로 받는다(shell·login·account·home). `core/storage.js`는 `KV.remote` 고리로 CLOUD에 연결한다.
- **셸은 화면을 모른다.** `ui/shell.js`는 `registerViews({ home: viewHome, c: viewDetail, … })`·`setNavs([...])`로 등록된 것만 라우팅한다. 진입점(main.js·admin.js)이 등록한다.
- **관리자 기능은 EXT 고리에 꽂는다.** `ui/ext.js`의 `EXT.detail(c, v)`·`drawer(r, body)`·`afterTurn(r, body)`·`me(v)`·`meSave(v)`·`persona(ov, setImg)`·`help(tab, box, list)`. 사용자 화면 모듈은 자리(`#wArtTools`·`#castTools`·`#ctaTools`·`#meExt`·`#avTools`, 드로어 `.menu-list` 끝, 고객센터 `#helpBody`)만 두고 `runExt(...)`를 부른다. 고객센터(`ui/help.js`)의 공지 쓰기·받은 문의는 `admin/support.js`가 `EXT.help`로 더하며, 쓰기 권한 자체는 서버(Supabase RLS의 `is_admin()`)가 정한다. 사용자 빌드에는 꽂는 모듈이 없어 비어 있다.
- 빌드마다 다른 설정 이전은 `boot({ migrate })`로 주입한다(관리자: `admin/migrate.js`의 그림체·이미지 모델 이전).
- `core/target.js`의 `isAdmin()`은 문구·배지 같은 작은 차이에만 쓴다(기능 분기는 EXT·화면 등록으로).

## 3. 점검 결과(A단계, 2026-11-04)

역방향 import 9곳과 허브 모듈을 찾아 걷어냈다. 동작은 그대로(Playwright 7종 통과).

| 문제 | 조치 |
|---|---|
| `core/rooms`·`core/wallet`·`services/cloud`·`services/vault`가 `ui/shell`·`ui/login`·`ui/account`를 import해 화면을 직접 갱신 | `core/events.js` 이벤트 버스. 아래층은 emit, ui는 on |
| `images/pick`·`images/situations`·`ui/worldart`·`ui/me`가 커뮤니티 공개를 위해 `ui/studio`를 import | `services/community.js`(publishCommunity·cleanChar·watchCommunity) |
| `services/sync`가 `boot.js`의 loadAll을 import(services → boot) | `services/load.js`로 loadAll 분리, TAGS 캐시는 `images/tags-cache.js` 잎 모듈 |
| `core/storage`가 `services/cloud`를 import(core → services) | `KV.remote` 고리, cloud.js가 꽂음 |
| `core/state`가 `ai/models`·`images/styles`의 기본값을 import | 기본값은 쓰는 쪽(styleFor·orModel)이 비었을 때 채움, 요금 상수는 `core/constants` |
| `boot.js`가 설정 이전 60줄 + 로드 + 부팅을 모두 가짐 | `core/migrate.js`(일반) + `admin/migrate.js`(그림체) + `services/load.js` |
| `ui/shell`이 모든 화면을 import(허브) | 화면 등록(registerViews·setNavs) |

합친 것: 작품 공개 관련 함수 셋 → `services/community.js`. 나눈 것: 위 표. 그 밖의 모듈 경계(ai/·images/·services/)는 적절해 그대로 둔다.

## 4. 그림의 흐름 — 관리자가 만들고 사용자는 본다

```
관리자 도구(admin.html)                          저장소                         사용자 사이트(index.html)
이미지 스튜디오·세계관 일러스트·자동 생성 ──IndexedDB──┐
                                            '작품 폴더에 저장' (admin/export.js)
                                                   ├─▶ content/<aud>/[줄/]<id>/images/<코드>-<키>.webp · cover.* · lore-<n>.*
                                                   └─▶ content/codes.json
                                              npm run build (scanImages · readCodes)
                                                   ├─▶ ORIGINALS[].images · img · loreImages  (content/… 상대 경로)
                                                   └─▶ CONTENT_CODES (shipped: true)
                                                                                 imagesOf · coverHTML · loreImg가 그대로 <img src>로 그림
                                                                                 allCustom() = 내 칸(customSits) ∪ 실린 코드 → 대화 규칙·조합 이름
```

- 참조 모양(`services/images.js`의 `validRef`): `/_blob/<id>` · `kv:img…` · `data:image/…` · **`content/…/images/x.webp`**. content/ 경로는 index.html 기준 상대 경로라 GitHub Pages·file:// 모두 같은 폴더 구조면 보인다. claude.ai에 올릴 땐 `content/**/images/`도 files로 올린다.
- 사용자 계정의 imgpacks(예전에 만든 그림)는 실린 그림을 덮는다(`imagesOf`: 작품 images 위에 imgpacks).
- 쓰는 방법: Chrome·Edge는 `showDirectoryPicker`로 저장소 `content` 폴더를 골라 바로 쓴다(폴더 안에 f·m·all이 있어야 함). 그 밖의 브라우저는 같은 구조의 ZIP(저장 없는 stored zip, `admin/export.js`의 makeZip)을 내려받아 풀어 넣는다. 이미 `content/`에 실린 그림은 다시 쓰지 않는다.
- 스튜디오에서 만든 내 작품은 `work.js`도 함께 써서 오리지널로 올릴 수 있다(기기 데이터인 images·publish·creator는 뺌).
- **관리자 전용 코드**(2026-11-05): 성인 수위 행동 코드 표는 `content/codes.admin.json`(git에 없음)을 `admin/codes.js`가 런타임에 fetch해(개발 서버에서만) `setExtraCodes`로 꽂거나, 웹 관리자 도구에서는 '목록으로 추가'로 계정(customSits)에 들여온다. admin.html이 배포되므로 빌드 결과물에는 넣지 않는다. 내보내기(codes.json·작품 폴더)가 성인 수위·관리자 전용 코드를 걸러 사용자 사이트로 흘러가지 않게 한다.
- **관리자 웹 주소와 관문**(2026-11-05): admin.html도 커밋·배포(https://…/HEARTSYNC/admin.html). 웹 주소에서는 `admin/gate.js`가 비밀번호(SHA-256 해시 비교)를 묻고 localhost·file://은 묻지 않는다. 정적 페이지의 클라이언트 관문이라 소스를 읽는 사람은 우회할 수 있다 — 무심코 들어오는 것만 막고, 실제 데이터는 관리자의 브라우저·계정에만 있다. 관리자는 `#codetest`(코드 조합 테스트)에서 작품·인물·코드 조합을 골라 프롬프트를 보고 그려 본 뒤 마음에 드는 것만 슬롯에 저장한다.
- **그림 생성 권한**(2026-11-05~06): 비밀번호 관문과 별개로, 웹 주소·file://에서는 Supabase `admins` 표에 있는 계정만 그림·움짤을 만든다(`images/gen-guard.js`, localhost·127.0.0.1만 건너뜀). Runware를 부르는 두 곳(`runwareImage`, 움짤 `rwTask`)이 맨 앞에서 확인하고, 태그 번역(사용자 키로 요금이 듦)이 먼저 도는 곳(`image-run.js`의 draw, `gen-sheet.js`의 생성 버튼, `auto-images.js`)은 번역 전에 확인한다. 이미 청구된 움짤의 결과 묻기(`getResponse`)는 막지 않는다. 브라우저 안의 확인이라 페이지를 고치면 우회할 수 있고, 진짜 서버 관문은 서버가 Runware를 부르는 단계(ROADMAP)다. `gate.mjs`가 가짜 https 호스트에서 시험한다(다른 흐름 시험은 127.0.0.1이라 건너뜀).
- **이미지 스튜디오**(2026-11-05): 관리자 도구의 그림 일은 `#images` 한 화면 — `admin/image-studio.js`(화면·이벤트) · `image-codes.js`(갈래·번호대 묶음과 인물별 그림 수, 순수 HTML 조각) · `image-run.js`(Runware 그리기·결과·저장·파일 이름 → 조합 키, 상태 `ISTATE`). 예전 이미지 슬롯 시트·조합 만들기·코드 표·코드 조합 테스트를 합쳐 고정 칸 격자를 없앴고(0~14는 목록의 "기본 감정" 묶음), 칸 편집기·목록으로 추가·추천 칸은 `admin/sit-sheets.js`를 그대로 씀. 다른 화면은 `openImages(c, code)`로만 들어옴. 코드 목록의 '선택 삭제'(계정의 내 칸만, 그 코드가 든 그림·움짤도 지움)와 조합의 '모두 빼기'도 이 화면.
- **움짤**(2026-11-05): 그림 칸마다 사진과 움짤(짧은 반복 영상)을 함께 두고 `on`으로 어느 쪽을 보일지 정함 — 저장·고르기는 `images/motion.js`(사용자 빌드에도, KV `motionpacks` + 작품 폴더의 `c.motions`), 보이기는 `ui/cover.js`의 `picHTML`(사진 위에 `<video>`를 겹침 — 영상을 못 받으면 사진), 본문은 `services/images.js`의 `IMG.putVideo`·`vtag`·`videoURL`(kv: 영상은 blob 주소로 — iOS는 data: 영상을 재생 못 함). 만들기는 관리자만 `admin/motion-run.js`(Runware videoInference 비동기 + getResponse). 사진을 바꾸거나 지우면 움짤도 지워 다른 사진에서 만든 영상이 남지 않게 함. 움직임 설명은 `admin/motion-prompts.js`(2026-11-06, 순수)가 코드별로 조립함 — 카메라(행에 pov가 있으면 1인칭) → 정적 묘사 → 움직임 → 마무리, 인물이 남자면 남성 표를 먼저 봄. 표는 데이터만 있는 `admin/motion-table.js`(`MotionPrompts`·`MotionPrompts_Male`)로 전체이용가 감정·일상과 가벼운 스킨십만이고, 표를 덮어써도 세미·성인 수위 칸이나 정의 안 된 번호에는 쓰이지 않고 예전 기본 설명을 그대로 쓴다(`motionSafe`). 저장소가 공개라 표도 공개된다.

## 5. 주석 정책

| | 소스 `src/` | 사용자 빌드 `index.html` | 관리자 빌드 `admin.html` |
|---|---|---|---|
| JS | 자세히(모듈 첫 줄 = 책임, 함수 위 = 왜) | 모두 벗김, `//!`·`/*!`만 남김. 모듈마다 `/* ── 파일 — 첫 줄 설명의 첫 문장 */` | 모두 남김 + 모듈 머리(가져옴·내보냄·쓰는 곳) |
| CSS | 조각 머리 `/* ── 이름 */` | 모두 벗김(`/*!`만) | 모두 남김 |
| HTML | 뼈대 설명 | `<!--!` 빌드 안내만 | 모두 남김 |
| 빈 줄 | 자유 | 지움 | 그대로 |

그래서 **모듈 첫 줄 주석의 첫 문장**이 사용자 빌드에 남는 유일한 설명이다 — 짧고 정확하게 쓴다. 줄 번호는 `.build/linemap.json`(사용자, 빈 줄을 지워 한 모듈이 여러 구간)·`linemap-admin.json`(관리자)으로 원본에 맞춘다(`npm run dev`가 콘솔에 원본 파일:줄을 찍음).

## 6. 결정과 남은 일

- **스튜디오(만들기)는 관리자 도구로 옮겼다.** 사용자가 작품을 만들면 그림도 만들어야 해 복잡해진다는 판단(2026-11-04). 되돌리려면 `src/js/main.js`에서 `viewStudio`를 `registerViews`에 더하고 USER_NAVS에 "만들기"를 넣으면 된다(모듈은 admin/에 그대로).
- 커뮤니티 공개(publishCommunity)는 관리자 도구에서만 일어난다. 사용자 사이트는 커뮤니티를 읽기만 한다.
- 대화 중 그림 자동 생성(`admin/auto-images.js`)은 관리자 도구에서만 돈다 — 사용자에게는 실린 그림이 없으면 조합 키 폴백(감정만 → 1 → 0) 뒤 글자 카드. 같은 곳의 자동 움짤(`autoMotions`, 기본 꺼짐)은 그림이 끝난 뒤 번호 100~500이 든 전체이용가 칸만 만든다(`wantsVideo`·`motionSafe`). 영상 모델이 사진을 첫 장면으로 쓰므로 그림을 대신하지 않고 그림 위에 겹친다.
- 사용자 빌드에 남은 작은 짐: `images/rating.js`(수위 계산)·`dropSitImages`(관리자만 부름). 더 줄이려면 rating을 codes.js로 합치고 dropSitImages를 admin/으로 옮기면 된다.
- 다음: 작품마다 그림을 실제로 만들어 `content/`에 싣기(관리자 도구 → 작품 화면 → 전부 저장), 실린 그림이 많아지면 `images/` 폴더 크기와 첫 화면 로딩(lazy)을 보기.

## 7. 외부 점검(Gemini 제안, 2026-11-05) 반영 여부

| 제안 | 판단 | 이유 |
|---|---|---|
| 1단계 Vite로 이행, 모듈별 CSS import, 동적 import(lazy) | **보류** | 배포물은 file://·GitHub Pages·claude.ai에서 그대로 도는 **단일 파일**이어야 함(여러 파일·동적 import는 file://에서 CORS로 막힘). 지금 빌드는 두 대상·주석 정책·TDZ·오래된 iOS 문법·작품 폴더 검사를 이미 하고 런타임 의존성 0을 지킴. CSS는 고유 클래스라 "전역 오염"이 실제 문제로 나타나지 않음 |
| 2단계 Proxy 반응형 저장소, 데이터 주도 렌더링 | **보류** | S를 Proxy로 바꾸면 62개 모듈 전부에 닿고, 스트리밍 중 수백 번 바뀌는 상태를 자동 재렌더하면 스크롤·포커스 흐름이 깨짐. 층 사이 결합은 §2의 이벤트 버스(core/events.js)·EXT 고리로 이미 풀었고, 화면은 명시적 render 함수가 가장 읽기 쉬움 |
| 3단계 content/와 Supabase를 한 데이터 층으로, 캐시 우선 fetch | **보류** | 작품은 관리자가 큐레이션해 빌드에 싣는 정적 데이터(12작품), Supabase는 사용자별 데이터만. 서버에서 작품을 받으면 file://·오프라인 부팅이 깨지고 표·RLS·공개 파이프라인이 늘어남. 작품이 수십 개를 넘으면 그때 다시 봄 |
| 4단계 낙관적 UI·스켈레톤·타임아웃/재시도 | **부분 적용** | 낙관적 UI(유저 말풍선 즉시, thinking 점, 타이핑 커서)와 오류 줄 + 다시 시도는 이미 있었음. 없던 것: **네트워크 시간 제한**(연결·스트림 멈춤·그림 생성·Supabase 요청 — TIMEOUT·timeoutSignal), 끊긴 응답의 본문 보존, 그림 자리 스켈레톤(img-wait/img-miss) |
| 5단계 JSDoc 타입·@typedef 스키마 | **적용** | `src/js/core/types.js`에 데이터 모양 @typedef 30여 종(작품·출연진·키워드북·대화방·메시지·설정·지갑·견적·코드·그림체·AI 요청/오류…), core·ai·services의 공개 함수·객체 88곳에 @param·@returns·@throws, `jsconfig.json`(checkJs false — 검사가 아니라 편집기·AI용 문서). 사용자 빌드는 주석을 벗기므로 크기 비용 0. ui/·images/·admin/은 첫 줄 주석으로 충분해 달지 않음 |

