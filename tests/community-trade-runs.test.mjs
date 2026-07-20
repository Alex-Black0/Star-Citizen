import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalizeTradeRun, rankTradeRuns } from "../src/trade-calculator.js";

const communityData = JSON.parse(await readFile(new URL("../public/data/community-trade-runs.json", import.meta.url), "utf8"));
const universe = JSON.parse(await readFile(new URL("../public/data/universe.json", import.meta.url), "utf8"));
const indexHtml = await readFile(new URL("../index.html", import.meta.url), "utf8");
const appSource = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
const nodeIds = new Set(universe.nodes.map((node) => node.id));

assert.equal(communityData.version, 1);
assert.equal(communityData.tradeRuns.length, 3);
assert(communityData.disclaimer.includes("Verify current values"));
assert(indexHtml.includes('id="tab-community-runs"'));
assert(indexHtml.includes('id="community-trade-runs"'));
assert(appSource.includes("copyCommunityTradeRun"));

const normalized = communityData.tradeRuns.map(normalizeTradeRun);
for (const run of normalized) {
  assert(run.communitySourceId, `Missing community source ID for ${run.name}`);
  assert(nodeIds.has(run.originId), `Missing origin ${run.originId}`);
  assert(nodeIds.has(run.destinationId), `Missing destination ${run.destinationId}`);
  assert.equal(run.totalScu, 1440);
  assert.equal(run.containers["32"], 36);
  assert.equal(run.containers["24"], 12);
  assert(run.priceObservedAt, `Missing observed date for ${run.name}`);
  assert(run.netProfit > 0, `Expected positive profit for ${run.name}`);
}

const ranked = rankTradeRuns(normalized, "netProfit");
assert.equal(ranked[0].name, "Baijini -> Gaslight");
assert.equal(ranked[0].netProfit, 995000);

console.log("Community trade run tests passed.");
