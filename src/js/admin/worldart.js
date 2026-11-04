/* 세계관 일러스트 관리(관리자 빌드만): 대표 일러스트(표지, 3:4)와 키워드북 항목마다 16:9 그림을 올리기·AI로 만들기·삭제하는 시트(openWorldArt).
   항목은 종류(인물·장소·물건…, LORE_KINDS)별로 묶고 설명 글을 함께 보여 줘 무엇을 그릴 칸인지 알 수 있게 — AI 프롬프트는 종류별 구도 + 항목 영문 태그 + 작품 세계관 태그(lorePrompt).
   저장 위치 — 내 작품(S.mine)은 작품 자체(img·loreImages, 공개돼 있으면 publishCommunity로 다시 올림), 오리지널 등 그 밖의 작품은 내 계정(S.coverpacks·S.lorepacks, KV).
   AI 버튼의 수위는 sheetRating("w:"+작품 id)(기본 전체이용가). 상세 페이지가 열려 있으면 바꾼 뒤 다시 그린다(viewDetail).
   사용자 사이트에 실으려면 상세·작품 화면의 '작품 폴더에 저장'(admin/export.js)으로 content/…/images/cover.*·lore-<n>.*로 내보낸다 */
import { audOf } from "../core/audience.js";
import { getChar, normalizeChar } from "../core/character.js";
import { S } from "../core/state.js";
import { KV } from "../core/storage.js";
import { $, $$, esc, toast } from "../core/util.js";
import { coverPrompt, lorePrompt } from "../images/prompt.js";
import { ratingFieldHTML, setSheetRating, sheetRating } from "../images/rating.js";
import { publishCommunity } from "../services/community.js";
import { IMG } from "../services/images.js";
import { viewDetail } from "../ui/detail.js";
import { ICON } from "../ui/icons.js";
import { sheet } from "../ui/sheet.js";
import { LORE_KINDS, loreImg } from "../ui/worldart.js";
import { genImageSheet } from "./gen-sheet.js";

