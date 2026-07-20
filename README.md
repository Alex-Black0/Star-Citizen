# Verse Route Map v5.1

This hotfix updates the themed hierarchical Star Citizen route and commodity map for GitHub Pages.

## What changed

- Clicking an **empty area** of either the 3D or 2D map now clears the selected location.
- Clearing the selection removes the dashed distance spokes without clearing the active origin, destination, or calculated route.
- Pyro fallback routing now includes direct same-system quantum links between major:
  - planets;
  - gateways;
  - stations;
  - trade and ship-storage locations.
- The route planner now applies a small waypoint penalty so it prefers a direct quantum leg instead of several nearly equal hops.
- Stanton's existing local hierarchy is retained. For example:

```text
microTech → Crusader → Yela
```

- Gaslight now routes directly to Stanton Gateway in the fallback graph:

```text
Gaslight → Stanton Gateway (Pyro)
```

The fallback direct Pyro distances are estimates derived from the map geometry. Imported UEX or verified in-game values should replace those estimates when available.

## Install the update

This ZIP is packaged without an extra inner project folder. Extract it into:

```text
C:\Users\alex9\Desktop\Star Citizen\Project\star-citizen-interactive-map-v5-1
```

Then run:

```cmd
robocopy "C:\Users\alex9\Desktop\Star Citizen\Project\star-citizen-interactive-map-v5-1" "C:\Users\alex9\Desktop\Star Citizen\Project\star-citizen-interactive-map-starter" /E /XD .git

cd /d "C:\Users\alex9\Desktop\Star Citizen\Project\star-citizen-interactive-map-starter"

findstr /C:"0.5.1" package.json
npm test
npm run validate

git status
git add -A
git commit -m "Clear map selections and fix direct Pyro routing"
git pull --rebase origin main
git push origin main
git status
```

## Expected tests

```text
Routing tests passed (54 nodes, 180 edges).
```

## Manual checks

1. Open Pyro.
2. Select Gaslight and confirm the dashed distance spokes appear.
3. Click an empty section of space and confirm the selection and spokes disappear.
4. Route Gaslight to Stanton Gateway (Pyro).
5. Confirm the route has one direct leg rather than visiting Pyro V and several other planets.
6. Route microTech to Yela and confirm the existing Stanton hierarchy remains:

```text
microTech → Crusader → Yela
```
