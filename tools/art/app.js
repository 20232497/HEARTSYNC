// 그림 관리 페이지의 화면 — tools/art.mjs가 내주는 목록·작업으로 그림을 그리고(생성 서비스로 바로), 후처리·로고를 입혀 후보로 보여 준 뒤 고른 것만 싣는다.
// 키는 이 브라우저의 localStorage에만 두고 생성 서비스(api.runware.ai)로만 보낸다 — 서버(tools/art.mjs)와 저장소에는 가지 않는다.
// 후처리와 로고는 화풍 보관함의 코드 그대로(/code/…). 생성 서비스가 노출로 판정한 그림은 실을 수 없다.
import { stylePost as postAnime } from "/code/post-anime.js";
import { stylePost as postDaily } from "/code/post-daily.js";
import { coverPost } from "/code/cover-post.js";
import { drawLogo, loadLogoFonts } from "/code/logo.js";
import { LOGOS } from "/code/logos.js";

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
const KEY = "hs_art_runware_key";
const API = "https://api.runware.ai/v1";
const KINDS = ["표지", "인물", "다른 모습", "장소", "컷씬", "세계관"];
const state = { works: [], id: "", filter: "todo", busy: 0, stop: false, cost: 0, vary: {} };

const key = () => {
  try {
    return localStorage.getItem(KEY) || "";
  } catch {
    return "";
  }
};
function showKey() {
  $("#keyState").textContent = key() ? "키 있음" : "키 없음 — 그리려면 넣어 주세요";
  $("#keyState").className = key() ? "ok" : "warn";
  $("#cost").textContent = state.cost ? `이번에 쓴 비용 약 $${state.cost.toFixed(3)}` : "";
}
$("#keySave").addEventListener("click", () => {
  const v = $("#key").value.trim();
  try {
    if (v) localStorage.setItem(KEY, v);
    else localStorage.removeItem(KEY);
  } catch {
    /* 저장이 막힌 브라우저 — 표시만 */
  }
  $("#key").value = "";
  showKey();
});
$("#view").addEventListener("click", () => $("#view").classList.remove("on"));
const zoom = (src) => {
  $("#view img").src = src;
  $("#view").classList.add("on");
};

/* ── 생성 서비스 호출: 밑그림(guide)이 있으면 먼저 그려 본 그림의 밑그림으로, hires가 있으면 키워 다시 그림 */
async function infer(j, extra) {
  const task = {
    taskType: "imageInference",
    taskUUID: crypto.randomUUID(),
    positivePrompt: j.pos,
    negativePrompt: j.neg,
    model: j.model,
    width: j.width,
    height: j.height,
    numberResults: 1,
    steps: j.steps,
    CFGScale: j.cfg,
    scheduler: j.scheduler,
    seed: j.seed,
    outputFormat: "WEBP",
    outputType: "dataURI",
    checkNSFW: true,
    includeCost: true,
    ...(j.lora && j.lora.length ? { lora: j.lora } : {}),
    ...(/\([^()]+:\d/.test(j.pos + j.neg) ? { promptWeighting: "sdEmbeds" } : {}),
    ...extra
  };
  for (let t = 0; ; t++) {
    const r = await fetch(API, { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + key() }, body: JSON.stringify([task]) });
    const d = await r.json().catch(() => ({})),
      e = (d.errors || [])[0];
    if (e && /failedModelLoad|inferenceError/i.test(String(e.code)) && t === 0) {
      task.taskUUID = crypto.randomUUID(); // 가끔 나는 일시 오류 — 한 번만 다시
      continue;
    }
    if (e || !r.ok) throw new Error(e ? [e.code, e.message].filter(Boolean).join(" — ") : "HTTP " + r.status);
    const x = (d.data || []).find((o) => o.taskType === "imageInference");
    if (!x) throw new Error("그림이 오지 않았어요");
    state.cost += x.cost || 0;
    return x;
  }
}
async function generate(j) {
  let nsfw = false,
    seedImage;
  if (j.guide) {
    const g = await infer(j.guide.job);
    nsfw = nsfw || !!g.NSFWContent;
    seedImage = g.imageDataURI;
  }
  let x = await infer(j, seedImage ? { seedImage, strength: j.guide.strength } : {});
  nsfw = nsfw || !!x.NSFWContent;
  if (j.hires) {
    x = await infer(j, { seedImage: x.imageDataURI, strength: j.hires.strength, width: j.hires.w, height: j.hires.h });
    nsfw = nsfw || !!x.NSFWContent;
  }
  return { blob: await (await fetch(x.imageDataURI)).blob(), nsfw };
}
const load = (blob) =>
  new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("그림을 읽지 못했어요"));
    i.src = URL.createObjectURL(blob);
  });
