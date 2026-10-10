# TASK-021 — Versioned player behavior candidate

Status: developer implementation and verification candidate, **not accepted**.
Independent review, acceptance QA and configured Project OS evaluation are pending.
DEC-029 approves model binding in new campaign definitions only; it does not approve
attaching a model to older runs, production classifications or native integration.

## Completed

- Optional immutable `behavior` data inside the existing full campaign definition
  authority. Model ID/version, classification version, schema version 1 and formula
  version 1 are pinned from creation. Unsupported formulas/schemas and altered
  authorities fail; there is no latest-version fallback or automatic conversion.
- Exact scenario/content coverage declarations: supported mappings exhaustively
  classify every action, or explicitly declare unsupported coverage and its reason.
  Restart/rollback numerators must be subsets of authored operational interventions.
  Classification comes from data, never names, categories or UI navigation.
- Pooled restart/rollback and evidence-before-action counts. Supporting investigation
  must be new in the same attempt, available before the intervention and satisfy
  both authored relevance and freshness trees using the strict condition evaluator.
  Rule omission is invalid; no implicit permanent freshness or expiry interval.
- Average investigation depth counts distinct authored keys per supported attempt
  with at least one new command. Empty attempts do not dilute it; supported
  zero-investigation attempts and unfinished/abandoned attempts remain included.
- Verified immediate observations and returned timer results retain source input,
  operation/local sequence, run/attempt, content/model/classification/formula versions
  and the returned event boundary. Requests alone are not results. Repeated tool
  observations retain their time/costs and freshness while depth deduplicates keys.
- Inherited pending timers have no new source. The pending queue preserves ordering,
  including inherited and new work with identical timer IDs/due times. Version 1
  accepts only statically unambiguous direct scheduling origins for timer observations;
  indirect/multiple producers or colliding result-source namespaces diagnose.
- Generated raw samples, support links, counts, availability and coverage are part
  of whole-record replay equality. `getCampaignBehavior` is read-only tool/test
  access after full replay verification, not hidden-value player UI.
- Metric references can now use supported verified observations in campaign conditions.
  Pre-command conditions retain the prior model; post-event conditions see only
  results processed up to that event, not later results in the same command batch.

## Availability and compatibility

Four fields have implemented derivation when their authored mappings are supported:
`restartRate`, `rollbackRate`, `evidenceBeforeActionRate`, `averageInvestigationDepth`.
Each retains numerator, denominator, source provenance and coverage. Zero eligible
samples are unavailable; an eligible denominator with no positives is observed zero.
If a run includes newly accepted inputs with explicitly unsupported coverage, these
fields remain unavailable rather than presenting the supported subset as universal.
Known raw counts and unsupported-attempt coverage remain explainable.

Six fields explicitly remain unavailable with `NO_RECORDED_OPPORTUNITIES`:
`aiRecommendationAcceptanceRate`, `safetyPreference`, `collateralDamageTolerance`,
`companyReportingRate`, `nullCooperationRate`, `predictionDeviation`. Current operation
variants do not record their required opportunities, pre-choice information or actual
presentation acknowledgements. Resource damage, Support messages and UNKNOWN hints
cannot substitute for those inputs. No ethical weighting or exposure lifecycle is
invented. Later supported opportunity operations require their separately reviewed
implementation; this candidate does not accept injected counts or opportunity payloads.

Model-less definitions retain their exact run shape and unavailable metric handling.
There is no new property by default, no historic prefix/import backfill and no model
attachment operation. New model-enabled definitions are separate immutable authorities.
Explicit compatible content mappings share one pinned model and formula; conflicting
investigation-key result semantics are rejected. Exact-head resume preserves the same
attempt's recorded new support. Confirmed checkpoint retries retain the old prefix as
baseline and begin their own observation sets empty, without erasing earlier attempts.

## Changed files

- `src/scenario/behavior.ts`: strict authored schema and reference/classification checks.
- `src/scenario/campaign.ts`: optional model binding; metric keys re-export unchanged.
- `src/engine/player-model/behavior.ts`: owned-copy deterministic derivation, raw
  provenance, pending result attribution and availability explanations.
- `src/engine/campaign/transitions.ts`: new-run binding and command/event projection;
  verified tool access and condition consumption.
- `src/tests/fixtures/behavior.ts`, `src/tests/player-behavior.test.ts` and
  `src/tests/player-behavior-ledger.test.ts`: non-production authoring and isolated tests.
- DEC-029, TASK-021 context/checkpoints, this document and the M4 plan/specification
  record the approved scope and handoff boundaries. Canonical state is not manually edited.

No UI, frozen scenarios, dependencies, physical IndexedDB layout, persistence adapter
or either legacy storage envelope is changed. No user storage was accessed.

## Tests

Developer checks: 45 focused behavior/ledger tests and 260 full-suite tests in 23 files.
Typecheck, lint, formatting, eight scenario-file validations, web build, Project OS
doctor and diff checks pass. The pre-existing non-blocking web chunk warning remains.
These results are developer verification, **not independent acceptance or native QA**.

One full-suite run launched concurrently with build/lint timed out in the existing
5-second UI vertical-slice test (259 passed, one timeout). An unchanged-timeout full
rerun without those concurrent commands passed all 260 tests. The observed timing
sensitivity is recorded for independent QA; no timeout/configuration was relaxed.

Coverage includes pooled `2/12`, information-only denominators, actual zero, rejected
and duplicate inputs, distinct retries/runs, zero-depth and empty attempts, repeated
keys, required relevance/freshness, expiry, same-command and later-result exclusion,
import/baseline isolation, direct and delayed observations, equal-due inherited work,
exact-head resume, supported metric conditions and causal event boundaries, explicit
compatibility, strict schema/version/reference rejection and forged caches.
Isolated injected memory IndexedDB tests cover reload across a pending result's due
boundary, lost acknowledgement, transaction abort after request success, concurrent
revision conflict and coexistence of old/new definition records. Only transaction
completion acknowledges official history/counts; the adapter's approved layout and
commit policy are unchanged.

## Known risks

- Full-history replay, per-event recomputation and whole-record growth are not
  benchmarked. Replay equality is not a cryptographic authenticity guarantee.
- The existing UI end-to-end test showed a 5-second timeout during concurrent
  verification; its unchanged full rerun passed. The exact cause is not established.
- The first result representation deliberately rejects ambiguous/indirect timer
  origins instead of guessing. More complex authored investigations need a separately
  verified representation, not a permissive fallback.
- The six opportunity-dependent metrics cannot become available until the missing
  typed operations and actual information/presentation provenance are supported.
- No production model definition or player-facing campaign adapter is wired here.
  TASK-022/024/025 must verify prediction, reveal gates, exposure and native publication.
- Existing dependency/security findings from TASK-020 remain outside scope; no
  dependency changes or new security certification is claimed.

## Remaining work and next recommended step

Obtain separately authorized TASK-021 read-only independent review and acceptance QA
against the committed candidate. Fix safe findings and gate any material policy change.
Only independently attributed evidence and configured Project OS evaluation can complete
TASK-021 and make TASK-022 eligible. M4 remains active; no push or release is implied.
