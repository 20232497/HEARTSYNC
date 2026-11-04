/* 관리자 전용 이미지 코드(관리자 빌드만): content/codes.admin.json(git에 없음 — 성인 수위 코드 표를 공개 저장소에 두지 않기 위해)을 빌드가 generated-admin.js의
   ADMIN_CODES로 만들어 주면, 여기서 상황 칸 표(images/situations.js allCustom)에 더한다. 각 코드는 shipped·adminOnly가 켜져 있어 코드 표 시트에서 '관리자 전용'으로
   보이고, '코드 표 내보내기'(content/codes.json)와 '작품 폴더에 저장'(그 코드가 든 조합 그림)에서는 빠진다 — 사용자 사이트에는 절대 실리지 않음.
   파일 모양·수위 규칙은 content/README.md. 다른 PC에서 쓰려면 그 파일을 복사해 두거나 코드 표 시트의 '목록으로 추가'에 붙여 넣는다 */
import { ADMIN_CODES } from "../content/generated-admin.js";
import { setExtraCodes } from "../images/situations.js";

setExtraCodes(ADMIN_CODES);
