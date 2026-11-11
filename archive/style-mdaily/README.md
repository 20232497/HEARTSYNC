# 남성향 일상 화풍 (보관본)

남성향 작품의 **여성 인물** 그림에 쓰던 기본 화풍(`mdaily`)을 앱 코드와 떼어 보관한 것입니다.
2026-11-08 개발 환경 정리 때 그림 생성 코드를 걷어 내기 전에, 그대로 다시 쓸 수 있게 값과 조립 순서를 남겼습니다.

- 정한 과정: 2026-11-05 사용자와 19라운드 비교 생성으로 확정, 2026-11-06 정면·표정·얼굴 다양화 보정
- 원래 위치: `src/js/images/styles.js`(값), `src/js/images/style-fit.js`(인물에 맞추기), `src/js/images/runware.js`(조립·후처리), `src/js/images/prompt.js`(장면 태그)
- 정리 직전 전체 코드는 git 태그 `archive/before-reset-2026-11-08`에 그대로 있습니다
- **v6(2026-11-10 확정)**: 배경·마감·얼굴을 다듬은 판 — 아래 v6 절. **그림은 v6 값으로 만듭니다.** 짝인 여성향 일상(남성 인물)은 `archive/style-fdaily/`

## 파일

| 파일 | 내용 |
| --- | --- |
| `mdaily.json` | 화풍의 모든 값: 모델·LoRA·생성 설정·프롬프트(따뜻한/차가운 색조)·네거티브·조건(fits)·후처리·고정 태그·장면 태그(칸 0~14) |
| `prompts.json` | 남성향 작품 여성 인물 23명 × 칸 0(프로필)·1(기본) = 46개의 **완성된** 긍정·부정 프롬프트. 외부 도구에 그대로 붙여 넣으면 됨 |
| `samples/` | 이 화풍으로 만든 견본 3장(384px). `mdaily-v6-1~3.jpg`는 v6 견본 |
| `mdaily-v6.json` | **v6 확정 값.** 프롬프트·네거티브·후처리 전부와 배경 규칙(`bg`). 바꾸지 않은 칸(사람 없는 그림·고정 태그·장면 태그)은 `mdaily.json` |
| `prompts-v6.json` | v6로 조립한 완성 프롬프트 — 여성 인물 25명 × 칸 0·1 = 50개 |
| `code/style-fit.js` | 인물 태그에 맞춰 화풍 문구를 고르는 순수 함수(`fitStyle`·`weighTags`) 사본 |
| `code/post.js` | 그림을 받은 뒤 캔버스에서 입히는 후처리(`stylePost`) 사본 |

## v6 — 2026-11-10 확정(그림은 이 값으로)

원래 값(아래 '생성 설정'부터의 설명)에서 배경·마감·얼굴을 다듬은 판입니다. 여성향 일상 v7(`archive/style-fdaily/`)과 함께 정했습니다. 모델·LoRA·샘플러·크기·조건(`fits`)·고정 태그·사람 없는 그림은 원래 값 그대로입니다.

**조립 순서:** 원래 순서에서 인물 태그와 화풍 문구 사이에 **배경**이 들어갑니다(`bg`).
- `(blurry background:1.5), (depth of field:1.3), light haze, (<장소 낱말>:0.8)`
- 장소 낱말은 작품의 artTags·장소(MP)에서 고릅니다. 네온·보케·술병처럼 센 낱말은 흐려지지 않고 또렷하게 그려져 뺍니다.
- `hanok`은 모델이 몰라 서양 아치를 그리므로 `traditional korean house`로 씁니다.
- 배경을 흐리게 넣으므로 규격 네거티브(`IMG_NEG`)의 `blurry`는 뺍니다.

**바꾼 것(원래 대비)**

