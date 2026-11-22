/* 단체 표지(세 사람)의 계획 — 2026-11-19~20 사용자와 여러 판을 거쳐 정함(경위는 ../README.md '단체 표지').
   한 장 안에서 세 사람을 그리거나 자리마다 그려 넣으면 옷·머리가 섞이고 형태가 무너진다 → **배경 따로, 인물 한 명씩 따로** 그려 배경을 지우고(오리기) 얹은 뒤 전체를 아주 약하게 다시 그려 잇는다.
   구도: 가운데 한 명은 정면, 양옆 두 명은 살짝 뒤(머리가 가운데의 88%, 조금 어둡게)에서 옆을 봄 — 좌우를 뒤집어 가운데 쪽을 보게 맞춘다. 모두 서 있고 허리 위.
   배경은 위로 올려 그 작품의 특징(문·폭포·계단)이 머리 위로 보이게 한다. 내려다보는 구도·앉은 자세·뒤로 멀어지는 원근 배치는 모두 물렸다(사용자 — '뒤로 갈수록 이상', '웬만하면 서 있는 포즈').
   groupPlan(작품 id, 작품) → { parts: 그릴 작업 넷(bg·left·mid·right), layout: 합성 값(./compose.js가 읽음), final: 잇는 작업, post }. Node에서만 돈다 */
import { isFem, MODEL } from "../../style-manime/code/assemble.js";
import { COVERS, Q, NQ, castOf, styled, sceneJob, sceneLight, assertCover } from "./cover.js";
import { COVER_POST } from "./cover-post.js";

// 가운데: 똑바로 정면 / 양옆: 몸을 튼 반측면에 시선은 옆으로(둘 다 허리 위·서 있는 자세)
const FRAME_MID = "(fully clothed:1.2), (cowboy shot:1.0), (upper body:0.7), standing, (straight-on:1.2), (facing viewer:1.2), (from above:0.2), looking at viewer";
const FRAME_SIDE = "(fully clothed:1.2), (cowboy shot:1.0), (upper body:0.7), standing, (three quarter view:1.2), (body turned to the side:1.0), (looking to the side:1.3), (looking away:1.0), (from above:0.3)";
// 오려 붙일 인물의 네거티브: 한 사람만, 얼굴 얼룩(어두운 문구의 부작용), 눕거나 앉은 자세, 배경
const NEG_CUT =
  ", (multiple people:1.3), (2girls:1.3), (2boys:1.3), (facial tattoo:1.3), (ink splatter:1.3), (blood on face:1.3), (lying:1.4), (on ground:1.3), (crouching:1.3), (sitting:1.2), (leaning on object:1.2)" +
  ", (detailed background:1.3), (scenery:1.2), (from below:1.3)";
const NEG_SIDE = ", (looking at viewer:1.4), (eye contact:1.3)";

/* 자리: 머리 크기와 정수리 높이로 맞춘다(화면 높이에 대한 비율) — 그림마다 머리 비율(21~30%)이 달라 그림 크기로 맞추면 머리 크기가 제각각이 된다.
   가운데 머리 = 화면의 21.5%, 양옆 = 19%(살짝 뒤). cx는 얼굴이 놓일 가로 자리 */
export const SEAT = { mid: { head: 0.215, crown: 0.215, cx: 0.5 }, left: { head: 0.19, crown: 0.2, cx: 0.19 }, right: { head: 0.19, crown: 0.2, cx: 0.81 } };
// 한 명 표지와 어울리게: 양옆은 조금 어둡게, 배경은 덜 밝게, 장면 색(grade)을 진하게, 가장자리를 어둡게(vig), 아래는 그늘(floor), 얼굴에만 빛(face), 인물 뒤 그림자(halo)
const LOOK = {
  dark: { side: "brightness(0.86) saturate(0.96) contrast(1.06)", mid: "brightness(1.0) contrast(1.08)", bgFilter: "brightness(0.9) contrast(1.08) blur(1px)", floor: 0.4, face: 0.3, halo: 0.55, gradeA: 0.2, vig: 0.42 },
  warm: { side: "brightness(0.93)", mid: "contrast(1.03)", bgFilter: "brightness(1.0) blur(1px)", floor: 0.15, face: 0.12, halo: 0.4, gradeA: 0.1, vig: 0.18 }
};
/** 전체를 잇는 세기 — 0.1까지만. 0.2를 넘으면 눈색·머리색이 바뀌고 배경의 바위가 사람 그림자가 되며, 가려진 고양이가 사람 얼굴이 된다 */
export const UNIFY = 0.1;

