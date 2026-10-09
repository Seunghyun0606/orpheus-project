# Condition evaluation — TASK-018 review draft

Status: [DEC-025](../../.project-os/decisions/DEC-025-strict-predicate-availability.yaml)
approves strict referenced-observation availability, not three-valued logical
short-circuiting. This is a logical contract and future fixture plan; no runtime
schema, evaluator, save field or production condition is implemented here.

The [definition interface draft](campaign-definition-contract.md) defines typed
reference/comparison trees and registry boundaries for review. It must preserve
this approved availability policy, not choose an alternative during serialization.

## Validation and required observations

The pure evaluator consumes a supported versioned authored condition and verified
explicit context related to its run/attempt and ordered evaluation boundary.
Conditions are data, never executable strings or UI-owned callbacks. Validate the
whole definition tree, operator arity, reference kinds/types, definition versions
and comparison values before reading any predicate as a boolean. Malformed
structure, unknown references, incompatible definitions and invalid required
context are diagnostics, even in a logically non-decisive subtree.

For a well-formed condition, collect every statically referenced observation in
the entire tree, including all ALL/ANY children and the NOT child. These are that
condition's required observations. References do not become optional because a
sibling is already false or true. Repeated references retain their definition
identity and do not create new behavior samples or alternate current snapshots.
Use the same verified context boundary throughout one evaluation.

A supported metric with zero eligible samples is valid but unavailable. A known
boolean false or an observed numeric zero is available. Missing required context
or unsupported definitions are invalid-input diagnostics, not an unavailable
leaf that can be coerced to false. No unavailable field receives a zero, neutral
value, guessed prior observation or confidence by default.

If any required observation is unavailable, return a diagnostic for this
condition and no boolean result. Do not evaluate a nested subtree to a constant
and then remove its references. No partial effect, branch grant or ending flag
may be derived from a diagnostic. Report source/definition/reference paths and
availability reasons without exposing hidden values in player UI.

## ALL, ANY and NOT truth tables

`T` and `F` mean available known booleans. `U` means a valid but unavailable
referenced observation. `D` means diagnostic with no boolean result. This is not
a three-valued boolean algebra: U is rejected before composition.

| Left | Right | ALL | ANY |
| ---- | ----- | --- | --- |
| T    | T     | T   | T   |
| T    | F     | F   | T   |
| F    | T     | F   | T   |
| F    | F     | F   | F   |
| T    | U     | D   | D   |
| F    | U     | D   | D   |
| U    | T     | D   | D   |
| U    | F     | D   | D   |
| U    | U     | D   | D   |

| Operand | NOT |
| ------- | --- |
| T       | F   |
| F       | T   |
| U       | D   |

For validated multi-child ALL/ANY, first require every referenced observation;
then ALL is true only when every child is true and ANY when at least one is true.
ALL/ANY require a nonempty list of validated condition children; NOT requires
exactly one validated condition child. Invalid arity diagnoses; do not add an
implicit identity value for a malformed empty group. The runtime authoring schema
must enforce these constraints. Exact serialization/field names remain an implementation-contract
review obligation, not a reason to select different availability semantics.

`ALL(F, ANY(T, U))` and `ANY(T, ALL(F, U))` both diagnose. They cannot be reduced
to F/T by short-circuiting or constant folding. Invalid-reference examples also
diagnose regardless of sibling truth. Reordering children cannot change boolean
eligibility or hide diagnostics; detailed diagnostic ordering must be canonical
and tested rather than dependent on traversal or object enumeration.

## Consumer and replay boundaries

Use this same availability policy for reviewed authored campaign conditions,
branch eligibility and ending conditions. Current legacy simulation/narrative
schemas are not modified or retroactively reinterpreted by this draft.

Under DEC-019, an ending condition diagnostic is not a false candidate: the
resolver must not omit it to produce a valid no-match or a different winner.
Validate the complete requested ending context/definition set before resolution.
No evaluation, archive visit or load grants a flag; only a separate verified
resolved transition can do so under its recorded identity and commit boundary.
Branch evaluation likewise cannot label a diagnostic as a known failed choice
or award a different route/effect. UI diagnostics must not imply moral failure.

Evaluation creates no accepted player input, observation or campaign effect.
Referenced imported discoveries can satisfy approved presence predicates under
DEC-011, but do not supply missing rates, historic actions or completion. Inherited
prefixes remain baselines under DEC-012. Later evidence/actions cannot change a
previous evaluation's recorded context; a new evaluation uses an explicit new
boundary without rewriting its predecessor.

## Required future fixtures

- All nine ALL/ANY pairs and three NOT cases above; known zero/false distinct
  from unavailable observations; preserve the boolean/diagnostic result type.
- Multi-child and nested conditions with decisive siblings and an unavailable
  leaf: diagnostic in every child-order permutation, no branch or ending grant.
- Invalid operator/type/reference/version under a decisive sibling: static
  diagnostic, not a successful boolean or valid no-match.
- Duplicate references and repeated read-only evaluation: identical eligibility,
  no new samples/effects; one verified context boundary for all leaves.
- Each ending's false/true/diagnostic cases, including a lower-precedence
  diagnostic candidate: no silent omission, fallback or arbitrary winner.
- Imports, inherited context, exact-head resume and later new observations:
  preserve original provenance; unavailable behavior is not manufactured.
- Diagnostic evaluation leaves committed campaign state untouched; a failed
  subsequent transition commit cannot publish new official effects or flags.

These are requirements for TASK-019/021/022/023/024/025, not passing tests of an
implemented evaluator. Production predicates, thresholds, priorities and reveal
gates are not selected. Independent review and QA must recheck the detailed
contract; historical review checkpoints retain their original findings.
