/* 데이터 모양 정의(JSDoc @typedef만 — 런타임 코드 없음). 어느 모듈도 import하지 않아 번들에 들어가지 않고, 편집기(jsconfig.json)가 다른 모듈의
   `@typedef {import("../core/types.js").Room} Room` 줄로 끌어다 쓴다. 칸이 바뀌면 여기와 실제로 만드는 곳(core/state.js의 S 기본값, core/rooms.js의 newRoom,
   content/README.md의 work.js 모양)을 같이 고치기. 검사는 하지 않는다(checkJs false) — 사람과 AI가 모양을 한눈에 보라는 문서 */

/** @typedef {"safe"|"questionable"|"explicit"} Rating 그림 수위(images/rating.js RATINGS) */
/** @typedef {"all"|"m"|"f"} Aud 관심있는 대화: 전체 · 남성향(여성 캐릭터와의 대화) · 여성향(남성 캐릭터와의 대화) */
/** @typedef {"quick"|"default"|"complex"} Tier AI 모델 등급(라이트·스토리·마스터가 차례로 씀) */
/** @typedef {"lite"|"story"|"master"} ModelKey 대화방이 고르는 모델(ai/models.js MODELS) */
/** @typedef {"short"|"mid"|"long"} LenKey 출력량(ai/models.js LEN) */
/** @typedef {"rooms"|"wallet"|"settings"|"vault"|"cloud"|"community"|"route"} EventName core/events.js의 이벤트 이름 */
/** @typedef {string} ImageRef 그림 참조 — "/_blob/<id>"(claude.ai assets) · "kv:img…"(IndexedDB·계정) · "data:image/…" · "content/…/images/x.webp"(빌드가 실은 그림). 검사는 services/images.js validRef */
/** @typedef {{ ref: string, on: boolean, local?: boolean }} Motion 그림 칸의 움짤(짧은 반복 영상) — ref는 /_blob/ · kv:img…(본문 data:video/…) · content/….mp4 · Runware 임시 주소(services/images.js validMotion), on이면 사진 대신 보임, local이면 커서 계정에 안 올리고 이 기기에만(images/motion.js) */
/** @typedef {string} ComboKey 그림 조합 키 — "3"(번호 하나) 또는 "3,404,501"(감정 오름차순 → 의상 → 장소, images/codes.js keyOf) */
/** @typedef {Record<string, string|number>} StatusMap 상태창 { "칸 이름": 값 } — 게이지 칸은 0~100 숫자, 다인원 칸은 "이름 n · 이름 n" 문자열 */

/**
 * 출연진 한 명. code는 그림 태그 [[img:code:번호]]와 images의 키.
 * @typedef {Object} CastMember
 * @property {string} code 영문 소문자·숫자
 * @property {string} name
 * @property {string} [look] 한국어 외모(성별·나이 포함 — guessAud·whoTags가 읽음)
 * @property {string} [tags] 영문 Danbooru 외모 태그(있으면 그림 프롬프트의 인물 묶음에 번역 없이 그대로)
 */
/**
 * 키워드북 항목. 대화에 keys 중 하나가 나오면 text를 AI에 전달.
 * @typedef {Object} LoreEntry
 * @property {string[]} keys 첫 키워드가 세계관 일러스트(loreImages)의 키
 * @property {string} text
 * @property {string} [kind] 항목 종류(ui/worldart.js LORE_KINDS: person·creature·place·item·event·group·concept) — 세계관 일러스트의 구도(images/prompt.js LORE_SHOT)
 * @property {string} [tags] 세계관 일러스트를 그릴 때 text 대신 쓰는 영문 태그
 */
/**
 * 시작 상황(오프닝).
 * @typedef {Object} Opening
 * @property {string} title
 * @property {string} text 첫 장면 본문([[img:코드:0]] 포함 가능)
 * @property {string} [directive] AI에게만 주는 지시
 * @property {StatusMap} [status] 시작 상태창
 */
