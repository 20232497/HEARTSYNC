// 모듈이 import 없이 써도 되는 이름: JS 내장과 브라우저 전역. 빌드(tools/build.mjs)가 "선언도 import도 안 된 이름" 검사에 씀.
// 앱 코드가 새 브라우저 API를 쓰면 여기에 더하기(없으면 빌드가 오타로 여겨 실패)
export const BROWSER_GLOBALS = new Set(
  `
Array ArrayBuffer BigInt Boolean DataView Date Error EvalError Float32Array Float64Array Function Infinity Int8Array Int16Array Int32Array Intl JSON Map Math NaN Number Object Promise Proxy
RangeError ReferenceError Reflect RegExp Set String Symbol SyntaxError TypeError URIError Uint8Array Uint8ClampedArray Uint16Array Uint32Array WeakMap WeakRef WeakSet
decodeURI decodeURIComponent encodeURI encodeURIComponent escape unescape eval globalThis isFinite isNaN parseFloat parseInt undefined queueMicrotask
window document navigator location history screen console fetch Request Response Headers FormData URL URLSearchParams Blob File FileReader FileList Image ImageBitmap createImageBitmap
HTMLElement HTMLImageElement HTMLCanvasElement HTMLInputElement HTMLTextAreaElement Element Node NodeList Event CustomEvent EventTarget KeyboardEvent MouseEvent TouchEvent PointerEvent
AbortController AbortSignal TextEncoder TextDecoder crypto indexedDB localStorage sessionStorage setTimeout clearTimeout setInterval clearInterval requestAnimationFrame cancelAnimationFrame requestIdleCallback
atob btoa alert confirm prompt open close getComputedStyle matchMedia MutationObserver ResizeObserver IntersectionObserver DecompressionStream CompressionStream ReadableStream WritableStream TransformStream
DOMParser XMLSerializer DOMException performance innerWidth innerHeight scrollX scrollY devicePixelRatio visualViewport CSS Audio OffscreenCanvas Path2D ImageData Worker WebSocket EventSource XMLHttpRequest
Notification self parent top frames origin isSecureContext caches
`
    .split(/\s+/)
    .filter(Boolean)
);
