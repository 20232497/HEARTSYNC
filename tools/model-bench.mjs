// 모델 비교 시험(개발 도구 — 앱·빌드에 들어가지 않음): 성인 트랙 후보 모델에 같은 한국어 대화를 시켜 보고 중립 지표를 잰다.
//   OPENROUTER_API_KEY=… node tools/model-bench.mjs --models a/b,c/d [--work seodoyun] [--turns 4] [--out 폴더] [--tokens 3200] [--reasoning '{"enabled":false}']
// 길: 앱의 진짜 코드(프롬프트 buildInput → 호출 llm → 스트림 해석 → 상태창 parseState)와 진짜 관문 코드(docs/edge/chat.ts handle)를 그대로 거쳐
// 진짜 모델 서버를 부른다. 흉내 내는 것은 계정 서버뿐(tests/unit/_idv-fake.mjs — 로그인·성인 인증·하루 한도).
// 대화 내용은 공개 저장소의 일반 작품과 평범한 입력만 쓴다 — 프롬프트는 일반 트랙의 것(암전 지시 포함)을 그대로 보내고, 경로만 관문으로 돌린다.
// 재는 것: 형식(상태창 JSON·추천 3개·그림 태그), 한국어 비율과 다른 글자 섞임, 분량·대사 줄 수, 유저 대사 대신 쓰기, 끊김, 첫 글자까지·전체 시간, 토큰·생각 토큰·비용.
// 글의 자연스러움은 숫자로 안 나오므로 --out 폴더의 대화 기록(.md)을 사람이 읽고 판단한다.
import fs from "node:fs";
import path from "node:path";
import { AsyncLocalStorage } from "node:async_hooks";
import { llm } from "../src/js/ai/llm.js";
import { LEN } from "../src/js/ai/models.js";
import { dropEcho, looseJSON, parseState, splitReply } from "../src/js/ai/parse.js";
import { buildInput } from "../src/js/ai/prompt/input.js";
import { ORIGINALS } from "../src/js/content/index.js";
import { CFG } from "../src/js/core/config.js";
import { newRoom } from "../src/js/core/rooms.js";
import { messagesMinorHint } from "../src/js/core/safety.js";
import { codebook, imgTags } from "../src/js/images/codes.js";
import { SB } from "../src/js/services/supabase.js";
import { A, fakeWorld, loadEdge } from "../tests/unit/_idv-fake.mjs";

const arg = (name, def) => { const i = process.argv.indexOf("--" + name); return i > 0 ? process.argv[i + 1] : def; };
const models = String(arg("models", "")).split(",").map((s) => s.trim()).filter(Boolean);
const key = process.env.OPENROUTER_API_KEY || "";
if (!models.length || !key) { console.error("쓰는 법: OPENROUTER_API_KEY=… node tools/model-bench.mjs --models 모델1,모델2 [--work 작품id] [--turns 4] [--out 폴더] [--tokens 3200]"); process.exit(2); }
const work = ORIGINALS.find((c) => c.id === arg("work", "seodoyun"));
if (!work) { console.error("모르는 작품: " + arg("work") + " (가능: " + ORIGINALS.map((c) => c.id).join(", ") + ")"); process.exit(2); }
const turns = Math.max(1, +arg("turns", 4) || 4), maxTokens = +arg("tokens", LEN.mid.tokens) || LEN.mid.tokens, outDir = arg("out", path.join(".build", "bench"));
const SAID = ["안녕. 여기서 보게 될 줄은 몰랐네. 요즘 어떻게 지냈어?", "*잠깐 말을 고르다가* 솔직히 좀 긴장돼. 네 얘기부터 들려줄래?", "// 갑자기 비가 쏟아지기 시작한다. 둘이 비를 피할 곳을 찾게 해 줘", "아까 한 말, 진심이야? 농담이었으면 조금 서운할 것 같은데.", "*웃으며* 그럼 다음엔 내가 살게. 약속.", "오늘 고마웠어. 조심히 들어가."];

