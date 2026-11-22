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

/* 그림을 못 받아오는 경우(2026-11-23 사용자 제보): 잠깐 끊긴 연결·서버 쪽 오류·빈 응답은 조금 기다렸다 다시 건다(waits의 수만큼).
   키·잔액·문구 같은 오류는 다시 걸어도 같으니 바로 알린다. 응답이 limit을 넘게 안 오면 멈추고 알린다 — 이때는 다시 걸지 않는다
   (서비스 쪽에서는 그려졌을 수 있어 값이 두 번 나감. 모델을 새로 올릴 때 2분쯤 걸린 뒤 성공한 적이 있어 한도를 넉넉히 둠) */
export const retry = { waits: [2000, 6000], limit: 240000 };
const TRANSIENT = /failedModelLoad|inferenceError|timeout|unavailable|rateLimit|tooManyRequests|internal|provider|overload/i;
const fatal = (text) => Object.assign(new Error(text), { fatal: true });
/** 한 번 걸어 본다 → 응답 항목. 다시 걸어 볼 만한 실패는 그냥 던지고, 다시 걸어도 소용없는 실패는 fatal로 던진다 */
async function once(task, type) {
  const ctl = new AbortController(),
    timer = setTimeout(() => ctl.abort(), retry.limit);
  let r, d;
  try {
    r = await fetch(meta.mock ? "/mock" : "https://api.runware.ai/v1", {
      method: "POST",
      headers: { "content-type": "application/json", ...(meta.mock ? { "x-hs-art": "1" } : { authorization: "Bearer " + key() }) },
      body: JSON.stringify([task]),
      signal: ctl.signal
    });
    d = await r.json().catch(() => ({}));
  } catch (e) {
    if (ctl.signal.aborted) throw fatal(`생성 서비스의 응답이 ${Math.round(retry.limit / 60000)}분 넘게 오지 않아 멈췄어요 — 잠시 뒤 다시 눌러 주세요`);
    throw new Error("생성 서비스에 닿지 못했어요(인터넷 연결 확인)");
  } finally {
    clearTimeout(timer);
  }
  const e = (d.errors || [])[0];
  if (e) {
    const text = [e.code, e.message, e.parameter].filter(Boolean).join(" — ");
    throw TRANSIENT.test(String(e.code) + " " + String(e.message)) ? new Error(text) : fatal(text);
  }
  if (!r.ok) throw r.status >= 500 || r.status === 429 || r.status === 408 ? new Error("HTTP " + r.status) : fatal("HTTP " + r.status);
  // 응답의 taskType은 보낸 것과 다를 수 있다(배경 지우기 removeBackground는 imageBackgroundRemoval로 온다) → 보낸 taskUUID로 먼저 찾는다
  const x = (d.data || []).find((o) => o.taskUUID === task.taskUUID) || (d.data || []).find((o) => o.taskType === type);
  if (!x) throw new Error("그림이 오지 않았어요(빈 응답)");
  return x;
}
async function call(task, type) {
  for (let t = 0; ; t++) {
    try {
      const x = await once(task, type);
      spent.usd += x.cost || 0;
      return x;
    } catch (e) {
      if (e.fatal || t >= retry.waits.length) throw t && !e.fatal ? new Error(`${e.message} — ${t + 1}번 해 봤어요. 잠시 뒤 다시 눌러 주세요`) : e;
      task.taskUUID = crypto.randomUUID();
      await new Promise((res) => setTimeout(res, retry.waits[t]));
    }
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
export const toBlob = (cv, type = "image/webp", q = 0.9) =>
  new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error("그림으로 바꾸지 못했어요"))), type, q));

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
    {
      taskType: "removeBackground",
      taskUUID: crypto.randomUUID(),
      model: "runware:112@5",
      inputs: { image: await dataOf(blob) },
      outputType: "dataURI",
      outputFormat: "PNG",
      includeCost: true
    },
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
