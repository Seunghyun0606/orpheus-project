# TASK-028 — Early campaign content authoring checkpoint

## Current scope

The latest human instruction cancels native QA and requests next implementation.
DEC-041 permits TASK-028 before TASK-027 acceptance. `projectctl claim TASK-028`
activated the task; TASK-024/027 remain active/incomplete. No tests, independent QA
or native app input/launch were performed in this step. The existing TASK-024 QA
window/profile is not reused for TASK-027. Read-only computer-use initialization
and listing succeeded, but are not native application verification.

DEC-038 fixes the Incident identities/causal sketches; DEC-040 supplies package and
typed presentation boundaries. Neither selects production content/model versions
or balance. This plan is outside runtime data and is not a playable campaign.

## Source-grounded authoring map

| Incident                      | Existing or approved mechanism                            | Contrasting responses                                                                                     | Investigation/reveal boundary                                                                           |
| ----------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| INC-001 Connection Saturation | Existing connection exhaustion and retry amplification    | Temporary restart versus sessions investigation and stale-session termination                             | Retain exact 1.1.0 Scenario and UNKNOWN hook; logs/metrics/session projection only                      |
| INC-002 Bad Deployment        | Existing issuer/verifier key mismatch                     | Stable-region window versus keyset repair or verified rollback                                            | Retain exact 1.2.0 Scenario, deployment trace and UNKNOWN evidence                                      |
| INC-003 Queue Backlog         | Existing poison-message/acknowledgement blockage          | Temporary consumers versus scoped quarantine/dead-letter rule                                             | Retain exact 1.2.0 Scenario, worker/queue investigation and UNKNOWN evidence                            |
| INC-004 Memory Leak           | Retained request objects drive gradual memory pressure    | Instance restart gives a temporary window; allocation investigation enables disabling the leaking handler | Memory metrics, retained-allocation observations and deleted-log fragment; no AI/experiment explanation |
| INC-005 Unsigned Deployment   | Unregistered observer workload increases synthetic demand | Rate limiting temporarily reduces pressure; lineage/trace investigation enables isolating synthetic load  | Deployment lineage and deleted-log artifact; optional GHOST_ARTIFACT discovery                          |
| INC-006 Certificate Storm     | Rollover mismatch causes identity retry amplification     | Verified rollback versus chain comparison and coordinated trust repair                                    | Security report names NULL only after verified GHOST_ARTIFACT; no AI identity                           |
| INC-007 Synthetic Pressure    | Synthetic sessions exhaust shared capacity                | Capacity increase versus tagged-session/admission investigation and scoped rate limit                     | Discoverable attacker trace and UNKNOWN hint; no ADVERSARY origin                                       |
| INC-008 Route Drift           | Conflicting route generations cause cross-region timeouts | Router restart versus route-generation comparison and consistency repair                                  | Route metrics, trace, deployment evidence and find-me trail; no AI/experiment reveal                    |

Existing Scenario schema 1 can represent timed degradation with explicit timer
events, temporary windows, revealed scalar observations, authored flags/evidence,
resolution/completion and capacity-backed delegation. No new engine effect or
save field has been chosen. Operational observation strings belong in Scenario
signals/evidence/War Room data; document/trace/deployment rows belong in exact-version
presentation sidecars, never React story branches.

The draft table describes approved mechanisms, not implemented outcomes. Durations,
signal values, costs and recovery thresholds for new content must be authored and
later verified; they do not silently inherit fixture balance. Hidden campaign initial
values, opportunity classifications and ending thresholds remain separate decisions.

## Reveal and compatibility constraints

- Preserve existing current and legacy MVP YAML bytes. A campaign-only presentation
  does not imply changing any of their replay authorities.
- Preserve optional-clue routes: ordinary recovery/Act access cannot require every
  clue or unavailable behavior metric. Missing prior discovery must not cause
  Security/AI/experiment text or hidden action labels to leak through another view.
- Use declared campaign prerequisites for GHOST_ARTIFACT → NULL_NAME; do not fake
  inherited discovery, insert flags on mount or treat archive viewing as an input.
- If correct cross-Incident reveal execution cannot be represented using the approved
  contracts, stop at its architecture gate instead of adding a permissive fallback.
- Full-campaign assets remain outside the eager three-Incident MVP catalog. Partial
  content must not make a fixture or incomplete production campaign startable.
- Retries keep accepted history; authored campaign effects award once under exact
  approved identities. No automatic old-record attachment/migration.

## Pending version proposal

Propose initial `contentVersion: 1.0.0` for newly introduced INC-004–026 only;
INC-001/002/003 stay 1.1.0/1.2.0/1.2.0. Reuse retained source authorities rather than
revise them. New investigation sidecars use `<Incident-ID>-INVESTIGATION`, version
`1.0.0`. A new full-campaign definition and package each use ID
`orpheus-full-campaign`, version `1.0.0`, with Scenario/presentation schema 1 and
already approved record/replay 2. These are proposed identity/version names, not
authored model values, actual creation or acceptance.

Once shipped, those exact bindings must be retained immutable. Subsequent content/
presentation changes require newly pinned package/definition authorities; unsupported
older bindings diagnose without upgrade, replacement or deletion. Existing campaign
v1/v2 authorities remain unchanged. No production behavior/prediction/opportunity/
ending model version, defaults, thresholds or release are approved by this proposal.

## Remaining work

After explicit version approval, author the five new early Incidents and eight
presentation sidecars, then supporting campaign/replay data within approved contracts.
Prepare deterministic recovery/temporary-window/delegation/reveal/save/retry fixtures
but do not run the deferred QA or claim their result. Independent and native acceptance
must be restored before overall task/final M5 completion under applicable decisions.
