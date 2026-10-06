# Reproducible balance probe

Run `node scripts/balance.mjs`. Each policy plays 2,000 seeded, two-player matches against each of Easy, Normal, and Hard Captain Cluck using the actual settlement rules and current five-share limit. Market and CPU random streams are independent; each policy starts from the same seed set. All policies see only public information. They use remaining protection cards on their largest position from round 10 onward. No policy sees future news effects or opponent orders.

| CPU level | Policy | Win rate ± approximate 95% margin | Ties | Mean final assets | Mean CPU assets |
|---|---|---:|---:|---:|---:|
| easy | Hold; protect late | 13.3% ± 1.5 | 0.9% | 186.6 | 220.1 |
| easy | Concentrate buys in COOP | 53.6% ± 2.2 | 1.1% | 229.8 | 224.8 |
| easy | Buy the lowest-priced stock | 46.9% ± 2.2 | 1.1% | 224.3 | 225.7 |
| easy | Trade on public news expectation | 73.6% ± 1.9 | 0.8% | 252.6 | 225.2 |
| normal | Hold; protect late | 8.5% ± 1.2 | 0.1% | 188.8 | 251.6 |
| normal | Concentrate buys in COOP | 29.3% ± 2.0 | 1.1% | 230.9 | 256.4 |
| normal | Buy the lowest-priced stock | 22.9% ± 1.8 | 0.8% | 225.3 | 256.2 |
| normal | Trade on public news expectation | 48.0% ± 2.2 | 1.1% | 253.6 | 256.7 |
| hard | Hold; protect late | 4.2% ± 0.9 | 0.1% | 189.7 | 277.6 |
| hard | Concentrate buys in COOP | 15.0% ± 1.6 | 0.6% | 230.1 | 283.4 |
| hard | Buy the lowest-priced stock | 10.9% ± 1.4 | 0.4% | 220.9 | 283.2 |
| hard | Trade on public news expectation | 29.6% ± 2.0 | 0.8% | 250.7 | 282.3 |

This probes a few simple strategies, not optimal play or human enjoyment. Buying creates positive demand, and the bank has unlimited shares, so systematic buying can benefit the buyer’s existing holdings. These simulations can flag a weak computer or concentration incentives; they do not establish multiplayer fairness. Normal and Hard evaluate legal trades against remaining public news, dice odds, and estimated opponent demand from public positions. Normal sometimes uses a simpler policy; Hard consistently evaluates all quantities and protection choices. These levels change computer choices, not demand, protection, price rules, or hidden information. Opponent-demand estimates are approximations, not access to pending orders. The five-share limit remains provisional pending human comparison with the earlier three-share version. Human playtesting remains necessary.
