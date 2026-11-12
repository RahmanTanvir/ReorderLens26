# Competition submission audit —2026-11-12

Scope: code correctness, safe cleanup, security and GitHub review readiness for
the International AI Builders Congress2026. No commit, push, deployment,
production reconfiguration, schema change or external inference is authorized.
This supersedes the interrupted production-readiness preparation as the active
task. Existing production limits remain unverified; this is not launch approval.

## Inspection and findings

- Reviewed the complete Git-visible inventory and import graph:149 source files
  (146 code modules),18 page modules,23 business API handlers,13 migrations,
  configuration, scripts, tests and assets.
- No exact duplicate source/asset files or unreferenced non-entry source modules
  were found by the static scan. TypeScript's unused-local/parameter check passed.
  This does not prove every export is necessary or replace runtime testing.
- All declared application dependencies are used directly or required as peers.
  In particular, supabase-js is a peer of the SSR adapter and react-dom is a peer
  of Next/React rendering; neither was removed merely for lacking direct imports.
- Real business routes read authorized Supabase data. Fixed rates/quantities are
  confined to the intentional labeled sample path and fictional tests. Input
  placeholders, skeletons and disabled actions with reasons are legitimate UI.
- The visual/component preview is an intentional non-persistent reference, not
  an abandoned dashboard. It remains available separately and is documented.
- Two bounded operational logs remain: generic500 request ID/code and sanitized
  Insight outcome metrics. No client debug logging or raw credential/CSV/prompt
  logging was found. No TODO/FIXME/debugger cleanup was necessary.
- README was655 lines of milestones with stale phase/authorization claims and
  no concise judge entry point. Historical records are useful but belong outside
  the main setup document.

## Safe changes

- Rewrote README for product features, private judge access, actual live URL,
  architecture, setup, variables, run/check commands and truthful limitations.
- Preserved prior milestone records in DEVELOPMENT_HISTORY.md and adjusted their
  relative links for the new location. Historical statements remain historical.
- Added AI_AND_DATA_PROVENANCE.md: deterministic runtime, disabled/unqualified
  model adapter, fictional sample/test data, coding assistance and asset origins.
- Removed the developer visual-preview footer link from customer authentication
  frames. The preview route, components and useful tests remain intact.
- Clarified .env.example's non-overwriting setup, correct publishable-key naming,
  and that no privileged Supabase key is needed by current workflows. Values stay
  blank/default-only. Existing .env.local was not changed.
- Preserved all migrations, sample functionality, regression fixtures, branding,
  font license and existing local work. No application file or user artifact was
  deleted merely because its name included test/sample/demo.

## Security review

Redacted final static scan:264 Git-visible files; six
reachable Git commits and357 unique history blobs. No high-confidence API/JWT/
private-key credential findings, no committed private .env files and no currently
tracked ignored files were found. Results never print matched values. Scanning
is heuristic; it is not exhaustive secret detection or a remote GitHub audit.

Prior local key exposure and owner-reported rotation are preserved in historical
records. No credential in reachable history was detected by this review, and no
history rewrite was attempted. Supabase identity/membership/RLS, same-origin
mutations, private cache policy, server-only services, input validation and
OpenRouter privacy/free-model gates were reviewed and retained.

The dependency audit has no production advisories. One inherited moderate
development-only minimatch advisory remains through TypeScript ESLint tooling
(GHSA-g3hv-75wg-m249). Its fix requires another major version; no unsupported
override or unrelated upgrade was introduced.

## Verification

