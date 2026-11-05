/* 움짤·행동 코드 표(관리자 빌드만, 데이터만 — 로직은 admin/motion-prompts.js): 번호 → { title 표에서 읽을 이름, base_prompt 정지 그림 태그, motion_en 움직임 문장 }.
   이 파일의 두 표만 덮어쓰면 된다: MotionPrompts(기본), MotionPrompts_Male(남자 인물 — 같은 번호가 있으면 이쪽, 없으면 기본 표). `as const`는 TypeScript 문법이라 쓰지 않음.
   적용 범위: 코드 정의의 수위가 전체이용가인 칸에만 쓰인다 — base_prompt는 내장·관리자 전용 코드의 그림 프롬프트를, motion_en은 움짤 문장을 대신한다. 세미·성인 수위 칸은 이 표를 보지 않음(그 칸의 움짤은 MOTION_PROMPT).
   코드로 정의되지 않은 번호(내장·내 칸·코드 표 어디에도 없음)도 쓰이지 않음 — 수위를 알 수 없어서. 새 번호는 이미지 스튜디오의 '목록으로 추가'로 같은 모양을 붙여 넣어 코드로 만든다.
   이 파일은 공개 저장소와 웹 주소의 admin.html에 그대로 실린다 — 성인 수위 표를 두지 않는 원칙(CLAUDE.md)은 여기에도 적용, tests/unit/motion-prompts.test.mjs가 표의 번호를 고정함 */
