# Repository cleanup — 2026-11-12

Scope: remove confirmed disposable local artifacts before GitHub submission.
No application logic, dependency, migration, security policy or production asset
was changed. No staging, commit, push, deployment or Git history operation occurred.

## Removed

393 top-level targets containing 11,167 files, totaling approximately 644.51 MiB,
were removed from the ignored `artifacts/` directory:

| Targets | Files | Reason |
|---|---:|---|
| 37 `edge-*` directories | 10,767 | Inactive isolated QA browser profiles and caches; no Edge process was running |
| `font-source/` | 18 | Downloaded package/tarball cache; the runtime WOFF2 hash matches and the font license/provenance remain |
| `p8-ui-build/` | 7 | Compiled isolated component test harness |
| `p8-ui-src/` | 9 | Generated harness entrypoints/stubs; retained `build-p8-ui.mjs` recreates them |
| `ReorderLens_P6_Import_Test_Data_2026-11-11/` | 14 | Extracted duplicate; all 14 file hashes matched the retained canonical pack |
| Earlier phase screenshots | 303 | Superseded QA captures; final audit and hosted P9 screenshots remain |
| `p7-draft-print.pdf`, `p7-long-draft-print.pdf` | 2 | Generated print-check output |
| Earlier intermediate JSON reports | 31 | Superseded check results; final evidence and the provider evaluation record remain |
| Earlier check/build logs | 9 | Regenerable logs; final audit logs remain |
| `p2-bootstrap.sql`, `p3-upgrade.sql` through `p8-upgrade.sql` | 7 | Generated bundles; the 13 original migrations and bundler remain |

The exact top-level removal manifest, including individual screenshot/report/log
filenames and per-directory file/byte counts, is retained locally at
`artifacts/repository-cleanup-manifest.json`. Browser cache descendants are
represented by their enclosing removed profile directory. No removal target
remains. Windows-protected cache files were removed only after checking that the
targets resolved inside this workspace's `artifacts/` directory; no junctions or
symbolic links were followed.

Regenerate a SQL bundle with `corepack.cmd pnpm db:bundle p2` (or `p3` through
`p8`). This only writes the local bundle; it does not apply database changes.
The setup guides document when each bundle may be applied. Never rerun an
already-applied bootstrap/upgrade just because a local output was deleted.

## Preserved

| Folder / files | Purpose |
|---|---|
| `src/`, `public/` | Working application, approved logo, self-hosted Manrope, license and CSV templates |
| `tests/` | All regression/security/component tests, SQL test platform and fictional workflow fixtures, including the opt-in capacity test |
| `supabase/` | All 13 immutable migrations, RLS/security functions, verification SQL and setup guides |
| `scripts/`, `.github/`, root configuration and lockfile | Repeatable installation, CI, migration bundling and release/isolation checks |
| `docs/`, `README.md`, `AGENTS.md` | Current guidance, provenance, verification evidence and historical decisions |
| `ReorderLens_Docs/` | Owner's local specification/design package; intentionally ignored |
| `.env.local` | Existing private local configuration; unchanged and ignored |
| `artifacts/p3-test-files/`, `p6-import-test-data/`, QA ZIP and builder | Owner-facing import datasets, update/invalid variants and reusable helpers |
| Final audit helpers/results/screenshots, P9 hosted evidence, capacity result | Useful local verification evidence; ignored |
| `p8-provider-eval-db/`, `p8-live-evaluation.json` | Persistent synthetic evaluation quota journal and original failure evidence; no new provider calls |
| `empty-git-initialization/` | Existing local safety backup; uncertain purpose is insufficient reason to delete it |
| `node_modules/`, `.next/` | Installed tooling and current build output; already ignored |

Before documentation/ignore-comment edits, hashes confirmed all 264 Git-visible
files plus `.env.local` were unchanged by deletion. A fresh import/duplicate scan
covered 146 source modules: no exact duplicate source/assets or unreferenced
source-module candidates. No source/test/asset deletion was justified.

## Git handling

`artifacts/`, dependencies, build output, coverage, local environment files,
Supabase temporary state and private specifications were already ignored.
Clarified the existing artifact rule; no broader ignore rules were necessary.
No already-tracked ignored files were found, so no Git index cleanup was needed.

## Post-cleanup verification

| Check | Result |
|---|---|
| `corepack.cmd pnpm check` | PASS: lint with zero warnings, route generation/TypeScript, 517 tests in 41 passing files, production build |
| Default test exclusions | One opt-in capacity benchmark skipped; retained and not counted as a passing test |
| `node scripts/bundle-migrations.mjs p2` through `p8` | PASS: all seven atomic bundles regenerated from the 13 preserved migrations; generated copies removed again |
| Static source/history scan | PASS: no exact duplicate/unreferenced source candidates or high-confidence credential findings |
| `corepack.cmd pnpm release:preflight` | PASS: 265 Git-visible files, 39 browser artifacts, original logo, disabled external inference and no credential findings |
| Documentation/application link check | PASS: 18 relative Markdown links and 50 literal application links, no missing targets |
| `git diff --check` and ignore/index inspection | PASS: no whitespace errors, tracked ignored files or staged files; all 393 removal targets absent |

The existing deployed application was not changed by this cleanup. Source files,
test fixtures, migrations and runtime assets retain their original hashes.
No dependency installation or external inference was performed.
After the intentional ignore-comment and audit-document edits, the other 263
originally inspected files, including private local configuration, still match
their pre-cleanup hashes. All 42 test files and 13 migrations remain.

Ready for owner review and GitHub source submission after the intended files are
committed by the owner. This is not a new production-readiness certification;
the remaining limits in the [submission audit](SUBMISSION_AUDIT.md) still apply,
including the previously recorded development-only dependency advisory.
