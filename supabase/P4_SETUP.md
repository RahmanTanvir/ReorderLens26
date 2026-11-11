# P4 inventory and risk — development verification

P4 adds read-only Overview, Inventory and Product Details. P5 forecast generation,
P6 planning and P8 Insight are not enabled. Existing P2 release follow-ups remain
recorded in the root README; do not infer a complete production security audit.

1. Generate `corepack.cmd pnpm db:bundle p4`. Apply the entire generated
   `artifacts/p4-upgrade.sql` once in the existing isolated Supabase development
   project's SQL Editor. It contains only migrations 00600/00700. Do not rerun
   earlier bootstrap/upgrade bundles or delete objects to retry an error.
   The owner reported successful P4 upgrade application on 2026-11-11.
2. The upgrade adds a security-invoker read view and three read-only procedures.
   Underlying tenant RLS and grants continue to apply; every RPC also checks the
   caller's membership. No service-role client or direct business-write grant.
3. Existing and future sample organizations receive one idempotent
   `sample_fixture` run with the eight documented daily rates (as of 2026-11-09).
   Creation/finish timestamps reflect the actual seed execution. These rates are
   illustrative and not fitted from the nine available sales records. No forecast
   curve, purchase plan or order is invented. Real workspaces receive no fixtures.
4. Restart `corepack.cmd pnpm dev`, sign in, and choose the sample workspace.
   On Overview/Inventory expect eight products: one at risk, three reorder soon,
   four healthy. Search Oil and apply At risk/supplier filters. Opening Oil should
   show on hand 38, illustrative demand 7/day, cover 5.4 days, lead 6 days and
   gap 0.6 days. Back to Inventory preserves the originating filters.
5. Open a real imported workspace. Its actual stock/suppliers should appear, but
   demand/risk remain Insufficient data until a sufficient saved forecast exists.
   Sales observations are not silently converted to a demand forecast.
6. Test sort, search, supplier/status filters and reset. Use `?limit=2` to test Next
   page / First page. Cursors are bound to workspace, query and source revision;
   after a confirmed import, old cursors must request a fresh first page.
7. Product Details shows only recorded sales in the last 28 local calendar days
   and actual saved forward forecast points when present. Missing dates are gaps;
   recorded zero stockout days are not invented lost demand. There is no confidence
   band. The exact values/availability are also in semantic tables.

## Read semantics

**Owner verification — 2026-11-11:** all requested authenticated sample and real
workspace checks above were reported passed. The supplied TWH screenshots show
the expected real-mode unknown-demand state and functioning At risk empty filter.
This is owner-run hosted verification, not automated multi-account testing.

- Active products only. Latest eligible stock date at or before today in
  Asia/Dhaka; future snapshots are ignored and flagged. Snapshots older than seven
  calendar days are stale. Current dates are determined server-side.
- Latest succeeded, finished, non-future seasonal baseline run, or sample_fixture
  only inside a sample organization. An insufficient result in a newer completed
  run never falls back silently to an older sufficient result.
- A later import or stale_at marks a forecast stale. Risk estimates remain visible
  with explicit warnings, as specified in BUSINESS_LOGIC. Zero sufficient demand
  is healthy with No recent demand; missing evidence is unknown, never healthy.
- Comparisons use exact numeric multiplication (SQL) and scaled BigInt ratios
  (domain). SQL/domain parity is tested, including strict lead-time and inclusive
  review-window boundaries. Display is half-up to one decimal from original inputs.
- List sorting uses stable composite keys and an ID tie-break, capped at 100 rows.
  Unknown/zero-demand cover sorts last in either cover direction. Search matches
  literal product names/SKUs; SQL wildcard characters are not interpreted.
- Overview uses risk tier then SKU; its counts cover the entire active workspace.
  Purchasing context reads only an actual non-stale saved draft plan, with totals
  from immutable line prices. Without one, it honestly says no draft is available.

`supabase/verify-p4.sql` is a read-only structural check, not proof of hosted
multi-account isolation. Local tests exercise migrated PostgreSQL/RLS and API/UI
boundaries; hosted identity/Storage coverage and production load remain separate
release gates. No deployment is performed by P4.
