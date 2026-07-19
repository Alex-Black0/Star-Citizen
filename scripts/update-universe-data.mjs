import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const API_BASES = (process.env.UEX_API_BASES || process.env.UEX_API_BASE || "https://api.uexcorp.uk/2.0,https://api.uexcorp.space/2.0")
  .split(",")
  .map((value) => value.trim().replace(/\/$/, ""))
  .filter(Boolean);
const OUTPUT_PATH = path.resolve(process.env.UNIVERSE_OUTPUT || "public/data/universe.json");
const LOCATION_MAP_PATH = path.resolve(process.env.UEX_LOCATION_MAP || "public/data/uex-location-map.json");
const OVERRIDES_PATH = path.resolve(process.env.ROUTE_OVERRIDES || "public/data/route-overrides.json");
const FALLBACK_PATH = path.resolve(process.env.UNIVERSE_FALLBACK || "public/data/universe.json");

const headers = {
  Accept: "application/json",
  "User-Agent": "Verse-Route-Map/0.3 (+https://github.com/Alex-Black0/Star-Citizen)"
};

const fallback = await readJsonOrNull(FALLBACK_PATH);
const overrides = (await readJsonOrNull(OVERRIDES_PATH))?.routes || [];
const fallbackIds = new Map(
  (fallback?.nodes || [])
    .filter((node) => node.visible !== false)
    .map((node) => [locationKey(node.system, node.name), node.id])
);
const fallbackPositions = new Map(
  (fallback?.nodes || []).map((node) => [locationKey(node.system, node.name), node.position])
);

console.log(`Loading UEX systems from ${API_BASES.join(" or ")}`);
const systems = (await fetchRows("star_systems"))
  .filter(isLiveVisible)
  .sort((a, b) => String(a.name).localeCompare(String(b.name)));

if (systems.length === 0) {
  throw new Error("UEX returned no live, visible star systems. The fallback universe file was not replaced.");
}

const datasets = [];
for (const system of systems) {
  const systemId = Number(system.id);
  console.log(`Loading ${system.name} locations...`);
  const [orbits, planets, moons, stations, cities, outposts, poi] = await Promise.all([
    fetchRows("orbits", { id_star_system: systemId }),
    fetchRows("planets", { id_star_system: systemId }),
    fetchRows("moons", { id_star_system: systemId }),
    fetchRows("space_stations", { id_star_system: systemId }),
    fetchRows("cities", { id_star_system: systemId }),
    fetchRows("outposts", { id_star_system: systemId }),
    fetchRows("poi", { id_star_system: systemId })
  ]);

  datasets.push({
    system,
    orbits: orbits.filter(isLiveVisible),
    planets: planets.filter(isLiveVisible),
    moons: moons.filter(isLiveVisible),
    stations: stations.filter(isLiveVisible),
    cities: cities.filter(isLiveVisible),
    outposts: outposts.filter(isLiveVisible),
    poi: poi.filter(isLiveVisible)
  });
}

const distanceRows = [];
for (const system of systems) {
  try {
    const rows = await fetchRows("orbits_distances", {
      id_star_system_origin: system.id,
      id_star_system_destination: system.id
    });
    distanceRows.push(...rows);
    console.log(`Loaded ${rows.length} same-system orbit distances for ${system.name}`);
  } catch (error) {
    console.warn(`Could not load ${system.name} orbit distances: ${error.message}`);
  }
}

if (distanceRows.length === 0) {
  throw new Error("UEX returned no orbit-distance rows. The fallback universe file was not replaced.");
}

const built = buildUniverse({ systems, datasets, distanceRows, overrides, fallbackIds, fallbackPositions });
await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
await writeFile(OUTPUT_PATH, `${JSON.stringify(built.universe, null, 2)}\n`, "utf8");
await writeFile(LOCATION_MAP_PATH, `${JSON.stringify(built.locationAliases, null, 2)}\n`, "utf8");

console.log(`Wrote ${built.universe.nodes.length} nodes and ${built.universe.edges.length} edges to ${OUTPUT_PATH}`);
console.log(`Wrote ${Object.keys(built.locationAliases).length} commodity-location aliases to ${LOCATION_MAP_PATH}`);

