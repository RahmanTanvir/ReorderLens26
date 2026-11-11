# P7 — human-reviewed purchase-order drafts

P6 was accepted by the owner on 2026-11-11, who explicitly authorized P7.
P8 and deployment remain gated. No dependencies or environment variables added.

## Apply once in the existing isolated development project

Generate the atomic phase-only bundle with `corepack.cmd pnpm db:bundle p7`.
Run the entire `artifacts/p7-upgrade.sql` once in the Supabase SQL Editor.
Do not rerun P2–P6. Migration 012 adds nullable document/line snapshot columns
without rewriting existing records, guarded conversion and RLS-preserving reads.
The exact bundle was tested against an existing P6 plan; repeat application
fails safely. Never remove applied migrations or replace hosted tables.

If application fails, stop and capture the error without credentials. The bundle
is one transaction. Run `supabase/verify-p7.sql` for read-only grants/schema checks.
No service-role client or extra Supabase configuration is required.

The owner reported successful application on 2026-11-11. All three new hosted
RPCs were probed anonymously and denied execution (401/42501). The owner later
reported all final signed-in creation, two-tab retry, refresh, CSV and printing
checks below passed. P7 is complete; this hosted smoke is owner-reported.

Final local checks include354 tests, lint/types/build,50 responsive/axe cases and
normal/100-line PDF fixtures. Print pages remain entirely white with backgrounds
enabled, navigation hidden, all100 unique line SKUs and exact totals preserved.

## Implemented contract

- S08 review requires saved, valid, non-stale, within-budget quantities. Unsaved
  changes must be saved/discarded first. A converted plan links to its saved drafts.
- S11 `/app/purchase-orders/review?planId=<uuid>` shows all positive lines grouped
  by supplier, frozen prices/lead times, budget and reviewed revision. Edit in S08;
  explicit **Save drafts** is the only order-creation action. Viewing never writes.
- `POST /api/plans/:id/convert` accepts only `{expectedRevision}`. Internal verified
  owner/operator membership, workspace advisory lock then plan row lock, freshness,
  revision, costs, eligibility, snapshots and packs are rechecked. It atomically
  creates one draft/supplier, copies immutable lines and marks the plan converted.
  A retry returns the same IDs, including after a later import. Converted plans
  cannot be edited. The unique organization/plan/supplier constraint is retained.
- S10 lists persisted drafts only, newest first, with supplier/date/plan filters
  and stable bounded pages (25 default, 100 maximum). Summary covers matching
  drafts across pages. Dates use Asia/Dhaka. No invented delivery statuses.
- S12 shows immutable workspace/supplier labels, quantities, prices, packs and
  nominal lead snapshots. CSV is private UTF-8/RFC4180 with spreadsheet formula
  protection. Browser printing removes navigation/dark chrome and supports PDF.
  Export failures leave the saved draft intact. No dispatch, payment or receipt.
- Pre-P7 orders lacking document snapshots are preserved, not backfilled with
  mutable current catalog data. They are excluded from versioned document reads;
  P6 did not create orders. An unsupported legacy converted plan returns a safe error.

## Hosted owner verification

Restart with `corepack.cmd pnpm dev` after applying the migration.

1. In the imported **fictional QA** workspace, open the unconverted saved plan
   with budget 50,000, review 7 and safety 2. Restore/reset and save quantities if
   necessary. With the unmodified baseline CSVs, the saved total is **49,930**,
   remaining **70**: Oil70/Rice65/Milk2/Noodles6. Open **Review Purchase Orders**.
2. Expect two groups: Fictional QA Dhaka Wholesale **34,370** (Rice + Noodles),
   Fictional QA Eastern Essentials **15,560** (Oil + Milk). Total **49,930**.
   These differ from the built-in sample fixture (48,750); do not mix expectations.
3. Open the same review URL in two tabs before saving. Save in both. Each should
   succeed/reuse the same two IDs. Refresh the list filtered by this plan: exactly
   two saved drafts, each with two lines, status Draft. An interrupted response
   can be retried with the same plan/revision without creating another order.
4. Open both details, refresh, export CSV and use Print / Save PDF. Check supplier,
   product/SKU, quantities, prices, dates and total. Chrome should disappear in
   print preview, with readable black text/white page. Nothing is sent to suppliers.
5. The source plan is now converted/read-only and links to the saved drafts.
   Reopening review must show existing drafts rather than a new Save action.
   Supplier/date filters and Reset filters must work; no matches shows an empty state.
6. For a separate fresh draft plan, open review in tab A; edit/save its quantity
   in tab B. A's Save must return409 and request re-review. Over-budget/empty plans
   cannot convert. A later stock import blocks old draft conversion; saved orders
   remain unchanged. Use the QA pack's stock-update folder only after baseline tests.
7. Built-in sample mode is separate: original 50,000/48,750 plan saves two drafts
   at26,500 and22,250. All sample pages/documents remain explicitly illustrative.

The owner reported the two-tab and browser output checks passed. Automated
multi-session stress, signed-in two-account isolation and broader printer/browser
coverage remain release follow-ups. Local PostgreSQL tests use an Auth/Storage
test facade; they do not prove hosted Auth E2E. P8 remains unauthorized.
