# Verse Route Map v5.4

A static 3D/2D Star Citizen route, commodity, and profitability planner for GitHub Pages.

## What changed in v5.4

### Community Trade Runs

The Trade Runs drawer now separates shared examples from each player's private browser data:

- **Community** — dated, read-only trade-run examples included with the public website
- **My Runs** — private runs saved in the current user's browser
- **Copy to My Runs** — duplicates a community example into the user's private list so it can be edited
- **Load route** — opens a community run directly on the map without copying it

New users no longer need to download and import a JSON file to see the starter trade runs.

The first shared examples are:

- Tressler → Baijini — Dynaflex
- Baijini → Gaslight — Silicon
- Gaslight → Tressler — Hydrogen

Each shared run shows its observed date, cargo configuration, investment, revenue, net profit, distance, and efficiency metrics. The interface clearly warns that commodity prices, stock, demand, fees, and availability may have changed.

## Data behavior

Community runs are bundled in:

```text
public/data/community-trade-runs.json
```

They are visible to everyone who opens the public map. They cannot be changed by visitors.

When someone clicks **Copy to My Runs**, a private editable copy is stored in that person's browser. Their edits do not change the shared community version or anyone else's data.

## Existing features retained

- procedural 3D planet, moon, star, and station textures
- Stanton, Pyro, and Nyx system themes
- universe → system → local navigation
- direct system routing and distance spokes
- price-per-SCU or total-transaction trade entry
- 32/24/12/8/1 SCU cargo containers
- optional loading, unloading, fuel, and other costs
- ranked profitability by net profit, SCU, distance, time, or freshness
- export and import for private browser data

## Update your Git-connected project

Extract `star-citizen-interactive-map-v5-4.zip` into:

```text
C:\Users\alex9\Desktop\Star Citizen\Project\star-citizen-interactive-map-v5-4
```

Then run:

```cmd
robocopy "C:\Users\alex9\Desktop\Star Citizen\Project\star-citizen-interactive-map-v5-4" "C:\Users\alex9\Desktop\Star Citizen\Project\star-citizen-interactive-map-starter" /E /XD .git

cd /d "C:\Users\alex9\Desktop\Star Citizen\Project\star-citizen-interactive-map-starter"

findstr /C:"0.5.4" package.json
npm test
npm run validate

git status
git add -A
git commit -m "Add shared community trade runs"
git pull --rebase origin main
git push origin main
git status
```

## Expected tests

```text
Routing tests passed (54 nodes, 180 edges).
Trade calculator tests passed.
Community trade run tests passed.
```
