# content/ — 작품(세계관·캐릭터) 폴더

HEART SYNC 오리지널 작품은 **작품 하나 = 폴더 하나**예요. 빌드(`npm run build`)가 이 폴더를 모두 찾아 검사한 뒤 `index.html`의 `ORIGINALS`·`HOME_ROWS`로 넣어요. 목록 파일은 없어요 — 폴더를 더하면 그대로 나란히 등록돼요. 작품 폴더의 `images/`와 `content/codes.json`은 관리자 도구(admin.html)가 내보낸 그림·이미지 코드 표고, 빌드가 함께 실어요(아래 '그림과 코드 표 싣기').

## 맨 위 폴더 = 관심있는 대화(aud)

| 폴더 | aud | 뜻 | 홈에 보이는 때 |
|---|---|---|---|
| `f/` | `f` | **여성향** — 남성 캐릭터와의 대화 | '여성향'·'전체'를 골랐을 때 |
| `m/` | `m` | **남성향** — 여성 캐릭터와의 대화 | '남성향'·'전체'를 골랐을 때 |
| `all/` | `all` | 전체 — 남녀가 섞인 작품 | '전체'를 골랐을 때만 |

작품의 `aud`는 **폴더가 정해요**. `work.js`에 `aud`를 쓰지 않아요(쓰면 폴더와 같아야 하고, 다르면 빌드 실패). 남성향 작품을 여성향으로 옮기려면 폴더를 `m/`에서 `f/`로 옮기면 끝이에요.

## 그 아래 = 작품 폴더 또는 홈 가로 줄 폴더

```
content/
├─ f/                         여성향
│  ├─ fate/                   홈 가로 줄 「다섯 남자, 하나의 비밀」 (_row.json이 있으면 줄 폴더)
│  │  ├─ _row.json            줄 제목·부제·순서
│  │  ├─ hwanghu/             계약 황후의 백 일
│  │  │  ├─ work.js
│  │  │  └─ images/           관리자 도구가 내보낸 그림(선택): <인물코드>-<번호>.webp · cover.webp · lore-1.webp …
│  │  ├─ hasuk/work.js        서촌 오월 하숙집
│  │  └─ lethe/work.js        호텔 레테: 마흔아홉 번째 밤
│  ├─ seodoyun/work.js        흑우 탐정사무소 (줄 없는 단독 작품)
│  ├─ kael/work.js
│  └─ baekyeon/work.js
├─ m/                         남성향
│  ├─ survive/                홈 가로 줄 「살아남는 자가 역사를 쓴다」
│  │  ├─ _row.json
│  │  ├─ daeyeon/  baekya/  sipjeol/
│  ├─ godseats/work.js        신님들, 관전 매너 좀
│  ├─ yunhaera/work.js
│  └─ hangyeoul/work.js
└─ all/                       전체(지금은 비어 있음)
```

- **작품 폴더**: `work.js`가 든 폴더. 폴더 이름 = 작품 `id`(영문 소문자·숫자·`-`·`_`).
- **줄 폴더**: `_row.json`이 든 폴더. 안에 작품 폴더를 두면 그 작품들이 홈의 가로 줄 하나로 모여요. 폴더 이름이 곧 작품의 `row` 값이라 `work.js`에 `row`를 쓰지 않아요. 줄 이름은 `f`·`m`·`all` 전체에서 하나만.
- `_`·`.`로 시작하는 폴더·파일은 빌드가 건너뛰어요(초안을 잠시 빼 둘 때 `_draft/`처럼).

## 새 세계관 추가 — 폴더 하나 복사

1. 가장 비슷한 작품 폴더를 복사해요.
   - 여성향 남주 군상극을 「다섯 남자, 하나의 비밀」 줄에 → `f/fate/hwanghu/`를 `f/fate/새id/`로
   - 남성향 히로인 군상극을 「살아남는 자가 역사를 쓴다」 줄에 → `m/survive/daeyeon/`을 `m/survive/새id/`로
   - 1:1 캐릭터 → `f/seodoyun/`(남자 캐릭터) 또는 `m/yunhaera/`(여자 캐릭터)
   - 새 홈 가로 줄을 만들려면 `f/새줄/_row.json`을 만들고 그 안에 작품 폴더를 둬요.
2. `work.js`에서 `id`를 폴더 이름과 같게 바꾸고 내용을 고쳐요.
3. `export const order = 숫자`로 순서를 정해요(작을수록 홈 대표 작품·오리지널 목록에서 앞). 같은 줄 안의 순서도 이 숫자를 따라요. 빼면 맨 뒤.
4. `npm run build`(또는 `npm run dev`를 켜 두면 저장할 때마다 자동). 틀린 곳이 있으면 `content/f/fate/새id: …`처럼 어디가 왜 틀렸는지 알려 줘요.
5. `index.html`도 같이 커밋해요(GitHub Actions가 소스와 같은지 확인).

## work.js 모양

