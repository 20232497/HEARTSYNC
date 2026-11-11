// 그림이 실린 작품의 흐름(지금 저장소에는 그림이 0장이라 가짜 그림으로 틀만 확인): 작품에 images·장소·컷씬·비공개 칸을 주입하고 content/…/images/* 요청을 가로채 작은 PNG를 돌려준다.
// 본문 태그 [[코드번호]] → <img>(그 칸 그림이 없으면 1 기본 그림), 갤러리·장소 목록, 도감·인물 시트 미리보기, 비공개(hidden) 그림은 대화에서 본 뒤에야 도감에서도 열림,
// 내 서재의 수집 기록(S.shelf.seen)과 '모은 그림 n / m' 배지, 인물 시트의 '본 칸 ✓' 표시.
import { chromium, webkit, devices } from "playwright";
import { noSupabase } from "./_offline.mjs";
const [, , url, out] = process.argv;
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
for (const [dev, engine, opts] of [["Desktop Chrome", chromium, {}], ["iPhone 13", webkit, devices["iPhone 13"]]]) {
  const b = await engine.launch(); const ctx = await b.newContext({ ...opts }); await noSupabase(ctx);
  let served = 0;
  await ctx.route("**/content/**/images/*", (route) => { served++; return route.fulfill({ status: 200, contentType: "image/png", body: PNG }); });
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push("pageerror: " + e.message)); p.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 160)); });
  const res = { dev };
  const wait = (ms) => p.waitForTimeout(ms), tag = dev.replace(/\W+/g, "_");
  try {
    await p.goto(url, { waitUntil: "load" }); await wait(1200);
    if (await p.$("#lguest")) { await p.click("#lguest"); await wait(400); }
    // 가짜 그림 6장(인물 0·1·3, 장소 1·2, 컷씬 1) — 인물의 3번 칸·둘째 장소·컷씬은 비공개
    const w = await p.evaluate(() => {
      closeOverlays(); setAudience("all"); S.shelf = mergeShelf(); KV.setLocal("shelf", undefined);
      const live = ORIGINALS[0], A = live.cast[0].code, MP = seriesCode("place"), EV = seriesCode("cut"), at = (k) => `content/_test/images/${k}.png`;
      live.places = [{ name: "시험 광장", desc: "누구나 아는 곳" }, { name: "시험 밀실", desc: "숨겨진 곳", hidden: true }];
      live.cuts = [{ title: "시험 컷씬", when: "결말 직전", hidden: true }];
      live.cast[0].hidden = [3];
      live.images = { [A]: { 0: at(A + 0), 1: at(A + 1), 3: at(A + 3) }, [MP]: { 1: at(MP + 1), 2: at(MP + 2) }, [EV]: { 1: at(EV + 1) } };
      return { id: live.id, A, MP, EV };
    });
    // 도감·인물 시트를 훑어 지금 상태를 읽음: 수집률 배지, 장소·컷씬 카드의 그림/잠금, 인물 시트 칩(잠금·본 칸·준비)과 3번 칸 미리보기
    const look = () => p.evaluate(async (w) => {
      const nap = (ms) => new Promise((r) => setTimeout(r, ms));
      location.hash = "c-" + w.id; await nap(350); const detail = ($("#collect") || {}).textContent || "";
      location.hash = "codex-" + w.id; await nap(350);
      const cards = $$(".codex-grid .wcard").map((f) => ({ code: f.querySelector("code").textContent, img: !!f.querySelector("img"), lock: f.classList.contains("locked") }));
      const c = normalizeChar(getChar(w.id)); castSheet(c, c.cast[0]);
      const chip = (n) => { const b = document.querySelector(`.overlay [data-sit="${n}"]`); return ["locked", "seen", "ready"].filter((k) => b.classList.contains(k)).join(); };
      const chips = { 0: chip(0), 1: chip(1), 3: chip(3), 7: chip(7) };
      document.querySelector('.overlay [data-sit="3"]').click(); const pv3 = !!document.querySelector(".overlay #cxPv img");
      closeOverlays();
      return { detail, codex: ($("#collect") || {}).textContent || "", cards, chips, pv3 };
    }, w);
    res.before = await look();
    if (out) await p.screenshot({ path: `${out}/art_${tag}_codex_before.png` });
    // 대화방: 첫 장면의 태그를 지우고(기대값을 고정) 응답 하나를 넣음 — 비공개 3번 칸·비공개 장소·그림이 없는 7번 칸(1 기본 그림으로 대신)
    res.chat = await p.evaluate(async (w) => {
      const nap = (ms) => new Promise((r) => setTimeout(r, ms)), r = newRoom(normalizeChar(getChar(w.id)), 0, S.personas[0]);
      r.msgs[0].alts[0].text = "첫 장면(그림 태그 없음).";
      r.msgs.push({ id: uid("m"), role: "user", text: "안녕" }, { id: uid("m"), role: "ai", idx: 0, alts: [{ text: `[[${w.MP}2]]\n\n밀실 문이 열렸다.\n\n[[${w.A}3]]\n\n"…여긴 어떻게."\n\n[[${w.A}7]]\n\n그가 고개를 돌렸다.`, status: r.status, suggestions: [] }], statusBefore: r.status });
      saveRoom(r); location.hash = "r-" + r.id; await nap(900);
      const fig = (code, sit) => document.querySelector(`#log .scene-img[data-code="${code}"][data-sit="${sit}"]`), src = (f) => { const i = f && f.querySelector("img"); return i ? i.getAttribute("src") : ""; };
      const f3 = fig(w.A, 3); if (f3) f3.scrollIntoView({ block: "center" }); await nap(500);
      const i3 = f3 && f3.querySelector("img");
      const body = { a3: src(f3), a7: src(fig(w.A, 7)), place: src(document.querySelector("#log .scene-img.place")), loaded: !!(i3 && i3.complete && i3.naturalWidth > 0) };
      openRoomDrawer("gallery"); await nap(200); const gallery = $$(".drawer .gallery img").length;
      openRoomDrawer("places"); await nap(200); const places = $$(".drawer .gallery button").map((x) => !!x.querySelector("img"));
      closeOverlays();
      return { body, gallery, places, seen: (S.shelf.seen[w.id] || []).slice(), saved: ((KV.getLocal("shelf") || {}).seen || {})[w.id] || [] };
    }, w);
    if (out) await p.screenshot({ path: `${out}/art_${tag}_chat.png` });
    res.after = await look();
    if (out) await p.screenshot({ path: `${out}/art_${tag}_codex_after.png` });
    res.served = served;
    const { A, MP, EV } = w, at = (k) => `content/_test/images/${k}.png`, bf = res.before, ch = res.chat, af = res.after, J = JSON.stringify;
    const card = (list, code) => list.find((x) => x.code === code) || {};
    // 대화 전: 0 / 6, 공개 장소만 그림, 비공개 장소·컷씬·3번 칸은 잠김
    if (bf.detail !== "모은 그림 0 / 6" || bf.codex !== bf.detail) errs.push("대화 전 수집률이 다름: " + J([bf.detail, bf.codex]));
    if (!card(bf.cards, MP + 1).img || card(bf.cards, MP + 2).img || !card(bf.cards, MP + 2).lock || card(bf.cards, EV + 1).img || !card(bf.cards, EV + 1).lock) errs.push("대화 전 장소·컷씬 카드가 다름: " + J(bf.cards));
    if (bf.chips[0] !== "ready" || bf.chips[1] !== "ready" || bf.chips[3] !== "locked" || bf.chips[7] !== "" || bf.pv3) errs.push("대화 전 인물 시트가 다름: " + J([bf.chips, bf.pv3]));
    // 대화방: 태그가 그림으로(7번 칸은 1 기본 그림), 실제로 불러와짐, 갤러리 3장, 장소 목록의 비공개 장소도 열림, 수집 기록에 본 코드와 대신 보인 1번 칸
    if (ch.body.a3 !== at(A + 3) || ch.body.a7 !== at(A + 1) || ch.body.place !== at(MP + 2) || !ch.body.loaded || !served) errs.push("본문 태그의 그림이 다름: " + J([ch.body, served]));
    if (ch.gallery !== 3 || J(ch.places) !== J([true, true])) errs.push("갤러리·장소 목록이 다름: " + J([ch.gallery, ch.places]));
    if (J(ch.seen.slice().sort()) !== J([A + 1, A + 3, A + 7, MP + 2].sort()) || J(ch.saved) !== J(ch.seen)) errs.push("수집 기록이 다름: " + J([ch.seen, ch.saved]));
    // 대화 뒤: 본 비공개 그림은 도감에서도 열리고(안 본 컷씬은 그대로 잠김), 본 칸 ✓, 3 / 6
    if (af.detail !== "모은 그림 3 / 6" || af.codex !== af.detail) errs.push("대화 뒤 수집률이 다름: " + J([af.detail, af.codex]));
    if (!card(af.cards, MP + 2).img || card(af.cards, MP + 2).lock || card(af.cards, EV + 1).img || !card(af.cards, EV + 1).lock) errs.push("대화 뒤 장소·컷씬 카드가 다름: " + J(af.cards));
    if (af.chips[0] !== "ready" || af.chips[1] !== "seen" || af.chips[3] !== "seen" || af.chips[7] !== "seen" || !af.pv3) errs.push("대화 뒤 인물 시트가 다름: " + J([af.chips, af.pv3]));
  } catch (e) { res.fail = String(e).slice(0, 400); }
  res.errs = errs;
  console.log(JSON.stringify(res));
  await b.close();
}
