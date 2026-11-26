/* MY: 내 서재(찜·도감 — ui/me-shelf.js)·페르소나·관심있는 대화·채팅 설정·AI 연결·계정·고객센터·약관 및 정책. #meExt 자리는 관리자 빌드가 EXT.me로 채움(답변 대기 문의 수) */
import { engineName } from "../ai/llm.js";
import { AUDS, audience } from "../core/audience.js";
import { LIMITS } from "../core/constants.js";
import { saveRoom } from "../core/rooms.js";
import { applySettings, cleanKeys, saveSettings } from "../core/settings.js";
import { S, room } from "../core/state.js";
import { KV } from "../core/storage.js";
import { $, $$, esc, num, toast, uid } from "../core/util.js";
import { isPro } from "../core/wallet.js";
import { CLOUD } from "../services/cloud.js";
import { localKVKeys, pushAll } from "../services/cloud-push.js";
import { wipeAccount } from "../services/cloud-wipe.js";
import { IMG } from "../services/images.js";
import { clearDevice } from "../services/sync.js";
import { accountBoxHTML, bindAccount } from "./account.js";
import { bindChatSettings, chatSettingsHTML } from "./chat-settings.js";
import { renderLog } from "./chat/log.js";
import { pavHTML } from "./cover.js";
import { runExt } from "./ext.js";
import { checkNotices, docUrl, hasNewNotice } from "./help.js";
import { audSegHTML, setAudience } from "./home.js";
import { ICON } from "./icons.js";
import { bindShelf, shelfHTML } from "./me-shelf.js";
import { confirmSheet, sheet } from "./sheet.js";
import { bindGo, topbar } from "./shell.js";