| 무엇 | 뺀 것 | 더한 것 |
| --- | --- | --- |
| 각도 | `(straight-on:1.25)`, `(front view:1.1)` | `(head tilt:1.1)` — 정면은 남기고 고개만 살짝 |
| 색·마감 | `muted … palette`, `(muted eye color:1.2)`, `natural eyes`, `(pastel colors:1.1)` | `… palette`, `(shiny hair:1.05)`, `hair highlights`, `(eye highlights:1.1)`, `light blush` |
| 얼굴 | `small nose`, `small mouth` | `(small face:1.2)`, `(small head:1.15)`, `(defined facial features:1.2)`, `(sharp features:1.1)`, `(defined eyes:1.2)`, `(sharp nose:1.1)`, `(double eyelids:1.1)`, `(beautiful face:1.2)`, `(beautiful detailed eyes:1.15)`, `(glossy lips:1.05)`, `(charming:1.1)` |
| 몸 | | `(slender body:1.25)`, `(slim:1.15)`, `(narrow shoulders:1.1)` |
| 네거티브 | | 머리색 번짐 `(gradient hair:1.3)`, `(multicolored hair:1.3)` · 노출 `(cleavage:1.5)`, `revealing clothes`, `(low neckline:1.3)`, `(breast focus:1.3)`, `(collarbone:1.2)`, `(large breasts:1.2)`, `sleeveless`, `bare shoulders` · 몸 `(broad shoulders:1.3)`, `(muscular female:1.3)`, `(thick arms:1.2)`, `(wide face:1.2)`, `(vest:1.1)` · 목 `(long neck:1.2)` · 조명 `(rim light:1.1)`, `(detailed background:1.2)` |

- 목: 세라나(SRN)의 목이 길어 보여, 긍정의 긴 목 문구를 빼고 네거티브에 `(long neck:1.2)`를 넣었습니다. 좁은 어깨도 1.2 → 1.1로 낮췄습니다(목이 더 길어 보임).
- 머리 윤기 문구는 옷 색을 머리로 번지게 해서(연두 저고리 → 연두 머리) 머리색 네거티브를 같이 넣었습니다.

**후처리:** 원래 후처리(`lift`·`soft`·`blur`)에 **가장자리 채도 빼기**를 더했습니다. `veil: { center: 0, edge: 0.4, mul: "rgb(255,255,255)", a: 0 }` — 어둡게 하거나 회색을 덮지 않고, 가운데에서 멀수록 채도만 최대 40% 뺍니다. 배경이 인물보다 가라앉아 경계가 부드러워집니다. 코드는 `code/post.js` 그대로입니다.

**v6에서 본 한계**
- 나이 많은 인물이 젊게 나옴(홍 여사 40대): 화풍의 성숙 태그가 나이를 하나로 정하기 때문입니다. 인물 나이를 쓰는 조립 규칙이 따로 필요합니다(아직 없음).
- 미소(MSO)의 `gear pendant`(톱니 문양 목걸이)가 십자가로 나옴
- 세라나는 몇몇 시드에서 깃이 V자로 열림(가슴골은 없음 — 그대로 둠)

## 생성 설정

| 항목 | 값 |
| --- | --- |
| 모델 | Run七八造 v2 — 세미리얼 PonyXL `civitai:548016@861939` (Pony 계열) |
| LoRA | `civitai:390892@1286572` 0.3, `civitai:690861@773211` 0.3 (Add More Details·KoreanAI) |
| 샘플러 | DPM++ 2M Karras, 35 steps, CFG 5 |
| 크기 | 832×1216 (세로 4:5·3:4 공통) |
| 가중치 문법 | `(태그:1.2)`를 쓰므로 Runware면 `promptWeighting: "sdEmbeds"` |
| 모델 기본 네거티브 | 쓰지 않음(`modelNeg: false`) |

## 프롬프트 조립 순서

순서가 중요합니다. 장면·표정이 화풍보다 뒤에 오면 표정이 무시됩니다.

**긍정:** 품질(`score_9, score_8_up, score_7_up`) → 수위(`rating_safe`) → 장면·표정(칸 태그) → 인물(`1girl, solo` + 인물 태그) → 배경 → 화풍 문구

- 장면·인물·배경 태그에는 내용 가중치 1.2, 표정 태그에는 1.1을 붙입니다(`weighTags`). 화풍 태그가 1.2~1.5라 가중치가 없으면 옷·머리가 묻힙니다.
- 화풍 문구는 인물의 머리색으로 고릅니다(`fitStyle`).
  - 검은 머리: `coolPrompt` + `blackTag` — 피부를 더 하얗게
  - 은발·회색·흰 머리: `coolPrompt`
  - 그 밖: `prompt`(따뜻한 색조)
- 인물 태그에 `forehead`·`parted bangs`·`curtain bangs` 등이 있으면 빽빽한 앞머리 태그와 그 네거티브를 뺍니다.
- 장면이 각도·행동·시선을 정하면(`fits`) 정면 태그와 손 네거티브를 뺍니다.

