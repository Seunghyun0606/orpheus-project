# Ending resolution — TASK-018 review draft

## TASK-023 developer implementation checkpoint

DEC-032 approves optional ending rules in new immutable campaign definitions only.
The [developer candidate](../../docs/TASK-023_IMPLEMENTATION.md) implements strict
`endings` data and the pure `resolveCampaignEnding` query. Existing definitions
without ending rules retain exact authority/record shapes; no old-run attachment,
storage migration or latest-version substitution is implemented.

`endings` declares schema version 1, ID/version, optional exact behavior/prediction
model versions, `finals` mappings and `entries`. A final mapping declares an allowed
incident/content version, typed source/key references and an explicit `eligible`
tree. Entries have unique IDs, model version, condition and nonnegative safe-integer
`priorityRank`. Every mapping validates every entry; no file-order winner exists.

The query verifies whole-record replay and an explicitly requested attempt/head,
with completion reached outside its inherited baseline. Current campaign context
and that final attempt's state are derived from the record. `action` observations
use only newly accepted commands in the selected attempt, with operation/input
provenance, not inherited command prefixes or another attempt's history. Known
imported discovery membership can satisfy campaign presence conditions under
DEC-011, but imports cannot manufacture final completion or actions.

Results are resolved, ambiguous, no-match or diagnostic. Invalid/unavailable
conditions block selection even at a lower priority or beneath a false final gate.
A false valid final eligibility is diagnostic rather than successful no-match.
Evaluation is read-only and introduces no ending grant/operation or player UI.
All ten ending fixtures are test-only; their simulated recovery is not a requirement
that all future production ending choices restore service health. Actual final
completion criteria remain authored scenario data.

Developer verification passed 70 ending tests and 380 full-suite tests with one
worker and unchanged timeouts; the report retains a default parallel UI timeout.
Independent
review, acceptance QA and distinct evaluation are still pending; TASK-023 is active.
The historical draft below describes the approved logical baseline, not a claim
that the new candidate has independent acceptance or production content.

## Original logical baseline

Status: DEC-019 approves unresolved top ties and no-match without automatic
endings. This document specifies review, replay and fixture boundaries within
that decision; no resolver, save field or production ending content is implemented.
The proposed priority and typed-condition representation now appears in the
[definition interface draft](campaign-definition-contract.md). Independent
review and production balance remain separate obligations.

## Explicit context and definitions

The pure resolver consumes validated campaign state, final incident state,
final actions and recorded authored ending-definition versions. These inputs
must be explicitly related to the official run/final attempt, not selected from
an arbitrary archive snapshot. Imported discoveries are usable only under the
approved presence rules; they do not supply final completion or missing behavior.

Definitions name ending IDs, conditions and priority precedence. Validate all
flag/evidence/action/model references and supported versions before resolution.
No ordering derives from file layout, object keys, alphabetic IDs or the UI.
The proposed candidate representation is `priorityRank`, a nonnegative safe
integer with smaller ranks preferred. Equal ranks are allowed for DEC-019's top
tie. This representation assigns no production ranks and must be checked with
order-independent fixtures; no file ordering or latest definition substitution.

Required observations retain availability/provenance. A known false predicate
is different from unavailable/indeterminate context. Do not turn an unsupported
rate into zero or infer that a missing final action was never taken. A malformed
definition or unavailable required observation must yield a diagnostic, not a
valid no-match result. DEC-025 now requires every referenced observation in each
complete condition tree before boolean composition, including nested children.

Independent review identified this composition gap as finding R1; the human chose
strict availability in
[DEC-025](../../.project-os/decisions/DEC-025-strict-predicate-availability.yaml).
The [condition contract](condition-evaluation.md) specifies ALL/ANY/NOT truth
tables, nesting, static validation and consumer/fixture boundaries. False AND
unavailable and true OR unavailable both diagnose; no short-circuit omission
is permitted. A diagnostic ending condition cannot silently become a false
candidate, valid no-match or another winner. Detailed contract recheck remains
required; this is not an implemented resolver or final review PASS.

## Result boundaries

The proposed result variants are resolved, ambiguous, no-match and diagnostic.
Their exact field names remain under schema review:

- Resolved identifies the uniquely preferred eligible ending and its validated
  matched candidates/priority provenance.
- Ambiguous identifies multiple equally preferred top matches, without a winner.
- No-match records that valid supported context yielded no matching condition.
- Diagnostic identifies malformed, missing, unsupported or inconsistent input.

Multiple matching conditions are not necessarily ambiguous. If one eligible
ending has uniquely preferred authored precedence, it resolves even when lower
priority endings also match. Lower-priority ties do not create a top tie.
No implicit fallback, including STATUS QUO, is allowed in any non-resolved result.

Evaluation is read-only. Only a separate verified resolved campaign transition
can grant an ending flag; repeat evaluation/load/archive review cannot do so.
Any future official grant follows input identity and DEC-013's transaction
completion boundary. Unresolved/diagnostic results preserve previously committed
state without inventing a new ending or erasing accepted history.

## Definition and content safeguards

TASK-023 must provide deterministic non-production fixtures for CONTINUITY,
LIBERATION, WHISTLEBLOWER, SHUTDOWN, CUSTODIAN, NULL, THE BOARD, THE FIRE,
STATUS QUO and REWRITE. Fixtures are authoring/engine verification, not production
balance, a canonical good/bad/true ranking or an implicit default ending.
Keep REWRITE's structural change distinct from replacing one primary objective
with another. Do not expose final-act content in the three UNKNOWN-only incidents.

## Required fixture matrix (new APIs not implemented here)

| Case                                                                            | Required result / owner                                                |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Each of the ten named endings satisfies explicit fixture conditions             | Repeatable resolved result; TASK-023                                   |
| Boundary or exclusion removes a candidate                                       | Evaluate its validated predicates, not a hardcoded ending ID; TASK-023 |
| Several matches, unique preferred priority                                      | Select that candidate, independent of file order; TASK-023             |
| Equally preferred top matches                                                   | Ambiguous diagnostic, no winner or new ending flag; TASK-023           |
| Lower-priority tie beneath unique preferred match                               | Still resolve the unique preferred match; TASK-023                     |
| Valid context and every ending condition false                                  | No-match, no STATUS QUO fallback; TASK-023                             |
| Missing final context, unavailable metric, bad reference or unsupported version | Diagnostic, not zero/no-match/fallback; TASK-023                       |
| Same explicit inputs, recorded definitions and priority                         | Identical result/diagnostics across replay; TASK-023                   |
| Re-evaluate/load/review unresolved or diagnostic result                         | No state mutation or additional ending grant; TASK-019/023/024         |

Independent review and acceptance QA remain pending. Existing compatibility tests
do not verify this proposed ending API or its unimplemented predicate schema.
