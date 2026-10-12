# TASK-028 — Approved production model baseline authoring

## Completed

DEC-044 records the human's option A approval of the proposal frozen at `97b6163`.
The new definition header/initial state and exact model identities are connected in
`.project-os/planning/TASK-028.model-bindings.yaml`. The two model files are literal
schema-1 authoring objects for eventual inline composition, not new runtime binding
fields or a startable campaign. They cover the eight currently authored Incidents
only. Full 26-Incident coverage, actual later opportunities and ending authority
remain absent; production admission stays strict.

Initial Act is 1. Corporate/NULL alignment and all seven hidden values are zero;
discoveries/completions are empty and the known GHOST/NULL flags are false. Every
later authored narrative/ending flag must also start false. No behavior metric is
initialized to zero: the existing engine derives unavailable metrics without samples.

Behavior `orpheus-player-behavior` and prediction `orpheus-player-prediction` pin
version/classification `1.0.0`, schema/formula 1. The future opportunity authority
pins `orpheus-player-opportunities` / `1.0.0`; no placeholder response rule was added
to satisfy its nonempty schema. Old models/definitions/records remain untouched.

Operational classifications list actual service-changing actions explicitly. Logs,
metrics, diagnosis, delegation, communication and Security/archive reading are not
in the restart/rollback denominator. Every operational intervention remains in the
evidence-before-action denominator, including blind INC-001 rollback. Its support
rule is deliberately false: session diagnosis does not establish a deployment cause.
This preserves a zero-support sample rather than excluding a blind action.

Per-Incident support keys name actual relevant diagnosis/configuration investigation
and attributable causal team reports. Generic logs/metrics and Jin's customer-impact
reports contribute investigation depth but are not causal support. Signal-delivery
rules credit freshly delivered direct results; timer-message rules credit actual
new delegation delivery, not its request/ACK. Existing same-attempt provenance excludes
inherited/imported observations and pending work without a new source. Freshness is
inclusive 0–180 action-driven seconds. Prefixed distinct keys avoid accidental
semantic collisions between similarly named tools across Incidents.

Prediction contexts compare service-changing responses before/after the authored
first causal observation, using explicit semantic candidate/action tables (restart,
rollback, scale, reroute, rate limit, causal repair, isolation or quarantine). Local
prerequisites and campaign guards still filter eligible candidates. These contexts
are authored pre-release classifications, not an inferred action-name heuristic.
Minimum support is 3. Existing pooled historical calculation and tie/no-candidate/
insufficient-support UNKNOWN behavior are unchanged. Every early mapping's reveal
predicate is false for nonnegative elapsed time, so revisiting an early Scenario
later cannot accidentally expose ORPHEUS guidance. Later content must author its
own explicit exposure gates and opportunity rules with real visible ACK.

## Changed files

- `.project-os/decisions/DEC-044-production-model-initial-baseline.yaml`
- `.project-os/tasks/ready/TASK-028.yaml` (approval reference only)
- `.project-os/planning/M5/models/orpheus-player-behavior.yaml`
- `.project-os/planning/M5/models/orpheus-player-prediction.yaml`
- `.project-os/planning/TASK-028.model-bindings.yaml`
- `src/tests/production-player-baseline.test.ts`
- Current implementation/status documentation and new pending checkpoint.

## Tests

Authored nine deferred cases for exact references/classification, initial unavailable
metrics, irrelevant support, blind rollback, 180/181 freshness, repeated depth,
inherited diagnosis/pending delegation, new delegation and absent early opportunities.
They are unit projections, not official campaign runs or full campaign acceptance.
No tests, typecheck, lint, validator, build, review or native QA were run at the
user's explicit QA-deferral instruction. Formatting is not verification evidence.

## Known risks and remaining work

New model tables, prediction comparability and tests are unverified. No simulated
history, score award, production opportunity wording, ending threshold/priority or
epilogue was invented. Fragment composition is still pending, not live runtime
integration. No user stores, databases, profiles or old authority bytes were touched.

TASK-024/027/028 remain incomplete; the full campaign cannot start. TASK-029 still
requires TASK-028 acceptance under its current contract. Continuing later content
without that acceptance requires a human-approved implementation-readiness exception,
not a self-assessed PASS or implied dependency removal. Mandatory M4/M5 acceptance,
review/QA and final release gates remain intact.

## Next recommended step

Decide whether to retain TASK-029's readiness dependency or explicitly allow its
content implementation ahead of TASK-028 verification. Preserve these partial assets
and finish actual campaign integration/replay and deferred verification before final
acceptance. No push or release is authorized.
