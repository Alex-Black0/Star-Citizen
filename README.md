# Verse Route Map v5

A static 3D/2D Star Citizen route and commodity planner designed for GitHub Pages.

## What changed in v5

- Kept the **Universe → System → Local** hierarchical navigation from v4
- Added **system-themed visuals**:
  - **Stanton** uses a cooler blue/navy palette
  - **Pyro** uses a darker orange ember palette
  - **Nyx** uses a deeper blue/violet palette
- Added richer background treatment with nebula overlays, stronger orbital rings, and more directional context
- Added **selected-location distance spokes** so clicking a planet or station shows dashed distance lines to nearby visible destinations
- Added clearer **station / gateway / jump-point / planet icon differentiation**
- Restored and added several Pyro priority locations, including:
  - **Gaslight**
  - **Patch City**
  - **Starlight**
  - **Rat's Nest**
  - **Dudley & Daughters**
  - **Megumi Refueling**
- Retained saved routes, trade runs, manual commodity prices, export, and import

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

Keep the Command Prompt window open. Press `Ctrl + C` to stop the server.

## Replace the existing Git-connected version

After extracting the v5 ZIP into your `Project` folder:

```cmd
robocopy "C:\Users\alex9\Desktop\Star Citizen\Project\star-citizen-interactive-map-v5\star-citizen-interactive-map-v5" "C:\Users\alex9\Desktop\Star Citizen\Project\star-citizen-interactive-map-starter" /E /XD .git

cd /d "C:\Users\alex9\Desktop\Star Citizen\Project\star-citizen-interactive-map-starter"

npm test
npm run validate

git status
git add -A
git commit -m "Add themed map visuals and selected distance spokes"
git pull --rebase origin main
git push origin main
```

Do not copy or replace the `.git` directory.

## Using the map

1. Start in the triangular universe overview.
2. Select Stanton, Pyro, or Nyx.
3. Use the brighter orbital rings to orient yourself inside the system.
4. Click a planet, station, or gateway to inspect it.
5. When a location is selected, the map draws **dashed distance spokes** to nearby visible destinations.
6. Select a planet and click **Open local map**, or zoom in after selecting it.
7. Use the breadcrumb buttons to move back to the system or universe.

## Saved routes and trade data

Saved routes, commodity runs, manual prices, and notes are stored in the current browser using local storage.

- Different users receive separate browser-local saves.
- Saves do not automatically follow a user to another device.
- Clearing browser data can remove them.
- Use **Trade Runs → Export** to back up the data.
- Use **Import** to restore it in another browser.

## Route topology

System stars remain display-only and never appear as travel waypoints. Inter-system routes pass through paired gateways.

The fallback graph includes the three-system triangle:

```text
Stanton ↔ Pyro
Pyro ↔ Nyx
Nyx ↔ Stanton
```

The verified regression route remains:

```text
Pyro Gateway (Stanton) → Port Tressler = 68 Gm
```

## Automatic universe updates

The GitHub workflow remains available at:

```text
.github/workflows/update-universe-data.yml
```

The update script still preserves the hierarchy metadata and the system triangle. You can continue replacing fallback values with better verified live data over time.

## Tests

```cmd
npm test
npm run validate
```

The current suite reports:

```text
Routing tests passed (54 nodes, 60 edges).
```
