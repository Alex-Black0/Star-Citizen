# Verse Route Map v5.3

A static 3D/2D Star Citizen route and commodity planner for GitHub Pages.

## What changed in v5.3

This update continues the visual overhaul by adding **procedural 3D textures** for stars, planets, moons, and stations.

### New visual improvements

- Added procedural body textures for major Stanton, Pyro, and Nyx worlds
- Each major planet/moon now has a more distinctive look based on its in-game identity
  - **Hurston** looks more dusty and industrial
  - **ArcCorp** uses an urbanized city-world texture
  - **Crusader** uses gas giant banding
  - **microTech** and its moons use colder ice palettes
  - **Pyro** bodies use darker volcanic / scorched palettes
  - **Nyx / Delamar** uses a cold rocky look
- Added texture treatment for **stars** and **stations**
- Atmosphere glow now varies by world instead of using a single generic color
- Planetary bodies slowly rotate in the 3D view

These textures are generated in the browser so the project stays lightweight and GitHub Pages-friendly.

## Existing features retained

- Universe → System → Local navigation
- system-themed backgrounds for Stanton, Pyro, and Nyx
- selected-location distance spokes
- saved trade runs and profitability ranking
- dual price-entry modes for trade runs
- optional operating costs
- browser-local saved routes and trade data

## Run locally

```cmd
cd /d "C:\Users\alex9\Desktop\Star Citizen\Project\star-citizen-interactive-map-starter"
py -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

## Update your Git-connected project

Extract `star-citizen-interactive-map-v5-3.zip` into your `Project` folder, then run:

```cmd
robocopy "C:\Users\alex9\Desktop\Star Citizen\Project\star-citizen-interactive-map-v5-3" "C:\Users\alex9\Desktop\Star Citizen\Project\star-citizen-interactive-map-starter" /E /XD .git

cd /d "C:\Users\alex9\Desktop\Star Citizen\Project\star-citizen-interactive-map-starter"

npm test
npm run validate

git status
git add -A
git commit -m "Add procedural 3D textures for planets and stations"
git pull --rebase origin main
git push origin main
```

## Notes

- The new textures are **procedural approximations**, not ripped in-game assets.
- They are designed to better communicate each world's identity while keeping the project portable.
- If you later want true high-fidelity planet textures, we can add an optional texture asset pipeline for manually curated maps.

## Tests

```cmd
npm test
npm run validate
```

Expected output:

```text
Routing tests passed (54 nodes, 180 edges).
Trade calculator tests passed.
```
