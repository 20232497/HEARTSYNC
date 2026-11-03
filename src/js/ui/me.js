/* MY: 프로필·페르소나·설정(채팅·AI 연결·이미지) */
import { engineName } from "../ai/llm.js";
import { OR_PRESETS } from "../ai/models.js";
import { AUDS, audience } from "../core/audience.js";
import { IN_CLAUDE } from "../core/config.js";
import { roomKey, saveRoom } from "../core/rooms.js";
import { applySettings, cleanKeys, saveSettings } from "../core/settings.js";
import { S, hasClaudeKey, room } from "../core/state.js";
import { IDB, KV } from "../core/storage.js";
import { $, $$, esc, toast, uid } from "../core/util.js";
import { isPro } from "../core/wallet.js";
import { genErr } from "../images/runware.js";
import { lookIsMale } from "../images/prompt.js";
import { BUILTIN_SETS, IMG_MODELS, IMG_STYLES, activeSet, claudeStyleTags, effectiveSet, groupStyleFiles, guessStyleModel, guessStylePrompt, imgModelInfo, matchBuiltin, overridingSet, styleOptionsHTML, unzipImages } from "../images/styles.js";
import { CLOUD } from "../services/cloud.js";
import { IMG, validRef } from "../services/images.js";
import { accountBoxHTML, bindAccount } from "./account.js";
import { renderLog } from "./chat/log.js";
import { pavHTML } from "./cover.js";
import { genImageSheet } from "./gen-sheet.js";
import { audSegHTML, setAudience } from "./home.js";
import { ICON } from "./icons.js";
import { confirmSheet, sheet } from "./sheet.js";
import { bindGo, topbar } from "./shell.js";
import { publishCommunity } from "./studio.js";

