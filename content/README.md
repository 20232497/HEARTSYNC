# content/ — 작품(세계관·캐릭터) 폴더

HEART SYNC 오리지널 작품은 **작품 하나 = 폴더 하나**예요. 빌드(`npm run build`)가 이 폴더를 모두 찾아 검사한 뒤 `index.html`의 `ORIGINALS`·`HOME_ROWS`로 넣어요. 목록 파일은 없어요 — 폴더를 더하면 그대로 나란히 등록돼요. 작품 폴더의 `images/`에 앱 밖에서 만든 그림을 이름 규칙대로 넣으면 빌드가 함께 실어요(아래 '그림 싣기').

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
│  │  │  └─ images/           그림(선택): KAS0.webp(인물 코드+감정 번호) · MP1.webp(장소) · EV1.webp(컷씬) · cover.webp · lore-1.webp …
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
  artTags: "dark fantasy, ruined cathedral, candlelight, …",   // 세계관 영문 낱말(앱 밖에서 그림을 만들 때)
  tags: ["태그", "…"],
  desc: "상세 페이지 소개",
  persona: `AI에게 주는 인물·진상 설정 …`,
  world: `세계관 규칙 …`,
  speech: `문체·말투 예시 …`,
  secret: "숨은 설정",
  fields: ["📅 날짜", "📍 장소", "❤️ 호감도"], gauge: "❤️ 호감도",
  lore: [ { keys: ["키워드", "별칭"], text: "대화에 키워드가 나오면 AI에 전달할 설명", kind: "place", tags: "ruined cathedral, stained glass, moonlight" } ],
  cast: [ { code: "KAS", name: "카시안", desc: "독자에게 보이는 소개(비밀은 persona에만)", look: "29세 남성, 흑발, …", tags: "black hair, golden eyes, black military uniform, …" },
          { code: "KASD", name: "카시안(용의 모습)", of: "KAS", look: "…", tags: "…" } ],   // 다른 모습(폼)은 별도 코드 — 선택
  places: [ { name: "루벨리아 황궁 알현실", desc: "…", tags: "throne room, gothic, …" } ],   // 장소 → MP1, MP2… — 선택
  cuts: [ { title: "첫 입맞춤", when: "카시안이 처음으로 먼저 입을 맞추는 순간", tags: "…" } ],   // 컷씬 → EV1, EV2… — 선택
  commands: [ { cmd: "알현", title: "황제 알현", desc: "독자용 설명", prompt: "AI에게 주는 지시 — 장면을 알현실로 옮기고 …" } ],   // 대화방 !알현 — 선택
  openings: [ { title: "시작 상황 이름", directive: "AI에게만 주는 지시", status: { "📅 날짜": "1일차" }, text: "첫 장면 …\n\n[[KAS0]]\n\n카시안: \"…\"" } ]
};
```

| 칸 | 뜻 |
|---|---|
| `cat` | 로맨스·판타지·RPG·미스터리·일상·시뮬레이션 중 하나 |
| `pal`·`motif`·`glyph` | 표지 색(0~7)·무늬(rain·city·stars·glow·petals·ash·curtain)·가운데 한 글자 |
| `world_mode` | 여러 인물이 나오는 군상극(세계관). 1:1 캐릭터면 빼요 |
| `fields`·`gauge` | 상태창 칸 이름(3글자 안팎)과 관계 게이지 칸. 시작 상황 `status`의 칸은 `fields`에 있어야 해요 |
| `cast` | 출연진. `code`는 **인물 코드 — 영문 대문자 1~4자**(한서윤 → `HSY`, 카시안 → `KAS`; 숫자는 안 되고 `MP`·`EV`는 예약). 그림 코드는 인물 코드 바로 뒤에 감정·행동 번호를 붙인 한 토큰이에요: 본문 태그 `[[HSY3]]`, 그림 파일 `HSY3.webp`(번호는 기본 감정 0~14 — `src/js/core/constants.js`의 `SIT`, 아래 '그림 코드 체계'). `of`(선택)는 다른 모습(폼)일 때 본체 인물의 코드 — 폼은 별도 코드로 그림을 갖고 AI는 '그 모습일 때만' 그 코드를 써요. `desc`(선택)는 상세 페이지 인물 시트(도감)에 보이는 독자용 소개 — 비밀·진상은 `persona`에만 적어요. `look`은 한국어 외모(AI가 읽고, 성별로 작품의 aud를 짐작). `tags`(선택)는 그 인물의 외모를 영문 Danbooru 태그로 적은 글 — 앱은 쓰지 않고, **앱 밖에서 그림을 만들 때** 같은 인물을 매번 같은 생김새로 맞추는 기준이에요(한국어는 넣지 않기 — 빌드가 막음). 그림을 위한 메모: 옷·머리만 적으면 인물끼리 얼굴이 같아지니 눈매(`narrow eyes`·`droopy eyes`·`round eyes` 등)·눈썹·앞머리(`parted bangs`·`side-swept bangs`·`forehead`)·점·주근깨도 적고, `big eyes`처럼 어려 보이는 낱말과 손에 든 물건(`holding …`)은 넣지 않기. 무기는 검 길이 이하를 기본으로(긴 막대 끝에 날이 달린 무기는 세로 그림에서 잘려요). 색이나 옷이 번지는 낱말도 조심하기 — `red hair ribbon`은 머리칼을 붉게, `white dress shirt`는 치마를, `mourning dress`는 서양 드레스를, `police`는 현대 경찰복을 불러요. 1:1 캐릭터도 `cast` 한 명을 적어요(`f/kael` → `KAEL`). 빼면 앱이 설정의 `외모:` 줄로 한 명(코드 `C`)을 만들고 그때는 맨 위 `lookTags`가 `tags` 자리 |
| `places` | 장소 목록(선택) `[{ name, desc, tags }]`. 순서가 곧 코드 — 첫 항목이 `MP1`, 둘째가 `MP2`…. AI는 장면의 장소가 바뀔 때 본문 첫 줄에 `[[MP1]]`을 넣고, 대화방의 `!지도` 명령어가 목록을 보여 줘요. 그림은 `images/MP1.webp`. `tags`는 그 장소를 그릴 영문 낱말(앱 밖에서) |
| `cuts` | 컷씬 목록(선택) `[{ title, when, tags }]`. 순서가 곧 코드 — `EV1`, `EV2`…. `when`(나오는 조건)이 처음 이루어지는 순간 AI가 `[[EV1]]`을 한 번 넣어요. 그림은 `images/EV1.webp` |
| `commands` | 작품 명령어(선택) `[{ cmd, title, desc, prompt }]`. 상세 페이지 '명령어' 카드에 보이고, 대화방 입력창에 `!cmd`를 치면 말풍선은 그대로 두고 AI에는 `prompt`가 `//` 연출 지시로 가요(예: `m/godseats`의 `!퀘스트`·`!관람석`·`!쉼터`). 앱 명령어 이름(`상태창`·`상태`·`갤러리`·`도감`·`지도`·`장소`·`도움말`·`명령어`·`help`)은 쓸 수 없어요(빌드 검사) |
| `lore` | 키워드북 `[{ keys, text, kind, tags }]`. 대화에 `keys`가 나오면 `text`를 AI에 전달해요. `kind`는 항목 종류 — `person` 인물 · `creature` 동물·존재 · `place` 장소 · `item` 물건 · `event` 사건 · `group` 세력 · `concept` 설정(앱의 `LORE_KINDS`, 상세 페이지 세계관 카드의 머리표). `tags`는 그 항목을 그릴 영문 낱말(앱 밖에서 `lore-<n>` 그림을 만들 때). 둘 다 빠지면 빌드 경고 |
| `artTags` | 그 세계관의 영문 낱말(시대·장소·조명·분위기, 예: `joseon dynasty, korean royal palace, paper lanterns, night`). 앱 밖에서 표지·세계관 일러스트를 만들 때 붙여 작품마다 분위기를 맞춰요 |
| `openings` | 시작 상황(게임 모드). 인물이 처음 등장하는 줄 위에 `[[코드0]]`(예: `[[KAS0]]` — 코드가 `cast`에 있고 번호가 0~14인지 빌드가 검사). 예전 `[[img:코드:번호]]` 모양은 더 쓰지 않아요 |

