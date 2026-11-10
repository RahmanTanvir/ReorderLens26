# P3 development upgrade and verification

P2 was marked complete by the owner with the disclosed verification gaps carried
forward. P3 adds imports and isolated sample data only. Use the existing isolated
development project and keep credentials in the ignored `.env.local`.

1. Generate the **P3-only** bundle: `corepack.cmd pnpm db:bundle p3`.
2. Open `artifacts/p3-upgrade.sql`, paste the entire file into the project's SQL
   Editor and run once. Do not rerun `p2-bootstrap.sql`. Stop on an error; do not
   delete objects to retry. The owner reported this upgrade applied successfully.
3. Optionally run the read-only `supabase/verify-p3.sql`. Keep migrations 00400
   and 00500 unchanged once applied; future changes require another migration.
4. Restart the app with `corepack.cmd pnpm dev`. Create a separate real workspace
   at `http://localhost:3000/setup?new=1`, named for example **P3 CSV TEST**.
5. On Import Data, choose one file for each of Suppliers, Products, Stock snapshots
   and Daily sales. Templates under `public/templates/` contain headers only.
   Local fictional verification files are in ignored `artifacts/p3-test-files/`;
   read its README and use those only in this isolated test workspace.
6. Continue to mapping. Review source columns, validate, and review counts/preview.
   The fictional test files should show 28 rows: 3 suppliers, 8 products,
   8 snapshots and 9 recorded daily-sales rows. No business tables change yet.
7. Review confirmation and check the explicit approval. Confirm the import, then
   reload its saved report. A lost response can safely be retried for the same job.
8. Reimport the same files as a new job. Expect 28 updates, require approval and
   preserve one row per normalized supplier/SKU/product-date. Correcting invalid
   source values needs a new upload; mapping errors can be fixed on the same job.
9. Open `/setup?new=1` and choose **Explore sample workspace**. Verify the visible
   illustrative-data banner, 8 saved sample products and blocked CSV imports.
   Switch back to the real test workspace to verify its records stay separate.

The owner reported steps 5–9 passed on the hosted development project. Local
automated permission tests use PostgreSQL/PGlite, not the hosted Auth/Storage
services. Hosted multi-account automated verification remains a release follow-up.

## Transport and authorization

`POST /api/imports` accepts strict JSON `{jobId,files:[...]}` (four manifest entries,
including kind, original filename, size, SHA-256 and proposed headers). Each file
then uses `POST /api/imports/:id/files/:kind` with multipart field `file`. Each
request is bounded to 2 MiB plus small multipart overhead; this avoids combining
four maximum-size files above Vercel's
[4.5 MB function payload limit](https://vercel.com/docs/functions/limitations).
No direct browser Storage token or signed upload link is exposed.

The server checks membership, owner/operator role and job creator for mutation;
viewers can read authorized reports only. SQL procedures repeat internal role and
tenant checks. Only manifest-declared filenames are accepted. Files are immutable
to user writes after the first successful upload, including during mapping retry.

Validation returns a fresh `validationToken`. Confirmation sends
`{confirmUpserts,validationToken}`; the transaction verifies the token and normalized
batch digest, then recomputes all update counts. If concurrent imports introduce
new updates, confirmation without update approval fails safely. Confirmation also
re-parses and checks the original private file checksums before entering SQL.

Successful imports set `stale_at` on earlier forecasts/plans and preserve PO
snapshots. Future consumers must filter or label stale inputs. Dates are strict
local calendar dates from 1900 through tomorrow in Asia/Dhaka; missing dates never
create invented zeros. Costs remain decimal strings through validation.

There are no automatic forecasts or seeded planning/PO results in P3. The sample
contains only documented catalog, inventory and limited illustrative history.
Source retention and maximum-size hosted performance still require launch review.
