# 공지·고객센터·메시지 신고

공지 메뉴와 고객센터(FAQ·문의), 관리자 도구의 고객센터 관리, 메시지 신고. 표와 권한은 docs/supabase.sql, 실행 순서는 [docs/SETUP.md](../SETUP.md), 문구의 법률 초안은 docs/legal/.

> CLAUDE.md의 지도 표가 가리키는 **영역 문서**예요. 이 영역의 코드를 고치기 전에 읽고, 고친 뒤에는 같은 커밋에서 이 문서의 해당 항목을 고쳐요. 항목은 2026-11-12에 CLAUDE.md의 '앱 구조'·'소스 구조·빌드' 절에서 문장 그대로 옮긴 것이고, 결정의 날짜와 경위를 모은 색인은 [docs/DECISIONS.md](../DECISIONS.md)에 있어요.

**이 문서가 다루는 모듈**: `src/js/ui/help.js` · `src/js/ui/faq.js` · `src/js/ui/report.js` · `src/js/services/support.js` · `src/js/admin/support.js` · `docs/supabase.sql`

## 공지·고객센터·메시지 신고

- 공지·고객센터(ui/help.js): 공지는 홈·대화 옆 메뉴 #notice(viewNotice — 사용자·관리자 빌드 모두, 예전 주소 #help-notice는 #notice로), 그 밖은 #help(viewHelp — 탭 #help-faq·#help-ask, MY의 고객센터 칸에서). 공지·문의는 Supabase 표(services/support.js SUPPORT, 표·RLS는 docs/supabase.sql 맨 아래) — notices(누구나 공개 공지 읽기, 관리자만 쓰기), inquiries(본인만 쓰기·읽기·지우기, 하루 5건 트리거), admins(SQL Editor에서만 넣음, is_admin()), owner_emails(고정 관리자 이메일 — 계정을 지우고 다시 가입해도 관리자로, 이메일은 파일에 적지 않고 SQL Editor로만, 트리거 pin_owner_admin·keep_owner_admin, docs/SETUP.md '관리자 계정 고정'). 관리자 도구에서 관리자 계정이면 공지 메뉴가 바로 관리 화면. 마지막으로 받은 공지는 hv1_notices(서버에 닿지 않을 때), MY의 '새 공지'는 hv1_notice_seen. 문의 meta('앱·브라우저 정보 함께 보내기', 기본 꺼짐). **메시지 신고**(2026-11-09 프레임 3차, ui/report.js reportSheet): AI 말풍선 메뉴의 '신고' → 사유(REPORT_REASONS 일곱 가지 — 미성년자 관련 성적 내용·자해·자살 조장·혐오·괴롭힘·불법 정보·개인정보 노출·오류·이상한 응답·기타: 2026-11-10 사용자 결정, 법률 초안 docs/legal/ui-copy.md §8의 출시판 목록. 미리 골라 두지 않아 하나를 골라야 보냄. 앞의 둘은 '우선' — 제목 `[신고] 사유 — 작품`(reportTitle)의 사유로 urgentReport가 가려내 관리자의 받은 문의 맨 위에 따로 보이고(#inUrgent·'우선 신고' 배지 .pill.err) MY의 답변 대기 수 옆에 건수)·덧붙일 말·'이 메시지 앞부분(LIMITS.reportQuote 300자)을 함께 보내기'(기본 켜짐, 미리보기를 보고 끌 수 있음 — 사용자 결정) → SUPPORT.report가 문의 표에 분류 `report`('신고', ASK_CATS)로 접수(하루 5건에 같이 셈, 대화 전체는 보내지 않음). 서버의 분류 제약은 docs/supabase.sql에 고쳐 뒀지만 **운영 DB에는 아직 실행 전**(docs/SETUP.md '메시지 신고 분류'의 SQL 두 줄 — 사용자가 실행) — 그 전에는 서버가 23514로 거부하면(fail의 code check) '기타' 분류로 다시 보내 접수하고 제목의 [신고]로 구분(isReport — 내 문의·받은 문의 목록의 '신고' 배지). 로그인하지 않았으면 로그인·메일 안내만. FAQ(ui/faq.js faqGroups)는 앱 동작을 근거로 쓴 고정 글 — 무료 턴·PLUS·하트 수는 상수에서 읽음, 계정 저장·API 키·수위 동작이 바뀌면 같이 고치기
