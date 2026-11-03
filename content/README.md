# content/ — 작품(세계관·캐릭터) 폴더

HEART SYNC 오리지널 작품은 **작품 하나 = 폴더 하나**예요. 빌드(`npm run build`)가 이 폴더를 모두 찾아 검사한 뒤 `index.html`의 `ORIGINALS`·`HOME_ROWS`로 넣어요. 목록 파일은 없어요 — 폴더를 더하면 그대로 나란히 등록돼요.

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
│  │  ├─ hwanghu/work.js      계약 황후의 백 일
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
  tags: ["태그", "…"],
  desc: "상세 페이지 소개",
  persona: `AI에게 주는 인물·진상 설정 …`,
  world: `세계관 규칙 …`,
  speech: `문체·말투 예시 …`,
  secret: "숨은 설정",
  fields: ["📅 날짜", "📍 장소", "❤️ 호감도"], gauge: "❤️ 호감도",
  lore: [ { keys: ["키워드", "별칭"], text: "대화에 키워드가 나오면 AI에 전달할 설명" } ],
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
| `lore` | 키워드북 `[{ keys, text, tags? }]`. `tags`(선택)는 그 항목의 세계관 일러스트를 그릴 때 `text` 대신 쓰는 영문 태그 |
| `openings` | 시작 상황(게임 모드). 군상극은 인물 첫 등장마다 `[[img:코드:0]]` |

`work.js` 안에서는 `const`로 같이 쓸 값을 만들거나(`m/godseats/work.js`의 상태창), 다른 파일을 `import`해도 돼요(예: 키워드북이 길면 `lore.js`로 빼서 `import lore from "./lore.js"`). 빌드가 Node에서 실행한 **결과 값**만 `index.html`에 넣어요 — 그래서 함수 같은 건 넣을 수 없고 글·숫자·참거짓·배열·객체만 돼요.

## 빌드가 검사하는 것

- 폴더: `f`·`m`·`all` 말고 다른 맨 위 폴더, `work.js`도 `_row.json`도 없는 폴더, 줄 안의 줄
- `id`가 폴더 이름과 같은지, 전체에서 겹치지 않는지
- `aud`·`row`를 적었다면 폴더와 같은지
- **출연진 성별과 폴더**: 출연진 외모가 모두 여성인데 `f/`에, 모두 남성인데 `m/`에 있으면 실패(남녀가 섞인 작품은 그대로 둠 — 앱의 `guessAud`와 같은 규칙)
- **미성년 인물**: 출연진 외모·설정 첫머리에 19세 미만 나이나 학생 신분이 있으면 실패(앱의 `minorFlags`와 같은 코드)
- 필수 칸(`name`·`title`·`oneLiner`·`desc`·`persona`·`openings`), `cat`·`pal`·`motif` 값, 시작 상황의 `[[img:코드:번호]]`가 `cast`에 있는 코드이고 번호가 0~14 또는 내장 코드(1xx·4xx·5xx, `src/js/images/codes.js`의 DIMS)인지
- 경고만: `gauge`가 `fields`에 없음, 시작 상황 `status`의 칸이 `fields`에 없음, 작품이 없는 줄
