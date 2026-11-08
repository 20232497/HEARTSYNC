/* 대화방 명령어(순수): 앱 명령어(APP_COMMANDS — !상태창·!갤러리·!지도·!도움말, 앱이 바로 처리)와 작품 명령어(work.js commands — AI에 연출 지시로 감), 입력 글 해석(parseCommand·findCommand·commandText) */
/** @typedef {import("./types.js").Command} Command */

/** 앱 명령어 — 어느 작품에서나 AI를 부르지 않고 앱이 바로 처리(view는 대화방 드로어 화면, help는 도움말 한 줄). 작품 명령어는 이 이름·별칭을 쓸 수 없음(빌드 검사) */
export const APP_COMMANDS = [
  { cmd: "상태창", alias: ["상태"], view: "status", title: "상태창 보기", desc: "지금 장면의 상태창을 펼쳐요" },
  { cmd: "갤러리", alias: ["도감"], view: "gallery", title: "갤러리", desc: "이 대화에 나온 장면 그림을 모아 봐요" },
  { cmd: "지도", alias: ["장소"], view: "places", title: "장소 보기", desc: "이 작품의 장소(MP 코드) 목록과 그림을 봐요" },
  { cmd: "도움말", alias: ["명령어", "help"], view: "help", title: "도움말", desc: "쓸 수 있는 명령어를 알려 줘요" }
];
/** 입력 글이 명령어 모양(!이름)이면 이름, 아니면 "". 전각 ！도 받고 앞뒤 공백은 뺌. @param {string} text @returns {string} */
export function parseCommand(text) { const m = String(text || "").trim().match(/^[!！]\s*(\S+)$/); return m ? m[1] : ""; }
/**
 * 이름으로 명령어 찾기 — 앱 명령어(별칭 포함, 영문은 대소문자 무시)가 먼저, 다음은 작품의 commands. 없으면 null.
 * @param {string} name @param {{commands?: Command[]}|null|undefined} c @returns {{app: typeof APP_COMMANDS[number], work?: undefined}|{work: Command, app?: undefined}|null}
 */
export function findCommand(name, c) {
  const n = String(name || "").toLowerCase();
  if (!n) return null;
  const app = APP_COMMANDS.find((x) => x.cmd === n || x.alias.some((a) => a.toLowerCase() === n));
  if (app) return { app };
  const work = ((c && c.commands) || []).find((x) => String(x.cmd).toLowerCase() === n);
  return work ? { work } : null;
}
/** 유저 메시지가 작품 명령어면 AI에 보낼 글(// 연출 지시 — 명령 이름·제목·지시), 아니면 원문 그대로. @param {string} text @param {{commands?: Command[]}|null|undefined} c @returns {string} */
export function commandText(text, c) {
  const f = findCommand(parseCommand(text), c);
  return f && f.work ? `// 유저가 명령어 !${f.work.cmd}(${f.work.title})을 썼다. ${f.work.prompt}` : text;
}
/** 도움말 한 줄: 앱 명령어 + 작품 명령어(제목). @param {{commands?: Command[]}|null|undefined} c @returns {string} */
export function commandHelp(c) {
  return [...APP_COMMANDS.map((x) => "!" + x.cmd), ...((c && c.commands) || []).map((x) => `!${x.cmd}(${x.title})`)].join(" · ");
}
