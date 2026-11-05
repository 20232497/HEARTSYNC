/* 사용자 사이트(index.html) 진입점: 사용자 화면·메뉴를 등록하고 부팅한다. 관리자 도구(admin.html)의 진입점은 admin.js.
   사용자 빌드에만 더하는 것: 쓰지 않는 Runware 키 정리(ui/leftover-key.js) */
import { USER_NAVS, USER_VIEWS } from "./app.js";
import { registerViews, setNavs } from "./ui/shell.js";
import "./ui/leftover-key.js";
import { boot } from "./boot.js";

registerViews(USER_VIEWS); setNavs(USER_NAVS);
boot();
