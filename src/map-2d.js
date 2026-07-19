import { routeEdgeIds } from "./router.js";
import { createHierarchy } from "./map-hierarchy.js";

const NODE_COLORS = {
  star: "#ffd279",
  planet: "#4fc5ff",
  station: "#d6e7f2",
  moon: "#8bb8d1",
  city: "#75f0c1",
  outpost: "#c9a56a",
  poi: "#c58cff",
  lagrange: "#65d6c4",
  planetoid: "#8fb4ff",
  gateway: "#ffb55f",
  "jump-point": "#d990ff",
  orbit: "#67b8dc"
};

export function createMap2D(container, universe, onNodeClick) {
  const hierarchy = createHierarchy(universe);
  let route = null;
  let selectedNodeId = "";
  let scope = { level: "overview", system: null, anchorId: null };

  function render() {
    const visibleNodes = hierarchy.visibleNodesForScope(scope);
    container.dataset.theme = scope.system || "overview";
    if (visibleNodes.length === 0) {
      container.innerHTML = '<p class="map-empty">No locations are available in this view.</p>';
      return;
    }

    const width = Math.max(900, container.clientWidth || 900);
    const height = Math.max(620, container.clientHeight || 620);
    const positions = visibleNodes.map((node) => hierarchy.displayPosition(node, scope));
    const xs = positions.map((position) => position[0]);
    const zs = positions.map((position) => position[2]);
    const minX = Math.min(...xs) - 18;
    const maxX = Math.max(...xs) + 18;
    const minZ = Math.min(...zs) - 18;
    const maxZ = Math.max(...zs) + 18;
    const scale = Math.min(width / Math.max(1, maxX - minX), height / Math.max(1, maxZ - minZ));
    const offsetX = (width - (maxX - minX) * scale) / 2;
    const offsetY = (height - (maxZ - minZ) * scale) / 2;
    const activeEdges = routeEdgeIds(route);
    const activeNodes = new Set(route?.nodeIds || []);
    const visibleIds = new Set(visibleNodes.map((node) => node.id));

    const point = (position) => ({
      x: offsetX + (position[0] - minX) * scale,
      y: height - (offsetY + (position[2] - minZ) * scale)
    });

    const centerNode = scope.level === "local"
      ? hierarchy.nodesById.get(scope.anchorId)
      : scope.level === "system"
        ? hierarchy.starsBySystem.get(scope.system)
        : null;
    const centerPoint = centerNode ? point(hierarchy.displayPosition(centerNode, scope)) : null;
    const ringMarkup = centerPoint
      ? hierarchy.ringRadii(scope, visibleNodes).map((radius) =>
          `<circle class="map-2d-ring" cx="${centerPoint.x}" cy="${centerPoint.y}" r="${radius * scale}" />`
        ).join("")
      : "";

    const axisMarkup = centerPoint ? `
      <line class="map-2d-axis" x1="0" y1="${centerPoint.y}" x2="${width}" y2="${centerPoint.y}" />
      <line class="map-2d-axis" x1="${centerPoint.x}" y1="0" x2="${centerPoint.x}" y2="${height}" />
    ` : "";

    const overviewEdges = scope.level === "overview"
      ? hierarchy.overviewLinks().map((link) => {
          const from = point(link.fromPosition);
          const to = point(link.toPosition);
          return `<line class="map-2d-system-link" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" />`;
        }).join("")
      : "";

    const edgeMarkup = scope.level === "overview" ? "" : universe.edges.map((edge) => {
      if (edge.visible === false) return "";
      const fromNode = hierarchy.nodesById.get(edge.from);
      const toNode = hierarchy.nodesById.get(edge.to);
      if (!fromNode || !toNode || !visibleIds.has(fromNode.id) || !visibleIds.has(toNode.id)) return "";
      const active = activeEdges.has(edge.id);
      if (edge.baseVisible === false && !active) return "";
      const from = point(hierarchy.displayPosition(fromNode, scope));
      const to = point(hierarchy.displayPosition(toNode, scope));
      const classes = ["map-2d-edge", edge.kind === "jump" ? "jump" : "", active ? "active" : ""].filter(Boolean).join(" ");
      return `<line class="${classes}" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" />`;
    }).join("");

    const spokesMarkup = selectedNodeId && scope.level !== "overview"
      ? buildSelectedSpokes(selectedNodeId, visibleNodes, hierarchy, point, universe.edges, scope)
      : "";

    const nodeMarkup = visibleNodes.map((node) => {
      const p = point(hierarchy.displayPosition(node, scope));
      const base = scope.level === "overview" ? 16 : node.id === scope.anchorId ? 13 : 7;
      const radius = Math.max(base, Number(node.radius || 0.7) * (scope.level === "overview" ? 4 : 3.2)) * (activeNodes.has(node.id) ? 1.3 : 1);
      const selected = selectedNodeId === node.id;
      const label = scope.level === "overview" ? (node.overviewLabel || `${node.name} System`) : node.name;
      return `
        <g class="map-2d-node-group" data-node-id="${escapeHtml(node.id)}">
          ${shapeMarkup(node, p.x, p.y, radius, selected)}
          <text class="map-2d-label ${scope.level === "overview" ? "system-label" : ""}" x="${p.x + radius + 7}" y="${p.y + 4}">${escapeHtml(label)}</text>
        </g>`;
    }).join("");

    container.innerHTML = `
      <svg class="map-2d-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="2D hierarchical route map">
        <g>${ringMarkup}${axisMarkup}</g>
        <g>${overviewEdges}${edgeMarkup}${spokesMarkup}</g>
        <g>${nodeMarkup}</g>
      </svg>`;

    container.querySelectorAll("[data-node-id]").forEach((element) => {
      element.addEventListener("click", () => onNodeClick(element.dataset.nodeId));
    });
  }

  const observer = new ResizeObserver(render);
  observer.observe(container);
  render();

  return {
    updateRoute(nextRoute) {
      route = nextRoute;
      render();
    },
    setSelected(nodeId) {
      selectedNodeId = nodeId || "";
      render();
    },
    setScope(nextScope) {
      scope = { level: "overview", system: null, anchorId: null, ...nextScope };
      render();
    },
    resetCamera() {
      render();
    },
    getScope: () => ({ ...scope }),
    destroy() {
      observer.disconnect();
      container.replaceChildren();
    }
  };
}

