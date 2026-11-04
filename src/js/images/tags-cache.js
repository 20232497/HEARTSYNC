/* 한글 → 영문 태그 번역 캐시(TAGS, KV "ponytags"). 번역 자체(ponyTags·koTags)는 tags.js — 캐시만 따로 둬서 번역 모듈이 없는 사용자 빌드에서도 읽어 둘 수 있게 */
export let TAGS = {};
export function setTags(v) { return (TAGS = v); }
