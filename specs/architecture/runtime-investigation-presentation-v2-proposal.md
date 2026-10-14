# Runtime investigation presentation v2 — proposal, not executable authority

TASK-035 design under DEC-067, 2026-10-14. **Exact contract approval is pending.**
This document addresses REVIEW-NARRATIVE-01/P1 and REVIEW-WARROOM-02/P2 from the
independent review. It does not implement the correction, certify old/new gameplay,
resolve four timeouts/37 format failures, or approve native execution/release.

## 1. Source facts and scope

`projectCampaignInvestigation` verifies replay equality but projects only authored
paragraph/table/signal blocks. `CampaignTools` renders those blocks; production
INC-001 records `UNKNOWN_GOOD`, `JIN_ACK` and delayed `JIN_IMPACT_REPORT` without
presenting them. `selectWarRoom` in the standalone store already maps exact Scenario
messages, scheduled delegation and capacity; the engine may reuse a pure extracted
mapping, never import Zustand or UI. Extraction must preserve standalone output.

DEC-040 requires new package AND definition versions for changed pinned views.
The registry supports multiple exact identities. Ending prose explicitly checks
`definitionVersion`; it therefore also needs a new envelope, even with identical
text. New wall-clock presentation timers belong to UI only, never simulation/save.

## 2. Proposed immutable bindings

| Authority                          | Retained                                                        | Proposed new-only binding                             |
| ---------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------- |
| Package                            | `orpheus-full-campaign@1.0.0`, schema 1                         | Same ID `@1.1.0`, schema 1                            |
| Definition                         | Same ID `@1.0.0`, schema 1, record/replay 2                     | Same ID `@1.1.0`, same schemas/record/replay          |
| 26 investigation views             | `<INC>-INVESTIGATION@1.0.0`, schema 1                           | Same IDs `@1.1.0`, schema 2                           |
| Ending prose                       | Existing exact ID `@1.0.0`, schema 1, bound to definition 1.0.0 | Same ID `@1.1.0`, schema 1, bound to definition 1.1.0 |
| Scenario/model/effect/ending rules | Current exact authorities                                       | Reused unchanged; no model or numeric changes         |

Add new files alongside old: `definitions/campaign-1.1.0.yaml`,
`packages/campaign-1.1.0.yaml`, `presentations/inc-NNN-1.1.0.yaml` (26),
`ending-presentations/endings-1.1.0.yaml`. Do not copy duplicate Scenario authorities
into the catalog. Keep every old runtime/legacy/planning source byte unchanged.
The old blueprint manifest needs no change; both packages must independently
validate all 26 Incidents, nine Acts and ten endings, never an incomplete subset.

For the new definition only, change envelope version and definition-owned
`references[].version` AND all five `branches[].version` to 1.1.0 (the current
validator requires branch versions equal to their owning definition). Preserve
branch IDs, reveal/eligibility predicates and all embedded behavior/prediction/opportunity/
ending versions, reference identities, conditions, effects/receipts, initial values,
progression/retry policy and numerical data. New ending-prose envelope changes
only its version, `definitionVersion` and its own `references[].version`; reuse
the existing ending model and text/gates. Verify equality after removing only these
declared envelope/reference-version differences, not by a broad recursive rename.

Create/restore stays explicit. Creation buttons identify exact 1.0.0 and 1.1.0
packages without an automatic latest/default pick; label 1.0.0's known presentation
limitations outside story content. Restoring 1.0.0 always resolves its original
view; it does NOT gain runtime streams. Unsupported versions diagnose without
fallback. No imported history or automatic run upgrade; no physical DB/index change,
new save field, preference key, guidance ACK or presentation cursor persisted.

## 3. Strict view schema 2

Keep the schema-1 parser, output and behavior unchanged. A discriminated 1/2 parser
admits schema 2 only for exact new views. Schema 2 retains all current envelope,
panel/action/reveal and relation validation and adds two **explicit block kinds**:

```yaml
# Illustrative field contract only, NOT a registered runtime view.
kind: narrative_stream
id: INCIDENT_NARRATIVE_HISTORY
entries:
  - narrativeId: UNKNOWN_GOOD
    delivery:
      mode: transient
      durationMs: 800
      reducedMotionMode: until_dismissed
      historyMode: recorded
```

`narrative_stream.entries` is required and may be empty only when the exact Scenario
has no narratives. Every narrative must appear exactly once across this view's
streams; there is no implicit all-narratives wildcard, fallback text or TTL.
`delivery` is a strict union: `transient` requires integer `durationMs` 1–60000;
`until_dismissed` forbids that field. Both require `reducedMotionMode: until_dismissed`
and `historyMode: recorded`. Proposed initial authoring: ONLY INC-001's
`UNKNOWN_GOOD` uses transient 800 ms; every other narrative explicitly uses
until_dismissed. These are proposed presentation choices, not new trigger logic.

```yaml
kind: war_room_stream
id: INCIDENT_WAR_ROOM
messageIds: [MAYA_OPEN, JIN_OPEN, JIN_ACK, JIN_IMPACT_REPORT, OPERATOR_UPDATE]
delegationActionIds: [ASK_JIN_CONFIRM_IMPACT]
capacityResourceIds: [TEAM_CAPACITY]
```

