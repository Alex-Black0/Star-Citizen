export const CONTAINER_SIZES = [32, 24, 12, 8, 1];
export const PRICING_MODES = Object.freeze({
  PER_SCU: "per-scu",
  TOTALS: "totals"
});

export function normalizeContainers(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  const normalized = {};
  for (const size of CONTAINER_SIZES) {
    normalized[String(size)] = nonNegativeInteger(source[String(size)]);
  }
  // v5 and earlier incorrectly labeled the largest container as 36 SCU.
  // Treat old 36-SCU counts as 32-SCU counts so existing browser saves survive.
  normalized["32"] += nonNegativeInteger(source["36"]);
  return normalized;
}

export function calculateTotalScu(containers = {}) {
  const normalized = normalizeContainers(containers);
  return CONTAINER_SIZES.reduce(
    (total, size) => total + size * normalized[String(size)],
    0
  );
}

export function calculateTradeMetrics(input = {}) {
  const containers = normalizeContainers(input.containers);
  const totalScu = calculateTotalScu(containers);
  const pricingMode = input.pricingMode === PRICING_MODES.TOTALS
    ? PRICING_MODES.TOTALS
    : PRICING_MODES.PER_SCU;

  const buyPrice = nonNegativeNumber(input.buyPrice);
  const sellPrice = nonNegativeNumber(input.sellPrice);
  const buyTotal = nonNegativeNumber(input.buyTotal);
  const sellTotal = nonNegativeNumber(input.sellTotal);

  const investment = pricingMode === PRICING_MODES.TOTALS
    ? buyTotal
    : totalScu * buyPrice;
  const revenue = pricingMode === PRICING_MODES.TOTALS
    ? sellTotal
    : totalScu * sellPrice;

  const fees = {
    loading: nonNegativeNumber(input.fees?.loading ?? input.loadingFee),
    unloading: nonNegativeNumber(input.fees?.unloading ?? input.unloadingFee),
    fuel: nonNegativeNumber(input.fees?.fuel ?? input.fuelCost),
    other: nonNegativeNumber(input.fees?.other ?? input.otherFees)
  };
  const totalFees = Object.values(fees).reduce((total, value) => total + value, 0);
  const grossProfit = revenue - investment;
  const netProfit = grossProfit - totalFees;
  const routeDistance = nonNegativeNumber(input.routeDistance);
  const observedMinutes = nonNegativeNumber(input.observedMinutes);

  return {
    pricingMode,
    containers,
    totalScu,
    buyPrice,
    sellPrice,
    buyTotal,
    sellTotal,
    investment,
    revenue,
    fees,
    totalFees,
    grossProfit,
    netProfit,
    profit: netProfit,
    routeDistance,
    observedMinutes,
    profitPerScu: totalScu > 0 ? netProfit / totalScu : null,
    profitPerGm: routeDistance > 0 ? netProfit / routeDistance : null,
    profitPerMinute: observedMinutes > 0 ? netProfit / observedMinutes : null
  };
}

export function normalizeTradeRun(run = {}) {
  const pricingMode = run.pricingMode || (
    Number.isFinite(Number(run.buyTotal)) || Number.isFinite(Number(run.sellTotal))
      ? PRICING_MODES.TOTALS
      : PRICING_MODES.PER_SCU
  );
  const metrics = calculateTradeMetrics({ ...run, pricingMode });
  const now = new Date().toISOString();
  return {
    ...run,
    ...metrics,
    id: run.id || cryptoSafeId(),
    name: String(run.name || "Unnamed trade run"),
    commodity: String(run.commodity || "Unknown commodity"),
    originId: String(run.originId || ""),
    destinationId: String(run.destinationId || ""),
    notes: String(run.notes || ""),
    priceObservedAt: run.priceObservedAt || dateOnly(run.updatedAt || run.createdAt || now),
    createdAt: run.createdAt || now,
    updatedAt: run.updatedAt || now
  };
}

export function rankTradeRuns(runs = [], metric = "netProfit") {
  const normalized = runs.map(normalizeTradeRun);
  return normalized.sort((a, b) => {
    const aValue = rankValue(a, metric);
    const bValue = rankValue(b, metric);
    if (aValue !== bValue) return bValue - aValue;
    return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
  });
}

export function freshnessForRun(run, now = new Date()) {
  const raw = run?.priceObservedAt || run?.updatedAt;
  const observed = raw ? new Date(raw) : null;
  if (!observed || Number.isNaN(observed.getTime())) {
    return { daysOld: null, level: "unknown", label: "Date unknown" };
  }
  const daysOld = Math.max(0, Math.floor((now.getTime() - observed.getTime()) / 86_400_000));
  if (daysOld >= 30) return { daysOld, level: "old", label: `${daysOld} days old` };
  if (daysOld >= 8) return { daysOld, level: "stale", label: `${daysOld} days old` };
  if (daysOld === 0) return { daysOld, level: "fresh", label: "Updated today" };
  return { daysOld, level: "fresh", label: `${daysOld} day${daysOld === 1 ? "" : "s"} old` };
}

function rankValue(run, metric) {
  if (metric === "profitPerScu") return finiteOrMinimum(run.profitPerScu);
  if (metric === "profitPerGm") return finiteOrMinimum(run.profitPerGm);
  if (metric === "profitPerMinute") return finiteOrMinimum(run.profitPerMinute);
  if (metric === "recent") return new Date(run.updatedAt || 0).getTime();
  return finiteOrMinimum(run.netProfit ?? run.profit);
}

function finiteOrMinimum(value) {
  return Number.isFinite(Number(value)) ? Number(value) : Number.NEGATIVE_INFINITY;
}

function nonNegativeInteger(value) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

function nonNegativeNumber(value) {
  return Math.max(0, Number(value) || 0);
}

function dateOnly(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function cryptoSafeId() {
  return globalThis.crypto?.randomUUID?.() || `trade-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
