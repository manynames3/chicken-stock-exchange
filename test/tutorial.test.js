import test from "node:test";
import assert from "node:assert/strict";
import {
  createTutorial,
  tutorialTurn,
  nextTutorialLesson,
} from "../public/tutorial.js";
import {
  matchInsights,
  scoreHistory,
  priceEquation,
} from "../public/presentation.js";
import { portfolio } from "../src/rules.js";
test("practice uses real settlements for a purchase, a loss, and protection, without changing another game", () => {
  const state = createTutorial(),
    other = createTutorial(),
    before = structuredClone(other);
  assert.equal(portfolio(state.room.players[0], state.room.stocks), 180);
  assert.equal(tutorialTurn(state, "hold"), false);
  assert.equal(tutorialTurn(state, "buy"), true);
  assert.equal(state.room.players[0].cash, 80);
  assert.equal(state.room.players[0].holdings.coop, 4);
  assert.equal(state.room.stocks[0].price, 13);
  assert.equal(tutorialTurn(state, "buy"), false);
  assert.equal(nextTutorialLesson(state), true);
  tutorialTurn(state, "hold");
  assert.equal(portfolio(state.room.players[0], state.room.stocks), 174);
  nextTutorialLesson(state);
  tutorialTurn(state, "protect");
  assert.equal(state.room.players[0].cash, 88);
  assert.equal(state.room.players[0].protections, 1);
  assert.equal(portfolio(state.room.players[0], state.room.stocks), 174);
  assert.equal(nextTutorialLesson(state), false);
  assert.deepEqual(other, before);
  const insights = matchInsights(state.room, "learner");
  assert.equal(insights.protection, 8);
  assert.deepEqual(insights.best, { round: 1, delta: 12 });
  assert.deepEqual(insights.worst, { round: 2, delta: -18 });
  assert.deepEqual(
    insights.history.map((p) => p.value),
    [180, 192, 174, 174],
  );
  for (const recap of state.room.recaps) delete recap.settlements;
  assert.deepEqual(
    scoreHistory(state.room, "learner").map((p) => p.value),
    [180, 192, 174, 174],
  );
});
test("price equations account for dice, caps and permanent delisting", () => {
  assert.match(
    priceEquation({ before: 29, news: 3, demand: 1, after: 30 }, 1),
    /capped at/,
  );
  assert.match(
    priceEquation({ before: 0, news: 3, demand: 1, after: 0 }, 1),
    /Already delisted/,
  );
});
