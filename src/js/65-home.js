/* ---------------------------------------------------------------- 홈 */
function cardHTML(c) {
  const info = c.world_mode && (c.cast || []).length > 1 ? `<span class="cast-n">👥 ${c.cast.length}인 · 🎬 ${(c.openings || []).length}</span>` : "";
  const aud = audience() === "all" && audOf(c) !== "all" ? `<span class="aud-tag">${AUDS[audOf(c)].name}</span>` : "";
  return `<button class="card" data-char="${esc(c.id)}"><div style="position:relative">${coverHTML(c, "", { vt: true, cat: true })}${info}</div>
    <span class="t">${esc(c.name)}</span><span class="d">${esc(c.oneLiner)}</span>
    <span class="meta">${aud}${(c.tags || []).slice(0, 3).map((t) => `<span>#${esc(t)}</span>`).join("")}</span></button>`;
}
/* 관심있는 대화 고르기: 처음 시작할 때(first) 한 번, 홈·설정에서 바꿀 수 있음 */
function audSegHTML() {
  return `<div class="seg aud-seg">${Object.keys(AUDS).map((k) => `<button type="button" data-aud="${k}" class="${audience() === k ? "on" : ""}">${AUDS[k].name}<small>${AUDS[k].desc}</small></button>`).join("")}</div>`;
}
function setAudience(k) { S.settings.audience = AUDS[k] ? k : "all"; saveSettings(); }
function audSheet(first) {
  const ov = sheet(`<h2>관심있는 대화</h2><p class="sub">${first ? "어떤 대화를 보고 싶으세요? " : ""}고른 쪽 작품만 홈에 보여요. MY → 설정에서 언제든 바꿀 수 있어요.</p>${audSegHTML()}`);
  $$("[data-aud]", ov).forEach((b) => b.onclick = () => { setAudience(b.dataset.aud); closeOverlays(); if ((location.hash.slice(1) || "home") === "home") viewHome(); toast(`${AUDS[audience()].name} 작품을 보여 드릴게요`); });
  if (first) setAudience(audience()); // 닫기만 해도 다시 묻지 않게 '전체'로 정해 둠
}
function viewHome() {
  const v = $("#view");
  const match = (c) => (S.cat === "전체" || c.cat === S.cat) && (!S.q || [c.name, c.title, c.oneLiner, ...(c.tags || [])].join(" ").toLowerCase().includes(S.q.toLowerCase()));
  // 내가 만든 작품은 관심있는 대화와 상관없이 늘 보임
  const pool = ORIGINALS.filter(audOK), originals = pool.filter(match), mine = S.mine.filter(match), comm = S.community.filter((c) => !S.mine.some((m) => m.id === c.id)).filter(audOK).filter(match);
  const hidden = audience() !== "all" && (ORIGINALS.length > pool.length);
  // 대표 작품: 전체면 여성향·남성향을 번갈아, 아니면 고른 쪽 앞에서 4개
  const hero = audience() !== "all" ? pool.slice(0, 4) : (() => { const f = pool.filter((c) => audOf(c) === "f"), m = pool.filter((c) => audOf(c) !== "f"), out = [];
    for (let i = 0; out.length < 4 && (i < f.length || i < m.length); i++) { if (f[i]) out.push(f[i]); if (m[i] && out.length < 4) out.push(m[i]); } return out; })();
  v.innerHTML = `<div class="page">
    ${topbar(`<label class="search">${ICON.search}<span class="sr">캐릭터 검색</span><input id="q" placeholder="캐릭터, 작품, 태그 검색" value="${esc(S.q)}"></label>`)}
    ${S.engine === "none" ? `<div class="engine-warn">AI 연결이 아직 없어요. claude.ai에서 열면 바로 대화할 수 있고, 파일로 열었다면 <b>MY → 설정</b>에서 Anthropic API 키를 넣어 주세요.</div>` : ""}
    ${!S.q ? `<div class="hero">${hero.map((c) => `
      <button class="hero-card" data-char="${esc(c.id)}">${coverHTML(c, "", { vt: true })}
        <div class="body"><span class="k">${c.isNew ? "NEW · " : ""}${esc(c.cat)} · HEART SYNC 오리지널</span><h3>${esc(c.title)}</h3><p>${esc(c.desc)}</p>
        <span class="who">${c.world_mode ? "세계관 입장하기" : esc(c.name) + "와 대화하기"} →</span></div></button>`).join("")}</div>` : ""}
    ${S.rooms.length && !S.q ? `<h2 class="sec">이어서 대화하기</h2><div class="cont">${S.rooms.slice(0, 4).map((r) => `
      <button data-room="${esc(r.id)}">${coverHTML(r)}<span class="x"><b>${esc(r.name)}</b><span>${esc(r.last)}</span></span><span class="note">${ago(r.at)}</span></button>`).join("")}</div>` : ""}
    ${!S.q && S.cat === "전체" ? HOME_ROWS.map((w) => { const sv = pool.filter((c) => c.row === w.key); return sv.length ? `<h2 class="sec">${esc(w.title)} <small>${esc(w.sub)}</small></h2><div class="row-scroll">${sv.map(cardHTML).join("")}</div>` : ""; }).join("") : ""}
    <h2 class="sec">둘러보기 <small>관심있는 대화</small></h2>
    ${audSegHTML()}
    <div class="chips" style="margin-top:10px">${["전체", ...CATS].map((c) => `<button class="chip ${S.cat === c ? "on" : ""}" data-cat="${c}">${c}</button>`).join("")}</div>
    <h2 class="sec">HEART SYNC 오리지널 <small>에디터가 직접 만든 작품</small></h2>
    ${originals.length ? `<div class="grid">${originals.map(cardHTML).join("")}</div>` : `<div class="empty">조건에 맞는 오리지널 작품이 없어요.${hidden ? `<br>지금은 ${AUDS[audience()].name} 작품만 보여요.<br><button class="btn sm" data-aud="all">전체 보기</button>` : ""}</div>`}
    <h2 class="sec">커뮤니티 신작 <small>${S.community.length ? "크리에이터가 공개한 캐릭터" : ""}</small></h2>
    ${comm.length ? `<div class="grid">${comm.map(cardHTML).join("")}</div>` :
      `<div class="empty">아직 공개된 캐릭터가 없어요.<br>첫 크리에이터가 되어 보세요.<br><button class="btn sm pri" data-go="studio">캐릭터 만들기</button></div>`}
    ${mine.length ? `<h2 class="sec">내가 만든 캐릭터</h2><div class="grid">${mine.map(cardHTML).join("")}</div>` : ""}
  </div>`;
  $$("[data-char]", v).forEach((b) => b.onclick = () => go("c-" + b.dataset.char));
  $$("[data-room]", v).forEach((b) => b.onclick = () => go("r-" + b.dataset.room));
  $$("[data-cat]", v).forEach((b) => b.onclick = () => { S.cat = b.dataset.cat; viewHome(); });
  $$("[data-aud]", v).forEach((b) => b.onclick = () => { setAudience(b.dataset.aud); viewHome(); });
  const q = $("#q"); q.oninput = () => { S.q = q.value; const pos = q.selectionStart; viewHome(); const n = $("#q"); n.focus(); n.setSelectionRange(pos, pos); };
  bindGo(v); IMG.hydrate(v);
}

