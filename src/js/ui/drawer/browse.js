/* 대화방 드로어에서 보는 화면: 상태창·갤러리·장소·북마크·세계관 수첩. 틀은 ../room-drawer.js — 그림 모으기는 ../room-tools.js, 세계관 카드는 ../worldart.js */
import { speakerName } from "../../ai/prompt/rules.js";
import { liveWork } from "../../core/character.js";
import { curText } from "../../core/rooms.js";
import { seenSet } from "../../core/shelf.js";
import { $, $$, esc } from "../../core/util.js";
import { IMG_TAG_RE, codebook, seriesCode } from "../../images/codes.js";
import { pickImg } from "../../images/pick.js";
import { IMG } from "../../services/images.js";
import { statusBlock } from "../chat/render.js";
import { lastAi } from "../chat/view.js";
import { artHTML, lightbox } from "../cover.js";
import { galleryItems, jumpTo } from "../room-tools.js";
import { loreCard, loreSeen } from "../worldart.js";

/** 드로어 화면 'status'. @param {import("../room-drawer.js").DrawerCtx} x */
export function drawerStatus({ r, c, body }) {
    const a = lastAi(r);
    body.innerHTML = (statusBlock(c, r.status, a?.statusBefore, { open: true }) || `<p class="note">아직 상태창이 없어요.</p>`) +
      `<div class="box" style="margin-top:12px"><h3>나 · ${esc(r.persona.name)}</h3><p>${esc(r.persona.desc || r.persona.memo || "설명 없음")}</p></div>
       <p class="note" style="margin-top:12px">진행 ${r.turn || 0}턴 · 메시지 ${r.msgs.length}개 · AI가 최근 ${r.set.mem}턴을 직접 읽어요.</p>`;
}
/** 드로어 화면 'gallery'. @param {import("../room-drawer.js").DrawerCtx} x */
export function drawerGallery({ r, c, ov, body }) {
    const items = galleryItems(r);
    body.innerHTML = items.length ? `<p class="note" style="margin-bottom:10px">이 대화에 나온 장면 이미지 ${items.length}장. 누르면 크게 보거나 그 장면으로 가요.</p><div class="gallery">${items.map((it, k) =>
      `<button data-g="${k}" title="${esc(it.name)} · ${esc(it.label)}">${it.ref ? IMG.tag(it.ref) : artHTML(c, { name: it.name }, it.sit, it.kind === "cast" ? "" : it.label)}</button>`).join("")}</div>`
      : `<div class="empty">아직 장면 이미지가 없어요. 대화 중에 인물이 등장하거나 감정이 크게 바뀌면 이미지가 나와요.</div>`;
    IMG.hydrate(body);
    $$("[data-g]", body).forEach((b) => b.onclick = () => { const it = items[+b.dataset.g], im = $("img", b); if (im && im.src) lightbox(im.src); else { ov.remove(); jumpTo(it.id); } });
}
/** 드로어 화면 'places'. @param {import("../room-drawer.js").DrawerCtx} x */
export function drawerPlaces({ c, body }) {
    // 작품의 장소(places → 예약 시리즈 코드 MP1…, 코드 글자는 codes.js SERIES에서) — !지도 명령어로도 열림. 그림은 작품 폴더 images/MP<n>.webp. 목록은 최신 작품에서
    // 비공개(hidden) 장소는 대화에서 그 코드를 보기 전까지 그림만 가림(이름·설명은 보임 — codebook의 hidden). 본 기록은 내 서재의 수집 기록(이 방 것은 방을 열 때·응답이 끝날 때 적힘)
    const live = liveWork(c), list = live.places || [], MP = seriesCode("place"), book = codebook(live)[MP], hid = book.hidden, seen = seenSet(c.id);
    const lock = (i) => hid.includes(i + 1) && !seen.has(MP + (i + 1));
    body.innerHTML = list.length ? `<p class="note" style="margin-bottom:10px">이 작품의 장소 ${list.length}곳. 대화에서는 [[${MP}번호]] 코드로 나와요.</p><div class="gallery">${list.map((p, i) => {
      const ref = lock(i) ? null : pickImg(c, MP, i + 1);
      return `<button data-p="${i}" title="${MP}${i + 1} · ${esc(p.name)}">${ref ? IMG.tag(ref) : artHTML(c, { name: p.name }, i + 1, (lock(i) ? "🔒 " : "") + book.label)}</button>`; }).join("")}</div>
      <div class="box" style="margin-top:12px">${list.map((p, i) => `<p><b>${MP}${i + 1} ${esc(p.name)}</b>${p.desc ? " — " + esc(p.desc) : ""}${lock(i) ? " · 🔒 그림은 대화에서 나오면 보여요" : ""}</p>`).join("")}</div>`
      : `<div class="empty">이 작품에는 장소 그림이 없어요.</div>`;
    IMG.hydrate(body);
    $$("[data-p]", body).forEach((b) => b.onclick = () => { const im = $("img", b); if (im && im.src) lightbox(im.src); });
}
/** 드로어 화면 'bookmarks'. @param {import("../room-drawer.js").DrawerCtx} x */
export function drawerBookmarks({ r, ov, body }) {
    const list = (r.bookmarks || []).map((id) => r.msgs.find((m) => m.id === id)).filter(Boolean);
    body.innerHTML = list.length ? list.map((m) => `<button class="bm" data-j="${m.id}"><b>${m.role === "ai" ? esc(speakerName(r)) : esc(r.persona.name)}</b>${esc(curText(m).replace(IMG_TAG_RE, "").replace(/[*"]/g, "").replace(/\s+/g, " ").slice(0, 120))}…</button>`).join("")
      : `<div class="empty">북마크한 장면이 없어요. 메시지 아래 ☆ 북마크를 눌러 담아 두세요.</div>`;
    $$("[data-j]", body).forEach((b) => b.onclick = () => { ov.remove(); jumpTo(b.dataset.j); });
}
/** 드로어 화면 'lore'. @param {import("../room-drawer.js").DrawerCtx} x */
export function drawerLore({ r, c, body }) {
    // 세계관 수첩: 작품의 키워드북(최신 작품) 가운데 이 대화에서 AI가 꺼내 쓴 항목만 이름·설명까지, 나머지는 종류만 — 대화가 이어질수록 채워짐(worldart.js loreSeen)
    const live = liveWork(c), lore = live.lore || [], seen = loreSeen(r, lore);
    body.innerHTML = lore.length ? `<p class="note" style="margin-bottom:10px">이 대화에서 펼친 세계관 ${seen.size} / ${lore.length}. 대화에 그 낱말이 나오면 AI가 설정을 꺼내 쓰고(말풍선 아래 📖), 여기에 채워져요.</p>
      <div class="wgal lore-book">${lore.map((e, i) => loreCard(live, e, seen.has(i), false)).join("")}</div>`
      : `<div class="empty">이 작품에는 키워드북이 없어요.</div>`;
    IMG.hydrate(body);
    $$("[data-wlb]", body).forEach((b) => b.onclick = () => { const im = $("img", b); if (im && im.src) lightbox(im.src); });
}
