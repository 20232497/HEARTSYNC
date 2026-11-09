// 트랙별 대화 경로: 성인 트랙 방은 서버 대화 관문으로만(본문·추천·요약 — Anthropic으로 한 번도 안 감), 일반 트랙 방은 내 키가 있으면 Anthropic으로 바로, 없으면 관문의 무료 길로.
// 관문·Anthropic은 route로 흉내 — 실제 서버로는 아무것도 안 감. 관문의 판정 자체(성인 인증·미성년·한도)는 단위 테스트 tests/unit/chat-gate.test.mjs
import { webkit, chromium, devices } from "playwright";
import { noSupabase } from "./_offline.mjs";
const url = process.argv[2];
const GATE = "https://gate.test/chat";
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "POST, OPTIONS" };
const pieces = (text) => text.match(/[\s\S]{1,40}/g);
const sseGate = (text) => pieces(text).map((t) => "data: " + JSON.stringify({ choices: [{ delta: { content: t } }] }) + "\n\n").join("") + 'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n';
const sseClaude = (text) => pieces(text).map((t) => "data: " + JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text: t } }) + "\n\n").join("") + 'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}\n\n';
const state = "\n===STATE===\n" + JSON.stringify({ status: {}, suggestions: ["하나", "둘", "셋"] });
// 요청의 시스템 글을 보고 본문·추천·요약 중 무엇인지 가려 그에 맞는 답을 줌
const answer = (sys, who) => /제안하라/.test(sys) ? JSON.stringify({ suggestions: [who + " 추천 1", who + " 추천 2", who + " 추천 3"] })
  : /장기기억용으로 요약/.test(sys) ? JSON.stringify({ title: "요약", summary: who + " 요약이에요." })
  : `*바람이 간판을 흔들었다.*\n\n한서윤: "${who}에서 온 대답이에요."` + state;