/** 받은 그림 → 화풍 후처리 → (표지) 표지 후처리와 로고 → 규격 크기의 webp */
async function finish(work, row, spec, raw) {
  const styled = await (spec.post === "anime" ? postAnime : postDaily)(raw, spec.job.post || {});
  const im = await load(styled);
  let cv;
  if (spec.cover) {
    cv = coverPost(im, work.pal, work.motif);
    if (LOGOS[work.id]) {
      await loadLogoFonts();
      await drawLogo(cv, LOGOS[work.id], work.pal);
    }
  } else {
    cv = document.createElement("canvas");
    cv.width = spec.size.w;
    cv.height = spec.size.h;
    const g = cv.getContext("2d");
    g.imageSmoothingQuality = "high";
    g.drawImage(im, 0, 0, cv.width, cv.height);
  }
  URL.revokeObjectURL(im.src);
  return await new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error("webp로 바꾸지 못했어요"))), "image/webp", 0.9));
}

/* ── 한 장 그리기 → 후보로 */
async function draw(work, row, el) {
  if (!key()) return say(el, "생성 서비스 키를 먼저 넣어 주세요.", "warn");
  const k = work.id + "/" + row.code,
    vary = state.vary[k] || 0;
  state.vary[k] = vary + 1;
  state.busy++;
  say(el, vary ? `다시 그리는 중…(${vary + 1}번째)` : "그리는 중…");
  $(".draw", el).disabled = true;
  try {
    const spec = await api(`/api/job?work=${encodeURIComponent(work.id)}&code=${encodeURIComponent(row.code)}&vary=${vary}`);
    const out = await generate(spec.job);
    const blob = await finish(work, row, spec, out.blob);
    addCand(work, row, el, blob, out.nsfw);
    say(el, out.nsfw ? "생성 서비스가 노출로 판정했어요 — 이 그림은 실을 수 없어요." : "후보가 나왔어요. 크게 보고 괜찮으면 싣기.", out.nsfw ? "warn" : "");
  } catch (e) {
    say(el, "실패: " + ((e && e.message) || e), "warn");
    if (/fund|balance|credit|insufficient|auth|api.?key/i.test(String(e && e.message))) state.stop = true; // 잔액·키 문제면 이어 그리기를 멈춤
  } finally {
    state.busy--;
    $(".draw", el).disabled = false;
    $(".draw", el).textContent = "다시 그리기";
    showKey();
  }
}
function addCand(work, row, el, blob, nsfw) {
  const url = URL.createObjectURL(blob),
    box = document.createElement("div");
  box.className = "cand";
  box.innerHTML = `<img alt="후보"><button class="main"${nsfw ? " disabled" : ""}>싣기</button>`;
  $("img", box).src = url;
  $("img", box).addEventListener("click", () => zoom(url));
  $("button", box).addEventListener("click", async () => {
    try {
      const r = await fetch(`/api/save?work=${encodeURIComponent(work.id)}&code=${encodeURIComponent(row.code)}`, { method: "POST", headers: { "x-hs-art": "1", "content-type": "image/webp" }, body: blob });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "HTTP " + r.status);
      row.has = true;
      row.saved = url;
      setThumb(el, row);
      say(el, `실었어요 — ${d.path} (${Math.round(d.bytes / 1024)}KB). npm run build 뒤에 사이트에 들어가요.`, "ok");
      renderWorks();
    } catch (e) {
      say(el, "싣기 실패: " + ((e && e.message) || e), "warn");
    }
  });
  $(".cands", el).prepend(box);
}
const say = (el, text, cls) => {
  const m = $(".msg", el);
  m.textContent = text;
  m.className = "msg " + (cls || "dim");
};
const api = async (url) => {
  const r = await fetch(url),
    d = await r.json();
  if (!r.ok) throw new Error(d.error || "HTTP " + r.status);
  return d;
};

