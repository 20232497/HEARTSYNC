// 그림 총괄 페이지의 화면 — tools/art.mjs가 내주는 목록·작업으로 그림을 그리고(생성 서비스로 바로), 후처리·로고를 입혀 후보로 보관함에 쌓은 뒤 고른 것만 싣는다.
// 한 작품씩도, 모든 작품을 한꺼번에도 그린다(보이는 조건 — 안 실린 것·안 실린 1순위·전체 — 그대로). 후보는 보관함에 남아 다시 열어도 보인다.
// 생성 호출은 ./gen.js, 표지(한 장짜리·단체 합성·로고)는 ./cover.js, 보관함은 ./lib.js. 후처리는 화풍 보관함의 코드 그대로(/code/…). 생성 서비스가 노출로 판정한 그림은 실을 수 없다.
import { stylePost as postAnime } from "/code/post-anime.js";
import { stylePost as postDaily } from "/code/post-daily.js";
import { meta, spent, key, setKey, ready, generate, load, toBlob } from "/gen.js";
import { makeCover, hasParts, seatPanel } from "/cover.js";
import { api, cands, loadKept, addCand, dropCand, saveCand } from "/lib.js";
import { initSite, refreshSite } from "/site.js";

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
const KINDS = ["표지", "인물", "다른 모습", "장소", "컷씬", "세계관"];
const COVER_NAME = { close: "얼굴 가까이", scene: "한 명 + 배경", group: "단체(세 사람)", symbol: "상징물" };
const state = { works: [], id: "", filter: "todo", style: "", workers: 2, stop: false, busy: 0, batching: false, running: new Set(), vary: {}, msg: {} };

function showKey() {
  $("#keyState").textContent = meta.mock ? "연습 모드 — 생성 서비스를 부르지 않아요" : key() ? "키 있음" : "키 없음 — 그리려면 넣어 주세요";
  $("#keyState").className = meta.mock || key() ? "ok" : "warn";
  $("#cost").textContent = spent.usd ? `이번에 쓴 비용 약 $${spent.usd.toFixed(3)}` : "";
}
$("#keySave").addEventListener("click", () => {
  setKey($("#key").value.trim());
  $("#key").value = "";
  showKey();
});
$("#view").addEventListener("click", () => $("#view").classList.remove("on"));
const zoom = (src) => {
  $("#view img").src = src;
  $("#view").classList.add("on");
};
const keyOf = (work, row) => work.id + "/" + row.code;
const rowEl = (k) => (k.startsWith(state.id + "/") ? $(`#main .row[data-code="${CSS.escape(k.slice(state.id.length + 1))}"]`) : null);
/** 그 칸의 알림 — 화면에 그 칸이 없어도(다른 작품을 보는 중) 남겨 둔다 */
function say(k, text, cls) {
  state.msg[k] = { text, cls: cls || "dim" };
  const el = rowEl(k);
  if (el) paintMsg(el, k);
}
function paintMsg(el, k) {
  const m = state.msg[k] || { text: "", cls: "dim" };
  $(".msg", el).textContent = m.text;
  $(".msg", el).className = "msg " + m.cls;
}

