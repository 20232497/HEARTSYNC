/* 세계관 일러스트(대표 일러스트·키워드북 그림) */
import { getChar, normalizeChar } from "../core/character.js";
import { S } from "../core/state.js";
import { KV } from "../core/storage.js";
import { $, $$, esc, toast } from "../core/util.js";
import { coverPrompt, lorePrompt } from "../images/prompt.js";
import { ratingFieldHTML, setSheetRating, sheetRating } from "../images/rating.js";
import { publishCommunity } from "../services/community.js";
import { IMG } from "../services/images.js";
import { viewDetail } from "./detail.js";
import { audOf } from "../core/audience.js";
import { genImageSheet } from "./gen-sheet.js";
import { ICON } from "./icons.js";
import { sheet } from "./sheet.js";

/* ---------------------------------------------------------------- 세계관 일러스트: 대표 일러스트(표지) + 키워드북 항목별 그림.
   내 작품은 작품(img·loreImages)에, 그 밖의 작품은 내 계정(coverpacks·lorepacks)에 저장 */
function loreImg(c, key) { const live = getChar(c.id) || c; return (S.lorepacks[c.id] || {})[key] || (live.loreImages || {})[key] || ""; }
export function worldArtHTML(c) {
  const lore = (getChar(c.id) || c).lore || [];
  if (!lore.length) return "";
  return `<div class="wgal">${lore.map((e) => { const ref = loreImg(c, e.keys[0]); return `<figure class="wcard">${ref ? `<button class="wpic" data-wlb="${esc(e.keys[0])}" aria-label="${esc(e.keys[0])} 크게 보기">${IMG.tag(ref)}</button>` : `<div class="wpic ph">${esc(e.keys[0])}</div>`}<figcaption><b>${esc(e.keys[0])}</b><span>${esc(e.text)}</span></figcaption></figure>`; }).join("")}</div>`;
}
export function openWorldArt(c) {
  c = normalizeChar(getChar(c.id) || c);
  const mine = S.mine.find((m) => m.id === c.id), lore = c.lore || [];
  const saveMine = () => { KV.set("mine", S.mine); if (mine.publish) publishCommunity(); };
  const getCover = () => mine ? mine.img : S.coverpacks[c.id];
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
    const ov = sheet(`<div class="sheet-head"><h2>세계관 일러스트</h2><button class="icon-btn" data-x aria-label="닫기">${ICON.close}</button></div>
      <p class="sub">대표 일러스트는 표지·카드에, 항목 그림은 작품 소개에 보여요.${mine ? "" : " 그림은 내 계정에만 저장돼요."}</p>
      ${ratingFieldHTML("worldRt", sheetRating("w:" + c.id), "세계관 일러스트 수위 (AI 버튼)")}
      <div class="warts">
        <div class="slot"><div class="pic cover-pic">${cov ? IMG.tag(cov) : `<div class="wpic ph">표지</div>`}</div><span class="lb">대표 일러스트 <small>3:4</small></span>${btns("__cover", !!cov)}</div>
        ${lore.map((e) => { const ref = loreImg(c, e.keys[0]); return `<div class="slot"><div class="pic land">${ref ? IMG.tag(ref) : `<div class="wpic ph">${esc(e.keys[0])}</div>`}</div><span class="lb">${esc(e.keys[0])} <small>16:9</small></span>${btns(e.keys[0], !!ref)}</div>`; }).join("")}
      </div>
      ${lore.length ? "" : `<p class="note" style="margin-top:10px">키워드북이 없는 작품이라 대표 일러스트만 넣을 수 있어요.</p>`}
      <input type="file" id="wfile" accept="image/png,image/jpeg,image/webp" hidden>`, "wide");
    live = ov; IMG.hydrate(ov);
    let target = "";
    $$("[data-wup]", ov).forEach((b) => b.onclick = () => { target = b.dataset.wup; $("#wfile", ov).click(); });
    $$("[data-wrm]", ov).forEach((b) => b.onclick = () => { setRef(b.dataset.wrm, ""); paint(); });
    $("#wfile", ov).onchange = async (e) => { const f = e.target.files[0]; if (!f) return; toast("올리는 중…"); try { setRef(target, await IMG.put(f)); paint(); toast("그림을 넣었어요"); } catch { toast("이미지를 읽지 못했어요. PNG·JPG로 다시 올려 주세요."); } };
    const rs = $("#worldRt", ov); if (rs) rs.onchange = () => setSheetRating("w:" + c.id, rs.value);
    $$("[data-wai]", ov).forEach((b) => b.onclick = () => {
      const key = b.dataset.wai, e = lore.find((x) => x.keys[0] === key), cover = key === "__cover";
      genImageSheet({ title: `${c.title} · ${cover ? "대표 일러스트" : key}`, aspect: cover ? "3:4" : "16:9", prompt: cover ? coverPrompt(c) : lorePrompt(c, e), rating: sheetRating("w:" + c.id), ctx: { kind: "world", aud: audOf(c) },
        onUse: async (blob) => { setRef(key, await IMG.put(blob)); if (live?.isConnected) paint(); toast(cover ? "대표 일러스트를 넣었어요" : "세계관 일러스트를 넣었어요"); } });
    });
  };
  paint();
}
