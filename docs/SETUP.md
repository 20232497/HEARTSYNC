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

### 관리자 계정 고정(한 번만 — 2026-11-06 완료)
`admins`는 계정 id를 봐서, 계정을 지우고 다시 가입하면 id가 바뀌어 권한이 사라져요. 운영자 이메일을 `owner_emails`에 넣으면 **그 이메일의 인증된 계정은 늘 관리자**예요. 저장소가 공개라 이메일은 파일에 적지 않고 이 표에만 둬요(앱에서는 읽지도 쓰지도 못해요).
1. [supabase.sql](supabase.sql)을 전체 실행한 뒤 SQL Editor에서: `insert into public.owner_emails (email) values ('관리자 이메일(소문자)') on conflict do nothing;`
2. 확인: `select o.email, u.id is not null as has_account, u.email_confirmed_at is not null as confirmed, a.user_id is not null as is_admin from public.owner_emails o left join auth.users u on lower(u.email) = o.email left join public.admins a on a.user_id = u.id;` — 셋 다 true면 끝이에요. 계정이 아직 없으면 false로 보이고, 가입해서 메일 인증을 마치는 순간 관리자가 돼요
- **계정을 지우고 다시 가입**: 메일 인증을 마치면 새 계정이 자동으로 관리자예요(같은 이메일을 Google 등으로 처음 가입해도 같음)
- **`admins`에서 빼기**: 고정 계정은 오류로 막혀요. MY의 계정 삭제는 그대로 돼요
- **표를 비우거나(`truncate`) 지웠을 때(`drop`)**: 막지는 못하지만 [supabase.sql](supabase.sql)을 다시 실행하면 복구돼요. `owner_emails`를 지웠거나 프로젝트를 새로 만들었다면 1번을 다시 해요
- **전제**: Authentication의 **이메일 인증을 켜 둬요**. 끄면 가입 즉시 인증된 것으로 처리돼서, 그 이메일의 계정이 없을 때 남이 먼저 가입해 관리자가 될 수 있어요. 그 메일함을 가진 사람이 곧 관리자이니 메일 계정의 2단계 인증도 켜 둬요
- **고정 풀기**: `delete from public.owner_emails where email = '관리자 이메일(소문자)';` — 관리자 권한은 남으니, 뺄 때는 이어서 `admins`에서 지워요. 고정 계정의 이메일을 다른 주소로 바꿔도 권한은 남고 고정만 풀려요
- **이메일이 다른 계정은 별개예요**: 카카오처럼 이메일이 없거나 다른 이메일로 가입한 계정은 고정 대상이 아니라서, 그 계정으로 로그인하면 관리자로 보이지 않아요. 그 계정도 쓰려면 위 2번의 UID 방식으로 넣어요(계정을 지우고 다시 가입하면 다시 넣어야 해요)
- 이 고정은 Supabase 권한(공지·문의·그림 생성 확인)에만 해당해요. 웹 관리자 도구의 비밀번호 관문은 따로이고, SQL Editor에 들어올 수 있는 사람은 이 설정도 바꿀 수 있어요

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
공지 메뉴의 공지와 MY → 고객센터(자주 묻는 질문·문의하기)의 문의는 Supabase 표 `notices`·`inquiries`에 있어요. 자주 묻는 질문은 앱에 들어 있는 고정 글(`src/js/ui/faq.js`)이라 설정이 필요 없어요.
1. **SQL Editor**에서 [supabase.sql](supabase.sql)을 **다시 한 번 전체 실행**(맨 아래 '고객센터' 부분이 새로 생김 — 앞부분은 이미 있으면 그대로 둠). 이 단계 전에는 앱의 공지 화면에 '고객센터 표가 아직 없어요'가 나와요
2. 관리자로 쓸 계정으로 앱에 한 번 로그인한 뒤 SQL Editor에서: `insert into public.admins (user_id) select id from auth.users where email = '관리자 이메일' on conflict do nothing;` (소셜 계정은 Authentication → Users의 User UID로 `values ('UID')`)
3. 그 계정으로 로그인한 관리자 도구에서는 따로 누를 것 없이 **공지** 메뉴에 '+ 새 공지'·고치기·삭제와 비공개 공지가 보이고, MY에 **고객센터 관리**(답변 대기 수), 고객센터의 문의하기 아래에 **받은 문의**(답변 대기·완료·종료·전체, 답을 쓰면 서버가 '답변 완료'로 바꿈)가 생겨요
- 권한은 서버가 정해요: 공지는 누구나(로그인 없이도) 공개된 것만 읽고 관리자만 씀, 문의는 쓴 사람 본인과 관리자만 봄, 사용자는 분류·제목·내용·답변 받을 이메일·앱 정보 칸만 쓸 수 있고(열 권한) 하루 5건까지(트리거). 관리자 페이지의 비밀번호 관문은 브라우저 안의 확인이라 서버 권한을 주지 않아요 — 관문을 지나도 `admins` 표에 없는 계정은 공지를 쓰거나 남의 문의를 볼 수 없고, 공지 화면은 읽기만 되며 로그인 안내가 보여요
- **메시지 신고 분류(2026-11-09 추가 — 한 번만, 아직 실행 전)**: 대화방 AI 말풍선의 '신고'는 문의 표에 분류 `report`('신고')로 들어와요. 2026-11-05에 만든 표의 분류 제약은 이 값을 모르므로 **SQL Editor**에서 아래 두 줄을 실행해 주세요([supabase.sql](supabase.sql)을 전체 다시 실행해도 같아요).
  ```sql
  alter table public.inquiries drop constraint if exists inquiries_category_check;
  alter table public.inquiries add constraint inquiries_category_check check (category in ('account', 'pay', 'chat', 'image', 'adult', 'bug', 'suggest', 'report', 'etc'));
  ```
  실행하기 전에도 신고는 접수돼요 — 서버가 분류를 거부하면 앱이 '기타' 분류로 다시 보내고 제목 앞의 `[신고]`로 구분해요(받은 문의 목록에는 어느 쪽이든 '신고' 배지). 신고 사유는 일곱 가지(미성년자 관련 성적 내용·자해·자살 조장·혐오·괴롭힘·불법 정보·개인정보 노출·오류·이상한 응답·기타)이고, 앞의 둘은 받은 문의 목록 맨 위에 '우선 처리할 신고'로 따로 보이며 MY의 답변 대기 수 옆에 건수가 붙어요(알림은 없으니 관리자 도구를 자주 확인). 신고에는 사유·작품 이름과, 이용자가 끄지 않았다면 그 메시지의 앞부분 300자가 담겨요(개인정보처리방침 2026-11-23 개정에 적음). 하루 5건 규칙은 문의와 같이 셈
