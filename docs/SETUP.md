# 운영 설정 — 배포 주소·계정 서버(Supabase)·소셜 로그인·Vercel

README에서 옮겨 둔 운영 메모예요. 코드 구조는 [ARCHITECTURE.md](ARCHITECTURE.md), 작품 폴더는 [../content/README.md](../content/README.md).

## 배포 주소
| 무엇 | 주소 | 어떻게 올라가나 |
|---|---|---|
| 사용자 사이트 | https://20232497.github.io/HEARTSYNC/ | GitHub Pages가 `main` 루트의 `index.html`을 그대로 띄움(병합하면 자동) |
| 관리자 도구 | https://20232497.github.io/HEARTSYNC/admin.html | 같은 빌드가 만든 `admin.html`(커밋됨). 웹 주소로 열면 **비밀번호 관문**(`src/js/admin/gate.js`, 해시만 저장) — 로컬(localhost·file://)은 묻지 않음. 그림을 만들려면 **관리자 계정**도 필요(아래) |
| 데모(claude.ai) | https://claude.ai/artifact/3sfDYFeJ13dHrkWwBFj1YG | 같은 파일 경로로 다시 publish하면 같은 주소. `icons/`·`styles/`·`content/**/images/`도 files로 함께 |

- GitHub Pages 경로는 대소문자를 구분해요(`/HEARTSYNC/`). 주소를 바꾸면 아래 Supabase URL Configuration·Google 브랜딩·네이버 서비스 URL도 같이 바꿔요.
- 관리자 비밀번호 관문은 정적 페이지의 클라이언트 관문이라 소스를 읽는 사람은 우회할 수 있어요(무심코 들어오는 것만 막음). 실제 데이터(API 키·그림·대화)는 관리자의 브라우저와 계정(RLS)에만 있어요. 비밀번호를 바꾸려면 `gate.js`의 HASH를 새 비밀번호의 SHA-256으로 바꿔요.
- 성인 수위 행동 코드 표는 공개 저장소에 두지 않아요. 웹 관리자 도구에서는 코드 표 시트의 **목록으로 추가**에 원본 표(.txt)를 한 번 들여오면 계정에 저장돼 어느 기기에서나 보여요. 로컬 개발 서버에서는 `content/codes.admin.json`(git 제외)을 자동으로 읽어요.

## 관리자 계정(그림 생성·공지·문의 답변, 한 번만)
비밀번호 관문은 화면만 가려요. 실제 권한은 Supabase `admins` 표에 있는 계정이 가져요. 웹 주소나 파일(`file://`)로 연 관리자 도구에서 **그림·움짤을 만들려면 이 계정으로 로그인**해야 하고, 개발 서버(`localhost`·`127.0.0.1`)만 이 확인을 건너뛰어요.
1. 아래 계정 서버 설정과 고객센터 설정을 먼저 해요(`admins` 표는 [supabase.sql](supabase.sql)이 만들어요)
2. 관리자로 쓸 계정으로 앱에 한 번 로그인한 뒤 **SQL Editor**에서 `insert into public.admins (user_id) select id from auth.users where email = '관리자 이메일' on conflict do nothing;` (소셜 계정은 Authentication → Users의 User UID로 `values ('UID')`)
3. 관리자 도구 → MY → 이미지 생성 맨 위에 **관리자 계정으로 확인됐어요**가 보이면 끝이에요. 표에 넣으면 새로 고침 없이 반영돼요

