/* 데이터 모양 정의(JSDoc @typedef만 — 런타임 코드 없음). 어느 모듈도 import하지 않아 번들에 들어가지 않고, 편집기(jsconfig.json)가 다른 모듈의
   `@typedef {import("../core/types.js").Room} Room` 줄로 끌어다 쓴다. 칸이 바뀌면 여기와 실제로 만드는 곳(core/state.js의 S 기본값, core/rooms.js의 newRoom,
   content/README.md의 work.js 모양)을 같이 고치기. 검사는 하지 않는다(checkJs false) — 사람과 AI가 모양을 한눈에 보라는 문서 */

/** @typedef {"all"|"m"|"f"} Aud 관심있는 대화: 전체 · 남성향(여성 캐릭터와의 대화) · 여성향(남성 캐릭터와의 대화) */
/** @typedef {"quick"|"default"|"complex"} Tier AI 모델 등급(ai/llm.js MODEL_OF — Haiku·Sonnet·Opus) */
/** @typedef {"lite"|"story"|"master"} ModelKey 대화방이 고르는 모델(ai/models.js MODELS) */
/** @typedef {"short"|"mid"|"long"} LenKey 출력량(ai/models.js LEN) */
/** @typedef {"rooms"|"wallet"|"settings"|"cloud"|"route"|"session"} EventName core/events.js의 이벤트 이름 */
/** @typedef {string} ImageRef 그림 참조 — "kv:img…"(IndexedDB·계정 — 페르소나 사진) · "data:image/…" · "content/…/images/x.webp"(빌드가 실은 그림). 검사는 services/images.js validRef */
/** @typedef {Record<string, string|number>} StatusMap 상태창 { "칸 이름": 값 } — 게이지 칸은 0~100 숫자, 다인원 칸은 "이름 n · 이름 n" 문자열 */

/**
 * 출연진 한 명. code는 그림 코드의 글자 부분 — 본문 태그 [[HSY3]](코드+감정 번호 한 토큰)·그림 파일 HSY3.webp·images의 키(images/codes.js).
 * @typedef {Object} CastMember
 * @property {string} code 영문 대문자 1~4자(CODE_RE — 숫자 없이, MP·EV는 예약)
 * @property {string} name
 * @property {string} [of] 다른 모습(폼)이면 본체 인물의 code — 폼은 별도 코드로 그림을 갖고, 프롬프트에 '그 모습일 때만'으로 안내
 * @property {string} [look] 한국어 외모(성별·나이 포함 — AI가 읽고, guessAud가 성별을 봄)
 * @property {string} [tags] 영문 Danbooru 외모 태그 — 앱은 쓰지 않음. 앱 밖에서 그림을 만들 때 같은 인물을 맞추는 기준(빌드가 한글을 막음)
 */
/**
 * 키워드북 항목. 대화에 keys 중 하나가 나오면 text를 AI에 전달.
 * @typedef {Object} LoreEntry
 * @property {string[]} keys 첫 키워드가 세계관 일러스트(loreImages)의 키
 * @property {string} text
 * @property {string} [kind] 항목 종류(ui/worldart.js LORE_KINDS: person·creature·place·item·event·group·concept) — 상세 페이지 세계관 카드의 머리표
 * @property {string} [tags] 그 항목을 그릴 영문 낱말 — 앱은 쓰지 않음(앱 밖에서 lore-<n> 그림을 만들 때)
 */
/**
 * 시작 상황(오프닝).
 * @typedef {Object} Opening
 * @property {string} title
 * @property {string} text 첫 장면 본문([[HSY0]] 같은 그림 태그 포함 가능 — 인물 코드 + 감정 번호 0~14)
 * @property {string} [directive] AI에게만 주는 지시
 * @property {StatusMap} [status] 시작 상태창
 */
/**
 * 장소(코드 MP<n>, places의 n번째 — 1부터). 그림은 images/MP<n>.*
 * @typedef {Object} Place
 * @property {string} name
 * @property {string} [desc]
 * @property {string} [tags] 영문 태그 — 앱은 쓰지 않음(앱 밖에서 그림을 만들 때)
 */
