# Campaign effect application — TASK-018 review draft

Status: DEC-015 approves once-per-run authored discovery/narrative/completion
effects. This document specifies review and verification boundaries within that
decision; it is not an implemented schema or a completed task handoff.
Amounts, initial values, ranges and production balance remain unselected.

## Separate four identities

- A committed input identity distinguishes duplicate delivery from a genuinely
  new accepted command. Equal command bytes in different official attempts are
  not duplicate inputs under DEC-010.
- An event identity locates a verified newly emitted incident event in its
  attempt and accepted-command batch, using the explicit event sequence.
- A discovery/completion membership identity deduplicates campaign collections;
  membership does not prove a numeric effect has been applied.
- An authored effect identity names the same campaign effect across compatible
  content versions. Its application receipt is scoped to the campaign run, not
  the attempt or scenario version. Names must be unambiguous across authored
  definitions, without runtime incident-ID special cases.

The exact record fields/canonical representation require final contract review.
They must preserve the applicable definition version, effect semantics and the
first qualifying source input/event. New content versions do not automatically
reaward an existing identity. Conflicting semantics cannot silently replace an
existing receipt; changing definitions requires explicit compatibility treatment.

## Pure transition and committed receipt

For a verified new accepted-command batch, inspect only its newly emitted events
after the inherited boundary. Match validated authored predicates and effects in
deterministic recorded order. No hidden value follows automatically from an
event name, support message, operational risk or discovery title.

For each qualifying effect, consult its run-scoped receipt. If already applied
under compatible semantics, keep the new command/event and membership but do not
apply that numeric effect again; keep the first receipt's provenance. This normal
retry is not an input conflict and must not reject the player's new command.
If not applied, produce the authored delta and receipt together in the proposed
next state. The same effect appearing twice in one batch must still apply once.
Unknown references, unsupported definitions or conflicting identity/semantics
produce a diagnostic without publishing a partially changed official state.

The pure domain prepares a candidate without platform I/O. DEC-013 commits the
whole ledger record, including input identity, receipt and projection, in the
same revision-checked IndexedDB transaction. Official state is published only
after transaction completion. A failed or conflicted commit cannot leave an
acknowledged receipt without its state change. After an interrupted acknowledgement,
reconcile the committed input rather than applying the effect again.

This policy is not a once-per-run cap on incident simulation actions or costs.
Actual new action outcomes and resource/impact deltas continue to be recorded;
restored cumulative baseline totals must not be added again. A newly accepted
action still contributes its eligible behavior sample under DEC-014 even when an
associated discovery effect is suppressed by an existing receipt.

## Imports, baselines and review

DEC-011 imports source-verified discovery membership and provenance only. It
creates neither historical numeric effects nor fictional application receipts.
Imported membership may satisfy authored presence predicates but cannot itself
trigger an effect. A later genuinely new native event must independently satisfy
the authored predicates; only then may its still-unapplied effect be considered.
Do not manufacture that event by diffing membership or projecting old snapshots.

DEC-012 inherited commands/events and baseline resources are prerequisites, not
new observations. Timers that genuinely fire during a subsequently accepted
command can provide new outcome events; inherited completed events cannot.
Archive review, load, deterministic validation and repeated adoption add no award.
Completion requires a verified eligible new transition, not a completed checkpoint
or caller-supplied incident ID. Its membership stays distinct from effect receipts.

## Required fixtures (not executed against unimplemented APIs)

| Case                                                             | Required result / owner                                                                          |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| First qualifying event, then same effect on a new official retry | One effect application, both histories retained; TASK-019                                        |
| Same effect triggered by two events in one batch                 | One receipt and delta, deterministic ordering; TASK-019                                          |
| New retry command with an already-applied effect                 | Accepted action/eligible behavior still counted, simulation effects still executed; TASK-019/021 |
| Duplicate committed input or load/review                         | No new command, receipt or delta; TASK-019/020                                                   |
| Compatible content version change with stable effect identity    | No reaward; changed semantics require compatibility treatment; TASK-019/020                      |
| Explicit discovery import and inherited replay prefix            | Membership/provenance only, no fabricated effect or receipt; TASK-019/020                        |
| Genuine new native event after discovery import                  | Check native predicate independently; apply only if eligible and no receipt; TASK-019/020        |
| Unknown effect reference or conflicting semantics                | Diagnostic, no partial official update; TASK-019/020                                             |
| Transaction abort/conflict or commit-before-ack reload           | Receipt and state remain coherent; duplicate reconciliation, no reaward; TASK-020                |

These fixtures must use explicitly test-only definitions, not invent production
amounts or ending thresholds. Independent architecture review and acceptance QA
remain pending; existing incident tests cannot certify this proposed new API.