/* ---------------------------------------------------------------- 캐릭터 상세 */
function viewDetail(id) {
  const c = normalizeChar(getChar(id)), v = $("#view");
  if (!c) { v.innerHTML = `<div class="page">${topbar()}<div class="empty">캐릭터를 찾을 수 없어요. 삭제됐거나 아직 불러오는 중일 수 있어요.<br><button class="btn sm" data-go="home">홈으로</button></div></div>`; bindGo(v); return; }
  const rooms = S.rooms.filter((r) => r.charId === c.id);
  const persona = S.personas.find((p) => p.def) || S.personas[0];
  const isMine = S.mine.some((m) => m.id === c.id);
  const creator = ORIGINALS.includes(c) ? "HEART SYNC 스튜디오" : (c.creator || "익명 크리에이터");
  v.innerHTML = `<div class="page">
    ${topbar(`<button class="icon-btn" data-go="home" aria-label="뒤로">${ICON.back}</button>`)}
    <div class="detail">
      <div>${coverHTML(c, "", { vt: true })}</div>
      <div>
        <span class="note">${esc(c.cat)} · ${esc(creator)}${c.world_mode ? " · 세계관" : ""}</span>
        <h1>${esc(c.title)}</h1>
        <p class="lead">${esc(c.oneLiner)}</p>
        <div class="tags">${(c.tags || []).map((t) => `<span>#${esc(t)}</span>`).join("")}</div>
        <div class="box"><h3>소개</h3><p>${esc(c.desc)}</p></div>
        <div class="box"><h3 style="display:flex;align-items:center">세계관 일러스트 <span class="spacer"></span><button class="btn sm ghost" id="wArt">일러스트 관리</button></h3>
          ${worldArtHTML(c) || `<p class="note">대표 일러스트(표지)를 AI로 만들거나 올릴 수 있어요. 키워드북이 있는 작품은 항목마다 세계관 일러스트도 넣을 수 있어요.</p>`}</div>
        <div class="box"><h3 style="display:flex;align-items:center">등장인물 <span class="spacer"></span><button class="btn sm ghost" id="imgSlots">이미지 슬롯 관리</button></h3>
          <div class="cast">${c.cast.map((x) => `<button data-cast="${esc(x.code)}" title="${esc(x.look || x.name)}">${portraitHTML(c, x)}<b>${esc(x.name)}</b></button>`).join("")}</div></div>
        <div class="box"><h3>${c.world_mode ? "게임 모드 · 시작 상황" : "시작 상황"}</h3><div class="openings">
          ${c.openings.map((o, i) => `<label class="opening"><input type="radio" name="op" value="${i}" ${i === 0 ? "checked" : ""}><b>${esc(o.title)}</b>
            <span>${esc(o.text.replace(/\[\[img:[^\]]*\]\]/g, "").replace(/[*"\[\]]/g, "").replace(/\s+/g, " ").slice(0, 120))}…</span></label>`).join("")}
        </div>
        <div class="field"><label for="pp">대화할 내 페르소나</label><select id="pp">${S.personas.map((p) => `<option value="${esc(p.id)}" ${p === persona ? "selected" : ""}>${esc(p.name)}${p.memo ? " · " + esc(p.memo) : ""}</option>`).join("")}</select></div>
        <div class="cta-row"><button class="btn pri big" id="start">새 대화 시작</button>${isMine ? `<button class="btn" data-go="studio-${esc(c.id)}">수정</button>` : ""}<button class="btn ghost sm" data-go="me">페르소나 관리</button></div>
        <p class="note" style="margin-top:8px">라이트 모델은 하루 ${FREE_DAILY}턴 무료. 상태창: ${c.fields.slice(0, 8).map(esc).join(" · ")}${c.fields.length > 8 ? " 외" : ""}</p>
        </div>
        ${rooms.length ? `<div class="box"><h3>내 대화방</h3><div class="cont">${rooms.map((r) => `<button data-room="${esc(r.id)}">${coverHTML(r)}<span class="x"><b>${esc(r.name)}</b><span>${esc(r.last)}</span></span><span class="note">${ago(r.at)}</span></button>`).join("")}</div></div>` : ""}
      </div>
    </div></div>`;
  bindGo(v); IMG.hydrate(v);
  $$("[data-room]", v).forEach((b) => b.onclick = () => go("r-" + b.dataset.room));
  $("#imgSlots").onclick = () => openImageSlots(c);
  $("#wArt").onclick = () => openWorldArt(c);
  $$("[data-wlb]", v).forEach((b) => b.onclick = () => { const i = b.querySelector("img"); if (i?.src) lightbox(i.src); });
  $$("[data-cast]", v).forEach((b) => b.onclick = () => openImageSlots(c, b.dataset.cast));
  $("#start").onclick = () => {
    if (rooms.length >= plan().rooms) return plusSheet("rooms");
    const opIdx = +(v.querySelector("input[name=op]:checked")?.value || 0);
    const p = S.personas.find((x) => x.id === $("#pp").value) || persona;
    room = newRoom(c, opIdx, p); go("r-" + room.id);
  };
}