/* ── 화면 */
const count = (w) => ({ need: w.rows.length, has: w.rows.filter((r) => r.has).length, left1: w.rows.filter((r) => !r.has && r.rank === 1).length });
function renderWorks() {
  const box = $("#works");
  box.innerHTML = state.works
    .map((w) => {
      const n = count(w);
      return `<button class="work${w.id === state.id ? " on" : ""}" data-id="${esc(w.id)}"><b>${esc(w.title)}</b><small class="dim">${esc(w.style === "anime" ? "애니" : "일상")} · 실림 ${n.has}/${n.need} · 남은 1순위 ${n.left1}</small></button>`;
    })
    .join("");
  box.querySelectorAll(".work").forEach((b) => b.addEventListener("click", () => ((state.id = b.dataset.id), renderWorks(), renderMain())));
}
const shown = (r) => (state.filter === "all" ? true : state.filter === "rank1" ? !r.has && r.rank === 1 : !r.has);
function setThumb(el, row) {
  const t = $(".thumb", el),
    src = row.saved || (row.has ? "/file?path=" + encodeURIComponent(row.path) + "&t=" + Date.now() : "");
  t.style.backgroundImage = src ? `url("${src}")` : "";
  t.textContent = src ? "" : "없음";
  t.onclick = src ? () => zoom(src) : null;
  $(".state", el).textContent = row.has ? "실림" : "안 실림";
  $(".state", el).className = "state " + (row.has ? "ok" : "dim");
}
function renderMain() {
  const w = state.works.find((x) => x.id === state.id),
    main = $("#main");
  if (!w) return (main.innerHTML = '<p class="dim">왼쪽에서 작품을 골라 주세요.</p>');
  const rows = w.rows.filter(shown);
  main.innerHTML =
    `<div class="bar"><b>${esc(w.title)}</b><span class="dim">${esc(w.id)} · ${w.style === "anime" ? "남성향 애니" : "일상"} · 표지 대표 ${esc(w.lead || "-")}${w.logo ? "" : " · 로고 설계 없음"}</span>` +
    `<select id="filter"><option value="todo">안 실린 것</option><option value="rank1">안 실린 1순위</option><option value="all">전체</option></select>` +
    `<button id="batch" class="main">보이는 것 모두 그리기</button><button id="halt">멈춤</button><span id="batchMsg" class="dim"></span></div>` +
    KINDS.map((k) => {
      const list = rows.filter((r) => r.kind === k);
      if (!list.length) return "";
      return `<h2>${esc(k)} <span class="dim">${list.length}장</span></h2><div class="rows">${list.map((r) => rowHTML(r)).join("")}</div>`;
    }).join("") +
    (rows.length ? "" : '<p class="dim">여기에 보일 그림이 없어요.</p>');
  $("#filter").value = state.filter;
  $("#filter").addEventListener("change", (e) => ((state.filter = e.target.value), renderMain()));
  main.querySelectorAll(".row").forEach((el) => {
    const row = w.rows.find((r) => r.code === el.dataset.code);
    setThumb(el, row);
    const b = $(".draw", el);
    if (b) b.addEventListener("click", () => draw(w, row, el));
  });
  $("#halt").addEventListener("click", () => ((state.stop = true), ($("#batchMsg").textContent = "멈추는 중 — 그리던 것까지만")));
  $("#batch").addEventListener("click", () => batch(w));
}
const rowHTML = (r) =>
  `<div class="row" data-code="${esc(r.code)}"><div class="head"><div class="thumb"></div><div class="info"><b>${esc(r.code)} · ${esc(r.name)}</b>` +
  `<span class="dim">${r.rank}순위 · ${r.size.w}×${r.size.h}${r.hidden ? " · 비공개" : ""} · </span><span class="state"></span>` +
  `<div class="acts">${r.can ? '<button class="draw">그리기</button>' : `<span class="dim">${r.tags ? "이 종류는 아직 그리는 규칙이 없어요" : "그림용 태그가 없어요"}</span>`}</div></div></div>` +
  `<div class="cands"></div><div class="msg dim"></div></div>`;
/** 보이는 것 가운데 그릴 수 있는 칸을 차례로(두 장씩) — 한 칸에 후보 하나 */
async function batch(w) {
  const els = [...document.querySelectorAll("#main .row")].filter((el) => $(".draw", el));
  if (!els.length) return;
  const cost = els.length;
  if (!confirm(`${cost}장을 그려요. 실제 생성 비용이 들어요(한 장에 대략 1~2센트). 계속할까요?`)) return;
  state.stop = false;
  let i = 0,
    done = 0;
  const next = async () => {
    while (i < els.length && !state.stop) {
      const el = els[i++];
      await draw(w, w.rows.find((r) => r.code === el.dataset.code), el);
      $("#batchMsg").textContent = `${++done}/${els.length}장`;
    }
  };
  await Promise.all([next(), next()]);
  $("#batchMsg").textContent = state.stop ? `멈췄어요(${done}/${els.length}장)` : `끝 — ${done}장. 후보를 보고 실어 주세요`;
}

showKey();
try {
  state.works = await api("/api/works");
  state.id = (state.works[0] || {}).id || "";
  renderWorks();
  renderMain();
} catch (e) {
  $("#main").innerHTML = `<p class="warn">${esc((e && e.message) || e)}</p>`;
}