function buildSelectedSpokes(selectedNodeId, visibleNodes, hierarchy, point, edges, scope) {
  const selectedNode = hierarchy.nodesById.get(selectedNodeId);
  if (!selectedNode) return "";
  const selectedPosition = point(hierarchy.displayPosition(selectedNode, scope));
  const candidates = visibleNodes
    .filter((node) => node.id !== selectedNodeId)
    .filter((node) => scope.level === "local"
      ? ["station", "moon", "city", "outpost", "poi", "planet", "planetoid"].includes(node.type)
      : ["planet", "planetoid", "station", "gateway", "moon", "city", "outpost"].includes(node.type))
    .slice(0, scope.level === "local" ? 8 : 10);

  return candidates.map((node) => {
    const target = point(hierarchy.displayPosition(node, scope));
    const midX = (selectedPosition.x + target.x) / 2;
    const midY = (selectedPosition.y + target.y) / 2;
    const distance = readableDistanceBetween(edges, selectedNode, node);
    return `
      <line class="map-2d-spoke" x1="${selectedPosition.x}" y1="${selectedPosition.y}" x2="${target.x}" y2="${target.y}" />
      <text class="map-2d-distance" x="${midX + 4}" y="${midY - 4}">${formatDistance(distance)} Gm</text>`;
  }).join("");
}

function shapeMarkup(node, x, y, radius, selected) {
  const fill = NODE_COLORS[node.type] || "#75d7ff";
  const stroke = selected ? "#ffffff" : "rgba(255,255,255,.42)";
  const strokeWidth = selected ? 3 : 1.2;
  if (node.type === "station") {
    const size = radius * 1.15;
    return `<rect class="map-2d-node station" x="${x - size}" y="${y - size}" width="${size * 2}" height="${size * 2}" rx="3" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" transform="rotate(45 ${x} ${y})" />`;
  }
  if (node.type === "gateway") {
    const size = radius * 1.45;
    return `<polygon class="map-2d-node gateway" points="${x},${y - size} ${x + size},${y} ${x},${y + size} ${x - size},${y}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
  }
  if (node.type === "jump-point") {
    return `<circle class="map-2d-node jump" cx="${x}" cy="${y}" r="${radius}" fill="none" stroke="${fill}" stroke-width="${strokeWidth + 1}" /><circle cx="${x}" cy="${y}" r="${radius * 0.45}" fill="${fill}" opacity="0.25" />`;
  }
  return `<circle class="map-2d-node" cx="${x}" cy="${y}" r="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
}

function readableDistanceBetween(edges, fromNode, toNode) {
  const direct = edges.find((edge) => (edge.from === fromNode.id && edge.to === toNode.id) || (edge.from === toNode.id && edge.to === fromNode.id));
  if (direct) return Number(direct.distance);
  return Math.hypot(fromNode.position[0] - toNode.position[0], fromNode.position[1] - toNode.position[1], fromNode.position[2] - toNode.position[2]);
}

function formatDistance(value) {
  return Number(value).toFixed(value < 10 ? 2 : value < 100 ? 1 : 0);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
