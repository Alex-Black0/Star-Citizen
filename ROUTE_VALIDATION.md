# Route Validation Notes

## Confirmed defect

The former graph connected destinations through `stanton-star` and `pyro-star`. Dijkstra correctly selected those edges, but those edges represented an invalid travel model.

## Correct behavior

- Stars are display-only.
- Same-system routes use direct orbit-distance edges.
- A station inherits the distance of its physical orbit anchor rather than routing through the star.
- Inter-system routes must cross the named gateway on both sides.
- System-to-system distance rows cannot create shortcuts that bypass gateways.

## Current regression case

```text
Origin: Pyro Gateway (Stanton)
Destination: Port Tressler
Expected: 68 Gm
Forbidden waypoint: Stanton
```

Run:

```cmd
npm test
```

## Recording another in-game check

Record:

```text
Game patch
Origin
Destination
Displayed Gm
Date measured
Whether an intermediate gateway was required
```

Then add the verified value to `public/data/route-overrides.json`. The next universe-data update applies that value after UEX import.

## Accuracy levels

- `manual-override`: explicitly verified or temporarily corrected.
- `community-measured`: imported UEX orbit distance.
- `measured`: known fallback measurement.
- `estimated`: fallback only; replace when live data is available.
- `topology`: required connection such as a jump tunnel, not a normal-space distance measurement.
