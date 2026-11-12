# P9 release readiness

Owner authorized P9 on2026-11-12. P8 is complete by owner acceptance with
deterministic-only Insight; model qualification is deferred. Keep
`AI_ASSISTANT_ENABLED=false` and `OPENROUTER_SAMPLE_EVALUATION=false`. No paid
routing, customer inference, agent deployment, commit/push or spending is authorized.
Owner reports successful Vercel deployment on2026-11-12; the agent did not deploy.

Competition submission audit2026-11-12: current source cleanup/check results are
in docs/SUBMISSION_AUDIT.md. Owner redirected the interrupted production-readiness
work to repository review. Existing functional evidence remains scoped; unverified
production gates have not been passed by that review. Judge access will be
provided privately by the owner; no account credentials belong in Git.

Current disposition2026-11-12: P9 core work is delivered with owner-deferred
release checks. Owner explicitly skipped hosted schema type export, hosted
Storage write checks, load testing and operational release checks. Keep their
guides and limitations for later; do not request these again unless resumed.
Deferred checks are unverified. This disposition is not a production-readiness
claim or authorization for agent deployment, commit/push, spending or inference.

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

- Hosted builds accept the exact documented `NEXT_PUBLIC_VERCEL_*` metadata names
  that Vercel injects automatically. These do not enter application configuration
  or replace `NEXT_PUBLIC_APP_URL`. Unknown public settings (including secret-key
  names) still fail, with names-only diagnostics. CI simulates deployment metadata.
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

Vercel configuration follow-up2026-11-12: reproduced the metadata rejection;
40 configuration tests pass after the fix, including18 platform metadata cases
and unknown/public-secret rejection. Lint, typecheck and production build pass
with all18 documented Vercel public metadata variables injected. This is local
simulation. Owner subsequently published/redeployed; see hosted results below.

## Verified deployed anonymous result —2026-11-12

Owner reports successful deployment at https://reorderlens26.vercel.app after
the public Supabase variable mismatch was identified in runtime logs
(`NEXT_PUBLIC_SUPABASE_ANON_KEY` is unsupported; this app uses the publishable-key
setting). Remote credential values were not inspected or logged.

`node scripts/release-smoke.mjs https://reorderlens26.vercel.app` passes52 checks:
public pages200 with matching script nonce/strict CSP and no-store, protected
pages307 to same-origin sign-in, anonymous business API requests401, empty
cross-origin auth requests403, and safe unknown-page404. No account, email or
business-data mutation was performed. Results: ignored artifacts/p9-smoke.json.
Those HTTP checks alone do not prove browser hydration, signed-in business
workflows, actual target Supabase association, two-account isolation or remaining
operational gates. Additional evidence below has its own scope. No agent cloud
configuration, commit/push or deployment.

Owner separately reports all deployed sign-in, workspace access, protected-page
refresh and sign-out checks passed on2026-11-12. This is owner-reported functional
evidence for that scope; it does not close signup/email recovery on this origin,
business workflow rehearsal or two-account isolation.

Owner subsequently reports all six deployed fictional-QA business checks passed
on2026-11-12: CSV import/reimport without duplicates; saved forecasts reopening
after refresh; saved plan quantity edits persisting; supplier-delay analysis
preserving the saved plan; draft PO save/replay without duplicates plus CSV/print;
and grounded read-only Insight refusing "Place the order". This closes that
deployed core-workflow rehearsal, not all negative/concurrency/load cases or
two-account isolation. External inference remains disabled.

Agent-executed deployed public browser QA also passes18 route/width cases
(six public routes at1440,390,320) on2026-11-12. Password visibility controls and
preview dialog/Escape verify hydration; no root horizontal overflow, axe WCAG
A/AA findings or observed application CSP violations before instrumentation.
Inspected hosted login390 and preview1440 screenshots. These checks are not a
complete accessibility audit or authenticated browser E2E. Evidence: ignored
artifacts/p9-hosted-browser-results.json and p9-hosted-*.png. The temporary hidden
browser/profile is separate from the owner's session; the browser was stopped.

Owner reports all deployed password-recovery checks passed on2026-11-12:
recovery email returns to https://reorderlens26.vercel.app in the same browser,
new password saves and signs in, and the reused recovery link shows a safe
invalid/expired notice. No password, token or recovery URL was shared. This closes
deployed recovery within that reported scope; signup confirmation remains separate.

Owner subsequently reports successful second-account confirmation on the deployed
site in a separate browser profile on2026-11-12, with return to the Vercel origin.
Two confirmed accounts are now available; preparation does not prove isolation.

Owner reports all listed two-account checks passed on2026-11-12: separate
workspace pickers/memberships; cross-account product, forecast, plan, PO detail
and CSV links reveal/download no foreign data (both directions where records
exist); foreign product/run/plan/PO API requests return403/404 while own workspace
access works; signed-out reloads require login/API401. Record this as owner-reported
page/API/export isolation evidence. Private original CSV Storage access, import-job
and explicit foreign-workspace-header checks, sequential same-profile identity
mixing and stale-tab workspace targeting are separate checks still open.

Owner subsequently reports stale-tab quantity saves updated Workspace One while
Workspace Two stayed unchanged, and confirms the passing16-table/four-flag audit
was run against the same Supabase project connected to Vercel (2026-11-12).
This closes that target association by owner report and the tested stale-tab case.

