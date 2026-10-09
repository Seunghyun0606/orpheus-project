# M3 exit verification (TASK-017)

Status: automated and native verification complete; M3 completion was approved
by the human on 2026-10-09. [DEC-008](../.project-os/decisions/DEC-008-m3-completion-m4-planning.yaml)
records the separate completion decision. The original TASK-017 handoffs remain
unchanged and describe verification before that approval.

| M3 exit criterion                                                                 | Repeatable evidence                                                                                                                                                                                                                                                                                                                            | Current result                              |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| INC-001, INC-002, and INC-003 are fully playable                                  | `src/app/AppShell.test.tsx` starts each scenario, follows its authored investigation path, observes UNKNOWN, reaches postmortem, and revisits the archive after remount. `src/tests/vertical-slice.test.tsx` covers keyboard-driven INC-001. [Native inspection](TASK-017_NATIVE_QA.md) records all three desktop routes and restored records. | Automated and native paths pass.            |
| Shared engine and UI contain no scenario-specific React logic                     | `src/app/AppShell.tsx` enumerates the scenario catalog; `src/app/App.tsx` renders state and authored action data. `npm run lint` checks the headless engine boundary. Search production React for `INC-001`, `INC-002`, or `INC-003` to audit branching.                                                                                       | Static inspection and automated tests pass. |
| Evidence, narrative, War Room communication, and delegation work across incidents | `src/tests/m3-narrative.test.ts` verifies persistent UNKNOWN discoveries. `src/tests/war-room.test.tsx` covers delegated jobs, exact ETA, capacity, save/restore, and replay. Native inspection observes delegation, results, communication, and cross-incident evidence.                                                                      | Automated and native checks pass.           |
| MVP reveals UNKNOWN without ORPHEUS identity                                      | `npm run validate:scenarios` validates current and frozen scenario YAML. `src/tests/m3-narrative.test.ts` checks the UNKNOWN-only discovery routes and rejects premature identity disclosure in scenario fields.                                                                                                                               | Automated content boundary pass.            |

## Quality command set

The TASK-017 source candidate passed:

- `npm test`: 116 tests in 16 files.
- `npm run test:replays`: 2 tests.
- `npm run validate:scenarios`: 8 current/frozen YAML files.
- `npm run lint`, `npm run format:check`, and `npm run typecheck`.
- `npm run build` and `npm run build:desktop`; the executable was rebuilt after
  the recovery-copy and responsive-layout corrections.
- `git diff --check` and `projectctl doctor`.

An initial full-test run overlapped other checks and a native build: one
vertical-slice test exceeded its five-second timeout. The isolated rerun passed
all 116 tests without increasing the timeout or changing that test. This failed
attempt is retained as a resource-contention limitation. Vite's uncompressed
chunk-size warning is non-blocking.

## Findings closed during verification

- Recovery copy used any delayed event as proof of expired mitigation. It now
  checks `temporary_effect_expired`; a delegation-only regression prevents the
  misleading message. Native INC-002 stays in diagnosis after Sam returns, while
  INC-001 correctly reports recurrence when restart expires.
- A sticky service rail covered evidence/actions when responsive panels moved
  into later rows. Those layouts now use normal flow. Native retests confirm
  uncovered evidence/actions at 150% and the action grid at 100% text.

## Native evidence boundary and remaining decision

The [native log](TASK-017_NATIVE_QA.md) distinguishes desktop observations from
automated coverage and identifies the inspected executable by SHA-256. The
earlier pipe connection failure was a blocked attempt, superseded by actual
native interactions. Independent agents audit this evidence but must not claim
to have personally performed the primary agent's native inputs.

The original save was not overwritten. Native inspection covered legacy load
and cross-incident confirmation/cancel; automated tests cover confirmed
replacement, malformed saves, and concurrent slot changes. Native minimums
remain 960 x 640: this is not a claim of native 320px support or inspection.

TASK-017 established verified readiness, not automatic milestone closure. The
later human approval closes M3 and authorizes M4 task definition, recorded in
DEC-008 and the [M4 plan](M4_IMPLEMENTATION_PLAN.md). It does not authorize a new
save migration, later-campaign production content, or release.
