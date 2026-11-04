/* 커뮤니티 공개(claude.ai db만): 내 공개 작품 올리기(publishCommunity), 받은 작품 정리(cleanChar), 구독(watchCommunity → "community" 이벤트) */
import { AUDS } from "../core/audience.js";
import { CATS, MOTIFS, PALETTES } from "../core/constants.js";
import { emit } from "../core/events.js";
import { minorFlags } from "../core/safety.js";
import { DB, S } from "../core/state.js";
import { KV } from "../core/storage.js";
import { toast } from "../core/util.js";
import { pubImages, pubLore, validRef } from "./images.js";
/** @typedef {import("../core/types.js").Work} Work */

/* 커뮤니티: pub/<내 id> 문서 하나에 내 공개 캐릭터를 모아 둔다 (모두 읽기, 본인만 쓰기) */
/** 내 공개 작품을 claude.ai db의 pub/<내 id> 문서 하나로(없으면 문서 삭제). claude.ai 밖에서는 아무 일도 안 함. @returns {Promise<void>} */
export async function publishCommunity() {
  if (!DB || !KV.uid) return;
  const pubs = S.mine.filter((m) => m.publish).map((m) => ({ ...m, img: typeof m.img === "string" && m.img.startsWith("kv:") ? "" : m.img, images: pubImages(m.images), loreImages: pubLore(m.loreImages), creator: S.profile.nick || "익명 크리에이터" }));
  try { if (pubs.length) await DB.doc("pub/" + KV.uid).set({ chars: pubs, at: Date.now() }); else await DB.doc("pub/" + KV.uid).delete(); }
  catch { if (pubs.length) toast("커뮤니티 공개는 이 페이지에 참여 권한이 있는 사람만 할 수 있어요. 캐릭터는 내 보관함에 저장됐어요."); }
}
/* 다른 사람이 올린 작품을 믿지 않고 정리: 길이 제한, 허용 값만, kv: 그림(남의 기기에만 있음)은 버림, 미성년 인물이면 통째로 버림 */
/** @param {unknown} c 다른 사람이 올린 작품 @returns {Work|null} 정리한 작품, 믿을 수 없거나 미성년 인물이면 null */
export function cleanChar(c) {
  if (!c || typeof c !== "object") return null;
  const s = (x, n) => typeof x === "string" ? x.slice(0, n) : "";
  if (!/^u[a-z0-9]+$/.test(s(c.id, 40)) || !c.name || !Array.isArray(c.openings) || !c.openings.length) return null;
  const fields = Array.isArray(c.fields) ? c.fields.map((f) => s(f, 12)).filter(Boolean).slice(0, 16) : ["호감도"];
  const gauge = s(c.gauge, 12) || fields[0];
  const cast = Array.isArray(c.cast) ? c.cast.slice(0, 12).map((x) => ({ code: s(x?.code, 8).toLowerCase().replace(/[^a-z0-9]/g, ""), name: s(x?.name, 16), look: s(x?.look, 200), ...(x?.tags ? { tags: s(x.tags, 300) } : {}) })).filter((x) => x.code && x.name) : [];
  const cleanStatus = (st) => Object.fromEntries(Object.entries(st && typeof st === "object" ? st : {}).slice(0, 20)
    .filter(([, v]) => (typeof v === "number" && Number.isFinite(v)) || typeof v === "string").map(([k, v]) => [s(k, 12), typeof v === "string" ? v.slice(0, 200) : v]));
  const out = { id: c.id, name: s(c.name, 16), title: s(c.title, 24), oneLiner: s(c.oneLiner, 70), cat: CATS.includes(c.cat) ? c.cat : "일상", aud: AUDS[c.aud] ? c.aud : "",
    tags: Array.isArray(c.tags) ? c.tags.map((t) => s(t, 12)).slice(0, 5) : [], glyph: s(c.glyph, 1), pal: PALETTES[c.pal] ? c.pal : 0, motif: MOTIFS[c.motif] ? c.motif : "glow",
    img: validRef(c.img) && !String(c.img).startsWith("kv:") ? c.img : "", images: pubImages(c.images), loreImages: pubLore(c.loreImages), world_mode: !!c.world_mode,
    desc: s(c.desc, 600), persona: s(c.persona, 3000), world: s(c.world, 2500), speech: s(c.speech, 800), secret: s(c.secret, 200),
    fields: fields.includes(gauge) ? fields : [gauge, ...fields], gauge, cast: cast.length ? cast : [{ code: "c", name: s(c.name, 16), look: "" }],
    lore: Array.isArray(c.lore) ? c.lore.slice(0, 40).map((e) => ({ keys: Array.isArray(e?.keys) ? e.keys.map((k) => s(k, 20)).filter(Boolean).slice(0, 6) : [], text: s(e?.text, 400) })).filter((e) => e.keys.length && e.text) : [], creator: s(c.creator, 20) || "익명 크리에이터",
    openings: c.openings.slice(0, 6).map((o) => ({ title: s(o?.title, 30), text: s(o?.text, 3000), directive: s(o?.directive, 300), status: cleanStatus(o?.status) })).filter((o) => o.text) };
  return out.openings.length && !minorFlags(out).length ? out : null;
}
/** pub/ 컬렉션을 구독해 S.community를 채우고 "community" 이벤트. @returns {void} */
export function watchCommunity() {
  if (!DB) return;
  DB.collection("pub").limit(200).onSnapshot((snap) => {
    const list = [];
    snap.docs.forEach((doc) => { const arr = doc.data()?.chars; if (Array.isArray(arr)) arr.slice(0, 20).forEach((c) => { const cc = cleanChar(c); if (cc && cc.openings.length) list.push(cc); }); });
    S.community = list;
    emit("community");
  }, () => {});
}