for (const [dev, engine] of [["iPhone 13", webkit], ["Galaxy S9+", chromium]]) {
  const b = await engine.launch(); const ctx = await b.newContext({ ...devices[dev] }); await noSupabase(ctx); const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const gate = [], claude = []; let gateFail = null;
  await ctx.route(GATE, (r) => {
    const q = r.request();
    if (q.method() === "OPTIONS") return r.fulfill({ status: 204, headers: CORS });
    const body = q.postDataJSON(); gate.push({ body, auth: q.headers().authorization || "" });
    if (gateFail) return r.fulfill({ status: gateFail.status, headers: CORS, contentType: "application/json", body: JSON.stringify({ code: gateFail.code }) });
    // 일반 트랙의 무료 길은 Anthropic 모양, 성인 트랙은 OpenAI 호환 모양의 스트림
    r.fulfill({ status: 200, headers: CORS, contentType: "text/event-stream", body: body.track === "general" ? sseClaude(answer(body.messages[0].content, "무료")) : sseGate(answer(body.messages[0].content, "관문")) });
  });
  await ctx.route("https://api.anthropic.com/**", (r) => {
    const q = r.request();
    if (q.method() === "OPTIONS") return r.fulfill({ status: 204, headers: CORS });
    const body = q.postDataJSON(); claude.push({ body, key: q.headers()["x-api-key"] || "" });
    r.fulfill({ status: 200, headers: CORS, contentType: "text/event-stream", body: sseClaude(answer(body.system, "클로드")) });
  });
  const res = { dev }, bad = [], check = (name, ok) => { if (!ok) bad.push(name); };
  try {
    await p.goto(url, { waitUntil: "load" }); await p.waitForTimeout(1200);
    await p.evaluate((GATE) => {
      CFG.chatUrl = GATE; S.settings.apiKey = "sk-ant-test";
      SB.s = { access_token: "tok-test", refresh_token: "r", expires_at: Date.now() + 3600000, user: { id: "u1", email: "a@example.test", provider: "email", providers: ["email"] } };
    }, GATE);
    const open = (track) => p.evaluate((track) => {
      const c = normalizeChar(JSON.parse(JSON.stringify(ORIGINALS.find((x) => x.id === "godseats")))); if (track) c.track = track;
      const r = newRoom(c, 0, S.personas[0]); r.set.model = "lite"; saveRoom(r); // 새 방의 기본은 권장 모델 — 이 시험은 경로만 보므로 라이트(무료 턴·quick)로 맞춤
      location.hash = "r-" + r.id; return r.char.track || "";
    }, track);
    const turn = (text) => p.evaluate(async (text) => {
      const free = S.wallet.freeUsed;
      room.msgs.push({ id: uid("m"), role: "user", text }); await generate(null, quote(room.set));
      const m = room.msgs[room.msgs.length - 1];
      return { text: m.role === "ai" ? curText(m) : "", err: room.lastErr || "", charged: S.wallet.freeUsed - free, shown: ($("#logInner") || document.body).textContent.includes("에서 온 대답") };
    }, text);

    // ① 성인 트랙 방: 본문 → 관문
    check("성인 방이 track을 사본에 굳힘", (await open("adult")) === "adult"); await p.waitForTimeout(700);
    const a1 = await turn("안녕");
    const g = gate[0] || { body: { messages: [{}] } };
    check("성인 본문이 관문으로 한 번", gate.length === 1 && claude.length === 0);
    check("관문 요청 모양", g.body.track === "adult" && g.body.tier === "quick" && g.body.messages[0].role === "system" && g.body.messages.slice(1).every((m) => m.role !== "system") && g.auth === "Bearer tok-test");
    check("성인 트랙 프롬프트: 암전 지시 없음·성인 고정 줄은 있음", !/암전/.test(g.body.messages[0].content) && /모든 등장인물은 성인이다/.test(g.body.messages[0].content));
    check("관문 스트림을 본문으로 읽음", /관문에서 온 대답/.test(a1.text) && !/STATE/.test(a1.text) && a1.shown && a1.charged === 1 && !a1.err);
    // ② 추천·요약도 같은 경로
    await p.evaluate(async () => { $("#sugBtn").click(); await new Promise((r) => setTimeout(r, 150)); $("#sugRe").click(); await new Promise((r) => setTimeout(r, 500)); });
    check("성인 방의 새 추천이 관문으로", gate.length === 2 && claude.length === 0 && (await p.evaluate(() => $$("#sugPanel [data-s]").map((x) => x.dataset.s).join("|"))) === "관문 추천 1|관문 추천 2|관문 추천 3");
    await p.evaluate(async () => { hideSug(); await maybeSummarize(room, true); });
    check("성인 방의 장기기억 요약이 관문으로", gate.length === 3 && claude.length === 0 && (await p.evaluate(() => room.memory)).includes("관문 요약이에요"));
    // ③ 막히는 경우: 어느 쪽 서버로도 나가지 않거나(미리 확인), 관문의 거절을 안내하고 하트·무료 턴을 돌려줌. Anthropic으로 대신 보내지 않음
    await p.evaluate(() => { room.userNote = "서윤은 열여덟 살로 한다"; });
    const m1 = await turn("계속");
    check("미성년 암시가 있으면 보내지 않음", gate.length === 3 && /미성년/.test(m1.err) && m1.charged === 0 && !m1.text);
    await p.evaluate(() => { room.userNote = ""; });
    gateFail = { status: 403, code: "adult_required" };
    const m2 = await turn("계속");
    check("관문이 성인 인증을 요구하면 안내", gate.length === 4 && /성인 인증/.test(m2.err) && m2.charged === 0);
    gateFail = { status: 429, code: "too_many" };
    check("하루 한도 안내", /한도/.test((await turn("계속")).err));
    gateFail = null;
    await p.evaluate(() => { window.__s = SB.s; SB.s = null; });
    const m3 = await turn("계속");
    check("로그인이 없으면 보내지 않고 안내", gate.length === 5 && /로그인/.test(m3.err) && m3.charged === 0);
    await p.evaluate(() => { SB.s = window.__s; CFG.chatUrl = ""; });
    const m4 = await turn("계속");
    check("관문 주소가 없으면 준비 중", gate.length === 5 && /준비 중/.test(m4.err));
    check("성인 방은 끝까지 Anthropic으로 가지 않음", claude.length === 0);
    await p.evaluate((GATE) => { CFG.chatUrl = GATE; }, GATE);
    // ④ 일반 트랙 방: Anthropic으로만
    check("일반 방은 track 없음", (await open("")) === ""); await p.waitForTimeout(700);
    const c1 = await turn("안녕");
    const c = claude[0] || { body: { system: "" } };
    check("일반 본문이 Anthropic으로 한 번", claude.length === 1 && gate.length === 5 && c.key === "sk-ant-test" && c.body.model === "claude-haiku-5-5");
    check("일반 트랙 프롬프트: 암전 지시 있음", /암전/.test(c.body.system));
    check("Anthropic 스트림을 본문으로 읽음", /클로드에서 온 대답/.test(c1.text) && c1.shown && !c1.err);
    await p.evaluate(async () => { await maybeSummarize(room, true); });
    check("일반 방의 요약도 Anthropic으로", claude.length === 2 && gate.length === 5);
    // ⑤ 일반 트랙의 무료 길: 내 키가 없으면 관문으로(로그인 필요), 서버에 없는 등급·무료 길이 없는 서버는 키 안내
    await p.evaluate(() => { S.settings.apiKey = ""; });
    check("관문이 있으면 키가 없어도 AI 연결 있음", await p.evaluate(() => hasClaudeKey()));
    const f1 = await turn("안녕"), fg = gate[gate.length - 1] || { body: { messages: [{}] } };
    check("키 없는 일반 방은 관문의 무료 길로", gate.length === 6 && claude.length === 2 && fg.body.track === "general" && fg.body.tier === "quick" && /암전/.test(fg.body.messages[0].content));
    check("무료 길의 Anthropic 모양 스트림을 본문으로 읽음", /무료에서 온 대답/.test(f1.text) && f1.shown && f1.charged === 1 && !f1.err);
    gateFail = { status: 403, code: "need_key" };
    const f2 = await turn("계속");
    check("서버에 없는 등급은 키 안내·환불", /API 키가 있어야/.test(f2.err) && f2.charged === 0);
    gateFail = { status: 500, code: "not_configured" };
    check("무료 길이 없는 서버면 키를 넣으라는 안내", /Anthropic API 키를 넣어/.test((await turn("계속")).err));
    gateFail = null;
    await p.evaluate(() => { SB.s = null; });
    const f3 = await turn("계속");
    check("무료 길도 로그인이 없으면 보내지 않고 안내", gate.length === 8 && claude.length === 2 && /로그인하면/.test(f3.err) && f3.charged === 0);
    res.counts = { gate: gate.length, claude: claude.length };
  } catch (e) { res.fail = String(e).slice(0, 300); }
  if (bad.length) res.fail = (res.fail ? res.fail + " · " : "") + bad.join(" / ");
  res.errs = errs; console.log(JSON.stringify(res)); await b.close();
}
