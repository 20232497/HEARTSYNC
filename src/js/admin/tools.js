/* 관리자 고리(EXT에 꽂음): 사용자 화면 모듈이 비워 둔 자리를 채운다. 사용자 빌드에는 이 모듈이 없어 그 자리들이 비어 있다.
   상세(EXT.detail): '일러스트 관리'·'이미지 슬롯 관리'·'작품 폴더에 저장', 내 작품이면 '수정', 인물 초상을 누르면 그 인물의 이미지 슬롯
   드로어(EXT.drawer): 메뉴 끝에 '이미지 슬롯(n장 등록)' / MY(EXT.me): 크리에이터 프로필(커뮤니티 공개 이름)과 관리자 안내 / 페르소나 시트(EXT.persona): 'AI로 만들기' */
import { getChar } from "../core/character.js";
import { S } from "../core/state.js";
import { KV } from "../core/storage.js";
import { $, $$, esc, toast } from "../core/util.js";
import { imagesOf } from "../images/pick.js";
import { lookIsMale } from "../images/prompt.js";
import { publishCommunity } from "../services/community.js";
import { IMG, validRef } from "../services/images.js";
import { EXT } from "../ui/ext.js";
import { go } from "../ui/shell.js";
import { CONTENT, exportWork } from "./export.js";
import { genImageSheet } from "./gen-sheet.js";
import { openImageSlots } from "./slots.js";
import { openWorldArt } from "./worldart.js";

EXT.detail.push((c, v) => {
  const wb = $("#wArtBox", v), wt = $("#wArtTools", v), ct = $("#castTools", v), cta = $("#ctaTools", v);
  if (wb) { wb.style.display = ""; if (!$(".wgal", wb)) wb.insertAdjacentHTML("beforeend", `<p class="note">대표 일러스트(표지)를 AI로 만들거나 올릴 수 있어요. 키워드북이 있는 작품은 항목마다 세계관 일러스트도 넣을 수 있어요.</p>`); }
  if (wt) { wt.innerHTML = `<button class="btn sm ghost" id="wArt">일러스트 관리</button>`; $("#wArt", wt).onclick = () => openWorldArt(c); }
  if (ct) {
    ct.innerHTML = `<button class="btn sm ghost" id="imgSlots">이미지 슬롯 관리</button> <button class="btn sm ghost" id="wExport" title="이 작품의 그림을 저장소 content/ 폴더에 써요">작품 폴더에 저장</button>`;
    $("#imgSlots", ct).onclick = () => openImageSlots(c);
    $("#wExport", ct).onclick = () => exportWorkToast(c);
  }
  if (cta && S.mine.some((m) => m.id === c.id)) { cta.innerHTML = `<button class="btn" id="wEdit">수정</button>`; $("#wEdit", cta).onclick = () => go("studio-" + c.id); }
  $$("[data-cast]", v).forEach((b) => b.onclick = () => openImageSlots(c, b.dataset.cast));
});
EXT.drawer.push((r, body) => {
  const list = $(".menu-list", body); if (!list) return;
  const c = getChar(r.char.id) || r.char, filled = Object.values(imagesOf(c)).reduce((a, m) => a + Object.values(m).filter(validRef).length, 0);
  list.insertAdjacentHTML("beforeend", `<button id="mImg">이미지 슬롯<span class="v">${filled}장 등록</span></button>`);
  $("#mImg", list).onclick = () => openImageSlots(c);
});
EXT.me.push((v) => {
  const box = $("#meExt", v); if (!box) return;
  box.insertAdjacentHTML("beforeend", `<h2 class="sec">크리에이터 프로필 <small>관리자 도구</small></h2>
    <div class="box"><div class="field" style="margin:0"><label for="nick">크리에이터 이름 (커뮤니티 공개 캐릭터에 표시)</label><input id="nick" maxlength="20" value="${esc(S.profile.nick)}" placeholder="예: 새벽작가"></div>
      <button class="btn sm" id="nickSave" style="margin-top:10px">저장</button>
      <p class="note" style="margin:10px 0 0">작품·그림·코드 표는 <a href="#works">작품</a> 화면에서 만들고 '작품 폴더에 저장'으로 저장소 content/ 폴더에 써요. npm run build 뒤 사용자 사이트(index.html)에 실려요.</p></div>`);
  $("#nickSave", box).onclick = () => { S.profile.nick = $("#nick", box).value.trim(); KV.set("profile", S.profile); publishCommunity(); toast("저장했어요"); };
});
EXT.persona.push((ov, setImg) => {
  const t = $("#avTools", ov); if (!t) return;
  t.innerHTML = `<button class="btn sm" id="avAi">AI로 만들기</button>`;
  $("#avAi", ov).onclick = () => genImageSheet({ title: "AI로 페르소나 이미지 만들기", aspect: "1:1", ctx: { kind: "daily", male: lookIsMale($("#pd", ov).value) },
    prompt: ["solo, adult, portrait, upper body, looking at viewer", $("#pd", ov).value.trim() || $("#pn", ov).value.trim(), "simple background"].filter(Boolean).join(", "),
    onUse: async (blob) => setImg(await IMG.put(blob)) });
});
/* 작품 하나를 content 폴더(또는 ZIP)로 내보내고 결과를 알림 */
export async function exportWorkToast(c) {
  try { const n = await exportWork(c); if (n) toast(CONTENT.dir ? `content 폴더에 ${n}개를 썼어요 — npm run build 뒤 사용자 사이트에 실려요` : `ZIP(${n}개 파일)을 내려받았어요 — 저장소 content/ 폴더에 풀어 넣고 npm run build`); }
  catch (e) { if (e && e.name !== "AbortError") toast("내보내지 못했어요: " + (e.message || e)); }
}
