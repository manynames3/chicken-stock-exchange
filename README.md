# 주식 · Chicken Stock Exchange

A bilingual stock-market board game using the supplied chicken artwork and physical prototype. Play solo against **Captain Cluck**, or invite **2–4 friends** to a private room. No account is required.

## Play

- Frontend: https://chicken-stock-exchange.pages.dev
- Room server: https://chicken-stock-exchange-server.hangi87.workers.dev

Enter a name and choose **Play vs computer**, or **Create a room** and share the invitation. The 한국어 / English button switches languages. Refreshing on the same browser restores your seat. Seats are device-local; clearing browser storage removes your reconnect token.

Solo games offer 60-second, 120-second, or untimed rounds. **Exit to menu** pauses a solo match and **Resume previous table** restores it, including the saved order. **Restart** begins a fresh match. Multiplayer games continue when a player returns to the menu; their saved seat can reconnect.

The trade preview shows exact cash and share changes. Quantity buttons are limited by available cash or owned shares, and selling is disabled for a selected stock with zero holdings. The saved-order box separately shows what will execute; unsaved changes never replace it. Chart lines use distinct patterns and markers, a labeled current-price column, a round inspector, and played/full-round views.

## Rules

Each player begins with 100 coins, two shares of each of four stocks, and two roast-chicken protection cards. All stocks begin at 10 coins.

Each of 12 rounds:

1. See the upcoming news target. Its direction and magnitude remain secret.
2. Within 60 seconds (or the solo timer setting), buy or sell 1–5 shares of one stock, or hold. Optionally protect one stock held after trading. Valid drafts are saved; locking is final. All locked players resolve early.
3. Execute every order at the same pre-news prices. The bank has unlimited shares. No borrowing or short selling.
4. Reveal news (−3, −2, −1, +1, +2, or +3), add demand (net buys +1, net sells −1, balanced 0), and add the shared dice result (red wins +1, blue wins −1, tie 0).
5. Clamp prices to 0–30. For protected shares held after trading, pay the actual price decrease multiplied by shares. The protection card is spent even when the price rises.
6. Permanently delist stocks at 0 and remove their shares after protection is paid. Show an eight-second recap; everyone may skip it together.

The 30-card deck contains all six news effects for each stock and the whole market. Discarded news, cash, and holdings are public. Pending orders, protection choices, and the remaining deck are private. Highest cash plus final share value wins; equal scores share victory. All stocks delisting ends the match early.

Captain Cluck uses only public information: prices, owned shares, the news target, and discarded cards. The computer estimates remaining news effects, preserves a cash reserve, takes profits near the ceiling, and uses protection against exposure. It commits before human orders, with no access to their drafts or future card effects.

## Run locally

Requires Node.js 22+.

```sh
npm ci
npm run dev
```

Open http://localhost:8787. Wrangler runs the frontend, Worker, WebSockets, and SQLite-backed Durable Objects locally. There are **no production npm dependencies**.

## Verify

```sh
npm test
npm run test:integration
node scripts/browser-check.mjs
node scripts/order-regression.mjs
node scripts/timer-check.mjs
node scripts/balance.mjs
```

Run the dev server before integration, browser, or deadline checks. Install Chromium for browser verification with `npx playwright install chromium` if needed.

- Unit tests cover shared client/server validation, settlement, protection, caps, delisting, privacy, the deck, match completion, conditional news estimates, and computer legality.
- Integration tests run full multiplayer and computer matches, authenticated WebSockets, zero-share rejection, reconnect, solo pause/resume/timers/restart, and rematches.
- Browser checks exercise solo trading, bilingual rules, multiplayer, and responsive widths.
- The order regression checks unavailable sales, delayed draft requests, exact saved orders, five-share trades, and solo controls.
- The deadline check waits for the real 60-second timeout without an open browser.
- The seeded simulation writes its reproducible results and limitations to [docs/balance.md](docs/balance.md).

Set `GAME_TEST_URL` or `GAME_BROWSER_URL` to verify a deployed environment. Scripts create temporary game rooms, which expire automatically.

## Deployment

The repository has two Cloudflare deployments:

- **Pages** serves the static frontend built into `dist/`.
- **Worker** owns one Durable Object per room, persistent state, deadlines, random outcomes, and viewer-specific WebSocket updates. SQLite migration `v1` creates the room class.

```sh
npx wrangler login
npm run deploy:server
GAME_SERVER_URL=https://chicken-stock-exchange-server.hangi87.workers.dev npm run build
npm run deploy:pages
```

Before deploying to another account, change `account_id` and `FRONTEND_ORIGIN` in `wrangler.jsonc`; use the Worker URL returned by deployment when building. The build writes that public origin into `config.js` and restricts the production CSP to it.

GitHub Actions runs rules tests and a build on pushes and pull requests. The manual **Deploy** workflow publishes both deployments when `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets are configured; never commit credentials. Its token needs Workers Scripts, Durable Objects, and Pages deployment access for the target account.

Room creation is limited to 30 rooms per IP per hour. Rooms expire after 24 hours without a player action. Stored seat tokens authorize access; only the current viewer's draft enters their state response. Clients submit commands with match and round identifiers to reject stale clicks. A server queue serializes commands, WebSocket authentication, and alarm resolution.

## Source map

- `src/rules.js`: rules and public-information computer strategy.
- `src/worker.js`: API, room persistence, WebSocket delivery, and alarms.
- `public/app.js`, `public/style.css`: bilingual responsive game UI.
- `public/order.js`: shared quantity bounds and order validation used by the browser and server.
- `public/board.js`: chart rendering with accessible round inspection.
- `public/assets/`: supplied character card and generated physical-game concept.
- `test/`, `scripts/`: reproducible validation and build scripts.

The five-share limit preserves one stock per round and prevents unlimited position swings. Functional checks and a small seeded balance probe are included; match length and competitive balance still need human playtesting. This is a fictional board game, not a brokerage integration.

## Artwork

The original chicken/news card artwork was supplied by the project owner. The physical-game concept was generated from the supplied prototype and character references. These assets are included for this game; no third-party asset license is asserted.