/** 인물·장소 그림: 받은 그림 → 화풍 후처리 → 규격 크기의 webp */
async function finish(spec, raw) {
  const im = await load(await (spec.post === "anime" ? postAnime : postDaily)(raw, spec.job.post || {})),
    cv = document.createElement("canvas");
  cv.width = spec.size.w;
  cv.height = spec.size.h;
  const g = cv.getContext("2d");
  g.imageSmoothingQuality = "high";
  g.drawImage(im, 0, 0, cv.width, cv.height);
  URL.revokeObjectURL(im.src);
  return toBlob(cv);
}
/* ── 한 장 그리기 → 후보로(보관함에) */
async function make(work, row) {
  const k = keyOf(work, row);
  if (!ready()) return say(k, "생성 서비스 키를 먼저 넣어 주세요.", "warn");
  if (state.running.has(k)) return "skip"; // 같은 칸을 겹쳐 그리지 않는다(같은 시드로 두 번 사게 됨)
  state.running.add(k);
  // 보관함에 이미 후보가 있으면 그 수만큼 시드를 옮겨 시작한다(같은 그림을 다시 사지 않게)
  const vary = state.vary[k] === undefined ? (cands[k] || []).length : state.vary[k];
  state.vary[k] = vary + 1;
  state.busy++;
  say(k, vary ? `다시 그리는 중…(${vary + 1}번째)` : "그리는 중…");
  paintRow(k);
  try {
    const spec = await api(`/api/job?work=${encodeURIComponent(work.id)}&code=${encodeURIComponent(row.code)}&vary=${vary}&style=${state.style}`);
    let out;
    if (spec.cover) out = await makeCover(work, spec, (t) => say(k, t));
    else {
      const g = await generate(spec.job);
      out = { blob: await finish(spec, g.blob), nsfw: g.nsfw, seed: spec.job.seed };
    }
    await addCand(work, row, out.blob, { nsfw: out.nsfw, seed: out.seed });
    say(k, out.nsfw ? "생성 서비스가 노출로 판정했어요 — 이 그림은 실을 수 없어요." : "후보가 나왔어요. 크게 보고 괜찮으면 싣기.", out.nsfw ? "warn" : "");
  } catch (e) {
    const why = String((e && e.message) || e);
    state.vary[k] = vary; // 그리지 못했으니 시드를 넘기지 않는다 — 다시 누르면 같은 내용의 요청이 되어, 닿았는지 몰랐던 작업을 되찾는다(gen.js pending)
    say(k, "실패: " + why, "warn");
    // 실패한 까닭을 보관함 기록에 남긴다(남기지 못해도 그만)
    const at = `work=${encodeURIComponent(work.id)}&code=${encodeURIComponent(row.code)}`;
    api("/api/fail?" + at, { method: "POST", headers: { "x-hs-art": "1", "content-type": "text/plain" }, body: why }).catch(() => {});
    if (/fund|balance|credit|insufficient|auth|api.?key|HTTP 40[123]/i.test(String(e && e.message))) state.stop = true; // 잔액·키 문제면 이어 그리기를 멈춤
  } finally {
    state.busy--;
    state.running.delete(k);
    paintRow(k);
    showKey();
  }
}
/** 여러 칸을 차례로(동시에 state.workers장) — pairs: [[작품, 칸]…]. confirmed가 없으면 비용을 알리고 묻는다 */
async function batch(pairs, o = {}) {
  if (!pairs.length) return ($("#batchMsg").textContent = "그릴 칸이 없어요.");
  if (!ready()) return ($("#batchMsg").textContent = "생성 서비스 키를 먼저 넣어 주세요.");
  // 단체 표지는 조각 넷(키워 다시 그리기 포함)에 오리기·잇기까지 — 대략 다섯 장 값. 일상 화풍에서 밑그림을 거치는 칸(남성 인물의 감정 그림 등)은 두 장 값
  const units = pairs.reduce((n, [w, r]) => n + (r.spec === "cover" && w.cover === "group" ? 5 : r.guide && (state.style || w.style) === "daily" ? 2 : 1), 0);
  const ask = meta.mock
    ? `${pairs.length}칸을 연습 모드로 돌려요(비용 0). 계속할까요?`
    : `${pairs.length}칸을 그려요. 실제 생성 비용이 들어요(대략 ${units}장 값 — 한 장에 1~2센트). 계속할까요?`;
  if (state.batching) return ($("#batchMsg").textContent = "이미 여러 칸을 그리는 중이에요 — 끝나거나 멈춘 뒤에 다시 눌러 주세요.");
  if (!o.confirmed && !confirm(ask)) return;
  state.batching = true;
  state.stop = false;
  let i = 0,
    done = 0,
    skipped = 0;
  const next = async () => {
    while (i < pairs.length && !state.stop) {
      const [w, r] = pairs[i++];
      if ((await make(w, r)) === "skip")
        skipped++; // 따로 그리는 중이던 칸 — 끝난 것으로 세지 않는다
      else done++;
      $("#batchMsg").textContent = `${done}/${pairs.length}칸`;
      renderWorks();
    }
  };
  $("#batchMsg").textContent = `0/${pairs.length}칸`;
  try {
    await Promise.all(Array.from({ length: Math.max(1, Math.min(3, state.workers)) }, next));
  } finally {
    state.batching = false;
  }
  const note = skipped ? ` · 따로 그리던 ${skipped}칸은 건너뜀` : "";
  $("#batchMsg").textContent = (state.stop ? `멈췄어요(${done}/${pairs.length}칸)` : `끝 — ${done}칸. 후보를 보고 실어 주세요`) + note;
}
const shown = (r) => (state.filter === "all" ? true : state.filter === "rank1" ? !r.has && r.rank === 1 : !r.has);
const todo = (w) => w.rows.filter((r) => shown(r) && r.can).map((r) => [w, r]);

