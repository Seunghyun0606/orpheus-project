# TASK-032 — Additional recommendation authoring checkpoint

## Completed

DEC-056 records the human's approval of the exact three rules at `debc698`.
[Recommendation bindings](../.project-os/planning/TASK-032.recommendation-bindings.yaml)
contain the authored LOGISTICS_CAPACITY, PUBLIC_ALLOCATION and REGIONAL_CONTAINMENT
recommendations for INC-018/022/025. The full rule IDs retain the approved
`_RECOMMENDATION` suffix.

Append `rules_extension` to the unchanged seven rules in
`.project-os/planning/M5/models/orpheus-player-opportunities.yaml` when composing
the **complete new** `orpheus-full-campaign` authority. This yields ten opportunity
rules and four recommendations across INC-015/018/022/025. The envelope is planning
metadata, not a new runtime schema or an independently startable model/package.
Keeping the original seven-rule source unchanged also preserves historical
eighteen-Incident unit compositions; they must not silently load later-only rules.

Each new rule requires its approved Act and known flag plus current local diagnosis,
configuration comparison and an uncontained mechanism. All lifecycle trees use
factual observations, not optional unsampled rates. Continuing validity includes
age 0 through 180 seconds; response eligibility is checked before the command
advances time. A real preparation/visible ACK precedes the next eligible response.
The recommended action is positive and its alternative negative; neither label
means correct/incorrect. No ACK, expiry or an unrelated action yields no sample.

The advisory text distinguishes temporary continuity from repair and retains Board
pacing: no SOFT CONTROL reveal or invented confidence. No Scenario, presentation,
behavior/prediction classification, action duration/cost or service consequence was
changed. No numerical award, ending grant, actual native exposure or complete
campaign acceptance is supplied here.

## Changed files

- DEC-056 and TASK-032's active decision references.
- `TASK-032.recommendation-bindings.yaml`: exact three-rule extension.
- `src/tests/additional-recommendations.test.ts`: deferred lifecycle/structure tests.
- Implementation/evidence documents and the separately unapproved numeric proposal.

## Tests

Authored tests check the unchanged seven-plus-three composition, exact action
consequences, factual/Act/known-discovery gates, ACK/positive/negative responses,
direct no-ACK recovery, inclusive expiry, unrelated commands, retry and duplicate
delivery, and pooled four distinct recommendation observations with no automatic
dependency score or ending. The isolated fixtures explicitly initialize known
flags/Act and simplify progression for lifecycle testing only; they do **not**
prove real story provenance, native exposure or full-campaign reachability.

**No tests, validator, typecheck, lint, build, native QA, independent review or
evaluation were run.** Mechanical formatting and read-only source inventory are
not passing verification evidence. QA remains deferred, not waived.

## Known risks / remaining work

The rules are authored fragments until the complete production definition is
composed. Full reveal/progression, actual UI ACK and durable restoration remain
unverified. The DEC-055 engine candidate also awaits all mandatory regression QA.
TASK-031/032, M4 and final M5 acceptance remain incomplete. There is no push or
release authority.

The next material decision is the
[initial numeric balance](TASK-032_NUMERIC_BALANCE_PROPOSAL.md): weights, exact
ending conditions and equal priority. It is a proposal only. Conditional epilogue
representation/gates and a future ending-grant transition remain separate decisions.
