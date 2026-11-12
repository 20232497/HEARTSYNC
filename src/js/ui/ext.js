/* 빌드 확장 고리(EXT): 사용자 화면 모듈이 비워 둔 자리를 관리자 모듈(src/js/admin/)이 채운다. 사용자 빌드(index.html)에는 꽂는 모듈이 없어 runExt가 아무 일도 안 한다.
   me(v) MY의 #meExt 자리 · help(tab, box, list) 고객센터 탭을 그린 뒤(tab "notice"·"ask", list는 그 탭의 공지·내 문의 — 같은 box에 여러 번 불릴 수 있으니 꽂는 쪽은 이미 넣었는지 보고 넣기).
   관리자 기능이 다른 화면에 자리가 필요하면 여기에 이름을 더하고 그 화면이 runExt로 부르게 한다 */
export const EXT = { me: [], help: [] };
export function runExt(name, ...args) {
  (EXT[name] || []).forEach((fn) => {
    try {
      fn(...args);
    } catch (e) {
      console.error("[ext " + name + "]", e);
    }
  });
}
