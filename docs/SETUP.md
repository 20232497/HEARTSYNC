# 운영 설정 — 배포 주소·계정 서버(Supabase)·소셜 로그인·고객센터·Vercel

README에서 옮겨 둔 운영 메모예요. 코드 구조는 [ARCHITECTURE.md](ARCHITECTURE.md), 작품 폴더는 [../content/README.md](../content/README.md).

## 배포 주소
| 무엇 | 주소 | 어떻게 올라가나 |
|---|---|---|
| 사용자 사이트 | https://20232497.github.io/HEARTSYNC/ | GitHub Pages가 `main` 루트의 `index.html`을 그대로 띄움(병합하면 자동) |
| 관리자 도구 | https://20232497.github.io/HEARTSYNC/admin.html | 같은 빌드가 만든 `admin.html`(커밋됨). 웹 주소로 열면 **비밀번호 관문**(`src/js/admin/gate.js`, 해시만 저장) — 로컬(localhost·file://)은 묻지 않음. 공지 쓰기·문의 답변은 **관리자 계정**도 필요(아래) |
| 데모(claude.ai) | https://claude.ai/artifact/3sfDYFeJ13dHrkWwBFj1YG | 같은 파일 경로로 다시 publish하면 같은 주소. `icons/`·`content/**/images/`도 files로 함께 |

- GitHub Pages 경로는 대소문자를 구분해요(`/HEARTSYNC/`). 주소를 바꾸면 아래 Supabase URL Configuration·Google 브랜딩·네이버 서비스 URL도 같이 바꿔요.
- 관리자 비밀번호 관문은 정적 페이지의 클라이언트 관문이라 소스를 읽는 사람은 우회할 수 있어요(무심코 들어오는 것만 막음). 실제 데이터(API 키·대화)는 관리자의 브라우저와 계정(RLS)에만 있어요. 비밀번호를 바꾸려면 `gate.js`의 HASH를 새 비밀번호의 SHA-256으로 바꿔요. 웹 주소의 관리자 도구 MY에 있는 **이 브라우저에서 관리자 잠그기**가 기억을 지워요.

## 관리자 계정(공지·문의 답변, 한 번만)
비밀번호 관문은 화면만 가려요. 실제 권한은 Supabase `admins` 표에 있는 계정이 가져요(공지 쓰기·받은 문의 보기·답변).
1. 아래 계정 서버 설정과 고객센터 설정을 먼저 해요(`admins` 표는 [supabase.sql](supabase.sql)이 만들어요)
2. 관리자로 쓸 계정으로 앱에 한 번 로그인한 뒤 **SQL Editor**에서 `insert into public.admins (user_id) select id from auth.users where email = '관리자 이메일' on conflict do nothing;` (소셜 계정은 Authentication → Users의 User UID로 `values ('UID')`)
3. 관리자 도구 → MY의 **고객센터 관리**에 '관리자 계정 아님' 대신 답변 대기 수가 보이면 끝이에요. 표에 넣으면 새로 고침 없이 반영돼요

## 계정 서버 설정(Supabase, 한 번만 — 2026-11-02 완료)
1. Supabase 대시보드 → 프로젝트 → **SQL Editor**에 [supabase.sql](supabase.sql)을 붙여 넣고 실행(계정 저장 표 `kv`, 본인 행만 보이게 하는 RLS, 계정 삭제 함수, 고객센터 표 — 여러 번 실행해도 됨)
2. **Authentication → URL Configuration**: Site URL을 `https://20232497.github.io/HEARTSYNC/`로, Redirect URLs에 `https://20232497.github.io/HEARTSYNC/**` 추가(인증 메일·비밀번호 재설정 링크가 돌아올 곳)
3. **Authentication → Sign In / Providers → Email**: Minimum password length 8(앱의 가입 규칙과 같게)
4. 소셜 로그인은 아래 '소셜 로그인 켜기'(2026-11-03 세 곳 모두 켬) — 공급자를 끄면 그 버튼은 '준비 중' 안내가 나옴
- 앱에 들어 있는 publishable 키는 브라우저용 공개 키라 저장소에 있어도 괜찮음(데이터는 RLS로 본인만 읽음). secret 키는 절대 넣지 않기
- 무료 요금제는 일주일 넘게 안 쓰면 프로젝트가 잠들 수 있음(대시보드에서 다시 깨움)

