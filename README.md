# Verse Route Map — Star Citizen map starter

A clean-room starter for a shareable Star Citizen map with:

- Interactive **3D** map built with Three.js
- Optional **2D** SVG map using the same data
- Click-to-select origin and destination
- Multi-hop shortest-path routing with explicit gateways and jump points
- Per-leg and total distance display
- Location details with snapshot and manually entered commodity prices
- Commodity runs with 36, 24, 12, 8, and 1 SCU container counts
- Automatic investment, revenue, and estimated-profit calculations
- Right-side saved-run drawer with load, edit, and delete actions
- Export/import of personal route and trade data as JSON
- Routes, manual prices, and trade runs saved in the user's browser with `localStorage`
- GitHub Pages deployment workflow
- Scheduled UEX commodity-data snapshot workflow

> **Data warning:** The included topology, positions, distances, and commodity prices are demonstration data. Replace them with verified current data before treating routes or values as authoritative.

## Why this structure

The universe is represented as a graph:

- **Nodes** are stars, planets, moons, stations, gateways, and jump points.
- **Edges** are allowed travel segments.
- Each edge has its own distance and travel type.

The renderer does not decide whether travel is possible. The graph does. This means a cross-system route can be forced through:

`planet → system hub → gateway → jump point → destination gateway → destination`

Both 3D and 2D views render the same graph, so adding a location or changing a route rule only requires a data update.

## Run locally

A local web server is required because the application loads JSON files with `fetch()`.

### Windows

```powershell
py -m http.server 8080
```

### macOS or Linux

