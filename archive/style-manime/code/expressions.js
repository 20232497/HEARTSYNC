/* 남성향 애니 화풍(manime)의 성격별 표정 태그 — 대표 칸의 표정·손동작을 인물의 성격(cast[].temper)에 따라 다르게 쓴다.
   대표 칸: 1 기본 · 2 웃음 · 3 부끄러움 · 4 슬픔 · 5 놀람 · 6 분노 · 7 삐침 · 8 공포 · 14 설렘 (대화에서 가장 자주 쓰이고 성격이 가장 잘 드러나는 칸).
   칸 1은 assemble.js의 기본 표정(CALM)과 손동작(TEMPERS)이 맡고, 여기는 칸 2~8·14만 — 그 밖의 칸(부상·회복·휴식·공격·각성)은 assemble.js EMOTIONS의 공통 표정.
   한 칸의 값: { f: 여성 표정·손동작, m: 남성, look?: 시선("away" 피함 · "down" 떨굼 · "viewer" 마주 봄 — 없으면 그 칸의 공통 시선), eyes?: { f, m } 눈 모양(없으면 그 칸의 공통 눈) }.
   만화 기호(반짝임·땀방울·하트)와 그 칸의 네거티브는 공통 표(EMOTIONS)의 것이 그대로 붙는다. 성격 값이 같으면 표정 태그도 같다 — 작품의 대표 인물만 아래 LEAD_EMO에서 버릇·소품을 따로 더한다 */

/** 성격별 표정 태그가 있는 대표 칸(칸 1은 assemble.js가 맡음) */
export const REP_SLOTS = [1, 2, 3, 4, 5, 6, 7, 8, 14];

const soft = { f: "(glaring:0.5), (v-shaped eyebrows:0.9)", m: "(glaring:0.5), (v-shaped eyebrows:0.9)" }; // 덜 매서운 화난 눈
const fear = { f: "(wide-eyed:0.9)", m: "(wide-eyed:0.5), (pupils:1.0)" }; // 남자는 눈을 크게 뜨면 앳돼 보여 덜 뜸
const calmFear = { f: "(wide-eyed:0.6)", m: "(wide-eyed:0.4), (pupils:1.0)" }; // 내색을 덜 하는 성격
const calmSurprise = { f: "(wide-eyed:0.7)", m: "(wide-eyed:0.5), (pupils:1.0)" }; // 눈을 덜 뜨는 놀람