**부정:** 품질 네거티브 → 규격(`IMG_NEG`) → 미성년 금지(`NEG_MINOR`, 늘 넣음) → 수위 네거티브 → 화풍 네거티브(인물이 정한 것은 뺌)

`prompts.json`은 이 과정을 실제 코드로 돌린 결과라 다시 조립할 필요가 없습니다.

## 후처리

태그로는 전체 밝기와 흐림이 움직이지 않아, 그림을 받은 뒤 브라우저 캔버스에서 입혔습니다(`code/post.js`).

- `lift: rgb(11,11,15)`를 screen으로 더하고, 흰색을 soft-light 0.08로 겹침
- 1/3로 줄였다 키운 사본을 0.6만큼 겹쳐 전체를 부드럽게
- 외부 도구로 만들면 이 단계가 빠지므로, 같은 느낌을 내려면 이미지 편집기에서 비슷하게 입히거나 `post.js`를 돌리세요

## 사람이 없는 그림

이 화풍은 사람을 그리는 데 맞춰져 있어 고양이만 시켜도 사람을 함께 그립니다. 사람 없는 그림은 `noHumans`의 모델(YabaL Mix)과 짧은 문구를 썼습니다. **YabaL Mix는 이미지 판매가 허용되지 않아** 유료 서비스에서는 다른 모델로 바꿔야 합니다.

## 인물 태그

얼굴이 서로 달라 보이는 것은 화풍이 아니라 **인물 태그** 덕분입니다. 23명의 눈매·눈썹·앞머리·점 태그는 각 작품의 `content/m/…/work.js`(`tags`·`lookTags`)에 있습니다. 새 인물도 눈매·눈썹을 태그에 넣어야 같은 얼굴로 몰리지 않습니다.

## 알려진 한계

- 옷의 글자·무늬는 네거티브로도 다 막지 못함
- 정면의 군복 인물은 시드에 따라 금테 액자가 남음
- 전신 구도에서 아래옷을 정하지 않은 인물은 맨다리로 나오기도 함
- 그림은 저장하기 전에 눈으로 확인할 것

## 라이선스

Pony 계열(Run七八造와 두 LoRA)은 **수익 모델 서비스 안에서 돌리면** PurpleSmart의 허가가 필요합니다. 관리자가 만들어 정적 그림으로 싣는 경우의 해석도 PurpleSmart에 물어 확인해야 합니다. **문의 메일은 아직 보내지 않았고**, 초안은 아래 부록에 있습니다. 모델별 자세한 조건은 `docs/COMMERCIALIZATION.md` §8에 있습니다.

