/* 인물 외모 문구: 설정의 "이름(나이, 성별)"·"외모:"와 출연진 look을 합쳐 castLook — S에 의존하지 않아 Node에서도 쓸 수 있음 */
/* 출연진 외모가 비었을 때: 캐릭터 설정의 "이름(나이, 성별)"과 "외모:" 부분으로 대신(성별이 틀린 1girl 기본값 방지) */
/* 설정 첫 괄호 "(27, 남)"·"(외견 28세, 실제 나이 천 살 이상, 남)" → "27세 남성"(성별이 괄호 끝에 있을 때만) */
function personaWho(c) { const w = String(c?.persona || "").match(/\(([^()]{1,60})\)/); if (!w) return ""; const age = w[1].match(/(\d{1,2})\s*(?:세|살)?\s*[,，]/), g = w[1].match(/(?:^|[,，]\s*)([남여])\s*$/); return g ? `${age ? age[1] + "세 " : ""}${g[1] === "남" ? "남성" : "여성"}` : ""; }
function personaLook(c) {
  const look = (String(c?.persona || "").match(/외모\s*[:：]\s*([^\n]+)/) || [])[1] || "";
  return [personaWho(c), look.trim().replace(/[.。]\s*$/, "")].filter(Boolean).join(", ");
}
/* 인물 외모 태그 자리: 출연진 외모 → 비었으면 설정의 외모. 주인공(c) 외모에 성별이 없으면 설정의 "나이 성별"을 앞에 붙임 */
export function castLook(cast, c) {
  const l = String(cast?.look || "").trim();
  if (!l) return personaLook(c);
  const who = cast.code === "c" && !/남성|여성|남자|여자|\b(?:male|female|girl|boy|man|woman)\b/i.test(l) ? personaWho(c) : "";
  return [who, l].filter(Boolean).join(", ");
}
