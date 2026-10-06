import test from "node:test";
import assert from "node:assert/strict";
import { newsStory, renderNewspaper } from "../public/news.js";
import { STOCKS, makeDeck } from "../public/game.js";
test("every card has a distinct bilingual story with its exact news effect", () => {
  for (const lang of ["en", "ko"]) {
    const titles = new Set(), descriptions = new Set(), reasons = new Set();
    for (const event of makeDeck(() => 0.5)) {
      const story = newsStory(event, STOCKS, lang);
      titles.add(story.heading);
      descriptions.add(story.description);
      reasons.add(story.reason);
      assert.equal(story.positive, event.effect > 0);
      assert.ok(story.description.length > 35);
      assert.ok(story.reason.length > 35);
      assert.ok(story.body.includes(String(Math.abs(event.effect))));
      const paper = renderNewspaper(
        {
          round: 3,
          event,
          movements: STOCKS.map((s) => ({ stock: s.id, before: 10 })),
        },
        STOCKS,
        lang,
      );
      assert.ok(paper.includes(story.heading));
      assert.ok(paper.includes(story.description));
      assert.ok(paper.includes(story.reason));
      assert.match(paper, /held-paper/);
      assert.match(paper, /reporter-head/);
      assert.match(paper, /left-grip/);
      assert.ok(paper.includes(lang === "en" ? "IN THIS GAME" : "이 게임에서는"));
      assert.ok(
        paper.includes(lang === "en" ? "Trades and dice" : "거래와 주사위"),
      );
    }
    assert.equal(titles.size, 30);
    assert.equal(descriptions.size, 30);
    assert.equal(reasons.size, 30);
  }
});
test("the paper marks delisted targets and escapes stock names", () => {
  const stocks = STOCKS.map((s) => ({ ...s, en: "<script>test</script>" }));
  const paper = renderNewspaper(
    {
      round: 2,
      event: { target: "coop", effect: 3 },
      movements: [{ stock: "coop", before: 0 }],
    },
    stocks,
  );
  assert.match(paper, /inactive-target/);
  assert.match(paper, /Delisted stocks stay at zero/);
  assert.ok(!paper.includes("<script>"));
  assert.match(paper, /\+\$3/);
});
