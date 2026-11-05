/* 관리자 도구(admin.html) 진입점: 사용자 사이트의 모든 모듈(app.js) 위에 관리자 모듈(src/js/admin/)을 더해 부팅한다.
   더해지는 것 — 화면: 작품(#works)·만들기(#studio)·이미지 스튜디오(#images — 예전 #codetest 주소도 여기로) / 관리자 전용 코드(admin/codes.js) / EXT 고리: 상세·드로어·MY·페르소나 시트의 이미지 관리 버튼, 대화 중 그림 자동 생성, 고객센터의 공지 쓰기·받은 문의(admin/support.js) / 설정 이전: 그림체·이미지 모델.
   사용자 빌드와 같은 저장소(이 브라우저·계정)를 쓰므로, 여기서 만든 그림·코드 표는 '작품 폴더에 저장'으로 content/에 써야 사용자 사이트에 실린다(admin/export.js).
   admin.html은 커밋·배포되며(https://…/HEARTSYNC/admin.html) 웹 주소로 열면 비밀번호 관문(admin/gate.js)을 지나야 부팅한다 — 로컬(localhost·file://)은 묻지 않음 */
import { USER_NAVS, USER_VIEWS } from "./app.js";
import { setTarget } from "./core/target.js";
import { registerViews, setNavs } from "./ui/shell.js";
import "./admin/codes.js";
import "./admin/tools.js";
import "./admin/image-settings.js";
import "./admin/auto-images.js";
import "./admin/support.js";
import { gate } from "./admin/gate.js";
import { migrateImageSettings } from "./admin/migrate.js";
import { viewImages } from "./admin/image-studio.js";
import { viewStudio } from "./admin/studio.js";
import { viewWorks } from "./admin/works.js";
import { boot } from "./boot.js";

setTarget("admin");
registerViews({ ...USER_VIEWS, works: viewWorks, studio: viewStudio, images: viewImages, codetest: viewImages });
setNavs([...USER_NAVS.slice(0, 3), ["works", "작품", "book"], ["images", "이미지", "image"], ["studio", "만들기", "plus"], ...USER_NAVS.slice(3)]); // 홈·대화·공지 → 관리자 메뉴 → 스토어·MY
gate().then(() => boot({ migrate: migrateImageSettings }));
