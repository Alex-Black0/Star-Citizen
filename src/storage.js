import { normalizeTradeRun } from "./trade-calculator.js";

const ROUTES_KEY = "verse-route-map.saved-routes.v1";
const TRADE_RUNS_KEY = "verse-route-map.trade-runs.v1";
const MANUAL_PRICES_KEY = "verse-route-map.manual-prices.v1";

function loadArray(key, label) {
  try {
    const raw = localStorage.getItem(key);
    const value = raw ? JSON.parse(raw) : [];
    return Array.isArray(value) ? value : [];
  } catch (error) {
    console.warn(`Could not load ${label}`, error);
    return [];
  }
}

function persistArray(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function loadSavedRoutes() {
  return loadArray(ROUTES_KEY, "saved routes");
}

export function persistSavedRoutes(routes) {
  persistArray(ROUTES_KEY, routes);
}

export function loadTradeRuns() {
  const normalized = loadArray(TRADE_RUNS_KEY, "trade runs").map(normalizeTradeRun);
  if (normalized.length) persistArray(TRADE_RUNS_KEY, normalized);
  return normalized;
}

export function persistTradeRuns(runs) {
  persistArray(TRADE_RUNS_KEY, runs.map(normalizeTradeRun));
}

export function loadManualPrices() {
  return loadArray(MANUAL_PRICES_KEY, "manual commodity prices");
}

export function persistManualPrices(records) {
  persistArray(MANUAL_PRICES_KEY, records);
}

export function exportUserData() {
  return {
    exportedAt: new Date().toISOString(),
    version: 2,
    savedRoutes: loadSavedRoutes(),
    tradeRuns: loadTradeRuns(),
    manualPrices: loadManualPrices()
  };
}

export function importUserData(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("The imported file does not contain valid map data.");
  }

  const savedRoutes = Array.isArray(payload.savedRoutes) ? payload.savedRoutes : [];
  const tradeRuns = Array.isArray(payload.tradeRuns) ? payload.tradeRuns.map(normalizeTradeRun) : [];
  const manualPrices = Array.isArray(payload.manualPrices) ? payload.manualPrices : [];

  persistSavedRoutes(savedRoutes);
  persistTradeRuns(tradeRuns);
  persistManualPrices(manualPrices);

  return { savedRoutes, tradeRuns, manualPrices };
}