### 관리자 계정 고정(한 번만 — 2026-11-06 추가)
`admins`는 계정 id를 봐서, 계정을 지우고 다시 가입하면 id가 바뀌어 권한이 사라져요. 운영자 이메일을 `owner_emails`에 넣으면 **그 이메일의 인증된 계정은 늘 관리자**예요. 저장소가 공개라 이메일은 파일에 적지 않고 이 표에만 둬요(앱에서는 읽지도 쓰지도 못해요).
1. [supabase.sql](supabase.sql)을 전체 실행한 뒤 SQL Editor에서: `insert into public.owner_emails (email) values ('관리자 이메일(소문자)') on conflict do nothing;`
2. 확인: `select o.email, u.id is not null as has_account, u.email_confirmed_at is not null as confirmed, a.user_id is not null as is_admin from public.owner_emails o left join auth.users u on lower(u.email) = o.email left join public.admins a on a.user_id = u.id;` — 셋 다 true면 끝이에요. 계정이 아직 없으면 false로 보이고, 가입해서 메일 인증을 마치는 순간 관리자가 돼요
- **계정을 지우고 다시 가입**: 메일 인증을 마치면 새 계정이 자동으로 관리자예요(같은 이메일을 Google 등으로 처음 가입해도 같음)
- **`admins`에서 빼기**: 고정 계정은 오류로 막혀요. MY의 계정 삭제는 그대로 돼요
- **표를 비우거나(`truncate`) 지웠을 때(`drop`)**: 막지는 못하지만 [supabase.sql](supabase.sql)을 다시 실행하면 복구돼요. `owner_emails`를 지웠거나 프로젝트를 새로 만들었다면 1번을 다시 해요
- **전제**: Authentication의 **이메일 인증을 켜 둬요**. 끄면 가입 즉시 인증된 것으로 처리돼서, 그 이메일의 계정이 없을 때 남이 먼저 가입해 관리자가 될 수 있어요. 그 메일함을 가진 사람이 곧 관리자이니 메일 계정의 2단계 인증도 켜 둬요
- **고정 풀기**: `delete from public.owner_emails where email = '관리자 이메일(소문자)';` — 관리자 권한은 남으니, 뺄 때는 이어서 `admins`에서 지워요. 고정 계정의 이메일을 다른 주소로 바꿔도 권한은 남고 고정만 풀려요
- 이 고정은 Supabase 권한(공지·문의·그림 생성 확인)에만 해당해요. 웹 관리자 도구의 비밀번호 관문은 따로이고, SQL Editor에 들어올 수 있는 사람은 이 설정도 바꿀 수 있어요

## 계정 서버 설정(Supabase, 한 번만 — 2026-11-02 완료)
1. Supabase 대시보드 → 프로젝트 → **SQL Editor**에 [supabase.sql](supabase.sql)을 붙여 넣고 실행(계정 저장 표 `kv`, 본인 행만 보이게 하는 RLS, 계정 삭제 함수, 고객센터 표 — 여러 번 실행해도 됨)
2. **Authentication → URL Configuration**: Site URL을 `https://20232497.github.io/HEARTSYNC/`로, Redirect URLs에 `https://20232497.github.io/HEARTSYNC/**` 추가(인증 메일·비밀번호 재설정 링크가 돌아올 곳)
3. **Authentication → Sign In / Providers → Email**: Minimum password length 8(앱의 가입 규칙과 같게 — 비밀번호가 API 키 잠금에도 쓰임)
4. 소셜 로그인은 아래 '소셜 로그인 켜기'(2026-11-03 세 곳 모두 켬) — 공급자를 끄면 그 버튼은 '준비 중' 안내가 나옴
- 앱에 들어 있는 publishable 키는 브라우저용 공개 키라 저장소에 있어도 괜찮음(데이터는 RLS로 본인만 읽음). secret 키는 절대 넣지 않기
- 무료 요금제는 일주일 넘게 안 쓰면 프로젝트가 잠들 수 있음(대시보드에서 다시 깨움)

