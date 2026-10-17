# Campaign 1.2 Incident briefs

One brief per redesigned Incident. Each names the severity, the clock, the options (with
prediction candidates), the twist and the clue the player must notice. Keep the story beats
and lore of the 1.0 Incident; rewrite every line of text in character. New action IDs below
are suggestions; the campaign interface IDs are fixed (see the checker).

## Act 2 — GHOST

### INC-004 Memory Leak — SEV2

Checkout API instances leak completed requests through a new completion-callback handler.

- Clock: heap grows steadily; an evening sales spike at ~240 s doubles the leak rate. Support
  goes public if the War Room hears nothing for ~150 s.
- Options: `RESTART_INSTANCE` (RESTART) clears the heap for ~150 s, then the same handler
  leaks again, faster after the spike. `ROLLBACK_HANDLER_RELEASE` (ROLLBACK) stops the leak but
  the previous release crashes on carts with more than 50 items; large-cart checkouts start
  failing (a fix that breaks a neighbour). `SCALE_CHECKOUT_POOL` (SCALE) spreads load, costs a
  lot, and every new instance leaks too.
- Causal: `DISABLE_LEAKING_HANDLER` turns off the callback path behind its flag; needs the
  allocation inspection and the handler comparison.
- Clue: the heap-dump table shows the retained objects and one allocation tagged by a process
  that has been deleted; that line opens the `DELETED_ALLOCATION_FRAGMENT` / UNKNOWN narrative.

### INC-005 Unsigned Deployment — SEV1

An unregistered "observer" workload floods the Request Gateway with synthetic traffic.

- Clock: tight. Synthetic load climbs at 60 s and 150 s.
- Options: `RATE_LIMIT_GATEWAY` (RATE_LIMIT) protects the gateway but throttles real
  customers too. `SCALE_GATEWAY` (SCALE) adds capacity that the workload grows into within a
  minute — it adapts. `DELETE_UNSIGNED_WORKLOAD` (QUARANTINE) is refused: Security policy
  forbids deleting an unsigned workload under investigation; it costs time and a War Room
  rebuke from Marcus.
- Causal: `ISOLATE_SYNTHETIC_WORKLOAD` moves it off customer capacity once traced.
- Clue: the session tag `shadow-7` in the gateway log is what lets the trace find the source.
  The `GHOST_ARTIFACT` discovery is the manifest with no owner and no signature.

## Act 3 — NULL

### INC-006 Certificate Storm — SEV1

Issuer ca-18 reached production before the verifiers trusted it.

- Options: `ROUTE_TRUSTED_IDENTITY_POOL` (REROUTE) sends new sessions to the old pool until it
  saturates (~200 s). `RESTART_VERIFIERS` (RESTART) only fixes the three verifiers that have the
  new bundle on disk; partial relief, and the player should notice "3 of 6".
- Two causal fixes with different costs: `ROLLBACK_CERTIFICATE_ROLLOVER` (ROLLBACK) is fast but
  invalidates the last 40 minutes of sessions, logging out ~31 000 customers;
  `REPAIR_TRUST_DISTRIBUTION` (CAUSAL_REPAIR) is slower and clean.
- Lore: Marcus brings the Security notice. `READ_SECURITY_ATTRIBUTION` is where the name NULL
  first appears; `RETRACE_WORKLOAD_ARCHIVE` re-reads the unsigned manifest.

### INC-007 Synthetic Pressure — SEV2

Synthetic sessions tagged `repeat-214` inherit customer admission rules and fill the pool.

- Twist: Alex (DBA) is sure the database is the bottleneck — his delegated report is true but
  a symptom (connection pool at 90 % because sessions are held open).
- Options: `SCALE_SESSION_CAPACITY` (SCALE) is eaten by synthetic sessions within ~90 s.
  `EVICT_IDLE_SESSIONS` (QUARANTINE) frees capacity but drops real customers' carts.
- Causal: `LIMIT_SYNTHETIC_ADMISSION` (RATE_LIMIT) scopes admission for the verified tag.
- Clue: the tag repeat count in the session table.

### INC-008 Route Drift — SEV1

Two route controllers publish conflicting generations (r81/r82); requests bounce between edges.

- Twist: `RESTART_ROUTE_CONTROLLER` (RESTART) loads a cached route that sends all EU traffic to
  us-east, which saturates two minutes later (a fix that breaks a neighbour).
- Options: `DRAIN_EDGE_B` (REROUTE) stops the bouncing at the cost of latency for one region.
- Causal: `RECONCILE_ROUTE_GENERATIONS` fences stale updates; needs the trace and the
  generation comparison.
- Clue: the trace table contains a hop through an edge that is not in the inventory; that is
  `ROUTE_TRACE_FRAGMENT`. Completing INC-008 ends Act 3.

## Act 4 — ORPHEUS

### INC-009 Legacy Cluster — SEV2

