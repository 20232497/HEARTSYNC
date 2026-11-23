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

/* 그림을 못 받아오는 경우(2026-11-23 사용자 제보 · Codex 검토 · 생성 서비스 문서 Task Polling·Errors·Rate Limits):
   ① 동기 요청은 120초까지만 기다리고, 그때까지 안 끝난 작업은 status: "processing"으로 돌아온다(모델을 새로 올릴 때 실제로 그랬다) → 같은 taskUUID로 getResponse를 조회해 결과를 받는다.
      다시 보내면 같은 그림을 두 번 사게 된다.
   ② 응답을 못 받았거나(연결 끊김·본문이 끊김) 응답에 그림이 없으면 접수됐는지 알 수 없다 → 다시 보내지 않고 같은 taskUUID로 조회해 되찾는다.
   ③ 다시 보내는 것은 서비스가 받지 않았다고 답했을 때뿐: HTTP 429·5xx, 다시 걸 만한 오류 코드(RETRY_CODE). 기다리는 시간은 서비스가 알려 준 값(retryAfter)이 먼저.
   ④ 키·잔액·문구 같은 오류(HTTP 400~404와 그 밖의 오류 코드)는 다시 걸어도 같으니 바로 알린다.
   한 작업을 기다리는 한도는 limit(처음 보낸 때부터). waits는 다시 보내기 전에, poll은 조회 사이에 기다리는 시간(마지막 값을 되풀이) */
export const retry = { waits: [2000, 6000], poll: [2000, 3000, 5000], limit: 240000 };
const RETRY_CODE = /^(serviceOverloaded|inferenceRateLimitExceeded|providerRateLimitExceeded|timeoutProvider|failedModelLoad|inferenceError)$/;
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
const fatal = (text) => Object.assign(new Error(text), { fatal: true });
/** 응답 항목의 그림 주소(없으면 빈 글) */
export const uriOf = (x) => (x && (x.imageDataURI || (x.imageBase64Data && "data:image/webp;base64," + x.imageBase64Data) || x.imageURL)) || "";
const mine = (list, task) => (list || []).filter((o) => o.taskUUID === task.taskUUID);

/** 요청 하나를 보내고 본문까지 읽는다 → { status, ok, after(서비스가 알려 준 기다릴 시간 ms), d }. 못 받으면 lost로 던진다(보냈는데 응답만 잃었을 수 있음) */
async function post(task, until) {
  const ctl = new AbortController(),
    timer = setTimeout(() => ctl.abort(), Math.max(1, until - Date.now()));
  try {
    const r = await fetch(meta.mock ? "/mock" : "https://api.runware.ai/v1", {
      method: "POST",
      headers: { "content-type": "application/json", ...(meta.mock ? { "x-hs-art": "1" } : { authorization: "Bearer " + key() }) },
      body: JSON.stringify([task]),
      signal: ctl.signal
    });
    const text = await r.text(); // 본문이 끊기면 아래 catch로(삼키지 않는다)
    let d = {};
    try {
      d = JSON.parse(text);
    } catch {
      /* JSON이 아닌 응답 — 아래에서 상태 코드로 본다 */
    }
    return { status: r.status, ok: r.ok, after: (+r.headers.get("retry-after") || 0) * 1000, d: d && typeof d === "object" ? d : {} };
  } catch {
    throw Object.assign(new Error(ctl.signal.aborted ? "생성 서비스의 응답이 한도 안에 오지 않았어요" : "생성 서비스와의 연결이 끊겼어요"), { lost: true });
  } finally {
    clearTimeout(timer);
  }
}
/** 응답을 읽는다 → { x } 그림이 온 항목 · { wait: true } 처리 중이거나 그림이 없음(조회로 기다릴 것). 오류는 던진다: fatal(다시 걸어도 같음) 또는 again(다시 보낼 만함 — after ms) */
function read(task, res) {
  const errs = res.d.errors || [],
    e = mine(errs, task)[0] || errs.find((x) => !x.taskUUID) || (res.ok ? null : errs[0]);
  if (e || !res.ok) {
    const text = e ? [e.code, e.message, e.parameter].filter(Boolean).join(" — ") : "HTTP " + res.status;
    const again = res.status === 429 || res.status >= 500 || !!(e && RETRY_CODE.test(String(e.code)));
    if (!again) throw fatal(text);
    throw Object.assign(new Error(text), { again: true, after: (e && e.retryAfter * 1000) || res.after || 0 });
  }
  const rows = mine(res.d.data, task),
    x = rows.find((o) => o.status !== "processing" && uriOf(o));
  return x ? { x } : { wait: true };
}
/** 같은 작업의 결과를 조회로 기다린다(getResponse) → 그림이 온 항목. 서비스가 그 작업을 모르거나 작업이 다시 걸 만한 오류로 끝났으면 null(다시 보내도 됨).
    서비스가 모르는 작업은 오류가 아니라 taskType이 "getResponse"인 '처리 중' 한 줄로 온다(2026-11-23 실제 호출로 확인 — 진짜 작업은 제 taskType으로 옴).
    막 보낸 요청이 조금 늦게 닿았을 수도 있으니 두 번 잇달아 그렇게 올 때만 받지 않은 것으로 본다 */