function buildUniverse({ systems, datasets, distanceRows, overrides, fallbackIds, fallbackPositions }) {
  const nodes = [];
  const edges = [];
  const usedIds = new Set();
  const nodeById = new Map();
  const orbitAnchorByUexId = new Map();
  const orbitDisplayByUexId = new Map();
  const planetOrbitByUexId = new Map();
  const locationAliases = {};
  const systemCenters = new Map();
  const gameVersions = new Set();

  systems.forEach((system, index) => {
    const fallbackPosition = fallbackPositions.get(locationKey(system.name, system.name));
    const center = fallbackPosition || [index * 175, 0, index % 2 === 0 ? 0 : 35];
    systemCenters.set(Number(system.id), center);
    addNode({
      id: reserveId(fallbackIds.get(locationKey(system.name, system.name)) || `${slugify(system.name)}-star`),
      name: system.name,
      system: system.name,
      type: "star",
      position: center,
      radius: 3.6,
      description: `${system.name} system star. Display-only and never used as a route waypoint.`,
      routable: false,
      selectable: false,
      tags: ["system-center", "display-only"],
      dataSource: "UEX API 2.0",
      uex: { entity: "star_system", id: Number(system.id), code: system.code || null }
    });
  });

  for (const dataset of datasets) {
    const system = dataset.system;
    const systemId = Number(system.id);
    const center = systemCenters.get(systemId);
    const sortedOrbits = [...dataset.orbits]
      .filter((orbit) => !flag(orbit.is_star))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));

    sortedOrbits.forEach((orbit, index) => {
      const orbitId = Number(orbit.id);
      const position = fallbackPositions.get(locationKey(system.name, orbit.name)) || orbitPosition(center, orbit, index, sortedOrbits.length);
      const anchorId = reserveId(`route-orbit-${orbitId}`);
      const visibleId = reserveId(
        fallbackIds.get(locationKey(system.name, orbit.name)) || stableLocationId(orbit.name, system.name, usedIds)
      );

      addNode({
        id: anchorId,
        name: `${orbit.name} route anchor`,
        system: system.name,
        type: "orbit-anchor",
        position,
        radius: 0.01,
        description: "Internal orbit-distance routing anchor.",
        visible: false,
        selectable: false,
        routeInternal: true,
        tags: ["route-internal"],
        dataSource: "UEX API 2.0",
        uex: { entity: "orbit", id: orbitId }
      });

      const visibleType = orbitType(orbit);
      addNode({
        id: visibleId,
        name: orbit.name,
        system: system.name,
        type: visibleType,
        position,
        radius: radiusForType(visibleType),
        description: describeOrbit(orbit, system.name),
        tags: tagsForRecord(orbit, visibleType),
        anchorId,
        distanceQuality: "UEX orbit-level",
        dataSource: "UEX API 2.0",
        uex: { entity: "orbit", id: orbitId, code: orbit.code || null }
      });
      addEdge({
        id: `attach-${visibleId}`,
        from: visibleId,
        to: anchorId,
        distance: 0,
        kind: "local",
        visible: false,
        distanceQuality: "orbit-anchor",
        dataSource: "UEX API 2.0"
      });

      orbitAnchorByUexId.set(orbitId, anchorId);
      orbitDisplayByUexId.set(orbitId, visibleId);
      addAlias(visibleId, [orbit.name, orbit.name_origin, orbit.code]);
    });

    for (const planet of dataset.planets) {
      const matchingOrbit = sortedOrbits.find((orbit) => normalize(orbit.name) === normalize(planet.name));
      if (matchingOrbit) planetOrbitByUexId.set(Number(planet.id), Number(matchingOrbit.id));
    }

    const moonOrbitByUexId = new Map();
    for (const moon of dataset.moons) {
      const orbitId = firstNumber(moon.id_orbit, planetOrbitByUexId.get(Number(moon.id_planet)));
      if (orbitId) moonOrbitByUexId.set(Number(moon.id), orbitId);
      addChildLocation(moon, "moon", orbitId, dataset, system, center, [moon.name, moon.name_origin, moon.code]);
    }

    for (const station of dataset.stations) {
      const orbitId = firstNumber(
        station.id_orbit,
        planetOrbitByUexId.get(Number(station.id_planet)),
        moonOrbitByUexId.get(Number(station.id_moon))
      );
      const type = flag(station.is_jump_point) || /gateway/i.test(station.name || "") ? "gateway" : "station";
      addChildLocation(station, type, orbitId, dataset, system, center, [station.name, station.nickname, station.code]);
    }

    for (const city of dataset.cities) {
      const orbitId = firstNumber(
        city.id_orbit,
        planetOrbitByUexId.get(Number(city.id_planet)),
        moonOrbitByUexId.get(Number(city.id_moon))
      );
      addChildLocation(city, "city", orbitId, dataset, system, center, [city.name, city.code]);
    }

    for (const outpost of dataset.outposts) {
      const orbitId = firstNumber(
        outpost.id_orbit,
        planetOrbitByUexId.get(Number(outpost.id_planet)),
        moonOrbitByUexId.get(Number(outpost.id_moon))
      );
      addChildLocation(outpost, "outpost", orbitId, dataset, system, center, [outpost.name, outpost.nickname]);
    }

    for (const point of dataset.poi) {
      const orbitId = firstNumber(
        point.id_orbit,
        planetOrbitByUexId.get(Number(point.id_planet)),
        moonOrbitByUexId.get(Number(point.id_moon))
      );
      addChildLocation(point, "poi", orbitId, dataset, system, center, [point.name, point.nickname]);
    }

    function addChildLocation(record, type, orbitId, currentDataset, currentSystem, currentCenter, aliases) {
      const anchorId = orbitAnchorByUexId.get(Number(orbitId));
      if (!anchorId) return;
      const anchor = nodeById.get(anchorId);
      const existingId = fallbackIds.get(locationKey(currentSystem.name, record.name));
      const id = reserveId(existingId || stableLocationId(record.name, currentSystem.name, usedIds));
      const siblingIndex = nodes.filter((node) => node.anchorId === anchorId && node.visible !== false).length;
      const position = fallbackPositions.get(locationKey(currentSystem.name, record.name)) || childPosition(anchor.position, siblingIndex);

      addNode({
        id,
        name: record.name,
        system: currentSystem.name,
        type,
        position,
        radius: radiusForType(type),
        description: describeLocation(record, type, currentSystem.name),
        tags: tagsForRecord(record, type),
        anchorId,
        distanceQuality: "UEX orbit-level",
        dataSource: "UEX API 2.0",
        mapVisible: !["outpost", "poi"].includes(type),
        uex: { entity: entityNameForType(type), id: Number(record.id), code: record.code || null }
      });
      addEdge({
        id: `attach-${id}`,
        from: id,
        to: anchorId,
        distance: 0,
        kind: "local",
        visible: false,
        distanceQuality: "orbit-anchor",
        dataSource: "UEX API 2.0"
      });
      addAlias(id, aliases);
    }
  }

  const latestDistanceByPair = new Map();
  for (const row of distanceRows) {
    const fromOrbit = Number(row.id_orbit_origin);
    const toOrbit = Number(row.id_orbit_destination);
    const distance = Number(row.distance);
    if (!fromOrbit || !toOrbit || fromOrbit === toOrbit || !Number.isFinite(distance) || distance < 0) continue;
    if (!orbitAnchorByUexId.has(fromOrbit) || !orbitAnchorByUexId.has(toOrbit)) continue;

    const pair = canonicalPair(fromOrbit, toOrbit);
    const timestamp = Number(row.date_modified || row.date_added || 0);
    const current = latestDistanceByPair.get(pair);
    if (!current || timestamp >= current.timestamp) latestDistanceByPair.set(pair, { row, timestamp });
    if (row.game_version) gameVersions.add(String(row.game_version));
  }

  for (const { row } of latestDistanceByPair.values()) {
    const fromOrbit = Number(row.id_orbit_origin);
    const toOrbit = Number(row.id_orbit_destination);
    // Inter-system travel is never allowed to bypass jump gateways. Cross-system
    // rows are intentionally ignored; connectJumpPointPairs() adds the required
    // gateway-to-gateway topology after all same-system quantum edges exist.
    if (Number(row.id_star_system_origin) !== Number(row.id_star_system_destination)) continue;

    addEdge({
      id: `uex-distance-${Math.min(fromOrbit, toOrbit)}-${Math.max(fromOrbit, toOrbit)}`,
      from: orbitAnchorByUexId.get(fromOrbit),
      to: orbitAnchorByUexId.get(toOrbit),
      distance: Number(row.distance),
      kind: "quantum",
      distanceQuality: "community-measured",
      baseVisible: false,
      dataSource: `UEX orbit distances${row.game_version ? ` ${row.game_version}` : ""}`,
      gameVersion: row.game_version || null
    });
  }

  connectJumpPointPairs(nodes, edges);
  applyOverrides(overrides, nodes, edges);

  const universe = {
    metadata: {
      name: "UEX-generated verse route graph",
      version: "0.3.0",
      distanceUnit: "Gm",
      authoritative: false,
      source: "UEX API 2.0 live-visible locations and orbit distances",
      updatedAt: new Date().toISOString(),
      gameVersion: [...gameVersions].sort().join(", ") || "UEX current dataset",
      routeModel: "Direct orbit-to-orbit graph. System stars are display-only and never route waypoints.",
      visualScaleOnly: true,
      notes: "UEX is community-maintained. Route distances are orbit-level; local surface or station approach travel is not added. Manual corrections from route-overrides.json are applied last.",
      counts: {
        systems: systems.length,
        visibleLocations: nodes.filter((node) => node.visible !== false).length,
        routeAnchors: orbitAnchorByUexId.size,
        routeEdges: edges.filter((edge) => edge.visible !== false).length
      }
    },
    nodes,
    edges
  };

  return { universe, locationAliases };

  function addNode(node) {
    if (!node.id || nodeById.has(node.id)) return;
    nodes.push(node);
    nodeById.set(node.id, node);
    usedIds.add(node.id);
  }

  function addEdge(edge) {
    if (!edge.from || !edge.to || edge.from === edge.to) return;
    if (!nodeById.has(edge.from) || !nodeById.has(edge.to)) return;
    const distance = Number(edge.distance);
    if (!Number.isFinite(distance) || distance < 0) return;
    edges.push({ bidirectional: true, ...edge, distance });
  }

  function reserveId(candidate) {
    let id = slugify(candidate);
    if (!id) id = "location";
    if (!usedIds.has(id)) {
      usedIds.add(id);
      return id;
    }
    let suffix = 2;
    while (usedIds.has(`${id}-${suffix}`)) suffix += 1;
    const unique = `${id}-${suffix}`;
    usedIds.add(unique);
    return unique;
  }

  function addAlias(locationId, aliases) {
    const clean = [...new Set((aliases || []).filter(Boolean).map(String))];
    if (clean.length > 0) locationAliases[locationId] = clean;
  }
}

