# ReorderLens

Inventory intelligence and budget-aware replenishment planning for independent
retailers. ReorderLens turns imported sales and stock records into explainable
demand estimates, stockout-risk views and human-reviewed purchasing drafts.

Prepared for the **International AI Builders Congress 2026**.

## Live demonstration

[Open ReorderLens](https://reorderlens26.vercel.app).

The owner will provide **confirmed judge access privately** through the submission
channel. No demo passwords, tokens or public default accounts belong in this
repository. Use the assigned fictional QA workspace or the clearly labeled sample
workspace; do not upload customer records for judging.

The separate [/preview](https://reorderlens26.vercel.app/preview) route is a
non-persistent visual/component reference, not a functional business dashboard.

## What the application does

- Supabase authentication, account recovery and isolated business workspaces.
- Four-file CSV mapping, validation, confirmation and duplicate-safe reimports.
- Inventory filtering, product details, stock coverage and stockout-risk signals.
- Saved, reproducible 7/14/28-day demand baselines with data-quality evidence.
- Budget-constrained replenishment suggestions with editable approved quantities.
- Supplier-delay comparisons that preserve the saved purchasing plan.
- Explicitly reviewed, supplier-grouped PO drafts with CSV and print/PDF export.
- ReorderLens Insight: contextual, read-only explanations of authorized records.

Missing evidence stays **insufficient data**. Draft orders are not dispatched,
paid or treated as received inventory. Intentional sample data is labeled and
isolated from real workspaces.

## Technology

React19, Next.js16 App Router, TypeScript, Tailwind CSS4, shadcn-style Radix
components, Supabase PostgreSQL/Auth/Storage and Vercel. The Graphite Workspace2.0
visual system uses self-hosted Manrope and the actual supplied logo.

Insight currently uses deterministic explanations. The OpenRouter free-model
adapter is implemented but external inference remains disabled; model
qualification is deferred. See [AI and data provenance](docs/AI_AND_DATA_PROVENANCE.md).

## Run locally

Use **Node24.18.0** and **pnpm11.25.0**, as pinned in package.json and .node-version.

~~~powershell
corepack.cmd pnpm install --frozen-lockfile
~~~

1. Create an isolated Supabase project for local testing.
2. Apply the reviewed files in [supabase/migrations](supabase/migrations) once,
   in filename order, to the empty project. Existing installations must follow
   their phase-specific upgrade instructions instead of rerunning migrations.
   See [Supabase setup](supabase/README.md) and the P3–P8 setup guides there.
3. Create .env.local from [.env.example](.env.example) **only if it does not
   already exist**. Preserve existing local configuration.
4. Set the application origin and the Supabase URL/publishable key from that
   same project. Keep email confirmation enabled; configure the local Site URL
   and callback redirect for http://localhost:3000/auth/callback.
5. Start the application:

~~~powershell
corepack.cmd pnpm dev
~~~

Open http://localhost:3000, register a test account, confirm its email in the
same browser/profile, then create a workspace or choose Explore sample workspace.
CSV templates are available in Import Data and [public/templates](public/templates).
Ordinary CSV imports are blocked in sample workspaces.

On macOS/Linux, use corepack pnpm instead of corepack.cmd pnpm. Without Supabase
configuration, /preview works; authenticated business workflows require Supabase.

## Environment variables

| Variable | Purpose |
|---|---|
| NEXT_PUBLIC_APP_URL | Exact application origin; local default is http://localhost:3000 |
| NEXT_PUBLIC_SUPABASE_URL | URL of the configured Supabase project |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | That project's key starting with sb_publishable_ |
| AI_ASSISTANT_ENABLED | Keep false for the accepted deterministic-only mode |
| OPENROUTER_SAMPLE_EVALUATION | Keep false; synthetic model evaluation is separately gated |
| OPENROUTER_API_KEY | Optional server-only provider credential; unnecessary for the demo |
| OPENROUTER_PRIMARY_MODEL / OPENROUTER_FALLBACK_MODELS | Optional evaluated free-model IDs; no default model is qualified |
| OPENROUTER_BASE_URL | Fixed to https://openrouter.ai/api/v1 |
| SUPABASE_SECRET_KEY | Unnecessary for current RPC/RLS workflows; leave blank |

Never put provider, secret or service-role keys in NEXT_PUBLIC_ settings.
The legacy NEXT_PUBLIC_SUPABASE_ANON_KEY name is unsupported. Keep .env.local
out of Git; the shared template contains no service credentials.

For Vercel, set Node24.x, configure target-specific environment values and exact
HTTPS Supabase callback origins, and keep inference off. Environment changes
require a new deployment. Do not reuse local callback URLs for the live site.

## Verification

~~~powershell
corepack.cmd pnpm check
corepack.cmd pnpm release:preflight
corepack.cmd pnpm audit --prod
~~~

The full check runs lint, route/TypeScript validation, unit/component/PostgreSQL
tests and the production build. PostgreSQL tests use real migrations in local
PGlite with an Auth/Storage facade; they do not require hosted credentials.

To check a local production server, use separate terminals:

~~~powershell
corepack.cmd pnpm start --port 3100
corepack.cmd pnpm release:smoke
~~~

The smoke script uses anonymous requests, no valid business payloads and no
account/email creation. Browser and hosted check scopes are documented in the
[release checklist](docs/RELEASE_CHECKLIST.md).

The optional [capacity benchmark](tests/security/capacity.test.ts) runs only when
REORDERLENS_CAPACITY=1. It uses synthetic local data, not the deployed database.
The [private CSV verifier](docs/HOSTED_ISOLATION_CHECK.md) is a separate interactive,
read-only data check for maintainers with two confirmed test accounts.

## Repository map

- src/app — pages, guarded route handlers, layouts, loading/error states and tokens.
- src/components — reusable UI and workflow-specific presentation.
- src/domain — pure import, forecast, risk, planning, scenario, order and explanation logic.
- src/server — server-only authentication, authorization, services and provider adapter.
- supabase — immutable migrations, verification SQL and setup guides.
- tests — unit, component and PostgreSQL regressions with fictional fixtures.
- docs — provenance, historical evidence, audit and release guidance.

The owner intentionally excludes ReorderLens_Docs/ (private specifications and
original design references), .env files and artifacts/ from Git. All runtime
branding/fonts, required migrations and useful automated fixtures are included.
Obtain the private specification package from the owner before changing product
behavior; ordinary review and running the application use the tracked files.

## Verification limits

The deployed public HTTP/browser checks were agent-executed; authenticated
business, recovery and cross-account checks were owner-reported. These evidence
types are kept separate in the release checklist.

Forecasts are statistical baselines, not proven-accuracy ML predictions.
Sample quantities are illustrative. Old/insufficient imported history or stale
stock can correctly prevent new recommendations; keep judge fixtures current.
Database types are a manually checked query contract rather than a full hosted
schema export. Hosted Storage write probes, load testing, restore exercises and
operational production review remain unverified. This is not a production-readiness
or security-certification claim.

[Development history](docs/DEVELOPMENT_HISTORY.md) preserves earlier phase records.
[Submission audit](docs/SUBMISSION_AUDIT.md) records the final cleanup and check results.
