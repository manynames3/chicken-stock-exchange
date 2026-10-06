# Good News Bad News · 주식

A bilingual stock-market board game using the supplied chicken artwork and physical prototype. Play solo against **Captain Cluck**, or create a private table for **2–4 human and computer players**. No account is required.

## Play

- Frontend: https://chicken-stock-exchange.pages.dev
- Room server: https://chicken-stock-exchange-server.hangi87.workers.dev

Enter a name and choose **Play vs computer**, or **Create a room** and share the invitation. The 한국어 / English button switches languages. Refreshing on the same browser restores your seat. Seats are device-local; clearing browser storage removes your reconnect token.

Solo games offer 60-second, 120-second, or untimed rounds. **Exit to menu** pauses a solo match and **Resume previous table** restores it, including the saved order. **Restart** begins a fresh match. Multiplayer games continue when a player returns to the menu; their saved seat can reconnect.

**How to play → Practice tutorial** offers three optional, untimed lessons: buying, a price drop, and protection. The scripted tutorial uses the same settlement engine as real matches, never sends live orders, and pauses an active solo table until you close help. Normal games have no automatic onboarding. Multiplayer tables continue while help is open.

Choose **Easy**, **Normal**, or **Hard** before a solo match. In a multiplayer lobby, the host may add, remove, or change a computer’s level; computers are always ready. Waiting and connection labels show exactly who is missing or not ready.

Resolved news, dice, prices, and settlement are available immediately. Desktop play uses a compact table with **market | newspaper | trade** side by side, sized to the available viewport. A slim scoreboard keeps totals, cash, and share counts visible. Phones and tablets use fixed **Market / News / Trade** tabs; a new-edition badge appears when news arrives in another tab, and the game never switches tabs or scrolls the page automatically. Captain Cluck holds the actual HTML newspaper, with the headline, story, full price explanation, and game effect printed on it. **Expand newspaper** opens the full edition in an accessible dialog. All 30 cards have distinct English and Korean descriptions and explanations connecting sales, costs, and expected earnings to share value. A compact dice strip explains red higher +$1, blue higher −$1, or a tie. **Round details** folds away orders, price equations, settlement, and protection payouts. The journal and detailed chart history remain available. The order button stays in a permanent footer; optional fields can scroll inside the trade panel on smaller screens. Short screens and long editions can scroll inside their panel, preserving readable text and the table's position. The trading panel keeps disabled controls during results and offers **Next round now** immediately; the automatic countdown remains visible. Prices use `$`. Optional good-news effects combine a brass fanfare and cartoon clucks; bad news gets a comic trombone slide and squeak. The paper can replay the effect and enable sound, and muting stops active effects immediately. Sound is off by default. The finale compares total assets over time, highlights the best and worst round, shows protection payouts, and offers a rematch. The title and branding use **Good News Bad News** and its newspaper-holding chicken mascot.

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

All computer levels use only public information: prices, cash, holdings, the news target, and discarded cards. Easy uses a simple heuristic. Normal mixes that policy with evaluation of legal trades. Hard evaluates quantities and protection against remaining public news, dice odds, estimated opponent demand, and delisting risk. Computers commit before human orders and never see their drafts or future card effects. Difficulty changes their decisions, not the rules.

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
node scripts/experience-check.mjs
node scripts/news-check.mjs
node scripts/paper-check.mjs
node scripts/layout-check.mjs
node scripts/timer-check.mjs
node scripts/balance.mjs
```

Run the dev server before integration, browser, or deadline checks. Install Chromium for browser verification with `npx playwright install chromium` if needed.

- Unit tests cover shared client/server validation, settlement, protection, caps, delisting, privacy, the deck, match completion, conditional news estimates, all CPU levels, the isolated tutorial, and finale calculations.
- Integration tests run full multiplayer and computer matches, authenticated WebSockets, zero-share rejection, reconnect, solo pause/resume/timers/restart, mixed computer lobbies, host permissions, and rematches.
- Browser checks exercise solo trading, bilingual rules, multiplayer, and responsive widths.
- The order regression checks unavailable sales, delayed draft requests, exact saved orders, five-share trades, and solo controls.
- The experience check verifies optional practice, live draft preservation, keyboard focus, mobile layout, immediate results and reduced motion, lobby computers, and a full-match finale.
- The news check covers bilingual papers, phone widths, immediate results, automatic and replayed effects, immediate mute, and offline waveform headroom. It saves listenable previews in `screenshots/`.
- The paper check verifies every English/Korean card at seven screen widths: the story and explanation stay inside the held newspaper, text stays readable, and expanded editions fit their frame, and compact editions retain the complete explanation without clipping it out of the paper.
- The layout check (also available as `node scripts/table-check.mjs`) verifies desktop viewport fit, fixed panels through round transitions, no automatic scrolling or tab switching, unread news badges, keyboard tabs, expanded-paper focus, visible holdings, dollar prices, and protection controls.
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

- `public/game.js`: shared pure settlement rules and public-information computer strategies; `src/rules.js` re-exports them for the authoritative server.
- `src/worker.js`: API, room persistence, WebSocket delivery, and alarms.
- `public/app.js`, `public/style.css`: bilingual responsive game UI.
- `public/order.js`: shared quantity bounds and order validation used by the browser and server.
- `public/board.js`: chart rendering with accessible round inspection.
- `public/tutorial.js`: isolated practice lessons using the shared engine.
- `public/presentation.js`: price equations, finale history, and character markup.
- `public/news.js`: bilingual newspaper editions and playful news stories.
- `public/sound.js`: optional procedural audio and a shared offline render function.
- `public/assets/`: supplied character card, generated expression sheet, and physical-game concept.
- `test/`, `scripts/`: reproducible validation and build scripts.

The five-share limit preserves one stock per round and prevents unlimited position swings. Functional checks and a 24,000-match seeded balance probe are included; match length and competitive balance still need human playtesting. This is a fictional board game, not a brokerage integration.

## Artwork

The original chicken/news card artwork was supplied by the project owner. The physical-game concept was generated from the supplied prototype and character references. The expression sheet was generated with the built-in image-generation tool using the supplied card as a character reference; its prompt and provenance are in [docs/artwork.md](docs/artwork.md). These assets are included for this game; no third-party asset license is asserted.

The remaining human validation is described in [docs/playtest.md](docs/playtest.md). Automated simulations do not establish human enjoyment or multiplayer balance.
