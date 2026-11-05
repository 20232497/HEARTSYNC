/* 관리자 전용 이미지 코드(관리자 빌드만): 저장소 루트의 content/codes.admin.json(git에 없음 — 성인 수위 코드 표를 공개 저장소·배포물에 두지 않기 위해)을
   페이지가 http(s)로 열렸을 때 fetch해 상황 칸 표(images/situations.js EXTRA_CODES)에 더한다. 개발 서버(npm run dev)·흐름 시험 서버에서만 되고,
   file://(fetch 막힘)과 웹 주소(파일이 배포되지 않음)에서는 조용히 빈 채로 둔다 — 빌드 결과물(admin.html)에는 글자 하나도 들어가지 않는다.
   웹 관리자 도구에서 성인 수위 코드를 쓰려면 코드 표 시트의 '목록으로 추가'에 원본 표(.txt)를 한 번 들여온다 — 내 칸(customSits)으로 계정에 저장돼 어느 기기에서나 보이고,
   '코드 표 내보내기'·'작품 폴더에 저장'은 전체이용가가 아닌 코드와 그 조합 그림을 빼므로 사용자 사이트로 흘러가지 않는다.
   모양 검사는 빌드의 codes.json과 같게: 번호 15~599(400·500 제외), rating safe·questionable·explicit, 성인 수위면 minorHint 금지.
   전체이용가 코드는 표(admin/motion-table.js)의 base_prompt가 파일의 prompt를 대신하고 motion도 읽음 — 세미·성인 수위 코드는 파일의 prompt 그대로, motion은 버림 */
import { SIT } from "../core/constants.js";
import { minorHint } from "../core/safety.js";
import { RESET, dimOf } from "../images/codes.js";
import { setExtraCodes } from "../images/situations.js";
import { MotionPrompts } from "./motion-table.js";

/** content/codes.admin.json을 읽어 EXTRA_CODES에 넣음. @returns {Promise<number>} 들어간 코드 수(없거나 못 읽으면 0) */
export async function loadAdminCodes() {
  if (!/^https?:$/.test(location.protocol)) return 0;
  let list;
  try { const r = await fetch("content/codes.admin.json", { cache: "no-store" }); if (!r.ok) return 0; list = await r.json(); } catch { return 0; }
  if (!Array.isArray(list)) return 0;
  const seen = new Set(), out = [];
  for (const d of list) {
    if (!d || !Number.isInteger(d.n) || typeof d.name !== "string" || typeof d.prompt !== "string") continue;
    if (d.n < SIT.length || d.n >= 600 || d.n === RESET.wear || d.n === RESET.place || seen.has(d.n)) continue;
    const rating = ["safe", "questionable", "explicit"].includes(d.rating) ? d.rating : "safe";
    if (rating !== "safe" && minorHint(d.name + "\n" + d.prompt)) continue;
    seen.add(d.n);
    const safe = rating === "safe", row = safe && MotionPrompts[d.n], motion = safe && typeof d.motion === "string" ? d.motion.trim() : "";
    out.push({ n: d.n, name: d.name.trim(), prompt: (row && row.base_prompt) || d.prompt.trim(), rating, ...(typeof d.keys === "string" ? { keys: d.keys } : {}), ...(motion ? { motion } : {}), dim: dimOf(d.n), shipped: true, adminOnly: true });
  }
  setExtraCodes(out.sort((a, b) => a.n - b.n));
  return out.length;
}
loadAdminCodes();
