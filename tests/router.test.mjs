import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { findShortestRoute, summarizeRoute } from "../src/router.js";

const universe = JSON.parse(await readFile(new URL("../public/data/universe.json", import.meta.url), "utf8"));
const nodesById = new Map(universe.nodes.map((node) => [node.id, node]));

// The original defect: Pyro Gateway (Stanton) → Port Tressler was incorrectly
// routed through the Stanton star and returned roughly 105 Gm.
const gatewayToTressler = findShortestRoute(
  universe.nodes,
  universe.edges,
  "pyro-gateway-stanton",
  "port-tressler"
);
assert(gatewayToTressler, "Expected Pyro Gateway to Port Tressler route");
assert.equal(gatewayToTressler.distance, 68);
const gatewaySteps = summarizeRoute(gatewayToTressler, universe.nodes);
assert.deepEqual(gatewaySteps.map((step) => step.nodeId), ["pyro-gateway-stanton", "port-tressler"]);

// Stars are visual system markers only and must never appear in a route.
for (const start of ["everus-harbor", "baijini-point", "port-tressler", "seraphim-station"]) {
  for (const end of ["hurston", "arccorp", "microtech", "crusader", "pyro-gateway-stanton"]) {
    if (start === end) continue;
    const route = findShortestRoute(universe.nodes, universe.edges, start, end);
    assert(route, `Expected a route from ${start} to ${end}`);
    for (const nodeId of route.nodeIds) {
      assert.notEqual(nodesById.get(nodeId)?.type, "star", `Star leaked into route ${start} → ${end}`);
    }
  }
}

const localRoute = findShortestRoute(universe.nodes, universe.edges, "everus-harbor", "baijini-point");
assert(localRoute, "Expected a route within Stanton");
assert(!localRoute.nodeIds.includes("stanton-star"));
assert(localRoute.distance > 0, "Expected a positive Stanton route distance");
if (String(universe.metadata?.version || "").includes("fallback")) {
  assert(Math.abs(localRoute.distance - 23.31281) < 0.000001);
}

const crossSystemRoute = findShortestRoute(universe.nodes, universe.edges, "hurston", "ruin-station");
assert(crossSystemRoute, "Expected a cross-system route");
for (const requiredNode of [
  "pyro-gateway-stanton",
  "stanton-gateway-pyro"
]) {
  assert(crossSystemRoute.nodeIds.includes(requiredNode), `Expected route to include ${requiredNode}`);
}
assert(!crossSystemRoute.nodeIds.includes("stanton-star"));
assert(!crossSystemRoute.nodeIds.includes("pyro-star"));

const sameNodeRoute = findShortestRoute(universe.nodes, universe.edges, "hurston", "hurston");
assert.equal(sameNodeRoute.distance, 0);
assert.deepEqual(sameNodeRoute.nodeIds, ["hurston"]);

// Generated UEX graphs use hidden orbit anchors. They should contribute distance
// without appearing as user-facing route stops.
const fixtureNodes = [
  { id: "a", name: "A" },
  { id: "anchor-a", name: "A anchor", routeInternal: true, visible: false },
  { id: "anchor-b", name: "B anchor", routeInternal: true, visible: false },
  { id: "b", name: "B" }
];
const fixtureEdges = [
  { id: "attach-a", from: "a", to: "anchor-a", distance: 0 },
  { id: "distance", from: "anchor-a", to: "anchor-b", distance: 68, kind: "quantum" },
  { id: "attach-b", from: "anchor-b", to: "b", distance: 0 }
];
const fixtureRoute = findShortestRoute(fixtureNodes, fixtureEdges, "a", "b");
assert.equal(fixtureRoute.distance, 68);
assert.deepEqual(summarizeRoute(fixtureRoute, fixtureNodes), [
  { nodeId: "a", distanceFromPrevious: 0, kinds: [] },
  { nodeId: "b", distanceFromPrevious: 68, kinds: ["quantum"] }
]);

for (const edge of universe.edges) {
  assert(nodesById.has(edge.from), `Missing edge origin ${edge.from}`);
  assert(nodesById.has(edge.to), `Missing edge destination ${edge.to}`);
  assert(Number.isFinite(Number(edge.distance)), `Invalid distance on ${edge.id}`);
  assert(Number(edge.distance) >= 0, `Negative distance on ${edge.id}`);
}

console.log(`Routing tests passed (${universe.nodes.length} nodes, ${universe.edges.length} edges).`);
