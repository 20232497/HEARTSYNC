/* 쓰지 않는 Runware 키 정리(사용자 사이트만 — main.js가 import): 그림 생성이 관리자 전용이 되기 전에 넣어 둔 키가 남아 있으면 MY에 칸을 보이고, 누를 때만 지운다.
   자동으로 지우지 않는 이유: 사용자 사이트와 관리자 도구가 같은 브라우저 저장소·같은 계정 금고를 쓰고, 지우면 되돌릴 수 없다 — 관리자 확인이 한 번만 어긋나도 관리자의 키를 잃는다.
   거꾸로 남은 키가 되살아나는 쪽(로그아웃해 둔 기기로 다시 로그인하면 그 기기의 키가 금고에 다시 올라옴)은 칸이 다시 보여 한 번 더 지우면 되니 잃는 쪽보다 안전하다.
   지우지 않는 경우: 관리자 계정 · 관리자 도구 비밀번호를 지난 브라우저 · 관리자인지 서버 답을 못 받음. 칸을 그릴 때와 누르는 순간 모두 확인한다.
   관리자 빌드에는 이 모듈이 없다 — 거기서는 MY → 이미지 생성의 Runware 키 칸(admin/image-settings.js)으로 고친다 */
import { on } from "../core/events.js";
import { S } from "../core/state.js";
import { $, toast } from "../core/util.js";
import { CLOUD } from "../services/cloud.js";
import { SB } from "../services/supabase.js";
import { SUPPORT } from "../services/support.js";
import { VAULT } from "../services/vault.js";
import { EXT } from "./ext.js";
import { confirmSheet } from "./sheet.js";

/**
 * 지금 남은 Runware 키를 어떻게 할 수 있는지.
 * none 칸 없음(키가 없거나 관리자) · unknown 관리자인지 서버 답을 못 받음(지우지 않음) · guest 로그인 전(이 브라우저만) · device 이 기기에만 있음 · locked 이 기기만 지울 수 있음(계정 금고가 잠김) · both 이 기기와 계정 금고
 * @returns {Promise<"none"|"unknown"|"guest"|"device"|"locked"|"both">}
 */
export async function leftoverPlan() {
  if (!S.settings.runwareKey) return "none";
  // 관리자 도구 비밀번호를 지난 브라우저(admin/gate.js)는 로그아웃해 있어도 운영자의 키일 수 있음. 일반 이용자에게는 이 표시가 없어 잃는 것이 없음
  try { if (localStorage.getItem("hv1_admin")) return "none"; } catch {}
  if (!SB.on()) return "device";
  if (!SB.s) return "guest";
  const admin = await SUPPORT.adminStatus();
  if (admin !== false) return admin ? "none" : "unknown";
  if (!CLOUD.on || CLOUD.noTable || S.settings.syncKeys === false || !VAULT.ok()) return "device";
  if (VAULT.state === "locked" || VAULT.state === "stale" || (!VAULT.rec && !VAULT.phrase())) return "locked";
  return VAULT.rec ? "both" : "device";
}
/**
 * 남은 Runware 키를 지움 — 칸을 그린 뒤 상황이 바뀌었을 수 있으니 누르는 순간 다시 확인.
 * @returns {Promise<{plan: string, account: ""|"done"|"none"|"locked"}>} account가 비면 지우지 않은 것
 * @throws 서버 오류·연결 실패(아무것도 바뀌지 않음)
 */
export async function clearLeftover() {
  const plan = await leftoverPlan();
  if (plan === "none" || plan === "unknown") return { plan, account: "" };
  return { plan, account: await VAULT.clearField("runwareKey") };
}

const LEFT_COPY = {
  guest: ["이 브라우저에 남아 있어요. 계정에도 저장했다면 로그인한 뒤에 지워야 계정 것까지 지워져요.", "이 브라우저에서 지워요. 로그인하면 계정에 저장된 키는 다시 받아요."],
  device: ["이 기기에 남아 있어요.", "이 기기에서 지워요."],
  locked: ["이 기기에 남아 있어요. 계정에도 잠긴 채 남아 있을 수 있는데, 위 계정 칸에서 잠금을 풀어야 함께 지울 수 있어요.", "이 기기에서만 지워요. 계정에 잠긴 키는 잠금을 풀면 다시 받아지고, 그때 함께 지울 수 있어요."],
  both: ["이 기기와 계정(암호문)에 남아 있어요.", "이 기기와 계정에서 지워요. 로그인한 다른 기기에서도 다음 동기화 때 지워져요."]
};
let leftSeq = 0; // 그리는 중에 다시 불리면 마지막 것만 그림
async function paintLeftover() {
  const box = $("#meExt"); if (!box) return;
  const seq = ++leftSeq, plan = await leftoverPlan();
  if (seq !== leftSeq || !box.isConnected) return;
  let el = $("#rwLeft", box);
  if (plan === "none") { if (el) el.remove(); return; }
  if (!el) { box.insertAdjacentHTML("beforeend", `<div id="rwLeft"></div>`); el = $("#rwLeft", box); }
  el.innerHTML = `<h2 class="sec">쓰지 않는 Runware 키</h2><div class="box">
    <p style="margin:0">예전에 그림을 만들려고 넣어 둔 API 키예요. 지금은 운영자가 미리 만들어 실은 그림을 보여 드려서 이 키를 쓰지 않아요. 지워도 대화에는 영향이 없어요.</p>
    <p class="note" style="margin:8px 0 0">${plan === "unknown" ? "계정 서버에서 확인하지 못해 지금은 지울 수 없어요. 인터넷 연결을 확인하고 MY를 다시 열어 주세요. 키는 그대로예요." : LEFT_COPY[plan][0]}</p>
    ${plan === "unknown" ? "" : `<div class="cta-row" style="margin-top:12px"><button class="btn sm danger" id="rwDel">${plan === "locked" ? "이 기기에서 지우기" : "지우기"}</button></div>`}</div>`;
  const del = $("#rwDel", el); if (!del) return;
  del.onclick = () => confirmSheet("Runware 키를 지울까요?", `${LEFT_COPY[plan][1]} Anthropic·OpenRouter 키는 그대로예요. 되돌릴 수 없어요. Runware에 등록된 키 자체는 없어지지 않으니, 더 쓰지 않으려면 runware.ai에서 폐기해 주세요.`, "지우기", async () => {
    try {
      const { account } = await clearLeftover();
      toast(!account ? "지금은 지울 수 없어요. 키는 그대로예요" : account === "done" ? "Runware 키를 이 기기와 계정에서 지웠어요" : account === "locked" ? "이 기기에서 지웠어요. 계정에 잠긴 키는 잠금을 풀면 지울 수 있어요" : "Runware 키를 지웠어요");
    } catch { toast("계정 서버에 연결하지 못했어요. 키는 그대로예요. 잠시 뒤 다시 해 주세요"); }
    paintLeftover();
  });
}
EXT.me.push(() => { paintLeftover(); });
on("vault", paintLeftover); // 금고 잠금을 풀면 키가 새로 받아져 칸이 달라질 수 있음
