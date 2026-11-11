# ReorderLens

Inventory intelligence and budget-aware replenishment planning, implemented in
reviewed phases. P1 was accepted by the owner. P2 now includes Supabase migrations,
server-side authentication, workspace setup and settings. The owner marked P2
complete and authorized P3 with the verification gaps below carried forward. `/` redirects to
`/login`; the preserved P1 visual preview is at `/preview`. P3 adds imports and
isolated sample data. P4 implements Overview, Inventory and Product Details.
P5 adds saved baseline forecasts and their source evidence at `/app/forecasts`;
the owner applied its hosted SQL upgrade and all final hosted checks passed. Planning,
purchase orders and AI remain later phases.

Follow [the Supabase development setup](supabase/README.md) before testing P2.
Configuration belongs in the ignored `.env.local`; `.env.example` is a blank
template. On Windows, use `corepack.cmd pnpm` if `pnpm` is not recognized.

## Local setup

Use Node.js `24.18.0` (also recorded in `.node-version`) and pnpm `11.25.0`.
The package-manager version is pinned in `package.json`; do not mix lockfiles.
No global Corepack activation is required when pnpm is already available.

```powershell
corepack.cmd pnpm install --frozen-lockfile
corepack.cmd pnpm dev
```

Open http://localhost:3000. The server binds to the local loopback interface.
No credentials or `.env.local` file are required for `/preview`.
To configure future integrations, copy `.env.example` to `.env.local` and keep
real values out of Git. Leave both public Supabase settings blank or configure
both together with a publishable key. Legacy anon-key configuration is not
supported by this bootstrap.

`AI_ASSISTANT_ENABLED` must remain `false`. External inference cannot be
enabled until its P8 evaluation and privacy gates are implemented and reviewed.
The OpenRouter model variables are reserved for P8 and are not consumed yet.