- 문의 알림(메일·카카오톡)은 없어요 — 관리자 도구 MY의 답변 대기 수로 확인해요. 알림이 필요하면 Supabase Database Webhook이나 Edge Function으로 붙일 수 있어요

## 대화 관문 설정(성인 트랙·일반 트랙의 무료 길 — 2026-11-09 틀만 세움, 아직 켜지 않음)
성인 트랙 방의 대화는 브라우저가 모델을 직접 부르지 않고 Supabase Edge Function `chat`([edge/chat.ts](edge/chat.ts))을 거쳐요. 함수가 로그인·성인 인증·미성년 암시·하루 한도를 판정한 뒤 회사 키로 모델(OpenRouter)을 불러 답을 그대로 흘려보내요. 앱의 `chatUrl`이 비어 있는 동안은 아무 일도 하지 않아요(성인 트랙 방은 '준비 중' 안내).
- **일반 트랙의 무료 길만 먼저 켤 수도 있어요**(성인 트랙과 따로): 내 API 키가 없는 로그인 이용자가 회사 키의 Claude(라이트 = Haiku)로 대화하게 됩니다. 필요한 것은 아래 1·2·4와 Secrets의 `ANTHROPIC_API_KEY`·`CHAT_MODELS`의 `general` 칸(`{"general":{"quick":"claude-haiku-5-5"}}` — 적은 등급만 무료 길로 받고, 나머지 등급은 이용자가 자기 키로)·선택 `CHAT_FREE_DAILY_LIMIT`(계정당 하루 호출 수, 기본 80 — 무료 10턴에 요약·추천·다시 쓰기를 더한 상한). 켜기 전에 개인정보처리방침(대화가 회사 서버를 거쳐 Anthropic으로 감)·FAQ(키 없이 쓰는 방법)를 고치고, Anthropic 콘솔에서 그 키의 월 한도를 정해 두세요. 무료 턴 수와 하트는 아직 브라우저가 세므로 서버 한도가 실제 상한이에요
- **성인 트랙을 켜기 전에 끝나 있어야 하는 것**: 변호사 자문·PG 확인(ROADMAP.md), 휴대폰 성인 인증의 실제 채널(아래 `verify-adult` — 인증 화면은 앱에 다시 만들어야 함), 성인 작품을 싣는 길(팩 형식·검사기·로더 — 아직 없음), 개인정보처리방침·이용약관 갱신(대화 내용이 OpenRouter와 그 뒤의 모델 제공자로 전송됨 — 국외 이전 고지)
1. **SQL Editor**에서 [supabase.sql](supabase.sql)을 다시 한 번 전체 실행(맨 아래 `chat_usage` 표와 `bump_chat_usage` 함수가 생김 — 계정·날짜·트랙별 호출 수)
2. **Edge Functions → 새 함수 `chat`** 을 만들고 [edge/chat.ts](edge/chat.ts) 내용을 그대로 붙여 넣어 배포. 함수는 미성년 판정에 앱과 같은 코드를 쓰려고 배포된 사이트의 `src/js/core/safety.js`를 가져와요 — **이 함수가 든 변경이 main에 병합돼 GitHub Pages에 올라간 뒤에** 배포하기(못 가져오면 함수가 뜨지 않음). safety.js를 고친 뒤에는 함수를 다시 배포해야 반영돼요
3. **Edge Functions → Secrets**에: `OPENROUTER_API_KEY`(OpenRouter 키), `CHAT_MODELS`(등급마다 모델 — 값은 모델 이름, 또는 그 모델만의 생각 설정을 붙인 꼴. 2026-11-09에 재서 고른 값: `{"adult":{"quick":{"model":"google/gemma-4-31b-it","reasoning":{"enabled":false}},"default":"z-ai/glm-5.3","complex":{"model":"moonshotai/kimi-k3.1-pro","reasoning":{"enabled":false}}}}` — 근거와 대안은 COMMERCIALIZATION.md 7장. 생각 설정을 안 붙이면 '낮게'로 보내요. 모델을 바꿀 땐 `tools/model-bench.mjs`로 먼저 재 보세요: 생각을 끌 수 없는 모델, '낮게'로도 출력 한도를 다 써 버리는 모델이 있어요), 선택: `CHAT_PREAMBLE_ADULT`(성인 트랙에서 시스템 글 맨 앞에 붙는 머리말 — 운영자가 따로 쓰고 저장소에는 넣지 않음), `CHAT_DAILY_LIMIT`(계정당 하루 호출 수, 기본 300 — 본문·요약·추천 모두 1회), `CHAT_ALLOW_TEST_IDV`(`1`이면 시험 채널 성인 인증도 인정 — 시험할 때만)
4. 앱에 관문 주소를 넣기: `index.html`보다 먼저 `window.HEARTVERSE_CONFIG = { chatUrl: "https://<프로젝트>.supabase.co/functions/v1/chat" }`(또는 `src/js/core/config.js`의 기본값)
- 함수는 대화 내용을 저장하지 않아요(남는 것은 계정·날짜·호출 수). 모델 쪽에는 계정 id·토큰을 보내지 않고, 입력을 학습·보관하는 제공자는 빼고 고르게 해 뒀어요(`provider.data_collection: "deny"` — 고른 모델에 맞는 제공자가 없으면 `not_configured`가 나요)
- OpenRouter 대시보드에서 그 키의 월 한도를 정해 두세요(하루 한도는 계정마다의 상한이고, 전체 지출 상한은 키 한도가 막아요)
- **실제 Supabase에 올려 돌려 본 적은 없어요** — 함수 로직은 단위 테스트(`tests/unit/chat-gate.test.mjs`)로, 앱 쪽 경로는 흐름 시험(`tests/e2e/tracks.mjs`)으로, 진짜 모델 서버와의 왕복(스트림 중계·생각 설정·`data_collection: deny`)은 `tools/model-bench.mjs`가 함수 코드를 이 PC에서 돌려 확인했어요(계정 서버만 흉내). 처음 올릴 때 사이트에서 safety.js를 가져오는 부분과 스트림 중계를 먼저 확인하세요