async function poll(task, until, why) {
  let unknown = 0;
  for (let i = 0; ; i++) {
    const left = until - Date.now();
    if (left <= 0)
      throw fatal(
        `${why} — ${Math.round(retry.limit / 60000)}분을 기다렸지만 그림이 오지 않아 멈췄어요. 서비스 쪽에서는 그려졌을 수 있어요(값이 나갔을 수 있음) — 잠시 뒤 다시 눌러 주세요`
      );
    await sleep(Math.min(left, retry.poll[Math.min(i, retry.poll.length - 1)]));
    let res;
    try {
      res = await post({ taskType: "getResponse", taskUUID: task.taskUUID }, until);
    } catch {
      continue; // 조회가 끊겼으면 한도까지 다시 조회
    }
    try {
      const out = read(task, res);
      if (out.x) return out.x;
      const rows = mine(res.d.data, task);
      if (rows.length && rows.every((o) => o.taskType === "getResponse")) {
        if (++unknown >= 2) return null;
      } else unknown = 0;
    } catch (e) {
      if (e.again || res.status === 404 || res.status === 400) return null; // 작업이 실패로 끝났거나(다시 걸 만함) 서비스가 그 작업을 모름 → 다시 보내도 두 번 그려지지 않는다
      throw e;
    }
  }
}
async function call(task) {
  const until = Date.now() + retry.limit;
  for (let t = 0; ; t++) {
    let x = null,
      why = "그림이 아직 그려지는 중이에요",
      after = 0;
    try {
      const out = read(task, await post(task, until));
      x = out.x || (await poll(task, until, why));
    } catch (e) {
      if (e.lost)
        x = await poll(task, until, (why = e.message)); // 접수됐는지 모름 → 같은 작업을 조회해 되찾는다
      else if (!e.again) throw e;
      else ((why = e.message), (after = e.after));
    }
    if (x) {
      spent.usd += x.cost || 0;
      return x;
    }
    // 여기까지 왔으면 서비스가 그 작업을 받지 않았거나 작업이 실패로 끝난 것 — 새 taskUUID로 다시 보낸다(waits의 수만큼)
    if (t >= retry.waits.length) throw new Error(`${why} — ${t + 1}번 해 봤어요. 잠시 뒤 다시 눌러 주세요`);
    await sleep(Math.min(Math.max(1, until - Date.now()), after || retry.waits[t]));
    task.taskUUID = crypto.randomUUID();
  }
}
const infer = (j, extra) =>
  call({
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
  });
/** 그림 주소(data URI나 서비스의 주소)를 blob으로 — 내려받지 못하면 까닭을 알린다 */
export const blobOf = async (uri) => {
  const r = await fetch(uri).catch(() => null);
  if (!r || !r.ok) throw new Error("받은 그림을 읽지 못했어요" + (r ? "(HTTP " + r.status + ")" : ""));
  return r.blob();
};
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
    seedImage = uriOf(g);
  }
  let x = await infer(j, seedImage ? { seedImage, strength: j.guide.strength } : {});
  nsfw = nsfw || !!x.NSFWContent;
  if (j.hires) {
    x = await infer(j, { seedImage: uriOf(x), strength: j.hires.strength, width: j.hires.w, height: j.hires.h });
    nsfw = nsfw || !!x.NSFWContent;
  }
  return { blob: await real(await blobOf(uriOf(x)), "image/webp"), nsfw };
}
/** 인물 그림의 배경을 지운다(Runware removeBackground — BiRefNet General, 한 장에 약 0.06센트) → PNG blob */
export async function removeBg(blob) {
  const x = await call({
    taskType: "removeBackground",
    taskUUID: crypto.randomUUID(),
    model: "runware:112@5",
    inputs: { image: await dataOf(blob) },
    outputType: "dataURI",
    outputFormat: "PNG",
    includeCost: true
  });
  return real(await blobOf(uriOf(x)), "image/png");
}
/** 합친 단체 표지(캔버스)를 아주 약하게 다시 그려 잇는다 → { blob, nsfw } */
export async function unify(final, cv) {
  const x = await infer(final, { seedImage: cv.toDataURL("image/jpeg", 0.93), strength: final.strength });
  return { blob: await real(await blobOf(uriOf(x)), "image/webp"), nsfw: !!x.NSFWContent };
}
