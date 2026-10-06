# Reproducible balance probe

Run `node scripts/balance.mjs`. Each policy plays 4,000 seeded, two-player matches against Captain Cluck using the actual settlement rules and current five-share limit. Market and CPU random streams are independent; each policy starts from the same seed set. All policies see only public information. They use remaining protection cards on their largest position from round 10 onward. No policy sees future news effects or opponent orders.

| Policy | Win rate ± approximate 95% margin | Ties | Mean final assets | Mean CPU assets |
|---|---:|---:|---:|---:|
| Hold; protect late | 12.9% ± 1.0 | 0.8% | 186.7 | 220.5 |
| Concentrate buys in COOP | 53.1% ± 1.5 | 1.2% | 229.2 | 225.1 |
| Buy the lowest-priced stock | 46.8% ± 1.5 | 1.1% | 223.9 | 225.9 |
| Trade on public news expectation | 72.7% ± 1.4 | 0.7% | 252.5 | 225.6 |

This probes a few simple strategies, not optimal play or human enjoyment. Buying creates positive demand, and the bank has unlimited shares, so systematic buying can benefit the buyer’s existing holdings. These simulations can flag a weak computer or concentration incentives; they do not establish multiplayer fairness. No demand, protection, or price rules were changed on the basis of this small policy set. Human playtesting remains necessary.
