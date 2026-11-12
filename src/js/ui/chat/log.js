/* 메시지 로그 그리기·스크롤 따라가기·말풍선 메뉴(수정·삭제·북마크·고정·좋아요/아쉬워요·분기) */
import { speakerName } from "../../ai/prompt/rules.js";
import { curText, forkRoom, saveRoom } from "../../core/rooms.js";
import { S, gen, room, setRoom } from "../../core/state.js";
import { $, $$, clamp, esc, toast } from "../../core/util.js";
import { imgTags } from "../../images/codes.js";
import { IMG } from "../../services/images.js";
import { bindEp, epBarHTML, epEventHTML, epTailHTML } from "./episode.js";
import { epCopy, generate, regen, regenAsk, sendTurn } from "./generate.js";
import { fmt, liveFill, statusBlock } from "./render.js";
import { flashHint, lastAi, updateMeter } from "./view.js";
import { coverHTML, pavHTML, zoomPic } from "../cover.js";
import { plan } from "../../core/wallet.js";
import { ensurePay, plusSheet } from "../pay.js";
import { pinSheet } from "../pins.js";
import { reportSheet } from "../report.js";
import { confirmSheet } from "../sheet.js";
import { go } from "../shell.js";

/* 응답 중 스크롤: 대화방 출력 설정의 '자동 스크롤'(r.set.autoScroll, 기본 꺼짐)이 켜져 있고 맨 아래에 있을 때만 따라 내려감.
   사용자가 위로 올리면 멈춤. 꺼져 있으면 보낼 때 한 번만 맨 아래로 가고, 답은 읽는 자리에서 아래로 자라남 */
