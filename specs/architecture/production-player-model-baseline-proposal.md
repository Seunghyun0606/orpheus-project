# TASK-028 — Production model baseline proposal

Status: proposed only; no production model/initial-value data is implemented here.
DEC-042 approved content/package versions but explicitly excluded these choices.
The new action guard implementation does not authorize selecting model balance.

## Why this is the next decision

The new complete campaign definition must pin its behavior, prediction and opportunity
authorities and explicit initial state. Existing fixture values are not production
defaults. The v2 contract cannot be satisfied by an empty placeholder or silently
attaching models to older runs. A complete 26-Incident package and ending authority
are still absent; this proposal will not make partial early content startable.

## Proposed option A

Use fresh production-only IDs `orpheus-player-behavior`, `orpheus-player-prediction`
and `orpheus-player-opportunities`, each version `1.0.0`, authoring schema 1 and
existing formula version 1. Behavior and prediction classification versions are
also `1.0.0`. Pin them only in the new `orpheus-full-campaign` definition; keep
fixture authorities and old campaign records untouched.

Initial state: Act 1; corporate/NULL alignment and all seven hidden numeric values
start at 0; collected evidence/narratives/completed Incidents are empty; authored
narrative/ending flags start false. **This does not initialize unsupported behavior
rates to zero**: no eligible samples remains unavailable under the approved formulas.
Hidden raw values remain off the player-facing UI.

Propose these authoring baselines, as explicit versioned tables rather than runtime
name/category heuristics:

- Operational denominator: authored service-changing mitigation/modification actions,
  not observation, delegation, communication or Security/Archive reading. Restart
  and rollback identities are listed explicitly per Scenario; preserved MVP actions
  retain their actual names and semantics.
- Evidence-before-action: relevant new investigation from the same attempt only,
  excluding inherited/imported knowledge. Declare the specific diagnosis/configuration
  observations and supported newly delivered delegation evidence for each causal
  intervention. Proposed freshness limit: 180 action-driven seconds. Unrelated logs
  or a generic communication message do not qualify as causal support.
- Investigation depth: distinct authored investigation keys per attempt; repeating
  the same item retains cost/history but not extra depth. Security attribution and
  actual archive investigation are distinct observations, not passive screen visits.
- Prediction: explicit comparable-condition/action mappings per Scenario, not a
  fuzzy/LLM heuristic. Proposed minimum sample support is 3 in each authored context.
  Top ties/no candidates/insufficient samples stay UNKNOWN; confidence is the unique
  top candidate's empirical share. Only current guard-eligible actions are candidates.
- Guidance: no ORPHEUS-branded prediction/recommendation exposure in Acts 1–3.
  Later opportunities require explicit authored reveal/validity/response gates and
  the already approved real visible ACK before eligible accepted responses.
- Safety, collateral tolerance, company reporting, NULL cooperation and recommendation/
  deviation metrics use only their separately declared valid response opportunities.
  Early operations or missing choices must not manufacture samples.

The established pooled formulas, duplicate/retry semantics, strict unavailable-leaf
policy and once-per-run discovery effects are unchanged. These table/value choices
are proposed—not derived implicitly from existing tests.

## Not selected by this proposal

Numerical alignment/value awards or losses, ending definition versions/conditions/
thresholds/priorities, final actions and epilogues remain later explicit design choices.
No actual production opportunity wording/response lists are approved wholesale;
later content must author them within these boundaries. This is not a packaging,
release, storage migration, QA waiver or completion/dependency exception.

## Option B

Keep the implemented action guard and early content unchanged. Supply a different
reviewable initial/model/classification baseline before production definition
composition. Do not copy fixtures, insert zero for unavailable metrics or create
an incomplete official run as a temporary workaround.

## Deferred verification

After QA is requested again, verify baseline schema/reference coverage, explicit
action classifications, relevant/fresh/inherited evidence boundaries, unique depth,
minimum-support/tie/no-candidate predictions, guarded opportunities/ACK/responses,
pooled counts, save/replay and old authority isolation. No checks were run for this
proposal or the new implementation candidate.