function applyOverrides(overrides, nodes, edges) {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  for (const override of overrides) {
    const fromNode = nodesById.get(override.from);
    const toNode = nodesById.get(override.to);
    if (!fromNode || !toNode) {
      console.warn(`Route override skipped because a location was not found: ${override.from} → ${override.to}`);
      continue;
    }
    const from = fromNode.anchorId || fromNode.id;
    const to = toNode.anchorId || toNode.id;
    const pair = canonicalPair(from, to);
    const existing = edges.find((edge) => canonicalPair(edge.from, edge.to) === pair);
    const values = {
      distance: Number(override.distance),
      kind: override.kind || existing?.kind || "quantum",
      distanceQuality: "manual-override",
      dataSource: override.source || "Manual route override",
      gameVersion: override.gameVersion || null,
      note: override.note || null
    };
    if (existing) {
      Object.assign(existing, values);
    } else {
      edges.push({
        id: `override-${slugify(override.from)}-${slugify(override.to)}`,
        from,
        to,
        bidirectional: override.bidirectional !== false,
        ...values
      });
    }
  }
}

function connectJumpPointPairs(nodes, edges) {
  const visible = nodes.filter((node) => node.visible !== false && ["gateway", "jump-point"].includes(node.type));
  const systems = [...new Set(visible.map((node) => node.system))];
  for (let i = 0; i < systems.length; i += 1) {
    for (let j = i + 1; j < systems.length; j += 1) {
      const systemA = systems[i];
      const systemB = systems[j];
      const a = visible.find((node) => node.system === systemA && normalize(node.name).includes(normalize(systemB)));
      const b = visible.find((node) => node.system === systemB && normalize(node.name).includes(normalize(systemA)));
      if (!a || !b) continue;
      // Use the visible gateways themselves for the inter-system transition. This
      // forces the route summary to show the required gateway on each side,
      // while same-system travel continues to use hidden orbit anchors.
      const from = a.id;
      const to = b.id;
      const pair = canonicalPair(from, to);
      if (edges.some((edge) => canonicalPair(edge.from, edge.to) === pair)) continue;
      edges.push({
        id: `jump-${slugify(systemA)}-${slugify(systemB)}`,
        from,
        to,
        distance: 0,
        kind: "jump",
        bidirectional: true,
        distanceQuality: "topology",
        dataSource: "UEX jump-point pairing",
        note: "Jump tunnel transition; not counted as normal-space Gm distance."
      });
    }
  }
}

