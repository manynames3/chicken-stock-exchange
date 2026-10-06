import { orderError, MAX_TRADE } from "./order.js";
export const STOCKS = [
  {
    id: "coop",
    en: "Coop Foods",
    ko: "꼬꼬푸드",
    ticker: "COOP",
    icon: "🥚",
    color: "#eaaa28",
  },
  {
    id: "nest",
    en: "Nest Tech",
    ko: "네스트테크",
    ticker: "NEST",
    icon: "⚡",
    color: "#428ee8",
  },
  {
    id: "sun",
    en: "Sunny Energy",
    ko: "써니에너지",
    ticker: "SUN",
    icon: "☀️",
    color: "#e16f94",
  },
  {
    id: "wing",
    en: "Feather Travel",
    ko: "페더여행",
    ticker: "WING",
    icon: "✈️",
    color: "#5baf82",
  },
];
export const ROUNDS = 12;
export const ROUND_MS = 60_000;
export const REVEAL_MS = 8_000;
export const HOLD = Object.freeze({
  action: "hold",
  stock: "coop",
  quantity: 1,
  protection: null,
});

export function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function makeDeck(random = Math.random) {
  return shuffle(
    [...STOCKS.map((s) => s.id), "all"].flatMap((target) =>
      [-3, -2, -1, 1, 2, 3].map((effect) => ({
        id: `${target}:${effect}`,
        target,
        effect,
      })),
    ),
    random,
  );
}
export function portfolio(player, stocks) {
  return (
    player.cash +
    stocks.reduce((n, s) => n + s.price * (player.holdings[s.id] || 0), 0)
  );
}
export function newPlayer(id, name, token) {
  return {
    id,
    name,
    token,
    cash: 100,
    holdings: Object.fromEntries(STOCKS.map((s) => [s.id, 2])),
    protections: 2,
    ready: false,
    locked: false,
    draft: { ...HOLD },
  };
}
export function resetMatch(room, random, now) {
  room.players = room.players.map((p) => ({
    ...newPlayer(p.id, p.name, p.token),
    isComputer: Boolean(p.isComputer),
    difficulty: p.difficulty || "normal",
  }));
  room.stocks = STOCKS.map((s) => ({
    ...s,
    price: 10,
    history: [10],
    delisted: false,
  }));
  room.deck = makeDeck(random);
  room.discards = [];
  room.recaps = [];
  room.round = 1;
  room.phase = "planning";
  room.deadline = roundDeadline(room, now);
  room.match = (room.match || 0) + 1;
  delete room.pausedPhase;
  delete room.remainingMs;
  prepareComputerOrders(room, random);
}
export function validateOrder(room, player, input) {
  const error = orderError(room.stocks, player, input);
  if (error) throw new Error(error);
  const protection = input.protection ?? null;
  return {
    action: input.action,
    stock: input.stock,
    quantity: input.quantity,
    protection,
  };
}
export function resolveRound(room, random, now) {
  if (room.phase !== "planning") return;
  const beforeScores = new Map(
    room.players.map((p) => [p.id, portfolio(p, room.stocks)]),
  );
  const event = room.deck[room.discards.length];
  const demand = Object.fromEntries(STOCKS.map((s) => [s.id, 0]));
  const trades = [];
  for (const player of room.players) {
    let order;
    try {
      order = validateOrder(room, player, player.draft);
    } catch {
      order = { ...HOLD };
    }
    const stock = room.stocks.find((s) => s.id === order.stock);
    if (order.action !== "hold") {
      const direction = order.action === "buy" ? 1 : -1;
      player.cash -= direction * stock.price * order.quantity;
      player.holdings[stock.id] += direction * order.quantity;
      demand[stock.id] += direction * order.quantity;
    }
    if (order.protection) player.protections--;
    trades.push({
      playerId: player.id,
      name: player.name,
      ...order,
      price: stock.price,
      compensation: 0,
    });
  }
  const dice = [1 + Math.floor(random() * 6), 1 + Math.floor(random() * 6)];
  const market = Math.sign(dice[0] - dice[1]);
  const movements = room.stocks.map((stock) => {
    const before = stock.price;
    const news =
      event.target === "all" || event.target === stock.id ? event.effect : 0;
    const pressure = Math.sign(demand[stock.id]);
    if (!stock.delisted) {
      stock.price = Math.max(
        0,
        Math.min(30, before + news + pressure + market),
      );
      stock.delisted = stock.price === 0;
    }
    stock.history.push(stock.price);
    for (let i = 0; i < room.players.length; i++) {
      const p = room.players[i],
        trade = trades[i];
      if (trade.protection === stock.id) {
        trade.compensation =
          p.holdings[stock.id] * Math.max(0, before - stock.price);
        p.cash += trade.compensation;
      }
      if (stock.delisted) p.holdings[stock.id] = 0;
    }
    return {
      stock: stock.id,
      before,
      after: stock.price,
      delta: stock.price - before,
      news,
      demand: pressure,
      delisted: stock.delisted,
    };
  });
  room.discards.push(event);
  room.recaps.push({
    round: room.round,
    resolvedAt: now,
    event,
    dice,
    market,
    trades,
    movements,
    settlements: room.players.map((p) => ({
      playerId: p.id,
      before: beforeScores.get(p.id),
      after: portfolio(p, room.stocks),
      delta: portfolio(p, room.stocks) - beforeScores.get(p.id),
    })),
  });
  room.phase =
    room.round >= ROUNDS || room.stocks.every((s) => s.delisted)
      ? "ended"
      : "reveal";
  room.deadline = room.phase === "reveal" ? now + REVEAL_MS : null;
  room.players.forEach((p) => {
    p.locked = false;
    p.draft = { ...HOLD };
  });
}
export function nextRound(room, now, random = Math.random) {
  if (room.phase !== "reveal") return;
  room.round++;
  room.phase = "planning";
  room.deadline = roundDeadline(room, now);
  prepareComputerOrders(room, random);
}
export function roundDeadline(room, now) {
  const seconds = room.solo ? (room.roundSeconds ?? 60) : 60;
  return seconds === 0 ? null : now + seconds * 1000;
}
export function expectedNews(discards, hint, stockId) {
  if (hint !== "all" && hint !== stockId) return 0;
  const used = discards.filter((e) => e.target === hint);
  return (
    -used.reduce((sum, e) => sum + e.effect, 0) / Math.max(1, 6 - used.length)
  );
}
// Only public information enters the computer strategy, never the future deck or human drafts.
function easyOrder(stocks, discards, hint, player, round, random) {
  const live = stocks.filter((s) => !s.delisted);
  if (!live.length) return { ...HOLD };
  const expected = (id) => expectedNews(discards, hint, id);
  const candidates = live.map((s) => ({
    stock: s,
    outlook: expected(s.id),
    jitter: random(),
  }));
  candidates.sort((a, b) => b.outlook + b.jitter - (a.outlook + a.jitter));
  let stock = candidates[0].stock;
  if (hint !== "all" && live.some((s) => s.id === hint) && random() < 0.65)
    stock = live.find((s) => s.id === hint);
  const outlook = expected(stock.id),
    choice = random();
  let action =
    outlook > 0.35
      ? "buy"
      : outlook < -0.35
        ? "sell"
        : choice < 0.5
          ? "buy"
          : choice < 0.82
            ? "sell"
            : "hold";
  if (stock.price >= 25 && player.holdings[stock.id] > 0) action = "sell";
  const reserve = round < 10 ? 20 : 0;
  const maxBuy = Math.min(
    MAX_TRADE,
    Math.floor(Math.max(0, player.cash - reserve) / stock.price),
  );
  const maxSell = Math.min(MAX_TRADE, player.holdings[stock.id]);
  let quantity = action === "buy" ? maxBuy : action === "sell" ? maxSell : 1;
  if (quantity < 1) {
    action = "hold";
    quantity = 1;
  }
  quantity =
    action === "hold" ? 1 : Math.max(1, Math.ceil(random() * quantity));
  let protection = null;
  if (
    player.protections > 0 &&
    (round >= 10 || outlook < -0.3 || random() < 0.1)
  ) {
    const exposure = live.map((s) => ({
      stock: s,
      shares:
        player.holdings[s.id] +
        (s.id === stock.id
          ? action === "buy"
            ? quantity
            : action === "sell"
              ? -quantity
              : 0
          : 0),
    }));
    exposure.sort(
      (a, b) => b.shares * b.stock.price - a.shares * a.stock.price,
    );
    if (exposure[0].shares > 0) protection = exposure[0].stock.id;
  }
  return { action, stock: stock.id, quantity, protection };
}
export function prepareComputerOrders(room, random) {
  for (const player of room.players.filter((p) => p.isComputer)) {
    const order = computerOrder(
      room.stocks,
      room.discards,
      room.deck[room.discards.length].target,
      player,
      room.round,
      random,
      player.difficulty || "normal",
      room.players
        .filter((p) => p.id !== player.id)
        .map((p) => ({ cash: p.cash, holdings: p.holdings })),
    );
    player.draft = validateOrder(room, player, order);
    player.locked = true;
  }
}
// Every response is viewer-specific. Secrets and other players' drafts never cross this boundary.
export function publicRoom(room, viewerId, connected = []) {
  const {
    code,
    hostId,
    phase,
    round,
    deadline,
    match,
    stocks = [],
    discards = [],
    recaps = [],
  } = room;
  return {
    code,
    hostId,
    phase,
    round,
    deadline,
    match,
    stocks,
    discards,
    recaps,
    solo: Boolean(room.solo),
    roundSeconds: room.solo ? (room.roundSeconds ?? 60) : 60,
    revision: room.revision || 0,
    hint: phase === "planning" ? room.deck[discards.length].target : null,
    serverTime: Date.now(),
    viewerId,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      cash: p.cash,
      holdings: p.holdings,
      protections: p.protections,
      ready: p.ready,
      locked: p.locked,
      isComputer: Boolean(p.isComputer),
      difficulty: p.isComputer ? p.difficulty || "normal" : null,
      connected: p.isComputer || connected.includes(p.id),
      score: portfolio(p, stocks),
      lastRoundChange:
        recaps.at(-1)?.settlements?.find((s) => s.playerId === p.id)?.delta ??
        null,
      ...(p.id === viewerId ? { draft: p.draft } : {}),
    })),
  };
}

