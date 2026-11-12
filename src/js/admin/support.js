/* 공지·고객센터 관리(관리자 빌드만 — EXT.help·EXT.me에 꽂음): 공지 화면에 '새 공지'와 공지마다 고치기·삭제, 문의하기 탭 아래에 받은 문의(상태별 — 답변·상태·삭제), MY에 답변 대기 수.
   관리자 계정으로 로그인돼 있으면 누를 것 없이 바로 관리 화면이 된다(2026-11-06 사용자 요청). 그 밖의 계정은 로그인 안내와 함께 읽기만.
   실제 쓰기 권한은 서버가 정한다(RLS — admins 표, docs/SETUP.md '관리자 계정 고정'). 비밀번호 관문(admin/gate.js)은 브라우저 안의 검사라 소스를 보면 우회할 수 있어 서버 권한을 줄 수 없음.
   사용자 화면(ui/help.js)이 그릴 때마다 불리므로(공지는 기기 사본 → 서버 목록으로 두 번) 이미 넣었으면 다시 넣지 않고, 기다리는 사이 화면이 바뀌었으면 그만둔다 */
import { $, $$, esc, toast } from "../core/util.js";
import { SB, acctName } from "../services/supabase.js";
import { ASK_STATUS, SUPPORT, supportErr, urgentReport } from "../services/support.js";
import { EXT } from "../ui/ext.js";
import { askHTML, viewNotice } from "../ui/help.js";
import { ICON } from "../ui/icons.js";
import { confirmSheet, sheet } from "../ui/sheet.js";
import { bindGo, go } from "../ui/shell.js";
/** @typedef {import("../core/types.js").Notice} Notice */
/** @typedef {import("../core/types.js").Inquiry} Inquiry */

const INBOX = [
  ["open", "답변 대기"],
  ["answered", "답변 완료"],
  ["closed", "종료"],
  ["", "전체"]
];
let inboxStatus = "open"; // 받은 문의 거르기(세션 동안 남음)

// 이 계정이 관리자인지 — 아니면 이유를 box 맨 위에 한 번 적음. stale()이 참이면(기다리는 사이 화면이 바뀜) 아무것도 안 함
async function adminOK(box, what, stale) {
  if (!SB.on()) return false;
  if (!SB.s) {
    if (!stale()) note(box, `${what} 관리자 계정으로 로그인해 주세요.`, "login", "로그인");
    return false;
  }
  const yes = await SUPPORT.amAdmin();
  if (stale()) return false;
  if (!yes) note(box, `지금 계정(<b>${esc(acctName())}</b>)은 관리자로 확인되지 않았어요. ${what} 관리자 계정으로 로그인해 주세요.`, "me", "계정 바꾸기");
  return yes;
}
// 안내와 이동 버튼 하나를 box 맨 위에 한 번 적음
function note(box, html, to, label) {
  if ($(".adm-note", box)) return;
  box.insertAdjacentHTML(
    "afterbegin",
    `<div class="box adm-note"><span class="pill">관리자</span> ${html}<div class="cta-row"><span class="spacer"></span>` +
      `<button type="button" class="btn sm pri" data-go="${to}">${label}</button></div></div>`
  );
  bindGo(box);
}
// 기다리기 전의 첫 자식을 기억해 화면이 다시 그려졌는지 봄
const watch = (box) => {
  const first = box.firstElementChild;
  return () => !box.isConnected || box.firstElementChild !== first;
};

