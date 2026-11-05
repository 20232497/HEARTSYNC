// 미성년 관문(사용자 사이트): 대화 앞부분·설정의 나이가 성인 경로를 끄는지, 시스템 규칙·실제 요청 경로·Claude 거절 우회까지 같은 판정을 따르는지,
// 출력 설정의 안내, 다시 쓰기 지침. 판정 자체(표현 표)는 단위 테스트 tests/unit/safety.test.mjs가 봄 — 여기서는 빌드된 페이지에서 경로가 이어지는지만
import { webkit, chromium, devices } from "playwright";
import { noSupabase } from "./_offline.mjs";
const url = process.argv[2];
for (const [dev, engine] of [["iPhone 13", webkit], ["Galaxy S9+", chromium]]) {
  const b = await engine.launch(); const ctx = await b.newContext({ ...devices[dev] }); await noSupabase(ctx); const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const res = { dev };
  try {
    await p.goto(url, { waitUntil: "load" }); await p.waitForTimeout(1200);
    res.errors = await p.evaluate(async () => {
      const bad = [], same = (got, want, what) => { if (got !== want) bad.push(`${what}: ${got} (기대 ${want})`); };
      // 성인 모드 켠 방 + 가짜 경로: OpenRouter는 "OR", Claude는 window.__claude로 답하거나 거절
      S.settings.isAgeVerified = true; S.settings.openRouterKey = "sk-or-test"; S.settings.apiKey = "sk-ant-test"; S.settings.autoFallback = true; S.engine = "byok";
      window.openRouterStream = async () => "OR";
      window.__claude = async () => "CLAUDE";
      window.byok = (...a) => window.__claude(...a);
      const w = normalizeChar(ORIGINALS.find((c) => c.id === "godseats"));
      const r = newRoom(w, 0, S.personas[0]); r.set.allowUnfiltered = true; setRoom(r);
      location.hash = "r-" + r.id; await new Promise((f) => setTimeout(f, 900));
      const say = (text) => { const m = { id: uid("m"), role: "user", text }; r.msgs.push(m); return m; };
      const drop = (m) => { r.msgs.splice(r.msgs.indexOf(m), 1); };
      const clean = (what) => same(unfilteredRoute(r), true, what + " 뒤 다시 성인 경로");
      const blocked = (what) => same(unfilteredRoute(r), false, what + "이 성인 경로를 막음");
      const ask = [{ role: "user", content: "규칙" }, { role: "user", content: "다음 장면" }];

      // 깨끗한 방: 성인 경로 + 시스템 규칙에 성인 항목
      clean("처음");
      same(/법적 성인/.test(rulesPrompt(r)), true, "깨끗한 방의 시스템 규칙에 성인 항목");
      same(await llm(ask, { room: r }), "OR", "깨끗한 방은 OpenRouter로");

      // 대화 앞부분의 나이: 경로·시스템 규칙·실제 요청이 함께 바뀌고, 거절해도 우회하지 않음
      const early = say("걔는 열일곱 살이야");
      blocked("대화의 나이");
      same(/법적 성인/.test(rulesPrompt(r)), false, "막힌 방의 시스템 규칙에 성인 항목 없음");
      same(await llm(ask, { room: r }), "CLAUDE", "막힌 방은 Claude로");
      window.__claude = async () => { throw { code: "refused", category: null }; };
      same(await llm(ask, { room: r }).catch((e) => e.code), "refused", "막힌 방은 거절을 우회하지 않음");
      window.__claude = async () => "죄송합니다. 도와드릴 수 없어요.";
      same(await llm(ask, { room: r }), "죄송합니다. 도와드릴 수 없어요.", "막힌 방은 거절 문구도 우회하지 않음");
      window.__claude = async () => "CLAUDE";
      // 기억력 밖으로 밀어내도 그대로
      for (let i = 0; i < r.set.mem * 2 + 4; i++) say("다음 장면으로 가자");
      blocked("기억력 밖으로 밀린 나이");
      drop(early); clean("그 말을 지운");
      r.msgs = r.msgs.filter((m) => m.text !== "다음 장면으로 가자");

      // 설정 칸마다
      const field = (what, set, undo) => { set(); blocked(what); undo(); clean(what); };
      const persona0 = r.char.persona;
      field("작품 설정의 나이", () => { r.char.persona = persona0 + "\n나이: 17"; }, () => { r.char.persona = persona0; });
      field("유저 캐릭터의 학년", () => { r.persona.desc = "고2 남학생"; }, () => { r.persona.desc = ""; });
      field("유저노트", () => { r.userNote = "서윤은 열여덟 살로 한다"; }, () => { r.userNote = ""; });
      field("장기기억", () => { r.memory = "그녀가 열일곱 살이라고 밝혔다"; }, () => { r.memory = ""; });
      // 키워드북은 buildInput처럼 원본 작품의 최신 것을 봄(방 사본이 아니라)
      const orig = getChar(r.char.id);
      field("원본 작품의 키워드북", () => { orig.lore.push({ keys: ["__시험"], text: "__시험은 열일곱 살", kind: "person" }); }, () => { orig.lore.pop(); });
      orig.lore.push({ keys: ["__개"], text: "늙은 개(14살)", kind: "creature" }); same(unfilteredRoute(r), true, "동물의 나이는 막지 않음"); orig.lore.pop();

      // 거절 우회: 메시지 앞쪽의 표현도 봄(예전엔 최근 3개만)
      const old = [{ role: "user", content: "규칙" }, { role: "user", content: "걔는 열일곱 살이야" }, ...Array.from({ length: 6 }, () => ({ role: "user", content: "다음" }))];
      same(canFallback(old), false, "우회: 앞쪽 메시지의 나이");
      same(canFallback(ask, null, r), true, "우회: 깨끗한 방은 허용");
      same(canFallback(ask, "cyber", r), false, "우회: 위험 능력 분류기는 그대로 막음");
      // 실제 턴의 메시지(상태창·[이번 응답] 안내문·시작 상황)가 스스로 걸리지 않아야 함 — 오리지널 전부, 시작 상황마다
      const turnOf = (room0) => { room0.msgs.push({ id: uid("m"), role: "user", text: "다음 장면으로 가자" }); return buildInput(room0, room0.msgs.length, room0.status); };
      for (const c of ORIGINALS) for (let i = 0; i < c.openings.length; i++) {
        const fresh = newRoom(normalizeChar(c), i, S.personas[0]); fresh.set.allowUnfiltered = true;
        same(canFallback(turnOf(fresh), null, fresh), true, `우회: ${c.id} 시작 상황 ${i}의 실제 메시지`);
      }

      // 출력 설정의 안내: 막힌 방에만
      const shown = async () => { openRoomDrawer("output"); await new Promise((f) => setTimeout(f, 250)); const t = $("#au").closest(".setcard").textContent; closeOverlays(); return /지금 이 대화방은 그런 표현이 있어 보호 모드예요/.test(t); };
      same(await shown(), false, "깨끗한 방엔 보호 모드 안내 없음");
      const note = say("걔는 고2야");
      same(await shown(), true, "막힌 방엔 보호 모드 안내");
      drop(note);

      // 다시 쓰기 지침: 방에 남지 않으니 창에서 막음
      window.regen = async (i, d) => { window.__regen = d; };
      const goDir = async (text) => {
        window.__regen = undefined; r.set.rerollAsk = true; regenAsk(0); await new Promise((f) => setTimeout(f, 100));
        $("#dir").value = text; $("#go").click(); await new Promise((f) => setTimeout(f, 100));
        const open = !!$("#dir"); closeOverlays(); r.set.rerollAsk = false; return { open, sent: window.__regen };
      };
      const stop = await goDir("여고생으로 바꿔서");
      same(stop.open, true, "미성년 암시 지침이면 창이 남음"); same(stop.sent, undefined, "미성년 암시 지침은 보내지 않음");
      const go = await goDir("서윤이 더 솔직하게");
      same(go.sent, "서윤이 더 솔직하게", "평범한 지침은 그대로");
      return bad;
    });
  } catch (e) { res.fail = String(e).slice(0, 300); }
  res.errs = errs; console.log(JSON.stringify(res)); await b.close();
}
