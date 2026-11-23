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

/* 그림을 못 받아오는 경우(2026-11-23 사용자 제보 · Codex 검토 두 번 · 생성 서비스 문서 Task Polling·Errors·Rate Limits):
   ① 동기 요청은 120초까지만 기다리고, 그때까지 안 끝난 작업은 status: "processing"으로 돌아온다(모델을 새로 올릴 때 실제로 그랬다) → 같은 taskUUID로 getResponse를 조회해 결과를 받는다.
      다시 보내면 같은 그림을 두 번 사게 된다 — 접수가 확인된 작업은 어떤 경우에도 다시 보내지 않는다.
   ② 응답을 못 받았거나(연결 끊김·본문이 끊김·본문 없는 5xx) 응답에 그림이 없으면 접수됐는지 알 수 없다 → 다시 보내지 않고 같은 taskUUID로 조회한다.
      서비스가 모르는 작업은 오류가 아니라 taskType이 "getResponse"인 '처리 중' 한 줄로 온다(실제 호출로 확인 — 진짜 작업은 제 taskType으로 옴).
      접수가 확인된 적이 없고 두 번 잇달아 그렇게 오면 받지 않은 것으로 보고 다시 보낸다(막 보낸 요청이 늦게 닿는 드문 경우에는 두 번 그려질 수 있음 — 끊길 때마다 몇 분씩 기다리게 하지 않으려는 선택).
   ③ 바로 다시 보내는 것은 서비스가 받지 않았거나 작업이 실패로 끝났다고 답했을 때뿐: HTTP 429, 그 작업의 오류 코드가 RETRY_CODE일 때. 기다리는 시간은 서비스가 알려 준 값(retryAfter)이 먼저.
   ④ 키·잔액·문구 같은 오류(HTTP 400~404, 그 밖의 오류 코드)는 다시 걸어도 같으니 바로 알린다. 조회 요청 자체의 실패(429·5xx)는 작업의 결과가 아니므로 다시 조회한다.
   waits: 다시 보내기 전에 기다리는 시간(그 수만큼만 다시 보냄) · poll: 조회 사이(마지막 값을 되풀이) · post: 요청 하나의 응답을 기다리는 한도
   · limit: 조회로 기다리는 한도(조회를 시작한 때부터) · hold: 서비스가 이보다 오래 기다리라고 하면 그 회차를 끝냄 */
export const retry = { waits: [2000, 6000], poll: [2000, 3000, 5000], post: 150000, limit: 300000, hold: 60000 };
const RETRY_CODE = /^(serviceOverloaded|inferenceRateLimitExceeded|providerRateLimitExceeded|timeoutProvider|failedModelLoad|inferenceError)$/;
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
const fatal = (text) => Object.assign(new Error(text), { fatal: true });
const textOf = (e) => [e.code, e.message, e.parameter].filter(Boolean).join(" — ");
/** 응답 항목의 그림 주소(없으면 빈 글) */
export const uriOf = (x) => (x && (x.imageDataURI || (x.imageBase64Data && "data:image/webp;base64," + x.imageBase64Data) || x.imageURL)) || "";
const mine = (list, task) => (list || []).filter((o) => o.taskUUID === task.taskUUID);

/** 요청 하나를 보내고 본문까지 읽는다 → { status, ok, after(서비스가 알려 준 기다릴 시간 ms), d }. 못 받으면 lost로 던진다(보냈는데 응답만 잃었을 수 있음) */
async function post(task, ms) {
  const ctl = new AbortController(),
    timer = setTimeout(() => ctl.abort(), Math.max(1, ms));
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
      /* JSON이 아닌 응답 — 상태 코드로 본다 */
    }
    return { status: r.status, ok: r.ok, after: (+r.headers.get("retry-after") || 0) * 1000, d: d && typeof d === "object" ? d : {} };
  } catch {
    throw Object.assign(new Error(ctl.signal.aborted ? "생성 서비스의 응답이 한도 안에 오지 않았어요" : "생성 서비스와의 연결이 끊겼어요"), { lost: true });
  } finally {
    clearTimeout(timer);
  }
}
/** 그림을 보낸 요청의 응답을 읽는다 → { x } 그림이 옴 · { again, why, after } 받지 않았거나 실패로 끝남(다시 보내도 됨)
    · { wait, accepted, why } 처리 중이거나 접수 여부를 모름(조회할 것). 다시 걸어도 같은 오류는 fatal로 던진다 */
