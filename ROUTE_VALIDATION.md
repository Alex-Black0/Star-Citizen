# Route Validation Checklist v5

## Automated checks

Run:

```cmd
npm test
npm run validate
```

Expected automated output:

```text
Routing tests passed (54 nodes, 60 edges).
```

## Visual checks

1. Open the public map and confirm the universe overview shows **Stanton**, **Pyro**, and **Nyx**.
2. Enter **Pyro** and confirm the system uses a warmer orange theme than Stanton and Nyx.
3. Confirm the orbital rings are prominent and directional axes remain visible.
4. Click a planet or station and confirm **dashed distance spokes** appear.
5. Open **Pyro V** local view and confirm **Gaslight** appears.
6. Confirm these Pyro priority locations appear in the dataset:
   - Gaslight
   - Patch City
   - Starlight
   - Rat's Nest
   - Dudley & Daughters
   - Megumi Refueling
7. Route **Pyro Gateway (Stanton)** to **Port Tressler** and confirm the total remains **68 Gm**.
8. Route **Port Tressler** to **Levski** and confirm the route uses the direct Stanton ↔ Nyx path rather than detouring through Pyro.
