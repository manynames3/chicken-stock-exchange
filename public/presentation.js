export const e = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const tr = (lang, en, ko) => (lang === "ko" ? ko : en);
export function chicken(mood = "neutral", extra = "") {
  const cell = {
    neutral: [0, 120],
    happy: [1280 / 3, 120],
    worried: [2560 / 3, 120],
    thoughtful: [0, 620],
    clever: [1280 / 3, 620],
    champion: [2560 / 3, 620],
  }[mood] || [0, 120];
  return `<span class="chicken-face chicken-${mood} ${extra}" aria-hidden="true"><svg viewBox="0 0 ${1280 / 3} 500" focusable="false"><svg width="${1280 / 3}" height="500" viewBox="${cell[0]} ${cell[1]} ${1280 / 3} 500" overflow="hidden"><image href="/assets/chicken-expressions.png" width="1280" height="1280"/></svg></svg></span>`;
}
const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");
export function priceEquation(movement, market, lang = "en") {
  const t = (en, ko) => tr(lang, en, ko);
  if (movement.before === 0)
    return `<span class="price-equation">${t("Already delisted · stays at 0", "영구 상장폐지 · 0 유지")}</span>`;
  const raw = movement.before + movement.news + movement.demand + market;
  return `<span class="price-equation"><b>${movement.before}</b><span>${signed(movement.news)}<small>${t("news", "뉴스")}</small></span><span>${signed(movement.demand)}<small>${t("demand", "수요")}</small></span><span>${signed(market)}<small>${t("dice", "주사위")}</small></span><strong>= ${movement.after}</strong>${raw !== movement.after ? `<em>${t("capped at", "범위 제한:")} ${movement.after}</em>` : ""}</span>`;
}
export function scoreHistory(room, playerId) {
  const holdings = { coop: 2, nest: 2, sun: 2, wing: 2 };
  let cash = 100;
  const points = [{ round: 0, value: 180 }];
  for (const recap of room.recaps) {
    const trade = recap.trades.find((t) => t.playerId === playerId);
    if (trade) {
      const direction =
        trade.action === "buy" ? 1 : trade.action === "sell" ? -1 : 0;
      cash -= direction * trade.price * trade.quantity;
      holdings[trade.stock] += direction * trade.quantity;
      cash += trade.compensation || 0;
    }
    for (const movement of recap.movements)
      if (movement.delisted) holdings[movement.stock] = 0;
    const settlement = recap.settlements?.find((s) => s.playerId === playerId);
    const value =
      settlement?.after ??
      cash +
        recap.movements.reduce(
          (sum, m) => sum + holdings[m.stock] * m.after,
          0,
        );
    points.push({ round: recap.round, value });
  }
  return points;
}
export function matchInsights(room, playerId) {
  const history = scoreHistory(room, playerId);
  const changes = history
    .slice(1)
    .map((p, i) => ({ round: p.round, delta: p.value - history[i].value }));
  return {
    history,
    best: changes.reduce((a, b) => (!a || b.delta > a.delta ? b : a), null),
    worst: changes.reduce((a, b) => (!a || b.delta < a.delta ? b : a), null),
    protection: room.recaps.reduce(
      (sum, r) =>
        sum +
        (r.trades.find((t) => t.playerId === playerId)?.compensation || 0),
      0,
    ),
  };
}
export function renderFinale(room, lang = "en") {
  const t = (en, ko) => tr(lang, en, ko),
    colors = ["#eaaa28", "#428ee8", "#e16f94", "#5baf82"];
  const sorted = [...room.players].sort((a, b) => b.score - a.score),
    winnerScore = sorted[0].score;
  const winners = sorted.filter((p) => p.score === winnerScore),
    me = room.players.find((p) => p.id === room.viewerId),
    stats = matchInsights(room, me.id);
  const histories = room.players.map((p) => scoreHistory(room, p.id));
  const values = histories.flatMap((h) => h.map((p) => p.value)),
    min = Math.max(0, Math.min(...values) - 15),
    max = Math.max(...values) + 15;
  const last = Math.max(1, room.recaps.at(-1)?.round || room.round);
  const x = (r) => 40 + (r / last) * 640,
    y = (v) => 170 - ((v - min) / (max - min)) * 145;
  const grid = [min, (min + max) / 2, max]
    .map(
      (v) =>
        `<line x1="40" x2="680" y1="${y(v)}" y2="${y(v)}" class="grid-line"/><text x="30" y="${y(v) + 4}" text-anchor="end">${Math.round(v)}</text>`,
    )
    .join("");
  const paths = histories
    .map(
      (h, i) =>
        `<polyline points="${h.map((p) => `${x(p.round)},${y(p.value)}`).join(" ")}" stroke="${colors[i]}" stroke-width="3" stroke-dasharray="${["", "8 4", "3 4", "12 4 3 4"][i]}" fill="none"/>`,
    )
    .join("");
  const delta = me.score - 180;
  return `<section class="finale panel"><div class="finale-heading"><div><div class="eyebrow">${t("THE CLOSING BELL", "마감 종이 울렸어요")}</div><h2>${winners.some((p) => p.id === me.id) ? t("Your nest egg wins!", "내 자산이 우승했어요!") : t("A new champion!", "새로운 챔피언!")}</h2><p>${winners.map((p) => e(p.name)).join(" & ")} · ${t("Cash + share value", "현금 + 주식 가치")}</p></div>${chicken(winners.some((p) => p.id === me.id) ? "champion" : "thoughtful", "finale-chicken")}<div class="confetti" aria-hidden="true">${Array.from({ length: 12 }, (_, i) => `<i style="--i:${i};--confetti-color:${colors[i % 4]}"></i>`).join("")}</div></div><ol class="finale-ranking">${sorted.map((p, i) => `<li><span>${chicken(p.score === winnerScore ? "champion" : "neutral")}<b>${sorted.findIndex((other) => other.score === p.score) + 1}. ${e(p.name)}</b>${p.id === me.id ? `<small>${t("YOU", "나")}</small>` : ""}</span><strong>${p.score} <small>${t("coins", "코인")}</small></strong></li>`).join("")}</ol><div class="match-highlights"><div><span>${t("Your total return", "내 총자산 변화")}</span><strong class="${delta < 0 ? "loss" : "gain"}">${signed(delta)} ${t("coins", "코인")}</strong><small>180 → ${me.score}</small></div><div><span>${t("Best round", "최고의 라운드")}</span><strong>${stats.best ? signed(stats.best.delta) : 0}</strong><small>${t("Round", "라운드")} ${stats.best?.round || "–"}</small></div><div><span>${t("Biggest setback", "가장 힘든 라운드")}</span><strong>${stats.worst ? signed(stats.worst.delta) : 0}</strong><small>${t("Round", "라운드")} ${stats.worst?.round || "–"}</small></div><div><span>${t("Protection repaid", "보호 카드 보상")}</span><strong>${stats.protection} ${t("coins", "코인")}</strong><small>${t("Chicken had your back", "꼬꼬가 지켜준 자산")}</small></div></div><figure class="asset-history"><figcaption>${t("Assets over the match", "라운드별 총자산")}</figcaption><svg viewBox="0 0 720 205" role="img" aria-label="${t("Comparison of each player’s assets over completed rounds. Exact values are in the table below.", "완료 라운드별 플레이어 총자산 비교. 아래 표에서 정확한 값을 확인하세요.")}">${grid}${paths}<text x="40" y="196">0</text><text x="680" y="196" text-anchor="end">${last}</text></svg><div class="history-legend">${room.players.map((p, i) => `<span style="--stock-color:${colors[i]}">${e(p.name)} · ${p.score}</span>`).join("")}</div><details><summary>${t("Exact values by round", "라운드별 정확한 수치")}</summary><div class="history-table"><table><thead><tr><th>${t("Round", "라운드")}</th>${room.players.map((p) => `<th>${e(p.name)}</th>`).join("")}</tr></thead><tbody>${histories[0].map((point, i) => `<tr><th>${point.round}</th>${histories.map((h) => `<td>${h[i]?.value ?? "–"}</td>`).join("")}</tr>`).join("")}</tbody></table></div></details></figure><div class="finale-actions">${me.id === room.hostId ? `<button id="rematch" class="primary">${t("Play a rematch", "다시 대결하기")}</button>` : `<p>${t("Your host can start a rematch.", "방장이 다시 시작할 수 있어요.")}</p>`}<button id="finale-exit" class="secondary">${t("Return to menu", "메뉴로 돌아가기")}</button></div></section>`;
}
export {
  soundEnabled,
  unlockSound,
  setSoundEnabled,
  toggleSound,
  playCue,
} from "./sound.js";
