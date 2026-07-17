const STORAGE_KEY = "verse-route-map.saved-routes.v1";

export function loadSavedRoutes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const routes = raw ? JSON.parse(raw) : [];
    return Array.isArray(routes) ? routes : [];
  } catch (error) {
    console.warn("Could not load saved routes", error);
    return [];
  }
}

export function persistSavedRoutes(routes) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(routes));
}
