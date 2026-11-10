# ReorderLens

Inventory intelligence and budget-aware replenishment planning, implemented in
reviewed phases. This repository currently contains only the P0 application
foundation. Authentication, inventory workflows, database schema and AI inference
are not implemented.

## Local setup

Use Node.js `24.18.0` (also recorded in `.node-version`) and pnpm `11.25.0`.
The package-manager version is pinned in `package.json`; do not mix lockfiles.
No global Corepack activation is required when pnpm is already available.

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

Open http://localhost:3000. The server binds to the local loopback interface.
No credentials or `.env.local` file are required for the bootstrap page.
To configure future integrations, copy `.env.example` to `.env.local` and keep
real values out of Git. Leave both public Supabase settings blank or configure
both together with a publishable key. Legacy anon-key configuration is not
supported by this bootstrap.

`AI_ASSISTANT_ENABLED` must remain `false` in P0. External inference cannot be
enabled until its P8 evaluation and privacy gates are implemented and reviewed.
The OpenRouter model variables are reserved for P8, not consumed by P0.

## Verification

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm start
```

Stop `pnpm dev` before `pnpm start`, since both use port 3000. `pnpm check`
runs lint, typecheck, configuration tests and production build in order.
Configuration tests cover absent/partial services, safe public projection,
misplaced secrets, URL validation and fail-closed external AI settings.
Typecheck generates Next.js route types first so it works on a fresh checkout;
the framework-managed `next-env.d.ts` is intentionally ignored.

## Project organization

- `src/app/`: root layout, minimal bootstrap page and Tailwind entrypoint.
- `src/lib/validation/`: pure, testable environment parsing with safe errors.
- `src/server/config/`: server-only environment access. Never pass this object
  to client components or serialize it into a response.
- `tests/unit/`: configuration safety tests.
- `ReorderLens_Docs/`: local technical specifications, phase tracker and original
  design assets. The owner explicitly requested exclusion from Git; fresh clones
  must receive this package separately. Original images remain untouched.

Later phases add shared components, domain calculations, authenticated services,
Supabase migrations and product routes as required. `/app/*` routes will live
under `src/app/app/*`. No business-data route exists during P0.

## Design and backend gates

P1 introduces Manrope, the complete Graphite token system, accessible primitives
and shell. The supplied transparent logo is
`ReorderLens_Docs/design-references/01-brand-identity/ReorderLens_logo.png`
(1312×1199; SHA-256
`34dc3a487cc24a6bc99c710fd1227ef45b5028f9c6b7d0c36219c92c2ea3cc85`).
Copy its exact bytes to runtime branding only during the branding milestone.
Do not recreate it, convert a screenshot, or mark candidate screens approved.

P2 requires local Supabase CLI + Docker or a separate hosted development project,
and two-user tenant-isolation tests before business-data APIs. Neither Docker nor
the Supabase CLI was found during inspection. No service credentials, accounts,
cloud projects or public deployment are needed for P0.

Resolve before the relevant later phase: missing pack-multiple plan snapshot,
creator-only building-plan visibility versus example RLS, S11 edit/review behavior,
assistant quota discrepancy (40 versus 50/org/day), and the stale `/api/inventory`
test example versus canonical `/api/products`.

## P0 status

**Implemented and locally verified — awaiting owner review (2026-11-10).**
P1 and later phases have not started. No commit, remote repository, migration,
service account, external inference call or deployment has been created.

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
P0 does not establish production readiness. Next action is owner review of P0,
then explicit authorization for P1 only.
