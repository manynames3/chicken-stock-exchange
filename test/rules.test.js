import test from "node:test";
import assert from "node:assert/strict";
import {
  STOCKS,
  HOLD,
  newPlayer,
  resetMatch,
  validateOrder,
  resolveRound,
  nextRound,
  publicRoom,
  makeDeck,
  portfolio,
  computerOrder,
  expectedNews,
  roundDeadline,
} from "../src/rules.js";
import { maxShares, orderError, MAX_TRADE } from "../public/order.js";
function fixture(event = { target: "coop", effect: -3 }) {
  const room = {
    code: "ABC234",
    players: [
      newPlayer("a", "Alice", "secret-a"),
      newPlayer("b", "Bob", "secret-b"),
    ],
  };
  resetMatch(room, () => 0.5, 1000);
  room.deck[0] = event;
  return room;
}
const tie = () => 0.5;
test("setup has agreed assets and 60-second deadline", () => {
  const r = fixture();
  assert.equal(r.deadline, 61000);
  assert.equal(r.round, 1);
  assert.equal(portfolio(r.players[0], r.stocks), 180);
  assert.equal(r.players[0].protections, 2);
});
test("deck has exactly thirty unique, balanced cards with six per target", () => {
  const d = makeDeck(tie);
  assert.equal(d.length, 30);
  assert.equal(new Set(d.map((e) => e.id)).size, 30);
  for (const target of [...STOCKS.map((s) => s.id), "all"]) {
    const cards = d.filter((e) => e.target === target);
    assert.equal(cards.length, 6);
    assert.equal(
      cards.reduce((n, e) => n + e.effect, 0),
      0,
    );
  }
});
test("orders reject insufficient cash, excess shares, fractional quantities and invalid actions", () => {
  const r = fixture(),
    p = r.players[0];
  for (const order of [
    { action: "buy", stock: "coop", quantity: MAX_TRADE + 1 },
    { action: "sell", stock: "coop", quantity: 3 },
    { action: "buy", stock: "coop", quantity: 1.5 },
    { action: "oops", stock: "coop", quantity: 1 },
  ])
    assert.throws(() => validateOrder(r, p, order));
  p.cash = 0;
  assert.throws(
    () => validateOrder(r, p, { action: "buy", stock: "coop", quantity: 1 }),
    /NOT_ENOUGH_CASH/,
  );
});
test("simultaneous orders execute at the same pre-news price; equal demand cancels", () => {
  const r = fixture();
  r.players[0].draft = { action: "buy", stock: "coop", quantity: 2 };
  r.players[1].draft = { action: "sell", stock: "coop", quantity: 2 };
  resolveRound(r, tie, 2000);
  assert.equal(r.players[0].cash, 80);
  assert.equal(r.players[1].cash, 120);
  assert.equal(r.stocks[0].price, 7);
  assert.equal(r.recaps[0].movements[0].demand, 0);
  assert.deepEqual(
    r.recaps[0].trades.map((t) => t.price),
    [10, 10],
  );
});
test("demand is based on share quantity and capped at one", () => {
  const r = fixture({ target: "nest", effect: 1 });
  r.players[0].draft = { action: "buy", stock: "coop", quantity: 3 };
  r.players[1].draft = { action: "sell", stock: "coop", quantity: 2 };
  resolveRound(r, tie, 2000);
  assert.equal(r.stocks[0].price, 11);
});
test("dice compare red and blue rather than applying their numeric difference", () => {
  const r = fixture({ target: "coop", effect: 1 });
  let i = 0;
  resolveRound(r, () => [0.99, 0][i++], 2000);
  assert.deepEqual(r.recaps[0].dice, [6, 1]);
  assert.equal(r.stocks[1].price, 11);
  assert.equal(r.stocks[0].price, 12);
});
test("global news applies to all live stocks", () => {
  const r = fixture({ target: "all", effect: -2 });
  resolveRound(r, tie, 2000);
  assert.deepEqual(
    r.stocks.map((s) => s.price),
    [8, 8, 8, 8],
  );
});
test("protection compensates shares AFTER purchases using the actual price decrease", () => {
  const r = fixture();
  r.players[0].draft = {
    action: "buy",
    stock: "coop",
    quantity: 3,
    protection: "coop",
  };
  resolveRound(r, tie, 2000);
  assert.equal(r.stocks[0].price, 8);
  assert.equal(r.players[0].holdings.coop, 5);
  assert.equal(r.players[0].cash, 80);
  assert.equal(r.players[0].protections, 1);
  assert.equal(r.recaps[0].trades[0].compensation, 10);
});
test("protection requires shares after selling and an available card", () => {
  const r = fixture(),
    p = r.players[0];
  assert.throws(
    () =>
      validateOrder(r, p, {
        action: "sell",
        stock: "coop",
        quantity: 2,
        protection: "coop",
      }),
    /NO_SHARES_TO_PROTECT/,
  );
  p.protections = 0;
  assert.throws(
    () => validateOrder(r, p, { ...HOLD, protection: "coop" }),
    /INVALID_PROTECTION/,
  );
});
test("protection is spent when the protected stock rises", () => {
  const r = fixture({ target: "coop", effect: 3 });
  r.players[0].draft = { ...HOLD, protection: "coop" };
  resolveRound(r, tie, 2000);
  assert.equal(r.players[0].protections, 1);
  assert.equal(r.players[0].cash, 100);
});
test("delisting clamps to zero, pays protection, then wipes holdings permanently", () => {
  const r = fixture();
  r.stocks[0].price = 2;
  r.players[0].draft = { ...HOLD, protection: "coop" };
  resolveRound(r, tie, 2000);
  assert.equal(r.stocks[0].price, 0);
  assert.equal(r.players[0].cash, 104);
  assert.equal(r.players[0].holdings.coop, 0);
  assert.throws(
    () =>
      validateOrder(r, r.players[0], {
        action: "buy",
        stock: "coop",
        quantity: 1,
      }),
    /DELISTED/,
  );
  nextRound(r, 3000);
  r.deck[1] = { target: "coop", effect: 3 };
  resolveRound(r, tie, 4000);
  assert.equal(r.stocks[0].price, 0);
});
test("upper cap remains thirty", () => {
  const r = fixture({ target: "coop", effect: 3 });
  r.stocks[0].price = 29;
  resolveRound(r, tie, 2000);
  assert.equal(r.stocks[0].price, 30);
});
test("invalid expired draft falls back to hold without spending protection", () => {
  const r = fixture();
  r.players[0].draft = {
    action: "buy",
    stock: "coop",
    quantity: 99,
    protection: "coop",
  };
  resolveRound(r, tie, 2000);
  assert.equal(r.players[0].cash, 100);
  assert.equal(r.players[0].protections, 2);
});
test("viewer state never contains tokens, deck or opponent drafts", () => {
  const r = fixture();
  r.players[1].draft = {
    action: "buy",
    stock: "nest",
    quantity: 3,
    protection: "nest",
  };
  const state = publicRoom(r, "a");
  assert.equal(state.hint, "coop");
  assert.equal(state.deck, undefined);
  assert.equal(state.players[1].draft, undefined);
  assert.equal(state.players[0].token, undefined);
  assert.ok(state.players[0].draft);
  assert.ok(!JSON.stringify(state).includes("secret-"));
});
test("twelve rounds finish and repeated resolution cannot execute twice", () => {
  const r = fixture();
  for (let round = 1; round <= 12; round++) {
    r.deck[round - 1] = { target: "coop", effect: 1 };
    resolveRound(r, tie, round * 1000);
    const cash = r.players[0].cash;
    resolveRound(r, tie, 9999);
    assert.equal(r.players[0].cash, cash);
    if (round < 12) nextRound(r, round * 1000 + 10);
  }
  assert.equal(r.phase, "ended");
  assert.equal(r.round, 12);
  assert.equal(r.recaps.length, 12);
});
test("all stocks delisted ends early", () => {
  const r = fixture({ target: "all", effect: -3 });
  r.stocks.forEach((s) => (s.price = 1));
  resolveRound(r, tie, 2000);
  assert.equal(r.phase, "ended");
});
test("rematch resets cards, coins, portfolio and news deck", () => {
  const r = fixture();
  resolveRound(r, tie, 1000);
  resetMatch(r, tie, 2000);
  assert.equal(r.match, 2);
  assert.equal(r.round, 1);
  assert.equal(r.recaps.length, 0);
  assert.equal(portfolio(r.players[0], r.stocks), 180);
  assert.equal(r.players[0].protections, 2);
});
test("computer uses only public inputs and always submits a legal order", () => {
  const r = fixture();
  r.players[1].isComputer = true;
  for (let i = 0; i < 100; i++) {
    const rng = () => ((i * 17) % 100) / 100;
    const order = computerOrder(
      r.stocks,
      r.discards,
      "coop",
      r.players[1],
      1,
      rng,
    );
    assert.doesNotThrow(() => validateOrder(r, r.players[1], order));
  }
  const before = computerOrder(
    r.stocks,
    r.discards,
    "coop",
    r.players[1],
    1,
    tie,
  );
  r.deck = [{ target: "coop", effect: 3 }];
  r.players[0].draft = { action: "buy", stock: "coop", quantity: 3 };
  assert.deepEqual(
    computerOrder(r.stocks, r.discards, "coop", r.players[1], 1, tie),
    before,
  );
});
test("computer locks on each round and survives rematch reset", () => {
  const r = fixture();
  r.players[1].isComputer = true;
  resetMatch(r, tie, 1000);
  assert.equal(r.players[1].locked, true);
  assert.equal(r.players[1].isComputer, true);
  resolveRound(r, tie, 2000);
  nextRound(r, 3000, tie);
  assert.equal(r.players[1].locked, true);
  assert.equal(publicRoom(r, "a").players[1].draft, undefined);
});
test("client quantity limits and server validation agree, including zero shares", () => {
  const r = fixture(),
    p = r.players[0];
  assert.equal(MAX_TRADE, 5);
  assert.equal(maxShares(r.stocks, p, "buy", "coop"), 5);
  assert.equal(maxShares(r.stocks, p, "sell", "coop"), 2);
  p.cash = 19;
  assert.equal(maxShares(r.stocks, p, "buy", "coop"), 1);
  p.holdings.coop = 0;
  const order = { action: "sell", stock: "coop", quantity: 1 };
  assert.equal(maxShares(r.stocks, p, "sell", "coop"), 0);
  assert.equal(orderError(r.stocks, p, order), "NOT_ENOUGH_SHARES");
  assert.throws(() => validateOrder(r, p, order), /NOT_ENOUGH_SHARES/);
  p.draft = order;
  resolveRound(r, tie, 2000);
  assert.equal(p.cash, 19);
  assert.equal(p.holdings.coop, 0);
  assert.equal(r.recaps[0].trades[0].action, "hold");
});
test("known news target conditions the estimate on only that target’s discarded cards", () => {
  const discards = [
    { target: "coop", effect: 3 },
    { target: "nest", effect: -3 },
    { target: "all", effect: -2 },
  ];
  assert.equal(expectedNews(discards, "coop", "coop"), -3 / 5);
  assert.equal(expectedNews(discards, "coop", "nest"), 0);
  assert.equal(expectedNews(discards, "all", "coop"), 2 / 5);
  assert.equal(expectedNews(discards, "all", "nest"), 2 / 5);
});
test("recaps and scorecards report actual portfolio changes after settlement", () => {
  const r = fixture();
  r.players[0].draft = { action: "buy", stock: "coop", quantity: 2 };
  resolveRound(r, tie, 2000);
  assert.deepEqual(r.recaps[0].settlements, [
    { playerId: "a", before: 180, after: 172, delta: -8 },
    { playerId: "b", before: 180, after: 176, delta: -4 },
  ]);
  assert.equal(publicRoom(r, "a").players[0].lastRoundChange, -8);
});
test("solo timer options survive rounds and rematches; multiplayer keeps its deadline", () => {
  const r = fixture();
  r.solo = true;
  r.roundSeconds = 0;
  assert.equal(roundDeadline(r, 1000), null);
  resetMatch(r, tie, 1000);
  assert.equal(r.deadline, null);
  resolveRound(r, tie, 2000);
  nextRound(r, 3000, tie);
  assert.equal(r.deadline, null);
  r.roundSeconds = 120;
  assert.equal(roundDeadline(r, 1000), 121000);
  r.solo = false;
  assert.equal(roundDeadline(r, 1000), 61000);
});

test("every CPU difficulty produces legal public-information orders across varied positions", () => {
  for (const difficulty of ["easy", "normal", "hard"])
    for (let i = 0; i < 50; i++) {
      const r = fixture(),
        p = r.players[1];
      p.cash = i * 3;
      p.protections = i % 3;
      for (const [j, s] of r.stocks.entries()) {
        s.price = 1 + ((i * 7 + j * 3) % 30);
        p.holdings[s.id] = (i + j) % 8;
      }
      const random = () => ((i * 19) % 101) / 101;
      const order = computerOrder(
        r.stocks,
        [{ target: "coop", effect: 3 }],
        i % 2 ? "coop" : "all",
        p,
        1 + (i % 12),
        random,
        difficulty,
        [{ cash: r.players[0].cash, holdings: r.players[0].holdings }],
      );
      assert.doesNotThrow(() => validateOrder(r, p, order));
    }
});
test("computer difficulty survives match reset and is public without exposing drafts", () => {
  const r = fixture();
  r.players[1].isComputer = true;
  r.players[1].difficulty = "hard";
  resetMatch(r, tie, 1000);
  const state = publicRoom(r, "a");
  assert.equal(state.players[1].difficulty, "hard");
  assert.equal(state.players[1].draft, undefined);
});
