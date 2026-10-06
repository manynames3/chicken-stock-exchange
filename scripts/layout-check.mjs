import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

const base = process.env.GAME_BROWSER_URL || "http://localhost:8787";
await mkdir("screenshots", { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(base);
  await page.locator("#player-name").fill("Layout check");
  await page.locator("#solo-timer").selectOption("0");
  await page.locator("#solo-difficulty").selectOption("easy");
  await page.locator("#play-solo").click();
  await page.locator("#lock-order:not([disabled])").waitFor();
  const positions = () => page.evaluate(() => Object.fromEntries(
    [".players-strip", ".market", ".trading-panel", ".recap-panel", ".activity"].map((selector) => {
      const box = document.querySelector(selector)?.getBoundingClientRect();
      return [selector, box ? { top: box.top + scrollY, left: box.left, width: box.width, height: box.height } : null];
    })
  ));
  await page.evaluate(() => scrollTo(0, 0));
  const before = await positions();
  await page.evaluate(() => document.querySelector("#lock-order").click());
  await page.locator('[data-reveal-stage="4"]').waitFor();
  const news = await positions();

  assert.ok(Math.abs(before[".market"].top - news[".market"].top) < 2,
    "Market board must stay in place when news appears");
  assert.equal(await page.locator(".reveal-dice").isVisible(), true, "Dice are visible immediately");
  assert.match(await page.locator(".dice-rule").textContent(), /Compare the faces/);
  assert.equal(await page.locator(".player-holdings b").count(), 8);
  assert.equal(await page.locator(".stock-tile .owned-shares").count(), 4);
  assert.match(await page.locator('[data-counter="price-coop"]').textContent(), /^\$/);
  assert.match(await page.locator("#trade-stock").textContent(), /\$/);
  assert.equal(await page.evaluate(() => scrollY), 0, "No automatic scrolling on news");
  const settled = await positions();
  await page.screenshot({ path: "screenshots/stable-news-desktop.png", fullPage: true });
  await page.locator("#next-round-control").click();
  await page.locator("#lock-order:not([disabled])").waitFor();
  const next = await positions();
  assert.ok(Math.abs(settled[".recap-panel"].top - next[".recap-panel"].top) < 2,
    "News must stay in place in the next planning round");
  for (const selector of Object.keys(before)) {
    for (const sample of [news, next])
      assert.ok(Math.abs(before[selector].top - sample[selector].top) < 2,
        `${selector} changed position: ${before[selector].top} → ${sample[selector].top}`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#lock-order").waitFor();
  const mobileBefore = await positions();
  await page.evaluate(() => document.querySelector("#lock-order").click());
  await page.locator("#next-round-control").waitFor();
  const mobileResult = await positions();
  await page.screenshot({ path: "screenshots/stable-news-mobile.png", fullPage: true });
  await page.evaluate(() => document.querySelector("#next-round-control").click());
  await page.locator("#lock-order:not([disabled])").waitFor();
  const mobileNext = await positions();
  for (const selector of [".players-strip", ".trading-panel", ".recap-panel", ".activity"]) {
    for (const sample of [mobileResult, mobileNext])
      assert.ok(Math.abs(mobileBefore[selector].top - sample[selector].top) < 2,
        `Mobile ${selector} changed position: ${mobileBefore[selector].top} → ${sample[selector].top}`);
  }
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Overflow at ${width}`);
    assert.ok(await page.locator(".price-equation").evaluateAll(equations => equations.every(equation => {
      const box = equation.getBoundingClientRect();
      return [...equation.children].every(term => term.getBoundingClientRect().right <= box.right + 1);
    })), `Price equation clipped at ${width}`);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('[data-action="buy"]').click();
  await page.locator('[data-quantity="5"]').click();
  await page.locator("#protection-choice summary").click();
  await page.locator("#protection").selectOption("coop");
  await page.waitForFunction(() => document.querySelector("#draft-status").textContent.startsWith("SAVED"));
  const protectedBefore = await positions();
  await page.evaluate(() => document.querySelector("#lock-order").click());
  await page.locator("#next-round-control").waitFor();
  const protectedResult = await positions();
  await page.evaluate(() => document.querySelector("#next-round-control").click());
  await page.locator("#lock-order:not([disabled])").waitFor();
  const protectedNext = await positions();
  for (const selector of [".market", ".trading-panel", ".recap-panel", ".activity"]) {
    for (const sample of [protectedResult, protectedNext])
      assert.ok(Math.abs(protectedBefore[selector].top - sample[selector].top) < 2,
        `Protected purchase moved ${selector}: ${protectedBefore[selector].top} → ${sample[selector].top}`);
  }
  assert.match(await page.title(), /Good News Bad News/);
  assert.ok(await page.locator(".brand-chicken").evaluate(image => image.complete && image.naturalWidth > 0));
  assert.deepEqual(errors, []);
  console.log("PASS: stable market and news across round phases.");
} finally {
  await browser.close();
}
