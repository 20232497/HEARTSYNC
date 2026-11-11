# 대화방 기능

명령어, 스트리밍 표시, 시작 상황, 고정 기억, 메시지 피드백과 분기, 대화방 안전 규칙, 유저노트·설정 상한, 화면 이동과 예시 문구. 방의 작품 사본 규칙(liveWork)은 CLAUDE.md에 있어요.

> CLAUDE.md의 지도 표가 가리키는 **영역 문서**예요. 이 영역의 코드를 고치기 전에 읽고, 고친 뒤에는 같은 커밋에서 이 문서의 해당 항목을 고쳐요. 항목은 2026-11-12에 CLAUDE.md의 '앱 구조'·'소스 구조·빌드' 절에서 문장 그대로 옮긴 것이고, 결정의 날짜와 경위를 모은 색인은 [docs/DECISIONS.md](../DECISIONS.md)에 있어요.

**이 문서가 다루는 모듈**: `src/js/core/commands.js` · `src/js/core/rooms.js` · `src/js/core/character.js` · `src/js/core/safety.js` · `src/js/core/constants.js` · `src/js/ui/chat/` · `src/js/ui/room-drawer.js` · `src/js/ui/drawer/` · `src/js/ui/pins.js` · `src/js/ui/room-tools.js` · `src/js/ui/shell.js` · `src/js/ui/chats.js`

## 명령어

