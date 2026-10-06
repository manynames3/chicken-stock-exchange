export const MAX_TRADE = 5;
export function maxShares(stocks, player, action, stockId) {
  const stock = stocks.find((s) => s.id === stockId);
  if (!stock || stock.delisted || stock.price <= 0) return 0;
  if (action === "buy")
    return Math.min(MAX_TRADE, Math.floor(player.cash / stock.price));
  if (action === "sell")
    return Math.min(MAX_TRADE, player.holdings[stockId] || 0);
  return 0;
}
export function orderError(stocks, player, input) {
  if (!input || !["buy", "sell", "hold"].includes(input.action))
    return "INVALID_ORDER";
  const stock = stocks.find((s) => s.id === input.stock);
  if (
    !stock ||
    !Number.isInteger(input.quantity) ||
    input.quantity < 1 ||
    input.quantity > MAX_TRADE
  )
    return "INVALID_ORDER";
  if (input.action !== "hold" && stock.delisted) return "DELISTED";
  if (input.action === "buy" && player.cash < stock.price * input.quantity)
    return "NOT_ENOUGH_CASH";
  if (
    input.action === "sell" &&
    (player.holdings[stock.id] || 0) < input.quantity
  )
    return "NOT_ENOUGH_SHARES";
  if (input.protection != null) {
    const protectedStock = stocks.find((s) => s.id === input.protection);
    if (!protectedStock || protectedStock.delisted || player.protections < 1)
      return "INVALID_PROTECTION";
    const after =
      (player.holdings[input.protection] || 0) +
      (stock.id === input.protection
        ? input.action === "buy"
          ? input.quantity
          : input.action === "sell"
            ? -input.quantity
            : 0
        : 0);
    if (after <= 0) return "NO_SHARES_TO_PROTECT";
  }
  return null;
}
