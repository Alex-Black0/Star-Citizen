import { createMap3D } from "./map-3d.js";
import { createMap2D } from "./map-2d.js";
import { findShortestRoute, summarizeRoute } from "./router.js";
import { createHierarchy, scopeForNode, scopeTitle } from "./map-hierarchy.js";
import {
  exportUserData,
  importUserData,
  loadManualPrices,
  loadSavedRoutes,
  loadTradeRuns,
  persistManualPrices,
  persistSavedRoutes,
  persistTradeRuns
} from "./storage.js";

const CONTAINER_SIZES = [36, 24, 12, 8, 1];
const TRADEABLE_TYPES = new Set(["planet", "planetoid", "station", "moon", "city", "outpost", "poi", "lagrange"]);

const elements = {
  map3d: document.querySelector("#map-3d"),
  map2d: document.querySelector("#map-2d"),
  view3d: document.querySelector("#view-3d"),
  view2d: document.querySelector("#view-2d"),
  resetCamera: document.querySelector("#reset-camera"),
  navUniverse: document.querySelector("#nav-universe"),
  navSystem: document.querySelector("#nav-system"),
  navLocal: document.querySelector("#nav-local"),
  navLocalDivider: document.querySelector("#nav-local-divider"),
  mapLevelTitle: document.querySelector("#map-level-title"),
  mapLevelHint: document.querySelector("#map-level-hint"),
  origin: document.querySelector("#origin-select"),
  destination: document.querySelector("#destination-select"),
  calculate: document.querySelector("#calculate-route"),
  clear: document.querySelector("#clear-route"),
  routeMode: document.querySelector("#route-mode"),
  routePanel: document.querySelector("#route-panel"),
  routeTitle: document.querySelector("#route-title"),
  routeDistance: document.querySelector("#route-distance"),
  routeDataStatus: document.querySelector("#route-data-status"),
  routeSteps: document.querySelector("#route-steps"),
  routeName: document.querySelector("#route-name"),
  saveRoute: document.querySelector("#save-route"),
  routeToTradeRun: document.querySelector("#route-to-trade-run"),
  savedRoutes: document.querySelector("#saved-routes"),
  locationName: document.querySelector("#location-name"),
  locationType: document.querySelector("#location-type"),
  locationDescription: document.querySelector("#location-description"),
  locationMetadata: document.querySelector("#location-metadata"),
  commodityList: document.querySelector("#commodity-list"),
  commoditySourceBadge: document.querySelector("#commodity-source-badge"),
  addLocationPrice: document.querySelector("#add-location-price"),
  openLocalMap: document.querySelector("#open-local-map"),
  tradeDrawerOpen: document.querySelector("#trade-drawer-open"),
  tradeDrawerClose: document.querySelector("#trade-drawer-close"),
  tradeDrawer: document.querySelector("#trade-drawer"),
  drawerBackdrop: document.querySelector("#drawer-backdrop"),
  tradeRunCount: document.querySelector("#trade-run-count"),
  tabSavedRuns: document.querySelector("#tab-saved-runs"),
  tabRunForm: document.querySelector("#tab-run-form"),
  tabPriceForm: document.querySelector("#tab-price-form"),
  panelSavedRuns: document.querySelector("#panel-saved-runs"),
  panelRunForm: document.querySelector("#panel-run-form"),
  panelPriceForm: document.querySelector("#panel-price-form"),
  newTradeRun: document.querySelector("#new-trade-run"),
  savedTradeRuns: document.querySelector("#saved-trade-runs"),
  exportUserData: document.querySelector("#export-user-data"),
  importUserData: document.querySelector("#import-user-data"),
  importUserDataFile: document.querySelector("#import-user-data-file"),
  tradeRunForm: document.querySelector("#trade-run-form"),
  tradeRunId: document.querySelector("#trade-run-id"),
  tradeRunName: document.querySelector("#trade-run-name"),
  tradeOrigin: document.querySelector("#trade-origin"),
  tradeDestination: document.querySelector("#trade-destination"),
  tradeCommodity: document.querySelector("#trade-commodity"),
  tradeBuyPrice: document.querySelector("#trade-buy-price"),
  tradeSellPrice: document.querySelector("#trade-sell-price"),
  tradeNotes: document.querySelector("#trade-notes"),
  tradeTotalScu: document.querySelector("#trade-total-scu"),
  tradeInvestment: document.querySelector("#trade-investment"),
  tradeRevenue: document.querySelector("#trade-revenue"),
  tradeProfit: document.querySelector("#trade-profit"),
  tradeRunSubmitLabel: document.querySelector("#trade-run-submit-label"),
  cancelTradeRun: document.querySelector("#cancel-trade-run"),
  locationPriceForm: document.querySelector("#location-price-form"),
  locationPriceId: document.querySelector("#location-price-id"),
  priceLocation: document.querySelector("#price-location"),
  priceCommodity: document.querySelector("#price-commodity"),
  priceBuy: document.querySelector("#price-buy"),
  priceSell: document.querySelector("#price-sell"),
  priceStock: document.querySelector("#price-stock"),
  priceNotes: document.querySelector("#price-notes"),
  locationPriceSubmitLabel: document.querySelector("#location-price-submit-label"),
  cancelLocationPrice: document.querySelector("#cancel-location-price"),
  onboarding: document.querySelector("#onboarding"),
  onboardingStart: document.querySelector("#onboarding-start"),
  onboardingDismiss: document.querySelector("#onboarding-dismiss"),
  toast: document.querySelector("#toast")
};

