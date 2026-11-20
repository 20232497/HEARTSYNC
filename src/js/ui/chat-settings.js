/* 채팅 표시 설정 조각: 글자 크기·줄 간격·지문 글꼴·Enter로 보내기·장면 이미지 보기 — MY의 '채팅 설정'과 대화방 메뉴의 '표시 설정'이 같이 씀(한 벌).
   바꾸는 즉시 저장하고(saveSettings) 화면에 반영(applySettings — 대화방 안에서 바꾸면 뒤의 대화 글이 바로 바뀜). 방마다가 아니라 앱 전체의 설정:
   글자 크기와 Enter로 보내기는 이 기기에만, 줄 간격·지문 글꼴·장면 이미지 보기는 로그인하면 계정에도 저장됨(services/cloud.js DEVICE_SETTINGS) */
import { exampleCast } from "../core/character.js";
import { applySettings, saveSettings } from "../core/settings.js";
import { S } from "../core/state.js";
import { $, $$, esc } from "../core/util.js";

const LINE_GAPS = [
    [1.6, "좁게"],
    [1.8, "보통"],
    [2.1, "넓게"]
  ],
  NARR_FONTS = [
    ["serif", "명조"],
    ["sans", "고딕"]
  ];
/** 설정 칸의 HTML — 한 화면에 한 번만 넣음(id가 겹치지 않게). @param {{ preview?: boolean }} [o] preview: 보기 말풍선을 같이 넣을지(대화방 안에서는 뒤의 대화가 보기라 뺌) @returns {string} */
export function chatSettingsHTML({ preview = true } = {}) {
  const s = S.settings,
    opt = (cur) => (x) => `<button type="button" data-v="${x[0]}" class="${cur == x[0] ? "on" : ""}">${x[1]}</button>`,
    seg = (key, list, cur) => `<div class="seg" data-set="${key}">${list.map(opt(cur)).join("")}</div>`;
  return (
    (preview
      ? `<div class="bubble chat-pv" aria-hidden="true"><p class="narr">창밖으로 첫눈이 내리기 시작했다.</p><p>` +
        `<b class="spk">${esc(exampleCast().name)}</b><span class="dlg">"오늘은 여기까지 할까요?"</span></p></div>`
      : "") +
    `<div class="field"${preview ? "" : ' style="margin-top:0"'}><label for="cfs" style="display:flex">글자 크기<span class="spacer"></span>` +
    `<output id="cfsV">${s.fs}px</output></label><input type="range" id="cfs" min="13" max="21" step="0.5" value="${s.fs}"></div>` +
    `<div class="two"><div class="field"><span class="lbl">줄 간격</span>${seg("chatLh", LINE_GAPS, s.chatLh)}</div>` +
    `<div class="field"><span class="lbl">지문 글꼴</span>${seg("narrFont", NARR_FONTS, s.narrFont)}</div></div>` +
    `<div class="toggle" style="margin-top:14px"><label for="cEnter">Enter로 보내기 <span class="note">끄면 Ctrl+Enter로 보내요</span></label>` +
    `<input type="checkbox" id="cEnter" ${s.enterSend !== false ? "checked" : ""}></div>` +
    `<div class="toggle" style="margin-top:8px"><label for="cImg">대화 속 장면 이미지 보기</label>` +
    `<input type="checkbox" id="cImg" ${s.sceneImg !== false ? "checked" : ""}></div>`
  );
}
/** chatSettingsHTML로 넣은 칸에 동작을 붙임 — 바꾸는 즉시 저장·반영. @param {HTMLElement} root 그 칸이 들어 있는 요소 @param {() => void} [after] 바뀐 뒤 부를 것(대화방의 입력창 안내 갱신 등) */
export function bindChatSettings(root, after) {
  const set = (k, val) => {
    S.settings[k] = val;
    saveSettings();
    applySettings();
    if (after) after();
  };
  $("#cfs", root).oninput = (e) => {
    set("fs", +e.target.value);
    $("#cfsV", root).textContent = e.target.value + "px";
  };
  $$("[data-set] button", root).forEach(
    (b) =>
      (b.onclick = () => {
        const k = b.parentElement.dataset.set;
        set(k, k === "chatLh" ? +b.dataset.v : b.dataset.v);
        $$("button", b.parentElement).forEach((x) => x.classList.toggle("on", x === b));
      })
  );
  $("#cEnter", root).onchange = (e) => set("enterSend", e.target.checked);
  $("#cImg", root).onchange = (e) => set("sceneImg", e.target.checked);
}
