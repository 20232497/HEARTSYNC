/* ---------------------------------------------------------------- 스토어 */
const PACKS = [
  { id: "h100", n: 100, bonus: 0, price: 1900 },
  { id: "h300", n: 300, bonus: 30, price: 4900 },
  { id: "h1000", n: 1000, bonus: 150, price: 14900, best: true },
  { id: "h3000", n: 3000, bonus: 600, price: 39000 }
];
const PLUS = { id: "plus", name: "HEART SYNC+ 1개월", price: 9900 };
function buyPack(id, after) { const p = PACKS.find((x) => x.id === id); checkout({ id: p.id, name: "하트 " + num(p.n + p.bonus) + "개", price: p.price, hearts: p.n + p.bonus }, after); }
function viewStore() {
  const v = $("#view"), pro = isPro(), story = listPrice("story", "mid", 10);
  const cell = (k, len) => { const l = listPrice(k, len, 10); return k === "lite" ? (len === "long" ? "♥" + l : "♥" + l) : "♥" + l; };
  v.innerHTML = `<div class="page">${topbar()}
    <h1 class="sec" style="margin-top:4px">스토어</h1>
    <div class="statline">
      <div class="box"><h3>오늘 무료 턴</h3><b>${pro ? "무제한" : freeLeft() + " / " + FREE_DAILY}</b><span class="note">라이트 모델 · 매일 자정에 다시 채워져요</span></div>
      <div class="box"><h3>보유 하트</h3><b>♥ ${num(S.wallet.hearts)}</b><span class="note">스토리 모델 약 ${Math.floor(S.wallet.hearts / (pro ? Math.ceil(story / 2) : story))}턴</span></div>
      <div class="box"><h3>요금제</h3><b>${pro ? "PLUS" : "무료"}</b><span class="note">${pro ? new Date(S.wallet.pro.until).toLocaleDateString("ko-KR") + "까지" : "기본 요금제"}</span></div>
    </div>

    <h2 class="sec">한 턴에 얼마나 드나요? <small>기억력 10턴 기준 · 10턴 늘 때마다 스토리 +♥1, 마스터 +♥2</small></h2>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>모델</th><th class="num">적게</th><th class="num">보통</th><th class="num">많게</th><th class="num plus">PLUS</th></tr></thead><tbody>
      <tr><td><b>라이트</b> <span class="pill ok">매일 ${FREE_DAILY}턴 무료</span><div class="note">빠르고 가벼운 일상 대화</div></td><td class="num">${cell("lite", "short")}</td><td class="num">${cell("lite", "mid")}</td><td class="num">${cell("lite", "long")}</td><td class="num plus">무제한</td></tr>
      <tr><td><b>스토리</b> <span class="pill">추천</span><div class="note">풍부한 묘사, 안정적인 캐릭터 연기</div></td><td class="num">${cell("story", "short")}</td><td class="num">${cell("story", "mid")}</td><td class="num">${cell("story", "long")}</td><td class="num plus">50% 할인</td></tr>
      <tr><td><b>마스터</b><div class="note">소설 같은 몰입감, 복잡한 RPG 계산</div></td><td class="num">${cell("master", "short")}</td><td class="num">${cell("master", "mid")}</td><td class="num">${cell("master", "long")}</td><td class="num plus">50% 할인</td></tr>
    </tbody></table></div>
    <p class="note" style="margin-top:8px">보내기 버튼에 이번 턴 비용이 항상 표시돼요. 응답이 실패하면 자동으로 환불되고, 장기기억 요약·AI 추천·캐릭터 초안은 무료예요.</p>

    <h2 class="sec">멤버십</h2>
    <div class="member">
      <h2>HEART SYNC<em>+</em></h2>
      <ul>
        <li>라이트 모델 무제한</li><li>스토리·마스터 모델 50% 할인</li><li>매달 하트 ${PLUS_MONTHLY}개 지급</li>
        <li>장기기억 ${num(PLAN.free.memoMax)}자 → ${num(PLAN.pro.memoMax)}자</li><li>기억력 최대 ${PLAN.free.memTurns}턴 → ${PLAN.pro.memTurns}턴</li><li>대화방 무제한 · 기억 히스토리 ${PLAN.pro.hist}개</li>
      </ul>
      <div class="row"><span class="price">${won(PLUS.price)} <small>/ 월 · 언제든 해지</small></span><span class="spacer"></span>
      ${pro ? `<span style="color:#e9dfcf">이용 중 · ${new Date(S.wallet.pro.until).toLocaleDateString("ko-KR")}까지</span>` : `<button class="btn gold" id="buyPlus">PLUS 시작하기</button>`}</div>
    </div>
    <div class="tbl-wrap" style="margin-top:12px"><table class="tbl"><thead><tr><th></th><th>무료</th><th class="plus">PLUS</th></tr></thead><tbody>
      <tr><td>라이트 모델</td><td>하루 ${FREE_DAILY}턴, 이후 턴당 ♥1~2</td><td class="plus">무제한</td></tr>
      <tr><td>스토리 · 마스터</td><td>턴당 ♥${listPrice("story", "mid", 10)} · ♥${listPrice("master", "mid", 10)}</td><td class="plus">턴당 ♥${Math.ceil(listPrice("story", "mid", 10) / 2)} · ♥${Math.ceil(listPrice("master", "mid", 10) / 2)}</td></tr>
      <tr><td>매달 하트</td><td>없음 (첫 방문 ♥${WELCOME})</td><td class="plus">♥${PLUS_MONTHLY}</td></tr>
      <tr><td>장기기억 · 기억력</td><td>${num(PLAN.free.memoMax)}자 · ${PLAN.free.memTurns}턴</td><td class="plus">${num(PLAN.pro.memoMax)}자 · ${PLAN.pro.memTurns}턴</td></tr>
      <tr><td>캐릭터당 대화방</td><td>${PLAN.free.rooms}개</td><td class="plus">무제한</td></tr>
    </tbody></table></div>

    <h2 class="sec">하트 충전</h2>
    <div class="packs">${PACKS.map((p) => `<button class="pack" data-pack="${p.id}">${p.best ? `<span class="best">인기</span>` : ""}
      <span class="n"><em>♥</em> ${num(p.n)}</span><span class="bonus">${p.bonus ? "+ 보너스 " + num(p.bonus) : ""}</span>
      <span class="per">스토리 약 ${Math.floor((p.n + p.bonus) / story)}턴 · 라이트 ${num(p.n + p.bonus)}턴</span>
      <span class="p">${won(p.price)}</span></button>`).join("")}</div>
    <p class="demo-note">이 스토어는 결제 흐름을 보여 주는 데모예요. 결제 버튼을 눌러도 실제로 청구되지 않고, 하트와 멤버십은 체험용으로만 지급돼요.</p>

    <h2 class="sec">하트 사용 내역</h2>
    ${S.wallet.ledger.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>일시</th><th>내용</th><th class="num">하트</th></tr></thead><tbody>
      ${S.wallet.ledger.slice(0, 25).map((h) => `<tr><td>${new Date(h.at).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })}</td><td style="white-space:normal">${esc(h.label)}</td><td class="num ${h.d < 0 ? "minus" : h.d > 0 ? "plusv" : ""}">${h.d > 0 ? "+" : ""}${h.d ? num(h.d) : "0"}</td></tr>`).join("")}</tbody></table></div>`
      : `<p class="note">아직 내역이 없어요.</p>`}
    <h2 class="sec">결제 내역</h2>
    ${S.wallet.history.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>일시</th><th>상품</th><th class="num">금액</th></tr></thead><tbody>
      ${S.wallet.history.slice(0, 20).map((h) => `<tr><td>${new Date(h.at).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })}</td><td>${esc(h.name)}</td><td class="num">${won(h.price)} <span class="note">(데모)</span></td></tr>`).join("")}</tbody></table></div>`
      : `<p class="note">아직 결제 내역이 없어요.</p>`}
  </div>`;
  bindGo(v);
  const bp = $("#buyPlus"); if (bp) bp.onclick = () => checkout(PLUS);
  $$("[data-pack]", v).forEach((b) => b.onclick = () => buyPack(b.dataset.pack));
}
function checkout(item, after) {
  const vat = Math.round(item.price / 11);
  const ov = sheet(`<h2>결제하기</h2><p class="sub">${esc(item.name)}${item.id === "plus" ? ` · 하트 ${PLUS_MONTHLY}개 포함` : ""}</p>
    <div class="sumrow"><span>상품 금액</span><span>${won(item.price - vat)}</span></div>
    <div class="sumrow"><span>부가세</span><span>${won(vat)}</span></div>
    <div class="sumrow total"><span>최종 결제 금액</span><span>${won(item.price)}</span></div>
    <div class="payopt" role="radiogroup" aria-label="결제 수단">
      <label><input type="radio" name="pm" checked> 신용·체크카드</label><label><input type="radio" name="pm"> 간편결제</label><label><input type="radio" name="pm"> 휴대폰 결제</label>
    </div>
    <p class="demo-note">데모 결제예요. 결제 정보를 받지 않고, 실제로 청구되지 않아요.</p>
    <div class="cta-row"><span class="spacer"></span><button class="btn ghost" data-x>취소</button><button class="btn pri" id="pay">${won(item.price)} 결제하기</button></div>`);
  $("#pay", ov).onclick = () => {
    const b = $("#pay", ov); b.disabled = true; b.textContent = "결제 승인 중…";
    setTimeout(() => {
      if (item.id === "plus") { const base = isPro() ? S.wallet.pro.until : Date.now(); S.wallet.pro = { until: base + 30 * 86400000 }; S.wallet.hearts += PLUS_MONTHLY; ledger(PLUS_MONTHLY, "PLUS 월간 하트"); }
      else { S.wallet.hearts += item.hearts; ledger(item.hearts, item.name + " 충전"); }
      S.wallet.history.unshift({ at: Date.now(), name: item.name, price: item.price }); S.wallet.history = S.wallet.history.slice(0, 50);
      saveWallet();
      $(".sheet", ov).innerHTML = `<div class="ok-mark">♥</div><h2 style="text-align:center">결제 완료</h2>
        <p class="sub" style="text-align:center">${item.id === "plus" ? `HEART SYNC+가 시작됐어요. 라이트 무제한, 하트 ${PLUS_MONTHLY}개가 지급됐어요.` : `하트 ${num(item.hearts)}개가 지급됐어요. 지금 ♥ ${num(S.wallet.hearts)}`}</p>
        <button class="btn pri block" id="done">${after ? "대화로 돌아가기" : "확인"}</button>`;
      $("#done", ov).onclick = () => { ov.remove(); if (after) after(); else route(); };
    }, 1000);
  };
}
