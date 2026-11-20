/* 모든 작품(content/)의 장소 그림과 표지 작업을 뽑는다 — 화풍 나누기·장소 규칙·표지 규칙을 한 번에 돌려 보는 곳. 저장소 맨 위에서:
     node archive/style-works/code/jobs.mjs            → 모든 작품의 표지와 장소 작업을 JSON으로 출력
     node archive/style-works/code/jobs.mjs hasuk      → 그 작품만
     node archive/style-works/code/jobs.mjs check      → 출력 없이 검사만(작품·장소·표지 수를 한 줄로)
   작품 태그가 바뀌면 다시 뽑는다(결과 파일은 저장소에 두지 않음). 뽑으면서 assertPlace·assertCover로 사람 없음·성인 표시·네거티브·문구 길이를 확인하고,
   로고 설계(./logos.js)에 없는 작품, 표지 설계 표(COVERS)에 없는 작품, 작품 태그가 바뀌어 표지 손질(rep)이 안 먹은 자리를 알려 준다.
   표지는 유형마다 모양이 다르다: 한 장짜리는 { type, job, post }, 단체는 { type, parts: { bg, left, mid, right }, layout, final, post } */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { placeJob, assertPlace, styleOf } from "./place.js";
import { coverPlan, coverOf, COVERS } from "./cover.js";
import { groupPlan } from "./cover-group.js";
import { LOGOS } from "./logos.js";
// 브라우저에서만 도는 캔버스 코드도 여기서 한 번 읽어 문법이 깨지지 않았는지 본다(그리지는 않음)
import { COVER_POST } from "./cover-post.js";
import { FONT_FAMILIES } from "./logo.js";
if (!COVER_POST.dark.filter || !FONT_FAMILIES.length) throw new Error("표지 후처리·로고 글꼴 값이 비었어요");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const args = process.argv.slice(2),
  check = args.includes("check"),
  only = args.find((a) => a !== "check");
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name === "work.js" ? [path.join(d, e.name)] : []));
const out = [],
  notes = [];
let places = 0,
  jobs = 0;
for (const f of walk(path.join(root, "content"))) {
  const id = path.basename(path.dirname(f));
  if (only && only !== id) continue;
  const work = (await import(pathToFileURL(f).href)).default;
  const cover = coverOf(id, work).type === "group" ? groupPlan(id, work) : coverPlan(id, work); // 둘 다 안에서 assertCover를 거친다
  const row = { work: id, style: styleOf(id), cover, logo: !!LOGOS[id], places: {} };
  for (const j of cover.parts ? Object.values(cover.parts) : [cover.job]) for (const a of j.miss || []) notes.push(`${id}: 표지 손질이 안 먹음(작품 태그가 바뀜) — ${a}`);
  jobs += cover.parts ? Object.keys(cover.parts).length + 1 : 1;
  (work.places || []).forEach((p, i) => {
    if (!p.tags) return notes.push(`${id} MP${i + 1}: 장소 태그가 없어 건너뜀`);
    row.places["MP" + (i + 1)] = assertPlace(placeJob(id, work, i + 1));
    places++;
  });
  if (!COVERS[id]) notes.push(`${id}: 표지 설계 표(COVERS)에 없음 — 첫 인물을 가까이 잡은 기본 설계로 뽑음`);
  if (!LOGOS[id]) notes.push(`${id}: 로고 설계(logos.js)가 없음`);
  out.push(row);
}
if (!out.length) throw new Error("작품을 찾지 못했어요" + (only ? " — 작품 id: " + only : ""));
for (const id of Object.keys(COVERS)) if (!only && !out.some((r) => r.work === id)) notes.push(`${id}: COVERS에 있지만 content/에 없는 작품`);
if (check) console.log(`작품 ${out.length} · 표지 ${out.length}(그릴 작업 ${jobs}) · 장소 ${places} — 검사 통과` + (notes.length ? "\n" + notes.join("\n") : ""));
else process.stdout.write(JSON.stringify(out, null, 1) + "\n");
