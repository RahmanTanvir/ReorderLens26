# Stockout-aware forecasting evaluation

**Status:** experimental offline evidence; runtime integration is not approved by
this result. ReorderLens continues to save `seasonal_baseline_v1` forecasts and
use them in replenishment plans.

## Objective and candidate

The experiment tests whether a lightweight global tabular model improves
seven-day observed-sales forecasts after histories that include stockout periods.
The selected candidate is LightGBM 4.7.0 with an L1 objective, 106 trees and 52
features. Sales inputs and the target are normalized by the eligible 28-day mean,
then rescaled at inference. A single multiplicative calibration factor
(`1.0440678113468995`) was fitted on the validation window only.

The checked-in 222,380-byte JSON model can be evaluated by the dependency-free
TypeScript implementation in `src/domain/forecast/ml.ts`. It is not called by an
API, forecast persistence, inventory read or planner path.

## Dataset and provenance

- FreshRetailNet-50K v1.0, developed by Dingdong-Inc, CC BY 4.0.
- 50,000 store-product series; 4,500,000 training rows over 90 days and 350,000
  owner-published evaluation rows over 7 days.
- Domain: Chinese fresh/perishable retail. This is not ReorderLens customer data
  and does not establish transfer performance in Bangladesh or other categories.
- Train SHA-256: `6706832db892bbae4969c19d87e07975d2543d2ba7d7d4756360654785de5a3d`.
- Eval SHA-256: `1b118840664280c6b88bffc84c80ee1f54c05d911e354b7599e5da10995e960e`.

Primary sources: [dataset card](https://huggingface.co/datasets/Dingdong-Inc/FreshRetailNet-50K),
[technical report](https://arxiv.org/abs/2505.16319), and
[official baseline code](https://github.com/Dingdong-Inc/frn-50k-baseline).

## Protocol

- Deterministic seed `20261114`.
- Every example uses exactly the 28 days at or before its cutoff.
- Training samples 20,000 series at seven rolling origins. Targets with any
  recorded stockout hours are excluded, leaving 574,820 training rows.
- Validation: 2024-06-12 through 2024-06-18.
- Test: 2024-06-19 through 2024-06-25.
- Untouched published evaluation: 2024-06-26 through 2024-07-02.
- Primary metrics score the same uncensored target rows for every method. Histories
  may contain stockouts. Secondary metrics include all observed-sales targets.
- No future availability, promotion, weather, identity or target fact is a feature.
- Comparators: current `seasonal_baseline_v1`, eligible seven-day mean, and
  seven-day seasonal naive.

WAPE is `sum(abs(prediction-actual))/sum(abs(actual))`. Bias is
`sum(prediction-actual)/sum(abs(actual))`; negative values mean underforecasting.

## Results on uncensored target days

| Window / method | Observations | Series | MAE | WAPE | Bias |
|---|---:|---:|---:|---:|---:|
| Validation · seasonal baseline | 196,407 | 47,634 | 0.3767 | 36.51% | -0.62% |
| Validation · calibrated LightGBM | 196,407 | 47,634 | 0.3334 | 32.31% | 0.00%* |
| Test · seasonal baseline | 198,987 | 48,171 | 0.4337 | 36.75% | -11.18% |
| Test · calibrated LightGBM | 198,987 | 48,171 | 0.3743 | 31.71% | -9.78% |
| Published eval · seasonal baseline | 206,562 | 50,000 | 0.4414 | 35.68% | -9.94% |
| Published eval · calibrated LightGBM | 206,562 | 50,000 | 0.3742 | 30.25% | -5.30% |

`*` The calibration factor is fitted on validation, so validation bias is not an
independent result. Test and published evaluation metrics remain held out.

On the published evaluation, the candidate reduced MAE and WAPE by 15.22%
relative to the current baseline. For the 202,343 target observations whose
28-day histories contained a stockout, WAPE moved from 35.53% to 30.09%, a 15.30%
relative reduction. The preceding test window showed the same direction (13.70%
relative WAPE reduction), reducing the chance that the published-window result
is a one-window accident.

The offline Python batch built features and predicted 350,000 product-days in
9.32 seconds on the recorded Windows/Python 3.14.6 environment. Training took
58.64 seconds and the native model was 338,882 bytes. These are local measurements,
not Vercel latency or cost guarantees. Runtime cost is zero provider/API spend.

## What this establishes—and what it does not

**Implemented and tested:** reproducible training/evaluation, chronological
cutoffs, a scale-invariant model export, dependency-free TypeScript tree
evaluation, Python-to-TypeScript parity vectors, strict seven-day input gating,
and deterministic baseline fallback eligibility reasons.

**Not established:** latent demand during stockouts, performance on actual
ReorderLens customers, 14/28-day quality, calibrated prediction intervals,
deployed Vercel latency, or real inventory outcomes.

The dataset lacks on-hand inventory, supplier lead times, purchase costs, packs
and budgets. Passing either forecast through the ReorderLens planner would require
invented assumptions, so no stockout reduction, savings, fill-rate or purchasing
impact is reported.

## Integration decision

The candidate is kept **experimental**. It is not persisted as `ml_v1`, selected
by inventory, or consumed by the planner because:

1. only seven-day external-domain performance is measured;
2. ReorderLens imports can contain missing dates and `unknown` availability,
   while the evaluated model requires 28 consecutive dates with known status;
3. public fresh-retail transfer is not customer validation; and
4. authoritative persistence would require a reviewed database-side model or a
   newly privileged server write path, neither justified by current evidence.

The baseline therefore remains the preferred production method. A future launch
gate should require 14/28-day rolling-origin evidence, one consented representative
retailer cohort, database/inference parity, planner-outcome evaluation with real
lead/cost/stock fields, and the existing tenant/RLS test suite.
