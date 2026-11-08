/* 관리자 도구(admin.html) 진입점: 사용자 사이트의 모든 모듈(app.js) 위에 관리자 모듈(src/js/admin/)을 더해 부팅한다.
   지금 더해지는 것 — 비밀번호 관문(admin/gate.js — 웹 주소로 열면 묻고, localhost·file://은 묻지 않음), 고객센터 관리(admin/support.js — 공지 쓰기·받은 문의, EXT.help·EXT.me).
   운영 도구(회원·하트·신고 — docs/ROADMAP.md)도 여기에 더한다. 사용자 화면에 끼울 것은 ui/ext.js의 EXT 고리로 */
import { USER_NAVS, USER_VIEWS } from "./app.js";
import { setTarget } from "./core/target.js";
import { registerViews, setNavs } from "./ui/shell.js";
import "./admin/support.js";
import { gate } from "./admin/gate.js";
import { boot } from "./boot.js";

setTarget("admin");
registerViews(USER_VIEWS);
setNavs(USER_NAVS);
gate().then(() => boot());
