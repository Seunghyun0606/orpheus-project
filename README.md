# Orpheus

Orpheus is a single-player, choice-driven techno-thriller for the desktop, built in Godot 4. You
play a Production Reliability Engineer at Vantage Systems on the night rotation: incidents unfold
as a timestamped conversation with your colleagues, evidence collects itself as the story moves,
and you decide, sometimes against a clock, between quick mitigation and root-cause repair, and
slowly uncover who is responsible when a trusted AI recommendation meets a human decision.

Product direction, principles and non-goals live in [PROJECT.md](PROJECT.md). The current
direction is [DEC-072](.project-os/decisions/DEC-072-choice-driven-story-and-godot.yaml): a
choice-driven story with a Godot runtime. The earlier Tauri/React desk is kept as a reference and
for its tooling; it is no longer the product.

## Status

- **Playable:** nine acts, 26 incidents and ten endings in the Godot client, in English and
  Korean, with a status window (tendencies, key decisions, revelations and the people you have
  met) and read-only records of finished incidents.
- **Planning state:** `projectctl status` prints the canonical milestone and task state. M1–M3
  are complete, M4 and M5 are blocked, and M6 (the story campaign in Godot) is active.
- **Not yet done:** human pacing and difficulty review, Godot export packages, installer
  verification, rights review and release.

## Prerequisites

- Node.js 24 or newer and npm 11 or newer
- Godot 4.7 (standard build). The scripts look for `GODOT_BIN`, then `godot` on `PATH`, then a
  Godot 4 console build under `../_basic_tool` or `%LOCALAPPDATA%\Programs`.

## Quick start

```sh
npm ci
npm run godot:play     # export the story data, then open the game window
npm run godot:editor   # open the project in the Godot editor (F5 runs it)
npm run godot:build    # build a local unsigned Windows x86_64 program
# Output: build/windows/OrpheusProject.exe (keep the whole build/windows folder)
```

Story content is YAML: episodes in `src/story/data/inc-NNN.yaml`, the cast in
`src/story/cast.yaml`, Korean text in `src/i18n/content/ko/story-*.yaml`. `npm run godot:export`
writes them to `godot/data` and `godot/locale`; the format is described in
[specs/architecture/story-episode-format.md](specs/architecture/story-episode-format.md).
`npm run story:play` plays an episode in the terminal against the reference runner.

## Playing

Choose **Begin** on the title screen. Each incident opens with the pager; text types in line by
line (click or Space shows it at once). Choose with the mouse, Enter or the number keys; a timed
decision runs out on its own if you wait. Once per act you connect two or three pieces of
evidence from the tray. **Status** shows how your choices have leaned and what you know, and
**Menu** (Esc) holds the settings: language, text size and speed, CRT, timers, volume and reduced
motion. A finished incident opens as a read-only record; H folds its summary away.

## Quality gates

```sh
npm run check          # format, lint, typecheck, content and story validation, tests, web build
npm run godot:parity   # the GDScript runner against the reference runner on every story path
npm run godot:smoke    # the whole campaign through the real Godot UI, three ways
```

Individual commands: `format:check`, `lint`, `typecheck`, `validate:scenarios`, `test`,
`test:replays`, `test:release-harness`, `build`, `build:desktop` (native compile, no installer).
CI runs `npm run check` on every push and pull request; the Godot checks need a local Godot
and are run before each commit to the story.

`npm run benchmark` measures development (Node, fake IndexedDB) replay and commit latency
against the approved budgets. `npm run build:review` produces an unsigned, isolated Windows
review installer.

## Repository layout

| Path                   | Contents                                                                           |
| ---------------------- | ---------------------------------------------------------------------------------- |
| `src/story`            | Story episodes, cast, schema, validator and the reference runner (DEC-072).        |
| `godot/`               | The Godot client: scenes, GDScript runner and UI, exported data, tests.            |
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

## Determinism and saves (legacy desk)

The engine applies an accepted action's costs, immediate effects and temporary effects at the
current simulation time, then advances the action-driven clock. Scheduled work runs in due-time
order (temporary expirations before timers at the same instant), and every batch settles
conditional events, narratives, resolution and completion to a fixed point. Repeatable
conditional events that could re-trigger each other are rejected by the validator.

Only accepted player commands enter the replay log, so the same scenario, seed and command list
always reproduce the same state and events. Saves and campaign records are verified by replaying
them; content versions are pinned, and older saves replay against frozen legacy scenarios before
migrating. Replay fixtures live in `src/tests/fixtures`; run them with `npm run test:replays`.
