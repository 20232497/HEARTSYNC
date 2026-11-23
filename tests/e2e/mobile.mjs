// HeartVerse mobile smoke test: WebKit (iPhone) + Chromium (Android) on given URLs
import { webkit, chromium, devices } from "playwright";
import { noSupabase } from "./_offline.mjs";
const [, , ...urls] = process.argv;
const out = process.env.SHOT_DIR;
const targets = [
  ["iPhone 13", webkit],
  ["iPhone SE", webkit],
  ["Galaxy S9+", chromium]
];
/* 가로 넘침 가드(페이지 안에서 돎) — 휴대폰에서 화면이 오른쪽으로 잘리거나 밀리는 것을 실패로:
   ① 화면(#view)과 문서가 가로로 넘치지 않음 ② 가로로 미는 상자(overflow-x auto·scroll) 밖에서 화면 좌우를 벗어난 요소가 없음.
   가로로 미는 상자는 안쪽이 넘치는 것이 정상이라 그 안의 요소는 빼지만, 상자 자신의 바깥 경계는 검사에 들어감(통째로 빼면 상자가 칸을 밀어내는 것을 놓침).
   잘려서 안 보이는 것(overflow hidden 안)도 잡음 — 글이 잘린 것이 곧 버그. 대화방 배경(.chat-bg)은 일부러 크게 깐 흐린 그림이라 뺌
   ③ 상태창(dl.status)의 값이 카드 밖으로 나가지 않음 — 화면 안에 남아 있어도 카드를 넘으면 잘려 보임(대화방과 방 메뉴의 상태창) */
