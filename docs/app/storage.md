# 상태·저장·계정·내 서재·MY

전역 상태 S, 이 기기와 계정에 저장하는 길(KV·IDB·CLOUD), 로그인과 계정 동기화, 내 서재(찜·최근 본·수집 기록), MY 화면. 대시보드 설정은 [docs/SETUP.md](../SETUP.md).

> CLAUDE.md의 지도 표가 가리키는 **영역 문서**예요. 이 영역의 코드를 고치기 전에 읽고, 고친 뒤에는 같은 커밋에서 이 문서의 해당 항목을 고쳐요. 항목은 2026-11-12에 CLAUDE.md의 '앱 구조'·'소스 구조·빌드' 절에서 문장 그대로 옮긴 것이고, 결정의 날짜와 경위를 모은 색인은 [docs/DECISIONS.md](../DECISIONS.md)에 있어요.

**이 문서가 다루는 모듈**: `src/js/core/state.js` · `src/js/core/storage.js` · `src/js/core/settings.js` · `src/js/core/migrate.js` · `src/js/core/shelf.js` · `src/js/services/supabase.js` · `src/js/services/cloud.js` · `src/js/services/sync.js` · `src/js/services/load.js` · `src/js/services/images.js` · `src/js/ui/login.js` · `src/js/ui/account.js` · `src/js/ui/me.js` · `docs/supabase.sql`

## 전역 상태와 저장

- 전역 상태 S(core/state.js): wallet·personas·rooms(목록)·shelf(내 서재)·settings{fs·chatLh·narrFont·enterSend·sceneImg·apiKey·memCfg·audience…}·cat·q. 현재 방 room, 진행 중 생성 gen. hasClaudeKey() = settings.apiKey 또는 CFG.serverKeys
- 저장: KV — 늘 localStorage(hv1_)에 쓰고, 로그인했으면 KV.remote → CLOUD.put으로 계정에도. 계정에 올리는 키는 wallet·personas·rooms·memcfg·room-<id>·shelf(SHELF.syncFrom 날짜부터 — 아래 '내 서재')·settings(cloudSettings — 키 칸 apiKey·runwareKey·openRouterKey와 기기마다 다른 fs·enterSend는 빼고)와 그림 본문 img…(페르소나 사진). 그림 본문은 IDB(IndexedDB "heartverse"/kv), 막히면 localStorage. IMG(services/images.js): put(shrink한 JPEG → kv:img… 참조) · load(메모리 → IDB → KV → CLOUD.getOne) · hydrate(그림 자리 img-wait → 받으면 그림, 못 받으면 img-miss) · migrate(예전 hv1_img… 옮김). validRef는 kv:img…·data:image/…·content/….(webp|png|jpg)만. localStorage가 가득 차면 storageFull()이 한 번 알림

## 로그인·계정 저장

- 로그인·계정 저장(Supabase 프로젝트 mblvphojbmxiuqnlxisi, CFG.supabaseUrl·supabaseKey는 브라우저용 공개 키 — 데이터는 RLS): 라이브러리 없이 REST — SB: signIn·signUp·recover·setPassword·oauth(카카오·custom:naver·Google — 대시보드에서 안 켠 공급자는 400 → '준비 중')·signOut, 세션 hv1_auth(이 기기만), 1분 남으면 refresh, 401이면 한 번 새로 받아 재시도, fromHash가 메일·소셜 링크의 #access_token을 세션으로(type=recovery면 newPasswordSheet), 취소·실패는 oauthMsg. 첫 방문의 작품·공지 주소: #c-<id>·#notice로 처음 들어오면 부팅이 #login-c-<id>·#login-notice로 바꾸고(bootBack) 로그인·둘러보기 뒤 그곳으로(leaveLogin, location.replace), 소셜·메일 왕복은 hv1_back({to, at}, 1시간, 계정에 안 올림)에 적어 둠, 못 찾는 작품은 홈(작품은 모두 content/에서 옴). CLOUD: 키마다 0.8초 모아 upsert, 실패하면 15초 뒤 다시, 표가 없으면(PGRST205) noTable. 받기는 그림 본문을 뺀 행을 updated_at 순으로(hv1_cloudlast_<uid>), 보내지 못한 키·열린 대화방은 덮지 않음. 처음 로그인(firstSync, ui/account.js): 계정이 비었으면 이 기기 데이터를 전부 올리고(pushAll — 그림은 계정에 없는 것만), 이 기기에만 있는 대화가 있으면 '합치기'·'계정 것만 쓰기'(그냥 닫으면 합침, mergeGuest — 대화방·페르소나만). 탭으로 돌아오면 20초가 지났을 때 바뀐 것만 받음. **API 키는 계정에 올리지 않음** — 기기마다 MY → AI 연결에서 넣음. MY → 계정: 상태·지금 동기화·로그아웃(이 기기 데이터도 지우기 → wipeDevice)·계정 삭제(rpc delete_me). 대시보드 상태는 메모리 '운영 Supabase 상태'와 docs/SETUP.md

