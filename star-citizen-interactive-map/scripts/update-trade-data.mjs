import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const endpoint = process.env.SC_TRADE_API_URL;
const token = process.env.SC_TRADE_API_TOKEN;

if (!endpoint) {
  console.log("SC_TRADE_API_URL is not configured. Skipping trade-data update.");
  process.exit(0);
}

const headers = { Accept: "application/json" };
if (token) headers.Authorization = `Bearer ${token}`;

const response = await fetch(endpoint, { headers });
if (!response.ok) {
  throw new Error(`Trade API request failed: ${response.status} ${response.statusText}`);
}

const payload = await response.json();
const rows = Array.isArray(payload) ? payload : (payload.data || payload.content || []);
if (!Array.isArray(rows)) {
  throw new Error("The configured endpoint did not return an array. Update adaptRecord() for the endpoint's response schema.");
}

const locations = {};
for (const raw of rows) {
  const record = adaptRecord(raw);
  if (!record) continue;
  locations[record.locationId] ??= [];
  locations[record.locationId].push({
    commodity: record.commodity,
    buy: record.buy,
    sell: record.sell,
    currency: record.currency || "aUEC/SCU",
    updatedAt: record.updatedAt || new Date().toISOString()
  });
}

const output = {
  metadata: {
    source: process.env.SC_TRADE_SOURCE_NAME || "Configured trade API",
    updatedAt: new Date().toISOString(),
    authoritative: false
  },
  locations
};

const outputPath = path.resolve("public/data/commodities.json");
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(`Wrote ${Object.keys(locations).length} locations to ${outputPath}`);

/**
 * Adapt one API result to the map's normalized commodity record.
 *
 * The default adapter expects this shape:
 * {
 *   "locationId": "hurston",
 *   "commodity": "Titanium",
 *   "buy": 8.1,
 *   "sell": 9.35,
 *   "currency": "aUEC/SCU",
 *   "updatedAt": "2026-07-17T00:00:00Z"
 * }
 *
 * Change this function after choosing the exact SC Trade Tools endpoint.
 */
function adaptRecord(raw) {
  const locationId = raw.locationId ?? raw.location_id;
  const commodity = raw.commodity ?? raw.commodityName ?? raw.commodity_name;
  const buy = toNumberOrNull(raw.buy ?? raw.buyPrice ?? raw.buy_price);
  const sell = toNumberOrNull(raw.sell ?? raw.sellPrice ?? raw.sell_price);

  if (!locationId || !commodity || (buy === null && sell === null)) return null;
  return {
    locationId: String(locationId),
    commodity: String(commodity),
    buy,
    sell,
    currency: raw.currency,
    updatedAt: raw.updatedAt ?? raw.updated_at
  };
}

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