async function fetchRows(resource, params = {}) {
  const failures = [];
  for (const base of API_BASES) {
    const url = new URL(`${base}/${resource}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== null && value !== undefined && value !== "") url.searchParams.set(key, String(value));
    }
    try {
      const response = await fetch(url, { headers });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const payload = await response.json();
      const rows = extractRows(payload);
      if (!Array.isArray(rows)) throw new Error("response was not array-shaped");
      return rows;
    } catch (error) {
      failures.push(`${base}: ${error.message}`);
    }
  }
  throw new Error(`${resource} request failed on every configured UEX host (${failures.join("; ")})`);
}

function extractRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.content)) return payload.content;
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

function isLiveVisible(record) {
  const visible = record.is_visible === undefined || flag(record.is_visible);
  const live = record.is_available_live === undefined || flag(record.is_available_live);
  const available = record.is_available === undefined || flag(record.is_available);
  const decommissioned = record.is_decommissioned !== undefined && flag(record.is_decommissioned);
  return visible && live && available && !decommissioned;
}

function orbitType(orbit) {
  if (flag(orbit.is_jump_point)) return "jump-point";
  if (flag(orbit.is_lagrange)) return "lagrange";
  if (flag(orbit.is_planet)) return "planet";
  if (flag(orbit.is_asteroid)) return "planetoid";
  if (flag(orbit.is_man_made)) return "station";
  return "orbit";
}

function entityNameForType(type) {
  return ({ moon: "moon", station: "space_station", gateway: "space_station", city: "city", outpost: "outpost", poi: "poi" })[type] || type;
}

function radiusForType(type) {
  return ({
    planet: 2.0,
    planetoid: 1.6,
    moon: 0.9,
    station: 0.68,
    gateway: 1.0,
    city: 0.55,
    outpost: 0.36,
    poi: 0.3,
    lagrange: 0.45,
    "jump-point": 1.2,
    orbit: 0.42
  })[type] || 0.5;
}

function tagsForRecord(record, type) {
  const tags = [type];
  if (flag(record.has_trade_terminal)) tags.push("trade");
  if (flag(record.has_refinery)) tags.push("refinery");
  if (flag(record.has_cargo_center)) tags.push("cargo-center");
  if (flag(record.has_refuel)) tags.push("refuel");
  if (flag(record.has_repair)) tags.push("repair");
  if (flag(record.is_jump_point) || type === "gateway" || type === "jump-point") tags.push("required-transition");
  return [...new Set(tags)];
}

function describeOrbit(orbit, systemName) {
  if (flag(orbit.is_jump_point)) return `${orbit.name}, jump-point orbit in the ${systemName} system.`;
  if (flag(orbit.is_lagrange)) return `${orbit.name}, Lagrange region in the ${systemName} system.`;
  if (flag(orbit.is_planet)) return `${orbit.name}, planetary orbit in the ${systemName} system.`;
  return `${orbit.name} in the ${systemName} system.`;
}

function describeLocation(record, type, systemName) {
  const parent = record.planet_name || record.moon_name || record.orbit_name;
  return `${record.name}, ${type.replaceAll("-", " ")} in the ${systemName} system${parent ? ` near ${parent}` : ""}.`;
}

function orbitPosition(center, orbit, index, total) {
  const angle = ((hashString(`${orbit.id}-${orbit.name}`) % 360) * Math.PI) / 180;
  const ring = 24 + (index % Math.max(1, Math.ceil(Math.sqrt(total)))) * 11 + Math.floor(index / 6) * 4;
  const y = ((hashString(orbit.name) % 9) - 4) * 1.4;
  return [center[0] + Math.cos(angle) * ring, center[1] + y, center[2] + Math.sin(angle) * ring];
}

function childPosition(anchor, index) {
  const angle = index * 2.399963229728653;
  const radius = 3.2 + Math.floor(index / 8) * 1.5;
  return [anchor[0] + Math.cos(angle) * radius, anchor[1] + 1.2 + (index % 3) * 0.6, anchor[2] + Math.sin(angle) * radius];
}

function stableLocationId(name, system, usedIds) {
  const base = slugify(name);
  if (!usedIds.has(base)) return base;
  return `${base}-${slugify(system)}`;
}

function canonicalPair(a, b) {
  return String(a) < String(b) ? `${a}::${b}` : `${b}::${a}`;
}

function firstNumber(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number) && number > 0) return number;
  }
  return null;
}

function flag(value) {
  return value === true || value === 1 || value === "1" || String(value).toLowerCase() === "true";
}

function locationKey(system, name) {
  return `${normalize(system)}|${normalize(name)}`;
}

function normalize(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function slugify(value) {
  return String(value || "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function hashString(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

async function readJsonOrNull(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}
