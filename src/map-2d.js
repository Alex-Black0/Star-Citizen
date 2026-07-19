import { routeEdgeIds } from "./router.js";
import { createHierarchy } from "./map-hierarchy.js";

const NODE_COLORS = {
  star: "#ffd279",
  planet: "#4fc5ff",
  station: "#b7d5e7",
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
      const classes = [
        "map-2d-edge",
        edge.kind === "jump" ? "jump" : "",
        active ? "active" : ""
      ].filter(Boolean).join(" ");
      return `<line class="${classes}" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" />`;
    }).join("");

    const nodeMarkup = visibleNodes.map((node) => {
      const p = point(hierarchy.displayPosition(node, scope));
      const base = scope.level === "overview" ? 16 : node.id === scope.anchorId ? 13 : 7;
      const radius = Math.max(base, Number(node.radius || 0.7) * (scope.level === "overview" ? 4 : 3.2)) * (activeNodes.has(node.id) ? 1.3 : 1);
      const selected = selectedNodeId === node.id;
      const label = scope.level === "overview" ? (node.overviewLabel || `${node.name} System`) : node.name;
      return `
        <g class="map-2d-node-group" data-node-id="${escapeHtml(node.id)}">
          <circle class="map-2d-node" cx="${p.x}" cy="${p.y}" r="${radius}" fill="${NODE_COLORS[node.type] || "#75d7ff"}" stroke="${selected ? "#ffffff" : "rgba(255,255,255,.38)"}" stroke-width="${selected ? 3 : 1.2}" />
          <text class="map-2d-label ${scope.level === "overview" ? "system-label" : ""}" x="${p.x + radius + 7}" y="${p.y + 4}">${escapeHtml(label)}</text>
        </g>`;
    }).join("");

    container.innerHTML = `
      <svg class="map-2d-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="2D hierarchical route map">
        <g>${ringMarkup}${axisMarkup}</g>
        <g>${overviewEdges}${edgeMarkup}</g>
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