const guard = (label) => {
  const W = innerWidth,
    v = document.getElementById("view"),
    bad = [],
    names = new Set();
  const scrollsX = (el) => /auto|scroll/.test(getComputedStyle(el).overflowX);
  if (v.scrollWidth > v.clientWidth + 1) bad.push(`${label}: 화면이 가로로 ${v.scrollWidth - v.clientWidth}px 넘침`);
  if (document.documentElement.scrollWidth > W + 1) bad.push(`${label}: 문서가 가로로 넘침`);
  for (const el of document.querySelectorAll("#view *, .overlay *")) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || (r.right <= W + 1 && r.left >= -1) || el.closest(".chat-bg")) continue;
    let q = el.parentElement,
      inside = false;
    for (; q && q !== document.body; q = q.parentElement)
      if (q !== v && scrollsX(q)) {
        inside = true;
        break;
      }
    if (inside) continue;
    const cls = typeof el.className === "string" && el.className.trim() ? "." + el.className.trim().split(/\s+/)[0] : "";
    names.add(`${el.tagName.toLowerCase()}${cls}(${Math.round(r.left)}~${Math.round(r.right)})`);
  }
  document.querySelectorAll("dl.status").forEach((el) => {
    if (el.clientWidth && el.scrollWidth > el.clientWidth + 1) bad.push(`${label}: 상태창 값이 카드 밖으로 ${el.scrollWidth - el.clientWidth}px 나감`);
  });
  if (names.size) bad.push(`${label}: 화면 밖으로 나간 요소 ${names.size}종 — ${[...names].slice(0, 3).join(", ")} / 폭 ${W}`);
  return bad;
};
for (const url of urls) {
  for (const [dev, engine] of targets) {
    const browser = await engine.launch();
    const ctx = await browser.newContext({ ...devices[dev] });
    await noSupabase(ctx);
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push("console: " + m.text().slice(0, 160));
    });
    const res = { url, dev };
    try {
      await page.goto(url, { waitUntil: "load", timeout: 30000 });
      await page.waitForTimeout(1500);
      const check = async (label) => {
        const r = await page.evaluate(() => ({
          mode: document.compatMode,
          bootMsg: !!document.getElementById("bootMsg") && document.getElementById("bootMsg").textContent,
          viewLen: (document.getElementById("view") || {}).innerHTML?.length || 0,
          viewH: Math.round(document.getElementById("view")?.getBoundingClientRect().height || 0),
          overflowX: document.documentElement.scrollWidth - innerWidth,
          tabbar: getComputedStyle(document.getElementById("tabbar")).display
        }));
        res[label] = r;
      };
      const fit = async (label) => errors.push(...(await page.evaluate(guard, label)));
      const goto = async (hash, ms = 500) => {
        await page.evaluate((h) => {
          location.hash = h;
        }, hash);
        await page.waitForTimeout(ms);
      };
      await check("home");
      // 뷰포트: 화면 확대를 잠가 둠 — 아이폰은 16px보다 작은 입력칸을 누르면 화면을 확대하고 되돌리지 않는데, maximum-scale=1이면 그 확대가 없음(2026-11-21 사용자 결정)
      res.viewport = await page.evaluate(() => document.querySelector('meta[name="viewport"]').content);
      if (!/(^|,)\s*maximum-scale=1(,|$)/.test(res.viewport)) errors.push("뷰포트 메타에 화면 확대 잠금(maximum-scale=1)이 없음: " + res.viewport);
      if (out) await page.screenshot({ path: `${out}/${dev.replace(/\W+/g, "_")}_${url.includes("github.io") ? "live" : "fixed"}_home.png` });
      // 화면마다 가로 넘침 없음(아래 guard) — 첫 화면(로그인 뒤 둘러보기 창이 떠 있을 수 있음)을 닫고 홈부터
      await page.evaluate(() => closeOverlays());
      for (const h of ["home", "chats", "codex", "notice", "store", "help", "login"]) {
        await goto(h);
        await fit(h);
      }
      await goto("me", 600);
      await check("me");
      await fit("me");
      // 작품 상세는 전부 — '다른 작품' 줄이 있는 작품(같은 묶음의 작품이 여럿)에서만 칸이 밀려 잘린 적이 있음(2026-11-21)
      const ids = await page.evaluate(() => ORIGINALS.map((c) => c.id));
      for (const id of ids.slice(1)) {
        await goto("c-" + id, 300);
        await fit("상세 " + id);
      }
      await page.evaluate(() => {
        const c = ORIGINALS[0];
        location.hash = "c-" + c.id;
      });
      await page.waitForTimeout(600);
      await check("detail");
      await fit("상세 " + ids[0]);
      // 상세: 시작 버튼이 첫 화면 안(아래에 고정된 줄 — 아래 탭 위), 탭을 누르면 그 칸이 탭 줄 바로 아래로 오고 지금 칸이 강조됨, 시작 상황의 '장면 펼쳐 읽기'
      res.detailCta = await page.evaluate(async () => {
        const nap = (ms) => new Promise((r) => setTimeout(r, ms)),
          box = (el) => el.getBoundingClientRect(),
          s = box($("#start")),
          bar = box($("#tabbar"));
        $$("[data-tab]")[1].click();
        await nap(200);
        const gap = Math.round(box($("#d-open")).top - box($("#dTabs")).bottom);
        $(".d-scene").open = true;
        return {
          startIn: s.top >= 0 && s.bottom <= bar.top + 1,
          gap,
          on: ($("[data-tab].on") || { dataset: {} }).dataset.tab,
          scene: !!$(".d-scene .bubble p")
        };
      });
      {
        const d = res.detailCta;
        if (!d.startIn || Math.abs(d.gap) > 12 || d.on !== "open" || !d.scene) errors.push("상세의 시작 버튼·탭이 다름: " + JSON.stringify(d));
      }
      // 시작 창(첫 장 AI 안내 → 고르는 장)도 가로로 넘치지 않음
      await page.click("#start");
      await page.waitForTimeout(400);
      await fit("시작 창 — AI 안내");
      if (await page.$("#aiOk")) {
        await page.click("#aiOk");
        await page.waitForTimeout(300);
      }
      if (!(await page.evaluate(() => !!$(".overlay #stFoot") && !$(".overlay #stFoot").hidden))) errors.push("시작 창의 고르는 장이 열리지 않음(#stFoot)");
      await fit("시작 창 — 고르는 장");
      await page.evaluate(() => closeOverlays());
      // 대화방: 내 말 하나와 답 하나가 있는 방(말풍선 여백·상태창을 재려고)
      await page.evaluate(() => {
        const r = newRoom(normalizeChar(ORIGINALS[0]), 0, S.personas[0]);
        r.msgs.push(
          { id: uid("m"), role: "user", text: "안녕, 오늘은 어디로 가?" },
          { id: uid("m"), role: "ai", idx: 0, statusBefore: r.status, alts: [{ text: '*고개를 든다.*\n\n"따라와."', status: r.status, suggestions: [] }] }
        );
        saveRoom(r);
        location.hash = "r-" + r.id;
      });
      await page.waitForTimeout(900);
      await check("chat");
      await fit("대화방");
      // 대화방의 얇은 머리와 한 줄 입력창 — 읽는 자리를 넓히려고 줄인 높이가 다시 커지지 않게(머리 53px · 입력창 묶음 77px, 전에는 59px · 139px)
      res.chatRow = await page.evaluate(() => {
        const h = (s) => Math.round($(s).getBoundingClientRect().height);
        return { head: h(".chat-head"), composer: h(".composer"), badge: !!$(".chat-head .ai-badge"), wallet: $("#freeCount").textContent.includes("♥") };
      });
      if (res.chatRow.head > 64 || res.chatRow.composer > 96 || !res.chatRow.badge || !res.chatRow.wallet)
        errors.push("대화방 머리·입력창 묶음이 다름: " + JSON.stringify(res.chatRow));
      // 입력칸과 보내기 버튼이 화면 안에 보이고, 말풍선이 가운데에 섬: 휴대폰에서는 AI 말풍선의 좌우 여백이 같고(전에는 아바타 칸 때문에 왼쪽 60px·오른쪽 14px),
      // 내 말풍선의 오른쪽 여백도 그와 같음(페르소나 사진은 휴대폰에서 숨김 — 2026-11-21 사용자 결정)
      res.chatFit = await page.evaluate(() => {
        const W = innerWidth,
          H = innerHeight,
          box = (s) => {
            const el = document.querySelector(s);
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom) };
          },
          inView = (b) => !!b && b.l >= 0 && b.r <= W && b.t >= 0 && b.b <= H && b.r > b.l && b.b > b.t,
          ai = box("#logInner .msg:not(.me) .bubble"),
          me = box("#logInner .msg.me .bubble");
        return { W, inp: inView(box("#inp")), send: inView(box("#sendBtn")), ai: ai && [ai.l, W - ai.r], meRight: me && W - me.r };
      });
      {
        const c = res.chatFit;
        if (!c.inp || !c.send) errors.push("대화방 입력칸·보내기 버튼이 화면 안에 다 보이지 않음: " + JSON.stringify(c));
        if (!c.ai || Math.abs(c.ai[0] - c.ai[1]) > 2 || c.meRight === null || c.meRight > c.ai[1] + 2)
          errors.push("휴대폰 말풍선이 가운데에 서지 않음(AI 말풍선 [왼쪽, 오른쪽] 여백·내 말풍선 오른쪽 여백): " + JSON.stringify(c));
      }
      if (out) await page.screenshot({ path: `${out}/${dev.replace(/\W+/g, "_")}_${url.includes("github.io") ? "live" : "fixed"}_chat.png` });
      // 대화방에서 여는 창들: 방 메뉴·방 메뉴의 상태창·대화 검색·모델 고르기·메시지 고치기 — 실제로 열린 것을 확인하고 잼(안 열렸으면 배경만 재고 통과하게 되므로)
      if (!(await page.evaluate(() => [...document.querySelectorAll("#logInner dl.status")].some((el) => el.clientWidth > 0))))
        errors.push("대화방에 펼쳐진 상태창이 없음 — 상태창 가드가 헛돎");
      for (const [label, open, shown] of [
        ["방 메뉴", () => openRoomDrawer("main"), ".overlay .drawer .menu-card"],
        ["방 메뉴 — 상태창", () => openRoomDrawer("status"), ".overlay .drawer dl.status"],
        ["대화 검색", () => openSearch(), ".overlay #csQ"],
        ["모델 고르기", () => openModelSheet(), ".overlay .sheet"],
        ["메시지 고치기", () => document.querySelector('#logInner [data-act="editai"]').click(), "#logInner .edit-box textarea"]
      ]) {
        await page.evaluate(open);
        // 창이 밀려 들어오는 움직임이 끝난 뒤에 잼 — 정해 둔 시간만 기다리면 느린 기계에서 움직이는 도중의 자리를 재어 헛실패함(방 메뉴 0.22초)
        await page.waitForTimeout(150);
        await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))));
        if (!(await page.$(shown))) errors.push(`${label}: 창이 열리지 않음(${shown})`);
        await fit(label);
        await page.evaluate(() => closeOverlays());
      }
    } catch (e) {
      res.fail = String(e).slice(0, 200);
    }
    res.errors = errors;
    console.log(JSON.stringify(res));
    await browser.close();
  }
}