Remaining private import read checks have an interactive verifier:
`node scripts/verify-hosted-isolation.ts`. See docs/HOSTED_ISOLATION_CHECK.md.
Credentials are entered locally with echo suppressed, used in memory only, and
never included in output. The tool authenticates test users and revokes only its
own sessions; it performs no business/object writes. Transport tests alone are
not hosted Storage evidence; owner-reported execution is recorded below.

Verifier local validation2026-11-12:17 mocked-transport tests pass, lint/typecheck/
production build pass, and credential preflight passes259 Git-visible paths and
39 browser artifacts. Syntax checked with Node24; hidden-input/cancel behavior
exercised in an actual terminal using fictional inputs and cancellation before
network authentication. No live password or session was obtained by the agent.

Owner reports the hosted verifier returned `passed: true` on2026-11-12. Record
private import-row and CSV read isolation in both directions, anonymous denial
and public-route denial as passed by owner report, including the verifier's own
CSV positive controls. The saved JSON was not available in this checkout for
agent inspection. This does not prove Storage write policies or other untested
session/header behavior; credentials and raw CSVs were never shared.

Owner reports remaining browser session/header checks passed on2026-11-12:
after signing out A and signing in B in the same profile, refresh showed only
B's data; B's read request with A's explicit X-Workspace-Id returned403 while
B's own workspace remained usable. Record this scoped identity/header gate PASS.

## Hosted evidence and open release gates

| Gate | Current evidence / required action |
|---|---|
| P2–P8 workflow | Owner-reported hosted functional checks passed; keep their documented scope |
| Deployed session flow | PASSED owner-reported sign-in, workspace access, protected-page refresh and sign-out on2026-11-12 at https://reorderlens26.vercel.app |
| Deployed core business flow | PASSED owner-reported six fictional-QA checks on2026-11-12: import/reimport, forecast reload, saved plan edits, read-only scenario, draft replay/exports and Insight grounding/refusal |
| Deployed public browser QA | PASSED18 route/width cases with hydration interaction, no overflow, axe A/AA findings or observed app CSP violations; limited to public pages |
| Password recovery | PASSED owner-reported deployed recovery redirect, new-password sign-in and safe reused-link handling at https://reorderlens26.vercel.app on2026-11-12; earlier local checks also passed |
| Full schema/privileges | PASSED owner-supplied hosted audit:16 protected tables,42 guarded functions, private2MiB bucket;18 policies reviewed; owner confirms audit covers the project connected to Vercel on2026-11-12 |
| Two-account isolation | Read/session/header scope PASSED by owner report: listed pages/record APIs/CSV exports, signed-out reload, stale-tab targeting, verifier reads, same-profile switching and foreign workspace header403; hosted write verification owner-deferred |
| Hosted Storage write checks | OWNER-DEFERRED2026-11-12: no hosted write-denial pass claimed; prior local policy tests and structural audit retain their limited scope |
| Private CSV read isolation | PASSED owner-reported hosted verifier `passed: true` on2026-11-12: distinct users, own-file controls, foreign import rows/CSV and anonymous/public-route denial; JSON not independently inspected |
| Hosted-generated DB types | OWNER-DEFERRED2026-11-12: skip hosted type export/reconciliation for now; retain the manually checked query contract; no generated-schema verification claimed |
| Deployed anonymous smoke | PASSED52 HTTP checks at https://reorderlens26.vercel.app on2026-11-12; owner deployed and confirms audited backend association; no general claim for untested signed-in edge cases |
| Deployed signup confirmation | PASSED owner-reported second-account email confirmation in a separate browser profile, returning to the Vercel site on2026-11-12 |
| Hosted load/concurrency | OWNER-DEFERRED2026-11-12: local PostgreSQL measurements and owner two-tab PO replay are not hosted load/stress proof |
| Retention/deletion/restore | OWNER-DEFERRED2026-11-12 under operational release checks: policy, backup/restore exercise and responsible owner remain unverified/unapproved |
| Plan/domain/cost/monitoring | OWNER-DEFERRED2026-11-12 under operational release checks: plan/budget, monitoring and operational ownership remain unverified; no spending authorized |
| External AI | ACCEPTED DEFERRED: disabled; three synthetic404 responses, no model qualified |
| Lint-tool advisory | One inherited moderate development-only minimatch advisory; compatible parser still uses affected major; no unsupported override |

Run the read-only `supabase/verify-release.sql` in the isolated development project.
It returns one `release_audit` JSON object so the SQL Editor cannot hide earlier
result sets. Summary should show `table_count=16` and true for `tables_protected`,
`functions_deny_anonymous`, `definer_search_paths_safe`, `private_import_bucket`.
Details contain metadata only. Policy definitions alone do not prove enabled RLS,
ACLs, private bucket settings or actual two-user behavior. Do not rerun old bundles.

For generated types, follow docs/HOSTED_DATABASE_TYPES.md. Export actual TypeScript
schema types from the connected Supabase project's dashboard into ignored
artifacts/p9-hosted-database.types.ts first. Reconcile with the checked query
contract before replacing anything. Dashboard export avoids installing a CLI or
sharing account tokens. CLI users should check their installed version's help:
v2 project-id and v3 remote targeting syntax differ. Never send access tokens/DB
passwords in chat or label manually assembled types as hosted-generated.

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
