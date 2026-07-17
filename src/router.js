export function buildGraph(nodes, edges) {
  const graph = new Map(nodes.map((node) => [node.id, []]));

  for (const edge of edges) {
    if (!graph.has(edge.from) || !graph.has(edge.to)) continue;
    graph.get(edge.from).push({ nodeId: edge.to, edge });
    if (edge.bidirectional !== false) {
      graph.get(edge.to).push({ nodeId: edge.from, edge });
    }
  }

  return graph;
}

export function findShortestRoute(nodes, edges, startId, endId) {
  if (!startId || !endId) return null;
  if (startId === endId) {
    return { nodeIds: [startId], edges: [], distance: 0 };
  }

  const graph = buildGraph(nodes, edges);
  if (!graph.has(startId) || !graph.has(endId)) return null;

  const distances = new Map(nodes.map((node) => [node.id, Number.POSITIVE_INFINITY]));
  const previous = new Map();
  const previousEdge = new Map();
  const unvisited = new Set(nodes.map((node) => node.id));
  distances.set(startId, 0);

  while (unvisited.size > 0) {
    let currentId = null;
    let currentDistance = Number.POSITIVE_INFINITY;

    for (const nodeId of unvisited) {
      const candidateDistance = distances.get(nodeId);
      if (candidateDistance < currentDistance) {
        currentDistance = candidateDistance;
        currentId = nodeId;
      }
    }

    if (currentId === null || currentDistance === Number.POSITIVE_INFINITY) break;
    if (currentId === endId) break;
    unvisited.delete(currentId);

    for (const neighbor of graph.get(currentId)) {
      if (!unvisited.has(neighbor.nodeId)) continue;
      const nextDistance = currentDistance + Number(neighbor.edge.distance || 0);
      if (nextDistance < distances.get(neighbor.nodeId)) {
        distances.set(neighbor.nodeId, nextDistance);
        previous.set(neighbor.nodeId, currentId);
        previousEdge.set(neighbor.nodeId, neighbor.edge);
      }
    }
  }

  if (!previous.has(endId)) return null;

  const nodeIds = [];
  const routeEdges = [];
  let cursor = endId;

  while (cursor) {
    nodeIds.unshift(cursor);
    const edge = previousEdge.get(cursor);
    if (edge) routeEdges.unshift(edge);
    if (cursor === startId) break;
    cursor = previous.get(cursor);
  }

  return {
    nodeIds,
    edges: routeEdges,
    distance: distances.get(endId)
  };
}

export function routeEdgeIds(route) {
  return new Set((route?.edges || []).map((edge) => edge.id));
}
