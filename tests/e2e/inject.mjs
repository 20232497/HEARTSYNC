// 주입(XSS) 시험: 이용자가 쓴 글·AI 응답·서버에서 온 공지와 문의·작품 데이터가 들어가는 자리마다 악성 글을 넣고 화면을 돌며 본다 —
//   ① 실행되지 않음(주입한 글이 window.__xss를 부르지 못함) ② 주입한 글에서 온 요소·on… 속성·javascript: 주소가 DOM에 없음 ③ 그 글이 글자 그대로 보임(자리마다 적어도 한 화면에서).
// 화면은 innerHTML로 그리고 'esc()를 쓴다'는 약속으로 지키므로(CLAUDE.md 코딩 규칙), 그 약속이 빠진 자리를 여기서 잡는다. 새 화면·새 데이터 칸을 더하면 아래 표(넣는 자리 · 도는 화면)에도 더한다.
// 사용자 사이트(Desktop Chrome·iPhone 13): 페르소나 · 가짜 작품의 모든 글 칸(외부 제작자를 받을 때에 대비) · 대화방(유저 메시지 · AI 본문과 상태창과 추천 · 가짜 응답 스트리밍 · 즉답 명령어 ·
//   유저노트 · 고정 기억 · 장기기억 · 신고 인용문) · 공지 · 내 문의 · 검색어 · 주소(#…)와 소셜 로그인 오류 문구. 관리자 도구(Desktop Chrome): 공지 관리 · 받은 문의와 신고 · 관리자가 아닌 계정 안내.
// Supabase는 page.route로 흉내 — 실제 서버로는 아무것도 가지 않는다.
import { chromium, webkit, devices } from "playwright";
const [, , url, out] = process.argv;
const site = url.replace(/[^/]*$/, ""); // 저장소 루트(…/index.html이면 그 폴더)
const SB = "https://mblvphojbmxiuqnlxisi.supabase.co";

/** 악성 글 한 묶음 — 자리마다 이름표(tag)를 달아 어디서 샜는지 알 수 있게. 실행되면 __xss('이름표:종류')가 불림.
    속성 깨기(" ')·img onerror·script·textarea/title/style 닫기·svg onload·javascript: 링크·따옴표가 든 주소(자동 링크가 속성을 깨는지)·javascript: 맨글 */
const P = (tag) =>
  `X${tag}"'><img src=x onerror="__xss('${tag}:img')"><script>__xss('${tag}:script')</script></textarea></title></style><svg onload="__xss('${tag}:svg')"></svg><a href="javascript:__xss('${tag}:href')">링크</a> https://example.test/"onmouseover="__xss('${tag}:url')" javascript:__xss('${tag}:plain')`;
/** 화면에 글자 그대로 보여야 하는 앞부분(목록에서 잘려 보여도 남는 길이) */
const MARK = (tag) => `X${tag}"'><img src=x`;

