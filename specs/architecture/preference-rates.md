# Safety and damage preference rates — TASK-018 review draft

Status: [DEC-023](../../.project-os/decisions/DEC-023-pooled-authored-preference-rates.yaml)
approves independent binary authored-choice rates, not mean intensity scores.
This is a logical contract and future fixture plan. Runtime schema, persisted
fields, authored production mappings and TASK-021 implementation are not added.
Detailed classification/opportunity definitions still require review.

## Independent observations and formulas

For each metric, authored versioned pre-action tradeoff rules determine eligible
new accepted choices and whether each satisfies that metric's positive predicate.
Retain raw per-metric positive/eligible counts and verified source provenance:

`safetyPreference = total safety-classified choices / total eligible safety choices`

`collateralDamageTolerance = total tolerance-classified choices / total eligible tolerance choices`

Pool compatible counts across official attempts under DEC-014, including eligible
choices in unfinished/abandoned attempts. Each eligible source choice has unit
weight; severity/intensity and attempt length do not change that unit or cause
per-attempt percentage averaging. A positive must belong to that metric's valid
denominator; diagnose malformed counts rather than clamping them into a rate.

The definitions, denominators and availability of the two metrics are independent.
An action can qualify for either, both or neither only as the reviewed predicates
specify. Do not infer one as `1 - other`. One metric can be available while the
other has no observations. Eligible choices with no positives give supported
zero; no eligible choices give unavailable, not neutral, safe or harm-tolerant.
An arithmetic-only fixture with one positive of three safety choices and one
positive of two tolerance choices yields `1/3` and `1/2`, not complements.

## Authored tradeoffs and information boundary

Validate opportunity/choice references against their recorded scenario/content
and classification versions. Retain the verified pre-action information and
availability required by the authored tradeoff. Do not use action names, generic
categories, text labels or absence of branch access as preference evidence.
If the tradeoff was not available, no choice about it has been observed.

Classification must use the information available before the accepted choice.
Later unknown customer harm cannot retrospectively prove that the player knowingly
tolerated it, and a lucky outcome cannot establish a preference for safety. Actual
customer impact, simulation operational risk and campaign collateralDamage or
operationalSafety remain distinct observations/effects. Neither behavior metric
automatically grants hidden-value changes or labels a player/action good or bad.

Exact opportunity identities, predicates, validity/replacement and information
acknowledgement fields need reviewed authoring and integration contracts. Do not
invent a permanent opportunity, timeout, overlapping-opportunity association,
neutral observation or production cutoff. Invalid references, missing required
context/classification and unsupported/incompatible definitions are diagnostics,
not known negative samples or a zero-filled preference. Preserve unavailable
coverage instead of presenting partial observations as universal player knowledge.

DEC-011 imported discovery membership can satisfy approved presence predicates,
but adoption itself supplies no historic preference choice. A genuine later
eligible choice still requires its own verified pre-action tradeoff and new input
provenance; a legacy snapshot cannot substitute those missing observations.
The current three incidents gain no invented ethical observations from their
existing resource, restart/rollback or UNKNOWN data.

## Identity, replay and commit

Preserve run/attempt, source input/sequence, applicable opportunity, metric and
definition versions for each observation. Project the same identified source once
per applicable metric; different event IDs or recalculation do not add choices.
A genuine distinct accepted input can qualify under its own authored rules even
when its bytes match an earlier attempt. Do not automatically treat every repeated
command as another tradeoff, or mistake DEC-015 effect suppression for suppression
of genuine new behavior. Detailed opportunity reuse/consumption needs review.

Exact-head resume retains existing same-attempt provenance and counts without
recounting. Confirmed checkpoint attempts retain inherited history as baseline;
only newly accepted qualifying choices add observations. Rejected/duplicate inputs,
import, archive review, UI navigation, timers and delegated outcomes alone add none.
A simulation action's time/costs and operational history remain recorded once,
even if it qualifies independently for multiple metrics or no preference metric.

Prepare identity/history/projections through the pure domain and commit them
together under DEC-013's revision-checked IndexedDB transaction. Official samples
are acknowledged only on transaction completion; abort/conflict preserves prior
committed state, and lost acknowledgements reconcile by identity. Do not rewrite
old definitions to the latest version silently or touch the two legacy save stores.

## Required TASK-019/020/021/024 fixtures

These tests belong to future APIs, not the current legacy compatibility suite:

- Independent counts `1/3` safety and `1/2` tolerance: no complement inference;
  one supported metric and one without eligible choices: value versus unavailable.
- One positive in two eligible choices and another in ten: pooled `2/12`, not
  averaged attempt percentages; retain abandoned/unfinished genuine choices.
- A supported negative choice yields `0/1`; no opportunity, inaccessible branch
  or absent accepted choice yields no sample, not an inferred preference.
- Pre-action tradeoff information versus hidden future damage/lucky outcomes:
  no retrospective classification or automatic raw-risk/moral score conversion.
- Invalid predicate/reference/context/version and incompatible historical rules:
  diagnostic, no clamped counts, guessed neutral observation or silent reclassification.
- Duplicate delivery, import, inherited prefixes, exact-head resume, new checkpoint
  attempts and archive review: preserve identity, count only new qualifying choices.
- Multiple metric eligibility and ordinary actions outside tradeoffs: retain one
  operational input/cost, independently verified per-metric observations only.
- Once-per-run effect suppression versus genuine new retry observations: no
  duplicate historic award and no loss of eligible new player choices.
- Abort, revision conflict and lost acknowledgement: coherent committed identities,
  history and raw counts; native capability/exposure checks remain separate.

Fractions are arithmetic fixtures, not production balance or preference intensity.
Company-reporting/NULL-cooperation response units are separately approved by
[DEC-024](../../.project-os/decisions/DEC-024-explicit-affiliation-response-rates.yaml)
and specified in the [affiliation draft](affiliation-rates.md); the metrics retain
independent opportunity/eligibility definitions.
Independent architecture review, acceptance QA and Project OS evaluation remain
required before TASK-018 completion or dependent runtime implementation.