- 명령어(core/commands.js, 순수): 두 층 — **앱 명령어** APP_COMMANDS는 항목마다 view 또는 prompt 하나: **화면형**(view — `!상태창`·`!갤러리`(`!도감`)·`!지도`(`!장소` — 드로어 places 뷰)·`!도움말`)은 ui/chat/view.js runCommand가 AI 없이 드로어를 엶(하트·턴 소모 없음), **연출형**(prompt — `!시간경과`·`!새사건`·`!조연등장`·`!반복금지`, 베이비챗 공통 단축어에 해당)은 작품 명령어와 같은 길로 AI에 감. **작품 명령어** work.js commands[{cmd,title,desc,prompt 또는 text}] — prompt('이야기')는 입력을 그대로 보내되 buildInput이 commandText로 `// 유저가 명령어 !cmd(title)을 썼다. prompt`로 바꿔 AI에 줌(말풍선은 친 그대로 — 앱 연출형도 같음). **text('즉답' — 2026-11-09 프레임 3차, 리루의 '즉시 응답')**는 runCommand가 가로채 replyNow(ui/chat/view.js)로 유저 말풍선 + 정해진 글의 AI 메시지를 방에 남김 — AI 호출·하트·턴 없음, 상태창은 직전 값, 두 메시지에 canned 표시(다시 쓰기·좋아요 없음, 분기의 턴 계산에서 빠짐), 다음 턴의 기록에는 들어감. 빌드가 prompt·text 중 하나만·text 길이(LIMITS.reply 1,000)·그림 태그를 검사. 한 모양 목록 allCommands(c)({cmd,title,desc,kind view·direct·work,names})·배지 COMMAND_KINDS(앱·연출·이야기·즉답 — 작품 것은 own)를 도감 카드·도움말·입력창 목록·FAQ가 같이 씀. parseCommand·findCommand(앱 먼저, 별칭·영문 대소문자 무시)·commandHelp·commandList(입력창 ! 목록). **덧붙인 말**(2026-11-10): `!이름 뒤의 글`은 commandArg — 연출형·작품 prompt면 commandText가 `// 유저가 명령어 !cmd(title)을 썼다 — 덧붙인 말: 「…」. prompt`로 함께 보내고, 화면형·즉답은 덧붙여도 같은 동작(덧붙인 말은 버림), 모르는 이름이면 보통 글. **입력창 ! 목록**(ui/chat/cmdlist.js, #cmdPanel): !로 시작하는 낱말을 치는 동안 입력창 위에 '!이름 — 제목'(앱 → 작품), ↑↓·Enter(채우기 — 다 친 명령어면 보내기)·Esc(전역 Esc로 번지지 않게). 빌드가 cmd 모양·중복·앱 이름 충돌을 검사(APP_RULES APP_COMMANDS). 예시는 m/godseats(!퀘스트·!관람석·!쉼터)

## 스트리밍 표시

- 스트리밍 표시: generate의 show()가 liveFill로 #liveBubble — 끝난 줄은 .lv-done에 한 번만 fmt, 쓰는 중 줄은 closeOpen으로 열린 서식을 임시로 닫아 .lv-cur. 자동 스크롤(r.set.autoScroll, 기본 꺼짐, stick 플래그·#jumpBtn). 추천 답변은 저장만 하고 '✦ AI 추천'을 누를 때 펼침(추가 호출 없음, '새로 추천'만 호출)

## 시작 상황

- 시작 상황 id(2026-11-11 프레임 4차 — 식별자 안정화): work.js openings[].id(필수, core/constants.js OPENING_ID_RE). 방은 시작 상황을 **id로** 기억함 — newRoom이 r.openingId에 적고(r.opening 제목은 화면 표시용), 다시 찾는 규칙은 core/rooms.js **openingIndex(c, r) 한 곳**: id → 제목(이 칸이 생기기 전의 방이거나 id를 못 찾을 때, 분기 표시는 떼고) → 첫 시작 상황. '처음부터 다시'(ui/room-drawer.js)가 씀, 분기한 방은 openingId를 그대로 가져감. 그래서 작품은 시작 상황의 제목을 자유롭게 고칠 수 있고 id는 고치지 않음(예전에는 제목을 고치면 조용히 첫 시작 상황으로 갔음). 예전 방에 id를 채워 넣는 이전 코드는 두지 않음(제목 대체 길로 충분)
- 시작 상황의 선택 칸(2026-11-09 프레임 3차): openings[].place(배경 장소 — places의 n번째) → newRoom(core/rooms.js)이 첫 메시지 맨 위에 그 장소 태그를 넣고(본문에 이미 있으면 그대로) 상세 페이지 시작 상황 카드에 장소 이름 · suggestions(첫 답변 추천 — 첫 메시지의 alt.suggestions로, '✦ AI 추천'이 호출 없이 보여 줌) · lead({ text, turns } — 방에 r.lead로 복사, r.turn이 turns에 닿기 전까지만 프롬프트 변동부 [지금 상태]의 '시작 연출'; directive는 고정부에 끝까지). 예약 시리즈 표 SERIES는 core/constants.js에 두고 images/codes.js가 다시 내보냄(core/rooms.js가 층 규칙을 어기지 않게). 참고: 리루의 시작 프롬프트(지속 턴수)·배경 이미지, 캐럿·베이비챗의 첫 답변 추천

## 고정 기억

- 고정 기억(핀 — 2026-11-09 프레임 3차, ui/pins.js): 방의 r.pins [{ id, text, at, msgId? }] — 말풍선 메뉴 '📌 고정'(pinSheet가 그 메시지 앞부분을 채운 한 줄 입력, 고쳐서 저장) 또는 드로어 장기기억의 '고정 기억' 탭(pinsHTML·bindPins — 수정·삭제·직접 추가, 한도 표시). 프롬프트 변동부의 [고정 기억 — 반드시 지킨다]로 유저노트와 장기 기억 사이에 매 턴 그대로(요약·압축은 건드리지 않음). 한도(2026-11-09 사용자 결정): 한 줄 LIMITS.pin 200자, 개수 PLAN.free.pins 5 · PLAN.pro.pins 20(넘으면 무료는 plusSheet("pins"), PLUS는 알림). **프롬프트에는 지금 요금제 한도 안의 앞쪽 줄만**(rules.js `(r.pins).slice(0, plan().pins)` — 2026-11-10 사용자 결정: PLUS가 끝나 한도가 줄면 넘는 줄은 지우지 않고 목록에 '보관 중'으로 두되 AI에는 보내지 않음, 다시 PLUS가 되면 모두 보냄). 분기하면 그 메시지까지에서 고정한 것(과 직접 적은 것)만 따라감. roomMinorHint도 고정 기억을 봄. 참고: Character.AI 기억 고정

## 메시지 피드백·분기

- 메시지 피드백·분기: AI 응답 버전마다 fb(1 좋아요 · -1 아쉬워요 · 0 — 말풍선 메뉴 👍/👎 토글, 이 기기·계정에 저장만 하고 **프롬프트에는 쓰지 않음**). **분기** forkRoom(r, msgId)(core/rooms.js): 그 메시지까지를 깊은 복사한 새 방(같은 작품 사본·페르소나·설정·유저노트, 상태창은 그 시점, opening 끝에 ' (분기)' — 원래 제목은 baseOpening, forkedFrom {roomId, msgId}), 원래 방은 그대로. 장기기억은 분기한 턴보다 뒤에 시작하는 구간을 빼고 복사(memoryUpTo — 구간 머리표 '[a-b턴]'은 memoryMark 하나로 쓰고 읽음, 머리표가 없는 기억은 통째로; 턴 번호는 원래 방의 것을 이어 씀). 말풍선 메뉴 '분기'(확인 창 → 작품당 방 수 한도 plan().rooms를 넘으면 PLUS 안내), 드로어 main에 '이 방은 …에서 분기'와 원래 대화방 버튼, 대화 목록 카드에 '분기' 표시(RoomIndex.fork). 드로어의 도구 함수(galleryItems·jumpTo·exportText·exportRoom·deleteRoom)는 ui/room-tools.js

## 대화방 안전

- 대화방 안전: saveRoom은 deletedRooms의 방을 저장하지 않음. 안전: minorFlags(출연진 외모·영문 태그·설정 첫머리의 19세 미만·학생 → 작품 검사 실패)·minorHint(글 속 나이(숫자·한글·영문)·학년·학생·아동·교복 낱말과 태그, 글자만 겹치는 말은 먼저 지움 — 여학생·남학생은 대학생에게도 흔히 써서 보지 않음(2026-11-06 사용자 결정), N살·N세는 둘 다 잡음)·settingHint(설정·장기기억용 — 어른 인물의 과거 이야기 꼴을 빼고 봄)·roomMinorHint(r, lore)(방 전체 — 성인 경로를 서버에 다시 세울 때의 기준). 지금 앱은 minorFlags만 작품 검사로 부르고, 나머지는 단위 테스트(tests/unit/safety.test.mjs — content/의 작품 전부가 막히지 않는지도)가 지킴

## 유저노트·설정 상한

- 유저노트 양식: work.js noteTemplate(글)이 있는 작품에서만 드로어 유저노트에 '이 작품의 양식 넣기' 버튼(최신 작품에서 읽음, 한도에서 자름). 예시는 m/godseats의 커스텀 모드 양식
- 유저 설정 상한(core/constants.js LIMITS — 작품의 guide와 같은 표): personaDesc 1,000(페르소나 시트 #pd)·userNote 2,000(드로어 유저노트)·pin 200(고정 기억 한 줄)·memory 2,000(장기기억 기본 한도 = S 기본 memCfg.limit = PLAN.free.memoMax — 2026-11-09 결정으로 3,000에서 줄임, 예전 설정값 3,000은 memCfg()가 요금제 한도로 자름, PLUS는 PLAN.pro.memoMax 10,000 — 넘으면 maybeSummarize가 압축). 입력 칸은 maxlength와 "n / 한도" 카운터, 저장할 때도 자름. FAQ '설정은 얼마나 길게'가 같은 상수를 읽음

## 화면 이동·예시 문구

- 화면 이동 스크롤(ui/shell.js route): #view는 화면이 바뀌어도 scrollTop이 남아 주소가 바뀔 때만 옮김 — 새 화면은 맨 위, 홈으로 돌아오면 떠날 때의 자리(homeY), 같은 주소를 다시 그리면 그대로. 대화방 #log는 따로 스크롤. 시험 tests/e2e/scroll.mjs
- 화면 예시 문구는 데이터에서(2026-11-09 사용자 결정 — 특정 작품·인물 이름을 코드에 박지 않음): exampleCast(c)(core/character.js) — 작품을 주면 그 작품의 첫 인물(본체), 안 주면 관심있는 대화에 맞는 첫 작품의 첫 인물, 없으면 EXAMPLE_CAST(constants). 쓰는 곳: 도감 '그림 코드 읽는 법'(고른 작품, 번호는 EXAMPLE_SIT)·FAQ·MY 채팅 미리보기·유저노트와 다시 쓰기 입력 칸 예시(그 방의 작품)·프롬프트의 태그 예시(rules.js). 조사를 타지 않게 이름 뒤에는 '의'만 씀. 예약 시리즈 글자(MP·EV)도 seriesCode(kind)(images/codes.js)나 SERIES를 돌아서 씀 — 다른 모듈에 'MP'·'EV'를 직접 적지 않기
