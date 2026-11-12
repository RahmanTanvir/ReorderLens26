# P9 release readiness

Owner authorized P9 on2026-11-12. P8 is complete by owner acceptance with
deterministic-only Insight; model qualification is deferred. Keep
`AI_ASSISTANT_ENABLED=false` and `OPENROUTER_SAMPLE_EVALUATION=false`. No paid
routing, customer inference, deployment, commit/push or spending is authorized.

## Local verification

From the application root, on Windows:

```powershell
corepack.cmd pnpm install --frozen-lockfile
corepack.cmd pnpm check
corepack.cmd pnpm release:preflight
corepack.cmd pnpm audit --prod
corepack.cmd pnpm start --port 3100
```

In another terminal, while that production server runs:

```powershell
corepack.cmd pnpm release:smoke
```

Stop only this test server afterward. Do not stop someone else's dev session.
For an already approved staging origin, `release:smoke https://STAGING_ORIGIN`
performs anonymous HTTP probes; it never creates accounts or business records.
Smoke is not a replacement for signed-in verification. No P9 migration is required.

CI in `.github/workflows/verify.yml` runs the frozen install, checks, preflight,
anonymous production smoke and production audit without cloud credentials.
Official checkout/setup-node actions are pinned to verified commits. It has
read-only repository permission, no deployment step and no production secrets.
The workflow has not run on GitHub until the owner commits/pushes it. A separate
Vercel Git integration may deploy automatically on push; verify its target
branch/environment before authorizing any push.

Preflight scans Git-visible source and public build artifacts for high-confidence
credentials, checks the blank service template, exact logo and disabled inference.
It reads configuration privately and reports locations/kinds, never secret values.
It is not a complete secret detector or a privacy/security certification.
`release:preflight --production` additionally rejects a non-HTTPS/loopback app
origin and missing Supabase public configuration; it does not authorize deployment.

## Changes requiring regression checks

- Business form requests and CSV exports bind to the rendered workspace. A
  different tab's cookie must not change the target of an import, forecast,
  saved plan edit or draft conversion. Server membership/RLS remains authoritative.
- Error Retry uses Next16.4's refetching `retry`, rather than only clearing cached
  error state. Root failures and unknown URLs have safe functional recovery UI.
- Per-response script nonces, strict dynamic script loading, same-origin browser
  connections, frame/form restrictions and private no-store protect HTML routes.
  Script unsafe-eval is development-only. Style attributes remain allowed for
  Radix positioning, SVG/chart sizing and budget bars. No external browser SDK.
- Radix scroll-lock styles receive the original document nonce through its existing
  `get-nonce@1.0.1` helper, now explicitly declared (no new transitive package).
- Browser Zod validation disables dynamic-code probing before shared schemas are
  constructed; server JIT stays enabled.
- Nonce rendering is dynamic, including `/preview`; private pages already were
  dynamic. Static branding/fonts/chunks retain their asset paths. No global
  `unsafe-inline` script allowance or arbitrary CSP bypass is used.
- Local workflow test runs the actual CSV parser and migrations through imported
  forecasts, plan edit, scenario, draft conversion/export and reimport. Auth and
  Storage are emulated; this is not hosted browser E2E or forecast accuracy proof.

## Verified local result —2026-11-12

Full check:479 tests/40 files, lint/types/build pass. Final anonymous HTTP smoke:
52 checks pass. Actual production public browser QA:18 route/width cases pass at
1440/390/320, with hydration/dialog interaction, axe/overflow and no observed
application CSP violations. Preflight:256 source paths and39 browser artifacts,
exact logo and inference-off guard pass. Original14 reference image hashes are
unchanged. Production audit clean; inherited moderate dev-only advisory retained.
CI syntax is checked locally but the GitHub workflow has not executed. Test
Auth/Storage facades and public browser checks do not replace hosted identity E2E.
Agent test server/browser were stopped; owner's dev session was untouched.

## Hosted evidence and open release gates

| Gate | Current evidence / required action |
|---|---|
| P2–P8 workflow | Owner-reported hosted functional checks passed; keep their documented scope |
| Password recovery | Owner reports new password sign-in and reused-link handling passed on2026-11-12 |
| Full schema/privileges | PASSED owner-supplied hosted audit:16 protected tables,42 guarded functions, private2MiB bucket;18 policies reviewed; associate/repeat against the exact staging target once confirmed |
| Two-account isolation | OPEN: only one confirmed test account is available |
| Hosted-generated DB types | OPEN: current `database.types.ts` is a checked query contract, not generated schema |
| Deployed staging smoke | OPEN: no staging deployment authorized or performed |
| Hosted load/concurrency | OPEN: local PostgreSQL measurements and owner two-tab PO replay are not load/stress proof |
| Retention/deletion/restore | OPEN: policy, backup/restore exercise and responsible owner not approved |
| Plan/domain/cost/monitoring | OPEN: Vercel/Supabase plan, production domain, budget and operational ownership need review |
| External AI | ACCEPTED DEFERRED: disabled; three synthetic404 responses, no model qualified |
| Lint-tool advisory | One inherited moderate development-only minimatch advisory; compatible parser still uses affected major; no unsupported override |

