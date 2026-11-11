# 여성향 일상 화풍 (보관본)

여성향 작품의 **남성 인물** 그림에 쓰는 기본 화풍(`fdaily`)을 앱 코드와 떼어 보관한 것입니다. 남성향 일상(`archive/style-mdaily/`)과 짝입니다.

- 원래 값(2026-11-06): 사용자와 43라운드 비교 생성으로 정함. 2026-11-08 정리 때 코드와 함께 빠져, 그동안 로컬 git 태그 `archive/before-reset-2026-11-08`의 `src/js/images/style-fdaily.js`(값)·`src/js/images/styles.js`(등록·사람 없는 그림)에만 있었습니다.
- **v7(2026-11-10 확정)**: 남성향 일상 v6과 함께 다듬은 판. 어깨를 넓히고, 피곤한 기색을 빼고, 얼굴을 더 매력 있게, 작품 장소를 흐린 배경으로 넣었습니다. **그림은 이 값으로 만듭니다.**

## 파일

| 파일 | 내용 |
| --- | --- |
| `fdaily.json` | 원래 값(2026-11-06) 그대로: 모델·LoRA·생성 설정·프롬프트(따뜻한/차가운 색조)·네거티브·조건(fits)·후처리·사람 없는 그림 |
| `fdaily-v7.json` | **확정 값.** 바뀐 칸만이 아니라 프롬프트·네거티브·조건·후처리 전부. 더해서 `lead`(앞쪽 몸 문구)·`bg`(배경 규칙)·`sceneTag0`(칸 0 장면 태그)·`tagFixes`(이번에 고친 작품 태그) |
| `prompts-v7.json` | 출연진의 남성 28명 × 칸 0(프로필)·1(기본) = 56개의 **완성된** 긍정·부정 프롬프트(작품 태그를 고친 뒤의 값). 외부 도구에 그대로 붙여 넣으면 됨 |
| `samples/` | v7로 만든 견본 3장(384px) |

조립 함수(`fitStyle`·`weighTags`)와 후처리(`stylePost`)는 남성향 일상과 같은 코드라 `archive/style-mdaily/code/`를 씁니다.

## 생성 설정

| 항목 | 원래 | v7 |
| --- | --- | --- |
| 모델 | Run七八造 v2 — 세미리얼 PonyXL `civitai:548016@861939` (Pony 계열) | 같음 |
| LoRA | Add More Details `civitai:390892@1286572` 0.1 · KoreanAI `civitai:690861@773211` 0.3 · Age Slider `civitai:468265@539667` **0.8** | 앞의 둘 같음 · Age Slider **0.4** |
| 샘플러 | DPM++ 2M Karras, 35 steps, CFG 4.5 | 같음 |
| 크기 | 832×1216 | 같음 |
| 가중치 문법 | `(태그:1.2)` — Runware면 `promptWeighting: "sdEmbeds"` | 같음 |
| 모델 기본 네거티브 | 쓰지 않음 | 같음 |
| 후처리 | 회색 베일(가장자리 채도를 빼고 살짝 어둡게) | 같음 |

## 프롬프트 조립 순서(v7)

**긍정:** 품질(`score_9, score_8_up, score_7_up`) → 수위(`rating_safe`) → 장면·표정(칸 태그) → `1boy, male focus, solo` + 인물 태그 → **앞쪽 몸 문구(`lead`)** → 배경(`bg`) → 화풍 문구

- 장면·인물 태그에는 내용 가중치 1.3, 표정 태그에는 1.15를 붙입니다(`weighTags`).
- 화풍 문구는 머리색으로 고르고(검은 머리 `coolPrompt` + `blackTag`, 은발·회색·흰 머리 `coolPrompt`, 그 밖 `prompt`), 그림 내용이 정한 것은 덮지 않습니다(`fits` — 자기 머리 모양이 있으면 리프컷을 빼고, 구도·각도를 정한 장면이면 정면·카우보이 샷을 뺌).
- 남성 인물이라 화풍 문구에서 여성용 낱말을 지웁니다: 이름에 `makeup`·`lip`·`eyelash`·`glamorous`·`cute`·`kawaii`·`beautiful`·`female`·`woman`·`eyeshadow`·`eyeliner`·`blush`가 든 태그.

**부정:** 품질 네거티브 → 규격(`IMG_NEG` — 배경을 넣으므로 `blurry`는 뺌) → 미성년 금지(`NEG_MINOR`, 늘 넣음) → 수위 네거티브 → 남성용(`1girl, female, breasts, makeup, lipstick, feminine`) → 화풍 네거티브(인물이 정한 것은 뺌)

`prompts-v7.json`은 이 과정을 돌린 결과라 다시 조립할 필요가 없습니다.