export const DIFFICULTIES = ["easy", "normal", "hard"];
export function remainingNews(discards, hint) {
  const used = new Set(
    discards.filter((e) => e.target === hint).map((e) => e.effect),
  );
  const remaining = [-3, -2, -1, 1, 2, 3].filter((effect) => !used.has(effect));
  return remaining.length ? remaining : [0];
}
function demandDistribution(stock, live, opponents, hint, expectation) {
  let totals = new Map([[0, 1]]);
  for (const opponent of opponents) {
    const targetChance =
      hint === "all" || live.length === 1
        ? 1 / live.length
        : stock.id === hint
          ? 0.5
          : 0.5 / (live.length - 1);
    const buyChance = expectation < -1 ? 0.2 : expectation > 1 ? 0.65 : 0.5;
    const sellChance = expectation < -1 ? 0.65 : expectation > 1 ? 0.15 : 0.3;
    const buy = Math.min(MAX_TRADE, Math.floor(opponent.cash / stock.price));
    const sell = Math.min(MAX_TRADE, opponent.holdings[stock.id] || 0);
    const choices = new Map([
      [0, 1 - targetChance * ((buy ? buyChance : 0) + (sell ? sellChance : 0))],
    ]);
    for (let q = 1; q <= buy; q++)
      choices.set(q, (targetChance * buyChance) / buy);
    for (let q = 1; q <= sell; q++)
      choices.set(-q, (targetChance * sellChance) / sell);
    const next = new Map();
    for (const [a, pa] of totals)
      for (const [b, pb] of choices)
        next.set(a + b, (next.get(a + b) || 0) + pa * pb);
    totals = next;
  }
  return totals;
}
// Evaluate only legal trades against remaining public news, dice odds and public positions.
export function computerOrder(
  stocks,
  discards,
  hint,
  player,
  round,
  random,
  difficulty = player.difficulty || "normal",
  opponents = [{ cash: 100, holdings: { coop: 2, nest: 2, sun: 2, wing: 2 } }],
) {
  if (difficulty === "easy")
    return easyOrder(stocks, discards, hint, player, round, random);
  const live = stocks.filter((s) => !s.delisted);
  if (!live.length) return { ...HOLD };
  const news = remainingNews(discards, hint);
  const orders = [{ ...HOLD }];
  for (const s of live)
    for (const action of ["buy", "sell"]) {
      const max =
        action === "buy"
          ? Math.min(MAX_TRADE, Math.floor(player.cash / s.price))
          : Math.min(MAX_TRADE, player.holdings[s.id]);
      for (let quantity = 1; quantity <= max; quantity++)
        orders.push({ action, stock: s.id, quantity, protection: null });
    }
  const distributions = new Map(
    live.map((s) => [
      s.id,
      demandDistribution(
        s,
        live,
        opponents,
        hint,
        expectedNews(discards, hint, s.id),
      ),
    ]),
  );
  const candidates = [];
  for (const order of orders) {
    const holdings = { ...player.holdings };
    const selected = stocks.find((s) => s.id === order.stock);
    const signed =
      order.action === "buy"
        ? order.quantity
        : order.action === "sell"
          ? -order.quantity
          : 0;
    holdings[order.stock] += signed;
    const cash = player.cash - signed * selected.price;
    let gain = 0,
      risk = 0;
    const refunds = [];
    for (const s of live) {
      let change = 0,
        downside = 0,
        delistChance = 0;
      for (const effect of news)
        for (const [market, dieChance] of [
          [-1, 15 / 36],
          [0, 6 / 36],
          [1, 15 / 36],
        ])
          for (const [otherDemand, chance] of distributions.get(s.id)) {
            const pressure = Math.sign(
              otherDemand + (s.id === order.stock ? signed : 0),
            );
            const price = Math.max(
              0,
              Math.min(
                30,
                s.price +
                  (hint === "all" || hint === s.id ? effect : 0) +
                  market +
                  pressure,
              ),
            );
            const probability = (dieChance * chance) / news.length;
            change += probability * (price - s.price);
            downside += probability * Math.max(0, s.price - price);
            if (price === 0) delistChance += probability;
          }
      gain += holdings[s.id] * change;
      risk += holdings[s.id] * (downside + delistChance * 0.6);
      if (holdings[s.id] > 0)
        refunds.push({ stock: s.id, value: holdings[s.id] * downside });
    }
    const reservePenalty = round < 10 ? Math.max(0, 20 - cash) * 0.04 : 0;
    const riskWeight = difficulty === "hard" ? 0.06 : 0.14;
    const base = gain - risk * riskWeight - reservePenalty;
    candidates.push({ ...order, value: base });
    if (player.protections > 0)
      for (const refund of refunds) {
        const cardCost =
          round >= 11
            ? 0
            : (Math.max(1, Math.max(...Object.values(holdings)) * 0.65) *
                (12 - round)) /
              11;
        candidates.push({
          ...order,
          protection: refund.stock,
          value: base + refund.value - cardCost,
        });
      }
  }
  if (difficulty === "normal" && random() < 0.5)
    return easyOrder(stocks, discards, hint, player, round, random);
  for (const candidate of candidates)
    candidate.value += (random() - 0.5) * (difficulty === "hard" ? 0.08 : 2.8);
  candidates.sort((a, b) => b.value - a.value);
  const { value, ...order } = candidates[0];
  return order;
}
