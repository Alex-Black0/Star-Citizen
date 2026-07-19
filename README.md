# Verse Route Map v4

A static 3D/2D Star Citizen route and commodity planner designed for GitHub Pages.

## What changed in v4

- Three-level map navigation: **Universe → System → Local**
- Stanton, Pyro, and Nyx arranged as a triangular system overview
- Direct paired gateway topology for:
  - Stanton ↔ Pyro
  - Pyro ↔ Nyx
  - Nyx ↔ Stanton
- Stronger system and local orbital rings with directional axes
- Zoom-aware object sizing and label density
- Select a planet and zoom in to enter its local map
- Zoom out from a local map to return to its system
- Origin, destination, trade, and price dropdowns grouped by system and parent location
- First-visit instructions explaining route planning and browser-local saves
- Existing commodity runs, manual prices, saved routes, import, and export retained

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

After extracting the v4 ZIP into your `Project` folder:

```cmd
robocopy "C:\Users\alex9\Desktop\Star Citizen\Project\star-citizen-interactive-map-v4" "C:\Users\alex9\Desktop\Star Citizen\Project\star-citizen-interactive-map-starter" /E /XD .git

cd /d "C:\Users\alex9\Desktop\Star Citizen\Project\star-citizen-interactive-map-starter"

npm test
npm run validate

git status
git add -A
git commit -m "Add hierarchical universe system and local map views"
git pull --rebase origin main
git push origin main
```

Do not copy or replace the `.git` directory.

## Using the map

1. Start in the triangular universe overview.
2. Select Stanton, Pyro, or Nyx.
3. Use the brighter orbital rings to orient yourself inside the system.
4. Select a planet or planetoid.
5. Click **Open local map**, or zoom in closely after selecting it.
6. Local view shows its moons, stations, cities, and other nearby points.
7. Use the breadcrumb buttons to return to the system or universe.

The origin and destination menus are grouped by system. Child locations appear as entries such as:

```text
Stanton System
  microTech · Planet
  microTech › Port Tressler · Station
  microTech › New Babbage · City
```

## Saved routes and trade data

Saved routes, commodity runs, manual prices, and notes are stored in the current browser using local storage.

- Different users receive separate browser-local saves.
- Saves do not automatically follow a user to another device.
- Clearing browser data can remove them.
- Use **Trade Runs → Export** to back up the data.
- Use **Import** to restore it in another browser.

## Route topology

System stars remain display-only and never appear as travel waypoints. Inter-system routes must pass through paired gateways.

The v4 fallback adds the direct Stanton–Nyx connection:

```text
Nyx Gateway (Stanton)
→ Stanton–Nyx Jump Point
→ Stanton Gateway (Nyx)
```

The Stanton-side and Nyx-side normal-space distances for this newly added fallback route are currently marked as estimates. Replace those values with UEX or verified in-game measurements when available.

## Automatic universe updates

The GitHub workflow remains available at:

```text
.github/workflows/update-universe-data.yml
```

The update script now:

- preserves the v4 hierarchy metadata;
- groups child locations under their orbit parent;
- builds the three-system overview;
- pairs all available system gateways;
- restores fallback triangle topology when a source dataset omits one of the required system links.

## Tests

```cmd
npm test
npm run validate
```

The test suite checks:

- the verified Pyro Gateway → Port Tressler 68 Gm regression;
- stars never leaking into routes;
- direct Stanton ↔ Nyx routing without a Pyro detour;
- all three system overview links;
- system-scale locations hiding local detail;
- local microTech view showing Port Tressler, New Babbage, and its moons.
