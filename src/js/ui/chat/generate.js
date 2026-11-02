/* 한 턴 보내기 → 응답 생성(generate)·다시 쓰기·인물 그림 채우기(addCastImages) */
import { unfilteredRoute } from "../../ai/adult.js";
import { errCopy, llm } from "../../ai/llm.js";
import { LEN, MODELS } from "../../ai/models.js";
import { dropEcho, parseState, splitReply } from "../../ai/parse.js";
import { buildInput } from "../../ai/prompt/input.js";
import { maybeSummarize } from "../../ai/prompt/memory.js";
import { curText, saveRoom } from "../../core/rooms.js";
import { gen, room, setGen } from "../../core/state.js";
import { $, uid } from "../../core/util.js";
import { charge, qShort, quote, refund } from "../../core/wallet.js";
import { imagesOf, imgTags } from "../../images/pick.js";
import { sitScores } from "../../images/situations.js";
import { IMG, validRef } from "../../services/images.js";
import { autoScroll, followLog, renderLog, setStick, stick, syncJump } from "./log.js";
import { liveFill } from "./render.js";
import { hideSug } from "./suggest.js";
import { lastAi, updateComposer, updateMeter } from "./view.js";
import { ensurePay } from "../pay.js";
import { closeOverlays, sheet } from "../sheet.js";

export async function sendTurn(text, { cont = false } = {}) {
  if (gen) return false;
  const q = await ensurePay(room); if (!q) return false;
  room.lastErr = "";
  room.msgs.push(cont ? { id: uid("m"), role: "user", text: "(이어서)", sys: true } : { id: uid("m"), role: "user", text });
  hideSug();
  generate(null, q);
  return true;
}
export function regenAsk(i) {
  if (!room.set.rerollAsk) return regen(i);
  const q = quote(room.set);
  const sh = sheet(`<h2>다시 쓰기</h2><p class="sub">어떤 방향으로 다시 쓸지 적으면 반영해요. 비워 두면 그냥 새로 써요.</p>
    <div class="field"><label for="dir">다시 쓸 방향 (선택)</label><textarea id="dir" maxlength="300" placeholder="예: 서윤이 좀 더 솔직하게 반응하도록 / 전투를 더 길게"></textarea></div>
    <div class="cta-row"><button class="btn ghost" data-x>취소</button><span class="spacer"></span><button class="btn pri" id="go">다시 쓰기 · ${qShort(q)}</button></div>`);
  $("#dir", sh).focus();
  $("#go", sh).onclick = () => { const d = $("#dir", sh).value.trim(); closeOverlays(); regen(i, d); };
}
export async function regen(i, direction = "") {
  if (gen) return;
  const q = await ensurePay(room); if (!q) return;
  room.msgs = room.msgs.slice(0, i + 1);
  generate(room.msgs[i], q, direction);
}
/* 매 응답, 장면에 나온 인물마다 그림 한 장: AI가 [[img]]를 빠뜨린 인물은 그 인물이 처음 말하거나(이름: …) 지문에 나오는 줄 위에 붙임.
   번호는 처음 등장이면 0, 아니면 그 인물의 대사·지문 낱말(×2)과 유저 입력 낱말(그 인물을 불렀거나, 아무도 안 불렀으면 처음 나온 인물만)로
   sitScores가 가장 높은 번호(그림이 있는 칸이면 0.5 더함), 없으면 1(기본). 출연진이 한 명이면 첫 대사 위(없으면 맨 위) */
