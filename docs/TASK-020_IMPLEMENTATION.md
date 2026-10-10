# TASK-020 — Campaign persistence candidate

Status: implementation candidate; **not accepted**. TASK-020 remains active.
DEC-028 records the human's approval of the physical layout. Existing incident and
discovery stores, frozen scenarios and UI are unchanged. No production campaign
definition is created and no old progress is automatically adopted.

## Completed

- Separate IndexedDB database `orpheus.campaign`, version 1, `runs` store with
  `runId` keyPath. Only initial creation is allowed; unknown version/layout fails
  without upgrade, deletion, replacement or fallback.
- Strict whole-record replay verification against injected exact campaign and
  scenario versions. Projections, associations and receipts are verified caches.
- Same-transaction read/revision check/write; stable duplicate delivery reconciles
  before revision checking and verifies the original candidate prefix. Changed
  identity payloads, stale new writes and divergent history are rejected.
- Caller payload snapshot before asynchronous work. Success is acknowledged only
  on transaction completion, not on `put`/`get` request success. Aborts and quota
  failures retain the previous committed head.
- Read-only legacy previews of both original slot/archive byte strings; recheck
  the preview before explicit confirmed adoption. Verify every source against its
  recorded version, reject malformed entries atomically, retain wrapper provenance
  and import only discovery membership. No numeric effects, completion, flags,
  behavior or historical chronology are reconstructed.
- Confirmed eligible unfinished checkpoints create a new baseline attempt without
  erasing prior attempts or recounting inherited inputs/effects. RNG, resources,
  replay prefix and pending work survive reload and continuation. Exact declared
  content variants remain pinned; no implicit latest-version target migration.
- An independently saved old-slot payload can be explicitly associated with a
  verified active attempt. Read-only resume requires its exact bytes and current
  live head. Equal seed/history alone, changed bytes or a superseded head cannot
  establish a resume or silently create an attempt.

## Changed files

`src/persistence/campaign-ledger.ts` owns the injected asynchronous read/commit
adapter. `src/persistence/campaign-legacy.ts` owns read-only preview/recheck ports.
`src/engine/campaign/transitions.ts` adds pure source validation, wrapper provenance,
association operations and read-only association resume. Optional association and
adoption metadata preserve earlier operation/record shapes when absent.

`src/tests/campaign-ledger.test.ts` and `campaign-legacy.test.ts` cover the new
paths. `fake-indexeddb@6.2.5` is a pinned **dev-only** dependency; every storage test
injects a separate memory factory and never opens the platform database. See its
[official implementation](https://github.com/dumbmatter/fakeIndexedDB) and the
[IndexedDB transaction model](https://w3c.github.io/IndexedDB/#transaction-concept).
DEC-028, task context, persistence specification and M4 plan record the approved
scope and current limits. Canonical Project OS state is not manually edited.

## Tests

Root verification: **215 tests / 21 files** passed, including 29 new persistence
cases. Typecheck, lint, formatting, eight scenario-file validations, web build,
Project OS doctor and diff check passed. The existing non-blocking build chunk
warning remains. These are developer checks, not independent acceptance.

Coverage includes hidden state/flags/evidence/history round-trip, reload, pending
continuation, duplicate/lost-ack reconciliation, divergent valid prior provenance,
concurrent writers, request-success then abort, quota/open failures, injected
blocked notification, malformed requests/records, unknown definition/content/schema,
source changes, invalid archive entries, original-byte preservation and stale
association refusal. Existing legacy save/overwrite protection suites still pass.

## Known risks and remaining work

- Independent review, acceptance QA and evaluator handoffs remain required. Earlier
  TASK-019 delegation permission does not extend to TASK-020.
- Memory tests do not prove native WebView capabilities, power-loss durability,
  real quota behavior, blocked upgrades or UI publication. TASK-024/025 integration
  must verify them; action-time permission is needed before touching user saves.
- The old slot, discovery archive and ledger do not share a transaction. Rechecking
  a preview verifies the observed bytes, not a lock against later independent old
  writers. Associations always check the actual slot again before resume.
- Legacy baseline continuation requires a declared exact source version, as in
  TASK-019/DEC-027. Existing approved old-reader target migrations remain unchanged;
  no additional target mapping, projection or rewrite is inferred here.
- Full-history replay and whole-record writes favor verification over scale;
  performance and storage growth are not benchmarked. Equality/replay is not a
  cryptographic authenticity boundary.
- `npm audit` reports a pre-existing indirect dev dependency high-severity warning
  for `source-map-js@1.2.1` (GHSA-68fv-2mgg-jv7q). Its locked version predates this
  change; no broad dependency/security update was performed or certified.

Next recommended step: separately authorize read-only TASK-020 independent review
and QA against the candidate commit, address safe findings, then use configured
Project OS submission/evaluation rules. Do not mark TASK-020 or M4 complete from
developer tests alone.