export let stick = true;
export function setStick(v) {
  return (stick = v);
}
export const autoScroll = () => !!(room && room.set.autoScroll);
export function followLog() {
  const log = $("#log");
  if (log && stick && autoScroll()) log.scrollTop = log.scrollHeight;
  syncJump();
}
// 글이 늘어나는 것만으로는 scroll 이벤트가 안 나서 '맨 아래로' 버튼을 따로 맞춤
export function syncJump() {
  const log = $("#log"),
    jump = log && $("#jumpBtn", log);
  if (jump) jump.hidden = log.scrollHeight - log.scrollTop - log.clientHeight < 160;
}
export function bindStick(log) {
  if (!log) return;
  stick = true;
  let ty = 0;
  const jump = $("#jumpBtn", log);
  log.addEventListener(
    "scroll",
    () => {
      const d = log.scrollHeight - log.scrollTop - log.clientHeight;
      if (d < 8) stick = true;
      else if (d > 24) stick = false;
      if (jump) jump.hidden = d < 160;
    },
    { passive: true }
  );
  log.addEventListener(
    "wheel",
    (e) => {
      if (e.deltaY < 0) stick = false;
    },
    { passive: true }
  );
  log.addEventListener(
    "touchstart",
    (e) => {
      ty = e.touches[0].clientY;
    },
    { passive: true }
  );
  log.addEventListener(
    "touchmove",
    (e) => {
      const y = e.touches[0].clientY;
      if (y > ty + 4) stick = false;
      ty = y;
    },
    { passive: true }
  );
  log.addEventListener("keydown", (e) => {
    if (["ArrowUp", "PageUp", "Home"].includes(e.key)) stick = false;
  });
  if (jump)
    jump.onclick = () => {
      stick = true;
      log.scrollTo({ top: log.scrollHeight, behavior: "smooth" });
    };
}
export function renderLog(scroll) {
  const box = $("#logInner");
  if (!box) return;
  const r = room,
    c = r.char,
    lastIdx = r.msgs.map((m) => m.role).lastIndexOf("ai");
  let html = `<div class="scene-card">${coverHTML(c)}<b>${esc(c.title)}</b><span>${esc(r.opening || "")} · ${esc(r.persona.name)}(으)로 플레이 중</span></div>`;
  r.msgs.forEach((m, i) => {
    if (r.side && i > 0 && r.msgs[i - 1].id === r.sideAfter) html += sidePill(r);
    const bm = (r.bookmarks || []).includes(m.id);
    if (m.role === "user") {
      if (m.sys) {
        html += `<div class="sys-pill">이어서 쓰기</div>`;
        return;
      }
      const ooc = m.text.startsWith("//");
      html += `<div class="msg me ${ooc ? "ooc" : ""}" data-id="${m.id}">${ooc ? "" : pavHTML(r.persona)}<div class="col">
        ${
          m.editing
            ? editBox(m.text, i)
            : `<div class="bubble">${ooc ? esc(m.text) : fmt(m.text, c, r.persona)}</div>
        <div class="tools-row">${m.canned ? "" : `<button data-act="edit" data-i="${i}">수정</button>`}` +
              `<button data-act="del" data-i="${i}">삭제</button>${
                ooc || m.canned ? "" : `<button data-act="pin" data-i="${i}" ` + `title="이 내용을 고정 기억으로 — 매 턴 그대로 AI에게 전해요">📌 고정</button>`
              }</div>`
        }
      </div></div>`;
      return;
    }
    const alt = m.alts[m.idx] || {},
      isLast = i === lastIdx,
      pending = gen && gen.msgId === m.id;
    let body;
    if (m.editing) body = editBox(alt.text, i);
    else if (pending && !alt.text) body = `<div class="bubble"><span class="thinking" aria-label="응답 생성 중"><i></i><i></i><i></i></span></div>`;
    else
      body = pending
        ? `<div class="bubble typing" id="liveBubble"></div>`
        : `<div class="bubble${imgTags(alt.text || "").length >= 2 ? " many-img" : ""}">${fmt(alt.text || "", c, r.persona)}</div>`;
    html +=
      `<div class="msg" data-id="${m.id}">${coverHTML(c)}<div class="col">` +
      `<span class="nm">${esc(speakerName(r))}</span>${pending ? "" : epEventHTML(r, alt)}${body}`;
    if (!pending && !m.editing) {
      html += statusBlock(c, alt.status, m.statusBefore, { open: isLast, live: isLast });
      html +=
        `<div class="tools-row">
        ${
          m.alts.length > 1
            ? `<button data-act="prev" data-i="${i}" ${m.idx === 0 ? "disabled" : ""} aria-label="이전 버전">‹</button>` +
              `<span class="sw">${m.idx + 1}/${m.alts.length}</span>` +
              `<button data-act="next" data-i="${i}" ${m.idx === m.alts.length - 1 ? "disabled" : ""} aria-label="다음 버전">›</button>`
            : ""
        }
        ${isLast && !alt.opening && !m.canned ? `<button data-act="regen" data-i="${i}">↻ 다시 쓰기</button>` : ""}
        <button data-act="bm" data-i="${i}" class="${bm ? "on" : ""}" aria-pressed="${bm}">${bm ? "★" : "☆"} 북마크</button>
        <button data-act="pin" data-i="${i}" title="이 장면을 고정 기억으로 — 매 턴 그대로 AI에게 전해요">📌 고정</button>
        <button data-act="editai" data-i="${i}">수정</button><button data-act="copy" data-i="${i}">복사</button>` +
        `<button data-act="report" data-i="${i}" title="이 메시지를 운영자에게 신고해요">신고</button>
        ${
          i > 0 && !r.ep ? `<button data-act="fork" data-i="${i}" title="이 ` + `메시지까지를 새 대화방으로 복사해요">분기</button>` : ""
        }${i > 0 ? `<button data-act="del" data-i="${i}">삭제</button>` : ""}
        ${alt.opening || m.canned ? "" : fbBtn(i, 1, alt.fb) + fbBtn(i, -1, alt.fb)}
        ${alt.lore?.length ? `<span class="lore-used" title="이 응답에 반영된 키워드북">📖 ${esc(alt.lore.join(" · "))}</span>` : ""}
        ${alt.cost ? `<span class="rcpt" title="이 응답에 쓴 비용">${esc(alt.cost)}</span>` : ""}
      </div>`;
    }
    html += `</div></div>`;
  });
  if (r.side && r.msgs.length && r.msgs[r.msgs.length - 1].id === r.sideAfter) html += sidePill(r);
  if (r.lastErr) html += `<div class="err-line" role="alert">${esc(r.lastErr)} <button class="btn sm" id="retry">다시 시도</button></div>`;
  html += epTailHTML(r); // 에피소드: 갈림길 카드 또는 결말 카드
  box.innerHTML = html;
  const lb = $("#liveBubble", box),
    gm = gen && r.msgs.find((m) => m.id === gen.msgId);
  if (lb && gm) liveFill(lb, gm.alts[gm.idx]?.text || "", c, r.persona, false);
  bindLog(box);
  bindEp(box, r);
  IMG.hydrate(box);
  const bar = $("#epBar");
  if (bar) {
    bar.innerHTML = epBarHTML(r);
    bar.hidden = !bar.innerHTML;
  }
  const chat = box.closest(".chat");
  if (chat) chat.classList.toggle("ep-over", !!(r.ep && r.ep.over)); // 끝난 에피소드 방은 입력창을 숨김(결말 카드의 버튼으로)
  if (scroll) {
    const log = $("#log");
    log.scrollTop = log.scrollHeight;
  }
}
/* 외전 방: 이어받은 대화와 외전이 시작되는 자리 사이의 구분선(방 제목 = 외전 갈래) */
const sidePill = (r) => `<div class="sys-pill side-pill">${esc(r.opening || "외전")} — 여기부터 외전</div>`;
/* 좋아요(1)·아쉬워요(-1) 토글 — Alt.fb(0이면 없음). 이 기기·계정에 저장만 하고 프롬프트에는 쓰지 않음 */
function fbBtn(i, v, cur) {
  const on = cur === v,
    label = v > 0 ? "좋아요" : "아쉬워요";
  return (
    `<button data-act="${v > 0 ? "up" : "down"}" data-i="${i}" class="${on ? "on" : ""}" aria-pressed="${on}" aria-label="` +
    `${label}" title="${label}">${v > 0 ? "👍" : "👎"}</button>`
  );
}
function editBox(text, i) {
  return (
    `<div class="edit-box"><label class="sr" for="ed${i}">메시지 수정</label><textarea id="ed${i}">${esc(text)}</textarea>
    <div class="row"><button class="btn sm ghost" data-act="cancel" data-i="${i}">취소</button>` +
    `<button class="btn sm pri" data-act="save" data-i="${i}">${room.msgs[i].role === "user" ? "수정하고 다시 생성" : "저장"}</button></div></div>`
  );
}
function bindLog(box) {
  $$(".status .inner:not(.open)", box).forEach((el) => {
    const open = () => el.classList.add("open");
    el.onclick = open;
    el.onkeydown = (e) => {
      if (e.key === "Enter") open();
    };
  });
  $$(".scene-img", box).forEach((f) => {
    if (f.querySelector("img"))
      f.onclick = (e) => {
        if (e.target.closest("img, video")) zoomPic(f);
      };
  });
  const retry = $("#retry");
  if (retry)
    retry.onclick = async () => {
      room.lastErr = "";
      const i = room.msgs.length - 1;
      if (room.msgs[i]?.role === "ai") return regen(i);
      const u = room.msgs.pop();
      renderLog();
      if (u) {
        const ok = await sendTurn(u.sys ? "" : u.text, { cont: !!u.sys });
        if (!ok) {
          room.msgs.push(u);
          renderLog();
        }
      }
    };
  $$("[data-act]", box).forEach(
    (b) =>
      (b.onclick = () => {
        const i = +b.dataset.i,
          m = room.msgs[i],
          act = b.dataset.act;
        if (gen && !["copy", "bm", "up", "down", "pin"].includes(act)) return flashHint("응답이 끝난 뒤에 할 수 있어요.");
        if (act === "prev" || act === "next") {
          m.idx = clamp(m.idx + (act === "next" ? 1 : -1), 0, m.alts.length - 1);
          restoreStatus();
          if (room.ep && i === room.msgs.length - 1 && (m.alts[m.idx].ep1 || m.ep0)) room.ep = epCopy(m.alts[m.idx].ep1 || m.ep0); // 에피소드: 그 버전 뒤의 진행 상태로
          saveRoom(room);
          renderLog();
        } else if (act === "regen") regenAsk(i);
        else if (act === "copy") copyText(curText(m).replace(/\[\[img:[^\]]*\]\]\n?/g, ""), "복사했어요");
        else if (act === "bm") {
          const s = new Set(room.bookmarks || []);
          s.has(m.id) ? s.delete(m.id) : s.add(m.id);
          room.bookmarks = [...s];
          saveRoom(room);
          renderLog();
          toast(s.has(m.id) ? "북마크에 담았어요" : "북마크에서 뺐어요");
        } else if (act === "pin") pinSheet(room, m);
        else if (act === "report") reportSheet(room, m);
        else if (act === "up" || act === "down") {
          const a = m.alts[m.idx],
            v = act === "up" ? 1 : -1;
          a.fb = a.fb === v ? 0 : v;
          saveRoom(room);
          renderLog();
        } else if (act === "fork") {
          if (S.rooms.filter((x) => x.charId === room.char.id).length >= plan().rooms) return plusSheet("rooms");
          confirmSheet("이 장면에서 분기할까요?", "이 메시지까지를 복사한 새 대화방을 만들어요. 지금 대화방은 그대로 남아요.", "분기", () => {
            const f = forkRoom(room, m.id);
            if (f) {
              setRoom(f);
              go("r-" + f.id);
              toast("분기한 대화방이에요");
            }
          });
        } else if (act === "edit" || act === "editai") {
          m.editing = true;
          renderLog();
          $("#ed" + i)?.focus();
        } else if (act === "cancel") {
          delete m.editing;
          renderLog();
        } else if (act === "save") {
          const t = $("#ed" + i).value.trim();
          delete m.editing;
          if (!t) return renderLog();
          if (m.role === "user") {
            m.text = t;
            const keep = room.msgs.slice(0, i + 1),
              gone = room.msgs[i + 1];
            ensurePay(room).then((q) => {
              if (!q) return renderLog();
              room.msgs = keep;
              restoreStatus();
              if (room.ep && gone && gone.ep0) room.ep = epCopy(gone.ep0);
              saveRoom(room);
              generate(null, q, "", true);
            });
          } else {
            m.alts[m.idx].text = t;
            saveRoom(room);
            renderLog();
          }
        } else if (act === "del")
          confirmSheet("이 메시지부터 끝까지 지울까요?", "지운 메시지는 되돌릴 수 없어요. 상태창도 그 시점으로 돌아가요.", "삭제", () => {
            const first = room.msgs.slice(Math.max(1, i)).find((x) => x.ep0);
            if (room.ep && first) room.ep = epCopy(first.ep0); // 에피소드: 지운 것 가운데 진행 상태를 적은 첫 메시지 직전으로(즉답 메시지는 상태를 바꾸지 않아 ep0가 없음 — 결말 뒤를 지우면 다시 이어 쓸 수 있음)
            room.msgs = room.msgs.slice(0, Math.max(1, i));
            room.lastErr = "";
            restoreStatus();
            saveRoom(room);
            renderLog();
            updateMeter();
          });
      })
  );
}
export function copyText(t, ok) {
  (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(
    () => toast(ok),
    () => toast("복사할 수 없었어요. 길게 눌러 선택해 주세요.")
  );
}
function restoreStatus() {
  const a = lastAi(room);
  room.status = a ? a.alts[a.idx].status || a.statusBefore : room.status;
  updateMeter();
}