`work.js` 안에서는 `const`로 같이 쓸 값을 만들거나(`m/godseats/work.js`의 상태창), 다른 파일을 `import`해도 돼요(예: 키워드북이 길면 `lore.js`로 빼서 `import lore from "./lore.js"`). 빌드가 Node에서 실행한 **결과 값**만 `index.html`에 넣어요 — 그래서 함수 같은 건 넣을 수 없고 글·숫자·참거짓·배열·객체만 돼요.

## 그림 코드 체계

그림 하나 = 코드 한 토큰이에요(2026-11-08, 참고 사이트의 `RIA2`식 구성을 따름).

| 코드 | 뜻 | 보기 |
|---|---|---|
| `<인물코드><번호>` | 그 인물의 감정·행동 칸 그림. 인물 코드는 `cast[].code`(영문 대문자 1~4자), 번호는 0~14 | `HSY3` = 한서윤 · 3 부끄러움 |
| `MP<n>` | 장소 — `places`의 n번째(1부터) | `MP1` |
| `EV<n>` | 컷씬 — `cuts`의 n번째(1부터) | `EV2` |

- 감정·행동 번호(`src/js/core/constants.js`의 `SIT`): 0 프로필 · 1 기본 · 2 웃음 · 3 부끄러움 · 4 슬픔 · 5 놀람 · 6 분노 · 7 삐침 · 8 공포 · 9 부상 · 10 회복 · 11 휴식 · 12 공격(맨손·무기 모두) · 13 각성 · 14 설렘. 모든 인물이 같은 표를 써요
- 다른 모습(폼)은 번호가 아니라 **다른 인물 코드**예요(`cast`에 `of: "본체 코드"`로 한 명 더) — 어린 모습·짐승 모습·가면처럼 생김새가 통째로 바뀔 때. 감정이 바뀌는 건 번호로
- 본문에서는 `[[HSY3]]`처럼 대괄호 둘로 감싸요(AI가 쓰고, 앱이 그림으로 바꿈). 코드를 해석하는 곳(프롬프트·렌더러·갤러리·빌드 검사·도감)은 모두 `src/js/images/codes.js`의 `codebook(작품)` 하나를 써요 — 시리즈를 더하려면 `SERIES`에 한 줄
- 명령어는 두 층이에요. **앱 명령어** `!상태창`·`!갤러리`·`!지도`·`!도움말`(`src/js/core/commands.js` APP_COMMANDS)은 어느 작품에서나 AI를 부르지 않고 앱이 처리하고, **작품 명령어**(`commands`)는 그 작품의 이야기 장치로 AI에 연출 지시를 보내요. 둘 다 상세 페이지 '명령어' 카드에 보여요
- 상세 페이지의 인물 카드를 누르면 **인물 시트**(도감)가 열려요 — 코드·외형·소개·다른 모습 칩·감정 칸 0~14 칩(그림이 준비된 칸은 ●, 누르면 미리보기). 장소·컷씬이 있으면 그 칸도 코드와 함께 보여요(`src/js/ui/codex.js`)
- 예전 체계(`[[img:p1:3]]`·`p1-3.webp`·조합 `3,404,501`)는 더 쓰지 않아요. 예전 대화방은 열 때 앱이 새 코드로 바꿔요(`core/rooms.js` migrateRoom — 같은 이름의 인물을 지금 작품에서 찾음)