/* 작품마다: bg 배경(장면 낱말 tags · 시드 · 보는 자리 zoom/at/shift — shift의 세로 값이 음수면 배경이 위로 올라가고 아래 빈 곳은 바닥 무늬로 채움) · tint 인물에 입히는 장면 색(곱하기) · grade 전체 색
   · left/mid/right 인물(code · pose 소품과 자세 · neg · swap [찾을 태그, 바꿀 태그] 표지에서만 인물 태그를 바꿈 · tint 그 인물만의 색 · flip 좌우 뒤집기 · head [정수리 위치, 머리 높이, 얼굴 가로 위치] · cx 자리 덮어쓰기).
   **head와 flip은 확정 그림에서 잰 값**이다 — 인물을 다시 그리면 그림이 달라지므로 그림 관리 페이지에서 다시 잰다(compose.js measure가 어림값을 주고 손으로 고침) */
export const GROUPS = {
  godseats: {
    bg: { tags: "ruined seoul downtown street, tall collapsed office buildings on both sides, leaning skyscrapers, broken windows, korean palace gate in the distance, cracked asphalt road, rubble, night, purple sky", seed: 9911, zoom: 1.1, at: [0.5, 0.35], shift: [0, -0.2] },
    tint: "#d9cfee", grade: "#8a5cd0",
    // 세레나: 해적 모자에 해골 무늬가 자꾸 그려짐 → 무늬 없는 모자로 적고 해골을 막음(그래도 가끔 나옴 — 눈으로 확인)
    left: { code: "SRN", pose: "(holding flintlock pistol:1.0), (hand on own hip:0.8), (plain black tricorn hat:1.2), (hat feather:0.8), (silver hair:1.3)", neg: ", (skull:1.6), (skull print:1.5), (jolly roger:1.5), (skull and crossbones:1.5), (pirate:1.3), (pink hair:1.4)", tint: "#e6e0f4", head: [0.1, 0.2, 0.52] },
    // 한서윤: 허리에 손을 얹으면 몸이 돌아감 → 팔을 내린 정면. 펜싱복이 몸에 붙지 않게
    mid: { code: "HSY", pose: "(holding rapier:1.1), (rapier:1.0), (arms at sides:1.0), (shoulders squared:0.8), (loose white fencing jacket:1.1), (loose white pants:1.2)", neg: ", (tight clothes:1.4), (skin tight:1.4), (bodysuit:1.3), (large breasts:1.3), (dual wielding:1.5), (two swords:1.5), (tight pants:1.4), (wide hips:1.3), (head tilt:1.2)", head: [0.08, 0.21] },
    right: { code: "BYU", pose: "(holding paper talisman:1.0), (hand up:0.7)", flip: 1, head: [0.07, 0.21, 0.5] }
  },
  hasuk: {
    bg: { tags: "hanok wooden floor hall, low dining table with rice bowls and side dishes, floor cushions, sliding paper doors, wooden pillars, courtyard outside, morning light, warm", seed: 9821, zoom: 1.05, at: [0.5, 0.5], shift: [0, -0.12] },
    grade: "#e8b060",
    left: { code: "YSH", pose: "(hand in pocket:1.0), (brown hair:1.3), (wavy hair:1.1)", neg: ", (black hair:1.3)", head: [0.04, 0.23, 0.49] },
    mid: { code: "KTH", pose: "(holding bowl:1.1), (steam:0.8)", neg: ", (head tilt:1.3), (looking down:1.2)", head: [0.05, 0.24] },
    right: { code: "BDH", pose: "(holding cat:1.1), (cat:1.0), (round eyewear:1.2), (glasses:1.2)", flip: 1, head: [0.07, 0.2, 0.49], cx: 0.85 } // 고양이가 가운데 인물 어깨에 가려서 오른쪽으로
  },
  sipjeol: {
    bg: { tags: "mountain stream valley, stone path, wet stepping stones, mossy rocks, tall waterfall in the distance, mist, wuxia, dawn, pine trees", seed: 9831, zoom: 1.05, at: [0.5, 0.3], shift: [0, -0.13] },
    tint: "#bccbe2", grade: "#4f79b8",
    left: { code: "DSS", pose: "(holding dagger:1.0), (hand on own hip:0.8), (short hair:1.1)", neg: ", (long hair:1.2)", flip: 1, head: [0.03, 0.28, 0.48] },
    mid: { code: "NGS", pose: "(hand on hilt:1.1), (sheathed sword:1.1), (jian:0.9), (black hair:1.3)", neg: ", (grin:1.3), (open mouth:1.3), (brown hair:1.4), (orange hair:1.3), (head tilt:1.2)", head: [0.08, 0.26] },
    right: { code: "HWN", pose: "(holding wooden medicine box:1.0)", head: [0.06, 0.26, 0.54] }
  },
  hwanghu: {
    bg: { tags: "imperial palace hall at night, grand staircase, red carpet, checkered marble floor, candelabra, tall windows, red curtains, chandelier, gold and ivory", seed: 9841, zoom: 1.05, at: [0.52, 0.2], shift: [0, -0.07] },
    tint: "#ecd3ad", grade: "#c8923a",
    left: { code: "NOL", pose: "(holding book:1.1), (silver hair:1.3)", neg: ", (blonde hair:1.4)", tint: "#dccff2", head: [0.1, 0.2, 0.58] },
    mid: { code: "KAS", pose: "(arms crossed:0.9), (gold trim:1.0)", neg: ", (head tilt:1.3), (looking down:1.2)", tint: "#f2d9a8", head: [0.03, 0.24] },
    right: { code: "LUK", pose: "(hand on hilt:1.1), (sheathed sword:1.0), (silver armor:1.2), (blue cape:0.9)", tint: "#cbd9ef", head: [0.06, 0.22, 0.53] }
  },
  /* F급 던전(2026-11-23 설계 · 같은 날 첫 그림 — head·flip·cx는 그 그림(보관함의 조각)에서 눈으로 잰 값. 자동 어림은 가온의 정수리를 뿔에 걸어 머리를 크게 잡았다 → 머리카락 정수리로 고침).
     세라는 첫 그림의 앞치마에 글자가 그려져 문구를 고쳤다(민무늬 앞치마·글자 막기) — 다시 그리면 세라의 head는 다시 잰다.
     직원 셋: 가운데 보스 가온, 왼쪽 무대 기술자 세라, 오른쪽 안내원 비오. 배경은 보스방(붉은 현수막·가짜 기둥·작업등). 글자가 그려지는 간판·포스터 낱말은 넣지 않는다.
     종족 낱말은 표지에서만 바꾼다(swap): minotaur girl은 소 무늬 비키니·방울 목걸이를, slime girl은 비치는 몸을 부른다 → 뿔·귀·머리카락 낱말로만 종족을 보인다 */
  fdungeon: {
    bg: { tags: "underground circular stone arena, labyrinth boss room, crumbling stone pillars, red banners hanging from the walls, stone archway gate, string lights, warm work lights, stage spotlights, light haze, stone floor, theme park attraction, indoors, cozy", seed: 9851, zoom: 1.05, at: [0.5, 0.3], shift: [0, -0.12] },
    grade: "#e8a45c",
    left: { code: "SER", swap: [["slime girl", "liquid hair"]], pose: "(holding wrench:1.0), (hand on own hip:0.8), (goggles on head:1.1), (light blue hair:1.2), (plain apron:1.2)",
      neg: ", (slime girl:1.3), (transparent body:1.4), (blue skin:1.3), (tears:1.3), (crying:1.3), (paint on face:1.3), (writing:1.4), (letters:1.3)", head: [0.084, 0.257, 0.513], cx: 0.165 },
    mid: { code: "GAO", swap: [["minotaur girl", "bull horns"]], pose: "(hand behind head:0.9), (embarrassed smile:0.7), (large curved horns:1.2), (cow ears:1.0), (red cape:1.1), (yellow safety vest:1.1)",
      neg: ", (cow print:1.4), (bikini:1.4), (cowbell:1.3), (neck bell:1.3), (midriff:1.3), (crop top:1.3), (navel:1.3), (animal head:1.4), (furry:1.3), (head tilt:1.2)", head: [0.14, 0.27] },
    // 비오: 발밑의 연기는 허리 위 구도에 안 보이고 몸 둘레에 번져 오리기를 어렵게 함 → 표지에서는 뺌
    right: { code: "BIO", swap: [["dark smoke around feet", ""]], pose: "(holding clipboard:1.0), (arm at side:0.8), (black necktie:1.0)", neg: ", (smoke:1.2), (long hair:1.2)", flip: 1, head: [0.09, 0.24, 0.513], cx: 0.845 }
  }
};
const ROLES = ["left", "right", "mid"]; // 얹는 순서 — 가운데가 양옆 어깨를 덮는다

