# ReorderLens engineering instructions

Implement only the phase explicitly authorized by the owner. P8 is complete by
owner acceptance on2026-11-12 with deterministic-only Insight; model qualification
is deferred and external inference stays disabled. The owner authorized P9 local
hardening/release preparation. P2's accepted release follow-ups remain recorded.
Do not deploy, commit/push, spend or enable external inference without separate
explicit instruction. No production-readiness claim while release gates remain.

Before product work, read `ReorderLens_Docs/AGENTS.md` and
`ReorderLens_Docs/CODEX_INSTRUCTIONS.md`, then the decision register and roadmap.
The owner intentionally excludes `ReorderLens_Docs/` from Git. Preserve it locally;
if it is absent in a fresh checkout, obtain the specification package before
implementing product behavior. Never invent its contents.

- Keep React, Next.js App Router, TypeScript, Tailwind, shadcn/ui, Supabase and
  Vercel. No Flutter or extra backend framework.
- Preserve existing work. Keep UI, pure domain calculations and server operations
  separate. Mark privileged modules with `import "server-only"`.
- Require verified Supabase identity, workspace membership and RLS before business
  data routes. No service-role or AI key in client code, public config or logs.
- Validate external inputs. Use real Supabase data for functional workflows;
  fictional fixtures belong only to explicitly labeled sample organizations.
- Follow Graphite Workspace 2.0 and Manrope in P1. Use the actual supplied logo,
  never screenshot placeholders. Individual screen candidates need review.
- Insight remains read-only and closed by default: vetted OpenRouter `:free`
  models, then deterministic fallback. No paid routing, external real customer
  data without privacy approval, autonomous actions, or arbitrary SQL.
- POs remain human-reviewed drafts; no dispatch, payment or inferred receipt.
- Verify changes with relevant tests, typecheck, lint and build. Report actual
  evidence and limitations; never claim a later phase or security gate is passed.
- Do not deploy, perform destructive operations or introduce spending without
  explicit authorization. Never force-add the ignored documentation folder.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