```bash
python3 -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

You can also run:

```bash
npm run serve
```

That command uses `npx serve` and may download the small `serve` package the first time.

## Publish on GitHub Pages

1. Create a new GitHub repository.
2. Copy these files into the repository.
3. Commit and push them to the `main` branch.
4. In GitHub, open **Settings → Pages**.
5. Under **Build and deployment**, select **GitHub Actions**.
6. The included `.github/workflows/pages.yml` workflow will publish the site.

Your friends can use the generated GitHub Pages URL without installing anything.

## Project layout

```text
.
├── .github/workflows/
│   ├── pages.yml
│   └── update-trade-data.yml
├── public/data/
│   ├── universe.json
│   ├── commodities.json
│   └── uex-location-map.json
├── scripts/
│   └── update-trade-data.mjs
├── src/
│   ├── app.js
│   ├── map-2d.js
│   ├── map-3d.js
│   ├── router.js
│   └── storage.js
├── index.html
├── styles.css
└── README.md
```

## Add a planet, station, or jump point

Edit `public/data/universe.json`.

Example node:

```json
{
  "id": "example-planet",
  "name": "Example Planet",
  "system": "Example System",
  "type": "planet",
  "position": [20, 0, 35],
  "radius": 2.2,
  "description": "Description shown in the location panel.",
  "tags": ["planet", "trade"]
}
```

The `position` is a **display coordinate**, not necessarily the real travel distance.

Supported starter types:

- `star`
- `planet`
- `station`
- `gateway`
- `jump-point`

## Add a route connection

Add an edge to `public/data/universe.json`:

```json
{
  "id": "example-edge",
  "from": "example-planet",
  "to": "example-gateway",
  "distance": 12.5,
  "kind": "quantum",
  "bidirectional": true
}
```

The routing algorithm uses `distance` as its weight. It does **not** use the distance between the rendered coordinates.

Suggested edge kinds:

- `local`
- `quantum`
- `gateway`
- `jump`

A gateway becomes mandatory simply by making it the only graph connection into or out of the next region.

## Routing algorithm

`src/router.js` uses Dijkstra's shortest-path algorithm. This is a strong default when every travel segment has a non-negative cost.

Later, edge cost can include more than physical distance:

```text
cost = distance + travelTime + fuelCost + dangerPenalty + playerPreference
```

For example, a user could choose:

- Shortest distance
- Fastest estimated time
- Lowest fuel use
- Safest route
- Highest trade profit

## Commodity data

The map combines two separate data sources:

1. `public/data/commodities.json` — a shared snapshot committed to GitHub.
2. Browser `localStorage` — each player's manually entered prices and saved trade runs.

Click a planet or station and choose **Add commodity price here** to enter:

- Commodity name
- Buy price per SCU
- Sell price per SCU
- Available or demanded quantity in SCU
- Notes such as terminal name or update time

Click **Create run** beside a commodity record to prefill a new trade run. A run stores:

- Buy and sell locations
- Commodity
- Counts of 36, 24, 12, 8, and 1 SCU containers
- Total SCU
- Buy and sell price per SCU
- Investment, revenue, and estimated profit
- Personal notes

Saved runs appear in the right-side **Trade Runs** drawer. **Load route** plots the run on the map. **Export** creates a JSON backup that can be imported on another browser or shared with a friend.

### Automatic UEX snapshots

UEX API 2.0 exposes commodity-price resources. The included updater defaults to:

```text
https://api.uexcorp.uk/2.0/commodities_prices_all
```

That bulk endpoint does not require an access token. The GitHub Action runs daily, normalizes the response, writes `public/data/commodities.json`, and commits changes. It intentionally runs from GitHub Actions instead of every visitor's browser so the site does not repeatedly download the full dataset and is not dependent on browser CORS behavior.

UEX reports prices by trading terminal, while the current map uses broader planet and station nodes. Edit:

```text
public/data/uex-location-map.json
```

to map UEX terminal names or slugs to map node IDs. Example:

```json
{
  "microtech": ["new babbage", "newbabbage"],
  "port-tressler": ["port tressler", "porttressler"]
}
```

For each mapped location and commodity, the updater keeps the lowest positive buy price and highest positive sell price among matched terminals. Add dedicated city, outpost, and terminal nodes later for more precise routing and prices.

To fetch from a different compatible endpoint, create the optional GitHub repository variable `SC_TRADE_API_URL`. Add `SC_TRADE_API_TOKEN` as an Actions secret only when that endpoint requires authentication. Never put API tokens in browser-delivered JavaScript or HTML.

Run the updater manually from **GitHub → Actions → Update commodity data → Run workflow**. The source is community-maintained and should always display a last-updated time and non-authoritative disclaimer.

## Possible map-data sources

For systems, celestial objects, and jump-point topology, investigate approved/open community APIs instead of copying another site's implementation. One example is the Star Citizen Wiki API:

- https://github.com/StarCitizenWiki/API
- https://docs.star-citizen.wiki/

Always review API terms, rate limits, attribution requirements, and data licenses before importing or republishing data.

## Saved information

The starter saves routes, manual commodity prices, and trade runs with browser `localStorage`. This is ideal for the first release because it requires no account system or database.

Limitations:

- Saved information only exists on that browser/device.
- Clearing browser storage deletes it.
- The Export/Import buttons provide a manual backup and sharing method.
- Automatic synchronization between devices still requires accounts and a backend.

For accounts and synchronization later, add a backend such as Supabase, Firebase, or a small custom API. Suggested tables:

```text
users
saved_routes
trade_runs
trade_run_cargo
manual_prices
route_waypoints
location_notes
custom_markers
shared_collections
```

## Recommended development phases

### Phase 1 — working map

- Verify the 3D and 2D interaction
- Replace sample Stanton/Pyro positions
- Add real route edges and distances
- Add search and filters
- Add more planets, moons, stations, and jump points

### Phase 2 — reliable trade data

- Obtain approved API access
- Normalize location IDs across map and trade sources
- Display source and last-updated time for every price
- Add stale-data indicators
- Add commodity and profit filters

### Phase 3 — player features

- Accounts
- Cloud-saved routes
- Private notes and markers
- Shareable route links
- Organization/friend collections
- Route optimization by ship, range, fuel, cargo, danger, or profit

### Phase 4 — advanced simulation

- Orbital movement or time-based positions
- Planet and moon textures
- System-level and local planetary zoom modes
- Ship quantum-drive performance
- Estimated travel time and fuel use
- Live or patch-versioned datasets

## Legal and attribution notes

This starter was built from scratch and is licensed under MIT. Do not copy source code, textures, models, or other assets from projects that do not grant an explicit license. Use project screenshots only as design references unless the author grants permission.

Star Citizen, Roberts Space Industries, and related names and assets belong to their respective rights holders. This project should clearly identify itself as an unofficial fan-made tool and include attribution required by every external dataset or asset license.
