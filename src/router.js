export function buildGraph(nodes, edges) {
  const graph = new Map(nodes.map((node) => [node.id, []]));

  for (const edge of edges) {
    if (!graph.has(edge.from) || !graph.has(edge.to)) continue;
    const distance = Number(edge.distance);
    if (!Number.isFinite(distance) || distance < 0) continue;

    graph.get(edge.from).push({ nodeId: edge.to, edge });
    if (edge.bidirectional !== false) {
      graph.get(edge.to).push({ nodeId: edge.from, edge });
    }
  }

  return graph;
}

export function findShortestRoute(nodes, edges, startId, endId) {
  if (!startId || !endId) return null;

  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const start = nodesById.get(startId);
  const end = nodesById.get(endId);
  if (!start || !end || start.routable === false || end.routable === false) return null;

  if (startId === endId) {
    return { nodeIds: [startId], edges: [], distance: 0 };
  }

  const graph = buildGraph(nodes, edges);
  const distances = new Map(nodes.map((node) => [node.id, Number.POSITIVE_INFINITY]));
  const previous = new Map();
  const previousEdge = new Map();
  const queue = new MinPriorityQueue();

  distances.set(startId, 0);
  queue.push(startId, 0);

  while (queue.size > 0) {
    const current = queue.pop();
    if (!current) break;
    const { value: currentId, priority: currentDistance } = current;

    if (currentDistance !== distances.get(currentId)) continue;
    if (currentId === endId) break;

    for (const neighbor of graph.get(currentId) || []) {
      const neighborNode = nodesById.get(neighbor.nodeId);
      if (!neighborNode) continue;
      if (neighborNode.routable === false && neighbor.nodeId !== endId) continue;

      const nextDistance = currentDistance + Number(neighbor.edge.distance);
      if (nextDistance < distances.get(neighbor.nodeId)) {
        distances.set(neighbor.nodeId, nextDistance);
        previous.set(neighbor.nodeId, currentId);
        previousEdge.set(neighbor.nodeId, neighbor.edge);
        queue.push(neighbor.nodeId, nextDistance);
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

export function summarizeRoute(route, nodes) {
  if (!route) return [];
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const visibleNodeIds = route.nodeIds.filter((nodeId) => {
    const node = nodesById.get(nodeId);
    return node && node.routeInternal !== true && node.visible !== false;
  });

  if (visibleNodeIds.length === 0) return [];

  const visibleSet = new Set(visibleNodeIds);
  const steps = [{
    nodeId: visibleNodeIds[0],
    distanceFromPrevious: 0,
    kinds: []
  }];

  let accumulatedDistance = 0;
  let accumulatedKinds = [];

  for (let index = 0; index < route.edges.length; index += 1) {
    const edge = route.edges[index];
    const nextNodeId = route.nodeIds[index + 1];
    accumulatedDistance += Number(edge.distance || 0);
    if (edge.kind && !accumulatedKinds.includes(edge.kind)) accumulatedKinds.push(edge.kind);

    if (visibleSet.has(nextNodeId)) {
      steps.push({
        nodeId: nextNodeId,
        distanceFromPrevious: accumulatedDistance,
        kinds: accumulatedKinds
      });
      accumulatedDistance = 0;
      accumulatedKinds = [];
    }
  }

  return steps;
}

export function routeEdgeIds(route) {
  return new Set((route?.edges || []).map((edge) => edge.id));
}

class MinPriorityQueue {
  #items = [];

  get size() {
    return this.#items.length;
  }

  push(value, priority) {
    const item = { value, priority };
    this.#items.push(item);
    this.#bubbleUp(this.#items.length - 1);
  }

  pop() {
    if (this.#items.length === 0) return null;
    if (this.#items.length === 1) return this.#items.pop();

    const first = this.#items[0];
    this.#items[0] = this.#items.pop();
    this.#bubbleDown(0);
    return first;
  }

  #bubbleUp(index) {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.#items[parent].priority <= this.#items[index].priority) break;
      [this.#items[parent], this.#items[index]] = [this.#items[index], this.#items[parent]];
      index = parent;
    }
  }

  #bubbleDown(index) {
    const length = this.#items.length;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let smallest = index;

      if (left < length && this.#items[left].priority < this.#items[smallest].priority) smallest = left;
      if (right < length && this.#items[right].priority < this.#items[smallest].priority) smallest = right;
      if (smallest === index) break;

      [this.#items[index], this.#items[smallest]] = [this.#items[smallest], this.#items[index]];
      index = smallest;
    }
  }
}
