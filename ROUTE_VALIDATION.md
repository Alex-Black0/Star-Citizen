# v5.2 Validation Checklist

## Automated tests

```cmd
npm test
npm run validate
```

Expected:

```text
Routing tests passed (54 nodes, 180 edges).
Trade calculator tests passed.
```

## Trade-run checks

1. Confirm the cargo sizes are **32, 24, 12, 8, and 1 SCU**.
2. Enter `36` under 32 SCU and `12` under 24 SCU. Confirm total cargo is **1,440 SCU**.
3. Test **Price by SCU & quantity** and confirm investment and revenue use total SCU.
4. Test **Total transaction amounts** and confirm the entered totals are used directly.
5. Enter loading, unloading, fuel, and other costs and confirm they reduce net profit.
6. Confirm route distance appears after selecting buy and sell locations.
7. Enter an observed trip time and confirm profit per minute appears.
8. Save multiple runs and test every ranking option.
9. Confirm the top-ranked run appears in the Best Match panel.
10. Confirm each run displays its price-observed date and freshness.
11. Edit a saved run and confirm it updates rather than creating a duplicate.
12. Confirm old saves that used 36-SCU containers appear as 32-SCU containers.
