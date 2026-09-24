# Orpheus

Orpheus is a desktop narrative techno-thriller built with Tauri, React, and TypeScript.
The repository currently contains the application and quality-tooling foundation; gameplay
systems and authored scenarios are intentionally introduced by later tasks.

## Prerequisites

- Node.js 24 or newer and npm 11 or newer
- The stable Rust toolchain
- The [Tauri system prerequisites](https://v2.tauri.app/start/prerequisites/) for your operating system

## Quick start

```sh
npm ci
npm run dev
```

Open the URL printed by Vite to run the web shell. To run the native desktop shell:

```sh
npm run dev:desktop
```

## Quality commands

```sh
npm run build
npm run lint
npm run format:check
npm run typecheck
npm test
npm run validate:scenarios
```

`npm run build:desktop` compiles the native application without producing an installer.
The scenario validation command recursively checks `src/scenario/data` by default. Pass one or
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