/**
 * 컷씬(코드 EV<n>, cuts의 n번째 — 1부터). when이 처음 이루어지는 순간 한 번. 그림은 images/EV<n>.*
 * @typedef {Object} Cut
 * @property {string} title
 * @property {string} [when] 나오는 조건(AI가 읽음)
 * @property {string} [tags] 영문 태그 — 앱은 쓰지 않음
 */
/** @typedef {Record<string, Record<string, ImageRef>>} ImagesMap 코드 글자 부분(인물 코드·MP·EV) → 번호(인물은 감정 칸 "0"~"14", MP·EV는 "1"부터) → 그림 참조 */
/**
 * 작품(캐릭터·세계관). 오리지널은 content/…/work.js(빌드가 aud·row·images·img·loreImages를 더함).
 * @typedef {Object} Work
 * @property {string} id 작품 폴더 이름
 * @property {string} name 주인공(또는 작품) 이름 — 1:1 작품의 화자
 * @property {string} title
 * @property {string} glyph 표지 가운데 한 글자
 * @property {string} cat 장르(core/constants.js CATS)
 * @property {number} pal 표지 색 0~7(PALETTES)
 * @property {string} motif 표지 무늬(MOTIFS 키)
 * @property {boolean} [world_mode] 여러 인물이 나오는 군상극(세계관)
 * @property {boolean} [isNew]
 * @property {string} oneLiner
 * @property {string[]} tags
 * @property {string} desc
 * @property {string} persona AI에게 주는 인물·진상 설정
 * @property {string} [world]
 * @property {string} [speech]
 * @property {string} [secret]
 * @property {string[]} fields 상태창 칸 이름
 * @property {string} [gauge] 관계 게이지 칸(fields 중 하나)
 * @property {LoreEntry[]} [lore]
 * @property {CastMember[]} [cast] 없으면 content/index.js·normalizeChar가 한 명(code "C")을 만듦
 * @property {Place[]} [places] 장소 목록 — 순서대로 MP1, MP2…
 * @property {Cut[]} [cuts] 컷씬 목록 — 순서대로 EV1, EV2…
 * @property {string} [lookTags] cast가 없는 1:1 작품의 영문 외모 태그 — 앱은 쓰지 않음(앱 밖에서 그림을 만들 때)
 * @property {string} [artTags] 그 세계관의 영문 낱말(시대·장소·분위기) — 앱은 쓰지 않음(앱 밖에서 표지·세계관 일러스트를 만들 때)
 * @property {Opening[]} openings
 * @property {Aud} [aud] 오리지널은 폴더가 정함, 없으면 guessAud
 * @property {string} [row] 홈 가로 줄(폴더 이름)
 * @property {ImagesMap} [images] 작품 폴더 images/의 그림
 * @property {ImageRef} [img] 대표 일러스트(표지, images/cover.*)
 * @property {Record<string, ImageRef>} [loreImages] 키워드북 첫 키워드 → 세계관 일러스트(images/lore-<n>.*)
 * @property {string} [creator] 예전 커뮤니티 작품의 크리에이터 이름(그 작품으로 연 방의 작품 사본에만 남아 있을 수 있음 — ui/detail.js)
 */
/**
 * 내 페르소나(대화에서 내가 연기하는 인물).
 * @typedef {Object} Persona
 * @property {string} id
 * @property {string} name
 * @property {string} memo 목록에 보이는 한 줄
 * @property {string} desc AI가 보는 상세 정보
 * @property {ImageRef|""} img
 * @property {boolean} [def] 기본 페르소나
 */
/**
 * 유저 메시지. sys면 "(이어서)" 같은 시스템 입력.
 * @typedef {Object} UserMessage
 * @property {string} id
 * @property {"user"} role
 * @property {string} text
 * @property {boolean} [sys]
 * @property {boolean} [editing]
 */