### 앞쪽 몸 문구(`lead`) — v7에서 새로 생긴 규칙

`(broad shoulders:1.5), (wide shoulders:1.2), athletic build, (handsome:1.3)`을 **인물 태그 바로 뒤, 배경 앞**에 넣습니다.

- SDXL은 프롬프트를 77토큰씩 끊어 읽습니다. 화풍 문구는 긴 프롬프트의 뒤쪽 덩어리에 있어, 거기서 어깨 가중치를 1.8까지 올려도 시드가 정한 몸통이 거의 바뀌지 않았습니다. 앞쪽에 둬야 어깨가 넓어집니다.
- 그렇다고 맨 앞(인물 태그 앞)에 두면 인물 태그가 첫 덩어리에서 밀려나 옷이 바뀝니다. 검은 정장이 흰 정장으로, 군복이 녹색으로, 정장에 훈장이 붙었습니다. 그래서 인물 태그 뒤입니다.
- `muscular male`은 넣지 않습니다. 가죽옷·목줄을 끌어옵니다.

### 배경(`bg`)

`(blurry background:1.5), (depth of field:1.3), light haze, (<장소 낱말>:0.8)` — 장소 낱말은 작품의 artTags·장소(MP)에서 고릅니다. 네온·보케·술병처럼 센 낱말은 흐려지지 않고 또렷하게 그려져 뺍니다. `hanok`은 모델이 몰라 서양 아치를 그리므로 `traditional korean house`로 씁니다. `prompts-v7.json`에 작품마다 쓴 낱말이 들어 있습니다.

### 칸 0(프로필)

`upper body, looking at viewer, light smile, relaxed expression, soft gaze` — 원래 장면 태그에서 `half-lidded eyes`를 뺐습니다(피곤해 보임). 칸 1도 같은 낱말을 뺍니다.

## v7에서 바꾼 것(원래 대비)

| 무엇 | 뺀 것 | 더한 것 |
| --- | --- | --- |
| 몸·어깨 | `(broad shoulders:1.4)`, `(broad chest:1.2)` | `(broad shoulders:1.8)`, `(wide shoulders:1.4)`, `(small head:1.3)`, `(broad chest:1.25)`, `(toned body:1.2)`, `athletic build`, `manly` |
| 얼굴 | | `(handsome:1.4)`, `(attractive:1.15)`, `(charming:1.1)`, `(detailed eyes:1.15)`, `(shiny hair:1.05)`, `hair highlights` |
| 나이 | `(33 years old:1.3)` | `(28 years old:1.2)` · Age LoRA 0.8 → 0.4 |
| 색 | `soft … palette` | `(desaturated:1.25)`, `muted … palette` |
| 피부 | `(pale skin:1.3)` | `(pale skin:1.35)` |
| 정장 조건(`fits`) | 목을 길게(`(long neck:1.3), (thick neck:1.25)`) + 긴 목 네거티브 빼기 | `(thick neck:1.3), (trapezius:1.15)` — 정장도 목이 굵게, 네거티브는 그대로 |
| 네거티브에서 뺌 | `(pretty boy:1.3)`, `(bishounen:1.3)`(미남 얼굴까지 막음), `(pectorals:1.3)`, `(blurry background:1.2)`(배경을 흐리게 넣으므로) | |
| 네거티브에 더함 | | 주름(`wrinkles`·`nasolabial folds`·`crow's feet`), 피곤(`sleepy`·`exhausted`·`dark circles`·`droopy eyes`·`sickly`), 마른 몸(`slim`·`slender`·`thin arms`·`thin`·`sloping shoulders`), 목줄(`choker`·`studded choker`·`belt collar`), 과한 조명·배경(`rim light`·`detailed background`·`dramatic lighting`·`cinematic lighting`) |

## 쓰면 안 되는 낱말(비교 생성에서 확인)

**머리**
- `wolf cut`·`leaf` → 짐승 귀·나뭇잎이 붙음
- `ash hair` → 진갈색. 회색은 `grey hair`
- `hair sheen` → 머리가 갈색으로 번짐
- `hair down`·`loose hair` → 머리가 길어짐
- `shoulder-length hair` → 길이가 들쭉날쭉
- `ponytail`만 쓰면 낮게 처짐 → `high ponytail`·`hair bun`
- 이름에 `lip`이 든 태그는 위의 남성용 정리가 조용히 지움(`flipped`·`clip`·`thin lips`) → 리프컷의 끝 말림은 `ends curving outward`