/** 단체 표지의 계획. 인물 그림 셋은 후처리 없이 오려 얹고, 합친 그림에만 표지 후처리를 입힌다 */
export function groupPlan(workId, work) {
  const v = COVERS[workId],
    G = GROUPS[workId];
  if (!v || v.type !== "group" || !G) throw new Error("단체 표지 설계가 없어요: " + workId);
  const mood = v.mood || "dark",
    L = LOOK[mood],
    cast = {};
  const parts = { bg: assertCover(sceneJob(G.bg.tags, v.color, mood, G.bg.seed)) };
  for (const role of ROLES) {
    const m = G[role],
      c = (cast[role] = castOf({ ...work, id: workId }, m.code, m.swap)),
      side = role !== "mid";
    const j = styled(c, { pose: m.pose, neg: NEG_CUT + (side ? NEG_SIDE : "") + (m.neg || "") }, { frame: side ? FRAME_SIDE : FRAME_MID, mood, color: v.color, place: (work.places || [])[0], solo: true, away: side });
    parts[role] = assertCover(j);
  }
  const nf = ROLES.filter((r) => isFem(cast[r])).length,
    nm = 3 - nf,
    who = [nf ? `${nf}girl${nf > 1 ? "s" : ""}` : "", nm ? `${nm}boy${nm > 1 ? "s" : ""}` : "", nf ? "(adult women:1.2)" : "", nm ? "(adult men:1.3)" : ""].filter(Boolean).join(", ");
  const fin = "(shiny hair:1.1), (hair strands:1.4), (detailed hair:1.3), (detailed face:1.3), (detailed skin:0.9), (semi-realistic:1.15), (manhwa:1.0), (digital painting:1.2), (painterly:1.1), (realistic shading:1.0)";
  const final = {
    model: MODEL.air, cfg: MODEL.cfg, steps: MODEL.steps, scheduler: MODEL.scheduler, seed: G.bg.seed, width: 1344, height: 1792, strength: UNIFY,
    pos: [who, "(fully clothed:1.2), standing", fin, sceneLight(v.color, mood), Q].join(", "),
    neg: NQ + ", bad anatomy, bad hands, child, loli, shota, underage, toddler, aged down, baby face, nsfw, nude, (cleavage:1.5), chibi, revealing clothes, (open shirt:1.4), (bare chest:1.5)"
  };
  const layout = {
    view: { zoom: G.bg.zoom, at: G.bg.at, shift: G.bg.shift }, bgFilter: L.bgFilter, tint: G.tint || null, floor: L.floor, face: L.face, halo: L.halo, grade: { color: G.grade, a: L.gradeA }, vig: L.vig, seat: SEAT,
    chars: ROLES.map((role) => ({ role, code: G[role].code, filter: role === "mid" ? L.mid : L.side, tint: G[role].tint || null, flip: G[role].flip ? 1 : 0, head: G[role].head, ...(G[role].cx ? { cx: G[role].cx } : {}) }))
  };
  return { type: "group", mood, lead: G.mid.code, parts, layout, final, post: COVER_POST[mood === "warm" ? "warm" : "group"] };
}
