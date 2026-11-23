// 그림 총괄 페이지의 표지 만들기 — 표지 규칙(archive/style-works)의 계획대로 그리고, 표지 후처리와 로고를 입힌다.
// 한 장짜리(가까이·한 명 + 배경·상징물)는 그려서 바로 입히고, 단체는 배경과 인물 셋을 따로 그려 인물의 배경을 지우고 얹은 뒤 전체를 아주 약하게 다시 그려 잇는다.
// 단체의 조각(배경·오린 인물)은 보관함에 남겨, 자리(머리 크기·좌우 뒤집기)를 고쳐 다시 붙일 때 다시 그리지 않는다 — 다시 붙이기는 잇는 호출 한 번만 든다.
import { coverPost } from "/code/cover-post.js";
import { composeGroup, measure, COMP_W, COMP_H } from "/code/compose.js";
import { drawLogo, loadLogoFonts, missingFonts } from "/code/logo.js";
import { LOGOS, LOGO_SHADE } from "/code/logos.js";
import { generate, removeBg, unify, load, toBlob } from "/gen.js";
import { parts, savePart, libUrl } from "/lib.js";

const ROLES = ["bg", "left", "mid", "right"],
  NAMES = { bg: "배경", left: "왼쪽", mid: "가운데", right: "오른쪽" };
/** 작품마다 붙일 준비가 된 단체 표지: { plan, imgs: { bg, left, mid, right }, layout(고친 자리 값) } */
const groups = {};
/** 작품마다 그리다 만 단체 표지: { plan(처음 받은 계획), files: { "<자리>-raw.webp"·"<자리>-cut.png": blob }, imgs } — 조각이 보관함에 다 들어가면 지운다(이 페이지를 닫으면 사라짐) */
const drafts = {};

