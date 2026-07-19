# Star Citizen Interactive Map

A static 3D/2D route planner, commodity price tracker, and saved trade-run tool designed for GitHub Pages.

## Route-model correction in v0.3

Earlier versions treated the **Stanton** and **Pyro** stars as travel hubs. That produced routes such as:

```text
Pyro Gateway (Stanton) → Stanton → microTech → Port Tressler
```

That graph was incorrect. A system star is now a **display-only marker** and cannot be selected or traversed by the routing algorithm.

The route graph now uses:

- direct same-system orbit-to-orbit distance edges;
- local location-to-orbit anchors for stations, cities, moons, and outposts;
- explicit gateway-to-gateway transitions for inter-system travel;
- manual overrides for recently verified in-game measurements.

The included regression test verifies that **Pyro Gateway (Stanton) → Port Tressler is 68 Gm** and never traverses the Stanton star.

## Included fallback locations

The repository ships with a corrected fallback graph containing major Stanton, Pyro, and Nyx destinations. It includes the major planets, moons, orbital stations, cities, gateways, and several major Pyro/Nyx locations.

The fallback is intentionally limited. The **Update universe route data** GitHub Action replaces it with the current UEX live-visible inventory, including additional:

- star systems;
- planets and planetoids;
- moons;
- space stations and gateways;
- cities;
- outposts;
- trade-relevant points of interest;
- Lagrange points and jump-point orbits.

## Run locally

From Command Prompt:

```cmd
cd /d "C:\Users\alex9\Desktop\Star Citizen\Project\star-citizen-interactive-map-starter"
py -m http.server 8080
```

Open:

```text
http://localhost:8080
```

Use `Ctrl+C` in Command Prompt to stop the server.

## Validate routing locally

Node.js 22 or newer is recommended.

```cmd
npm test
npm run validate
```

The tests check:

- the verified 68 Gm Pyro Gateway–Port Tressler route;
- stars never appearing in any route;
- required Stanton–Pyro gateway traversal;
- hidden orbit anchors not appearing as user-facing stops;
- valid edge endpoints and nonnegative distances.

## Refresh all locations and route distances

### From GitHub

After pushing this version:

1. Open the repository on GitHub.
2. Select **Actions**.
3. Select **Update universe route data**.
4. Select **Run workflow**.
5. Wait for the workflow and the following Pages deployment to finish.

The updater also runs daily and when its script, override data, or workflow changes.

### Locally

```cmd
npm run update:universe
npm test
```

The updater writes:

```text
public/data/universe.json
public/data/uex-location-map.json
```

It tries both current UEX API hosts and refuses to replace the fallback file when no systems or distance data are returned.

## Route-data sources and limitations

UEX publishes live-visible location resources and orbit-to-orbit distances in Gm. The project imports those records as a community-maintained dataset.

Important limitations:

- UEX data can lag behind the newest game patch.
- Imported distances are at orbit level; final local approach distances are not added.
- Surface navigation is not modeled.
- A jump tunnel is represented as a required topology transition and currently adds 0 Gm to normal-space quantum distance.
- Visual coordinates are for map readability and are never used to calculate travel distance.

The map displays the dataset source, supported game version, and update date beneath the route controls.

## Correct a measured route

Add a record to:

```text
public/data/route-overrides.json
```

Example:

```json
{
  "from": "pyro-gateway-stanton",
  "to": "port-tressler",
  "distance": 68,
  "kind": "quantum",
  "gameVersion": "4.8.3",
  "source": "UEX route records and player verification",
  "note": "Observed close to 69 Gm in game."
}
```

Overrides are applied after imported UEX distances, so a verified in-game measurement wins.

## Add a missing location manually

For an immediate fallback-only addition, edit `public/data/universe.json` and add:

1. a node with a unique `id`, name, system, type, and visual position;
2. one or more measured route edges;
3. aliases in `public/data/uex-location-map.json` when the location has commodity terminals.

For long-term maintenance, prefer fixing the UEX import mapping so the location remains automatic.

## Commodity and trade-run features

- Click a planet, moon, city, station, or outpost to add a manual commodity price.
- Open **Trade Runs** to create, update, load, and delete saved runs.
- Cargo can be entered as 36, 24, 12, 8, and 1 SCU container counts.
- Saved runs and manual prices use browser local storage.
- Export/import lets players transfer their local data as JSON.
- The daily commodity workflow can refresh the shared UEX price snapshot.

## GitHub Pages

The deployment workflow publishes the repository root. In GitHub:

```text
Settings → Pages → Source → GitHub Actions
```

Every push to `main` deploys the latest map.

## Project structure

```text
.github/workflows/pages.yml                 GitHub Pages deployment
.github/workflows/update-trade-data.yml     Commodity refresh
.github/workflows/update-universe-data.yml  Locations and route refresh
public/data/universe.json                   Route graph and location inventory
public/data/route-overrides.json            Verified distance corrections
public/data/commodities.json                Shared commodity snapshot
scripts/update-universe-data.mjs            UEX location/distance importer
scripts/update-trade-data.mjs               Commodity importer
src/router.js                               Dijkstra routing and route summaries
src/map-3d.js                               Three.js renderer
src/map-2d.js                               SVG renderer
tests/router.test.mjs                       Regression tests
```

## Disclaimer

This is a fan-made project and is not affiliated with or endorsed by Cloud Imperium Games or Roberts Space Industries. UEX data is community-maintained and should be verified against the current live game when accuracy is operationally important.
