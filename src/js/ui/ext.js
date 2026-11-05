/* 빌드 확장 고리(EXT): 사용자 화면 모듈이 비워 둔 자리를 관리자 모듈(src/js/admin/)이 채운다. 사용자 빌드(index.html)에는 꽂는 모듈이 없어 runExt가 아무 일도 안 한다.
   detail(c, v) 작품 상세 · drawer(r, body) 대화방 드로어 메뉴 · afterTurn(r, body) 응답이 끝난 뒤 · me(v) MY의 #meExt 자리 · meSave(v) MY '설정 저장' · persona(ov, setImg) 페르소나 시트
   help(tab, box, list) 고객센터 탭을 그린 뒤(tab "notice"·"ask", list는 그 탭의 공지·내 문의 — 같은 box에 여러 번 불릴 수 있으니 꽂는 쪽은 이미 넣었는지 보고 넣기) */
export const EXT = { detail: [], drawer: [], afterTurn: [], me: [], meSave: [], persona: [], help: [] };
export function runExt(name, ...args) { (EXT[name] || []).forEach((fn) => { try { fn(...args); } catch (e) { console.error("[ext " + name + "]", e); } }); }
