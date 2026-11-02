/* ---------------------------------------------------------------- 이미지 슬롯 관리 */
function openImageSlots(c, code) {
  c = normalizeChar(c);
  const mine = S.mine.find((m) => m.id === c.id);
  let cur = code && c.cast.some((x) => x.code === code) ? code : c.cast[0].code;
  const store = () => mine ? (mine.images = mine.images || {}) : (S.imgpacks[c.id] = S.imgpacks[c.id] || {});
  const persist = () => { if (mine) { KV.set("mine", S.mine); if (mine.publish) publishCommunity(); } else KV.set("imgpacks", S.imgpacks); };
  const put = async (file, sit, code = cur) => { const ref = await IMG.put(file); const m = store()[code] || {}; IMG.drop(m[sit]); m[sit] = ref; store()[code] = m; };
  const prompt = (cast, i) => buildPonyPrompt(cast, i, c);
  // 직접 만든 칸은 그 칸의 수위(19금 칸만 성인 태그), 기본 칸(0~14)은 이 작품 수위(기본 전체이용가)
  const slotRating = (i) => { const d = sitDef(i); return d ? imgRating(d.rating) : sheetRating(c.id); };
  let live = null, bulk = null;
  const paint = () => {
    const cast = c.cast.find((x) => x.code === cur), slots = imagesOf(c)[cur] || {};
    const ov = sheet(`<div class="sheet-head"><h2>이미지 슬롯</h2><button class="icon-btn" data-x aria-label="닫기">${ICON.close}</button></div>
      <p class="sub">대화 속 장면마다 이 칸의 이미지가 보여요. 빈 칸은 프로필 이미지로 대신해요.${mine ? "" : " 이미지는 내 계정에만 저장돼요."}</p>
      <div class="casttabs chips">${c.cast.map((x) => `<button class="chip ${x.code === cur ? "on" : ""}" data-cc="${esc(x.code)}">${esc(x.name)} <small>${esc(x.code)}</small></button>`).join("")}</div>
      <div class="cta-row" style="margin:0 0 10px"><button class="btn sm pri" id="bulk">여러 장 한 번에 올리기</button><button class="btn sm" id="aiAll">${bulk ? "AI 채우기 멈추기" : "빈 칸 AI로 채우기"}</button><button class="btn sm" id="prompt">이미지 프롬프트 복사</button><button class="btn sm" id="addSit">+ 칸 추가</button><button class="btn sm" id="recSit">추천 칸</button><button class="btn sm" id="listSit">목록으로 추가</button><span class="note">파일 이름을 2.png처럼 칸 번호로 지으면 그 칸에 들어가요.</span></div>
      ${ratingFieldHTML("slotRt", sheetRating(c.id), "기본 칸(0~14) 그림 수위 — 직접 만든 칸은 그 칸의 수위로 만들어요")}
      <div class="slot-grid">${slotNums().map((i) => { const ref = validRef(slots[i]) ? slots[i] : null, d = sitDef(i); return `<div class="slot"><div class="pic${bulk && bulk.code === cur && bulk.at === i ? " busy" : ""}">${ref ? IMG.tag(ref) : artHTML(c, cast, i)}</div><span class="lb">${i} ${esc(sitName(i))}${d && d.rating !== "safe" ? " 🔞" : ""}${i === 0 ? " <small>첫 등장</small>" : ""}</span><div class="bs"><button data-up="${i}">${ref ? "바꾸기" : "올리기"}</button><button data-ai="${i}">AI</button>${ref ? `<button data-rm="${i}">삭제</button>` : ""}${d ? `<button data-ed="${i}">고치기</button>` : ""}</div></div>`; }).join("")}</div>
      <input type="file" id="one" accept="image/png,image/jpeg,image/webp" hidden><input type="file" id="many" accept="image/png,image/jpeg,image/webp" multiple hidden>
      <p class="note" style="margin-top:12px">AI 버튼은 설정의 Runware 키로 그려요. 같은 인물로 그리려면 작품의 '이미지 출연진' 외모를 자세히 적어 주세요.</p>`, "wide");
    live = ov; IMG.hydrate(ov);
    $$("[data-cc]", ov).forEach((b) => b.onclick = () => { cur = b.dataset.cc; paint(); });
    let target = 0;
    $$("[data-up]", ov).forEach((b) => b.onclick = () => { target = +b.dataset.up; $("#one", ov).click(); });
    $$("[data-rm]", ov).forEach((b) => b.onclick = () => { const m = store()[cur] || {}; IMG.drop(m[b.dataset.rm]); delete m[b.dataset.rm]; store()[cur] = m; persist(); paint(); });
    $$("[data-ai]", ov).forEach((b) => b.onclick = () => {
      const i = +b.dataset.ai, code = cur;
      genImageSheet({ title: `${cast.name} · ${i} ${sitName(i)}`, parts: savedParts(c, cast, i), save: { c, cast, i }, aspect: "4:5", rating: slotRating(i),
        onUse: async (blob) => { await put(blob, i, code); persist(); if (live?.isConnected) paint(); toast("이미지를 등록했어요"); } });
    });
    $$("[data-ed]", ov).forEach((b) => b.onclick = () => sitEditor(sitDef(+b.dataset.ed), paint));
    const rs = $("#slotRt", ov); if (rs) rs.onchange = () => setSheetRating(c.id, rs.value);
    $("#addSit", ov).onclick = () => sitEditor(null, paint);
    $("#recSit", ov).onclick = () => sitPresetSheet(paint);
    $("#listSit", ov).onclick = () => sitListSheet(paint);
    $("#aiAll", ov).onclick = async () => {
      if (bulk) { bulk.stop = true; return; }
      if (!hasRunwareKey()) { toast(genErr({ code: "no_key" })); return; }
      const code = cur, ca = cast, todo = slotNums().filter((i) => !validRef((imagesOf(c)[code] || {})[i]));
      if (!todo.length) { toast("빈 칸이 없어요"); return; }
      bulk = { code, at: -1, stop: false }; let ok = 0, err = null;
      for (const i of todo) {
        if (bulk.stop) break;
        bulk.at = i; if (live?.isConnected) paint(); toast(`AI로 채우는 중… ${ok + 1}/${todo.length}`);
        try { const rt = imgRating(slotRating(i)); await put(await runwareImage(await partsTags(savedParts(c, ca, i), rt !== "safe"), { aspect: "4:5", rating: rt }), i, code); persist(); ok++; }
        catch (e) { err = e; if (["no_key", "bad_key", "no_funds", "bad_model", "network", "rate_limited", "minor_block"].includes(e?.code)) break; }
      }
      const stopped = bulk.stop; bulk = null; if (live?.isConnected) paint();
      toast(`${ok}장 만들었어요${stopped ? " (멈춤)" : err ? ` · ${genErr(err)}` : ""}`);
    };
    $("#one", ov).onchange = async (e) => { const f = e.target.files[0]; if (!f) return; toast("올리는 중…"); try { await put(f, target); persist(); paint(); toast("이미지를 등록했어요"); } catch { toast("이미지를 읽지 못했어요. PNG·JPG로 다시 올려 주세요."); } };
    $("#bulk", ov).onclick = () => $("#many", ov).click();
    $("#many", ov).onchange = async (e) => {
      const files = [...e.target.files]; let ok = 0, skip = 0; toast(files.length + "장을 올리는 중…");
      for (const f of files) {
        const base = f.name.replace(/\.[^.]+$/, "").toLowerCase(), m = base.match(/(?:^|[_\-\s])([a-z]+\d*)?[_\-\s]?(\d{1,2})$/) || base.match(/^(\d{1,2})$/);
        const sit = m ? +(m[2] ?? m[1]) : NaN;
        if (!slotNums().includes(sit)) { skip++; continue; }
        try { await put(f, sit); ok++; } catch { skip++; }
      }
      persist(); paint(); toast(`${ok}장 등록${skip ? `, ${skip}장은 번호를 알 수 없어 건너뛰었어요` : ""}`);
    };
    $("#prompt", ov).onclick = () => { const nums = slotNums(); copyText(nums.map((i) => `${i} ${sitName(i)}: ${prompt(cast, i)}`).join("\n"), `${nums.length}칸 프롬프트를 복사했어요`); };
  };
  paint();
}