const [universe, commodities] = await Promise.all([
  loadJson("./public/data/universe.json"),
  loadJson("./public/data/commodities.json")
]);

const nodesById = new Map(universe.nodes.map((node) => [node.id, node]));
const hierarchy = createHierarchy(universe);
const routableNodes = universe.nodes.filter((node) =>
  node.visible !== false &&
  node.selectable !== false &&
  node.routable !== false &&
  node.routeInternal !== true
);
const tradeableNodes = routableNodes.filter((node) => TRADEABLE_TYPES.has(node.type));

let state = {
  view: "3d",
  originId: "",
  destinationId: "",
  selectedNodeId: "",
  route: null,
  savedRoutes: loadSavedRoutes(),
  tradeRuns: loadTradeRuns(),
  manualPrices: loadManualPrices(),
  drawerTab: "saved",
  mapScope: { level: "overview", system: null, anchorId: null }
};

populateLocationSelects(routableNodes, elements.origin, elements.destination);
populateLocationSelects(tradeableNodes, elements.tradeOrigin, elements.tradeDestination, elements.priceLocation);

const map3d = createMap3D(elements.map3d, universe, handleMapNodeClick, handleMapScaleRequest);
const map2d = createMap2D(elements.map2d, universe, handleMapNodeClick);
map3d.setScope(state.mapScope);
map2d.setScope(state.mapScope);

bindEvents();
renderSavedRoutes();
renderSavedTradeRuns();
renderSelection();
renderRoute();
updateRouteMode();
updateTradeMath();
renderRouteDataStatus();
updateMapNavigation();
showOnboardingIfNeeded();

function bindEvents() {
  elements.origin.addEventListener("change", () => {
    state.originId = elements.origin.value;
    state.route = null;
    focusMapForNode(state.originId);
    updateMaps();
    updateRouteMode();
    renderRoute();
  });

  elements.destination.addEventListener("change", () => {
    state.destinationId = elements.destination.value;
    state.route = null;
    focusMapForNode(state.destinationId);
    updateMaps();
    updateRouteMode();
    renderRoute();
  });

  elements.calculate.addEventListener("click", calculateRoute);
  elements.clear.addEventListener("click", clearRoute);
  elements.saveRoute.addEventListener("click", saveActiveRoute);
  elements.routeToTradeRun.addEventListener("click", () => openTradeRunForm({
    originId: state.originId,
    destinationId: state.destinationId
  }));
  elements.resetCamera.addEventListener("click", () => map3d.resetCamera());
  elements.view3d.addEventListener("click", () => switchView("3d"));
  elements.view2d.addEventListener("click", () => switchView("2d"));
  elements.navUniverse.addEventListener("click", enterOverview);
  elements.navSystem.addEventListener("click", () => state.mapScope.system && enterSystem(state.mapScope.system));
  elements.navLocal.addEventListener("click", () => state.mapScope.anchorId && enterLocal(state.mapScope.anchorId));
  elements.openLocalMap.addEventListener("click", () => {
    const node = nodesById.get(state.selectedNodeId);
    const anchor = hierarchy.getLocalAnchor(node);
    if (anchor) enterLocal(anchor.id);
  });

  elements.tradeDrawerOpen.addEventListener("click", () => openDrawer("saved"));
  elements.tradeDrawerClose.addEventListener("click", closeDrawer);
  elements.drawerBackdrop.addEventListener("click", closeDrawer);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && elements.tradeDrawer.classList.contains("open")) closeDrawer();
  });

  elements.tabSavedRuns.addEventListener("click", () => switchDrawerTab("saved"));
  elements.tabRunForm.addEventListener("click", () => switchDrawerTab("run"));
  elements.tabPriceForm.addEventListener("click", () => switchDrawerTab("price"));
  elements.newTradeRun.addEventListener("click", () => openTradeRunForm());
  elements.addLocationPrice.addEventListener("click", () => openLocationPriceForm({ locationId: state.selectedNodeId }));

  elements.tradeRunForm.addEventListener("submit", saveTradeRun);
  elements.locationPriceForm.addEventListener("submit", saveLocationPrice);
  elements.cancelTradeRun.addEventListener("click", () => switchDrawerTab("saved"));
  elements.cancelLocationPrice.addEventListener("click", () => switchDrawerTab("saved"));

  elements.tradeRunForm.querySelectorAll("input, select").forEach((input) => {
    input.addEventListener("input", updateTradeMath);
    input.addEventListener("change", updateTradeMath);
  });

  elements.exportUserData.addEventListener("click", exportDataFile);
  elements.importUserData.addEventListener("click", () => elements.importUserDataFile.click());
  elements.importUserDataFile.addEventListener("change", importDataFile);
  elements.onboardingStart?.addEventListener("click", () => closeOnboarding(false));
  elements.onboardingDismiss?.addEventListener("click", () => closeOnboarding(true));
}