/**
 * AI 응답 한 버전(다시 쓰기마다 하나).
 * @typedef {Object} Alt
 * @property {string} text 본문([[HSY3]] 그림 태그 포함 — 예전 방의 [[img:…]]는 migrateRoom이 바꿈)
 * @property {StatusMap} [status] 이 응답 뒤의 상태창
 * @property {string[]} [suggestions] 추천 답변(✦ AI 추천을 눌렀을 때만 보여 줌)
 * @property {string} [cost] "무료"·"PLUS"·"♥n"
 * @property {string[]} [lore] 이 응답에 반영된 키워드
 * @property {boolean} [opening] 시작 상황 본문이면 true
 */
/**
 * AI 메시지. alts[idx]가 현재 보이는 버전.
 * @typedef {Object} AiMessage
 * @property {string} id
 * @property {"ai"} role
 * @property {number} idx
 * @property {Alt[]} alts
 * @property {StatusMap} statusBefore 이 응답 직전 상태창(되돌리기·비교에 씀)
 * @property {boolean} [editing]
 */
/** @typedef {UserMessage|AiMessage} Message */
/**
 * 대화방 설정.
 * @typedef {Object} RoomSet
 * @property {ModelKey} model
 * @property {LenKey} len
 * @property {number} mem 기억력(최근 몇 턴을 그대로 읽는지)
 * @property {boolean} rerollAsk 다시 쓰기 전에 방향을 물음
 * @property {boolean} [autoScroll]
 */
/** @typedef {{ at: number, label: string, text: string }} MemHist 장기기억 히스토리 한 건 */
/**
 * 대화방(KV "room-<id>"). 목록용 요약은 RoomIndex(S.rooms).
 * @typedef {Object} Room
 * @property {string} id
 * @property {boolean} [v2]
 * @property {Work} char 방을 만들 때의 작품 사본(최신 키워드북·그림은 getChar로 따로 봄)
 * @property {{ id: string, name: string, memo: string, desc: string, img: ImageRef|"" }} persona
 * @property {string} opening 시작 상황 제목
 * @property {string} directive
 * @property {string} userNote
 * @property {string} memory 장기기억
 * @property {MemHist[]} memHist
 * @property {number} sinceMem 마지막 요약 뒤 지난 턴
 * @property {number} turn
 * @property {StatusMap} status
 * @property {string[]} bookmarks 메시지 id
 * @property {RoomSet} set
 * @property {Message[]} msgs
 * @property {number} at 마지막 저장 시각
 * @property {number} created
 * @property {string} [lastErr] 마지막 오류 안내(대화방 아래 오류 줄 + 다시 시도)
 */
/**
 * 대화방 목록 항목(S.rooms, core/rooms.js indexRoom이 만듦) — 표지를 그릴 수 있게 작품 정보 일부를 복사해 둠.
 * @typedef {Object} RoomIndex
 * @property {string} id
 * @property {string} charId
 * @property {string} name
 * @property {string} title
 * @property {string} glyph
 * @property {number} pal
 * @property {string} motif
 * @property {ImageRef|""} img
 * @property {number} at
 * @property {string} last 마지막 줄 미리보기
 */
/** @typedef {{ at: number, d: number, label: string }} LedgerItem 하트 장부 한 줄(d는 변화량) */
/**
 * 지갑(데모 — 실제 청구 없음).
 * @typedef {Object} Wallet
 * @property {number} hearts
 * @property {string} freeDay 무료 턴을 센 날짜(util today())
 * @property {number} freeUsed
 * @property {{ until: number }|null} pro PLUS 만료 시각
 * @property {unknown[]} history
 * @property {LedgerItem[]} ledger
 * @property {Record<string, boolean>} ack
 */