EXT.help.push(async (tab, box, list) => {
  const stale = watch(box);
  if (tab === "notice") {
    if (!(await adminOK(box, "공지를 쓰려면", stale))) return;
    if (!$("#nNew", box)) {
      box.insertAdjacentHTML(
        "afterbegin",
        `<div class="cta-row adm-bar"><span class="pill">관리자</span><span class="note">비공개 공지도 보여요</span><span class="spacer"></span>` +
          `<button class="btn sm pri" id="nNew">+ 새 공지</button></div>`
      );
      $("#nNew", box).onclick = () => noticeSheet(null);
    }
    $$("details.notice", box).forEach((d) => {
      const n = list.find((x) => +x.id === +d.dataset.nid);
      if (!n || $(".nadm", d)) return;
      d.insertAdjacentHTML(
        "beforeend",
        `<div class="cta-row nadm"><span class="spacer"></span><button type="button" class="btn sm danger" data-ndel>삭제</button>` +
          `<button type="button" class="btn sm" data-ned>고치기</button></div>`
      );
      $("[data-ned]", d).onclick = () => noticeSheet(n);
      $("[data-ndel]", d).onclick = () =>
        confirmSheet("이 공지를 지울까요?", `‘${n.title}’ 공지가 모든 사용자에게서 사라져요. 되돌릴 수 없어요.`, "삭제", async () => {
          try {
            await SUPPORT.dropNotice(n.id);
            toast("공지를 지웠어요");
            viewNotice();
          } catch (e) {
            toast(supportErr(e));
          }
        });
    });
  }
  if (tab === "ask") {
    if (!(await adminOK(box, "받은 문의를 보려면", stale)) || $("#inbox", box)) return;
    box.insertAdjacentHTML(
      "beforeend",
      `<h2 class="sec">받은 문의 <small>관리자 — 모든 사용자의 문의</small></h2>
      <div class="seg" id="inSeg">${INBOX.map(
        ([k, l]) => `<button type="button" data-in="${k}" class="` + `${k === inboxStatus ? "on" : ""}">${l}</button>`
      ).join("")}</div>` + `<div id="inbox" class="nlist" style="margin-top:10px"></div>`
    );
    $$("[data-in]", box).forEach(
      (b) =>
        (b.onclick = () => {
          inboxStatus = b.dataset.in;
          $$("[data-in]", box).forEach((x) => x.classList.toggle("on", x === b));
          loadInbox(box);
        })
    );
    loadInbox(box);
  }
});

/* 받은 문의: 문의마다 계정·답변 이메일·앱 정보, 답변 칸·상태·저장·삭제 */
async function loadInbox(box) {
  const el = $("#inbox", box);
  if (!el) return;
  el.innerHTML = `<p class="note">불러오는 중…</p>`;
  let list;
  try {
    list = await SUPPORT.inbox(inboxStatus);
  } catch (e) {
    el.innerHTML = `<p class="note">${esc(supportErr(e))}</p>`;
    return;
  }
  if (!list.length) {
    el.innerHTML = `<div class="empty">${inboxStatus ? esc(ASK_STATUS[inboxStatus]) + " 문의가 없어요." : "받은 문의가 없어요."}</div>`;
    return;
  }
  // 우선 처리할 신고(미성년자 관련·자해·자살 조장)는 맨 위에 따로 — 나머지는 받은 순서 그대로
  const top = list.filter(urgentReport),
    rest = list.filter((a) => !urgentReport(a)),
    row = (a) => askHTML(a, inboxExtra(a));
  el.innerHTML =
    (top.length
      ? `<p class="note" id="inUrgent" style="margin:0 0 6px">` +
        (`<b>우선 처리할 신고 ${top.length}건</b> — 미성년자 관련·자해·자살 조장 사유예요. 먼저 확인해 주세요.</p>` +
          `${top.map(row).join("")}${rest.length ? '<hr style="border:0;border-top:1px solid var(--line);margin:12px 0">' : ""}`)
      : "") + rest.map(row).join("");
  $$("details.ask", el).forEach((d) => {
    const a = list.find((x) => +x.id === +d.dataset.aid);
    if (!a) return;
    $("[data-save]", d).onclick = async (e) => {
      e.target.disabled = true;
      try {
        await SUPPORT.answer(a.id, { answer: $("[data-ans]", d).value.trim(), status: $("[data-st]", d).value });
        toast("답변을 저장했어요");
        loadInbox(box);
      } catch (x) {
        toast(supportErr(x));
        e.target.disabled = false;
      }
    };
    $("[data-del]", d).onclick = () =>
      confirmSheet("이 문의를 지울까요?", "쓴 사람의 '내 문의'에서도 사라져요. 되돌릴 수 없어요.", "삭제", async () => {
        try {
          await SUPPORT.dropAsk(a.id);
          toast("문의를 지웠어요");
          loadInbox(box);
        } catch (x) {
          toast(supportErr(x));
        }
      });
  });
}
/** @param {Inquiry} a @returns {string} */
function inboxExtra(a) {
  const m = a.meta || {},
    info = [m.engine && "AI " + m.engine, m.screen, m.host, m.app].filter(Boolean).join(" · ");
  return (
    `<div class="adm-ask">
    <p class="note">계정 ${esc(String(a.user_id || "").slice(0, 8))}…` +
    `${a.reply_to ? ` · 답변 이메일 <a href="mailto:${esc(a.reply_to)}">${esc(a.reply_to)}</a>` : ""}${info ? " · " + esc(info) : ""}</p>
    ${m.ua ? `<p class="note ua">${esc(m.ua)}</p>` : ""}
    <div class="field"><label for="ans${+a.id}">답변 <span class="note">쓰면 '답변 완료'로 바뀌어요</span></label>` +
    `<textarea id="ans${+a.id}" data-ans maxlength="4000">${esc(a.answer || "")}</textarea></div>
    <div class="cta-row"><select data-st class="inp" aria-label="상태">${Object.keys(ASK_STATUS)
      .map((k) => `<option value="${k}" ${k === a.status ? "selected" : ""}>${ASK_STATUS[k]}</option>`)
      .join("")}</select><span class="spacer"></span>
      <button type="button" class="btn sm danger" data-del>삭제</button><button type="button" class="btn sm pri" data-save>저장</button></div></div>`
  );
}

