/* 크리에이터 스튜디오: 작품 쓰기·AI 초안·저장·삭제. 커뮤니티 공개·정리는 services/community.js */
import { errCopy, llm } from "../ai/llm.js";
import { loreText, parseLore } from "../ai/prompt/lore.js";
import { AUDS, audOf, guessAud } from "../core/audience.js";
import { CATS, MOTIFS, PALETTES } from "../core/constants.js";
import { minorFlags } from "../core/safety.js";
import { S } from "../core/state.js";
import { KV } from "../core/storage.js";
import { $, $$, esc, toast, uid } from "../core/util.js";
import { coverPrompt } from "../images/prompt.js";
import { publishCommunity } from "../services/community.js";
import { IMG } from "../services/images.js";
import { genImageSheet } from "./gen-sheet.js";
import { cardHTML } from "../ui/home.js";
import { confirmSheet } from "../ui/sheet.js";
import { go, topbar } from "../ui/shell.js";
import { openImages } from "./image-studio.js";

let draft = null;
function blankDraft() {
  return { id: uid("u"), name: "", title: "", glyph: "", cat: "로맨스", pal: 1, motif: "glow", oneLiner: "", tags: [], desc: "", persona: "", world: "", speech: "", secret: "",
    fields: ["장소", "호감도", "속마음"], gauge: "호감도", cast: [], lore: [], images: {}, world_mode: false, openings: [{ title: "첫 만남", text: "", directive: "", status: {} }], img: "", publish: false };
}
export function viewStudio(id) {
  const v = $("#view");
  if (!draft || (id && draft.id !== id) || (!id && S.mine.some((m) => m.id === draft.id))) {
    const ex = id && S.mine.find((m) => m.id === id);
    draft = ex ? JSON.parse(JSON.stringify(ex)) : blankDraft();
  }
  const d = draft, editing = S.mine.some((m) => m.id === d.id);
  const castText = (d.cast || []).map((x) => `${x.code}|${x.name}|${x.look || ""}${x.tags ? "|" + x.tags : ""}`).join("\n");
  v.innerHTML = `<div class="page">${topbar()}
    <h1 class="sec" style="margin-top:4px">${editing ? "캐릭터 수정" : "캐릭터 만들기"} <small>크리에이터 스튜디오</small></h1>
    <div class="studio"><div>
      <div class="box"><h3>AI로 초안 만들기</h3>
        <p class="note">컨셉 한 줄이면 설정·말투·시작 상황·상태창까지 채워 줘요. 채운 뒤 자유롭게 고치세요. (무료)</p>
        <div class="ai-draft"><label class="sr" for="concept">컨셉</label><input class="inp" id="concept" maxlength="200" placeholder="예: 은퇴한 천재 셰프가 운영하는 심야 식당, 무뚝뚝한데 손님 취향은 다 기억함">
        <button class="btn pri" id="aiGen">초안 생성</button></div><div class="msgline" id="aiMsg"></div></div>
      <div class="box">
        <h3>기본 정보</h3>
        <div class="two">
          <div class="field"><label for="f-name">캐릭터 이름 *</label><input id="f-name" maxlength="16" value="${esc(d.name)}"></div>
          <div class="field"><label for="f-title">작품명 *</label><input id="f-title" maxlength="24" value="${esc(d.title)}"></div>
        </div>
        <div class="field"><label for="f-one">한 줄 소개 * (카드에 보여요)</label><input id="f-one" maxlength="70" value="${esc(d.oneLiner)}"></div>
        <div class="two">
          <div class="field"><label for="f-cat">카테고리</label><select id="f-cat">${CATS.map((c) => `<option ${c === d.cat ? "selected" : ""}>${c}</option>`).join("")}</select></div>
          <div class="field"><label for="f-aud">관심있는 대화</label><select id="f-aud">${[["", `자동 (출연진 성별로 — 지금: ${AUDS[guessAud(d)].name})`], ["m", "남성향 · 여성 캐릭터"], ["f", "여성향 · 남성 캐릭터"], ["all", "전체 · 남녀 모두"]].map(([k, l]) => `<option value="${k}" ${(d.aud || "") === k ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></div>
        </div>
        <div class="field"><label for="f-tags">태그 (쉼표로 구분, 최대 5개)</label><input id="f-tags" maxlength="60" value="${esc(d.tags.join(", "))}"></div>
        <div class="field"><label for="f-desc">작품 소개 (상세 페이지)</label><textarea id="f-desc" maxlength="600">${esc(d.desc)}</textarea></div>
        <div class="toggle" style="margin-top:12px"><label for="f-wm"><b>세계관 모드</b><br><span class="note">여러 인물이 나오고 AI가 내레이터로 진행해요 (RPG·시뮬레이션)</span></label><input type="checkbox" id="f-wm" ${d.world_mode ? "checked" : ""}></div>
      </div>
      <div class="box">
        <h3>표지</h3>
        <div class="two">
          <div class="field"><span class="lbl">색 테마</span><div class="swatches">${PALETTES.map((p, i) => `<button type="button" data-pal="${i}" class="${d.pal === i ? "on" : ""}" style="background:linear-gradient(150deg,${p[0]},${p[1]} 70%,${p[2]})" aria-label="색 테마 ${i + 1}"></button>`).join("")}</div></div>
          <div class="field"><span class="lbl">배경 모티프</span><div class="motifs">${Object.entries(MOTIFS).map(([k, l]) => `<button type="button" data-motif="${k}" class="${d.motif === k ? "on" : ""}">${l}</button>`).join("")}</div></div>
        </div>
        <div class="two">
          <div class="field"><label for="f-glyph">대표 글자 (한 글자, 한자 추천)</label><input id="f-glyph" maxlength="1" value="${esc(d.glyph)}"></div>
          <div class="field"><label for="f-img">표지 이미지 (선택)</label><input id="f-img" type="file" accept="image/png,image/jpeg,image/webp"></div>
        </div>
        <div class="cta-row" style="margin-top:6px"><button type="button" class="btn sm" id="imgAi">AI로 표지 만들기</button>${d.img ? `<button class="btn sm ghost" id="imgDel">표지 이미지 빼기</button>` : ""}</div>
      </div>
      <div class="box">
        <h3>캐릭터 프롬프트</h3>
        <div class="field"><label for="f-persona">캐릭터 설정 * (나이·직업·성격·외모·관계)</label><textarea id="f-persona" maxlength="3000" style="min-height:130px">${esc(d.persona)}</textarea></div>
        <div class="field"><label for="f-world">세계관·규칙</label><textarea id="f-world" maxlength="2500">${esc(d.world)}</textarea></div>
        <div class="field"><label for="f-speech">말투와 대사 예시</label><textarea id="f-speech" maxlength="800">${esc(d.speech)}</textarea></div>
        <div class="field"><label for="f-secret">숨겨진 설정 (가까워지면 드러남)</label><input id="f-secret" maxlength="200" value="${esc(d.secret)}"></div>
      </div>
      <div class="box">
        <h3>키워드북</h3>
        <p class="note">대화에 키워드가 나올 때만 AI에게 알려 주는 설정이에요. 장소·인물·물건·사건을 많이 적어도 평소 프롬프트는 길어지지 않아요. 한 줄에 하나씩 <b>키워드1, 키워드2 | 설명</b> (최대 40줄).</p>
        <div class="field"><label for="f-lore" class="sr">키워드북</label><textarea id="f-lore" maxlength="12000" style="min-height:110px" placeholder="순댓국집, 사장님 | 사무소 1층 24시간 순댓국집. 사장님은 외상을 봐 준다.">${esc(loreText(d.lore))}</textarea></div>
      </div>
      <div class="box">
        <h3>이미지 출연진</h3>
        <p class="note">대화 중 [[img:코드:번호]]로 불러올 인물이에요. 한 줄에 하나씩 <b>코드|이름|외모|영문 태그(선택)</b>. 영문 태그를 적으면 그림을 만들 때 외모 대신 그대로 써서 같은 생김새로 그려요. 비워 두면 캐릭터 이름 하나(c)로 만들어요.</p>
        <div class="field"><label for="f-cast" class="sr">이미지 출연진</label><textarea id="f-cast" maxlength="1200" placeholder="c|${esc(d.name || "캐릭터 이름")}|긴 흑발, 날카로운 눈매, 검은 코트">${esc(castText)}</textarea></div>
        ${editing ? `<button class="btn sm" id="slots" style="margin-top:8px">이미지 스튜디오 열기</button>` : `<p class="note" style="margin-top:6px">저장한 뒤 이미지 스튜디오에서 감정·의상·장소별 그림을 만들 수 있어요.</p>`}
      </div>
      <div class="box">
        <h3>상태창</h3>
        <div class="two">
          <div class="field"><label for="f-fields">항목 (쉼표로 구분, 최대 16개)</label><input id="f-fields" maxlength="240" value="${esc(d.fields.join(", "))}"></div>
          <div class="field"><label for="f-gauge">헤더 게이지 항목</label><input id="f-gauge" maxlength="12" value="${esc(d.gauge)}"></div>
        </div>
        <p class="note" style="margin-top:6px">게이지 항목은 0~100 숫자나 'HP 80/100' 같은 값으로 막대가 그려져요. '속마음' 항목은 눌러야 보이게 흐리게 표시돼요.</p>
      </div>
      <div class="box">
        <h3>시작 상황 (최대 6개)</h3>
        <div id="ops">${d.openings.map((o, i) => `<div class="op-block">
          <div class="field"><label for="o-t${i}">상황 제목</label><input id="o-t${i}" maxlength="30" value="${esc(o.title)}"></div>
          <div class="field"><label for="o-x${i}">첫 메시지 (*서술*, "대사", [[img:코드:0]])</label><textarea id="o-x${i}" maxlength="3000" style="min-height:120px">${esc(o.text)}</textarea></div>
          <div class="field"><label for="o-d${i}">시작 지침 (AI만 봐요, 선택)</label><input id="o-d${i}" maxlength="300" value="${esc(o.directive || "")}" placeholder="예: 하드 모드. 적은 강하고 보상은 박하다."></div>
          ${d.openings.length > 1 ? `<button class="btn sm ghost danger" data-opdel="${i}" style="margin-top:6px">이 상황 삭제</button>` : ""}</div>`).join("")}</div>
        ${d.openings.length < 6 ? `<button class="btn sm" id="opAdd" style="margin-top:10px">+ 시작 상황 추가</button>` : ""}
      </div>
      <div class="box">
        <div class="toggle"><label for="f-pub"><b>커뮤니티에 공개</b><br><span class="note">이 페이지를 여는 다른 사람의 '커뮤니티 신작'에 보여요. 크리에이터 이름: ${esc(S.profile.nick || "익명 크리에이터")}</span></label><input type="checkbox" id="f-pub" ${d.publish ? "checked" : ""}></div>
      </div>
      <div class="cta-row"><button class="btn pri" id="saveChar">${editing ? "저장" : "만들기"}</button>${editing ? `<button class="btn danger" id="delChar">삭제</button>` : ""}</div>
      <div class="msgline" id="saveMsg"></div>
    </div>
    <div class="preview"><span class="lbl">미리보기</span><div style="margin-top:8px" id="pv"></div></div></div></div>`;
  const pv = () => { collect(); $("#pv").innerHTML = cardHTML({ ...d, name: d.name || "캐릭터 이름", oneLiner: d.oneLiner || "한 줄 소개가 여기에 보여요.", title: d.title || "작품명" }); IMG.hydrate($("#pv")); };
  $$("input,textarea,select", v).forEach((el) => el.addEventListener("input", pv));
  $$("[data-pal]", v).forEach((b) => b.onclick = () => { collect(); d.pal = +b.dataset.pal; viewStudio(id); });
  $$("[data-motif]", v).forEach((b) => b.onclick = () => { collect(); d.motif = b.dataset.motif; viewStudio(id); });
  $$("[data-opdel]", v).forEach((b) => b.onclick = () => { collect(); d.openings.splice(+b.dataset.opdel, 1); viewStudio(id); });
  const add = $("#opAdd"); if (add) add.onclick = () => { collect(); d.openings.push({ title: "", text: "", directive: "", status: {} }); viewStudio(id); };
  const imgDel = $("#imgDel"); if (imgDel) imgDel.onclick = () => { collect(); d.img = ""; viewStudio(id); };
  $("#imgAi").onclick = () => {
    collect();
    genImageSheet({ title: "AI로 표지 만들기", aspect: "3:4", prompt: coverPrompt(d), ctx: { kind: "world", aud: audOf(d) },
      onUse: async (blob) => { collect(); d.img = await IMG.put(blob); viewStudio(id); toast("표지 이미지를 넣었어요"); } });
  };
  const sl = $("#slots"); if (sl) sl.onclick = () => { const m = S.mine.find((x) => x.id === d.id); if (m) openImages(m); };
  $("#f-img").onchange = async (e) => { const f = e.target.files[0]; if (!f) return; collect(); toast("올리는 중…"); try { d.img = await IMG.put(f); viewStudio(id); } catch { toast("이미지를 읽지 못했어요. PNG·JPG로 다시 올려 주세요."); } };
  $("#aiGen").onclick = () => aiDraft(id);
  $("#saveChar").onclick = () => saveChar();
  const del = $("#delChar"); if (del) del.onclick = () => confirmSheet("이 캐릭터를 삭제할까요?", "커뮤니티 공개도 함께 내려가요. 이미 만든 대화방은 남아요.", "삭제", () => {
    S.mine = S.mine.filter((m) => m.id !== d.id); KV.set("mine", S.mine); publishCommunity(); draft = null; go("home");
  });
  pv();
}
function parseCast(text, name) {
  const out = [], used = new Set();
  String(text).split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 12).forEach((l) => {
    const [code, nm, look, tags] = l.split("|").map((x) => (x || "").trim());
    const cd = (code || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
    if (!cd || !nm || used.has(cd)) return; used.add(cd); out.push({ code: cd, name: nm.slice(0, 16), look: (look || "").slice(0, 200), ...(tags ? { tags: tags.slice(0, 300) } : {}) });
  });
  return out.length ? out : [{ code: "c", name: name || "캐릭터", look: "" }];
}
function collect() {
  const d = draft, val = (s) => ($(s)?.value ?? "").trim();
  if (!$("#f-name")) return;
  d.name = val("#f-name"); d.title = val("#f-title"); d.oneLiner = val("#f-one"); d.cat = val("#f-cat");
  if (AUDS[val("#f-aud")]) d.aud = val("#f-aud"); else delete d.aud;
  d.tags = val("#f-tags").split(/[,#]/).map((t) => t.trim()).filter(Boolean).slice(0, 5);
  d.desc = val("#f-desc"); d.glyph = val("#f-glyph"); d.persona = val("#f-persona"); d.world = val("#f-world"); d.speech = val("#f-speech"); d.secret = val("#f-secret");
  d.world_mode = !!$("#f-wm")?.checked;
  d.fields = val("#f-fields").split(",").map((t) => t.trim()).filter(Boolean).slice(0, 16);
  d.gauge = val("#f-gauge") || d.fields[0] || "호감도";
  d.cast = parseCast(val("#f-cast"), d.name);
  d.lore = parseLore(val("#f-lore"));
  d.openings = d.openings.map((o, i) => ({ ...o, title: val("#o-t" + i), text: $("#o-x" + i)?.value.trim() ?? o.text, directive: val("#o-d" + i) }));
  d.publish = !!$("#f-pub")?.checked;
}
function saveChar() {
  collect(); const d = draft, m = $("#saveMsg");
  const miss = [!d.name && "캐릭터 이름", !d.title && "작품명", !d.oneLiner && "한 줄 소개", !d.persona && "캐릭터 설정", !d.openings.some((o) => o.text) && "첫 메시지"].filter(Boolean);
  if (miss.length) { m.className = "msgline err"; m.textContent = miss.join(", ") + "을(를) 채워 주세요."; return; }
  const minors = minorFlags(d);
  if (minors.length) { m.className = "msgline err"; m.textContent = `등장인물은 모두 성인(만 19세 이상)이어야 해요. 나이나 신분을 확인해 주세요: ${minors.join(", ")}`; return; }
  if (!d.fields.includes(d.gauge)) d.fields.unshift(d.gauge);
  d.openings = d.openings.filter((o) => o.text).map((o, i) => ({ title: o.title || "시작 " + (i + 1), text: o.text, directive: o.directive || "", status: { ...(o.status || {}), [d.gauge]: o.status?.[d.gauge] ?? 10 } }));
  d.creator = S.profile.nick || "익명 크리에이터"; d.updated = Date.now();
  const copy = JSON.parse(JSON.stringify(d));
  S.mine = [copy, ...S.mine.filter((x) => x.id !== d.id)];
  KV.set("mine", S.mine); publishCommunity();
  toast(d.publish ? "저장하고 커뮤니티에 공개했어요" : "저장했어요");
  draft = null; go("c-" + copy.id);
}
async function aiDraft(id) {
  const concept = $("#concept").value.trim(), m = $("#aiMsg"), b = $("#aiGen");
  if (!concept) { m.className = "msgline err"; m.textContent = "컨셉을 한 줄 적어 주세요."; return; }
  collect(); b.disabled = true; m.className = "msgline"; m.textContent = "캐릭터를 설계하는 중… (보통 20~60초)";
  const prompt = `한국어 캐릭터 롤플레이 플랫폼에 올릴 오리지널 캐릭터를 설계하라. 컨셉: ${concept}
조건: 모든 인물은 성인(20세 이상). 실존 인물·기존 작품 캐릭터를 쓰지 않는다. 유저가 바로 몰입할 수 있는 구체적 갈등과 떡밥을 넣는다.
JSON 하나로만 답하라:
{"name":"캐릭터 이름","title":"작품명(12자 이내)","oneLiner":"카드용 한 줄 소개(45자 이내, 유저를 '당신'으로)","cat":"${CATS.join("|")} 중 하나","tags":["태그 4개"],"glyph":"작품을 상징하는 한자 한 글자","pal":0~7 정수(0 밤비 남색,1 장미,2 별밤,3 새벽 청록,4 단풍,5 잿빛,6 네온 보라,7 숲),"motif":"rain|city|stars|glow|petals|ash|curtain","desc":"상세 소개 2~3문장","persona":"이름(나이, 성별). 직업·신분. 성격(장점과 결점). 버릇. 외모. 유저와의 관계 — 5~7문장","look":"외모 한 줄(이미지 프롬프트용)","world":"세계관·장소·주변 인물·규칙 3~5문장","speech":"말투 설명 한 줄 + 대표 대사 2개(각 줄에 큰따옴표)","secret":"숨겨진 설정 한 문장","fields":["상태창 항목 3~5개, 관계 게이지 항목과 '속마음' 포함"],"gauge":"관계 게이지 항목 이름","openings":[{"title":"상황 제목","text":"첫 메시지 300~500자. 첫 문단 뒤에 [[img:c:0]] 한 줄. *서술* 과 \\"대사\\" 를 줄바꿈으로 섞고, 유저가 반응할 여지를 남기며 끝낸다. 유저의 행동은 쓰지 않는다."},{"title":"다른 상황","text":"..."}]}`;
  try {
    const v = await llm([{ role: "user", content: prompt }], { tier: "default", json: true, maxTokens: 3000 });
    if (!v || typeof v !== "object" || !v.name) throw { code: "invalid_json" };
    const d = draft, s = (x, n) => typeof x === "string" ? x.slice(0, n) : "";
    Object.assign(d, {
      name: s(v.name, 16), title: s(v.title, 24), oneLiner: s(v.oneLiner, 70), cat: CATS.includes(v.cat) ? v.cat : d.cat,
      tags: Array.isArray(v.tags) ? v.tags.map((t) => s(t, 12).replace(/^#/, "")).filter(Boolean).slice(0, 5) : d.tags,
      glyph: s(v.glyph, 1), pal: Number.isInteger(v.pal) && PALETTES[v.pal] ? v.pal : d.pal, motif: MOTIFS[v.motif] ? v.motif : d.motif,
      desc: s(v.desc, 600), persona: s(v.persona, 3000), world: s(v.world, 2500), speech: s(v.speech, 800), secret: s(v.secret, 200),
      fields: Array.isArray(v.fields) && v.fields.length ? v.fields.map((f) => s(f, 12)).filter(Boolean).slice(0, 8) : d.fields,
      gauge: s(v.gauge, 12) || d.gauge, cast: [{ code: "c", name: s(v.name, 16), look: s(v.look, 200) }],
      openings: Array.isArray(v.openings) && v.openings.length ? v.openings.slice(0, 3).map((o) => ({ title: s(o.title, 30), text: s(o.text, 3000), directive: "", status: {} })) : d.openings
    });
    viewStudio(id); const mm = $("#aiMsg"); mm.className = "msgline ok"; mm.textContent = "초안을 채웠어요. 마음에 들게 고친 뒤 만들기를 누르세요.";
  } catch (e) {
    b.disabled = false; m.className = "msgline err"; m.textContent = e.code === "invalid_json" ? "초안 형식이 깨졌어요. 한 번 더 눌러 주세요." : errCopy(e) || "취소했어요.";
  }
}
