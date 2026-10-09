# Ending resolution — TASK-018 review draft

Status: DEC-019 approves unresolved top ties and no-match without automatic
endings. This document specifies review, replay and fixture boundaries within
that decision; no resolver, save field or production ending content is implemented.
Priority representation, exact predicate schema and production balance still
require their reviewed versioned definitions.

## Explicit context and definitions

The pure resolver consumes validated campaign state, final incident state,
final actions and recorded authored ending-definition versions. These inputs
must be explicitly related to the official run/final attempt, not selected from
an arbitrary archive snapshot. Imported discoveries are usable only under the
approved presence rules; they do not supply final completion or missing behavior.

Definitions name ending IDs, conditions and priority precedence. Validate all
flag/evidence/action/model references and supported versions before resolution.
No ordering derives from file layout, object keys, alphabetic IDs or the UI.
Priority direction and serialization must be explicit in the reviewed definition
contract, with fixtures; this draft chooses no numeric production priorities.

Required observations retain availability/provenance. A known false predicate
is different from unavailable/indeterminate context. Do not turn an unsupported
rate into zero or infer that a missing final action was never taken. A malformed
definition or unavailable required observation must yield a diagnostic, not a
valid no-match result. Predicate composition/availability details still need
contract review; no guessed truth table may enter production implicitly.

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