Run the read-only `supabase/verify-release.sql` in the isolated development project.
It returns one `release_audit` JSON object so the SQL Editor cannot hide earlier
result sets. Summary should show `table_count=16` and true for `tables_protected`,
`functions_deny_anonymous`, `definer_search_paths_safe`, `private_import_bucket`.
Details contain metadata only. Policy definitions alone do not prove enabled RLS,
ACLs, private bucket settings or actual two-user behavior. Do not rerun old bundles.

For generated types, use an authenticated Supabase CLI in your own environment:
`supabase gen types typescript --project-id PROJECT_REF --schema public`.
Save to an ignored comparison file first and reconcile against the checked query
contract before replacing anything. Never send access tokens/DB passwords in chat.
Do not label manually assembled types as hosted-generated.

## Hosted two-account procedure

Register a second email you control with confirmation enabled in a separate browser
profile; open its confirmation link in that same profile. No admin/service key or
membership-policy change is needed. Use synthetic development data only.

1. A owns workspace A and B owns a separate workspace B, with no shared membership.
2. Both can load only their own workspace/catalog. Copy A product, import job,
   forecast, plan and PO URLs into B's profile; no A details or download may appear.
   B's API attempts using A's workspace header/IDs must return safe403/404, no data.
3. Test private original CSV object access across users; anonymous/cross-org read
   and writes must fail. Confirm the bucket is private; do not create public URLs.
4. Sign out and reload protected URLs: login redirect/API401, no cached data. Test
   two identities sequentially in the same profile for cache/session mixing.
5. In one account, open two owned workspaces in two tabs. Change the shared selected
   workspace in B, then submit A's form. The request must still target displayed A;
   it must never write into B silently. Membership/roles must still be rechecked.
6. Keep actual failure code/action/date as evidence. Never paste session cookies,
   Authorization headers, passwords, signed Storage URLs or recovery links.

## Signed-in staging rehearsal after explicit deployment approval

Use an isolated staging Supabase project and reviewed migrations. Use exact HTTPS
site/callback origins for staging; do not share production secrets or a broad
production redirect wildcard. Set `NEXT_PUBLIC_APP_URL` to that origin so Secure
cookies and recovery callbacks match. Keep email confirmation enabled.

Rehearse signup/confirmation/setup, invalid and valid CSV mapping/commit/reimport,
Inventory filter/detail/back,7/14/28 forecasts and repeat-ID reuse, plan edits,
stale revision409, over-budget conversion block, supplier+3/reset with unchanged
saved plan, explicit review/save/replay of supplier drafts, CSV/Print-PDF, Insight
context/refusal/cancel, Settings, recovery and sign-out. Check errors/offline/empty
states, keyboard/mobile layouts, private no-store and absence of CSP violations.
Do not weaken CSP/confirmation/RLS merely to make a test appear to pass.

Review actual Vercel function duration/body limits and measured maximum-size
imports/500-product computations before selecting a plan. Timeout is not proof a
transaction failed: reload the persisted job/run/plan/draft before retrying.

## Operations and approval boundary

Keep secrets in target-specific encrypted server configuration; public publishable
keys are not service keys. Rotate compromised keys and verify templates/history
contain no credentials. Application logs expose request IDs/codes and bounded
assistant metrics, never prompts/raw CSV/email/tokens. Use request IDs/digests to
investigate errors, with restricted log access and an agreed retention policy.

Before real customer data: name operational/support owners, approve raw-import
and usage-metadata retention/deletion/export handling, configure backups, rehearse
restore in a disposable environment, review email delivery/rate limits and budget
alerts. No automatic deletion, new paid service, email dispatch or monitoring
subscription has been introduced. A proposed retention duration is not policy.

Rollback application code to a reviewed compatible build. Preserve saved drafts
and migrations. A code rollback does not reverse schema/data changes; use a reviewed
roll-forward or tested restore plan. Never reset a shared database or restore over
customer data without explicit authorization and a verified backup.

Once gates are evidenced or explicitly accepted, present the exact Vercel project,
target origin, isolated Supabase project, configuration, costs and remaining limits
for owner deployment approval. P9 authorization alone does not perform a release.

Official references checked2026-11-12: [Vercel duration](https://vercel.com/docs/functions/configuring-functions/duration),
[Supabase password flows](https://supabase.com/docs/guides/auth/passwords),
[checkout v7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1),
[setup-node v7.1.0](https://github.com/actions/setup-node/releases/tag/v7.1.0).
Next nonce/retry/connection behavior was checked in this installed version's
`node_modules/next/dist/docs/`, rather than assuming older APIs.
