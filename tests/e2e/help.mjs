// 공지·고객센터 시험(끝에 메시지 신고 — 대화방 말풍선의 '신고'가 문의 표에 접수되는 흐름): Supabase를 page.route로 흉내 냄(실제 서버로는 아무것도 안 감 — docs/supabase.sql의 RLS·열 권한·트리거와 같은 규칙을 메모리로).
// 사용자 사이트(index.html): MY의 고객센터·약관 칸과 '새 공지' → 공지 메뉴(공개만·고정 먼저·메뉴 표시·예전 주소 #help-notice) → 자주 묻는 질문 찾기 → 둘러보기면 로그인 안내 →
//   로그인한 사람의 문의 남기기(보내는 칸은 열 권한 안의 것만)·하루 5건 제한·지우기 → 관리자 기능이 없음. 휴대폰(iPhone 13 WebKit)에서 가로 넘침 없음.
// 관리자 도구(admin.html, 같은 서버의 /admin.html): 로그인 안 함·관리자가 아닌 계정은 공지를 읽기만 하고 로그인 안내(SQL·계정 id는 안 보임) → 관리자 계정은 공지 메뉴를 누르면 바로 비공개 공지·새 공지·고치기·지우기 →
//   받은 문의에 답 → 답변 완료로 바뀜 → 사용자 화면의 '내 문의'에 답이 보임 → MY의 답변 대기 수 → 휴대폰 탭바 넘침 없음.
import { chromium, webkit, devices } from "playwright";
const [, , url, out] = process.argv;
const site = url.replace(/[^/]*$/, ""); // 저장소 루트(…/index.html이면 그 폴더)
const SB = "https://mblvphojbmxiuqnlxisi.supabase.co";
const U = { tokA: { id: "aaaaaaaa-0000-4000-8000-00000000000a", email: "user@example.test" }, tokB: { id: "bbbbbbbb-0000-4000-8000-00000000000b", email: "admin@example.test" }, tokC: { id: "cccccccc-0000-4000-8000-00000000000c", email: "reporter@example.test" } };
const iso = (minAgo) => new Date(Date.now() - minAgo * 60000).toISOString();
const db = {
  admins: [U.tokB.id], n: 10,
  notices: [
    { id: 1, title: "서비스 오픈 안내", body: "HEART SYNC를 찾아 주셔서 고마워요.\n자세한 내용: https://example.test/a?x=1&y=2", pinned: false, published: true, created_at: iso(300), updated_at: iso(300) },
    { id: 2, title: "점검 공지(고정)", body: "11월 6일 새벽 점검", pinned: true, published: true, created_at: iso(500), updated_at: iso(500) },
    { id: 3, title: "준비 중인 공지", body: "아직 비공개", pinned: false, published: false, created_at: iso(10), updated_at: iso(10) }
  ],
  inquiries: [], posts: [], patches: [],
  cats: ["account", "pay", "chat", "image", "adult", "bug", "suggest", "etc"] // 문의 분류 제약 — 처음엔 2026-11-05의 것('report' 없음), 신고 시험이 docs/SETUP.md의 SQL을 실행한 것처럼 'report'를 더함
};
const json = (route, status, body) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: body === undefined ? "" : JSON.stringify(body) });
const who = (req) => { const t = (req.headers()["authorization"] || "").replace("Bearer ", ""); return U[t] ? U[t].id : null; };
const isAdmin = (uid) => !!uid && db.admins.includes(uid);
const eq = (u, k) => { const v = u.searchParams.get(k); return v && v.startsWith("eq.") ? decodeURIComponent(v.slice(3)) : null; };
const denied = (route) => json(route, 403, { code: "42501", message: "new row violates row-level security policy" });
async function handler(route) {
  const req = route.request(), u = new URL(req.url()), p = u.pathname, m = req.method(), uid = who(req);
  if (m === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" } });
  const body = req.postData() ? JSON.parse(req.postData()) : null;
  if (p === "/rest/v1/kv") return m === "GET" ? json(route, 200, []) : json(route, m === "POST" ? 201 : 204);
  if (p === "/auth/v1/logout") return json(route, 204);
  if (p === "/rest/v1/admins") { const x = eq(u, "user_id"); return json(route, 200, uid && x === uid && isAdmin(uid) ? [{ user_id: uid }] : []); }
  if (p === "/rest/v1/notices") {
    const id = +eq(u, "id");
    if (m === "GET") return json(route, 200, db.notices.filter((n) => n.published || isAdmin(uid)).sort((a, b) => (b.pinned - a.pinned) || (a.created_at < b.created_at ? 1 : -1)));
    if (!isAdmin(uid)) return m === "POST" ? denied(route) : json(route, 200, []); // RLS: 고치기·지우기는 0행
    if (m === "POST") { const n = { id: ++db.n, title: body.title, body: body.body, pinned: !!body.pinned, published: body.published !== false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }; db.notices.push(n); return json(route, 201, [n]); }
    const n = db.notices.find((x) => x.id === id); if (!n) return json(route, 200, []);
    if (m === "PATCH") { Object.assign(n, body, { updated_at: new Date().toISOString() }); return json(route, 200, [n]); }
    if (m === "DELETE") { db.notices = db.notices.filter((x) => x !== n); return json(route, 200, [{ id }]); }
  }
  if (p === "/rest/v1/inquiries") {
    if (!uid) return json(route, 401, { code: "42501", message: "permission denied for table inquiries" });
    const id = +eq(u, "id"), mine = (a) => a.user_id === uid || isAdmin(uid);
    if (m === "GET") {
      const fu = eq(u, "user_id"), fs = eq(u, "status");
      return json(route, 200, db.inquiries.filter((a) => mine(a) && (!fu || a.user_id === fu) && (!fs || a.status === fs)).sort((a, b) => b.id - a.id));
    }
    if (m === "POST") {
      db.posts.push(Object.keys(body).sort().join(","));
      if (Object.keys(body).some((k) => !["category", "title", "body", "reply_to", "meta"].includes(k))) return json(route, 403, { code: "42501", message: "permission denied for table inquiries" }); // 열 권한
      if (db.inquiries.filter((a) => a.user_id === uid).length >= 5) return json(route, 400, { code: "P0001", message: "too_many_inquiries", hint: "문의는 하루 5건까지" });
      if (!db.cats.includes(body.category)) return json(route, 400, { code: "23514", message: 'new row for relation "inquiries" violates check constraint "inquiries_category_check"' });
      const a = Object.assign({ id: ++db.n, user_id: uid, status: "open", answer: null, answered_at: null, created_at: new Date().toISOString() }, body); db.inquiries.push(a); return json(route, 201, [a]);
    }
    const a = db.inquiries.find((x) => x.id === id && mine(x));
    if (m === "PATCH") {
      db.patches.push(Object.keys(body).sort().join(","));
      if (!a || !isAdmin(uid)) return json(route, 200, []);
      if (Object.keys(body).some((k) => !["answer", "status"].includes(k))) return json(route, 403, { code: "42501", message: "permission denied" });
      if ("answer" in body && body.answer !== a.answer) { a.answered_at = body.answer ? new Date().toISOString() : null; }
      Object.assign(a, body); if (a.answer && a.status === "open") a.status = "answered"; // 트리거 inquiries_guard
      return json(route, 200, [a]);
    }
    if (m === "DELETE") { if (!a) return json(route, 200, []); db.inquiries = db.inquiries.filter((x) => x !== a); return json(route, 200, [{ id }]); }
  }
  return json(route, 404, { message: "mock: unknown " + p });
}
const res = {}, errs = [], browsers = [];
async function open(engine, dev, page, tok) {
  const b = await engine.launch(); browsers.push(b);
  const ctx = await b.newContext({ ...devices[dev] });
  await ctx.route(SB + "/**", handler);
  // 로그인 상태는 세션을 미리 넣어 흉내(계정 화면 시험은 social·vault)
  await ctx.addInitScript(([s]) => { try { if (s && !localStorage.getItem("hv1_auth")) localStorage.setItem("hv1_auth", JSON.stringify(s)); localStorage.setItem("hv1_guest", "1"); } catch (e) {} },
    [tok ? { access_token: tok, refresh_token: "r" + tok, expires_at: Date.now() + 86400000, user: { id: U[tok].id, email: U[tok].email, provider: "email", providers: ["email"] } } : null]);
  const pg = await ctx.newPage();
  pg.on("pageerror", (e) => errs.push(dev + " pageerror: " + e.message));
  pg.on("console", (msg) => { if (msg.type() === "error" && !/Failed to load resource/.test(msg.text())) errs.push(dev + " console: " + msg.text().slice(0, 200)); });
  await pg.goto(site + page, { waitUntil: "load" }); await pg.waitForTimeout(1000);
  await pg.evaluate(() => { closeOverlays(); setAudience("all"); });
  return pg;
}
const hash = async (pg, h, ms = 600) => { await pg.evaluate((h) => { location.hash = h; }, h); await pg.waitForTimeout(ms); };
const fail = [];
const expect = (ok, what) => { if (!ok) fail.push(what); };
try {
  // ---------- 사용자 사이트: 둘러보기
  const G = await open(chromium, "Desktop Chrome", "index.html", null);
  await hash(G, "me", 900);
  res.me = await G.evaluate(() => ({ help: [...document.querySelectorAll("#helpMenu [data-go]")].map((b) => b.dataset.go), docs: [...document.querySelectorAll(".menu-list a")].map((a) => a.getAttribute("href")), newNotice: (document.querySelector("#noticeNew") || {}).textContent, nav: (document.querySelector("[data-nav].on") || {}).dataset?.nav }));
  expect(res.me.help.join() === "notice,help-faq,help-ask", "MY 고객센터 칸");
  expect(res.me.docs.includes("terms.html") && res.me.docs.includes("privacy.html"), "MY 약관 및 정책 링크");
  expect(res.me.newNotice === "새 공지", "MY 새 공지 표시");
  await G.click("#rail [data-nav=notice]"); await G.waitForTimeout(900);
  res.notice = await G.evaluate(() => ({ hash: location.hash, h1: (document.querySelector("#view h1") || {}).textContent, back: !!document.querySelector("#view [aria-label='MY로 돌아가기']"), titles: [...document.querySelectorAll("details.notice b")].map((b) => b.textContent), pinned: !!document.querySelector("details.notice .pill"), firstOpen: document.querySelector("details.notice").open, link: (document.querySelector("details.notice .nbody a") || {}).href, nav: (document.querySelector("[data-nav].on") || {}).dataset?.nav, admin: !!document.querySelector("#nNew, .adm-note") }));
  expect(res.notice.titles.join("|") === "점검 공지(고정)|서비스 오픈 안내", "공지: 공개만·고정 먼저 " + res.notice.titles.join("|"));
  expect(res.notice.link === "https://example.test/a?x=1&y=2", "공지 본문 주소 링크");
  expect(res.notice.hash === "#notice" && res.notice.h1 === "공지" && !res.notice.back, "공지: 메뉴 화면(뒤로 버튼 없음) " + JSON.stringify([res.notice.hash, res.notice.h1, res.notice.back]));
  expect(res.notice.nav === "notice" && !res.notice.admin, "공지: 메뉴 표시·관리자 버튼 없음");
  await hash(G, "me", 500);
  res.meAfter = await G.evaluate(() => (document.querySelector("#noticeNew") || {}).textContent);
  expect(res.meAfter === "", "공지를 본 뒤 새 공지 표시가 사라짐");
  await hash(G, "help-notice", 700);
  res.oldNotice = await G.evaluate(() => ({ hash: location.hash, titles: document.querySelectorAll("details.notice").length, nav: (document.querySelector("[data-nav].on") || {}).dataset?.nav }));
  expect(res.oldNotice.hash === "#notice" && res.oldNotice.titles === 2 && res.oldNotice.nav === "notice", "예전 주소 #help-notice → #notice");
  await hash(G, "help", 400);
  res.helpTabs = await G.evaluate(() => ({ tabs: [...document.querySelectorAll("[data-htab]")].map((b) => b.dataset.htab), on: (document.querySelector("[data-htab].on") || {}).dataset?.htab, nav: (document.querySelector("[data-nav].on") || {}).dataset?.nav }));
  expect(res.helpTabs.tabs.join() === "faq,ask" && res.helpTabs.on === "faq" && res.helpTabs.nav === "me", "고객센터 탭: 자주 묻는 질문·문의하기");
  await hash(G, "help-faq", 400);
  res.faq = await G.evaluate(async () => {
    const all = document.querySelectorAll("details.faq").length, q = document.querySelector("#faqQ");
    q.value = "비밀번호"; q.oninput();
    const shown = [...document.querySelectorAll("details.faq")].filter((d) => !d.hidden), hit = shown.every((d) => d.textContent.includes("비밀번호") && d.open);
    q.value = "없는낱말zz"; q.oninput();
    return { all, shown: shown.length, hit, none: !document.querySelector("#faqNone").hidden };
  });
  expect(res.faq.all >= 15 && res.faq.shown > 0 && res.faq.shown < res.faq.all && res.faq.hit && res.faq.none, "FAQ 찾기");
  await hash(G, "help-ask", 400);
  res.askGuest = await G.evaluate(() => ({ login: !!document.querySelector("#helpBody [data-go=login]"), mail: !!document.querySelector("#helpBody a[href^='mailto:']") }));
  expect(res.askGuest.login && res.askGuest.mail, "둘러보기: 로그인 안내·메일");
  res.userBuildAdmin = await G.evaluate(() => ({ noticeSheet: typeof noticeSheet, loadInbox: typeof loadInbox, ext: EXT.help.length }));
  expect(res.userBuildAdmin.noticeSheet === "undefined" && res.userBuildAdmin.loadInbox === "undefined" && res.userBuildAdmin.ext === 0, "사용자 빌드에 관리자 함수 없음");
  if (out) await G.screenshot({ path: `${out}/help_faq.png`, fullPage: true });

  // ---------- 사용자 사이트: 로그인한 사용자 A의 문의
  const A = await open(chromium, "Desktop Chrome", "index.html", "tokA");
  await hash(A, "help-ask", 900);
  await A.click("#aSend"); await A.waitForTimeout(150);
  res.emptyErr = await A.textContent("#aErr");
  expect(/제목/.test(res.emptyErr), "빈 제목 막기");
  await A.selectOption("#aCat", "bug"); await A.fill("#aTitle", "대화방이 안 열려요"); await A.fill("#aBody", "작품 상세에서 시작하기를 누르면 아무 일도 없어요."); await A.fill("#aMail", "reply@example.test");
  res.metaDefault = await A.isChecked("#aMeta"); res.bugHint = await A.textContent("#aErr"); await A.check("#aMeta");
  expect(!res.metaDefault && /앱·브라우저/.test(res.bugHint), "앱 정보는 기본 꺼짐·오류 신고면 안내");
  await A.click("#aSend"); await A.waitForTimeout(900);
  res.sent = await A.evaluate(() => ({ items: [...document.querySelectorAll("#askList details.ask b")].map((b) => b.textContent), status: (document.querySelector("#askList .pill") || {}).textContent, cleared: document.querySelector("#aTitle").value === "" }));
  res.firstPost = db.posts[0]; res.meta = db.inquiries[0] && db.inquiries[0].meta;
  expect(res.sent.items[0] === "대화방이 안 열려요" && res.sent.status === "답변 대기" && res.sent.cleared, "문의 남기기 → 내 문의");
  expect(res.firstPost === "body,category,meta,reply_to,title", "보내는 칸은 열 권한 안의 것만: " + res.firstPost);
  expect(!!(res.meta && res.meta.ua && res.meta.screen && res.meta.app === "user"), "앱·브라우저 정보");
  await A.evaluate(async () => { for (let i = 0; i < 4; i++) await SUPPORT.ask({ category: "etc", title: "추가 " + i, body: "다섯 건 채우기" }); });
  await A.fill("#aTitle", "여섯 번째"); await A.fill("#aBody", "하루 다섯 건이 넘어요"); await A.click("#aSend"); await A.waitForTimeout(700);
  res.limit = await A.textContent("#aErr");
  expect(/하루 5건/.test(res.limit), "하루 5건 제한 안내");
  await hash(A, "help-faq", 200); await hash(A, "help-ask", 900);
  const before =await A.evaluate(() => document.querySelectorAll("#askList details.ask").length);
  await A.evaluate(() => { const d = [...document.querySelectorAll("#askList details.ask")].find((x) => x.textContent.includes("추가 3")); d.open = true; d.querySelector("[data-adel]").click(); });
  await A.waitForTimeout(200); await A.click(".overlay #ok"); await A.waitForTimeout(800);
  res.del = { before, after: await A.evaluate(() => document.querySelectorAll("#askList details.ask").length), server: db.inquiries.length };
  expect(res.del.after === before - 1 && res.del.server === 4, "내 문의 지우기");
  res.hiddenNotice = await A.evaluate(async () => (await SUPPORT.notices()).some((n) => !n.published));
  expect(!res.hiddenNotice, "일반 계정에 비공개 공지 안 보임");

  // ---------- 관리자 도구: 로그인 안 함 · 관리자가 아닌 계정(A) — 공지는 읽기만, 로그인 안내(SQL·계정 id 없음)
  const adminView = (pg) => pg.evaluate(() => { const n = document.querySelector(".adm-note"); return { note: n ? n.textContent : "", go: n ? (n.querySelector("[data-go]") || {}).dataset?.go : null, sql: !!document.querySelector(".adm-note pre"), newBtn: !!document.querySelector("#nNew"), edit: document.querySelectorAll(".nadm").length, titles: document.querySelectorAll("details.notice").length }; });
  const AG = await open(chromium, "Desktop Chrome", "admin.html", null);
  await hash(AG, "notice", 1000);
  res.adminGuest = await adminView(AG);
  expect(res.adminGuest.note.includes("관리자 계정으로 로그인") && res.adminGuest.go === "login" && !res.adminGuest.newBtn && res.adminGuest.titles === 2, "관리자 도구·로그인 안 함: 안내와 읽기만 " + JSON.stringify(res.adminGuest));
  await AG.click(".adm-note [data-go]"); await AG.waitForTimeout(300);
  expect((await AG.evaluate(() => location.hash)) === "#login", "로그인 안내 버튼 → 로그인 화면");
  const AA = await open(chromium, "Desktop Chrome", "admin.html", "tokA");
  await hash(AA, "notice", 1000);
  res.adminNotAdmin = await adminView(AA);
  expect(res.adminNotAdmin.note.includes("관리자 계정으로 로그인") && res.adminNotAdmin.note.includes("user@example.test") && res.adminNotAdmin.go === "me", "관리자 아님 안내: " + res.adminNotAdmin.note);
  expect(!res.adminNotAdmin.sql && !res.adminNotAdmin.note.includes("insert into") && !res.adminNotAdmin.note.includes("aaaaaaaa-0000"), "관리자 아님 안내에 SQL·계정 id 없음");
  expect(!res.adminNotAdmin.newBtn && !res.adminNotAdmin.edit && res.adminNotAdmin.titles === 2, "관리자 아님: 공지는 읽기만");

  // ---------- 관리자 도구: 관리자 계정(B) — 메뉴를 누르면 누를 것 없이 바로 관리 화면
  const B = await open(chromium, "Desktop Chrome", "admin.html", "tokB");
  res.adminNavs = await B.evaluate(() => [...document.querySelectorAll("#rail [data-nav]")].map((b) => b.dataset.nav));
  await B.click("#rail [data-nav=notice]"); await B.waitForTimeout(1100);
  res.adminNotice = await B.evaluate(() => ({ hash: location.hash, note: !!document.querySelector(".adm-note"), nav: (document.querySelector("[data-nav].on") || {}).dataset?.nav, titles: [...document.querySelectorAll("details.notice b")].map((b) => b.textContent), hiddenPill: !!document.querySelector("details.notice .pill.gold"), edit: document.querySelectorAll(".nadm").length, newBtn: !!document.querySelector("#nNew") }));
  expect(res.adminNotice.hash === "#notice" && res.adminNotice.nav === "notice" && !res.adminNotice.note, "관리자: 공지 메뉴로 들어옴·안내 없음");
  expect(res.adminNotice.titles.length === 3 && res.adminNotice.hiddenPill && res.adminNotice.edit === 3 && res.adminNotice.newBtn, "관리자: 비공개 공지·고치기 버튼");
  await B.click("#nNew"); await B.waitForTimeout(200);
  await B.click("#ntS"); await B.waitForTimeout(150);
  res.noTitle = await B.textContent("#ntE");
  await B.fill("#ntT", "새 기능: 고객센터"); await B.fill("#ntB", "공지사항·자주 묻는 질문·문의하기가 생겼어요."); await B.check("#ntP");
  await B.click("#ntS"); await B.waitForTimeout(900);
  res.created = await B.evaluate(() => [...document.querySelectorAll("details.notice b")].map((b) => b.textContent));
  expect(/제목/.test(res.noTitle) && res.created[0] === "새 기능: 고객센터", "새 공지 올리기(고정이라 맨 위)");
  await B.evaluate(() => { const d = [...document.querySelectorAll("details.notice")].find((x) => x.textContent.includes("서비스 오픈")); d.open = true; d.querySelector("[data-ned]").click(); });
  await B.waitForTimeout(200); await B.fill("#ntT", "서비스 오픈 안내(수정)"); await B.click("#ntS"); await B.waitForTimeout(900);
  await B.evaluate(() => { const d = [...document.querySelectorAll("details.notice")].find((x) => x.textContent.includes("준비 중인")); d.open = true; d.querySelector("[data-ndel]").click(); });
  await B.waitForTimeout(200); await B.click(".overlay #ok"); await B.waitForTimeout(900);
  res.edited = { titles: await B.evaluate(() => [...document.querySelectorAll("details.notice b")].map((b) => b.textContent)), server: db.notices.map((n) => n.title) };
  expect(res.edited.titles.includes("서비스 오픈 안내(수정)") && !res.edited.titles.some((t) => t.includes("준비 중인")) && res.edited.server.length === 3, "공지 고치기·지우기");
  await hash(B, "help-ask", 1200);
  res.inbox = await B.evaluate(() => ({ n: document.querySelectorAll("#inbox details.ask").length, mineOnly: document.querySelectorAll("#askList details.ask").length }));
  expect(res.inbox.n === 4 && res.inbox.mineOnly === 0, "받은 문의 4건(관리자 자신의 '내 문의'는 0)");
  await B.evaluate(() => { const d = [...document.querySelectorAll("#inbox details.ask")].find((x) => x.textContent.includes("대화방이 안 열려요")); d.open = true; d.querySelector("[data-ans]").value = "새로 고침 뒤에도 그러면 브라우저 이름을 알려 주세요."; d.querySelector("[data-save]").click(); });
  await B.waitForTimeout(1000);
  res.answered = { patch: db.patches[0], status: db.inquiries.find((a) => a.title === "대화방이 안 열려요").status, inboxAfter: await B.evaluate(() => document.querySelectorAll("#inbox details.ask").length) };
  expect(res.answered.patch === "answer,status" && res.answered.status === "answered" && res.answered.inboxAfter === 3, "답변 → 답변 완료(대기 목록에서 빠짐)");
  await hash(B, "me", 1200);
  res.adminMe = await B.evaluate(() => (document.querySelector("#inOpen") || {}).textContent);
  expect(res.adminMe === "답변 대기 3건", "MY 답변 대기 수: " + res.adminMe);
  if (out) await B.screenshot({ path: `${out}/help_admin_me.png` });

  // ---------- 사용자 A: 답이 보임 · 휴대폰 가로 넘침
  await hash(A, "notice", 300); await hash(A, "help-ask", 900);
  res.userSees = await A.evaluate(() => { const d = [...document.querySelectorAll("#askList details.ask")].find((x) => x.textContent.includes("대화방이 안 열려요")); return d && { answer: (d.querySelector(".answer") || {}).textContent || "", pill: d.querySelector(".pill").textContent }; });
  expect(res.userSees && res.userSees.answer.includes("브라우저 이름") && res.userSees.pill === "답변 완료", "사용자에게 답변이 보임");
  const P = await open(webkit, "iPhone 13", "index.html", "tokA");
  res.mobile = {};
  for (const h of ["notice", "help-faq", "help-ask", "me"]) {
    await hash(P, h, 900);
    res.mobile[h] = await P.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(res.mobile[h] <= 0, `휴대폰 ${h} 가로 넘침 ${res.mobile[h]}px`);
  }
  await hash(P, "help-ask", 600);
  if (out) await P.screenshot({ path: `${out}/help_ask_iphone.png`, fullPage: true });
  await hash(P, "notice", 700);
  if (out) await P.screenshot({ path: `${out}/notice_user_iphone.png` });
  // 휴대폰 탭바: 사용자·관리자 모두 5칸(홈·대화·공지·스토어·MY) — 좁은 폭(320px)에서도 글자가 한 줄로 칸 안에 들어옴(wrapped: 이미/지처럼 꺾인 칸)
  const tabFit = (pg) => pg.evaluate(() => {
    const t = document.querySelector("#tabbar"), bs = [...t.querySelectorAll("button")];
    const lines = (b) => { const r = document.createRange(); r.selectNodeContents(b.querySelector("span")); return r.getClientRects().length; };
    return { n: bs.length, over: t.scrollWidth - t.clientWidth, clipped: bs.filter((b) => b.scrollWidth > b.clientWidth).map((b) => b.textContent), wrapped: bs.filter((b) => lines(b) > 1).map((b) => b.textContent), page: document.documentElement.scrollWidth - innerWidth };
  });
  res.tabUser = await tabFit(P);
  expect(res.tabUser.n === 6 && res.tabUser.over <= 0 && !res.tabUser.clipped.length && !res.tabUser.wrapped.length, "사용자 탭바 6칸 " + JSON.stringify(res.tabUser));
  const PA = await open(webkit, "iPhone 13", "admin.html", "tokB");
  await hash(PA, "notice", 1000);
  res.tabAdmin = await tabFit(PA);
  expect(res.tabAdmin.n === 6 && res.tabAdmin.over <= 0 && !res.tabAdmin.clipped.length && !res.tabAdmin.wrapped.length && res.tabAdmin.page <= 0, "관리자 탭바 6칸 " + JSON.stringify(res.tabAdmin));
  if (out) await PA.screenshot({ path: `${out}/notice_admin_iphone.png` });
  await PA.setViewportSize({ width: 320, height: 640 }); await PA.waitForTimeout(250);
  res.tabAdmin320 = await tabFit(PA);
  expect(res.tabAdmin320.over <= 0 && !res.tabAdmin320.clipped.length && !res.tabAdmin320.wrapped.length && res.tabAdmin320.page <= 0, "관리자 탭바 320px " + JSON.stringify(res.tabAdmin320));
  if (out) await PA.screenshot({ path: `${out}/notice_admin_320.png` });
  await hash(B, "notice", 800);
  if (out) await B.screenshot({ path: `${out}/notice_admin_desktop.png` });
  if (out) await AA.screenshot({ path: `${out}/notice_notadmin_desktop.png` });

  // ---------- 메시지 신고(사용자 C): AI 말풍선의 '신고' → 사유·덧붙일 말·'앞부분 함께 보내기'(기본 켜짐) → 문의 표에.
  // 서버 제약이 예전 것이면 '기타'로 접수(제목 [신고]), SQL을 실행한 뒤에는 '신고' 분류. 끄면 메시지 앞부분은 안 감. 관리자 목록에 신고 배지. 로그인 안 했으면 안내만
  const C = await open(chromium, "Desktop Chrome", "index.html", "tokC");
  const reportOpen = (pg) => pg.evaluate(async () => {
    const nap = (ms) => new Promise((r) => setTimeout(r, ms));
    if (!room) { const r = newRoom(normalizeChar(ORIGINALS[0]), 0, S.personas[0]); location.hash = "r-" + r.id; await nap(900); }
    document.querySelector('#log [data-act="report"]').click(); await nap(200);
    const pv = document.querySelector("#rpPv"), q = document.querySelector("#rpQuote");
    return { title: (document.querySelector(".overlay h2") || {}).textContent, checked: q ? q.checked : null, pv: pv ? pv.textContent : null, text: document.querySelector(".overlay").textContent.replace(/\s+/g, " ").slice(0, 200), login: !!document.querySelector(".overlay [data-go=login]"), mail: !!document.querySelector('.overlay a[href^="mailto:"]') };
  });
  const sheet1 = await reportOpen(C), n0 = db.inquiries.length, p0 = db.posts.length;
  // 사유는 미리 골라 두지 않음 — 고르지 않고 보내면 안내만 하고 서버로 가지 않음. 사유는 일곱 가지(REPORT_REASONS)
  await C.click("#rpSend"); await C.waitForTimeout(200);
  res.reportNoReason = await C.evaluate(() => ({ err: document.querySelector("#rpErr").textContent, chips: document.querySelectorAll("#rpWhy [data-why]").length, on: document.querySelectorAll("#rpWhy .on").length, want: REPORT_REASONS.length }));
  expect(/사유를 골라/.test(res.reportNoReason.err) && db.posts.length === p0 && res.reportNoReason.chips === res.reportNoReason.want && res.reportNoReason.chips === 7 && res.reportNoReason.on === 0, "사유를 고르지 않으면 보내지 않음·사유 일곱 가지 " + JSON.stringify(res.reportNoReason));
  await C.click('.overlay [data-why="error"]'); await C.fill("#rpNote", "같은 말을 되풀이해요"); await C.click("#rpSend"); await C.waitForTimeout(900);
  const first = db.inquiries[db.inquiries.length - 1] || {};
  res.reportOld = { sheet: { title: sheet1.title, checked: sheet1.checked, pvLen: (sheet1.pv || "").length, tag: /\[\[/.test(sheet1.pv || "") }, added: db.inquiries.length - n0, tries: db.posts.length - p0, category: first.category, title: first.title, body: first.body, closed: await C.evaluate(() => !document.querySelector("#rpSend")) };
  expect(sheet1.title === "이 메시지 신고" && sheet1.checked === true && res.reportOld.sheet.pvLen > 10 && res.reportOld.sheet.pvLen <= 300 && !res.reportOld.sheet.tag, "신고 시트: 앞부분 미리보기(300자 이내·그림 태그 없음)·기본 켜짐 " + JSON.stringify(res.reportOld.sheet));
  expect(res.reportOld.added === 1 && res.reportOld.tries === 2 && first.category === "etc" && /^\[신고\] 오류·이상한 응답 — /.test(first.title || "") && res.reportOld.closed, "예전 서버 제약이면 '기타'로 접수 " + JSON.stringify([res.reportOld.added, res.reportOld.tries, first.category, first.title]));
  expect(/^사유: 오류·이상한 응답\n작품: /.test(first.body || "") && first.body.includes("같은 말을 되풀이해요") && first.body.includes("[신고한 메시지 앞부분]\n" + sheet1.pv), "신고 내용: 사유·작품·덧붙일 말·메시지 앞부분");
  db.cats.push("report"); // docs/SETUP.md '메시지 신고 분류'의 SQL을 실행한 뒤
  await reportOpen(C); await C.uncheck("#rpQuote");
  const pvHidden = await C.evaluate(() => document.querySelector("#rpPv").hidden);
  await C.click('.overlay [data-why="minor"]'); await C.click("#rpSend"); await C.waitForTimeout(900);
  const second = db.inquiries[db.inquiries.length - 1] || {};
  res.reportNew = { category: second.category, title: second.title, quote: (second.body || "").includes("[신고한 메시지 앞부분]"), pvHidden };
  expect(second.category === "report" && /^\[신고\] 미성년자 관련 성적 내용 — /.test(second.title || "") && !res.reportNew.quote && pvHidden, "SQL 실행 뒤에는 '신고' 분류·끄면 메시지 앞부분은 안 감 " + JSON.stringify(res.reportNew));
  await hash(C, "help-ask", 900);
  res.reportMine = await C.evaluate(() => [...document.querySelectorAll("#askList details.ask")].map((d) => (d.querySelector(".pill.err") ? "우선" : d.querySelector(".pill.gold") ? "신고" : "")));
  expect(res.reportMine.length === 2 && res.reportMine.slice().sort().join() === "신고,우선", "내 문의에 신고 2건(배지 — 하나는 우선 신고) " + JSON.stringify(res.reportMine));
  await hash(B, "help-faq", 200); await hash(B, "help-ask", 1200);
  // 관리자의 받은 문의: 우선 처리할 신고(미성년자 관련·자해·자살 조장)는 맨 위에 따로, 그 밖의 신고는 받은 순서 자리에 '신고' 배지
  res.reportInbox = await B.evaluate(() => { const ds = [...document.querySelectorAll("#inbox details.ask")], kind = (d) => (d.querySelector(".pill.err") ? "우선" : d.querySelector(".pill.gold") ? "신고" : "");
    return { first: kind(ds[0]), firstTitle: ds[0].querySelector("b").textContent.slice(0, 18), head: (document.querySelector("#inUrgent") || {}).textContent || "", headFirst: document.querySelector("#inbox").firstElementChild.id, kinds: ds.map(kind).filter(Boolean) }; });
  expect(res.reportInbox.first === "우선" && res.reportInbox.firstTitle === "[신고] 미성년자 관련 성적 내용" && /우선 처리할 신고 1건/.test(res.reportInbox.head) && res.reportInbox.headFirst === "inUrgent" && res.reportInbox.kinds.slice().sort().join() === "신고,우선", "관리자의 받은 문의: 우선 신고가 맨 위에 따로 " + JSON.stringify(res.reportInbox));
  await hash(B, "me", 1200);
  res.reportAdminMe = await B.evaluate(() => (document.querySelector("#inOpen") || {}).textContent);
  expect(/우선 신고 1건/.test(res.reportAdminMe || ""), "MY의 답변 대기 수에 우선 신고 수: " + res.reportAdminMe);
  const GR = await open(chromium, "Desktop Chrome", "index.html", null);
  const guest = await reportOpen(GR);
  res.reportGuest = { title: guest.title, form: guest.checked !== null, login: guest.login, mail: guest.mail };
  expect(guest.title === "이 메시지 신고" && guest.checked === null && guest.login && guest.mail, "로그인 안 했으면 신고 폼 대신 로그인·메일 안내 " + JSON.stringify(res.reportGuest));
} catch (e) { errs.push("script: " + (e && e.stack || e).toString().slice(0, 400)); }
for (const b of browsers) await b.close().catch(() => {});
res.fail = fail; res.errs = errs;
console.log(JSON.stringify(res, null, 1));