All three arrays are required, unique and may be empty only if their source set
is empty. Across war-room streams, exact coverage is required for Scenario messages,
actions declaring delegation, and the unique resources those declarations name.
Initial and delivered messages are one chronological stream, not duplicate static
opening paragraphs. Capacity exposes ONLY explicitly declared team-delegation
resources, never campaign hidden values or unrelated operational-risk/cost scores.

New stream blocks must be placed in authored `logs` or `war_room` panels,
respectively. INC-001–003 place narratives in `observations`; INC-004–025 in `logs`.
INC-001–025 place the War Room stream only in `team`; the additional INC-006
`security-attribution` panel retains its existing distinct predicates/content.
Retain existing panel predicates/actions; do not infer panel membership by title
text or weaken reveal gates. In new `team` views, replace exactly the paragraph
blocks whose IDs and text both match authored initial War Room messages with the
stream. Retain unrelated explanatory blocks; do not delete text by keyword.
Narrative history and fresh delivery use
the SAME block/panel visibility checks. Reject multiple placements of a narrative,
duplicate initial/delivered message references or ambiguous stream ownership.
Schema 1 rejects both new kinds/fields. Unknown schemas, fields, IDs, role mappings,
references, duration/range values and incomplete coverage reject admission before
official creation. Missing runtime references diagnose with no raw ID/body leakage.

INC-026 has no existing `logs`/`war_room` panels; all existing action panels require
`FINAL_DECISION_COMMITTED=false`. Add only to its new schema-2 view two read-only
panels: `runtime-narratives` (title `Recorded runtime narratives`, kind `logs`) and
`runtime-war-room` (title `War Room event history`, kind `war_room`). Both have
`actionIds: []`, Scenario reveal `[resource CUSTOMER_IMPACT gte 0]` and campaign
reveal `compare CURRENT_ACT gte 9`. Both remain visible before AND after final
completion. Narrative body membership still requires an actual recorded trigger;
noninitial messages still require recorded message events. These gates do not
expose untriggered final decisions or unlock actions. Keep all existing INC-026
action-panel conditions/content untouched. Empty delegation/capacity arrays are
explicitly valid for this Scenario, which has no delegated actions. This additive
final-history visibility choice is part of the proposed human approval, not a fix
applied to 1.0.0.

## 4. Pure verified projection

Input remains the exact resolved package, verified run and selected attempt ID.
Replay equality and exact Scenario/view matching precede output. No observer payload
alone is authority. Schema 1 returns the existing static result unchanged; schema 2
projects authored streams from the selected verified attempt.

- Narrative text/title comes from the exact Scenario entry only after a matching
  `narrative_triggered` event with that `sourceId`. Output uses a stable tuple of
  run ID, attempt ID, event sequence and narrative ID; expose simulation timestamp.
- Initial War Room messages use exact authored roles/text at simulation T+0,
  followed by recorded `war_room_message` events in sequence order. Do not invent
  event sequence IDs for initial entries; use distinct `initial` identity keys.
- Pending delegations come only from current `scheduledWork.timer_event` entries
  matched to the authored delegation action/event/role. Due time is simulated
  `dueAtSeconds`; remaining ETA is max(0, due minus selected elapsedSeconds), not
  a ticking real-time countdown. Show actual selected resource value/max, not a
  default zero for missing capacity. Unknown/missing mapping invalidates the block.
- Histories are deterministic read-only projections. Archive uses the selected
  attempt's local events/state, with current verified campaign knowledge for the
  authored campaign gate, as the existing projector does. Label it historical.
  Later knowledge does not manufacture an earlier event/exposure/sample.
- Navigation, dismissal, timing, reads and archive issue no command/ACK, grant no
  evidence/effects/behavior and never create an audio cue. Real trigger/evidence
  persistence remains the existing deterministic command/replay path.

## 5. Fresh live delivery and lifecycle

Reuse `subscribeCommitted` solely as a signal that an exact operation was durably
published. Its current suffix payload is NOT proof of operation ownership: after
a lost ACK and another writer's later command, duplicate reconciliation can return
a newer whole record and a suffix containing another command's events. A new-only
consumer matches the complete canonical operation against verified history and
replays prefixes immediately before/after that operation. The exact selected
attempt's event-log delta between those prefixes defines the operation's owned
events. Reject supplied events outside that interval (including genuine but
foreign events), rather than accepting current-history membership alone. Match
the owned event tuple against the verified schema-2 view; never skip verification.
Only `narrative_triggered` events from
new accepted command inputs beyond `baselineEventCount` are candidates. Creation,
checkpoint inherited prefix, adoption, queries and successful read/load are not
fresh deliveries. Failed writes, conflict, unconfirmed ACK or forged payload yield
no alert. Fresh delivery additionally requires that the signalled operation is the
currently published verified head, newer than the consumer's verified read/mount
boundary, for the current live attempt. Same-identity retry may deliver ONCE when
first verified publication is known and these constraints hold. A stale retry
returning later operations is history-only; after publication, duplicates never
redeliver. This does not change command/effect receipt or prior audio behavior.

