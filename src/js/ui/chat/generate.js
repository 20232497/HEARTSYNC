/* 한 턴 보내기 → 응답 생성(generate)·다시 쓰기·빠진 인물 그림 태그 채우기(addCastImages) */
import { errCopy, llm } from "../../ai/llm.js";
import { LEN, MODELS } from "../../ai/models.js";
import { dropEcho, parseState, splitReply } from "../../ai/parse.js";
import { buildInput } from "../../ai/prompt/input.js";
import { maybeSummarize } from "../../ai/prompt/memory.js";
import { exampleCast } from "../../core/character.js";
import { epAfter, epPick } from "../../core/episode.js";
import { markEnding } from "../../core/shelf.js";
import { curText, saveRoom } from "../../core/rooms.js";
import { gen, holdRoom, releaseRoom, room, setGen } from "../../core/state.js";
import { $, esc, toast, uid } from "../../core/util.js";
import { charge, qShort, quote, refund, refundSug } from "../../core/wallet.js";
import { imgTag, imgTags } from "../../images/codes.js";
import { imagesOf } from "../../images/pick.js";
import { sitScores } from "../../images/situations.js";
import { IMG, validRef } from "../../services/images.js";
import { autoScroll, followLog, renderLog, setStick, stick, syncJump } from "./log.js";
import { liveFill } from "./render.js";
import { hideSug, showSug } from "./suggest.js";
import { lastAi, updateComposer, updateMeter } from "./view.js";
import { ensurePay } from "../pay.js";
import { collectSeen } from "../room-tools.js";
import { closeOverlays, sheet } from "../sheet.js";

/* 에피소드 진행 상태의 사본 — 메시지마다 ep0(그 메시지 직전)·ep1(그 응답 뒤)로 적어 두고 다시 쓰기·삭제·버전 바꾸기가 되돌림 */
export const epCopy = (st) => JSON.parse(JSON.stringify(st));
/* 한 턴 보내기. pick: 에피소드 갈림길 카드로 보낸 것이면 그 보기 id — 진행 상태를 먼저 고른 뒤로 바꿔 놓고 응답을 받음(이번 응답은 다음 장에서 시작). 끝난 에피소드 방에서는 보내지 않음 */
export async function sendTurn(text, { cont = false, pick = "" } = {}) {
  if (gen || (room.ep && room.ep.over)) return false;
  const q = await ensurePay(room);
  if (!q) return false;
  room.lastErr = "";
  const u = cont ? { id: uid("m"), role: "user", text: "(이어서)", sys: true } : { id: uid("m"), role: "user", text };
  if (room.ep) {
    u.ep0 = epCopy(room.ep);
    if (pick) room.ep = epPick(room.char.episode, room.ep, pick, room.status?.[room.char.gauge]);
  }
  room.msgs.push(u);
  hideSug();
  generate(null, q);
  return true;
}
export function regenAsk(i) {
  if (!room.set.rerollAsk) return regen(i);
  const q = quote(room.set);
  const sh = sheet(
    `<h2>다시 쓰기</h2><p class="sub">어떤 방향으로 다시 쓸지 적으면 반영해요. 비워 두면 그냥 새로 써요.</p>
    <div class="field"><label for="dir">다시 쓸 방향 (선택)</label>` +
      `<textarea id="dir" maxlength="300" placeholder="예: ${esc(exampleCast(room.char).name)}의 반응을 더 솔직하게 / 장면을 더 길게"></textarea></div>
    <div class="cta-row"><button class="btn ghost" data-x>취소</button><span class="spacer"></span>` +
      `<button class="btn pri" id="go">다시 쓰기 · ${qShort(q)}</button></div>`
  );
  $("#dir", sh).focus();
  $("#go", sh).onclick = () => {
    const d = $("#dir", sh).value.trim();
    closeOverlays();
    regen(i, d);
  };
}
export async function regen(i, direction = "") {
  if (gen) return;
  const r = room,
    q = await ensurePay(r);
  if (!q || r !== room) return;
  // 새 버전이 본문 하나 없이 실패하면 되돌릴 것 — 그대로 두면 에피소드 진행이 이 응답 앞으로 돌아간 채 남음
  // (보고 있던 버전도 — 실패 처리는 남은 마지막 버전을 고르므로, 앞 버전을 보다가 다시 쓰면 본문과 진행이 어긋남)
  const m = r.msgs[i],
    was = { msgs: r.msgs, ep: r.ep ? epCopy(r.ep) : null, idx: m.idx };
  r.lastErr = ""; // 새로 시도하므로 앞의 오류 줄은 거둠(실패하면 다시 적힘)
  r.msgs = r.msgs.slice(0, i + 1);
  if (r.ep && m.ep0) r.ep = epCopy(m.ep0); // 에피소드: 이 응답 직전 상태에서 다시
  const undo = () => {
    r.msgs = was.msgs;
    m.idx = was.idx;
    if (was.ep) r.ep = was.ep;
    return "";
  };
  generate(m, q, direction, { undo });
}
/* 매 응답, 장면에 나온 인물마다 그림 한 장: AI가 [[코드번호]]를 빠뜨린 인물은 그 인물이 처음 말하거나(이름: …) 지문에 나오는 줄 위에 붙임.
   번호는 처음 등장이면 0, 아니면 그 인물의 대사·지문 낱말(×2)과 유저 입력 낱말(그 인물을 불렀거나, 아무도 안 불렀으면 처음 나온 인물만)로
   sitScores가 가장 높은 번호(그림이 있는 칸이면 0.5 더함), 없으면 1(기본).
   다른 모습(폼, cast[].of)은 본체와 한 사람 — 어느 쪽 태그든 있으면 넘어가고, 빠졌을 땐 본체 코드로 붙임. 출연진이 한 명이면 첫 대사 위(없으면 맨 위) */
