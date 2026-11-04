/* MY → 이미지 생성 설정(관리자 빌드만): Runware API 키, 대화 중 장면 그림 자동 생성, 그림체(자동·내장 기본 화풍·프리셋·세트·직접 입력)와 이미지 모델,
   그림체 세트 가져오기(그림 또는 ZIP → 이름 앞부분별 3장 묶음 → Anthropic 키가 있으면 Claude가 그림체 문구 작성), 연결 테스트.
   ui/me.js의 #meExt 자리에 EXT.me로 끼워 넣고, '설정 저장'(EXT.meSave)에서 키·그림체를 S.settings에 쓴다(saveSettings는 me.js가 이어서 부름).
   사용자 사이트에는 이 칸이 없다 — 그림은 관리자가 만들어 content/에 싣는다(2026-11 결정). 그림체 관련 설정 이전은 admin/migrate.js */
import { IN_CLAUDE } from "../core/config.js";
import { saveSettings } from "../core/settings.js";
import { S, hasClaudeKey } from "../core/state.js";
import { $, $$, esc, toast, uid } from "../core/util.js";
import { genErr } from "../images/runware.js";
import { BUILTIN_SETS, IMG_MODELS, IMG_STYLES, activeSet, claudeStyleTags, effectiveSet, groupStyleFiles, guessStyleModel, guessStylePrompt, imgModelInfo, matchBuiltin, overridingSet, styleOptionsHTML, unzipImages } from "../images/styles.js";
import { IMG, validRef } from "../services/images.js";
import { EXT } from "../ui/ext.js";
import { genImageSheet } from "./gen-sheet.js";

