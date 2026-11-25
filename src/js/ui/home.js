/* 홈: 추천작 → 둘러보기(관심있는 대화·에피소드와 자유형·장르 고르기) → 구역(찜한 작품·기획 줄·장르별 줄), 관심있는 대화 고르기.
   최근 대화와 최근 본 작품은 홈에 두지 않고 왼쪽 메뉴에 작게(ui/shell.js) — 2026-11-21 사용자 결정 */
import { HOME_ROWS, ORIGINALS } from "../content/index.js";
import { AUDS, audOK, audOf, audience } from "../core/audience.js";
import { CATS } from "../core/constants.js";
import { saveSettings } from "../core/settings.js";
import { likedIds } from "../core/shelf.js";
import { S, hasClaudeKey } from "../core/state.js";
import { $, $$, esc, toast } from "../core/util.js";
import { IMG } from "../services/images.js";
import { coverHTML } from "./cover.js";
import { ICON } from "./icons.js";
import { closeOverlays, sheet } from "./sheet.js";
import { bindGo, go, topbar } from "./shell.js";

export function cardHTML(c) {
  const body = (c.cast || []).filter((x) => !x.of).length; // 다른 모습(폼)은 한 사람으로 — 예전엔 폼까지 세어 인원이 부풀었음
  const bits = [c.episode ? "에피소드" : "", c.world_mode && body > 1 ? `👥 ${body}인 · 🎬 ${(c.openings || []).length}` : ""].filter(Boolean);
  const info = bits.length ? `<span class="cast-n">${bits.join(" · ")}</span>` : "";
  const aud = audience() === "all" && audOf(c) !== "all" ? `<span class="aud-tag">${AUDS[audOf(c)].name}</span>` : "";
  return `<button class="card" data-char="${esc(c.id)}"><div style="position:relative">${coverHTML(c, "", { vt: true, cat: true })}${info}</div>
    <span class="t">${esc(c.name)}</span><span class="d">${esc(c.oneLiner)}</span>
    <span class="meta">${c.hold ? `<span class="hold-tag">출시판 제외</span>` : ""}${aud}${(c.tags || [])
      .slice(0, 3)
      .map((t) => `<span>#${esc(t)}</span>`)
      .join("")}</span></button>`;
}
/* 관심있는 대화 고르기: 처음 시작할 때(first) 한 번, 홈·설정에서 바꿀 수 있음 */
export function audSegHTML() {
  return `<div class="seg aud-seg">${Object.keys(AUDS)
    .map((k) => `<button type="button" data-aud="${k}" class="${audience() === k ? "on" : ""}">${AUDS[k].name}<small>${AUDS[k].desc}</small></button>`)
    .join("")}</div>`;
}
export function setAudience(k) {
  S.settings.audience = AUDS[k] ? k : "all";
  saveSettings();
}
export function audSheet(first) {
  const ov = sheet(
    `<h2>관심있는 대화</h2><p class="sub">${first ? "어떤 대화를 보고 싶으세요? " : ""}고른 쪽 작품만 홈에 보여요. MY → 설정에서 언제든 바꿀 수 있어요.</p>${audSegHTML()}`
  );
  $$("[data-aud]", ov).forEach(
    (b) =>
      (b.onclick = () => {
        setAudience(b.dataset.aud);
        closeOverlays();
        if ((location.hash.slice(1) || "home") === "home") viewHome();
        toast(`${AUDS[audience()].name} 작품을 보여 드릴게요`);
      })
  );
  if (first) setAudience(audience()); // 닫기만 해도 다시 묻지 않게 '전체'로 정해 둠
}
// 처음 시작할 때 묻기. 작품·대화방·공지 주소로 바로 들어왔으면 그 화면을 가리지 않고 홈에 처음 갈 때 묻는다(시트는 홈에 보일 작품을 고르는 것)
let audLater = false;
export function askAud() {
  if (AUDS[S.settings.audience]) return;
  if (/^#(?:[cr]-|notice$)/.test(location.hash)) audLater = true;
  else audSheet(true);
}
/** 작품 카드를 가로로 넘기는 줄(작품이 없으면 빈 글) — 홈의 줄들과 상세 페이지의 '같은 줄의 다른 작품'이 같이 씀. sub는 작은 설명(없어도 됨), id는 시험·꾸밈용 */
export function rowHTML(title, sub, list, id) {
  return list.length
    ? `<h2 class="sec"${id ? ` id="${id}"` : ""}>${esc(title)}${sub ? ` <small>${esc(sub)}</small>` : ""}</h2>` +
        `<div class="row-scroll">${list.map(cardHTML).join("")}</div>`
    : "";
}
/* 둘러보기의 형식 고르기(S.kind — 저장하지 않음, 앱을 새로 열면 전체): 에피소드형(작품에 episode가 있음)과 자유형을 나눠 보거나 같이 */
const HOME_KINDS = {
  all: { name: "전체", desc: "두 가지 모두" },
  ep: { name: "에피소드", desc: "끝이 있는 이야기" },
  free: { name: "자유형 채팅", desc: "끝이 없는 대화" }
};
const kindOK = (c) => (S.kind === "ep" ? !!c.episode : S.kind === "free" ? !c.episode : true);
export function viewHome() {
  const v = $("#view");
  const match = (c) =>
    (S.cat === "전체" || c.cat === S.cat) && (!S.q || [c.name, c.title, c.oneLiner, ...(c.tags || [])].join(" ").toLowerCase().includes(S.q.toLowerCase()));
  const pool = ORIGINALS.filter(audOK), // 관심있는 대화로 거른 것 — 추천작은 여기서
    shown = pool.filter(kindOK), // 둘러보기 아래 구역은 형식으로 한 번 더 거름
    found = shown.filter(match);
  const hidden = audience() !== "all" && ORIGINALS.length > pool.length;
  // 고른 장르·검색어가 없으면 구역별 가로 줄(찜한 작품 → 기획 줄 → 장르별, 빈 구역은 빠짐), 있으면 격자 하나. 찜한 작품도 같은 조건으로 거름(없어진 작품은 빠짐)
  const zones =
    !S.q && S.cat === "전체"
      ? rowHTML(
          "찜한 작품",
          "",
          likedIds()
            .map((id) => shown.find((c) => c.id === id))
            .filter(Boolean),
          "rowLikes"
        ) +
        HOME_ROWS.map((w) =>
          rowHTML(
            w.title,
            w.sub,
            shown.filter((c) => c.row === w.key)
          )
        ).join("") +
        CATS.map((k, i) =>
          rowHTML(
            k,
            "",
            shown.filter((c) => c.cat === k),
            "rowCat" + i
          )
        ).join("")
      : found.length
        ? `<h2 class="sec">${S.q ? "검색 결과" : esc(S.cat)} <small>${found.length}개</small></h2><div class="grid">${found.map(cardHTML).join("")}</div>`
        : "";
  const empty =
    `<div class="empty">조건에 맞는 작품이 없어요.` +
    (S.kind !== "all" ? `<br><button class="btn sm" data-kind="all">에피소드·자유형 모두 보기</button>` : "") +
    (hidden ? `<br>지금은 ${AUDS[audience()].name} 작품만 보여요.<br><button class="btn sm" data-aud="all">전체 보기</button>` : "") +
    `</div>`;
  // 추천작: 전체면 여성향·남성향을 번갈아, 아니면 고른 쪽 앞에서 4개
  const hero =
    audience() !== "all"
      ? pool.slice(0, 4)
      : (() => {
          const f = pool.filter((c) => audOf(c) === "f"),
            m = pool.filter((c) => audOf(c) !== "f"),
            out = [];
          for (let i = 0; out.length < 4 && (i < f.length || i < m.length); i++) {
            if (f[i]) out.push(f[i]);
            if (m[i] && out.length < 4) out.push(m[i]);
          }
          return out;
        })();
  v.innerHTML = `<div class="page">
    ${topbar(`<label class="search">${ICON.search}<span class="sr">캐릭터 검색</span><input id="q" placeholder="캐릭터, 작품, 태그 검색" value="${esc(S.q)}"></label>`)}
    ${!hasClaudeKey() ? `<div class="engine-warn">AI 연결이 아직 없어요. <b>MY → 설정</b>에서 Anthropic API 키를 넣어 주세요.</div>` : ""}
    ${
      !S.q && hero.length
        ? `<h2 class="sec">추천작</h2><div class="hero">${hero
            .map(
              (c) => `
      <button class="hero-card" data-char="${esc(c.id)}">${coverHTML(c, "", { vt: true })}
        <div class="body"><span class="k">${c.isNew ? "NEW · " : ""}${esc(c.cat)} · HEART SYNC 오리지널</span><h3>${esc(c.title)}</h3><p>${esc(c.desc)}</p>
        <span class="who">${c.world_mode ? "세계관 입장하기" : esc(c.name) + "와 대화하기"} →</span></div></button>`
            )
            .join("")}</div>`
        : ""
    }
    <h2 class="sec">둘러보기 <small>관심있는 대화 · 이야기 형식 · 장르</small></h2>
    ${audSegHTML()}
    <div class="seg kind-seg">${Object.keys(HOME_KINDS)
      .map(
        (k) =>
          `<button type="button" data-kind="${k}" class="${S.kind === k ? "on" : ""}" aria-pressed="${S.kind === k}">` +
          `${HOME_KINDS[k].name}<small>${HOME_KINDS[k].desc}</small></button>`
      )
      .join("")}</div>
    <div class="chips" style="margin-top:10px">${["전체", ...CATS]
      .map((c) => `<button class="chip ${S.cat === c ? "on" : ""}" ` + `data-cat="${c}">${c}</button>`)
      .join("")}</div>
    ${zones || empty}
  </div>`;
  $$("[data-char]", v).forEach((b) => (b.onclick = () => go("c-" + b.dataset.char)));
  $$("[data-cat]", v).forEach(
    (b) =>
      (b.onclick = () => {
        S.cat = b.dataset.cat;
        viewHome();
      })
  );
  $$("[data-kind]", v).forEach(
    (b) =>
      (b.onclick = () => {
        S.kind = HOME_KINDS[b.dataset.kind] ? b.dataset.kind : "all";
        viewHome();
      })
  );
  $$("[data-aud]", v).forEach(
    (b) =>
      (b.onclick = () => {
        setAudience(b.dataset.aud);
        viewHome();
      })
  );
  const q = $("#q");
  q.oninput = () => {
    S.q = q.value;
    const pos = q.selectionStart;
    viewHome();
    const n = $("#q");
    n.focus();
    n.setSelectionRange(pos, pos);
  };
  bindGo(v);
  IMG.hydrate(v);
  if (audLater) {
    audLater = false;
    askAud();
  }
}