### 소셜 로그인 켜기(카카오·네이버·Google)
세 곳 모두 '돌아올 주소(Callback·Redirect URI)'는 `https://mblvphojbmxiuqnlxisi.supabase.co/auth/v1/callback`. 발급받은 Client Secret은 Supabase 대시보드에만 넣고 저장소·앱에는 넣지 않기.
1. **카카오** — [카카오 디벨로퍼스](https://developers.kakao.com) → 앱 생성(앱 대표 도메인 `https://20232497.github.io`) → **앱 → 플랫폼 키 → REST API 키**에서 카카오 로그인 리다이렉트 URI 등록(클라이언트 시크릿은 키를 만들 때 이미 켜져 있음) → **카카오 로그인 → 일반**에서 사용 설정 ON → **동의항목**: 닉네임 필수, 프로필 사진 선택, **카카오계정(이메일) 선택**. Supabase 카카오 공급자는 이메일(`account_email`)을 늘 함께 요청해서, 이메일 동의항목이 없으면 카카오가 KOE205(설정하지 않은 동의 항목)를 냄 → 이메일 항목은 비즈 앱만 켤 수 있으니 **앱 → 일반 → 비즈니스 정보 → 개인 개발자 비즈 앱 전환**(앱 아이콘 등록 → 본인인증·카카오비즈니스 통합 서비스 약관 동의 → 전환, 사업자 번호 없어도 됨). Supabase **Authentication → Sign In / Providers → Kakao**: REST API 키·클라이언트 시크릿을 넣고 켜기, **Allow users without an email** 켜기(이메일 동의를 거부해도 가입되게)
2. **Google** — [Google Cloud 콘솔](https://console.cloud.google.com) → API 및 서비스 → OAuth 동의 화면(외부) → 사용자 인증 정보 → OAuth 클라이언트 ID(웹 애플리케이션): 승인된 JavaScript 원본 `https://20232497.github.io`, 승인된 리디렉션 URI는 위 주소. Supabase **Providers → Google**에 Client ID·Secret. **브랜딩**: 애플리케이션 홈페이지 `https://20232497.github.io/HEARTSYNC/`, 개인정보처리방침 `https://20232497.github.io/HEARTSYNC/privacy.html`, 승인된 도메인 `20232497.github.io`·`mblvphojbmxiuqnlxisi.supabase.co` → **대상 → 앱 게시**(2026-11-03 프로덕션으로 게시함 — 테스트 사용자가 아니어도 어느 Google 계정이든 로그인됨). 요청 범위가 이메일·프로필뿐이라 심사는 없음. 브랜드 인증은 안 해서 Google 로그인 화면에는 앱 이름 대신 Supabase 주소가 보임(로고를 올리면 심사 대상이 되니 올리지 않기)
3. **네이버** — [네이버 개발자 센터](https://developers.naver.com) → Application → 애플리케이션 등록 → 사용 API '네이버 로그인'(제공 정보는 별명 정도만, 이메일은 안 받아도 됨) → 환경 PC 웹: 서비스 URL `https://20232497.github.io/HEARTSYNC/`, Callback URL은 위 주소. 검수 전에는 '멤버 관리'에 등록한 아이디만 로그인됨. Supabase **Providers → Custom Providers → New Provider**: 식별자 `naver`(앱은 `custom:naver`로 부름), 이름 네이버, Auto-discovery, Issuer URL `https://nid.naver.com`(Discovery URL은 비움), Client ID·Secret, Scopes `openid`, **Allow users without email** 켜기. 네이버는 Supabase 기본 공급자가 아니라 OIDC로 붙이므로 켠 뒤 실제 계정으로 한 번 시험해 볼 것
- 같은 이메일로 이메일 가입과 소셜 로그인을 하면 Supabase가 한 계정으로 이어 줌
- API 키는 계정에 올리지 않아요(이 브라우저에만). 표의 `kv_no_plain_keys` 제약이 settings 행에 키 칸이 있으면 서버에서도 거부해요

## 고객센터 설정(공지사항·문의하기 — 2026-11-05 추가, 한 번만)
MY → 고객센터(공지사항·자주 묻는 질문·문의하기)의 공지와 문의는 Supabase 표 `notices`·`inquiries`에 있어요. 자주 묻는 질문은 앱에 들어 있는 고정 글(`src/js/ui/faq.js`)이라 설정이 필요 없어요.
1. **SQL Editor**에서 [supabase.sql](supabase.sql)을 **다시 한 번 전체 실행**(맨 아래 '고객센터' 부분이 새로 생김 — 앞부분은 이미 있으면 그대로 둠). 이 단계 전에는 앱의 공지사항에 '고객센터 표가 아직 없어요'가 나와요
2. 관리자로 쓸 계정으로 앱에 한 번 로그인한 뒤 SQL Editor에서: `insert into public.admins (user_id) select id from auth.users where email = '관리자 이메일' on conflict do nothing;` (소셜 계정은 Authentication → Users의 User UID로 `values ('UID')`). 관리자 도구(admin.html) → MY → 고객센터 → 공지사항에 들어가면, 관리자가 아닐 때 내 계정 UID가 든 그 한 줄을 보여 줘요
3. 관리자 도구의 MY에 **고객센터 관리**(답변 대기 수)가 생기고, 고객센터의 공지사항에 '+ 새 공지'·고치기·삭제, 문의하기 아래에 **받은 문의**(답변 대기·완료·종료·전체, 답을 쓰면 서버가 '답변 완료'로 바꿈)가 보여요
- 권한은 서버가 정해요: 공지는 누구나(로그인 없이도) 공개된 것만 읽고 관리자만 씀, 문의는 쓴 사람 본인과 관리자만 봄, 사용자는 분류·제목·내용·답변 받을 이메일·앱 정보 칸만 쓸 수 있고(열 권한) 하루 5건까지(트리거). 관리자 페이지의 비밀번호 관문과 상관없이 `admins` 표에 없는 계정은 공지를 쓰거나 남의 문의를 볼 수 없어요
- 문의 알림(메일·카카오톡)은 없어요 — 관리자 도구 MY의 답변 대기 수로 확인해요. 알림이 필요하면 Supabase Database Webhook이나 Edge Function으로 붙일 수 있어요

## 남겨 둔 서버 조각(지금 앱은 부르지 않음)
- **휴대폰 성인 인증**: Edge Function [edge/verify-adult.ts](edge/verify-adult.ts)와 표 `adult_checks`([supabase.sql](supabase.sql) 맨 아래)는 성인 기능을 서버에 다시 세울 때 쓰려고 남겨 두었어요. 앱의 인증 화면·설정(예전 `idv`)은 2026-11-08 정리 때 걷어 냈고, 함수는 단위 테스트(`tests/unit/verify-adult.test.mjs`)로만 돌려요. 예전 설정 순서(포트원 시험 채널·Secret·배포)는 태그 `archive/before-reset-2026-11-08`의 이 문서에 있어요
- 예전 `vault`(API 키 금고) 행 제약 `kv_vault_sealed`도 표에 남아 있지만 앱은 더 쓰지 않아요

## Vercel 미리보기
- `vercel.json`은 저장소에 붙어 있는 Vercel 미리보기 배포용(PR마다 `Vercel` 체크·봇 댓글) — `npm run build` 뒤 저장소 루트를 그대로 서빙하게 해(outputDirectory ".") GitHub Pages와 같은 모양으로 맞춤. 지우면 PR의 Vercel 체크가 실패해요. 기준 배포 주소는 위 GitHub Pages
