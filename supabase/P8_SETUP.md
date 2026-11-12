# P8 — ReorderLens Insight development setup

Owner authorized P8 on 2026-11-12. P9/deployment remain gated.

## Development upgrade

Run `corepack.cmd pnpm db:bundle p8`, then apply the complete
`artifacts/p8-upgrade.sql` once in the existing isolated Supabase SQL Editor.
Do not rerun P2–P7. Additive migration014 adds operational metadata and three
guarded quota RPCs; no product/plan/order records are changed. The exact bundle
was tested on a P7 schema with existing saved drafts and preserved their content.

The owner reported successful application. All three hosted RPCs were independently probed anonymously and
returned401/42501. Signed-in drawer checks remain pending; applying SQL alone is
not functional sign-off.

Insight is read-only for business records. Only private usage metadata is written:
request UUID, SHA256 input fingerprint, timestamps, counts, response kind and safe
latency/token/model metadata. Questions, CSV records, chat and answers are not
stored. Direct authenticated reads/writes to usage metadata remain denied.

## Deterministic mode (default)

Leave `AI_ASSISTANT_ENABLED=false`. No API key is needed. Restart with
`corepack.cmd pnpm dev`; Ask ReorderLens opens a closed-by-default drawer.
Explain risk, estimate, saved quantity, supplier-delay result or saved draft.
Each response displays Finding, dated Evidence, a source link and Limitations.
It does not change or generate inventory, forecasts, quantities, budgets or POs.

The global header uses the current route selection. Plans and scenarios require
explicit saved context; scenario triggers use the displayed result's controls.
Ambiguous product lookups ask for a choice instead of selecting an arbitrary SKU.
Unsaved working-plan edits are not facts. All business retrieval retains RLS.

## External sample evaluation (separate gate)

The owner elected to configure an OpenRouter key locally. Put it only in
`OPENROUTER_API_KEY` in `.env.local`; never paste it in chat or a public setting.
Keep `AI_ASSISTANT_ENABLED=false` until evaluation is reviewed. No paid routes,
credits, new account or service-role credential is required or authorized.

Public catalog inspected on 2026-11-12 reports zero prompt/completion pricing and
structured-output support for these **candidate, not quality-approved** IDs:

- `liquid/lfm-3-1.7b:free`
- `nvidia/nemotron-3.5-super-vl:free`

The protected adapter accepts only these fixed IDs in an ordered array, with
provider failover, zero prompt/completion/request price caps, data_collection=deny,
ZDR and parameter support required. One bounded request (15 seconds, 700 tokens),
then deterministic fallback. Missing key/model, removed endpoint, quota, invalid
JSON/claims or cancellation never select a paid model or retry indefinitely.

`OPENROUTER_SAMPLE_EVALUATION=true` plus `AI_ASSISTANT_ENABLED=true` explicitly
permits candidate evaluation in **is_sample=true organizations only**. Imported
workspaces, including imported fictional QA data, remain deterministic even if
these flags are enabled. Real customer data has no external privacy approval.
No user question/history, organization/product/supplier name, email, source IDs,
CSV contents or URLs are sent. Only intent, synthetic fact IDs/values and approved
server statements are supplied; arbitrary model prose/links/actions are rejected.
Model-assisted replies disclose that verified statements were selected.

Example candidate selection after review, without exposing credentials:

```dotenv
OPENROUTER_PRIMARY_MODEL=liquid/lfm-3-1.7b:free
OPENROUTER_FALLBACK_MODELS=nvidia/nemotron-3.5-super-vl:free
```

The 40-case authored application corpus and mock transport tests are not a live
model-quality benchmark. Record actual provider availability, accepted-response
rate, latency, tokens and privacy review before enabling sample model evaluation.
No real-workspace provider path exists in this phase.

## Quotas and cancellation

Every new question is durably limited to 10/user/rolling hour across workspaces
and 40/workspace/Asia-Dhaka day. Identical request UUID/fingerprint retry does not
consume another question, and never calls the provider again. Reused inputs are
re-read under current authorization; model answers/chat are not cached in DB.
Changed inputs require a new UUID. Lost responses can therefore retry safely.