**옷·소품**
- 목 근처의 `collar`(`open collar` 포함) → 초커·목줄. 셔츠 깃은 `collared shirt`
- `muscular male` → 가죽옷·목줄
- `plain t-shirt` → 오히려 무늬가 생김. 민무늬 속옷은 `white undershirt`
- `sweater`와 `neck`이 함께 있으면 터틀넥
- `navy` → 제복
- `bomber jacket` → 패치가 붙음
- `adam's apple` → 사과를 그림
- `soft brush strokes` → 손에 붓을 쥠
- 겉옷만 적은 인물(방화복·앞치마)은 그 속이 맨가슴으로 나옴. 맨살 네거티브로는 안 막히고, **안에 입은 옷을 작품 태그에 적어야** 잡힘

**옷 색이 설정과 다를 때** — 작품 태그에 색과 옷을 쉬운 낱말로 더하면 잡힙니다.
- `black three-piece suit`만으로는 흰 정장 → `black suit jacket, black waistcoat, black necktie`
- `white shirt`를 적으면 흰색이 재킷으로 번지고, `white dress shirt`는 흰 치마를 부름
- `ornate uniform`은 배경까지 금장식 → `gold trim`
- `black military uniform`만으로는 진녹색 → `black jacket`
- `feather-trimmed coat`·`black robe`는 가슴이 드러남 → `black shirt, high collar`

**그 밖**
- 눈 색 네거티브(`purple eyes`·`green eyes`)는 다른 인물의 눈을 빨갛게 만들어 쓰지 않음

## 이번에 고친 작품 태그(v7과 같은 커밋)

| 인물 | 작품 | 고친 것 | 이유 |
| --- | --- | --- | --- |
| LEO 레온하르트 | `content/f/fate/hwanghu` | `open collar` → `collared shirt` | 목줄이 그려짐(시드 3개 모두) — 고친 뒤 사라짐 |
| HIG 한이결 | `content/f/fate/lethe` | `dark red hair` 앞에 `burgundy hair` | 갈색으로 나옴 — 고친 뒤 붉은 기가 돎 |
| RGN 류건 | `content/m/godseats` | `scorched firefighter jacket` 앞에 `black t-shirt` | 방화복 속 맨가슴 |
| KTH 강태하 | `content/f/fate/hasuk` | `black apron` 앞에 `white shirt` | 앞치마 속 맨몸 |

AI 대화에는 쓰이지 않는 그림용 태그(`tags`)만 고쳤습니다.

## 알려진 한계

- **나이 많은 인물이 젊게 나옴**(반석호 58세·장태산 36세 큰 덩치): 화풍이 나이를 28세로 고정하고 주름을 네거티브로 막기 때문입니다. 인물 나이가 있으면 화풍 나이·주름 네거티브를 바꾸는 조립 규칙이 따로 필요합니다(아직 없음). 남성향 일상(여성 인물)도 같습니다.
- **이한결의 검은 티셔츠에 프린트가 남음**: 셔츠 낱말을 바꾸거나 피곤 낱말을 빼도 그대로였습니다. 검은 티 + 헤드폰 조합에 붙은 모델 습관이라, 프린트 없는 시드를 골라 씁니다.
- **강태하의 `burn scar on forearm`이 얼굴 흉터로 나옴**: 시드를 고르거나 태그를 다듬을 일입니다.
- 실내 장면에 액자가 자주 걸림, 눈가 붉은 기, 회색 머리는 다른 색보다 어려 보이기 쉬움, 눈 색을 정하지 않은 인물은 파란 눈이 되기도 함(원래 값 때부터)
- 정장·넘긴 머리는 몇몇 시드에서 고개가 조금 돌아감
- 그림은 저장하기 전에 눈으로 확인할 것

## 사람이 없는 그림

이 화풍은 동물만 시켜도 사람을 함께 그립니다. 사람 없는 그림은 `noHumans`의 WAI Illustrious v14(`civitai:827184@1761560`)와 짧은 문구를 씁니다. YabaL Mix는 그림 판매가 안 되어 처음부터 쓰지 않았습니다.

## 라이선스

- 그림 원칙(관리자만 만듦·참고 그림 커밋 금지·모든 인물 성인·키를 채팅과 저장소에 넣지 않기)과 모델별 상업 조건은 `archive/style-mdaily/README.md`의 '라이선스' 절을 따릅니다.
- Run七八造와 두 LoRA는 Pony 계열이라, 수익 모델 서비스에서 쓰려면 **PurpleSmart 허가**가 필요합니다. 문의 메일 초안은 같은 README 부록에 있고, 아직 보내지 않았습니다.
- **Age Slider LoRA(`civitai:468265`)의 상업 조건은 아직 확인하지 않았습니다.** 유료 출시 전에 확인합니다.
- WAI(사람 없는 그림)는 그림 판매 O, 앱 안 생성 X입니다.
