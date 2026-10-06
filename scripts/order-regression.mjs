import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto(process.env.GAME_BROWSER_URL || "http://localhost:8787");
  await page.locator("#player-name").fill("Order regression");
  await page.locator("#solo-timer").selectOption("0");
  await page.locator("#play-solo").click();
  await page.locator(".market-chart").waitFor();
  await page.waitForFunction(
    () => document.querySelector("#connection").textContent === "Connected",
  );
  await page.locator('[data-action="sell"]').click();
  for (const q of [3, 4, 5])
    assert.equal(
      await page.locator(`[data-quantity="${q}"]`).isDisabled(),
      true,
    );
  assert.match(await page.locator("#saved-order").textContent(), /Saved order/);

  // Hold an earlier request before it reaches the server, then change the order.
  let delayed = false;
  await page.route("**/api/rooms/*/action", async (route) => {
    const body = route.request().postDataJSON();
    if (body.type === "draft" && !body.lock && !delayed) {
      delayed = true;
      await new Promise((resolve) => setTimeout(resolve, 700));
    }
    await route.continue();
  });
  await page.locator('[data-quantity="1"]').click();
  await page.waitForTimeout(250);
  assert.equal(delayed, true);
  await page.locator('[data-quantity="2"]').click();
  await page.waitForFunction(
    () =>
      document.querySelector("#draft-status").textContent.startsWith("SAVED") &&
      document
        .querySelector("#saved-order")
        .textContent.includes("SELL 2 COOP"),
  );
  await page.unroute("**/api/rooms/*/action");
  await page.locator("#lock-order").click();
  await page.locator("#skip-reveal").click();
  await page.locator("#lock-order:not([disabled])").waitFor();
  await page.locator('[data-stock="coop"]').click();
  assert.equal(
    await page.locator('[data-action="sell"]').isDisabled(),
    true,
    "Selling the selected stock must be disabled when all its shares were sold.",
  );
  assert.match(
    await page.locator('[data-stock="coop"]').textContent(),
    /0 shares owned/,
  );
  assert.ok(
    !(await page.locator(".order-summary").textContent()).includes(
      "You receive",
    ),
  );
  await page.locator('[data-action="buy"]').click();
  assert.equal(await page.locator('[data-quantity="5"]').isDisabled(), false);
  await page.locator('[data-quantity="5"]').click();
  await page.waitForFunction(() =>
    document.querySelector("#saved-order").textContent.includes("BUY 5 COOP"),
  );
  await page.locator("#protection-choice summary").click();
  await page.locator("#protection").selectOption("coop");
  await page.waitForFunction(() =>
    document.querySelector("#saved-order").textContent.includes("🍗 COOP"),
  );
  assert.equal(
    await page.locator("#protection-choice").evaluate((el) => el.open),
    true,
  );
  await page.locator("#exit-menu").click();
  await page.locator("#resume-table").waitFor();
  await page.locator("#resume-table").click();
  await page.locator(".market-chart").waitFor();
  await page.waitForFunction(
    () => document.querySelector("#connection").textContent === "Connected",
  );
  assert.match(await page.locator("#saved-order").textContent(), /BUY 5 COOP/);
  await page.locator("#round-timer-setting").selectOption("120");
  await page.waitForFunction(
    () =>
      document.querySelector("#round-timer-setting").value === "120" &&
      document.querySelector("#trade-timer").textContent.endsWith("s"),
  );
  await page.locator('[data-chart-view="full"]').click();
  assert.equal(
    await page.locator('[data-chart-view="full"]').getAttribute("aria-pressed"),
    "true",
  );
  await page.locator("#chart-round").selectOption("0");
  assert.match(
    await page.locator(".chart-inspection").textContent(),
    /COOP 10/,
  );
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#restart-solo").click();
  await page.waitForFunction(() =>
    document
      .querySelector(".round-box strong")
      .textContent.trim()
      .startsWith("1"),
  );
  assert.match(
    await page.locator('[data-stock="coop"]').textContent(),
    /2 shares owned/,
  );
  console.log(
    "PASS: zero-share sales blocked, 1–5 trades, delayed draft ordering, exact saved orders, exit/resume, timers, chart inspection and restart.",
  );
} finally {
  await browser.close();
}
