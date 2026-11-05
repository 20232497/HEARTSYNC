// 그림 조합 코드: [[img:코드:3,404,501]] 태그 그리기(figure[data-key]), 의상·장소 이어 가기·되돌리기(400·500), AI가 태그를 빠뜨린 인물의 자동 태그(지문의 장소 낱말),
// 대화 중 자동 생성(가짜 runwareImage → 캔버스 PNG, 같은 조합은 다시 만들지 않음), 이미지 스튜디오(그 인물의 갤러리 → 조합 고르기·파일 이름 → 조합 키)·드로어 갤러리, 움짤(사진 위에 겹침·⟳ 끄기·사진을 바꾸면 지움), 코드별 움직임 설명·대화 중 자동 움짤(가짜 fetch)
import { webkit, chromium, devices } from "playwright";
import { noSupabase } from "./_offline.mjs";
const url = process.argv[2], out = process.argv[3];
const targets = [["Desktop Chrome", chromium], ["iPhone 13", webkit]];
for (const [dev, engine] of targets) {
  const b = await engine.launch(); const ctx = await b.newContext({ ...devices[dev] }); await noSupabase(ctx); const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 140)); });
  const res = { dev };
  const navs = []; p.on("framenavigated", (f) => { if (f === p.mainFrame()) navs.push(f.url().replace(/^.*\/\/[^/]+/, "")); });
  p.on("close", () => navs.push("page closed")); p.on("crash", () => navs.push("page crashed"));
  try {
    await p.goto(url, { waitUntil: "load" }); await p.waitForTimeout(1200);
    const code = await p.evaluate(() => { const r = newRoom(normalizeChar(ORIGINALS.find((c) => c.id === "godseats")), 0, S.personas[0]); location.hash = "r-" + r.id; return r.char.cast[0].code; });
    res.code = code;
    await p.waitForTimeout(900);
    // 가짜 llm: window.__body를 본문으로 돌려주고, 시스템 프롬프트를 남김
    await p.evaluate(() => {
      window.llm = async (input, { onText }) => {
        window.__lastInput = input;
        const full = window.__body + "\n===STATE===\n" + JSON.stringify({ status: {}, suggestions: ["하나", "둘", "셋"] });
        onText({ text: full.slice(0, 40) }); await new Promise((r) => setTimeout(r, 60)); onText({ text: full });
        return full;
      };
    });
    const turn = async (body, text = "입력") => p.evaluate(async ([body, text]) => {
      window.__body = body;
      room.msgs.push({ id: uid("m"), role: "user", text });
      await generate(null, quote(room.set));
      const ai = lastAi(room), sys = window.__lastInput[0].content;
      return { text: curText(ai), figs: $$("#logInner figure.scene-img").map((f) => ({ code: f.dataset.code, key: f.dataset.key, img: !!f.querySelector("img") })), rw: window.__rw || 0,
        sysHasDims: /의상 번호: 400 기본 의상/.test(sys) && /장소 번호: 500 기본 배경/.test(sys), nowLine: (sys.match(/지금 이어지는 의상·장소: ([^\n]+)/) || [])[1] || "" };
    }, [body, text]);
    const name = await p.evaluate(() => room.char.cast[0].name);
    // 1) 조합 태그 그대로 저장되고 figure에 조합 키가 붙음(그림은 없어 아트 카드)
    const t1 = await turn(`*바람이 불었다.*\n\n[[img:${code}:3,404,501]]\n\n${name}: "첫 대사예요."`);
    res.t1 = { tag: t1.text.includes(`[[img:${code}:3,404,501]]`), fig: t1.figs.some((f) => f.code === code && f.key === "3,404,501" && !f.img), sysHasDims: t1.sysHasDims };
    // 2) 감정만 쓰면 의상·장소가 이어지고, 시스템 프롬프트에 지금 의상·장소가 보임
    const t2 = await turn(`[[img:${code}:2]]\n\n${name}: "두 번째 대사예요."`);
    res.t2 = { tag: t2.text.includes(`[[img:${code}:2,404,501]]`), nowLine: t2.nowLine };
    // 3) 400으로 의상을 되돌리면 장소만 남음
    const t3 = await turn(`[[img:${code}:5,400]]\n\n${name}: "세 번째 대사예요."`);
    res.t3 = { tag: t3.text.includes(`[[img:${code}:5,501]]`) };
    // 4) 태그를 빠뜨리면 자동으로 붙이고, 지문의 장소 낱말(소파 → 503)을 읽음
    const t4 = await turn(`*${name}은 소파에 털썩 앉았다.*\n\n${name}: "네 번째 대사예요. 소파가 편하네요."`);
    res.t4 = { tag: new RegExp(`\\[\\[img:${code}:\\d+,503\\]\\]`).test(t4.text), text: t4.text.slice(0, 60) };
    // 5) 자동 생성: 가짜 runwareImage(캔버스 PNG). 없는 조합만 한 번 만들고 그 자리를 그림으로 바꿈. 500으로 장소(503)를 되돌려 키는 7,404
    await p.evaluate(() => {
      S.settings.autoImg = true; S.settings.runwareKey = "test-key"; window.__rw = 0;
      window.runwareImage = async () => { window.__rw++; const cv = document.createElement("canvas"); cv.width = cv.height = 8; const g = cv.getContext("2d"); g.fillStyle = "#f06292"; g.fillRect(0, 0, 8, 8); return new Promise((r) => cv.toBlob(r, "image/png")); };
    });
    const t5 = await turn(`[[img:${code}:7,404,500]]\n\n${name}: "다섯 번째 대사예요."`);
    const swapped = await p.waitForFunction((code) => { const f = document.querySelector(`#logInner figure.scene-img[data-code="${code}"][data-key="7,404"]`); return !!(f && f.querySelector("img")); }, code, { timeout: 10000 }).then(() => true).catch(() => false);
    res.t5 = { tagKey: t5.text.includes(`[[img:${code}:7,404]]`), swapped, rw: await p.evaluate(() => window.__rw), stored: await p.evaluate((code) => validRef((imagesOf(room.char)[code] || {})["7,404"]), code) };
    // 6) 같은 조합은 다시 만들지 않고 바로 그림이 보임
    const t6 = await turn(`[[img:${code}:7,404]]\n\n${name}: "여섯 번째 대사예요."`);
    await p.waitForTimeout(600);
    res.t6 = { rw: await p.evaluate(() => window.__rw), imgNow: t6.figs.filter((f) => f.key === "7,404").every((f) => f.img), fallback: await p.evaluate((code) => pickImg(room.char, code, "7,404,503") === (imagesOf(room.char)[code] || {})["7,404"] ? "same-act-only" : "other", code) };
    // 7) 이미지 스튜디오: 자동 생성한 조합 그림(7,404)이 그 인물의 갤러리에 있고, 누르면 그 조합이 골라져 지금 그림에 보임. 파일 이름 → 조합 키
    await p.evaluate((code) => openImages(room.char, code), code); await p.waitForTimeout(600);
    res.studio = await p.evaluate(async () => {
      const card = document.querySelector('[data-load="7,404"]'); if (!card) return { card: false };
      card.click(); await new Promise((z) => setTimeout(z, 300));
      return { card: true, combo: $(".ct-combo code").textContent, now: !!$(".is-now .pic img"), sels: $$(".is-sel").length, cnt: $('.is-code[data-row="7"] .cnt')?.textContent || "", keys: [nameKey("ks_3.png"), nameKey("3-404-501.webp"), nameKey("photo.png")] };
    });
    await p.screenshot({ path: `${out}/${dev.replace(/\W+/g, "_")}_images.png` });
    // 8) 움짤: 그 칸에 움짤(가짜 영상 본문 — kv:)을 켜 두면 대화 그림이 사진 위에 영상을 겹치고(blob 주소), ⟳로 끄면 사진만. 사진을 바꾸면 움짤은 지워짐
    res.motion = await p.evaluate(async (code) => {
      const w = (ms) => new Promise((z) => setTimeout(z, ms)), c = room.char;
      const k = uid("img"); IMG.cache[k] = "data:video/mp4;base64,AAAAIGZ0eXBpc29t"; await IDB.set(k, IMG.cache[k]);
      putMotion(c, code, "7,404", "kv:" + k);
      location.hash = "r-" + room.id; await w(700);
      const fig = () => document.querySelector(`#logInner figure.scene-img[data-code="${code}"][data-key="7,404"]`);
      const v = fig() && fig().querySelector(".mo-wrap video.mo"), on = { video: !!v, blob: !!(v && /^blob:/.test(v.src)), img: !!(fig() && fig().querySelector(".mo-wrap img")) };
      const flipped = flipMotion(c, code, "7,404"); renderLog(); await w(300);
      const off = { flipped, video: !!(fig() && fig().querySelector("video")), img: !!(fig() && fig().querySelector("img")), still: !!motionOf(c, code, "7,404") };
      flipMotion(c, code, "7,404");
      putCastImage(c, code, "7,404", "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=");
      return { on, off, gone: !motionOf(c, code, "7,404"), body: !IMG.cache[k] };
    }, code);
    await p.evaluate(() => { location.hash = "r-" + room.id; }); await p.waitForTimeout(500);
    // 9) 코드별 움직임 설명·대화 중 자동 움짤. Runware는 페이지 안의 가짜 fetch(영상 본문도 가짜), 기다리는 시간은 줄임 — 실제 네트워크·요금 없음
    const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    await p.evaluate(() => {
      const st = window.setTimeout, real = window.fetch; window.__vid = []; window.__failVid = false;
      window.setTimeout = (f, ms, ...a) => st(f, ms === 8000 || ms === 4000 ? 5 : ms, ...a);
      window.fetch = async (u, o) => {
        if (String(u) === CFG.runwareUrl) {
          const t = JSON.parse(o.body)[0];
          if (t.taskType === "videoInference") __vid.push(t);
          const row = t.taskType !== "getResponse" ? { status: "processing" } : __failVid ? { status: "error", message: "가짜 실패" } : { status: "success", videoURL: "https://vm.runware.ai/fake.mp4" };
          return new Response(JSON.stringify({ data: [{ taskUUID: t.taskUUID, ...row }] }), { headers: { "content-type": "application/json" } });
        }
        if (String(u).includes("vm.runware.ai")) return new Response(new Uint8Array(64), { headers: { "content-type": "video/mp4" } });
        return real(u, o);
      };
    });
    // 창: 칸마다 맞는 문장을 채우고, 세미 수위 칸은 기본 설명 그대로, 고친 문장은 그 칸에만 기억하고 '기본 설명으로' 되돌림
    res.sheet = await p.evaluate(async ([code, PNG]) => {
      const c = room.char, cast = c.cast.find((x) => x.code === code), val = () => $("#moP").value, shut = () => $(".mo-sheet [data-x]").click();
      S.settings.autoImg = false; putCastImage(c, code, "101", PNG);
      const open = (k) => { motionSheet(c, cast, k); return val(); };
      const smile = open("101"); shut();
      const semi = open("111"); shut();
      const combo = open("7,404"); shut();
      open("101"); $("#moP").value = "waving a hand slowly"; $("#moGo").click();
      for (let i = 0; i < 60 && !motionOf(c, code, "101"); i++) await new Promise((z) => setTimeout(z, 50));
      const sent = __vid[__vid.length - 1] || {};
      const again = open("101"); const other = (() => { shut(); return open("102"); })(); shut();
      open("101"); $("#moReset").click(); const reset = val();
      return { smile, semi, combo, isDefault: semi === MOTION_PROMPT, sent: sent.positivePrompt, safety: !!(sent.safety && sent.safety.checkContent), again, other, reset, made: !!motionOf(c, code, "101") };
    }, [code, PNG]);
    await p.waitForTimeout(500); // 창이 나타나는 움직임이 끝난 뒤에
    await p.screenshot({ path: `${out}/${dev.replace(/\W+/g, "_")}_motion_sheet.png` });
    await p.evaluate((code) => { $(".mo-sheet [data-x]").click(); putMotion(room.char, code, "101", null); Object.keys(MSTATE.edits).forEach((k) => delete MSTATE.edits[k]); __vid.length = 0; }, code);
    // 자동: 턴을 보내고 잠깐 기다린 뒤 이번에 나간 videoInference 수
    const autoTurn = async (body) => {
      const before = await p.evaluate(() => __vid.length);
      await turn(`${body}\n\n${name}: "자동 움짤 대사예요."`);
      await p.waitForTimeout(500);
      return (await p.evaluate(() => __vid.length)) - before;
    };
    const auto = res.auto = {};
    auto.off = await autoTurn(`[[img:${code}:101,400,500]]`);
    await p.evaluate(() => { S.settings.autoMotion = true; });
    auto.on = await autoTurn(`[[img:${code}:101,400,500]]`);
    auto.task = await p.evaluate(() => { const t = __vid[__vid.length - 1] || {}; return { smiling: /smiling softly/.test(t.positivePrompt || ""), safety: !!(t.safety && t.safety.checkContent), model: t.model, dur: t.duration }; });
    const saved = await p.waitForFunction((code) => !!motionOf(room.char, code, "101"), code, { timeout: 8000 }).then(() => true).catch(() => false);
    await p.waitForTimeout(300);
    auto.fig = await p.evaluate((code) => { const v = document.querySelector(`#logInner figure.scene-img[data-code="${code}"][data-key="101"] .mo-wrap video.mo`); return !!v; }, code);
    auto.saved = saved;
    auto.again = await autoTurn(`[[img:${code}:101,400,500]]`); // 이미 있으면 다시 안 만듦
    await p.evaluate((code) => { flipMotion(room.char, code, "101"); }, code);
    auto.flipped = await autoTurn(`[[img:${code}:101,400,500]]`); // 꺼 둔 움짤도 다시 안 만듦
    await p.evaluate(([code, PNG]) => { for (const k of ["3", "111", "120"]) putCastImage(room.char, code, k, PNG); }, [code, PNG]);
    auto.base = await autoTurn(`[[img:${code}:3,400,500]]`); // 표에 없는 기본 감정
    auto.semi = await autoTurn(`[[img:${code}:111,400,500]]`); // 세미 수위
    auto.noPic = await autoTurn(`[[img:${code}:130,400,500]]`); // 표에는 있지만 보여 줄 그 코드의 그림이 없음(폴백 칸은 표에 없음)
    // 한 응답에 최대 2개, 남은 칸은 다음 턴에
    const codes = await p.evaluate((PNG) => { const cs = room.char.cast.slice(0, 3).map((x) => x.code); cs.forEach((k) => putCastImage(room.char, k, "102", PNG)); return cs; }, PNG);
    const tags = codes.map((k) => `[[img:${k}:102,400,500]]`).join("\n\n");
    auto.cap = await autoTurn(tags);
    await p.waitForTimeout(400);
    auto.capNext = await autoTurn(tags);
    await p.waitForTimeout(400);
    // 실패한 칸은 이번 세션에 다시 시도하지 않음
    await p.evaluate(() => { __failVid = true; });
    auto.broke = await autoTurn(`[[img:${code}:120,400,500]]`);
    await p.waitForTimeout(400);
    auto.brokeAgain = await autoTurn(`[[img:${code}:120,400,500]]`);
    auto.brokeSaved = await p.evaluate((code) => !!motionOf(room.char, code, "120"), code);
    await p.evaluate(() => { S.settings.autoMotion = false; __failVid = false; });
    // 스튜디오를 연 채로 화면 밖에서 시작한 일이 끝나면 '만드는 중' 글이 남지 않고 다시 그려짐
    res.stale = await p.evaluate(async (code) => {
      const c = room.char, id = jobId(c, code, "101"), w = (ms) => new Promise((z) => setTimeout(z, ms));
      openImages(c, code); await w(500);
      MJOBS[id] = { t0: Date.now(), status: "만드는 중", progress: 0 }; viewImages(); await w(100);
      const shown = !!document.querySelector("[data-mjob]");
      delete MJOBS[id]; await w(1300);
      return { shown, gone: !document.querySelector("[data-mjob]") };
    }, code);
    await p.evaluate(() => { location.hash = "r-" + room.id; }); await p.waitForTimeout(500);
    await p.evaluate(() => { closeOverlays(); openRoomDrawer("gallery"); }); await p.waitForTimeout(400);
    res.gallery = await p.evaluate(() => $$(".gallery button").length);
    await p.evaluate(() => closeOverlays());
  } catch (e) { res.fail = String(e).slice(0, 300); res.navs = navs.slice(-8); }
  const bad = [];
  if (res.t1 && !(res.t1.tag && res.t1.fig && res.t1.sysHasDims)) bad.push("t1 " + JSON.stringify(res.t1));
  if (res.t2 && !(res.t2.tag && /오피스룩·침실/.test(res.t2.nowLine))) bad.push("t2 " + JSON.stringify(res.t2));
  if (res.t3 && !res.t3.tag) bad.push("t3 " + JSON.stringify(res.t3));
  if (res.t4 && !res.t4.tag) bad.push("t4 " + JSON.stringify(res.t4));
  if (res.t5 && !(res.t5.tagKey && res.t5.swapped && res.t5.rw === 1 && res.t5.stored)) bad.push("t5 " + JSON.stringify(res.t5));
  if (res.t6 && !(res.t6.rw === 1 && res.t6.imgNow)) bad.push("t6 " + JSON.stringify(res.t6));
  if (res.studio && !(res.studio.card && /:7,404]]/.test(res.studio.combo) && res.studio.now && res.studio.sels === 2 && res.studio.cnt === "1장" && res.studio.keys.join("|") === "3|3,404,501|")) bad.push("studio " + JSON.stringify(res.studio));
  if (res.motion && !(res.motion.on.video && res.motion.on.blob && res.motion.on.img && res.motion.off.flipped === false && !res.motion.off.video && res.motion.off.img && res.motion.off.still && res.motion.gone && res.motion.body)) bad.push("motion " + JSON.stringify(res.motion));
  const sh = res.sheet;
  if (sh && !(/^Static camera/.test(sh.smile) && /Featuring 1(girl|boy)/.test(sh.smile) && /smiling softly/.test(sh.smile) && !/[ㄱ-힣]/.test(sh.smile) && sh.isDefault && /office lady/.test(sh.combo) && /slight body movement/.test(sh.combo)
    && sh.sent === "waving a hand slowly" && sh.safety && sh.made && sh.again === "waving a hand slowly" && !/waving/.test(sh.other) && /glaring intensely/.test(sh.other) && sh.reset === sh.smile)) bad.push("sheet " + JSON.stringify(sh));
  const au = res.auto;
  if (au && !(au.off === 0 && au.on === 1 && au.task.smiling && au.task.safety && au.task.model === "bytedance:2@2" && au.task.dur === 5 && au.saved && au.fig && au.again === 0 && au.flipped === 0 && au.base === 0 && au.semi === 0 && au.noPic === 0
    && au.cap === 2 && au.capNext === 1 && au.broke === 1 && au.brokeAgain === 0 && !au.brokeSaved)) bad.push("auto " + JSON.stringify(au));
  if (res.stale && !(res.stale.shown && res.stale.gone)) bad.push("stale " + JSON.stringify(res.stale));
  if (res.gallery !== undefined && res.gallery < 1) bad.push("gallery " + res.gallery);
  res.errs = errs.concat(bad); console.log(JSON.stringify(res)); await b.close();
}