export function viewMe() {
  const v = $("#view"),
    cur = S.personas.find((p) => p.def) || S.personas[0];
  v.innerHTML =
    `<div class="page">${topbar()}
    <h1 class="sec" style="margin-top:4px">MY</h1>
    <div class="statline">
      <div class="box"><h3>대화방</h3><b>${S.rooms.length}</b></div>
      <div class="box"><h3>하트</h3><b>♥ ${num(S.wallet.hearts)}</b></div>
      <div class="box"><h3>요금제</h3><b>${isPro() ? "PLUS" : "무료"}</b></div>
    </div>
    ${accountBoxHTML()}
    ${shelfHTML()}
    <h2 class="sec">내 페르소나 <small>대화에서 내가 연기하는 캐릭터</small></h2>
    <div class="box">
      <div class="avatar-pick">${pavHTML(cur)}<div style="min-width:0"><b style="font-size:17px">${esc(cur.name)}</b> ` +
    `<span class="pill">기본</span><div class="note">${esc(cur.memo || "")}</div></div></div>
      ${
        cur.desc
          ? `<div class="setcard" style="margin-top:12px"><h4>상세 정보</h4>` +
            `<p style="margin:0;white-space:pre-wrap;font-size:13.5px">${esc(cur.desc)}</p></div>`
          : ""
      }
      <h3 style="margin:16px 0 8px">현재 페르소나</h3>
      <div class="plist">${S.personas
        .map(
          (p) =>
            `<div class="prow ${p.def ? "on" : ""}">${pavHTML(p)}` +
            `<div class="x" data-def="${esc(p.id)}" role="button" tabindex="0" title="기본 페르소나로 설정">` +
            `<b>${esc(p.name)}${p.def ? ' <span class="chk">✓</span>' : ""}</b><span>${esc(p.memo || p.desc || "설명 없음")}</span></div>` +
            `<button class="btn sm ghost" data-pedit="${esc(p.id)}">수정</button></div>`
        )
        .join("")}</div>
      ${S.personas.length < 8 ? `<button class="btn block" id="padd" style="margin-top:8px">+ 페르소나 추가</button>` : ""}
    </div>
    <h2 class="sec">관심있는 대화 <small>홈에 보일 작품</small></h2>
    <div class="box">${audSegHTML()}<p class="note" style="margin:8px 0 0">남성향은 여성 캐릭터, 여성향은 남성 캐릭터와의 대화만 보여요.</p></div>
    <h2 class="sec">채팅 설정 <small>바꾸면 바로 적용돼요</small></h2>
    <div class="box">${chatSettingsHTML()}</div>
    <h2 class="sec">AI 연결 <small>지금: ${esc(engineName())}</small></h2>
    <div class="box">
      <div class="field" style="margin-top:0"><label for="key">Anthropic API 키 <span class="note">이 기기에만 저장돼요</span></label>` +
    `<input id="key" type="password" autocomplete="off" placeholder="sk-ant-..." value="${esc(S.settings.apiKey)}"></div>
    </div>
    <div id="meExt"></div>
    <div class="cta-row" style="margin-top:14px"><button class="btn pri" id="setSave">설정 저장</button><span class="spacer"></span>` +
    `<button class="btn sm danger" id="reset">모든 데이터 초기화</button></div>
    <p class="note">API 키는 이 브라우저에만 저장돼요. 로그인하면 대화·페르소나·설정은 계정에도 저장돼요.</p>
    <h2 class="sec">고객센터</h2>
    <div class="box"><div class="menu-list" id="helpMenu">
      <button data-go="notice">공지사항<span class="v" id="noticeNew">${hasNewNotice() ? "새 공지" : ""}</span></button>
      <button data-go="help-faq">자주 묻는 질문</button>
      <button data-go="help-ask">문의하기</button></div></div>
    <h2 class="sec">약관 및 정책</h2>
    <div class="box"><div class="menu-list">
      <a href="${esc(docUrl("terms.html"))}" target="_blank" rel="noopener">이용약관</a>
      <a href="${esc(docUrl("privacy.html"))}" target="_blank" rel="noopener">개인정보처리방침</a></div></div>
  </div>`;
  bindGo(v);
  bindShelf(v);
  IMG.hydrate(v);
  checkNotices();
  runExt("me", v);
  $$("[data-def]", v).forEach(
    (b) =>
      (b.onclick = () => {
        S.personas.forEach((p) => (p.def = p.id === b.dataset.def));
        KV.set("personas", S.personas);
        viewMe();
      })
  );
  $$("[data-pedit]", v).forEach(
    (b) =>
      (b.onclick = () =>
        personaSheet(
          S.personas.find((p) => p.id === b.dataset.pedit),
          viewMe
        ))
  );
  const pa = $("#padd");
  if (pa) pa.onclick = () => personaSheet(null, viewMe);
  bindChatSettings(v); // 채팅 설정: 바꾸는 즉시 저장·반영 — 대화방 메뉴의 '표시 설정'과 같은 조각(ui/chat-settings.js)
  bindAccount(v);
  $$("[data-aud]", v).forEach(
    (x) =>
      (x.onclick = () => {
        setAudience(x.dataset.aud);
        $$("[data-aud]", v).forEach((y) => y.classList.toggle("on", y === x));
        toast(`${AUDS[audience()].name} 작품을 보여 드릴게요`);
      })
  );
  $("#setSave").onclick = () => {
    S.settings.apiKey = $("#key").value.trim();
    const warn = cleanKeys();
    saveSettings();
    applySettings();
    viewMe();
    toast(warn.length ? "저장했어요. 키를 확인해 주세요: " + warn.join(" · ") : "설정을 저장했어요");
  };
  $("#reset").onclick = () =>
    confirmSheet(
      "모든 데이터를 지울까요?",
      "대화방, 하트, 페르소나와 페르소나 사진이 모두 지워져요." +
        (CLOUD.on ? " 로그인되어 있어서 계정에 저장된 데이터와, 이 계정으로 쓰던 다른 기기의 데이터도 그 기기가 다음에 접속할 때 지워져요." : "") +
        " 되돌릴 수 없어요.",
      "전부 삭제",
      wipeAll
    );
}
/* 모든 데이터 초기화: 계정(로그인했으면) → 이 기기 순서. 계정 쪽이 실패하면 이 기기도 지우지 않고 멈춰 알림 — 한쪽만 지워진 상태를 만들지 않음(2026-11-24 사용자 결정,
   전에는 실패를 삼키고 새로고침해 다음 받기에서 지운 대화가 되살아났음). 둘 다 끝난 것을 확인한 뒤에만 새로고침. 지우는 범위는 전과 같음(설정·API 키는 남김) */