/** 공지 쓰기·고치기 시트. @param {Notice|null} n */
function noticeSheet(n) {
  const ov = sheet(
    `<div class="sheet-head"><h2>${n ? "공지 고치기" : "새 공지"}</h2><button class="icon-btn" data-x aria-label="닫기">${ICON.close}</button></div>
    <div class="field"><label for="ntT">제목</label><input id="ntT" maxlength="120" value="${esc(n ? n.title : "")}"></div>
    <div class="field"><label for="ntB">내용 <span class="note">줄바꿈 그대로, 주소는 링크로 보여요</span></label>` +
      `<textarea id="ntB" maxlength="8000" style="min-height:200px">${esc(n ? n.body : "")}</textarea></div>
    <div class="toggle" style="margin-top:12px"><label for="ntP">맨 위에 고정</label><input type="checkbox" id="ntP" ${n && n.pinned ? "checked" : ""}></div>
    <div class="toggle" style="margin-top:8px"><label for="ntV">공개 <span class="note">끄면 관리자에게만 보여요</span></label>` +
      `<input type="checkbox" id="ntV" ${n && n.published === false ? "" : "checked"}></div>
    <p class="lerr" id="ntE" role="alert"></p>
    <div class="cta-row" style="margin-top:4px"><span class="spacer"></span><button class="btn ghost" data-x>취소</button>` +
      `<button class="btn pri" id="ntS">${n ? "저장" : "올리기"}</button></div>`
  );
  $("#ntT", ov).focus();
  $("#ntS", ov).onclick = async (e) => {
    const title = $("#ntT", ov).value.trim();
    if (!title) {
      $("#ntE", ov).textContent = "제목을 적어 주세요.";
      return $("#ntT", ov).focus();
    }
    e.target.disabled = true;
    try {
      await SUPPORT.saveNotice({
        id: n ? n.id : undefined,
        title,
        body: $("#ntB", ov).value.trim(),
        pinned: $("#ntP", ov).checked,
        published: $("#ntV", ov).checked
      });
      ov.remove();
      toast(n ? "공지를 고쳤어요" : "공지를 올렸어요");
      viewNotice();
    } catch (x) {
      $("#ntE", ov).textContent = supportErr(x);
      e.target.disabled = false;
    }
  };
}

/* MY(관리자 도구): 고객센터 관리 칸 — 답변 대기 수 */
EXT.me.push((v) => {
  const box = $("#meExt", v);
  if (!box || !SB.on() || !SB.s) return;
  box.insertAdjacentHTML(
    "beforeend",
    `<h2 class="sec">고객센터 관리 <small>관리자 도구</small></h2>
    <div class="box"><div class="menu-list"><button data-hgo="help-ask">받은 문의<span class="v" id="inOpen">확인 중…</span></button>` +
      `<button data-hgo="notice">공지 쓰기·고치기</button></div></div>`
  );
  $$("[data-hgo]", box).forEach((b) => (b.onclick = () => go(b.dataset.hgo)));
  const out = (t) => {
    const el = $("#inOpen", box);
    if (el) el.textContent = t;
  };
  SUPPORT.amAdmin()
    .then((yes) =>
      yes
        ? SUPPORT.inbox("open").then((l) => {
            const u = l.filter(urgentReport).length;
            out(l.length ? `답변 대기 ${l.length}건${u ? ` · 우선 신고 ${u}건` : ""}` : "대기 없음");
          })
        : out("관리자 계정 아님")
    )
    .catch((e) => out(supportErr(e).slice(0, 24)));
});