No new prediction exposure is recorded by this notification. Opportunity visibility
ACK remains the separate existing explicit user-confirmation operation.

Use an ephemeral delivery-key set including definition identity/version, run,
attempt, event sequence and narrative ID, FIFO queue and injected UI clock/timer.
It is not serialized. Process events in sequence, one visible notice at a time. A duration
starts after that notice's first rendered visible frame, never while queued. Normal
INC-001 flash lasts 800 ms; accessible reduced-motion mode holds it until dismissed.
Other notices always wait for dismissal. Dismissal changes UI only; later notices
are not lost because one received an authored transient duration.

All legitimately triggered bodies remain available in the gated historical stream
after dismissal/expiry. This is an explicit new-version recoverability choice;
never claim to have recovered a missing original log body in an old pinned view.
The fleeting notification is optional atmosphere, not the only way to read a clue.
Use a labelled nonmodal region and persistent history link; do not steal keyboard
focus or use aggressive alert announcements. Reduced-motion holds readable content;
native Narrator behavior requires its separate real verification.

Lifecycle resets: successful verified load/read, attempt/run/package switch,
archive entry, document hidden, exit or unmount clear notices/queue and cancel UI
timers; returning never replays a fresh alert from history. Unseen hidden/gated
events stay only in history, not deferred flashes. Old timer callbacks must fail
an epoch check before touching state. Dropping/resetting a notice retires its key,
not its recorded history. Retain retired identities until that consumer unmounts;
on mount/successful verified read/reset, establish a new ephemeral floor at the
current verified revision so callbacks at or before it cannot become fresh. On
hidden/archive/reset, include all currently verified history in that floor, not
only previously delivered items. Reject stale subscription epochs. Reload does not create a new delivery cursor
in storage. Add a transient `subscribeReadBoundary` notification after a successful
explicit verified load (including verified not-found); it is not emitted by commit
publication, and has no saved-field/canonical-operation counterpart. A failed load
does not turn a stale/unverified run into a new notification source.

If reduced-motion turns on during a transient notice, cancel its timer and hold it
until dismissal. Turning it off does not shorten an already-held notice; apply the
new setting only to later notices. Panel gate closure drops its affected notices;
other queued visible notices may proceed, with no hidden ID/body output.

## 6. Verification matrix before implementation acceptance

| ID  | Required proof                                                                                                                                                                           |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V1  | Original source-byte inventory/old views/old record replay unchanged, no schema-2 attachment                                                                                             |
| V2  | Exact mixed catalog 1.0/1.1 admission, explicit creation, pinned restore, ending-prose rebinding and no latest/missing fallback                                                          |
| V3  | Strict schema union; wrong IDs/fields/schema/TTL/duplicate owners/incomplete coverage/role and resource mappings rejected; explicit INC-026 new panels validate                          |
| V4  | New definition/model/effect/ending equality except explicit envelope/reference/branch versions; default MVP untouched                                                                    |
| V5  | Real production INC-001 trigger: pre-trigger no body; recorded Good available afterwards; no UI hardcoded text; INC-026 final narratives remain gated and readable after completion      |
| V6  | Real Jin ACK at0, report at120; before-due absence, genuine pending ETA/capacity and after-due removal                                                                                   |
| V7  | Same-command transient scheduling, ordered multiple narratives, first-visible-frame duration and duration boundary                                                                       |
| V8  | Reduced-motion, keyboard/dismissal/history access, mode-change, no forced focus, hidden/gated cancellation                                                                               |
| V9  | Successful load/archive/history equivalence including completed INC-026, no fresh alert/cue/sample, no auto-resume after reset                                                           |
| V10 | Abort/conflict/lost ACK plus concurrent later command, operation-prefix event ownership, stale head/read floor, duplicate callback/stale epoch and forged existing/foreign event silence |
| V11 | Baseline checkpoint/adoption no fresh notices; genuine new retry event allowed; records/receipts remain unchanged by UI                                                                  |
| V12 | Required full regression/format/performance and independently attributed current evidence; native/install separately scoped                                                              |

Test notifications with injected UI clocks, never fake the simulation clock or
raise existing test/budget limits. Use actual exact packages/accepted events for
production proofs, not only isolated score predicates. Adding verified projections
does not authorize skipped replay/validation caches or optimizations. Existing
four timeouts, 37 format failures, missing full routes, M4 restoration/TASK-025,
long/native budgets and rights clearance remain acceptance blockers.

## 7. Approval and implementation boundary

DEC-067 authorizes DESIGN AND REVIEW only. Obtain separate approval of the exact
1.1/schema-2 bindings, explicit 800 ms/readable-history choice, new transient read
observer and verification matrix before altering runtime/schema/content.
Then implement only approved new authorities plus additive version-gated parsing/
projection; independently verify old/new behavior and evaluate tasks through Project
OS. No native/app/install/profile execution, status completion, push or release is
implied by contract approval. Any further material choice returns to its own gate.
