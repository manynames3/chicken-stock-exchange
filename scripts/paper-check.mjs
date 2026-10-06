import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const base = process.env.GAME_BROWSER_URL || "http://localhost:8787";
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(base);
  await page.evaluate(async () => {
    const image = new Image();
    image.src = "/assets/chicken-news-logo.png";
    await image.decode();
  });
  const sizes = [];
  for (const width of [320, 360, 375, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    const result = await page.evaluate(async () => {
      const { renderNewspaper, newsStory, renderWaitingNewspaper } = await import("/news.js");
      const { STOCKS, makeDeck } = await import("/game.js");
      const faults = [];
      let maxHeight = 0;
      for (const lang of ["en", "ko"]) {
        for (const event of makeDeck(() => 0.5)) {
          const story = newsStory(event, STOCKS, lang);
          document.querySelector("#app").innerHTML = `<div class="news-slot">${renderNewspaper({ round: 4, event, movements: STOCKS.map(s => ({ stock: s.id, before: 10 })) }, STOCKS, lang)}</div>`;
          const paper = document.querySelector(".held-paper");
          const box = paper.getBoundingClientRect();
          for (const selector of ["h2", ".newspaper-description", ".newspaper-reason", ".newspaper-footer"]) {
            const element = paper.querySelector(selector);
            const rect = element.getBoundingClientRect();
            if (rect.left < box.left || rect.right > box.right + 1 || rect.bottom > box.bottom + 1)
              faults.push(`${lang} ${event.target} ${event.effect}: ${selector} is outside the paper`);
          }
          if (!paper.querySelector(".newspaper-reason p").textContent.includes(story.reason))
            faults.push("The reason is missing from the held paper");
          if (document.documentElement.scrollWidth > innerWidth)
            faults.push(`${lang} ${event.target} ${event.effect}: horizontal overflow`);
          if (parseFloat(getComputedStyle(paper.querySelector(".newspaper-description")).fontSize) < 14)
            faults.push("Story text is too small");
          const holder = document.querySelector(".newspaper-holder");
          const paperHeight = box.height + parseFloat(getComputedStyle(holder).paddingTop) + parseFloat(getComputedStyle(holder).paddingBottom);
          if (paperHeight > holder.clientHeight + 1)
            faults.push(`${lang} ${event.target} ${event.effect}: the fixed news frame cuts off the paper`);
          maxHeight = Math.max(maxHeight, paperHeight);
        }
        document.querySelector("#app").innerHTML = `<div class="news-slot">${renderWaitingNewspaper(lang)}</div>`;
        if (!document.querySelector(".reporter-head") || !document.querySelector(".left-grip"))
          faults.push("The first-edition placeholder must use the same held-paper frame");
      }
      return { faults, maxHeight };
    });
    assert.deepEqual(result.faults, [], `Paper errors at ${width}px`);
    sizes.push({ width, maxHeight: Math.ceil(result.maxHeight) });
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify(sizes));
  console.log("PASS: all 30 bilingual stories and price explanations are printed inside the held paper at phone, tablet and desktop widths.");
} finally {
  await browser.close();
}
