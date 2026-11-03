/* 이미지 슬롯 시트(인물·칸별 그림)와 조합 그림(감정 + 의상 + 장소) 갤러리·조합 만들기 */
import { audOf } from "../core/audience.js";
import { castLook } from "../core/cast.js";
import { normalizeChar } from "../core/character.js";
import { SIT } from "../core/constants.js";
import { S, hasRunwareKey } from "../core/state.js";
import { $, $$, esc, toast } from "../core/util.js";
import { DIM_NAMES, RESET, keyOf, parseCodes } from "../images/codes.js";
import { imagesOf, putCastImage } from "../images/pick.js";
import { buildPonyPrompt, lookIsMale, partsTags, savedParts } from "../images/prompt.js";
import { imgRating, ratingFieldHTML, setSheetRating, sheetRating } from "../images/rating.js";
import { genErr, runwareImage } from "../images/runware.js";
import { codeDefs, codeRating, keyName, knownCodes, sitDef, sitName, slotNums } from "../images/situations.js";
import { styleFor } from "../images/styles.js";
import { IMG, validRef } from "../services/images.js";
import { copyText } from "./chat/log.js";
import { artHTML } from "./cover.js";
import { genImageSheet } from "./gen-sheet.js";
import { ICON } from "./icons.js";
import { sheet } from "./sheet.js";
import { codeTableSheet, sitEditor, sitListSheet, sitPresetSheet } from "./sit-sheets.js";