/** @typedef {{ type: "free"|"plus"|"heart", n: number, list: number }} Quote 한 턴 견적 — n은 낼 하트, list는 정가 */
/** @typedef {{ memTurns: number, memoMax: number, hist: number, rooms: number }} Plan 요금제 한도(core/wallet.js PLAN) */
/** @typedef {{ auto: boolean, every: number, limit: number, guide: "auto"|"custom", custom: string }} MemCfg 장기기억 요약 설정 */
/**
 * 설정(S.settings, localStorage hv1_settings). API 키(apiKey)는 이 브라우저에만 — 계정에는 올리지 않음(services/cloud.js가 빼고, 서버 표 제약 kv_no_plain_keys도 거부).
 * 예전 빌드의 그림·성인 설정 칸(customSits·styleSets·isAgeVerified 등)이 남아 있을 수 있지만 쓰는 코드가 없음(core/migrate.js).
 * @typedef {Object} Settings
 * @property {number} fs 채팅 글자 크기 13~21
 * @property {number} chatLh 줄 간격
 * @property {"serif"|"sans"} narrFont
 * @property {boolean} enterSend
 * @property {boolean} sceneImg 대화 속 장면 그림 보기
 * @property {string} apiKey Anthropic
 * @property {MemCfg} memCfg
 * @property {Aud} [audience]
 */
/**
 * 전역 상태 S(core/state.js). 저장은 KV — 바꾼 모듈이 save…()로 씀.
 * @typedef {Object} State
 * @property {Wallet} wallet
 * @property {Persona[]} personas
 * @property {RoomIndex[]} rooms
 * @property {Settings} settings
 * @property {string} cat 홈 장르 필터(ui/home.js)
 * @property {string} q 홈 검색어
 */
/** @typedef {{ anthropicUrl: string, supabaseUrl?: string, supabaseKey?: string, serverKeys?: boolean }} Config window.HEARTVERSE_CONFIG로 덮는 연결 설정 — serverKeys면 프록시가 키를 가짐 */
/** @typedef {{ role: "system"|"user"|"assistant", content: string }} LLMMessage AI 요청 메시지(첫 메시지 = 시스템) */
/**
 * llm() 옵션.
 * @typedef {Object} LLMOptions
 * @property {Tier} [tier="quick"]
 * @property {(e: { text: string, delta: string }) => void} [onText] 스트리밍 조각마다(text는 지금까지 전부)
 * @property {AbortSignal} [signal] 사용자 취소
 * @property {boolean} [json=false] 응답을 JSON으로 파싱해 돌려줌
 * @property {number} [maxTokens=2000]
 */
/**
 * AI 호출이 던지는 오류. code → 안내 문구는 ai/llm.js errCopy.
 * code: cancelled(사용자 취소) · timeout · refused · rate_limited · no_engine · bad_key · upstream_error · invalid_json · session_expired
 * @typedef {Object} LLMError
 * @property {string} code
 * @property {string} [text] 끊기기 전까지 받은 본문
 * @property {string} [msg] 서버 메시지
 * @property {string|null} [category] 거절 분류(stop_details.category)
 */
/** @typedef {{ signal: AbortSignal, timedOut: boolean, clear(): void, tick(ms?: number): void }} TimeoutSignal core/util.js timeoutSignal이 돌려주는 것 */
/**
 * 공지사항(Supabase public.notices — docs/supabase.sql). 관리자만 쓰고, 로그인 없이도 published인 것을 읽음.
 * @typedef {Object} Notice
 * @property {number} id
 * @property {string} title 120자까지
 * @property {string} body 8000자까지(주소는 링크로 보임)
 * @property {boolean} pinned 맨 위에 고정
 * @property {boolean} published false면 관리자에게만 보임
 * @property {string} created_at ISO 시각
 * @property {string} updated_at
 */
/**
 * 문의(Supabase public.inquiries). 로그인한 본인이 쓰고 읽고 지움, 관리자가 답함(answer·status만 고칠 수 있음 — 열 권한).
 * @typedef {Object} Inquiry
 * @property {number} id
 * @property {string} user_id 쓴 계정(서버가 auth.uid()로 채움)
 * @property {string} category services/support.js ASK_CATS
 * @property {string} title 100자까지
 * @property {string} body 4000자까지
 * @property {string|null} reply_to 답변 받을 이메일(선택)
 * @property {{ ua?: string, screen?: string, engine?: string, app?: string, host?: string }|null} meta '앱·브라우저 정보 함께 보내기'를 켰을 때
 * @property {"open"|"answered"|"closed"} status 답을 쓰면 서버가 answered로
 * @property {string|null} answer 운영자 답변
 * @property {string|null} answered_at
 * @property {string} created_at
 */

export {};