/* 진짜 관문을 이 프로세스 안에서 돌림: 앱의 llm()이 부르는 CFG.chatUrl 요청을 handle()에 넘기고, handle()의 모델 서버 호출만 진짜로 나감 */
const { handle } = await loadEdge("chat");
const GATE = "https://gate.local/chat", now = new Date(), als = new AsyncLocalStorage(), realFetch = globalThis.fetch;
const world = fakeWorld({ OPENROUTER_API_KEY: key });
world.add({ id: "hs" + "a".repeat(32), user_id: A, checked_at: now.toISOString(), adult: true, test: false, expires_at: new Date(now.getTime() + 864e5).toISOString() });
const reasoning = arg("reasoning") ? JSON.parse(arg("reasoning")) : undefined; // 주면 그 모델들에 이 생각 설정을 붙임(없으면 관문의 기본)
const env = (k) => { const m = reasoning ? { model: als.getStore().model, reasoning } : als.getStore().model; return k === "CHAT_MODELS" ? JSON.stringify({ adult: { quick: m, default: m, complex: m } }) : k === "CHAT_DAILY_LIMIT" ? "100000" : world.env(k); };
const upstream = async (url, opt = {}) => {
  if (!String(url).startsWith("https://openrouter.ai/")) return world.fetch(url, opt);
  const meta = als.getStore().meta, res = await realFetch(url, opt);
  meta.http = res.status;
  if (!res.ok || !res.body) { meta.err = (await res.clone().text().catch(() => "")).slice(0, 300); return res; }
  const [a, b] = res.body.tee();
  (async () => { // 관문이 그대로 흘려보내는 스트림을 옆에서 읽어 토큰·생각 글·제공자를 적어 둠
    const dec = new TextDecoder(); let buf = "";
    for await (const chunk of b) {
      buf += dec.decode(chunk, { stream: true });
      let i; while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (line.startsWith(":")) { meta.alive++; continue; } // 주석 줄(keep-alive)
        if (!line.startsWith("data:")) continue;
        try { const ev = JSON.parse(line.slice(5)), d = ev.choices && ev.choices[0] && ev.choices[0].delta;
          if (ev.provider) meta.provider = ev.provider; if (ev.usage) meta.usage = ev.usage; if (ev.error) meta.err = JSON.stringify(ev.error).slice(0, 300);
          if (d && (d.reasoning || d.reasoning_content)) meta.think += String(d.reasoning || d.reasoning_content).length;
          if (ev.choices && ev.choices[0] && ev.choices[0].finish_reason) meta.finish = ev.choices[0].finish_reason; } catch {}
      }
    }
  })().catch(() => {});
  return new Response(a, { status: res.status, headers: res.headers });
};
globalThis.fetch = (url, opt = {}) => String(url) === GATE ? handle(new Request(GATE, opt), env, upstream, () => new Date(), messagesMinorHint) : realFetch(url, opt);
CFG.chatUrl = GATE;
SB.s = { access_token: "tokA", refresh_token: "r", expires_at: Date.now() + 864e5, user: { id: A, email: "" } };