## 내 서재

- 내 서재(2026-11-09 프레임 3차, core/shelf.js — KV "shelf" 하나): S.shelf { likes·unlikes·recent(작품 id → 시각), seen(작품 id → 대화에서 본 그림 코드) }. **찜**은 상세 페이지의 #like 버튼(toggleLike — '하트'는 재화 이름이라 책갈피 아이콘 ICON.mark와 '찜' 낱말), **최근 본**은 상세를 열 때 touchRecent(SHELF.recent 12개까지). 홈에 '찜한 작품'·'최근 본 작품' 줄(있을 때만, 관심있는 대화 audOK로 거름 — 가로 줄은 ui/home.js rowHTML 하나), 상세 맨 아래 '같은 줄의 다른 작품'(작품의 row — 줄이 없는 작품은 숨김). **계정 동기화는 날짜 관문**(2026-11-09 사용자 결정): SHELF.syncFrom(core/constants.js, 지금 2026-11-23 = 개인정보처리방침 시행일 — 미루려면 이 상수와 privacy.html 시행일을 같이)부터만 CLOUD가 "shelf"를 주고받고(shelfSyncOn), 그 전에 이 기기에 쌓인 것은 그날 뒤 첫 pull에서 올라감(CLOUD.shelfUp). 다른 키(통째로 덮음)와 달리 **합침** — mergeShelf(순수: 작품마다 더 늦은 시각이라 찜을 푼 것도 전해짐, seen은 합집합, 키 순서를 맞춰 JSON 글로 비교), 받을 때 CLOUD.takeShelf가 이 기기에만 있던 것을 되올림. 처음 로그인(firstSync): 이 기기에서 찜한 작품 가운데 계정에 없는 것이 있으면 대화처럼 합칠지 물음(2026-11-10 사용자 결정 — 대화가 없고 찜만 있어도 '이 기기의 찜을 합칠까요?'), '계정 것만 쓰기'를 고르면 resetShelf(이 기기의 서재를 버림), 최근 본·수집 기록만 있을 때는 묻지 않고 합침. **수집 기록**(seen): collectSeen(r)(ui/room-tools.js — 방을 열 때·응답이 끝날 때·즉답 뒤)이 그 방에 나온 그림 코드(galleryItems)와, 그 칸 그림이 없어 대신 보인 칸(1·0)을 markSeen으로 적음. 도감·상세의 등장인물 머리에 collectHTML(ui/codex.js) '모은 그림 n / m'(m = 그 작품에 실린 그림 수, 0이면 숨김 — 지금은 그림이 0장이라 안 보임), 인물 시트 감정 칩의 '본 칸 ✓'(.seen), 비공개 칸은 hiddenOf가 본 번호를 빼서 풀림. 누적 대화 수·랭킹은 서버가 있어야 해서 하지 않음(docs/ROADMAP.md 3장)

## MY

- MY: 페르소나(사진은 이용자가 올린 것만)·관심있는 대화·채팅 설정(fs 13~21px·chatLh·narrFont·enterSend·sceneImg — 바꾸는 즉시 저장, applySettings가 --chat-fs 등 반영)·AI 연결(Anthropic API 키, '설정 저장', cleanKeys가 형식이 다르면 알림)·계정·고객센터·약관 및 정책·모든 데이터 초기화. 테마는 기기 설정을 따름
