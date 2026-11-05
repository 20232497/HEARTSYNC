# 화풍 작업 인계 지침서 (2026-11-05 기준)

다음 세션(로컬 PC)에서 그대로 이어가기 위한 정리. 앱 전체 규칙은 `CLAUDE.md`, 모델 라이선스는 `docs/COMMERCIALIZATION.md` §8.

---

## 0. 지금 상태 한눈에

| 항목 | 상태 |
|---|---|
| 남성향 일상(`mdaily`) | **확정·main 병합(PR #34)** — Run七八造 v2 + LoRA 2개, 후처리 t½ |
| 그림 생성 관리자 전용 | **main 병합(PR #35)** — Runware 호출 앞 관리자 계정 확인 + 사용자 빌드 검사 |
| 모델 라이선스 | 정리 끝(§8). Pony 계열은 PurpleSmart 허가 대기 — **문의 메일 아직 안 보냄**(부록 A) |
| 남성향 애니(`manime`) | **2라운드까지 비교, 3라운드 준비** ← 다음 작업 |
| 여성향 일상(`fdaily`) | 애니 다음. **YabaL은 그림 판매 금지라 모델 교체가 전제** |
| 동물·배경 그림 | 사용자가 뒤로 미룸 |
| 화풍 확정 뒤 물어볼 것 | ① 세계관 항목을 설정 화면에서 숨길지 ② 그림체 프리셋을 지우고 직접 입력만 남길지 |

---

## 1. 결정된 원칙 (바꾸지 않기)

1. **그림은 관리자만 만든다.** 관리자가 만들어 고른 것을 `content/<aud>/<id>/images/`에 싣고(관리자 도구 '작품 폴더에 저장' → 커밋 → 배포), 이용자는 보기만 한다. 이용자 생성 기능은 없음.
   - 이유: Pony 계열 모델은 "수익 모델 앱 안에서 돌리는 것"이 금지(허가 필요)지만, **만든 그림을 파는 것은 허용**. 미리 만들어 싣는 방식은 후자.
   - 이용자 요청에 맞춰 서버가 그때그때 그리면 다시 "생성 서비스"가 됨 → 하지 않기.
2. **YabaL Mix로 만든 그림은 상업적으로 못 씀**(그림 판매 X). 지금 YabaL을 쓰는 곳: `fdaily`, `fworld`, `mworld`, `mdaily.noHumans`. 출시 전 전부 교체 대상. 새 화풍은 처음부터 **그림 판매 O 모델**로.
3. **모든 인물은 성인.** 장면 태그에 `adult woman, mature female` / `adult man`. 기본 수위 safe.
4. **참고 그림(PC의 `HEART SYNC\HeartServe이미지!` 폴더)은 공개 저장소에 절대 커밋 금지.** 견본은 우리가 만든 384px `styles/<id>-1~3.jpg`만.
5. **Runware 키는 채팅에 붙여 넣지 않기.** 로컬에서는 앱 설정(localStorage)에만.

### 모델별 상업 조건 요약 (자세히는 §8 표)

| 모델 | 그림 판매 | 앱 안 생성 | 비고 |
|---|---|---|---|
| Run七八造 v2 · Add More Details · KoreanAI | O | Pony 라이선스상 허가 필요 | 남성향 일상 |
| YabaL Mix | **X** | X | 교체 대상 |
| Hassaku XL | O | O | Illustrious 계열(비공개 병합 수익화 금지) |
| WAI · semILust | O | X | |
| **Animagine XL 4.0** | O | O | **조건이 가장 깔끔**(CreativeML Open RAIL++-M) |

---

## 2. 관리자 전용 생성 — 로컬에서 알아둘 것 (PR #35)

- `src/js/images/gen-guard.js` `assertAdmin()`을 `runwareImage`(그림)와 `admin/motion-run.js rwTask`(움짤)가 먼저 부름.
- **localhost·127.0.0.1에서는 확인 없이 통과** → `npm run dev`로 여는 로컬 관리자 도구는 지금처럼 그대로 생성됨.
- 웹 주소(GitHub Pages의 admin.html)·file://에서는 **Supabase 로그인 + `admins` 표에 있는 계정**만. MY → 이미지 생성 칸 맨 위에 권한 상태가 뜸.
  - **할 일:** 본인 계정이 `admins` 표에 있는지 확인. 없으면 화면이 알려 주는 `insert into public.admins …` 한 줄을 Supabase SQL Editor에서 실행.
- 빌드 검사 `checkNoGen`(tools/build.mjs): index.html에 생성 코드가 섞이면 빌드 실패.
- 관리자 비밀번호 관문(admin/gate.js)은 해시가 공개 저장소에 있음 → 12자 이상으로 바꾸기 권장(HASH 교체).

---

## 3. 남성향 애니 — 지금까지

현재 앱의 `manime`(styles.js)은 **아직 옛 문구**(Hassaku + `(anime key visual:1.3)` …). 화풍 확정 때 통째로 바꾼다.

### 공통 조건
- 시드 **7101~7104**(장면별 고정), 비율 **4:5**, rating **safe**
- 모델
  - **Hassaku XL** `civitai:140272@1617798` (arch illustrious)
  - **Animagine XL 4.0** `civitai:1188071@1408658` (arch sdxl, **CFG 5**, 품질 pos `high score, great score, absurdres`, neg `low score, bad score, average score`)
  - Animagine 3.1·Nova Anime XL은 Runware에서 로드 실패(failedModelLoad)
- 장면(모두 앞에 `adult woman, mature female`, 4번만 남자)
  1. 검은 머리·붉은 그라데이션·호박색 눈·베이지 트렌치코트·붉은 초커·흰 배경
  2. 금발·녹안·붉은 장미 장식·금 귀걸이·보석 목걸이·미소·어두운 배경
  3. 은발·청안·남색 터틀넥·은 십자가·번개·어두운 배경
  4. `1boy, adult man`, 짧은 검은 머리·녹안·검은 재킷·금 월계 장식
- 공통 네거티브: `key, keychain, skeleton key, grey skin, (shadow over face:1.2), half-shaded face, wrinkles, old woman, realistic, 3d`
  - Animagine 추가: `(colorful:1.2), rainbow, multicolored hair, paint splatter, red skin, colored skin`

### 1라운드 (20장) — Hassaku(b1)·Animagine 4.0(b2)·WAI(b3)
모두 참고 그림보다 평면적(머리칼 광택·눈매·먹 효과 부족). WAI는 탈락.

### 2라운드 (16장) — c1~c4
- **c1 (Hassaku)**: `anime coloring, game cg, official art, (thin lineart:1.2), sharp lineart, cel shading, (bright face:1.1), shadow under hair, (sharp eyes:1.2), (detailed iris:1.2), glowing eyes, thick eyelashes, eyeliner, light blush, small nose, (thin hair strands:1.3), flyaway hair, (glossy hair:1.3), (shiny hair highlights:1.2), ink splatter, sparkle, floating particles, intricate jewelry, detailed clothes, high contrast, dramatic lighting`
- **c2** = c1 + `(sketchy ink lines:1.2), ink wash, painterly highlights, intricate details`
- **c3 (Animagine)**: `anime coloring, game cg, official art, (thin lineart:1.2), sharp lineart, cel shading, (bright face:1.1), shadow under hair, (sharp eyes:1.2), detailed iris, thick eyelashes, light blush, small nose, thin hair strands, flyaway hair, (glossy hair:1.2), hair highlights, sparkle, intricate jewelry, detailed clothes, (limited palette:1.2), restrained colors`
- **c4** = c3, CFG 3.5

관찰
- c1: 눈·머리 광택 좋음 / **피부가 갈색으로 변함, 파인 옷이 나옴**
- c3: 선이 가장 섬세 / **색이 너무 빠짐**
- `key visual` 태그 → 열쇠를 그림(현재 manime 문구에 남아 있음, 확정 때 제거)
- `dramatic lighting`·`glowing eyes` → 피부가 어두워지고 눈이 형광
- `limited palette`는 너무 셈
- **두 모델 다 남자를 긴 머리로 그림**

**사용자 2라운드 평가는 아직 못 받음** — 3라운드 전에 c1~c4에 대한 한 줄 평을 먼저 물어볼 것.

### 3라운드 계획 (제안, 16장 = 4장면 × 4안)

| 안 | 기준 | 변경 |
|---|---|---|
| d1 | c3 Animagine | `(limited palette:1.2), restrained colors` 빼고 `rich colors` · `(glossy hair:1.3), (shiny hair highlights:1.2)` · 네거티브의 `(colorful:1.2)` 뺌(rainbow·multicolored hair는 유지) |
| d2 | d1 | + `ink splatter, sparkle, floating particles` |
| d3 | c1 Hassaku | `dramatic lighting`·`glowing eyes` 뺌 · + `(fair skin:1.1)` · 네거티브 + `dark skin, tanned skin, cleavage, revealing clothes` |
| d4 | d3 | + `soft rim lighting` |

모든 안 공통: 장면 4에 `(short hair:1.4)`, 네거티브 `long hair, ponytail`. `key visual` 쓰지 않음.

추천 방향: **Animagine(d1·d2)을 주력**(라이선스가 깔끔해 나중에 이용자 생성으로 넓혀도 바꿀 필요 없음), Hassaku는 비교용.

### 확정되면 할 일
1. `styles.js`의 `manime`을 확정 문구·모델·`neg`·`gen`(cfg 등)으로 교체(`mdaily`처럼 `neg`·`gen` 칸 사용 가능 — `styleFor`의 `sys()`가 넘겨줌). Animagine을 쓰면 `IMG_MODELS`에 추가(arch `sdxl`, pos/neg 위 값, cfg 5).
2. 견본 `styles/manime-1~3.jpg`(384px) 교체.
3. `npm run build` → `npm test` → `node tests/run.mjs admin images styles` → PR.

---

## 4. 비교 생성 방법 (로컬)

- `npm run dev` → `http://localhost:5173/ADMIN.HTML` (**대문자로 열면** 새로 고침 스크립트가 안 붙어 소스를 고쳐도 긴 생성이 끊기지 않음)
- 하네스 `samples-compare/harness.js`(git 제외, PC에 있음): 앱의 `runwareImage`를 fetch로 감싸 seed·CFG·네거티브를 덮어씀. 결과는 개발 서버 `POST /__dev/save?name=…`로 `.build/samples/`에 저장(키는 페이지 밖으로 안 나감).
  - 파일이 없어졌으면 다시 작성: 페이지 콘솔에서 `S.settings.imgStyle`을 바꾸지 말고 `runwareImage(prompt, { style: {id, name, prompt, model, neg, gen}, aspect: "4:5", rating: "safe" })`을 부르고, `fetch`를 감싸 요청 본문의 `seed`·`CFGScale`·`negativePrompt`를 바꾸면 됨.
- localhost라 관리자 관문은 통과. 장당 약 $0.0025.
- 결과는 4안 × 4장면 비교판(가로 안, 세로 장면) 하나로 묶어 사용자에게 보여 줌.

### 클라우드 세션에서 하려면
- 클라우드 기본(Default) 환경에 Runware 키를 network secret으로 저장해 두었고(api.runware.ai 허용), HEARTSYNC 전용 환경(api.runware.ai만 허용, 키는 없음)도 만들어 둠.
- 2026-11-05 세션에서는 키를 저장한 뒤에도 `missingApiKey` — 실행 중인 세션에 반영되지 않았음. 새 세션에서 다시 확인 필요.
- 클라우드의 Playwright는 프로젝트 버전과 브라우저 버전이 달라 `PLAYWRIGHT_BROWSERS_PATH`로 심볼릭 링크를 만들어야 했고, **WebKit은 없음**(흐름 시험은 Chrome만).

---

## 5. 남은 일 (우선순위 순)

1. **PurpleSmart 문의 메일 보내기**(부록 A) — 답이 몇 주 걸릴 수 있으니 먼저.
2. `admins` 표에 본인 계정 확인(§2).
3. **남성향 애니 3라운드** → 확정 → PR.
4. **여성향 일상** — YabaL 대체 모델 비교(그림 판매 O 모델만 후보).
5. 화풍 확정 뒤 물어볼 것 두 가지(§0).
6. 출시 전: YabaL 쓰는 곳 전부 교체, Pony 허가 결과에 따라 남성향 일상 유지/교체.
7. 시험 공백: WebKit(Safari) 흐름 시험은 클라우드에서 못 돌림 → 로컬에서 `npx playwright install webkit` 후 `npm run e2e`.

---

## 부록 A. PurpleSmart 문의 메일 (보내기 전 서명에 이름·이메일 넣기)

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

End users cannot generate images in the app. Only our administrator (me) generates images with an internal admin tool, which requires a verified administrator account. I review them by hand, then ship the chosen ones with the app as static files (character portraits, world illustrations and cover art). Users only view these pre-made images. No Pony-based model runs in response to a user request.

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
