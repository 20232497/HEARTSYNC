/* 모든 작품(content/)의 인물마다 일상 화풍의 완성된 프롬프트를 뽑는다 — 여성 인물은 남성향 일상, 남성 인물은 여성향 일상. 저장소 맨 위에서:
     node archive/style-mdaily/code/prompts.mjs            → 모든 인물의 프로필(칸 0)과 기본(칸 1)을 JSON으로 출력
     node archive/style-mdaily/code/prompts.mjs yunhaera   → 그 작품만 · 끝에 all을 붙이면 칸 0~14 전부
   감정 그림의 배경은 작품의 첫 장소(places[0]). 작품 태그가 바뀌면 다시 뽑는다(결과 파일은 저장소에 두지 않음). 뽑으면서 assertSafe로 성인 표시·네거티브를 확인한다 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { profileJob, emotionJob, assertSafe, isFem, ageOf } from "./assemble.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const args = process.argv.slice(2),
  all = args.includes("all"),
  only = args.find((a) => a !== "all");
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name === "work.js" ? [path.join(d, e.name)] : []));
const out = [];
for (const f of walk(path.join(root, "content"))) {
  const id = path.basename(path.dirname(f));
  if (only && only !== id) continue;
  const work = (await import(pathToFileURL(f).href)).default,
    place = (work.places || [])[0];
  for (const c0 of work.cast || []) {
    const base = c0.of ? (work.cast || []).find((x) => x.code === c0.of) : null; // 다른 모습(폼)은 성격·나이가 없으면 본체 값
    const c = base ? { ...c0, temper: c0.temper || base.temper, age: c0.age === undefined ? base.age : c0.age } : c0;
    const row = { work: id, code: c.code, name: c.name, style: isFem(c) ? "mdaily" : "fdaily", age: ageOf(c), temper: c.temper || "(옅은 미소)", slots: {} };
    row.slots[0] = assertSafe(profileJob(c, place));
    for (const s of all ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] : [1]) row.slots[s] = assertSafe(emotionJob(c, place, s));
    out.push(row);
  }
}
if (!out.length) throw new Error("인물을 찾지 못했어요" + (only ? " — 작품 id: " + only : ""));
process.stdout.write(JSON.stringify(out, null, 1) + "\n");
