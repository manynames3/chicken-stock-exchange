import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const base = process.env.GAME_BROWSER_URL || "http://localhost:8787";
await mkdir("screenshots", { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(base);
  await page.locator("#sound-button").click();
  assert.equal(
    await page.locator("#sound-button").getAttribute("aria-pressed"),
    "true",
  );
  await page.reload();
  assert.equal(
    await page.locator("#sound-button").getAttribute("aria-pressed"),
    "true",
    "Sound preference persists",
  );
  await page.locator("#sound-button").click();
  await page.locator("#practice-button").click();
  assert.match(await page.locator(".asset-explanation").textContent(), /180/);
  assert.equal(await page.locator(".game-layout").count(), 0);
  await page.locator('[data-tutorial-choice="buy"]').click();
  assert.match(
    await page.locator(".tutorial-outcome").textContent(),
    /180 → 192/,
  );
  await page.locator("#tutorial-next").click();
  await page.locator('[data-tutorial-choice="hold"]').click();
  assert.match(
    await page.locator(".tutorial-outcome").textContent(),
    /192 → 174/,
  );
  await page.locator("#tutorial-next").click();
  await page.locator('[data-tutorial-choice="protect"]').click();
  assert.match(
    await page.locator(".tutorial-outcome").textContent(),
    /174 → 174/,
  );
  await page.screenshot({
    path: "screenshots/tutorial-complete.png",
    fullPage: true,
  });
  await page.locator("#rules-done").click();
  await page.locator("#player-name").fill("Experience");
  await page.locator("#solo-timer").selectOption("0");
  await page.locator("#solo-difficulty").selectOption("hard");
  await page.locator("#play-solo").click();
  await page.locator(".game-layout").waitFor();
  await page.waitForFunction(
    () => document.querySelector("#connection").textContent === "Connected",
  );
  assert.equal(await page.locator("#app .tutorial-board").count(), 0);
  assert.equal(
    await page.locator("#rules-dialog").evaluate((el) => el.open),
    false,
  );
  assert.match(await page.locator(".game-top .eyebrow").textContent(), /Hard/);
  await page.locator('[data-action="buy"]').focus();
  await page.keyboard.press("Enter");
  assert.equal(
    await page
      .locator('[data-action="buy"]')
      .evaluate((el) => el === document.activeElement),
    true,
    "Keyboard focus survives rendering",
  );
  await page.locator('[data-quantity="2"]').click();
  await page.waitForFunction(() =>
    document.querySelector("#draft-status").textContent.startsWith("SAVED"),
  );
  await page.locator('[data-quantity="3"]').click();
  const before = await page.locator(".order-summary > strong").textContent();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#rules-button").click();
  await page.locator("#help-tutorial").click();
  await page.locator("#tutorial-reset").click();
  await page.locator('[data-tutorial-choice="buy"]').click();
  await page.locator(".tutorial-outcome").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "screenshots/upgraded-mobile-tutorial.png",
    fullPage: true,
  });
  assert.ok(
    await page.locator("#rules-done").evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.bottom <= innerHeight && r.top >= 0;
    }),
    "Mobile help footer remains reachable",
  );
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator("#lock-order:not([disabled])").waitFor();
  assert.equal(
    await page.locator("#saved-order").textContent(),
    `Saved order: ${before}`,
    "Practice preserves the latest valid draft even before autosave completes",
  );
  assert.match(await page.locator(".round-box strong").textContent(), /^1/);
  await page.screenshot({
    path: "screenshots/upgraded-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  // Desktop history was open, so explicitly close it to verify the mobile default flow.
  if (await page.locator("#market-history").evaluate((el) => el.open))
    await page.locator("#market-history > summary").click();
  const stockRect = await page.locator(".stock-tiles").boundingBox(),
    tradeRect = await page.locator(".trading-panel").boundingBox(),
    historyRect = await page.locator("#market-history").boundingBox();
  assert.ok(
    stockRect.y < tradeRect.y && tradeRect.y < historyRect.y,
    "Mobile stocks and trading precede the chart",
  );
  assert.ok(
    tradeRect.width > 350 && stockRect.width > 350,
    "Mobile controls use the available width",
  );
  await page.screenshot({
    path: "screenshots/upgraded-mobile.png",
    fullPage: true,
  });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `Overflow at ${width}`,
    );
  }
  await page.locator("#lock-order").click();
  await page.locator('[data-reveal-stage="0"]').waitFor();
  assert.equal(await page.locator(".reveal-news").isVisible(), false);
  assert.equal(
    await page.locator("#trade-stock").count(),
    0,
    "No final price in a stale trade panel during the reveal",
  );
  assert.equal(
    await page.locator(".journal-round").count(),
    0,
    "The journal does not skip ahead of the first reveal",
  );
  assert.equal(
    await page.locator(".player-meta").first().isVisible(),
    false,
    "Final cash is shown at settlement",
  );
  await page.locator('[data-reveal-stage="1"]').waitFor();
  assert.equal(await page.locator(".reveal-news").isVisible(), true);
  assert.equal(await page.locator(".reveal-dice").isVisible(), false);
  await page.locator('[data-reveal-stage="2"]').waitFor();
  assert.equal(await page.locator(".reveal-dice").isVisible(), true);
  await page.locator("#skip-animation").click();
  await page.locator('[data-reveal-stage="4"]').waitFor();
  assert.equal(await page.locator(".recap-panel .price-equation").count(), 4);
  await page.locator("#skip-reveal").click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (let round = 2; round <= 12; round++) {
    await page.locator("#lock-order:not([disabled])").waitFor();
    await page.locator("#lock-order").click();
    if (round === 12) break;
    if (await page.locator(".finale").count()) break;
    await page.locator("#skip-reveal").click();
  }
  await page.locator(".finale").waitFor();
  assert.equal(await page.locator(".match-highlights > div").count(), 4);
  await page.locator(".asset-history details > summary").click();
  const lastRound = Number(
    (await page.locator(".round-box strong").textContent())
      .split("/")[0]
      .trim(),
  );
  assert.equal(
    await page.locator(".history-table tbody tr").count(),
    lastRound + 1,
  );
  await page.screenshot({
    path: "screenshots/upgraded-finale.png",
    fullPage: true,
  });
  await page.locator("#rematch").click();
  await page.locator("#lock-order:not([disabled])").waitFor();
  await page.locator("#exit-menu").click();
  await page.locator("#create-room").waitFor();
  await page.locator("#create-room").click();
  await page.locator("#lobby-status").waitFor();
  assert.match(
    await page.locator("#lobby-status").textContent(),
    /Waiting for one more/,
  );
  await page.locator("#lobby-difficulty").selectOption("hard");
  await page.locator("#add-computer").click();
  await page.waitForFunction(
    () => document.querySelectorAll("[data-remove-computer]").length === 1,
  );
  assert.match(await page.locator(".seats").textContent(), /Hard/);
  await page.locator("[data-computer-level]").selectOption("easy");
  await page.waitForFunction(
    () => document.querySelector("[data-computer-level]").value === "easy",
  );
  await page.locator("#ready").click();
  await page.locator("#start-game:not([disabled])").waitFor();
  await page.screenshot({
    path: "screenshots/upgraded-lobby.png",
    fullPage: true,
  });
  await page.locator("#start-game").click();
  await page.locator(".game-layout").waitFor();
  await page.waitForFunction(
    () => document.querySelector("#connection").textContent === "Connected",
  );
  await page.locator("#lock-order").click();
  await page.locator("#skip-reveal").waitFor();
  assert.match(
    await page.locator(".revealed-orders").textContent(),
    /Captain Cluck/,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: optional isolated tutorial, Hard CPU, keyboard focus, live draft preservation, mobile ordering, staged/reduced-motion reveals, finale and computer lobby.",
  );
} finally {
  await browser.close();
}
