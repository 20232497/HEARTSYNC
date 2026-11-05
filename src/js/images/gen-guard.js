/* 그림·움짤 생성 관문(관리자 빌드만): 서버(Supabase admins 표)가 관리자로 확인한 계정만 Runware를 부른다. 개발 서버·흐름 시험(localhost·127.0.0.1)은 통과.
   왜(2026-11-05, 사용자 결정 — '오직 어드민 계정에서만 만들어서 세계관에 업데이트'): 그림은 관리자가 직접 만들어 content/에 싣는 것만 쓴다. Pony 계열 모델은 수익 모델 서비스 안에서 돌리면
   라이선스 허가가 필요하고(docs/COMMERCIALIZATION.md §8), admin.html은 웹에 공개돼 있어 비밀번호 관문(admin/gate.js — 클라이언트 해시)만으로는 아무나 자기 키를 넣고 우리 도구로 그릴 수 있었다.
   관리자 여부는 SUPPORT.amAdmin()(RLS가 본인 행만 보여 주는 admins 표 — '맞음'만 기억)이 정한다. 한계: 페이지 JS를 고치면 우회할 수 있지만, 그건 우리 도구가 아니라 직접 만든 클라이언트다 */
import { SB } from "../services/supabase.js";
import { SUPPORT } from "../services/support.js";

/** 개발 서버·흐름 시험 주소인지(관문을 건너뜀). @returns {boolean} */
export const localDev = () => /^https?:$/.test(location.protocol) && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
/** 지금 계정이 그림을 만들 수 있는지 — {ok, code?}. 화면 안내용(설정의 이미지 생성 칸). @returns {Promise<{ok: boolean, code?: string}>} */
export async function genAccess() {
  if (localDev()) return { ok: true };
  if (!SB.on() || !(SB.s && SB.s.user)) return { ok: false, code: "admin_login" };
  return (await SUPPORT.amAdmin()) ? { ok: true } : { ok: false, code: "admin_only" };
}
/** Runware를 부르기 직전에 — 관리자가 아니면 {code: "admin_login" | "admin_only"}를 던짐. @returns {Promise<void>} @throws {{code: string}} */
export async function assertAdmin() {
  const a = await genAccess();
  if (!a.ok) throw { code: a.code };
}
