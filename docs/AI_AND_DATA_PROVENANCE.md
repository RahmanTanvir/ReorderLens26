# AI, data and asset provenance

ReorderLens is prepared for the International AI Builders Congress2026. This
document describes the implementation; it does not assert compliance with event
rules that have not been supplied or independently reviewed.

## Runtime intelligence

- Forecasting uses the versioned deterministic `seasonal_baseline_v1` algorithm.
  It uses recorded eligible sales within a28-day history window for7/14/28-day
  projections. Missing history remains insufficient data. Stockout observations
  are excluded; lost sales, promotion effects and calibrated uncertainty are not
  reconstructed. No trained-model accuracy, backtest improvement or business
  outcome is claimed.
- Replenishment uses an explainable, budget-constrained greedy allocation with
  saved quantity/cost snapshots and human approvals. It is not a claim of global
  optimization. Draft purchase orders are never dispatched, paid or received by
  the application.
- ReorderLens Insight currently produces deterministic, contextual explanations
  from authorized saved evidence. It is read-only and closed until opened.
  Responses identify saved facts and limits; they do not mutate business records.
- The server includes an opt-in OpenRouter free-model fallback adapter with
  deterministic fallback. External inference is disabled in the accepted mode.
  The prior bounded synthetic evaluation received three404 responses and accepted
  no model answers. No provider/model qualification or live-model quality score
  is claimed. Real customer records must not be sent to these free endpoints.

## Data and development assistance

- Real workspaces use Supabase-backed imports and saved results. No production
  inventory statistics or purchase totals are hardcoded into these workflows.
- The intentional sample workspace is marked as illustrative, separate from real
  workspace data, and blocks ordinary CSV imports. Its predefined rates/plan are
  demonstrations, not fitted forecasts or customer outcomes.
- Automated tests use explicitly fictional fixtures. The synthetic CSV fixture
  contains418 rows and may shift dates during tests to exercise freshness gates.
  Its names, SKUs and records are not customer data. Capacity measurements use
  additional synthetic local fixtures and are not hosted load or accuracy proof.
- AI coding assistance (Codex) was used in implementation, testing, documentation
  and review. Owner acceptance and reported hosted checks are distinguished from
  agent-executed checks in the release records. Code generation alone is not
  counted as verification.

## Assets

- The Threshold R + Lens logo is the actual owner-supplied PNG, copied without
  modification into public/branding/reorderlens-logo.png. Its SHA-256 is
  `34dc3a487cc24a6bc99c710fd1227ef45b5028f9c6b7d0c36219c92c2ea3cc85`.
- Manrope is self-hosted from the unmodified Fontsource variable font. See
  src/app/fonts/README.md and public/fonts/Manrope-OFL.txt for provenance/license.
- UI icons come from the pinned lucide-react package. Shared primitives use
  Radix with shadcn-style component composition and centralized Graphite tokens.

Historical verification is retained in DEVELOPMENT_HISTORY.md. Current limits
and scoped hosted evidence are in RELEASE_CHECKLIST.md.