/* ── 화면 */
const count = (w) => ({
  need: w.rows.length,
  has: w.rows.filter((r) => r.has).length,
  left1: w.rows.filter((r) => !r.has && r.rank === 1).length,
  cand: w.rows.filter((r) => (cands[keyOf(w, r)] || []).length).length
});
function renderWorks() {
  const box = $("#works"),
    all = state.works.map(count),
    sum = (f) => all.reduce((n, c) => n + c[f], 0);
  $("#total").textContent = `전체 실림 ${sum("has")}/${sum("need")} · 남은 1순위 ${sum("left1")} · 후보가 있는 칸 ${sum("cand")}`;
  box.innerHTML = state.works
    .map((w, i) => {
      const n = all[i];
      return `<button class="work${w.id === state.id ? " on" : ""}" data-id="${esc(w.id)}"><b>${esc(w.title)}</b><small class="dim">${esc(w.style === "anime" ? "애니" : "일상")} · 실림 ${n.has}/${n.need} · 남은 1순위 ${n.left1}${n.cand ? ` · 후보 ${n.cand}칸` : ""}</small></button>`;
    })
    .join("");
  box.querySelectorAll(".work").forEach((b) => b.addEventListener("click", () => ((state.id = b.dataset.id), renderWorks(), renderMain())));
}
function setThumb(el, row) {
  const t = $(".thumb", el),
    src = row.has ? "/file?path=" + encodeURIComponent(row.path) + "&t=" + Date.now() : "";
  t.style.backgroundImage = src ? `url("${src}")` : "";
  t.textContent = src ? "" : "없음";
  t.onclick = src ? () => zoom(src) : null;
  $(".state", el).textContent = row.has ? "실림" : "안 실림";
  $(".state", el).className = "state " + (row.has ? "ok" : "dim");
}
/** 한 칸의 후보·단추·알림을 다시 그린다(그 칸이 화면에 있을 때만) */
function paintRow(k) {
  const el = rowEl(k);
  if (!el) return;
  const w = state.works.find((x) => x.id === state.id),
    row = w.rows.find((r) => r.code === el.dataset.code);
  setThumb(el, row);
  paintMsg(el, k);
  const b = $(".draw", el);
  if (b) b.textContent = (cands[k] || []).length ? "다시 그리기" : "그리기";
  const box = $(".cands", el);
  box.innerHTML = "";
  for (const c of cands[k] || []) {
    const d = document.createElement("div");
    d.className = "cand";
    d.innerHTML = `<img alt="후보"><button class="main put"${c.nsfw || meta.mock ? " disabled" : ""}>싣기</button><button class="drop">버리기</button>`;
    $("img", d).src = c.url;
    $("img", d).addEventListener("click", () => zoom(c.url));
    $(".put", d).addEventListener("click", async () => {
      try {
        const r = await saveCand(w, row, c);
        row.has = true; // 썸네일은 작품 폴더에 실린 파일로 보여 준다(후보를 버려도 깨지지 않게)
        say(k, `실었어요 — ${r.path} (${Math.round(r.bytes / 1024)}KB). npm run build 뒤에 사이트에 들어가요.`, "ok");
        renderWorks();
        paintRow(k);
        refreshSite(); // 올릴 그림 수가 바뀜
      } catch (e) {
        say(k, "싣기 실패: " + ((e && e.message) || e), "warn");
      }
    });
    $(".drop", d).addEventListener("click", async () => {
      try {
        await dropCand(k, c);
        paintRow(k);
        renderWorks();
      } catch (e) {
        say(k, "버리기 실패: " + ((e && e.message) || e), "warn");
      }
    });
    box.append(d);
  }
  const seat = $(".seatBtn", el);
  if (seat) seat.hidden = !hasParts(w);
}
function renderMain() {
  const w = state.works.find((x) => x.id === state.id),
    main = $("#main");
  if (!w) return (main.innerHTML = '<p class="dim">왼쪽에서 작품을 골라 주세요.</p>');
  const rows = w.rows.filter(shown);
  main.innerHTML =
    `<div class="bar"><b>${esc(w.title)}</b><span class="dim">${esc(w.id)} · 인물 그림 ${w.style === "anime" ? "남성향 애니" : "일상"} · 표지 ${esc(COVER_NAME[w.cover] || w.cover)}${w.lead ? "(" + esc(w.lead) + ")" : ""}${w.logo ? "" : " · 로고 설계 없음"}</span>` +
    `<button id="batch" class="main">이 작품의 보이는 것 모두 그리기</button></div>` +
    KINDS.map((k) => {
      const list = rows.filter((r) => r.kind === k);
      if (!list.length) return "";
      return `<h2>${esc(k)} <span class="dim">${list.length}장</span></h2><div class="rows">${list.map((r) => rowHTML(w, r)).join("")}</div>`;
    }).join("") +
    (rows.length ? "" : '<p class="dim">여기에 보일 그림이 없어요.</p>');
  main.querySelectorAll(".row").forEach((el) => {
    const row = w.rows.find((r) => r.code === el.dataset.code),
      k = keyOf(w, row);
    paintRow(k);
    const b = $(".draw", el);
    if (b) b.addEventListener("click", () => make(w, row));
    const s = $(".seatBtn", el);
    if (s)
      s.addEventListener("click", async () => {
        const box = $(".panel", el);
        box.hidden = false;
        try {
          const spec = await api(`/api/job?work=${encodeURIComponent(w.id)}&code=${encodeURIComponent(row.code)}`);
          await seatPanel(w, box, spec.plan, async (out) => {
            await addCand(w, row, out.blob, { nsfw: out.nsfw, seed: out.seed });
            paintRow(k);
            showKey();
          });
        } catch (e) {
          box.textContent = "자리 맞추기를 열지 못했어요: " + ((e && e.message) || e);
        }
      });
  });
  $("#batch").addEventListener("click", () => batch(todo(w)));
}
const rowHTML = (w, r) =>
  `<div class="row" data-code="${esc(r.code)}"><div class="head"><div class="thumb"></div><div class="info"><b>${esc(r.code)} · ${esc(r.name)}</b>` +
  `<span class="dim">${r.rank}순위 · ${r.size.w}×${r.size.h}${r.hidden ? " · 비공개" : ""} · </span><span class="state"></span>` +
  `<div class="acts">${r.can ? '<button class="draw">그리기</button>' : `<span class="dim">${r.tags ? "이 종류는 아직 그리는 규칙이 없어요" : "그림용 태그가 없어요"}</span>`}` +
  `${r.spec === "cover" && w.cover === "group" ? '<button class="seatBtn" hidden>자리 맞추기</button>' : ""}</div></div></div>` +
  `<div class="cands"></div><div class="msg dim"></div><div class="panel" hidden></div></div>`;

