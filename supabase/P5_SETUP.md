# P5 baseline forecasting — isolated development verification

P5 adds `/app/forecasts`, synchronous atomic baseline generation and immutable
saved evidence. P6 planning, purchase orders and external AI remain unavailable.
Apply this upgrade only after P2, P3 and P4 are already applied.

1. Run `corepack.cmd pnpm db:bundle p5`. In your isolated Supabase development
   project's SQL Editor, run the **entire** `artifacts/p5-upgrade.sql` **once**.
   It contains only migrations 00800/00900 in one transaction. Do not rerun P2,
   P3 or P4 bundles; do not delete objects to retry a failure. The read-only
   `supabase/verify-p5.sql` can inspect structure without running the upgrade.
2. Restart `corepack.cmd pnpm dev`, sign in, select your real imported workspace
   and open `/app/forecasts`. With no previous runs, expect a useful empty state.
   Owners/operators can select a sales cutoff (on/before today in Asia/Dhaka)
   and a 7, 14 or 28-day horizon. Viewer access is read-only.
3. Generate each horizon and reopen it from Saved runs, including after refresh.
   **Run complete** means computation/storage succeeded; it does not assert that
   history is sufficient. The P3 test dataset contains only nine sales rows
   across products, so its expected outcome is **Insufficient data**, null daily
   demand and no invented projected points. Inventory remains unknown in that
   case. Missing dates are never assumed to be zero sales.
4. If your own development dataset has at least 14 eligible dates per product in
   `[cutoff-27,cutoff]`, including one in `[cutoff-6,cutoff]`, expect 7/14/28 saved
   dated points per sufficient product. Inspect a product's evidence, open
   **Exact saved dates and units**, and compare source dates/availability. Its D7
   rate should also appear in Inventory/Product Details. Do not manufacture
   customer history to make a numerical forecast appear. Positive-path local
   tests use explicitly fictional records in a separate in-memory PostgreSQL.
5. Repeat an identical successful request: the saved run ID must stay the same,
   with no duplicate. A failed/interrupted HTTP response does not imply database
   rollback: check Saved runs and retry the same inputs. A completed run is
   reused before the quota check; at most ten new runs/hour/workspace are allowed.
6. Confirm a later CSV import in a development workspace if testing source
   invalidation: original run history/estimates stay unchanged; that run is
   labeled stale, and the same forecast inputs create a new source version.
   This changes development data, so use records you intend to import.
7. Switch to the sample workspace. Expect eight labeled illustrative rates,
   generation disabled, and no invented forward curve or horizon totals. Its
   original documented dataset and inventory totals remain unchanged.
8. Where two development accounts/roles are available, verify viewer generation
   rejection and cross-workspace run/product isolation. Local RLS tests do not
   substitute for hosted multi-account verification.

## Calculation and persistence

- `seasonal_baseline_v1`; history snapshot includes recorded date, units,
  availability and promotion, plus catalog/supplier names at execution.
- Stockout records are excluded from fitting without reconstructing lost sales.
  Unknown availability remains uncorrected; promotions are not modeled.
- Two matching eligible weekdays use their mean; otherwise the global eligible
  mean. D7 averages the first seven **unrounded** predictions for every horizon.
- Exact integer numerators use LCM(1..28), with half-up rounding once at the
  existing `numeric(14,4)` storage boundary. The blueprint's “round display only”
  conflicts with its finite-scale schema for repeating fractions. P5 preserves
  that schema, documents four-decimal persisted precision, and never computes D7
  from rounded points. Horizon totals sum the saved points. No interval,
  performance percentage or calibrated accuracy is asserted.
- Generation is guarded in PostgreSQL, not computed from browser-supplied
  estimates. It shares the import transaction lock. Successful inputs are
  idempotent by organization/cutoff/horizon/source revision/algorithm version.
- All product results/points commit together. A caught SQL failure rolls back
  partial output and persists only `BASELINE_FAILED`. Cancellation/connection
  loss can roll back the request or lose its response: retries remain safe.
- Reads retain tenant RLS and use bounded stable keyset pages. Run snapshots are
  immutable through the application's grants; a later import marks them stale.
  There is no silent fallback from an insufficient newer run to an older rate.

## API

- `GET /api/forecasts/runs?limit=25&runsCursor=<last-run-id>` returns saved runs,
  including failed statuses for review; `data.items` and `pageInfo.nextCursor`.
- `POST /api/forecasts/runs` accepts only `{asOfDate,horizonDays}`. Returns actual
  persisted `{runId,status,reused,errorCode}`, 201 new or 200 reused. Execution
  status and per-product evidence quality are separate.
- `GET /api/forecasts/runs/:id?limit=25&cursor=<last-result-id>&productId=<uuid>`
  returns run metadata, bounded product estimates and selected product's exact
  history/points, with `pageInfo.nextCursor`. Omit productId for the page's first
  product. Cursor IDs must belong to this organization and run. No raw source
  files, secrets, autonomous purchasing or provider transmission.

The owner reported successful hosted upgrade application on 2026-11-11. All three
new RPCs reject anonymous execution (401/42501). Screenshots confirm the expected
TWH insufficient-data result (8 products; Rice 4 eligible/7 observed with 3
stockouts). A selector synchronization issue visible in those screenshots was
fixed with a navigation regression test. The owner reported all final selection/
reuse/horizon/sample checks passed on 2026-11-11. P5 functional verification is
complete; this is owner-run hosted evidence, not automated E2E. Accepted P2
release follow-ups and maximum-size
hosted load testing remain separate gates. No deployment is part of P5.
