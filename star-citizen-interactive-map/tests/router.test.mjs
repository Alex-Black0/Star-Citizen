import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { findShortestRoute } from "../src/router.js";

const universe = JSON.parse(await readFile(new URL("../public/data/universe.json", import.meta.url), "utf8"));

const localRoute = findShortestRoute(universe.nodes, universe.edges, "everus-harbor", "baijini-point");
assert(localRoute, "Expected a route within Stanton");
assert.deepEqual(localRoute.nodeIds, ["everus-harbor", "hurston", "stanton-star", "arccorp", "baijini-point"]);

const crossSystemRoute = findShortestRoute(universe.nodes, universe.edges, "hurston", "ruin-station");
assert(crossSystemRoute, "Expected a cross-system route");
for (const requiredNode of ["stanton-gateway", "stanton-pyro-jump", "pyro-gateway"]) {
  assert(crossSystemRoute.nodeIds.includes(requiredNode), `Expected route to include ${requiredNode}`);
}

const sameNodeRoute = findShortestRoute(universe.nodes, universe.edges, "hurston", "hurston");
assert.equal(sameNodeRoute.distance, 0);
assert.deepEqual(sameNodeRoute.nodeIds, ["hurston"]);

console.log("Routing tests passed.");
