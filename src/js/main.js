/* 사용자 사이트(index.html) 진입점: 사용자 화면·메뉴를 등록하고 부팅한다. 관리자 도구(admin.html)의 진입점은 admin.js */
import { USER_NAVS, USER_VIEWS } from "./app.js";
import { registerViews, setNavs } from "./ui/shell.js";
import { boot } from "./boot.js";

registerViews(USER_VIEWS); setNavs(USER_NAVS);
boot();