$("#filter").addEventListener("change", (e) => ((state.filter = e.target.value), renderMain()));
$("#style").addEventListener("change", (e) => (state.style = e.target.value));
$("#workers").addEventListener("change", (e) => (state.workers = +e.target.value || 2));
$("#halt").addEventListener("click", () => ((state.stop = true), ($("#batchMsg").textContent = "멈추는 중 — 그리던 것까지만")));
$("#batchAll").addEventListener("click", () => batch(state.works.flatMap(todo)));
// 세션(브라우저 창을 다루는 도구)에서 부를 때: art.run((작품, 칸) => 조건, { confirmed: true }) — 돈이 드는 호출이라 사용자 승인을 받은 뒤에만 confirmed를 넘긴다
window.art = {
  state,
  cands,
  run: (pick, o) =>
    batch(
      state.works.flatMap((w) => w.rows.filter((r) => r.can && (!pick || pick(w, r))).map((r) => [w, r])),
      o
    ),
  stop: () => (state.stop = true)
};

try {
  Object.assign(meta, await api("/api/meta"));
  showKey();
  $("#lib").textContent = "보관함: " + meta.lib;
  state.works = await api("/api/works");
  await loadKept();
  state.id = (state.works[0] || {}).id || "";
  renderWorks();
  renderMain();
  // 올리기가 끝나면 실린 표시를 다시 읽는다
  initSite(async () => {
    state.works = await api("/api/works");
    renderWorks();
    renderMain();
  });
} catch (e) {
  $("#main").innerHTML = `<p class="warn">${esc((e && e.message) || e)}</p>`;
}
