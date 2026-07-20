# Verse Route Map v5.2

A static 3D/2D Star Citizen route, commodity, and trade-profit planner for GitHub Pages.

## What changed in v5.2

- Corrected the largest cargo container from **36 SCU** to **32 SCU**.
- Existing browser saves using the old `36` key are automatically migrated to `32` so saved runs are not lost.
- Added two pricing modes:
  1. **Price by SCU & quantity**
  2. **Total transaction amounts** for entering the combined amount paid and received across one or more transactions
- Added optional operating costs:
  - auto-loading fee
  - auto-unloading fee
  - fuel cost
  - other costs
- Added an optional **price observed date** and freshness indicator so old prices are easier to identify.
- Added optional **observed trip time**.
- Automatically records route distance when the trade run is saved.
- Added profitability metrics:
  - net profit
  - profit per SCU
  - profit per Gm
  - profit per observed minute
- Saved trade runs can now be ranked by any of those profitability metrics or by the most recent update.
- The highest-ranked run is shown in a dedicated **Best Match** panel.
- Existing selection clearing and direct Pyro routing from v5.1 are retained.

## Example cargo load

The form now supports the example:

```text
36 × 32 SCU containers = 1,152 SCU
12 × 24 SCU containers =   288 SCU
Total                    = 1,440 SCU
```

## Install without an extra nested folder

This ZIP contains the project files at its root. Extract it into:

```text
C:\Users\alex9\Desktop\Star Citizen\Project\star-citizen-interactive-map-v5-2
```

Then run:

```cmd
robocopy "C:\Users\alex9\Desktop\Star Citizen\Project\star-citizen-interactive-map-v5-2" "C:\Users\alex9\Desktop\Star Citizen\Project\star-citizen-interactive-map-starter" /E /XD .git

cd /d "C:\Users\alex9\Desktop\Star Citizen\Project\star-citizen-interactive-map-starter"

findstr /C:"0.5.2" package.json
npm test
npm run validate

git status
git add -A
git commit -m "Add flexible trade pricing and profitability rankings"
git pull --rebase origin main
git push origin main
git status
```

Expected test output:

```text
Routing tests passed (54 nodes, 180 edges).
Trade calculator tests passed.
```

## Using the profitability ranking

1. Open **Trade Runs**.
2. Create or edit several runs.
3. Enter cargo quantities and select a pricing mode.
4. Add optional fees and observed trip time when known.
5. Save the run.
6. In **Saved Runs**, use **Rank saved runs by** to compare:
   - Net profit
   - Profit per SCU
   - Profit per Gm
   - Profit per minute
   - Most recently updated

The saved run can be edited later instead of being re-entered from scratch.

## Journal data

A trade journal can be converted into starter/default trade runs. Each imported example should include a price-observed date and a warning that prices may become stale. That can be added in the next data-import pass.

## Later roadmap

- Ship and vehicle profiles
- Automatic cargo capacity based on the selected ship
- Cargo utilization and optimization by ship
- Estimated trip time based on distance and ship performance
- Reusable community/default trade runs
- 3D planet textures and more accurate in-game visual models, using the supplied screenshots and VerseGuide as visual references without copying proprietary assets
