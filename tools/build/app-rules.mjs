// 작품 검사에 쓰는 앱 규칙을 src/js에서 꺼냄(appRules) — 규칙이 빌드와 앱 두 군데로 갈라지지 않게 같은 코드를 읽어 씀
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { BuildError, GEN_FILE, JS, readText } from "./common.mjs";

/* 빌드 검사에 쓰는 앱 규칙 — src/js에서 같은 코드를 꺼내 쓴다(규칙이 두 군데로 갈라지지 않게) */
const APP_RULES = [
  "SIT",
  "CODE_RE",
  "SERIES",
  "codebook",
  "APP_COMMANDS",
  "PALETTES",
  "MOTIFS",
  "CATS",
  "LIMITS",
  "LORE",
  "FREE_DAILY",
  "MODELS",
  "guessAud",
  "personaWho",
  "personaLook",
  "castLook",
  "minorFlags",
  "minorHint",
  "settingHint",
  "LORE_KINDS",
  "OPENING_ID_RE",
  "GAUGE_COND_RE"
];

/* ---------------------------------------------------------------- 앱 규칙 꺼내기(작품 검사용) */
export function appRules() {
  const files = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".js") && p !== GEN_FILE) files.push(p);
    }
  })(JS);
  const lines = files.flatMap((f) => readText(f).split("\n")),
    parts = [];
  for (const name of APP_RULES) {
    const fn = new RegExp(`^(?:export )?function\\s+${name}\\s*\\(`),
      cn = new RegExp(`^(?:export )?const\\s+${name}\\s*=`);
    const i = lines.findIndex((l) => fn.test(l) || cn.test(l));
    if (i < 0) throw new BuildError([`src/js에서 ${name}을(를) 찾지 못했어요 — 이름을 바꿨다면 tools/build.mjs의 APP_RULES도 고쳐 주세요`]);
    let j = i;
    if (fn.test(lines[i])) {
      if (!/}\s*$/.test(lines[i])) while (j < lines.length && lines[j] !== "}") j++;
    } else while (j < lines.length && !/;\s*(\/\/.*)?$/.test(lines[j])) j++; // 줄 끝 주석은 허용
    parts.push(
      lines
        .slice(i, j + 1)
        .join("\n")
        .replace(/^export /, "")
    );
  }
  const ctx = vm.createContext({});
  try {
    vm.runInContext(`"use strict";\n${parts.join("\n")}\nglobalThis.R = { ${APP_RULES.join(", ")} };`, ctx);
  } catch (e) {
    throw new BuildError([`src/js의 앱 규칙(${APP_RULES.join(", ")})을 읽지 못했어요 — ${e.message}`]);
  }
  return ctx.R;
}
