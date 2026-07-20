# Route Validation Checklist v5.3

## Automated checks

Run:

```cmd
npm test
npm run validate
```

Expected output:

```text
Routing tests passed (54 nodes, 180 edges).
Trade calculator tests passed.
```

## Visual checks

1. Open the public map.
2. Enter **Stanton** and confirm:
   - Hurston looks dusty / brown
   - ArcCorp looks urbanized
   - Crusader shows gas giant banding
   - microTech looks icy
3. Enter **Pyro** and confirm the system uses darker orange visuals and the planets look more scorched / volcanic.
4. Enter **Nyx** and confirm Delamar has a colder rocky appearance.
5. Open any local view and confirm the selected body is textured and slowly rotating.
6. Confirm space stations still display correctly and routing / selection behavior still works.
