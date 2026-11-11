// 빌드 도구들이 같이 쓰는 것: 폴더 위치, 빌드 대상(TARGETS), 작품 폴더 이름(AUD_DIRS), 빌드 오류(BuildError), 파일 읽기·쓰기 도우미, 값 모양 검사(isObj·str), <script>에 넣어도 안전한 글(jsSafe)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const SRC = path.join(ROOT, "src"), JS = path.join(SRC, "js"), CONTENT = path.join(ROOT, "content");
export const GEN_FILE = path.join(JS, "content", "generated.js"), BUILD_DIR = path.join(ROOT, ".build");

/* 빌드 대상: page(뼈대, src/ 아래) → out(저장소 루트). strip이면 주석·빈 줄을 벗기고, doc이면 모듈마다 설명 머리를 붙임 */
export const TARGETS = {
  user: { page: "page.html", out: "index.html", strip: true, doc: false, linemap: "linemap.json", label: "사용자 사이트" },
  admin: { page: "admin.html", out: "admin.html", strip: false, doc: true, linemap: "linemap-admin.json", label: "관리자 도구" }
};
/* 폴더 이름이 곧 작품의 aud(관심있는 대화) 값 */
export const AUD_DIRS = { f: "여성향(남성 캐릭터와의 대화)", m: "남성향(여성 캐릭터와의 대화)", all: "전체(남녀가 섞임)" };

export class BuildError extends Error { constructor(list) { super(list.join("\n")); this.list = list; } }

export const readText = (p) => fs.readFileSync(p, "utf8").replace(/^﻿/, "").replace(/\r\n?/g, "\n");
export const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");
export const visible = (name) => !name.startsWith(".") && !name.startsWith("_");
export const subdirs = (dir) => fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory() && visible(d.name)).map((d) => d.name).sort();
export const writeIfChanged = (p, text) => { if (!fs.existsSync(p) || readText(p) !== text) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); return true; } return false; };
export const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
export const str = (v) => typeof v === "string" && v.trim() !== "";
/* <script> 안에 넣어도 안전하게: "</script"가 태그를 닫지 않게, U+2028·2029(오래된 브라우저에서 문자열 안 줄바꿈 오류)는 이스케이프 */
export const LS = String.fromCharCode(0x2028), PS = String.fromCharCode(0x2029);
export const jsSafe = (s) => s.replace(/<\//g, "<\\/").split(LS).join("\\u2028").split(PS).join("\\u2029");