export const MotionPrompts = {
  // 100번대: 세부 감정·일상
  101: { title: "미소_지음", base_prompt: "smile, soft expression, gentle eyes, warm atmosphere, happy", motion_en: "smiling softly, gentle eyes blinking, warm and happy facial expression" },
  102: { title: "분노_표출", base_prompt: "frown, glaring, hostile, sharp eyes, cold stare", motion_en: "glaring intensely, sharp hostile eye movement, frowning deeply" },
  103: { title: "당황함", base_prompt: "panic, sweating, blushing, looking away, stiff posture", motion_en: "looking around in panic, sweating heavily, stiff and tense body movement, blushing deeply" },
  105: { title: "취기_오름", base_prompt: "drunk, glazed eyes, blushing, sluggish, bold behavior", motion_en: "swaying sluggishly, glazed eyes looking around, bold and unrestrained body movement, flushed cheeks" },
  106: { title: "슬픔_오열", base_prompt: "crying, tears, sobbing, head down, sad eyes, trembling lips", motion_en: "shoulders shaking violently from crying, tears streaming down cheeks, lips trembling, head bowing down" },
  107: { title: "수줍음_부끄러움", base_prompt: "blush, looking away, fidgeting, shy, faint smile", motion_en: "fidgeting nervously, looking away shyly, faint smile appearing, cheeks blushing" },
  108: { title: "차가운_정색", base_prompt: "expressionless, cold stare, crossed arms, distant, looking down", motion_en: "staring coldly without expression, arms crossed tightly, looking down with a distant gaze" },
  109: { title: "체력_방전", base_prompt: "panting, exhausted, sweat, slumped, heavy breathing", motion_en: "panting heavily, slumped posture, chest rising and falling rapidly from exhaustion, sweat dripping" },
  110: { title: "질투_폭발", base_prompt: "jealous, pout, side glance, crossed arms, sulking", motion_en: "pouting angrily, casting side glances, crossing arms with a jealous expression, sulking movement" },
  112: { title: "애교_부림", base_prompt: "puppy eyes, looking up, clinging, cute, cheek to cheek", motion_en: "looking up with puppy eyes, clinging affectionately, rubbing cheek against viewer" },
  113: { title: "거부_밀쳐냄", base_prompt: "rejecting, pushing away, turning head, grimace, defensive", motion_en: "pushing away forcefully, turning head in rejection, defensive grimacing facial expression" },
  114: { title: "허탈함_공허함", base_prompt: "empty eyes, blank expression, listless, sigh, slumped shoulders", motion_en: "empty eyes staring blankly, listless sighing, shoulders slumping in emptiness" },
  115: { title: "안도감_긴장풀림", base_prompt: "relieved, deep breath, soft smile, relaxed, peaceful", motion_en: "taking a deep breath of relief, soft smile forming, body relaxing peacefully" },
  116: { title: "장난스러움", base_prompt: "wink, tongue out, playful smile, mischievous, teasing", motion_en: "winking playfully, sticking tongue out teasingly, mischievous smile spreading" },
  117: { title: "애틋함_그리움", base_prompt: "affectionate, wistful eyes, gentle touch, staring into eyes", motion_en: "staring affectionately with wistful eyes, gentle touching motion, longing gaze" },
  118: { title: "경계_의심", base_prompt: "wary, narrowed eyes, leaning back, defensive stance, tense", motion_en: "narrowing eyes warily, leaning back defensively, tense and suspicious posture" },
  119: { title: "절망_좌절", base_prompt: "despair, head in hands, collapsed, crying, tear stains", motion_en: "collapsing in despair, burying head in hands, crying uncontrollably, tear stains forming" },
  120: { title: "환희_기쁨", base_prompt: "big smile, excited, bright expression, hands together, sparkling eyes", motion_en: "smiling brightly, clapping hands together in excitement, eyes sparkling with joy" },
  121: { title: "놀람_경악", base_prompt: "shocked, wide eyes, open mouth, hand over mouth, stepping back", motion_en: "eyes widening in shock, mouth opening in gasp, stepping back, hands covering mouth" },
  122: { title: "식사_음주", base_prompt: "eating, holding wine glass, tableware, food, satisfied", motion_en: "chewing food with a satisfied expression, holding and moving wine glass gently" },
  123: { title: "게임_집중", base_prompt: "playing games, holding controller, focused, serious expression, monitor", motion_en: "staring intently at monitor, fingers moving rapidly on controller, focused gaming expression" },
  124: { title: "수면_졸음", base_prompt: "sleeping, nodding off, closed eyes, yawning, rubbing eyes", motion_en: "nodding off to sleep, rubbing eyes sleepily, yawning wide, eyes slowly closing" },
  125: { title: "독서_학습", base_prompt: "reading, reading book, glasses, focused, quiet", motion_en: "turning book pages, adjusting glasses, focused reading expression, quiet movement" },
  126: { title: "가벼운대화_잡담", base_prompt: "talking, open mouth, eye contact, listening, light hand gesture", motion_en: "talking animatedly, making light hand gestures, maintaining eye contact while speaking" },
  127: { title: "머리쓰다듬기_받음", base_prompt: "pov, headpat, being pet by partner, closed eyes, pleased, soft hair", motion_en: "POV partner's hand gently petting and stroking head, hair swaying smoothly under touch, closing eyes in pleasure, soft affectionate movement" },
  128: { title: "무릎베개_누움", base_prompt: "lap pillow, lying on partner's lap, looking up at viewer, pov, peaceful", motion_en: "POV looking up from partner's lap, peaceful relaxed breathing, slight head movement on thighs, soft intimate eye contact" },
  129: { title: "가벼운장난_간지럼_받음", base_prompt: "being tickled by partner, flinching, giggling, dodging, cheerful", motion_en: "POV partner's hands tickling sides, body flinching and squirming dynamically, giggling happily, playfully dodging hands" },
  130: { title: "삐침_토라짐", base_prompt: "pout, turning away, puffed cheeks, not looking, sulking", motion_en: "turning head away with puffed cheeks, sulking and pouting, avoiding eye contact" },
  131: { title: "요리_베이킹", base_prompt: "cooking, wearing apron, kitchen, tasting food", motion_en: "stirring food in kitchen, wearing apron, tasting food carefully with a concentrated look" },
  132: { title: "스마트폰_보기", base_prompt: "looking at phone, typing on phone, phone screen glow, indifferent", motion_en: "typing rapidly on phone screen, screen glow illuminating face, indifferent scrolling motion" },
  133: { title: "기지개_스트레칭", base_prompt: "stretching, arms up, closed eyes, languid", motion_en: "stretching arms high, languid body movement, closing eyes comfortably" },
  134: { title: "화장_단장", base_prompt: "applying makeup, looking in mirror, applying lipstick, dressing up", motion_en: "applying lipstick carefully, looking in mirror, getting dressed up motion" },
  135: { title: "음악_감상", base_prompt: "listening to music, wearing earphones, closed eyes, humming", motion_en: "head nodding to music rhythm, wearing earphones, humming with closed eyes" },
  136: { title: "심호흡_진정", base_prompt: "deep breath, composing oneself, closed eyes, calming down", motion_en: "taking a deep calming breath, closing eyes to compose oneself, chest expanding" },
  137: { title: "기다림_초조", base_prompt: "anxious, restless, checking watch, biting lip, looking around", motion_en: "checking watch anxiously, looking around restlessly, biting lip in nervousness" },
  138: { title: "억지_미소", base_prompt: "forced smile, stiff smile, sad eyes, trembling", motion_en: "forcing a stiff smile, sad eyes trembling, lips quivering slightly" },
  139: { title: "감동의_눈물", base_prompt: "tears of joy, moved, crying, bright smile, sparkling eyes", motion_en: "crying tears of joy, smiling brightly while moved, eyes sparkling with emotion" },
  140: { title: "짜증_신경질", base_prompt: "irritated, hand on forehead, sharp glare, sigh, annoyed", motion_en: "sighing in irritation, putting hand on forehead, sharp annoyed glare" },
  // 200번대: 가벼운 스킨십(코드 정의는 관리자 코드 표 content/codes.admin.json — 정의가 있을 때만 쓰임)
  201: { title: "가벼운_포옹", base_prompt: "hug, embracing, close contact, chest to chest, looking at each other", motion_en: "hugging tightly, rubbing back gently, chest pressing against chest, swaying softly" },
  202: { title: "베이비_키스", base_prompt: "light kiss, pecking, gentle kiss, closed eyes", motion_en: "pecking lightly on lips, gentle kissing motion, eyes closing softly" },
  213: { title: "손깍지_밀착", base_prompt: "holding hands, intertwined fingers, tight grip, warmth", motion_en: "fingers intertwining tightly, hands gripping with strength, subtle warm movement" },
  214: { title: "이마_볼_키스_받음", base_prompt: "pov, kissed on forehead and cheek, affectionate, loving gaze from partner", motion_en: "POV partner leaning in to kiss forehead and cheek, gentle romantic movement, loving gaze, soft touching" },
  215: { title: "백허그_받음", base_prompt: "pov, receiving backhug, hugged from behind by partner, chest to back", motion_en: "POV partner's arms wrapping tightly around waist from behind, being pulled into chest, swaying gently together, intimate warmth" },
  216: { title: "뺨_부비기", base_prompt: "cheek to cheek, rubbing cheeks, intimate, affectionate smile", motion_en: "rubbing cheeks together affectionately, intimate smiling, face pressing close" }
};
export const MotionPrompts_Male = {
  151: { title: "넥타이_풀기", base_prompt: "loosening tie", motion_en: "loosening tie" },
  251: { title: "쓰다듬어짐", base_prompt: "pov, touched", motion_en: "POV partner touching" }
};
