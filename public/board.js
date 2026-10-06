export function stockMarker(index, x, y, color, radius = 5) {
  const common = `fill="${color}" stroke="white" stroke-width="1.8"`;
  if (index === 1)
    return `<rect x="${x - radius}" y="${y - radius}" width="${radius * 2}" height="${radius * 2}" rx="1" ${common}/>`;
  if (index === 2)
    return `<path d="M${x},${y - radius - 1} L${x + radius + 1},${y} L${x},${y + radius + 1} L${x - radius - 1},${y}Z" ${common}/>`;
  if (index === 3)
    return `<path d="M${x},${y - radius - 1} L${x + radius + 1},${y + radius} L${x - radius - 1},${y + radius}Z" ${common}/>`;
  return `<circle cx="${x}" cy="${y}" r="${radius}" ${common}/>`;
}
export function renderChart(room, view, lang) {
  const t = (en, ko) => (lang === "ko" ? ko : en);
  const completed = room.stocks[0].history.length - 1;
  const maxRound = view === "full" ? 12 : Math.max(3, completed);
  const left = 34,
    right = 594,
    top = 18,
    bottom = 258;
  const x = (round) => left + (round / maxRound) * (right - left);
  const y = (price) => bottom - (price / 30) * (bottom - top);
  let grid = "";
  for (let price = 0; price <= 30; price += 5)
    grid += `<line x1="${left}" x2="${right}" y1="${y(price)}" y2="${y(price)}" class="grid-line ${price === 0 ? "zero" : ""}"/><text x="25" y="${y(price) + 5}" text-anchor="end">${price}</text>`;
  for (let round = 0; round <= maxRound; round++)
    grid += `<line x1="${x(round)}" x2="${x(round)}" y1="${top}" y2="${bottom}" class="grid-line vertical"/><text x="${x(round)}" y="284" text-anchor="middle">${round}</text>`;
  const labels = room.stocks
    .map((s, i) => ({ stock: s, index: i, y: Math.max(38, y(s.price)) }))
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < labels.length; i++)
    labels[i].y = Math.max(labels[i].y, labels[i - 1].y + 24);
  if (labels.at(-1).y > bottom) {
    labels.at(-1).y = bottom;
    for (let i = labels.length - 2; i >= 0; i--)
      labels[i].y = Math.min(labels[i].y, labels[i + 1].y - 24);
  }
  const patterns = ["", "8 4", "3 4", "12 4 3 4"];
  const lines = room.stocks
    .map(
      (s, i) =>
        `<g class="chart-series" data-series="${s.id}"><polyline points="${s.history.map((price, round) => `${x(round)},${y(price)}`).join(" ")}" fill="none" stroke="${s.color}" stroke-width="3" stroke-dasharray="${patterns[i]}" stroke-linecap="round" stroke-linejoin="round"/>${s.history.map((price, round) => stockMarker(i, x(round), y(price), s.color, round === completed ? 5 : 3)).join("")}</g>`,
    )
    .join("");
  const named =
    `<text x="${right + 32}" y="18" class="latest-label">${t("LATEST", "현재 주가")}</text>` +
    labels
      .map(
        ({ stock: s, index: i, y: labelY }) =>
          `${stockMarker(i, right + 35, labelY - 1, s.color, 4)}<text x="${right + 46}" y="${labelY + 5}" class="endpoint-label">${s.ticker} ${s.price}</text>`,
      )
      .join("");
  const regions = Array.from({ length: completed + 1 }, (_, round) => {
    const half = (right - left) / maxRound / 2,
      begin = Math.max(left, x(round) - half),
      end = Math.min(right, x(round) + half);
    return `<rect class="round-hit" data-chart-round="${round}" x="${begin}" y="${top}" width="${end - begin}" height="${bottom - top}"/>`;
  }).join("");
  return `<div class="chart-controls"><div class="chart-toggle" role="group" aria-label="${t("Chart range", "차트 범위")}"><button data-chart-view="history" aria-pressed="${view === "history"}">${t("Played rounds", "완료 라운드")}</button><button data-chart-view="full" aria-pressed="${view === "full"}">${t("All 12 rounds", "전체 12라운드")}</button></div><label for="chart-round" class="sr-only">${t("Inspect round", "라운드 확인")}</label><select id="chart-round">${Array.from({ length: completed + 1 }, (_, i) => `<option value="${i}" ${i === completed ? "selected" : ""}>${t("Round", "라운드")} ${i}${i === completed ? ` · ${t("latest", "최신")}` : ""}</option>`).join("")}</select></div><svg class="market-chart" viewBox="0 0 760 298" role="img" aria-label="${t("Stock prices by round. Lines are labeled and have distinct patterns and point shapes. Use the round selector for exact values.", "종목별 주가 차트. 선의 이름, 패턴, 점 모양으로 구분하며 라운드 선택기로 정확한 값을 확인할 수 있어요.")}">${completed < maxRound ? `<rect x="${x(completed)}" y="${top}" width="${right - x(completed)}" height="${bottom - top}" class="future-zone"/>` : ""}${grid}${lines}${named}${regions}</svg>`;
}