/** 후처리 → 로고 → 규격 크기의 webp. 로고 글꼴을 못 불러왔으면 던진다(기본 글꼴로 그려진 표지는 쓰지 않는다) */
async function dress(work, img, post) {
  const cv = coverPost(img, post);
  if (LOGOS[work.id]) {
    await loadLogoFonts();
    await drawLogo(cv, LOGOS[work.id], work.logoPal, LOGO_SHADE);
    if (missingFonts().length) throw new Error("로고 글꼴을 불러오지 못했어요(인터넷 연결 확인): " + missingFonts().join(", "));
  }
  return toBlob(cv);
}
/** 표지 한 장을 만든다 — spec은 서버의 /api/job 결과({ plan }), say는 진행 알림 */
export async function makeCover(work, spec, say) {
  const p = spec.plan;
  if (p.type !== "group") {
    const out = await generate(p.job);
    return { blob: await dress(work, await load(out.blob), p.post), nsfw: out.nsfw, seed: p.job.seed };
  }
  // 그리다가 실패하면(연결 끊김 등) 그때까지 그린 조각은 drafts에 남는다 → 다시 누르면 그 조각은 다시 사지 않고 이어 그린다.
  // 이어 그릴 때는 처음 받은 계획(d.plan)을 그대로 쓴다 — 누를 때마다 시드가 바뀐 새 계획이 오는데, 섞으면 조각마다 시드가 달라진다
  const d = (drafts[work.id] = drafts[work.id] || { plan: p, files: {}, imgs: {} }),
    { imgs, files, plan } = d,
    layout = structuredClone(plan.layout);
  for (const role of ROLES) {
    const n = ROLES.indexOf(role) + 1,
      raw = role + "-raw.webp",
      cut = role + "-cut.png";
    if (!files[raw]) {
      say(`단체 표지 — ${NAMES[role]} 그리는 중…(조각 넷 가운데 ${n})`);
      const out = await generate(plan.parts[role]);
      if (out.nsfw) {
        // 노출로 판정된 조각이 나오면 거기서 끝낸다 — 나머지 조각에 돈을 더 쓰지 않고, 조각을 남기지도 잇지도 않는다(그 그림만 이번 화면에 보여 줌)
        delete drafts[work.id];
        return { blob: out.blob, nsfw: true, seed: plan.final.seed };
      }
      files[raw] = out.blob;
    } else if (!imgs[role]) say(`단체 표지 — ${NAMES[role]}: 지난번에 그려 둔 그림을 이어서 써요(조각 넷 가운데 ${n})`);
    if (!imgs[role]) {
      const name = role === "bg" ? raw : cut;
      if (role !== "bg" && !files[cut]) files[cut] = await removeBg(files[raw]);
      try {
        imgs[role] = await load(files[name]);
      } catch (e) {
        delete files[name]; // 깨진 그림은 남기지 않는다 — 다시 누르면 그 단계부터 다시(배경은 다시 그리고, 인물은 오리기만 다시)
        throw e;
      }
    }
    // 새로 그린 그림이라 계획에 적힌 머리 자리(확정 그림에서 잰 값)는 맞지 않는다 → 이 그림에서 어림
    if (role !== "bg") layout.chars.find((c) => c.role === role).head = measure(imgs[role]);
  }
  // 조각은 넷이 다 그려진 뒤에 한꺼번에 보관함에 — 중간에 실패하면 예전 조각 묶음이 그대로 남는다(새것과 섞이지 않게)
  // 첫 조각을 쓸 때 예전 묶음을 지운다(fresh) — 쓰는 도중에 실패해도 예전 조각과 섞이지 않고, 초안이 남아 있어 다시 누르면 이어서 쓴다
  const all = Object.entries(files),
    bundle = (d.bundle = d.bundle || crypto.randomUUID()); // 쓰다 실패한 뒤 다시 누르면 같은 번호로 이어 쓴다
  for (const [i, [name, blob]] of all.entries()) await savePart(work, name, blob, { bundle, fresh: i === 0, last: i === all.length - 1 });
  groups[work.id] = { plan, imgs, layout };
  delete drafts[work.id]; // 조각이 보관함에 다 들어갔다 — 여기서부터의 실패(잇기)는 '자리 맞추기'에서 보관함의 조각으로 다시 붙이면 된다
  say("단체 표지 — 붙이고 잇는 중…");
  return finishGroup(work);
}
/** 붙인 그림을 이어 표지로 — 잇는 호출 한 번 */
export async function finishGroup(work) {
  const G = groups[work.id],
    out = await unify(G.plan.final, composeGroup(G.layout, G.imgs));
  return { blob: await dress(work, await load(out.blob), G.plan.post), nsfw: out.nsfw, seed: G.plan.final.seed };
}
/** 조각 넷이 보관함에 다 있는지(다시 붙일 수 있는지) */
export const hasParts = (work) =>
  !!groups[work.id] || ["bg-raw.webp", "left-cut.png", "mid-cut.png", "right-cut.png"].every((n) => (parts[work.id] || []).includes(n));
/** 보관함의 조각으로 붙일 준비 — plan은 서버의 /api/job 결과에서. 머리 자리는 그림에서 다시 어림한다 */
async function prepare(work, plan) {
  if (groups[work.id]) return groups[work.id];
  const imgs = {},
    layout = structuredClone(plan.layout),
    t = "&t=" + Date.now();
  imgs.bg = await load(libUrl(work.id + "/cover-parts/bg-raw.webp") + t);
  for (const c of layout.chars) {
    imgs[c.role] = await load(libUrl(`${work.id}/cover-parts/${c.role}-cut.png`) + t);
    c.head = measure(imgs[c.role]);
  }
  return (groups[work.id] = { plan, imgs, layout });
}

const num = (v, d) => (Number.isFinite(+v) && v !== "" ? +v : d);
/** 자리 맞추기 판 — 인물마다 머리 자리(정수리·머리 높이·얼굴 가로)·좌우 뒤집기·가로 자리를 고치고, 미리 보기(호출 없음)로 확인한 뒤 이어서 후보를 만든다.
    box는 판을 그릴 곳, plan은 서버가 준 계획, onCand(결과)는 새 후보를 받는 곳 */