## 남겨 둔 서버 조각(지금 앱은 부르지 않음)
- **휴대폰 성인 인증**: Edge Function [edge/verify-adult.ts](edge/verify-adult.ts)와 표 `adult_checks`([supabase.sql](supabase.sql) 맨 아래)는 성인 기능을 서버에 다시 세울 때 쓰려고 남겨 두었어요. 앱의 인증 화면·설정(예전 `idv`)은 2026-11-08 정리 때 걷어 냈고, 함수는 단위 테스트(`tests/unit/verify-adult.test.mjs`)로만 돌려요. 예전 설정 순서(포트원 시험 채널·Secret·배포)는 태그 `archive/before-reset-2026-11-08`의 이 문서에 있어요
- 예전 `vault`(API 키 금고) 행 제약 `kv_vault_sealed`도 표에 남아 있지만 앱은 더 쓰지 않아요

## Vercel 미리보기
- `vercel.json`은 저장소에 붙어 있는 Vercel 미리보기 배포용(PR마다 `Vercel` 체크·봇 댓글) — `npm run build` 뒤 저장소 루트를 그대로 서빙하게 해(outputDirectory ".") GitHub Pages와 같은 모양으로 맞춤. 지우면 PR의 Vercel 체크가 실패해요. 기준 배포 주소는 위 GitHub Pages