/* 모든 페이지에 먼저 심는 도구: 표식 받는 곳(__xss)·악성 글(__P)·화면 훑기(__scan)·글자 그대로 보이는 이름표 찾기(__seen) */
const init = ({ p, m }) => {
  window.__hits = [];
  window.__xss = (t) => {
    window.__hits.push(String(t));
  };
  window.__P = (0, eval)("(" + p + ")");
  window.__MARK = (0, eval)("(" + m + ")");
  window.__scan = (label) => {
    const bad = [];
    document.querySelectorAll("*").forEach((el) => {
      for (const a of [...el.attributes]) {
        if (/^on/i.test(a.name) && /__xss/.test(a.value)) bad.push(`${label}: <${el.localName} ${a.name}=…> 속성이 생김`);
        if (/^(href|src|action|formaction|xlink:href|srcdoc|data)$/i.test(a.name) && /^\s*javascript:/i.test(a.value))
          bad.push(`${label}: <${el.localName} ${a.name}="javascript:…">`);
      }
      if (el.localName === "script" && /__xss\(/.test(el.textContent)) bad.push(`${label}: <script> 요소가 생김`);
    });
    document.querySelectorAll('img[src="x"], svg[onload], u').forEach((el) => bad.push(`${label}: 주입한 글이 <${el.localName}> 요소가 됨`));
    return bad;
  };
  window.__seen = (tags) => {
    const text = document.body ? document.body.textContent : "",
      vals = [...document.querySelectorAll("input, textarea")].map((x) => x.value || "").join("\n");
    return tags.filter((k) => text.includes(window.__MARK(k)) || vals.includes(window.__MARK(k)));
  };
};

/* 가짜 Supabase(메모리): 공지·문의·관리자 표만 — 나머지는 빈 목록 */
const U = {
  tokA: { id: "aaaaaaaa-0000-4000-8000-00000000000a", email: P("email") },
  tokB: { id: "bbbbbbbb-0000-4000-8000-00000000000b", email: "admin@example.test" }
};
const iso = (minAgo) => new Date(Date.now() - minAgo * 60000).toISOString();
const db = {
  admins: [U.tokB.id],
  notices: [
    { id: 1, title: P("ntit"), body: P("nbody"), pinned: true, published: true, created_at: iso(300), updated_at: iso(300) },
    { id: 2, title: P("nhid"), body: P("nhidb"), pinned: false, published: false, created_at: iso(10), updated_at: iso(10) }
  ],
  inquiries: [
    {
      id: 11,
      user_id: U.tokA.id,
      category: "bug",
      title: P("qtit"),
      body: P("qbody"),
      reply_to: null,
      meta: null,
      status: "answered",
      answer: P("qans"),
      answered_at: iso(5),
      created_at: iso(60)
    },
    {
      id: 12,
      user_id: U.tokA.id,
      category: P("qcat"),
      title: P("qtit2"),
      body: "분류·상태가 서버에서 이상하게 온 문의",
      reply_to: null,
      meta: null,
      status: P("qstat"),
      answer: null,
      answered_at: null,
      created_at: iso(50)
    },
    {
      id: 13,
      user_id: U.tokA.id,
      category: "report",
      title: "[신고] 미성년자 관련 성적 내용 — " + P("rwork"),
      body: P("rbody"),
      reply_to: null,
      meta: null,
      status: "open",
      answer: null,
      answered_at: null,
      created_at: iso(40)
    },
    {
      id: 14,
      user_id: U.tokA.id,
      category: "etc",
      title: "[신고] " + P("rwhy") + " — 작품",
      body: "사유 자리에 든 글",
      reply_to: null,
      meta: null,
      status: "open",
      answer: null,
      answered_at: null,
      created_at: iso(30)
    },
    {
      id: 15,
      user_id: U.tokA.id,
      category: "bug",
      title: P("atit"),
      body: P("abody"),
      reply_to: P("qmail"),
      meta: { ua: P("qua"), screen: P("qscr"), app: P("qapp") },
      status: "open",
      answer: null,
      answered_at: null,
      created_at: iso(20)
    }
  ]
};
const json = (route, status, body) =>
  route.fulfill({
    status,
    contentType: "application/json",
    headers: { "access-control-allow-origin": "*" },
    body: body === undefined ? "" : JSON.stringify(body)
  });
async function handler(route) {
  const req = route.request(),
    u = new URL(req.url()),
    path = u.pathname,
    m = req.method();
  if (m === "OPTIONS")
    return route.fulfill({
      status: 204,
      headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" }
    });
  const tok = (req.headers()["authorization"] || "").replace("Bearer ", ""),
    uid = U[tok] ? U[tok].id : null,
    admin = !!uid && db.admins.includes(uid);
  const eq = (k) => {
    const v = u.searchParams.get(k);
    return v && v.startsWith("eq.") ? decodeURIComponent(v.slice(3)) : null;
  };
  if (m !== "GET") return json(route, m === "POST" ? 201 : 204);
  if (path === "/rest/v1/admins") return json(route, 200, admin && eq("user_id") === uid ? [{ user_id: uid }] : []);
  if (path === "/rest/v1/notices")
    return json(
      route,
      200,
      db.notices.filter((n) => n.published || admin).sort((a, b) => b.pinned - a.pinned)
    );
  if (path === "/rest/v1/inquiries") {
    if (!uid) return json(route, 401, { code: "42501", message: "permission denied" });
    const fu = eq("user_id"),
      fs = eq("status");
    return json(
      route,
      200,
      db.inquiries.filter((a) => (a.user_id === uid || admin) && (!fu || a.user_id === fu) && (!fs || a.status === fs)).sort((a, b) => b.id - a.id)
    );
  }
  return json(route, 200, []);
}
const session = (tok) => ({
  access_token: tok,
  refresh_token: "r" + tok,
  expires_at: Date.now() + 86400000,
  user: { id: U[tok].id, email: U[tok].email, provider: "email", providers: ["email"] }
});

/* 넣는 자리의 이름표 — 여기 적힌 것은 모두 어느 화면에선가 글자 그대로 보여야 함(안 보이면 '넣은 글이 화면에 닿지 않았다'로 실패: 시험이 헛도는 것을 막음) */
const WORK_TAGS = [
  "title",
  "name",
  "one",
  "desc",
  "guide",
  "maker",
  "tpl",
  "wtag",
  "field",
  "cast",
  "cdesc",
  "look",
  "place",
  "pdesc",
  "cut",
  "when",
  "ctit",
  "cdsc",
  "ctext",
  "lkey",
  "ltext",
  "otit",
  "otext",
  "osug",
  "oval",
  "btit",
  "ask",
  "opt",
  "opt2",
  "evt",
  "end",
  "end2"
];
const ROOM_TAGS = [
  "pname",
  "pmemo",
  "pdsc",
  "user",
  "ai",
  "aiq",
  "aiem",
  "sval",
  "sug",
  "note",
  "mem",
  "mhl",
  "mht",
  "pin",
  "err",
  "gen",
  "gval",
  "gsug",
  "live",
  "q"
];
const SERVER_TAGS = ["ntit", "nbody", "qtit", "qbody", "qans", "qtit2", "atit", "abody", "rwork", "rbody", "rwhy", "email"];
// 받은 문의는 답변 대기(open)만 보임
const ADMIN_TAGS = ["ntit", "nbody", "nhid", "nhidb", "atit", "abody", "qmail", "qua", "qscr", "qapp", "rwork", "rbody", "rwhy", "email"];
/* 넣기는 하지만 화면에 그대로 보이지 않는 것이 정상인 자리(훑기만 함): 주소·소셜 로그인 오류 문구(정해진 안내로 바뀜)·서버가 준 분류와 상태(아는 값만 낱말로 바꿔 보임)·명령어 이름(<u>) */
const SCAN_ONLY = ["hash", "oauth", "qcat", "qstat"];

async function open(engine, opts, page, tok) {
  const b = await engine.launch(),
    ctx = await b.newContext({ ...opts });
  await ctx.route(SB + "/**", handler);
  await ctx.addInitScript(init, { p: P.toString(), m: MARK.toString() });
  await ctx.addInitScript(
    ([s]) => {
      try {
        if (s && !localStorage.getItem("hv1_auth")) localStorage.setItem("hv1_auth", JSON.stringify(s));
        localStorage.setItem("hv1_guest", "1");
      } catch (e) {}
    },
    [tok ? session(tok) : null]
  );
  const p = await ctx.newPage(),
    errs = [];
  p.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  p.on("console", (msg) => {
    if (msg.type() === "error" && !/Failed to load resource/.test(msg.text())) errs.push("console: " + msg.text().slice(0, 200));
  });
  p.on("dialog", (d) => {
    errs.push("대화 상자가 뜸(주입한 글이 실행됐을 수 있음): " + d.message().slice(0, 80));
    d.dismiss().catch(() => {});
  });
  await p.goto(site + page, { waitUntil: "load" });
  await p.waitForTimeout(1200);
  await p.evaluate(() => {
    closeOverlays();
    setAudience("all");
  });
  return { b, ctx, p, errs };
}
/** 화면 하나를 훑는 도구 묶음 — sweep(이름): 지금 화면을 훑어 결과에 쌓음, go(이름, 주소), act(이름, 함수, 인자): 함수를 부른 뒤 훑고 겹친 창을 닫음 */
function walker(p, res, tags) {
  const wait = (ms) => p.waitForTimeout(ms);
  const sweep = async (label) => {
    const r = await p.evaluate(([label, tags]) => ({ bad: __scan(label), seen: __seen(tags) }), [label, tags]);
    res.bad.push(...r.bad);
    r.seen.forEach((k) => res.seenSet.add(k));
    res.screens++;
  };
  const go = async (label, h, ms = 500) => {
    await p.evaluate((h) => {
      location.hash = h;
    }, h);
    await wait(ms);
    await sweep(label);
  };
  const act = async (label, fn, arg, ms = 300) => {
    await p.evaluate(fn, arg);
    await wait(ms);
    await sweep(label);
    await p.evaluate(() => closeOverlays());
  };
  return { wait, sweep, go, act };
}
const finish = async (p, res, errs, tags) => {
  res.hits = await p.evaluate(() => window.__hits.slice());
  res.unseen = tags.filter((k) => !res.seenSet.has(k));
  res.bad = [...new Set(res.bad)];
  res.errs = [...new Set(errs)];
  res.seen = res.seenSet.size;
  delete res.seenSet;
  if (res.hits.length) res.errs.push("주입한 글이 실행됨: " + res.hits.join(", "));
  if (res.bad.length) res.errs.push(...res.bad.slice(0, 12));
  if (res.unseen.length) res.errs.push("넣은 글이 어느 화면에도 글자 그대로 보이지 않음(시험이 그 자리에 닿지 못함): " + res.unseen.join(", "));
};

/* ---------------------------------------------------------------- 사용자 사이트 */
for (const [dev, engine, opts] of [
  ["Desktop Chrome", chromium, {}],
  ["iPhone 13", webkit, devices["iPhone 13"]]
]) {
  const res = { dev, page: "index.html", screens: 0, bad: [], seenSet: new Set() },
    tags = [...WORK_TAGS, ...ROOM_TAGS, ...SERVER_TAGS];
  const { b, ctx, p, errs } = await open(engine, opts, "index.html", "tokA");
  const { wait, sweep, go, act } = walker(p, res, [...tags, ...SCAN_ONLY]);
  try {
    // 넣기: 페르소나, 첫 작품의 글 칸 전부(가짜 작품), 그 작품으로 연 대화방
    const w = await p.evaluate(() => {
      const P = __P,
        me = S.personas[0],
        live = ORIGINALS[0];
      me.name = P("pname");
      me.memo = P("pmemo");
      me.desc = P("pdsc");
      const first = live.openings[0],
        field = P("field");
      Object.assign(live, {
        title: P("title"),
        name: P("name"),
        oneLiner: P("one"),
        desc: P("desc"),
        guide: P("guide"),
        creator: P("maker"),
        noteTemplate: P("tpl"),
        tags: [P("wtag")],
        world: P("world"),
        publishedAt: P("date"),
        fields: [...live.fields, field],
        cast: (live.cast || [{ code: "C" }]).map((x, i) => (i ? x : { ...x, name: P("cast"), desc: P("cdesc"), look: P("look") })),
        places: [{ name: P("place"), desc: P("pdesc") }],
        cuts: [{ title: P("cut"), when: P("when") }],
        commands: [{ cmd: "<u>밑줄", title: P("ctit"), desc: P("cdsc"), text: P("ctext") }],
        lore: [{ keys: [P("lkey"), "둘째 키"], text: P("ltext"), kind: "place" }, ...(live.lore || [])],
        openings: [
          { ...first, title: P("otit"), text: P("otext"), place: 1, suggestions: [P("osug")], status: { ...(first.status || {}), [field]: P("oval") } },
          ...live.openings.slice(1)
        ],
        // 에피소드형 작품의 진행표: 장 제목·갈림길의 물음과 보기·사건 제목·결말 이름이 화면에 보임(goal·text·brief는 AI에게만 감)
        episode: {
          beats: [
            {
              id: "one",
              title: P("btit"),
              goal: P("goal"),
              at: [1, 3],
              choice: {
                id: "road",
                ask: P("ask"),
                options: [
                  { id: "left", label: P("opt"), default: true },
                  { id: "right", label: P("opt2") }
                ]
              }
            },
            { id: "two", title: P("btit2"), goal: P("goal2"), at: [4, 8] }
          ],
          events: [{ id: "storm", title: P("evt"), text: P("evtx") }],
          endings: [
            { id: "good", title: P("end"), brief: P("brief"), when: { choice: { road: "left" } } },
            { id: "plain", title: P("end2"), brief: P("brief2") }
          ]
        }
      });
      S.wallet.pro = { until: Date.now() + 86400000 }; // 작품당 방 수 한도(무료 3개)에 걸리지 않게 — 이 시험은 같은 작품으로 방을 여럿 엶
      if (typeof HOME_ROWS !== "undefined" && HOME_ROWS[0]) {
        HOME_ROWS[0].title = P("row");
        HOME_ROWS[0].sub = P("rsub");
      }
      const r = newRoom(normalizeChar(getChar(live.id)), 0, me),
        st = { ...r.status, [field]: P("sval") };
      r.set.model = "lite";
      r.userNote = P("note");
      r.memory = P("mem");
      r.memHist = [{ at: Date.now(), label: P("mhl"), text: P("mht") }];
      r.pins = [{ id: uid("p"), text: P("pin"), at: Date.now() }];
      r.lastErr = P("err");
      const ai = {
        id: uid("m"),
        role: "ai",
        idx: 0,
        statusBefore: r.status,
        alts: [
          {
            text: `${P("ai")}\n\n"${P("aiq")}"\n\n*${P("aiem")}*`,
            status: st,
            suggestions: [P("sug")],
            lore: [live.lore[0].keys[0]],
            cost: P("cost"),
            ev: "storm"
          }
        ]
      };
      r.msgs.push({ id: uid("m"), role: "user", text: P("user") }, ai);
      r.status = st;
      r.bookmarks = [ai.id];
      Object.assign(r.ep, { t: 1, ask: "road", askAt: 1, seen: ["storm"] }); // 에피소드: 첫 장에서 사건이 하나 일어났고 갈림길 앞에 선 상태
      saveRoom(r);
      return { id: live.id, rid: r.id };
    });
    // 홈·검색·상세·도감
    await go("홈", "home", 700);
    await act("홈 검색", () => {
      S.q = __P("q");
      viewHome();
    });
    await p.evaluate(() => {
      S.q = "";
    });
    await go("상세", "c-" + w.id, 700);
    await act(
      "인물 시트",
      (id) => {
        const c = normalizeChar(getChar(id));
        castSheet(c, c.cast[0]);
      },
      w.id
    );
    await act("플레이 가이드 시트", (id) => guideSheet(getChar(id)), w.id);
    await go("도감", "codex-" + w.id, 700);
    // 새 대화방의 첫 답변 추천(작품이 적은 글 — AI 호출 없이 보임)
    await p.evaluate((id) => {
      const r = newRoom(normalizeChar(getChar(id)), 0, S.personas[0]);
      saveRoom(r);
      location.hash = "r-" + r.id;
    }, w.id);
    await wait(900);
    await act("새 방의 첫 답변 추천", () => toggleSug(), null, 400);
    // 대화방: 본문·상태창·오류 줄, 추천 답변, 입력창 ! 목록, 드로어의 모든 화면, 시트들
    await go("대화방", "r-" + w.rid, 1000);
    await act("갈림길 카드(오류 줄이 없을 때만 보임)", () => {
      room.lastErr = "";
      renderLog(true);
      window.__choice = !!document.querySelector("#log .ep-choice") && !!document.querySelector("#log .ep-ev");
    });
    await act("추천 답변", () => toggleSug(), null, 400);
    await act("! 명령어 목록", () => {
      const i = $("#inp");
      i.value = "!";
      i.oninput();
    });
    await p.evaluate(() => {
      const i = $("#inp");
      i.value = "";
      i.oninput();
    });
    for (const v of ["main", "status", "persona", "note", "memory", "bookmarks", "gallery", "places", "lore", "output"])
      await act("드로어 " + v, (v) => openRoomDrawer(v), v);
    await act("유저노트 양식 넣기", () => {
      openRoomDrawer("note");
      const t = $("#tpl");
      if (t) t.click();
    });
    for (const tab of ["cur", "pin", "hist", "cfg"])
      await act(
        "장기기억 탭 " + tab,
        (tab) => {
          openRoomDrawer("memory");
          const t = document.querySelector(`[data-tab="${tab}"]`);
          if (t) t.click();
        },
        tab
      );
    await act("모델 시트", () => openModelSheet());
    await act("페르소나 시트", () => personaSheet(S.personas[0]));
    await act("신고 시트", () => reportSheet(room, lastAi(room)), null, 500);
    await act("고정 시트", () => pinSheet(room, lastAi(room)));
    // 즉답 명령어(작품이 적은 글이 AI 없이 방에 남음)와 도움말 한 줄
    await act(
      "즉답 명령어",
      () => {
        const i = $("#inp");
        i.value = "!<u>밑줄";
        $("#form").requestSubmit();
      },
      null,
      500
    );
    await act(
      "도움말 한 줄",
      () => {
        const i = $("#inp");
        i.value = "!도움말";
        $("#form").requestSubmit();
      },
      null,
      400
    );
    // 가짜 응답: 스트리밍 중(쓰는 중 말풍선)과 끝난 뒤(본문·상태창 값·추천 답변이 파서를 거쳐 저장됨)
    await p.evaluate(() => {
      const P = __P,
        field = room.char.fields[room.char.fields.length - 1];
      window.llm = async (input, { onText }) => {
        const full = `${P("gen")}\n\n"${P("live")}"\n===STATE===\n` + JSON.stringify({ status: { [field]: P("gval") }, suggestions: [P("gsug"), "둘", "셋"] });
        for (let n = 60; n < full.length; n += 60) {
          onText({ text: full.slice(0, n) });
          await new Promise((r) => setTimeout(r, 40));
        }
        window.__mid = { bad: __scan("스트리밍 중"), seen: __seen(["live", "gen"]) };
        await new Promise((r) => setTimeout(r, 150));
        return full;
      };
      room.msgs.push({ id: uid("m"), role: "user", text: "두 번째 입력" });
      window.__turn = generate(null, quote(room.set));
    });
    await p.evaluate(() => window.__turn);
    await wait(400);
    {
      const mid = await p.evaluate(() => window.__mid || { bad: ["스트리밍 중: 가짜 응답이 돌지 않음"], seen: [] });
      res.bad.push(...mid.bad);
      mid.seen.forEach((k) => res.seenSet.add(k));
    }
    await sweep("가짜 응답 뒤");
    await act("가짜 응답의 추천 답변", () => toggleSug(), null, 400);
    await act("드로어 status(응답 뒤)", () => openRoomDrawer("status"));
    // 끝난 에피소드 방: 결말 카드(결말 이름·고른 길) → 외전 고르기 시트(인물 이름) → 외전 방(제목과 첫 장면 제안에 인물 이름이 들어감)
    await p.evaluate((id) => {
      const r = newRoom(normalizeChar(getChar(id)), 0, S.personas[0]);
      r.set.model = "lite";
      r.msgs.push(
        { id: uid("m"), role: "user", text: "끝으로" },
        { id: uid("m"), role: "ai", idx: 0, statusBefore: r.status, alts: [{ text: "결말 장면.", status: r.status, suggestions: [] }] }
      );
      Object.assign(r.ep, { t: 9, beat: 2, picks: { road: "left" }, seen: ["storm"], end: "good", over: true });
      saveRoom(r);
      location.hash = "r-" + r.id;
    }, w.id);
    await wait(900);
    await sweep("끝난 에피소드 방의 결말 카드");
    res.ep = { choice: await p.evaluate(() => !!window.__choice), end: await p.evaluate(() => !!document.querySelector("#log .ep-end")) };
    await p.evaluate(() => {
      const b = $("#epSide");
      if (b) b.click();
    });
    await wait(400);
    res.ep.sheet = await p.evaluate(() => !!document.querySelector(".overlay #sideGo"));
    await sweep("외전 고르기 시트");
    await p.evaluate(() => {
      const b = document.querySelector("#sideGo");
      if (b) b.click();
    });
    await wait(900);
    res.ep.side = await p.evaluate(() => !!(room && room.side) && !!document.querySelector("#log .side-pill"));
    await sweep("외전 방");
    if (!res.ep.choice || !res.ep.end || !res.ep.sheet || !res.ep.side)
      errs.push("에피소드 화면이 열리지 않음(갈림길 카드·결말 카드·외전 시트·외전 방): " + JSON.stringify(res.ep));
    await act("외전 방의 첫 장면 제안", () => toggleSug(), null, 400);
    // 대화 목록·MY·공지·내 문의
    await go("대화 목록", "chats", 700);
    await go("MY", "me", 900);
    await go("공지", "notice", 1000);
    await go("내 문의", "help-ask", 1100);
    await go("자주 묻는 질문", "help-faq", 500);
    // 주소에 넣은 글: 작품·대화방·도감·고객센터·로그인 복귀 주소
    for (const h of ["c-", "r-", "codex-", "help-", "login-c-", "notice-", ""]) await go("주소 #" + h + "…", h + encodeURIComponent(P("hash")), 350);
    if (out) {
      await p.evaluate((rid) => {
        location.hash = "r-" + rid;
      }, w.rid);
      await wait(700);
      await p.screenshot({ path: `${out}/inject_${dev.replace(/\W+/g, "_")}_room.png` });
    }
    await finish(p, res, errs, tags);
    // 소셜 로그인이 돌려준 오류 문구(주소의 #·? 뒤 — 새 탭으로 들어옴): 정해진 안내로만 보이고 주소의 글은 화면에 들어가지 않음
    for (const sep of ["#", "?"]) {
      const p2 = await ctx.newPage();
      p2.on("dialog", (d) => {
        res.errs.push("소셜 로그인 오류 문구에서 대화 상자가 뜸");
        d.dismiss().catch(() => {});
      });
      await p2.goto(`${site}index.html${sep}error=access_denied&error_code=bad&error_description=${encodeURIComponent(P("oauth"))}`, { waitUntil: "load" });
      await p2.waitForTimeout(1200);
      const r = await p2.evaluate(() => ({ bad: __scan("소셜 로그인 오류 문구"), hits: window.__hits.slice() }));
      if (r.bad.length || r.hits.length) res.errs.push(...r.bad, ...r.hits.map((x) => "실행됨: " + x));
      res.screens++;
      await p2.close();
    }
  } catch (e) {
    res.fail = String(e).slice(0, 400);
  }
  console.log(JSON.stringify(res));
  await b.close();
}

/* ---------------------------------------------------------------- 관리자 도구: 관리자 계정(공지 관리·받은 문의와 신고) → 관리자가 아닌 계정(안내에 계정 이메일이 보임) */
{
  const res = { dev: "관리자 도구", page: "admin.html", screens: 0, bad: [], seenSet: new Set() };
  const A = await open(chromium, {}, "admin.html", "tokB"),
    tools = walker(A.p, res, [...ADMIN_TAGS, ...SCAN_ONLY]);
  let errs = A.errs;
  try {
    await tools.go("공지 관리", "notice", 1100);
    await tools.act(
      "공지 고치기 시트",
      () => {
        const d = document.querySelector("details.notice");
        d.open = true;
        d.querySelector("[data-ned]").click();
      },
      null,
      400
    );
    await tools.go("받은 문의", "help-ask", 1300);
    await tools.act("받은 문의 펼침", () => {
      document.querySelectorAll("details.ask").forEach((d) => {
        d.open = true;
      });
    });
    await tools.go("MY(답변 대기 수)", "me", 1100);
    if (out) {
      await tools.go("받은 문의(스크린샷)", "help-ask", 1100);
      await A.p.screenshot({ path: `${out}/inject_admin_inbox.png` });
    }
    res.hits = await A.p.evaluate(() => window.__hits.slice());
    await A.b.close();
    // 관리자가 아닌 계정으로 관리자 도구의 공지 화면 — 안내 글에 그 계정의 이메일(서버가 준 값)이 들어감
    const N = await open(chromium, {}, "admin.html", "tokA"),
      t2 = walker(N.p, res, [...ADMIN_TAGS, ...SCAN_ONLY]);
    errs = errs.concat(N.errs);
    await t2.go("관리자 아님 안내", "notice", 1100);
    await t2.go("관리자 아님 · MY", "me", 900);
    res.hits = res.hits.concat(await N.p.evaluate(() => window.__hits.slice()));
    await N.b.close();
    res.unseen = ADMIN_TAGS.filter((k) => !res.seenSet.has(k));
    res.bad = [...new Set(res.bad)];
    res.errs = [...new Set(errs)];
    res.seen = res.seenSet.size;
    delete res.seenSet;
    if (res.hits.length) res.errs.push("주입한 글이 실행됨: " + res.hits.join(", "));
    if (res.bad.length) res.errs.push(...res.bad.slice(0, 12));
    if (res.unseen.length) res.errs.push("넣은 글이 어느 화면에도 글자 그대로 보이지 않음(시험이 그 자리에 닿지 못함): " + res.unseen.join(", "));
  } catch (e) {
    res.fail = String(e).slice(0, 400);
    delete res.seenSet;
  }
  console.log(JSON.stringify(res));
}
