import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const base = process.env.GAME_BROWSER_URL || "http://localhost:8787";
await mkdir("screenshots", { recursive: true });
const browser = await chromium.launch();
try {
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    page = await context.newPage(),
    errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await context.addInitScript(() => {
    window.__soundStats = { oscillators: 0, stops: 0 };
    window.__gains = [];
    const Audio = window.AudioContext;
    window.AudioContext = class extends Audio {
      createOscillator() {
        const oscillator = super.createOscillator(),
          stop = oscillator.stop.bind(oscillator);
        window.__soundStats.oscillators++;
        oscillator.stop = (...args) => {
          window.__soundStats.stops++;
          return stop(...args);
        };
        return oscillator;
      }
      createGain() {
        const gain = super.createGain();
        window.__gains.push(gain);
        return gain;
      }
    };
  });
  await page.goto(base);
  // Render the actual effects through Web Audio, check the signal, and save listenable previews.
  for (const [name, positive] of [
    ["good-news", true],
    ["bad-news", false],
  ]) {
    const result = await page.evaluate(async (positive) => {
      const { scheduleCue } = await import("/sound.js");
      const context = new OfflineAudioContext(1, 48000 * 3, 48000);
      const duration = scheduleCue(
        context,
        context.destination,
        "news",
        positive,
        0,
      );
      const buffer = await context.startRendering(),
        samples = buffer.getChannelData(0);
      return { duration, samples: Array.from(samples) };
    }, positive);
    const peak = result.samples.reduce(
        (peak, value) => Math.max(peak, Math.abs(value)),
        0,
      ),
      energy =
        result.samples.reduce((sum, v) => sum + v * v, 0) /
        result.samples.length;
    assert.ok(
      peak > 0.03 && peak < 0.4,
      `${name} has audible signal and headroom: ${peak}`,
    );
    assert.ok(result.duration > 1.5 && result.duration < 2.5);
    assert.ok(energy > 0.00001);
    const bytes = Buffer.alloc(44 + result.samples.length * 2);
    bytes.write("RIFF", 0);
    bytes.writeUInt32LE(bytes.length - 8, 4);
    bytes.write("WAVEfmt ", 8);
    bytes.writeUInt32LE(16, 16);
    bytes.writeUInt16LE(1, 20);
    bytes.writeUInt16LE(1, 22);
    bytes.writeUInt32LE(48000, 24);
    bytes.writeUInt32LE(96000, 28);
    bytes.writeUInt16LE(2, 32);
    bytes.writeUInt16LE(16, 34);
    bytes.write("data", 36);
    bytes.writeUInt32LE(result.samples.length * 2, 40);
    result.samples.forEach((v, i) =>
      bytes.writeInt16LE(Math.round(v * 32767), 44 + i * 2),
    );
    await writeFile(`screenshots/${name}.wav`, bytes);
  }
  await page.locator("#player-name").fill("News reader");
  await page.locator("#solo-timer").selectOption("0");
  await page.locator("#solo-difficulty").selectOption("easy");
  await page.locator("#play-solo").click();
  await page.locator("#lock-order:not([disabled])").waitFor();
  await page.locator("#lock-order").click();
  await page.locator('[data-reveal-stage="1"]').waitFor();
  assert.equal(await page.locator(".newspaper").isVisible(), true);
  assert.equal(await page.locator(".reveal-dice").isVisible(), false);
  assert.equal(
    await page.evaluate(() => window.__soundStats.oscillators),
    0,
    "Muted news schedules no audio",
  );
  await page.waitForTimeout(1200);
  assert.equal(
    await page.locator(".reveal-dice").isVisible(),
    false,
    "Readers get time for the headline before dice",
  );
  await page.locator("#skip-animation").click();
  await page.locator("#replay-news-sound").click();
  assert.equal(
    await page.locator("#sound-button").getAttribute("aria-pressed"),
    "true",
  );
  assert.ok(
    (await page.evaluate(() => window.__soundStats.oscillators)) > 3,
    "The dramatic effect plays",
  );
  await page.locator("#sound-button").click();
  assert.equal(
    await page.locator("#sound-button").getAttribute("aria-pressed"),
    "false",
  );
  // AudioParam changes become observable on the next audio processing quantum.
  await page.waitForFunction(() => window.__gains[0].gain.value === 0, null, {
    timeout: 1000,
  });
  await page.locator("#skip-reveal").click();
  await page.locator("#read-last-news").waitFor();
  await page.locator("#read-last-news").click();
  await page.waitForFunction(
    () =>
      document.querySelector(".newspaper").getBoundingClientRect().top <
      innerHeight - 100,
  );
  const samples = await page.evaluate(async () => {
    const { STOCKS } = await import("/game.js");
    return {
      stocks: STOCKS,
      movements: STOCKS.map((s) => ({ stock: s.id, before: 10 })),
    };
  });
  const preview = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  await preview.goto(base);
  for (const [edition, event] of [
    ["good", { target: "coop", effect: 3 }],
    ["bad", { target: "wing", effect: -2 }],
  ]) {
    await preview.evaluate(
      async ({ samples, event }) => {
        const { renderNewspaper } = await import("/news.js");
        document.querySelector("#app").innerHTML = renderNewspaper(
          { round: 4, event, movements: samples.movements },
          samples.stocks,
        );
      },
      { samples, event },
    );
    await preview
      .locator(".newspaper")
      .screenshot({ path: `screenshots/newspaper-${edition}.png` });
    for (const width of [320, 390, 768, 1440]) {
      await preview.setViewportSize({ width, height: 1000 });
      assert.ok(
        await preview.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${edition} newspaper overflow at ${width}`,
      );
    }
  }
  await preview.setViewportSize({ width: 390, height: 844 });
  await preview
    .locator(".newspaper")
    .screenshot({ path: "screenshots/newspaper-mobile.png" });
  await preview.locator("#language").click();
  // The real in-game language toggle rebuilds the complete recap in Korean.
  await page.locator("#language").click();
  assert.match(
    await page.locator(".newspaper-masthead").textContent(),
    /꼬꼬일보/,
  );
  const mutedBefore = await page.evaluate(
    () => window.__soundStats.oscillators,
  );
  await page.locator("#lock-order:not([disabled])").waitFor();
  await page.locator("#lock-order").click();
  await page.locator(".reveal-news:not([hidden])").waitFor();
  assert.equal(
    await page.evaluate(() => window.__soundStats.oscillators),
    mutedBefore,
    "Mute also applies to subsequent news",
  );
  await page.locator("#skip-animation").click();
  await page.locator("#skip-reveal").click();
  await page.locator("#sound-button").click();
  const enabledBefore = await page.evaluate(
    () => window.__soundStats.oscillators,
  );
  await page.locator("#lock-order:not([disabled])").waitFor();
  await page.locator("#lock-order").click();
  await page.locator('[data-reveal-stage="1"]').waitFor();
  const automatic = await page.evaluate(() => window.__soundStats.oscillators);
  assert.ok(
    automatic - enabledBefore >= 7,
    "News automatically plays the dramatic effect when enabled",
  );
  await page.locator("#language").click();
  assert.equal(
    await page.evaluate(() => window.__soundStats.oscillators),
    automatic,
    "Re-rendering the newspaper does not replay the news cue",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: bilingual newspaper, reading interval, mobile widths, repeatable sound previews, live replay, immediate mute and future muted rounds.",
  );
} finally {
  await browser.close();
}