/** @typedef {Record<string, Record<ComboKey, ImageRef>>} ImagesMap 인물 코드 → 조합 키 → 그림 참조 */
/**
 * 작품(캐릭터·세계관). 오리지널은 content/…/work.js(빌드가 aud·row·images·img·loreImages를 더함), 내 작품은 S.mine, 커뮤니티는 S.community.
 * @typedef {Object} Work
 * @property {string} id 오리지널은 폴더 이름, 내 작품은 "u…"
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
 * @property {CastMember[]} [cast] 없으면 content/index.js·normalizeChar가 한 명(code "c")을 만듦
 * @property {string} [lookTags] cast가 없는 1:1 작품의 영문 외모 태그
 * @property {string} [artTags] 그 세계관의 영문 낱말(시대·장소·분위기) — 표지·세계관 일러스트 프롬프트에 붙음
 * @property {Opening[]} openings
 * @property {Aud} [aud] 오리지널은 폴더가 정함, 없으면 guessAud
 * @property {string} [row] 홈 가로 줄(폴더 이름)
 * @property {ImagesMap} [images] 작품에 붙은 그림(오리지널은 content/…/images/, 내 작품은 만든 것)
 * @property {ImageRef} [img] 대표 일러스트(표지)
 * @property {Record<string, ImageRef>} [loreImages] 키워드북 첫 키워드 → 세계관 일러스트
 * @property {Record<string, Record<ComboKey, string>>} [motions] 오리지널: 작품 폴더 images/의 움짤(인물 코드 → 조합 키 → content/….mp4, 켜진 것으로 봄)
 * @property {boolean} [publish] 내 작품: 커뮤니티 공개 여부
 * @property {string} [creator] 커뮤니티 작품의 크리에이터 이름
 * @property {number} [updated]
 */
/**
 * 이미지 코드(직접 만든 칸·내장 코드·작품 폴더에 실린 코드). 15~99 감정/행동, 1xx 세부 감정, 4xx 의상, 5xx 장소.
 * @typedef {Object} CodeDef
 * @property {number} n
 * @property {string} name
 * @property {string} prompt 영문 태그 또는 한국어(만들 때 번역)
 * @property {Rating} rating
 * @property {string} [keys] 유저 입력에서 이 코드를 고르는 낱말 "낱말|낱말"
 * @property {boolean} [builtin] images/codes.js DIMS의 내장 코드
 * @property {boolean} [shipped] content/codes.json에서 실린 코드(CONTENT_CODES)
 * @property {"act"|"wear"|"place"} [dim]
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
 * @property {string} text 본문([[img:…]] 태그 포함)
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
 * @property {boolean} allowUnfiltered 이 방에서 성인 무검열(ageOK·OpenRouter 키 필요)
 */
/** @typedef {{ at: number, label: string, text: string }} MemHist 장기기억 히스토리 한 건 */
/**
 * 대화방(KV "room-<id>"). 목록용 요약은 RoomIndex(S.rooms).
 * @typedef {Object} Room
 * @property {string} id
 * @property {boolean} [v2]
 * @property {Work} char 방을 만들 때의 작품 사본(최신 키워드북은 getChar로 따로 봄)
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
 * 그림체 세트(관리자 도구에서 그림·ZIP으로 만듦).
 * @typedef {Object} StyleSet
 * @property {string} id
 * @property {string} name
 * @property {ImageRef[]} refs 참고 그림(최대 8)
 * @property {string} prompt 그림체 문구
 * @property {string} model 이미지 모델 AIR id
 * @property {string} [overrides] 덮어쓰는 내장 기본 화풍 id
 */
/** @typedef {{ id: string, name: string, prompt: string, model: string }} StyleInfo styleFor()가 고른 그림체 */
/**
 * 설정(S.settings, localStorage hv1_settings). 키 칸(apiKey·runwareKey·openRouterKey)은 계정에는 암호화된 금고(vault)로만 올라감.
 * @typedef {Object} Settings
 * @property {number} fs 채팅 글자 크기 13~21
 * @property {number} chatLh 줄 간격
 * @property {"serif"|"sans"} narrFont
 * @property {boolean} enterSend
 * @property {boolean} sceneImg 대화 속 장면 그림 보기
 * @property {boolean} autoImg 대화 중 그림 자동 생성(관리자 도구)
 * @property {string} apiKey Anthropic
 * @property {string} runwareKey
 * @property {string} openRouterKey
 * @property {string} customUnfilteredModel OpenRouter 모델 직접 지정
 * @property {CodeDef[]} customSits 직접 만든 이미지 칸
 * @property {string} imgModel 직접 입력 그림체의 모델
 * @property {string} imgStyle "auto" · "sys:<내장 id>" · "set:<세트 id>" · 프리셋 이름 · "custom"
 * @property {string} [imgStyleCustom]
 * @property {StyleSet[]} [styleSets]
 * @property {Record<string, Rating>} [sheetRatings] 작품별(그리고 "w:"+id 세계관) 기본 칸 그림 수위
 * @property {MemCfg} memCfg
 * @property {Aud} [audience]
 * @property {boolean} isAgeVerified 성인 자기 확인
 * @property {boolean} contentFilter false면 모든 대화방이 성인 모드
 * @property {boolean} autoFallback Claude가 거절하면 OpenRouter로
 * @property {boolean} [syncKeys] API 키도 계정 금고에 저장(기본 켜짐)
 */
