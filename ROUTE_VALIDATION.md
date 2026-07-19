# Route and hierarchy validation — v4

## Automated checks

Run:

```cmd
npm test
npm run validate
```

Expected fallback result:

```text
Routing tests passed (48 nodes, 54 edges).
```

## Verified regression

The route below remains direct:

```text
Pyro Gateway (Stanton) → Port Tressler = 68 Gm
```

It must not include the Stanton star or microTech as artificial route waypoints.

## Triangle topology

The overview and route graph contain all three links:

```text
Stanton ↔ Pyro
Pyro ↔ Nyx
Nyx ↔ Stanton
```

A fallback route from Port Tressler to Levski must use:

```text
Nyx Gateway (Stanton)
Stanton–Nyx Jump Point
Stanton Gateway (Nyx)
```

It must not detour through the Pyro gateways.

## Hierarchical display checks

### Universe level

Only Stanton, Pyro, and Nyx system markers should appear in a triangular layout.

### System level

The star, planets or planetoids, gateways, jump points, and major system objects should appear. Planet-local stations, moons, and cities should remain hidden.

### Local level

Selecting microTech and opening its local map should show:

- microTech
- Port Tressler
- New Babbage
- Calliope
- Clio
- Euterpe

## Distance warning

The new Stanton–Nyx fallback topology is correct, but its normal-space gateway distances are provisional estimates. Gateway pairing is reliable; exact Gm values should be replaced as verified measurements become available.