## Verification

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm start
```

Stop `pnpm dev` before `pnpm start`, since both use port 3000. `pnpm check`
runs lint, typecheck, unit/component tests and production build in order.
Configuration tests cover absent/partial services, safe public projection,
misplaced secrets, URL validation and fail-closed external AI settings.
Typecheck generates Next.js route types first so it works on a fresh checkout;
the framework-managed `next-env.d.ts` is intentionally ignored.

## Project organization

- `src/app/`: root layout, preview entrypoint, local Manrope font and Graphite tokens.
- `src/components/ui/`: manually installed shadcn-compatible primitives using
  Radix dialog/sheet/tooltip behavior, native inputs/selects and shared variants.
- `src/components/layout/`: responsive shell, navigation and top bar.
- `src/components/shared/`: branding, page headers, empty states and metric strip.
- `src/components/preview/`: explicitly labeled P1 inventory and component examples.
- `src/lib/navigation.ts`: canonical future route map and section matching.
- `src/lib/validation/`: pure, testable environment parsing with safe errors.
- `src/server/config/`: server-only environment access. Never pass this object
  to client components or serialize it into a response.
- `tests/unit/`: configuration and deep-link navigation tests.
- `tests/components/`: interaction, focus-restoration and accessibility regression tests.
- `ReorderLens_Docs/`: local technical specifications, phase tracker and original
  design assets. The owner explicitly requested exclusion from Git; fresh clones
  must receive this package separately. Original images remain untouched.

P2 adds `supabase/migrations/`, server-only Supabase/auth helpers, same-origin
auth/workspace/profile handlers, `/setup`, `/app/overview` and `/app/settings`.
P3 adds guarded imports; P4 adds inventory/risk domain functions and protected
read APIs. Later phases add forecast generation and purchasing workflows.

## Design and backend gates

P1 introduces self-hosted Manrope, centralized Graphite tokens, reusable
primitives and the shell. The supplied transparent logo is
`ReorderLens_Docs/design-references/01-brand-identity/ReorderLens_logo.png`
(1312×1199; SHA-256
`34dc3a487cc24a6bc99c710fd1227ef45b5028f9c6b7d0c36219c92c2ea3cc85`).
Its exact bytes are now copied to `public/branding/reorderlens-logo.png` and used
by the shell and favicon metadata. Runtime branding/font assets are tracked even
though the original specification package is intentionally ignored. Do not
recreate the logo, recolor it, or mark candidate screens approved.

P2 requires local Supabase CLI + Docker or a separate hosted development project,
and two-user tenant-isolation tests before business-data APIs. Neither Docker nor
the Supabase CLI was found during inspection. No service credentials, accounts,
cloud projects or public deployment are needed for the P1 preview.

P2 resolves the pack-multiple plan snapshot and creator-only building-plan/line
read policies in its initial migrations. Resolve before later phases: S11 edit/review behavior,
assistant quota discrepancy (40 versus 50/org/day), and the stale `/api/inventory`
test example versus canonical `/api/products`.

## P0 verification record

**Locally verified (2026-11-10); owner subsequently authorized P1.** The following
is the historical P0 verification record. At that point the agent had created no
commit, remote repository, migration, service account, external inference call or
deployment. The owner subsequently committed and connected the repository.

Exact baseline: Node.js 24.18.0; pnpm 11.25.0; Next.js 16.4.6; React/React DOM
19.3.1; TypeScript 5.9.3; Tailwind/PostCSS plugin 4.3.5; PostCSS 8.5.32;
ESLint 9.39.5 with eslint-config-next 16.4.6; Vitest 5.1.0; Zod 4.6.7;
server-only 0.0.1. Type packages are pinned in `package.json`. The lockfile
records the complete resolved tree. `pnpm-workspace.yaml` holds pnpm 11 settings;
checks fail on stale dependencies rather than installing implicitly.

### Actual verification evidence

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Passed; manifest and lockfile agree |
| `pnpm check` | Passed: zero-warning lint, generated route types + strict typecheck, 19/19 configuration tests, production build |
| Fresh generated-type file | Removed only the generated `next-env.d.ts`; `pnpm check` recreated it successfully |
| `pnpm dev` | Ready; root HTTP 200 without service credentials |
| `pnpm start --port 3100` | Ready; root HTTP 200, expected content and noindex metadata |
| Unimplemented `/api/products` | HTTP 404; no business-data endpoint exposed |
| Import-boundary probes | Client alias, client relative and shared server imports rejected; server entrypoint accepted |
| Synthetic build-secret check | Test DB/AI sentinel values absent from served HTML and all `.next/static` files |
| Browser viewport checks | 1440×900 and 390×844; document width equals viewport width, expected heading rendered; screenshots visually reviewed |
| Source assets | All 14 screen manifest checksums and original logo checksum unchanged |
| Git exclusion | `/ReorderLens_Docs/`, environment files, dependencies, generated types, builds and artifacts ignored; no documentation tracked |
| `pnpm audit --prod` | Passed: no known production-dependency vulnerabilities reported |
| `pnpm audit --audit-level=high` | Exit 0; one moderate development-only finding, detailed below |

Both local servers were stopped after verification. Browser QA used the installed
Edge headless browser after the normal browser helper could not start. The local,
ignored `artifacts/` folder contains the viewport check/results and
`p0-desktop.png` / `p0-mobile.png`; these are bootstrap screenshots, not P1 design
acceptance evidence. Original empty Git metadata was preserved there when Git was
reinitialized under the Windows user's ownership; no global Git trust was changed.

### Known limits and next gate

The full dependency audit reports development-only `minimatch@10.2.6` through
the TypeScript ESLint parser: [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249),
moderate denial-of-service risk when processing crafted globs. No unsupported
major-version override was applied. Recheck the upstream lint dependency chain
before release. ESLint 9.39.5 is retained for the peer ranges declared by the
current Next.js React/import/accessibility lint plugins; the registry marks this
ESLint line deprecated. Upgrade the compatible lint set together when supported.

Supabase auth/RLS, Storage authorization, product calculations, business APIs,
AI fallback execution and end-to-end workflows remain unimplemented and untested.
P0 does not establish production readiness. Current P1 evidence follows.

## P1 visual system

The preview follows the S05 layout structure using the canonical 226px sidebar,
69px top bar, approximately 30px desktop gutter, 8–12px radii, restrained teal,
Manrope and tabular numerals. Tablet/mobile navigation uses an accessible modal
sheet; Escape closes it and returns focus. A resize to desktop closes the sheet.
Controls retain 44px touch height below 768px. Reduced motion and a skip link are
supported. The inventory table scrolls inside its region on narrow screens;
the empty-state explanation stays outside that horizontal scroll area.

`View components` opens a local-only dialog demonstrating inputs, native select,
status styles, loading style, validation/error and success states. Nothing is
persisted. Data controls, workspace switching and Insight are explicitly disabled
with explanations; unavailable navigation entries have no active destination.
There is no notification bell, fake user profile, fabricated metric or sample
business record. Insight has no open drawer or provider integration in P1.

The Manrope Latin variable WOFF2 (weights 200–800) comes from
`@fontsource-variable/manrope@5.3.0`, with provenance in `src/app/fonts/README.md`
and the original OFL license at `public/fonts/Manrope-OFL.txt`. `next/font/local`
self-hosts it; builds and visitors do not contact an external font service.

New runtime dependencies are pinned: Radix dialog 1.3.1, slot 1.5.0, tooltip
1.4.1; CVA 0.7.1; clsx 2.1.1; tailwind-merge 3.7.0; Lucide React 1.71.0.
Testing adds React Testing Library 16.3.3, user-event 14.6.9, jest-dom 7.0.1,
jsdom 31.0.0 and axe-core 4.14.0. No additional application framework, chart/grid
library, database client or AI SDK was installed.

### P1 verification — 2026-11-10

**Implemented, locally verified and subsequently accepted by the owner.**

| Check | Actual result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Passed with pinned UI/test dependencies |
| `pnpm check` | Passed: lint, route type generation/typecheck, component/unit tests and production build |
| Final `pnpm test` | 27/27 tests in three files, including the added ARIA-label regression |
| Final `pnpm typecheck` and `pnpm lint` | Passed after the regression test was added |
| Development smoke check | `pnpm dev` ready; `/` returns 200 with the expected visual preview |
| Production HTTP checks | `/` is 200; `/app/inventory` and `/api/products` are 404 |
| Browser layout checks | 1440×900, native S05 1487×1058, 1024×900, 390×844 and 320×740; no page-level horizontal overflow |
| Geometry/font | 226px desktop sidebar, 69px top bar; self-hosted Manrope loaded; original logo decoded/rendered |
| Keyboard behavior | Modal focus trapping, Escape closure/focus restoration, skip link and freshness tooltip passed |
| Responsive behavior | Mobile navigation starts closed and closes when resized to desktop; reduced-motion CSS verified |
| Accessibility | axe-core found no automated WCAG 2/2.1 A/AA violations in the five page viewports, mobile navigation, component error and component success states |
| Asset preservation | All 14 reference-image hashes unchanged; runtime logo is byte-identical to supplied source |
| Browser/server boundary | No server credential configuration names in production browser assets; existing 19 environment safety tests still pass |
| Dependency audit | Production audit reports no known vulnerabilities; full audit retains the existing one moderate development-only lint dependency finding |

Screenshots and the browser QA results are local, ignored artifacts:
`artifacts/p1-desktop.png`, `p1-s05-native.png`, `p1-narrow.png`, `p1-mobile.png`,
`p1-mobile-full.png`, `p1-small-mobile.png`, `p1-mobile-navigation.png`,
`p1-component-error.png`, `p1-components.png` and `p1-browser-results.json`.
Automated accessibility checks do not establish complete accessibility or user
acceptance. Screen candidates have not been marked approved.

Intentional differences from S05: canonical 226px/69px geometry, Manrope instead
of the reference fallback font, the supplied original logo, no notification bell
or fictional profile, an explicit preview notice, unavailable totals instead of
invented metrics, and an empty table instead of product fixtures. These preserve
the visual structure without implying a connected workflow.

The owner subsequently accepted P1 and authorized P2. No commit, push or
deployment was performed by the P1 task.

## P2 completed by owner acceptance — 2026-11-10

- Three migrations define the 16 application tables, least-privilege grants/RLS,
  atomic owner workspace creation/settings, own-profile updates and private
  import Storage policies. Workspace creation is limited to five/hour and ten
  total per user. Future business-write procedures are deliberately absent.
- Server-side Supabase SSR uses HTTP-only cookies, verified identity and workspace
  membership. Mutations enforce same-origin requests, strict bounded JSON input,
  safe errors and private no-store responses. No service-role key is used.
- Login/signup, confirmation callback/resend, password recovery, logout,
  workspace setup/selection and owner settings are implemented. Sample setup is
  visibly unavailable until P3; no fabricated business records are shown.
- Runtime additions: Supabase JS 2.119.0 and SSR 0.12.7. PGlite 0.5.16 is a
  development-only PostgreSQL test engine, never the application's backend.
- Latest local test run: **93/93 tests across seven files passed**, including
  40 PostgreSQL/RLS checks under non-bypass roles. The full `corepack.cmd pnpm check`
  passed: lint, typecheck, tests and production build.
  These checks use a minimal test Auth/Storage schema and do not prove hosted
  GoTrue, email delivery or Storage service integration.
- The configured hosted Auth settings endpoint responds successfully with email
  sign-in enabled; anonymous organization access returns permission denied.
  This does not prove the entire hosted schema or authenticated flows.
- Owner-reported hosted smoke test (2026-11-10): test-account registration,
  confirmation in the same browser, workspace creation, Settings and sign-out
  all worked. This is owner verification, not an automated browser test.
- Still pending: complete hosted migration verification; real two-account tenant
  isolation, password recovery and protected-route checks; P2
  responsive visual QA. Database TypeScript contracts currently cover only P2
  queries and must be reconciled with generated hosted schema types.

The original specification package, local credentials and test artifacts remain
ignored. No P3 implementation, public deployment, commit or push was performed.

The owner explicitly requested “Mark P2 completed & start P3” after the outstanding
checks were disclosed. P2 completion records that acceptance; the unexecuted checks
above remain unverified and must be closed before a production release. P3 is now
authorized; its implementation and verification record follows. P4 and later
remain outside the current scope.

## P3 import and sample workflow — 2026-11-10

`/app/data` supports four required UTF-8 CSV types, reviewed column mappings,
row/field validation, up to 20 preview records, insert/update counts and explicit
confirmation. Files are limited to 2 MiB each and 5,000 combined data rows.
The browser prepares a checksum/header manifest, then transfers each file in a
separate bounded request so a four-file batch fits Vercel's per-request limit.
The server verifies filenames, MIME, bytes, encoding, checksums and headers; it
re-reads original private objects for validation and again for confirmation.

The confirmed catalog/stock/sales write is one guarded SQL transaction. Replays
return the original result; a validation token rejects a preview replaced in
another session. Updates require explicit approval. Saved import reports can be
reopened. Source objects have no user overwrite/delete policy; only the four
declared filenames can be uploaded. There is no raw-file public URL.

Existing workspaces use the **P3-only upgrade**, not the P2 bootstrap:

```powershell
corepack.cmd pnpm db:bundle p3
```

Apply the resulting `artifacts/p3-upgrade.sql` once in the isolated development
project's SQL Editor. The owner reported successful application. See
[P3 setup and checks](supabase/P3_SETUP.md). No P2 migration was rewritten.

`Explore sample workspace` creates one isolated, idempotently seeded fictional
Northgate Market workspace per account. It contains the documented 3 suppliers,
8 products, 8 stock snapshots and 9 sales-history records. Sample labels remain
visible across protected pages; business CSV imports are blocked. No forecasts,
plans or POs are invented. Ordinary workspace creation now leads to Import Data.

Verification record:

- Final `corepack.cmd pnpm check` passed: zero-warning lint, strict typecheck,
  **156/156 tests in 12 files**, and production build (including per-file routes).
  The permission suites include 59 PostgreSQL checks across P2/P3.
- Owner reported the hosted upgrade and first 28-row import successful.
- Owner also reported repeat import with updates and isolated sample workspace
  checks successful. These are owner-run checks, not automated hosted results.
- Local SQL tests exercise all migrations under non-bypass roles: atomic commit,
  rollback, idempotence, stale validation tokens, update confirmation, per-workspace
  rate limits, tenant/role/job ownership, frozen originals and sample isolation.
- React interaction tests cover reviewed mapping, invalid rows, required explicit
  approval, safe retry, bounded per-file transfer orchestration and read-only
  reports. Source-verification tests re-read files and reject changed bytes.
- Isolated static renders of actual UI components passed layout and automated
  axe WCAG A/AA checks at 1440, 1024, 390 and 320px across five import states.
  Screenshots were visually inspected; the fixture document encoding was fixed
  and the browser checks rerun successfully. This is component visual QA, not
  an authenticated browser end-to-end test.
- Production smoke: unauthenticated `/app/data` redirects to login; an import
  object API returns 401, both no-store; the CSV template returns 200.
- Production dependency audit reports no known vulnerabilities. Documentation,
  environment files, test datasets and artifacts remain ignored as intended.
- All 14 supplied screen-reference hashes and the original/runtime logo hash are
  unchanged. Browser assets contain no secret-key configuration names or secret
  key prefix. The agent's port-3100 verification server was stopped; the owner's
  port-3000 development server was left alone.

P2's accepted verification gaps remain release follow-ups. Automatic hosted
two-account API/Storage tests and load testing at the maximum input size have not
been performed. Original-file retention/deletion still needs a launch decision.
No commit, push, deployment or P4 implementation was performed.

## P4 inventory and risk — 2026-11-11

The owner explicitly authorized P4 after the P3 hosted checks. Overview, Inventory
and Product Details now use authenticated Supabase reads. Inventory supports
literal name/SKU search, supplier/status filters, five validated sort orders,
stable cursor pagination, current stock dates, demand provenance and stale-input
warnings. Import confirmation now links directly to Inventory. Links and filters
preserve their URL state; product section links respect the sticky header. Unknown data is separate
from healthy/zero demand; disabled planning/Insight actions remain explained.

The read view and procedures use **security invoker** permissions and underlying
tenant RLS, plus internal membership checks. Monetary inputs remain decimal
strings; domain ratios use scaled BigInt arithmetic and display half-up from
unrounded inputs. SQL/domain risk parity is tested. Cursors are scoped to the
workspace, query and source revision; source changes require a fresh first page.

Real workspaces receive no hardcoded demand. Until P5 creates sufficient forecasts,
their imported stock appears with Insufficient data for demand/risk. Sample
workspaces alone receive the eight documented illustrative daily rates, labeled
`sample_fixture`; Oil shows 38 on hand, 7/day, 5.4 days cover, 6-day lead and a
0.6-day gap. No history, curve, uncertainty, plan, PO or model performance is
invented. Product history renders recorded dates and availability; missing days
stay missing. Actual saved forecast points are shown only when present.

Existing projects need only the **P4 upgrade**:

```powershell
corepack.cmd pnpm db:bundle p4
```

Apply `artifacts/p4-upgrade.sql` once in the isolated Supabase SQL Editor; do not
rerun P2/P3. [Setup and live checks](supabase/P4_SETUP.md) describe the exact steps.
`supabase/verify-p4.sql` provides a read-only structural check. Old migrations and
the original design references were preserved. No new dependency was needed.

Verified locally: final `corepack.cmd pnpm check` passes lint, strict types,
**198/198 tests in 16 files** and production build. This includes 77 PostgreSQL
permission/read-model cases across P2–P4, 18 specifically for inventory. Tests
cover exact thresholds, sample/real separation, latest eligible snapshots/runs,
staleness, literal filters, all sort orders, pagination, tenant/role restrictions,
decimal strings, safe API errors, saved budget prices, tables and chart semantics.

Isolated component browser QA uses actual migrated local PostgreSQL sample
records, not a mock inventory backend: six states across 1440/1487/1024/390/320px
passed overflow and automated WCAG A/AA checks. Images were reviewed against
S04/S05/S06. This remains static component QA, not hosted authenticated browser
automation. Native S05 size is retained. Intentional differences include real
unknown/budget states, labeled illustrative rates, meaningful section links,
sparse recorded history, and visibly unavailable later-phase actions.

The owner reported successful P4 upgrade application and that all requested
authenticated sample/real-workspace checks passed on 2026-11-11. Supplied TWH
screenshots confirm eight loaded products/stock snapshots, unavailable demand,
eight unclassified products and no matches for the At risk filter, as expected
without a saved forecast. Sample counts, Oil evidence and filter-preserving return
navigation were owner-reported checks, not inferred from these real-mode images.
P4 functional verification is complete. All three hosted P4 read procedures
reject anonymous execution (401/42501). Previously accepted P2 release follow-ups, maximum-size
hosted performance and source-retention decisions remain unresolved. No P5,
deployment, commit or push is authorized or performed by P4.

Production smoke checks confirmed unauthenticated Inventory/Product Details
redirect to login, and all three inventory read APIs reject anonymous requests
with 401 and private no-store headers. Production dependency audit is clean.
All original reference-image hashes and logo bytes are preserved; the runtime
browser assets contain no secret credential names/prefixes. The agent's port-3100
production test server was stopped; the owner's development server was not stopped.

## P5 baseline forecasting — 2026-11-11

The owner authorized P5. `/app/forecasts` generates and reviews immutable
`seasonal_baseline_v1` runs for 7/14/28 days, with selected-product history,
projected points, exact tables, quality reasons and provenance. Owners/operators
can generate; viewers read; sample rates remain read-only and illustrative.
Inventory consumes the latest completed run, including honest unknown demand
when a newer result is insufficient. P6 planning and external AI remain gated.

Two additive migrations (00800/00900) add source/algorithm identity, immutable
source/catalog snapshots, guarded atomic generation and invoker read procedures.
Direct forecast writes remain denied. Generation shares the import lock, reuses
successful identical inputs and limits new runs to ten/hour/workspace. A caught
failure preserves only safe status, rolling back all partial estimates. No new
dependencies, environment variables, services or service-role access were added.

The baseline uses the preceding 28 days, at least 14 eligible records and a recent
eligible observation. Explicit stockouts are excluded, unknown availability is
uncorrected, and promotions/lost sales are not modeled. Weekday means require two
matches, otherwise the overall mean is used. Exact rational predictions produce
D7 before rounding; the existing numeric(14,4) storage precision is disclosed.
No fabricated interval, accuracy percentage, missing-as-zero input or sample
curve is shown. Real-data MAE/WAPE/held-out comparison remains a release follow-up.

Generate an upgrade for an existing P4 development project:

```powershell
corepack.cmd pnpm db:bundle p5
```

Apply the complete `artifacts/p5-upgrade.sql` once, **not older bundles**.
[P5 setup and verification](supabase/P5_SETUP.md) describes recovery, API paging
and the distinction between run completion and sufficient evidence. The owner
reported successful hosted application on 2026-11-11; all three new hosted RPCs
reject anonymous execution (401/42501). Owner screenshots show a saved TWH run
with eight insufficient products; Rice has four eligible/seven recorded days,
three excluded stockout days and no invented future series. This is the correct
small-dataset result, not a generation failure.

Screenshots also exposed a stale saved-run selector after client navigation.
The selector now resets to the loaded run; its horizon/cutoff are explicit beside
the ID. A component navigation regression covers the mismatch. The owner reported
all final checks passed: selector synchronization, 7/14/28-day runs, identical-input
run reuse and eight read-only sample rates. P5 functional verification is complete;
this is owner-run hosted evidence, not automated hosted E2E.

Local verification includes full lint/types/tests/build, exact TypeScript/SQL
parity, chronological gates, fractional pre-rounding, immutable provenance,
atomic failure rollback, tenant/viewer/anon rules, retry limits, stable pages,
inventory integration and form/error states. Nine isolated component states at
five widths passed 45 overflow/axe checks; phone controls now stack readably.
The isolated 500-product/28-day load check saved 500 results / 14,000 points in
7,765ms on PGlite; this is not hosted/Vercel latency evidence. Production route
auth/no-store checks, production audit, original asset hashes and browser
credential-marker scan pass. Final `corepack.cmd pnpm check` exits 0 with
**253/253 tests in 20 files**, zero-warning lint, strict types and production build;
97 PostgreSQL cases span P2-P5, including 20 new forecasting cases.

Inherited P2 hosted isolation/recovery/generated-types gaps, hosted maximum-size
performance and source retention remain release gates. No deployment, commit or
push was performed. P6 requires explicit authorization.
