/* 본문 서식(fmt·fmtLine)·상태창(statusBlock)·스트리밍 표시(liveFill) */
import { clamp, esc, num } from "../../core/util.js";
import { imgTags } from "../../images/pick.js";
import { gaugeView } from "./view.js";
import { figHTML } from "../cover.js";

export function barPct(v) {
  if (typeof v === "number") return clamp(v, 0, 100);
  if (typeof v !== "string") return null;
  let m = v.match(/^\s*(\d[\d,]*)\s*\/\s*(\d[\d,]*)\s*$/);
  if (m) { const a = +m[1].replace(/,/g, ""), b = +m[2].replace(/,/g, ""); return b > 0 ? clamp(a / b * 100, 0, 100) : null; }
  m = v.match(/^\s*(\d{1,3})(\.\d+)?\s*%\s*$/); if (m) return clamp(+m[1], 0, 100);
  return null;
}
function firstNum(v) { if (typeof v === "number") return v; const m = String(v).match(/-?\d[\d,]*/); return m ? +m[0].replace(/,/g, "") : null; }
export function statusBlock(c, s, prev, { open = false, live = false } = {}) {
  if (!s || !Object.keys(s).length) return "";
  const rows = c.fields.filter((f) => s[f] !== undefined && s[f] !== "").map((f) => {
    const raw = s[f]; let val;
    const pct = barPct(raw);
    if (f.includes("속마음")) val = `<span class="inner ${live ? "" : "open"}" tabindex="0" title="눌러서 속마음 보기">${esc(raw)}</span>`;
    else if (pct !== null) {
      const a = firstNum(raw), b = prev && prev[f] !== undefined ? firstNum(prev[f]) : null, d = a !== null && b !== null ? a - b : 0;
      val = `<span class="bar"><i><b style="width:${pct}%"></b></i>${esc(raw)}${d ? `<span class="dl ${d > 0 ? "up" : "down"}">${d > 0 ? "▲" + num(d) : "▼" + num(-d)}</span>` : ""}</span>`;
    } else val = esc(raw);
    return `<div class="st-row ${String(raw).length > 26 ? "wide" : ""}"><dt>${esc(f)}</dt><dd>${val}</dd></div>`;
  });
  if (!rows.length) return "";
  const g = gaugeView(c, s);
  return `<details class="stat" ${open ? "open" : ""}><summary>상태창${g ? ` · ${esc(c.gauge)} ${esc(g.text)}` : ""}</summary><dl class="status">${rows.join("")}</dl></details>`;
}
function inline(s) {
  let html = "", last = 0, m; const re = /(\*[^*]+\*)|("[^"]*"|“[^”]*”)/g;
  while ((m = re.exec(s))) {
    if (m.index > last) html += esc(s.slice(last, m.index));
    html += m[1] ? `<span class="narr">${esc(m[1].slice(1, -1))}</span>` : `<span class="dlg">${esc(m[2])}</span>`;
    last = re.lastIndex;
  }
  return html + esc(s.slice(last));
}
function fmtLine(line, names) {
  if (/^\[[^\[\]]+\](\s*\[[^\[\]]+\])*$/.test(line)) return `<p class="sys">${line.match(/\[[^\[\]]+\]/g).map((g) => esc(g.slice(1, -1))).join("<br>")}</p>`;
  const sp = line.match(/^([^\s:*"“\[]{1,14}(?: [^\s:*"“\[]{1,10})?)\s*:\s*(.+)$/);
  if (sp && names.has(sp[1])) return `<p><b class="spk">${esc(sp[1])}</b>${inline(sp[2])}</p>`;
  return `<p class="${/^\s*\*[^*]+\*\s*$/.test(line) ? "narr" : ""}">${inline(line)}</p>`;
}
export function fmt(text, c, persona) {
  const names = new Set([c.name, persona?.name, ...(c.cast || []).map((x) => x.name)].filter(Boolean));
  // 글 없이 이어진 그림(여러 인물)은 한 줄(.scene-row)로 나란히
  const out = []; let row = [];
  const flush = () => { if (row.length > 1) out.push(`<div class="scene-row">${row.join("")}</div>`); else if (row.length) out.push(row[0]); row = []; };
  for (const raw of String(text).split(/\n+/)) {
    const line = raw.trim(); if (!line) continue;
    let buf = "";
    for (const part of line.split(/(\[\[img:[a-z0-9]+:\d{1,2}\]\])/i)) {
      const m = part.match(/^\[\[img:([a-z0-9]+):(\d{1,2})\]\]$/i);
      if (m) { if (buf.trim()) { flush(); out.push(fmtLine(buf.trim(), names)); buf = ""; } const f = figHTML(c, m[1].toLowerCase(), +m[2]); if (f) row.push(f); }
      else buf += part;
    }
    if (buf.trim()) { flush(); out.push(fmtLine(buf.trim(), names)); }
  }
  flush();
  return out.join("");
}
/* 스트리밍 표시: 끝난 줄은 한 번만 서식을 입혀 붙이고(살짝 나타남), 쓰는 중인 줄은 열린 *·" 를 임시로 닫아 처음부터 서식대로 보여 줌 */
function closeOpen(line) {
  const st = [];
  for (const ch of line) {
    if (ch === "*" || ch === '"') { if (st[st.length - 1] === ch) st.pop(); else st.push(ch); }
    else if (ch === "“") st.push("”");
    else if (ch === "”" && st[st.length - 1] === "”") st.pop();
  }
  let out = line + st.reverse().join("");
  if (/^\s*\[(?!\[)[^\]]*$/.test(out)) out += "]";
  return out;
}
export function liveFill(el, text, c, persona, anim = true) {
  let done = el.querySelector(".lv-done"), cur = el.querySelector(".lv-cur");
  if (!done) { el.innerHTML = `<div class="lv-done"></div><div class="lv-cur"></div>`; done = el.firstChild; cur = el.lastChild; el.dataset.n = "0"; }
  const lines = text.split("\n"), last = lines.pop(), n = +(el.dataset.n || 0);
  if (lines.length < n) { el.innerHTML = ""; return liveFill(el, text, c, persona, anim); } // 글이 처음부터 다시 오면(깨진 응답을 다시 쓸 때) 비우고 새로
  el.classList.toggle("many-img", imgTags(text).length >= 2);
  if (lines.length > n) {
    const before = done.children.length;
    done.insertAdjacentHTML("beforeend", fmt(lines.slice(n).join("\n"), c, persona));
    if (anim) [...done.children].slice(before).forEach((x) => x.classList.add("lv-new"));
    el.dataset.n = String(lines.length);
  }
  // 이름만 쓰인 상태(곧 "이름: 대사"가 될 수 있음)는 잠깐 숨겨 서식이 바뀌어 보이지 않게
  cur.innerHTML = /^[^\s:*"“\[]{1,14}$/.test(last.trim()) ? "" : fmt(closeOpen(last), c, persona);
}
