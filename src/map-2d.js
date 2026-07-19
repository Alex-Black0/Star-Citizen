import { routeEdgeIds } from "./router.js";

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
  "jump-point": "#d990ff"
};

export function createMap2D(container, universe, onNodeClick) {
  const nodeLookup = new Map(universe.nodes.map((node) => [node.id, node]));
  const visibleNodes = universe.nodes.filter((node) => node.visible !== false && node.mapVisible !== false);
  let route = null;
  let selectedNodeId = null;

  function render() {
    const width = Math.max(900, container.clientWidth || 900);
    const height = Math.max(620, container.clientHeight || 620);
    const xs = visibleNodes.map((node) => node.position[0]);
    const zs = visibleNodes.map((node) => node.position[2]);
    const minX = Math.min(...xs) - 12;
    const maxX = Math.max(...xs) + 12;
    const minZ = Math.min(...zs) - 12;
    const maxZ = Math.max(...zs) + 12;
    const scale = Math.min(width / (maxX - minX), height / (maxZ - minZ));
    const offsetX = (width - (maxX - minX) * scale) / 2;
    const offsetY = (height - (maxZ - minZ) * scale) / 2;
    const activeEdges = routeEdgeIds(route);
    const activeNodes = new Set(route?.nodeIds || []);

    const point = (position) => ({
      x: offsetX + (position[0] - minX) * scale,
      y: height - (offsetY + (position[2] - minZ) * scale)
    });

    const edgeMarkup = universe.edges.filter((edge) => edge.visible !== false).map((edge) => {
      const fromNode = nodeLookup.get(edge.from);
      const toNode = nodeLookup.get(edge.to);
      if (!fromNode || !toNode) return "";
      const from = point(fromNode.position);
      const to = point(toNode.position);
      const classes = [
        "map-2d-edge",
        edge.kind === "jump" ? "jump" : "",
        edge.baseVisible === false ? "route-only" : "",
        activeEdges.has(edge.id) ? "active" : ""
      ].filter(Boolean).join(" ");
      return `<line class="${classes}" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" />`;
    }).join("");

    const nodeMarkup = visibleNodes.map((node) => {
      const p = point(node.position);
      const radius = Math.max(4.5, node.radius * 2.7) * (activeNodes.has(node.id) ? 1.35 : 1);
      const stroke = selectedNodeId === node.id ? "#ffffff" : "rgba(255,255,255,.32)";
      return `
        <g data-node-id="${node.id}">
          <circle class="map-2d-node" cx="${p.x}" cy="${p.y}" r="${radius}" fill="${NODE_COLORS[node.type] || "#75d7ff"}" stroke="${stroke}" stroke-width="${selectedNodeId === node.id ? 3 : 1}" />
          <text class="map-2d-label" x="${p.x + radius + 5}" y="${p.y + 4}">${escapeHtml(node.name)}</text>
        </g>`;
    }).join("");

    container.innerHTML = `
      <svg class="map-2d-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="2D route map">
        <g>${edgeMarkup}</g>
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
      selectedNodeId = nodeId;
      render();
    },
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