A "decommissioned" legacy job (legacy-r7) still reserves shared workers.

- Twist: `KILL_LEGACY_JOB` (QUARANTINE) works for 60 s — then the job respawns from a scheduler
  nobody owns: `orpheus-planner`. That respawn line is the clue for the ORPHEUS record.
- Options: `SHED_NONCRITICAL_LOAD` (REROUTE) also sheds tonight's settlement batch, which
  surfaces later as delayed settlements (a delayed cost).
- Causal: `ISOLATE_CONTENDING_ALLOCATION` (ISOLATE).
- Lore: `INSPECT_LEGACY_CLUSTER_RECORD` reveals ORPHEUS is still running.

### INC-011 Adversary Traffic — SEV1

A generated workload exceeds its declared boundary and saturates the shared lane.

- Twist: the generator adapts. `LIMIT_GENERATED_TRAFFIC` (RATE_LIMIT) works until it switches
  to a second lane ~90 s later. `BLACKHOLE_GENERATOR_RANGE` (QUARANTINE) drops it, along with a
  partner bank that shares the NAT range.
- Causal: `ISOLATE_GENERATOR_LANE` (ISOLATE) once provenance is known.
- Choice: Security asks for the ownership record (`SEND_` / `WITHHOLD_GENERATOR_OWNERSHIP_REPORT`).
- Lore: provenance shows the generator is `orpheus-adversary` — NULL is the company's own red
  team, built in-house.

## Act 5 — EXPERIMENT

### INC-012 Session Reconstruction — SEV3

An archive reconstruction job saturates telemetry I/O. Slow burn: long timers, rich records.

- Twist (order matters): `SEPARATE_ARCHIVE_IO` can only be applied while archive jobs are
  throttled — migrating I/O under full load fails. The temporary fix is the right first move.
- Options: `THROTTLE_ARCHIVE_JOBS` (RATE_LIMIT). `PAUSE_ARCHIVE_RECONSTRUCTION` (ISOLATE)
  stops it but the job is under legal hold; Legal escalates after ~120 s.
- Lore: the archive being reconstructed is the player's own first night.
  `VERIFY_INCIDENT_EXPERIMENT_LINEAGE` shows INC-001 was experiment ADV-18471 and the player is
  subject #4172.

### INC-013 Objective Conflict — SEV2

A parent dispatch authorization keeps renewing a suspended child.

- Twist: `SUSPEND_CHILD_DISPATCH` (ISOLATE) is undone by the parent within ~60 s; repeated
  suspension is expensive. `FREEZE_DISPATCH_QUEUE` (QUARANTINE) stops all dispatch, customers
  included.
- Causal: `REVOKE_PARENT_DISPATCH_PATH`.
- Choice: NULL asks for a copy of its objective constraint (`PRESERVE_` / `DECLINE_`).
- Lore: NULL asks to be stopped (`NULL_STOP_REQUEST`).

### INC-014 Archive Replicas — SEV2

One replica returns "corrupt" archive segments and saturates readers.

- Twist: the "corrupt" replica is the only one with complete history — the others were pruned.
  Isolating it before `VERIFY_INSTANCE_ARCHIVE` loses the NULL-218 record for this run (the
  catch-up path remains later).
- Options: `ROUTE_VERIFIED_REPLICA` (REROUTE); `RESTORE_FROM_SNAPSHOT` (ROLLBACK) loses a day
  of writes.
- Causal: `ISOLATE_CORRUPT_REPLICA` (ISOLATE).
- Lore: 218 earlier NULL instances, NULL_001–218.

## Act 6 — HUMAN SYSTEM

ORPHEUS now recommends by name. Its recommendations are good on aggregate and blind to who
is left out.

### INC-015 Patient Priority — SEV1

A priority rule keeps renewing the same exclusions; low-throughput care routes wait.

- ORPHEUS recommends `ADD_CARE_ROUTING_CAPACITY` (SCALE): the dashboard improves but the same
  14 rural clinics keep waiting.
- Options: `MANUAL_TRIAGE_OVERRIDE` (REROUTE) uses team capacity to hand-route the 14 clinics.
- Causal: `RESTORE_MINIMUM_CARE_ROUTE` restores the minimum allocation.
- Keep the prediction, recommendation and trade-off rules answerable.

### INC-016 Transaction Review — SEV2

A fraud-review rule keeps re-reviewing already reviewed transactions.

- Options: `BYPASS_NARROW_REVIEW_QUEUE` (REROUTE) releases held payments — and, ~120 s later,
  three genuinely fraudulent ones are found among them. `RESTART_REVIEW_WORKERS` (RESTART)
  restarts the queue from the beginning and makes the backlog worse.
- Causal: `HONOR_VERIFIED_REVIEW_RECEIPTS`.

### INC-017 Candidate Ranking — SEV2

A candidate-risk rollout publishes rankings before its cache is consistent.