| Command / check | Actual outcome |
|---|---|
| corepack.cmd pnpm check | PASS: zero-warning ESLint, generated route/TypeScript checks,517 tests in41 passing files, one opt-in capacity test skipped, production build |
| corepack.cmd pnpm exec tsc --noEmit --noUnusedLocals --noUnusedParameters | PASS: no unused-local/parameter diagnostics |
| corepack.cmd pnpm release:preflight | PASS:264 Git-visible paths,39 browser artifacts, exact logo, disabled local inference; no credential findings |
| corepack.cmd pnpm audit --prod --json | PASS: zero production advisories |
| corepack.cmd pnpm audit --json | Exit1: one inherited moderate development-only minimatch advisory; no high/critical findings |
| node artifacts/final-code-audit.mjs | PASS: full inventory/import traversal; six commits/357 history blobs scanned with redacted output, no high-confidence credential findings or unreferenced source candidates |
| node artifacts/check-submission-links.mjs | PASS:16 relative Markdown links and50 literal application links; no missing targets |
| node scripts/release-smoke.mjs https://reorderlens26.vercel.app | PASS:52 anonymous deployed HTTP checks; no account/business mutation or email |
| node artifacts/final-browser-check.mjs | PASS: fresh local production build,52 HTTP checks and18 public browser route/width cases at1440/390/320 |
| git diff --check | PASS: no whitespace errors |

Browser QA includes actual hydration/password visibility, preview dialog/Escape,
root overflow, axe WCAG A/AA rules and application CSP observation before test
instrumentation. No violations were observed in that scope. Inspected final
login390 and preview1440 screenshots. The owned temporary server and hidden
browser were stopped; the owner's existing session was not stopped or modified.
This is not a complete accessibility audit or authenticated hosted browser E2E.

The single skipped test is the explicit capacity measurement from the preceding
readiness work. Its separate local run passed and wrote a synthetic500-product/
5,000-import-row measurement; it is not silently counted in the517 test total.
No performance or hosted capacity guarantee follows from it.

Audit helper scripts/results/screenshots are local ignored artifacts, not new
runtime dependencies or shipped application features. Historical check records
are preserved separately and are not relabeled as new hosted tests.

## Remaining limits

- Private judge access will be supplied by the owner outside this repository.
  New arbitrary-email signup/delivery was not tested by the agent.
- Authenticated business/recovery/two-account/private-CSV checks are owner-reported.
  The agent has no signed-in hosted browser session for independently repeating
  them. Public browser/HTTP checks and local PostgreSQL checks have narrower scope.
- External AI is disabled; model qualification is deferred. No paid model route
  or customer-data transmission was tested or enabled for this audit.
- Hosted-generated schema types, hosted Storage write probes, hosted load,
  backups/restore and operating ownership remain unverified. Local capacity
  measurements are not production throughput or forecast accuracy evidence.
- Private specifications/design references, local credentials and ignored test
  artifacts remain excluded from Git. They were preserved locally, not deleted.

Source-submission readiness and production readiness are separate conclusions.

## Final Git inventory and disposition

Ready for owner review and GitHub source submission with the limitations above.
No blocking source/type/build/credential-scan issue was found. The deployed demo
is reachable; its newest local authentication-footer cleanup has not been deployed
by the agent. The owner will provide confirmed judge access privately.

The working tree has four modified files and eight untracked files (including
pre-existing uncommitted P9 helpers). No file is staged, committed or pushed by
this audit:

```text
 M .env.example
 M README.md
 M docs/RELEASE_CHECKLIST.md
 M src/components/auth/auth-frame.tsx
?? docs/AI_AND_DATA_PROVENANCE.md
?? docs/DEVELOPMENT_HISTORY.md
?? docs/HOSTED_DATABASE_TYPES.md
?? docs/HOSTED_ISOLATION_CHECK.md
?? docs/SUBMISSION_AUDIT.md
?? scripts/verify-hosted-isolation.ts
?? tests/security/capacity.test.ts
?? tests/unit/hosted-isolation.test.ts
```

Required owner actions before submission: review the intended diff/new files,
commit/push explicitly, and provide the confirmed judge account privately via
the submission channel. Do not publish credentials or force-add the ignored
specification package. No database cleanup, fixture/account deletion, paid-service
upgrade, model enablement or history rewrite is required by this source audit.

## Subsequent repository cleanup

The owner subsequently requested removal of confirmed disposable local outputs.
See [REPOSITORY_CLEANUP.md](REPOSITORY_CLEANUP.md) for the removal inventory,
preserved folders and fresh post-cleanup verification. The earlier preservation
statements and Git inventory above describe the preceding audit, before cleanup.
