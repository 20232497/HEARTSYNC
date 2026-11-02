/* ---------------------------------------------------------------- 앱 상태 */
const S = {
  wallet: { hearts: 0, freeDay: today(), freeUsed: 0, pro: null, history: [], ledger: [], ack: {} },
  personas: [{ id: "p1", name: "유저", memo: "", desc: "", img: "", def: true }],
  profile: { nick: "" }, mine: [], rooms: [], community: [], imgpacks: {}, coverpacks: {}, lorepacks: {}, tagpacks: {},
  settings: { fs: 15.5, chatLh: 1.8, narrFont: "serif", enterSend: true, sceneImg: true, apiKey: "", runwareKey: "", customSits: [], imgModel: IMG_MODELS[0].id, imgStyle: "webtoon", imgStyleCustom: "", styleRefs: [], styleSets: [], styleV2: true, memCfg: { auto: true, every: 5, limit: 3000, guide: "auto", custom: "" },
    // 성인 모드: 자기 확인(isAgeVerified) 전에는 모두 꺼진 것과 같음. contentFilter false면 모든 대화방이 성인 모드
    isAgeVerified: false, contentFilter: true, autoFallback: true, openRouterKey: "", unfilteredModels: { ...OR_TIER }, customUnfilteredModel: "" },
  engine: "pending", cat: "전체", q: ""
};
let SAMPLE = null, samplePromise = null, DB = null, DOWNLOADS = null;
let room = null, gen = null;

function isPro() { return !!(S.wallet.pro && S.wallet.pro.until > Date.now()); }
function plan() { return isPro() ? PLAN.pro : PLAN.free; }
function refreshFree() { if (S.wallet.freeDay !== today()) { S.wallet.freeDay = today(); S.wallet.freeUsed = 0; } }
function freeLeft() { refreshFree(); return Math.max(0, FREE_DAILY - S.wallet.freeUsed); }
function saveWallet() { KV.set("wallet", S.wallet); renderWalletChips(); }
function ledger(d, label) { S.wallet.ledger.unshift({ at: Date.now(), d, label }); S.wallet.ledger = S.wallet.ledger.slice(0, 80); }

/* 가격: 모델 기본가 × 출력량 + 기억력 가산. 무료 턴은 라이트 모델에만, PLUS는 라이트 무제한·나머지 50% */
function listPrice(model, len, mem) {
  const m = MODELS[model] || MODELS.lite;
  return Math.max(1, Math.ceil(m.base * (LEN[len] || LEN.mid).mul) + Math.max(0, Math.ceil((mem - 10) / 10)) * m.memStep);
}
function quote(set) {
  const list = listPrice(set.model, set.len, set.mem);
  if (isPro()) return set.model === "lite" ? { type: "plus", n: 0, list } : { type: "heart", n: Math.ceil(list / 2), list };
  if (set.model === "lite" && freeLeft() > 0) return { type: "free", n: 0, list };
  return { type: "heart", n: list, list };
}
function qShort(q) { return q.type === "free" ? "무료" : q.type === "plus" ? "PLUS" : "♥" + q.n; }
function charge(q, label) {
  if (q.type === "free") { S.wallet.freeUsed++; ledger(0, label + " · 무료 턴"); }
  else if (q.type === "heart") { S.wallet.hearts -= q.n; ledger(-q.n, label); }
  else ledger(0, label + " · PLUS");
  saveWallet();
}
function refund(q, label) {
  if (q.type === "free") S.wallet.freeUsed = Math.max(0, S.wallet.freeUsed - 1);
  else if (q.type === "heart") { S.wallet.hearts += q.n; ledger(q.n, label + " · 실패 환불"); }
  saveWallet();
}

/* ---------------------------------------------------------------- 캐릭터·커버·이미지 */
function normalizeChar(c) {
  if (!c) return c;
  if (!Array.isArray(c.fields) || !c.fields.length) c.fields = ["호감도", "속마음"];
  if (!c.gauge) c.gauge = c.fields[0];
  if (!Array.isArray(c.cast) || !c.cast.length) c.cast = [{ code: "c", name: c.name, look: "" }];
  if (!c.images || typeof c.images !== "object") c.images = {};
  if (!Array.isArray(c.lore)) c.lore = [];
  return c;
}
function allChars() { return [...S.mine, ...ORIGINALS, ...S.community.filter((c) => !S.mine.some((m) => m.id === c.id))]; }
function getChar(id) { return S.mine.find((c) => c.id === id) || ORIGINALS.find((c) => c.id === id) || S.community.find((c) => c.id === id); }
function coverHTML(c, cls = "", opts = {}) {
  const pal = PALETTES[c.pal] || PALETTES[0], img = IMG.tag(S.coverpacks[c.charId || c.id] || c.img);
  const motif = MOTIFS[c.motif] ? c.motif : "glow";
  return `<div class="cover m-${motif} ${img ? "has-img" : ""} ${cls}" style="--c1:${pal[0]};--c2:${pal[1]};--c3:${pal[2]}" aria-hidden="true">${img}` +
    `<span class="glyph">${esc((c.glyph || c.name || "?").slice(0, 1))}</span>` +
    (opts.vt ? `<span class="vt">${esc(c.title)}</span>` : "") + (opts.cat ? `<span class="cat">${esc(c.cat)}</span>` : "") + `</div>`;
}
function imagesOf(c) {
  const live = getChar(c.id) || c, base = live.images || c.images || {}, over = S.imgpacks[c.id] || {};
  const out = {};
  for (const x of c.cast || []) out[x.code] = { ...(base[x.code] || {}), ...(over[x.code] || {}) };
  return out;
}
function pickImg(c, code, sit) {
  const m = imagesOf(c)[code] || {};
  return [m[sit], m[1], m[0]].find(validRef) || null;
}
function artHTML(c, cast, sit) {
  const pal = PALETTES[c.pal] || PALETTES[0];
  return `<div class="artcard" style="--c1:${pal[0]};--c2:${pal[1]};--c3:${pal[2]};--tint:${SIT_TINT[sit] || "#fff"}"><span class="ac-g">${esc((cast.name || "?").slice(0, 1))}</span><span class="ac-s">${esc(sitName(sit))}</span><span class="ac-n">${esc(cast.name)}</span></div>`;
}
function figHTML(c, code, sit) {
  const cast = (c.cast || []).find((x) => x.code === code); if (!cast) return "";
  sit = sit | 0; if (sit < 0 || (sit >= SIT.length && !sitDef(sit))) sit = 1; // 모르는 번호는 기본 칸으로
  const ref = pickImg(c, code, sit);
  return ref ? `<figure class="scene-img" data-code="${code}" data-sit="${sit}">${IMG.tag(ref)}<figcaption>${esc(cast.name)} · ${esc(sitName(sit))}</figcaption></figure>`
    : `<figure class="scene-img" data-code="${code}" data-sit="${sit}">${artHTML(c, cast, sit)}</figure>`;
}
function portraitHTML(c, cast) {
  const ref = pickImg(c, cast.code, 0);
  return `<div class="portrait thumb-art">${ref ? IMG.tag(ref) : artHTML(c, cast, 0)}</div>`;
}
function imgTags(text) { return [...String(text).matchAll(/\[\[img:([a-z0-9]+):(\d{1,2})\]\]/gi)].map((m) => ({ code: m[1].toLowerCase(), sit: +m[2] })); }
function lightbox(src) {
  const lb = document.createElement("div"); lb.className = "lightbox"; lb.innerHTML = `<img src="${esc(src)}" alt="확대 이미지">`;
  lb.onclick = () => lb.remove(); document.body.append(lb);
}