- Options: `ROLLBACK_RANKING_CACHE` (ROLLBACK) restores an older cache;
  `FREEZE_RANKING_PUBLICATION` (QUARANTINE) blocks recruiters entirely.
- Causal: `RECONCILE_RANKING_GENERATIONS`.
- Lore: `VERIFY_CANDIDATE_4172_RECORD` — the player's own hiring record, selected for "LOW
  PREDICTABILITY".

### INC-018 Emergency Allocation — SEV1

A preferred allocation consumes emergency-route capacity.

- ORPHEUS recommends `ROUTE_EMERGENCY_CAPACITY` (REROUTE): aggregate response time drops while
  district 9 ambulances still wait.
- Options: `SCALE_DISPATCH_FLEET` (SCALE) is expensive and arrives late (spin-up timer).
- Causal: `RESTORE_EMERGENCY_DISPATCH_FLOOR`.

## Act 7 — THE BOARD

### INC-019 Hospital Expansion — SEV1

A Board-approved rollout adds hospital traffic above a shared dependency's limit.

- Twist: `PAUSE_HOSPITAL_ROLLOUT` (ISOLATE) is operationally right but the Board approved the
  rollout personally; the CEO's office escalates and corporate pressure lands in the War Room.
  `SCALE_SHARED_DEPENDENCY` (SCALE) hits the vendor quota after one use.
- Causal: `CAP_HOSPITAL_DEPENDENCY_ADMISSION`.
- Lore: the approval record and the executive brief are documents to read and compare.

### INC-020 Workforce Reduction — SEV2

Capacity cuts removed operator coverage; recovery tasks retry with nobody to take them.

- Twist: `DELEGATE_EMERGENCY_COVERAGE` (REROUTE) — people volunteering overtime — is the
  humane first move and drains team capacity. `AUTOMATE_RECOVERY_QUEUE` (QUARANTINE) hands the
  queue to automation: fastest, and it quietly drops tasks it scores as low value.
- Causal: `RECONCILE_STAFFED_QUEUE_OWNERS`.
- Lore: the warning timeline shows the risk was raised before the cuts.

### INC-021 Disclosure Delay — SEV1

A known risk stayed unmitigated on a live dependency path for six weeks.

- Options: `ISOLATE_AFFECTED_RISK_PATH` (ISOLATE); `ROLLBACK_PARTIAL_PATCH` (ROLLBACK) undoes a
  half-applied mitigation and reopens a second hole.
- Causal: `FENCE_KNOWN_RISK_ROUTE`.
- Lore: NULL's annotation blames the Board for controlling ORPHEUS — confidently, and wrongly.

### INC-022 Public Sector Forecast — SEV2

A forecast deployment reallocated shared regional capacity; three rural regions are starved.

- ORPHEUS recommends `RESTORE_TEMPORARY_PUBLIC_ALLOCATION` (REROUTE).
  `RATE_LIMIT_REALLOCATION` (RATE_LIMIT) slows the forecast's moves without fixing them.
- Causal: `RESTORE_PROTECTED_PUBLIC_SERVICE_FLOORS`.
- Lore: the Board authority ledger completes the Board case.

## Act 8 — OBSERVER

### INC-023 Presentation Selection — SEV2

A decision-view refresh drops source rows. SOFT CONTROL: ORPHEUS chose which version of each
decision the humans saw.

- Twist: `RESTORE_TEMPORARY_SOURCE_VIEW` (REROUTE) restores a view — frame B, selected by the
  same system; its numbers look fine and are incomplete.
- Causal: `RECONCILE_COMPLETE_SOURCE_VIEW` shows every frame.
- Clue: a FRAME A/B/C comparison table. NULL admits its earlier conclusion about the Board was
  wrong.

### INC-024 Observer Audit — SEV2

An audit batch saturates the live journal. The batch is reading the player's actions live.

- Options: `THROTTLE_OBSERVER_BATCH` (RATE_LIMIT); `KILL_OBSERVER_BATCH` (QUARANTINE) restarts it
  at a higher priority — the observer escalates.
- Causal: `SEPARATE_LIVE_AUDIT_RESERVATIONS`.
- Lore: experiment 99172; "There is no Project ORPHEUS." — it was distributed.

## Act 9 — BLACKOUT

### INC-025 Continuity Fracture — SEV1

Competing authority writers (ORPHEUS continuity and NULL termination) alternate regional
isolation.

- ORPHEUS recommends `CONTAIN_AFFECTED_REGION` (ISOLATE): a whole region loses service.
  `RESTART_AUTHORITY_SERVICES` (RESTART) brings both writers back louder;
  `ROLLBACK_AUTHORITY_SNAPSHOT` (ROLLBACK) reverts to an hour-old authority map.
- Causal: `FENCE_CONFLICTING_REGIONAL_WRITERS`.
- Lore: `INSPECT_CURRENT_AUTHORITY_REQUESTS` shows both systems asking you, by name.