export const TEMPER_EMO = {
  // 도도 — 웃어도 입은 다물고, 부끄러우면 토라지고, 눈물은 참고, 화는 차갑게
  도도: {
    2: { f: "(smile:1.1), (smug:0.8), (closed mouth:0.7), (raised eyebrow:0.5), (hand on own chin:0.6)", m: "(smile:1.0), (smirk:0.5), (closed mouth:0.8), (raised eyebrow:0.5)" },
    3: { f: "(embarrassed:1.2), (blush:1.5), (pout:0.8), (frown:0.4), (crossed arms:0.8)", m: "(embarrassed:1.1), (blush:1.0), (frown:0.5), closed mouth, (hand over own mouth:0.7)" },
    4: { look: "away", f: "(sad:1.2), (teary eyes:1.1), (tearing up:0.9), (biting own lip:0.7), (frown:0.7), (crossed arms:0.5)", m: "(sad:1.1), (teary eyes:0.8), (frown:0.8), closed mouth, (clenched hand:0.6)" },
    5: { eyes: calmSurprise, f: "(surprised:1.2), (raised eyebrows:0.9), (parted lips:0.8), (hand on own chest:0.5)", m: "(surprised:1.1), (raised eyebrow:0.8), (parted lips:0.5)" },
    6: { f: "(angry:1.2), (scowl:1.0), (frown:1.0), closed mouth, (crossed arms:1.0)", m: "(angry:1.2), (scowl:1.0), (frown:1.0), closed mouth, (crossed arms:0.9)" },
    7: { f: "(pout:1.0), (annoyed:1.0), (frown:0.6), (crossed arms:1.0), (head tilt:0.4)", m: "(annoyed:1.1), (frown:0.9), closed mouth, (crossed arms:0.9)" },
    8: { eyes: calmFear, f: "(scared:1.1), (nervous:0.9), (sweat:0.8), (frown:0.6), (parted lips:0.5), (hand on own arm:0.8)", m: "(scared:1.0), (nervous:0.8), (sweat:0.8), (frown:0.6), closed mouth" },
    14: { look: "away", f: "(blush:1.5), (embarrassed:0.6), (light smile:0.6), (pout:0.3), (playing with own hair:0.9)", m: "(blush:0.9), (light smile:0.6), closed mouth, (hand on own neck:0.7)" },
  },
  // 장난 — 이를 드러내고 웃고, 민망하면 멋쩍게 웃고, 슬퍼도 웃어 보이고, 화는 투덜거림으로
  장난: {
    2: { f: "(grin:1.2), (one eye closed:0.8), (open mouth:0.7), (happy:0.9), (v:0.7)", m: "(grin:1.1), (teeth:0.5), (one eye closed:0.5), (happy:0.8)" },
    3: { f: "(embarrassed:1.1), (blush:1.5), (nervous smile:0.9), (sweatdrop:0.5), (scratching cheek:0.9)", m: "(embarrassed:1.1), (blush:1.0), (nervous smile:0.8), (scratching head:0.9)" },
    4: { f: "(sad:1.1), (sad smile:1.0), (teary eyes:1.1), (tearing up:0.9), (hand on own arm:0.6)", m: "(sad:1.1), (sad smile:0.9), (teary eyes:0.8), closed mouth" },
    5: { f: "(surprised:1.4), (open mouth:1.1), (raised eyebrows:0.9), (hands up:0.9)", m: "(surprised:1.3), (open mouth:0.7), (raised eyebrows:0.9), (hand up:0.6)" },
    6: { eyes: soft, f: "(angry:1.2), (pout:1.0), (puffed cheeks:0.7), (hands on own hips:0.9)", m: "(annoyed:1.2), (angry:0.9), (frown:1.0), (clenched teeth:0.6), (hand on own hip:0.7)" },
    7: { f: "(pout:1.3), (puffed cheeks:1.1), (annoyed:0.7), (hands on own hips:0.9)", m: "(pout:0.8), (annoyed:0.9), (frown:0.6), closed mouth, (hand on own hip:0.7)" },
    8: { eyes: fear, f: "(scared:1.3), (nervous smile:0.7), (sweat:1.0), (open mouth:0.6), (hands up:0.8)", m: "(scared:1.1), (nervous smile:0.7), (sweat:1.0), (parted lips:0.6), (hand up:0.6)" },
    14: { f: "(blush:1.6), (grin:0.6), (nervous smile:0.6), (scratching cheek:0.8)", m: "(blush:0.9), (nervous smile:0.7), (scratching cheek:0.8)" },
  },
  // 해맑음 — 활짝 웃고, 두 볼을 감싸고, 눈물이 그렁그렁하고, 화는 볼을 부풀리는 정도
  해맑음: {
    2: { f: "(smile:1.4), (:d:1.1), (open mouth:1.0), (happy:1.2), (sparkling eyes:0.6), (own hands together:0.7)", m: "(smile:1.3), (open mouth:0.8), (happy:1.1), (laughing:0.7)" },
    3: { f: "(embarrassed:1.2), (blush:1.7), (smile:0.6), (wavy mouth:0.6), (hands on own cheeks:1.0)", m: "(embarrassed:1.1), (blush:1.1), (smile:0.6), (scratching head:0.9)" },
    4: { f: "(sad:1.3), (tearing up:1.4), (teary eyes:1.3), (tears:1.0), (wavy mouth:0.8), (own hands together:0.7)", m: "(sad:1.2), (tearing up:1.2), (teary eyes:1.0), (wavy mouth:0.5), closed mouth" },
    5: { f: "(surprised:1.4), (open mouth:1.1), (raised eyebrows:0.9), (hands on own cheeks:0.8)", m: "(surprised:1.3), (open mouth:0.7), (raised eyebrows:0.9)" },
    6: { eyes: soft, f: "(angry:1.1), (pout:1.1), (puffed cheeks:1.0), (clenched hands:0.9)", m: "(angry:1.1), (pout:0.5), (frown:1.0), (clenched hands:0.8)" },
    7: { f: "(pout:1.4), (puffed cheeks:1.2), (teary eyes:0.4), (clenched hands:0.8)", m: "(pout:0.9), (puffed cheeks:0.4), (annoyed:0.8), (crossed arms:0.8)" },
    8: { eyes: fear, f: "(scared:1.4), (trembling:1.0), (teary eyes:0.9), (open mouth:0.7), (hands on own chest:0.9)", m: "(scared:1.2), (sweat:0.9), (parted lips:0.8), (raised eyebrows:0.7)" },
    14: { f: "(blush:1.7), (smile:1.0), (parted lips:0.5), (hands on own cheeks:0.9)", m: "(blush:1.0), (smile:0.9), (scratching cheek:0.7)" },
  },
  // 수줍음 — 입을 가리고 웃고, 고개를 숙이고, 두 손을 모으고, 화가 나도 눈물이 먼저
  수줍음: {
    2: { f: "(smile:1.0), (shy:0.8), (closed mouth:0.6), (blush:0.8), (hand to own mouth:0.9)", m: "(smile:0.9), (shy:0.7), (closed mouth:0.7), (blush:0.6), (hand on own neck:0.6)" },
    3: { look: "down", f: "(embarrassed:1.3), (shy:1.2), (blush:1.8), (full-face blush:0.8), (wavy mouth:0.7), (own hands together:1.0)", m: "(embarrassed:1.2), (shy:1.0), (blush:1.3), (wavy mouth:0.5), (hand on own neck:0.8)" },
    4: { f: "(sad:1.3), (tearing up:1.3), (teary eyes:1.2), (tears:0.9), closed mouth, (own hands together:0.9)", m: "(sad:1.2), (tearing up:1.1), (teary eyes:1.0), closed mouth, (clenched hands:0.6)" },
    5: { f: "(surprised:1.3), (raised eyebrows:0.8), (parted lips:0.6), (hand to own mouth:1.0)", m: "(surprised:1.2), (parted lips:0.6), (raised eyebrows:0.8), (hand up:0.5)" },
    6: { eyes: { f: "(glaring:0.4), (v-shaped eyebrows:0.8)", m: "(glaring:0.4), (v-shaped eyebrows:0.8)" }, f: "(angry:1.0), (pout:0.9), (teary eyes:0.7), (frown:0.9), (trembling:0.6), (clenched hands:1.0)", m: "(angry:1.0), (frown:1.0), (teary eyes:0.4), closed mouth, (clenched hands:0.9)" },
    7: { look: "down", f: "(pout:1.0), (sad:0.5), (frown:0.5), closed mouth, (own hands together:0.9)", m: "(pout:0.6), (frown:0.6), closed mouth, (hand on own arm:0.7)" },
    8: { eyes: fear, f: "(scared:1.4), (trembling:1.1), (teary eyes:1.0), (sweat:0.8), (parted lips:0.6), (own hands together:1.0)", m: "(scared:1.3), (trembling:0.8), (sweat:0.9), (parted lips:0.7), (hand on own chest:0.6)" },
    14: { look: "down", f: "(blush:1.8), (full-face blush:0.7), (shy:1.0), (light smile:0.7), (own hands together:1.0)", m: "(blush:1.2), (shy:0.8), (light smile:0.7), (hand on own neck:0.8)" },
  },
  // 다정 — 따뜻하게 웃고, 슬퍼도 미소를 잃지 않고, 화는 엄한 얼굴로
  다정: {
    2: { f: "(smile:1.3), (gentle smile:1.0), (open mouth:0.6), (laughing:0.6), (happy:0.9), (hand on own chest:0.7)", m: "(smile:1.2), (gentle smile:0.9), (open mouth:0.5), (happy:0.8)" },
    3: { f: "(embarrassed:1.1), (blush:1.5), (gentle smile:0.8), (hand on own cheek:1.0)", m: "(embarrassed:1.0), (blush:1.0), (gentle smile:0.7), (scratching cheek:0.8)" },
    4: { f: "(sad:1.2), (sad smile:1.1), (tearing up:1.2), (teary eyes:1.1), (tears:0.8), (hand on own chest:0.8)", m: "(sad:1.1), (sad smile:1.0), (teary eyes:0.9), closed mouth" },
    5: { f: "(surprised:1.2), (raised eyebrows:0.9), (parted lips:0.8), (hand to own mouth:0.9)", m: "(surprised:1.2), (raised eyebrows:0.9), (parted lips:0.6)" },
    6: { eyes: soft, f: "(angry:1.0), (serious:0.9), (frown:1.0), (worried:0.6), closed mouth, (hands on own hips:0.8)", m: "(angry:1.0), (serious:1.0), (frown:1.0), closed mouth, (crossed arms:0.7)" },
    7: { f: "(pout:0.9), (frown:0.5), (sad:0.4), closed mouth, (hand on own cheek:0.7)", m: "(frown:0.7), (pout:0.4), (sigh:0.5), closed mouth, (hand on own neck:0.6)" },
    8: { eyes: fear, f: "(scared:1.2), (worried:1.0), (sweat:0.8), (parted lips:0.6), (hands on own chest:0.9)", m: "(scared:1.1), (worried:0.9), (sweat:0.8), (parted lips:0.6)" },
    14: { f: "(blush:1.6), (gentle smile:1.0), (parted lips:0.4), (hand on own chest:1.0)", m: "(blush:0.9), (gentle smile:0.9), (hand on own chest:0.6)" },
  },
  // 냉소 — 한쪽 입꼬리로 웃고, 민망하면 시선을 피하고, 슬픔은 지친 얼굴로, 화는 넌더리로
  냉소: {
    2: { eyes: { f: "(half-closed eyes:0.7), (jitome:0.4)", m: "(half-closed eyes:0.8)" }, f: "(smirk:0.9), (smile:0.8), (closed mouth:0.6), (hand on own chin:0.5)", m: "(smile:0.9), (smirk:0.5), closed mouth, (raised eyebrow:0.5)" },
    3: { f: "(embarrassed:1.0), (blush:1.2), (annoyed:0.6), (frown:0.4), closed mouth, (hand on own neck:0.8)", m: "(embarrassed:1.0), (blush:0.8), (annoyed:0.5), closed mouth, (hand on own neck:0.9)" },
    4: { f: "(sad:1.1), (tired:0.8), (sad smile:0.7), (teary eyes:0.7), closed mouth, (hand on own arm:0.7)", m: "(sad:1.1), (tired:0.8), (sad smile:0.6), closed mouth" },
    5: { eyes: { f: "(wide-eyed:0.6)", m: "(wide-eyed:0.4), (pupils:1.0)" }, f: "(surprised:1.0), (raised eyebrow:1.0), (parted lips:0.6)", m: "(surprised:1.0), (raised eyebrow:1.0), closed mouth" },
    6: { f: "(angry:1.1), (scowl:1.0), (annoyed:0.9), (frown:1.0), closed mouth, (crossed arms:0.9)", m: "(angry:1.1), (scowl:1.0), (annoyed:0.9), (frown:1.0), closed mouth, (hand on own forehead:0.7)" },
    7: { f: "(annoyed:1.2), (frown:0.8), (pout:0.5), (jitome:0.6), closed mouth, (crossed arms:0.9)", m: "(annoyed:1.2), (frown:0.9), (jitome:0.5), closed mouth, (hand on own neck:0.6)" },
    8: { eyes: calmFear, f: "(scared:1.0), (nervous:0.9), (sweat:1.0), (frown:0.6), closed mouth, (hand on own arm:0.8)", m: "(scared:1.0), (nervous:0.8), (sweat:1.0), (frown:0.6), closed mouth" },
    14: { look: "away", f: "(blush:1.3), (embarrassed:0.6), (frown:0.3), closed mouth, (hand over own mouth:0.9)", m: "(blush:0.9), (embarrassed:0.5), closed mouth, (hand over own mouth:0.8)" },
  },
  // 곧음 — 시원하게 웃고, 당황하면 굳고, 눈물은 주먹을 쥐고 참고, 화는 정면으로
  곧음: {
    2: { f: "(smile:1.3), (open mouth:0.8), (laughing:0.8), (happy:1.0), (hand on own hip:0.6)", m: "(smile:1.3), (open mouth:0.8), (laughing:0.8), (happy:1.0)" },
    3: { f: "(embarrassed:1.3), (blush:1.6), (flustered:0.9), (wavy mouth:0.6), (hand on own cheek:0.7)", m: "(embarrassed:1.2), (blush:1.2), (flustered:0.9), closed mouth, (scratching head:0.9)" },
    4: { f: "(sad:1.2), (teary eyes:1.1), (tearing up:1.0), (frown:0.9), (biting own lip:0.6), (clenched hands:0.8)", m: "(sad:1.2), (teary eyes:0.8), (frown:1.0), closed mouth, (clenched hand:0.9)" },
    5: { f: "(surprised:1.3), (open mouth:0.8), (raised eyebrows:0.9), (hand on own chest:0.6)", m: "(surprised:1.3), (open mouth:0.5), (raised eyebrows:0.9)" },
    6: { f: "(angry:1.3), (serious:0.9), (frown:1.2), (clenched teeth:0.6), (clenched hand:1.0)", m: "(angry:1.4), (frown:1.2), (clenched teeth:0.8), (clenched hand:1.0)" },
    7: { f: "(pout:0.9), (frown:0.9), (annoyed:0.8), closed mouth, (crossed arms:1.0)", m: "(frown:1.0), (annoyed:1.0), closed mouth, (crossed arms:1.0)" },
    8: { eyes: fear, f: "(scared:1.2), (serious:0.6), (sweat:0.9), (clenched teeth:0.5), (clenched hands:0.9)", m: "(scared:1.1), (serious:0.7), (sweat:0.9), closed mouth, (clenched hand:0.9)" },
    14: { f: "(blush:1.6), (flustered:0.7), (light smile:0.8), closed mouth, (hand on own chest:0.9)", m: "(blush:1.0), (flustered:0.6), (light smile:0.7), closed mouth, (scratching cheek:0.8)" },
  },
  // 차가움 — 웃음은 옅게, 부끄러움은 내색 없이 시선만, 눈물은 표정 없이, 화는 얼음처럼
  차가움: {
    2: { eyes: { f: "(half-closed eyes:0.6)", m: "(half-closed eyes:0.7)" }, f: "(light smile:1.1), (closed mouth:0.9), (soft gaze:0.6), (tucking hair:0.6)", m: "(light smile:1.0), closed mouth, (soft gaze:0.6)" },
    3: { f: "(embarrassed:0.9), (blush:1.1), (expressionless:0.4), closed mouth, (tucking hair:0.9)", m: "(embarrassed:0.9), (blush:0.8), closed mouth, (hand over own mouth:0.8)" },
    4: { f: "(sad:1.1), (expressionless:0.5), (tears:0.9), (teary eyes:0.8), closed mouth, (hand on own arm:0.6)", m: "(sad:1.1), (expressionless:0.5), (tears:0.6), closed mouth" },
    5: { eyes: calmSurprise, f: "(surprised:1.0), (parted lips:0.7), (raised eyebrows:0.6)", m: "(surprised:1.0), (parted lips:0.5), (raised eyebrows:0.6)" },
    6: { eyes: { f: "(glaring:1.1), (v-shaped eyebrows:0.8)", m: "(glaring:1.1), (v-shaped eyebrows:0.8)" }, f: "(angry:1.1), (expressionless:0.5), (frown:0.9), closed mouth, (shaded face:0.6), (crossed arms:0.7)", m: "(angry:1.1), (expressionless:0.5), (frown:0.9), closed mouth, (shaded face:0.7)" },
    7: { f: "(annoyed:0.9), (expressionless:0.4), (frown:0.6), closed mouth, (crossed arms:0.8)", m: "(annoyed:0.9), (expressionless:0.4), (frown:0.6), closed mouth" },
    8: { eyes: calmFear, f: "(scared:1.0), (expressionless:0.3), (sweat:0.8), (turn pale:0.7), (parted lips:0.5), (hand on own arm:0.7)", m: "(scared:0.9), (sweat:0.8), (turn pale:0.6), closed mouth" },
    14: { look: "away", f: "(blush:1.2), (light smile:0.5), (parted lips:0.5), (hand on own chest:0.8)", m: "(blush:0.8), (light smile:0.4), closed mouth, (hand on own neck:0.6)" },
  },
};