> 이 절과 부록은 화풍 작업 인계 지침서(PR #36, 2026-11-05)에서 옮겨 왔습니다. 그 지침서에 있던 앱 안 생성 절차(관리자 도구·비교 하네스)는 2026-11-08 정리 때 코드가 빠져서 옮기지 않았습니다. 원문은 `docs/style-handoff` 브랜치에 남아 있습니다.

### 그림 원칙(바꾸지 않기)

1. **그림은 관리자만 만든다.** 관리자가 앱 밖에서 만들고 골라 `content/<aud>/<id>/images/`에 싣습니다(커밋 → 배포). 이용자는 보기만 하고, 이용자가 그림을 만드는 기능은 없습니다.
   - 이유: Pony 계열 모델은 수익 모델 앱 안에서 돌리는 것이 금지(허가 필요)지만, **만든 그림을 파는 것은 허용**됩니다. 미리 만들어 싣는 방식은 뒤쪽에 해당합니다.
   - 이용자 요청에 맞춰 서버가 그때그때 그리면 다시 '생성 서비스'가 됩니다. 그렇게 하지 않습니다.
2. **YabaL Mix로 만든 그림은 상업적으로 쓸 수 없습니다**(그림 판매 X). 출시 전에 모두 바꿔야 할 대상입니다. 새 화풍은 처음부터 **그림 판매가 허용되는 모델**로 만듭니다.
3. **모든 인물은 성인입니다.** 장면 태그에 `adult woman, mature female` 또는 `adult man`을 넣고, 기본 수위는 safe입니다.
4. **참고 그림은 공개 저장소에 절대 커밋하지 않습니다.** 견본은 우리가 만든 384px 그림(`samples/`)만 씁니다.
5. **Runware 키는 채팅에 붙여 넣지 않고**, 저장소에도 넣지 않습니다.

### 모델별 상업 조건 요약

| 모델 | 그림 판매 | 앱 안 생성 | 비고 |
|---|---|---|---|
| Run七八造 v2 · Add More Details · KoreanAI | O | Pony 라이선스상 허가 필요 | 남성향 일상(이 화풍) |
| YabaL Mix | **X** | X | 바꿔야 할 대상(이 화풍의 `noHumans`) |
| Hassaku XL | O | O | Illustrious 계열(비공개 병합 수익화 금지) |
| WAI · semILust | O | X | |
| **Animagine XL 4.0** | O | O | **조건이 가장 깔끔**(CreativeML Open RAIL++-M) |

### 남은 일(인계 지침서 §5 기준)

1. 아래 부록의 문의 메일 보내기 — 답이 몇 주 걸릴 수 있어 가장 먼저
2. 여성향 일상 — YabaL 대체 모델 비교(그림 판매 O 모델만 후보)
3. 유료 출시 전 — YabaL 쓰는 화풍 모두 교체, Pony 허가 결과에 따라 남성향 일상 유지 또는 교체

남성향 애니 화풍 비교(Hassaku XL·Animagine XL 4.0, 2라운드까지)의 기록은 `docs/style-handoff` 브랜치 `docs/STYLE-HANDOFF.md` §3에 있습니다. 그때 추천은 라이선스가 가장 깔끔한 Animagine XL 4.0이었습니다.

## 부록. PurpleSmart 문의 메일(보내기 전 서명에 이름·이메일 넣기)

3절은 2026-11-08 정리에 맞춰 '앱 밖 도구'로 고쳤습니다. 그 밖의 내용은 지침서 원문 그대로입니다.

```
To: contact@purplesmart.ai
Subject: Commercial use inquiry: Pony Diffusion V6 XL derivatives in a Korean character chat app (HEART SYNC)

Hello PurpleSmart team,

I am the developer of HEART SYNC, an independent character chat and interactive story web app being developed in South Korea. I would like to confirm the license terms for Pony Diffusion V6 XL and models based on it before our commercial launch, and ask for permission where it is needed.

1. About the service

- HEART SYNC is a web app where users read and chat with original characters in illustrated story worlds.
- We plan to make money through in-app currency and a monthly membership (about 9,900 KRW, roughly 7 USD). There is no paid feature yet, and the app is still in development.
- All characters are adults. We block sexual content involving minors, or characters who look like minors, in every setting. Images are generated as safe-for-work by default.

2. Models we use (all based on Pony Diffusion V6 XL, run through the Runware API)

- Run七八造 v2 (checkpoint, Civitai model 548016)
- Add More Details (LoRA, Civitai model 390892)
- KoreanAI Style (LoRA, Civitai model 690861)

3. How we generate images now

End users cannot generate images in the app. Only our administrator (me) generates images, with a separate tool outside the app. I review them by hand, then ship the chosen ones with the app as static files (character portraits, world illustrations and cover art). Users only view these pre-made images. No Pony-based model runs in response to a user request.

4. Questions

Q1. Under your license, may we use images that our administrator generates with the models above (as described in section 3) commercially inside a paid app? This includes showing them to paying users and using them in marketing.

Q2. Is it allowed to generate these images through a third-party paid inference API (Runware), or should we run the models on our own hardware?

Q3. In the future we may let users generate images on demand inside the app as a paid feature. Would this need a separate commercial license from you? If so, what are the terms and the process?

Q4. Could we use images we generated with these models as training data for a style LoRA on a different base model (for example, Animagine XL 4.0)?

Q5. Civitai lists Pony Diffusion V6 XL under a modified Fair AI Public License 1.0-SD, but the Hugging Face page lists CreativeML OpenRAIL-M. Which license applies, and does it also cover the derivative checkpoint and LoRAs above?

If you need more details, such as screenshots of the app or a description of our safety filters, I will be glad to send them. Thank you for your time and for your work on Pony Diffusion.

Best regards,
[Your name]
HEART SYNC developer
[your email]
https://20232497.github.io/HEARTSYNC/
```
