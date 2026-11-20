// 그림 총괄 페이지의 '사이트에 올리기' 단추 — 실은 그림을 사이트에 반영한다(서버의 tools/art/publish.mjs가 빌드·커밋·올리기·PR·검사 통과 시 병합까지).
// 그림 전용 작업 사본(바탕화면 바로가기로 연 것)에서만 눌린다. 올리는 동안 진행 글을 몇 초마다 읽어 보여 준다. 실패하면 이유와 PR 주소를 보여 주고, 다시 누르면 이어서 한다.
import { api } from "/lib.js";

const $ = (s) => document.querySelector(s);
let timer = 0,
  onDone = () => {};
const link = (url) => (url ? ` <a href="${url.replace(/"/g, "")}" target="_blank" rel="noopener">PR 보기</a>` : "");
function show(html, cls, can, label) {
  $("#siteMsg").innerHTML = html;
  $("#siteMsg").className = cls || "dim";
  $("#publish").disabled = !can;
  $("#publish").textContent = label || "사이트에 올리기";
}
/** 올리기 상태를 읽어 단추와 알림을 고친다 — 싣기·버리기 뒤에도 부른다 */
export async function refreshSite() {
  clearTimeout(timer);
  let s;
  try {
    s = await api("/api/site");
  } catch (e) {
    return show("올리기 상태를 읽지 못했어요: " + String((e && e.message) || e).replace(/[<&]/g, " "), "warn", false);
  }
  const j = s.job;
  if (j.running) {
    show("올리는 중 — " + (j.log[j.log.length - 1] || "준비").replace(/[<&]/g, " "), "dim", false);
    timer = setTimeout(refreshSite, 3000);
  } else if (j.error) show(j.error.replace(/[<&]/g, " ") + link(j.url), "warn", s.home || s.upload, s.upload ? "이어서 올리기" : "");
  else if (j.done) {
    show(`올렸어요 — ${j.done.count}장. 몇 분 뒤 사이트에 보여요.` + link(j.url), "ok", false);
    if (!j.told) onDone();
    j.told = true;
  } else if (s.mock) show("연습 모드에서는 올릴 수 없어요.", "dim", false);
  else if (s.upload) show("지난번 올리기가 끝나지 않았어요 — 누르면 이어서 해요.", "warn", true, "이어서 올리기");
  else if (!s.home) show("올리기는 바탕화면의 '그림 총괄' 바로가기로 열었을 때만 돼요(그림 전용 작업 사본).", "dim", false);
  else if (s.others.length) show("그림 말고 바뀐 파일이 있어 올릴 수 없어요: " + s.others.slice(0, 3).join(", ").replace(/[<&]/g, " "), "warn", false);
  else show(s.images.length ? `올릴 그림 ${s.images.length}장` : "올릴 그림이 없어요(후보에서 '싣기'를 누르면 생겨요)", "dim", s.images.length > 0);
}
/** 단추를 건다 — done은 올리기가 끝났을 때 부를 것(목록을 다시 읽기) */
export function initSite(done) {
  onDone = done || onDone;
  $("#publish").addEventListener("click", async () => {
    if (!confirm("실은 그림을 사이트에 올려요. GitHub 검사가 통과하면 바로 main에 병합되고, 몇 분 뒤 공개 사이트에 보여요. 그림을 눈으로 확인하셨나요?")) return;
    try {
      await api("/api/site", { method: "POST", headers: { "x-hs-art": "1" } });
    } catch (e) {
      return show(String((e && e.message) || e).replace(/[<&]/g, " "), "warn", true);
    }
    refreshSite();
  });
  refreshSite();
}
