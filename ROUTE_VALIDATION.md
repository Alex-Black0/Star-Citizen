# v5.4 Validation Checklist

## Automated checks

```cmd
npm test
npm run validate
```

Expected output:

```text
Routing tests passed (54 nodes, 180 edges).
Trade calculator tests passed.
Community trade run tests passed.
```

## Community Trade Runs checks

1. Open **Trade Runs** in a browser with no existing private runs.
2. Confirm the drawer opens on the **Community** tab.
3. Confirm these three examples appear:
   - Tressler → Baijini
   - Baijini → Gaslight
   - Gaslight → Tressler
4. Confirm each run shows its observed date and price warning.
5. Rank the shared runs by net profit and confirm Baijini → Gaslight is first.
6. Click **Load route** and confirm the route opens on the map.
7. Click **Copy to My Runs** and confirm the run appears in the **My Runs** tab.
8. Edit the copied run and confirm the original community example remains unchanged.
9. Delete the copied run and confirm **Copy to My Runs** becomes available again.
