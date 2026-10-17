# Orpheus

Orpheus is a single-player narrative techno-thriller for the desktop, built with Tauri, React and
TypeScript. You play a Production Reliability Engineer at Vantage Systems: you answer the Pager,
investigate logs, metrics and colleagues, choose between quick mitigation and root-cause repair,
and slowly uncover who is responsible when a trusted AI recommendation meets a human decision.

Product direction, principles and non-goals live in [PROJECT.md](PROJECT.md).

## Status

- **Playable:** the three-incident MVP desk (INC-001–003) and an opt-in nine-act, 26-incident
  full campaign with ten endings.
- **Planning state:** `projectctl status` prints the canonical milestone and task state. M1–M3
  are complete; M4 (campaign intelligence) and M5 (full campaign and release) are active.
  [DEC-070](.project-os/decisions/DEC-070-review-driven-remediation.yaml) is the current
  remediation plan.
- **Not yet done:** native desktop QA, installer verification, rights review and release. See
  [M5 verification plan](docs/M5_VERIFICATION_PLAN.md).

## Prerequisites

- Node.js 24 or newer and npm 11 or newer
- The stable Rust toolchain
- The [Tauri system prerequisites](https://v2.tauri.app/start/prerequisites/) for your operating
  system

## Quick start

```sh
npm ci
npm run dev           # web client at the printed URL
npm run dev:desktop   # native desktop client
```

## Playing the vertical slice

The incident desk lists INC-001, INC-002 and INC-003. Select **Start INC-001**: the Pager shows a
SEV1 Payment API error-rate alert. Use the investigation tabs with Tab and the arrow keys, and
activate actions with Enter or Space.

1. Open the Payment API logs, inspect PostgreSQL, then inspect database sessions. The session
   table reveals 164 stale `idle in transaction` sessions and unlocks the termination action.
2. Terminate the stale sessions. A transient `UNKNOWN` log message appears; continue to the
   postmortem, which reports elapsed time, customer impact, operational risk and your action
   sequence without grading you.
3. Open **Evidence** to find the corrupted log entry. Save, restart and load to confirm that
   evidence and recovered state persist.

For the mitigation path, restart the Payment API before investigating: the banner reads
**Temporary stabilization**, and the degradation recurs once the relief expires.

**Display settings** adjust CRT effects, animation and text scale; they never change saves or
replays.

## Quality gates

```sh
npm run check   # format, lint, typecheck, scenario validation, tests, release harness, web build
```

Individual commands: `format:check`, `lint`, `typecheck`, `validate:scenarios`, `test`,
`test:replays`, `test:release-harness`, `build`, `build:desktop` (native compile, no installer).
CI runs `npm run check` on every push and pull request.

`npm run benchmark` measures development (Node, fake IndexedDB) replay and commit latency
against the approved budgets. `npm run build:review` produces an unsigned, isolated Windows
review installer.

## Repository layout

| Path                   | Contents                                                                           |
| ---------------------- | ---------------------------------------------------------------------------------- |
| `src/engine`           | Pure, deterministic incident and campaign engine (no React, DOM or Tauri imports). |
| `src/scenario`         | Versioned Zod contracts, YAML parsing, validators and the validation CLI.          |
| `src/scenario/data`    | Hash-pinned incident, campaign, presentation and ending content.                   |
| `src/persistence`      | Incident saves, campaign progress and the IndexedDB campaign ledger.               |
| `src/store`, `src/app` | Zustand session stores and the React application.                                  |
| `authoring/`           | Source data and models that the authoring scripts compose into campaign content.   |
| `scripts/`             | Validation, authoring, benchmark and packaging tools.                              |
| `specs/`, `docs/`      | Architecture contracts, campaign blueprint, authoring and support guides.          |
| `.project-os/`         | Project OS state, milestones, task contracts and the decision log.                 |

Content authoring is described in [docs/CAMPAIGN_AUTHORING.md](docs/CAMPAIGN_AUTHORING.md);
validate new content with `npm run validate:scenarios -- path/to/file-or-directory`.

## Determinism and saves

The engine applies an accepted action's costs, immediate effects and temporary effects at the
current simulation time, then advances the action-driven clock. Scheduled work runs in due-time
order (temporary expirations before timers at the same instant), and every batch settles
conditional events, narratives, resolution and completion to a fixed point. Repeatable
conditional events that could re-trigger each other are rejected by the validator.

Only accepted player commands enter the replay log, so the same scenario, seed and command list
always reproduce the same state and events. Saves and campaign records are verified by replaying
them; content versions are pinned, and older saves replay against frozen legacy scenarios before
migrating. Replay fixtures live in `src/tests/fixtures`; run them with `npm run test:replays`.