function addCastImages(body, r, prev, said) {
  const c = r.char,
    all = c.cast || [],
    baseOf = (code) => {
      const f = all.find((x) => x.code === code);
      return f && f.of ? f.of : code;
    };
  const cast = all.filter((x) => x.name && !x.of && x.name !== r.persona.name);
  if (!cast.length || !body.trim()) return body;
  const lines = body.split("\n"),
    have = new Set(imgTags(body).map((t) => baseOf(t.code))),
    imgs = imagesOf(c);
  const seen = new Set();
  prev.forEach((m) => imgTags(curText(m)).forEach((t) => seen.add(baseOf(t.code))));
  const keysOf = (x) => {
    const n = x.name.trim(),
      k = [n],
      first = n.split(/\s+/)[0];
    if (first !== n && first.length >= 2) k.push(first);
    if (/^[가-힣]{3,4}$/.test(n)) k.push(n.slice(1));
    return k;
  };
  const said2 = said || "",
    anyNamed = cast.some((x) => keysOf(x).some((k) => said2.includes(k)));
  const found = [];
  for (const x of cast) {
    const keys = keysOf(x);
    const speaks = (l) => keys.some((k) => new RegExp("^\\s*" + k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*:").test(l));
    const mentions = (l) => keys.some((k) => l.includes(k));
    let at = lines.findIndex(speaks);
    if (at < 0) at = lines.findIndex((l) => /^\s*\*/.test(l) && mentions(l));
    if (at < 0 && cast.length === 1)
      at = Math.max(
        0,
        lines.findIndex((l) => /["“]/.test(l))
      );
    if (at >= 0) found.push({ x, keys, at, own: lines.filter((l) => speaks(l) || (cast.length === 1 ? !/^\s*\[/.test(l) : mentions(l))).join("\n") });
  }
  found.sort((a, b) => a.at - b.at);
  const adds = [];
  found.forEach((f, i) => {
    if (have.has(f.x.code)) return;
    let sit = 1;
    if (!seen.has(f.x.code)) sit = 0;
    else {
      const mine = !!said2 && (f.keys.some((k) => said2.includes(k)) || (!anyNamed && i === 0)),
        sc = new Map();
      sitScores(f.own).forEach((v, k) => sc.set(k, v * 2));
      if (mine) sitScores(said2).forEach((v, k) => sc.set(k, (sc.get(k) || 0) + v));
      let best = 0;
      sc.forEach((v, k) => {
        const s = v + (validRef((imgs[f.x.code] || {})[k]) ? 0.5 : 0);
        if (s > best) {
          best = s;
          sit = k;
        }
      });
    }
    adds.push({ at: f.at, tag: imgTag(f.x.code, sit) });
  });
  adds
    .slice(0, 5)
    .sort((a, b) => b.at - a.at)
    .forEach((a) => lines.splice(a.at, 0, a.tag, ""));
  return lines.join("\n");
}
/* target 없으면 새 AI 메시지, 있으면 그 메시지에 새 버전(alt) 추가.
   opt.edit: 메시지를 고친 뒤의 새 답(턴 수를 세지 않음) · opt.undo: 본문 하나 없이 실패했을 때 부를 되돌리기(자르기 전 대화로 — 돌려준 글이 있으면 토스트로 알림) */
export async function generate(target, q, direction = "", opt = {}) {
  const r = room,
    c = r.char,
    model = r.set.model;
  let msg = target,
    altIdx;
  if (!msg) {
    const prev = lastAi(r);
    const before = prev ? prev.alts[prev.idx].status || prev.statusBefore : r.status;
    msg = { id: uid("m"), role: "ai", idx: 0, alts: [{ text: "" }], statusBefore: before, ...(r.ep ? { ep0: epCopy(r.ep) } : {}) };
    r.msgs.push(msg);
    altIdx = 0;
  } else {
    msg.alts.push({ text: "" });
    altIdx = msg.alts.length - 1;
    msg.idx = altIdx;
  }
  const input = buildInput(r, r.msgs.indexOf(msg), msg.statusBefore, direction, !!q.sug); // 추천 칸은 이번 턴 견적에 추천 값이 들어 있을 때만
  const label = `${c.title} · ${MODELS[model].name}${target ? " 다시 쓰기" : ""}`;
  charge(q, label);
  const ctl = new AbortController();
  setGen({ ctl, msgId: msg.id, roomId: r.id });
  hideSug(); // 추천 답변은 '✦ AI 추천'을 눌렀을 때만 펼침
  setStick(true);
  renderLog(true);
  updateComposer();
  const said = (() => {
    const u = r.msgs[r.msgs.indexOf(msg) - 1];
    return u && u.role === "user" && !u.sys && !u.text.startsWith("//") ? u.text : "";
  })();
  // 화면엔 본문만: 상태 구분자가 오기 시작했거나(=== STATE 일부) JSON·코드블록 줄이 시작되면 그 줄부터 숨김 — 끊긴 답을 남길 때도 같은 손질
  const clean = (t) =>
    dropEcho(splitReply(t).body, said)
      .replace(/\n?[ \t]*=+[ \t]*[A-Z]*[ \t]*=*\s*$/, "")
      .replace(/\n[ \t]*(?:```|\{)[^\n]*$/, "")
      .replace(/\[\[[^\]]*$/, "")
      .trim();
  const show = (t) => {
    msg.alts[altIdx].text = clean(t);
    if (room !== r) return;
    const el = $("#liveBubble");
    if (el) {
      liveFill(el, msg.alts[altIdx].text, c, r.persona);
      IMG.hydrate(el);
      followLog();
    } else {
      renderLog(stick && autoScroll());
      syncJump();
    }
  };
  holdRoom(r.id); // 응답이 끝나 이 방 객체를 저장할 때까지, 계정에서 받은 것으로 이 방을 덮지 않게(services/cloud.js)
  try {
    const text = await llm(input, {
      tier: MODELS[model].tier,
      signal: ctl.signal,
      onText: ({ text }) => show(text),
      maxTokens: (LEN[r.set.len] || LEN.mid).tokens,
      room: r
    });
    show(text);
    // 본문 없이 상태 블록만 온 답은 답으로 치지 않음 — 저장하지 않고 아래의 실패 길로(값을 돌려줌)
    if (!msg.alts[altIdx].text) throw { code: "upstream_error", text: "" };
    const parsed = parseState(text, c, msg.statusBefore),
      prevMsgs = r.msgs.slice(0, r.msgs.indexOf(msg));
    const bodyText = addCastImages(msg.alts[altIdx].text, r, prevMsgs, said);
    const rep = parsed.ep;
    delete parsed.ep;
    // 답변 추천: 값을 낸 턴(자동 받기 — q.sug)에 온 것만 저장함. 값을 내지 않은 턴에 모델이 시키지 않은 추천을 내보내면 버림(저장된 추천은 값 없이 펼쳐지므로),
    // 값을 냈는데 추천이 같이 오지 않았으면 추천 값만 되돌림
    if (!q.sug) parsed.suggestions = [];
    else if (!parsed.suggestions.length) refundSug(q, label);
    Object.assign(msg.alts[altIdx], parsed, { text: bodyText, cost: qShort(q), lore: input.lore });
    r.status = parsed.status;
    // 에피소드: 이번 지시(input.ep)와 AI의 보고(_ep)로 다음 상태 — 사건 띠(ev)와 이 버전 뒤의 상태(ep1)를 응답에 적고, 결말까지 끝났으면 '모은 결말'에
    if (r.ep && c.episode && input.ep) {
      const a = msg.alts[altIdx];
      r.ep = epAfter(c.episode, r.ep, input.ep, rep, parsed.status[c.gauge]);
      if (input.ep.event) a.ev = input.ep.event.id;
      a.ep1 = epCopy(r.ep);
      if (r.ep.over) markEnding(c.id, r.ep.end);
    }
    if (!target && !opt.edit) {
      r.turn = (r.turn || 0) + 1;
      r.sinceMem = (r.sinceMem || 0) + 1;
    }
  } catch (e) {
    // 사용자가 멈췄거나 스트림이 중간에 끊긴 경우(시간 초과 timeout · 끝난 신호 없이 닫힘이나 중간의 오류 조각 upstream_error): 받은 본문까지 남김.
    // 멈춘 것은 값 그대로, 끊긴 것은 값을 돌려줌(2026-11-21 사용자 결정) — 끊긴 거면 '다시 시도'(= 다시 쓰기) 안내. 거절(refused)은 받은 글이 있어도 남기지 않음
    const keep = e && e.text ? clean(e.text) : "";
    const lost = !!e && (e.code === "timeout" || e.code === "upstream_error");
    if (keep && (e.code === "cancelled" || lost)) {
      if (lost) refund(q, label);
      else refundSug(q, label); // 본문만 남긴 답에는 추천이 없음 — 추천 값은 되돌림
      Object.assign(msg.alts[altIdx], { text: keep, status: msg.statusBefore, cost: lost ? "" : qShort(q) });
      if (lost) r.lastErr = "응답이 오는 중에 끊겨 여기까지만 남겼어요. 값은 돌려드렸어요. '다시 시도'를 누르면 다시 써요.";
    } else {
      msg.alts.splice(altIdx, 1);
      if (!msg.alts.length) r.msgs.splice(r.msgs.indexOf(msg), 1);
      else msg.idx = msg.alts.length - 1;
      refund(q, label);
      // 메시지 수정·다시 쓰기는 자르기 전 대화로 되돌림(opt.undo). 수정은 '다시 시도' 줄 대신 토스트로 알림 — 그 줄의 버튼은 마지막 답을 다시 쓰는 것이라 뜻이 달라짐
      const copy = errCopy(e),
        note = opt.undo ? opt.undo() : "";
      if (note) toast([copy, note].filter(Boolean).join(" "));
      else if (copy) r.lastErr = copy;
    }
  } finally {
    try {
      setGen(null);
      saveRoom(r);
      collectSeen(r);
      if (room === r && $("#logInner")) {
        renderLog(stick && autoScroll());
        syncJump();
        updateComposer();
        updateMeter();
        $("#inp")?.focus({ preventScroll: true });
        if (q.sug) showSug(); // 자동 받기로 온 추천은 바로 펼쳐 보임(값을 낸 것이라 누르지 않아도)
      }
      maybeSummarize(r); // 요약은 시작하면서 스스로 방을 잡음 — 아래에서 놓아도 틈이 없음
    } finally {
      releaseRoom(r.id); // 위에서 무엇이 던져도 방은 꼭 놓음(안 놓으면 그 방은 계정에서 받지 못함)
    }
  }
}
export function stopGen() {
  if (gen) gen.ctl.abort();
}