export async function seatPanel(work, box, plan, onCand) {
  box.innerHTML = '<span class="dim">조각을 읽는 중…</span>';
  const G = await prepare(work, plan);
  const row = (c) =>
    `<div class="seat" data-role="${c.role}"><b>${NAMES[c.role]} ${c.code}</b>` +
    `<label>정수리 <input class="cf" type="number" step="0.01" min="0" max="0.5" value="${c.head[0]}"></label>` +
    `<label>머리 높이 <input class="hf" type="number" step="0.01" min="0.12" max="0.5" value="${c.head[1]}"></label>` +
    `<label>얼굴 가로 <input class="fx" type="number" step="0.01" min="0" max="1" value="${c.head[2] === undefined ? 0.5 : c.head[2]}"></label>` +
    `<label>자리 <input class="cx" type="number" step="0.01" min="0.05" max="0.95" value="${c.cx || ""}" placeholder="${G.layout.seat[c.role].cx}"></label>` +
    `<label><input class="flip" type="checkbox"${c.flip ? " checked" : ""}> 좌우 뒤집기</label></div>`;
  box.innerHTML =
    `<p class="dim">값은 그림 크기에 대한 비율이에요(정수리 = 위에서 머리 끝까지, 머리 높이 = 정수리에서 턱까지, 얼굴 가로 = 왼쪽에서 얼굴 가운데까지). 양옆 인물은 가운데를 보도록 뒤집어 주세요.</p>` +
    G.layout.chars.map(row).join("") +
    `<div class="acts"><button class="rec">기록된 값 넣기(확정 그림용)</button><button class="pv">미리 보기(호출 없음)</button><button class="go main">이어서 후보 만들기(호출 1번)</button><span class="pmsg dim"></span></div><img class="pvimg" alt="" hidden>`;
  const read = () => {
    for (const c of G.layout.chars) {
      const el = box.querySelector(`.seat[data-role="${c.role}"]`),
        v = (s) => el.querySelector(s).value;
      c.head = [num(v(".cf"), c.head[0]), Math.max(0.12, num(v(".hf"), c.head[1])), num(v(".fx"), 0.5)]; // 머리 높이로 나누니 0에 가까운 값은 받지 않음
      c.flip = el.querySelector(".flip").checked ? 1 : 0;
      if (num(v(".cx"), 0)) c.cx = num(v(".cx"), 0);
      else delete c.cx;
    }
  };
  const msg = (t, cls) => {
    box.querySelector(".pmsg").textContent = t;
    box.querySelector(".pmsg").className = "pmsg " + (cls || "dim");
  };
  // 보관함의 조각이 확정 표지를 만든 그 그림이면, 표지 규칙에 적어 둔 값(그 그림에서 잰 머리 자리·뒤집기·자리)이 그대로 맞는다
  box.querySelector(".rec").addEventListener("click", () => {
    for (const c of plan.layout.chars) {
      const el = box.querySelector(`.seat[data-role="${c.role}"]`);
      el.querySelector(".cf").value = c.head[0];
      el.querySelector(".hf").value = c.head[1];
      el.querySelector(".fx").value = c.head[2] === undefined ? 0.5 : c.head[2];
      el.querySelector(".cx").value = c.cx || "";
      el.querySelector(".flip").checked = !!c.flip;
    }
    msg("표지 규칙에 기록된 값을 넣었어요.");
  });
  box.querySelector(".pv").addEventListener("click", () => {
    read();
    const cv = composeGroup(G.layout, G.imgs),
      sm = document.createElement("canvas");
    sm.width = COMP_W / 2;
    sm.height = COMP_H / 2;
    sm.getContext("2d").drawImage(cv, 0, 0, sm.width, sm.height);
    const im = box.querySelector(".pvimg");
    im.src = sm.toDataURL("image/jpeg", 0.85);
    im.hidden = false;
    msg("붙인 그림이에요(잇기·후처리·로고 전).");
  });
  box.querySelector(".go").addEventListener("click", async (e) => {
    read();
    e.target.disabled = true;
    msg("잇는 중…");
    try {
      await onCand(await finishGroup(work));
      msg("후보가 나왔어요.", "ok");
    } catch (err) {
      msg("실패: " + ((err && err.message) || err), "warn");
    } finally {
      e.target.disabled = false;
    }
  });
}