/* ---------------------------------------------------------------- 세계관 일러스트: 대표 일러스트(표지) + 키워드북 항목별 그림.
   내 작품은 작품(img·loreImages)에, 그 밖의 작품은 내 계정(coverpacks·lorepacks)에 저장 */
function loreImg(c, key) { const live = getChar(c.id) || c; return (S.lorepacks[c.id] || {})[key] || (live.loreImages || {})[key] || ""; }
function lorePrompt(c, e) { return ["scenery, wide shot, detailed background, atmospheric lighting, no text", e.text].filter(Boolean).join(", "); }
function pubLore(m) { const out = {}; for (const [k, ref] of Object.entries(m || {}).slice(0, 40)) if (typeof ref === "string" && ref.startsWith("/_blob/") && validRef(ref)) out[String(k).slice(0, 20)] = ref; return out; }
function worldArtHTML(c) {
  const lore = (getChar(c.id) || c).lore || [];
  if (!lore.length) return "";
  return `<div class="wgal">${lore.map((e) => { const ref = loreImg(c, e.keys[0]); return `<figure class="wcard">${ref ? `<button class="wpic" data-wlb="${esc(e.keys[0])}" aria-label="${esc(e.keys[0])} 크게 보기">${IMG.tag(ref)}</button>` : `<div class="wpic ph">${esc(e.keys[0])}</div>`}<figcaption><b>${esc(e.keys[0])}</b><span>${esc(e.text)}</span></figcaption></figure>`; }).join("")}</div>`;
}
function openWorldArt(c) {
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
      genImageSheet({ title: `${c.title} · ${cover ? "대표 일러스트" : key}`, aspect: cover ? "3:4" : "16:9", prompt: cover ? coverPrompt(c) : lorePrompt(c, e), rating: sheetRating("w:" + c.id),
        onUse: async (blob) => { setRef(key, await IMG.put(blob)); if (live?.isConnected) paint(); toast(cover ? "대표 일러스트를 넣었어요" : "세계관 일러스트를 넣었어요"); } });
    });
  };
  paint();
}
