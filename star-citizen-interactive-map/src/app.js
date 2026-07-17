import { createMap3D } from "./map-3d.js";
import { createMap2D } from "./map-2d.js";
import { findShortestRoute } from "./router.js";
import { loadSavedRoutes, persistSavedRoutes } from "./storage.js";

const elements = {
  map3d: document.querySelector("#map-3d"),
  map2d: document.querySelector("#map-2d"),
  view3d: document.querySelector("#view-3d"),
  view2d: document.querySelector("#view-2d"),
  resetCamera: document.querySelector("#reset-camera"),
  origin: document.querySelector("#origin-select"),
  destination: document.querySelector("#destination-select"),
  calculate: document.querySelector("#calculate-route"),
  clear: document.querySelector("#clear-route"),
  routeMode: document.querySelector("#route-mode"),
  routePanel: document.querySelector("#route-panel"),
  routeTitle: document.querySelector("#route-title"),
  routeDistance: document.querySelector("#route-distance"),
  routeSteps: document.querySelector("#route-steps"),
  routeName: document.querySelector("#route-name"),
  saveRoute: document.querySelector("#save-route"),
  savedRoutes: document.querySelector("#saved-routes"),
  locationName: document.querySelector("#location-name"),
  locationType: document.querySelector("#location-type"),
  locationDescription: document.querySelector("#location-description"),
  locationMetadata: document.querySelector("#location-metadata"),
  commodityList: document.querySelector("#commodity-list")
};

const [universe, commodities] = await Promise.all([
  loadJson("./public/data/universe.json"),
  loadJson("./public/data/commodities.json")
]);

const nodesById = new Map(universe.nodes.map((node) => [node.id, node]));
let state = {
  view: "3d",
  originId: "",
  destinationId: "",
  selectedNodeId: "",
  route: null,
  savedRoutes: loadSavedRoutes()
};

populateLocationSelects(universe.nodes);
const map3d = createMap3D(elements.map3d, universe, handleMapNodeClick);
const map2d = createMap2D(elements.map2d, universe, handleMapNodeClick);
renderSavedRoutes();
renderSelection();
renderRoute();
updateRouteMode();

function populateLocationSelects(nodes) {
  const systems = [...new Set(nodes.map((node) => node.system))];
  for (const select of [elements.origin, elements.destination]) {
    select.innerHTML = '<option value="">Select a location</option>';
    for (const system of systems) {
      const group = document.createElement("optgroup");
      group.label = system;
      nodes.filter((node) => node.system === system).forEach((node) => {
        const option = document.createElement("option");
        option.value = node.id;
        option.textContent = `${node.name} · ${formatType(node.type)}`;
        group.appendChild(option);
      });
      select.appendChild(group);
    }
  }
}

elements.origin.addEventListener("change", () => {
  state.originId = elements.origin.value;
  state.route = null;
  updateMaps();
  updateRouteMode();
  renderRoute();
});

elements.destination.addEventListener("change", () => {
  state.destinationId = elements.destination.value;
  state.route = null;
  updateMaps();
  updateRouteMode();
  renderRoute();
});

elements.calculate.addEventListener("click", calculateRoute);
elements.clear.addEventListener("click", clearRoute);
elements.saveRoute.addEventListener("click", saveActiveRoute);
elements.resetCamera.addEventListener("click", () => map3d.resetCamera());
elements.view3d.addEventListener("click", () => switchView("3d"));
elements.view2d.addEventListener("click", () => switchView("2d"));

function switchView(view) {
  state.view = view;
  elements.map3d.classList.toggle("hidden", view !== "3d");
  elements.map2d.classList.toggle("hidden", view !== "2d");
  elements.view3d.classList.toggle("active", view === "3d");
  elements.view2d.classList.toggle("active", view === "2d");
  elements.resetCamera.classList.toggle("hidden", view !== "3d");
}

function handleMapNodeClick(nodeId) {
  state.selectedNodeId = nodeId;
  renderSelection();
  updateMaps();

  if (!state.originId) {
    state.originId = nodeId;
    elements.origin.value = nodeId;
  } else if (!state.destinationId && nodeId !== state.originId) {
    state.destinationId = nodeId;
    elements.destination.value = nodeId;
    calculateRoute();
  } else if (nodeId !== state.destinationId) {
    state.originId = nodeId;
    state.destinationId = "";
    state.route = null;
    elements.origin.value = nodeId;
    elements.destination.value = "";
    renderRoute();
    updateMaps();
  }

  updateRouteMode();
}

function calculateRoute() {
  if (!state.originId || !state.destinationId) {
    elements.routeMode.textContent = !state.originId ? "Choose origin" : "Choose destination";
    return;
  }

  state.route = findShortestRoute(
    universe.nodes,
    universe.edges,
    state.originId,
    state.destinationId
  );
  renderRoute();
  updateMaps();
  updateRouteMode();
}

function clearRoute() {
  state.originId = "";
  state.destinationId = "";
  state.route = null;
  elements.origin.value = "";
  elements.destination.value = "";
  elements.routeName.value = "";
  renderRoute();
  updateMaps();
  updateRouteMode();
}

