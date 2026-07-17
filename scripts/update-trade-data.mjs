import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const endpoint = process.env.SC_TRADE_API_URL || "https://api.uexcorp.uk/2.0/commodities_prices_all";
const token = process.env.SC_TRADE_API_TOKEN;
const mappingPath = path.resolve(process.env.UEX_LOCATION_MAP || "public/data/uex-location-map.json");

const headers = {
  Accept: "application/json",
  "User-Agent": "Verse-Route-Map/0.2 (+https://github.com/Alex-Black0/Star-Citizen)"
};
if (token) headers.Authorization = `Bearer ${token}`;

const locationAliases = JSON.parse(await readFile(mappingPath, "utf8"));
const aliasIndex = buildAliasIndex(locationAliases);

const response = await fetch(endpoint, { headers });
if (!response.ok) {
  throw new Error(`Trade API request failed: ${response.status} ${response.statusText}`);
}

const payload = await response.json();
const rows = Array.isArray(payload) ? payload : (payload.data || payload.content || []);
if (!Array.isArray(rows)) {
  throw new Error("The configured endpoint did not return an array or an object with a data/content array.");
}

const grouped = new Map();
let matchedRows = 0;

for (const raw of rows) {
  const record = adaptRecord(raw, aliasIndex);
  if (!record) continue;
  matchedRows += 1;

  const key = `${record.locationId}::${record.commodity.toLowerCase()}`;
  const current = grouped.get(key) || {
    locationId: record.locationId,
    commodity: record.commodity,
    buy: null,
    sell: null,
    stockScu: null,
    buyTerminal: null,
    sellTerminal: null,
    containerSizes: new Set(),
    updatedAt: null
  };

  if (isPositive(record.buy) && (!isPositive(current.buy) || record.buy < current.buy)) {
    current.buy = record.buy;
    current.buyTerminal = record.terminal;
  }
  if (isPositive(record.sell) && (!isPositive(current.sell) || record.sell > current.sell)) {
    current.sell = record.sell;
    current.sellTerminal = record.terminal;
  }
  if (isPositive(record.stockScu)) {
    current.stockScu = Math.max(Number(current.stockScu || 0), record.stockScu);
  }
  for (const size of record.containerSizes) current.containerSizes.add(size);
  if (!current.updatedAt || record.updatedAt > current.updatedAt) current.updatedAt = record.updatedAt;

  grouped.set(key, current);
}

const locations = {};
for (const record of grouped.values()) {
  locations[record.locationId] ??= [];
  locations[record.locationId].push({
    commodity: record.commodity,
    buy: record.buy,
    sell: record.sell,
    stockScu: record.stockScu,
    currency: "aUEC/SCU",
    buyTerminal: record.buyTerminal,
    sellTerminal: record.sellTerminal,
    containerSizes: [...record.containerSizes].sort((a, b) => b - a),
    updatedAt: record.updatedAt
  });
}

for (const records of Object.values(locations)) {
  records.sort((a, b) => a.commodity.localeCompare(b.commodity));
}

const output = {
  metadata: {
    source: process.env.SC_TRADE_SOURCE_NAME || "UEX API 2.0 commodity price snapshot",
    endpoint,
    updatedAt: new Date().toISOString(),
    authoritative: false,
    matchedRows,
    note: "Community-maintained data. Buy is the lowest matched terminal buy price; sell is the highest matched terminal sell price for each mapped map location."
  },
  locations
};

const outputPath = path.resolve("public/data/commodities.json");
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(`Matched ${matchedRows} API rows and wrote ${Object.keys(locations).length} map locations to ${outputPath}`);

function buildAliasIndex(mapping) {
  return Object.entries(mapping).flatMap(([locationId, aliases]) =>
    (Array.isArray(aliases) ? aliases : [aliases]).map((alias) => ({
      locationId,
      alias: normalize(alias)
    }))
  ).filter((entry) => entry.alias.length > 0);
}

function adaptRecord(raw, aliases) {
  const terminal = raw.terminal_name ?? raw.terminalName ?? raw.terminal_slug ?? raw.terminalSlug ?? raw.terminal_code ?? raw.terminalCode;
  const locationId = resolveLocationId(raw, aliases);
  const commodity = raw.commodity_name ?? raw.commodityName ?? raw.commodity;
  const buy = toNumberOrNull(raw.price_buy ?? raw.buy ?? raw.buyPrice ?? raw.buy_price);
  const sell = toNumberOrNull(raw.price_sell ?? raw.sell ?? raw.sellPrice ?? raw.sell_price);
  const stockScu = toNumberOrNull(raw.scu_sell_stock ?? raw.scu_buy ?? raw.stockScu ?? raw.stock_scu);
  const containerSizes = parseContainerSizes(raw.container_sizes ?? raw.containerSizes);
  const timestamp = toNumberOrNull(raw.date_modified ?? raw.dateModified ?? raw.updated_at ?? raw.updatedAt);

  if (!locationId || !commodity || (buy === null && sell === null)) return null;
  return {
    locationId,
    commodity: String(commodity),
    buy,
    sell,
    stockScu,
    terminal: terminal ? String(terminal) : null,
    containerSizes,
    updatedAt: timestamp && timestamp < 100000000000 ? new Date(timestamp * 1000).toISOString() : timestamp ? new Date(timestamp).toISOString() : new Date().toISOString()
  };
}

function resolveLocationId(raw, aliases) {
  const haystack = normalize([
    raw.terminal_name,
    raw.terminal_slug,
    raw.terminal_code,
    raw.planet_name,
    raw.space_station_name,
    raw.city_name,
    raw.outpost_name,
    raw.orbit_name
  ].filter(Boolean).join(" "));

  const match = aliases.find((entry) => haystack.includes(entry.alias));
  return match?.locationId || null;
}

function parseContainerSizes(value) {
  if (!value) return [];
  return String(value)
    .split(/[|,]/)
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0);
}

function normalize(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function isPositive(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0;
}