export function viewMe() {
  const v = $("#view"), cur = S.personas.find((p) => p.def) || S.personas[0];
  v.innerHTML = `<div class="page">${topbar()}
    <h1 class="sec" style="margin-top:4px">MY</h1>
    <div class="statline">
      <div class="box"><h3>대화방</h3><b>${S.rooms.length}</b></div>
      <div class="box"><h3>만든 캐릭터</h3><b>${S.mine.length}</b></div>
      <div class="box"><h3>요금제</h3><b>${isPro() ? "PLUS" : "무료"}</b></div>
    </div>
    ${accountBoxHTML()}
    <h2 class="sec">내 페르소나 <small>대화에서 내가 연기하는 캐릭터</small></h2>
    <div class="box">
      <div class="avatar-pick">${pavHTML(cur)}<div style="min-width:0"><b style="font-size:17px">${esc(cur.name)}</b> <span class="pill">기본</span><div class="note">${esc(cur.memo || "")}</div></div></div>
      ${cur.desc ? `<div class="setcard" style="margin-top:12px"><h4>상세 정보</h4><p style="margin:0;white-space:pre-wrap;font-size:13.5px">${esc(cur.desc)}</p></div>` : ""}
      <h3 style="margin:16px 0 8px">현재 페르소나</h3>
      <div class="plist">${S.personas.map((p) => `<div class="prow ${p.def ? "on" : ""}">${pavHTML(p)}<div class="x" data-def="${esc(p.id)}" role="button" tabindex="0" title="기본 페르소나로 설정"><b>${esc(p.name)}${p.def ? ' <span class="chk">✓</span>' : ""}</b><span>${esc(p.memo || p.desc || "설명 없음")}</span></div><button class="btn sm ghost" data-pedit="${esc(p.id)}">수정</button></div>`).join("")}</div>
      ${S.personas.length < 8 ? `<button class="btn block" id="padd" style="margin-top:8px">+ 페르소나 추가</button>` : ""}
    </div>
    <h2 class="sec">크리에이터 프로필</h2>
    <div class="box"><div class="field" style="margin:0"><label for="nick">크리에이터 이름 (커뮤니티 공개 캐릭터에 표시)</label><input id="nick" maxlength="20" value="${esc(S.profile.nick)}" placeholder="예: 새벽작가"></div>
      <button class="btn sm" id="nickSave" style="margin-top:10px">저장</button></div>
    <h2 class="sec">관심있는 대화 <small>홈에 보일 작품</small></h2>
    <div class="box">${audSegHTML()}<p class="note" style="margin:8px 0 0">남성향은 여성 캐릭터, 여성향은 남성 캐릭터와의 대화만 보여요. 내가 만든 작품은 늘 보여요.</p></div>
    <h2 class="sec">채팅 설정 <small>바꾸면 바로 적용돼요</small></h2>
    <div class="box">
      <div class="bubble chat-pv" aria-hidden="true"><p class="narr">창밖으로 첫눈이 내리기 시작했다.</p><p><b class="spk">서윤</b><span class="dlg">"오늘은 여기까지 할까요?"</span></p></div>
      <div class="field"><label for="cfs" style="display:flex">글자 크기<span class="spacer"></span><output id="cfsV">${S.settings.fs}px</output></label><input type="range" id="cfs" min="13" max="21" step="0.5" value="${S.settings.fs}"></div>
      <div class="two">
        <div class="field"><span class="lbl">줄 간격</span><div class="seg" data-set="chatLh">${[[1.6, "좁게"], [1.8, "보통"], [2.1, "넓게"]].map(([n, l]) => `<button type="button" data-v="${n}" class="${S.settings.chatLh == n ? "on" : ""}">${l}</button>`).join("")}</div></div>
        <div class="field"><span class="lbl">지문 글꼴</span><div class="seg" data-set="narrFont">${[["serif", "명조"], ["sans", "고딕"]].map(([k, l]) => `<button type="button" data-v="${k}" class="${S.settings.narrFont === k ? "on" : ""}">${l}</button>`).join("")}</div></div>
      </div>
      <div class="toggle" style="margin-top:14px"><label for="cEnter">Enter로 보내기 <span class="note">끄면 Ctrl+Enter로 보내요</span></label><input type="checkbox" id="cEnter" ${S.settings.enterSend !== false ? "checked" : ""}></div>
      <div class="toggle" style="margin-top:8px"><label for="cImg">대화 속 장면 이미지 보기</label><input type="checkbox" id="cImg" ${S.settings.sceneImg !== false ? "checked" : ""}></div>
    </div>
    <h2 class="sec">AI 연결 <small>지금: ${esc(engineName())}</small></h2>
    <div class="box">
      <div class="field" style="margin-top:0"><label for="key">Anthropic API 키 <span class="note">파일로 열었을 때만 필요</span></label><input id="key" type="password" autocomplete="off" placeholder="sk-ant-..." value="${esc(S.settings.apiKey)}"></div>
      ${IN_CLAUDE ? `<div class="setcard" style="margin-top:14px"><h4>성인 인증 · 수위</h4><p class="d" style="margin:0">파일로 열었을 때만 설정할 수 있어요.</p></div>`
        : `<div class="setcard" style="margin-top:14px"><h4>성인 인증 · 수위</h4>
        <div class="toggle"><label for="ageChk">만 19세 이상이에요 (자기 확인)</label><input type="checkbox" id="ageChk" ${S.settings.isAgeVerified ? "checked" : ""}></div>
        <div class="toggle"><label for="unfilterChk">모든 대화방 수위 제한 해제</label><input type="checkbox" id="unfilterChk" ${!S.settings.contentFilter ? "checked" : ""}></div>
        <div class="toggle"><label for="fallbackChk">Claude가 거절하면 OpenRouter로 이어 쓰기</label><input type="checkbox" id="fallbackChk" ${S.settings.autoFallback ? "checked" : ""}></div>
        <p class="d" style="margin:0">OpenRouter 키가 있어야 동작해요. 미성년 인물·암시는 항상 막아요. 이 체크는 본인인증이 아니에요.</p>
        <p class="d" style="margin:6px 0 0">AI 그림은 전체이용가로 만들어요. 이미지 슬롯에서 세미·성인 수위로 직접 만든 칸만 그 칸의 수위로 자동으로 만들어요.</p></div>`}
      ${IN_CLAUDE ? "" : `<div class="two">
        <div class="field"><label for="orkey">OpenRouter API 키 <span class="note">성인 모드용</span></label><input id="orkey" type="password" autocomplete="off" placeholder="sk-or-..." value="${esc(S.settings.openRouterKey || "")}"></div>
        <div class="field"><label for="ormodel">무검열 모델</label><select id="ormodel">${(() => { const cur = String(S.settings.customUnfilteredModel || "").trim(), pre = OR_PRESETS.some((m) => m[0] === cur);
          return [["", "등급별 자동 (Rocinante · Hermes 3 · DeepSeek V3)"], ...OR_PRESETS, ["custom", "직접 입력"]].map(([k, l]) => `<option value="${esc(k)}" ${(k === "custom" ? cur && !pre : k === cur) ? "selected" : ""}>${esc(l)}</option>`).join(""); })()}</select></div>
      </div>
      <div class="field" id="ormodelBox" ${String(S.settings.customUnfilteredModel || "").trim() && !OR_PRESETS.some((m) => m[0] === S.settings.customUnfilteredModel.trim()) ? "" : "hidden"}><label for="ormodelTxt">OpenRouter 모델 ID</label><input id="ormodelTxt" maxlength="120" autocomplete="off" placeholder="예: deepseek/deepseek-chat-v3-0324" value="${esc(S.settings.customUnfilteredModel || "")}"></div>`}
    </div>
    <h2 class="sec">이미지 생성 <small>Runware</small></h2>
    <div class="box">
      <div class="field" style="margin-top:0"><label for="rkey">Runware API 키 <span class="note">runware.ai에서 발급</span></label><input id="rkey" type="password" autocomplete="off" placeholder="Runware API 키" value="${esc(S.settings.runwareKey || "")}"></div>
      <div class="toggle" style="margin:0 0 12px"><label for="autoImg">대화 중 장면 그림 자동 생성 <span class="note">${IN_CLAUDE ? "파일·웹으로 열었을 때만 돼요" : "AI가 고른 감정·의상·장소 조합의 그림이 없으면 Runware로 만들어 저장해요(장당 약 $0.0025, 같은 조합은 다시 만들지 않음)"}</span></label><input type="checkbox" id="autoImg" ${S.settings.autoImg ? "checked" : ""} ${IN_CLAUDE ? "disabled" : ""}></div>
      <div class="field"><label for="gstyle">그림체</label><select id="gstyle">${styleOptionsHTML()}</select><p class="note" id="gstyleDesc" style="margin:2px 0 0"></p></div>
      <div class="field" id="gmodelBox"><label for="gmodel">이미지 모델</label><select id="gmodel">${[...IMG_MODELS, ...(IMG_MODELS.some((m) => m.id === S.settings.imgModel) ? [] : [{ id: S.settings.imgModel, name: S.settings.imgModel }])].map((m) => `<option value="${esc(m.id)}">${esc(m.name)}</option>`).join("")}</select></div>
      <div class="field" id="gstyleBox"><label for="gstyleTxt">그림체 문구 <span class="note" id="gstyleTxtNote">한국어로 써도 돼요</span></label><textarea id="gstyleTxt" maxlength="600" style="min-height:76px" placeholder="예: 한국 웹툰 그림체, 깔끔한 선화, 부드러운 피부 음영"></textarea></div>
      <div class="field"><span class="lbl">기본 화풍 <span class="note">참고 그림에서 뽑아 내장한 그림체. 같은 이름(프롬1_남성향_일상 …)의 ZIP 세트를 올리면 그 세트가 덮고, 지우면 다시 내장으로 돌아와요</span></span>
        <div class="ssets" id="bsets"></div></div>
      <div class="field"><span class="lbl">그림체 세트</span>
        <div class="ssets" id="ssets"></div><input type="file" id="ssetFile" accept="image/png,image/jpeg,image/webp,.zip,application/zip" multiple hidden>
        <div class="cta-row" style="margin-top:6px"><button class="btn sm" id="ssetAdd" type="button">+ 세트 가져오기 (그림 또는 ZIP)</button></div>
        <p class="note" style="margin:4px 0 0">이름 앞부분이 같은 그림끼리 3장씩 묶어요. Anthropic 키가 있으면 그림체 태그를 자동으로 써요.</p></div>
      <div class="cta-row" style="margin-top:10px"><button class="btn sm" id="gtest">연결 테스트</button><span class="note" id="gtestMsg">테스트 그림 1장을 만들어 봐요.</span></div>
    </div>
    <div class="cta-row" style="margin-top:14px"><button class="btn pri" id="setSave">설정 저장</button><span class="spacer"></span><button class="btn sm danger" id="reset">모든 데이터 초기화</button></div>
    <p class="note">키와 데이터는 ${KV.dbOk ? "내 claude.ai 계정" : "이 브라우저"}에만 저장돼요 · 이미지: ${IMG.assets ? "아티팩트 저장소" : "압축 후 내 저장 공간"}</p>
  </div>`;
  bindGo(v); IMG.hydrate(v);
  $("#nickSave").onclick = () => { S.profile.nick = $("#nick").value.trim(); KV.set("profile", S.profile); publishCommunity(); toast("저장했어요"); };
  $$("[data-def]", v).forEach((b) => b.onclick = () => { S.personas.forEach((p) => p.def = p.id === b.dataset.def); KV.set("personas", S.personas); viewMe(); });
  $$("[data-pedit]", v).forEach((b) => b.onclick = () => personaSheet(S.personas.find((p) => p.id === b.dataset.pedit), viewMe));
  const pa = $("#padd"); if (pa) pa.onclick = () => personaSheet(null, viewMe);
  const gs = $("#gstyle"), gt = $("#gstyleTxt"), gm = $("#gmodel");
  const findSet = (k) => (S.settings.styleSets || []).find((s) => "set:" + s.id === k);
  // 고른 그림체에 맞춰 설명·모델·문구 칸을 보여 줌(프리셋은 모델·문구 고정, 세트·직접 입력은 고칠 수 있음)
  // 자동·내장·프리셋은 모델·문구 고정(내장 문구는 읽기만), 세트·직접 입력은 고칠 수 있음
  gs.onchange = () => {
    const k = gs.value, set = findSet(k), sys = k.startsWith("sys:") ? effectiveSet(k.slice(4)) : null, p = set || sys || k === "auto" ? null : IMG_STYLES[k];
    $("#gstyleDesc").textContent = k === "auto" ? "작품 성향(남성향·여성향, 전체면 인물 성별)에 맞춰 내장 기본 화풍을 자동으로 골라요. 표지·세계관 일러스트는 표지 화풍으로 그려요."
      : sys ? `${sys.desc} · 모델: ${imgModelInfo(sys.model).name}${sys.over ? ` · 지금은 내 세트 '${sys.over.name}'이 덮고 있어요` : ""}`
      : set ? "올린 그림에서 읽은 그림체예요. 문구와 모델을 고칠 수 있어요." : p.desc + (p.model ? ` · 모델: ${imgModelInfo(p.model).name}` : "");
    $("#gmodelBox").hidden = k === "auto" || !!sys || !!p?.model; $("#gstyleBox").hidden = k === "auto" || !!p?.model;
    gt.readOnly = !!sys; $("#gstyleTxtNote").textContent = sys ? "내장 문구(읽기만) — 바꾸려면 같은 이름의 세트로 덮어쓰거나 직접 입력을 골라요" : "한국어로 써도 돼요";
    gm.value = (set ? set.model : sys ? sys.model : p?.model) || S.settings.imgModel;
    gt.value = set ? set.prompt || "" : sys ? sys.prompt : k === "custom" ? S.settings.imgStyleCustom || "" : "";
  };
  gt.oninput = () => { const set = findSet(gs.value); if (set) { set.prompt = gt.value; saveSettings(); paintSets(); } };
  gm.onchange = () => { const set = findSet(gs.value); if (set) { set.model = gm.value; saveSettings(); paintSets(); } };
  const saveStyle = () => { S.settings.imgStyle = gs.value; if (gs.value === "custom") { S.settings.imgStyleCustom = gt.value.trim(); S.settings.imgModel = gm.value; } };
  const refreshStyle = () => { if (!gs.isConnected) return; gs.innerHTML = styleOptionsHTML(); gs.value = S.settings.imgStyle; gs.onchange(); paintSets(); };
  gs.onchange();
  const paintSets = () => {
    const box = $("#ssets"); if (!box) return;
    const sets = S.settings.styleSets || [], bb = $("#bsets");
    // 내장 기본 화풍 카드: 견본(styles/<id>-n.jpg, 없으면 칸 숨김)·설명·덮어쓴 세트
    bb.innerHTML = BUILTIN_SETS.map((b) => { const o = overridingSet(b.id), on = S.settings.imgStyle === "sys:" + b.id; return `<div class="sset bset ${on ? "on" : ""}" data-bset="${b.id}">
      ${b.samples ? `<div class="th">${[1, 2, 3].slice(0, b.samples).map((n) => `<span><img src="styles/${b.id}-${n}.jpg" alt="" loading="lazy"></span>`).join("")}</div>` : ""}
      <b>${esc(b.name)}${on ? ' <span class="pill">사용 중</span>' : ""}${o ? ` <span class="pill">내 세트 '${esc(o.name)}'로 덮음</span>` : ""}</b>
      <p class="note">${esc(b.desc)}</p>
      <div class="cta-row" style="margin:0"><button class="btn sm ${on ? "" : "pri"}" data-buse="${b.id}" ${on ? "disabled" : ""}>이 화풍으로</button>${o ? `<button class="btn sm ghost" data-bres="${b.id}">내장으로 되돌리기</button>` : ""}</div></div>`; }).join("");
    $$(".bset img", bb).forEach((im) => { im.onerror = () => { im.parentElement.hidden = true; }; });
    $$("[data-buse]", bb).forEach((b) => b.onclick = () => { S.settings.imgStyle = "sys:" + b.dataset.buse; saveSettings(); refreshStyle(); toast("이 기본 화풍으로 만들도록 바꿨어요"); });
    $$("[data-bres]", bb).forEach((b) => b.onclick = () => { const o = overridingSet(b.dataset.bres); if (!o) return; delete o.overrides; saveSettings(); refreshStyle(); toast("내장 화풍으로 돌아왔어요. 세트는 그대로 남아 있어요"); });
    box.innerHTML = sets.length ? sets.map((s) => { const on = S.settings.imgStyle === "set:" + s.id; return `<div class="sset ${on ? "on" : ""}">
      <div class="th">${(s.refs || []).filter(validRef).map((r) => `<span>${IMG.tag(r)}</span>`).join("")}</div>
      <b>${esc(s.name)}${on ? ' <span class="pill">사용 중</span>' : ""}</b>
      <p class="note">${esc(s.prompt || "아직 그림체 문구가 없어요. '문구 뽑기'를 눌러 주세요.")}<br>모델: ${esc(imgModelInfo(s.model || IMG_MODELS[0].id).name)}</p>
      <label class="over">덮어쓸 기본 화풍 <select data-sover="${esc(s.id)}">${[["", "없음"], ...BUILTIN_SETS.map((b) => [b.id, b.name])].map(([v, l]) => `<option value="${esc(v)}" ${(s.overrides || "") === v ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>
      <div class="cta-row" style="margin:0"><button class="btn sm ${on ? "" : "pri"}" data-suse="${esc(s.id)}" ${on ? "disabled" : ""}>사용</button><button class="btn sm" data-sgen="${esc(s.id)}">문구 뽑기</button><button class="btn sm ghost" data-sdel="${esc(s.id)}">삭제</button></div></div>`; }).join("") : `<p class="note">아직 세트가 없어요.</p>`;
    IMG.hydrate(box);
    $$("[data-suse]", box).forEach((b) => b.onclick = () => { S.settings.imgStyle = "set:" + b.dataset.suse; saveSettings(); refreshStyle(); toast("이 세트의 그림체로 만들도록 바꿨어요"); });
    $$("[data-sgen]", box).forEach((b) => b.onclick = () => readSets([b.dataset.sgen]));
    // 세트가 내장 기본 화풍을 덮게 하기(한 화풍은 세트 하나만 덮음). '없음'이면 내장으로
    $$("[data-sover]", box).forEach((sel) => sel.onchange = () => {
      const s = findSet("set:" + sel.dataset.sover); if (!s) return;
      sets.forEach((x) => { if (x !== s && x.overrides === sel.value) delete x.overrides; });
      if (sel.value) s.overrides = sel.value; else delete s.overrides;
      saveSettings(); refreshStyle(); toast(sel.value ? "이 세트가 그 기본 화풍을 덮어요" : "덮어쓰기를 풀었어요. 내장 화풍으로 돌아와요");
    });
    $$("[data-sdel]", box).forEach((b) => b.onclick = () => {
      const s = findSet("set:" + b.dataset.sdel); if (!s) return;
      const over = !!s.overrides;
      (s.refs || []).forEach((r) => IMG.drop(r)); S.settings.styleSets = S.settings.styleSets.filter((x) => x !== s);
      if (S.settings.imgStyle === "set:" + s.id) S.settings.imgStyle = "auto";
      saveSettings(); refreshStyle(); toast(over ? "세트를 지웠어요. 기본 화풍은 내장으로 돌아왔어요" : "세트를 지웠어요");
    });
  };
  const readSets = async (ids) => {
    if (!S.settings.apiKey) { const k = $("#key")?.value.trim(); if (k) { S.settings.apiKey = k; saveSettings(); } }
    if (!hasClaudeKey()) { toast("Anthropic API 키를 넣으면 Claude가 세트 그림을 읽어 그림체 태그를 자동으로 써요."); return; }
    let ok = 0, err = null;
    for (const [i, id] of ids.entries()) {
      const s = findSet("set:" + id); if (!s) continue;
      toast(`그림체를 읽는 중… ${i + 1}/${ids.length} · ${s.name}`);
      try { s.prompt = await claudeStyleTags(s.refs || []); ok++; saveSettings(); refreshStyle(); }
      catch (e) { err = e; if (["no_claude", "bad_claude", "network", "rate_limited"].includes(e?.code)) break; }
    }
    toast(err && !ok ? genErr(err) : `세트 ${ok}개의 그림체 문구를 썼어요${err ? " · " + genErr(err) : ""}`);
  };
  $("#ssetAdd").onclick = () => $("#ssetFile").click();
  $("#ssetFile").onchange = async (e) => {
    const picked = [...e.target.files]; e.target.value = "";
    if (!picked.length) return; toast("그림을 읽는 중…");
    let made = [];
    try {
      let files = [];
      for (const f of picked) files.push(...(/\.zip$/i.test(f.name) || /zip/.test(f.type) ? await unzipImages(f) : [f]));
      files = files.filter((f) => /\.(png|jpe?g|webp)$/i.test(f.name) || /^image\//.test(f.type));
      if (!files.length) { toast("그림 파일을 찾지 못했어요. PNG·JPG·WEBP 또는 그 그림이 든 ZIP을 골라 주세요."); return; }
      for (const g of groupStyleFiles(files).slice(0, 12)) {
        const refs = []; for (const f of g.files) refs.push(await IMG.put(f));
        // 이름이 내장 기본 화풍과 맞으면(프롬1_남성향_일상 …) 그 화풍을 덮음 — 같은 화풍을 덮던 예전 세트는 덮기를 풂
        const ov = matchBuiltin(g.name); if (ov) (S.settings.styleSets || []).forEach((x) => { if (x.overrides === ov) delete x.overrides; });
        made.push({ id: uid("ss"), name: g.name, refs, prompt: guessStylePrompt(g.name), model: guessStyleModel(g.name), ...(ov ? { overrides: ov } : {}) });
      }
      S.settings.styleSets = [...(S.settings.styleSets || []), ...made];
      const cur = String(S.settings.imgStyle || "auto");
      if (!made.some((s) => s.overrides) && !activeSet() && cur !== "auto" && !cur.startsWith("sys:")) S.settings.imgStyle = "set:" + made[0].id;
      saveSettings(); refreshStyle();
      const overs = made.filter((s) => s.overrides).map((s) => s.name);
      toast(`세트 ${made.length}개를 만들었어요 (${made.map((s) => s.name).join(", ")})${overs.length ? ` · 기본 화풍을 덮어요: ${overs.join(", ")}` : ""}`);
    } catch (err) { toast(err?.code === "nozip" ? "이 브라우저는 ZIP을 바로 열 수 없어요. 압축을 풀어 그림 파일들을 골라 주세요." : "파일을 읽지 못했어요. PNG·JPG·ZIP인지 확인해 주세요."); return; }
    if (hasClaudeKey() || $("#key")?.value.trim()) await readSets(made.map((s) => s.id));
  };
  paintSets();
  // 채팅 설정: 바꾸는 즉시 저장·반영
  const chatSet = (k, val) => { S.settings[k] = val; saveSettings(); applySettings(); };
  $("#cfs").oninput = (e) => { chatSet("fs", +e.target.value); $("#cfsV").textContent = e.target.value + "px"; };
  $$("[data-set] button", v).forEach((b) => b.onclick = () => {
    const k = b.parentElement.dataset.set; chatSet(k, k === "chatLh" ? +b.dataset.v : b.dataset.v);
    $$("button", b.parentElement).forEach((x) => x.classList.toggle("on", x === b));
  });
  $("#cEnter").onchange = (e) => chatSet("enterSend", e.target.checked);
  $("#cImg").onchange = (e) => chatSet("sceneImg", e.target.checked);
  $("#autoImg").onchange = (e) => { S.settings.autoImg = e.target.checked; saveSettings(); if (e.target.checked && !S.settings.runwareKey && !$("#rkey").value.trim()) toast("Runware API 키를 넣고 설정 저장을 눌러야 그림이 만들어져요"); };
  bindAccount(v);
  $$("[data-aud]", v).forEach((x) => x.onclick = () => { setAudience(x.dataset.aud); $$("[data-aud]", v).forEach((y) => y.classList.toggle("on", y === x)); toast(`${AUDS[audience()].name} 작품을 보여 드릴게요`); });
  // 성인 인증을 체크해야 수위 해제 옵션을 고를 수 있음
  const age = $("#ageChk");
  if (age) { const sync = () => ["#unfilterChk", "#fallbackChk"].forEach((s) => $(s).disabled = !age.checked); age.onchange = sync; sync(); }
  const orm = $("#ormodel");
  if (orm) orm.onchange = () => { $("#ormodelBox").hidden = orm.value !== "custom"; if (orm.value === "custom") $("#ormodelTxt").focus(); };
  $("#setSave").onclick = () => {
    S.settings.apiKey = $("#key").value.trim();
    S.settings.runwareKey = $("#rkey").value.trim(); saveStyle();
    if (age) {
      S.settings.isAgeVerified = age.checked; S.settings.contentFilter = !$("#unfilterChk").checked; S.settings.autoFallback = $("#fallbackChk").checked;
      S.settings.openRouterKey = $("#orkey").value.trim();
      S.settings.customUnfilteredModel = orm.value === "custom" ? $("#ormodelTxt").value.trim() : orm.value;
    }
    const warn = cleanKeys();
    saveSettings(); applySettings(); if (S.engine === "none" && S.settings.apiKey) S.engine = "byok"; viewMe();
    toast(warn.length ? "저장했어요. 키를 확인해 주세요: " + warn.join(" · ") : "설정을 저장했어요");
  };
  $("#gtest").onclick = () => {
    S.settings.runwareKey = $("#rkey").value.trim(); saveStyle(); saveSettings();
    genImageSheet({ title: "Runware 연결 테스트", aspect: "1:1", prompt: "1girl, solo, adult, sitting by the window, holding coffee cup, cat, warm afternoon sunlight, cozy room", ctx: { kind: "daily", aud: "m" },
      onUse: async () => toast("테스트 이미지는 저장하지 않아요. Runware 연결이 잘 돼요!") });
  };
  $("#reset").onclick = () => confirmSheet("모든 데이터를 지울까요?", "대화방, 만든 캐릭터, 하트, 페르소나, 이미지 연결이 모두 지워져요." + (CLOUD.on ? " 로그인되어 있어서 계정에 저장된 데이터도 지워져요." : "") + " 되돌릴 수 없어요.", "전부 삭제", () => {
    S.rooms.forEach((r) => KV.set(roomKey(r.id), undefined));
    ["rooms", "mine", "wallet", "personas", "profile", "imgpacks", "coverpacks", "lorepacks", "tagpacks", "ponytags"].forEach((k) => KV.set(k, undefined));
    IDB.clear(); try { Object.keys(localStorage).filter((k) => /^hv1_img[a-z0-9]{10,30}$/.test(k)).forEach((k) => localStorage.removeItem(k)); } catch {}
    S.mine = []; publishCommunity();
    (CLOUD.on ? CLOUD.wipe().catch(() => {}) : Promise.resolve()).then(() => setTimeout(() => location.reload(), 400));
  });
}
export function personaSheet(p, after) {
  let img = p?.img || "";
  const ov = sheet(`<div class="sheet-head"><h2>${p ? "페르소나 수정" : "새 페르소나"}</h2><button class="icon-btn" data-x aria-label="닫기">${ICON.close}</button></div>
    <div class="avatar-pick" style="margin:8px 0 4px"><div id="avBox">${pavHTML({ name: p?.name || "?", img })}</div><div><input type="file" id="av" accept="image/png,image/jpeg,image/webp" hidden><button class="btn sm" id="avBtn">이미지 올리기</button> <button class="btn sm" id="avAi">AI로 만들기</button> <button class="btn sm ghost" id="avDel" ${img ? "" : "hidden"}>빼기</button><p class="note" style="margin:6px 0 0">대화에서 내 말풍선 옆에 보여요.</p></div></div>
    <div class="field"><label for="pn">이름</label><input id="pn" maxlength="20" value="${esc(p?.name || "")}"></div>
    <div class="field"><label for="pm">메모 (목록에 보이는 한 줄, 예: 관능미 · 츤데레)</label><input id="pm" maxlength="30" value="${esc(p?.memo || "")}"></div>
    <div class="field"><label for="pd">상세 정보 (AI가 보고 나를 대해요)</label><textarea id="pd" maxlength="800" style="min-height:130px" placeholder="예: 27세 남자. 긴 장발의 리프컷, 진한 흑발. 나른하고 귀찮은 말투, 맑은 저음.">${esc(p?.desc || "")}</textarea></div>
    <div class="toggle" style="margin-top:12px"><label for="pdef">기본 페르소나로 쓰기</label><input type="checkbox" id="pdef" ${p?.def ? "checked" : ""}></div>
    <div class="cta-row">${p && S.personas.length > 1 ? `<button class="btn danger" id="pdel">삭제</button>` : ""}<span class="spacer"></span><button class="btn ghost" data-x>취소</button><button class="btn pri" id="psave">저장</button></div>`);
  IMG.hydrate(ov);
  $("#avBtn", ov).onclick = () => $("#av", ov).click();
  $("#av", ov).onchange = async (e) => { const f = e.target.files[0]; if (!f) return; try { img = await IMG.put(f); $("#avBox", ov).innerHTML = pavHTML({ name: $("#pn", ov).value || "?", img }); IMG.hydrate(ov); $("#avDel", ov).hidden = false; } catch { toast("이미지를 읽지 못했어요."); } };
  $("#avAi", ov).onclick = () => genImageSheet({ title: "AI로 페르소나 이미지 만들기", aspect: "1:1", ctx: { kind: "daily", male: lookIsMale($("#pd", ov).value) },
    prompt: ["solo, adult, portrait, upper body, looking at viewer", $("#pd", ov).value.trim() || $("#pn", ov).value.trim(), "simple background"].filter(Boolean).join(", "),
    onUse: async (blob) => { img = await IMG.put(blob); $("#avBox", ov).innerHTML = pavHTML({ name: $("#pn", ov).value || "?", img }); IMG.hydrate(ov); $("#avDel", ov).hidden = false; } });
  $("#avDel", ov).onclick = () => { img = ""; $("#avBox", ov).innerHTML = pavHTML({ name: $("#pn", ov).value || "?", img: "" }); $("#avDel", ov).hidden = true; };
  $("#psave", ov).onclick = () => {
    const name = $("#pn", ov).value.trim(); if (!name) { $("#pn", ov).focus(); return; }
    const item = p || { id: uid("p") }; Object.assign(item, { name, memo: $("#pm", ov).value.trim(), desc: $("#pd", ov).value.trim(), img });
    if ($("#pdef", ov).checked) S.personas.forEach((x) => x.def = false);
    item.def = $("#pdef", ov).checked || (!!p && p.def);
    if (!p) S.personas.push(item);
    if (!S.personas.some((x) => x.def)) S.personas[0].def = true;
    KV.set("personas", S.personas);
    if (room && room.persona.id === item.id) { room.persona = { id: item.id, name: item.name, memo: item.memo, desc: item.desc, img: item.img }; saveRoom(room); renderLog(); }
    ov.remove(); after && after();
  };
  const del = $("#pdel", ov); if (del) del.onclick = () => { S.personas = S.personas.filter((x) => x !== p); if (!S.personas.some((x) => x.def)) S.personas[0].def = true; KV.set("personas", S.personas); ov.remove(); after && after(); };
}