function renderRoute() {
  if (!state.route) {
    elements.routePanel.classList.add("hidden");
    elements.routeSteps.replaceChildren();
    return;
  }

  const origin = nodesById.get(state.originId);
  const destination = nodesById.get(state.destinationId);
  elements.routePanel.classList.remove("hidden");
  elements.routeTitle.textContent = `${origin.name} → ${destination.name}`;
  elements.routeDistance.textContent = `${formatDistance(state.route.distance)} ${universe.metadata.distanceUnit}`;
  elements.routeName.placeholder = `${origin.name} to ${destination.name}`;
  elements.routeSteps.innerHTML = state.route.nodeIds.map((nodeId, index) => {
    const node = nodesById.get(nodeId);
    const nextEdge = state.route.edges[index];
    const detail = nextEdge
      ? `${formatType(nextEdge.kind)} · ${formatDistance(nextEdge.distance)} ${universe.metadata.distanceUnit}`
      : "Destination";
    return `<li><strong>${escapeHtml(node.name)}</strong><small>${escapeHtml(detail)}</small></li>`;
  }).join("");
}

function renderSelection() {
  const node = nodesById.get(state.selectedNodeId);
  if (!node) {
    elements.locationName.textContent = "Nothing selected";
    elements.locationType.textContent = "—";
    elements.locationDescription.textContent = "Select a planet, station, gateway, or jump point to see its details.";
    elements.locationMetadata.replaceChildren();
    elements.commodityList.innerHTML = '<p class="muted-copy">No commodity records loaded.</p>';
    return;
  }

  elements.locationName.textContent = node.name;
  elements.locationType.textContent = formatType(node.type);
  elements.locationDescription.textContent = node.description;
  elements.locationMetadata.innerHTML = `
    <dt>System</dt><dd>${escapeHtml(node.system)}</dd>
    <dt>Map coordinates</dt><dd>${node.position.map((value) => Number(value).toFixed(1)).join(", ")}</dd>
    <dt>Node ID</dt><dd>${escapeHtml(node.id)}</dd>`;

  const records = commodities.locations[node.id] || [];
  elements.commodityList.innerHTML = records.length
    ? records.map((record) => `
      <div class="commodity-row">
        <strong>${escapeHtml(record.commodity)}</strong>
        <span class="commodity-price"><small>BUY</small>${formatPrice(record.buy)}</span>
        <span class="commodity-price"><small>SELL</small>${formatPrice(record.sell)}</span>
      </div>`).join("")
    : '<p class="muted-copy">No commodity records for this location.</p>';
}

function updateMaps() {
  map3d.updateRoute(state.route);
  map2d.updateRoute(state.route);
  map3d.setSelected(state.selectedNodeId);
  map2d.setSelected(state.selectedNodeId);
}

function updateRouteMode() {
  elements.routeMode.textContent = !state.originId
    ? "Choose origin"
    : !state.destinationId
      ? "Choose destination"
      : state.route
        ? "Route ready"
        : "Ready to calculate";
}

function saveActiveRoute() {
  if (!state.route) return;
  const origin = nodesById.get(state.originId);
  const destination = nodesById.get(state.destinationId);
  const savedRoute = {
    id: crypto.randomUUID(),
    name: elements.routeName.value.trim() || `${origin.name} → ${destination.name}`,
    originId: state.originId,
    destinationId: state.destinationId,
    createdAt: new Date().toISOString()
  };
  state.savedRoutes.unshift(savedRoute);
  state.savedRoutes = state.savedRoutes.slice(0, 25);
  persistSavedRoutes(state.savedRoutes);
  elements.routeName.value = "";
  renderSavedRoutes();
}

function renderSavedRoutes() {
  if (state.savedRoutes.length === 0) {
    elements.savedRoutes.innerHTML = '<p class="muted-copy">No saved routes yet.</p>';
    return;
  }

  elements.savedRoutes.innerHTML = state.savedRoutes.map((saved) => {
    const origin = nodesById.get(saved.originId);
    const destination = nodesById.get(saved.destinationId);
    return `
      <div class="saved-route">
        <div>
          <button class="saved-route-title" data-load-route="${saved.id}" type="button">${escapeHtml(saved.name)}</button>
          <div class="saved-route-meta">${escapeHtml(origin?.name || saved.originId)} → ${escapeHtml(destination?.name || saved.destinationId)}</div>
        </div>
        <button data-delete-route="${saved.id}" type="button" aria-label="Delete ${escapeHtml(saved.name)}">Delete</button>
      </div>`;
  }).join("");

  elements.savedRoutes.querySelectorAll("[data-load-route]").forEach((button) => {
    button.addEventListener("click", () => loadSavedRoute(button.dataset.loadRoute));
  });
  elements.savedRoutes.querySelectorAll("[data-delete-route]").forEach((button) => {
    button.addEventListener("click", () => deleteSavedRoute(button.dataset.deleteRoute));
  });
}

function loadSavedRoute(id) {
  const saved = state.savedRoutes.find((route) => route.id === id);
  if (!saved) return;
  state.originId = saved.originId;
  state.destinationId = saved.destinationId;
  state.selectedNodeId = saved.destinationId;
  elements.origin.value = saved.originId;
  elements.destination.value = saved.destinationId;
  renderSelection();
  calculateRoute();
}

function deleteSavedRoute(id) {
  state.savedRoutes = state.savedRoutes.filter((route) => route.id !== id);
  persistSavedRoutes(state.savedRoutes);
  renderSavedRoutes();
}

async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Could not load ${path}: ${response.status}`);
  return response.json();
}

function formatDistance(value) {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatPrice(value) {
  if (value === null || value === undefined || value === "") return "—";
  return Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatType(value) {
  return String(value).replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