```js
/* 한 줄 설명 */
export const order = 40; // 홈·오리지널 목록 순서(작을수록 앞)

export default {
  id: "newworld", name: "작품 이름", title: "작품 제목", glyph: "字", cat: "로맨스", pal: 1, motif: "petals", world_mode: true, isNew: true,
  oneLiner: "카드에 보이는 한 줄 소개",
  artTags: "dark fantasy, ruined cathedral, candlelight, …",   // 세계관 영문 낱말(그림용)
  tags: ["태그", "…"],
  desc: "상세 페이지 소개",
  persona: `AI에게 주는 인물·진상 설정 …`,
  world: `세계관 규칙 …`,
  speech: `문체·말투 예시 …`,
  secret: "숨은 설정",
  fields: ["📅 날짜", "📍 장소", "❤️ 호감도"], gauge: "❤️ 호감도",
  lore: [ { keys: ["키워드", "별칭"], text: "대화에 키워드가 나오면 AI에 전달할 설명", kind: "place", tags: "ruined cathedral, stained glass, moonlight" } ],
  cast: [ { code: "ks", name: "카시안", look: "29세 남성, 흑발, …", tags: "black hair, golden eyes, black military uniform, …" } ],
  openings: [ { title: "시작 상황 이름", directive: "AI에게만 주는 지시", status: { "📅 날짜": "1일차" }, text: "첫 장면 …\n\n[[img:ks:0]]\n\n카시안: \"…\"" } ]
};
```

| 칸 | 뜻 |
|---|---|
| `cat` | 로맨스·판타지·RPG·미스터리·일상·시뮬레이션 중 하나 |
| `pal`·`motif`·`glyph` | 표지 색(0~7)·무늬(rain·city·stars·glow·petals·ash·curtain)·가운데 한 글자 |
| `world_mode` | 여러 인물이 나오는 군상극(세계관). 1:1 캐릭터면 빼요 |
| `fields`·`gauge` | 상태창 칸 이름(3글자 안팎)과 관계 게이지 칸. 시작 상황 `status`의 칸은 `fields`에 있어야 해요 |
| `cast` | 출연진. `code`는 그림 태그 `[[img:코드:번호]]`에 써요(번호는 0~14 기본 감정, 또는 내장 코드 1xx 감정·4xx 의상·5xx 장소를 쉼표로 조합 — 앱의 '코드 표'). `tags`(선택)는 그 인물의 외모를 영문 Danbooru 태그로 적은 글 — 있으면 그림 프롬프트의 인물 묶음에 번역 없이 그대로 들어가 같은 인물이 매번 같은 생김새로 그려져요(성별·인원 태그는 `look`에서 자동, 한국어는 넣지 않기). 1:1 캐릭터는 `cast`를 빼면 앱이 설정의 `외모:` 줄로 한 명(`c`)을 만들어요 — 그때는 맨 위 `lookTags`가 같은 역할 |
| `lore` | 키워드북 `[{ keys, text, kind, tags }]`. `kind`는 항목 종류 — `person` 인물 · `creature` 동물·존재 · `place` 장소 · `item` 물건 · `event` 사건 · `group` 세력 · `concept` 설정(앱의 `LORE_KINDS`). 세계관 일러스트의 구도가 이것으로 정해져요(인물은 초상, 동물은 `no humans`, 장소는 풍경, 물건은 정물…). `tags`는 그 항목을 그릴 영문 낱말(없으면 `text`를 번역해서 씀). 둘 다 빠지면 빌드 경고 |
| `artTags` | 그 세계관의 영문 낱말(시대·장소·조명·분위기, 예: `joseon dynasty, korean royal palace, paper lanterns, night`). 표지와 모든 세계관 일러스트 프롬프트에 붙어 작품마다 분위기가 나게 해요(없으면 `oneLiner`) |
| `openings` | 시작 상황(게임 모드). 군상극은 인물 첫 등장마다 `[[img:코드:0]]` |

`work.js` 안에서는 `const`로 같이 쓸 값을 만들거나(`m/godseats/work.js`의 상태창), 다른 파일을 `import`해도 돼요(예: 키워드북이 길면 `lore.js`로 빼서 `import lore from "./lore.js"`). 빌드가 Node에서 실행한 **결과 값**만 `index.html`에 넣어요 — 그래서 함수 같은 건 넣을 수 없고 글·숫자·참거짓·배열·객체만 돼요.

## 그림과 코드 표 싣기 — `images/`·`codes.json` (2026-11-04)

사용자는 그림을 만들지 않아요. 관리자 도구(`admin.html` — `npm run build`가 함께 만듦, git에 없음)에서 Runware로 만들거나 올린 그림을 **작품 폴더에 저장**(상세·작품 화면)으로 저장소의 `content/`에 쓰고, 다시 `npm run build`하면 사용자 사이트에 실려요. Chrome·Edge는 `content` 폴더를 고르면 바로 쓰고, 그 밖의 브라우저는 같은 구조의 ZIP을 내려받아 풀어 넣어요.