let saveStyle = () => {}; // 지금 화면의 그림체 선택을 S.settings에 쓰는 함수 — 칸을 그릴 때 바꿈
EXT.me.push((v) => {
  const box = $("#meExt", v); if (!box) return;
  box.insertAdjacentHTML("beforeend", `<h2 class="sec">이미지 생성 <small>Runware · 관리자 도구</small></h2>
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
      <p class="note" style="margin:0 0 10px">AI 그림은 전체이용가로 만들어요. 이미지 슬롯에서 세미·성인 수위로 직접 만든 칸만 그 칸의 수위로 만들어요.</p>
      <div class="cta-row" style="margin-top:10px"><button class="btn sm" id="gtest">연결 테스트</button><span class="note" id="gtestMsg">테스트 그림 1장을 만들어 봐요.</span></div>
    </div>`);
  const gs = $("#gstyle", box), gt = $("#gstyleTxt", box), gm = $("#gmodel", box);
  const findSet = (k) => (S.settings.styleSets || []).find((s) => "set:" + s.id === k);
  // 고른 그림체에 맞춰 설명·모델·문구 칸을 보여 줌: 자동·내장·프리셋은 모델·문구 고정(내장 문구는 읽기만), 세트·직접 입력은 고칠 수 있음
  gs.onchange = () => {
    const k = gs.value, set = findSet(k), sys = k.startsWith("sys:") ? effectiveSet(k.slice(4)) : null, p = set || sys || k === "auto" ? null : IMG_STYLES[k];
    $("#gstyleDesc", box).textContent = k === "auto" ? "작품 성향(남성향·여성향, 전체면 인물 성별)에 맞춰 내장 기본 화풍을 자동으로 골라요. 표지·세계관 일러스트는 표지 화풍으로 그려요."
      : sys ? `${sys.desc} · 모델: ${imgModelInfo(sys.model).name}${sys.over ? ` · 지금은 내 세트 '${sys.over.name}'이 덮고 있어요` : ""}`
      : set ? "올린 그림에서 읽은 그림체예요. 문구와 모델을 고칠 수 있어요." : p.desc + (p.model ? ` · 모델: ${imgModelInfo(p.model).name}` : "");
    $("#gmodelBox", box).hidden = k === "auto" || !!sys || !!p?.model; $("#gstyleBox", box).hidden = k === "auto" || !!p?.model;
    gt.readOnly = !!sys; $("#gstyleTxtNote", box).textContent = sys ? "내장 문구(읽기만) — 바꾸려면 같은 이름의 세트로 덮어쓰거나 직접 입력을 골라요" : "한국어로 써도 돼요";
    gm.value = (set ? set.model : sys ? sys.model : p?.model) || S.settings.imgModel;
    gt.value = set ? set.prompt || "" : sys ? sys.prompt : k === "custom" ? S.settings.imgStyleCustom || "" : "";
  };
  gt.oninput = () => { const set = findSet(gs.value); if (set) { set.prompt = gt.value; saveSettings(); paintSets(); } };
  gm.onchange = () => { const set = findSet(gs.value); if (set) { set.model = gm.value; saveSettings(); paintSets(); } };
  saveStyle = () => { if (!gs.isConnected) return; S.settings.imgStyle = gs.value; if (gs.value === "custom") { S.settings.imgStyleCustom = gt.value.trim(); S.settings.imgModel = gm.value; } };
  const refreshStyle = () => { if (!gs.isConnected) return; gs.innerHTML = styleOptionsHTML(); gs.value = S.settings.imgStyle; gs.onchange(); paintSets(); };
  gs.onchange();
  const paintSets = () => {
    const sb = $("#ssets", box); if (!sb) return;
    const sets = S.settings.styleSets || [], bb = $("#bsets", box);
    // 내장 기본 화풍 카드: 견본(styles/<id>-n.jpg, 없으면 칸 숨김)·설명·덮어쓴 세트
    bb.innerHTML = BUILTIN_SETS.map((b) => { const o = overridingSet(b.id), on = S.settings.imgStyle === "sys:" + b.id; return `<div class="sset bset ${on ? "on" : ""}" data-bset="${b.id}">
      ${b.samples ? `<div class="th">${[1, 2, 3].slice(0, b.samples).map((n) => `<span><img src="styles/${b.id}-${n}.jpg" alt="" loading="lazy"></span>`).join("")}</div>` : ""}
      <b>${esc(b.name)}${on ? ' <span class="pill">사용 중</span>' : ""}${o ? ` <span class="pill">내 세트 '${esc(o.name)}'로 덮음</span>` : ""}</b>
      <p class="note">${esc(b.desc)}</p>
      <div class="cta-row" style="margin:0"><button class="btn sm ${on ? "" : "pri"}" data-buse="${b.id}" ${on ? "disabled" : ""}>이 화풍으로</button>${o ? `<button class="btn sm ghost" data-bres="${b.id}">내장으로 되돌리기</button>` : ""}</div></div>`; }).join("");
    $$(".bset img", bb).forEach((im) => { im.onerror = () => { im.parentElement.hidden = true; }; });
    $$("[data-buse]", bb).forEach((b) => b.onclick = () => { S.settings.imgStyle = "sys:" + b.dataset.buse; saveSettings(); refreshStyle(); toast("이 기본 화풍으로 만들도록 바꿨어요"); });
    $$("[data-bres]", bb).forEach((b) => b.onclick = () => { const o = overridingSet(b.dataset.bres); if (!o) return; delete o.overrides; saveSettings(); refreshStyle(); toast("내장 화풍으로 돌아왔어요. 세트는 그대로 남아 있어요"); });
    sb.innerHTML = sets.length ? sets.map((s) => { const on = S.settings.imgStyle === "set:" + s.id; return `<div class="sset ${on ? "on" : ""}">
      <div class="th">${(s.refs || []).filter(validRef).map((r) => `<span>${IMG.tag(r)}</span>`).join("")}</div>
      <b>${esc(s.name)}${on ? ' <span class="pill">사용 중</span>' : ""}</b>
      <p class="note">${esc(s.prompt || "아직 그림체 문구가 없어요. '문구 뽑기'를 눌러 주세요.")}<br>모델: ${esc(imgModelInfo(s.model || IMG_MODELS[0].id).name)}</p>
      <label class="over">덮어쓸 기본 화풍 <select data-sover="${esc(s.id)}">${[["", "없음"], ...BUILTIN_SETS.map((b) => [b.id, b.name])].map(([val, l]) => `<option value="${esc(val)}" ${(s.overrides || "") === val ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>
      <div class="cta-row" style="margin:0"><button class="btn sm ${on ? "" : "pri"}" data-suse="${esc(s.id)}" ${on ? "disabled" : ""}>사용</button><button class="btn sm" data-sgen="${esc(s.id)}">문구 뽑기</button><button class="btn sm ghost" data-sdel="${esc(s.id)}">삭제</button></div></div>`; }).join("") : `<p class="note">아직 세트가 없어요.</p>`;
    IMG.hydrate(sb);
    $$("[data-suse]", sb).forEach((b) => b.onclick = () => { S.settings.imgStyle = "set:" + b.dataset.suse; saveSettings(); refreshStyle(); toast("이 세트의 그림체로 만들도록 바꿨어요"); });
    $$("[data-sgen]", sb).forEach((b) => b.onclick = () => readSets([b.dataset.sgen]));
    // 세트가 내장 기본 화풍을 덮게 하기(한 화풍은 세트 하나만 덮음). '없음'이면 내장으로
    $$("[data-sover]", sb).forEach((sel) => sel.onchange = () => {
      const s = findSet("set:" + sel.dataset.sover); if (!s) return;
      sets.forEach((x) => { if (x !== s && x.overrides === sel.value) delete x.overrides; });
      if (sel.value) s.overrides = sel.value; else delete s.overrides;
      saveSettings(); refreshStyle(); toast(sel.value ? "이 세트가 그 기본 화풍을 덮어요" : "덮어쓰기를 풀었어요. 내장 화풍으로 돌아와요");
    });
    $$("[data-sdel]", sb).forEach((b) => b.onclick = () => {
      const s = findSet("set:" + b.dataset.sdel); if (!s) return;
      const over = !!s.overrides;
      (s.refs || []).forEach((r) => IMG.drop(r)); S.settings.styleSets = S.settings.styleSets.filter((x) => x !== s);
      if (S.settings.imgStyle === "set:" + s.id) S.settings.imgStyle = "auto";
      saveSettings(); refreshStyle(); toast(over ? "세트를 지웠어요. 기본 화풍은 내장으로 돌아왔어요" : "세트를 지웠어요");
    });
  };
  // 세트 그림 3장을 Claude(haiku)에 보여 그림체 태그만 뽑아 문구로. Anthropic 키가 없으면 AI 연결 칸(#key)에 적어 둔 값을 먼저 저장해 봄
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
  $("#ssetAdd", box).onclick = () => $("#ssetFile", box).click();
  $("#ssetFile", box).onchange = async (e) => {
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
  $("#autoImg", box).onchange = (e) => { S.settings.autoImg = e.target.checked; saveSettings(); if (e.target.checked && !S.settings.runwareKey && !$("#rkey", box).value.trim()) toast("Runware API 키를 넣고 설정 저장을 눌러야 그림이 만들어져요"); };
  $("#gtest", box).onclick = () => {
    S.settings.runwareKey = $("#rkey", box).value.trim(); saveStyle(); saveSettings();
    genImageSheet({ title: "Runware 연결 테스트", aspect: "1:1", prompt: "1girl, solo, adult, sitting by the window, holding coffee cup, cat, warm afternoon sunlight, cozy room", ctx: { kind: "daily", aud: "m" },
      onUse: async () => toast("테스트 이미지는 저장하지 않아요. Runware 연결이 잘 돼요!") });
  };
});
/* '설정 저장': Runware 키와 그림체 선택을 S.settings에 — saveSettings·applySettings는 me.js가 이어서 부름 */
EXT.meSave.push((v) => { const rk = $("#rkey", v); if (rk) S.settings.runwareKey = rk.value.trim(); saveStyle(); });