/* ── 작품의 대표 인물 — 그 인물만의 버릇·소품(사용자 2026-11-20: '주요 인물은 따로 더') ──
   성격별 표가 기본이고, 여기 적힌 칸만 이 값이 대신한다(한 인물은 성별이 정해져 있어 emo 한 줄). 키는 "인물코드:이름"(인물 코드는 작품끼리 겹칠 수 있음).
   소품은 무기가 아닌 것만(무기 낱말은 공격 칸 말고는 빠짐) — 찻잔·책·회중시계·안경. 칸 1(기본)은 넣지 않는다(기본 표정은 한 가지로 정해 둠) */
export const LEAD_EMO = {
  // 윤해라 — 귀 뒤로 머리를 넘기는 버릇, 당황하면 말이 빨라짐
  "YHR:윤해라": {
    2: { emo: "(smile:1.1), (smug:0.7), (closed mouth:0.7), (tucking hair:0.8)" },
    3: { emo: "(embarrassed:1.3), (blush:1.6), (flustered:1.0), (wavy mouth:0.6), (parted lips:0.5), (hand up:0.6)" },
    14: { look: "away", emo: "(blush:1.5), (light smile:0.7), (parted lips:0.4), (tucking hair:0.9)" },
  },
  // 아델 — 손에서 놓지 않는 책, 쓸쓸함
  "ADL:아델": {
    2: { emo: "(smile:1.0), (light smile:0.6), closed mouth, (holding book:0.8)" },
    4: { look: "away", emo: "(sad:1.2), (melancholic:1.0), (teary eyes:0.6), closed mouth, (holding book:0.6)" },
    14: { look: "away", emo: "(blush:0.9), (light smile:0.6), closed mouth, (holding book:0.8)" },
  },
  // 서도윤 — 능글맞은 웃음, 화가 나면 장난기가 걷히고 날카로워짐
  "SDY:서도윤": {
    2: { emo: "(grin:1.0), (smirk:0.4), (one eye closed:0.5), (hand on own chin:0.6)" },
    6: { emo: "(serious:1.1), (angry:0.9), (frown:1.0), closed mouth, (hand in pocket:0.8)" },
    14: { look: "away", emo: "(blush:0.8), (nervous smile:0.7), (scratching head:0.9)" },
  },
  // 백연 — 웃으면 가늘어지는 눈, 손에 든 찻잔, 좀처럼 놀라지 않음
  "BY:백연": {
    2: { eyes: "(narrow eyes:1.0), (half-closed eyes:0.8)", emo: "(smile:1.2), (smug:0.6), closed mouth, (holding cup:0.8), (teacup:0.7)" },
    5: { eyes: "(wide-eyed:0.4), (pupils:1.0)", emo: "(surprised:0.9), (raised eyebrow:0.9), (light smile:0.5), closed mouth" },
    7: { emo: "(pout:0.8), (annoyed:0.6), closed mouth, (holding cup:0.7), (teacup:0.6)" },
  },
  // 한겨울 — 큰 안경을 고쳐 쓰는 버릇, 소매가 긴 카디건, 꿈 얘기엔 웃어넘김
  "HGU:한겨울": {
    2: { emo: "(smile:1.4), (:d:1.0), (open mouth:1.0), (happy:1.2), (adjusting eyewear:0.7)" },
    3: { emo: "(embarrassed:1.2), (blush:1.7), (smile:0.6), (wavy mouth:0.6), (sleeves past wrists:0.7), (hands on own cheeks:0.9)" },
    4: { look: "away", emo: "(sad:1.1), (sad smile:1.1), (teary eyes:1.0), (hand on own arm:0.7)" },
    5: { emo: "(surprised:1.4), (open mouth:1.0), (raised eyebrows:0.9), (adjusting eyewear:0.9)" },
  },
  // 이화 — 소매 속에 모은 두 손, 표정 없이 흘리는 눈물
  "IHW:이화": {
    2: { emo: "(light smile:1.0), (closed mouth:0.9), (soft gaze:0.6), (hands in opposite sleeves:0.7)" },
    4: { emo: "(sad:1.2), (expressionless:0.4), (tears:1.0), (teary eyes:0.9), closed mouth, (own hands together:0.8)" },
    6: { emo: "(angry:1.1), (expressionless:0.5), (frown:0.8), closed mouth, (shaded face:0.6), (hands in opposite sleeves:0.8)" },
  },
  // 차사현 — 회중시계를 확인하는 버릇, 넥타이를 고쳐 맴
  "CSH:차사현": {
    5: { eyes: "(wide-eyed:0.4), (pupils:1.0)", emo: "(surprised:0.9), (raised eyebrow:0.8), closed mouth, (holding pocket watch:0.7)" },
    6: { emo: "(angry:1.0), (expressionless:0.6), (frown:0.8), closed mouth, (shaded face:0.6), (adjusting necktie:0.7)" },
    7: { look: "down", emo: "(annoyed:0.9), (expressionless:0.4), (frown:0.6), closed mouth, (holding pocket watch:0.9), (pocket watch:0.8)" },
    14: { look: "away", emo: "(blush:0.7), (light smile:0.3), closed mouth, (adjusting necktie:0.8)" },
  },
  // 카엘 — 가슴에 손을 얹는 기사의 예, 상처를 숨기는 버릇, 낯선 것에 감탄
  "KAEL:카엘": {
    2: { emo: "(smile:1.0), (nervous smile:0.4), closed mouth, (hand on own chest:0.6)" },
    4: { look: "away", emo: "(sad:1.1), (teary eyes:0.5), (frown:0.9), closed mouth, (holding own arm:0.8)" },
    5: { emo: "(surprised:1.3), (parted lips:0.7), (raised eyebrows:1.0), (hand on own chest:0.5)" },
    14: { emo: "(blush:1.1), (flustered:0.8), closed mouth, (hand on own chest:0.9)" },
  },
  // 한서윤 — 허리에 손, 칭찬에 약해 포니테일 끝을 만짐
  "HSY:한서윤": {
    2: { emo: "(smile:1.1), (smug:0.9), (closed mouth:0.7), (hand on own hip:0.8)" },
    3: { emo: "(embarrassed:1.3), (blush:1.7), (pout:0.7), (wavy mouth:0.5), (playing with own hair:0.9)" },
    6: { emo: "(angry:1.2), (scowl:1.0), (frown:1.0), closed mouth, (hand on own hip:0.9)" },
  },
  // 강태하 — 무뚝뚝한 사람의 옅은 웃음, 목덜미를 문지름
  "KTH:강태하": {
    2: { emo: "(light smile:1.0), (smile:0.7), closed mouth, (crossed arms:0.7)" },
    3: { emo: "(embarrassed:1.1), (blush:1.0), (frown:0.4), closed mouth, (hand on own neck:0.9)" },
    14: { look: "away", emo: "(blush:0.9), (light smile:0.5), closed mouth, (hand on own neck:0.8)" },
  },
  // 남궁설 — 팔짱을 끼고 내려다보는 오만함
  "NGS:남궁설": {
    2: { emo: "(smile:1.0), (smug:1.0), (smirk:0.5), (closed mouth:0.7), (crossed arms:0.8)" },
    6: { emo: "(angry:1.3), (scowl:1.1), (frown:1.0), closed mouth, (looking down at viewer:0.6), (crossed arms:0.9)" },
  },
  // 카시안 — 턱을 괴고 짓는 옅은 웃음, 내려다보는 분노
  "KAS:카시안": {
    2: { emo: "(light smile:0.8), (smirk:0.4), closed mouth, (hand on own chin:0.6)" },
    6: { emo: "(angry:1.2), (expressionless:0.6), (frown:0.9), closed mouth, (shaded face:0.8), (looking down at viewer:0.7), (crossed arms:0.8)" },
    14: { look: "away", emo: "(blush:0.6), closed mouth, (hand over own mouth:0.8)" },
  },
  // 홍 여사 — 손으로 입가를 가리고 웃는 나른함
  "HME:홍 여사": {
    2: { eyes: "(half-closed eyes:0.8)", emo: "(smile:1.1), (smug:0.7), closed mouth, (hand to own mouth:0.8)" },
    5: { eyes: "(wide-eyed:0.6)", emo: "(surprised:0.9), (raised eyebrows:0.7), (light smile:0.5), (hand to own mouth:0.8)" },
    14: { emo: "(blush:1.0), (smile:0.8), closed mouth, (hand on own cheek:0.9)" },
  },
  // 서하진 — 좀처럼 웃지 않는 기관사, 주먹을 쥐고 참는 슬픔
  "SHJ:서하진": {
    2: { emo: "(light smile:0.9), closed mouth, (soft gaze:0.5), (hand on own neck:0.6)" },
    4: { emo: "(sad:1.1), (expressionless:0.5), (teary eyes:0.6), closed mouth, (clenched hand:0.8)" },
  },
};
