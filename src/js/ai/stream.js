/* AI 응답 스트림 읽기: SSE 줄 읽기(readSSE)와 공급자별 조각 해석(anthropicEvent·openaiEvent) — 순수 함수라 단위 테스트가 그대로 import */
/**
 * @typedef {{ delta?: string, stop?: string, category?: string|null, failed?: boolean }} StreamPart 조각 하나의 뜻 — delta 더할 글, stop 끝난 이유(거절은 "refusal"), category
 * 거절 분류, failed 스트림 안의 오류
 */

/**
 * SSE 본문을 끝까지 읽어 `data:` 줄의 JSON마다 onData. 읽을 수 없는 줄과 onData 안의 오류는 넘어감(조각 하나가 깨져도 스트림은 계속).
 * @param {ReadableStream<Uint8Array>} body
 * @param {(ev: any) => void} onData
 * @param {() => void} [onChunk] data 줄이 올 때마다(멈춤 시간 제한을 다시 셈) — 주석 줄(": …" keep-alive)만 오는 동안은 부르지 않아, 답 없이 연결만 붙들린 스트림이 시간 제한에 걸림
 * @returns {Promise<void>}
 */
export async function readSSE(body, onData, onChunk) {
  const reader = body.getReader(),
    dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      onChunk && onChunk();
      try {
        onData(JSON.parse(line.slice(5)));
      } catch {}
    }
  }
}
/** Anthropic Messages 스트림의 이벤트 하나. 답을 보내던 중의 오류 조각(type "error" — 과부하 등)은 failed. @param {any} ev @returns {StreamPart} */
export function anthropicEvent(ev) {
  if (ev.type === "error") return { failed: true };
  if (ev.type === "content_block_delta" && ev.delta && ev.delta.text) return { delta: ev.delta.text };
  if (ev.type === "message_delta" && ev.delta && ev.delta.stop_reason) {
    const d = ev.delta.stop_details || ev.stop_details;
    return { stop: ev.delta.stop_reason, category: d && d.category !== undefined ? d.category : null };
  }
  return {};
}
/** OpenAI 호환 chat completions 스트림의 조각 하나(서버 대화 관문이 중계하는 모양). 내용 필터로 끝나면 거절로 봄. @param {any} ev @returns {StreamPart} */
export function openaiEvent(ev) {
  if (ev.error) return { failed: true };
  const c = ev.choices && ev.choices[0],
    out = {};
  if (!c) return out;
  if (c.delta && typeof c.delta.content === "string" && c.delta.content) out.delta = c.delta.content;
  if (c.finish_reason === "error") out.failed = true;
  else if (c.finish_reason) out.stop = c.finish_reason === "content_filter" ? "refusal" : c.finish_reason;
  return out;
}