```
content/<f|m|all>/[<줄>/]<id>/images/
  <인물코드>-<번호>.webp            그 인물의 감정 번호 그림 (예: ks-0.webp 프로필, ks-3.webp 부끄러움)
  <인물코드>-<번호>-<의상>-<장소>.webp 조합 그림 — 조합 키 "3,404,501"의 쉼표를 -로 (예: ks-3-404-501.webp)
  cover.webp                         대표 일러스트(표지, 3:4)
  lore-<n>.webp                      키워드북 n번째 항목의 세계관 일러스트(16:9, 1부터)
content/codes.json                   이미지 코드 표 [{ "n": 15, "name": "식사", "prompt": "eating, …", "rating": "safe", "keys": "식사|밥" }, …]
```

- 확장자는 webp·png·jpg. 파일 이름의 번호는 기본 감정(0~14)·내장 코드(1xx·4xx·5xx)·`codes.json`의 코드만 — 다른 번호면 빌드 실패. 조합 키 순서(감정 오름차순 → 의상 → 장소)와 다르게 적으면 바른 키로 등록하고 경고
- 빌드가 `ORIGINALS`의 `images`(인물 코드 → 조합 키 → `content/…` 상대 경로)·`img`·`loreImages`에 넣고, 앱은 그 경로를 `<img src>`로 그대로 써요(GitHub Pages·file:// 모두 같은 폴더 구조). claude.ai에 올릴 땐 `content/**/images/`도 함께 올려야 해요
- 사용자가 로그인한 계정의 그림(imgpacks — 예전에 만든 것)이 있으면 그것이 실린 그림을 덮어요
- `codes.json`은 관리자 도구의 **코드 표 내보내기**가 써요(실린 코드 + 그 브라우저에서 만든 칸 가운데 **전체이용가만**). 번호는 15~599(400·500 제외), `rating`은 safe·questionable·explicit, 성인 수위 코드의 이름·프롬프트에 미성년으로 보이는 표현이 있으면 실패. 앱에서는 `CONTENT_CODES`로 들어가 모든 사용자의 코드 표(대화 규칙의 번호 목록·조합 이름)에 쓰이고, 같은 번호의 내 칸이 있으면 내 칸이 덮어요. 성인 수위 코드를 여기 두면 공개 저장소와 사용자 사이트에 그대로 실리니 빌드가 경고해요
- **`codes.admin.json`(관리자 전용, git에 없음)**: 성인 수위 행동 코드(2xx 스킨십·3xx 체위·406·408 같은 것)처럼 **관리자 도구에서만** 쓸 코드 표. 모양은 `codes.json`과 같아요(예: [`codes.admin.example.json`](codes.admin.example.json)). 빌드에는 넣지 않고(admin.html도 배포되니까) **개발 서버(`npm run dev`)로 연 관리자 페이지가 런타임에 읽어요** — 웹 주소나 file://에서는 비어 있어요. 웹 관리자 도구에서 쓰려면 코드 표 시트의 **목록으로 추가**에 원본 표(.txt)를 한 번 들여오면 내 칸으로 계정에 저장돼 어느 기기에서나 보여요. 어느 쪽이든 성인 수위 코드는 '코드 표 내보내기'·'작품 폴더에 저장'에서 빠져 사용자 사이트로 흘러가지 않아요

## 빌드가 검사하는 것

- 폴더: `f`·`m`·`all` 말고 다른 맨 위 폴더, `work.js`도 `_row.json`도 없는 폴더, 줄 안의 줄
- `id`가 폴더 이름과 같은지, 전체에서 겹치지 않는지
- `aud`·`row`를 적었다면 폴더와 같은지
- **출연진 성별과 폴더**: 출연진 외모가 모두 여성인데 `f/`에, 모두 남성인데 `m/`에 있으면 실패(남녀가 섞인 작품은 그대로 둠 — 앱의 `guessAud`와 같은 규칙)
- **미성년 인물**: 출연진 외모·설정 첫머리에 19세 미만 나이나 학생 신분이 있으면 실패(앱의 `minorFlags`와 같은 코드)
- 필수 칸(`name`·`title`·`oneLiner`·`desc`·`persona`·`openings`), `cat`·`pal`·`motif` 값, 시작 상황의 `[[img:코드:번호]]`가 `cast`에 있는 코드이고 번호가 0~14 또는 내장 코드(1xx·4xx·5xx, `src/js/images/codes.js`의 DIMS)인지
- `images/`: 인물 코드가 `cast`에 있는지, 번호가 기본·내장·`codes.json` 코드인지, 같은 그림이 둘인지, `lore-<n>`이 키워드북 범위 안인지 / `codes.json`: 모양·번호 범위·중복·수위·미성년 표현
- 키워드북 `kind`가 `LORE_KINDS`에 없거나, `tags`·`artTags`에 한글이 있으면 실패
- 경고만: 키워드북 항목에 `kind`·`tags`가 없음, `gauge`가 `fields`에 없음, 시작 상황 `status`의 칸이 `fields`에 없음, 작품이 없는 줄, `images/`의 모르는 파일 이름, 조합 키 순서가 다른 파일 이름
