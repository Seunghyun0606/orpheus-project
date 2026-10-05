# M3 exit verification (TASK-017)

Status: in progress. This is an evidence map, not M3 completion approval. The
milestone remains active until independent acceptance QA, native desktop
inspection, and its configured human completion gate are resolved.

| M3 exit criterion                                                                 | Repeatable evidence                                                                                                                                                                                                                                                                                                                                                   | Current result                                            |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| INC-001, INC-002, and INC-003 are fully playable                                  | `src/app/AppShell.test.tsx` starts each scenario, follows its authored investigation path, observes UNKNOWN, reaches postmortem, and revisits the archive after remount. `src/tests/vertical-slice.test.tsx` covers the original keyboard-driven INC-001 path.                                                                                                        | Automated UI pass; native interactive inspection pending. |
| Shared engine and UI contain no scenario-specific React logic                     | `src/app/AppShell.tsx` enumerates the scenario catalog; `src/app/App.tsx` renders state and authored action data. `npm run lint` checks the headless engine boundary. Search production React for `INC-001`, `INC-002`, or `INC-003` to audit branching.                                                                                                              | Static inspection and automated tests pass.               |
| Evidence, narrative, War Room communication, and delegation work across incidents | `src/tests/m3-narrative.test.ts` replays all UNKNOWN discovery routes and verifies cross-incident evidence persistence. `src/tests/war-room.test.tsx` checks all three authored delegated jobs, exact ETA, team capacity, save/restore, and deterministic replay. `src/app/AppShell.test.tsx` observes delegated pending work and recovered UNKNOWN in the shared UI. | Automated engine and UI pass.                             |
| MVP reveals UNKNOWN without ORPHEUS identity                                      | `npm run validate:scenarios` validates current and frozen scenario YAML. `src/tests/m3-narrative.test.ts` checks the UNKNOWN-only discovery routes and rejects premature identity disclosure in scenario fields.                                                                                                                                                      | Automated content boundary pass.                          |

## Quality command set

Run `npm run build`, `npm run lint`, `npm run format:check`, `npm run typecheck`,
`npm test`, `npm run test:replays`, `npm run validate:scenarios`,
`npm run build:desktop`, `git diff --check`, and `projectctl doctor` against the
same candidate commit. TASK-016's committed acceptance record passed 115 tests
in 16 files and produced a native release executable. TASK-017 strengthens the
three-incident UI assertions; its final command outcomes must be recorded in
its own result before evaluation.

## Native inspection still required

The Tauri release binary compiled, but a successful build is not a GUI smoke
test. On this TASK-017 run, Computer Use failed to connect to the Windows native
pipe on the initial call, after a short retry, and after resetting its JavaScript
session. No native window screenshot or interaction was observed. Do not report
native visual, keyboard, 320px/150% text, or complete desktop play as passed on
that basis.

When the native helper is available, inspect the incident desk, all three paths
through postmortem, UNKNOWN evidence and War Room updates, save-slot confirmation,
keyboard focus, reduced motion/CRT-off/text scaling, and narrow-window overflow.
Avoid overwriting a pre-existing save unless the approved in-app confirmation is
deliberately accepted. Then request independent review and acceptance QA, and
present the separate M3 completion decision to the human gate. Do not update the
M3 roadmap state before that decision.
