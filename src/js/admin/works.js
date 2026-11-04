/* 작품 화면(관리자 빌드만, #works): 오리지널·내 작품을 한 목록으로 — 성향·출연진 수·등록한 그림 수·표지·세계관 일러스트 유무와 상세/이미지(이미지 스튜디오)/일러스트/작품 폴더에 저장 버튼.
   위에는 content 폴더 고르기(Chrome·Edge — 고르면 그 폴더에 바로 씀, 그 밖의 브라우저는 ZIP 내려받기), 코드 표(codes.json) 내보내기, 전부 저장.
   그림은 이 브라우저(IndexedDB·계정)에만 있으므로 여기서 content/에 써야 npm run build 뒤 사용자 사이트에 실린다(admin/export.js) */
import { ORIGINALS } from "../content/index.js";
import { AUDS, audOf } from "../core/audience.js";
import { normalizeChar } from "../core/character.js";
import { S } from "../core/state.js";
import { $, $$, esc, toast } from "../core/util.js";
import { imagesOf } from "../images/pick.js";
import { IMG, validRef } from "../services/images.js";
import { coverHTML } from "../ui/cover.js";
import { bindGo, go, topbar } from "../ui/shell.js";
import { loreImg } from "../ui/worldart.js";
import { CONTENT, canPickDir, codesDropped, exportCodes, exportWork, pickContentDir } from "./export.js";
import { openImages } from "./image-studio.js";
import { exportWorkToast } from "./tools.js";
import { openWorldArt } from "./worldart.js";

export function viewWorks() {
  const v = $("#view");
  const works = [...ORIGINALS.map((c) => ({ c: normalizeChar(c), orig: true })), ...S.mine.map((c) => ({ c: normalizeChar(c), orig: false }))];
  const count = (c) => Object.values(imagesOf(c)).reduce((a, m) => a + Object.values(m).filter(validRef).length, 0);
  const row = ({ c, orig }) => {
    const mine = S.mine.find((m) => m.id === c.id), cover = mine ? mine.img : S.coverpacks[c.id], lore = c.lore || [], loreN = lore.filter((e) => loreImg(c, e.keys[0])).length;
    return `<div class="wrow">${coverHTML(c)}<div class="x"><b>${esc(c.title)}</b><span class="note">${orig ? "오리지널" : "내 작품"} · ${esc((AUDS[audOf(c)] || {}).name || audOf(c))} · 출연진 ${c.cast.length}명</span>
      <span class="note">그림 ${count(c)}장 · 표지 ${validRef(cover) ? "있음" : "없음"} · 세계관 일러스트 ${loreN}/${lore.length}</span></div>
      <div class="bs"><button class="btn sm ghost" data-go="c-${esc(c.id)}">상세</button><button class="btn sm ghost" data-slots="${esc(c.id)}">이미지</button><button class="btn sm ghost" data-art="${esc(c.id)}">일러스트</button><button class="btn sm" data-save="${esc(c.id)}">작품 폴더에 저장</button></div></div>`;
  };
  v.innerHTML = `<div class="page">${topbar()}
    <h1 class="sec" style="margin-top:4px">작품 <small>관리자 도구</small></h1>
    <div class="box"><p class="note" style="margin:0 0 10px">여기서 만든 그림·코드 표는 이 브라우저(와 로그인한 계정)에만 있어요. <b>작품 폴더에 저장</b>으로 저장소의 <b>content/</b> 폴더에 쓰고 <b>npm run build</b>를 돌리면 사용자 사이트(index.html)에 실려요. 새 작품은 <a href="#studio">만들기</a>에서.</p>
      <div class="cta-row" style="margin:0">${canPickDir() ? `<button class="btn sm" id="pickDir">${CONTENT.dir ? "content 폴더: " + esc(CONTENT.dir.name) : "content 폴더 고르기"}</button>` : `<span class="note">이 브라우저는 폴더에 바로 쓸 수 없어 ZIP으로 내려받아요(Chrome·Edge는 바로 써요).</span>`}
        <button class="btn sm" id="saveCodes">코드 표 내보내기 (codes.json)</button><button class="btn sm pri" id="saveAll">전부 저장</button><button class="btn sm ghost" data-go="images">이미지 스튜디오</button></div></div>
    <div class="wlist">${works.map(row).join("")}</div></div>`;
  bindGo(v); IMG.hydrate(v);
  const find = (id) => works.find((w) => w.c.id === id).c;
  const pd = $("#pickDir", v); if (pd) pd.onclick = async () => { try { if (await pickContentDir()) viewWorks(); } catch (e) { if (e.name !== "AbortError") toast("폴더를 열지 못했어요: " + (e.message || e)); } };
  $("#saveCodes", v).onclick = async () => { try { await exportCodes(); const d = codesDropped(); toast((CONTENT.dir ? "content/codes.json에 썼어요" : "codes.json을 내려받았어요 — 저장소 content/ 폴더에 넣어요") + (d ? ` · 성인 수위·관리자 전용 코드 ${d}개는 공개 저장소에 싣지 않아 뺐어요` : "")); } catch (e) { toast("내보내지 못했어요: " + (e.message || e)); } };
  $("#saveAll", v).onclick = async () => {
    let n = 0, w = 0;
    for (const { c } of works) { try { const k = await exportWork(c); if (k) { n += k; w++; } } catch (e) { toast(`${c.title}: ${e.message || e}`); return; } }
    toast(n ? `${w}개 작품, 파일 ${n}개를 ${CONTENT.dir ? "content 폴더에 썼어요" : "ZIP으로 내려받았어요"} — npm run build로 사용자 사이트에 실어요` : "이 브라우저에 만들어 둔 그림이 없어요");
  };
  $$("[data-slots]", v).forEach((b) => b.onclick = () => openImages(find(b.dataset.slots)));
  $$("[data-art]", v).forEach((b) => b.onclick = () => openWorldArt(find(b.dataset.art)));
  $$("[data-save]", v).forEach((b) => b.onclick = () => exportWorkToast(find(b.dataset.save)));
}
export { go };