export function openImageSlots(c, code) {
  c = normalizeChar(c);
  const mine = S.mine.find((m) => m.id === c.id);
  let cur = code && c.cast.some((x) => x.code === code) ? code : c.cast[0].code;
  const put = async (file, key, code = cur) => putCastImage(c, code, key, await IMG.put(file));
  const prompt = (cast, key) => buildPonyPrompt(cast, key, c);
  // 그림 수위: 기본 칸(0~14)은 이 작품의 시트 수위(기본 전체이용가), 직접 만든·내장 칸은 그 칸의 수위 — 조합이면 가장 높은 것
  const rating = (key) => imgRating(codeRating(parseCodes(String(key)), c));
  const ctxOf = (cast) => ({ kind: "daily", aud: audOf(c), male: lookIsMale(castLook(cast, c)) }); // 기본 화풍(자동): 작품 성향 → 인물 성별
  let live = null, bulk = null;
  const paint = () => {
    const cast = c.cast.find((x) => x.code === cur), slots = imagesOf(c)[cur] || {}, nums = slotNums();
    const combos = Object.keys(slots).filter((k) => validRef(slots[k]) && !nums.includes(+k)).sort((a, b) => a.localeCompare(b, "ko", { numeric: true })); // 세 자리 코드·조합 키
    const ov = sheet(`<div class="sheet-head"><h2>이미지 슬롯</h2><button class="icon-btn" data-x aria-label="닫기">${ICON.close}</button></div>
      <p class="sub">대화 속 장면마다 이 칸의 이미지가 보여요. 빈 칸은 프로필 이미지로 대신해요.${mine ? "" : " 이미지는 내 계정에만 저장돼요."}</p>
      <div class="casttabs chips">${c.cast.map((x) => `<button class="chip ${x.code === cur ? "on" : ""}" data-cc="${esc(x.code)}">${esc(x.name)} <small>${esc(x.code)}</small></button>`).join("")}</div>
      <div class="cta-row" style="margin:0 0 10px"><button class="btn sm pri" id="bulk">여러 장 한 번에 올리기</button><button class="btn sm" id="aiAll">${bulk ? "AI 채우기 멈추기" : "빈 칸 AI로 채우기"}</button><button class="btn sm" id="prompt">이미지 프롬프트 복사</button><button class="btn sm" id="addSit">+ 칸 추가</button><button class="btn sm" id="recSit">추천 칸</button><button class="btn sm" id="listSit">목록으로 추가</button><button class="btn sm" id="codes">코드 표</button><span class="note">파일 이름을 2.png처럼 칸 번호로, 조합은 3-404-501.png처럼 지으면 그 칸에 들어가요.</span></div>
      ${ratingFieldHTML("slotRt", sheetRating(c.id), "기본 칸(0~14) 그림 수위 — 직접 만든 칸은 그 칸의 수위로 만들어요")}
      <div class="slot-grid">${nums.map((i) => { const ref = validRef(slots[i]) ? slots[i] : null, d = sitDef(i); return `<div class="slot"><div class="pic${bulk && bulk.code === cur && bulk.at === i ? " busy" : ""}">${ref ? IMG.tag(ref) : artHTML(c, cast, i)}</div><span class="lb">${i} ${esc(sitName(i))}${d && d.rating !== "safe" ? " 🔞" : ""}${i === 0 ? " <small>첫 등장</small>" : ""}</span><div class="bs"><button data-up="${i}">${ref ? "바꾸기" : "올리기"}</button><button data-ai="${i}">AI</button>${ref ? `<button data-rm="${i}">삭제</button>` : ""}${d ? `<button data-ed="${i}">고치기</button>` : ""}</div></div>`; }).join("")}</div>
      <h3 class="lbl" style="margin:16px 0 6px">조합 그림 <small>감정 + 의상 + 장소</small></h3>
      <p class="note" style="margin:0 0 10px">대화 중 AI가 [[img:${esc(cur)}:3,404,501]]처럼 의상·장소 번호를 함께 쓰면 그 조합의 그림이 보여요. ${S.settings.autoImg ? "없는 조합은 대화 중 자동으로 만들어 여기에 쌓여요." : "없는 조합은 가까운 그림으로 대신해요. MY → 설정 → 이미지 생성에서 '대화 중 장면 그림 자동 생성'을 켜면 그때그때 만들어요."}</p>
      <div class="slot-grid">${combos.map((k) => `<div class="slot" data-combo="${esc(k)}"><div class="pic">${IMG.tag(slots[k])}</div><span class="lb">${esc(keyName(k))}<small>${esc(k)}</small></span><div class="bs"><button data-cup="${esc(k)}">바꾸기</button><button data-cai="${esc(k)}">AI</button><button data-crm="${esc(k)}">삭제</button></div></div>`).join("")}<div class="slot combo-add"><button class="btn sm" id="addCombo">+ 조합 만들기</button></div></div>
      <input type="file" id="one" accept="image/png,image/jpeg,image/webp" hidden><input type="file" id="many" accept="image/png,image/jpeg,image/webp" multiple hidden>
      <p class="note" style="margin-top:12px">AI 버튼은 설정의 Runware 키로 그려요. 같은 인물로 그리려면 작품의 '이미지 출연진' 외모를 자세히 적어 주세요.</p>`, "wide");
    live = ov; IMG.hydrate(ov);
    $$("[data-cc]", ov).forEach((b) => b.onclick = () => { cur = b.dataset.cc; paint(); });
    let target = "0";
    $$("[data-up],[data-cup]", ov).forEach((b) => b.onclick = () => { target = b.dataset.up || b.dataset.cup; $("#one", ov).click(); });
    $$("[data-rm],[data-crm]", ov).forEach((b) => b.onclick = () => { putCastImage(c, cur, b.dataset.rm || b.dataset.crm, null); paint(); });
    $$("[data-ai],[data-cai]", ov).forEach((b) => b.onclick = () => {
      const key = b.dataset.ai || b.dataset.cai, code = cur;
      genImageSheet({ title: `${cast.name} · ${keyName(key)}`, parts: savedParts(c, cast, key), save: { c, cast, i: key }, aspect: "4:5", rating: rating(key), ctx: ctxOf(cast),
        onUse: async (blob) => { await put(blob, key, code); if (live?.isConnected) paint(); toast("이미지를 등록했어요"); } });
    });
    $$("[data-ed]", ov).forEach((b) => b.onclick = () => sitEditor(sitDef(+b.dataset.ed), paint));
    const rs = $("#slotRt", ov); if (rs) rs.onchange = () => setSheetRating(c.id, rs.value);
    $("#addSit", ov).onclick = () => sitEditor(null, paint);
    $("#recSit", ov).onclick = () => sitPresetSheet(paint);
    $("#listSit", ov).onclick = () => sitListSheet(paint);
    $("#codes", ov).onclick = () => codeTableSheet(paint);
    $("#addCombo", ov).onclick = () => comboSheet(c, cast, paint);
    $("#aiAll", ov).onclick = async () => {
      if (bulk) { bulk.stop = true; return; }
      if (!hasRunwareKey()) { toast(genErr({ code: "no_key" })); return; }
      const code = cur, ca = cast, todo = slotNums().filter((i) => !validRef((imagesOf(c)[code] || {})[i]));
      if (!todo.length) { toast("빈 칸이 없어요"); return; }
      bulk = { code, at: -1, stop: false }; let ok = 0, err = null;
      for (const i of todo) {
        if (bulk.stop) break;
        bulk.at = i; if (live?.isConnected) paint(); toast(`AI로 채우는 중… ${ok + 1}/${todo.length}`);
        try { const rt = rating(i); await put(await runwareImage(await partsTags(savedParts(c, ca, i), rt !== "safe"), { aspect: "4:5", rating: rt, style: styleFor(ctxOf(ca)) }), i, code); ok++; }
        catch (e) { err = e; if (["no_key", "bad_key", "no_funds", "bad_model", "network", "rate_limited", "minor_block"].includes(e?.code)) break; }
      }
      const stopped = bulk.stop; bulk = null; if (live?.isConnected) paint();
      toast(`${ok}장 만들었어요${stopped ? " (멈춤)" : err ? ` · ${genErr(err)}` : ""}`);
    };
    $("#one", ov).onchange = async (e) => { const f = e.target.files[0]; if (!f) return; toast("올리는 중…"); try { await put(f, target); paint(); toast("이미지를 등록했어요"); } catch { toast("이미지를 읽지 못했어요. PNG·JPG로 다시 올려 주세요."); } };
    $("#bulk", ov).onclick = () => $("#many", ov).click();
    $("#many", ov).onchange = async (e) => {
      const files = [...e.target.files]; let ok = 0, skip = 0; toast(files.length + "장을 올리는 중…");
      for (const f of files) {
        // 파일 이름 끝의 번호(2, ks_3, 3-404-501 …) → 조합 키. 모르는 번호가 섞여 있으면 건너뜀
        const base = f.name.replace(/\.[^.]+$/, "").toLowerCase(), m = base.match(/(\d{1,3}(?:[-,]\d{1,3})*)$/);
        const codes = m ? parseCodes(m[1].replace(/-/g, ",")) : [];
        if (!codes.length || knownCodes(codes).length !== codes.length || (codes.length === 1 && codes[0] < 100 && !slotNums().includes(codes[0]))) { skip++; continue; }
        try { await put(f, keyOf(codes)); ok++; } catch { skip++; }
      }
      paint(); toast(`${ok}장 등록${skip ? `, ${skip}장은 번호를 알 수 없어 건너뛰었어요` : ""}`);
    };
    $("#prompt", ov).onclick = () => { const keys = [...slotNums(), ...combos]; copyText(keys.map((k) => `${k} ${keyName(k)}: ${prompt(cast, k)}`).join("\n"), `${keys.length}칸 프롬프트를 복사했어요`); };
  };
  paint();
}
/* 조합 만들기: 감정/행동 · 의상 · 장소를 골라 그 조합의 그림을 AI로 만들거나 올림(슬롯 시트 위에 겹쳐 뜸) */
function comboSheet(c, cast, after) {
  const defs = codeDefs(), label = (d) => `${d.n} ${d.name}${d.rating !== "safe" ? " 🔞" : ""}`;
  const opt = (list, cur) => list.map(([v, l]) => `<option value="${esc(String(v))}" ${String(v) === String(cur) ? "selected" : ""}>${esc(l)}</option>`).join("");
  const acts = [...SIT.map((s, i) => [i, `${i} ${s}`]), ...defs.filter((d) => d.dim === "act").map((d) => [d.n, label(d)])];
  const wears = [["", "설정대로"], ...defs.filter((d) => d.dim === "wear" && d.n !== RESET.wear).map((d) => [d.n, label(d)])];
  const places = [["", "자동"], ...defs.filter((d) => d.dim === "place" && d.n !== RESET.place).map((d) => [d.n, label(d)])];
  const ov = document.createElement("div"); ov.className = "overlay gen-ov";
  ov.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="sheet-head"><h2>조합 만들기 · ${esc(cast.name)}</h2><button class="icon-btn" data-x aria-label="닫기">${ICON.close}</button></div>
    <p class="sub" style="margin-top:0">고른 조합의 그림을 만들어 두면 대화에서 그 조합이 나올 때 바로 보여요.</p>
    <div class="field"><label for="cbA">${DIM_NAMES.act}</label><select id="cbA">${opt(acts, 1)}</select></div>
    <div class="two"><div class="field"><label for="cbW">${DIM_NAMES.wear}</label><select id="cbW">${opt(wears, "")}</select></div><div class="field"><label for="cbP">${DIM_NAMES.place}</label><select id="cbP">${opt(places, "")}</select></div></div>
    <p class="note" id="cbKey"></p>
    <input type="file" id="cbFile" accept="image/png,image/jpeg,image/webp" hidden>
    <div class="cta-row"><button class="btn" id="cbUp">그림 올리기</button><span class="spacer"></span><button class="btn ghost" data-x>닫기</button><button class="btn pri" id="cbAi">AI로 그리기</button></div></div>`;
  document.body.append(ov);
  const close = () => ov.remove();
  ov.addEventListener("click", (e) => { if (e.target === ov || e.target.closest("[data-x]")) close(); });
  const key = () => keyOf([+$("#cbA", ov).value, +$("#cbW", ov).value || null, +$("#cbP", ov).value || null].filter((n) => n !== null));
  const show = () => { const k = key(); $("#cbKey", ov).textContent = `[[img:${cast.code}:${k}]] · ${keyName(k)}`; };
  ["#cbA", "#cbW", "#cbP"].forEach((s) => $(s, ov).onchange = show); show();
  const saved = async (blob, k) => { putCastImage(c, cast.code, k, await IMG.put(blob)); close(); after && after(); toast("조합 그림을 등록했어요"); };
  $("#cbAi", ov).onclick = () => { const k = key(); genImageSheet({ title: `${cast.name} · ${keyName(k)}`, parts: savedParts(c, cast, k), save: { c, cast, i: k }, aspect: "4:5", rating: imgRating(codeRating(parseCodes(k), c)), ctx: { kind: "daily", aud: audOf(c), male: lookIsMale(castLook(cast, c)) }, onUse: (blob) => saved(blob, k) }); };
  $("#cbUp", ov).onclick = () => $("#cbFile", ov).click();
  $("#cbFile", ov).onchange = async (e) => { const f = e.target.files[0]; if (!f) return; toast("올리는 중…"); try { await saved(f, key()); } catch { toast("이미지를 읽지 못했어요. PNG·JPG로 다시 올려 주세요."); } };
}
