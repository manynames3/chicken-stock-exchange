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
  room.deadline = now + ROUND_MS;
  room.match = (room.match || 0) + 1;
  prepareComputerOrders(room, random);
}
export function validateOrder(room, player, input) {
  if (!input || !["buy", "sell", "hold"].includes(input.action))
    throw new Error("INVALID_ORDER");
  const stock = room.stocks.find((s) => s.id === input.stock);
  if (
    !stock ||
    !Number.isInteger(input.quantity) ||
    input.quantity < 1 ||
    input.quantity > 3
  )
    throw new Error("INVALID_ORDER");
  if (input.action !== "hold" && stock.delisted) throw new Error("DELISTED");
  if (input.action === "buy" && player.cash < stock.price * input.quantity)
    throw new Error("NOT_ENOUGH_CASH");
  if (
    input.action === "sell" &&
    (player.holdings[stock.id] || 0) < input.quantity
  )
    throw new Error("NOT_ENOUGH_SHARES");
  const protection = input.protection ?? null;
  if (protection !== null) {
    const protectedStock = room.stocks.find((s) => s.id === protection);
    if (!protectedStock || protectedStock.delisted || player.protections < 1)
      throw new Error("INVALID_PROTECTION");
    const after =
      (player.holdings[protection] || 0) +
      (stock.id === protection
        ? input.action === "buy"
          ? input.quantity
          : input.action === "sell"
            ? -input.quantity
            : 0
        : 0);
    if (after <= 0) throw new Error("NO_SHARES_TO_PROTECT");
  }
  return {
    action: input.action,
    stock: stock.id,
    quantity: input.quantity,
    protection,
  };
}
export function resolveRound(room, random, now) {
  if (room.phase !== "planning") return;
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
    event,
    dice,
    market,
    trades,
    movements,
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
  room.deadline = now + ROUND_MS;
  prepareComputerOrders(room, random);
}
// Only public information enters the computer strategy, never the future deck or human drafts.
export function computerOrder(stocks, discards, hint, player, round, random) {
  const live = stocks.filter((s) => !s.delisted);
  if (!live.length) return { ...HOLD };
  const expected = (id) => {
    const relevant = discards.filter(
      (e) => e.target === id || e.target === "all",
    );
    const sum = relevant.reduce((n, e) => n + e.effect, 0);
    return -sum / Math.max(1, 12 - relevant.length);
  };
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
    3,
    Math.floor(Math.max(0, player.cash - reserve) / stock.price),
  );
  const maxSell = Math.min(3, player.holdings[stock.id]);
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
      connected: p.isComputer || connected.includes(p.id),
      score: portfolio(p, stocks),
      ...(p.id === viewerId ? { draft: p.draft } : {}),
    })),
  };
}
