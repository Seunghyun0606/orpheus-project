# New-campaign v2 presentation records (DEC-033 candidate)

The human approved new-only v2 recording. This extends the runtime representation,
not existing pinned v1 histories. TASK-024 acceptance, native evidence and TASK-025
audit remain outstanding. See implementation evidence.

## Authoring

Campaign authoring retains `schemaVersion: 1`. A new authority must explicitly
select `replayVersion: 2`, `recordVersion: 2`, a pinned behavior model and required
`opportunities`. Replay v1 may not declare record v2 or opportunities. The record
envelope becomes `schemaVersion: 2`; physical IndexedDB remains version 1.

Opportunity authoring pins schema/formula version 1, id/version, behavior version,
and prediction version when prediction rules occur. Every rule pins incident/content
version and declares a metric, kind, presentation id/text, typed references,
availability/reveal/continuing-validity predicates, explicit single-response/no-
replacement lifecycle and nonempty eligible action mappings. Choice mappings also
require their positive predicate; prediction/recommendation positivity derives only
from the approved identity comparison. No fallback predicate or timeout is added.

Kinds map to separate metrics: prediction → deviation, recommendation → recommendation
acceptance, choice → the four authored preference/affiliation rates. Prediction
references a comparable context; recommendation explicitly names its action.
References resolve declared campaign observations, elapsed/age time, scenario
signals/resources/flags/evidence. All referenced unavailable observations diagnose
before Boolean composition, including decisive siblings. Model/content versions,
references, response actions and candidate mappings validate before runtime.

## Ordered operations and derived data

All operations retain common run/operation identity, sequence, exact definition
id/version and canonical version 1. New variants require replay version 2:

- `prepare_opportunity`: attempt id, prior incident head, preparation id and rule id.
- `acknowledge_presentation`: attempt id, prior head, preparation id and surface id.

Preparation stores the replay-owned authored presentation, model/formula identity,
rule/kind/metric, attempt/content/head/time/history boundary, current observations
and immutable prediction result (or explicit recommended action). This is not
exposure. Same rule/attempt/head cannot manufacture distinct preparations by changing
ids. The adapter may explicitly reselect existing valid prepared content.

ACK requires the current active unfinished attempt, the preparation's exact head
and actual authored surface. It validates current authored lifecycle and prediction
context/candidate gates. Its operation id and boundary are committed before responses.
Mount, hidden documents, read-only archive visits and queries never automatically ACK.
The screen uses an explicit visible-confirmation interaction; adapter tests are not
native observation evidence.

New accepted commands inspect still-valid ACKed opportunities in their own verified
pre-action state. Unrelated/rejected/inherited/imported work creates no response.
Eligible responses consume one sample per preparation. More than one candidate
association for a metric diagnoses rather than choosing a latest opportunity.
Current prediction applicability/reveal/all candidate conditions are checked again;
both the original prediction identity and selected action must remain candidates.
Missing required context diagnoses; expiry/unavailable choices do not count negatively.

Response provenance retains preparation/ACK/model/rule identities, operation/input/
command sequences, attempt/prior head, positive Boolean, authored observations and
separate current prediction context. Stored original prediction/confidence is not
updated by later choices. Each metric projects pooled positive/eligible counts and
its own coverage/provenance. No eligible responses means unavailable, not observed 0.

## Persistence and UI boundaries

The existing revision-checked IndexedDB transaction verifies complete authority and
replay equality and writes command plus derived responses together. No second
simulation dispatch, localStorage write, volatile fallback or cross-store atomicity
claim. v1 and v2 records coexist under exact definition authorities; no old record is
rewritten or upgraded. Unknown versions fail.

The opt-in adapter requires explicit authority/run/ledger injection and read before
creation. It publishes only a verified transaction-complete record containing the
submitted exact operation. Pending identity/candidate survives abort or unknown ACK;
retry reconciles that identity. A known conflict requires explicit verified reload,
not automatic action rebasing. Preparation selection is separate ephemeral UI state,
not campaign input or response. Default AppShell has no campaign injection, enabling
no late-game model/content in MVP. Read-only framework queries grant no ending/effect.

Production thresholds/gates/content and isolated native test profile setup remain
separate decisions. No user save mutation, M4 closure, release or TASK-025 waiver is
authorized here.

_Links to process artifacts removed under DEC-070 were dropped; the originals remain at git tag `archive/pre-process-consolidation`._
