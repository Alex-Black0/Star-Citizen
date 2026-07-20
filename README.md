# Verse Route Map v5.5

## What changed

- **My Runs** is now the default Trade Runs view.
- The Trade Runs badge and **My Runs** counter show only the user’s locally saved runs.
- The three shared routes moved into a small **Examples** button next to the Trade Runs title.
- Example runs are optional and no longer consume the upper half of the drawer.
- Only one drawer panel can display at a time, preventing the overlapping-panel gap shown in v5.4.
- Added a bundled fallback so the three examples still load if the separate community JSON request fails.
- Players can still load an example route or copy it into My Runs before editing it.

## Update your project

Extract the ZIP into:

```text
C:\Users\alex9\Desktop\Star Citizen\Project\star-citizen-interactive-map-v5-5
```

Then run:

```cmd
dir "C:\Users\alex9\Desktop\Star Citizen\Project\star-citizen-interactive-map-v5-5\package.json"

robocopy "C:\Users\alex9\Desktop\Star Citizen\Project\star-citizen-interactive-map-v5-5" "C:\Users\alex9\Desktop\Star Citizen\Project\star-citizen-interactive-map-starter" /E /XD .git

cd /d "C:\Users\alex9\Desktop\Star Citizen\Project\star-citizen-interactive-map-starter"

findstr /C:"0.5.5" package.json
npm test
npm run validate

git status
git add -A
git commit -m "Simplify example runs and fix trade drawer counts"
git pull --rebase origin main
git push origin main
git status
```

Saved personal trade runs remain in the same browser storage key and should not be erased by this update.
