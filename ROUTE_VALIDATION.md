# Route Validation Checklist v5.1

## Automated checks

```cmd
npm test
npm run validate
```

Expected:

```text
Routing tests passed (54 nodes, 180 edges).
```

## Selection checks

- Select a planet or station and confirm distance spokes appear.
- Click empty space in the 3D map and confirm the selection clears.
- Repeat in the 2D map.
- Confirm clearing the selected object does not erase a previously calculated route.

## Route checks

### Pyro

```text
Gaslight → Stanton Gateway (Pyro)
```

Expected visible steps:

```text
Gaslight
Stanton Gateway (Pyro)
```

The route must not insert Pyro V, Pyro IV, Bloom, Monox, or Pyro I.

### Stanton regression

```text
microTech → Yela
```

Expected visible steps:

```text
microTech
Crusader
Yela
```

### Existing verified regression

```text
Pyro Gateway (Stanton) → Port Tressler = 68 Gm
```
