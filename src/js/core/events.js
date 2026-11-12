/* 모듈 사이의 느슨한 연결(이벤트 버스): 아래층(core·services)이 위층(ui)을 import하지 않고 "바뀌었다"고 알리기만 한다 — on(이름, fn)·emit(이름, 값).
   아무것도 import하지 않는 잎 모듈. 이름과 뜻:
     rooms      대화방 목록이 바뀜(core/rooms)           → ui/shell이 레일의 최근 대화를 다시 그림
     wallet     지갑(하트·무료 턴)이 바뀜(core/wallet)     → ui/shell이 지갑 칩을 다시 그림
     settings   설정을 저장함(core/settings)              → services/cloud가 계정에 올림
     cloud      계정 저장 상태가 바뀜(services/cloud)      → ui/account가 상태 글을 다시 그림
     route      화면을 다시 그려야 함(services/sync)       → ui/shell이 route()
     session    로그인한 계정이 바뀜(services/supabase)     → 지금은 받는 곳 없음(서버 기능이 계정마다 바꿔 끼울 자리) */
/** @typedef {import("./types.js").EventName} EventName */
const handlers = {};
/** 이벤트 구독. @param {EventName} name @param {(v?: unknown) => void} fn @returns {Function} 넘긴 fn 그대로 */
export function on(name, fn) {
  (handlers[name] = handlers[name] || []).push(fn);
  return fn;
}
/** 이벤트 알림 — 구독자 하나가 던져도 나머지는 돈다(콘솔에 기록). @param {EventName} name @param {unknown} [v] @returns {void} */
export function emit(name, v) {
  (handlers[name] || []).forEach((fn) => {
    try {
      fn(v);
    } catch (e) {
      console.error("[event " + name + "]", e);
    }
  });
}