export function openWorldArt(c) {
  c = normalizeChar(getChar(c.id) || c);
  const mine = S.mine.find((m) => m.id === c.id), lore = c.lore || [];
  const saveMine = () => { KV.set("mine", S.mine); if (mine.publish) publishCommunity(); };
  const getCover = () => mine ? mine.img : S.coverpacks[c.id];
  // 그림 참조를 넣거나 빼기(ref가 빈 값이면 삭제). 예전 그림은 IMG.drop으로 저장 공간에서도 지움
  const setRef = (key, ref) => {
    if (key === "__cover") {
      if (mine) { IMG.drop(mine.img); mine.img = ref; saveMine(); }
      else { IMG.drop(S.coverpacks[c.id]); if (ref) S.coverpacks[c.id] = ref; else delete S.coverpacks[c.id]; KV.set("coverpacks", S.coverpacks); }
    } else {
      const st = mine ? (mine.loreImages = mine.loreImages || {}) : (S.lorepacks[c.id] = S.lorepacks[c.id] || {});
      IMG.drop(st[key]); if (ref) st[key] = ref; else delete st[key];
      if (mine) saveMine(); else KV.set("lorepacks", S.lorepacks);
    }
    if (location.hash.slice(1) === "c-" + c.id) viewDetail(c.id);
  };
  let live = null;
  const paint = () => {
    const cov = getCover() || "";
    const btns = (key, has) => `<div class="bs"><button data-wup="${esc(key)}">${has ? "바꾸기" : "올리기"}</button><button data-wai="${esc(key)}">AI</button>${has ? `<button data-wrm="${esc(key)}">삭제</button>` : ""}</div>`;
    // 키워드북 항목을 종류별로(종류가 없는 항목은 '그 밖') — 정해 둔 순서대로
    const kinds = [...Object.keys(LORE_KINDS), ""].map((k) => ({ k, name: LORE_KINDS[k] || "그 밖", items: lore.filter((e) => (LORE_KINDS[e.kind] ? e.kind : "") === k) })).filter((g) => g.items.length);
    const item = (e) => { const ref = loreImg(c, e.keys[0]); return `<div class="slot wslot"><div class="pic">${ref ? IMG.tag(ref) : `<div class="wpic ph">${esc(e.keys[0])}</div>`}</div><span class="lb">${esc(e.keys[0])}</span><span class="wtx" title="${esc(e.text)}">${esc(e.text)}</span>${btns(e.keys[0], !!ref)}</div>`; };
    const ov = sheet(`<div class="sheet-head"><h2>세계관 일러스트</h2><button class="icon-btn" data-x aria-label="닫기">${ICON.close}</button></div>
      <p class="sub">${mine ? "" : "그림은 내 계정에만 저장돼요. "}사용자 사이트에 실으려면 '작품 폴더에 저장'을 눌러요.</p>
      <div class="wexp"><p><b>대표 일러스트</b> 홈 카드와 작품 상세의 표지예요(세로 3:4).</p>
        <p><b>항목 그림</b> 키워드북 — 대화 중 AI가 참고하는 설정 사전 — 의 항목마다 한 장이에요. 작품 상세의 '세계관 일러스트'에 그 항목 설명과 함께 보여요(가로 16:9). AI 버튼은 항목 종류에 맞는 구도(인물은 초상, 장소는 풍경, 물건은 정물…)로 그려요.</p>
        ${c.artTags ? `<p><b>세계관 태그</b> <span class="note">${esc(c.artTags)}</span> — 표지와 모든 항목 그림에 함께 붙어요.</p>` : ""}</div>
      ${ratingFieldHTML("worldRt", sheetRating("w:" + c.id), "세계관 일러스트 수위 (AI 버튼)")}
      <h3 class="lbl wgh">대표 일러스트</h3>
      <div class="warts"><div class="slot"><div class="pic cover-pic">${cov ? IMG.tag(cov) : `<div class="wpic ph">표지</div>`}</div><span class="lb">표지 <small>3:4</small></span>${btns("__cover", !!cov)}</div></div>
      ${kinds.map((g) => `<h3 class="lbl wgh">${esc(g.name)} <small>${g.items.length}</small></h3><div class="warts">${g.items.map(item).join("")}</div>`).join("")}
      ${lore.length ? "" : `<p class="note" style="margin-top:10px">키워드북이 없는 작품이라 대표 일러스트만 넣을 수 있어요.</p>`}
      <input type="file" id="wfile" accept="image/png,image/jpeg,image/webp" hidden>`, "wide");
    live = ov; IMG.hydrate(ov);
    let target = "";
    $$("[data-wup]", ov).forEach((b) => b.onclick = () => { target = b.dataset.wup; $("#wfile", ov).click(); });
    $$("[data-wrm]", ov).forEach((b) => b.onclick = () => { setRef(b.dataset.wrm, ""); paint(); });
    $("#wfile", ov).onchange = async (e) => { const f = e.target.files[0]; if (!f) return; toast("올리는 중…"); try { setRef(target, await IMG.put(f)); paint(); toast("그림을 넣었어요"); } catch { toast("이미지를 읽지 못했어요. PNG·JPG로 다시 올려 주세요."); } };
    const rs = $("#worldRt", ov); if (rs) rs.onchange = () => setSheetRating("w:" + c.id, rs.value);
    // AI: 표지는 coverPrompt(world_mode면 단체 구도), 항목은 lorePrompt(풍경). 화풍은 ctx(kind: world)로 표지 화풍
    $$("[data-wai]", ov).forEach((b) => b.onclick = () => {
      const key = b.dataset.wai, e = lore.find((x) => x.keys[0] === key), cover = key === "__cover";
      genImageSheet({ title: `${c.title} · ${cover ? "대표 일러스트" : (LORE_KINDS[e.kind] ? LORE_KINDS[e.kind] + " " : "") + key}`, aspect: cover ? "3:4" : "16:9", prompt: cover ? coverPrompt(c) : lorePrompt(c, e), rating: sheetRating("w:" + c.id), ctx: { kind: "world", aud: audOf(c) },
        onUse: async (blob) => { setRef(key, await IMG.put(blob)); if (live?.isConnected) paint(); toast(cover ? "대표 일러스트를 넣었어요" : "세계관 일러스트를 넣었어요"); } });
    });
  };
  paint();
}