function populateLocationSelects(nodes, ...selects) {
  const systemOrder = hierarchy.systemOrder;
  const typeOrder = new Map([
    ["planet", 1], ["planetoid", 2], ["gateway", 3], ["jump-point", 4], ["station", 5],
    ["moon", 6], ["city", 7], ["lagrange", 8], ["outpost", 9], ["poi", 10]
  ]);

  for (const select of selects) {
    select.innerHTML = '<option value="">Select a location</option>';
    for (const system of systemOrder) {
      const systemNodes = nodes.filter((node) => node.system === system).sort((a, b) => {
        const parentA = hierarchy.getParent(a.id)?.name || "";
        const parentB = hierarchy.getParent(b.id)?.name || "";
        return parentA.localeCompare(parentB) || (typeOrder.get(a.type) || 99) - (typeOrder.get(b.type) || 99) || a.name.localeCompare(b.name);
      });
      if (!systemNodes.length) continue;
      const group = document.createElement("optgroup");
      group.label = `${system} System`;
      for (const node of systemNodes) {
        const option = document.createElement("option");
        const parent = hierarchy.getParent(node.id);
        option.value = node.id;
        option.textContent = parent
          ? `${parent.name} › ${node.name} · ${formatType(node.type)}`
          : `${node.name} · ${formatType(node.type)}`;
        group.appendChild(option);
      }
      select.appendChild(group);
    }
  }
}

function switchView(view) {
  state.view = view;
  elements.map3d.classList.toggle("hidden", view !== "3d");
  elements.map2d.classList.toggle("hidden", view !== "2d");
  elements.view3d.classList.toggle("active", view === "3d");
  elements.view2d.classList.toggle("active", view === "2d");
  elements.resetCamera.classList.toggle("hidden", view !== "3d");
}