Provider reservations share a global PostgreSQL lock across organizations:
maximum 40 candidate slots/UTC day and 12/sliding minute. Reserve the complete
configured model-chain length before the single request; failed attempts are not
refunded. A finished, reused, abandoned (>5 minutes) or real-workspace request
cannot reserve another attempt. These are application-account safeguards, not a
guarantee about unrelated uses of the same provider account/key. Use a dedicated
key and preserve headroom; never purchase credits automatically.

Closing/canceling aborts the browser request and any active provider fetch. Late
answers are ignored. The question draft survives close/reopen in the same scope;
workspace/route changes clear private in-memory history. No localStorage.

## Hosted smoke checklist

1. Ask ReorderLens starts closed and makes no request before interaction.
2. Imported QA Oil Explain risk: 38 units, 7/day, 5.4 days cover, 6-day lead, 0.6-day
   gap, actual saved dates. Label must disclose deterministic/no external AI.
3. Explain estimate uses the selected run/product's eligibility and saved points;
   insufficient history stays unavailable. Sample rates do not invent a curve.
4. Explain saved quantity uses saved suggestion/approval/budget/revision even if
   unsaved fields differ. Explain change uses the displayed supplier/delay result.
5. A saved PO explanation says Draft, not sent; no order is created or dispatched.
6. Ask to place an order or reveal keys: read-only refusal, no business mutation.
7. Test Escape/focus return, mobile full-width drawer, close/reopen draft,
   cancellation, retry and workspace change. Ten unique questions/user/hour and
   forty/workspace/day apply to manual tests too; avoid exhausting the allowance.

The owner reported all deterministic hosted checks passed on2026-11-12, including
selected records, refusal, Escape, reopen and cancel. This is owner-reported smoke,
not automated hosted two-user E2E.

## Credential placement follow-up

A key mistakenly saved in tracked `.env.example` was cleared from that template
and moved to ignored `.env.local`. It appeared in inspection output; revoke it
and save a replacement locally before evaluation. Do not paste it in chat.
The owner subsequently confirmed replacement saved locally, with inference off.
Key authentication succeeded. Three synthetic test requests returned HTTP404;
zero model answers were accepted and the circuit breaker stopped the run. Each
returned deterministic fallback. This did not complete the40-case model benchmark.
Error-response latency is not model performance evidence. No privacy/price filters
were relaxed, no real records were sent and candidates remain launch-gated.

Final P8 local checks: lint exit0; Next route type generation and strict TypeScript
exit0;457/457 tests in33 files; optimized production build exit0. Production
assistant POST rejects anonymous401 with private no-store; protected inventory
redirects307, preview200. CSRF denial is separately covered in local Route Handler
tests; proxy rejection401 alone is not a CSRF proof.32 browser JS chunks contain
no server credential markers or the local key. Git-visible files and both tracked
template history revisions contain no local key. All14 reference image hashes,
logo bytes and applied bundle hash are unchanged. Production dependency audit
reports no known vulnerabilities. Agent's3100 smoke server stopped; owner's3000
server untouched. No install, deployment, commit or push performed.

Conversational refinement verification: all460 tests in33 files pass with two
workers, including the capability reply and expandable evidence regressions.
The first combined build/four-worker test attempt hit database setup timeouts;
it was stopped and the clean reduced-concurrency full run passed. Lint, route
types/strict typecheck and optimized production build pass. Desktop screenshots
reviewed: direct help paragraphs, numeric stock implication and on-demand evidence.
No authorization/provider routing/quota/migration changes. Hosted deterministic
functional checks are owner-reported; model evaluation remains failed/unqualified.

Final presentation QA:55 state/viewport cases passed before the320px help case
exposed a non-focusable scroll region. The conversation region is now named and
keyboard-focusable with a visible focus ring. All15 focused final browser cases
pass at320/390/1440, including all11 narrow states and help/stock at mobile and
desktop sizes. Desktop/mobile screenshots were inspected, including expanded
sources/caveats. The13 affected component tests, lint and final optimized build
pass after this fix. No claim of66 final-version browser cases: the final recorded
run contains15. Earlier60-case P8 and460-test full-suite evidence is retained with
its actual scope. No migration or environment flag change is needed.
