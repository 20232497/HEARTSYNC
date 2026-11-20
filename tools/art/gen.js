// 그림 총괄 페이지의 생성 서비스 호출 — 그리기(밑그림·키워 다시 그리기)·배경 지우기·단체 표지 잇기.
// 키는 이 브라우저의 localStorage에만 두고 생성 서비스(api.runware.ai)로만 보낸다 — 서버(tools/art.mjs)와 저장소에는 가지 않는다.
// 연습 모드(npm run art -- --mock)에서는 생성 서비스 대신 이 서버의 /mock이 자리 표시 그림을 돌려준다(키 없이, 비용 0).
const KEY = "hs_art_runware_key";
export const meta = { mock: false, lib: "" }; // 서버의 /api/meta — app.js가 채움
export const spent = { usd: 0 };

export const key = () => {
  try {
    return localStorage.getItem(KEY) || "";
  } catch {
    return "";
  }
};
export function setKey(v) {
  try {
    if (v) localStorage.setItem(KEY, v);
    else localStorage.removeItem(KEY);
  } catch {
    /* 저장이 막힌 브라우저 — 표시만 */
  }
}
/** 그릴 수 있는 상태인지(연습 모드이거나 키가 있음) */
export const ready = () => meta.mock || !!key();

async function call(task, type) {
  for (let t = 0; ; t++) {
    const r = await fetch(meta.mock ? "/mock" : "https://api.runware.ai/v1", {
      method: "POST",
      headers: { "content-type": "application/json", ...(meta.mock ? { "x-hs-art": "1" } : { authorization: "Bearer " + key() }) },
      body: JSON.stringify([task])
    });
    const d = await r.json().catch(() => ({})),
      e = (d.errors || [])[0];
    if (e && /failedModelLoad|inferenceError/i.test(String(e.code)) && t === 0) {
      task.taskUUID = crypto.randomUUID(); // 가끔 나는 일시 오류 — 한 번만 다시
      continue;
    }
    if (e || !r.ok) throw new Error(e ? [e.code, e.message, e.parameter].filter(Boolean).join(" — ") : "HTTP " + r.status);
    const x = (d.data || []).find((o) => o.taskType === type);
    if (!x) throw new Error("그림이 오지 않았어요");
    spent.usd += x.cost || 0;
    return x;
  }
}
const infer = (j, extra) =>
  call(
    {
      taskType: "imageInference",
      taskUUID: crypto.randomUUID(),
      positivePrompt: j.pos,
      negativePrompt: j.neg,
      model: j.model,
      width: j.width,
      height: j.height,
      numberResults: 1,
      steps: j.steps,
      CFGScale: j.cfg,
      scheduler: j.scheduler,
      seed: j.seed,
      outputFormat: "WEBP",
      outputType: "dataURI",
      checkNSFW: true,
      includeCost: true,
      ...(j.lora && j.lora.length ? { lora: j.lora } : {}),
      ...(/\([^()]+:\d/.test(j.pos + j.neg) ? { promptWeighting: "sdEmbeds" } : {}),
      ...extra
    },
    "imageInference"
  );
export const blobOf = async (uri) => (await fetch(uri)).blob();
export const dataOf = (blob) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(new Error("그림을 읽지 못했어요"));
    r.readAsDataURL(blob);
  });
export const load = (src) =>
  new Promise((res, rej) => {
    const i = new Image(),
      url = typeof src === "string" ? src : URL.createObjectURL(src);
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("그림을 읽지 못했어요"));
    i.src = url;
  });
export const toBlob = (cv, type = "image/webp", q = 0.9) => new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error("그림으로 바꾸지 못했어요"))), type, q));

/** 연습 모드의 자리 표시 그림(SVG)을 진짜 그림 형식으로 — 보관함은 webp·png만 받는다 */
async function real(blob, type) {
  if (!meta.mock) return blob;
  const im = await load(blob),
    cv = document.createElement("canvas");
  cv.width = im.width;
  cv.height = im.height;
  cv.getContext("2d").drawImage(im, 0, 0);
  return toBlob(cv, type, 0.9);
}
/** 작업 하나를 그린다: 밑그림(guide)이 있으면 먼저 그려 본 그림의 밑그림으로, hires가 있으면 키워 다시 그림 → { blob, nsfw } */
export async function generate(j) {
  let nsfw = false,
    seedImage;
  if (j.guide) {
    const g = await infer(j.guide.job);
    nsfw = nsfw || !!g.NSFWContent;
    seedImage = g.imageDataURI;
  }
  let x = await infer(j, seedImage ? { seedImage, strength: j.guide.strength } : {});
  nsfw = nsfw || !!x.NSFWContent;
  if (j.hires) {
    x = await infer(j, { seedImage: x.imageDataURI, strength: j.hires.strength, width: j.hires.w, height: j.hires.h });
    nsfw = nsfw || !!x.NSFWContent;
  }
  return { blob: await real(await blobOf(x.imageDataURI), "image/webp"), nsfw };
}
/** 인물 그림의 배경을 지운다(Runware removeBackground — BiRefNet General, 한 장에 약 0.06센트) → PNG blob */
export async function removeBg(blob) {
  const x = await call(
    { taskType: "removeBackground", taskUUID: crypto.randomUUID(), model: "runware:112@5", inputs: { image: await dataOf(blob) }, outputType: "dataURI", outputFormat: "PNG", includeCost: true },
    "removeBackground"
  );
  const uri = x.imageDataURI || (x.imageBase64Data && "data:image/png;base64," + x.imageBase64Data) || x.imageURL;
  if (!uri) throw new Error("오린 그림이 오지 않았어요");
  return real(await blobOf(uri), "image/png");
}
/** 합친 단체 표지(캔버스)를 아주 약하게 다시 그려 잇는다 → { blob, nsfw } */
export async function unify(final, cv) {
  const x = await infer(final, { seedImage: cv.toDataURL("image/jpeg", 0.93), strength: final.strength });
  return { blob: await real(await blobOf(x.imageDataURI), "image/webp"), nsfw: !!x.NSFWContent };
}
