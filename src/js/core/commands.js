/* 대화방 명령어(순수): 앱 명령어(APP_COMMANDS — 화면형 !상태창·!갤러리·!지도·!도움말은 앱이 바로 처리, 연출형 !시간경과·!새사건·!조연등장·!반복금지는 AI에 연출 지시)와
   작품 명령어(work.js commands — AI에 연출 지시로 감), 한 모양으로 모은 목록(allCommands·commandList), 입력 글 해석(parseCommand·findCommand·commandText) */
/** @typedef {import("./types.js").AppCommand} AppCommand */
/** @typedef {import("./types.js").Command} Command */

/**
 * 앱 명령어 — 어느 작품에서나 쓰는 공통 명령어. 작품 명령어는 이 이름·별칭을 쓸 수 없음(빌드 검사).
 * view가 있으면 '화면형': AI를 부르지 않고 대화방 드로어 화면을 엶(help는 도움말 한 줄, 하트·턴을 쓰지 않음).
 * prompt가 있으면 '연출형': 작품 명령어처럼 그대로 보내되 AI에는 prompt가 // 연출 지시로 감(한 턴을 씀). title·desc는 독자용.
 * @type {AppCommand[]}
 */
export const APP_COMMANDS = [
  { cmd: "상태창", alias: ["상태"], view: "status", title: "상태창 보기", desc: "지금 장면의 상태창을 펼쳐요" },
  { cmd: "갤러리", alias: ["도감"], view: "gallery", title: "갤러리", desc: "이 대화에 나온 장면 그림을 모아 봐요" },
  { cmd: "지도", alias: ["장소"], view: "places", title: "장소 보기", desc: "이 작품의 장소(MP 코드) 목록과 그림을 봐요" },
  { cmd: "도움말", alias: ["명령어", "help"], view: "help", title: "도움말", desc: "쓸 수 있는 명령어를 알려 줘요" },
  { cmd: "시간경과", alias: [], title: "시간 건너뛰기", desc: "며칠 뒤로 건너뛰고 새 장면을 열어요", prompt: "며칠 뒤로 시간을 건너뛴다. 그사이에 있었던 일을 두세 문장으로 요약한 뒤, 달라진 때와 곳에서 새 장면을 연다. 상태창의 날짜·시간 칸이 있으면 함께 바꾼다." },
  { cmd: "새사건", alias: [], title: "새로운 사건", desc: "지금 이야기에 어울리는 새 사건을 일으켜요", prompt: "이 세계관과 지금의 관계에 어울리는 새 사건 하나를 일으킨다. 지금까지의 흐름·떡밥과 이어지게 하고, 유저가 고를 여지를 남긴다." },
  { cmd: "조연등장", alias: [], title: "조연 등장", desc: "장면에 어울리는 조연 두세 명을 불러와요", prompt: "이 장면과 세계관에 어울리는 조연 두세 명을 이름·역할과 함께 자연스럽게 등장시킨다. 조연은 모두 성인이고, 기존 인물의 비중을 빼앗지 않는다." },
  { cmd: "반복금지", alias: [], title: "반복 끊기", desc: "되풀이되는 대사·전개를 끊고 다른 방향으로 가요", prompt: "직전 응답들에 나온 대사·전개·묘사를 되풀이하지 않는다. 같은 표현과 같은 흐름을 피하고 다른 방향으로 장면을 진전시킨다." }
];
/** 명령어 종류(도감 카드 배지·입력창 ! 목록): view 앱 화면형 · direct 앱 연출형 · work 작품 명령어. name은 배지 글, note는 풀이 */
export const COMMAND_KINDS = {
  view: { name: "앱", note: "앱이 바로 화면을 열어요 — 하트를 쓰지 않아요" },
  direct: { name: "연출", note: "어느 작품에서나 AI에게 연출을 지시해요 — 한 턴을 써요" },
  work: { name: "이야기", note: "이 작품의 이야기 장치예요 — 한 턴을 써요" }
};
/**
 * 쓸 수 있는 명령어 전부를 한 모양으로(앱 → 작품 순): { cmd, title, desc, kind, names(이름 + 별칭) }. 도감 카드·도움말·입력창 목록이 모두 이것을 씀.
 * @param {{commands?: Command[]}|null|undefined} c
 * @returns {{cmd: string, title: string, desc: string, kind: "view"|"direct"|"work", names: string[]}[]}
 */
export function allCommands(c) {
  return [...APP_COMMANDS.map((x) => ({ cmd: x.cmd, title: x.title, desc: x.desc, kind: x.view ? "view" : "direct", names: [x.cmd, ...x.alias] })),
    ...((c && c.commands) || []).map((x) => ({ cmd: x.cmd, title: x.title, desc: x.desc || "", kind: "work", names: [x.cmd] }))];
}
/** 입력 글이 명령어 모양(!이름)이면 이름, 아니면 "". 전각 ！도 받고 앞뒤 공백은 뺌. @param {string} text @returns {string} */
export function parseCommand(text) { const m = String(text || "").trim().match(/^[!！]\s*(\S+)$/); return m ? m[1] : ""; }
/**
 * 이름으로 명령어 찾기 — 앱 명령어(별칭 포함, 영문은 대소문자 무시)가 먼저, 다음은 작품의 commands. 없으면 null.
 * @param {string} name @param {{commands?: Command[]}|null|undefined} c @returns {{app: AppCommand, work?: undefined}|{work: Command, app?: undefined}|null}
 */
export function findCommand(name, c) {
  const n = String(name || "").toLowerCase();
  if (!n) return null;
  const app = APP_COMMANDS.find((x) => x.cmd === n || x.alias.some((a) => a.toLowerCase() === n));
  if (app) return { app };
  const work = ((c && c.commands) || []).find((x) => String(x.cmd).toLowerCase() === n);
  return work ? { work } : null;
}
/** 유저 메시지가 연출 지시가 있는 명령어(앱 연출형·작품 명령어)면 AI에 보낼 글(// 연출 지시 — 명령 이름·제목·지시), 아니면 원문 그대로. @param {string} text @param {{commands?: Command[]}|null|undefined} c @returns {string} */
export function commandText(text, c) {
  const f = findCommand(parseCommand(text), c), x = f && (f.work || (f.app.prompt ? f.app : null));
  return x ? `// 유저가 명령어 !${x.cmd}(${x.title})을 썼다. ${x.prompt}` : text;
}
/** 도움말 한 줄: 앱 명령어 + 작품 명령어(제목). @param {{commands?: Command[]}|null|undefined} c @returns {string} */
export function commandHelp(c) {
  return allCommands(c).map((x) => (x.kind === "work" ? `!${x.cmd}(${x.title})` : "!" + x.cmd)).join(" · ");
}
/**
 * 입력창 ! 목록: 입력이 !로 시작하는 한 낱말(쓰는 중 — "!"만 쳐도)이면 이름·별칭이 그 글자로 시작하는 명령어들(앱 → 작품), 아니면 [].
 * @param {string} text @param {{commands?: Command[]}|null|undefined} c @returns {ReturnType<typeof allCommands>}
 */
export function commandList(text, c) {
  const m = String(text || "").match(/^\s*[!！]\s*(\S*)\s*$/);
  if (!m) return [];
  const p = m[1].toLowerCase();
  return allCommands(c).filter((x) => x.names.some((n) => n.toLowerCase().indexOf(p) === 0));
}
