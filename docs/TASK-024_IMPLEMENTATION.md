# TASK-024 — v2 presentation candidate

Status: implementation candidate, **not complete**. DEC-033 approves v2 only in
new immutable campaign authorities. TASK-024 remains active and TASK-025 has not
started. Default MVP content and initialization are unchanged.

## Completed safe scope

- Strict optional `recordVersion: 2`, `replayVersion: 2` and `opportunities`
  binding in new campaign definitions. Both record and replay v1 retain their
  exact shapes; no migration, attachment, backfill or latest-version fallback.
- Authored, version-pinned prediction/recommendation/choice rules require typed
  references, availability/reveal/continuing validity, single-response consumption,
  no replacement, and explicit eligible/positive predicates. No global timeout or
  permanently-valid default. These fixture rules are not production calibration.
- `prepare_opportunity` stores immutable calculation/context/presentation. It
  contributes no response or exposure. `acknowledge_presentation` records an
  explicit actual-screen confirmation at the verified attempt head before a
  qualifying command. Repeated operation delivery is idempotent; divergent IDs,
  duplicate rule/head preparation and overlapping response association diagnose.
- Commands derive at most one response per metric from new accepted input and
  verified pre-action state. The command and response commit atomically. Neither
  UI queries nor inherited/checkpoint/imported history are player responses.
- Current prediction `when`, `reveal` and all candidate predicates are revalidated
  at ACK/response and display boundaries. Original prediction/confidence is never
  relabelled. Response records separately retain their current candidate context.
- Six opportunity metrics pool positive/eligible counts. Unobserved means
  unavailable; supported zero is `0/1`. Coverage is metric-specific, not copied
  from the operational model. Existing four behavior formulas remain unchanged.
- The injected `createCampaignSessionStore` reads before explicit creation,
  publishes only transaction-complete replay-verified records, retains exact
  pending identity/candidate after abort or unknown caller acknowledgement, and
  retries that operation without executing another action. A known revision
  conflict requires explicit authoritative reload, not automatic rebase.
- Opt-in `AppShell`/`CampaignDesk` injection displays approved progression,
  evidence, authored eligibility and read-only ending queries. It selects prepared
  guidance explicitly, never an implicit latest opportunity. Actual visible
  confirmation is an interaction, not a render/mount effect. Archive review and
  remount do not create ACKs. No raw hidden metrics or story percentage is shown.
- All physical storage names/version remain unchanged: `orpheus.campaign`,
  database version 1, `runs`, `runId`. Tests inject fresh fake IndexedDB factories.
  No actual user storage was opened, rewritten or reset.

## Changed files

Authoring: `src/scenario/campaign.ts`, `src/scenario/opportunity.ts`.
Domain: `src/engine/campaign/transitions.ts`, `opportunities.ts`,
`src/engine/player-model/prediction.ts`.
Adapter/UI: `src/store/campaign-session.ts`, `src/app/CampaignDesk.tsx`,
`src/app/AppShell.tsx`, `src/ui/base.css`.
Tests: `src/tests/campaign-opportunities.test.ts`,
`src/tests/fixtures/opportunities.ts`, `src/tests/fixtures/ledger.ts`,
`src/store/campaign-session.test.ts`, `src/app/CampaignDesk.test.tsx`.
Decision/preflight: DEC-033, TASK-024 ready context and presentation record gate.

## Tests and independent findings

Developer full verification on 2026-10-12: **409 tests / 28 files passed**,
33.24 seconds, default two-worker harness. Typecheck, lint, format check, eight
scenario validation files, web build and Tauri `--no-bundle` desktop build passed.
Web chunk warning persists (579.14 kB); native linker emitted a warning, not an
error. Building a native binary is not observing its UI or proving durable native
ACKs. At that developer checkpoint, final independent candidate checks were
still pending. The subsequent results below are attributed separately.

Independent candidate verification of commit `6b1a8fce` on 2026-10-12:

- `codex-task024-domain-reviewer` confirmed P1/P2 corrections and reported no
  remaining blockers in the implementation candidate scope.
- `codex-task024-candidate-qa` directly passed 29 focused tests / 3 files (9.28s)
  and the default full suite, 409 tests / 28 files (32.95s). Typecheck, lint,
  formatting, eight scenario files, web build, doctor and diff checks passed.
