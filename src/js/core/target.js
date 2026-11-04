/* 빌드 대상: "user"(index.html — 사용자 사이트) 또는 "admin"(admin.html — 관리자 도구). 진입점(main.js·admin.js)이 setTarget으로 정한다.
   모듈은 되도록 이 값으로 갈라지지 말고 EXT 고리·화면 등록(ui/shell.js의 registerViews)으로 나뉜다 — 여기는 문구·로고 배지처럼 작은 차이에만 */
export let TARGET = "user";
export function setTarget(t) { TARGET = t === "admin" ? "admin" : "user"; return TARGET; }
export const isAdmin = () => TARGET === "admin";
