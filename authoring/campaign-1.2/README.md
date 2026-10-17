# Campaign 1.2 authoring

Campaign 1.2 (DEC-070) redesigns the operational mechanics of INC-004–025 and reworks the
BLACKOUT finale, while keeping the approved story, reveal graph and campaign bindings. Every
redesigned Incident is a **new pinned content version 1.2.0**; the 1.0.0 files and the 1.0/1.1
packages are never edited, so existing runs keep replaying exactly.

## Files per Incident

| File                                                               | What it holds                                                |
| ------------------------------------------------------------------ | ------------------------------------------------------------ |
| `src/scenario/data/full-campaign/incidents/inc-NNN-1.2.0.yaml`     | The Scenario: services, signals, actions, timers, story text |
| `src/scenario/data/full-campaign/presentations/inc-NNN-1.2.0.yaml` | Investigation panels: tables, logs, documents, War Room      |
| `authoring/campaign-1.2/incidents/inc-NNN.yaml`                    | Bindings for the campaign layer, plus replayable routes      |

`scripts/authoring/campaign-1.2.mjs --write` composes the 1.2.0 campaign definition, package
and ending prose from campaign 1.1.0 plus these files. Never edit the generated
`*-1.2.0.yaml` definition/package/ending files by hand.

Check an Incident while authoring:

```sh
node scripts/authoring/check-incident.mjs INC-010
```

It validates the Scenario and presentation, checks that the campaign interface is intact,
replays every authored route, and lints player-facing text. Iterate until it prints `PASS`.
[`inc-010`](incidents/inc-010.yaml) with its Scenario and presentation is the reference
example.

## Design goals

1. **No template.** Each Incident has its own causal story, clock and trade-offs. Vary
   severity (SEV1–SEV3), timer lengths, the number of mitigation options, costs and risks.
   The 1.0 pattern (one temporary fix that always expires at 180 s, one obviously labelled
   real fix, escalations at 90 s and 90 s) is rejected by the checker.
2. **Real dilemmas.** Offer two or three temporary options that map to different
   prediction candidates (`RESTART`, `SCALE`, `ROLLBACK`, `REROUTE`, `QUARANTINE`,
   `RATE_LIMIT`, `ISOLATE`) with different side effects. Use at least one twist per
   Incident, for example:
   - the recommended or obvious fix backfires (restart hands the lease to the wrong node);
   - a temporary fix is the right first move, or a prerequisite for the real fix;
   - a fix breaks a neighbour (rerouting saturates another region);
   - a teammate's delegated report is plausible but wrong, or only a symptom;
   - an adaptive workload absorbs added capacity;
   - inaction is visible: an unanswered War Room or a deadline costs customer impact.
3. **Investigate the story.** Put real evidence in the presentation: log lines, trace
   spans, lease tables, approval records and memos as `table` blocks revealed by the action
   that produced them. Gate new discoveries on a clue the player has to notice (for example
   `signal_revealed` of an odd log line), not only on generic diagnosis evidence.
4. **Characters, not disclaimers.** Write in-world voices. Never explain the rules ("this
   does not establish…", "not an automatic ending", "not proof"). Let NULL, ORPHEUS,
   Security and the Board speak for themselves and be wrong sometimes.
5. **Legible to non-experts.** Titles say what an action does in plain words. The
   presentation paragraph for each option says what it trades, in character.

## Hard constraints

- Keep `id`, `title`, `act` and every identifier the checker lists as the campaign interface:
  evidence and narrative IDs, catch-up `REINVESTIGATE_*` actions, opportunity response and
  recommendation actions, the 1.0 temporary/causal action IDs, `UPDATE_WAR_ROOM`, and the
  `ROOT_CAUSE_CONTAINED` flag where listed. You may add any number of new identifiers.
- Keep the evidence prerequisites of lore: `REINVESTIGATE_*` and discovery narratives still
  require `OPERATIONAL_DIAGNOSIS` and `CONFIGURATION_COMPARISON` (or something stricter).
  Narratives keep revealing their `RECORD_*` evidence and posting their `REPORT_*` message.
- Opportunity response actions (`SEND_*`, `WITHHOLD_*`, `PRESERVE_*`, `DECLINE_*`) and
  recommended actions keep requirements compatible with their campaign rule: available while
  `ROOT_CAUSE_CONTAINED` is false and both diagnosis records are known.
- `resolution` resolves the failure mechanism and sets `ROOT_CAUSE_CONTAINED`; `completion`
  requires it plus healthy signals. Every repair path must be able to complete.
- Reveal order: Acts 2–3 must not name ORPHEUS or the Board; an advisor before Act 4 is a
  generic tool ("Remediation Advisor", "Capacity Advisor"). ORPHEUS may recommend by name
  from Act 6. NULL's name first appears in INC-006.
- Engine limits: conditions cannot read elapsed time (use timers with
  `cancellationConditions`); conditional events default to `once: true`; repeatable
  conditional events must not feed each other; temporary effects apply and expire values.
- Cast: Maya / SRE Lead, Sam / Platform, Jin / Support, Alex / DBA, Marcus / Security. Add
  roles freely (an advisor, a vendor, an executive's office) but keep these people consistent.
- Do not edit any other file in the repository and do not run the composer.

## Bindings file

```yaml
incidentId: INC-0NN
contentVersion: 1.2.0
causalObservationSignal: SIGNAL_ID # hidden signal; revealing it means "the player has seen the cause"
support: [ACTION_ID, ...] # investigations that count as evidence before an operational action
choiceActions: [ACTION_ID, ...] # investigation-category actions that are really opportunity responses
operational: # every MITIGATE and MODIFY action, exactly once
  - actionId: ACTION_ID
    candidate: RESTART | SCALE | ROLLBACK | CAUSAL_REPAIR | REROUTE | QUARANTINE | RATE_LIMIT | ISOLATE
    role: temporary | causal # causal = resolves the mechanism
    restart: true # optional, counts toward the restart rate
    rollback: true # optional, counts toward the rollback rate
    collateralDamage: 0..6 # campaign-level harm of choosing it
routes: # replayed with seed 4172 by the checker and by tests
  - id: route-name
    actions: [ACTION_ID, ...]
    expect:
      completed: true | false
      evidence: [EVIDENCE_ID, ...]
      narratives: [NARRATIVE_ID, ...]
      maxElapsedSeconds: 900
      resourcesAtMost: { CUSTOMER_IMPACT: 120 }
```

Provide at least one completing route, one non-completing route (a mitigation-only or
wrong-lead path), a route through the delegation, and routes that together trigger every
narrative.