function handleMapNodeClick(nodeId) {
  const clickedNode = nodesById.get(nodeId);
  if (!clickedNode || clickedNode.visible === false) return;

  if (state.mapScope.level === "overview" && clickedNode.type === "star") {
    enterSystem(clickedNode.system);
    return;
  }

  state.selectedNodeId = nodeId;
  renderSelection();
  updateMaps();

  if (clickedNode.selectable === false || clickedNode.routable === false || clickedNode.routeInternal === true) {
    updateRouteMode();
    return;
  }

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

function handleMapScaleRequest(nextScope) {
  if (nextScope.level === "overview") enterOverview();
  else if (nextScope.level === "system") enterSystem(nextScope.system);
  else if (nextScope.level === "local") enterLocal(nextScope.anchorId);
}

function enterOverview() {
  setMapScope({ level: "overview", system: null, anchorId: null });
}

function enterSystem(system) {
  if (!system) return;
  setMapScope({ level: "system", system, anchorId: null });
}

function enterLocal(anchorId) {
  const anchor = nodesById.get(anchorId);
  if (!anchor) return;
  setMapScope({ level: "local", system: anchor.system, anchorId: anchor.id });
  state.selectedNodeId = anchor.id;
  renderSelection();
  updateMaps();
}

function setMapScope(nextScope) {
  state.mapScope = nextScope;
  map3d.setScope(nextScope);
  map2d.setScope(nextScope);
  updateMapNavigation();
  updateMaps();
}

function focusMapForNode(nodeId) {
  const node = nodesById.get(nodeId);
  if (!node) return;
  const nextScope = scopeForNode(node, hierarchy);
  if (nextScope.level === "local" && !hierarchy.hasLocalChildren(nextScope.anchorId) && node.id === nextScope.anchorId) {
    enterSystem(node.system);
  } else {
    setMapScope(nextScope);
  }
  state.selectedNodeId = node.id;
  renderSelection();
}

function updateMapNavigation() {
  const scope = state.mapScope;
  elements.mapLevelTitle.textContent = scopeTitle(scope, hierarchy);
  elements.mapLevelHint.textContent = scope.level === "overview"
    ? "Select a system to open its planetary map."
    : scope.level === "system"
      ? "Orbital rings show direction and spacing. Select a planet, then zoom in or open its local map."
      : "Local view shows moons, stations, cities, and nearby points. Zoom out to return to the system.";
  elements.navUniverse.classList.toggle("active", scope.level === "overview");
  elements.navSystem.classList.toggle("hidden", scope.level === "overview");
  elements.navSystem.classList.toggle("active", scope.level === "system");
  elements.navSystem.textContent = scope.system ? `${scope.system} System` : "System";
  elements.navLocal.classList.toggle("hidden", scope.level !== "local");
  elements.navLocalDivider.classList.toggle("hidden", scope.level !== "local");
  elements.navLocal.classList.toggle("active", scope.level === "local");
  elements.navLocal.textContent = scope.anchorId ? nodesById.get(scope.anchorId)?.name || "Local" : "Local";
}

function calculateRoute() {
  if (!state.originId || !state.destinationId) {
    elements.routeMode.textContent = !state.originId ? "Choose origin" : "Choose destination";
    return null;
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
  return state.route;
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
  const routeSteps = summarizeRoute(state.route, universe.nodes);

  elements.routePanel.classList.remove("hidden");
  elements.routeTitle.textContent = `${origin.name} → ${destination.name}`;
  elements.routeDistance.textContent = `${formatDistance(state.route.distance)} ${universe.metadata.distanceUnit}`;
  elements.routeName.placeholder = `${origin.name} to ${destination.name}`;
  elements.routeSteps.innerHTML = routeSteps.map((step, index) => {
    const node = nodesById.get(step.nodeId);
    const kinds = step.kinds.map(formatType).join(" + ");
    const detail = index === 0
      ? "Origin"
      : `${kinds || "Travel"} · ${formatDistance(step.distanceFromPrevious)} ${universe.metadata.distanceUnit}`;
    return `<li><strong>${escapeHtml(node.name)}</strong><small>${escapeHtml(detail)}</small></li>`;
  }).join("");
}

function renderRouteDataStatus() {
  if (!elements.routeDataStatus) return;
  const metadata = universe.metadata || {};
  const parts = [
    metadata.source || "Route dataset",
    metadata.gameVersion ? `Game ${metadata.gameVersion}` : null,
    metadata.updatedAt ? `Updated ${new Date(metadata.updatedAt).toLocaleDateString()}` : null
  ].filter(Boolean);
  elements.routeDataStatus.textContent = parts.join(" · ");
  elements.routeDataStatus.classList.toggle("warning", metadata.authoritative === false);
}

function getLocationCommodityRecords(locationId) {
  const snapshotRecords = (commodities.locations[locationId] || []).map((record, index) => ({
    ...record,
    id: `snapshot-${locationId}-${index}`,
    locationId,
    source: commodities.metadata?.source || "Snapshot",
    sourceType: "snapshot",
    stockScu: record.stockScu ?? null,
    updatedAt: commodities.metadata?.updatedAt || null
  }));

  const manualRecords = state.manualPrices
    .filter((record) => record.locationId === locationId)
    .map((record) => ({ ...record, source: "Manual", sourceType: "manual" }));

  return [...manualRecords, ...snapshotRecords];
}

function renderSelection() {
  const node = nodesById.get(state.selectedNodeId);
  if (!node) {
    elements.locationName.textContent = "Nothing selected";
    elements.locationType.textContent = "—";
    elements.locationDescription.textContent = "Select a planet, station, gateway, or jump point to see its details.";
    elements.locationMetadata.replaceChildren();
    elements.commodityList.innerHTML = '<p class="muted-copy">No commodity records loaded.</p>';
    elements.addLocationPrice.classList.add("hidden");
    elements.openLocalMap.classList.add("hidden");
    return;
  }

  elements.locationName.textContent = node.name;
  elements.locationType.textContent = formatType(node.type);
  elements.locationDescription.textContent = node.description;
  elements.locationMetadata.innerHTML = `
    <dt>System</dt><dd>${escapeHtml(node.system)}</dd>
    <dt>Map coordinates</dt><dd>${node.position.map((value) => Number(value).toFixed(1)).join(", ")}</dd>
    <dt>Node ID</dt><dd>${escapeHtml(node.id)}</dd>
    <dt>Data source</dt><dd>${escapeHtml(node.dataSource || universe.metadata?.source || "Map dataset")}</dd>`;

  const parent = hierarchy.getParent(node.id);
  if (parent) {
    elements.locationMetadata.insertAdjacentHTML("beforeend", `<dt>Parent</dt><dd>${escapeHtml(parent.name)}</dd>`);
  }

  const tradeable = TRADEABLE_TYPES.has(node.type);
  elements.addLocationPrice.classList.toggle("hidden", !tradeable);
  const localAnchor = hierarchy.getLocalAnchor(node);
  const localAvailable = Boolean(localAnchor && (hierarchy.hasLocalChildren(localAnchor.id) || parent));
  elements.openLocalMap.classList.toggle("hidden", !localAvailable || state.mapScope.level === "local");
  elements.openLocalMap.textContent = localAnchor ? `Open ${localAnchor.name} local map` : "Open local map";

  const records = getLocationCommodityRecords(node.id);
  elements.commoditySourceBadge.textContent = records.some((record) => record.sourceType === "manual")
    ? "SNAPSHOT + MANUAL"
    : "SNAPSHOT";

  elements.commodityList.innerHTML = records.length
    ? records.map((record, index) => `
      <div class="commodity-row expanded">
        <div class="commodity-main">
          <strong>${escapeHtml(record.commodity)}</strong>
          <small>${escapeHtml(record.sourceType === "manual" ? "Manual entry" : "Data snapshot")}${record.stockScu !== null && record.stockScu !== undefined && record.stockScu !== "" ? ` · ${formatWhole(record.stockScu)} SCU` : ""}</small>
        </div>
        <span class="commodity-price"><small>BUY / SCU</small>${formatPrice(record.buy)}</span>
        <span class="commodity-price"><small>SELL / SCU</small>${formatPrice(record.sell)}</span>
        <div class="commodity-actions">
          <button class="mini-button" data-use-price="${index}" type="button">Create run</button>
          ${record.sourceType === "manual" ? `<button class="mini-button" data-edit-price="${escapeHtml(record.id)}" type="button">Edit</button><button class="mini-button danger" data-delete-price="${escapeHtml(record.id)}" type="button">Delete</button>` : ""}
        </div>
      </div>`).join("")
    : '<p class="muted-copy">No commodity records for this location. Use “Add commodity price here” to create one.</p>';

  elements.commodityList.querySelectorAll("[data-use-price]").forEach((button) => {
    button.addEventListener("click", () => {
      const record = records[Number(button.dataset.usePrice)];
      openTradeRunForm({
        originId: node.id,
        commodity: record.commodity,
        buyPrice: record.buy,
        sellPrice: record.sell
      });
    });
  });

  elements.commodityList.querySelectorAll("[data-edit-price]").forEach((button) => {
    button.addEventListener("click", () => {
      const record = state.manualPrices.find((item) => item.id === button.dataset.editPrice);
      if (record) openLocationPriceForm(record);
    });
  });

  elements.commodityList.querySelectorAll("[data-delete-price]").forEach((button) => {
    button.addEventListener("click", () => deleteLocationPrice(button.dataset.deletePrice));
  });
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
  showToast("Route saved in this browser.");
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
  loadRoute(saved.originId, saved.destinationId);
}

function loadRoute(originId, destinationId) {
  state.originId = originId;
  state.destinationId = destinationId;
  state.selectedNodeId = destinationId;
  elements.origin.value = originId;
  elements.destination.value = destinationId;
  renderSelection();
  calculateRoute();
}

function deleteSavedRoute(id) {
  state.savedRoutes = state.savedRoutes.filter((route) => route.id !== id);
  persistSavedRoutes(state.savedRoutes);
  renderSavedRoutes();
}

function openDrawer(tab = "saved") {
  elements.tradeDrawer.classList.add("open");
  elements.tradeDrawer.setAttribute("aria-hidden", "false");
  elements.drawerBackdrop.classList.remove("hidden");
  switchDrawerTab(tab);
}

function closeDrawer() {
  elements.tradeDrawer.classList.remove("open");
  elements.tradeDrawer.setAttribute("aria-hidden", "true");
  elements.drawerBackdrop.classList.add("hidden");
}

function switchDrawerTab(tab) {
  state.drawerTab = tab;
  const tabs = {
    saved: [elements.tabSavedRuns, elements.panelSavedRuns],
    run: [elements.tabRunForm, elements.panelRunForm],
    price: [elements.tabPriceForm, elements.panelPriceForm]
  };

  Object.values(tabs).forEach(([button, panel]) => {
    const active = button === tabs[tab][0];
    button.classList.toggle("active", active);
    panel.classList.toggle("active", active);
  });
}

function openTradeRunForm(prefill = {}) {
  resetTradeRunForm();
  elements.tradeRunId.value = prefill.id || "";
  elements.tradeRunName.value = prefill.name || "";
  elements.tradeOrigin.value = prefill.originId || state.originId || (TRADEABLE_TYPES.has(nodesById.get(state.selectedNodeId)?.type) ? state.selectedNodeId : "");
  elements.tradeDestination.value = prefill.destinationId || state.destinationId || "";
  elements.tradeCommodity.value = prefill.commodity || "";
  elements.tradeBuyPrice.value = numberOrBlank(prefill.buyPrice);
  elements.tradeSellPrice.value = numberOrBlank(prefill.sellPrice);
  elements.tradeNotes.value = prefill.notes || "";

  if (prefill.containers) {
    elements.tradeRunForm.querySelectorAll("[data-container-size]").forEach((input) => {
      input.value = Math.max(0, Number(prefill.containers[input.dataset.containerSize] || 0));
    });
  }

  elements.tradeRunSubmitLabel.textContent = prefill.id ? "Update trade run" : "Save trade run";
  updateTradeMath();
  openDrawer("run");
}

function resetTradeRunForm() {
  elements.tradeRunForm.reset();
  elements.tradeRunId.value = "";
  elements.tradeRunForm.querySelectorAll("[data-container-size]").forEach((input) => {
    input.value = "0";
  });
  elements.tradeRunSubmitLabel.textContent = "Save trade run";
}

function getContainerBreakdown() {
  const containers = {};
  elements.tradeRunForm.querySelectorAll("[data-container-size]").forEach((input) => {
    const size = input.dataset.containerSize;
    containers[size] = Math.max(0, Math.floor(Number(input.value) || 0));
  });
  return containers;
}

function calculateTotalScu(containers) {
  return CONTAINER_SIZES.reduce((total, size) => total + size * Number(containers[String(size)] || 0), 0);
}

function updateTradeMath() {
  const containers = getContainerBreakdown();
  const totalScu = calculateTotalScu(containers);
  const buyPrice = Number(elements.tradeBuyPrice.value) || 0;
  const sellPrice = Number(elements.tradeSellPrice.value) || 0;
  const investment = totalScu * buyPrice;
  const revenue = totalScu * sellPrice;
  const profit = revenue - investment;

  elements.tradeTotalScu.textContent = `${formatWhole(totalScu)} SCU`;
  elements.tradeInvestment.textContent = `${formatAuec(investment)} aUEC`;
  elements.tradeRevenue.textContent = `${formatAuec(revenue)} aUEC`;
  elements.tradeProfit.textContent = `${formatSignedAuec(profit)} aUEC`;
  elements.tradeProfit.classList.toggle("negative", profit < 0);
}

function saveTradeRun(event) {
  event.preventDefault();
  const originId = elements.tradeOrigin.value;
  const destinationId = elements.tradeDestination.value;
  const containers = getContainerBreakdown();
  const totalScu = calculateTotalScu(containers);
  const buyPrice = Number(elements.tradeBuyPrice.value);
  const sellPrice = Number(elements.tradeSellPrice.value);

  if (!originId || !destinationId) {
    showToast("Choose both a buy and sell location.", true);
    return;
  }
  if (originId === destinationId) {
    showToast("The buy and sell locations must be different.", true);
    return;
  }
  if (totalScu <= 0) {
    showToast("Add at least one cargo container.", true);
    return;
  }

  const existingId = elements.tradeRunId.value;
  const existing = state.tradeRuns.find((run) => run.id === existingId);
  const now = new Date().toISOString();
  const run = {
    id: existingId || crypto.randomUUID(),
    name: elements.tradeRunName.value.trim() || `${elements.tradeCommodity.value.trim()} · ${nodesById.get(originId)?.name} → ${nodesById.get(destinationId)?.name}`,
    originId,
    destinationId,
    commodity: elements.tradeCommodity.value.trim(),
    containers,
    totalScu,
    buyPrice,
    sellPrice,
    investment: totalScu * buyPrice,
    revenue: totalScu * sellPrice,
    profit: totalScu * (sellPrice - buyPrice),
    notes: elements.tradeNotes.value.trim(),
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };

  state.tradeRuns = existingId
    ? state.tradeRuns.map((item) => item.id === existingId ? run : item)
    : [run, ...state.tradeRuns];

  state.tradeRuns = state.tradeRuns.slice(0, 100);
  persistTradeRuns(state.tradeRuns);
  renderSavedTradeRuns();
  switchDrawerTab("saved");
  showToast(existingId ? "Trade run updated." : "Trade run saved.");
}

function renderSavedTradeRuns() {
  elements.tradeRunCount.textContent = String(state.tradeRuns.length);

  if (state.tradeRuns.length === 0) {
    elements.savedTradeRuns.innerHTML = `
      <div class="empty-state">
        <strong>No commodity runs saved</strong>
        <p>Create a route, choose a commodity, and add your cargo container counts.</p>
      </div>`;
    return;
  }

  elements.savedTradeRuns.innerHTML = state.tradeRuns.map((run) => {
    const origin = nodesById.get(run.originId);
    const destination = nodesById.get(run.destinationId);
    const cargoSummary = CONTAINER_SIZES
      .filter((size) => Number(run.containers?.[String(size)] || 0) > 0)
      .map((size) => `${run.containers[String(size)]}×${size}`)
      .join(" · ");

    return `
      <article class="trade-run-card">
        <div class="trade-run-card-header">
          <div>
            <p class="eyebrow">${escapeHtml(run.commodity)}</p>
            <h3>${escapeHtml(run.name)}</h3>
          </div>
          <strong class="profit-value ${Number(run.profit) < 0 ? "negative" : ""}">${formatSignedAuec(run.profit)} aUEC</strong>
        </div>
        <div class="trade-route-line">
          <span><small>BUY</small>${escapeHtml(origin?.name || run.originId)}</span>
          <b>→</b>
          <span><small>SELL</small>${escapeHtml(destination?.name || run.destinationId)}</span>
        </div>
        <div class="trade-stats">
          <span><small>CARGO</small>${formatWhole(run.totalScu)} SCU</span>
          <span><small>BUY / SCU</small>${formatPrice(run.buyPrice)}</span>
          <span><small>SELL / SCU</small>${formatPrice(run.sellPrice)}</span>
        </div>
        <p class="container-summary">${escapeHtml(cargoSummary || "No container breakdown")}</p>
        ${run.notes ? `<p class="trade-notes-preview">${escapeHtml(run.notes)}</p>` : ""}
        <div class="trade-card-actions">
          <button class="button primary" data-load-trade-run="${run.id}" type="button">Load route</button>
          <button class="button secondary" data-edit-trade-run="${run.id}" type="button">Edit</button>
          <button class="button secondary danger-button" data-delete-trade-run="${run.id}" type="button">Delete</button>
        </div>
      </article>`;
  }).join("");

  elements.savedTradeRuns.querySelectorAll("[data-load-trade-run]").forEach((button) => {
    button.addEventListener("click", () => {
      const run = state.tradeRuns.find((item) => item.id === button.dataset.loadTradeRun);
      if (!run) return;
      loadRoute(run.originId, run.destinationId);
      closeDrawer();
      showToast(`${run.name} loaded on the map.`);
    });
  });

  elements.savedTradeRuns.querySelectorAll("[data-edit-trade-run]").forEach((button) => {
    button.addEventListener("click", () => {
      const run = state.tradeRuns.find((item) => item.id === button.dataset.editTradeRun);
      if (run) openTradeRunForm(run);
    });
  });

  elements.savedTradeRuns.querySelectorAll("[data-delete-trade-run]").forEach((button) => {
    button.addEventListener("click", () => deleteTradeRun(button.dataset.deleteTradeRun));
  });
}

function deleteTradeRun(id) {
  const run = state.tradeRuns.find((item) => item.id === id);
  if (!run || !window.confirm(`Delete “${run.name}”?`)) return;
  state.tradeRuns = state.tradeRuns.filter((item) => item.id !== id);
  persistTradeRuns(state.tradeRuns);
  renderSavedTradeRuns();
  showToast("Trade run deleted.");
}

function openLocationPriceForm(prefill = {}) {
  elements.locationPriceForm.reset();
  elements.locationPriceId.value = prefill.id || "";
  elements.priceLocation.value = prefill.locationId || state.selectedNodeId || "";
  elements.priceCommodity.value = prefill.commodity || "";
  elements.priceBuy.value = numberOrBlank(prefill.buy);
  elements.priceSell.value = numberOrBlank(prefill.sell);
  elements.priceStock.value = numberOrBlank(prefill.stockScu);
  elements.priceNotes.value = prefill.notes || "";
  elements.locationPriceSubmitLabel.textContent = prefill.id ? "Update location price" : "Save location price";
  openDrawer("price");
}

function saveLocationPrice(event) {
  event.preventDefault();
  const locationId = elements.priceLocation.value;
  const buy = nullableNumber(elements.priceBuy.value);
  const sell = nullableNumber(elements.priceSell.value);

  if (buy === null && sell === null) {
    showToast("Enter a buy price, sell price, or both.", true);
    return;
  }

  const existingId = elements.locationPriceId.value;
  const existing = state.manualPrices.find((record) => record.id === existingId);
  const now = new Date().toISOString();
  const record = {
    id: existingId || crypto.randomUUID(),
    locationId,
    commodity: elements.priceCommodity.value.trim(),
    buy,
    sell,
    stockScu: nullableNumber(elements.priceStock.value),
    notes: elements.priceNotes.value.trim(),
    sourceType: "manual",
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };

  state.manualPrices = existingId
    ? state.manualPrices.map((item) => item.id === existingId ? record : item)
    : [record, ...state.manualPrices];

  persistManualPrices(state.manualPrices);
  state.selectedNodeId = locationId;
  renderSelection();
  switchDrawerTab("saved");
  showToast(existingId ? "Location price updated." : "Location price saved.");
}

function deleteLocationPrice(id) {
  const record = state.manualPrices.find((item) => item.id === id);
  if (!record || !window.confirm(`Delete the manual ${record.commodity} price?`)) return;
  state.manualPrices = state.manualPrices.filter((item) => item.id !== id);
  persistManualPrices(state.manualPrices);
  renderSelection();
  showToast("Manual price deleted.");
}

function exportDataFile() {
  const payload = exportUserData();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `verse-map-data-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("Trade data exported.");
}

async function importDataFile() {
  const [file] = elements.importUserDataFile.files;
  elements.importUserDataFile.value = "";
  if (!file) return;

  try {
    const payload = JSON.parse(await file.text());
    const imported = importUserData(payload);
    state.savedRoutes = imported.savedRoutes;
    state.tradeRuns = imported.tradeRuns;
    state.manualPrices = imported.manualPrices;
    renderSavedRoutes();
    renderSavedTradeRuns();
    renderSelection();
    showToast("Trade data imported.");
  } catch (error) {
    console.error(error);
    showToast("Could not import that JSON file.", true);
  }
}

function showOnboardingIfNeeded() {
  if (!elements.onboarding) return;
  if (localStorage.getItem("verse-map-onboarding-v4") === "dismissed") return;
  elements.onboarding.classList.remove("hidden");
}

function closeOnboarding(dontShowAgain) {
  elements.onboarding?.classList.add("hidden");
  if (dontShowAgain) localStorage.setItem("verse-map-onboarding-v4", "dismissed");
}

let toastTimer;
function showToast(message, error = false) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.remove("hidden", "error");
  elements.toast.classList.toggle("error", error);
  toastTimer = window.setTimeout(() => elements.toast.classList.add("hidden"), 3200);
}

async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Could not load ${path}: ${response.status}`);
  return response.json();
}

function nullableNumber(value) {
  return value === "" || value === null || value === undefined ? null : Number(value);
}

function numberOrBlank(value) {
  return value === null || value === undefined || value === "" ? "" : String(value);
}

function formatDistance(value) {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatPrice(value) {
  if (value === null || value === undefined || value === "") return "—";
  return Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatWhole(value) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatAuec(value) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatSignedAuec(value) {
  const number = Number(value || 0);
  const prefix = number > 0 ? "+" : "";
  return `${prefix}${formatAuec(number)}`;
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