/**
 * 전역 상태 S(core/state.js). 저장은 KV — 바꾼 모듈이 save…()로 씀.
 * @typedef {Object} State
 * @property {Wallet} wallet
 * @property {Persona[]} personas
 * @property {{ nick: string }} profile
 * @property {Work[]} mine 내가 만든 작품
 * @property {RoomIndex[]} rooms
 * @property {Work[]} community
 * @property {Record<string, ImagesMap[string] extends infer R ? Record<string, Record<ComboKey, ImageRef>> : never>} imgpacks 작품 id → 인물 코드 → 조합 키 → 그림(내 계정이 작품에 덧씌움)
 * @property {Record<string, ImageRef>} coverpacks 작품 id → 표지
 * @property {Record<string, Record<string, ImageRef>>} lorepacks 작품 id → 키워드 → 세계관 일러스트
 * @property {Record<string, Record<string, object>>} tagpacks 작품 id → 인물 코드 → 저장한 태그 차이
 * @property {Record<string, Record<string, Record<ComboKey, Motion|null>>>} motionpacks 작품 id → 인물 코드 → 조합 키 → 움짤(null은 실린 움짤을 가림)
 * @property {Settings} settings
 * @property {"pending"|"sample"|"byok"|"none"} engine AI 연결 상태
 * @property {string} cat
 * @property {string} q
 * @property {string[]|null} [sampleTiers]
 */
/** @typedef {{ anthropicUrl: string, runwareUrl: string, openRouterUrl: string, supabaseUrl?: string, supabaseKey?: string, serverKeys?: boolean }} Config window.HEARTVERSE_CONFIG로 덮는 연결 설정 — serverKeys면 프록시가 키를 가짐 */
/** @typedef {{ role: "system"|"user"|"assistant", content: string }} LLMMessage AI 요청 메시지(첫 메시지 = 시스템) */
/**
 * llm()·openRouterStream() 옵션.
 * @typedef {Object} LLMOptions
 * @property {Tier} [tier="quick"]
 * @property {(e: { text: string, delta: string }) => void} [onText] 스트리밍 조각마다(text는 지금까지 전부)
 * @property {AbortSignal} [signal] 사용자 취소
 * @property {boolean} [json=false] 응답을 JSON으로 파싱해 돌려줌
 * @property {number} [maxTokens=2000]
 * @property {Room|null} [room] 대화 요청이면 그 방(성인 경로 판정)
 * @property {boolean} [adult=false] 성인 수위 요청(그림 태그 번역 등) — OpenRouter로만
 */
/**
 * AI·그림 호출이 던지는 오류. code → 안내 문구는 ai/llm.js errCopy, images/runware.js genErr.
 * code: cancelled(사용자 취소) · timeout · refused · rate_limited · prompt_too_large · no_engine · bad_key · upstream_error · invalid_json · garbled ·
 *       no_or_key · or_bad_key · or_no_funds · or_bad_model · or_network · network · minor_block · blocked · no_funds · bad_model · image_fetch …
 * @typedef {Object} LLMError
 * @property {string} code
 * @property {string} [text] 끊기기 전까지 받은 본문
 * @property {string} [msg] 서버 메시지
 * @property {string|null} [category] 거절 분류(cyber·bio… 면 우회하지 않음)
 */
/** @typedef {{ signal: AbortSignal, timedOut: boolean, clear(): void, tick(ms?: number): void }} TimeoutSignal core/util.js timeoutSignal이 돌려주는 것 */

export {};
