import assert from "node:assert/strict";
import {
  CONTAINER_SIZES,
  PRICING_MODES,
  calculateTotalScu,
  calculateTradeMetrics,
  freshnessForRun,
  normalizeTradeRun,
  rankTradeRuns
} from "../src/trade-calculator.js";

assert.deepEqual(CONTAINER_SIZES, [32, 24, 12, 8, 1]);
assert.equal(calculateTotalScu({ 32: 36, 24: 12 }), 1440);

const migrated = normalizeTradeRun({
  id: "legacy",
  name: "Legacy",
  commodity: "Gold",
  originId: "a",
  destinationId: "b",
  containers: { 36: 2, 24: 1 },
  buyPrice: 10,
  sellPrice: 20,
  createdAt: "2026-07-01T00:00:00Z",
  updatedAt: "2026-07-01T00:00:00Z"
});
assert.equal(migrated.containers["32"], 2);
assert.equal(migrated.totalScu, 88);
assert.equal(migrated.netProfit, 880);

const perScu = calculateTradeMetrics({
  pricingMode: PRICING_MODES.PER_SCU,
  containers: { 32: 1, 24: 1 },
  buyPrice: 100,
  sellPrice: 150,
  fees: { loading: 100, unloading: 50, fuel: 25, other: 25 },
  routeDistance: 20,
  observedMinutes: 10
});
assert.equal(perScu.totalScu, 56);
assert.equal(perScu.investment, 5600);
assert.equal(perScu.revenue, 8400);
assert.equal(perScu.totalFees, 200);
assert.equal(perScu.netProfit, 2600);
assert.equal(perScu.profitPerGm, 130);
assert.equal(perScu.profitPerMinute, 260);

const totals = calculateTradeMetrics({
  pricingMode: PRICING_MODES.TOTALS,
  containers: { 32: 36, 24: 12 },
  buyTotal: 1_000_000,
  sellTotal: 1_450_000,
  fees: { loading: 20_000, unloading: 20_000, fuel: 10_000 }
});
assert.equal(totals.totalScu, 1440);
assert.equal(totals.netProfit, 400_000);

const ranked = rankTradeRuns([
  { id: "a", name: "A", commodity: "A", netProfit: 1_000, totalScu: 100, pricingMode: "totals", buyTotal: 1, sellTotal: 1001 },
  { id: "b", name: "B", commodity: "B", netProfit: 2_000, totalScu: 400, pricingMode: "totals", buyTotal: 1, sellTotal: 2001 }
], "netProfit");
assert.equal(ranked[0].id, "b");

const freshness = freshnessForRun({ priceObservedAt: "2026-07-01" }, new Date("2026-07-20T12:00:00Z"));
assert.equal(freshness.level, "stale");
assert.equal(freshness.daysOld, 19);

console.log("Trade calculator tests passed.");
