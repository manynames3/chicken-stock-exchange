import {
  newPlayer,
  resetMatch,
  resolveRound,
  nextRound,
  HOLD,
  publicRoom,
} from "./game.js";
import { chicken, e, tr, priceEquation } from "./presentation.js";
const lessons = [
  {
    action: "buy",
    order: { action: "buy", stock: "coop", quantity: 2, protection: null },
    event: { target: "coop", effect: 2 },
    dice: [3, 3],
    en: "Buy two COOP shares",
    ko: "COOP 2주 매수하기",
    intro: [
      "A purchase swaps cash for shares at the price shown. Your total assets change when prices move.",
      "매수하면 표시된 가격으로 현금을 주식으로 바꿔요. 주가가 움직일 때 총자산이 변해요.",
    ],
    explanation: [
      "You paid 20 coins for two shares. COOP rose from 10 to 13: news +2, demand +1, dice 0. Your four COOP shares gained 12 coins.",
      "2주에 20코인을 지불했어요. COOP은 뉴스 +2, 수요 +1, 주사위 0으로 10에서 13으로 올랐어요. 보유한 COOP 4주의 가치가 12코인 늘었어요.",
    ],
  },
  {
    action: "hold",
    order: { ...HOLD },
    event: { target: "coop", effect: -2 },
    dice: [2, 5],
    en: "Hold through bad news",
    ko: "악재에서 관망하기",
    intro: [
      "Holding keeps your cash and share counts unchanged, but you still carry market risk.",
      "관망하면 현금과 주식 수량은 그대로지만 주가 변동의 영향을 받아요.",
    ],
    explanation: [
      "COOP lost 3 coins per share: news −2 and the blue die −1. The dice also lowered every other stock by 1. Your assets fell by 18 coins even though you did not trade.",
      "COOP은 뉴스 −2와 파란 주사위 −1로 주당 3코인 하락했어요. 주사위 때문에 다른 종목도 1코인씩 하락해 거래하지 않아도 총자산이 18코인 줄었어요.",
    ],
  },
  {
    action: "protect",
    order: { ...HOLD, protection: "coop" },
    event: { target: "coop", effect: -2 },
    dice: [3, 3],
    en: "Protect COOP and hold",
    ko: "COOP 보호하고 관망하기",
    intro: [
      "Spend one chicken card before the news. It repays the actual drop on your COOP shares held after trading.",
      "뉴스 전에 치킨 카드 1장을 사용해요. 거래 후 보유한 COOP 주식의 실제 하락분을 보상해요.",
    ],
    explanation: [
      "COOP fell 2 coins. Your four shares lost 8 coins, and protection repaid 8 coins in cash. Your total stayed unchanged. One card was spent; it would also be spent if prices rose.",
      "COOP이 2코인 하락해 4주의 가치가 8코인 줄었지만 현금 8코인을 돌려받아 총자산은 그대로예요. 카드 1장을 썼으며 주가가 올라도 소모돼요.",
    ],
  },
];
export function createTutorial() {
  const room = {
    code: "PRACTICE",
    solo: true,
    roundSeconds: 0,
    players: [
      newPlayer("learner", "You", ""),
      newPlayer("guide", "Captain Cluck", ""),
    ],
  };
  resetMatch(room, () => 0.5, 0);
  room.deck = lessons.map((l) => l.event);
  return { room, step: 0, revealed: false };
}
export function tutorialTurn(state, choice) {
  if (state.revealed || choice !== lessons[state.step].action) return false;
  const lesson = lessons[state.step];
  state.room.players[0].draft = { ...lesson.order };
  state.room.players[1].draft = { ...HOLD };
  let i = 0;
  resolveRound(state.room, () => (lesson.dice[i++] - 1 + 0.1) / 6, 0);
  state.revealed = true;
  return true;
}
export function nextTutorialLesson(state) {
  if (!state.revealed || state.step >= 2) return false;
  state.step++;
  nextRound(state.room, 0, () => 0.5);
  state.revealed = false;
  return true;
}
export function renderTutorial(state, lang = "en") {
  const t = (en, ko) => tr(lang, en, ko),
    lesson = lessons[state.step],
    view = publicRoom(state.room, "learner"),
    me = view.players[0],
    recap = view.recaps.at(-1);
  const complete = state.step === 2 && state.revealed;
  return `<section class="tutorial-board" aria-label="${t("Isolated practice tutorial", "독립 연습 튜토리얼")}"><div class="tutorial-heading">${chicken(complete ? "champion" : state.revealed ? (state.step === 1 ? "worried" : "happy") : "thoughtful")}<div><div class="eyebrow">${t("PRACTICE ONLY · SCRIPTED NEWS · NO TIMER", "연습 전용 · 정해진 뉴스 · 시간 제한 없음")}</div><h3>${complete ? t("You know the market basics!", "기본 규칙을 익혔어요!") : t(lesson.en, lesson.ko)}</h3></div></div><ol class="tutorial-progress">${lessons.map((l, i) => `<li ${i === state.step ? 'aria-current="step"' : ""} class="${i <= state.step ? "active" : ""}">${i + 1} ${t(["Buy", "Price drop", "Protection"][i], ["매수", "하락", "보호"][i])}</li>`).join("")}</ol><div class="tutorial-assets"><span>${t("Cash", "현금")} <b>${me.cash}</b></span><span>${t("Share value", "주식 가치")} <b>${me.score - me.cash}</b></span><span>${t("Total assets", "총자산")} <strong>${me.score}</strong></span></div>${state.step === 0 && !state.revealed ? `<p class="asset-explanation">100 ${t("cash", "현금")} + (8 ${t("shares", "주")} × 10) = <b>180 ${t("total assets", "총자산")}</b></p>` : ""}<div class="tutorial-stocks">${view.stocks.map((s) => `<div style="--stock-color:${s.color}"><b>${s.ticker} · ${s.price}</b><small>${me.holdings[s.id]} ${t("owned", "주 보유")}</small></div>`).join("")}</div><p>${t(...lesson.intro)}</p><div class="tutorial-choices">${lessons.map((l) => `<button data-tutorial-choice="${l.action}" class="${l.action === lesson.action ? "primary" : "secondary"}" ${state.revealed || l.action !== lesson.action ? "disabled" : ""}>${t(l.en, l.ko)}</button>`).join("")}</div>${state.revealed ? `<div class="tutorial-outcome" role="status"><h4>${t("Why your assets changed", "총자산이 변한 이유")}</h4>${priceEquation(recap.movements[0], recap.market, lang)}<p>${t(...lesson.explanation)}</p><strong>${recap.settlements[0].before} → ${recap.settlements[0].after} ${t("total assets", "총자산")}</strong></div>${complete ? `<p>${t("Ready for a real match? News is hidden there, and every decision is yours.", "실전에서는 뉴스가 비밀이고 모든 결정은 여러분의 몫이에요.")}</p><button id="tutorial-reset" class="secondary">${t("Practice again", "다시 연습하기")}</button>` : `<button id="tutorial-next" class="primary">${t("Next lesson", "다음 연습")}</button>`}` : `<p class="small">${t("Choose the highlighted action to see a real settlement.", "강조된 주문을 선택해 실제 정산을 확인하세요.")}</p>`}</section>`;
}
