# P9 hosted database type export

Status: owner deferred this step on2026-11-12. Retain this guide for later;
no export, application type replacement or generated-schema verification is
currently required to continue P9 work. The schema-type gap remains documented.

The application currently uses a manually checked query contract in
src/lib/supabase/database.types.ts. Obtain an actual schema-generated export
before changing it; a passing runtime test does not prove every type matches.

1. Open the Supabase project connected to https://reorderlens26.vercel.app.
   Use the same project whose16-table/security audit you confirmed passed.
2. Open its Data API documentation in the dashboard and use the TypeScript
   database-type generation/download action. Export the `public` schema.
   Supabase's official guide links the relevant dashboard page:
   https://supabase.com/docs/guides/api/rest/generating-types
3. Save the actual downloaded/copied TypeScript output as UTF-8 at:

   ```text
   D:\Competitions\ReorderLens\Reorder_Web\artifacts\p9-hosted-database.types.ts
   ```

4. Confirm the file is ready. No password, API key, account token, database
   connection string or customer rows are needed. Do not overwrite the current
   application type file, run migrations, or deploy for this export.

The export should contain a Database type with public Tables, Functions and
Enums, and usually a Json type. It must be the full schema export, not a single
table's client example, an API response or a manually assembled approximation.
The agent will compare it with migrations and current service queries, preserve
least-privilege application constraints, then run relevant checks after any
reconciliation. A generated Insert type does not grant database write permission.

Dashboard export is supported by Supabase's official guide (checked2026-11-12).
No CLI installation is required for this route. If using an already authenticated
CLI instead, inspect `supabase --version` and `supabase gen types typescript --help`
first: project targeting flags differ between CLI versions. Keep that account's
access token local; save generated output to the same comparison path above.

The generated comparison file is ignored by Git. Do not force-add the private
documentation package or record schema generation as completed until the actual
file is inspected. This step does not close Storage write/load/operational gates.