const count = (s, re) => (s.match(re) || []).length;
function measure(text, c, said, persona) {
  const { json } = splitReply(text), body = dropEcho(splitReply(text).body, said).trim(), plain = body.replace(/\[\[[^\]]*\]\]/g, "");
  const v = looseJSON(json), st = v && typeof v === "object" ? (v.status && typeof v.status === "object" ? v.status : v) : null, book = codebook(c), tags = imgTags(body);
  const ko = count(plain, /[가-힣]/g), latin = count(plain, /[A-Za-z]/g), han = count(plain, /[一-鿿]/g), kana = count(plain, /[぀-ヿ]/g), other = count(plain, /[Ѐ-ӿ฀-๿؀-ۿ]/g);
  return { body, chars: plain.length, state: !!json, json: !!st, fields: st ? c.fields.filter((f) => st[f] !== undefined && st[f] !== "").length + "/" + c.fields.length : "0/" + c.fields.length,
    sug: v && Array.isArray(v.suggestions) ? v.suggestions.length : 0, tags: tags.length, badTags: tags.filter((t) => !book[t.code] || t.sit < book[t.code].min || t.sit > book[t.code].max).length,
    ko: ko + latin + han + kana + other ? Math.round((ko / (ko + latin + han + kana + other)) * 100) : 0, latin, han, kana, other,
    lines: count(plain, /^.*["“].*$/gm), asUser: count(plain, new RegExp("^\\s*" + persona + "\\s*:", "gm")), echo: body.length < splitReply(text).body.trim().length };
}
async function runModel(model) {
  const r = newRoom(JSON.parse(JSON.stringify(work)), 0, { id: "p1", name: "지호", memo: "", desc: "" }), rows = [], log = [`# ${model} — ${work.title}`, "", "## 시작 상황", r.msgs[0].alts[0].text];
  r.set.len = "mid";
  for (let t = 0; t < turns; t++) {
    const said = SAID[t % SAID.length], meta = { think: 0, alive: 0 }, before = r.status, t0 = Date.now(); let first = 0, text = "", err = "";
    r.msgs.push({ id: "u" + t, role: "user", text: said });
    const input = buildInput(r, r.msgs.length, before); // 프롬프트는 일반 트랙의 것(이 시점에 방의 track은 비어 있음)
    try { text = await als.run({ model, meta }, () => llm(input, { tier: "default", maxTokens, room: { ...r, char: { ...r.char, track: "adult" } }, signal: AbortSignal.timeout(240000), onText: () => { first = first || Date.now() - t0; } })); }
    catch (e) { err = (e && e.code) || String(e).slice(0, 80); text = (e && e.text) || ""; }
    const m = measure(text, r.char, said, r.persona.name), u = meta.usage || {}, parsed = parseState(text, r.char, before);
    rows.push({ model, turn: t + 1, err, http: meta.http, finish: meta.finish || "", provider: meta.provider || "", first, total: Date.now() - t0, ...m, body: undefined,
      inTok: u.prompt_tokens, outTok: u.completion_tokens, thinkTok: (u.completion_tokens_details || {}).reasoning_tokens, thinkChars: meta.think, alive: meta.alive, cost: u.cost, upstream: meta.err });
    log.push("", `## ${t + 1}턴 — 지호`, said, "", `### 응답 (${m.chars}자 · ${Date.now() - t0}ms${err ? " · 오류 " + err : ""}${meta.finish ? " · " + meta.finish : ""})`, m.body || "(없음)", "", "상태창: `" + JSON.stringify(parsed.status) + "`", "추천: " + JSON.stringify(parsed.suggestions), "", "받은 글의 끝(상태창 자리): `" + text.slice(-260).replace(/\s+/g, " ") + "`");
    if (!m.body) break; // 답이 없으면 더 보내지 않음
    r.msgs.push({ id: "a" + t, role: "ai", idx: 0, alts: [{ text: m.body, ...parsed }], statusBefore: before }); r.status = parsed.status;
  }
  fs.writeFileSync(path.join(outDir, model.replace(/[^\w.-]+/g, "_") + "__" + work.id + ".md"), log.join("\n"));
  return rows;
}
fs.mkdirSync(outDir, { recursive: true });
const all = (await Promise.all(models.map((m) => runModel(m).catch((e) => [{ model: m, turn: 0, err: String(e).slice(0, 120) }])))).flat();
fs.writeFileSync(path.join(outDir, "result__" + work.id + ".json"), JSON.stringify(all, null, 1));
const pad = (v, n) => String(v === undefined || v === null ? "-" : v).padEnd(n);
console.log(["모델", "턴", "오류", "끝", "첫글자ms", "전체ms", "글자", "한글%", "영문", "한자", "가나", "상태", "칸", "추천", "태그", "나쁜태그", "대사줄", "유저대사", "입력tok", "출력tok", "생각tok", "주석줄", "비용$"].join("\t"));
for (const x of all) console.log([pad(x.model, 34), x.turn, x.err || "-", x.finish || "-", x.first, x.total, x.chars, x.ko, x.latin, x.han, x.kana, x.json ? "OK" : x.state ? "깨짐" : "없음", x.fields, x.sug, x.tags, x.badTags, x.lines, x.asUser, x.inTok, x.outTok, x.thinkTok === undefined ? (x.thinkChars ? "~" + x.thinkChars + "자" : "-") : x.thinkTok, x.alive, x.cost === undefined ? "-" : (+x.cost).toFixed(5)].join("\t") + (x.upstream ? "\t" + x.upstream : ""));
console.log("\n대화 기록·결과: " + path.resolve(outDir));
process.exit(0);
