/* 말풍선 메뉴 처리 — 버전 넘기기·다시 쓰기·복사·북마크·고정·신고·좋아요/아쉬워요·분기·수정·삭제, 상태창 펼치기·그림 크게 보기·다시 시도. 메시지 로그(ui/chat/log.js renderLog)가 그린 뒤 붙임 */
import { forkRoom } from "../../core/room-fork.js";
import { curText, saveRoom } from "../../core/rooms.js";
import { S, gen, room, setRoom } from "../../core/state.js";
import { $, $$, clamp, toast } from "../../core/util.js";
import { plan } from "../../core/wallet.js";
import { closeCrisis, markCrisis } from "./crisis.js";
import { epCopy, generate, regen, regenAsk, sendTurn } from "./generate.js";
import { copyText, drafts, renderLog } from "./log.js";
import { hideSug } from "./suggest.js";
import { flashHint, lastAi, updateComposer, updateMeter } from "./view.js";
import { zoomPic } from "../cover.js";
import { ensurePay, plusSheet } from "../pay.js";
import { pinSheet } from "../pins.js";
import { reportSheet } from "../report.js";
import { confirmSheet } from "../sheet.js";
import { go } from "../shell.js";

export function bindLog(box) {
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
        const ok = await sendTurn(u.sys ? "" : u.text, { cont: !!u.sys, id: u.id }); // 같은 id로 — 위기 안내 카드가 그대로 남게
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
        if (gen && !["copy", "bm", "up", "down", "pin", "crisis-x"].includes(act)) return flashHint("응답이 끝난 뒤에 할 수 있어요.");
        if (act === "crisis-x") {
          closeCrisis(room.id, m.id);
          renderLog();
        } else if (act === "prev" || act === "next") {
          m.idx = clamp(m.idx + (act === "next" ? 1 : -1), 0, m.alts.length - 1);
          restoreStatus();
          if (room.ep && i === room.msgs.length - 1 && (m.alts[m.idx].ep1 || m.ep0)) room.ep = epCopy(m.alts[m.idx].ep1 || m.ep0); // 에피소드: 그 버전 뒤의 진행 상태로
          saveRoom(room);
          renderLog();
          syncSug();
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
          drafts.delete(m.id);
          renderLog();
          $("#ed" + i)?.focus();
        } else if (act === "cancel") {
          delete m.editing;
          drafts.delete(m.id);
          renderLog();
        } else if (act === "save") {
          const t = $("#ed" + i).value.trim();
          if (!t || m.role !== "user") delete m.editing;
          if (!t) return renderLog();
          if (m.role === "user") {
            // 값 확인이 끝난 뒤에만 고침 — 그 창을 닫거나 하트가 모자라면 대화는 그대로, 고쳐 쓴 글은 수정 칸에 그대로 남김(쓰던 글 그대로 — 하트를 사고 와서 다시 누르게)
            const r = room;
            drafts.set(m.id, t);
            ensurePay(r).then((q) => {
              if (!q || r !== room) return renderLog();
              delete m.editing;
              drafts.delete(m.id);
              // 새 답이 본문 하나 없이 실패하면 되돌릴 것: 원문·뒤 메시지·상태창·에피소드 진행(generate가 undo를 부름).
              // 자른 대화는 여기서 저장하지 않음 — 응답이 끝날 때 한 번(그 전에 창이 닫히면 저장된 것은 고치기 전 대화)
              const was = { text: m.text, msgs: r.msgs, status: r.status, ep: r.ep ? epCopy(r.ep) : null, err: r.lastErr },
                gone = r.msgs[i + 1];
              m.text = t;
              markCrisis(r, m);
              r.lastErr = "";
              r.msgs = r.msgs.slice(0, i + 1);
              restoreStatus();
              if (r.ep && gone && gone.ep0) r.ep = epCopy(gone.ep0);
              const undo = () => {
                m.text = was.text;
                r.msgs = was.msgs;
                r.status = was.status;
                r.lastErr = was.err;
                if (was.ep) r.ep = was.ep;
                return "고치기 전 대화로 되돌렸어요.";
              };
              generate(null, q, "", { edit: true, undo });
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
            syncSug();
          });
      })
  );
}
/* 마지막 답변(또는 그 버전)이 바뀐 뒤: 펼쳐 둔 추천은 예전 답변의 것이니 닫고, 추천 버튼의 값 표시를 지금 답변에 맞춤 —
   저장된 추천이 없는 버전으로 바꿨는데 값 없는 버튼이 남으면 누를 때 보이지 않던 값이 나감 */
function syncSug() {
  hideSug();
  updateComposer();
}
function restoreStatus() {
  const a = lastAi(room);
  room.status = a ? a.alts[a.idx].status || a.statusBefore : room.status;
  updateMeter();
}
