/* 작품 목록: 빌드가 content/ 폴더로 만든 generated.js(git에 없음)를 읽고, 출연진이 없는 1:1 작품에 cast를 만들어 내보냄.
   ORIGINALS의 images·img·loreImages는 작품 폴더 images/의 그림(content/… 상대 경로), CONTENT_CODES는 content/codes.json의 이미지 코드 표(관리자 도구가 내보냄) */
import { CONTENT_CODES, HOME_ROWS, ORIGINALS } from "./generated.js";

/* 기존 오리지널(1:1): 이미지 출연진(설정의 외모 줄 + 작품의 lookTags 영문 태그)과 첫 등장 프로필 이미지 */
for (const c of ORIGINALS) {
  if (c.cast) continue;
  const look = (c.persona.match(/외모:\s*([^\n]+)/) || [])[1] || "";
  c.cast = [{ code: "c", name: c.name, look, tags: c.lookTags || "" }];
  c.openings.forEach((o) => { o.text = o.text.replace(/\n\n/, "\n\n[[img:c:0]]\n\n"); });
}

export { ORIGINALS, HOME_ROWS, CONTENT_CODES };
