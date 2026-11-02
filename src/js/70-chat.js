/* ---------------------------------------------------------------- 대화방 */
async function viewChat(id) {
  const v = $("#view");
  if (!room || room.id !== id) {
    v.innerHTML = `<div class="page"><p class="note">대화를 불러오는 중…</p></div>`;
    const r = await KV.get(roomKey(id));
    if (location.hash.slice(1) !== "r-" + id) return;
    if (!r) { v.innerHTML = `<div class="page">${topbar()}<div class="empty">대화방을 찾을 수 없어요.<br><button class="btn sm" data-go="chats">대화 목록</button></div></div>`; bindGo(v); return; }
    room = migrateRoom(r);
  }
  const c = room.char;
  v.innerHTML = `<div class="chat">
    <div class="chat-bg">${coverHTML(c)}</div>
    <header class="chat-head">
      <button class="icon-btn" id="back" aria-label="뒤로">${ICON.back}</button>
      ${coverHTML(c)}
      <div class="who"><b>${esc(c.title)}</b><span>${esc(room.opening || "")} · ${esc(room.persona.name)}</span></div>
      <div class="meter" id="meter"></div>
      <button class="model-chip" id="modelChip" aria-label="AI 모델 선택"></button>
      <button class="icon-btn" id="info" aria-label="대화방 관리">${ICON.menu}</button>
    </header>
    <div class="chat-log" id="log"><div class="log-inner" id="logInner"></div><div class="jump-wrap"><button class="jump" id="jumpBtn" type="button" hidden>↓ 맨 아래로</button></div></div>
    <div class="composer"><div class="inner">
      <div class="sug-panel" id="sugPanel" hidden></div>
      <div class="bar2">
        <button class="chip" id="sugBtn" aria-expanded="false">✦ AI 추천</button>
        <button class="chip" id="contBtn">이어서 쓰기</button>
        <span class="spacer"></span><span class="freecount" id="freeCount"></span>
      </div>
      <form class="inputrow" id="form">
        <label class="sr" for="inp">메시지</label>
        <textarea id="inp" rows="1" maxlength="1500" placeholder="${esc(room.persona.name)}의 행동·대사 입력 (지문은 *별표* 사이에)"></textarea>
        <button class="stopbtn" id="stopBtn" type="button" hidden>■ 중지</button>
        <button class="send" id="sendBtn" type="submit" aria-label="보내기"></button>
      </form>
      <div class="hint" id="hint"></div>
    </div></div>
  </div>`;
  $("#back").onclick = () => history.length > 1 ? history.back() : go("chats");
  $("#info").onclick = () => openRoomDrawer("main");
  $("#modelChip").onclick = () => openModelSheet();
  $("#contBtn").onclick = () => { if (!gen) sendTurn("", { cont: true }); };
  $("#sugBtn").onclick = () => toggleSug();
  $("#stopBtn").onclick = () => stopGen();
  const inp = $("#inp");
  inp.oninput = () => { inp.style.height = "auto"; inp.style.height = Math.min(160, inp.scrollHeight) + "px"; };
  inp.onkeydown = (e) => {
    // Enter로 보내기(기본) 또는 Ctrl+Enter로 보내기 — 채팅 설정의 enterSend
    const send = S.settings.enterSend !== false ? !e.shiftKey : e.ctrlKey || e.metaKey;
    if (e.key === "Enter" && send && !e.isComposing && e.keyCode !== 229) {
      e.preventDefault();
      if (gen) { flashHint("응답을 쓰는 중이에요. 끝나면 보낼 수 있고, 입력은 미리 써 둘 수 있어요."); return; }
      $("#form").requestSubmit();
    }
  };
  $("#form").onsubmit = async (e) => {
    e.preventDefault();
    if (gen) return;
    const t = inp.value.trim(); if (!t) return;
    const ok = await sendTurn(t);
    if (ok && inp.value.trim() === t) { inp.value = ""; inp.oninput(); }
  };
  bindStick($("#log"));
  renderLog(true); updateMeter(); updateComposer();
}
let hintTimer = null;
function flashHint(msg) {
  const h = $("#hint"); if (!h) return;
  h.textContent = msg; h.classList.add("warn");
  clearTimeout(hintTimer); hintTimer = setTimeout(() => { hintTimer = null; h.classList.remove("warn"); updateComposer(); }, 2600);
}
function updateComposer() {
  if (!room || !$("#sendBtn")) return;
  const q = quote(room.set), m = MODELS[room.set.model];
  const send = $("#sendBtn"), stop = $("#stopBtn");
  send.disabled = !!gen; stop.hidden = !gen;
  send.innerHTML = `${ICON.send}<small>${qShort(q)}</small>`;
  send.title = q.type === "heart" ? `이번 턴에 하트 ${q.n}개가 사용돼요` : q.type === "free" ? "오늘의 무료 턴으로 보내요" : "PLUS 무제한";
  $("#contBtn").disabled = !!gen; $("#sugBtn").disabled = !!gen;
  const chip = $("#modelChip"); if (chip) chip.innerHTML = `${m.name}${unfilteredRoute(room) ? ' <span class="adult" title="성인 무검열 모드 · OpenRouter">🔞</span>' : ""} <small>${qShort(q)}/턴</small> ▾`;
  const fc = $("#freeCount");
  if (fc) {
    const left = freeLeft();
    fc.className = "freecount" + (!isPro() && left <= 3 ? " low" : "");
    fc.innerHTML = isPro() ? `<span class="badge-pro">PLUS</span> ♥ <b>${num(S.wallet.hearts)}</b>` : `무료 <b>${left}</b>/${FREE_DAILY}턴 · ♥ <b>${num(S.wallet.hearts)}</b>`;
  }
  const h = $("#hint");
  if (h && !hintTimer) {
    if (gen) h.textContent = "응답을 쓰는 중이에요 · 다음 입력은 미리 써 둘 수 있어요 · Esc 또는 ■ 중지";
    else if (q.type === "free" && freeLeft() <= 3) h.textContent = `오늘 무료 턴이 ${freeLeft()}번 남았어요. 다 쓰면 라이트 모델은 턴당 ♥${listPrice("lite", room.set.len, room.set.mem)}이에요.`;
    else h.textContent = (S.settings.enterSend !== false ? "Enter 전송 · Shift+Enter 줄바꿈" : "Ctrl+Enter 전송 · Enter 줄바꿈") + " · // 로 시작하면 연출 지시";
  }
}
function lastAi(r) { for (let i = r.msgs.length - 1; i >= 0; i--) if (r.msgs[i].role === "ai") return r.msgs[i]; return null; }
function gaugeView(c, s) {
  const v = s?.[c.gauge]; if (v === undefined) return null;
  const pct = barPct(v); if (pct === null) return null;
  return { pct, text: String(v) };
}
function updateMeter() {
  const el = $("#meter"); if (!el || !room) return;
  const g = gaugeView(room.char, room.status);
  el.innerHTML = g ? `<span>${esc(room.char.gauge)}</span><i><b style="width:${g.pct}%"></b></i><span>${esc(g.text)}</span>` : "";
}
function barPct(v) {
  if (typeof v === "number") return clamp(v, 0, 100);
  if (typeof v !== "string") return null;
  let m = v.match(/^\s*(\d[\d,]*)\s*\/\s*(\d[\d,]*)\s*$/);
  if (m) { const a = +m[1].replace(/,/g, ""), b = +m[2].replace(/,/g, ""); return b > 0 ? clamp(a / b * 100, 0, 100) : null; }
  m = v.match(/^\s*(\d{1,3})(\.\d+)?\s*%\s*$/); if (m) return clamp(+m[1], 0, 100);
  return null;
}
function firstNum(v) { if (typeof v === "number") return v; const m = String(v).match(/-?\d[\d,]*/); return m ? +m[0].replace(/,/g, "") : null; }
function statusBlock(c, s, prev, { open = false, live = false } = {}) {
  if (!s || !Object.keys(s).length) return "";
  const rows = c.fields.filter((f) => s[f] !== undefined && s[f] !== "").map((f) => {
    const raw = s[f]; let val;
    const pct = barPct(raw);
    if (f.includes("속마음")) val = `<span class="inner ${live ? "" : "open"}" tabindex="0" title="눌러서 속마음 보기">${esc(raw)}</span>`;
    else if (pct !== null) {
      const a = firstNum(raw), b = prev && prev[f] !== undefined ? firstNum(prev[f]) : null, d = a !== null && b !== null ? a - b : 0;
      val = `<span class="bar"><i><b style="width:${pct}%"></b></i>${esc(raw)}${d ? `<span class="dl ${d > 0 ? "up" : "down"}">${d > 0 ? "▲" + num(d) : "▼" + num(-d)}</span>` : ""}</span>`;
    } else val = esc(raw);
    return `<div class="st-row ${String(raw).length > 26 ? "wide" : ""}"><dt>${esc(f)}</dt><dd>${val}</dd></div>`;
  });
  if (!rows.length) return "";
  const g = gaugeView(c, s);
  return `<details class="stat" ${open ? "open" : ""}><summary>상태창${g ? ` · ${esc(c.gauge)} ${esc(g.text)}` : ""}</summary><dl class="status">${rows.join("")}</dl></details>`;
}
function inline(s) {
  let html = "", last = 0, m; const re = /(\*[^*]+\*)|("[^"]*"|“[^”]*”)/g;
  while ((m = re.exec(s))) {
    if (m.index > last) html += esc(s.slice(last, m.index));
    html += m[1] ? `<span class="narr">${esc(m[1].slice(1, -1))}</span>` : `<span class="dlg">${esc(m[2])}</span>`;
    last = re.lastIndex;
  }
  return html + esc(s.slice(last));
}
function fmtLine(line, names) {
  if (/^\[[^\[\]]+\](\s*\[[^\[\]]+\])*$/.test(line)) return `<p class="sys">${line.match(/\[[^\[\]]+\]/g).map((g) => esc(g.slice(1, -1))).join("<br>")}</p>`;
  const sp = line.match(/^([^\s:*"“\[]{1,14}(?: [^\s:*"“\[]{1,10})?)\s*:\s*(.+)$/);
  if (sp && names.has(sp[1])) return `<p><b class="spk">${esc(sp[1])}</b>${inline(sp[2])}</p>`;
  return `<p class="${/^\s*\*[^*]+\*\s*$/.test(line) ? "narr" : ""}">${inline(line)}</p>`;
}
function fmt(text, c, persona) {
  const names = new Set([c.name, persona?.name, ...(c.cast || []).map((x) => x.name)].filter(Boolean));
  // 글 없이 이어진 그림(여러 인물)은 한 줄(.scene-row)로 나란히
  const out = []; let row = [];
  const flush = () => { if (row.length > 1) out.push(`<div class="scene-row">${row.join("")}</div>`); else if (row.length) out.push(row[0]); row = []; };
  for (const raw of String(text).split(/\n+/)) {
    const line = raw.trim(); if (!line) continue;
    let buf = "";
    for (const part of line.split(/(\[\[img:[a-z0-9]+:\d{1,2}\]\])/i)) {
      const m = part.match(/^\[\[img:([a-z0-9]+):(\d{1,2})\]\]$/i);
      if (m) { if (buf.trim()) { flush(); out.push(fmtLine(buf.trim(), names)); buf = ""; } const f = figHTML(c, m[1].toLowerCase(), +m[2]); if (f) row.push(f); }
      else buf += part;
    }
    if (buf.trim()) { flush(); out.push(fmtLine(buf.trim(), names)); }
  }
  flush();
  return out.join("");
}
function pavHTML(p) { const img = IMG.tag(p.img); return `<div class="pav">${img || esc((p.name || "?").slice(0, 1))}</div>`; }
/* 스트리밍 표시: 끝난 줄은 한 번만 서식을 입혀 붙이고(살짝 나타남), 쓰는 중인 줄은 열린 *·" 를 임시로 닫아 처음부터 서식대로 보여 줌 */
function closeOpen(line) {
  const st = [];
  for (const ch of line) {
    if (ch === "*" || ch === '"') { if (st[st.length - 1] === ch) st.pop(); else st.push(ch); }
    else if (ch === "“") st.push("”");
    else if (ch === "”" && st[st.length - 1] === "”") st.pop();
  }
  let out = line + st.reverse().join("");
  if (/^\s*\[(?!\[)[^\]]*$/.test(out)) out += "]";
  return out;
}
function liveFill(el, text, c, persona, anim = true) {
  let done = el.querySelector(".lv-done"), cur = el.querySelector(".lv-cur");
  if (!done) { el.innerHTML = `<div class="lv-done"></div><div class="lv-cur"></div>`; done = el.firstChild; cur = el.lastChild; el.dataset.n = "0"; }
  const lines = text.split("\n"), last = lines.pop(), n = +(el.dataset.n || 0);
  if (lines.length < n) { el.innerHTML = ""; return liveFill(el, text, c, persona, anim); } // 글이 처음부터 다시 오면(깨진 응답을 다시 쓸 때) 비우고 새로
  el.classList.toggle("many-img", imgTags(text).length >= 2);
  if (lines.length > n) {
    const before = done.children.length;
    done.insertAdjacentHTML("beforeend", fmt(lines.slice(n).join("\n"), c, persona));
    if (anim) [...done.children].slice(before).forEach((x) => x.classList.add("lv-new"));
    el.dataset.n = String(lines.length);
  }
  // 이름만 쓰인 상태(곧 "이름: 대사"가 될 수 있음)는 잠깐 숨겨 서식이 바뀌어 보이지 않게
  cur.innerHTML = /^[^\s:*"“\[]{1,14}$/.test(last.trim()) ? "" : fmt(closeOpen(last), c, persona);
}
/* 응답 중 스크롤: 대화방 출력 설정의 '자동 스크롤'(r.set.autoScroll, 기본 꺼짐)이 켜져 있고 맨 아래에 있을 때만 따라 내려감.
   사용자가 위로 올리면 멈춤. 꺼져 있으면 보낼 때 한 번만 맨 아래로 가고, 답은 읽는 자리에서 아래로 자라남 */
let stick = true;
const autoScroll = () => !!(room && room.set.autoScroll);
function followLog() { const log = $("#log"); if (log && stick && autoScroll()) log.scrollTop = log.scrollHeight; syncJump(); }
// 글이 늘어나는 것만으로는 scroll 이벤트가 안 나서 '맨 아래로' 버튼을 따로 맞춤
function syncJump() { const log = $("#log"), jump = log && $("#jumpBtn", log); if (jump) jump.hidden = log.scrollHeight - log.scrollTop - log.clientHeight < 160; }
function bindStick(log) {
  if (!log) return;
  stick = true; let ty = 0;
  const jump = $("#jumpBtn", log);
  log.addEventListener("scroll", () => {
    const d = log.scrollHeight - log.scrollTop - log.clientHeight;
    if (d < 8) stick = true; else if (d > 24) stick = false;
    if (jump) jump.hidden = d < 160;
  }, { passive: true });
  log.addEventListener("wheel", (e) => { if (e.deltaY < 0) stick = false; }, { passive: true });
  log.addEventListener("touchstart", (e) => { ty = e.touches[0].clientY; }, { passive: true });
  log.addEventListener("touchmove", (e) => { const y = e.touches[0].clientY; if (y > ty + 4) stick = false; ty = y; }, { passive: true });
  log.addEventListener("keydown", (e) => { if (["ArrowUp", "PageUp", "Home"].includes(e.key)) stick = false; });
  if (jump) jump.onclick = () => { stick = true; log.scrollTo({ top: log.scrollHeight, behavior: "smooth" }); };
}
function renderLog(scroll) {
  const box = $("#logInner"); if (!box) return;
  const r = room, c = r.char, lastIdx = r.msgs.map((m) => m.role).lastIndexOf("ai");
  let html = `<div class="scene-card">${coverHTML(c)}<b>${esc(c.title)}</b><span>${esc(r.opening || "")} · ${esc(r.persona.name)}(으)로 플레이 중</span></div>`;
  r.msgs.forEach((m, i) => {
    const bm = (r.bookmarks || []).includes(m.id);
    if (m.role === "user") {
      if (m.sys) { html += `<div class="sys-pill">이어서 쓰기</div>`; return; }
      const ooc = m.text.startsWith("//");
      html += `<div class="msg me ${ooc ? "ooc" : ""}" data-id="${m.id}">${ooc ? "" : pavHTML(r.persona)}<div class="col">
        ${m.editing ? editBox(m.text, i) : `<div class="bubble">${ooc ? esc(m.text) : fmt(m.text, c, r.persona)}</div>
        <div class="tools-row"><button data-act="edit" data-i="${i}">수정</button><button data-act="del" data-i="${i}">삭제</button></div>`}
      </div></div>`;
      return;
    }
    const alt = m.alts[m.idx] || {}, isLast = i === lastIdx, pending = gen && gen.msgId === m.id;
    let body;
    if (m.editing) body = editBox(alt.text, i);
    else if (pending && !alt.text) body = `<div class="bubble"><span class="thinking" aria-label="응답 생성 중"><i></i><i></i><i></i></span></div>`;
    else body = pending ? `<div class="bubble typing" id="liveBubble"></div>` : `<div class="bubble${imgTags(alt.text || "").length >= 2 ? " many-img" : ""}">${fmt(alt.text || "", c, r.persona)}</div>`;
    html += `<div class="msg" data-id="${m.id}">${coverHTML(c)}<div class="col"><span class="nm">${esc(speakerName(r))}</span>${body}`;
    if (!pending && !m.editing) {
      html += statusBlock(c, alt.status, m.statusBefore, { open: isLast, live: isLast });
      html += `<div class="tools-row">
        ${m.alts.length > 1 ? `<button data-act="prev" data-i="${i}" ${m.idx === 0 ? "disabled" : ""} aria-label="이전 버전">‹</button><span class="sw">${m.idx + 1}/${m.alts.length}</span><button data-act="next" data-i="${i}" ${m.idx === m.alts.length - 1 ? "disabled" : ""} aria-label="다음 버전">›</button>` : ""}
        ${isLast && !alt.opening ? `<button data-act="regen" data-i="${i}">↻ 다시 쓰기</button>` : ""}
        <button data-act="bm" data-i="${i}" class="${bm ? "on" : ""}" aria-pressed="${bm}">${bm ? "★" : "☆"} 북마크</button>
        <button data-act="editai" data-i="${i}">수정</button><button data-act="copy" data-i="${i}">복사</button>
        ${i > 0 ? `<button data-act="del" data-i="${i}">삭제</button>` : ""}
        ${alt.lore?.length ? `<span class="lore-used" title="이 응답에 반영된 키워드북">📖 ${esc(alt.lore.join(" · "))}</span>` : ""}
        ${alt.cost ? `<span class="rcpt" title="이 응답에 쓴 비용">${esc(alt.cost)}</span>` : ""}
      </div>`;
    }
    html += `</div></div>`;
  });
  if (r.lastErr) html += `<div class="err-line" role="alert">${esc(r.lastErr)} <button class="btn sm" id="retry">다시 시도</button></div>`;
  box.innerHTML = html;
  const lb = $("#liveBubble", box), gm = gen && r.msgs.find((m) => m.id === gen.msgId);
  if (lb && gm) liveFill(lb, gm.alts[gm.idx]?.text || "", c, r.persona, false);
  bindLog(box); IMG.hydrate(box);
  if (scroll) { const log = $("#log"); log.scrollTop = log.scrollHeight; }
}
function editBox(text, i) {
  return `<div class="edit-box"><label class="sr" for="ed${i}">메시지 수정</label><textarea id="ed${i}">${esc(text)}</textarea>
    <div class="row"><button class="btn sm ghost" data-act="cancel" data-i="${i}">취소</button><button class="btn sm pri" data-act="save" data-i="${i}">${room.msgs[i].role === "user" ? "수정하고 다시 생성" : "저장"}</button></div></div>`;
}
function bindLog(box) {
  $$(".status .inner:not(.open)", box).forEach((el) => { const open = () => el.classList.add("open"); el.onclick = open; el.onkeydown = (e) => { if (e.key === "Enter") open(); }; });
  $$(".scene-img img", box).forEach((im) => im.onclick = () => lightbox(im.src));
  const retry = $("#retry"); if (retry) retry.onclick = async () => {
    room.lastErr = ""; const i = room.msgs.length - 1;
    if (room.msgs[i]?.role === "ai") return regen(i);
    const u = room.msgs.pop(); renderLog();
    if (u) { const ok = await sendTurn(u.sys ? "" : u.text, { cont: !!u.sys }); if (!ok) { room.msgs.push(u); renderLog(); } }
  };
  $$("[data-act]", box).forEach((b) => b.onclick = () => {
    const i = +b.dataset.i, m = room.msgs[i], act = b.dataset.act;
    if (gen && !["copy", "bm"].includes(act)) return flashHint("응답이 끝난 뒤에 할 수 있어요.");
    if (act === "prev" || act === "next") { m.idx = clamp(m.idx + (act === "next" ? 1 : -1), 0, m.alts.length - 1); restoreStatus(); saveRoom(room); renderLog(); }
    else if (act === "regen") regenAsk(i);
    else if (act === "copy") copyText(curText(m).replace(/\[\[img:[^\]]*\]\]\n?/g, ""), "복사했어요");
    else if (act === "bm") { const s = new Set(room.bookmarks || []); s.has(m.id) ? s.delete(m.id) : s.add(m.id); room.bookmarks = [...s]; saveRoom(room); renderLog(); toast(s.has(m.id) ? "북마크에 담았어요" : "북마크에서 뺐어요"); }
    else if (act === "edit" || act === "editai") { m.editing = true; renderLog(); $("#ed" + i)?.focus(); }
    else if (act === "cancel") { delete m.editing; renderLog(); }
    else if (act === "save") {
      const t = $("#ed" + i).value.trim(); delete m.editing; if (!t) return renderLog();
      if (m.role === "user") {
        m.text = t; const keep = room.msgs.slice(0, i + 1);
        ensurePay(room).then((q) => { if (!q) return renderLog(); room.msgs = keep; restoreStatus(); saveRoom(room); generate(null, q, "", true); });
      } else { m.alts[m.idx].text = t; saveRoom(room); renderLog(); }
    }
    else if (act === "del") confirmSheet("이 메시지부터 끝까지 지울까요?", "지운 메시지는 되돌릴 수 없어요. 상태창도 그 시점으로 돌아가요.", "삭제", () => {
      room.msgs = room.msgs.slice(0, Math.max(1, i)); room.lastErr = ""; restoreStatus(); saveRoom(room); renderLog(); updateMeter();
    });
  });
}
function copyText(t, ok) { (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast(ok), () => toast("복사할 수 없었어요. 길게 눌러 선택해 주세요.")); }
function restoreStatus() {
  const a = lastAi(room);
  room.status = a ? (a.alts[a.idx].status || a.statusBefore) : room.status;
  updateMeter();
}

/* 결제 확인 → 견적 반환 (null이면 보내지 않음) */
async function ensurePay(r) {
  const q = quote(r.set);
  if (q.type === "heart" && S.wallet.hearts < q.n) { paywall(q, r); return null; }
  if (q.type === "heart") {
    const key = r.set.model === "lite" ? "lite-" + today() : "m-" + r.set.model;
    if (!S.wallet.ack[key]) {
      const ok = await askPay(q, r); if (!ok) return null;
      Object.keys(S.wallet.ack).forEach((k) => { if (k.startsWith("lite-")) delete S.wallet.ack[k]; });
      S.wallet.ack[key] = true; saveWallet();
    }
  }
  return quote(r.set);
}
async function sendTurn(text, { cont = false } = {}) {
  if (gen) return false;
  const q = await ensurePay(room); if (!q) return false;
  room.lastErr = "";
  room.msgs.push(cont ? { id: uid("m"), role: "user", text: "(이어서)", sys: true } : { id: uid("m"), role: "user", text });
  hideSug();
  generate(null, q);
  return true;
}
function regenAsk(i) {
  if (!room.set.rerollAsk) return regen(i);
  const q = quote(room.set);
  const sh = sheet(`<h2>다시 쓰기</h2><p class="sub">어떤 방향으로 다시 쓸지 적으면 반영해요. 비워 두면 그냥 새로 써요.</p>
    <div class="field"><label for="dir">다시 쓸 방향 (선택)</label><textarea id="dir" maxlength="300" placeholder="예: 서윤이 좀 더 솔직하게 반응하도록 / 전투를 더 길게"></textarea></div>
    <div class="cta-row"><button class="btn ghost" data-x>취소</button><span class="spacer"></span><button class="btn pri" id="go">다시 쓰기 · ${qShort(q)}</button></div>`);
  $("#dir", sh).focus();
  $("#go", sh).onclick = () => { const d = $("#dir", sh).value.trim(); closeOverlays(); regen(i, d); };
}
async function regen(i, direction = "") {
  if (gen) return;
  const q = await ensurePay(room); if (!q) return;
  room.msgs = room.msgs.slice(0, i + 1);
  generate(room.msgs[i], q, direction);
}
/* 모델이 유저 입력을 본문 첫 줄에 다시 옮겨 적으면(조금 바꿔 쓴 것 포함, 글자 2개씩 묶어 70% 이상 같으면) 그 줄을 뺌 */
function dropEcho(body, said) {
  const m = /^\s*([^\n]+)\n/.exec(body); if (!m || !said) return body;
  const norm = (s) => s.replace(/[\s*"“”'‘’.,!?…~]/g, ""), a = norm(m[1]), b = norm(said);
  if (a.length < 6 || b.length < 6 || a.length > b.length * 1.3 + 4) return body;
  const grams = (s) => { const g = new Set(); for (let i = 0; i < s.length - 1; i++) g.add(s.slice(i, i + 2)); return g; };
  const ga = grams(a), gb = grams(b); let hit = 0; ga.forEach((g) => { if (gb.has(g)) hit++; });
  return hit / ga.size >= 0.7 ? body.slice(m[0].length).replace(/^\s+/, "") : body;
}
/* 매 응답, 장면에 나온 인물마다 그림 한 장: AI가 [[img]]를 빠뜨린 인물은 그 인물이 처음 말하거나(이름: …) 지문에 나오는 줄 위에 붙임.
   번호는 처음 등장이면 0, 아니면 그 인물의 대사·지문 낱말(×2)과 유저 입력 낱말(그 인물을 불렀거나, 아무도 안 불렀으면 처음 나온 인물만)로
   sitScores가 가장 높은 번호(그림이 있는 칸이면 0.5 더함), 없으면 1(기본). 출연진이 한 명이면 첫 대사 위(없으면 맨 위) */
function addCastImages(body, r, prev, said) {
  const c = r.char, cast = (c.cast || []).filter((x) => x.name && x.name !== r.persona.name);
  if (!cast.length || !body.trim()) return body;
  const lines = body.split("\n"), have = new Set(imgTags(body).map((t) => t.code)), imgs = imagesOf(c), adult = unfilteredRoute(r);
  const seen = new Set(); prev.forEach((m) => imgTags(curText(m)).forEach((t) => seen.add(t.code)));
  const keysOf = (x) => { const n = x.name.trim(), k = [n], first = n.split(/\s+/)[0]; if (first !== n && first.length >= 2) k.push(first); if (/^[가-힣]{3,4}$/.test(n)) k.push(n.slice(1)); return k; };
  const said2 = said || "", anyNamed = cast.some((x) => keysOf(x).some((k) => said2.includes(k)));
  const found = [];
  for (const x of cast) {
    const keys = keysOf(x);
    const speaks = (l) => keys.some((k) => new RegExp("^\\s*" + k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*:").test(l));
    const mentions = (l) => keys.some((k) => l.includes(k));
    let at = lines.findIndex(speaks);
    if (at < 0) at = lines.findIndex((l) => /^\s*\*/.test(l) && mentions(l));
    if (at < 0 && cast.length === 1) at = Math.max(0, lines.findIndex((l) => /["“]/.test(l)));
    if (at >= 0) found.push({ x, keys, at, own: lines.filter((l) => speaks(l) || (cast.length === 1 ? !/^\s*\[/.test(l) : mentions(l))).join("\n") });
  }
  found.sort((a, b) => a.at - b.at);
  const adds = [];
  found.forEach((f, i) => {
    if (have.has(f.x.code)) return;
    let sit = 1;
    if (!seen.has(f.x.code)) sit = 0;
    else {
      const sc = new Map(); sitScores(f.own, adult).forEach((v, k) => sc.set(k, v * 2));
      if (said2 && (f.keys.some((k) => said2.includes(k)) || (!anyNamed && i === 0))) sitScores(said2, adult).forEach((v, k) => sc.set(k, (sc.get(k) || 0) + v));
      let best = 0; sc.forEach((v, k) => { const s = v + (validRef((imgs[f.x.code] || {})[k]) ? 0.5 : 0); if (s > best) { best = s; sit = k; } });
    }
    adds.push({ at: f.at, tag: `[[img:${f.x.code}:${sit}]]` });
  });
  adds.slice(0, 5).sort((a, b) => b.at - a.at).forEach((a) => lines.splice(a.at, 0, a.tag, ""));
  return lines.join("\n");
}
/* target 없으면 새 AI 메시지, 있으면 그 메시지에 새 버전(alt) 추가 */
async function generate(target, q, direction = "", isEdit = false) {
  const r = room, c = r.char, model = r.set.model;
  let msg = target, altIdx;
  if (!msg) {
    const prev = lastAi(r);
    const before = prev ? (prev.alts[prev.idx].status || prev.statusBefore) : r.status;
    msg = { id: uid("m"), role: "ai", idx: 0, alts: [{ text: "" }], statusBefore: before };
    r.msgs.push(msg); altIdx = 0;
  } else { msg.alts.push({ text: "" }); altIdx = msg.alts.length - 1; msg.idx = altIdx; }
  const input = buildInput(r, r.msgs.indexOf(msg), msg.statusBefore, direction);
  const label = `${c.title} · ${MODELS[model].name}${target ? " 다시 쓰기" : ""}`;
  charge(q, label);
  const ctl = new AbortController();
  gen = { ctl, msgId: msg.id };
  hideSug(); // 추천 답변은 '✦ AI 추천'을 눌렀을 때만 펼침
  stick = true; renderLog(true); updateComposer();
  const said = (() => { const u = r.msgs[r.msgs.indexOf(msg) - 1]; return u && u.role === "user" && !u.sys && !u.text.startsWith("//") ? u.text : ""; })();
  const show = (t) => {
    // 화면엔 본문만: 상태 구분자가 오기 시작했거나(=== STATE 일부) JSON·코드블록 줄이 시작되면 그 줄부터 숨김
    const body = dropEcho(splitReply(t).body, said).replace(/\n?[ \t]*=+[ \t]*[A-Z]*[ \t]*=*\s*$/, "").replace(/\n[ \t]*(?:```|\{)[^\n]*$/, "").replace(/\[\[[^\]]*$/, "");
    msg.alts[altIdx].text = body.trim();
    if (room !== r) return;
    const el = $("#liveBubble");
    if (el) { liveFill(el, msg.alts[altIdx].text, c, r.persona); IMG.hydrate(el); followLog(); }
    else { renderLog(stick && autoScroll()); syncJump(); }
  };
  try {
    const text = await llm(input, { tier: MODELS[model].tier, signal: ctl.signal, onText: ({ text }) => show(text), maxTokens: (LEN[r.set.len] || LEN.mid).tokens, room: r });
    show(text);
    const parsed = parseState(text, c, msg.statusBefore);
    const bodyText = msg.alts[altIdx].text ? addCastImages(msg.alts[altIdx].text, r, r.msgs.slice(0, r.msgs.indexOf(msg)), said) : "(빈 응답)";
    Object.assign(msg.alts[altIdx], parsed, { text: bodyText, cost: qShort(q), lore: input.lore });
    r.status = parsed.status;
    if (!target && !isEdit) { r.turn = (r.turn || 0) + 1; r.sinceMem = (r.sinceMem || 0) + 1; }
  } catch (e) {
    const keep = e && e.text ? splitReply(e.text).body.trim() : "";
    if (keep && e.code === "cancelled") Object.assign(msg.alts[altIdx], { text: keep, status: msg.statusBefore, cost: qShort(q) });
    else {
      msg.alts.splice(altIdx, 1);
      if (!msg.alts.length) r.msgs.splice(r.msgs.indexOf(msg), 1); else msg.idx = msg.alts.length - 1;
      refund(q, label);
      const copy = errCopy(e); if (copy) r.lastErr = copy;
    }
  } finally {
    gen = null;
    saveRoom(r);
    if (room === r && $("#logInner")) {
      renderLog(stick && autoScroll()); syncJump(); updateComposer(); updateMeter(); $("#inp")?.focus({ preventScroll: true });
    }
    maybeSummarize(r);
  }
}
function stopGen() { if (gen) gen.ctl.abort(); }
/* 응답 나누기: 본문 / 상태 JSON. 구분자가 변형("=== STATE ===")되거나 빠진 채 JSON(또는 ```json)만 붙어도 찾아냄 */
function splitReply(t) {
  t = String(t || "");
  let i = t.indexOf(MARK), len = MARK.length;
  if (i < 0) { const m = /\n[ \t]*={2,}[ \t]*STATE[ \t]*={2,}[ \t]*/i.exec(t); if (m) { i = m.index; len = m[0].length; } }
  if (i < 0) { const m = /\n[ \t]*(?:```(?:json)?\s*)?\{\s*"status"\s*:/.exec(t); if (m) { i = m.index; len = 0; } }
  if (i < 0) return { body: t, json: "" };
  // JSON 뒤에 붙은 장면 그림 태그는 본문으로 옮김(일부 OpenRouter 모델이 맨 끝에 씀)
  const json = t.slice(i + len), late = json.match(/\[\[img:[^\]\n]+\]\]/g) || [];
  return { body: t.slice(0, i) + (late.length ? "\n\n" + late.join("\n") : ""), json: late.length ? json.replace(/\*?\[\[img:[^\]\n]+\]\]\*?/g, "") : json };
}
/* 토큰 한도 등으로 중간에 끊긴 JSON 복구: 열린 문자열·괄호를 닫고, 값 없이 끝난 키나 쉼표는 버림 */
function repairJSON(s) {
  const a = s.indexOf("{"); if (a < 0) return "";
  let out = "", str = false, esc = false; const st = [];
  for (const ch of s.slice(a)) {
    out += ch;
    if (str) { if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === '"') str = false; continue; }
    if (ch === '"') str = true;
    else if (ch === "{" || ch === "[") st.push(ch === "{" ? "}" : "]");
    else if (ch === "}" || ch === "]") { st.pop(); if (!st.length) return out; }
  }
  if (str) out += '"';
  // 객체 안에서 값 없이 끝난 키("키" 또는 "키":)는 버림. 배열 안 끝 문자열은 값이니 살림
  if (st[st.length - 1] === "}") out = out.replace(/([,{])\s*"[^"]*"\s*:?\s*$/, "$1");
  out = out.replace(/,\s*$/, "").replace(/:\s*$/, ': ""');
  while (st.length) out += st.pop();
  return out;
}
/* "이화 5 · 설련 0" 같은 여러 인물 수치 칸 읽기 (문자열 또는 {"이화": 5}) */
function multiPairs(v, strict = true) {
  if (v && typeof v === "object" && !Array.isArray(v)) return Object.entries(v).map(([k, n]) => [String(k).trim(), Number(n)]).filter(([k, n]) => k && Number.isFinite(n));
  if (typeof v !== "string") return [];
  const out = [];
  for (const p of v.split(/\s*[·,|/]\s*/).filter(Boolean)) {
    const m = (strict ? /^(.+?)\s*[:：]?\s*(-?\d+)\s*$/ : /^(.+?)\s*[:：]?\s*(-?\d+)/).exec(p.trim());
    // 이름에 숫자가 아닌 글자가 있어야 인물 수치("60/100"을 "6 0 · 1 0"으로 읽던 문제)
    if (m && /[^\d\s.+%-]/.test(m[1])) out.push([m[1].trim(), Number(m[2])]); else if (strict) return [];
  }
  return out;
}
/* 여러 인물 수치 합치기: 빠진 인물은 직전 값 유지, 한 사람당 한 턴 -10~+8, 0~100. 직전 값이 그런 형식이 아니면 null */
function mergeMulti(prev, next) {
  const a = multiPairs(prev); if (a.length < 2) return null;
  const b = new Map(multiPairs(next, false)), seen = new Set();
  const res = a.map(([k, pv]) => { seen.add(k); const nv = b.get(k); return [k, Number.isFinite(nv) ? clamp(Math.round(clamp(nv, pv - 10, pv + 8)), 0, 100) : pv]; });
  for (const [k, nv] of b) if (!seen.has(k) && res.length < 12) res.push([k, clamp(Math.round(nv), 0, 100)]);
  return res.map(([k, n]) => `${k} ${n}`).join(" · ");
}
/* 상태 값으로 객체·배열이 오면 표시용 문자열로 */
function flatValue(o) { const p = multiPairs(o); return (p.length ? p.map(([k, n]) => `${k} ${n}`).join(" · ") : Array.isArray(o) ? o.join(", ") : JSON.stringify(o)).slice(0, 200); }
function parseState(text, c, before) {
  const out = { status: { ...(before || {}) }, suggestions: [] };
  const { json } = splitReply(text);
  if (!json) return out;
  let v = looseJSON(json);
  if (!v || typeof v !== "object") v = looseJSON(repairJSON(json));
  if (!v || typeof v !== "object") return out;
  // "status"로 감싸지 않고 항목을 바로 쓴 응답도 받아 줌
  const st = v.status && typeof v.status === "object" ? v.status : c.fields.some((f) => f in v) ? v : null;
  if (st) {
    for (const f of c.fields) {
      const nv = st[f]; if (nv === undefined || nv === null || nv === "") continue;
      out.status[f] = mergeMulti(before?.[f], nv) ?? (typeof nv === "string" ? nv.slice(0, 200) : typeof nv === "object" ? flatValue(nv) : nv);
    }
    if (typeof before?.[c.gauge] === "number") {
      const g = Number(st[c.gauge]), prev = before[c.gauge];
      out.status[c.gauge] = Number.isFinite(g) ? clamp(Math.round(clamp(g, prev - 10, prev + 8)), 0, 100) : prev;
    }
  }
  if (Array.isArray(v.suggestions)) out.suggestions = v.suggestions.filter((s) => typeof s === "string").map((s) => s.replace(/^\s*\d+[.)]\s*/, "").slice(0, 80)).filter(Boolean).slice(0, 3);
  return out;
}

/* AI 추천 답변: 평소엔 숨김, 버튼을 누르면 표시 (없으면 무료로 생성) */
function hideSug() { const p = $("#sugPanel"); if (p) p.hidden = true; const b = $("#sugBtn"); if (b) { b.classList.remove("on"); b.setAttribute("aria-expanded", "false"); } }
async function toggleSug() {
  const p = $("#sugPanel"), b = $("#sugBtn");
  if (!p.hidden) return hideSug();
  p.hidden = false; b.classList.add("on"); b.setAttribute("aria-expanded", "true");
  const r = room, m = lastAi(r), alt = m && m.alts[m.idx];
  const paint = (list) => {
    p.innerHTML = `<div class="head">✦ 이렇게 이어가 보세요 <span class="spacer"></span><button class="btn sm ghost" id="sugRe">${ICON.redo.replace("<svg", '<svg width="14" height="14"')} 새로 추천</button><button class="btn sm ghost" id="sugX" aria-label="추천 닫기">닫기</button></div>` +
      list.map((s) => `<button class="s" data-s="${esc(s)}">${esc(s)}</button>`).join("");
    $$("[data-s]", p).forEach((x) => x.onclick = () => { const inp = $("#inp"); inp.value = x.dataset.s; inp.oninput(); inp.focus(); hideSug(); });
    $("#sugX", p).onclick = hideSug;
    $("#sugRe", p).onclick = () => fetchSug(true);
  };
  const fetchSug = async (force) => {
    if (!alt) return;
    if (!force && alt.suggestions && alt.suggestions.length) return paint(alt.suggestions);
    p.innerHTML = `<div class="head">✦ 추천 대사를 만드는 중… <span class="thinking"><i></i><i></i><i></i></span></div>`;
    const recent = r.msgs.filter((x) => curText(x) && !x.sys).slice(-6).map((x) => (x.role === "ai" ? speakerName(r) : r.persona.name) + ": " + curText(x).replace(/\[\[img:[^\]]*\]\]/g, "").slice(0, 700)).join("\n\n");
    try {
      const v = await llm([{ role: "user", content: `롤플레이 「${r.char.title}」의 최근 대화다. 유저 캐릭터 ${r.persona.name}가 다음에 보낼 만한 행동·대사 3개를 제안하라.
- 서로 다른 방향(다정·도발·신중 등), 각 40자 이내, ${r.persona.name}의 1인칭 시점. 행동은 *별표*, 대사는 "큰따옴표".
- JSON {"suggestions":["…","…","…"]} 하나로만 답하라.

${recent}` }], { tier: "quick", json: true, room: r });
      const list = Array.isArray(v?.suggestions) ? v.suggestions.filter((s) => typeof s === "string").map((s) => s.slice(0, 80)).slice(0, 3) : [];
      if (!list.length) throw { code: "invalid_json" };
      alt.suggestions = list; saveRoom(r);
      if (room === r && !p.hidden) paint(list);
    } catch (e) { if (room === r && !p.hidden) p.innerHTML = `<div class="head">추천을 만들지 못했어요. ${esc(errCopy(e))}<span class="spacer"></span><button class="btn sm ghost" id="sugX">닫기</button></div>`; $("#sugX", p) && ($("#sugX", p).onclick = hideSug); }
  };
  fetchSug(false);
}

/* ---------------------------------------------------------------- 장기기억: N턴마다 자동 요약, 한도 초과 시 압축 후 히스토리 보관 */
let summarizing = false;
function memCfg() { const c = S.settings.memCfg; return { ...c, limit: Math.min(c.limit, plan().memoMax) }; }
function pushHist(r, text, label) {
  if (!text || !text.trim()) return;
  r.memHist = [{ at: Date.now(), label, text }, ...(r.memHist || [])].slice(0, plan().hist);
}
async function maybeSummarize(r, manual = false) {
  const cfg = memCfg();
  if (summarizing) return;
  if (!manual && (!cfg.auto || (r.sinceMem || 0) < cfg.every)) return;
  const n = manual ? Math.max(1, r.sinceMem || cfg.every) : cfg.every;
  const msgs = r.msgs.filter((m) => !m.sys && curText(m)).slice(-(n * 2));
  if (!msgs.length) return;
  summarizing = true; flagMemo(true, "장기기억을 정리하는 중…");
  const to = r.turn || 0, from = Math.max(1, to - n + 1);
  const guide = cfg.guide === "custom" && cfg.custom.trim() ? cfg.custom.trim() : "사건 순서가 드러나게 쓰고 ① 무슨 일이 왜 일어났는지(원인→결과) ② 인물별 감정과 관계가 어떻게, 무엇 때문에 바뀌었는지 ③ 약속·밝혀진 과거와 비밀·얻거나 잃은 물건과 능력·중요한 수치 ④ 아직 풀리지 않은 떡밥과 갈등을 빠짐없이 남긴다.";
  try {
    const excerpt = msgs.map((m) => (m.role === "ai" ? speakerName(r) : r.persona.name) + ": " + curText(m).replace(/\[\[img:[^\]]*\]\]/g, "").replace(/\s+/g, " ").slice(0, 900)).join("\n");
    const v = await llm([{ role: "user", content: `롤플레이 「${r.char.title}」의 최근 ${n}턴을 장기기억용으로 요약하라. 유저 캐릭터 이름은 ${r.persona.name}.
요약 지침: ${guide}
JSON {"title":"이 구간의 짧은 제목(15자 이내)","summary":"4~8문장 요약"} 하나로만 답하라.

[직전까지의 기억 끝부분]
${(r.memory || "(없음)").slice(-800)}

[이번 구간 대화]
${excerpt}` }], { tier: "quick", json: true, room: r });
    if (!v || typeof v.summary !== "string") throw 0;
    r.memory = ((r.memory || "").trim() + `\n\n[${from}-${to}턴] ${String(v.title || "").slice(0, 30)}\n${v.summary.trim()}`).trim();
    // 요약하는 동안 진행된 턴은 다음 요약 몫으로 남김(0으로 지우면 그 턴들이 요약에서 빠짐)
    r.sinceMem = Math.max(0, (r.sinceMem || 0) - n);
    if (r.memory.length > cfg.limit) {
      pushHist(r, r.memory, "압축 전 기억");
      flagMemo(true, "기억이 길어져 압축하는 중…");
      const snap = r.memory;
      const c2 = await llm([{ role: "user", content: `다음 장기기억 노트를 ${Math.round(cfg.limit * 0.6)}자 이내로 압축하라. [a-b턴] 구간 표시는 합쳐도 되지만 사건 순서는 유지하고, 관계·약속·비밀·능력·수치·떡밥을 우선 남겨라. JSON {"memory":"..."} 하나로만 답하라.\n\n${r.memory}` }], { tier: "quick", json: true, room: r });
      // 압축하는 사이 기억이 바뀌었으면(직접 고침 등) 덮어쓰지 않고 다음 요약 때 다시 압축
      if (r.memory !== snap) {}
      else if (c2 && typeof c2.memory === "string" && c2.memory.trim()) r.memory = c2.memory.trim().slice(0, cfg.limit);
      else r.memory = r.memory.slice(-cfg.limit);
    }
    saveRoom(r);
    if (manual) toast("장기기억을 업데이트했어요");
  } catch (e) { if (manual) toast("요약하지 못했어요. 잠시 뒤 다시 시도해 주세요."); }
  finally { summarizing = false; flagMemo(false); }
}
function flagMemo(on, txt) {
  $$(".memo-flag").forEach((x) => x.remove());
  if (on && $(".chat")) { const f = document.createElement("div"); f.className = "memo-flag"; f.textContent = txt; $(".chat").append(f); }
}
