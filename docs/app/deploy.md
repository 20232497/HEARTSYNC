# 배포·정책 문서·관리자 관문

아이콘, 개인정보처리방침·이용약관, 관리자 도구의 비밀번호 관문, 서버 프록시·대화 관문으로 넓히는 설정(CFG). 배포 주소와 이름 규칙은 CLAUDE.md에 있어요.

> CLAUDE.md의 지도 표가 가리키는 **영역 문서**예요. 이 영역의 코드를 고치기 전에 읽고, 고친 뒤에는 같은 커밋에서 이 문서의 해당 항목을 고쳐요. 항목은 2026-11-12에 CLAUDE.md의 '앱 구조'·'소스 구조·빌드' 절에서 문장 그대로 옮긴 것이고, 결정의 날짜와 경위를 모은 색인은 [docs/DECISIONS.md](../DECISIONS.md)에 있어요.

**이 문서가 다루는 모듈**: `icons/` · `privacy.html` · `terms.html` · `src/js/admin/gate.js` · `src/js/core/config.js` · `vercel.json` · `docs/legal/`

## 아이콘·정책 문서

- 아이콘: icons/(favicon-32 가운데 하트만, icon-192, apple-touch-icon 180). 화면 로고 LOGO(ui/shell.js)
- 개인정보처리방침 privacy.html·이용약관 terms.html(**법률 검토 전 초안**) — 스크립트 없는 정적 페이지. 로그인 화면 맨 아래와 MY → 약관 및 정책에 링크, 파일로 열면 docUrl()(ui/help.js)이 웹 주소로. 수집 항목·저장 위치·AI 전송 대상·결제·성인 이용이 바뀌면 같이 고치고 시행일을 바꾸기(지금 시행일 **11-23**(2026-11-09 사용자 결정 — 11-16 예정안에 합쳐 미룸) — 2026-11-08 정리에 맞춰 고침: Anthropic만, 그림 생성·키 금고·성인 모드·본인인증·커뮤니티 없음, 예전 기능의 계정 데이터는 #old 항목. 프레임 3차로 더한 항목: 내 서재(찜·최근 본·모은 그림 기록)를 11-23부터 계정에 저장(core/constants.js SHELF.syncFrom과 같은 날 — 단위 시험 shelf가 두 날짜가 같은지 봄), 메시지 신고에 담기는 것(#ask). 11-13·11-16 시행 예정안은 시행 전에 바뀜. 위쪽 '변경 안내' 문단은 시행일이 지나면 지우기)

## 관리자 관문

- 관리자 도구 비밀번호 관문 admin/gate.js: 웹 주소에서만 SHA-256 해시 비교, 맞으면 localStorage hv1_admin, MY의 '관리자 잠그기'로 해제. localhost·127.0.0.1·file://은 묻지 않음. 클라이언트 관문이라 무심코 들어오는 것만 막음 — 비밀번호를 바꾸려면 gate.js의 HASH

## 배포 확장

- 배포 확장: CFG(window.HEARTVERSE_CONFIG: anthropicUrl·serverKeys·chatUrl·supabaseUrl·supabaseKey)로 서버 프록시·대화 관문. 예상 못 한 오류는 reportError(). 남은 과제와 결정 이유는 docs/ROADMAP.md, 상용화 단계는 docs/COMMERCIALIZATION.md
