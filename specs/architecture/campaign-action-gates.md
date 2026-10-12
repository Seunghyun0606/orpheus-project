# Campaign action prerequisites — DEC-043 implementation contract

Status: human-approved representation, unverified implementation candidate.
The proposal at `1383be0` remains the approval checkpoint. QA, typecheck, tests and
native checks are deferred; source existence is not a PASS.

## New-only definition representation

CampaignDefinition remains authoring schema 1. Optional nonempty `actionGates`
is permitted only with record/replay 2. Each strict entry is exactly:
`id`, `incidentId`, `contentVersion`, `actionId`, `eligibility`.
Eligibility is the existing typed campaign condition tree; declared references
must authorize its new `action` context and match the exact definition version.
No callback, implicit default predicate, arbitrary object path or keyword rule.

Reject duplicate IDs or incident/version/action bindings, absent/unknown actions
and content versions, wrong reference types/versions/contexts. When one Scenario
version is reused at different campaign incident entries, every such entry must
provide a binding for the protected action. A compatible version is a separate
explicit binding; no latest-version lookup.

Retained definitions without `actionGates` preserve their old canonical shape and
behavior. No old operation/record envelope or physical database schema changes.
The additional fields in the UI adapter are ephemeral projections, not saved fields.

## Accepted command and query boundary

`evaluateActionGate` consumes an explicitly supplied verified pre-command campaign
context. `selectCampaignActionIds` intersects Scenario-local availability with this
same predicate. The public `getCampaignActionAvailability` query validates definition,
whole replay and canonical record equality before returning IDs/diagnostics.

The command transition checks the guard before simulation, time/cost/state changes,
opportunity association or behavior inputs. False yields `INELIGIBLE_CAMPAIGN_ACTION`;
unavailable observations retain strict diagnostics, even under otherwise decisive
Boolean siblings. Failure does not publish any candidate or mutate the prior record.
Stable duplicate delivery reconciles already accepted history before applying new
command logic; it is not a new input or reason to reinterpret old acceptance.

The session uses the query for displayed actions and exposes unavailable-state
diagnostics as a generic alert, without leaking a protected action label. Prediction
candidates and recommendation availability also use guarded action selection.
Choice presentations require all declared response-action campaign predicates;
closed conditions suppress exposure/responses, unknown conditions diagnose. Existing
guidance ACK, response association and atomic commit-before-publish are unchanged.

## Protected reveal authoring analysis

For a guarded Scenario version, derive protected revealed signals/evidence, narrative
nodes, War Room messages and dependent flags from the guarded action and mandatory
action-completion narrative conditions. Follow declared dependencies to a fixed point;
these sets are validation/query analysis, never authority stored in a run.

Reject unguarded actions, timer/conditional events, resolution or completion effects
that produce these protected outputs. Reject protected signals/messages initially
visible and protected membership preloaded in campaign initial collections.
Protected narratives must declare a mandatory completed guarded action condition.

The simulation's explicit `trigger_narrative` effect bypasses local conditions.
Consequently explicit triggers of protected narratives are rejected, including
from guarded actions or other narratives. Use normal condition-driven narrative
evaluation after the accepted action completes; do not weaken existing simulation
semantics or reinterpret older content to enforce the new contract.

This is structural control-flow validation, not semantic censorship of arbitrary
authored prose. Full-campaign content still requires negative reveal QA and complete
definition bindings. Standalone Scenario replay has no campaign context; official
campaign commands must use the campaign transition, not a second simulation dispatch.

## Source checkpoint/adoption provenance

Local replay alone does not prove cross-Incident prerequisites. If a source contains
a guarded action or a protected signal/evidence/narrative/message, require an existing
verified **same-run checkpoint association** with exact source bytes. Its recorded
associate operation/attempt/head must match the receipt. That receipt was created
against an official live head whose ordered campaign history already validates
the original guarded command. Seed equality or matching commands alone is not proof.

An unassociated protected source yields `UNPROVEN_PROTECTED_SOURCE`, even if current
campaign evidence now satisfies the prerequisite. All adoption sources are checked
before any membership is applied; mixed batches never partially import. Preserve
source bytes and the prior committed run. Associated supported prefixes may seed a
new attempt without new inherited behavior/effects; exact-head resume remains read-only.

`checkCampaignSourceAdmission` is a replay-verified read-only preview. Legacy preview
ports optionally accept explicit campaign authority; their prepare operations supply
it for guarded definitions. Existing unscoped legacy inspection is not a full-campaign
authority or consent to import; old ungated preparation paths retain their old order.
No foreign-campaign source format, provenance Boolean, new receipt or record variant
is introduced. Unsupported protected lineage is diagnosed rather than converted.

## Early content integration and outstanding decisions

INC-006 authors `READ_SECURITY_ATTRIBUTION`, with local diagnosis requirements and
condition-driven `SECURITY_THREAT_NAME`. Its official campaign binding additionally
requires `GHOST_DISCOVERED` and Act access. Certificate rollback/trust repair does
not require that optional clue.

A separate accepted `RETRACE_WORKLOAD_ARCHIVE` investigation can correlate the earlier
workload from INC-006 and produce its own `GHOST_ARCHIVE_FRAGMENT`. It is not passive
archive navigation or importing the player's INC-005 action. The planned logical
flag bindings map verified native events from either source to the same clue state;
they grant no numeric alignment/value award. Further late-Act reinvestigation routes
remain content authoring work. The bindings fragment is not a complete definition.

Production model versions, hidden initial values/classifications, numerical effects
and ending balance remain separate human choices. No full package or new user run is
created here. Required QA, native and independent final acceptance remain pending.
