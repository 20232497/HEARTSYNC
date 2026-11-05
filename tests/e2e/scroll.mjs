// 화면을 옮길 때의 스크롤(#view): 새 화면은 맨 위부터, 같은 주소를 다시 그리면 보던 자리, 홈으로 돌아오면 보던 자리.
// 대화방의 #log·이미지 스튜디오의 목록처럼 따로 스크롤하는 곳이 깨지지 않는지도 본다. 값이 다르면 errors에 쌓임 → tests/run.mjs가 실패로 판정
import { chromium, webkit, devices } from "playwright";
import { noSupabase } from "./_offline.mjs";
const [, , url, out] = process.argv; // out: 스크린샷 폴더(없으면 안 찍음)
for (const [dev, engine] of [["Desktop Chrome", chromium], ["iPhone 13", webkit]]) {
  const res = { dev, passed: 0, errors: [] }, tag = dev.replace(/\W+/g, "_");
  const browser = await engine.launch();
  const ctx = await browser.newContext({ ...devices[dev] }); await noSupabase(ctx);
  const watch = (p) => { p.on("pageerror", (e) => res.errors.push(`pageerror: ${e.message}`)); p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) res.errors.push(`console: ${m.text().slice(0, 200)}`); }); return p; };
  const page = watch(await ctx.newPage());
  const same = (label, got, want, slack = 0) => { if (Math.abs(got - want) > slack) res.errors.push(`${label}: ${got} (기대 ${want})`); else res.passed++; };
  const yOf = (p) => p.evaluate(() => $("#view").scrollTop);
  const y = () => yOf(page);
  const hashIs = (h, p = page) => p.waitForFunction((x) => location.hash === x, h, { timeout: 10000 }).catch(() => res.errors.push("주소가 안 바뀜: " + h)).then(() => p.waitForTimeout(150));
  const to = async (h, p = page) => { await p.evaluate((x) => { location.hash = x; }, h); await hashIs("#" + h, p); };
  // 내려 둠. 화면이 짧아 내려가지 않으면 시험이 뜻이 없으니 알림(must)
  const down = async (n, must = true) => { const got = await page.evaluate((x) => { const v = $("#view"); v.scrollTop = x; return v.scrollTop; }, n); if (must && got < n / 2) res.errors.push(`화면이 짧아 ${n}만큼 내려가지 않음: ${got}`); return got; };
  try {
    await page.goto(url, { waitUntil: "load" });
    await page.waitForSelector("#lguest"); await page.click("#lguest"); await page.waitForTimeout(400);
    await page.evaluate(() => { closeOverlays(); setAudience("all"); });

    // 홈을 내려 작품을 누르면 상세는 맨 위부터 — 원래 버그(상세가 내려간 채 열려 제목이 잘림)
    await page.evaluate(() => document.querySelector(".grid .card").scrollIntoView({ block: "center" }));
    const homeAt = await y(), id = await page.$eval(".grid .card", (b) => b.dataset.char);
    if (homeAt < 200) res.errors.push("홈이 내려가지 않음: " + homeAt);
    await page.click(".grid .card"); await hashIs("#c-" + id);
    same("카드 → 상세", await y(), 0);
    if (out) await page.screenshot({ path: `${out}/scroll_${tag}_detail.png` });
    // 돌아오면 보던 자리: 상단 뒤로 버튼·브라우저 뒤로, 앞으로 가면 다시 맨 위
    await down(300); await page.click(".topbar [data-go=home]"); await hashIs("#home");
    same("상단 뒤로 → 홈", await y(), homeAt, 2);
    await page.click(".grid .card"); await hashIs("#c-" + id);
    same("다시 상세", await y(), 0);
    await down(200); await page.goBack(); await hashIs("#home");
    same("브라우저 뒤로 → 홈", await y(), homeAt, 2);
    await page.goForward(); await hashIs("#c-" + id);
    same("브라우저 앞으로 → 상세", await y(), 0);

    // 같은 주소를 다시 그리면 그대로(services/sync reloadFromCloud, ui/store 완료, go 같은 주소)
    for (const [where, go2] of [["home", "go('home')"], ["c-hwanghu", "go('c-hwanghu')"]]) {
      await to(where); const at = await down(where === "home" ? 500 : 250);
      for (const code of ["route()", go2, "emit('route')", "reloadFromCloud()"]) {
        await page.evaluate((c) => (0, eval)(c), code); await page.waitForTimeout(80);
        same(`${where}에서 ${code}`, await y(), at);
      }
    }
    // 메뉴로 옮기면 맨 위부터, 홈 메뉴는 보던 자리, 이미 홈이면 그대로
    await to("home"); const homeTab = await down(500);
    await page.locator("[data-nav=store]:visible").click(); await hashIs("#store");
    same("홈 → 스토어", await y(), 0);
    await page.locator("[data-nav=home]:visible").click(); await hashIs("#home");
    same("스토어 → 홈", await y(), homeTab, 2);
    await page.locator("[data-nav=home]:visible").click(); await page.waitForTimeout(120);
    same("홈에서 홈 메뉴", await y(), homeTab, 2);
    // 그 밖의 화면 이동
    await to("me"); same("홈 → MY", await y(), 0);
    await down(400); await to("store"); same("MY → 스토어", await y(), 0);
    await down(100, false); await to("chats"); same("스토어 → 대화", await y(), 0);
    await to("help-faq"); same("대화 → 자주 묻는 질문", await y(), 0);
    await down(150, false); await to("help-notice"); same("고객센터 탭 바꾸기", await y(), 0);
    await to("c-hwanghu"); await down(300); await to("c-hasuk"); same("작품 → 다른 작품", await y(), 0);

    // 대화방: #view는 맨 위, #log는 맨 아래(따로 스크롤), 뒤로 나오면 홈의 보던 자리
    await to("home"); const before = await down(500);
    const rid = await page.evaluate(() => { const r = newRoom(normalizeChar(getChar("lethe")), 0, S.personas[0]); location.hash = "r-" + r.id; return r.id; });
    await hashIs("#r-" + rid); await page.waitForSelector("#log");
    same("홈 → 대화방", await y(), 0);
    same("대화방 #log는 맨 아래", await page.evaluate(() => { const l = $("#log"); return l.scrollHeight - l.scrollTop - l.clientHeight; }), 0, 8);
    await page.click("#back"); await hashIs("#home");
    same("대화방 뒤로 → 홈", await y(), before, 2);

    // 이미지 스튜디오(관리자): 자기 화면을 다시 그릴 땐 목록·화면 스크롤 그대로, 주소가 바뀌면 화면만 맨 위
    const adm = watch(await ctx.newPage());
    await adm.goto(url + "admin.html#images-hwanghu", { waitUntil: "load" }); await adm.waitForSelector(".is-list [data-pick]");
    const set = await adm.evaluate(() => { const l = $(".is-list"), v = $("#view"); l.scrollTop = 300; v.scrollTop = 150; return { list: l.scrollTop, view: v.scrollTop }; });
    if (set.list < 100) res.errors.push("이미지 스튜디오 목록이 내려가지 않음: " + set.list);
    const scrolls = () => adm.evaluate(() => ({ list: $(".is-list").scrollTop, view: $("#view").scrollTop }));
    await adm.evaluate(() => document.querySelector(".is-list [data-pick]").click()); await adm.waitForTimeout(150);
    let now = await scrolls(); same("코드 고르기: 목록", now.list, set.list, 2); same("코드 고르기: 화면", now.view, set.view, 2);
    await adm.evaluate(() => route()); await adm.waitForTimeout(150);
    now = await scrolls(); same("같은 주소 다시: 목록", now.list, set.list, 2); same("같은 주소 다시: 화면", now.view, set.view, 2);
    await to("images-hasuk", adm); same("다른 작품의 스튜디오", await yOf(adm), 0);
    await adm.evaluate(() => { $("#view").scrollTop = 150; }); await to("works", adm); same("스튜디오 → 작품 화면", await yOf(adm), 0);
  } catch (e) { res.errors.push(String(e).slice(0, 300)); }
  await browser.close();
  console.log(JSON.stringify(res));
}