- `codex-task024-candidate-evaluator` audited the contract, implementation and
  attributed evidence read-only: bounded candidate PASS, overall TASK-024 PENDING.
  Native portions of AC1/AC3 and native AC5 remain unmet. The evaluator does not
  claim the QA commands as its own execution.

These bounded planning records are not immutable final task acceptance records:
[review](../.project-os/planning/TASK-024.candidate-review.yaml),
[QA](../.project-os/planning/TASK-024.candidate-qa.yaml),
[evaluation](../.project-os/planning/TASK-024.candidate-evaluation.yaml).

Focused tests cover prediction `0/1`, `1/1`, pooled `2/12`, provenance, response
uniqueness, unrelated/rejected inputs, current authored candidate changes,
gates/UNKNOWN/expiry, checkpoint exclusion, recommendation versus prediction,
choice metrics, v1 preservation, forgery rejection, transaction abort, conflict,
lost acknowledgement, remount/archive behavior, explicit preparation selection,
hidden-document no-ACK, keyboard controls, DOM 150%/reduced-motion/non-color cues,
legacy-slot isolation and data-driven read-only fixture ending query.

Failure history is preserved:

1. Initial typecheck caught the new checkpoint fixture's wrong `encodeSave`
   arguments; corrected to explicit scenario/seed/state.
2. First domain execution: 13 passed, 2 failed because restart/rollback training
   tied and legitimately returned UNKNOWN. Training fixture now has three actual
   restart commands; no predictor tie rule or timeout was relaxed.
3. Initial TSX typechecks caught broad query result unions; narrowed structurally.
   Lint caught the forward store declaration; converted to a typed const closure.
4. First component execution: 2 passed, 4 failed. Assertions ran before async
   commit completion; they now await real rendered/published state. JSDOM text
   scale checks use the explicit CSS declaration, not a native layout claim.
5. Independent read-only reviewer reproduced P1: a now-ineligible authored
   prediction candidate could still be counted using prepared/engine availability.
   Shared current-context validation and regression tests correct it. Reviewer
   confirmed the correction; related 127 tests / 4 files passed independently.
6. Reviewer identified P2 implicit latest guidance selection. Adapter now keeps
   an explicit selected preparation ID and offers the valid prepared list. New
   selection regression passed in the developer and independent QA suites;
   final independent re-review confirmed the correction.

## Known risks and remaining work

- At the original `6b1a8fce` checkpoint, no native fixture entry/profile had been
  authorized or added. DEC-034 now approves the separate entry and it has been
  built, unlaunched; the discovered actual path still needs confirmation. Computer-use
  initialization and lightweight app inventory succeeded on 2026-10-12, but no
  Orpheus app was returned. No native app was launched or clicked, and no user
  saves were accessed. This is not a `native pipe unavailable` finding.
- TASK-024 requires actual isolated gated presentation, native minimum 960×640,
  150% text/keyboard/reduced-motion and native durable ACK/reload evidence. DOM
  style attributes and fake IndexedDB do not satisfy these requirements.
- Native test setup must separate actual WebView storage from
  `com.vantage.orpheus` user data and keep fixture content out of the normal
  production entry. Any material test-profile/layout choice requires the human.
- Independent candidate review/QA and bounded evaluation passed. Final acceptance
  review/QA and distinct configured evaluation after native evidence remain mandatory.
  No canonical completion, M4 closure, TASK-025 waiver, production campaign,
  ending grant, actual REWRITE, push or release is approved by this candidate.

## Next recommended step

The human approved the separate native fixture entry/profile under DEC-034.
The [QA entry candidate](TASK-024_NATIVE_QA.md) has since been added and built,
not launched. Local Tauri source reveals a different relative profile path than
the original proposal; the [path confirmation gate](../.project-os/planning/TASK-024.native-path-resolution-gate.yaml)
must be resolved first. Record actual native evidence before final TASK-024
evaluation and the independent TASK-025 audit. No native profile has been opened
or created through the application at that pre-approval checkpoint.

DEC-035 subsequently approved the actual QA path. Partial direct native evidence
now confirms reveal gating and a committed ACK before response. Root fixed poor
button contrast in `9719e06`; after restarting the corrected binary, Windows
locked before restoration. See [native resume](TASK-024_NATIVE_QA.md). Actual
post-restart durability, response/reload and enlarged-text/archive inspection
remain pending; no final task acceptance is claimed.