function addCastImages(body, r, prev, said) {
  const c = r.char, cast = (c.cast || []).filter((x) => x.name && x.name !== r.persona.name);
  if (!cast.length || !body.trim()) return body;
  const lines = body.split("\n"), have = new Set(imgTags(body).map((t) => t.code)), imgs = imagesOf(c), adult = unfilteredRoute(r);
  const seen = new Set(); prev.forEach((m) => imgTags(curText(m)).forEach((t) => seen.add(t.code)));
  const keysOf = (x) => { const n = x.name.trim(), k = [n], first = n.split(/\s+/)[0]; if (first !== n && first.length >= 2) k.push(first); if (/^[가-힣]{3,4}$/.test(n)) k.push(n.slice(1)); return k; };
  const said2 = said || "", anyNamed = cast.some((x) => keysOf(x).some((k) => said2.includes(k)));
  const found = [];
  for (const x of cast) {
    const keys = keysOf(x);
    const speaks = (l) => keys.some((k) => new RegExp("^\\s*" + k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*:").test(l));
    const mentions = (l) => keys.some((k) => l.includes(k));
    let at = lines.findIndex(speaks);
    if (at < 0) at = lines.findIndex((l) => /^\s*\*/.test(l) && mentions(l));
    if (at < 0 && cast.length === 1) at = Math.max(0, lines.findIndex((l) => /["“]/.test(l)));
    if (at >= 0) found.push({ x, keys, at, own: lines.filter((l) => speaks(l) || (cast.length === 1 ? !/^\s*\[/.test(l) : mentions(l))).join("\n") });
  }
  found.sort((a, b) => a.at - b.at);
  const adds = [];
  found.forEach((f, i) => {
    if (have.has(f.x.code)) return;
    let sit = 1;
    if (!seen.has(f.x.code)) sit = 0;
    else {
      const sc = new Map(); sitScores(f.own, adult).forEach((v, k) => sc.set(k, v * 2));
      if (said2 && (f.keys.some((k) => said2.includes(k)) || (!anyNamed && i === 0))) sitScores(said2, adult).forEach((v, k) => sc.set(k, (sc.get(k) || 0) + v));
      let best = 0; sc.forEach((v, k) => { const s = v + (validRef((imgs[f.x.code] || {})[k]) ? 0.5 : 0); if (s > best) { best = s; sit = k; } });
    }
    adds.push({ at: f.at, tag: `[[img:${f.x.code}:${sit}]]` });
  });
  adds.slice(0, 5).sort((a, b) => b.at - a.at).forEach((a) => lines.splice(a.at, 0, a.tag, ""));
  return lines.join("\n");
}
/* target 없으면 새 AI 메시지, 있으면 그 메시지에 새 버전(alt) 추가 */
export async function generate(target, q, direction = "", isEdit = false) {
  const r = room, c = r.char, model = r.set.model;
  let msg = target, altIdx;
  if (!msg) {
    const prev = lastAi(r);
    const before = prev ? (prev.alts[prev.idx].status || prev.statusBefore) : r.status;
    msg = { id: uid("m"), role: "ai", idx: 0, alts: [{ text: "" }], statusBefore: before };
    r.msgs.push(msg); altIdx = 0;
  } else { msg.alts.push({ text: "" }); altIdx = msg.alts.length - 1; msg.idx = altIdx; }
  const input = buildInput(r, r.msgs.indexOf(msg), msg.statusBefore, direction);
  const label = `${c.title} · ${MODELS[model].name}${target ? " 다시 쓰기" : ""}`;
  charge(q, label);
  const ctl = new AbortController();
  setGen({ ctl, msgId: msg.id });
  hideSug(); // 추천 답변은 '✦ AI 추천'을 눌렀을 때만 펼침
  setStick(true); renderLog(true); updateComposer();
  const said = (() => { const u = r.msgs[r.msgs.indexOf(msg) - 1]; return u && u.role === "user" && !u.sys && !u.text.startsWith("//") ? u.text : ""; })();
  const show = (t) => {
    // 화면엔 본문만: 상태 구분자가 오기 시작했거나(=== STATE 일부) JSON·코드블록 줄이 시작되면 그 줄부터 숨김
    const body = dropEcho(splitReply(t).body, said).replace(/\n?[ \t]*=+[ \t]*[A-Z]*[ \t]*=*\s*$/, "").replace(/\n[ \t]*(?:```|\{)[^\n]*$/, "").replace(/\[\[[^\]]*$/, "");
    msg.alts[altIdx].text = body.trim();
    if (room !== r) return;
    const el = $("#liveBubble");
    if (el) { liveFill(el, msg.alts[altIdx].text, c, r.persona); IMG.hydrate(el); followLog(); }
    else { renderLog(stick && autoScroll()); syncJump(); }
  };
  try {
    const text = await llm(input, { tier: MODELS[model].tier, signal: ctl.signal, onText: ({ text }) => show(text), maxTokens: (LEN[r.set.len] || LEN.mid).tokens, room: r });
    show(text);
    const parsed = parseState(text, c, msg.statusBefore);
    const bodyText = msg.alts[altIdx].text ? addCastImages(msg.alts[altIdx].text, r, r.msgs.slice(0, r.msgs.indexOf(msg)), said) : "(빈 응답)";
    Object.assign(msg.alts[altIdx], parsed, { text: bodyText, cost: qShort(q), lore: input.lore });
    r.status = parsed.status;
    if (!target && !isEdit) { r.turn = (r.turn || 0) + 1; r.sinceMem = (r.sinceMem || 0) + 1; }
  } catch (e) {
    const keep = e && e.text ? splitReply(e.text).body.trim() : "";
    if (keep && e.code === "cancelled") Object.assign(msg.alts[altIdx], { text: keep, status: msg.statusBefore, cost: qShort(q) });
    else {
      msg.alts.splice(altIdx, 1);
      if (!msg.alts.length) r.msgs.splice(r.msgs.indexOf(msg), 1); else msg.idx = msg.alts.length - 1;
      refund(q, label);
      const copy = errCopy(e); if (copy) r.lastErr = copy;
    }
  } finally {
    setGen(null);
    saveRoom(r);
    if (room === r && $("#logInner")) {
      renderLog(stick && autoScroll()); syncJump(); updateComposer(); updateMeter(); $("#inp")?.focus({ preventScroll: true });
    }
    maybeSummarize(r);
  }
}
export function stopGen() { if (gen) gen.ctl.abort(); }