### 소셜 로그인 켜기(카카오·네이버·Google)
세 곳 모두 '돌아올 주소(Callback·Redirect URI)'는 `https://mblvphojbmxiuqnlxisi.supabase.co/auth/v1/callback`. 발급받은 Client Secret은 Supabase 대시보드에만 넣고 저장소·앱에는 넣지 않기.
1. **카카오** — [카카오 디벨로퍼스](https://developers.kakao.com) → 앱 생성(앱 대표 도메인 `https://20232497.github.io`) → **앱 → 플랫폼 키 → REST API 키**에서 카카오 로그인 리다이렉트 URI 등록(클라이언트 시크릿은 키를 만들 때 이미 켜져 있음) → **카카오 로그인 → 일반**에서 사용 설정 ON → **동의항목**: 닉네임 필수, 프로필 사진 선택, **카카오계정(이메일) 선택**. Supabase 카카오 공급자는 이메일(`account_email`)을 늘 함께 요청해서, 이메일 동의항목이 없으면 카카오가 KOE205(설정하지 않은 동의 항목)를 냄 → 이메일 항목은 비즈 앱만 켤 수 있으니 **앱 → 일반 → 비즈니스 정보 → 개인 개발자 비즈 앱 전환**(앱 아이콘 등록 → 본인인증·카카오비즈니스 통합 서비스 약관 동의 → 전환, 사업자 번호 없어도 됨). Supabase **Authentication → Sign In / Providers → Kakao**: REST API 키·클라이언트 시크릿을 넣고 켜기, **Allow users without an email** 켜기(이메일 동의를 거부해도 가입되게)
2. **Google** — [Google Cloud 콘솔](https://console.cloud.google.com) → API 및 서비스 → OAuth 동의 화면(외부) → 사용자 인증 정보 → OAuth 클라이언트 ID(웹 애플리케이션): 승인된 JavaScript 원본 `https://20232497.github.io`, 승인된 리디렉션 URI는 위 주소. Supabase **Providers → Google**에 Client ID·Secret. **브랜딩**: 애플리케이션 홈페이지 `https://20232497.github.io/HEARTSYNC/`, 개인정보처리방침 `https://20232497.github.io/HEARTSYNC/privacy.html`, 승인된 도메인 `20232497.github.io`·`mblvphojbmxiuqnlxisi.supabase.co` → **대상 → 앱 게시**(2026-11-03 프로덕션으로 게시함 — 테스트 사용자가 아니어도 어느 Google 계정이든 로그인됨). 요청 범위가 이메일·프로필뿐이라 심사는 없음. 브랜드 인증은 안 해서 Google 로그인 화면에는 앱 이름 대신 Supabase 주소가 보임(로고를 올리면 심사 대상이 되니 올리지 않기)
3. **네이버** — [네이버 개발자 센터](https://developers.naver.com) → Application → 애플리케이션 등록 → 사용 API '네이버 로그인'(제공 정보는 별명 정도만, 이메일은 안 받아도 됨) → 환경 PC 웹: 서비스 URL `https://20232497.github.io/HEARTSYNC/`, Callback URL은 위 주소. 검수 전에는 '멤버 관리'에 등록한 아이디만 로그인됨. Supabase **Providers → Custom Providers → New Provider**: 식별자 `naver`(앱은 `custom:naver`로 부름), 이름 네이버, Auto-discovery, Issuer URL `https://nid.naver.com`(Discovery URL은 비움), Client ID·Secret, Scopes `openid`, **Allow users without email** 켜기. 네이버는 Supabase 기본 공급자가 아니라 OIDC로 붙이므로 켠 뒤 실제 계정으로 한 번 시험해 볼 것
- 같은 이메일로 이메일 가입과 소셜 로그인을 하면 Supabase가 한 계정으로 이어 줌(그때는 API 키도 로그인 비밀번호로 잠금)

## 고객센터 설정(공지사항·문의하기 — 2026-11-05 추가, 한 번만)
MY → 고객센터(공지사항·자주 묻는 질문·문의하기)의 공지와 문의는 Supabase 표 `notices`·`inquiries`에 있어요. 자주 묻는 질문은 앱에 들어 있는 고정 글(`src/js/ui/faq.js`)이라 설정이 필요 없어요.
1. **SQL Editor**에서 [supabase.sql](supabase.sql)을 **다시 한 번 전체 실행**(맨 아래 '고객센터' 부분이 새로 생김 — 앞부분은 이미 있으면 그대로 둠). 이 단계 전에는 앱의 공지사항에 '고객센터 표가 아직 없어요'가 나와요
2. 관리자로 쓸 계정으로 앱에 한 번 로그인한 뒤 SQL Editor에서: `insert into public.admins (user_id) select id from auth.users where email = '관리자 이메일' on conflict do nothing;` (소셜 계정은 Authentication → Users의 User UID로 `values ('UID')`). 관리자 도구(admin.html) → MY → 고객센터 → 공지사항에 들어가면, 관리자가 아닐 때 내 계정 UID가 든 그 한 줄을 보여 줘요
3. 관리자 도구의 MY에 **고객센터 관리**(답변 대기 수)가 생기고, 고객센터의 공지사항에 '+ 새 공지'·고치기·삭제, 문의하기 아래에 **받은 문의**(답변 대기·완료·종료·전체, 답을 쓰면 서버가 '답변 완료'로 바꿈)가 보여요
- 권한은 서버가 정해요: 공지는 누구나(로그인 없이도) 공개된 것만 읽고 관리자만 씀, 문의는 쓴 사람 본인과 관리자만 봄, 사용자는 분류·제목·내용·답변 받을 이메일·앱 정보 칸만 쓸 수 있고(열 권한) 하루 5건까지(트리거). 관리자 페이지의 비밀번호 관문과 상관없이 `admins` 표에 없는 계정은 공지를 쓰거나 남의 문의를 볼 수 없어요
- 문의 알림(메일·카카오톡)은 없어요 — 관리자 도구 MY의 답변 대기 수로 확인해요. 알림이 필요하면 Supabase Database Webhook이나 Edge Function으로 붙일 수 있어요

## 휴대폰 성인 인증 설정(시험 모드 — 2026-11-05 추가, 사업자등록 없이 됨)
기본은 꺼져 있어요(`src/js/core/config.js`의 `idv.mode: "off"` — 자기 확인 체크 그대로, 포트원으로 아무 요청도 안 감). 켜면 성인 모드는 **휴대폰 인증을 마친 로그인 계정**에서만 열리고 자기 확인 체크는 사라져요. 시험 모드는 통신사 확인 없는 **모의 인증**이라 실제 본인 확인이 아니에요(화면에 '시험 모드'로 표시됨).
1. **포트원 콘솔** [admin.portone.io](https://admin.portone.io) 무료 가입 → 연동 모드 **테스트** → 채널 추가: PG사 NHN KCP, 채널 속성 **본인인증**, 공용 테스트 MID **KCP V2 본인인증 AO6R1**(KCP 안내에 '테스트 연동 정보가 없다'는 문구도 함께 있어서, 창이 안 뜨면 KG이니시스 통합인증 **MIIiasTest**로). 콘솔에서 **Store ID·채널 키**를 적어 두고 **V2 API Secret**을 발급해요
2. Supabase **SQL Editor**에서 [supabase.sql](supabase.sql)을 **다시 전체 실행**(맨 아래 `adult_checks` 표가 새로 생김)
3. Supabase **Edge Functions → Deploy a new function → Via Editor**: 이름 `verify-adult`, 내용은 [edge/verify-adult.ts](edge/verify-adult.ts) 전체를 붙여 넣고 Deploy. 그다음 함수의 설정에서 **JWT 검증(Verify JWT)을 꺼요** — 함수가 로그인 토큰을 직접 확인하고, 켜 두면 브라우저의 사전 요청이나 새 서명 키에서 막힐 수 있어요. CLI를 쓰면: `supabase functions deploy verify-adult --no-verify-jwt`(파일을 `supabase/functions/verify-adult/index.ts`로 복사한 뒤)
4. Supabase **Edge Functions → Secrets**에 `PORTONE_API_SECRET` = 1번의 V2 API Secret(상점이 여러 개면 `PORTONE_STORE_ID`도). **API Secret은 저장소·채팅·앱 어디에도 넣지 않아요**
5. `src/js/core/config.js`의 `idv`를 `{ mode: "test", storeId: "…", channelKey: "…" }`로(이 둘은 브라우저용 공개 값) → `npm run build` → `npm run dev`로 localhost에서 먼저 시험 → 커밋해 main에 병합하면 웹 주소의 **모든 방문자**에게 적용돼요
6. MY → AI 연결 → **성인 인증 · 수위** → **휴대폰으로 성인 인증**. KCP 테스트는 SMS에 임의의 6자리를 넣으면 통과해요. 결과 판정은 생년월일 기준이라, 시험 채널이 미성년 생년월일을 돌려주면 '만 19세가 되는 해부터' 안내가 나와요(시험 채널이 어떤 값을 돌려주는지는 문서로 확인하지 못했어요)
- **실제 운영으로 바꾸기**: 사업자등록 → 포트원에서 PG 계약(다날·KCP, 통신사 심사 2~3주. 'AI 성인 대화' 업종이 통과하는지 신청 전에 문의) → 실제 채널 키로 바꾸고 `mode: "live"`, Secret도 실제 것으로. live 모드는 시험 채널에서 한 인증을 인정하지 않아요(다시 인증)
- **안 될 때**: '서버에 연결하지 못했어요' → 함수를 안 올렸거나 JWT 검증이 켜져 있음 / '인증 서버가 아직 준비되지 않았어요' → 2번(표)·4번(Secret) 확인
- **한계**: 지금은 AI를 브라우저에서 사용자 키로 부르기 때문에 인증 판정도 브라우저 안의 일이에요. 표와 결과는 서버가 지키지만, 콘솔로 앱을 고치면 넘어갈 수 있어요 — 서버가 AI를 부르는 단계(COMMERCIALIZATION.md)에서 서버가 `adult_checks`를 보고 경로를 정해야 진짜 관문이 돼요

## Vercel 미리보기
- `vercel.json`은 저장소에 붙어 있는 Vercel 미리보기 배포용(PR마다 `Vercel` 체크·봇 댓글) — `npm run build` 뒤 저장소 루트를 그대로 서빙하게 해(outputDirectory ".") GitHub Pages와 같은 모양으로 맞춤. 지우면 PR의 Vercel 체크가 실패해요. 기준 배포 주소는 위 GitHub Pages