function read(task, res) {
  const errs = res.d.errors || [],
    e = mine(errs, task)[0] || errs.find((x) => !x.taskUUID);
  if (e) {
    if (!RETRY_CODE.test(String(e.code))) throw fatal(textOf(e));
    return { again: true, why: textOf(e), after: e.retryAfter * 1000 || res.after || 0 };
  }
  if (res.status === 429) return { again: true, why: "HTTP 429", after: res.after }; // 받지 않았다는 답(문서)
  if (!res.ok) {
    if (res.status < 500) throw fatal(errs[0] ? textOf(errs[0]) : "HTTP " + res.status);
    return { wait: true, why: "HTTP " + res.status }; // 본문 없는 5xx — 접수됐는지 모른다
  }
  const rows = mine(res.d.data, task),
    x = rows.find((o) => o.status !== "processing" && uriOf(o));
  if (x) return { x };
  return {
    wait: true,
    accepted: rows.some((o) => o.taskType !== "getResponse"),
    why: rows.length ? "그림이 아직 그려지는 중이에요" : "그림이 오지 않았어요(빈 응답)"
  };
}
/** 같은 작업의 결과를 조회로 기다린다(getResponse) → 그림이 온 항목. null이면 다시 보내도 된다(작업이 다시 걸 만한 오류로 끝났거나, 접수된 적이 없고 서비스도 그 작업을 모름) */
async function poll(task, why, accepted) {
  const until = Date.now() + retry.limit;
  for (let i = 0, unknown = 0; ; i++) {
    const left = until - Date.now();
    if (left <= 0)
      throw fatal(
        `${why} — ${Math.round(retry.limit / 60000)}분을 기다렸지만 그림이 오지 않아 멈췄어요. 서비스 쪽에서는 그려졌을 수 있어요(값이 나갔을 수 있음) — 잠시 뒤 다시 눌러 주세요`
      );
    await sleep(Math.min(left, retry.poll[Math.min(i, retry.poll.length - 1)]));
    let res;
    try {
      res = await post({ taskType: "getResponse", taskUUID: task.taskUUID }, Math.min(retry.post, Math.max(1, until - Date.now())));
    } catch {
      continue; // 조회가 끊겼으면 한도까지 다시 조회
    }
    const e = mine(res.d.errors, task).find((x) => x.taskType !== "getResponse");
    if (e) {
      if (RETRY_CODE.test(String(e.code))) return null; // 그 작업이 다시 걸 만한 오류로 끝났다
      throw fatal(textOf(e));
    }
    if ([401, 402, 403].includes(res.status)) throw fatal("HTTP " + res.status);
    if (!res.ok) continue; // 조회 요청 자체의 실패(429·5xx 등)는 작업의 결과가 아니다 → 다시 조회
    const rows = mine(res.d.data, task),
      x = rows.find((o) => o.status !== "processing" && uriOf(o));
    if (x) return x;
    if (rows.some((o) => o.taskType !== "getResponse")) ((accepted = true), (unknown = 0));
    else if (!accepted && ++unknown >= 2) return null;
  }
}
async function call(task) {
  for (let t = 0; ; t++) {
    let out;
    try {
      out = read(task, await post(task, retry.post));
    } catch (e) {
      if (!e.lost) throw e;
      out = { wait: true, why: e.message }; // 접수됐는지 모름 → 같은 작업을 조회해 되찾는다
    }
    const x = out.x || (out.wait ? await poll(task, out.why, !!out.accepted) : null);
    if (x) {
      spent.usd += x.cost || 0;
      return x;
    }
    // 여기까지 왔으면 서비스가 그 작업을 받지 않았거나 작업이 실패로 끝난 것 — 새 taskUUID로 다시 보낸다(waits의 수만큼)
    if (t >= retry.waits.length) throw new Error(`${out.why} — ${t + 1}번 해 봤어요. 잠시 뒤 다시 눌러 주세요`);
    const hold = out.after || retry.waits[t];
    if (hold > retry.hold) throw new Error(`${out.why} — 생성 서비스가 ${Math.ceil(hold / 1000)}초 뒤에 다시 하라고 해요. 그때 다시 눌러 주세요`);
    await sleep(hold);
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
  const ctl = new AbortController(),
    timer = setTimeout(() => ctl.abort(), 60000); // 내려받기가 멈추면 칸이 끝없이 '그리는 중'으로 남는다
  try {
    const r = await fetch(uri, { signal: ctl.signal });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.blob();
  } catch (e) {
    throw new Error("받은 그림을 읽지 못했어요(" + (ctl.signal.aborted ? "내려받기가 멈춤" : (e && e.message) || e) + ")");
  } finally {
    clearTimeout(timer);
  }
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
