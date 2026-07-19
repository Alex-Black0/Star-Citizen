const LOCAL_PARENT_TYPES = new Set(["planet", "planetoid", "moon", "orbit", "lagrange"]);
const SYSTEM_TYPES = new Set(["star", "planet", "planetoid", "gateway", "jump-point", "lagrange", "orbit", "station"]);

export function createHierarchy(universe) {
  const nodesById = new Map(universe.nodes.map((node) => [node.id, node]));
  const starsBySystem = new Map(
    universe.nodes.filter((node) => node.type === "star").map((node) => [node.system, node])
  );
  const systemOrder = Object.keys(universe.metadata?.systemLayout || {});
  for (const system of new Set(universe.nodes.map((node) => node.system).filter(Boolean))) {
    if (!systemOrder.includes(system)) systemOrder.push(system);
  }

  const anchorParents = new Map();
  for (const node of universe.nodes) {
    if (!node.anchorId || node.visible === false) continue;
    if (!LOCAL_PARENT_TYPES.has(node.type)) continue;
    const current = anchorParents.get(node.anchorId);
    if (!current || parentPriority(node) < parentPriority(current)) anchorParents.set(node.anchorId, node);
  }

  const parentById = new Map();
  for (const node of universe.nodes) {
    const explicitParent = node.parentId && nodesById.has(node.parentId) ? node.parentId : null;
    const inferred = node.anchorId ? anchorParents.get(node.anchorId)?.id : null;
    if (explicitParent && explicitParent !== node.id) parentById.set(node.id, explicitParent);
    else if (inferred && inferred !== node.id && !LOCAL_PARENT_TYPES.has(node.type)) parentById.set(node.id, inferred);
  }

  const childrenById = new Map();
  for (const [childId, parentId] of parentById) {
    if (!childrenById.has(parentId)) childrenById.set(parentId, []);
    childrenById.get(parentId).push(childId);
  }

  const overviewPositions = new Map();
  for (const system of systemOrder) {
    const star = starsBySystem.get(system);
    const position = universe.metadata?.systemLayout?.[system]?.position || star?.overviewPosition || star?.position;
    if (position) overviewPositions.set(system, position);
  }

  function getParent(nodeId) {
    return nodesById.get(parentById.get(nodeId)) || null;
  }

  function getLocalAnchor(nodeOrId) {
    let node = typeof nodeOrId === "string" ? nodesById.get(nodeOrId) : nodeOrId;
    if (!node) return null;
    const visited = new Set();
    while (node && !visited.has(node.id)) {
      visited.add(node.id);
      const parent = getParent(node.id);
      if (!parent) break;
      node = parent;
    }
    if (node.type === "star" || node.type === "gateway" || node.type === "jump-point") return null;
    return node;
  }

  function descendants(anchorId) {
    const result = [];
    const queue = [...(childrenById.get(anchorId) || [])];
    const seen = new Set();
    while (queue.length) {
      const id = queue.shift();
      if (seen.has(id)) continue;
      seen.add(id);
      const node = nodesById.get(id);
      if (node) result.push(node);
      queue.push(...(childrenById.get(id) || []));
    }
    return result;
  }

  function hasLocalChildren(nodeId) {
    return descendants(nodeId).some((node) => node.visible !== false && node.mapVisible !== false);
  }

  function visibleNodesForScope(scope) {
    if (scope.level === "overview") {
      return systemOrder.map((system) => starsBySystem.get(system)).filter(Boolean);
    }

    if (scope.level === "local") {
      const anchor = nodesById.get(scope.anchorId);
      if (!anchor) return [];
      return [anchor, ...descendants(anchor.id)].filter(isMapVisible);
    }

    return universe.nodes.filter((node) => {
      if (!isMapVisible(node) || node.system !== scope.system) return false;
      if (node.type === "star") return true;
      if (parentById.has(node.id)) return false;
      return SYSTEM_TYPES.has(node.type) || node.viewLevel === "system";
    });
  }

  function displayPosition(node, scope) {
    if (scope.level === "overview") {
      return overviewPositions.get(node.system) || node.overviewPosition || node.position;
    }

    if (scope.level === "local") {
      const anchor = nodesById.get(scope.anchorId);
      if (!anchor) return node.position;
      const scale = 3.2;
      return [
        (node.position[0] - anchor.position[0]) * scale,
        (node.position[1] - anchor.position[1]) * scale,
        (node.position[2] - anchor.position[2]) * scale
      ];
    }

    const star = starsBySystem.get(scope.system);
    if (!star) return node.position;
    return [
      node.position[0] - star.position[0],
      node.position[1] - star.position[1],
      node.position[2] - star.position[2]
    ];
  }

  function ringRadii(scope, visibleNodes) {
    if (scope.level === "overview") return [];
    const centerId = scope.level === "local" ? scope.anchorId : starsBySystem.get(scope.system)?.id;
    const center = visibleNodes.find((node) => node.id === centerId);
    if (!center) return [];
    const centerPosition = displayPosition(center, scope);
    const candidates = visibleNodes.filter((node) => {
      if (node.id === center.id) return false;
      if (scope.level === "system") return ["planet", "planetoid", "gateway", "lagrange"].includes(node.type);
      return node.type !== "city" && node.type !== "outpost" && node.type !== "poi";
    });
    const distances = candidates.map((node) => {
      const p = displayPosition(node, scope);
      return Math.hypot(p[0] - centerPosition[0], p[2] - centerPosition[2]);
    }).filter((distance) => distance > 1);
    const buckets = [];
    for (const value of distances.sort((a, b) => a - b)) {
      if (!buckets.some((existing) => Math.abs(existing - value) < Math.max(2.5, value * 0.08))) buckets.push(value);
    }
    return buckets.slice(0, scope.level === "system" ? 8 : 7);
  }

  function overviewLinks() {
    const links = universe.metadata?.systemLinks || [];
    return links.map((link) => ({
      ...link,
      fromPosition: overviewPositions.get(link.from),
      toPosition: overviewPositions.get(link.to)
    })).filter((link) => link.fromPosition && link.toPosition);
  }

  return {
    nodesById,
    starsBySystem,
    systemOrder,
    parentById,
    childrenById,
    overviewPositions,
    getParent,
    getLocalAnchor,
    descendants,
    hasLocalChildren,
    visibleNodesForScope,
    displayPosition,
    ringRadii,
    overviewLinks
  };
}

export function scopeForNode(node, hierarchy) {
  if (!node) return { level: "overview", system: null, anchorId: null };
  if (node.type === "star") return { level: "system", system: node.system, anchorId: null };
  const localAnchor = hierarchy.getLocalAnchor(node);
  if (localAnchor && (localAnchor.id !== node.id || hierarchy.hasLocalChildren(localAnchor.id))) {
    return { level: "local", system: node.system, anchorId: localAnchor.id };
  }
  return { level: "system", system: node.system, anchorId: null };
}

export function scopeTitle(scope, hierarchy) {
  if (scope.level === "overview") return "Known Systems";
  if (scope.level === "local") return hierarchy.nodesById.get(scope.anchorId)?.name || scope.system || "Local Map";
  return `${scope.system} System`;
}

function isMapVisible(node) {
  return node.visible !== false && node.mapVisible !== false && node.routeInternal !== true;
}

function parentPriority(node) {
  return ({ planet: 1, planetoid: 2, moon: 3, orbit: 4, lagrange: 5 })[node.type] || 10;
}