## 그림 싣기 — `images/`

앱은 그림을 만들지 않아요(2026-11-08 정리 때 그림 생성 코드를 걷어 냄 — 예전 코드는 태그 `archive/before-reset-2026-11-08`). 그림은 앱 밖에서 만들고(남성향 일상 화풍의 설정·완성 프롬프트는 [`archive/style-mdaily/`](../archive/style-mdaily/)), 작품 폴더의 `images/`에 **코드 이름 그대로** 넣은 뒤 `npm run build`하면 사용자 사이트에 실려요.

```
content/<f|m|all>/[<줄>/]<id>/images/
  <인물코드><번호>.webp     그 인물의 감정 칸 그림, 번호는 0~14 (예: KAS0.webp 프로필, KAS3.webp 부끄러움)
  MP<n>.webp                places의 n번째 장소 (예: MP1.webp)
  EV<n>.webp                cuts의 n번째 컷씬 (예: EV1.webp)
  cover.webp                대표 일러스트(표지, 3:4)
  lore-<n>.webp             키워드북 n번째 항목의 세계관 일러스트(16:9, 1부터)
```

- 확장자는 webp·png·jpg. 인물 코드는 `cast`의 대문자 그대로, 번호 15 이상·`places`/`cuts` 범위 밖·예전 이름(`ks-0.webp`)은 빌드 실패
- 대화에서 그 칸 그림이 없으면 1 기본 → 0 프로필 순으로 대신 보여 주고, 그것도 없으면 글자 카드예요. 그러니 인물마다 0·1부터 채우면 빈 칸이 안 보여요. 장소·컷씬은 그 번호 그림만(없으면 이름이 든 카드)
- 빌드가 `ORIGINALS`의 `images`(코드 글자 → 번호 → `content/…` 상대 경로)·`img`·`loreImages`에 넣고, 앱은 그 경로를 `<img src>`로 그대로 써요(GitHub Pages·file:// 모두 같은 폴더 구조). claude.ai에 올릴 땐 `content/**/images/`도 함께 올려야 해요
- 그림도 공개 저장소에 들어가요 — 모든 그림은 전체이용가로

## 빌드가 검사하는 것

- 폴더: `f`·`m`·`all` 말고 다른 맨 위 폴더, `work.js`도 `_row.json`도 없는 폴더, 줄 안의 줄
- `id`가 폴더 이름과 같은지, 전체에서 겹치지 않는지
- `aud`·`row`를 적었다면 폴더와 같은지
- **출연진 성별과 폴더**: 출연진 외모가 모두 여성인데 `f/`에, 모두 남성인데 `m/`에 있으면 실패(남녀가 섞인 작품은 그대로 둠 — 앱의 `guessAud`와 같은 규칙)
- **미성년 인물**: 출연진 외모·설정 첫머리에 19세 미만 나이나 학생 신분이 있으면 실패(앱의 `minorFlags`와 같은 코드)
- 필수 칸(`name`·`title`·`oneLiner`·`desc`·`persona`·`openings`), `cat`·`pal`·`motif` 값
- `cast[].code`가 영문 대문자 1~4자(숫자 없이, `MP`·`EV` 아님)이고 겹치지 않는지, `of`가 본체 인물의 코드인지(폼의 폼은 안 됨), `desc`가 글인지, `places`·`cuts` 모양, `commands`의 `cmd`가 공백·`!` 없이 겹치지 않고 앱 명령어 이름이 아닌지
- 시작 상황의 `[[코드번호]]`: 코드가 `cast`(또는 `MP`·`EV`)에 있고 번호가 범위 안인지. 예전 `[[img:…]]` 모양은 실패
- `images/`: 파일 이름이 `<코드><번호>`·`cover`·`lore-<n>`인지, 코드와 번호가 위 규칙에 맞는지, 같은 그림·표지가 둘인지, `lore-<n>`이 키워드북 범위 안인지
- 키워드북 `kind`가 `LORE_KINDS`에 없거나, `cast[].tags`·`lookTags`·키워드북 `tags`·`artTags`에 한글이 있으면 실패
- 경고만: 키워드북 항목에 `kind`·`tags`가 없음, `gauge`가 `fields`에 없음, 시작 상황 `status`의 칸이 `fields`에 없음, `cast`가 있는데 `lookTags`를 씀, 작품이 없는 줄, `images/`의 그림이 아닌 파일·모르는 파일 이름, 남아 있는 `content/codes.json`

## 작품별 인물 코드(2026-11-08)

| 작품 | 코드 |
|---|---|
| hwanghu 계약 황후의 백 일 | KAS 카시안 · LEO 레온하르트 · LUK 루카스 · NOL 노엘 · RYL 라일 |
| hasuk 서촌 오월 하숙집 | KTH 강태하 · YSH 윤시후 · BDH 백도현 · LHG 이한결 · SJH 서진혁 |
| lethe 호텔 레테 | CSH 차사현 · HIG 한이결 · KMH 강무혁 · SHJ 서하준 · RU 루 |
| godseats 신님들, 관전 매너 좀 | HSY 한서윤 · DHR 도하린 · RGN 류건 · SRN 세레나 바이스 · YNH 연화 · YCI 윤채이 · KYL 카일 노스 · BYU 백여울 |
| daeyeon 대연궁 검시록 | IHW 이화 · SRY 설련 · JOK 정옥 · WLH 월하 · DNB 단비 |
| baekya 백야호 | SHJ 서하진 · HRN 홍레나 · CYR 차유리 · MSO 미소 · YDG 윤도경 |
| sipjeol 십절곡 | NGS 남궁설 · DSS 당소소 · HWN 혜원 · MKR 묵란 · HRN 화린 |
| 1:1 | BY 백연 · KAEL 카엘 · SDY 서도윤 · HGU 한겨울 · YHR 윤해라 |

한국 이름은 성·이름 첫 자음(한서윤 → HSY), 외국 이름은 짧은 로마자(카시안 → KAS). 작품 안에서만 안 겹치면 돼요(다른 작품의 SHJ·HRN은 다른 사람).