let wiping = false,
  accountWiped = false; // 계정 쪽은 끝났고 이 기기만 남았음(기기 지우기를 다시 시도할 때 계정을 또 지우지 않음)
async function wipeAll() {
  if (wiping) return; // 확인 창을 두 번 눌러도 한 번만 — 둘째가 '계정은 끝났다'고 보고 기기부터 지우지 않게
  wiping = true;
  try {
    await wipeNow();
  } finally {
    wiping = false;
  }
}
async function wipeNow() {
  toast("지우는 중이에요…");
  const uid = CLOUD.uid,
    got = CLOUD.on && !accountWiped ? await wipeAccount() : "ok";
  if (got !== "ok") {
    // 계정 쪽이 실패하면 이 기기에 그대로 있는 것을 다시 올려 둠 — 대화는 어느 쪽에서도 지워지지 않았음. "half"(방이 아닌 행만 지워짐)는 방의 표식 요청이 서버에
    // 적용됐을 수 있어 방 본문까지. "unsure"(첫 DELETE의 답을 잃음 — 2026-11-25 디렉터 검토: 전에는 목록·지갑·페르소나가 빠진 계정이 남았음)는 방 행을 건드리기
    // 전이라 방이 아닌 행만(다른 기기가 올린 더 새 방 본문을 옛 본문으로 덮지 않게). "fail"(서버가 거절 — 지워진 것 없음)은 올리지 않음(Codex 검토)
    if (got !== "fail" && CLOUD.on && CLOUD.uid === uid)
      try {
        await pushAll(got === "unsure" ? localKVKeys().filter((k) => !/^room-/.test(k)) : undefined);
      } catch {}
    return wipeFailed("계정의 데이터를 지우지 못했어요", "네트워크를 확인하고 다시 시도해 주세요. 이 기기의 데이터도 아직 그대로예요.");
  }
  // 지우는 사이 계정이 바뀌었으면(로그아웃·다른 계정) 이 기기에 있는 것은 이제 다른 계정의 것 — 지우지 않음
  if (CLOUD.uid !== uid) return toast("계정이 바뀌어서 이 기기의 데이터는 지우지 않았어요");
  accountWiped = true;
  const clean = await clearDevice(); // 큰 저장소(방 본문·그림)를 비웠는지
  if (!clean) return wipeFailed("이 기기의 데이터를 다 지우지 못했어요", "이 사이트를 연 다른 탭을 닫고 다시 시도해 주세요.", true);
  location.reload();
}
function wipeFailed(title, sub, half) {
  const ov = sheet(
    `<h2>${esc(title)}</h2><p class="sub">${esc(sub)}</p><div class="cta-row"><span class="spacer"></span>` +
      `<button class="btn ghost" data-x>닫기</button><button class="btn pri" id="wRetry">다시 시도</button></div>`
  );
  let again = false;
  $("#wRetry", ov).onclick = () => {
    again = true;
    ov.remove();
    wipeAll();
  };
  // 계정은 지워졌고 이 기기만 덜 지워진 채 닫으면 새로고침 — 이 화면은 계정에 더 올리지 않는 상태(CLOUD.wiped)라 그대로 쓰게 두지 않음(새로고침하면 풀림)
  if (half)
    ov.onShut = () => {
      if (!again) location.reload();
    };
}
/* 페르소나 만들기·수정 시트. 사진은 이용자가 올린 것만 */
export function personaSheet(p, after) {
  let img = p?.img || "";
  const ov = sheet(
    `<div class="sheet-head"><h2>${p ? "페르소나 수정" : "새 페르소나"}</h2><button class="icon-btn" data-x aria-label="닫기">${ICON.close}</button></div>
    <div class="avatar-pick" style="margin:8px 0 4px"><div id="avBox">${pavHTML({ name: p?.name || "?", img })}</div><div>` +
      `<input type="file" id="av" accept="image/png,image/jpeg,image/webp" hidden><button class="btn sm" id="avBtn">이미지 올리기</button> ` +
      `<button class="btn sm ghost" id="avDel" ${img ? "" : "hidden"}>빼기</button>` +
      `<p class="note" style="margin:6px 0 0">대화에서 내 말풍선 옆에 보여요.</p></div></div>
    <div class="field"><label for="pn">이름</label><input id="pn" maxlength="20" value="${esc(p?.name || "")}"></div>
    <div class="field"><label for="pm">메모 (목록에 보이는 한 줄, 예: 관능미 · 츤데레)</label><input id="pm" maxlength="30" value="${esc(p?.memo || "")}"></div>
    <div class="field"><label for="pd" style="display:flex">상세 정보 (AI가 보고 나를 대해요)<span class="spacer"></span>` +
      `<span class="memo-count" id="pdCnt"></span></label>` +
      (`<textarea id="pd" maxlength="${LIMITS.personaDesc}" style="min-height:130px" placeholder="예: 27세 남자. 긴 장발의 리프컷, 진한 흑발. 나른하고 ` +
        `귀찮은 말투, 맑은 저음.">${esc(p?.desc || "")}</textarea></div>
    <div class="toggle" style="margin-top:12px"><label for="pdef">기본 페르소나로 쓰기</label><input type="checkbox" id="pdef" ${p?.def ? "checked" : ""}></div>
    <div class="cta-row">${p && S.personas.length > 1 ? `<button class="btn danger" id="pdel">삭제</button>` : ""}`) +
      `<span class="spacer"></span><button class="btn ghost" data-x>취소</button><button class="btn pri" id="psave">저장</button></div>`
  );
  IMG.hydrate(ov);
  const pd = $("#pd", ov),
    pdUpd = () => {
      $("#pdCnt", ov).textContent = num(pd.value.length) + " / " + num(LIMITS.personaDesc);
    };
  pd.oninput = pdUpd;
  pdUpd(); // 글자 수 "n / 한도"
  const setImg = (ref) => {
    img = ref || "";
    $("#avBox", ov).innerHTML = pavHTML({ name: $("#pn", ov).value || "?", img });
    IMG.hydrate(ov);
    $("#avDel", ov).hidden = !img;
  };
  $("#avBtn", ov).onclick = () => $("#av", ov).click();
  $("#av", ov).onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      setImg(await IMG.put(f));
    } catch {
      toast("이미지를 읽지 못했어요.");
    }
  };
  $("#avDel", ov).onclick = () => setImg("");
  $("#psave", ov).onclick = () => {
    const name = $("#pn", ov).value.trim();
    if (!name) {
      $("#pn", ov).focus();
      return;
    }
    const item = p || { id: uid("p") };
    Object.assign(item, { name, memo: $("#pm", ov).value.trim(), desc: pd.value.trim().slice(0, LIMITS.personaDesc), img });
    if ($("#pdef", ov).checked) S.personas.forEach((x) => (x.def = false));
    item.def = $("#pdef", ov).checked || (!!p && p.def);
    if (!p) S.personas.push(item);
    if (!S.personas.some((x) => x.def)) S.personas[0].def = true;
    KV.set("personas", S.personas);
    if (room && room.persona.id === item.id) {
      room.persona = { id: item.id, name: item.name, memo: item.memo, desc: item.desc, img: item.img };
      saveRoom(room);
      renderLog();
    }
    ov.remove();
    after && after();
  };
  const del = $("#pdel", ov);
  if (del)
    del.onclick = () => {
      S.personas = S.personas.filter((x) => x !== p);
      if (!S.personas.some((x) => x.def)) S.personas[0].def = true;
      KV.set("personas", S.personas);
      ov.remove();
      after && after();
    };
}
