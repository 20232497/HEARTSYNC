/* 에피소드 방·외전 방의 프롬프트 조각: 고정부 끝의 방 갈래 머리(modeHead — 에피소드의 장 목록, 외전의 '있었던 일')와 변동부의 [에피소드 진행](epProgress — 이번 응답의 지시). 시스템 프롬프트를 짜는 곳은 rules.js */
import { SIDE, choiceOf } from "../../core/episode.js";

/* 고정부 끝의 방 갈래 머리: 에피소드 방은 장 목록과 '결말은 앱이 알릴 때만'(결말 목록은 보내지 않음 — 미리 알면 그쪽으로 몰아감), 외전 방은 이어받은 결말과 외전 갈래(SIDE). 방이 정해지면 바뀌지 않음 */
export function modeHead(r) {
  const c = r.char, ep = c.episode;
  if (r.ep && ep) return `
[에피소드 — 끝이 있는 이야기]
- 이 방은 정해진 장을 차례로 지나 결말에서 끝나는 이야기다. 장을 건너뛰거나 다음 장의 일을 앞당기지 않는다.
- 결말은 앱이 아래 [에피소드 진행]에서 알릴 때만 쓴다. 그 전에는 이야기를 닫거나 결말을 단정하지 않는다.
- 장: ${ep.beats.map((b, i) => `${i + 1}. 「${b.title}」 ${b.goal}`).join(" / ")}
`;
  const s = r.side, K = s && SIDE[s.kind];
  if (!K) return "";
  const name = ((c.cast || []).find((x) => x.code === s.who) || {}).name || "";
  return `
[외전 — ${K.label}${name ? " · " + name : ""}]
- 이 방은 「${c.title}」의 결말${s.endTitle ? ` 「${s.endTitle}」` : ""} 뒤에 이어지는 외전이다. 그 결말과 지금까지의 대화는 실제로 일어난 일이다. 되돌리거나 결말을 다시 내지 않는다.
- 끝이 정해지지 않은 자유 대화로 이어 간다. ${K.line(name)}
${sideRecap(c.episode, s)}`;
}
/* 외전의 '있었던 일' — 원래 에피소드의 장(제목·목표)·고른 길·본 사건·결말 줄거리. 오래된 대화가 기억력 밖으로 밀려도 이 요약은 늘 고정부에(시점 외전이 사건을 차례로 다시 그릴 재료). 방마다 정해진 값이라 고정부에 둠 */
function sideRecap(ep, s) {
  if (!ep) return "";
  const path = Object.keys(s.picks || {}).map((id) => { const ch = choiceOf(ep, id), o = ch && ch.options.find((x) => x.id === s.picks[id]); return ch && o ? `'${ch.ask}' → ${o.label}` : ""; }).filter(Boolean);
  const evs = (s.seen || []).map((id) => (ep.events || []).find((x) => x.id === id)).filter(Boolean).map((x) => x.title);
  const end = ep.endings.find((x) => x.id === s.ending);
  return [`- 에피소드에서 있었던 일(대화 기록·장기 기억과 함께 사실로 다룬다):`,
    ...ep.beats.map((b, i) => `  ${i + 1}장 「${b.title}」 ${b.goal}`),
    path.length ? `  유저가 고른 길: ${path.join(" / ")}` : "",
    evs.length ? `  일어난 사건: ${evs.join(", ")}` : "",
    end ? `  결말 「${end.title}」: ${end.brief}` : ""].filter(Boolean).join("\n") + "\n";
}
/* 변동부의 [에피소드 진행] — 이번 응답의 지시(epPlan). 결말을 정한 턴은 결말 장면만 */
export function epProgress(ep, st, plan) {
  if (!plan || st.over) return "";
  const L = ["", "[에피소드 진행 — 앱이 정한 순서. 반드시 따른다]"];
  if (plan.ending) {
    L.push(`- 이번 응답으로 이야기를 끝낸다. 결말 「${plan.ending.title}」: ${plan.ending.brief}`, "- 결말 장면을 서두르지 말고 충분히 쓴다. 인물들의 마지막 말과 여운으로 맺고, 이번에는 유저에게 다음 행동을 묻는 말로 끝내지 않는다.");
    return L.join("\n") + "\n";
  }
  const b = plan.beat, picked = Object.keys(st.picks).map((id) => { const ch = choiceOf(ep, id), o = ch && ch.options.find((x) => x.id === st.picks[id]); return ch && o ? `'${ch.ask}' → ${o.label}` : ""; }).filter(Boolean);
  if (!b) return "";
  L.push(`- 지금 ${plan.n}장 / ${ep.beats.length}장 「${b.title}」 — 이 장의 목표: ${b.goal}`);
  if (picked.length) L.push(`- 유저가 고른 갈림길(이야기는 이 선택의 결과를 따른다): ${picked.join(" / ")}`);
  if (plan.ask) L.push(`- 이 장의 목표는 이뤘고 유저가 갈림길 '${plan.ask.ask}' 앞에 있다(보기: ${plan.ask.options.map((o) => `${o.id}=${o.label}`).join(", ")}). 유저의 이번 입력을 받아 장면을 잇는다.`);
  else {
    L.push(plan.phase === "early" ? "- 이 장은 막 열렸다. 목표를 서두르지 말고 장면과 관계를 쌓는다." : plan.phase === "open" ? "- 흐름이 닿으면 이 장의 목표를 이룬다. 억지로 끌고 가지는 않는다." : "- 이번 응답에서 이 장의 목표를 반드시 매듭짓는다.");
    if (b.choice && plan.phase !== "early") L.push(`- 이 장의 목표를 이루는 응답은 유저가 '${b.choice.ask}'를 정해야 하는 순간에서 멈춘다(보기를 나열하지 않는다).`);
  }
  if (plan.event) L.push(`- 이번 응답 안에서 이 사건이 실제로 일어나 장면으로 보여야 한다(소문·예고·다음 장면으로 미루지 않는다). 하던 장면이 있으면 짧게 맺고 사건으로 넘어가도 된다: ${plan.event.text}`);
  return L.join("\n") + "\n";
}
