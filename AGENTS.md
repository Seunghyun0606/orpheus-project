# Project Agent Bootstrap

This repository uses Project OS.

Project memory is stored in the repository. Do not reconstruct project state from conversation history.

## Start of work

1. Read `PROJECT.md`.
2. Read `.project-os/manifest.yaml`.
3. Read `.project-os/state/current.yaml`.
4. Determine the current role and task.
5. Load only context required for that role and task.

## During work

- Respect task scope and acceptance criteria.
- Respect project non-goals and active architecture decisions.
- Do not change product direction implicitly.
- Do not mark work complete only because implementation exists.
- Prefer automated verification over self-assessment.
- Escalate only when a configured Human Gate is reached or progress is genuinely blocked.

## Completion

Produce a structured task result. Canonical project state must be updated only through the configured Project OS state transition rules.

If no task is assigned, use `projectctl next --role <role>` to identify an eligible task.

## Claude and Codex

Two agents work on this repository. Their roles do not overlap.

- **Claude** owns product direction within the active decisions, story and dialogue writing,
  the story and cast formats, UI features, triage of Codex reports, and the integration commits
  on the working branch.
- **Codex** takes scoped work from a brief in `docs/codex/YYYY-MM-DD-<topic>.md`: generated art,
  QA reports, and self-contained engineering (CI, tests, build tooling). The brief is the scope;
  anything outside it goes into the report as a suggestion.

How Codex works:

- In its own git worktree on branch `codex/<topic>`, created for the brief. Never in the main
  working tree, never on another branch.
- It leaves its changes uncommitted in that worktree. Claude reviews, commits and merges them.
- Its report goes to `docs/qa/YYYY-MM-DD-<topic>.md` in the worktree: scope, what was run
  (commands and results), findings, and a structured result. Each finding has an ID, a severity
  (P1 blocks play or corrupts saves, P2 is wrong behaviour or a misleading text, P3 is polish),
  the location (`path:line`), steps to reproduce, expected and actual behaviour, and a
  suggestion. Claude adds an accept/defer/reject decision per finding when triaging.
- A report-only brief changes no product file.
- The Godot runtime is exercised on a copy under `.qa/` with a different application name, so the
  player's saves (`user://campaign.json`) are never touched.

Neither agent pushes, signs, publishes a build, or changes canonical Project OS state without the
user's explicit request.
