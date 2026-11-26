/* 메시지 로그 그리기·스크롤 따라가기 — 말풍선 메뉴(수정·삭제·북마크·고정·좋아요/아쉬워요·분기)의 처리는 ui/chat/log-acts.js */
import { speakerName } from "../../ai/prompt/rules.js";
import { gen, room } from "../../core/state.js";
import { $, esc, toast } from "../../core/util.js";
import { imgTags } from "../../images/codes.js";
import { IMG } from "../../services/images.js";
import { crisisHTML } from "./crisis.js";
import { bindEp, epBarHTML, epEventHTML, epTailHTML } from "./episode.js";
import { bindLog } from "./log-acts.js";
import { fmt, liveFill, statusBlock } from "./render.js";
import { regenText } from "./view.js";
import { quote } from "../../core/wallet.js";
import { aiLabel } from "../ai-notice.js";
import { coverHTML, pavHTML } from "../cover.js";

/* 응답 중 스크롤: 대화방 출력 설정의 '자동 스크롤'(r.set.autoScroll, 기본 꺼짐)이 켜져 있고 맨 아래에 있을 때만 따라 내려감.
   사용자가 위로 올리면 멈춤. 꺼져 있으면 보낼 때 한 번만 맨 아래로 가고, 답은 읽는 자리에서 아래로 자라남 */
export let stick = true;
export function setStick(v) {
  return (stick = v);
}
export const autoScroll = () => !!(room && room.set.autoScroll);
// 수정 칸에 고쳐 쓰던 글(메시지 id → 글) — 값 확인을 닫거나 하트가 모자라도 남게. 방 객체 밖에 둠: 계정 올리기 대기열이 방 객체를 그대로 들고 있다가
// 보낼 때 글로 바꾸므로, 메시지에 두면 승인하지 않은 글이 계정에 올라갈 수 있음(Codex 검토)
export const drafts = new Map();
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
    lastIdx = r.msgs.map((m) => m.role).lastIndexOf("ai"),
    [rl, rt] = regenText(quote(r.set)); // 다시 쓰기 버튼의 값과 설명 — 보내기 버튼과 같은 견적(ui/chat/view.js)
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
      html += `<div class="msg me ${ooc ? "ooc" : ""}" data-id="${esc(m.id)}">${ooc ? "" : pavHTML(r.persona)}<div class="col">
        ${
          m.editing
            ? editBox(drafts.has(m.id) ? drafts.get(m.id) : m.text, i)
            : `<div class="bubble">${ooc ? esc(m.text) : fmt(m.text, c, r.persona)}</div>
        <div class="tools-row">${m.canned ? "" : `<button data-act="edit" data-i="${i}">수정</button>`}` +
              `<button data-act="del" data-i="${i}">삭제</button>${
                ooc || m.canned ? "" : `<button data-act="pin" data-i="${i}" ` + `title="이 내용을 고정 기억으로 — 매 턴 그대로 AI에게 전해요">📌 고정</button>`
              }</div>`
        }
      </div></div>${crisisHTML(r.id, m.id, i)}`;
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
      `<div class="msg" data-id="${esc(m.id)}" role="group" aria-label="${esc(aiLabel(speakerName(r)))}">${coverHTML(c)}<div class="col">` +
      `<span class="nm">${esc(speakerName(r))}</span>${pending ? "" : epEventHTML(r, alt)}${body}`;
    if (!pending && !m.editing) {
      html += statusBlock(c, alt.status, m.statusBefore, { open: isLast, live: isLast });
      html +=
        `<div class="tools-row">
        ${
          m.alts.length > 1
            ? `<span class="pager" role="group" aria-label="저장된 답 ${m.alts.length}개 — 넘겨 봐도 값이 나가지 않아요">` +
              `<button data-act="prev" data-i="${i}" ${m.idx === 0 ? "disabled" : ""} aria-label="이전 답">‹</button>` +
              `<span class="sw">${m.idx + 1}/${m.alts.length}</span>` +
              `<button data-act="next" data-i="${i}" ${m.idx === m.alts.length - 1 ? "disabled" : ""} aria-label="다음 답">›</button></span>`
            : ""
        }
        ${isLast && !alt.opening && !m.canned ? `<button data-act="regen" data-i="${i}" class="regen" title="${esc(rt)}">${esc(rl)}</button>` : ""}
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
  // 메시지 수정의 실패(lastErrEdit)는 '다시 시도'를 숨김 — 그 버튼은 마지막 답을 다시 쓰는 것이라 고친 글을 다시 보내는 것과 뜻이 다름
  if (r.lastErr)
    html += `<div class="err-line" role="alert">${esc(r.lastErr)}${r.lastErrEdit ? "" : ` <button class="btn sm" id="retry">다시 시도</button>`}</div>`;
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
export function copyText(t, ok) {
  (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(
    () => toast(ok),
    () => toast("복사할 수 없었어요. 길게 눌러 선택해 주세요.")
  );
}
