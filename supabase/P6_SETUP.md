# P6 planning and scenarios — isolated development verification

P6 adds `/app/replenishment` and `/app/scenarios`. P7 purchase-order review,
creation/export, P8 Insight and deployment remain unavailable. Use only the
existing isolated Supabase development project after P2–P5 are applied.

1. Run `corepack.cmd pnpm db:bundle p6`. Apply the **entire** generated
   `artifacts/p6-upgrade.sql` **once** in Supabase SQL Editor. It contains only
   migrations 01000/01100. Do not rerun older bundles or delete existing objects.
   `supabase/verify-p6.sql` is a read-only structural audit.
2. Restart `corepack.cmd pnpm dev`. Select your real TWH workspace. Its small P3
   history still has no sufficient forecasts, so the planner must explain why it
   cannot generate recommendations. It must not invent purchasing quantities.
   If you have legitimate sufficient development history, choose its completed
   run and budget to exercise the runtime greedy allocator.
3. Select the sample workspace, open Replenishment and choose **Load sample
   plan**. This explicitly creates the documented illustrative fixture: budget
   BDT 50,000; four selected products/185 units; suggested/approved total
   BDT 48,750; remaining BDT 1,250. All eight saved product inputs are available,
   including excluded healthy products. The fixed suggestions are labeled
   `sample_fixture`, never claimed as output from the runtime heuristic.
4. Change Oil's approved quantity from65 to60. The preview total should become
   BDT 47,700 with BDT 2,300 remaining; Save working plan, refresh and reopen it.
   Original suggested quantity stays65. Only approved quantities determine totals.
   Try a lower budget (e.g. BDT 1,000): the overage is explicit. Saving over-budget
   exploration is allowed, but budget eligibility is false and review is blocked.
5. Set budget back to50,000 and save. **Reset quantities** restores the original
   suggestions (Oil65/total48,750) under a new revision. It never reallocates after
   a budget edit. Discard unsaved edits affects only the current browser fields.
6. Open the same plan in two tabs. Save an edit in one, then save from the older
   tab: expect `STALE_REVISION`/409, preserved local fields and explicit Reload
   saved plan. No lost update. Save working plan is one atomic revision, including
   simultaneous budget and up to100 quantity edits.
7. From a saved plan choose **Analyze supplier delay**. Select Eastern Essentials,
   add3 days and Run scenario: Oil lead6→9/gap0.6→3.6 days; Milk lead3→6/gap0→1.2;
   baseline exposed1, delayed exposed2, newly exposed1. Local Traders/Dhaka inputs
   stay unchanged. Reset to baseline gives0 days and identical before/after gaps.
   Return to Planner: revision, quantities and budget must stay unchanged.
8. Scenario controls can change without changing the last displayed result until
   Run scenario is pressed. The result identifies its actual supplier/delay/revision.
   Viewer accounts may inspect plans/run comparisons; only owners/operators save.
9. A later confirmed development import marks the saved plan stale, blocks editing
   and requires fresh forecast/plan inputs. Existing evidence stays frozen. No PO,
   supplier communication, payment, receipt or external AI action occurs.

## Engineering boundaries

- Allocation: active products, sufficient positive D7, confirmed stock, positive
  cost, active supplier and at-risk/reorder-soon status. Missing stock is recorded
  as an exclusion, never a zero snapshot. Healthy/unknown/zero-demand products are
  not manually turned into recommendations in v1.
- Desired = ceil-to-pack(max(0,ceil(D×(lead+review+safety)−stock))). Prioritize risk,
  exact descending pre-arrival gap, then Unicode SKU/ID deterministically. Greedy
  allocation takes affordable complete packs; no global optimality claim.
- Money uses integer minor units/SQL numeric, not floating-point. Large approved
  totals remain decimal strings. D7 is the saved four-decimal forecast contract.
  Gap/cover display rounds once from original ratios, not rounded API values.
- Technical initial limits:500 active products/plan,100 rows/page or atomic edit
  batch,20 new plans/hour/org. Successful creation retries use the caller's saved
  plan UUID and frozen initial request; changing inputs requires a new UUID.
- Input/catalog/cost/stock/demand/lead/pack/risk snapshots stay fixed. Budget and
  approved quantities are editable on current drafts, guarded by internal role,
  membership, org/import lock, parent row lock and expected revision. Direct table
  writes remain denied. Sample approval edits never affect real workspaces.
- Scenario POST is stateless, same-origin protected and available to viewers.
  Reads one authorized saved plan, computes pure comparisons, returns affected
  product pages; no mutation RPC is used. Stale scenarios are labeled historical.
- P7 conversion is intentionally absent. `canReview` is a budget/input eligibility
  calculation for future P7; the UI does not enable a nonexistent order action.
- Runtime numerical-path tests use fictional isolated PostgreSQL fixtures.
  Hosted two-account/positive-history/scale verification and accepted P2 release
  follow-ups remain separate gates. Do not label P6 production-ready.

The owner reported successful hosted migration application. All six new public
RPCs reject anonymous execution (401/42501). Owner TWH screenshots confirm the
expected zero-sufficient-forecast creation block and no-plan scenario state.
The owner subsequently confirmed final editing/reset/scenario and two-tab checks,
marked P6 complete and authorized P7 (2026-11-11). This is owner-reported hosted
verification, not an automated hosted E2E run.

## Importable synthetic QA alternative requested by owner

The owner requested CSVs instead of the built-in sample workflow. A separate
test pack is available locally at artifacts/p6-import-test-data/START_HERE.md,
with the archive artifacts/ReorderLens_P6_Import_Test_Data_2026-11-11.zip.
Create an ordinary development workspace explicitly named ReorderLens QA -
SYNTHETIC DATA and import only the four01_baseline CSVs first. Keep them separate
from TWH/business records; the sample organization itself does not accept imports.
All names/SKUs are visibly fictional. This explicit owner-requested test workflow
uses the real importer/forecast/planner over synthetic inputs, not fixed fixture
recommendations. Use cutoff2026-11-11:418 import rows,7 sufficient/1 insufficient,
and runtime plan49,930.00/70.00 on a50,000 budget. The detailed checklist includes
stock updates and intentionally invalid imports. Exact files passed local parser,
guarded SQL workflow and domain parity checks. Hosted owner verification remains
complete by owner acceptance. The later explicit “Checked” confirmation closes
the P6 hosted smoke checklist; inherited release checks remain separate.
