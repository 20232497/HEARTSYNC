/* 남성향 작품(content/m)의 인물마다 완성된 프롬프트를 뽑는다 — 저장소 맨 위에서:
     node archive/style-manime/code/prompts.mjs            → 모든 인물의 프로필(칸 0)과 기본(칸 1)을 JSON으로 출력
     node archive/style-manime/code/prompts.mjs godseats   → 그 작품만 · 끝에 all을 붙이면 칸 0~14 전부
   감정 그림의 배경은 작품의 첫 장소(places[0]). 작품 태그가 바뀌면 다시 뽑는다(결과 파일은 저장소에 두지 않음) */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { profileJob, emotionJob, assertSafe, personaOf, tierOf, EMOTIONS } from "./assemble.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const args = process.argv.slice(2), all = args.includes("all"), only = args.find((a) => a !== "all");
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name === "work.js" ? [path.join(d, e.name)] : []));
const out = [];
for (const f of walk(path.join(root, "content", "m"))) {
  const id = path.basename(path.dirname(f));
  if (only && only !== id) continue;
  const work = (await import(pathToFileURL(f).href)).default, place = (work.places || [])[0];
  for (const c of work.cast || []) {
    const row = { work: id, code: c.code, name: c.name, tier: tierOf(c), persona: personaOf(c) || "(눈매 규칙)", slots: {} };
    row.slots[0] = assertSafe(profileJob(c, place));
    if (place) for (const s of all ? [1, ...Object.keys(EMOTIONS).map(Number)] : [1]) row.slots[s] = assertSafe(emotionJob(c, place, s));
    out.push(row);
  }
}
if (!out.length) throw new Error("인물을 찾지 못했어요" + (only ? " — 작품 id: " + only : ""));
process.stdout.write(JSON.stringify(out, null, 1) + "\n");
