import { writeFile } from "node:fs/promises";
import {
  newPlayer,
  resetMatch,
  resolveRound,
  nextRound,
  computerOrder,
  expectedNews,
  portfolio,
  HOLD,
  validateOrder,
} from "../src/rules.js";
import { maxShares } from "../public/order.js";
function random(seed) {
  let n = seed >>> 0;
  return () => {
    n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
    return n / 4294967296;
  };
}
function protection(room, player, order) {
  if (room.round < 10 || !player.protections) return order;
  const exposure = room.stocks
    .filter((s) => !s.delisted)
    .map((s) => ({
      id: s.id,
      value:
        s.price *
        (player.holdings[s.id] +
          (order.stock === s.id
            ? order.action === "buy"
              ? order.quantity
              : order.action === "sell"
                ? -order.quantity
                : 0
            : 0)),
    }));
  exposure.sort((a, b) => b.value - a.value);
  return exposure[0]?.value > 0
    ? { ...order, protection: exposure[0].id }
    : order;
}
const strategies = {
  "Hold; protect late": () => ({ ...HOLD }),
  "Concentrate buys in COOP": (r, p) => {
    const q = maxShares(r.stocks, p, "buy", "coop");
    return q ? { action: "buy", stock: "coop", quantity: q } : { ...HOLD };
  },
  "Buy the lowest-priced stock": (r, p) => {
    const s = r.stocks
      .filter((s) => maxShares(r.stocks, p, "buy", s.id) > 0)
      .sort((a, b) => a.price - b.price)[0];
    return s
      ? {
          action: "buy",
          stock: s.id,
          quantity: maxShares(r.stocks, p, "buy", s.id),
        }
      : { ...HOLD };
  },
  "Trade on public news expectation": (r, p, hint) => {
    const ranked = r.stocks
      .filter((s) => !s.delisted)
      .map((s) => ({ s, e: expectedNews(r.discards, hint, s.id) }))
      .sort((a, b) => b.e - a.e);
    const positive = ranked.find(
      ({ s, e }) => e >= 0 && maxShares(r.stocks, p, "buy", s.id) > 0,
    );
    if (positive)
      return {
        action: "buy",
        stock: positive.s.id,
        quantity: maxShares(r.stocks, p, "buy", positive.s.id),
      };
    const negative = ranked
      .reverse()
      .find(({ s, e }) => e < 0 && maxShares(r.stocks, p, "sell", s.id) > 0);
    return negative
      ? {
          action: "sell",
          stock: negative.s.id,
          quantity: maxShares(r.stocks, p, "sell", negative.s.id),
        }
      : { ...HOLD };
  },
};
const count = 4000;
const rows = [];
for (const [label, strategy] of Object.entries(strategies)) {
  let wins = 0,
    ties = 0,
    sum = 0,
    cpuSum = 0;
  for (let seed = 1; seed <= count; seed++) {
    const market = random(seed),
      cpu = random(seed ^ 0xa42f3c9);
    const room = {
      players: [
        newPlayer("human", "Strategy", ""),
        newPlayer("cpu", "Captain Cluck", ""),
      ],
    };
    resetMatch(room, market, 0);
    while (room.phase !== "ended") {
      const hint = room.deck[room.discards.length].target; // The public hint, never the effect.
      room.players[0].draft = validateOrder(
        room,
        room.players[0],
        protection(
          room,
          room.players[0],
          strategy(room, room.players[0], hint),
        ),
      );
      room.players[1].draft = computerOrder(
        room.stocks,
        room.discards,
        hint,
        room.players[1],
        room.round,
        cpu,
      );
      validateOrder(room, room.players[1], room.players[1].draft);
      resolveRound(room, market, 0);
      if (room.phase === "reveal") nextRound(room, 0);
    }
    const a = portfolio(room.players[0], room.stocks),
      b = portfolio(room.players[1], room.stocks);
    if (a > b) wins++;
    else if (a === b) ties++;
    sum += a;
    cpuSum += b;
  }
  const p = wins / count,
    uncertainty = 1.96 * Math.sqrt((p * (1 - p)) / count) * 100;
  rows.push(
    `| ${label} | ${(p * 100).toFixed(1)}% ± ${uncertainty.toFixed(1)} | ${((ties / count) * 100).toFixed(1)}% | ${(sum / count).toFixed(1)} | ${(cpuSum / count).toFixed(1)} |`,
  );
}
const report = `# Reproducible balance probe\n\nRun \`node scripts/balance.mjs\`. Each policy plays ${count.toLocaleString()} seeded, two-player matches against Captain Cluck using the actual settlement rules and current five-share limit. Market and CPU random streams are independent; each policy starts from the same seed set. All policies see only public information. They use remaining protection cards on their largest position from round 10 onward. No policy sees future news effects or opponent orders.\n\n| Policy | Win rate ± approximate 95% margin | Ties | Mean final assets | Mean CPU assets |\n|---|---:|---:|---:|---:|\n${rows.join("\n")}\n\nThis probes a few simple strategies, not optimal play or human enjoyment. Buying creates positive demand, and the bank has unlimited shares, so systematic buying can benefit the buyer’s existing holdings. These simulations can flag a weak computer or concentration incentives; they do not establish multiplayer fairness. No demand, protection, or price rules were changed on the basis of this small policy set. Human playtesting remains necessary.\n`;
await writeFile("docs/balance.md", report);
console.log(report);
