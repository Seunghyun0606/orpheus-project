# Orpheus

Orpheus is a desktop narrative techno-thriller built with Tauri, React, and TypeScript.
The repository contains a shared desktop for the three M3 incidents, validated scenario data, and a
deterministic headless incident engine. Each session runs from the Pager alert through investigation,
recovery, saved evidence, and an action-derived postmortem.

## Prerequisites

- Node.js 24 or newer and npm 11 or newer
- The stable Rust toolchain
- The [Tauri system prerequisites](https://v2.tauri.app/start/prerequisites/) for your operating system

## Quick start

```sh
npm ci
npm run dev
```

Open the URL printed by Vite to run the web client. To run the native desktop client:

```sh
npm run dev:desktop
```

## Desktop vertical-slice run

Start with `npm run dev:desktop` (or `npm run dev` for browser QA). The incident desk lists
INC-001, INC-002, and INC-003. Select **Start INC-001** for the original vertical slice: its
Pager shows `SEV1`, Payment API, and the error-rate alert. Use the investigation tabs with Tab
and arrow keys, then activate actions with Enter or Space:

1. Open Payment API logs, inspect PostgreSQL, and inspect database sessions. The session table
   reveals 164 stale `idle in transaction` sessions, then unlocks the termination action.
2. Terminate stale database sessions. The transient `UNKNOWN` log message appears before the
   postmortem; activate **Continue incident** to finish. The report shows elapsed time, customer
   impact, operational risk, and the recorded action sequence without grading the player.
3. Return to the completed incident record, open **Evidence**, and confirm **Corrupted log entry**.
   Save the session, restart the incident, then load the saved session. Return from the restored
   postmortem and confirm that the evidence and recovered state remain.

For the temporary-mitigation path, restart Payment API before investigation. The recovery banner
labels this **Temporary stabilization**; after enough action-driven time the degradation recurs.
The postmortem explains the temporary window and its observed effects.

**Display settings** are available on both the incident and postmortem screens. They independently
persist CRT effects, reduced animation, and 100%, 125%, or 150% text scaling in local browser
storage. They do not alter the incident save or replay log.

## Quality commands

```sh
npm run build
npm run lint
npm run format:check
npm run typecheck
npm test
npm run test:replays
npm run validate:scenarios
npm run build:desktop
```

`npm run build:desktop` compiles the native application without producing an installer.

## War Room and saved progress

The three MVP incident YAML files author team messages, a communication action, and a delayed
delegation. Open **War Room** to read reports and pending work; delegated work occupies one team
capacity slot until its authored ETA. Reports can be incomplete or conflicting and are not marked
correct or incorrect. The same panel and engine rules apply to all three incidents. Return to the
incident desk at any time; completed records can be reviewed there.

INC-001 remains at content version 1.1.0; INC-002/003 now use 1.2.0 for their UNKNOWN discovery
paths. Existing 1.0.0 and 1.1.0 saves are verified against frozen original scenarios before
replay into current content. Loading does not overwrite the original single-incident slot; save
again to keep the migrated version. Unsupported or altered saves are rejected.

Discoveries also enter the separate, versioned `orpheus.campaign-progress.v1` local record. The
Evidence tab projects recovered artifacts and UNKNOWN trigger history across incidents from
replay-verified records, even after an incident is restarted. This record never overwrites
`orpheus.incident.v1`. The desktop retains one incident save slot. The desk can resume its saved
incident, and saving a different incident requires explicit confirmation before that slot is
replaced. If the slot changes while confirmation is open, confirmation is requested again. A
malformed or incompatible slot is reported and preserved rather than silently erased.
Completed/discovered progress is kept in the separate campaign record, so all three records can
be revisited after restart. Reviewing an archived record is read-only and does not replace an
unfinished response in memory. An older incident save can be imported into the discovery record with
**Load**. No later-act identity is revealed here.

## M2 verification map

| M2 exit criterion                                    | Repeatable evidence                                                                                                                                                                                                                                                 |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Operations desktop from Pager to postmortem          | `src/tests/vertical-slice.test.tsx` exercises logs, database investigation, status, actions, evidence, save/load, and postmortem; `npm run build:desktop` compiles the native client. Follow the desktop run above for visual QA.                                   |
| Impact and temporary recovery without grading        | `src/app/App.test.tsx` verifies temporary stabilization and recurrence; `src/engine/postmortem.test.ts` compares the two response paths and measured impact.                                                                                                        |
| UNKNOWN discovery and durable corrupted-log evidence | `src/tests/vertical-slice.test.tsx` verifies the transient message before the report and evidence after save, restart, and load.                                                                                                                                    |
| Adjustable presentation and non-color status cues    | `src/app/App.test.tsx` verifies persisted controls and keyboard tab navigation; its incident assertions verify textual recovery states. At 320px and 150% text scale, check the database observations and report for clipped content and run an accessibility scan. |

Run the full quality command set above and the desktop build for the final M2 check. The
structured TASK-010 result in `.project-os/tasks/results` records actual command outcomes and
independent review/QA decisions.

The scenario validation command checks current content and frozen legacy content (eight files) by
default. Pass one or
more YAML files or directories to validate authored content elsewhere:

```sh
npm run validate:scenarios -- path/to/scenario.yaml path/to/scenario-directory
```

Diagnostics include the source file, data path, stable error code, and message. Invalid content
produces a non-zero exit code.

## Source boundaries

- `src/app`: React application composition.
- `src/ui`: presentation code and styles.
- `src/engine`: pure TypeScript domain boundary. React, Zustand, DOM, and Tauri imports are
  rejected by ESLint here.
- `src/scenario`: versioned Zod contract, YAML parser, reference validator, and validation CLI.
- `src-tauri`: native desktop entry point and configuration.

## Deterministic simulation order

The headless engine applies an accepted action's costs, immediate effects, and temporary-effect
starts at the current simulation time, then advances the action-driven clock. Scheduled work runs
in ascending due-time order. At the same timestamp, temporary effects expire before timer events;
items of the same kind retain their scheduling order. Each effect batch settles conditional events,
narratives, resolution, and completion to a fixed point before time continues.

Only accepted player commands enter the ordered replay log. Replaying the same validated scenario,
seed, initial state, and command list produces deeply equal state and emitted events.

## Headless replay fixtures

Run both INC-001 replay paths without the UI:

```sh
npm run test:replays
```

To run one path independently, filter by its test name:

```sh
npm run test:replays -- -t "temporary mitigation"
npm run test:replays -- -t "root-cause resolution"
```

Replay fixtures live in `src/tests/fixtures` and contain only a stable fixture id, seed, and ordered
engine commands. Keep outcome assertions in the adjacent replay test so fixture inputs remain concise,
serializable, and reusable by future replay tooling.
